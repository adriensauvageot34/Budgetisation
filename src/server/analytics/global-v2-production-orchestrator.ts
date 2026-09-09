import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  buildGlobalActivityRhythm,
  buildGlobalPersonaDifferences,
  buildGlobalPersonaMetrics,
  buildGlobalSharedAnalysis,
  buildGlobalTransformations,
  projectGlobalSharedActivitiesFromFacts,
  type GlobalPersonaDefinition,
  type GlobalPersonaObservation,
} from "@/analytics/global-v2";
import { buildGlobalM5TransformationFeed } from "@/analytics/global-v2/relationship-m3";
import { parseHouseholdId, type PersonId } from "@/core/identity";
import { normalizeGlobalAnalysisScopeV2 } from "@/core/global-v2";
import { addMonths, parseHouseholdTimeZone, parseInstant, parseLocalDate, parseYearMonth } from "@/core/time";
import {
  getAnalysisPeriods,
  getHouseholdPersons,
  getHouseholdRevision,
} from "@/server/bootstrap/queries";
import { createAuthorizedRuntimeContext, type AuthorizedRuntimeContext } from "@/server/canonical/context";
import { CanonicalRepository } from "@/server/canonical/repository";
import { optionalCanonicalString, type CanonicalRecord } from "@/server/canonical/record";
import { FactSourceResolver } from "./fact-source-resolver";
import { resolveGlobalM1HouseholdAuthority } from "./global-v2-economic-authority";
import { resolveGlobalM2HouseholdAuthority } from "./global-v2-category-needs-authority";
import { resolveGlobalM5PersonAuthority } from "./global-v2-relationship-authority";
import { resolveGlobalM6MomentAuthority } from "./global-v2-moment-authority";
import { resolveGlobalM7PlaceAuthority } from "./global-v2-place-authority";
import { resolveGlobalM8PurchaseAuthority } from "./global-v2-purchase-authority";
import { buildGlobalV2CandidateFromOwnerOutputs, globalV2M6HasPresentationContent, type GlobalV2OwnerOutput, type GlobalV2PresentationLabels } from "./global-v2-candidate";

export const GLOBAL_V2_LIVE_PROJECT = "ipuuhxrblxormwgoaqnz" as const;

function evidence(owner: string, output: unknown): readonly string[] {
  const hash = new TextEncoder().encode(JSON.stringify(output)).byteLength;
  return [`owner:${owner}`, `owner-output-bytes:${owner}:${hash}`].sort();
}

function hasItems(value: unknown, keys: readonly string[]): boolean {
  if (value === null || typeof value !== "object") return false;
  return keys.some((key) => Array.isArray((value as Record<string, unknown>)[key]) && ((value as Record<string, unknown>)[key] as unknown[]).length > 0);
}

function labelsFromRows(rows: readonly CanonicalRecord[], idColumn: string, labelColumn: string): Readonly<Record<string, string>> {
  return Object.fromEntries(rows.flatMap((row) => {
    const id = optionalCanonicalString(row, [idColumn]);
    const label = optionalCanonicalString(row, [labelColumn]);
    return id === undefined || label === undefined ? [] : [[id, label] as const];
  }).sort(([left], [right]) => left.localeCompare(right)));
}

export async function createGlobalV2CandidateContext(input: {
  readonly client: SupabaseClient;
  readonly householdId: string;
  readonly asOf: string;
}): Promise<AuthorizedRuntimeContext> {
  const householdId = parseHouseholdId(input.householdId);
  const [{ data: household, error }, persons, periods, revision] = await Promise.all([
    input.client.from("households").select("household_id,timezone").eq("household_id", householdId).single(),
    getHouseholdPersons(input.client, householdId),
    getAnalysisPeriods(input.client, householdId),
    getHouseholdRevision(input.client, householdId),
  ]);
  if (error !== null) throw error;
  if (revision === null) throw new TypeError("GLOBAL_LIVE_REVISION_MISSING");
  return createAuthorizedRuntimeContext({
    user: { id: "global-v2-read-only-preparation" },
    household: { householdId, timezone: parseHouseholdTimeZone(household.timezone) },
    persons,
    periods,
    revision,
  }, parseInstant(input.asOf));
}

