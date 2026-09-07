import "server-only";

import { createHash } from "node:crypto";

import {
  GlobalPublicationEngine,
  type GlobalPublicationDecision,
} from "@/analytics/global-v2";
import {
  canonicalSerializeGlobal,
  computeGlobalAnalysisScopeV2Hash,
  normalizeGlobalAnalysisScopeV2,
  type GlobalAnalysisScopeV2,
  type GlobalScopeValidationContext,
} from "@/core/global-v2";
import {
  buildGlobalExpandedReadModel,
  buildGlobalInitialReadModel,
  buildGlobalModuleCompactReadModel,
  buildImportedGlobalSummaryReadModel,
  GLOBAL_MAX_SECTION_ROWS,
  globalExpandedSectionKeys,
  globalPrimaryModuleCatalog,
  globalV2ExpandedResourceCatalog,
  globalV2QueryRegistry,
  type GlobalCompactQuality,
  type GlobalExpandedSectionKey,
  type GlobalModuleCapability,
  type GlobalPrimaryModuleKey,
  type GlobalReadModelPublicationMeta,
  type GlobalReadModelResourceMeta,
  type GlobalV2ExpandedResourceName,
  type GlobalV2QueryParams,
  type GlobalV2QueryResourceName,
} from "@/query-api/global-v2";
import {
  attachGlobalV2QueryPlanToManifest,
  buildGlobalV2QueryPlan,
  globalV2QueryInstanceKey,
  globalV2QueryMethodSignature,
  globalV2QueryResourceInputHash,
  type GlobalV2QueryInstanceInput,
} from "@/server/analytics/materialization/global-query-plan";
import {
  globalV2ClosureDeclarationDigest,
  globalV2ClosureInputDigest,
  globalV2ManifestFormatVersion,
  globalV2PublicationProfileId,
  globalV2ResourceFamilies,
  type GlobalV2ResolvedDependency,
  type GlobalV2ResourceVersion,
} from "@/server/analytics/materialization/global-v2";

const GIT_SHA = /^[0-9a-f]{40}$/u;

function digest(value: unknown): string {
  return createHash("sha256").update(canonicalSerializeGlobal(value), "utf8").digest("hex");
}

function deterministicUuid(value: unknown): string {
  const hex = digest(value).slice(0, 32).split("");
  hex[12] = "5";
  hex[16] = (["8", "9", "a", "b"] as const)[Number.parseInt(hex[16]!, 16) % 4]!;
  const joined = hex.join("");
  return `${joined.slice(0, 8)}-${joined.slice(8, 12)}-${joined.slice(12, 16)}-${joined.slice(16, 20)}-${joined.slice(20)}`;
}

export type GlobalV2OwnerOutput = {
  readonly moduleKey: GlobalPrimaryModuleKey;
  readonly owner: string;
  readonly output: unknown;
  readonly knowledge: "KNOWN" | "PARTIAL" | "UNKNOWN" | "NOT_APPLICABLE" | "CONFLICT";
  readonly capabilityState: GlobalModuleCapability["state"];
  readonly reasonCodes: readonly string[];
  readonly evidenceRefs: readonly string[];
};

export type GlobalV2CandidateInput = {
  readonly project: string;
  readonly householdId: string;
  readonly householdTimeZone: string;
  readonly personIds: readonly string[];
  readonly asOf: string;
  readonly certifiedThrough: string;
  readonly dataRevision: string;
  readonly analyticsRevision: string;
  readonly implementationIdentity: string;
  readonly ownerOutputs: readonly GlobalV2OwnerOutput[];
};

type EntityProjection = { readonly ref: string; readonly labelKey: string };

const entityKeysByModule: Readonly<Record<GlobalPrimaryModuleKey, readonly string[]>> = Object.freeze({
  ECONOMIC: [],
  CATEGORIES_NEEDS: ["categoryId", "needId"],
  TRANSFORMATIONS: ["transformationId"],
  RHYTHM: ["activityId", "routineId"],
  RELATIONSHIPS: ["relationshipId"],
  MOMENTS: ["momentId"],
  GEO_MOBILITY: ["placeId"],
  CONSUMPTION: ["purchaseEventId", "merchantId"],
  PERSONAS: ["personId", "differenceId"],
  TOGETHER: ["unitId", "universeId"],
});

