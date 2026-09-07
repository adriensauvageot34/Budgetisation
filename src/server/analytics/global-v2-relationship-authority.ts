import "server-only";

import { Temporal } from "@js-temporal/polyfill";
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex, utf8ToBytes } from "@noble/hashes/utils.js";
import { canonicalSerializeGlobal, parseGlobalAnalysisScopeV2, parseGlobalValueProvenance, assertGlobalDependencyClosure, computeGlobalDependencyDeclarationDigest } from "@/core/global-v2";
import { parseLocalDate, parseYearMonth } from "@/core/time";
import type { CanonicalRepository } from "@/server/canonical/repository";
import { FactSourceResolver } from "./fact-source-resolver";
import { projectRelationshipPersonDays, projectRelationshipRestaurantOutcomes } from "@/analytics/global-v2/relationship-fact-adapter";
import { buildGlobalRelationshipTemporalEvidence } from "@/analytics/global-v2/relationship-temporal";
import { createGlobalM5DependencyDeclaration } from "@/analytics/global-v2/relationship-dependencies";
import type { buildGlobalCurrentRegime } from "@/analytics/global-v2/temporal-lifecycle";

const digest = (value: unknown) => bytesToHex(sha256(utf8ToBytes(canonicalSerializeGlobal(value))));

/** Read-only production wiring. No snapshot, oracle or certificate is an input.
 * P04 regime evidence is upstream-only (before M5 enrichment); absent evidence
 * is a local exclusion, not an invented homogeneous regime.
 */
