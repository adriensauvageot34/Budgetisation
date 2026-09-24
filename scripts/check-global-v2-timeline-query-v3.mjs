import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { registerHooks } from "node:module";
import { pathToFileURL } from "node:url";

const root = process.cwd();
registerHooks({ resolve(specifier, context, nextResolve) {
  if (specifier === "server-only") return { url: "data:text/javascript,export{}", shortCircuit: true };
  const target = specifier.startsWith("@/") ? pathToFileURL(path.join(root, "src", specifier.slice(2))).href : specifier;
  try { return nextResolve(target, context); } catch (error) {
    if ((!target.startsWith(".") && !target.startsWith("file:")) || /\.[cm]?[jt]sx?$/u.test(target)) throw error;
    for (const candidate of [`${target}.ts`, `${target}/index.ts`]) try { return nextResolve(candidate, context); } catch { /* continue */ }
    throw error;
  }
} });

const query = await import("../src/query-api/global-v2/index.ts");
const core = await import("../src/core/global-v2/index.ts");
const comparatorApi = await import("../src/analytics/global-v2/timeline-semantic-comparator.ts");
const snapshotsApi = await import("../src/server/analytics/global-v2-timeline-query.ts");
const planApi = await import("../src/server/analytics/materialization/global-query-plan.ts");
const { buildGlobalM7EventMobilityAuthority } = await import("../src/analytics/global-v2/event-mobility.ts");

const digest = (value) => createHash("sha256").update(core.canonicalSerializeGlobal(value), "utf8").digest("hex");
const emptyOwner = buildGlobalM7EventMobilityAuthority({ mobilityLegs: [], trips: [], memberships: [], contextLinks: [], contextResolutions: [] });
const ref = (n) => `life-event:e${n}`;
const baseSummary = (n, status) => ({
  eventRef: ref(n), targetKind: "LIFE_EVENT", relationTypes: ["STOP_CONTEXT"], validationStatus: "CONFIRMED",
  mobilityCostMetric: { metricId: "mobility_usage_estimated_fuel_cost", methodVersion: emptyOwner.costMetricId, provenance: "estimated", monetaryBasis: "estimated_cost" },
  monetaryNature: "ESTIMATED_MOBILITY_USAGE", additivity: { withinSummary: "UNION_UNIQUE_MOBILITY_LEGS", acrossSummaries: "NON_ADDITIVE_RECOMPUTE_ON_TARGET_GROUP" },
  methodVersion: emptyOwner.methodVersion, policyVersion: emptyOwner.policyVersion, evidenceRefs: [], inputHash: digest({ n, status }), status,
  coverage: { state: status === "KNOWN" ? "COMPLETE" : status, basis: status === "KNOWN" ? "FULL_ENVELOPING_TRIP" : status === "PARTIAL" ? "ANCHORED_STOP_LEGS" : status === "AMBIGUOUS" ? "ASSOCIATED_CONTEXT" : status === "UNKNOWN" ? "NO_PROVEN_MOBILITY" : "EXPLICIT_NO_MOBILITY", policyRef: emptyOwner.policyVersion },
  ...(status === "KNOWN" || status === "PARTIAL" ? { physicalLegCount: 1, tripCount: 1, distanceKm: n === 1 ? "0" : "10.123456789", estimatedFuelLiters: "1.234567891", estimatedFuelCost: "2.123456789" } : {}),
});
const summaries = [baseSummary(1, "KNOWN"), baseSummary(2, "PARTIAL"), baseSummary(3, "AMBIGUOUS"), baseSummary(4, "UNKNOWN"), baseSummary(5, "NOT_APPLICABLE"), baseSummary(7, "KNOWN")];
const ownerBody = { methodVersion: emptyOwner.methodVersion, policyVersion: emptyOwner.policyVersion, costMetricId: emptyOwner.costMetricId, summaries, physicalUnionTotals: emptyOwner.physicalUnionTotals, inputHash: digest(summaries.map(({ inputHash }) => inputHash)), liveWrites: "NONE" };
const owner = { ...ownerBody, outputHash: digest(ownerBody) };