export async function resolveGlobalV2ProductionOwnerOutputs(repository: CanonicalRepository) {
  const { context } = repository;
  const eligiblePeriods = context.periods.filter((period) =>
    period.isClosed
    && period.month <= context.asOf.slice(0, 10)
    && period.financeStatus !== "unknown"
    && period.lifeStatus !== "unknown"
    && period.calendarStatus !== "unknown")
    .sort((left, right) => left.month.localeCompare(right.month));
  const latest = eligiblePeriods.at(-1);
  if (latest === undefined) throw new TypeError("GLOBAL_CERTIFIED_THROUGH_MISSING");
  const certifiedThrough = latest.month.slice(0, 8) + new Date(Date.UTC(Number(latest.month.slice(0, 4)), Number(latest.month.slice(5, 7)), 0)).getUTCDate().toString().padStart(2, "0");
  const scope = normalizeGlobalAnalysisScopeV2({ subject: { kind: "household" }, time: { kind: "global_v2", asOf: context.asOf, certifiedThrough: certifiedThrough as never } }, { householdTimeZone: context.timezone, authorizedPersonIds: context.personIds });
  const targetMonth = parseYearMonth(certifiedThrough.slice(0, 7));
  const resolver = new FactSourceResolver(repository);

  const m8 = await resolveGlobalM8PurchaseAuthority({ repository, scope });
  const [m2, m5, m6, m7] = await Promise.all([
    resolveGlobalM2HouseholdAuthority({ repository, resolver, targetMonth, purchaseAuthority: m8 }),
    Promise.all(context.personIds.map((personId) => resolveGlobalM5PersonAuthority({ repository, scope: { ...scope, subject: { kind: "person", personId } } }))),
    resolveGlobalM6MomentAuthority({ repository, scope }),
    resolveGlobalM7PlaceAuthority({ repository, scope }),
  ]);
  const m1 = m2.m1;

  const occurrenceMonths = eligiblePeriods.map(({ month }) => parseYearMonth(month.slice(0, 7)));
  const occurrences = (await Promise.all(occurrenceMonths.map((month) => resolver.loadActivityOccurrences({ subject: { kind: "household" }, time: { kind: "month", month } })))).flat();
  const personDays = (await Promise.all(context.personIds.flatMap((personId) => occurrenceMonths.map((month) => resolver.loadPersonDays({ subject: { kind: "person", personId }, time: { kind: "month", month } }))))).flat();
  const activityIds = [...new Set(occurrences.map(({ activityId }) => String(activityId)))].sort();
  const rhythms = context.personIds.flatMap((personId) => activityIds.map((activityId) => buildGlobalActivityRhythm({ activityId, personId: String(personId), occurrences, personDays })));

  const relationshipEvolution = m5.flatMap((result) => buildGlobalM5TransformationFeed(result));
  const m3 = buildGlobalTransformations({ series: [], relations: [], relationshipEvolution });

  const definitions: GlobalPersonaDefinition[] = activityIds.map((activityId) => ({
    metricId: `activity-rate:${activityId}`,
    family: "LEISURE_AND_ACTIVITIES",
    grain: "MONTH",
    comparisonMode: "RATE",
    materialityPolicyId: "PERSONA_FREQUENCY",
    allowedDataNatures: ["OBSERVED"],
    exceptionalPolicy: "SEPARATE",
    humanRelevance: "SECONDARY",
    redundancyGroup: `activity-rate:${activityId}`,
    canAppearInTopDifferences: true,
    minimumComparableUnits: 3,
    methodVersion: "global_persona_activity_rate_adapter@v1",
  }));
  const observations: GlobalPersonaObservation[] = rhythms.flatMap((rhythm) => rhythm.monthlyRates.map((point) => ({
    metricId: `activity-rate:${rhythm.activityId}`,
    personId: rhythm.personId as PersonId,
    unitId: point.month,
    value: point.value ?? "0",
    habitualValue: point.value ?? "0",
    exceptionalValue: "0",
    knowledge: point.status,
    observable: point.status === "KNOWN" || point.status === "PARTIAL",
    dataNature: "OBSERVED" as const,
    evidenceRefs: point.dependencyRefs,
  })));
  const personaMetrics = context.personIds.length >= 2 ? buildGlobalPersonaMetrics({ definitions, personIds: context.personIds, observations }) : [];
  const personaDifferences = context.personIds.length >= 2 ? buildGlobalPersonaDifferences({ definitions, personAId: context.personIds[0]!, personBId: context.personIds[1]!, observations, temporalStatusByMetric: Object.fromEntries(definitions.map(({ metricId }) => [metricId, "INSUFFICIENT_TEMPORAL_SUPPORT"])) }) : [];
  const m9 = { definitions, metrics: personaMetrics, differences: personaDifferences, authority: context.personIds.length >= 2 ? "P01_PERSON_ATTRIBUTION_AND_M4_ACTIVITY" : "DATA_GATED_PERSON_PAIR" };

  const sharedUnits = context.personIds.length === 2
    ? projectGlobalSharedActivitiesFromFacts({ occurrences, personIds: [String(context.personIds[0]), String(context.personIds[1])], activityTypeByActivityId: Object.fromEntries(activityIds.map((id) => [id, undefined])) })
    : [];
  const m10 = { units: sharedUnits, universes: buildGlobalSharedAnalysis(sharedUnits), authority: context.personIds.length === 2 ? "CANONICAL_ACTIVITY_PARTICIPATION" : "DATA_GATED_PERSON_PAIR" };

  const categoryIds = m2.result.categories.groups.flatMap(({ dimension }) => dimension.status === "KNOWN" ? [String(dimension.id)] : []);
  const needIds = m2.result.needs.groups.flatMap(({ dimension }) => dimension.status === "KNOWN" ? [String(dimension.id)] : []);
  const placeIds = m7.places.map(({ placeId }) => String(placeId));
  const recurrenceIds = new Set(m1.recurrences.series.map(({ recurrenceId }) => recurrenceId));
  const firstEconomicMonth = m1.history.points[0]?.month ?? targetMonth;
  const [categoryRows, needRows, placeRows, minimalBundle] = await Promise.all([
    repository.loadTaxonomyRows("categories", categoryIds),
    repository.loadNeedRows(needIds),
    repository.loadEntityRows("places", "place_id", placeIds),
    repository.loadMinimalPlanningBundle({
      start: parseLocalDate(`${firstEconomicMonth}-01`),
      endExclusive: parseLocalDate(`${addMonths(targetMonth, 1)}-01`),
    }),
  ]);
  const presentationLabels: GlobalV2PresentationLabels = {
    persons: Object.fromEntries(context.persons.map(({ personId, displayName }) => [String(personId), displayName]).sort(([left], [right]) => left.localeCompare(right))),
    categories: labelsFromRows(categoryRows, "category_id", "nom_canonique"),
    needs: labelsFromRows(needRows, "need_id", "name"),
    places: labelsFromRows(placeRows, "place_id", "nom_canonique"),
    recurrences: labelsFromRows(
      minimalBundle.recurrenceSeries.filter((row) => {
        const id = optionalCanonicalString(row, ["recurrence_series_id"]);
        return id !== undefined && recurrenceIds.has(id);
      }),
      "recurrence_series_id",
      "name",
    ),
  };

  const ownerOutputs: GlobalV2OwnerOutput[] = [
    { moduleKey: "ECONOMIC", owner: "GlobalM1HouseholdAuthority", output: m1, knowledge: m1.state.actual.status, capabilityState: m1.state.actual.status === "KNOWN" ? "AVAILABLE" : "PARTIAL", reasonCodes: [], evidenceRefs: evidence("M1", m1) },
    { moduleKey: "CATEGORIES_NEEDS", owner: "GlobalM2HouseholdAuthority", output: m2, knowledge: "KNOWN", capabilityState: "AVAILABLE", reasonCodes: [], evidenceRefs: evidence("M2", m2) },
    { moduleKey: "TRANSFORMATIONS", owner: "buildGlobalTransformations", output: m3, knowledge: m3.transformations.length > 0 || m3.relationshipChanges !== undefined ? "KNOWN" : "UNKNOWN", capabilityState: m3.transformations.length > 0 || m3.relationshipChanges !== undefined ? "AVAILABLE" : "PARTIAL", reasonCodes: m3.transformations.length > 0 ? [] : ["NO_CERTIFIED_TRANSFORMATION"], evidenceRefs: evidence("M3", m3) },
    { moduleKey: "RHYTHM", owner: "buildGlobalActivityRhythm", output: { rhythms }, knowledge: rhythms.length > 0 ? "KNOWN" : "UNKNOWN", capabilityState: rhythms.length > 0 ? "AVAILABLE" : "PARTIAL", reasonCodes: rhythms.length > 0 ? [] : ["NO_OBSERVABLE_ACTIVITY"], evidenceRefs: evidence("M4", rhythms) },
    { moduleKey: "RELATIONSHIPS", owner: "GlobalM5PersonAuthority", output: m5, knowledge: m5.some((result) => result.insights.length > 0) ? "KNOWN" : "UNKNOWN", capabilityState: "PARTIAL", reasonCodes: ["AUTHORITY_GATED_RELATIONSHIP_PROVIDERS"], evidenceRefs: evidence("M5", m5) },
    { moduleKey: "MOMENTS", owner: "GlobalM6MomentAuthority", output: m6, knowledge: globalV2M6HasPresentationContent(m6) ? "PARTIAL" : "UNKNOWN", capabilityState: "PARTIAL", reasonCodes: globalV2M6HasPresentationContent(m6) ? ["MOMENT_PLACE_FACETS_PARTIAL"] : ["NO_COMPARABLE_MOMENT"], evidenceRefs: evidence("M6", m6) },
    { moduleKey: "GEO_MOBILITY", owner: "GlobalM7PlaceAuthority", output: m7, knowledge: hasItems(m7, ["places", "visits", "placeResults"]) ? "KNOWN" : "UNKNOWN", capabilityState: "PARTIAL", reasonCodes: ["AUTHORITY_GATED_MOBILITY"], evidenceRefs: evidence("M7", m7) },
    { moduleKey: "CONSUMPTION", owner: "GlobalM8PurchaseAuthority", output: m8, knowledge: hasItems(m8, ["events", "merchants"]) ? "PARTIAL" : "UNKNOWN", capabilityState: "PARTIAL", reasonCodes: ["PURCHASE_EVENT_COVERAGE_PARTIAL"], evidenceRefs: evidence("M8", m8) },
    { moduleKey: "PERSONAS", owner: "buildGlobalPersonaMetrics", output: m9, knowledge: personaMetrics.length > 0 ? "PARTIAL" : "UNKNOWN", capabilityState: context.personIds.length >= 2 ? "PARTIAL" : "UNAVAILABLE", reasonCodes: personaMetrics.length > 0 ? ["COMPARABLE_INTERSECTION_REQUIRED"] : ["PERSON_PAIR_UNAVAILABLE"], evidenceRefs: evidence("M9", m9) },
    { moduleKey: "TOGETHER", owner: "SharedParticipationResolver", output: m10, knowledge: m10.universes.length > 0 ? "PARTIAL" : "UNKNOWN", capabilityState: context.personIds.length === 2 ? "PARTIAL" : "UNAVAILABLE", reasonCodes: m10.universes.length > 0 ? ["PARTICIPATION_COVERAGE_VISIBLE"] : ["SHARED_UNIVERSE_UNAVAILABLE"], evidenceRefs: evidence("M10", m10) },
  ];
  return { scope, certifiedThrough, targetMonth, ownerOutputs, presentationLabels };
}

/** Read-only production bridge: this API exposes no materialization store. */
export async function prepareGlobalV2LiveCandidate(input: {
  readonly project: typeof GLOBAL_V2_LIVE_PROJECT;
  readonly client: SupabaseClient;
  readonly context: AuthorizedRuntimeContext;
  readonly implementationIdentity: string;
}) {
  if (input.project !== GLOBAL_V2_LIVE_PROJECT) throw new TypeError("GLOBAL_LIVE_PROJECT_MISMATCH");
  const repository = new CanonicalRepository(input.client, input.context);
  const resolved = await resolveGlobalV2ProductionOwnerOutputs(repository);
  return buildGlobalV2CandidateFromOwnerOutputs({
    project: input.project,
    householdId: String(input.context.householdId),
    householdTimeZone: input.context.timezone,
    personIds: input.context.personIds.map(String),
    asOf: input.context.asOf,
    certifiedThrough: resolved.certifiedThrough,
    dataRevision: String(input.context.dataRevision),
    analyticsRevision: String(input.context.analyticsRevision),
    implementationIdentity: input.implementationIdentity,
    ownerOutputs: resolved.ownerOutputs,
    presentationLabels: resolved.presentationLabels,
  });
}
