import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { registerHooks } from "node:module";
import { pathToFileURL } from "node:url";

const root = process.cwd();
registerHooks({ resolve(specifier, context, nextResolve) {
  if (specifier === "server-only") return { url: "data:text/javascript,export default {};", shortCircuit: true };
  const target = specifier.startsWith("@/") ? pathToFileURL(path.join(root, "src", specifier.slice(2))).href : specifier;
  try { return nextResolve(target, context); } catch (error) {
    if ((!target.startsWith(".") && !target.startsWith("file:")) || /\.[cm]?[jt]sx?$/u.test(target)) throw error;
    for (const candidate of [`${target}.ts`, `${target}/index.ts`]) {
      try { return nextResolve(candidate, context); } catch { /* continue */ }
    }
    throw error;
  }
} });

const query = await import("../src/query-api/global-v2/index.ts");
const core = await import("../src/core/global-v2/index.ts");
const projectionApi = await import("../src/analytics/global-v2/timeline-semantic-projection.ts");
const comparatorApi = await import("../src/analytics/global-v2/timeline-semantic-comparator.ts");
const snapshotsApi = await import("../src/server/analytics/global-v2-timeline-query.ts");
const planApi = await import("../src/server/analytics/materialization/global-query-plan.ts");

let checks = 0;
const check = (callback) => { callback(); checks += 1; };
const rejects = (callback, pattern) => check(() => assert.throws(callback, pattern));
const hash = (character) => character.repeat(64);
const publicationMeta = { publicationId: "5acd2106-5d92-56ff-8569-623fa622c5fa", revision: 98, factsHash: hash("a"), generatedAt: "2026-09-17T12:00:00Z", profileId: "global-v2-household@v1", manifestHash: hash("b") };
const resourceMeta = { contractVersion: "global-v2-query@v1", methodSignature: hash("c"), policyVersions: { projection: "timeline-semantic-projection@v1", comparator: "timeline-semantic-comparator@v1", transport: "global-v2-snapshot-only@sh05-v1" }, resourceInputHash: hash("d") };
const semantic = { taxonomyVersion: "timeline_semantic_taxonomy@v1", close: { key: "visite_ami", label: "Visite à des amis" }, intermediate: { key: "visites_et_liens_sociaux", label: "Visites & liens sociaux" }, grand: { key: "relations_et_evenements_de_vie", label: "Relations & événements de vie" } };
const event = (index, overrides = {}) => ({
  eventRef: `life-event:${String(index).padStart(4, "0")}`,
  sourceKind: "LIFE_EVENT",
  canonicalName: `E${index}`,
  startDate: "2025-01-01",
  endDate: "2025-01-01",
  visibilityTier: "EXTENDED",
  semanticClassification: semantic,
  eventCost: { authority: "NONE", status: "UNKNOWN" },
  comparisonLevels: [],
  participantCount: 0,
  momentDetailAvailable: false,
  ...overrides,
});

const baseTimeline = { kind: "global_life_timeline", schemaVersion: "global-life-timeline@v2", resource: "analysis_global_life_timeline", moduleKey: "RHYTHM", publicationMeta, resourceMeta };
const compactEvent = (index) => { const { participantCount: _participantCount, ...compact } = event(index, { canonicalName: "E", semanticClassification: { taxonomyVersion: "v", close: { key: "c", label: "C" }, intermediate: { key: "i", label: "I" }, grand: { key: "g", label: "G" } } }); return compact; };
const twoEvents = query.buildGlobalLifeTimelineV2ReadModel({ ...baseTimeline, events: [event(2, { startDate: "2025-01-02", endDate: "2025-01-03" }), event(1)] });
check(() => assert.deepEqual(twoEvents.events.map(({ eventRef }) => eventRef), ["life-event:0001", "life-event:0002"]));
check(() => assert.equal(twoEvents.schemaVersion, "global-life-timeline@v2"));
check(() => assert.equal(JSON.stringify(twoEvents).includes("evidenceRefs"), false));
check(() => assert.equal(JSON.stringify(twoEvents).includes("destinations"), false));
check(() => assert.equal(JSON.stringify(twoEvents).includes("peerObservations"), false));
check(() => assert.deepEqual(query.parseGlobalLifeTimelineV2ReadModel({ ...baseTimeline, events: [event(1, { eventCost: { authority: "CANONICAL_LINKED", status: "KNOWN", value: "0" } })] }).events[0].eventCost, { authority: "CANONICAL_LINKED", status: "KNOWN", value: "0" }));
check(() => assert.equal(query.parseGlobalLifeTimelineV2ReadModel({ ...baseTimeline, events: Array.from({ length: 256 }, (_, index) => compactEvent(index)) }).events.length, 256));
rejects(() => query.parseGlobalLifeTimelineV2ReadModel({ ...baseTimeline, events: Array.from({ length: 257 }, (_, index) => compactEvent(index)) }), /EVENT_LIMIT/);
rejects(() => query.parseGlobalLifeTimelineV2ReadModel({ ...baseTimeline, events: [event(1, { canonicalName: "x".repeat(128 * 1024) })] }), /PAYLOAD_BUDGET/);

