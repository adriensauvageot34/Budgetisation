import assert from "node:assert/strict";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { registerHooks } from "node:module";

const root = process.cwd();
registerHooks({ resolve(specifier, context, next) {
  if (specifier === "server-only") return { url: "data:text/javascript,export{}", shortCircuit: true };
  if (specifier.startsWith("@/")) specifier = pathToFileURL(path.join(root, "src", specifier.slice(2))).href;
  try { return next(specifier, context); } catch (error) {
    if (!specifier.startsWith(".") && !specifier.startsWith("file:")) throw error;
    if (/\.[cm]?[jt]s$/u.test(specifier)) throw error;
    for (const candidate of [`${specifier}.ts`, `${specifier}/index.ts`]) try { return next(candidate, context); } catch { /* next */ }
    throw error;
  }
} });

const core = await import("../src/core/global-v2/index.ts");
const query = await import("../src/query-api/global-v2/index.ts");
const planApi = await import("../src/server/analytics/materialization/global-query-plan.ts");
const materialization = await import("../src/server/analytics/materialization/global-v2.ts");
const runtime = await import("../src/server/query/global-v2-runtime.ts");
const { GlobalGenerationPin } = await import("../src/server/query/global-generation.ts");

let checks = 0;
const check = (fn) => { fn(); checks += 1; };
const checkAsync = async (fn) => { await fn(); checks += 1; };
const rejects = (fn, pattern) => check(() => assert.throws(fn, pattern));
const h = (char) => char.repeat(64);
const context = { householdTimeZone: "Europe/Paris", authorizedPersonIds: [] };
const rawScope = { subject: { kind: "household" }, time: { kind: "global_v2", asOf: "2026-09-06T12:00:00Z", certifiedThrough: "2026-07-31" } };
const normalizedScope = core.normalizeGlobalAnalysisScopeV2(rawScope, context);
const scopeHash = core.computeGlobalAnalysisScopeV2Hash(normalizedScope);
const publicationMeta = { publicationId: "00000000-0000-4000-8000-000000000150", revision: 81, factsHash: h("a"), generatedAt: "2026-09-06T15:00:00Z", profileId: "global-v2-household@v1", manifestHash: h("b") };
const dependencies = [{ authority: "METRIC", family: "global-certified-output", identity: "metric:certified:v1", digest: h("c"), required: true }];
const quality = { knowledgeState: "KNOWN", supportStatus: "SUFFICIENT", effectiveCoverage: 1, dataNature: "OBSERVED", limitationCodes: [], evidenceRefs: ["evidence:certified"] };
const capability = (id, state = "AVAILABLE") => ({ capabilityId: id, state, reasonCodes: state === "AVAILABLE" ? [] : ["AUTHORITY_GATED"] });

const paramsFor = (resource) => {
  if (query.globalV2TopLevelResources.includes(resource)) return {};
  if (query.globalV2ExpandedResourceCatalog.slice(0, 10).some((entry) => entry.resource === resource)) return { sectionKey: "OVERVIEW" };
  if (resource === "analysis_global_methodology") return { methodRef: "method:global-economic@v1", moduleKey: "ECONOMIC" };
  return { entityRef: resource === "analysis_global_category_need_detail" ? "category:food" : `entity:${resource}` };
};
const resourceMeta = (resource, params) => ({
  contractVersion: query.globalV2QueryRegistry[resource].contractVersion,
  methodSignature: planApi.globalV2QueryMethodSignature(resource),
  policyVersions: query.globalV2QueryRegistry[resource].policyVersions,
  resourceInputHash: planApi.globalV2QueryResourceInputHash({ resource, scope: normalizedScope, params, dependencies }),
});
const instanceKey = (resource, params = paramsFor(resource)) => planApi.globalV2QueryInstanceKey(resource, scopeHash, params);

