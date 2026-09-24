import assert from "node:assert/strict";
import { createHash } from "node:crypto";

// Reuse the representative V2/V3 wire fixtures and their strict producer checks.
const { owner, projection, scope, publicationMeta, semanticDependencies, mobilityDependency, v2, v3 } = await import("./check-global-v2-timeline-query-v3.mjs");
const query = await import("../src/query-api/global-v2/index.ts");
const core = await import("../src/core/global-v2/index.ts");
const comparatorApi = await import("../src/analytics/global-v2/timeline-semantic-comparator.ts");
const snapshotsApi = await import("../src/server/analytics/global-v2-timeline-query.ts");
const planApi = await import("../src/server/analytics/materialization/global-query-plan.ts");
const runtime = await import("../src/server/query/global-v2-runtime.ts");
const productionServices = await import("../src/server/query/global-v2-production-services.ts");
const { GlobalGenerationPin } = await import("../src/server/query/global-generation.ts");

const resource = "analysis_global_life_timeline";
const comparisonResource = "analysis_global_timeline_event_comparison";
const canonical = core.canonicalSerializeGlobal;
const sha = (value) => createHash("sha256").update(canonical(value), "utf8").digest("hex");
const v2Method = query.globalV2TimelineMethodForSchema("global-life-timeline@v2");
const v3Method = query.globalV2TimelineMethodForSchema("global-life-timeline@v3");
assert.ok(v2Method && v3Method);
assert.deepEqual(query.globalV2AcceptedQueryMethodSignatures(resource).slice(0, 2), [v3Method.methodSignature, v2Method.methodSignature]);
assert.equal(query.globalV2TimelineMethodForSchema("unknown@v9"), undefined);

const resourceMeta = (name, params, dependencies, method = v3Method) => ({
  contractVersion: query.globalV2QueryRegistry[name].contractVersion,
  methodSignature: name === resource ? method.methodSignature : query.globalV2ExpectedQueryMethodSignature(name),
  policyVersions: name === resource ? method.policyVersions : query.globalV2QueryRegistry[name].policyVersions,
  resourceInputHash: planApi.globalV2QueryResourceInputHash({ resource: name, scope, params, dependencies }),
});
const comparisonInputs = (snapshots, dependencies) => snapshots.comparisons.map(({ params, payload }) => ({
  resource: comparisonResource, scope, params, dependencies,
  payload: { ...payload, resourceMeta: resourceMeta(comparisonResource, params, dependencies) },
}));
const makePlan = (snapshots, timelineDependencies, comparisonDependencies = semanticDependencies, method = v3Method) => planApi.buildGlobalV2QueryPlan({ instances: [
  { resource, scope, params: {}, dependencies: timelineDependencies, payload: { ...snapshots.timeline, resourceMeta: resourceMeta(resource, {}, timelineDependencies, method) } },
  ...comparisonInputs(snapshots, comparisonDependencies),
] });
const timeline = (plan) => plan.instances.find((instance) => instance.resource === resource);
const comparisons = (plan) => plan.instances.filter((instance) => instance.resource === comparisonResource);
const closure = (plan, key) => plan.closures.find((item) => item.outputKey === key);

const planA = makePlan(v3, [...semanticDependencies, mobilityDependency]);
const mobilityB = { ...mobilityDependency, digest: sha({ alternateEventMobilityOutput: owner.outputHash }) };
const planB = makePlan(v3, [...semanticDependencies, mobilityB]);
assert.notEqual(timeline(planA).resourceInputHash, timeline(planB).resourceInputHash);
assert.notEqual(closure(planA, timeline(planA).key).inputDigest, closure(planB, timeline(planB).key).inputDigest);
assert.ok(closure(planA, timeline(planA).key).dependencies.some((dependency) => dependency.family === mobilityDependency.family && dependency.digest === owner.outputHash));
for (const [left, right] of comparisons(planA).map((item, index) => [item, comparisons(planB)[index]])) {
  assert.equal(left.resourceInputHash, right.resourceInputHash);
  assert.equal(left.methodSignature, right.methodSignature);
  assert.equal(canonical(left.payload), canonical(right.payload));
  assert.equal(closure(planA, left.key).inputDigest, closure(planB, right.key).inputDigest);
  assert.equal(left.dependencies.some((dependency) => dependency.family === mobilityDependency.family), false);
}
assert.deepEqual(query.parseGlobalLifeTimelineV3ReadModel(timeline(planA).payload).events.map(({ eventCost }) => eventCost), query.parseGlobalLifeTimelineV3ReadModel(timeline(planB).payload).events.map(({ eventCost }) => eventCost));

