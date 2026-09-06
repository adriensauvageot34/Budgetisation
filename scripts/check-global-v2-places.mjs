import assert from "node:assert/strict";
import fs from "node:fs";
import { registerHooks } from "node:module";

registerHooks({ resolve(specifier, context, next) {
  try { return next(specifier, context); } catch (error) {
    if (!specifier.startsWith(".") || /\.[cm]?[jt]s$/.test(specifier)) throw error;
    for (const candidate of [`${specifier}.ts`, `${specifier}/index.ts`]) try { return next(candidate, context); } catch { /* next */ }
    throw error;
  }
} });

const {
  buildGlobalPlaceMobility,
  createGlobalM7DependencyDeclaration,
  recertifyGlobalCDForPlaceAndMoment,
} = await import("../src/analytics/global-v2/index.ts");
const { assertGlobalDependencyClosure } = await import("../src/core/global-v2/index.ts");
const { parseMoney } = await import("../src/core/money/index.ts");

let checks = 0;
const check = (fn) => { fn(); checks += 1; };
const uuid = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const householdId = uuid(1), personId = uuid(2);
const places = [
  { placeId: "region", resolutionLevel: "REGION", evidenceRefs: ["place:region"] },
  { placeId: "city", parentPlaceId: "region", resolutionLevel: "MUNICIPALITY", evidenceRefs: ["place:city"] },
  { placeId: "venue", parentPlaceId: "city", resolutionLevel: "VENUE", evidenceRefs: ["place:venue"] },
  { placeId: "other", resolutionLevel: "VENUE", evidenceRefs: ["place:other"] },
  { placeId: "unknown", resolutionLevel: "UNKNOWN", evidenceRefs: ["place:unknown"] },
];
const visit = (id, placeId, start, end, extra = {}) => ({
  fact: "fct_place_visit", householdId, householdTimeZone: "Europe/Paris", visitKey: `visit:${id}`,
  personDayId: `day:${id}`, personId, placeId, localDate: start.slice(0, 10),
  interval: { kind: "known", startedAt: `${start}Z`, endedAt: `${end}Z` }, timePrecision: "exact", sequenceIndex: 1,
  ...extra,
});
const day = (date, n = date) => ({ fact: "fct_person_day", householdId, householdTimeZone: "Europe/Paris", personDayId: `person-day:${n}`, personId, localDate: date, locationObservability: "observable" });
const economic = (id, amount, placeId) => ({
  fact: "fct_economic_component", householdId, householdTimeZone: "Europe/Paris", canonicalComponentKey: `component:${id}`,
  sourceOperation: { kind: "resolved", id: uuid(100 + Number(id)) }, gross: parseMoney(String(amount)), refundApplied: parseMoney("0"), net: parseMoney(String(amount)),
  bankDate: { kind: "known", date: "2026-06-10" }, economicTiming: { kind: "known", segments: [{ segmentKey: `segment:${id}`, timingState: "known", periodStart: "2026-06-10", periodEnd: "2026-06-10", economicMonth: "2026-06", amount: parseMoney(String(amount)) }] },
  person: { kind: "unknown" }, category: { kind: "undetermined" }, subcategory: { kind: "unknown" }, activity: { kind: "unknown" }, merchant: { kind: "unknown" }, moment: { kind: "unknown" },
  canonicalPlace: placeId === undefined ? { kind: "unknown" } : { kind: "resolved", placeId, resolution: "operation_place_canonical" }, necessity: { kind: "unknown" }, behavior: { kind: "unknown" }, lifeScope: { kind: "unknown" },
});
const purchase = (id, componentKey) => ({
  fact: "fct_purchase_event", householdId, householdTimeZone: "Europe/Paris", purchaseEventId: `purchase:${id}`,
  sources: [{ membershipKind: "CONSUMPTION_COMPONENT", kind: "operation", sourceId: `source:${id}`, canonicalComponentKey: componentKey, evidenceRefs: [`purchase-source:${id}`], provenance: "STRUCTURED_CANONICAL_SOURCE" }],
  economicAmount: parseMoney("1"), timing: { status: "KNOWN", precision: "DAY", economicDate: "2026-06-10", economicMonth: "2026-06", authority: "EXPLICIT_CONSUMPTION_SOURCE", evidenceRefs: [`purchase:${id}`] }, provenance: "STRUCTURED_CANONICAL_SOURCE",
});
function dependencies(input) {
  const refs = [
    ...input.places.flatMap((row) => row.evidenceRefs), ...input.visits.map((row) => `fct_place_visit:${row.visitKey}`),
    ...input.personDays.map((row) => `fct_person_day:${row.personDayId}`), ...input.economicFacts.map((row) => `economic-component:${row.canonicalComponentKey}`),
    ...input.purchaseEvents.map((row) => `purchase-event:${row.purchaseEventId}`), ...(input.visitSemantics ?? []).flatMap((row) => row.evidenceRefs),
    ...(input.nightEvidence ?? []).flatMap((row) => row.evidenceRefs), ...(input.roleAssertions ?? []).flatMap((row) => row.evidenceRefs),
    ...(input.economicAttributions ?? []).flatMap((row) => row.evidenceRefs), ...Object.values(input.activityTypesByVisit ?? {}).flatMap((values) => values.map((value) => `activity-type:${value}`)),
    ...Object.values(input.narrativePlaceEvidence ?? {}).flat(),
  ];
  return Object.fromEntries([...new Set(refs)].map((ref) => [ref, `digest:${ref}`]));
}
const build = (partial = {}) => {
  const input = { householdId, householdTimeZone: "Europe/Paris", certifiedThrough: "2026-06-30", places, visits: [], personDays: [], economicFacts: [], purchaseEvents: [], ...partial };
  return buildGlobalPlaceMobility({ ...input, dependencyDigests: dependencies(input) });
};

