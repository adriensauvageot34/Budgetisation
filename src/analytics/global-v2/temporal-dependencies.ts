import { parseGlobalDependencyDeclaration } from "../../core/global-v2";

/** Inputs are official normalized signals, not History ReadModels or arbitrary tables. */
export function createGlobalTemporalDependencyDeclaration(options: { readonly includeRelationships?: boolean } = {}) {
  return parseGlobalDependencyDeclaration({
    declarationVersion: "global-dependency-declaration@v1", resourceId: "global-v2:m3-transformations",
    factDependencies: [],
    entityDependencies: [{ kind: "ENTITY", id: "canonical-temporal-anchors", requirement: "OPTIONAL", scopeRelation: "explicit-semantic-signal-link" }],
    upstreamAnalytics: [{ kind: "ANALYTICS", id: "certified-monthly-signal-series", requirement: "REQUIRED", scopeRelation: "same-subject-and-certified-boundary", corpusAuthority: "CERTIFIED_HISTORY" }],
    otherModuleDependencies: [
      { kind: "MODULE", id: "GlobalTemporalBoundaryResolver", requirement: "REQUIRED", scopeRelation: "resolved-before-consumption" },
      { kind: "MODULE", id: "GlobalMaterialityEngine", requirement: "REQUIRED", scopeRelation: "signal-specific-policy" },
      ...["M4", "M6", "M7", "M8"].map((id) => ({ kind: "MODULE", id, requirement: "OPTIONAL", scopeRelation: "authorized-signal-enrichment-no-cycle" })),
      ...(options.includeRelationships ? [{ kind: "MODULE", id: "M5_RELATIONSHIP_EVOLUTION", requirement: "REQUIRED", scopeRelation: "association-evolution-only-no-feedback-into-regime-authority" }] : []),
    ],
    naturalGrain: "MONTH", timeWindowPolicy: { id: "global-temporal-window", version: "v1" },
    historicalLookback: { kind: "ALL_RELIABLE" },
    personScope: { kind: "HOUSEHOLD" }, entityScope: { kind: "NONE" },
    supportPolicy: { id: "global-temporal-support", version: "v1" }, coveragePolicy: { id: "global-temporal-coverage", version: "v1" },
    methodVersion: options.includeRelationships ? "global_transformations_with_relationships@v1" : "global_transformations@v1",
    policyVersions: { temporalChange: "v1", lifecycle: "v1", fusion: "v2", primaryDriver: "v1", signalCatalog: "v1", ...(options.includeRelationships ? { relationshipEvolution: "v1" } : {}) },
    publicationOutputs: [], invalidationScope: { kind: "MODULE", moduleId: "global-v2:m3-transformations" },
    capabilityRequirements: [],
  }, { authorizedPersonIds: [] });
}
