import "server-only";
import { Temporal } from "@js-temporal/polyfill";
import type { SupabaseClient } from "@supabase/supabase-js";
import { parseLocalDate } from "@/core/time";
import { parsePlannerJsonObject, plannerMonth, plannerString, plannerUuid } from "@/domain/phase2/planner/json";
import { buildGlobalM7PersonalMobilityAuthority } from "@/analytics/global-v2/personal-mobility";
import type { CanonicalRepository } from "@/server/canonical/repository";
import { resolveGlobalM7MobilityContextAuthority } from "@/server/analytics/global-v2-mobility-context-authority";
import { resolveGlobalPersonaProductObservations } from "@/server/analytics/global-v2-persona-signals";
import { resolveGlobalM2NeedSubjects } from "@/server/analytics/global-v2-need-subject-authority";
import { loadMonthForecastAuthorities } from "../live-month-forecast";
import { assembleMonthForecast } from "../month-forecast";
import type { MonthForecast } from "../month-forecast";
import { readMonthPredictionEvidence } from "../month-prediction-evidence";
import { readMonthInputs } from "../month-inputs";
import type { MonthInputs } from "../month-scenario";
import { readPlannedExpenses } from "../planned-expenses";
import type { PersonHabitAssertion, PlanningBaselineSources } from "./baseline-sources";
import { buildPlanningBaseline } from "./baseline";
import { parseActivityCausalFinancialLinks } from "@/analytics/facts";
import { RENEWAL_NEED_KEYS } from "./renewal-engine";

/** Explicit downstream compatibility payload; never accepted by the Baseline builder. */
export const legacySeedDecisions = (inputs: MonthInputs) => parsePlannerJsonObject(inputs.decision ?? {});

export async function readPersonHabitAssertions(client: SupabaseClient, householdId: string,
  authorizedPersonIds: readonly string[], knowledgeCutoff: string): Promise<readonly PersonHabitAssertion[]> {
  const rows: PersonHabitAssertion[] = [];
  const authorized = new Set(authorizedPersonIds);
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await client.from("person_habit_assertions")
      .select("person_habit_assertion_id,person_id,habit_key,monthly_visit_estimate,typical_visit_price,price_basis,authority,validated_at")
      .eq("household_id", plannerUuid(householdId)).lte("validated_at", knowledgeCutoff)
      .order("person_habit_assertion_id").range(offset, offset + 999);
    if (error) throw error;
    for (const row of data ?? []) {
      const personId = plannerUuid(row.person_id);
      if (!authorized.has(personId)) throw new TypeError("BASELINE_HABIT_PERSON_SCOPE_INVALID");
      if (row.authority !== "USER_VALIDATED" || row.price_basis !== "INDICATIVE_PRICE_NOT_PAYMENT") throw new TypeError("BASELINE_HABIT_AUTHORITY_INVALID");
      rows.push({ assertionId: plannerUuid(row.person_habit_assertion_id), personId, habitKey: plannerString(row.habit_key),
        monthlyVisitEstimate: String(row.monthly_visit_estimate), typicalVisitPrice: String(row.typical_visit_price),
        authority: row.authority, priceBasis: row.price_basis, validatedAt: Temporal.Instant.from(row.validated_at).toString() });
    }
    if ((data?.length ?? 0) < 1000) return rows;
  }
}

/** Reads the existing owners only. The repository must already hold the authorized household
 * context. Habit assertions require its trusted server read client (existing SELECT grants).
 * No new credential, Plan read, materialization, migration, or financial evaluation occurs. */
