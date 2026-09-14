import "server-only";

import { Temporal } from "@js-temporal/polyfill";
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex, utf8ToBytes } from "@noble/hashes/utils.js";
import { canonicalSerializeGlobal, parseGlobalAnalysisScopeV2, parseGlobalTimeWindowPolicy, parseGlobalValueProvenance, assertGlobalDependencyClosure, computeGlobalDependencyDeclarationDigest } from "@/core/global-v2";
import { parseLocalDate, parseYearMonth } from "@/core/time";
import type { CanonicalRepository } from "@/server/canonical/repository";
import { canonicalString } from "@/server/canonical/record";
import { FactSourceResolver } from "./fact-source-resolver";
import {
  projectRelationshipPersonDays,
  projectRelationshipRestaurantOutcomes,
  projectRelationshipWorkContexts,
  type RelationshipActivityParticipation,
} from "@/analytics/global-v2/relationship-fact-adapter";
import { createGlobalM5DependencyDeclaration } from "@/analytics/global-v2/relationship-dependencies";
import type { GlobalPersonRegimeAuthority } from "@/analytics/global-v2/person-regime-authority";
import { GlobalTemporalBoundaryResolver } from "@/analytics/global-v2/temporal-boundary";

const digest = (value: unknown) => bytesToHex(sha256(utf8ToBytes(canonicalSerializeGlobal(value))));

/** Read-only production wiring. No snapshot, oracle or certificate is an input.
 * P04 regime evidence is upstream-only (before M5 enrichment); absent evidence
 * is a local exclusion, not an invented homogeneous regime.
 */
