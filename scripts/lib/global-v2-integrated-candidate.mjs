import crypto from "node:crypto";

const hash = (value) => crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex");

export async function buildIntegratedGlobalV2Candidate({ core, query, planApi, materialization, analytics }, options = {}) {
  const householdId = "00000000-0000-4000-8000-000000000001";
  const publicationId = options.publicationId ?? "00000000-0000-4000-8000-000000000170";
  const revision = options.revision ?? 80;
  const baseAnalyticsRevision = options.baseAnalyticsRevision ?? revision - 1;
  const generatedAt = "2026-09-06T18:00:00Z";
  const rawScope = { subject: { kind: "household" }, time: { kind: "global_v2", asOf: "2026-09-06T12:00:00Z", certifiedThrough: "2026-07-31" } };
  const scope = core.normalizeGlobalAnalysisScopeV2(rawScope, { householdTimeZone: "Europe/Paris", authorizedPersonIds: [] });
  const scopeHash = core.computeGlobalAnalysisScopeV2Hash(scope);
  const provisionalMeta = { publicationId, revision, factsHash: "a".repeat(64), generatedAt, profileId: materialization.globalV2PublicationProfileId, manifestHash: "b".repeat(64) };
  const quality = { knowledgeState: "KNOWN", supportStatus: "SUFFICIENT", effectiveCoverage: 1, dataNature: "OBSERVED", limitationCodes: [], evidenceRefs: ["evidence:integrated-qualified-output"] };
  const publicationPolicy = {
    policyId: "global-integrated-core", sectionClass: "CORE_STRUCTURAL", allowedSurfaces: ["AUTO_GLOBAL", "MODULE_DETAIL"],
    requireCertifiedHistory: true, requireMateriality: false, requireStatistics: false, requireTemporalRobustness: false,
    allowPartialQualifiedDetail: true, placeholderPolicy: "CORE_WHEN_RECOVERABLE", methodVersion: "global-integrated-publication@v1",
  };
  const publicationEngine = new analytics.GlobalPublicationEngine();
  const gates = { capability: true, applicable: true, semantic: true, knowledge: "KNOWN", certification: true, support: "SUFFICIENT", coverage: 1, materiality: true, statistics: true, temporalRobustness: true, editorialSelection: true };
  const outputs = query.globalPrimaryModuleCatalog.map((entry, index) => ({
    moduleKey: entry.moduleKey,
    outputId: `qualified:${entry.moduleKey.toLowerCase()}`,
    value: String((index + 1) * 100),
    evidenceRefs: [`analytics:${entry.moduleKey.toLowerCase()}:qualified`],
    digest: hash({ moduleKey: entry.moduleKey, value: (index + 1) * 100 + (options.outputDelta ?? 0), status: "KNOWN", sourceRevision: "1" }),
  }));
  const outputByModule = new Map(outputs.map((output) => [output.moduleKey, output]));
  const dependenciesFor = (moduleKey) => {
    const output = outputByModule.get(moduleKey);
    return [{ authority: "METRIC", family: `global_${moduleKey.toLowerCase()}_qualified_output`, identity: output.outputId, digest: output.digest, required: true }];
  };
  const paramsFor = (resource, moduleKey) => {
    if (query.globalV2TopLevelResources.includes(resource)) return {};
    if (query.globalV2ExpandedResourceCatalog.slice(0, 10).some((entry) => entry.resource === resource)) return { sectionKey: "OVERVIEW" };
    if (resource === "analysis_global_methodology") return { methodRef: "method:global-integrated@v1", moduleKey: moduleKey ?? "ECONOMIC" };
    return { entityRef: `entity:${(moduleKey ?? "ECONOMIC").toLowerCase()}:primary` };
  };
  const instanceKey = (resource, params) => planApi.globalV2QueryInstanceKey(resource, scopeHash, params);
  const resourceMeta = (resource, params, dependencies) => ({
    contractVersion: query.globalV2QueryRegistry[resource].contractVersion,
    methodSignature: planApi.globalV2QueryMethodSignature(resource),
    policyVersions: query.globalV2QueryRegistry[resource].policyVersions,
    resourceInputHash: planApi.globalV2QueryResourceInputHash({ resource, scope, params, dependencies }),
  });

  const moduleInputs = query.globalPrimaryModuleCatalog.map((entry) => {
    const output = outputByModule.get(entry.moduleKey);
    const dependencies = dependenciesFor(entry.moduleKey);
    const decision = publicationEngine.decide({ sectionKey: `module:${entry.moduleKey}`, policy: publicationPolicy, surface: "AUTO_GLOBAL", analyticsRevision: String(revision), gates });
    const expandedResource = query.globalV2ExpandedResourceCatalog.find((item) => item.moduleKey === entry.moduleKey)?.resource;
    const params = {};
    const payload = query.buildGlobalModuleCompactReadModel({
      moduleKey: entry.moduleKey,
      publicationDecision: decision,
      insightCandidates: [],
      kpis: [{ kpiId: `kpi:${output.outputId}`, phenomenonId: output.outputId, labelKey: "global.coverage", displayValue: output.value, metricRef: output.outputId, evidenceRefs: output.evidenceRefs }],
      quality: { ...quality, evidenceRefs: output.evidenceRefs },
      capabilities: [{ capabilityId: `GLOBAL_${entry.moduleKey}`, state: "AVAILABLE", reasonCodes: [] }],
      detailEntries: [{ entryId: `expanded:${entry.moduleKey}`, labelKey: "global.detail", targetResource: expandedResource, targetRef: instanceKey(expandedResource, { sectionKey: "OVERVIEW" }) }],
      publicationMeta: provisionalMeta,
      resourceMeta: resourceMeta(entry.resource, params, dependencies),
    });
    return { resource: entry.resource, scope, params, payload, dependencies };
  });

  const expandedInputs = query.globalV2ExpandedResourceCatalog
    .filter(({ resource }) => query.globalV2QueryRegistry[resource].availability === "AVAILABLE")
    .map(({ resource, moduleKey, capabilityId }, index) => {
      const output = outputByModule.get(moduleKey);
      const dependencies = dependenciesFor(moduleKey);
      const params = paramsFor(resource, moduleKey);
      const isModule = query.globalV2ExpandedResourceCatalog.slice(0, 10).some((item) => item.resource === resource);
      const payload = query.buildGlobalExpandedReadModel({
        kind: "global_expanded", schemaVersion: "global-expanded@v1", resource, moduleKey,
        sectionKey: resource === "analysis_global_methodology" ? "METHODOLOGY" : "OVERVIEW", visibility: "VISIBLE",
        secondaryInsights: [],
        metrics: [{ metricId: output.outputId, labelKey: "global.coverage", displayValue: output.value, knowledgeState: "KNOWN", dataNature: "OBSERVED", evidenceRefs: output.evidenceRefs }],
        series: [],
        rows: [{ rowId: `row:${output.outputId}`, labelKey: `global.${moduleKey.toLowerCase()}`, displayValue: output.value, knowledgeState: "KNOWN", ...(isModule ? { entityRef: `entity:${moduleKey.toLowerCase()}:primary` } : {}), evidenceRefs: output.evidenceRefs }],
        destinations: index === 0 ? [
          { targetId: "category-detail", kind: "GLOBAL_QUERY", resource: "analysis_global_category_need_detail", instanceKey: instanceKey("analysis_global_category_need_detail", { entityRef: "entity:categories_needs:primary" }), scopeHash, sourcePublicationId: publicationId, sourceAnalyticsRevision: revision },
          { targetId: "entity-merchant", kind: "ENTITY", resource: "entity_merchant", entityRef: "merchant:primary", scopeHash, sourcePublicationId: publicationId, sourceAnalyticsRevision: revision },
        ] : [],
        quality: { ...quality, evidenceRefs: output.evidenceRefs }, capabilities: [{ capabilityId, state: "AVAILABLE", reasonCodes: [] }],
        publicationMeta: provisionalMeta, resourceMeta: resourceMeta(resource, params, dependencies),
      });
      return { resource, scope, params, payload, dependencies };
    });

  const initialDependencies = outputs.map((output) => ({ authority: "METRIC", family: `global_${output.moduleKey.toLowerCase()}_qualified_output`, identity: output.outputId, digest: output.digest, required: true }));
  const initialParams = {};
  const initialPayload = query.buildGlobalInitialReadModel({ modules: moduleInputs.map(({ payload }) => payload), capabilities: [{ capabilityId: "GLOBAL_V2", state: "AVAILABLE", reasonCodes: [] }], resourceMeta: resourceMeta("analysis_global_manifest", initialParams, initialDependencies) });
  const summaryDependencies = [{ authority: "METRIC", family: "global_summary_import", identity: "summary:missing", digest: hash({ status: "MISSING" }), required: true }];
  const summaryPayload = query.buildImportedGlobalSummaryReadModel({ kind: "global_imported_summary", schemaVersion: "global-imported-summary@v1", status: "MISSING", publicationMeta: provisionalMeta, resourceMeta: resourceMeta("analysis_global_summary_ai", {}, summaryDependencies) });
  const provisionalInputs = [
    { resource: "analysis_global_manifest", scope, params: {}, payload: initialPayload, dependencies: initialDependencies },
    { resource: "analysis_global_summary_ai", scope, params: {}, payload: summaryPayload, dependencies: summaryDependencies },
    ...moduleInputs,
    ...expandedInputs,
  ];
  const provisionalPlan = planApi.buildGlobalV2QueryPlan({ instances: provisionalInputs });
  const artifactDependencies = outputs.map((output) => ({ authority: "METRIC", family: `global_${output.moduleKey.toLowerCase()}_qualified_output`, identity: output.outputId, digest: output.digest, required: true }));
  const artifactVersion = { key: "global-artifact:certified-outputs", family: "global_certified_outputs", contractVersion: "global-certified-outputs@v1", methodSignature: hash({ method: "integrated-candidate@v1" }), policyVersions: { certification: "global-integrated-candidate@v1" }, resourceInputHash: hash({ outputs: outputs.map(({ outputId, digest }) => ({ outputId, digest })) }) };
  const artifactClosure = { outputKey: artifactVersion.key, declarationDigest: materialization.globalV2ClosureDeclarationDigest(artifactDependencies), inputDigest: materialization.globalV2ClosureInputDigest(artifactDependencies), dependencies: artifactDependencies };
  const manifest = planApi.attachGlobalV2QueryPlanToManifest({ base: {
    formatVersion: materialization.globalV2ManifestFormatVersion, profileId: materialization.globalV2PublicationProfileId,
    householdId, asOf: rawScope.time.asOf, certifiedThrough: rawScope.time.certifiedThrough, sourceRevision: "1", baseAnalyticsRevision: String(baseAnalyticsRevision),
    resourceFamilies: [...materialization.globalV2ResourceFamilies], requiredArtifactKeys: [artifactVersion.key], artifactVersions: [artifactVersion], artifactClosures: [artifactClosure],
    implementation: { status: "KNOWN", digest: hash({ implementation: "P17B-integrated" }), gitSha: "1".repeat(40) },
  }, plan: provisionalPlan });
  const finalMeta = { ...provisionalMeta, factsHash: manifest.publicationFactsHash, manifestHash: manifest.manifestHash };
  const rebind = (payload) => ({ ...payload, publicationMeta: finalMeta });
  const inputs = provisionalInputs.map((input) => ({ ...input, payload: rebind(input.payload) }));
  const plan = planApi.buildGlobalV2QueryPlan({ instances: inputs });
  const finalManifest = planApi.attachGlobalV2QueryPlanToManifest({ base: {
    formatVersion: materialization.globalV2ManifestFormatVersion, profileId: materialization.globalV2PublicationProfileId,
    householdId, asOf: rawScope.time.asOf, certifiedThrough: rawScope.time.certifiedThrough, sourceRevision: "1", baseAnalyticsRevision: String(baseAnalyticsRevision),
    resourceFamilies: [...materialization.globalV2ResourceFamilies], requiredArtifactKeys: [artifactVersion.key], artifactVersions: [artifactVersion], artifactClosures: [artifactClosure],
    implementation: { status: "KNOWN", digest: hash({ implementation: "P17B-integrated" }), gitSha: "1".repeat(40) },
  }, plan });
  if (manifest.manifestHash !== finalManifest.manifestHash) throw new TypeError("INTEGRATED_MANIFEST_NON_DETERMINISTIC");
  return { householdId, publicationId, revision, generatedAt, rawScope, scope, scopeHash, outputs, inputs, plan, manifest: finalManifest, artifactVersion, artifactDependencies, artifactPayload: { kind: "global_certified_outputs", outputs, publicationMeta: finalMeta, resourceMeta: { contractVersion: artifactVersion.contractVersion, methodSignature: artifactVersion.methodSignature, policyVersions: artifactVersion.policyVersions, resourceInputHash: artifactVersion.resourceInputHash } } };
}