const availableExpanded = query.globalV2ExpandedResourceCatalog.filter(({ resource }) => query.globalV2QueryRegistry[resource].availability === "AVAILABLE");
const expandedInputs = availableExpanded.map(({ resource, moduleKey, capabilityId }, index) => {
  const params = paramsFor(resource);
  const destinations = index === 0 ? [
    { targetId: "category-detail", kind: "GLOBAL_QUERY", resource: "analysis_global_category_need_detail", instanceKey: instanceKey("analysis_global_category_need_detail"), scopeHash, sourcePublicationId: publicationMeta.publicationId, sourceAnalyticsRevision: publicationMeta.revision },
    { targetId: "entity-merchant", kind: "ENTITY", resource: "entity_merchant", entityRef: "merchant:grocer", scopeHash, sourcePublicationId: publicationMeta.publicationId, sourceAnalyticsRevision: publicationMeta.revision },
    { targetId: "history-month", kind: "HISTORY", resource: "history_month_balance_summary", scopeHash, sourcePublicationId: publicationMeta.publicationId, sourceAnalyticsRevision: publicationMeta.revision },
    { targetId: "operations", kind: "OPERATIONS", resource: "operations_browse", scopeHash, sourcePublicationId: publicationMeta.publicationId, sourceAnalyticsRevision: publicationMeta.revision },
  ] : [];
  const payload = query.buildGlobalExpandedReadModel({
    kind: "global_expanded", schemaVersion: "global-expanded@v1", resource, moduleKey,
    sectionKey: resource === "analysis_global_methodology" ? "METHODOLOGY" : "OVERVIEW", visibility: "VISIBLE",
    secondaryInsights: [],
    metrics: index === 0 ? [
      { metricId: "actual", labelKey: "global.actual", displayValue: "3 000 €", knowledgeState: "KNOWN", dataNature: "OBSERVED", evidenceRefs: ["evidence:actual"] },
      { metricId: "typical", labelKey: "global.typical", displayValue: "2 800 €", knowledgeState: "KNOWN", dataNature: "OBSERVED", evidenceRefs: ["evidence:typical"] },
    ] : [],
    series: index === 0 ? [{ seriesId: "economic", labelKey: "global.economic", unit: "EUR", points: [{ unitKey: "2026-06", displayValue: "2 900 €", knowledgeState: "KNOWN" }, { unitKey: "2026-07", displayValue: "3 000 €", knowledgeState: "KNOWN" }], evidenceRefs: ["evidence:series"] }] : [],
    rows: index === 0 ? [
      { rowId: "category-food", labelKey: "category.food", displayValue: "900 €", knowledgeState: "KNOWN", entityRef: "category:food", evidenceRefs: ["evidence:food"] },
      { rowId: "category-home", labelKey: "category.home", displayValue: "1 200 €", knowledgeState: "KNOWN", entityRef: "category:home", evidenceRefs: ["evidence:home"] },
    ] : [],
    destinations, quality, capabilities: [capability(capabilityId)], publicationMeta, resourceMeta: resourceMeta(resource, params),
  });
  return { resource, scope: normalizedScope, params, payload, dependencies };
});

const moduleInputs = query.globalPrimaryModuleCatalog.map((entry) => {
  const params = {};
  const expandedResource = `${entry.resource}_expanded`;
  const payload = {
    kind: "global_module_compact", schemaVersion: "global-module-compact@v1", moduleKey: entry.moduleKey, resource: entry.resource, order: entry.order,
    visibility: "VISIBLE", kpis: [], quality, capabilities: [capability(`GLOBAL_${entry.moduleKey}`)],
    detailEntries: [{ entryId: `expanded:${entry.moduleKey}`, labelKey: "global.detail", targetResource: expandedResource, targetRef: instanceKey(expandedResource) }],
    publicationMeta, resourceMeta: resourceMeta(entry.resource, params),
  };
  return { resource: entry.resource, scope: normalizedScope, params, payload, dependencies };
});

const initialModules = moduleInputs.map(({ payload }) => payload);
const initialPayload = query.buildGlobalInitialReadModel({ modules: initialModules, capabilities: [capability("GLOBAL_V2")], resourceMeta: resourceMeta("analysis_global_manifest", {}) });
const summaryPayload = query.buildImportedGlobalSummaryReadModel({ kind: "global_imported_summary", schemaVersion: "global-imported-summary@v1", status: "MISSING", publicationMeta, resourceMeta: resourceMeta("analysis_global_summary_ai", {}) });
const inputs = [
  { resource: "analysis_global_manifest", scope: normalizedScope, params: {}, payload: initialPayload, dependencies },
  { resource: "analysis_global_summary_ai", scope: normalizedScope, params: {}, payload: summaryPayload, dependencies },
  ...moduleInputs,
  ...expandedInputs,
];

