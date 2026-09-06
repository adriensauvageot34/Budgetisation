import type { PersonId } from "../../core/identity";
import { parseGlobalDependencyDeclaration, type GlobalPersonScopePolicy } from "../../core/global-v2";

export function createGlobalM6DependencyDeclaration(input: {
  readonly personScope: GlobalPersonScopePolicy;
  readonly authorizedPersonIds: readonly PersonId[];
  readonly momentIds: readonly string[];
}) {
  return parseGlobalDependencyDeclaration({
    declarationVersion: "global-dependency-declaration@v1",
    resourceId: "global-v2:m6-moment-experiences",
    factDependencies: [
      { kind: "FACT", id: "fct_economic_component", requirement: "REQUIRED", scopeRelation: "canonical-component-moment-causality-and-economic-timing", corpusAuthority: "CERTIFIED_HISTORY" },
      { kind: "FACT", id: "fct_activity_occurrence", requirement: "OPTIONAL", scopeRelation: "explicit-moment-life-event-membership-only", corpusAuthority: "CERTIFIED_HISTORY" },
      { kind: "FACT", id: "fct_activity_occurrence_cost", requirement: "OPTIONAL", scopeRelation: "explicit-causal-component-role-only", corpusAuthority: "CERTIFIED_HISTORY" },
    ],
    entityDependencies: [
      { kind: "ENTITY", id: "moments", requirement: "REQUIRED", scopeRelation: "same-household-canonical-moment" },
      { kind: "ENTITY", id: "moment_life_events", requirement: "REQUIRED", scopeRelation: "explicit-confirmed-or-deduced-membership" },
      { kind: "ENTITY", id: "life_event_participations", requirement: "OPTIONAL", scopeRelation: "household-participant-proof" },
      { kind: "ENTITY", id: "places", requirement: "OPTIONAL", scopeRelation: "facet-only-explicit-place-authority" },
    ],
    upstreamAnalytics: [
      { kind: "ANALYTICS", id: "history_shared_doctrines", requirement: "REQUIRED", scopeRelation: "causal-cost-distinct-from-spent-during", corpusAuthority: "CERTIFIED_HISTORY" },
      { kind: "ANALYTICS", id: "global-v2:m3-transformations", requirement: "OPTIONAL", scopeRelation: "declared-transformation-anchor-only", corpusAuthority: "CERTIFIED_HISTORY" },
      { kind: "ANALYTICS", id: "global-v2:m4-rhythm-routines", requirement: "OPTIONAL", scopeRelation: "narrative-signal-only-no-cycle", corpusAuthority: "CERTIFIED_HISTORY" },
    ],
    otherModuleDependencies: [
      { kind: "MODULE", id: "GlobalTemporalBoundaryResolver", requirement: "REQUIRED", scopeRelation: "moment-cohort-resolved-before-consumption" },
      { kind: "MODULE", id: "GlobalMaterialityEngine", requirement: "REQUIRED", scopeRelation: "family-specific-cost-delta" },
    ],
    naturalGrain: "MOMENT",
    timeWindowPolicy: { id: "global-moment-certified-cohort", version: "v1" },
    historicalLookback: { kind: "ALL_RELIABLE" },
    personScope: input.personScope,
    entityScope: { kind: "ENTITY_SET", entityType: "moment", entityIds: [...new Set(input.momentIds)].sort() },
    supportPolicy: { id: "global-moment-peer-support", version: "v1" },
    coveragePolicy: { id: "global-moment-metadata-participant-financial", version: "v1" },
    materialityPolicy: { id: "global-materiality-moment-family", version: "v1" },
    methodVersion: "global_moment_experience@v1",
    policyVersions: {
      comparisonCatalog: "v1",
      peerSupport: "v1",
      causalCost: "v1",
      spentDuring: "v1",
      paymentTimeline: "v1",
      momentComposition: "v1",
      narrativeImportance: "v1",
      robustStatistics: "v1",
    },
    publicationOutputs: [],
    invalidationScope: { kind: "MODULE", moduleId: "global-v2:m6-moment-experiences" },
    capabilityRequirements: [
      { capabilityId: "global-v2:canonical-moment-type", requirement: "REQUIRED" },
      { capabilityId: "global-v2:moment-financial-causality", requirement: "REQUIRED" },
      { capabilityId: "global-v2:moment-place-facets", requirement: "OPTIONAL" },
    ],
  }, { authorizedPersonIds: input.authorizedPersonIds });
}
