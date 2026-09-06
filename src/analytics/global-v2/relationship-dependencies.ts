import type { PersonId } from "../../core/identity";
import { parseGlobalDependencyDeclaration, type GlobalPersonScopePolicy } from "../../core/global-v2";

export function createGlobalM5DependencyDeclaration(input: {
  readonly personScope: GlobalPersonScopePolicy;
  readonly authorizedPersonIds: readonly PersonId[];
  readonly grain: "PERSON_DAY" | "WEEK";
}) {
  return parseGlobalDependencyDeclaration({
    declarationVersion: "global-dependency-declaration@v1",
    resourceId: `global-v2:m5-relationships:${input.grain.toLowerCase()}`,
    factDependencies: [
      { kind: "FACT", id: "fct_person_day", requirement: "REQUIRED", scopeRelation: "same-household-person-natural-date", corpusAuthority: "CERTIFIED_HISTORY" },
      { kind: "FACT", id: "fct_activity_occurrence", requirement: "REQUIRED", scopeRelation: "explicit-person-participation-single-occurrence", corpusAuthority: "CERTIFIED_HISTORY" },
      { kind: "FACT", id: "fct_economic_component", requirement: "OPTIONAL", scopeRelation: "proven-person-daily-economic-attribution-only", corpusAuthority: "CERTIFIED_HISTORY" },
    ],
    entityDependencies: [
      { kind: "ENTITY", id: "life_event_types", requirement: "REQUIRED", scopeRelation: "canonical-type-key-not-label" },
      { kind: "ENTITY", id: "analysis_periods", requirement: "REQUIRED", scopeRelation: "certified-observable-coverage" },
      { kind: "ENTITY", id: "financial_source_person_links", requirement: "OPTIONAL", scopeRelation: "exact-component-person-attribution" },
    ],
    upstreamAnalytics: [
      { kind: "ANALYTICS", id: "global_day_type@v1", requirement: "REQUIRED", scopeRelation: "explicit-day-context-proof", corpusAuthority: "CERTIFIED_HISTORY" },
      { kind: "ANALYTICS", id: "global-current-regime", requirement: "REQUIRED", scopeRelation: "same-person-certified-regime", corpusAuthority: "CERTIFIED_HISTORY" },
      { kind: "ANALYTICS", id: "global-seasonal-pattern", requirement: "OPTIONAL", scopeRelation: "explicitly-established-season-only-no-calendar-inference", corpusAuthority: "CERTIFIED_HISTORY" },
      { kind: "ANALYTICS", id: "daily_economic_ledger", requirement: "OPTIONAL", scopeRelation: "economic-day-not-bank-date", corpusAuthority: "CERTIFIED_HISTORY" },
    ],
    otherModuleDependencies: [
      { kind: "MODULE", id: "GlobalTemporalBoundaryResolver", requirement: "REQUIRED", scopeRelation: "before-statistical-consumption" },
      { kind: "MODULE", id: "GlobalMaterialityEngine", requirement: "REQUIRED", scopeRelation: "shared-outcome-policy" },
    ],
    naturalGrain: input.grain,
    timeWindowPolicy: { id: "relationship-comparable-certified-window", version: "v1" },
    historicalLookback: { kind: "COMPARABLE_INTERSECTION", unit: input.grain },
    personScope: input.personScope,
    entityScope: { kind: "NONE" },
    supportPolicy: { id: "relationship-post-match-support", version: "v1" },
    coveragePolicy: { id: "relationship-observable-outcome-coverage", version: "v1" },
    methodVersion: "global_relationships@v1",
    policyVersions: {
      relationshipCatalog: "v2", relationshipMatching: "v1", relationshipStatistics: "v1",
      relationshipFdr: "v1", relationshipLomo: "v1", relationshipLeaveRestComparator: "v1",
      relationshipWeekendComparator: "v1", relationshipMateriality: "v1",
    },
    publicationOutputs: [],
    invalidationScope: { kind: "MODULE", moduleId: "global-v2:m5-relationships" },
    capabilityRequirements: [
      { capabilityId: "global-v2:person-day-exposure", requirement: "REQUIRED" },
      { capabilityId: "global-v2:person-economic-attribution", requirement: "OPTIONAL" },
    ],
  }, { authorizedPersonIds: input.authorizedPersonIds });
}