const semanticClassification = { taxonomyVersion: "timeline_semantic_taxonomy@v1", close: { key: "visite_ami", label: "Visite à des amis" }, intermediate: { key: "visites_et_liens_sociaux", label: "Visites & liens sociaux" }, grand: { key: "relations_et_evenements_de_vie", label: "Relations & événements de vie" } };
const events = Array.from({ length: 6 }, (_, index) => ({
  eventRef: ref(index + 1), sourceKind: "LIFE_EVENT", canonicalName: `Événement ${index + 1}`, startDate: `2026-01-0${index + 1}`, endDate: `2026-01-0${index + 1}`,
  visibilityTier: index === 0 ? "PRINCIPAL" : "EXTENDED", semanticClassification,
  sourceOntology: { typeKey: "visit", typeLabel: "Visite", familyKey: "visite_ami" },
  eventCost: index === 0 ? { authority: "CANONICAL_LINKED", status: "KNOWN", value: "0" } : { authority: "NONE", status: "UNKNOWN" },
  places: [{ placeRef: "place:one", label: "Lieu A" }], participants: { count: 2, participantRefs: ["person:a", "person:b"] },
  ...(index === 1 ? { spentDuringContext: { status: "PARTIAL", total: "20", componentCount: 1 } } : {}),
  momentDetailAvailable: false,
}));
const projection = { methodVersion: "timeline-semantic-projection@v1", sourceRevision: 8, sortContract: "startDate ASC, eventRef ASC", events, counts: { topLevel: events.length, principal: 1, extendedOnly: events.length - 1 } };
const comparator = comparatorApi.buildTimelineSemanticComparator({ projection });
const hash = (character) => character.repeat(64);
const publicationMeta = { publicationId: "00000000-0000-4000-8000-000000000001", revision: 108, factsHash: hash("a"), generatedAt: "2026-09-24T00:00:00Z", profileId: "global-v2-household@v1", manifestHash: hash("b") };
const scope = core.normalizeGlobalAnalysisScopeV2({ subject: { kind: "household" }, time: { kind: "global_v2", asOf: "2026-09-24T00:00:00Z", certifiedThrough: "2026-07-31" } }, { householdTimeZone: "Europe/Paris", authorizedPersonIds: [] });
const semanticDependencies = [{ authority: "CANONICAL", family: "timeline_semantic_projection", identity: "timeline-semantic-projection@v1", digest: hash("c"), required: true }];
const mobilityDependency = { authority: "METRIC", family: "global_event_mobility_owner_output", identity: "GlobalM7EventMobilityAuthority:EVENT_MOBILITY", digest: owner.outputHash, required: true };
const timelineDependencies = [...semanticDependencies, mobilityDependency];
const meta = (resource, params) => ({ contractVersion: query.globalV2QueryRegistry[resource].contractVersion, methodSignature: planApi.globalV2QueryMethodSignature(resource), policyVersions: query.globalV2QueryRegistry[resource].policyVersions, resourceInputHash: planApi.globalV2QueryResourceInputHash({ resource, scope, params, dependencies: resource === "analysis_global_life_timeline" ? timelineDependencies : semanticDependencies }) });
const common = { projection, comparator, publicationMeta, resourceMeta: meta };
const v2 = snapshotsApi.buildGlobalTimelineQuerySnapshots(common);
const v3 = snapshotsApi.buildGlobalTimelineQuerySnapshots({ ...common, eventMobilityAuthority: owner });
const second = snapshotsApi.buildGlobalTimelineQuerySnapshots({ ...common, eventMobilityAuthority: owner });
const parsedV2 = query.parseGlobalLifeTimelineV2ReadModel(v2.timeline);
const parsedV3 = query.parseGlobalLifeTimelineV3ReadModel(v3.timeline);
assert.equal(v3.timeline.schemaVersion, "global-life-timeline@v3");
assert.equal(query.globalV2QueryRegistry.analysis_global_life_timeline.methodVersion, "analysis_global_life_timeline@v3");
assert.equal(query.globalV2QueryRegistry.analysis_global_life_timeline.contractVersion, "global-v2-query@v1");
assert.equal(query.globalV2QueryRegistry.analysis_global_timeline_event_comparison.methodVersion, "analysis_global_timeline_event_comparison@v2");
assert.deepEqual(query.globalV2QueryRegistry.analysis_global_timeline_event_comparison.policyVersions, { projection: "timeline-semantic-projection@v1", comparator: "timeline-semantic-comparator@v2", transport: "global-v2-snapshot-only@sh05-v2" });
assert.equal(query.globalV2AcceptedQueryMethodSignatures("analysis_global_life_timeline").length, 3);
const oldV2Signature = digest({ resource: "analysis_global_life_timeline", contractVersion: "global-v2-query@v1", methodVersion: "analysis_global_life_timeline@v2", policyVersions: { projection: "timeline-semantic-projection@v1", comparator: "timeline-semantic-comparator@v2", transport: "global-v2-snapshot-only@sh05-v2" } });
assert.ok(query.globalV2AcceptedQueryMethodSignatures("analysis_global_life_timeline").includes(oldV2Signature));
assert.notEqual(query.globalV2ExpectedQueryMethodSignature("analysis_global_life_timeline"), oldV2Signature);
assert.equal(parsedV3.events.length, 6);
assert.deepEqual(parsedV3.events.filter(({ mobilityContext }) => mobilityContext !== undefined).map(({ eventRef }) => eventRef), [ref(1), ref(2)]);
assert.equal(parsedV3.events[0].mobilityContext.status, "KNOWN");
assert.equal(parsedV3.events[1].mobilityContext.status, "PARTIAL");
assert.equal(parsedV3.events[0].mobilityContext.distanceKm, "0");
assert.deepEqual(parsedV3.events[0].eventCost, { authority: "CANONICAL_LINKED", status: "KNOWN", value: "0" });
assert.deepEqual(parsedV3.events[1].eventCost, { authority: "NONE", status: "UNKNOWN" });
assert.equal(parsedV3.events[1].mobilityContext.estimatedFuelCost, "2.123456789");
assert.equal(parsedV3.events[5].mobilityContext, undefined);
assert.equal(v3.timeline.events[0].mobilityContext.length, 7);
assert.equal(v3.timeline.events[2].mobilityContext, undefined);
assert.deepEqual(parsedV3.mobilityMeta, { metricId: "mobility_usage_estimated_fuel_cost", metricMethodVersion: owner.costMetricId, monetaryNature: "ESTIMATED_MOBILITY_USAGE", attributionPolicyVersion: owner.policyVersion, ownerMethodVersion: owner.methodVersion, crossEventAdditivity: "NON_ADDITIVE_RECOMPUTE_ON_TARGET_GROUP" });
for (const key of ["eventRef", "sourceKind", "canonicalName", "startDate", "endDate", "visibilityTier", "semanticClassification", "eventCost", "series", "comparisonLevels", "defaultComparisonLevel", "distinctiveComparisonLevel", "primaryPlaceLabel", "participantCount", "spentDuringContext", "momentDetailAvailable"]) {
  assert.deepEqual(parsedV3.events.map((event) => event[key]), parsedV2.events.map((event) => event[key]), `${key} doit rester identique à V2.`);
}
assert.deepEqual(v3.comparisons, v2.comparisons);
assert.ok(v3.comparisons.length > 0);
assert.equal(JSON.stringify(v3.comparisons).includes("mobilityContext"), false);
assert.equal(JSON.stringify(v3.comparisons).includes("mobilityMeta"), false);
const serialized = JSON.stringify(v3.timeline);
for (const field of ["mobilityLegId", "mobilityTripId", "mobilityTripContextLinkId", "contextResolutionId", "evidenceRefs", "inputHash", "outputHash"]) assert.equal(serialized.includes(`"${field}"`), false);
assert.equal(serialized, JSON.stringify(second.timeline));
assert.deepEqual(v3.timeline.events.map(({ eventRef }) => eventRef), v2.timeline.events.map(({ eventRef }) => eventRef));
assert.equal(v3.timeline.resourceMeta.methodSignature, second.timeline.resourceMeta.methodSignature);
assert.notEqual(planApi.globalV2QueryResourceInputHash({ resource: "analysis_global_life_timeline", scope, params: {}, dependencies: timelineDependencies }), planApi.globalV2QueryResourceInputHash({ resource: "analysis_global_life_timeline", scope, params: {}, dependencies: semanticDependencies }));
assert.equal(planApi.globalV2QueryResourceInputHash({ resource: "analysis_global_timeline_event_comparison", scope, params: {}, dependencies: semanticDependencies }), planApi.globalV2QueryResourceInputHash({ resource: "analysis_global_timeline_event_comparison", scope, params: {}, dependencies: semanticDependencies }));
const plan = planApi.buildGlobalV2QueryPlan({ instances: [
  { resource: "analysis_global_life_timeline", scope, params: {}, payload: v3.timeline, dependencies: timelineDependencies },
  ...v3.comparisons.map(({ params, payload }) => ({ resource: "analysis_global_timeline_event_comparison", scope, params, payload, dependencies: semanticDependencies })),
] });
assert.equal(plan.instances.find(({ resource }) => resource === "analysis_global_life_timeline").payload.schemaVersion, "global-life-timeline@v3");

