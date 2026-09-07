import type { PersonId } from "../../core/identity";
import { assertCapabilityRespectsAuthorityGates, parseGlobalCapability, parseGlobalDependencyDeclaration, type GlobalPersonScopePolicy } from "../../core/global-v2";

export function createGlobalM4DependencyDeclaration(input: {
  readonly personScope: GlobalPersonScopePolicy;
  readonly authorizedPersonIds: readonly PersonId[];
}) {
  return parseGlobalDependencyDeclaration({
    declarationVersion: "global-dependency-declaration@v1",
    resourceId: "global-v2:m4-rhythm-routines",
    factDependencies: [
      { kind: "FACT", id: "fct_activity_occurrence", requirement: "REQUIRED", scopeRelation: "same-household-person-participant-and-occurrence", corpusAuthority: "CERTIFIED_HISTORY" },
      { kind: "FACT", id: "fct_person_day", requirement: "REQUIRED", scopeRelation: "same-person-and-local-date-exposure", corpusAuthority: "CERTIFIED_HISTORY" },
      { kind: "FACT", id: "fct_place_visit", requirement: "OPTIONAL", scopeRelation: "presence-only-never-semantic-place-role", corpusAuthority: "CERTIFIED_HISTORY" },
      { kind: "FACT", id: "fct_activity_occurrence_cost", requirement: "OPTIONAL", scopeRelation: "same-occurrence-causal-authority", corpusAuthority: "CERTIFIED_HISTORY" },
      { kind: "FACT", id: "fct_economic_component", requirement: "OPTIONAL", scopeRelation: "same-person-day-associated-cost-no-causality", corpusAuthority: "CERTIFIED_HISTORY" },
    ],
    entityDependencies: [
      { kind: "ENTITY", id: "person_place_roles", requirement: "OPTIONAL", scopeRelation: "dated-canonical-role-only" },
      { kind: "ENTITY", id: "DayPartCatalog", requirement: "OPTIONAL", scopeRelation: "versioned-semantic-day-part" },
      { kind: "ENTITY", id: "CalendarEventWindowCatalog", requirement: "OPTIONAL", scopeRelation: "versioned-anchored-cycle-window" },
    ],
    upstreamAnalytics: [],
    otherModuleDependencies: [
      { kind: "MODULE", id: "GlobalTemporalBoundaryResolver", requirement: "REQUIRED", scopeRelation: "resolved-before-consumption" },
      { kind: "MODULE", id: "GlobalMaterialityEngine", requirement: "REQUIRED", scopeRelation: "seasonal-and-rhythm-materiality" },
      { kind: "MODULE", id: "global-v2:m3-transformations", requirement: "OPTIONAL", scopeRelation: "downstream-consumer-only-no-cycle" },
    ],
    naturalGrain: "OCCURRENCE",
    timeWindowPolicy: { id: "global-routine-natural-window", version: "v1" },
    historicalLookback: { kind: "ALL_RELIABLE" },
    personScope: input.personScope,
    entityScope: { kind: "NONE" },
    supportPolicy: { id: "global-routine-pattern", version: "v1" },
    coveragePolicy: { id: "global-routine-observable-exposure", version: "v1" },
    materialityPolicy: { id: "global-materiality-activity-frequency", version: "v1" },
    methodVersion: "global_routine_pattern@v1",
    policyVersions: {
      routinePattern: "v1",
      cycleSeasonality: "v1",
      routineCost: "v1",
      observableExposure: "v1",
      semanticTokenAuthority: "v1",
    },
    publicationOutputs: [],
    invalidationScope: { kind: "MODULE", moduleId: "global-v2:m4-rhythm-routines" },
    capabilityRequirements: [
      { capabilityId: "global-v2:person-day-exposure", requirement: "REQUIRED" },
      { capabilityId: "global-v2:dated-place-role", requirement: "OPTIONAL" },
    ],
  }, { authorizedPersonIds: input.authorizedPersonIds });
}

export const globalM4PlaceRoleCapability = assertCapabilityRespectsAuthorityGates(parseGlobalCapability({
  capabilityId: "global-v2:dated-place-role",
  state: "UNAVAILABLE",
  authorityGateIds: [],
  reasonCodes: ["CANONICAL_DATED_PLACE_ROLE_ABSENT", "M09_AUTHORITY_GATED"],
  supportedPersonScopes: [],
  supportedEntityScopes: [],
  evidenceRefs: ["docs/global-v2/GA0-post-history-reality-check.md", "docs/history-v2/26-history-core-shared-doctrines-report.md"],
  policyRef: "global-place-role-authority@v1",
}));