function entitiesFromOutput(moduleKey: GlobalPrimaryModuleKey, output: unknown): readonly EntityProjection[] {
  const accepted = new Set(entityKeysByModule[moduleKey]);
  const refs = new Map<string, EntityProjection>();
  const visit = (value: unknown, depth: number): void => {
    if (depth > 8 || value === null || typeof value !== "object") return;
    if (Array.isArray(value)) {
      value.forEach((item) => visit(item, depth + 1));
      return;
    }
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      if (accepted.has(key) && typeof item === "string" && item.trim().length > 0) {
        const ref = `${key.replace(/Id$/u, "").replace(/[A-Z]/gu, (letter) => `-${letter.toLowerCase()}`)}:${item}`;
        refs.set(ref, { ref, labelKey: `global.entity.${key}` });
      }
      visit(item, depth + 1);
    }
  };
  visit(output, 0);
  return [...refs.values()]
    .sort((left, right) => left.ref.localeCompare(right.ref))
    .slice(0, GLOBAL_MAX_SECTION_ROWS);
}

function countMeaningful(value: unknown): number {
  if (Array.isArray(value)) return value.length;
  if (value !== null && typeof value === "object") {
    const record = value as Record<string, unknown>;
    for (const key of ["transformations", "relationships", "experiences", "places", "purchases", "metrics", "differences", "universes", "rhythms"] as const) {
      if (Array.isArray(record[key])) return record[key].length;
    }
    return Object.keys(record).length;
  }
  return value === undefined || value === null ? 0 : 1;
}

function publicationDecision(output: GlobalV2OwnerOutput, revision: number): GlobalPublicationDecision {
  return new GlobalPublicationEngine().decide({
    sectionKey: `module:${output.moduleKey}`,
    policy: {
      policyId: "global-v2-owner-output",
      sectionClass: "CORE_STRUCTURAL",
      allowedSurfaces: ["AUTO_GLOBAL", "MODULE_DETAIL"],
      requireCertifiedHistory: true,
      requireMateriality: false,
      requireStatistics: false,
      requireTemporalRobustness: false,
      allowPartialQualifiedDetail: true,
      placeholderPolicy: "CORE_WHEN_RECOVERABLE",
      methodVersion: "global-v2-owner-projection@v1",
    },
    surface: "AUTO_GLOBAL",
    analyticsRevision: String(revision),
    gates: {
      capability: output.capabilityState !== "UNAVAILABLE",
      applicable: output.knowledge !== "NOT_APPLICABLE",
      semantic: true,
      knowledge: output.knowledge,
      certification: true,
      support: output.knowledge === "KNOWN" ? "SUFFICIENT" : "PARTIAL_SUPPORT",
      coverage: output.knowledge === "KNOWN" ? 1 : output.knowledge === "PARTIAL" ? 0.7 : 0,
      provenance: output.evidenceRefs.length > 0,
      baseCompatible: true,
      materiality: true,
      statistics: true,
      temporalRobustness: true,
      editorialSelection: true,
      publicationReady: true,
      recoverableReason: output.capabilityState === "UNAVAILABLE" ? "CAPABILITY_NOT_AVAILABLE" : "UNKNOWN_REQUIRED_VALUE",
    },
  });
}

function quality(output: GlobalV2OwnerOutput): GlobalCompactQuality {
  return {
    knowledgeState: output.knowledge,
    ...(output.knowledge === "PARTIAL" ? { partialMeaning: "OBSERVED_ONLY" as const } : {}),
    supportStatus: output.knowledge === "KNOWN" ? "SUFFICIENT" : "INSUFFICIENT",
    ...(output.knowledge === "KNOWN" ? { effectiveCoverage: 1 } : output.knowledge === "PARTIAL" ? { effectiveCoverage: 0.7 } : {}),
    dataNature: "OBSERVED",
    limitationCodes: [...output.reasonCodes].sort(),
    evidenceRefs: [...new Set(output.evidenceRefs)].sort(),
  };
}

function capability(output: GlobalV2OwnerOutput): GlobalModuleCapability {
  return {
    capabilityId: `GLOBAL_${output.moduleKey}`,
    state: output.capabilityState,
    reasonCodes: [...new Set(output.reasonCodes)].sort(),
  };
}

