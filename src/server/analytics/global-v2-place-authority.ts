import "server-only";

import { Temporal } from "@js-temporal/polyfill";
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex, utf8ToBytes } from "@noble/hashes/utils.js";
import { buildGlobalPlaceMobility, createGlobalM7DependencyDeclaration, GlobalTemporalBoundaryResolver, type GlobalPlaceNode, type GlobalPlaceResolutionLevel } from "@/analytics/global-v2";
import { canonicalSerializeGlobal, parseGlobalAnalysisScopeV2, parseGlobalTimeWindowPolicy, parseGlobalValueProvenance, assertGlobalDependencyClosure, computeGlobalDependencyDeclarationDigest } from "@/core/global-v2";
import { addDays, parseLocalDate } from "@/core/time";
import { canonicalString, optionalCanonicalString } from "@/server/canonical/record";
import type { CanonicalRepository } from "@/server/canonical/repository";

const digest = (value: unknown) => bytesToHex(sha256(utf8ToBytes(canonicalSerializeGlobal(value))));
const levels = new Set<GlobalPlaceResolutionLevel>(["VENUE", "ADDRESS", "SITE", "LOCALITY", "MUNICIPALITY", "REGION"]);
const mapLevel = (value: string | undefined): GlobalPlaceResolutionLevel => value !== undefined && levels.has(value.toUpperCase() as GlobalPlaceResolutionLevel) ? value.toUpperCase() as GlobalPlaceResolutionLevel : "UNKNOWN";

/** Production read path for M7 core. It consumes CanonicalRepository Facts and
 * never reads GPS points, labels, History ReadModels or relationship results. */
