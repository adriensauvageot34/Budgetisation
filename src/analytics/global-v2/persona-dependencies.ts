import type { PersonId } from "../../core/identity";
import { parseGlobalDependencyDeclaration } from "../../core/global-v2";

export function createGlobalM9DependencyDeclaration(personIds: readonly PersonId[]) {
  return parseGlobalDependencyDeclaration({
    declarationVersion: "global-dependency-declaration@v1",
    resourceId: "global-v2:m9-persona",
    factDependencies: [
      { kind: "FACT", id: "fct_economic_component", requirement: "REQUIRED", scopeRelation: "person-attribution-proved-only", corpusAuthority: "CERTIFIED_HISTORY" },
      { kind: "FACT", id: "fct_person_day", requirement: "OPTIONAL", scopeRelation: "person-observability-and-day-rates", corpusAuthority: "CERTIFIED_HISTORY" },
      { kind: "FACT", id: "fct_activity_occurrence", requirement: "OPTIONAL", scopeRelation: "person-participation-proved-only", corpusAuthority: "CERTIFIED_HISTORY" },
      { kind: "FACT", id: "fct_place_visit", requirement: "OPTIONAL", scopeRelation: "person-visit-authority-only", corpusAuthority: "CERTIFIED_HISTORY" },
      { kind: "FACT", id: "fct_purchase_event", requirement: "OPTIONAL", scopeRelation: "retained-human-purchase-and-beneficiary-authority", corpusAuthority: "CERTIFIED_HISTORY" },
    ],
    entityDependencies: [
      { kind: "ENTITY", id: "persons", requirement: "REQUIRED", scopeRelation: "same-household-authorized-persons" },
      { kind: "ENTITY", id: "financial_source_person_links", requirement: "REQUIRED", scopeRelation: "exact-grain-beneficiary-or-share-attribution" },
    ],
    upstreamAnalytics: [
      { kind: "ANALYTICS", id: "global-v2:m1-economic-function", requirement: "REQUIRED", scopeRelation: "personal-economic-selection-with-unattributed-zone", corpusAuthority: "CERTIFIED_HISTORY" },
      { kind: "ANALYTICS", id: "global-v2:m2-category-needs", requirement: "OPTIONAL", scopeRelation: "authorized-personal-category-and-need-metrics", corpusAuthority: "CERTIFIED_HISTORY" },
      { kind: "ANALYTICS", id: "global-v2:m3-transformations", requirement: "REQUIRED", scopeRelation: "current-regime-and-exceptional-classification", corpusAuthority: "CERTIFIED_HISTORY" },
      { kind: "ANALYTICS", id: "global-v2:m4-rhythm-routines", requirement: "OPTIONAL", scopeRelation: "person-occurrence-and-routine-metrics", corpusAuthority: "CERTIFIED_HISTORY" },
      { kind: "ANALYTICS", id: "global-v2:m5-relationships", requirement: "OPTIONAL", scopeRelation: "association-only-person-signals", corpusAuthority: "CERTIFIED_HISTORY" },
      { kind: "ANALYTICS", id: "global-v2:m6-moment-experiences", requirement: "OPTIONAL", scopeRelation: "official-exceptional-moment-exclusions", corpusAuthority: "CERTIFIED_HISTORY" },
      { kind: "ANALYTICS", id: "global-v2:m7-place-mobility", requirement: "OPTIONAL", scopeRelation: "proven-person-place-metrics", corpusAuthority: "CERTIFIED_HISTORY" },
      { kind: "ANALYTICS", id: "global-v2:m8-purchase-merchant", requirement: "OPTIONAL", scopeRelation: "retained-purchase-metrics-only", corpusAuthority: "CERTIFIED_HISTORY" },
    ],
    otherModuleDependencies: [
      { kind: "MODULE", id: "GlobalTemporalBoundaryResolver", requirement: "REQUIRED", scopeRelation: "own-support-and-comparable-intersection" },
      { kind: "MODULE", id: "GlobalMaterialityEngine", requirement: "REQUIRED", scopeRelation: "persona-money-or-frequency-policy" },
    ],
    naturalGrain: "MONTH",
    timeWindowPolicy: { id: "global-persona-natural-windows", version: "v1" },
    historicalLookback: { kind: "COMPARABLE_INTERSECTION", unit: "MONTH" },
    personScope: { kind: "COMPARABLE_PERSONS", personIds: [...personIds].sort(), intersectionPolicy: { id: "global-persona-comparable-intersection", version: "v1" } },
    entityScope: { kind: "NONE" },
    supportPolicy: { id: "global-persona-support", version: "v1" },
    coveragePolicy: { id: "global-persona-comparable-coverage", version: "v1" },
    materialityPolicy: { id: "global-materiality-persona", version: "v1" },
    methodVersion: "global_persona@v1",
    policyVersions: { comparison: "v1", support: "v1", coverage: "v1", exceptional: "v1", ranking: "v1", hysteresis: "v1", observedCost: "v1", enrichedReference: "v1" },
    publicationOutputs: [],
    invalidationScope: { kind: "PERSON_SCOPE", personIds: [...personIds].sort() },
    capabilityRequirements: [
      { capabilityId: "global-v2:person-attribution", requirement: "REQUIRED" },
      { capabilityId: "global-v2:personal-reference-cost", requirement: "OPTIONAL" },
    ],
  }, { authorizedPersonIds: personIds });
}