const semanticC = [{ ...semanticDependencies[0], digest: sha({ changedSemanticInput: true }) }];
const planC = makePlan(v3, [...semanticC, mobilityDependency], semanticC);
assert.notEqual(timeline(planA).resourceInputHash, timeline(planC).resourceInputHash);
assert.notEqual(comparisons(planA)[0].resourceInputHash, comparisons(planC)[0].resourceInputHash);

const economicProjection = { ...projection, events: projection.events.map((event, index) => index === 0 ? { ...event, eventCost: { authority: "CANONICAL_LINKED", status: "KNOWN", value: "42" } } : event) };
const economicComparator = comparatorApi.buildTimelineSemanticComparator({ projection: economicProjection });
const economicDependencies = [{ ...semanticDependencies[0], digest: sha(economicProjection) }];
const economicSnapshots = snapshotsApi.buildGlobalTimelineQuerySnapshots({
  projection: economicProjection, comparator: economicComparator, eventMobilityAuthority: owner, publicationMeta,
  resourceMeta: (name, params) => resourceMeta(name, params, name === resource ? [...economicDependencies, mobilityDependency] : economicDependencies),
});
const planD = makePlan(economicSnapshots, [...economicDependencies, mobilityDependency], economicDependencies);
assert.notEqual(timeline(planA).resourceInputHash, timeline(planD).resourceInputHash);
assert.notEqual(comparisons(planA)[0].resourceInputHash, comparisons(planD)[0].resourceInputHash);
assert.notEqual(query.parseGlobalLifeTimelineV3ReadModel(timeline(planA).payload).events[0].eventCost.value, query.parseGlobalLifeTimelineV3ReadModel(timeline(planD).payload).events[0].eventCost.value);

const planV2 = makePlan(v2, semanticDependencies, semanticDependencies, v2Method);
assert.equal(timeline(planV2).methodSignature, v2Method.methodSignature);
assert.equal(planV2.queryVersions.find(({ key }) => key === timeline(planV2).key).methodSignature, v2Method.methodSignature);
assert.equal(query.globalV2QueryRegistry[resource].schema.safeParse(timeline(planV2).payload).success, true);
assert.equal(query.globalV2QueryRegistry[resource].schema.safeParse(timeline(planA).payload).success, true);
assert.equal(query.parseGlobalLifeTimelineRollbackReadModel(timeline(planV2).payload).schemaVersion, "global-life-timeline@v2");
assert.equal(query.parseGlobalLifeTimelineRollbackReadModel(timeline(planA).payload).schemaVersion, "global-life-timeline@v3");
assert.equal(query.parseGlobalLifeTimelineRollbackReadModel(timeline(planV2).payload).events.some((event) => "mobilityContext" in event), false);
assert.equal(query.globalV2QueryRegistry[resource].schema.safeParse({ ...timeline(planV2).payload, events: [{}] }).success, false);
assert.equal(query.globalV2QueryRegistry[resource].schema.safeParse({ ...timeline(planA).payload, mobilityMeta: { fake: true } }).success, false);
assert.equal(query.globalV2QueryRegistry[resource].schema.safeParse({ ...timeline(planA).payload, schemaVersion: "unknown@v9" }).success, false);
assert.throws(() => planApi.buildGlobalV2QueryPlan({ instances: [
  { ...timeline(planV2), payload: { ...timeline(planV2).payload, resourceMeta: { ...timeline(planV2).payload.resourceMeta, methodSignature: "f".repeat(64) } } },
  ...comparisons(planV2),
] }), /RESOURCE_META_MISMATCH/);
assert.throws(() => makePlan({ ...v3, timeline: { ...v3.timeline, schemaVersion: "unknown@v9" } }, [...semanticDependencies, mobilityDependency]), /SCHEMA_UNSUPPORTED/);