export async function readPlanningBaselineSources(repository: CanonicalRepository, targetMonth: string,
  knowledgeCutoff: string, options: Readonly<{ simpleOccurrences?: boolean; renewals?: boolean; forecast?: MonthForecast }> = {}): Promise<PlanningBaselineSources> {
  const month = plannerMonth(targetMonth), cutoff = Temporal.Instant.from(knowledgeCutoff);
  const { client, context } = repository, householdId = String(context.householdId);
  const today = cutoff.toZonedDateTimeISO(context.timezone).toPlainDate();
  const lastHistorical = Temporal.PlainDate.from(`${month}-01`).subtract({ days: 1 });
  const through = Temporal.PlainDate.compare(today, lastHistorical) < 0 ? today : lastHistorical;
  const firstMonth = context.periods.map(p => p.month.slice(0, 7)).sort()[0];
  if (!firstMonth || `${firstMonth}-01` > through.toString()) throw new TypeError("BASELINE_CANONICAL_PERIODS_UNAVAILABLE");
  const range = { start: parseLocalDate(`${firstMonth}-01`), endExclusive: parseLocalDate(through.add({ days: 1 }).toString()) };
  const simpleRead = async () => {
    if (!options.simpleOccurrences) return undefined;
    const occurrences = await repository.loadActivityOccurrences(range);
    const links = parseActivityCausalFinancialLinks(await repository.loadActivityCausalFinancialLinkRows(occurrences.map(e => e.lifeEventId)));
    return { occurrences, links };
  };
  const [authorities, storedInputs, evidence, plannedExpenses, habitAssertions, productObservations, mobilityLegs, mobilityContext, canonicalPurchases, simpleOccurrences] = await Promise.all([
    loadMonthForecastAuthorities(client, householdId), readMonthInputs(client, householdId, month),
    readMonthPredictionEvidence(client, householdId, month, true, { asOfDate: today.toString(), timezone: context.timezone }),
    readPlannedExpenses(client, householdId, month), readPersonHabitAssertions(client, householdId, context.personIds.map(String), cutoff.toString()),
    resolveGlobalPersonaProductObservations({ repository, certifiedThrough: parseLocalDate(through.toString()) }),
    repository.loadMobilityLegFacts(range), resolveGlobalM7MobilityContextAuthority({ repository, certifiedThrough: through.toString() }),
    repository.loadPurchaseAwareCanonical(range, "PURCHASE_AWARE_PILOT"),
    simpleRead(),
  ]);
  const forecast = options.forecast ? admitPlanningForecast(authorities.publication, month, options.forecast) : assembleMonthForecast(authorities, month);
  if (canonicalPurchases.status !== "PASS") throw new TypeError("BASELINE_PURCHASE_OWNER_BLOCKED");
  // Product owner has already verified the Canonical household scope; resolve the same
  // Need subjects from Canonical person_id, without inferring them from legacy names.
  const needKeys = [...new Set([...productObservations.map(o => o.needKey), ...(options.renewals ? RENEWAL_NEED_KEYS : [])])].sort();
  const needRows: import("@/server/canonical/record").CanonicalRecord[] = [];
  for (let offset = 0; offset < needKeys.length; offset += 100) {
    const { data, error } = await client.from("needs").select("need_id,need_key,person_id").in("need_key", needKeys.slice(offset, offset + 100));
    if (error) throw error;
    needRows.push(...(data ?? []));
  }
  const subjects = resolveGlobalM2NeedSubjects(needRows, context.personIds);
  const needSubjects = Object.fromEntries(needRows.map(row => {
    const id = String(row.need_id), subject = subjects[id];
    if (!subject || subject.scope === "CONFLICT") throw new TypeError("BASELINE_NEED_SUBJECT_CONFLICT");
    return [id, { needKey: plannerString(row.need_key), personId: subject.scope === "PERSONAL" ? String(subject.personId) : null }];
  }));
  const closed = new Set(context.periods.filter(p => p.isClosed && p.sourceRevision !== null && p.locationStatus === "complete"
    && p.month.slice(0, 7) < month && Temporal.PlainYearMonth.from(p.month.slice(0, 7)).toPlainDate({ day: 1 }).add({ months: 1 }).subtract({ days: 1 }).toString() < today.toString()
    && evidence.completeMonthsBySource?.MOBILITY?.includes(p.month.slice(0, 7))).map(p => p.month.slice(0, 7)));
  const closedLegs = mobilityLegs.filter(l => closed.has(l.date.slice(0, 7))), legIds = new Set(closedLegs.map(l => String(l.legId)));
  const mobilityContexts = mobilityContext.contextLinks.filter(c => legIds.has(c.mobilityLegId));
  const personalMobility = buildGlobalM7PersonalMobilityAuthority({ mobilityLegs: closedLegs, contextLinks: mobilityContexts,
    presenceResolutions: mobilityContext.presenceResolutions.filter(p => legIds.has(p.mobilityLegId)) });
  return { householdId, targetMonth: month, knowledgeCutoff: cutoff.toString(), timezone: context.timezone,
    forecast, monthInputs: storedInputs.inputs,
    periods: context.periods, evidence, food: authorities.background.food,
    purchaseFacts: canonicalPurchases.facts.filter(f => f.fact === "fct_purchase_aware_economic_component"), habitAssertions, productObservations,
    needSubjects, mobilityLegs: closedLegs, mobilityContexts, personalMobility, plannedExpenses,
    ...(simpleOccurrences ? { simpleOccurrences } : {}) };
}

/** A published snapshot is already certified by its owner. Match its generation,
 * rather than rebuilding its amounts under today's policies. Both C1 and the
 * financial owner consume this exact admitted forecast for the same read. */
export function admitPlanningForecast(publication: Readonly<{ publication_id: string; source_revision: number; published_analytics_revision: number }>,
  targetMonth: string, forecast: MonthForecast): MonthForecast {
  if (forecast.meta.targetMonth !== targetMonth || forecast.meta.sourcePublicationId !== publication.publication_id
    || forecast.meta.sourceRevision !== publication.source_revision || forecast.meta.analyticsRevision !== publication.published_analytics_revision)
    throw new TypeError("PLANNER_WORLD_AUTHORITIES_CHANGED_DURING_READ");
  return forecast;
}

export async function readPlanningBaseline(repository: CanonicalRepository, targetMonth: string, knowledgeCutoff: string) {
  return buildPlanningBaseline(await readPlanningBaselineSources(repository, targetMonth, knowledgeCutoff));
}