check(() => assert.deepEqual(query.parseGlobalV2QueryParams("analysis_global_timeline_event_comparison", { eventRef: "moment:abc", comparisonLevel: "SAME_CLOSE_FAMILY" }), { eventRef: "moment:abc", comparisonLevel: "SAME_CLOSE_FAMILY" }));
rejects(() => query.parseGlobalV2QueryParams("analysis_global_timeline_event_comparison", { eventRef: "moment:abc", comparisonLevel: "SAME_GRAND_FAMILY" }), /comparisonLevel/);
rejects(() => query.parseGlobalV2QueryParams("analysis_global_timeline_event_comparison", { eventRef: "invalid", comparisonLevel: "SAME_SERIES" }), /REF_INVALID/);
rejects(() => query.parseGlobalV2QueryParams("analysis_global_timeline_event_comparison", { eventRef: "moment:abc", comparisonLevel: "SAME_SERIES", extra: true }), /GlobalV2EventComparisonParams/);

const known = (authority = "M6_CAUSAL", value = "10") => ({ authority, status: "KNOWN", value });
const peer = (index) => ({ eventRef: `moment:p${String(index).padStart(3, "0")}`, sourceKind: "MOMENT", canonicalName: `P${index}`, startDate: "2025-01-01", endDate: "2025-01-01", visibilityTier: "EXTENDED", eventCost: known("M6_CAUSAL", String(index)) });
const comparison = (peerCount) => ({
  kind: "global_timeline_event_comparison", schemaVersion: "global-timeline-event-comparison@v1", resource: "analysis_global_timeline_event_comparison", moduleKey: "RHYTHM",
  subject: { eventRef: "life-event:subject", sourceKind: "LIFE_EVENT", canonicalName: "Sujet", startDate: "2025-02-01", endDate: "2025-02-01", visibilityTier: "PRINCIPAL", eventCost: known("CANONICAL_LINKED", "0") },
  comparison: { level: "SAME_CLOSE_FAMILY", label: "Visite à des amis", cohortKey: "close:visite_ami", policyVersion: "timeline-semantic-comparator@v1" },
  support: { status: peerCount < 5 ? "PARTIAL" : "KNOWN", peerCount }, statistics: { median: "10", q1: "5", q3: "15", mad: "5" }, deltas: { absolute: "-10", relative: "-1" },
  materiality: { status: peerCount < 5 ? "UNKNOWN" : "NOT_MATERIAL", policyRef: { id: "global-materiality-moment-short", version: "v1" } }, facetContext: [], peerObservations: Array.from({ length: peerCount }, (_, index) => peer(index)), publicationMeta, resourceMeta,
});
check(() => assert.equal(query.parseGlobalTimelineEventComparisonReadModel(comparison(255)).peerObservations.length, 255));
rejects(() => query.parseGlobalTimelineEventComparisonReadModel(comparison(256)), /SUPPORT_MISMATCH/);
rejects(() => query.parseGlobalTimelineEventComparisonReadModel({ ...comparison(3), support: { status: "PARTIAL", peerCount: 4 } }), /PEER_COUNT_MISMATCH/);
rejects(() => query.parseGlobalTimelineEventComparisonReadModel({ ...comparison(3), peerObservations: comparison(3).peerObservations.map((entry) => ({ ...entry, canonicalName: "x".repeat(40_000) })) }), /PAYLOAD_BUDGET/);

const scopeHash = hash("e");
const params = { eventRef: "life-event:subject", comparisonLevel: "SAME_CLOSE_FAMILY" };
const keyA = planApi.globalV2QueryInstanceKey("analysis_global_timeline_event_comparison", scopeHash, params, "generation-a");
const keyB = planApi.globalV2QueryInstanceKey("analysis_global_timeline_event_comparison", scopeHash, params, "generation-b");
check(() => assert.notEqual(keyA, keyB));
check(() => assert.match(keyA, /analysis_global_timeline_event_comparison/));
rejects(() => planApi.globalV2QueryInstanceKey("analysis_global_timeline_event_comparison", scopeHash, params), /GENERATION_REQUIRED/);