query.assertGlobalV2QueryRegistryComplete();
check(() => assert.equal(Object.keys(query.globalV2QueryRegistry).length, 34));
check(() => assert.deepEqual(query.globalV2TopLevelResources.slice(0, 2), ["analysis_global_manifest", "analysis_global_summary_ai"]));
check(() => assert.equal(query.globalV2QueryRegistry.analysis_global_product_detail.availability, "AUTHORITY_GATED"));
check(() => assert.equal(query.globalV2QueryRegistry.analysis_global_route_detail.availability, "AUTHORITY_GATED"));
check(() => assert.equal(inputs.some(({ resource }) => resource === "analysis_global_product_detail" || resource === "analysis_global_route_detail"), false));

const validRequest = { resource: "analysis_global_economic_expanded", scope: rawScope, params: { sectionKey: "OVERVIEW" }, expectedGeneration: { publicationId: publicationMeta.publicationId, analyticsRevision: 81 } };
const parsedRequest = query.parseGlobalV2QueryRequest(validRequest, context);
check(() => assert.equal(parsedRequest.scopeHash, scopeHash));
check(() => assert.equal(query.globalV2RequestHasPresentUndefined(validRequest), false));
check(() => assert.notEqual(query.globalV2QueryCacheKey(parsedRequest), query.globalV2QueryCacheKey(query.parseGlobalV2QueryRequest({ ...validRequest, params: { sectionKey: "BREAKDOWN" } }, context))));
check(() => assert.equal(query.globalV2QueryCacheKey(parsedRequest), query.globalV2QueryCacheKey(query.parseGlobalV2QueryRequest({ ...validRequest, scope: { ...rawScope, filters: {} } }, context))));
rejects(() => query.parseGlobalV2QueryRequest({ ...validRequest, params: { sectionKey: "OVERVIEW", page: "1" } }, context), /non autorisée|unrecognized/);
rejects(() => query.parseGlobalV2QueryRequest({ ...validRequest, params: { sectionKey: undefined } }, context), /non autorisée|literal/);
rejects(() => query.parseGlobalV2QueryRequest({ ...validRequest, scope: { ...rawScope, filters: undefined } }, context), /objet/);
rejects(() => query.parseGlobalV2QueryRequest({ ...validRequest, invented: true }, context), /non autorisée|unrecognized/);
check(() => assert.equal(query.globalV2RequestHasPresentUndefined({ ...validRequest, params: { sectionKey: undefined } }), true));