export async function resolveGlobalM7PlaceAuthority(input: {
  readonly repository: CanonicalRepository;
  readonly scope: unknown;
}) {
  const { repository } = input, context = repository.context;
  const scope = parseGlobalAnalysisScopeV2(input.scope, { householdTimeZone: context.timezone, authorizedPersonIds: context.personIds });
  if (scope.time.asOf > context.asOf) throw new TypeError("M7_RUNTIME_ASOF_MISMATCH");
  if (Object.values(scope.filters).some((values) => values.length)) throw new TypeError("M7_FILTER_PROVIDER_NOT_RESOLVED");
  const earliestMonth = context.periods.map((period) => period.month.slice(0, 7)).sort()[0] ?? Temporal.PlainDate.from(scope.time.certifiedThrough).subtract({ months: 12 }).toString().slice(0, 7);
  const range = { start: parseLocalDate(`${earliestMonth}-01`), endExclusive: addDays(scope.time.certifiedThrough, 1) };
  const [placeRows, allVisits, allPersonDays, allEconomicFacts, purchaseEvents] = await Promise.all([
    repository.loadEntityRows("places", "place_id"), repository.loadPlaceVisits(range), repository.loadPersonDays(range), repository.loadEconomicFacts(range), repository.loadPurchaseEvents(),
  ]);
  const visits = allVisits.filter((visit) => scope.subject.kind === "household" || visit.personId === scope.subject.personId);
  const personDays = allPersonDays.filter((day) => scope.subject.kind === "household" || day.personId === scope.subject.personId);
  // P01 proves person attribution but M7 has no component-splitting Fact yet.
  // Fail closed instead of publishing a full Household component as personal.
  const economicFacts = scope.subject.kind === "household" ? allEconomicFacts : [];
  const scopedPurchaseEvents = scope.subject.kind === "household" ? purchaseEvents : [];
  const places: GlobalPlaceNode[] = placeRows.map((row) => {
    const placeId = canonicalString(row, ["place_id"], "entities"), parentPlaceId = optionalCanonicalString(row, ["parent_place_id"]);
    const level = mapLevel(optionalCanonicalString(row, ["resolution_level", "niveau_resolution"]));
    return { placeId, ...(parentPlaceId === undefined ? {} : { parentPlaceId }), resolutionLevel: level, evidenceRefs: [`place:${placeId}`] };
  });
  const provenance = parseGlobalValueProvenance({
    resultNature: "OBSERVED", precision: "EXACT", integrationMode: "DERIVED_FROM_OBSERVED", monetaryBasis: "AUTHORITATIVE_ECONOMIC",
    sourceRefs: ["canonical:referentiel_lieu", "canonical:location_occurrences", "canonical:person_days", "canonical:operation_place_canonical"],
    factRefs: ["fct_place_visit", "fct_person_day", "fct_economic_component", "fct_purchase_event"], evidenceRefs: visits.map((visit) => `fct_place_visit:${visit.visitKey}`).sort(), entityRefs: places.map(({ placeId }) => placeId), upstreamMetricRefs: [],
    policyVersions: { placeCorpus: "v1" }, dataRevision: context.dataRevision, analyticsRevision: context.analyticsRevision,
  });
  const boundary = new GlobalTemporalBoundaryResolver().resolve({
    scope,
    policy: parseGlobalTimeWindowPolicy({ policyId: "global-place-certified-corpus", policyVersion: "v1", naturalGrain: "VISIT", corpus: "CERTIFIED_HISTORY", lookback: { kind: "ALL_RELIABLE" }, gapPolicy: "PRESERVE", comparableIntersection: "NOT_REQUIRED" }),
    supportPolicy: { policyRef: "global-place-observable-months@v1", minimumRequired: 1, strongAt: 1 },
    candidates: visits.map((visit) => ({ unitId: String(visit.visitKey), authority: "CERTIFIED_HISTORY" as const, start: visit.localDate, end: visit.localDate, eligible: true, observed: true, comparable: visit.interval.kind === "known", methodExcluded: false, dependencyRefs: [`fct_place_visit:${visit.visitKey}`] })),
    certifiedProvenance: provenance,
  });
  const selectedVisits = visits.filter((visit) => boundary.certifiedUnitIds.includes(String(visit.visitKey)));
  const dependencyDigests: Record<string, string> = {};
  const register = (ref: string, value: unknown) => { const valueDigest = digest(value); if (dependencyDigests[ref] && dependencyDigests[ref] !== valueDigest) throw new TypeError(`M7_CONTRADICTORY_DEPENDENCY:${ref}`); dependencyDigests[ref] = valueDigest; };
  for (const place of places) for (const ref of place.evidenceRefs) register(ref, place);
  for (const visit of selectedVisits) register(`fct_place_visit:${visit.visitKey}`, visit);
  for (const day of personDays) register(`fct_person_day:${day.personDayId}`, day);
  for (const fact of economicFacts) register(`economic-component:${fact.canonicalComponentKey}`, fact);
  for (const event of scopedPurchaseEvents) register(`purchase-event:${event.purchaseEventId}`, event);
  const result = buildGlobalPlaceMobility({ householdId: String(context.householdId), householdTimeZone: context.timezone, certifiedThrough: scope.time.certifiedThrough, places, visits: selectedVisits, personDays, economicFacts, purchaseEvents: scopedPurchaseEvents, dependencyDigests });
  const personScope = scope.subject.kind === "household" ? { kind: "HOUSEHOLD" as const } : { kind: "PERSON" as const, personId: scope.subject.personId };
  const declaration = createGlobalM7DependencyDeclaration({ personScope, authorizedPersonIds: context.personIds, placeIds: places.map(({ placeId }) => placeId) });
  const consumption = { factDependencyIds: ["fct_place_visit", "fct_person_day", "fct_economic_component", "fct_purchase_event"], entityDependencyIds: ["places"], upstreamAnalyticsIds: ["history_shared_doctrines"], otherModuleDependencyIds: ["GlobalTemporalBoundaryResolver", "GlobalMaterialityEngine"], policyIds: ["global-place-certified-corpus", "global-place-observable-months", "global-place-location-and-finance", "global-place-growth-decline", "visitResolution", "visitMerge", "visitDays", "stayEvidence", "placeImportance", "placeLifecycle", "localizedFinance", "placeHierarchy", "mobilityGates", "relationshipReplay"] };
  assertGlobalDependencyClosure(declaration, consumption);
  return { ...result, boundary, dependencyDeclaration: declaration, sourceHash: digest(Object.entries(dependencyDigests).sort(([a], [b]) => a.localeCompare(b))), executionHash: digest({ inputHash: result.inputHash, boundary: boundary.resolutionHash, declaration: computeGlobalDependencyDeclarationDigest(declaration) }), providerStatus: { canonicalPlaces: "CONNECTED", canonicalVisits: "CONNECTED", localizedFinance: economicFacts.length ? "CONNECTED" : scope.subject.kind === "person" ? "AUTHORITY_GATED_PERSON_COMPONENT_SPLIT" : "DATA_GATED", placeRoles: "AUTHORITY_GATED", mobility: "AUTHORITY_GATED" }, liveWrites: "NONE" as const };
}