const rejects = (mutate, pattern) => assert.throws(() => query.parseGlobalLifeTimelineV3ReadModel(mutate(structuredClone(v3.timeline))), pattern);
rejects((value) => ({ ...value, extra: true }), /non autorisée|UNKNOWN|clé/iu);
rejects((value) => ({ ...value, mobilityMeta: { ...value.mobilityMeta, metricId: "wrong" } }), /mobilityMetricId/u);
rejects((value) => ({ ...value, events: value.events.map((event, index) => index === 0 ? { ...event, mobilityContext: ["UNKNOWN", 1, 1, "0", "0", "0", "CONFIRMED"] } : event) }), /mobilityStatus/u);
for (const [index, bad] of [[1, 0], [2, 0], [3, "-1"], [4, "NaN"], [5, "-0.1"], [6, "NOPE"]]) {
  rejects((value) => ({ ...value, events: value.events.map((event, eventIndex) => eventIndex === 0 ? { ...event, mobilityContext: event.mobilityContext.map((entry, tupleIndex) => tupleIndex === index ? bad : entry) } : event) }), /INVALID|non autorisée/iu);
}
rejects((value) => ({ ...value, events: value.events.map((event, index) => index === 0 ? { ...event, mobilityContext: ["KNOWN"] } : event) }), /TUPLE_INVALID/u);
rejects((value) => ({ ...value, events: value.events.map((event, index) => index === 0 ? { ...event, mobilityContext: { status: "KNOWN", physicalLegCount: 1, tripCount: 1, distanceKm: "0", estimatedFuelLiters: "0", estimatedFuelCost: "0", validationStatus: "CONFIRMED", rawLeg: {} } } : event) }), /non autorisée|UNKNOWN|clé/iu);
const forbiddenLogic = ["STOP_CONTEXT", "ACCESS_CONTEXT", "ENVELOPING_CONTEXT", "PRIMARY_CONTEXT", "DESTINATION_CONTEXT", "ORIGIN_CONTEXT", "ASSOCIATED_CONTEXT", "fuelPaidAmount", "bankFuelPayment"];
for (const file of ["src/query-api/global-v2/timeline-v3.ts", "src/server/analytics/global-v2-timeline-query.ts"]) {
  const source = fs.readFileSync(path.join(root, file), "utf8");
  for (const term of forbiddenLogic) assert.equal(source.includes(term), false, `${file} doit rester un transport de summaries : ${term}`);
}
const v2Bytes = new TextEncoder().encode(JSON.stringify(v2.timeline)).byteLength;
const v3Bytes = new TextEncoder().encode(serialized).byteLength;
assert.ok(v3Bytes < 128 * 1024);
console.log(JSON.stringify({ result: "PASS", fixture: "synthetic", v2Bytes, v3Bytes, deltaBytes: v3Bytes - v2Bytes, eventCount: parsedV3.events.length, matchedMobilityContexts: 2, KNOWN: 1, PARTIAL: 1, unmatchedSummaries: 1, remainingBudgetBytes: 128 * 1024 - v3Bytes }));

export { owner, projection, comparator, scope, publicationMeta, semanticDependencies, mobilityDependency, v2, v3 };
