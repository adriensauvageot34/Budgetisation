import type { PersonId } from "../../core/identity";
import { parseGlobalDependencyDeclaration } from "../../core/global-v2";

export function createGlobalM10DependencyDeclaration(personIds: readonly [PersonId, PersonId]) {
  return parseGlobalDependencyDeclaration({
    declarationVersion: "global-dependency-declaration@v1", resourceId: "global-v2:m10-shared-participation",
    factDependencies: [
      { kind: "FACT", id: "fct_activity_occurrence", requirement: "REQUIRED", scopeRelation: "positive-canonical-participation-only", corpusAuthority: "CERTIFIED_HISTORY" },
      { kind: "FACT", id: "fct_person_day", requirement: "OPTIONAL", scopeRelation: "shared-observable-support-denominator", corpusAuthority: "CERTIFIED_HISTORY" },
      { kind: "FACT", id: "fct_place_visit", requirement: "OPTIONAL", scopeRelation: "strict-stop-stay-copresence-only", corpusAuthority: "CERTIFIED_HISTORY" },
      { kind: "FACT", id: "fct_economic_component", requirement: "OPTIONAL", scopeRelation: "cost-context-independent-from-participation", corpusAuthority: "CERTIFIED_HISTORY" },
    ],
    entityDependencies: [
      { kind: "ENTITY", id: "life_event_participations", requirement: "REQUIRED", scopeRelation: "positive-or-explicit-negative-participation-authority" },
      { kind: "ENTITY", id: "moments", requirement: "OPTIONAL", scopeRelation: "explicit-participants-or-authorized-multiday-proof" },
      { kind: "ENTITY", id: "places", requirement: "OPTIONAL", scopeRelation: "canonical-hierarchy-resolution-only" },
      { kind: "ENTITY", id: "contacts", requirement: "OPTIONAL", scopeRelation: "authority-gated-AG024-AG031" },
    ],
    upstreamAnalytics: [
      { kind: "ANALYTICS", id: "global-v2:m6-moment-experiences", requirement: "OPTIONAL", scopeRelation: "moment-window-and-structural-proof-only", corpusAuthority: "CERTIFIED_HISTORY" },
      { kind: "ANALYTICS", id: "global-v2:m7-place-mobility", requirement: "OPTIONAL", scopeRelation: "visit-proof-only-no-finance-inference", corpusAuthority: "CERTIFIED_HISTORY" },
    ],
    otherModuleDependencies: [{ kind: "MODULE", id: "SharedParticipationResolver", requirement: "REQUIRED", scopeRelation: "sole-shared-participation-authority" }],
    naturalGrain: "OCCURRENCE", timeWindowPolicy: { id: "global-shared-natural-univers", version: "v1" }, historicalLookback: { kind: "ALL_RELIABLE" },
    personScope: { kind: "COMPARABLE_PERSONS", personIds: [...personIds].sort(), intersectionPolicy: { id: "global-shared-observable-intersection", version: "v1" } }, entityScope: { kind: "NONE" },
    supportPolicy: { id: "global-shared-observable-support", version: "v1" }, coveragePolicy: { id: "global-shared-coverage", version: "v1" }, materialityPolicy: { id: "global-materiality-shared", version: "v1" },
    methodVersion: "global_shared_participation@v1", policyVersions: { evidence: "v1", copresence: "v1", activityCatalog: "v1", multidayMoment: "v1", support: "v1", social: "v1" },
    publicationOutputs: [], invalidationScope: { kind: "MODULE", moduleId: "global-v2:m10-shared-participation" },
    capabilityRequirements: [{ capabilityId: "global-v2:shared-participation-resolver", requirement: "REQUIRED" }, { capabilityId: "global-v2:contact-social-identity", requirement: "OPTIONAL" }],
  }, { authorizedPersonIds: personIds });
}