const plan = planApi.buildGlobalV2QueryPlan({ instances: inputs });
check(() => assert.equal(plan.instances.length, 32));
check(() => assert.equal(plan.requiredQueryKeys.length, 32));
check(() => assert.equal(plan.queryVersions.length, 32));
check(() => assert.equal(plan.closures.length, 32));
check(() => assert.equal(new Set(plan.requiredQueryKeys).size, plan.requiredQueryKeys.length));
check(() => assert.deepEqual(plan.externalQueryRefs, ["ENTITY:entity_merchant:entity-merchant", "HISTORY:history_month_balance_summary:history-month", "OPERATIONS:operations_browse:operations"]));
check(() => assert.ok(plan.totalPayloadBytes > 0));
check(() => assert.ok(plan.duplicatePayloadBytes >= 0));
check(() => assert.equal(plan.instances.every(({ payload, resource }) => query.globalV2QueryRegistry[resource].schema.safeParse(payload).success), true));
check(() => assert.equal(plan.instances.every(({ key }, index, values) => index === 0 || values[index - 1].key.localeCompare(key) < 0), true));
check(() => assert.deepEqual(plan.closures.map(({ outputKey }) => outputKey).sort(), [...plan.requiredQueryKeys].sort()));
check(() => assert.deepEqual(["global-artifact:certified-outputs", ...plan.closures.map(({ outputKey }) => outputKey)].sort(), ["global-artifact:certified-outputs", ...plan.requiredQueryKeys].sort()));
const manifest = planApi.attachGlobalV2QueryPlanToManifest({
  base: {
    formatVersion: materialization.globalV2ManifestFormatVersion,
    profileId: materialization.globalV2PublicationProfileId,
    householdId: "00000000-0000-4000-8000-000000000001",
    asOf: rawScope.time.asOf,
    certifiedThrough: rawScope.time.certifiedThrough,
    sourceRevision: "1",
    baseAnalyticsRevision: "80",
    resourceFamilies: [...materialization.globalV2ResourceFamilies],
    requiredArtifactKeys: ["global-artifact:certified-outputs"],
    artifactVersions: [{ key: "global-artifact:certified-outputs", family: "global_certified_outputs", contractVersion: "v1", methodSignature: h("d"), policyVersions: { production: "v1" }, resourceInputHash: h("e") }],
    artifactClosures: [{ outputKey: "global-artifact:certified-outputs", declarationDigest: h("f"), inputDigest: h("1"), dependencies }],
    publicationFactsHash: h("2"),
    implementation: { status: "KNOWN", digest: h("3"), gitSha: "4".repeat(40) },
  },
  plan,
});
check(() => assert.deepEqual(manifest.requiredQueryKeys, plan.requiredQueryKeys));
check(() => assert.equal(manifest.queryVersions.length, plan.instances.length));
check(() => assert.equal(manifest.closures.length, plan.instances.length + 1));
check(() => assert.deepEqual(manifest.externalDependencyRefs, plan.externalQueryRefs));
check(() => assert.equal(materialization.parseGlobalV2PublicationManifest(manifest).manifestHash, manifest.manifestHash));

const reordered = planApi.buildGlobalV2QueryPlan({ instances: [...inputs].reverse() });
check(() => assert.deepEqual(reordered.requiredQueryKeys, plan.requiredQueryKeys));
check(() => assert.deepEqual(reordered.queryVersions, plan.queryVersions));
rejects(() => planApi.buildGlobalV2QueryPlan({ instances: [...inputs, inputs[0]] }), /INSTANCE_DUPLICATE/);
rejects(() => planApi.buildGlobalV2QueryPlan({ instances: inputs.filter(({ resource }) => resource !== "analysis_global_category_need_detail") }), /REACHABLE_INSTANCE_MISSING/);
rejects(() => planApi.buildGlobalV2QueryPlan({ instances: [...inputs, { resource: "analysis_global_product_detail", scope: normalizedScope, params: { entityRef: "product:x" }, payload: expandedInputs[0].payload, dependencies }] }), /AUTHORITY_GATED/);
rejects(() => planApi.buildGlobalV2QueryPlan({ instances: [{ ...inputs[0], payload: { ...inputs[0].payload, resourceMeta: { ...inputs[0].payload.resourceMeta, resourceInputHash: h("f") } } }, ...inputs.slice(1)] }), /RESOURCE_META_MISMATCH/);

const nextPlan = planApi.buildGlobalV2QueryPlan({ instances: inputs.filter(({ resource }) => resource !== "analysis_global_methodology") });
check(() => assert.doesNotThrow(() => planApi.assertGlobalV2NoResidualKeys(nextPlan, nextPlan.requiredQueryKeys)));
rejects(() => planApi.assertGlobalV2NoResidualKeys(nextPlan, plan.requiredQueryKeys), /RESIDUAL_OR_MISSING/);
check(() => assert.equal(plan.requiredQueryKeys.length - nextPlan.requiredQueryKeys.length, 1));