export async function resolveGlobalM5PersonAuthority(input: {
  readonly repository: CanonicalRepository;
  readonly scope: unknown;
  readonly regime?: { readonly personId: string; readonly result: ReturnType<typeof buildGlobalCurrentRegime> };
}) {
  const { repository } = input;
  const context = repository.context;
  const scope = parseGlobalAnalysisScopeV2(input.scope, { householdTimeZone: context.timezone, authorizedPersonIds: context.personIds });
  if (scope.subject.kind !== "person") throw new TypeError("M5_PERSON_CATALOG_REQUIRES_PERSON_SCOPE");
  if (scope.time.asOf > context.asOf) throw new TypeError("M5_RUNTIME_ASOF_MISMATCH");
  if (Object.values(scope.filters).some((values) => values.length)) throw new TypeError("M5_FILTER_PROVIDER_NOT_RESOLVED");
  const personId = scope.subject.personId;
  if (input.regime && input.regime.personId !== personId) throw new TypeError("M5_CROSS_PERSON_REGIME");
  let regimeStart: string | undefined;
  if (input.regime) {
    const closure = JSON.parse(input.regime.result.closure) as { regime: { start: string }; boundary: string };
    parseYearMonth(closure.regime.start); parseYearMonth(closure.boundary);
    if (closure.boundary !== scope.time.certifiedThrough.slice(0, 7)) throw new TypeError("M5_REGIME_BOUNDARY_MISMATCH");
    if (input.regime.result.status === "KNOWN" && input.regime.result.structuralReferenceEligible) regimeStart = closure.regime.start;
  }
  const regimeId = input.regime ? `p04-regime:${digest(input.regime)}` : "p04-regime:unresolved";
  const resolver = new FactSourceResolver(repository); // Never a legacy Minimal source.
  const periods = context.periods.filter((period) => period.householdId === context.householdId && period.month.slice(0, 7) <= scope.time.certifiedThrough.slice(0, 7) && (regimeStart === undefined || period.month.slice(0, 7) >= regimeStart)).sort((a, b) => a.month.localeCompare(b.month));
  if (new Set(periods.map((period) => period.month)).size !== periods.length) throw new TypeError("M5_DUPLICATE_ANALYSIS_PERIOD");
  const personDays = [], occurrences = [];
  for (const period of periods) {
    const factScope = { subject: { kind: "person" as const, personId }, time: { kind: "month" as const, month: parseYearMonth(period.month.slice(0, 7)) } };
    const [days, activities] = await Promise.all([resolver.loadPersonDays(factScope), resolver.loadActivityOccurrences(factScope)]);
    personDays.push(...days.filter((day) => day.personId === personId && day.localDate <= scope.time.certifiedThrough));
    occurrences.push(...activities.filter((event) => event.startDate <= scope.time.certifiedThrough && event.activityId === "repas_restaurant"));
  }
  const dependencyDigests: Record<string, string> = { [regimeId]: digest(input.regime ?? { status: "UNKNOWN", reason: "P04_REGIME_NOT_SUPPLIED" }) };
  const register = (ref: string, value: unknown) => {
    const valueDigest = digest(value);
    if (dependencyDigests[ref] && dependencyDigests[ref] !== valueDigest) throw new TypeError(`M5_CONTRADICTORY_DEPENDENCY:${ref}`);
    dependencyDigests[ref] = valueDigest;
  };
  for (const day of personDays) register(`fct_person_day:${day.personDayId}`, { personDayId: day.personDayId, personId: day.personId, householdId: day.householdId, localDate: day.localDate, householdTimeZone: day.householdTimeZone });
  for (const fact of occurrences) register(`fct_activity_occurrence:${fact.lifeEventId}`, { lifeEventId: fact.lifeEventId, activityId: fact.activityId, startDate: fact.startDate, endDate: fact.endDate, participantIds: [...fact.participantIds].sort(), validationStatus: fact.validationStatus });
  for (const period of periods) register(`analysis-period:${period.month.slice(0, 7)}`, { month: period.month, isClosed: period.isClosed, lifeStatus: period.lifeStatus, sourceRevision: period.sourceRevision });
  const calendar = personDays.map((day) => {
    const calendarClass = Temporal.PlainDate.from(day.localDate).dayOfWeek >= 6 ? "WEEKEND" as const : "WEEKDAY" as const;
    const evidenceRef = `calendar:${context.timezone}:${day.localDate}`;
    register(evidenceRef, { localDate: day.localDate, householdTimeZone: context.timezone, calendarClass, method: "iso-calendar-weekday@v1" });
    return { personDayId: String(day.personDayId), calendarClass, evidenceRef };
  });
  const projected = projectRelationshipPersonDays({ householdId: context.householdId, personId, regimeId, personDays, contexts: [], calendar });
  const days = projected.map((day) => ({ ...day, excludedReasons: regimeStart === undefined ? ["AUTHORITY_GATED_CURRENT_REGIME"] : [] }));
  const completeLifeMonths = periods.filter((period) => period.isClosed && period.lifeStatus === "complete" && Temporal.PlainDate.from(period.month).with({ day: 1 }).add({ months: 1 }).subtract({ days: 1 }).toString() <= scope.time.certifiedThrough).map((period) => period.month.slice(0, 7));
  const outcomes = projectRelationshipRestaurantOutcomes({ householdId: context.householdId, personId, days, occurrences, completeLifeMonths });
  const candidates = days.map((day) => ({ unitId: day.id, authority: "CERTIFIED_HISTORY" as const, start: parseLocalDate(day.date), end: parseLocalDate(day.date), eligible: true, observed: day.personDayObservable, comparable: day.excludedReasons.length === 0, methodExcluded: day.excludedReasons.length > 0, dependencyRefs: [...day.evidenceRefs, ...day.calendarEvidenceRefs, regimeId] }));
  const observedDates = new Set(days.map((day) => day.date));
  for (const period of periods) {
    const month = period.month.slice(0, 7);
    for (let date = Temporal.PlainDate.from(`${month}-01`); date.toString().startsWith(month) && date.toString() <= scope.time.certifiedThrough; date = date.add({ days: 1 })) {
      if (!observedDates.has(date.toString())) candidates.push({ unitId: `missing-person-day:${personId}:${date}`, authority: "CERTIFIED_HISTORY", start: parseLocalDate(date.toString()), end: parseLocalDate(date.toString()), eligible: true, observed: false, comparable: false, methodExcluded: false, dependencyRefs: [`analysis-period:${month}`, regimeId] });
    }
  }
  const provenance = parseGlobalValueProvenance({ resultNature: "OBSERVED", precision: "EXACT", integrationMode: "DERIVED_FROM_OBSERVED", monetaryBasis: "AUTHORITATIVE_ECONOMIC", sourceRefs: ["canonical:person_days", "canonical:life_events", "canonical:life_event_participations", "canonical:analysis_periods"], factRefs: ["fct_person_day", "fct_activity_occurrence"], evidenceRefs: Object.keys(dependencyDigests).sort(), entityRefs: [], upstreamMetricRefs: input.regime ? [regimeId] : [], policyVersions: { relationshipCatalog: "v2", activityObservation: "v1", calendar: "v1" }, dataRevision: context.dataRevision, analyticsRevision: context.analyticsRevision });
  const result = buildGlobalRelationshipTemporalEvidence({
    scope, certifiedProvenance: provenance,
    analysis: { householdId: context.householdId, personId, regimeId, householdTimeZone: context.timezone, asOf: scope.time.asOf, certifiedThrough: scope.time.certifiedThrough, sourceRevision: Number(context.dataRevision), analyticsRevision: Number(context.analyticsRevision), days, outcomes, dependencyDigests },
    candidates,
  });
  const declaration = createGlobalM5DependencyDeclaration({ personScope: { kind: "PERSON", personId }, authorizedPersonIds: context.personIds, grain: "PERSON_DAY" });
  const consumption = { factDependencyIds: ["fct_person_day", "fct_activity_occurrence"], entityDependencyIds: ["analysis_periods", "life_event_types"], upstreamAnalyticsIds: input.regime ? ["global-current-regime"] : [], otherModuleDependencyIds: ["GlobalTemporalBoundaryResolver", "GlobalMaterialityEngine"], policyIds: ["relationshipCatalog", "relationshipMatching", "relationshipStatistics", "relationshipFdr", "relationshipLomo", "relationshipMateriality"] };
  assertGlobalDependencyClosure(declaration, consumption);
  const sourceHash = digest(Object.entries(dependencyDigests).sort(([a], [b]) => a.localeCompare(b)));
  return { ...result, dependencyDeclaration: declaration, sourceHash, inputHash: digest({ engine: result.inputHash, sourceHash, declaration: computeGlobalDependencyDeclarationDigest(declaration) }), providerStatus: { restaurant: "CANONICAL_FACTS_CONNECTED", workContext: "AUTHORITY_GATED", personalDailyFinance: "AUTHORITY_GATED", shared: "AUTHORITY_GATED", regime: regimeStart === undefined ? "AUTHORITY_GATED" : "P04_CONNECTED" }, liveWrites: "NONE" as const };
}