const request = { resource, scope, params: {}, expectedGeneration: { publicationId: publicationMeta.publicationId, analyticsRevision: publicationMeta.revision } };
const context = { householdTimeZone: "Europe/Paris", authorizedPersonIds: [] };
const parsedRequest = query.parseGlobalV2QueryRequest(request, context);
const candidateFor = (instance) => ({
  queryKey: query.globalV2QueryCacheKey(parsedRequest), resource, publicationId: publicationMeta.publicationId,
  analyticsRevision: publicationMeta.revision, active: true, invalidated: false, manifestComplete: true, signatureCompatible: true,
  factsHash: publicationMeta.factsHash, manifestHash: publicationMeta.manifestHash, data: instance.payload,
  contractVersion: query.globalV2QueryRegistry[resource].contractVersion,
  methodVersion: query.globalV2TimelineMethodForSchema(instance.payload.schemaVersion).methodVersion,
  methodSignature: instance.methodSignature, policyVersions: instance.policyVersions, resourceInputHash: instance.resourceInputHash,
});
const read = (candidate) => runtime.executeGlobalV2SnapshotQuery(request, { scopeValidationContext: context, authorize: () => true, readSnapshot: () => candidate }, new GlobalGenerationPin());
assert.equal((await read(candidateFor(timeline(planA)))).status, "READY");
assert.equal((await read(candidateFor(timeline(planV2)))).status, "READY");
assert.equal((await read({ ...candidateFor(timeline(planV2)), methodSignature: "f".repeat(64) })).errorCode, "CONTRACT_MISMATCH");
assert.equal((await read({ ...candidateFor(timeline(planA)), methodSignature: v2Method.methodSignature })).errorCode, "CONTRACT_MISMATCH");
assert.equal((await read({ ...candidateFor(timeline(planV2)), data: { ...timeline(planV2).payload, events: [{}] } })).errorCode, "INVALID_SNAPSHOT");
assert.equal((await read({ ...candidateFor(timeline(planA)), data: { ...timeline(planA).payload, mobilityMeta: { fake: true } } })).errorCode, "INVALID_SNAPSHOT");
assert.equal((await read({ ...candidateFor(timeline(planA)), data: { ...timeline(planA).payload, schemaVersion: "unknown@v9" } })).errorCode, "CONTRACT_MISMATCH");
const readProduction = async (instance, methodSignature = instance.methodSignature) => {
  const row = { query_key: instance.key, resource, contract_version: query.globalV2QueryRegistry[resource].contractVersion,
    method_signature: methodSignature, payload: instance.payload, publication_id: publicationMeta.publicationId,
    is_active: true, invalidated_at: null };
  const chain = { select() { return chain; }, eq() { return chain; }, async maybeSingle() { return { data: row, error: null }; } };
  const services = productionServices.createGlobalV2ProductionQueryServices({
    client: { from: () => chain }, context: { timezone: "Europe/Paris", personIds: [] },
    generation: { publicationId: publicationMeta.publicationId, analyticsRevision: publicationMeta.revision,
      scope, publicationMeta, requiredQueryKeys: [instance.key] },
  });
  return runtime.executeGlobalV2SnapshotQuery(request, services, new GlobalGenerationPin());
};
assert.equal((await readProduction(timeline(planA))).status, "READY");
assert.equal((await readProduction(timeline(planV2))).status, "READY");
assert.equal((await readProduction(timeline(planV2), "f".repeat(64))).errorCode, "CONTRACT_MISMATCH");
assert.equal(planA.requiredQueryKeys.length, planV2.requiredQueryKeys.length);
assert.equal(planA.requiredQueryKeys.length, planA.instances.length);
assert.equal(planA.externalQueryRefs.length, 0);
assert.equal(comparisons(planA).length, comparisons(planB).length);
assert.equal(comparisons(planA).length, comparisons(planV2).length);

console.log(JSON.stringify({ result: "PASS", v2Signature: v2Method.methodSignature, v3Signature: v3Method.methodSignature,
  timelineDependencyFamilies: timeline(planA).dependencies.map(({ authority, family, identity }) => ({ authority, family, identity })),
  comparisonDependencyFamilies: comparisons(planA)[0].dependencies.map(({ authority, family, identity }) => ({ authority, family, identity })),
  comparisonSnapshotsBefore: comparisons(planA).length, comparisonSnapshotsAfter: comparisons(planB).length,
  eventMobilityTimelineInvalidated: true, eventMobilityComparatorStable: true, semanticAndEconomicInvalidation: true,
  v2RuntimeReady: true, v3RuntimeReady: true, unknownSchemaRejected: true, fakeSignatureRejected: true }));