// GPS or labels are not inputs: absence of a canonical visit remains absence.
const empty = build();
check(() => assert.equal(empty.visits.length, 0));
check(() => assert.equal(empty.places.find(({ placeId }) => placeId === "venue").roleStatus, "UNKNOWN"));
check(() => assert.equal(empty.places.find(({ placeId }) => placeId === "venue").routinePlacePenalty, 1));
const repeatedLabel = build({ places: [{ placeId: "same-label-a", resolutionLevel: "VENUE", label: "Maison", evidenceRefs: ["place:same-label-a"] }, { placeId: "same-label-b", resolutionLevel: "VENUE", label: "Maison", evidenceRefs: ["place:same-label-b"] }] });
check(() => assert.equal(repeatedLabel.places.every(({ roleStatus }) => roleStatus === "UNKNOWN"), true));
check(() => assert.equal(empty.mobilityCapabilities.routes.state, "UNAVAILABLE"));
check(() => assert.equal(empty.mobility.estimatedUsageCost.status, "UNKNOWN"));
check(() => assert.equal(empty.mobility.costSummaries.length, 0));
check(() => assert.equal(empty.mobility.observedFuelDoubleCountPrevented, true));

const passiveShort = build({ visits: [visit("short", "venue", "2026-06-10T08:00:00", "2026-06-10T08:08:00")], visitSemantics: [{ visitKey: "visit:short", visitKind: "STOP", sourceMode: "PASSIVE_LOCATION", evidenceRefs: ["passive:short"] }] });
check(() => assert.equal(passiveShort.visits[0].visitKind, "PASS_THROUGH"));
check(() => assert.equal(passiveShort.places.find(({ placeId }) => placeId === "venue").visitCount, 0));
const broadShort = build({ visits: [visit("broad", "city", "2026-06-10T08:00:00", "2026-06-10T08:15:00")], visitSemantics: [{ visitKey: "visit:broad", visitKind: "STOP", sourceMode: "PASSIVE_LOCATION", evidenceRefs: ["passive:broad"] }] });
check(() => assert.equal(broadShort.visits[0].visitKind, "PASS_THROUGH"));
const explicitShort = build({ visits: [visit("explicit", "venue", "2026-06-10T08:00:00", "2026-06-10T08:05:00")], visitSemantics: [{ visitKey: "visit:explicit", visitKind: "STOP", sourceMode: "EXPLICIT_ACTIVITY_OR_EVENT", evidenceRefs: ["event:explicit"] }] });
check(() => assert.equal(explicitShort.visitDays.length, 1));