function detailResourceFor(moduleKey: GlobalPrimaryModuleKey): GlobalV2ExpandedResourceName | undefined {
  return globalV2ExpandedResourceCatalog.slice(10).find(({ moduleKey: candidate, resource }) =>
    candidate === moduleKey && resource !== "analysis_global_methodology" && globalV2QueryRegistry[resource].availability === "AVAILABLE")?.resource;
}

export function buildGlobalV2CandidateFromOwnerOutputs(input: GlobalV2CandidateInput) {
  if (!input.project || !input.householdId || !GIT_SHA.test(input.implementationIdentity)) throw new TypeError("GLOBAL_LIVE_CANDIDATE_IDENTITY_INVALID");
  if (!/^\d+$/u.test(input.dataRevision) || !/^\d+$/u.test(input.analyticsRevision)) throw new TypeError("GLOBAL_LIVE_CANDIDATE_REVISION_INVALID");
  const revision = Number(input.analyticsRevision) + 1;
  const rawScope: GlobalAnalysisScopeV2 = {
    subject: { kind: "household" },
    time: { kind: "global_v2", asOf: input.asOf as never, certifiedThrough: input.certifiedThrough as never },
  };
  const validationContext: GlobalScopeValidationContext = {
    householdTimeZone: input.householdTimeZone as never,
    authorizedPersonIds: input.personIds as never,
  };
  const scope = normalizeGlobalAnalysisScopeV2(rawScope, validationContext);
  const scopeHash = computeGlobalAnalysisScopeV2Hash(scope);
  const outputs = [...input.ownerOutputs].sort((left, right) => left.moduleKey.localeCompare(right.moduleKey));
  if (outputs.length !== globalPrimaryModuleCatalog.length || new Set(outputs.map(({ moduleKey }) => moduleKey)).size !== globalPrimaryModuleCatalog.length) {
    throw new TypeError("GLOBAL_LIVE_CANDIDATE_OWNER_SET_INCOMPLETE");
  }
  const outputDigests = outputs.map((item) => ({ moduleKey: item.moduleKey, owner: item.owner, digest: digest(item.output), knowledge: item.knowledge, capabilityState: item.capabilityState }));
  const implementation = {
    status: "KNOWN" as const,
    gitSha: input.implementationIdentity,
    digest: digest({ format: "global-v2-live-implementation@v1", gitSha: input.implementationIdentity, registry: Object.entries(globalV2QueryRegistry).map(([resource, contract]) => ({ resource, contractVersion: contract.contractVersion, methodVersion: contract.methodVersion, policyVersions: contract.policyVersions })) }),
  };
  const candidateId = deterministicUuid({ format: "global-v2-live-candidate@v1", project: input.project, householdId: input.householdId, scope, dataRevision: input.dataRevision, analyticsRevision: input.analyticsRevision, implementation, outputDigests });
  const generatedAt = input.asOf;
  const provisionalMeta: GlobalReadModelPublicationMeta = {
    publicationId: candidateId,
    revision,
    factsHash: "0".repeat(64),
    generatedAt,
    profileId: globalV2PublicationProfileId,
    manifestHash: "0".repeat(64),
  };
  const dependenciesFor = (moduleKey: GlobalPrimaryModuleKey): readonly GlobalV2ResolvedDependency[] => {
    const output = outputDigests.find((entry) => entry.moduleKey === moduleKey)!;
    return [{ authority: "METRIC", family: `global_${moduleKey.toLowerCase()}_owner_output`, identity: `${output.owner}:${moduleKey}`, digest: output.digest, required: true }];
  };
  const metaFor = (resource: GlobalV2QueryResourceName, params: GlobalV2QueryParams, dependencies: readonly GlobalV2ResolvedDependency[]): GlobalReadModelResourceMeta => ({
    contractVersion: globalV2QueryRegistry[resource].contractVersion,
    methodSignature: globalV2QueryMethodSignature(resource),
    policyVersions: globalV2QueryRegistry[resource].policyVersions,
    resourceInputHash: globalV2QueryResourceInputHash({ resource, scope, params, dependencies }),
  });
  const expandedResourceByModule = new Map(globalV2ExpandedResourceCatalog.slice(0, 10).map(({ moduleKey, resource }) => [moduleKey, resource] as const));
  const expandedKeysByModule = new Map<GlobalPrimaryModuleKey, Map<GlobalExpandedSectionKey, string>>();
  for (const { moduleKey } of outputs) {
    const resource = expandedResourceByModule.get(moduleKey)!;
    expandedKeysByModule.set(moduleKey, new Map(globalExpandedSectionKeys.map((sectionKey) => [sectionKey, globalV2QueryInstanceKey(resource, scopeHash, { sectionKey })])));
  }
  const moduleInstances: GlobalV2QueryInstanceInput[] = outputs.map((ownerOutput) => {
    const catalog = globalPrimaryModuleCatalog.find(({ moduleKey }) => moduleKey === ownerOutput.moduleKey)!;
    const dependencies = dependenciesFor(ownerOutput.moduleKey);
    const params = {};
    const decision = publicationDecision(ownerOutput, revision);
    const visible = decision.visibility === "VISIBLE";
    const count = countMeaningful(ownerOutput.output);
    return {
      resource: catalog.resource,
      scope,
      params,
      dependencies,
      payload: buildGlobalModuleCompactReadModel({
        moduleKey: ownerOutput.moduleKey,
        publicationDecision: decision,
        insightCandidates: [],
        kpis: visible ? [{ kpiId: `kpi:${ownerOutput.moduleKey.toLowerCase()}:owner-output`, phenomenonId: `phenomenon:${ownerOutput.moduleKey.toLowerCase()}:owner-output`, labelKey: `global.${ownerOutput.moduleKey.toLowerCase()}`, displayValue: String(count), metricRef: `${ownerOutput.owner}:${ownerOutput.moduleKey}`, evidenceRefs: ownerOutput.evidenceRefs }] : [],
        quality: quality(ownerOutput),
        capabilities: [capability(ownerOutput)],
        detailEntries: visible ? [{ entryId: `expanded:${ownerOutput.moduleKey}`, labelKey: "global.detail", targetResource: expandedResourceByModule.get(ownerOutput.moduleKey)!, targetRef: expandedKeysByModule.get(ownerOutput.moduleKey)!.get("OVERVIEW")! }] : [],
        publicationMeta: provisionalMeta,
        resourceMeta: metaFor(catalog.resource, params, dependencies),
      }),
    };
  });
  const expandedInstances: GlobalV2QueryInstanceInput[] = [];
  for (const ownerOutput of outputs) {
    const decision = publicationDecision(ownerOutput, revision);
    if (decision.visibility !== "VISIBLE") continue;
    const resource = expandedResourceByModule.get(ownerOutput.moduleKey)!;
    const dependencies = dependenciesFor(ownerOutput.moduleKey);
    const entities = entitiesFromOutput(ownerOutput.moduleKey, ownerOutput.output);
    for (const sectionKey of globalExpandedSectionKeys) {
      const params = { sectionKey };
      expandedInstances.push({
        resource,
        scope,
        params,
        dependencies,
        payload: buildGlobalExpandedReadModel({
          kind: "global_expanded",
          schemaVersion: "global-expanded@v1",
          resource,
          moduleKey: ownerOutput.moduleKey,
          sectionKey,
          visibility: "VISIBLE",
          secondaryInsights: [],
          metrics: [{ metricId: `metric:${ownerOutput.moduleKey.toLowerCase()}:owner-output`, labelKey: `global.${ownerOutput.moduleKey.toLowerCase()}`, displayValue: String(countMeaningful(ownerOutput.output)), knowledgeState: ownerOutput.knowledge, ...(ownerOutput.knowledge === "PARTIAL" ? { partialMeaning: "OBSERVED_ONLY" as const } : {}), dataNature: "OBSERVED", evidenceRefs: ownerOutput.evidenceRefs }],
          series: [],
          rows: entities.map((entity) => ({ rowId: `row:${entity.ref}`, labelKey: entity.labelKey, displayValue: entity.ref, knowledgeState: "KNOWN" as const, entityRef: entity.ref, evidenceRefs: ownerOutput.evidenceRefs })),
          destinations: [],
          quality: quality(ownerOutput),
          capabilities: [capability(ownerOutput)],
          publicationMeta: provisionalMeta,
          resourceMeta: metaFor(resource, params, dependencies),
        }),
      });
    }
    const detailResource = detailResourceFor(ownerOutput.moduleKey);
    if (detailResource !== undefined) for (const entity of entities) {
      const params = { entityRef: entity.ref };
      expandedInstances.push({
        resource: detailResource,
        scope,
        params,
        dependencies,
        payload: buildGlobalExpandedReadModel({
          kind: "global_expanded", schemaVersion: "global-expanded@v1", resource: detailResource, moduleKey: ownerOutput.moduleKey, sectionKey: "OVERVIEW", visibility: "VISIBLE", secondaryInsights: [], metrics: [], series: [],
          rows: [{ rowId: `detail:${entity.ref}`, labelKey: entity.labelKey, displayValue: entity.ref, knowledgeState: "KNOWN", evidenceRefs: ownerOutput.evidenceRefs }], destinations: [], quality: quality(ownerOutput), capabilities: [capability(ownerOutput)], publicationMeta: provisionalMeta, resourceMeta: metaFor(detailResource, params, dependencies),
        }),
      });
    }
    const methodologyParams = { moduleKey: ownerOutput.moduleKey, methodRef: `method:${ownerOutput.owner}` };
    expandedInstances.push({
      resource: "analysis_global_methodology",
      scope,
      params: methodologyParams,
      dependencies,
      payload: buildGlobalExpandedReadModel({
        kind: "global_expanded", schemaVersion: "global-expanded@v1", resource: "analysis_global_methodology", moduleKey: ownerOutput.moduleKey, sectionKey: "METHODOLOGY", visibility: "VISIBLE", secondaryInsights: [], metrics: [], series: [], rows: [{ rowId: `method:${ownerOutput.moduleKey}`, labelKey: "global.method", displayValue: ownerOutput.owner, knowledgeState: "KNOWN", evidenceRefs: ownerOutput.evidenceRefs }], destinations: [], quality: quality(ownerOutput), capabilities: [{ capabilityId: "GLOBAL_METHODOLOGY", state: "AVAILABLE", reasonCodes: [] }], publicationMeta: provisionalMeta, resourceMeta: metaFor("analysis_global_methodology", methodologyParams, dependencies),
      }),
    });
  }
  const allOutputDependencies = outputs.map(({ moduleKey }) => dependenciesFor(moduleKey)[0]!);
  const initialParams = {};
  const initialPayload = buildGlobalInitialReadModel({
    modules: moduleInstances.map(({ payload }) => payload as never),
    capabilities: outputs.map(capability),
    resourceMeta: metaFor("analysis_global_manifest", initialParams, allOutputDependencies),
  });
  const summaryDependencies: readonly GlobalV2ResolvedDependency[] = [{ authority: "CANONICAL", family: "imported_global_summary", identity: `summary:${input.householdId}:missing`, digest: digest({ status: "MISSING", sourceRevision: input.dataRevision }), required: true }];
  const summaryPayload = buildImportedGlobalSummaryReadModel({ kind: "global_imported_summary", schemaVersion: "global-imported-summary@v1", status: "MISSING", publicationMeta: provisionalMeta, resourceMeta: metaFor("analysis_global_summary_ai", {}, summaryDependencies) });
  const provisionalInstances: GlobalV2QueryInstanceInput[] = [
    { resource: "analysis_global_manifest", scope, params: {}, payload: initialPayload, dependencies: allOutputDependencies },
    { resource: "analysis_global_summary_ai", scope, params: {}, payload: summaryPayload, dependencies: summaryDependencies },
    ...moduleInstances,
    ...expandedInstances,
  ];
  const artifactKey = `global-artifact:owner-outputs:${scopeHash}`;
  const artifactDependencies = allOutputDependencies;
  const artifactVersion: GlobalV2ResourceVersion = {
    key: artifactKey,
    family: "global_owner_outputs",
    contractVersion: "global-owner-outputs@v1",
    methodSignature: digest({ method: "global-v2-production-orchestration@v1", implementation }),
    policyVersions: { orchestration: "global-v2-production-orchestration@v1" },
    resourceInputHash: digest({ scope, outputDigests }),
  };
  const artifactClosure = { outputKey: artifactKey, declarationDigest: globalV2ClosureDeclarationDigest(artifactDependencies), inputDigest: globalV2ClosureInputDigest(artifactDependencies), dependencies: artifactDependencies };
  const manifestBase = {
    formatVersion: globalV2ManifestFormatVersion,
    profileId: globalV2PublicationProfileId,
    householdId: input.householdId,
    asOf: input.asOf,
    certifiedThrough: input.certifiedThrough,
    sourceRevision: input.dataRevision,
    baseAnalyticsRevision: input.analyticsRevision,
    resourceFamilies: [...globalV2ResourceFamilies],
    requiredArtifactKeys: [artifactKey],
    artifactVersions: [artifactVersion],
    artifactClosures: [artifactClosure],
    implementation,
  };
  const provisionalPlan = buildGlobalV2QueryPlan({ instances: provisionalInstances });
  const manifest = attachGlobalV2QueryPlanToManifest({ base: manifestBase, plan: provisionalPlan });
  const finalMeta: GlobalReadModelPublicationMeta = { ...provisionalMeta, factsHash: manifest.publicationFactsHash, manifestHash: manifest.manifestHash };
  const instances = provisionalInstances.map((instance) => ({ ...instance, payload: { ...(instance.payload as Record<string, unknown>), publicationMeta: finalMeta } }));
  const plan = buildGlobalV2QueryPlan({ instances });
  const finalManifest = attachGlobalV2QueryPlanToManifest({ base: manifestBase, plan });
  if (manifest.manifestHash !== finalManifest.manifestHash) throw new TypeError("GLOBAL_LIVE_CANDIDATE_NON_DETERMINISTIC");
  const artifactPayload = { kind: "global_owner_outputs", outputs: outputs.map(({ moduleKey, owner, output, knowledge, capabilityState, reasonCodes, evidenceRefs }) => ({ moduleKey, owner, output, knowledge, capabilityState, reasonCodes: [...reasonCodes].sort(), evidenceRefs: [...evidenceRefs].sort() })), publicationMeta: finalMeta, resourceMeta: { contractVersion: artifactVersion.contractVersion, methodSignature: artifactVersion.methodSignature, policyVersions: artifactVersion.policyVersions, resourceInputHash: artifactVersion.resourceInputHash } };
  return {
    project: input.project,
    householdScope: input.householdId,
    asOf: input.asOf,
    dataRevision: input.dataRevision,
    analyticsRevision: input.analyticsRevision,
    implementationIdentity: input.implementationIdentity,
    candidateId,
    factsHash: finalManifest.publicationFactsHash,
    manifestHash: finalManifest.manifestHash,
    requiredArtifactCount: finalManifest.requiredArtifactKeys.length,
    requiredSnapshotCount: finalManifest.requiredQueryKeys.length,
    queryInstanceCount: plan.instances.length,
    availableCapabilities: [...new Set(Object.values(globalV2QueryRegistry).filter(({ availability }) => availability === "AVAILABLE").map(({ capabilityId }) => capabilityId))].sort(),
    gatedCapabilities: [...new Set(Object.values(globalV2QueryRegistry).filter(({ availability }) => availability === "AUTHORITY_GATED").map(({ capabilityId }) => capabilityId))].sort(),
    requiredKeys: { artifacts: finalManifest.requiredArtifactKeys, queries: finalManifest.requiredQueryKeys },
    versions: { artifacts: finalManifest.artifactVersions, queries: finalManifest.queryVersions },
    ownerOutputs: outputs,
    scope,
    scopeHash,
    plan,
    manifest: finalManifest,
    artifacts: [{ key: artifactKey, payload: artifactPayload, version: artifactVersion, dependencies: artifactDependencies }],
    snapshots: plan.instances.map((instance) => ({ key: instance.key, resource: instance.resource, scopeHash: instance.scopeHash, params: instance.params, payload: instance.payload, methodSignature: instance.methodSignature, resourceInputHash: instance.resourceInputHash, policyVersions: globalV2QueryRegistry[instance.resource].policyVersions, payloadHash: digest(instance.payload) })),
  };
}
