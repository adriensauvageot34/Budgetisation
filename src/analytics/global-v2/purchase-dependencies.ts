import type { PersonId } from "../../core/identity";
import { parseGlobalDependencyDeclaration, type GlobalPersonScopePolicy } from "../../core/global-v2";

export function createGlobalM8DependencyDeclaration(input: {
  readonly personScope: GlobalPersonScopePolicy;
  readonly authorizedPersonIds: readonly PersonId[];
  readonly merchantIds: readonly string[];
}) {
  return parseGlobalDependencyDeclaration({
    declarationVersion: "global-dependency-declaration@v1",
    resourceId: "global-v2:m8-purchase-merchant-core",
    factDependencies: [
      { kind: "FACT", id: "fct_purchase_event", requirement: "REQUIRED", scopeRelation: "canonical-human-acquisition-identity", corpusAuthority: "CERTIFIED_HISTORY" },
      { kind: "FACT", id: "fct_economic_component", requirement: "REQUIRED", scopeRelation: "purchase-consumption-membership-euro-authority", corpusAuthority: "CERTIFIED_HISTORY" },
      { kind: "FACT", id: "fct_economic_person_attribution", requirement: "OPTIONAL", scopeRelation: "beneficiary-only-never-payer-fallback", corpusAuthority: "CERTIFIED_HISTORY" },
      { kind: "FACT", id: "fct_purchase_adjustment", requirement: "OPTIONAL", scopeRelation: "explicit-adjustment-or-economic-refund-authority", corpusAuthority: "CERTIFIED_HISTORY" },
    ],
    entityDependencies: [
      { kind: "ENTITY", id: "purchase_events", requirement: "REQUIRED", scopeRelation: "same-household-explicit-membership" },
      { kind: "ENTITY", id: "merchants", requirement: "OPTIONAL", scopeRelation: "canonical-merchant-id-only" },
      { kind: "ENTITY", id: "merchant_establishments", requirement: "OPTIONAL", scopeRelation: "explicit-establishment-only" },
      { kind: "ENTITY", id: "payment_processors", requirement: "OPTIONAL", scopeRelation: "distinct-from-merchant" },
      { kind: "ENTITY", id: "marketplaces", requirement: "OPTIONAL", scopeRelation: "channel-not-seller-fallback" },
    ],
    upstreamAnalytics: [
      { kind: "ANALYTICS", id: "economic_consumption_net_attributable", requirement: "REQUIRED", scopeRelation: "same-owned-components", corpusAuthority: "CERTIFIED_HISTORY" },
    ],
    otherModuleDependencies: [
      { kind: "MODULE", id: "GlobalTemporalBoundaryResolver", requirement: "REQUIRED", scopeRelation: "purchase-event-certified-corpus" },
      { kind: "MODULE", id: "GlobalMaterialityEngine", requirement: "REQUIRED", scopeRelation: "merchant-temporal-significance" },
    ],
    naturalGrain: "PURCHASE_EVENT",
    timeWindowPolicy: { id: "global-purchase-certified-corpus", version: "v1" },
    historicalLookback: { kind: "ALL_RELIABLE" },
    personScope: input.personScope,
    entityScope: input.merchantIds.length === 0
      ? { kind: "NONE" }
      : { kind: "ENTITY_SET", entityType: "merchant", entityIds: [...new Set(input.merchantIds)].sort() },
    supportPolicy: { id: "global-purchase-observable-months", version: "v1" },
    coveragePolicy: { id: "purchase-merchant-coverage", version: "v1" },
    materialityPolicy: { id: "global-materiality-merchant", version: "v1" },
    methodVersion: "global_purchase_merchant@v1",
    policyVersions: {
      identity: "v1", retained: "v1", adjustment: "v1", merchant: "v1",
      coverage: "v1", ticket: "v1", temporal: "v1",
    },
    publicationOutputs: [],
    invalidationScope: { kind: "MODULE", moduleId: "global-v2:m8-purchase-merchant-core" },
    capabilityRequirements: [
      { capabilityId: "global-v2:purchase-event-identity", requirement: "REQUIRED" },
      { capabilityId: "global-v2:purchase-adjustment", requirement: "REQUIRED" },
      { capabilityId: "global-v2:merchant-identity", requirement: "REQUIRED" },
      { capabilityId: "global-v2:merchant-establishment", requirement: "OPTIONAL" },
      { capabilityId: "global-v2:product-line", requirement: "OPTIONAL" },
    ],
  }, { authorizedPersonIds: input.authorizedPersonIds });
}