export async function resolveGlobalM5PersonAuthority(input: {
  readonly repository: CanonicalRepository;
  readonly scope: unknown;
  readonly regimeAuthority?: GlobalPersonRegimeAuthority;
}) {
  const { repository } = input;
  const context = repository.context;
  const scope = parseGlobalAnalysisScopeV2(input.scope, { householdTimeZone: context.timezone, authorizedPersonIds: context.personIds });
  if (scope.subject.kind !== "person") throw new TypeError("M5_PERSON_CATALOG_REQUIRES_PERSON_SCOPE");
  if (scope.time.asOf > context.asOf) throw new TypeError("M5_RUNTIME_ASOF_MISMATCH");
  if (Object.values(scope.filters).some((values) => values.length)) throw new TypeError("M5_FILTER_PROVIDER_NOT_RESOLVED");
  const personId = scope.subject.personId;
  if (input.regimeAuthority && input.regimeAuthority.personId !== personId) throw new TypeError("M5_CROSS_PERSON_REGIME");
  const declaration = createGlobalM5DependencyDeclaration({ personScope: { kind: "PERSON", personId }, authorizedPersonIds: context.personIds, grain: "PERSON_DAY" });
  if (input.regimeAuthority?.status !== "KNOWN") {
    const gate = {
      status: input.regimeAuthority?.status ?? "UNKNOWN",
      reasonCodes: ["AUTHORITY_GATED_CURRENT_REGIME"],
      personId: String(personId),
      certifiedThrough: scope.time.certifiedThrough,
    };
    return {
      evaluationStatus: "AUTHORITY_GATED" as const,
      reasonCodes: ["AUTHORITY_GATED_CURRENT_REGIME"] as const,
      scope: { householdId: String(context.householdId), personId: String(personId), certifiedThrough: scope.time.certifiedThrough },
      relationships: [] as const,
      insights: [] as const,
      executedRelationshipStages: [] as const,
      dependencyDeclaration: declaration,
      sourceHash: digest(gate),
      inputHash: digest({ gate, declaration: computeGlobalDependencyDeclarationDigest(declaration) }),
      providerStatus: { restaurant: "AUTHORITY_GATED", workContext: "AUTHORITY_GATED", personalDailyFinance: "AUTHORITY_GATED", shared: "AUTHORITY_GATED", regime: "AUTHORITY_GATED" } as const,
      exceptionPolicy: "NOT_USED_V1" as const,
      seasonPolicy: "NOT_REQUIRED" as const,
      liveWrites: "NONE" as const,
    };
  }
  const closure = JSON.parse(input.regimeAuthority.result.closure) as { regime: { start: string }; boundary: string };
  const regimeStart = parseYearMonth(closure.regime.start);
  parseYearMonth(closure.boundary);
  if (closure.boundary !== scope.time.certifiedThrough.slice(0, 7)) throw new TypeError("M5_REGIME_BOUNDARY_MISMATCH");
  if (input.regimeAuthority.result.status !== "KNOWN" || !input.regimeAuthority.result.structuralReferenceEligible) throw new TypeError("M5_INVALID_KNOWN_REGIME_AUTHORITY");
  const regimeId = `p04-regime:${digest(input.regimeAuthority)}`;
  const resolver = new FactSourceResolver(repository); // Never a legacy Minimal source.
  const periods = context.periods.filter((period) => period.householdId === context.householdId && period.month.slice(0, 7) <= scope.time.certifiedThrough.slice(0, 7) && (regimeStart === undefined || period.month.slice(0, 7) >= regimeStart)).sort((a, b) => a.month.localeCompare(b.month));
  if (new Set(periods.map((period) => period.month)).size !== periods.length) throw new TypeError("M5_DUPLICATE_ANALYSIS_PERIOD");
  const personDays = [], occurrences = [];
  for (const period of periods) {
    const month = parseYearMonth(period.month.slice(0, 7));
    const personScope = { subject: { kind: "person" as const, personId }, time: { kind: "month" as const, month } };
    const householdScope = { subject: { kind: "household" as const }, time: { kind: "month" as const, month } };
    const [days, activities] = await Promise.all([resolver.loadPersonDays(personScope), resolver.loadActivityOccurrences(householdScope)]);
    personDays.push(...days.filter((day) => day.personId === personId && day.localDate <= scope.time.certifiedThrough));
    occurrences.push(...activities.filter((event) => event.startDate <= scope.time.certifiedThrough
      && ["repas_restaurant", "travail_site", "teletravail"].includes(String(event.activityId))));
  }
  const participationRows = await repository.loadLifeEventParticipationRows([...new Set(occurrences.map((fact) => String(fact.lifeEventId)))]);
  const participations: readonly RelationshipActivityParticipation[] = participationRows.map((row) => {
    const status = canonicalString(row, ["participation_status"], "life_events");
    if (status !== "Confirmée" && status !== "Déduite" && status !== "Inconnue") throw new TypeError("M5_INVALID_PARTICIPATION_STATUS");
    const lifeEventId = canonicalString(row, ["life_event_id"], "life_events");
    const personDayId = canonicalString(row, ["person_day_id"], "life_events");
    const participationPersonId = canonicalString(row, ["person_id"], "life_events");
    return {
      lifeEventId,
      personDayId,
      personId: participationPersonId,
      status,
      evidenceRef: `life_event_participation:${lifeEventId}:${personDayId}:${participationPersonId}:${status}`,
    };
  });
  const dependencyDigests: Record<string, string> = { [regimeId]: digest(input.regimeAuthority) };
  const register = (ref: string, value: unknown) => {
    const valueDigest = digest(value);
    if (dependencyDigests[ref] && dependencyDigests[ref] !== valueDigest) throw new TypeError(`M5_CONTRADICTORY_DEPENDENCY:${ref}`);
    dependencyDigests[ref] = valueDigest;
  };
  for (const day of personDays) register(`fct_person_day:${day.personDayId}`, { personDayId: day.personDayId, personId: day.personId, householdId: day.householdId, localDate: day.localDate, householdTimeZone: day.householdTimeZone });
  for (const fact of occurrences) register(`fct_activity_occurrence:${fact.lifeEventId}`, { lifeEventId: fact.lifeEventId, activityId: fact.activityId, startDate: fact.startDate, endDate: fact.endDate, participantIds: [...fact.participantIds].sort(), validationStatus: fact.validationStatus });
  for (const participation of participations) register(participation.evidenceRef, participation);
  for (const period of periods) register(`analysis-period:${period.month.slice(0, 7)}`, { month: period.month, isClosed: period.isClosed, lifeStatus: period.lifeStatus, sourceRevision: period.sourceRevision });
  const calendar = personDays.map((day) => {
    const calendarClass = Temporal.PlainDate.from(day.localDate).dayOfWeek >= 6 ? "WEEKEND" as const : "WEEKDAY" as const;
    const evidenceRef = `calendar:${context.timezone}:${day.localDate}`;
    register(evidenceRef, { localDate: day.localDate, householdTimeZone: context.timezone, calendarClass, method: "iso-calendar-weekday@v1" });
    return { personDayId: String(day.personDayId), calendarClass, evidenceRef };
  });
  const contexts = projectRelationshipWorkContexts({ householdId: String(context.householdId), personId: String(personId), personDays, occurrences, participations });
  for (const workContext of contexts) register(workContext.authorityRef, workContext);
  const days = projectRelationshipPersonDays({ householdId: context.householdId, personId, regimeId, personDays, contexts, calendar });
  const completeLifeMonths = periods.filter((period) => period.isClosed && period.lifeStatus === "complete" && Temporal.PlainDate.from(period.month).with({ day: 1 }).add({ months: 1 }).subtract({ days: 1 }).toString() <= scope.time.certifiedThrough).map((period) => period.month.slice(0, 7));
  const outcomes = projectRelationshipRestaurantOutcomes({ householdId: context.householdId, personId, days, occurrences, participations, completeLifeMonths });
  const candidates = days.map((day) => ({ unitId: day.id, authority: "CERTIFIED_HISTORY" as const, start: parseLocalDate(day.date), end: parseLocalDate(day.date), eligible: true, observed: day.personDayObservable, comparable: day.excludedReasons.length === 0, methodExcluded: day.excludedReasons.length > 0, dependencyRefs: [...day.evidenceRefs, ...day.calendarEvidenceRefs, regimeId] }));
  const observedDates = new Set(days.map((day) => day.date));
  for (const period of periods) {
    const month = period.month.slice(0, 7);
    for (let date = Temporal.PlainDate.from(`${month}-01`); date.toString().startsWith(month) && date.toString() <= scope.time.certifiedThrough; date = date.add({ days: 1 })) {
      if (!observedDates.has(date.toString())) candidates.push({ unitId: `missing-person-day:${personId}:${date}`, authority: "CERTIFIED_HISTORY", start: parseLocalDate(date.toString()), end: parseLocalDate(date.toString()), eligible: true, observed: false, comparable: false, methodExcluded: false, dependencyRefs: [`analysis-period:${month}`, regimeId] });
    }
  }
  const provenance = parseGlobalValueProvenance({ resultNature: "OBSERVED", precision: "EXACT", integrationMode: "DERIVED_FROM_OBSERVED", monetaryBasis: "AUTHORITATIVE_ECONOMIC", sourceRefs: ["canonical:person_days", "canonical:life_events", "canonical:life_event_participations", "canonical:analysis_periods"], factRefs: ["fct_person_day", "fct_activity_occurrence"], evidenceRefs: Object.keys(dependencyDigests).sort(), entityRefs: [], upstreamMetricRefs: [regimeId], policyVersions: { relationshipCatalog: "v2", activityObservation: "v1", calendar: "v1", workContext: "v1" }, dataRevision: context.dataRevision, analyticsRevision: context.analyticsRevision });
  const resolution = new GlobalTemporalBoundaryResolver().resolve({
    scope,
    policy: parseGlobalTimeWindowPolicy({ policyId: "relationship-comparable-certified-window", policyVersion: "v1", naturalGrain: "PERSON_DAY", corpus: "CERTIFIED_HISTORY", lookback: { kind: "ALL_RELIABLE" }, gapPolicy: "PRESERVE", comparableIntersection: "EXACT_NATURAL_UNIT" }),
    supportPolicy: { policyRef: "relationship-observable-unit@v1", minimumRequired: 1, strongAt: 1 },
    candidates,
    certifiedProvenance: provenance,
  });
  const consumption = { factDependencyIds: ["fct_person_day", "fct_activity_occurrence"], entityDependencyIds: ["analysis_periods", "life_event_types", "life_event_participations"], upstreamAnalyticsIds: ["global-current-regime"], otherModuleDependencyIds: ["GlobalTemporalBoundaryResolver", "GlobalMaterialityEngine"], policyIds: ["relationshipCatalog", "relationshipMatching", "relationshipStatistics", "relationshipFdr", "relationshipLomo", "relationshipMateriality"] };
  assertGlobalDependencyClosure(declaration, consumption);
  const sourceHash = digest(Object.entries(dependencyDigests).sort(([a], [b]) => a.localeCompare(b)));
  const analysis = { householdId: String(context.householdId), personId: String(personId), regimeId, householdTimeZone: context.timezone, asOf: scope.time.asOf, certifiedThrough: scope.time.certifiedThrough, sourceRevision: Number(context.dataRevision), analyticsRevision: Number(context.analyticsRevision), days, outcomes, dependencyDigests };
  return {
    evaluationStatus: "READY_FOR_PRODUCT" as const,
    reasonCodes: [] as const,
    scope: { householdId: String(context.householdId), personId: String(personId), certifiedThrough: scope.time.certifiedThrough },
    analysis,
    missingPersonDayDates: resolution.window.gapDates,
    resolution,
    relationships: [] as const,
    insights: [] as const,
    executedRelationshipStages: [] as const,
    dependencyDeclaration: declaration,
    sourceHash,
    inputHash: digest({ analysis, resolution: resolution.resolutionHash, sourceHash, declaration: computeGlobalDependencyDeclarationDigest(declaration) }),
    providerStatus: { restaurant: "CANONICAL_PARTICIPATION_CONNECTED", workContext: "CANONICAL_PARTICIPATION_CONNECTED", personalDailyFinance: "AUTHORITY_GATED", shared: "AUTHORITY_GATED", regime: "P04_CONNECTED" } as const,
    exceptionPolicy: "NOT_USED_V1" as const,
    seasonPolicy: "NOT_REQUIRED" as const,
    liveWrites: "NONE" as const,
  };
}