const merged = build({ visits: [visit("m1", "venue", "2026-06-10T08:00:00", "2026-06-10T09:00:00"), visit("m2", "venue", "2026-06-10T09:10:00", "2026-06-10T10:00:00")] });
check(() => assert.equal(merged.visits.length, 1));
const gap = build({ visits: [visit("g1", "venue", "2026-06-10T08:00:00", "2026-06-10T09:00:00"), visit("g2", "venue", "2026-06-10T09:16:00", "2026-06-10T10:00:00")] });
check(() => assert.equal(gap.visits.length, 2));
const incompatibleGap = build({ visits: [visit("i1", "venue", "2026-06-10T08:00:00", "2026-06-10T09:00:00"), visit("ix", "other", "2026-06-10T09:03:00", "2026-06-10T09:07:00"), visit("i2", "venue", "2026-06-10T09:10:00", "2026-06-10T10:00:00")] });
check(() => assert.equal(incompatibleGap.visits.filter(({ placeId }) => placeId === "venue").length, 2));
const transit = build({ visits: [visit("transit", "venue", "2026-06-10T08:00:00", "2026-06-10T09:00:00")], visitSemantics: [{ visitKey: "visit:transit", visitKind: "TRANSIT", sourceMode: "CANONICAL_VISIT", evidenceRefs: ["visit-kind:transit"] }] });
check(() => assert.equal(transit.places.find(({ placeId }) => placeId === "venue").visitCount, 0));

const hierarchy = build({ visits: [visit("parent", "city", "2026-06-10T08:00:00", "2026-06-10T09:00:00"), visit("child", "venue", "2026-06-10T08:00:00", "2026-06-10T09:00:00")] });
check(() => assert.equal(hierarchy.visits.filter(({ rollupOnly }) => !rollupOnly).length, 1));
check(() => assert.equal(hierarchy.places.reduce((sum, row) => sum + row.visitCount, 0), 1));
const conflict = build({ visits: [visit("c1", "venue", "2026-06-10T08:00:00", "2026-06-10T09:00:00"), visit("c2", "other", "2026-06-10T08:30:00", "2026-06-10T09:30:00")] });
check(() => assert.equal(conflict.visits.filter(({ status }) => status === "CONFLICT").length, 2));
check(() => assert.equal(conflict.visits.some((row) => Object.hasOwn(row, "durationMinutes")), false));

const overnight = build({ visits: [visit("night", "venue", "2026-06-10T21:00:00", "2026-06-11T02:00:00")], nightEvidence: [{ visitKey: "visit:night", nightDate: "2026-06-10", kind: "EXPLICIT_LODGING", contextId: "stay:1", evidenceRefs: ["lodging:1"] }] });
check(() => assert.equal(overnight.visits.length, 1));
check(() => assert.equal(overnight.visitDays.length, 2));
check(() => assert.equal(overnight.stays[0].nightCount, 1));

const localized = economic("1", 100, "venue"), unknownEconomic = economic("2", 50);
const finance = build({ economicFacts: [localized, unknownEconomic], purchaseEvents: [purchase("1", localized.canonicalComponentKey), purchase("2", unknownEconomic.canonicalComponentKey)] });
check(() => assert.equal(finance.finance.localizedAmountCoverage.ratio, 2 / 3));
check(() => assert.equal(finance.finance.localizedEventCoverage.ratio, 1 / 2));
check(() => assert.equal(finance.finance.rankingMode, "LOCALIZED_ONLY"));
check(() => assert.equal(finance.finance.amountByPlace.find(({ placeId }) => placeId === "venue").amount, "100"));
check(() => assert.equal(finance.finance.amountByPlace.find(({ placeId }) => placeId === "city").amount, "100"));
check(() => assert.equal(finance.finance.attributions.length, 1));
const partiallyAttributed = build({ economicFacts: [unknownEconomic], economicAttributions: [{ attributionId: "attribution:partial", canonicalComponentKey: unknownEconomic.canonicalComponentKey, placeId: "venue", attributedAmount: parseMoney("20"), attributionMode: "DECLARED_PLACE_ATTRIBUTION", economicIdentityRefs: ["allocation:partial"], evidenceRefs: ["declared:partial"] }] });
check(() => assert.equal(partiallyAttributed.finance.localizedAmountCoverage.ratio, .4));
check(() => assert.equal(partiallyAttributed.finance.amountByPlace.find(({ placeId }) => placeId === "venue").amount, "20"));
const belowRankingThreshold = build({ economicFacts: [economic("59", 59, "venue"), economic("41", 41)] });
check(() => assert.equal(belowRankingThreshold.finance.rankingMode, "UNAVAILABLE"));
const globalRankingThreshold = build({ economicFacts: [economic("85", 85, "venue"), economic("15", 15)] });
check(() => assert.equal(globalRankingThreshold.finance.rankingMode, "GLOBAL"));