const normalizedScope = core.normalizeGlobalAnalysisScopeV2({ subject: { kind: "household" }, time: { kind: "global_v2", asOf: "2026-09-17T12:00:00Z", certifiedThrough: "2026-09-16" } }, { householdTimeZone: "Europe/Paris", authorizedPersonIds: [] });
const dependencies = [{ authority: "CANONICAL", family: "timeline-semantic", identity: "timeline-semantic@v1", digest: hash("f"), required: true }];
const metaFor = (resource, resourceParams) => ({ contractVersion: query.globalV2QueryRegistry[resource].contractVersion, methodSignature: planApi.globalV2QueryMethodSignature(resource), policyVersions: query.globalV2QueryRegistry[resource].policyVersions, resourceInputHash: planApi.globalV2QueryResourceInputHash({ resource, scope: normalizedScope, params: resourceParams, dependencies }) });
const advertisedEvents = [
  event(1, { eventRef: "life-event:subject", visibilityTier: "PRINCIPAL", eventCost: known("CANONICAL_LINKED", "0"), comparisonLevels: [{ level: "SAME_CLOSE_FAMILY", label: "Visite à des amis", supportStatus: "PARTIAL", peerCount: 3, materiality: "UNKNOWN" }], defaultComparisonLevel: "SAME_CLOSE_FAMILY" }),
  ...Array.from({ length: 3 }, (_, index) => event(index + 2, { eventRef: `moment:p${String(index).padStart(3, "0")}`, sourceKind: "MOMENT", eventCost: known("M6_CAUSAL", String(index)), momentDetailAvailable: true })),
];
// The same-generation authorization gate is exercised with LifeEvents only so no M6 detail resource is needed.
const planTimelineEvents = advertisedEvents.map((entry) => entry.sourceKind === "MOMENT" ? { ...entry, eventRef: `life-event:peer-${entry.eventRef.slice(-3)}`, sourceKind: "LIFE_EVENT", momentDetailAvailable: false } : entry);
const planPeerObservations = planTimelineEvents.slice(1).map((entry) => ({ eventRef: entry.eventRef, sourceKind: entry.sourceKind, canonicalName: entry.canonicalName, startDate: entry.startDate, endDate: entry.endDate, visibilityTier: entry.visibilityTier, eventCost: entry.eventCost }));
const planTimeline = query.buildGlobalLifeTimelineV2ReadModel({ ...baseTimeline, events: planTimelineEvents, resourceMeta: metaFor("analysis_global_life_timeline", {}) });
const planParams = { eventRef: "life-event:subject", comparisonLevel: "SAME_CLOSE_FAMILY" };
const planComparison = query.buildGlobalTimelineEventComparisonReadModel({ ...comparison(3), peerObservations: planPeerObservations, resourceMeta: metaFor("analysis_global_timeline_event_comparison", planParams) });
check(() => assert.equal(planApi.buildGlobalV2QueryPlan({ instances: [
  { resource: "analysis_global_life_timeline", scope: normalizedScope, params: {}, payload: planTimeline, dependencies },
  { resource: "analysis_global_timeline_event_comparison", scope: normalizedScope, params: planParams, payload: planComparison, dependencies },
] }).instances.length, 2));
const unauthorizedParams = { ...planParams, comparisonLevel: "SAME_SERIES" };
const unauthorizedPayload = query.buildGlobalTimelineEventComparisonReadModel({ ...planComparison, resourceMeta: metaFor("analysis_global_timeline_event_comparison", unauthorizedParams) });
rejects(() => planApi.buildGlobalV2QueryPlan({ instances: [
  { resource: "analysis_global_life_timeline", scope: normalizedScope, params: {}, payload: planTimeline, dependencies },
  { resource: "analysis_global_timeline_event_comparison", scope: normalizedScope, params: unauthorizedParams, payload: unauthorizedPayload, dependencies },
] }), /PARAMS_PAYLOAD_MISMATCH|LEVEL_NOT_ADVERTISED/);

