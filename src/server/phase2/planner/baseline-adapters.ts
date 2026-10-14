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
import { loadMonthForecastAuthorities, loadPlanningBaselineGlobalContext } from "../live-month-forecast";
import { assembleMonthForecast } from "../month-forecast";
import type { ForecastAuthorities, MonthForecast } from "../month-forecast";
import { readMonthPredictionEvidence } from "../month-prediction-evidence";
import type { MonthPredictionEvidence } from "../remaining-month-forecast";
import { readMonthInputs } from "../month-inputs";
import type { MonthInputs } from "../month-scenario";
import { readPlannedExpenses } from "../planned-expenses";
import type { PersonHabitAssertion, PlanningBaselineSources } from "./baseline-sources";
import { buildPlanningBaseline } from "./baseline";
import { readActivityHistory, type ActivityHistoryStore } from "./activity-history-artifact";
import { RENEWAL_NEED_KEYS } from "./renewal-engine";
import { activityHistoryPeriod } from "./activity-history-period";
import { snapshotHistoryTrace, snapshotWork, snapshotSync } from "./snapshot-observation";
import { readHistoricalBasis, type HistoricalBasisStore } from "./historical-basis";
import { inspectHistoricalM7Basis } from "./historical-m7-basis";

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
  knowledgeCutoff: string, options: Readonly<{ simpleOccurrences?: boolean; renewals?: boolean; forecast?: MonthForecast | Promise<MonthForecast>;
    predictionEvidence?: Promise<MonthPredictionEvidence>; activityHistory?: ActivityHistoryStore; historicalBasis?: HistoricalBasisStore }> = {}): Promise<PlanningBaselineSources> {
  const month = plannerMonth(targetMonth), cutoff = Temporal.Instant.from(knowledgeCutoff);
  const { client, context } = repository, householdId = String(context.householdId);
  const { today, through, range } = activityHistoryPeriod(context, month, knowledgeCutoff);
  const m7BasisPromise = options.historicalBasis && options.simpleOccurrences
    ? inspectHistoricalM7Basis(repository, range, options.historicalBasis) : Promise.resolve(null);
  const simpleRead = async () => {
    if (!options.simpleOccurrences) return undefined;
    const basis = await m7BasisPromise;
    if (basis) return basis.simpleOccurrences;
    return readActivityHistory(repository, range, today.toString(), options.activityHistory, snapshotHistoryTrace);
  };
  const simpleOccurrencesPromise = snapshotWork("ActivityHistory", simpleRead);
  // C1 and M7 use the same owner projection for this exact authorized range.
  // M7 still reads its richer event/participation/location data independently.
  const activityOccurrences = options.simpleOccurrences
    ? { range, facts: simpleOccurrencesPromise.then(result => result!.occurrences) } : undefined;
  type GlobalContext = Readonly<{ kind: "compact"; authorities: Pick<ForecastAuthorities, "publication" | "background"> }>
    | Readonly<{ kind: "full"; authorities: ForecastAuthorities }>;
  const globalPromise = snapshotWork("Publications_Global_Food", async (): Promise<GlobalContext> => options.forecast
    ? { kind: "compact", authorities: await loadPlanningBaselineGlobalContext(client, householdId) }
    : { kind: "full", authorities: await loadMonthForecastAuthorities(client, householdId) });
  const [global, storedInputs, evidence, plannedExpenses, habitAssertions, productObservations, mobilityLegs, mobilityContext, canonicalPurchases, simpleOccurrences] = await snapshotWork("Baseline_ReadBarrier", () => Promise.all([
    globalPromise, snapshotWork("Live_MonthInputs", () => readMonthInputs(client, householdId, month)),
    options.predictionEvidence ?? readMonthPredictionEvidence(client, householdId, month, true, { asOfDate: today.toString(), timezone: context.timezone }),
    snapshotWork("Live_PlannedExpenses", () => readPlannedExpenses(client, householdId, month)), snapshotWork("Habits", () => readPersonHabitAssertions(client, householdId, context.personIds.map(String), cutoff.toString())),
    snapshotWork("Persona_ProductObservations", () => resolveGlobalPersonaProductObservations({ repository, certifiedThrough: parseLocalDate(through.toString()) })),
    snapshotWork("Mobility_Legs", async () => (await m7BasisPromise)?.mobilityLegs ?? repository.loadMobilityLegFacts(range)),
    snapshotWork("Mobility_M7_Context", async () => (await m7BasisPromise)?.mobilityContext ?? resolveGlobalM7MobilityContextAuthority({ repository, certifiedThrough: through.toString(),
      ...(activityOccurrences ? { activityOccurrences } : {}) })),
    readHistoricalBasis(repository, range, options.historicalBasis),
    simpleOccurrencesPromise,
  ]));
  // Source reads depend on the authorized scope/cutoff, not the pending forecast.
  // Admit that exact published generation before exposing any Baseline facts.
  let forecast: MonthForecast;
  if (global.kind === "full") forecast = assembleMonthForecast(global.authorities, month);
  else {
    const suppliedForecast = await options.forecast;
    if (!suppliedForecast) throw new TypeError("PLANNER_FORECAST_REQUIRED_FOR_COMPACT_GLOBAL");
    forecast = admitPlanningForecast(global.authorities.publication, month, suppliedForecast);
  }
  const authorities = global.authorities;
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
  const personalMobility = snapshotSync("Mobility_M7_PersonalBuild", () => buildGlobalM7PersonalMobilityAuthority({ mobilityLegs: closedLegs, contextLinks: mobilityContexts,
    presenceResolutions: mobilityContext.presenceResolutions.filter(p => legIds.has(p.mobilityLegId)) }));
  return { householdId, targetMonth: month, knowledgeCutoff: cutoff.toString(), timezone: context.timezone,
    forecast, monthInputs: storedInputs.inputs,
    periods: context.periods, evidence, food: authorities.background.food,
    purchaseFacts: canonicalPurchases.purchaseFacts, habitAssertions, productObservations,
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