const causal = build({ economicFacts: [unknownEconomic], economicAttributions: [{ attributionId: "attribution:causal", canonicalComponentKey: unknownEconomic.canonicalComponentKey, placeId: "venue", attributedAmount: parseMoney("50"), attributionMode: "CAUSAL_EVENT_PLACE", economicIdentityRefs: ["life-event:1"], evidenceRefs: ["canonical-causal-place:1"] }] });
check(() => assert.equal(causal.finance.attributions[0].attributionMode, "CAUSAL_EVENT_PLACE"));
const conflictingFinance = build({ economicFacts: [unknownEconomic], economicAttributions: [
  { attributionId: "a", canonicalComponentKey: unknownEconomic.canonicalComponentKey, placeId: "venue", attributedAmount: parseMoney("20"), attributionMode: "DECLARED_PLACE_ATTRIBUTION", economicIdentityRefs: ["component:2"], evidenceRefs: ["declared:a"] },
  { attributionId: "b", canonicalComponentKey: unknownEconomic.canonicalComponentKey, placeId: "other", attributedAmount: parseMoney("20"), attributionMode: "DECLARED_PLACE_ATTRIBUTION", economicIdentityRefs: ["component:2"], evidenceRefs: ["declared:b"] },
] });
check(() => assert.equal(conflictingFinance.finance.conflicts.length, 1));
check(() => assert.equal(conflictingFinance.finance.attributions.length, 0));
check(() => assert.throws(() => build({ economicFacts: [unknownEconomic], economicAttributions: [{ attributionId: "overflow", canonicalComponentKey: unknownEconomic.canonicalComponentKey, placeId: "venue", attributedAmount: parseMoney("51"), attributionMode: "DECLARED_PLACE_ATTRIBUTION", economicIdentityRefs: ["component:2"], evidenceRefs: ["declared:overflow"] }] }), /EXCEEDS_COMPONENT/));

const routine = build({ visits: [visit("routine", "venue", "2026-06-10T08:00:00", "2026-06-10T09:00:00")], roleAssertions: [{ personId, placeId: "venue", role: "HOME", validFrom: "2025-01-01", evidenceRefs: ["role:home"] }] });
check(() => assert.equal(routine.places.find(({ placeId }) => placeId === "venue").routinePlacePenalty, .35));
check(() => assert.equal(routine.places.find(({ placeId }) => placeId === "venue").roleStatus, "ACTIVE_ROUTINE"));
const roleEnded = build({ visits: [visit("ended", "venue", "2025-01-10T08:00:00", "2025-01-10T09:00:00")], roleAssertions: [{ personId, placeId: "venue", role: "PRIMARY_WORK", validFrom: "2024-01-01", validTo: "2025-12-31", evidenceRefs: ["role:ended"] }] });
check(() => assert.equal(roleEnded.places.find(({ placeId }) => placeId === "venue").lifecycle.status, "ROLE_ENDED"));
check(() => assert.equal(build({ places: [{ placeId: "only-known-parent", resolutionLevel: "MUNICIPALITY", evidenceRefs: ["place:only-known-parent"] }] }).places[0].resolutionLevel, "MUNICIPALITY"));