const fixturePath = process.argv.find((value) => value.startsWith("--fixture="))?.slice("--fixture=".length) ?? process.env.TIMELINE_IMPLEMENTATION_FIXTURE_PATH;
if (fixturePath !== undefined) {
  const fixture = JSON.parse(fs.readFileSync(fixturePath, "utf8"));
  const eventByFixtureId = new Map(fixture.events.map((entry) => [entry.fixtureEntryId, entry]));
  const identity = (entry) => entry.eventIdentityRef ?? eventByFixtureId.get(entry.fixtureEntryId)?.currentIdentity?.ref ?? `life-event:fixture-${entry.fixtureEntryId.toLowerCase()}`;
  const assertions = fixture.semanticAssertions.map((entry) => {
    const [prefix, id] = identity(entry).split(":", 2);
    return { eventRef: prefix === "moment" ? { sourceKind: "MOMENT", momentId: id } : { sourceKind: "LIFE_EVENT", lifeEventId: id }, visibilityTier: entry.visibilityTier, closeFamilyKey: entry.closeFamilyKey, taxonomyVersion: entry.taxonomyVersion };
  });
  const moments = [];
  const lifeEvents = [];
  for (const assertion of fixture.semanticAssertions) {
    const source = eventByFixtureId.get(assertion.fixtureEntryId);
    const [prefix, id] = identity(assertion).split(":", 2);
    const shared = { typeKey: "fixture", typeLabel: "Fixture", familyKey: "fixture", startDate: source.startDate, endDate: source.endDate, participantRefs: [], places: [] };
    if (prefix === "moment") moments.push({ ...shared, momentId: id, canonicalName: assertion.canonicalName, causalCost: source.cost.targetState === "KNOWN" ? { status: "KNOWN", value: String(source.cost.targetValueEur) } : { status: "UNKNOWN" }, ...(typeof source.series === "string" ? { seriesRef: source.series.split(" ", 1)[0] } : {}) });
    else lifeEvents.push({ ...shared, lifeEventId: id, canonicalTitle: assertion.canonicalName, ownedByCertifiedMoment: false, ...(typeof source.parentRelation === "string" && source.parentRelation.match(/life-event:[0-9a-f-]+/u) ? { parentLifeEventRef: source.parentRelation.match(/life-event:[0-9a-f-]+/u)[0] } : {}), ...(typeof source.series === "string" ? { seriesRef: source.series.split(" ", 1)[0] } : {}) });
  }
  const lifeEventCosts = fixture.costAssertions.map((entry) => ({ lifeEventId: identity(entry).split(":", 2)[1], methodVersion: "timeline-event-cost@v1", authority: entry.targetCostAuthority, status: entry.targetCostAuthority === "NONE" ? "UNKNOWN" : entry.targetCostState, value: entry.targetCostState === "KNOWN" ? String(entry.targetCostValueEur) : null, reasonCode: entry.targetCostAuthority === "NONE" ? "NO_ACTIVE_ASSERTION" : null, componentKeys: entry.expectedComponentKeys }));
  const projection = projectionApi.buildTimelineSemanticProjection({ sourceRevision: 4, moments, lifeEvents, assertions, lifeEventCosts, seriesLabelsByRef: { "moment-series:56c3698c-89b7-57d4-940f-34cb6e5e2362": "Soirées techno" } });
  const comparator = comparatorApi.buildTimelineSemanticComparator({ projection });
  const built = snapshotsApi.buildGlobalTimelineQuerySnapshots({ projection, comparator, publicationMeta, resourceMeta: () => resourceMeta });
  const serialized = JSON.stringify(built.timeline);
  check(() => assert.equal(built.timeline.events.length, 172));
  check(() => assert.ok(Buffer.byteLength(serialized) < 128 * 1024));
  check(() => assert.equal(/["'](?:evidenceRefs|destinations|peerObservations)["']\s*:/u.test(serialized), false));
  check(() => assert.equal(built.comparisons.every(({ payload }) => payload.peerObservations.length === payload.support.peerCount), true));
  check(() => assert.equal(built.comparisons.every(({ payload }) => Buffer.byteLength(JSON.stringify(payload)) < 96 * 1024), true));
  check(() => assert.equal(built.comparisons.every(({ payload }) => payload.comparison.level !== "SAME_GRAND_FAMILY"), true));
}

const frontend = fs.readFileSync(path.join(root, "src", "features", "global-v2", "life-timeline.tsx"), "utf8");
check(() => assert.match(frontend, /Temporary SH-05 presentation bridge/u));
check(() => assert.doesNotMatch(frontend, /medianMoney|moneyQuartiles|MedianAbsoluteDeviation|buildTimelineSemanticComparator/u));

console.log(`Global V2 Timeline Query S6 checks: ${checks} passed${fixturePath === undefined ? " (fixture acceptance not requested)." : "."}`);
