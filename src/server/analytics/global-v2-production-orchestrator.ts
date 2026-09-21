import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  buildGlobalActivityRhythm,
  buildGlobalActivityCostProfile,
  buildGlobalPersonaDifferences,
  buildGlobalPersonaMetrics,
  buildGlobalSharedAnalysis,
  buildGlobalTransformations,
  projectGlobalM1ActualTransformationSeries,
  projectGlobalM2CategoryTransformationSeries,
  projectGlobalM4ActivityFrequencyTransformationUniverse,
  projectGlobalSharedActivitiesFromFacts,
  selectGlobalPersonRegimeAuthority,
  type GlobalPersonaDefinition,
  type GlobalPersonaObservation,
} from "@/analytics/global-v2";
import { buildGlobalM5Pr03Product } from "@/analytics/global-v2/relationship-product";
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
import { buildGlobalV2PersonaSignals, resolveGlobalPersonaProductObservations } from "./global-v2-persona-signals";
import { resolveGlobalGroceryCandidateAdapter, resolveGlobalTimelineCandidateAdapter } from "./global-v2-candidate-adapters";
import { resolveGlobalMomentComponentPresentation } from "./global-v2-moment-component-presentation";
import { resolveGlobalTimelineSemanticAnalysis } from "./global-v2-timeline-semantic-comparator";
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
  const [m2, m6, m7, productObservations] = await Promise.all([
    resolveGlobalM2HouseholdAuthority({ repository, resolver, targetMonth, purchaseAuthority: m8 }),
    resolveGlobalM6MomentAuthority({ repository, scope }),
    resolveGlobalM7PlaceAuthority({ repository, scope }),
    resolveGlobalPersonaProductObservations({ repository, certifiedThrough: parseLocalDate(certifiedThrough) }),
  ]);
  const m1 = m2.m1;

  const occurrenceMonths = eligiblePeriods.map(({ month }) => parseYearMonth(month.slice(0, 7)));
  const [occurrences, activityCosts, personDays] = await Promise.all([
    Promise.all(occurrenceMonths.map((month) => resolver.loadActivityOccurrences({ subject: { kind: "household" }, time: { kind: "month", month } }))).then((batches) => batches.flat()),
    Promise.all(occurrenceMonths.map((month) => resolver.loadActivityOccurrenceCosts({ subject: { kind: "household" }, time: { kind: "month", month } }))).then((batches) => batches.flat()),
    Promise.all(context.personIds.flatMap((personId) => occurrenceMonths.map((month) => resolver.loadPersonDays({ subject: { kind: "person", personId }, time: { kind: "month", month } })))).then((batches) => batches.flat()),
  ]);
  const activityIds = [...new Set(occurrences.map(({ activityId }) => String(activityId)))].sort();
  const rhythms = context.personIds.flatMap((personId) => activityIds.map((activityId) => buildGlobalActivityRhythm({ activityId, personId: String(personId), occurrences, personDays })));
  const activityCostProfiles = activityIds.map((activityId) => buildGlobalActivityCostProfile({ activityId, occurrences, activityCosts }));

  const baseM3Evaluation = (() => {
    try {
      const baseM3CertifiedMonths = m1.history.points
        .map((point) => ({
          month: parseYearMonth(point.month),
          dependencyRefs: [...new Set([
            ...point.lineage.dependencyRefs,
            ...point.actual.provenance.sourceRefs,
            ...point.actual.provenance.factRefs,
            ...point.actual.provenance.evidenceRefs,
            ...point.actual.provenance.upstreamMetricRefs,
          ])].sort(),
        }))
        .sort((left, right) => left.month.localeCompare(right.month));
      const baseM3M4Series = projectGlobalM4ActivityFrequencyTransformationUniverse({
        certifiedThroughMonth: targetMonth,
        certifiedMonths: baseM3CertifiedMonths,
        occurrences,
        personDays,
        rhythms,
      });
      const baseM3Series = [
        projectGlobalM1ActualTransformationSeries({ householdId: String(context.householdId), authority: m1 }),
        ...projectGlobalM2CategoryTransformationSeries({
          householdId: String(context.householdId),
          result: m2.result,
          monthlyComponents: m2.transformationMonthlyComponents,
          certifiedMonths: m1.history.points,
        }),
        ...baseM3M4Series,
      ];
      const baseM3 = buildGlobalTransformations({
        series: baseM3Series,
        relations: [],
      });
      return { evaluated: true as const, series: baseM3Series, output: baseM3, knowledge: "KNOWN" as const, capabilityState: "AVAILABLE" as const, reasonCodes: [] as const };
    } catch {
      return {
        evaluated: false as const,
        series: [] as const,
        output: { evaluationStatus: "NOT_EVALUATED" as const, methodVersion: "global_transformations_owner_envelope@v1" as const },
        knowledge: "UNKNOWN" as const,
        capabilityState: "UNAVAILABLE" as const,
        reasonCodes: ["TRANSFORMATION_INPUT_UNIVERSE_BUILD_FAILED"] as const,
      };
    }
  })();
  const personRegimeAuthorities = context.personIds.map((personId) => selectGlobalPersonRegimeAuthority({
    personId: String(personId),
    certifiedThrough,
    transformations: baseM3Evaluation.evaluated ? baseM3Evaluation.output.transformations : [],
    series: baseM3Evaluation.series,
  }));
  const m5 = await Promise.all(context.personIds.map((personId) => {
    const regimeAuthority = personRegimeAuthorities.find((authority) => authority.personId === String(personId))!;
    return resolveGlobalM5PersonAuthority({
      repository,
      scope: { ...scope, subject: { kind: "person", personId } },
      regimeAuthority,
    });
  }));
  const m5Product = buildGlobalM5Pr03Product({
    authorizedPersonIds: context.personIds.map(String),
    displayNamesByPersonId: Object.fromEntries(context.persons.map(({ personId, displayName }) => [String(personId), displayName])),
    providers: m5,
  });
  const m5OwnerOutput = m5Product.ownerResults;
  // This downstream feed is built only after the person-regime authorities and
  // M5 product replay. It is never fed back into the same run's regime selector.
  const m5RelationshipEvolution = m5Product.relationshipEvolution;

  const sharedUnits = context.personIds.length === 2
    ? projectGlobalSharedActivitiesFromFacts({ occurrences, personIds: [String(context.personIds[0]), String(context.personIds[1])], activityTypeByActivityId: Object.fromEntries(activityIds.map((id) => [id, undefined])) })
    : [];
  const m10 = { units: sharedUnits, universes: buildGlobalSharedAnalysis(sharedUnits), authority: context.personIds.length === 2 ? "CANONICAL_ACTIVITY_PARTICIPATION" : "DATA_GATED_PERSON_PAIR" };

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
  const historicalM9 = { definitions, metrics: personaMetrics, differences: personaDifferences, authority: context.personIds.length >= 2 ? "P01_PERSON_ATTRIBUTION_AND_M4_ACTIVITY" : "DATA_GATED_PERSON_PAIR" };

  const categoryIds = m2.result.categories.groups.flatMap(({ dimension }) => dimension.status === "KNOWN" ? [String(dimension.id)] : []);
  const subcategoryIds = [...new Set(m2.result.categories.groups.flatMap(({ annualSubcategoryBreakdown }) =>
    annualSubcategoryBreakdown?.flatMap(({ key }) => key.startsWith("__") ? [] : [key]) ?? []))].sort();
  const needIds = m2.result.needs.groups.flatMap(({ dimension }) => dimension.status === "KNOWN" ? [String(dimension.id)] : []);
  const placeIds = m7.places.map(({ placeId }) => String(placeId));
  const recurrenceIds = new Set(m1.recurrences.series.map(({ recurrenceId }) => recurrenceId));
  const firstEconomicMonth = m1.history.points[0]?.month ?? targetMonth;
  const [categoryRows, subcategoryRows, needRows, placeRows, minimalBundle] = await Promise.all([
    repository.loadTaxonomyRows("categories", categoryIds),
    repository.loadTaxonomyRows("subcategories", subcategoryIds),
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
    subcategories: labelsFromRows(subcategoryRows, "subcategory_id", "nom_canonique"),
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
  const [timeline, semanticTimeline, grocery, momentComponentPresentation] = await Promise.all([
    resolveGlobalTimelineCandidateAdapter({ repository, certifiedThrough: parseLocalDate(certifiedThrough), occurrences, m6 }),
    resolveGlobalTimelineSemanticAnalysis({ client: repository.client, repository, certifiedThrough: parseLocalDate(certifiedThrough), occurrences, m6 }),
    Promise.resolve(resolveGlobalGroceryCandidateAdapter({
      months: occurrenceMonths,
      occurrences,
      activityCostProfiles,
      m2MonthlyComponents: m2.transformationMonthlyComponents,
      subcategoryRows,
    })),
    resolveGlobalMomentComponentPresentation({ repository, m6 }),
  ]);
  const candidateAdapters = { timeline, grocery };
  const persona = buildGlobalV2PersonaSignals({
    householdId: context.householdId,
    personIds: context.personIds,
    displayNamesByPersonId: presentationLabels.persons ?? {},
    m1,
    m2,
    m4: { rhythms },
    m6,
    m7,
    m8,
    productObservations,
    m10,
    differences: personaDifferences,
    certifiedThrough: parseLocalDate(certifiedThrough),
  });
  const m9 = {
    ...historicalM9,
    profile: persona.profile,
    signals: persona.signals,
    declarations: persona.declarations,
    adapterVersion: persona.adapterVersion,
    declarationProviderVersion: persona.declarationProviderVersion,
    limitations: persona.limitations,
    capabilities: persona.capabilities,
  };

  const ownerOutputs: GlobalV2OwnerOutput[] = [
    { moduleKey: "ECONOMIC", owner: "GlobalM1HouseholdAuthority", output: m1, knowledge: m1.state.actual.status, capabilityState: m1.state.actual.status === "KNOWN" ? "AVAILABLE" : "PARTIAL", reasonCodes: [], evidenceRefs: evidence("M1", m1) },
    { moduleKey: "CATEGORIES_NEEDS", owner: "GlobalM2HouseholdAuthority", output: m2, knowledge: "KNOWN", capabilityState: "AVAILABLE", reasonCodes: [], evidenceRefs: evidence("M2", m2) },
    { moduleKey: "TRANSFORMATIONS", owner: "buildGlobalTransformations", output: baseM3Evaluation.output, knowledge: baseM3Evaluation.knowledge, capabilityState: baseM3Evaluation.capabilityState, reasonCodes: baseM3Evaluation.reasonCodes, evidenceRefs: evidence("M3", baseM3Evaluation.output) },
    { moduleKey: "RHYTHM", owner: "buildGlobalActivityRhythm", output: { rhythms, activityCostProfiles }, knowledge: rhythms.length > 0 ? "KNOWN" : "UNKNOWN", capabilityState: rhythms.length > 0 ? "AVAILABLE" : "PARTIAL", reasonCodes: rhythms.length > 0 ? [] : ["NO_OBSERVABLE_ACTIVITY"], evidenceRefs: evidence("M4", { rhythms, activityCostProfiles }) },
    { moduleKey: "RELATIONSHIPS", owner: "GlobalM5PersonAuthority", output: m5OwnerOutput, knowledge: m5OwnerOutput.some((result) => result.insights.length > 0) ? "PARTIAL" : "UNKNOWN", capabilityState: m5.every((result) => result.evaluationStatus === "AUTHORITY_GATED") ? "UNAVAILABLE" : "PARTIAL", reasonCodes: m5.every((result) => result.evaluationStatus === "AUTHORITY_GATED") ? ["AUTHORITY_GATED_CURRENT_REGIME"] : ["AUTHORITY_GATED_RELATIONSHIP_PROVIDERS"], evidenceRefs: evidence("M5", { m5OwnerOutput, productPlanDigest: m5Product.plan.planDigest }) },
    { moduleKey: "MOMENTS", owner: "GlobalM6MomentAuthority", output: m6, knowledge: globalV2M6HasPresentationContent(m6) ? "PARTIAL" : "UNKNOWN", capabilityState: "PARTIAL", reasonCodes: globalV2M6HasPresentationContent(m6) ? ["MOMENT_PLACE_FACETS_PARTIAL"] : ["NO_COMPARABLE_MOMENT"], evidenceRefs: evidence("M6", m6) },
    { moduleKey: "GEO_MOBILITY", owner: "GlobalM7PlaceAuthority", output: m7, knowledge: hasItems(m7, ["places", "visits", "placeResults"]) ? "KNOWN" : "UNKNOWN", capabilityState: "PARTIAL", reasonCodes: ["AUTHORITY_GATED_MOBILITY"], evidenceRefs: evidence("M7", m7) },
    { moduleKey: "CONSUMPTION", owner: "GlobalM8PurchaseAuthority", output: m8, knowledge: hasItems(m8, ["events", "merchants"]) ? "PARTIAL" : "UNKNOWN", capabilityState: "PARTIAL", reasonCodes: ["PURCHASE_EVENT_COVERAGE_PARTIAL"], evidenceRefs: evidence("M8", m8) },
    { moduleKey: "TOGETHER", owner: "SharedParticipationResolver", output: m10, knowledge: m10.universes.length > 0 ? "PARTIAL" : "UNKNOWN", capabilityState: context.personIds.length === 2 ? "PARTIAL" : "UNAVAILABLE", reasonCodes: m10.universes.length > 0 ? ["PARTICIPATION_COVERAGE_VISIBLE"] : ["SHARED_UNIVERSE_UNAVAILABLE"], evidenceRefs: evidence("M10", m10) },
    { moduleKey: "PERSONAS", owner: "buildGlobalV2PersonaSignals", output: m9, knowledge: persona.profile.profiles.length > 0 ? "PARTIAL" : personaMetrics.length > 0 ? "PARTIAL" : "UNKNOWN", capabilityState: context.personIds.length > 0 ? "PARTIAL" : "UNAVAILABLE", reasonCodes: persona.limitations, evidenceRefs: evidence("M9", m9) },
  ];
  return { scope, certifiedThrough, targetMonth, ownerOutputs, presentationLabels, candidateAdapters, semanticTimeline, momentComponentPresentation, personRegimeAuthorities, m5Product, m5RelationshipEvolution, persona };
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
    candidateAdapters: resolved.candidateAdapters,
    semanticTimeline: resolved.semanticTimeline,
    momentComponentPresentation: resolved.momentComponentPresentation,
  });
}