const runtimeInstance = plan.instances.find(({ resource }) => resource === validRequest.resource);
const candidate = {
  publicationId: publicationMeta.publicationId, analyticsRevision: 81, active: true, invalidated: false, manifestComplete: true, signatureCompatible: true,
  data: runtimeInstance.payload, resource: runtimeInstance.resource, contractVersion: query.globalV2QueryRegistry[runtimeInstance.resource].contractVersion,
  methodVersion: query.globalV2QueryRegistry[runtimeInstance.resource].methodVersion, methodSignature: runtimeInstance.methodSignature,
  resourceInputHash: runtimeInstance.resourceInputHash, policyVersions: query.globalV2QueryRegistry[runtimeInstance.resource].policyVersions,
  factsHash: publicationMeta.factsHash, manifestHash: publicationMeta.manifestHash,
};
let snapshotReads = 0;
let producerReads = 0;
const services = new Proxy({ scopeValidationContext: context, authorize: () => true, readSnapshot: (_request, cacheKey) => { snapshotReads += 1; assert.equal(cacheKey, query.globalV2QueryCacheKey(parsedRequest)); return candidate; } }, {
  get(target, property, receiver) { if (property === "producer" || property === "build" || property === "recompute") producerReads += 1; return Reflect.get(target, property, receiver); },
});
const hit = await runtime.executeGlobalV2SnapshotQuery(validRequest, services, new GlobalGenerationPin());
await checkAsync(() => { assert.equal(hit.status, "READY"); assert.deepEqual(hit.data, runtimeInstance.payload); });
check(() => assert.equal(snapshotReads, 1));
check(() => assert.equal(producerReads, 0));
await checkAsync(async () => assert.equal((await runtime.executeGlobalV2SnapshotQuery({ ...validRequest, params: { sectionKey: undefined } }, services)).errorCode, "INVALID_REQUEST"));
await checkAsync(async () => assert.equal((await runtime.executeGlobalV2SnapshotQuery(validRequest, { ...services, readSnapshot: () => undefined })).errorCode, "SNAPSHOT_MISS"));
await checkAsync(async () => assert.equal((await runtime.executeGlobalV2SnapshotQuery(validRequest, { ...services, readSnapshot: () => ({ ...candidate, signatureCompatible: false }) })).errorCode, "SIGNATURE_INCOMPATIBLE"));
await checkAsync(async () => assert.equal((await runtime.executeGlobalV2SnapshotQuery(validRequest, { ...services, readSnapshot: () => ({ ...candidate, methodVersion: "old@v1" }) })).errorCode, "CONTRACT_MISMATCH"));
await checkAsync(async () => assert.equal((await runtime.executeGlobalV2SnapshotQuery(validRequest, { ...services, readSnapshot: () => ({ ...candidate, publicationId: "other" }) })).errorCode, "GENERATION_MISMATCH"));
await checkAsync(async () => assert.equal((await runtime.executeGlobalV2SnapshotQuery({ ...validRequest, resource: "analysis_global_product_detail", params: { entityRef: "product:x" } }, services)).errorCode, "SNAPSHOT_MISS"));

const oversized = { ...expandedInputs[0].payload, rows: Array.from({ length: query.GLOBAL_MAX_SECTION_ROWS + 1 }, (_, index) => ({ rowId: `row-${String(index).padStart(2, "0")}`, labelKey: "row", knowledgeState: "KNOWN", evidenceRefs: [] })) };
check(() => assert.equal(query.globalExpandedReadModelSchema.safeParse(oversized).success, false));
check(() => assert.equal(query.importedGlobalSummaryReadModelSchema.safeParse({ ...summaryPayload, status: "FRESH", sanitizedHtml: "<p>One</p><script>x</script>", importedAt: "2026-09-06T15:00:00Z", contentHash: h("d") }).success, false));
check(() => assert.equal(query.importedGlobalSummaryReadModelSchema.parse({ ...summaryPayload, status: "FRESH", sanitizedHtml: "<p>One</p><p>Two</p>", importedAt: "2026-09-06T15:00:00Z", contentHash: h("d") }).status, "FRESH"));

console.log(`Global V2 Query instances: ${checks}/${checks} PASS`);
console.log(`RuntimeSchemas: ${plan.instances.length}/${plan.instances.length} PASS`);
console.log(`Reachable instances: ${plan.requiredQueryKeys.length}; external destinations: ${plan.externalQueryRefs.length}`);
console.log(`Payload bytes: ${plan.totalPayloadBytes}; duplicate bytes: ${plan.duplicatePayloadBytes}; snapshot reads: ${snapshotReads}; producer reads: ${producerReads}`);