const transitions = build({ visits: [visit("t1", "venue", "2026-06-10T08:00:00", "2026-06-10T09:00:00"), visit("t2", "other", "2026-06-10T10:00:00", "2026-06-10T11:00:00")] });
check(() => assert.equal(transitions.transitions.length, 1));
check(() => assert.equal(transitions.transitions[0].routeKnown, false));
check(() => assert.equal(transitions.transitions[0].distanceKnown, false));

const orderedInput = { visits: [visit("o1", "venue", "2026-06-10T08:00:00", "2026-06-10T09:00:00"), visit("o2", "other", "2026-06-11T08:00:00", "2026-06-11T09:00:00")], personDays: [day("2026-05-10"), day("2026-06-10")] };
const ordered = build(orderedInput), permuted = build({ ...orderedInput, visits: [...orderedInput.visits].reverse(), personDays: [...orderedInput.personDays].reverse(), places: [...places].reverse() });
check(() => assert.equal(ordered.inputHash, permuted.inputHash));
check(() => assert.equal(ordered.outputHash, permuted.outputHash));
check(() => assert.notEqual(ordered.inputHash, build({ ...orderedInput, visits: [visit("o1", "venue", "2026-06-10T08:00:00", "2026-06-10T09:01:00"), orderedInput.visits[1]] }).inputHash));
check(() => assert.throws(() => buildGlobalPlaceMobility({ householdId, householdTimeZone: "Europe/Paris", certifiedThrough: "2026-06-30", places, visits: [visit("missing", "venue", "2026-06-10T08:00:00", "2026-06-10T09:00:00")], personDays: [], economicFacts: [], purchaseEvents: [], dependencyDigests: Object.fromEntries(places.flatMap((row) => row.evidenceRefs.map((ref) => [ref, `digest:${ref}`]))) }), /DEPENDENCY_CLOSURE_MISSING/));

const declaration = createGlobalM7DependencyDeclaration({ personScope: { kind: "HOUSEHOLD" }, authorizedPersonIds: [personId], placeIds: places.map(({ placeId }) => placeId) });
check(() => assert.doesNotThrow(() => assertGlobalDependencyClosure(declaration, { factDependencyIds: ["fct_place_visit", "fct_person_day", "fct_economic_component", "fct_purchase_event"], entityDependencyIds: ["places"], upstreamAnalyticsIds: ["history_shared_doctrines"], otherModuleDependencyIds: ["GlobalTemporalBoundaryResolver", "GlobalMaterialityEngine"], policyIds: ["global-place-certified-corpus", "global-place-observable-months", "global-place-location-and-finance", "global-place-growth-decline", "visitResolution", "visitMerge", "visitDays", "stayEvidence", "placeImportance", "placeLifecycle", "localizedFinance", "placeHierarchy", "mobilityGates", "relationshipReplay"] })));

const replay = recertifyGlobalCDForPlaceAndMoment({ moments: { inputHash: "m6", crossModuleSignals: { m3SeriesEvolution: [] } }, places: empty });
check(() => assert.equal(replay.examinedDefinitions.length, 15));
check(() => assert.equal(replay.examinedDefinitions.every(({ eligible, status }) => !eligible && status === "EXCLUDED_WITH_REASON"), true));
check(() => assert.equal(replay.fdrUniverseChanged, false));
check(() => assert.equal(replay.qValuesChanged, false));
check(() => assert.equal(replay.sourceDependsOnRelationshipResult, false));
check(() => assert.equal(replay.closureDigest.length, 64));

const index = JSON.parse(fs.readFileSync(new URL("../docs/global-v2/GLOBAL_MASTER_INDEX.json", import.meta.url), "utf8"));
check(() => assert.equal(index.requirements.filter(({ owner }) => owner === "P08").length, 173));
check(() => assert.equal(index.tests.filter(({ owner }) => owner === "P08").length, 176));
check(() => assert.equal(index.capabilities.filter(({ owner }) => owner === "P08").length, 29));

console.log(`P08 M7 Places/mobility: ${checks}/${checks} PASS`);
