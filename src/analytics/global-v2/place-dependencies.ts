import type { PersonId } from "../../core/identity";
import { parseGlobalDependencyDeclaration, type GlobalPersonScopePolicy } from "../../core/global-v2";

export function createGlobalM7DependencyDeclaration(input: {
  readonly personScope: GlobalPersonScopePolicy;
  readonly authorizedPersonIds: readonly PersonId[];
  readonly placeIds: readonly string[];
}) {
  return parseGlobalDependencyDeclaration({
    declarationVersion: "global-dependency-declaration@v1",
    resourceId: "global-v2:m7-place-mobility",
    factDependencies: [
      { kind: "FACT", id: "fct_place_visit", requirement: "REQUIRED", scopeRelation: "canonical-person-place-visit-interval", corpusAuthority: "CERTIFIED_HISTORY" },
      { kind: "FACT", id: "fct_person_day", requirement: "REQUIRED", scopeRelation: "location-observability-denominator", corpusAuthority: "CERTIFIED_HISTORY" },
      { kind: "FACT", id: "fct_economic_component", requirement: "REQUIRED", scopeRelation: "direct-canonical-place-resolution-only", corpusAuthority: "CERTIFIED_HISTORY" },
      { kind: "FACT", id: "fct_purchase_event", requirement: "OPTIONAL", scopeRelation: "event-coverage-denominator-and-proved-establishment-only", corpusAuthority: "CERTIFIED_HISTORY" },
      { kind: "FACT", id: "fct_activity_occurrence", requirement: "OPTIONAL", scopeRelation: "explicit-visit-and-causal-place-only", corpusAuthority: "CERTIFIED_HISTORY" },
    ],
    entityDependencies: [
      { kind: "ENTITY", id: "places", requirement: "REQUIRED", scopeRelation: "canonical-place-hierarchy" },
      { kind: "ENTITY", id: "person_place_roles", requirement: "OPTIONAL", scopeRelation: "dated-canonical-role-only" },
      { kind: "ENTITY", id: "economic_place_attributions", requirement: "OPTIONAL", scopeRelation: "explicit-authorized-attribution-only" },
      { kind: "ENTITY", id: "mobility_legs", requirement: "OPTIONAL", scopeRelation: "authority-gated-AG006" },
      { kind: "ENTITY", id: "route_definitions", requirement: "OPTIONAL", scopeRelation: "authority-gated-AG007" },
      { kind: "ENTITY", id: "vehicles", requirement: "OPTIONAL", scopeRelation: "authority-gated-AG001" },
      { kind: "ENTITY", id: "fuel_price_observations", requirement: "OPTIONAL", scopeRelation: "authority-gated-AG010" },
    ],
    upstreamAnalytics: [
      { kind: "ANALYTICS", id: "history_shared_doctrines", requirement: "REQUIRED", scopeRelation: "presence-visit-finance-separation", corpusAuthority: "CERTIFIED_HISTORY" },
      { kind: "ANALYTICS", id: "global-v2:m6-moment-experiences", requirement: "OPTIONAL", scopeRelation: "explicit-narrative-and-stay-evidence-only", corpusAuthority: "CERTIFIED_HISTORY" },
      { kind: "ANALYTICS", id: "global-v2:m3-transformations", requirement: "OPTIONAL", scopeRelation: "one-way-place-signal-consumer", corpusAuthority: "CERTIFIED_HISTORY" },
      { kind: "ANALYTICS", id: "global-v2:m5-relationships", requirement: "OPTIONAL", scopeRelation: "one-way-recertification-consumer-no-cycle", corpusAuthority: "CERTIFIED_HISTORY" },
    ],
    otherModuleDependencies: [
      { kind: "MODULE", id: "GlobalTemporalBoundaryResolver", requirement: "REQUIRED", scopeRelation: "certified-place-corpus" },
      { kind: "MODULE", id: "GlobalMaterialityEngine", requirement: "REQUIRED", scopeRelation: "place-growth-decline-policy" },
    ],
    naturalGrain: "VISIT",
    timeWindowPolicy: { id: "global-place-certified-corpus", version: "v1" },
    historicalLookback: { kind: "ALL_RELIABLE" },
    personScope: input.personScope,
    entityScope: { kind: "ENTITY_SET", entityType: "place", entityIds: [...new Set(input.placeIds)].sort() },
    supportPolicy: { id: "global-place-observable-months", version: "v1" },
    coveragePolicy: { id: "global-place-location-and-finance", version: "v1" },
    materialityPolicy: { id: "global-place-growth-decline", version: "v1" },
    methodVersion: "global_place_mobility@v1",
    policyVersions: {
      visitResolution: "v1", visitMerge: "v1", visitDays: "v1", stayEvidence: "v1",
      placeImportance: "v1", placeLifecycle: "v1", localizedFinance: "v1",
      placeHierarchy: "v1", mobilityGates: "v1", relationshipReplay: "v1",
    },
    publicationOutputs: [],
    invalidationScope: { kind: "MODULE", moduleId: "global-v2:m7-place-mobility" },
    capabilityRequirements: [
      { capabilityId: "global-v2:place-visits", requirement: "REQUIRED" },
      { capabilityId: "global-v2:localized-finance", requirement: "REQUIRED" },
      { capabilityId: "global-v2:dated-place-role", requirement: "OPTIONAL" },
      { capabilityId: "global-v2:mobility-leg", requirement: "OPTIONAL" },
      { capabilityId: "global-v2:route-definition", requirement: "OPTIONAL" },
    ],
  }, { authorizedPersonIds: input.authorizedPersonIds });
}
