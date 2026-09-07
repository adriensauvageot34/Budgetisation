import "server-only";

import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex, utf8ToBytes } from "@noble/hashes/utils.js";
import {
  buildGlobalPurchaseMerchant,
  createGlobalM8DependencyDeclaration,
  GlobalTemporalBoundaryResolver,
  type GlobalPurchaseAdjustmentInput,
  type GlobalPurchaseMetadataAuthority,
} from "@/analytics/global-v2";
import {
  assertGlobalDependencyClosure,
  canonicalSerializeGlobal,
  computeGlobalDependencyDeclarationDigest,
  parseGlobalAnalysisScopeV2,
  parseGlobalTimeWindowPolicy,
  parseGlobalValueProvenance,
} from "@/core/global-v2";
import { addDays, parseLocalDate, parseYearMonth } from "@/core/time";
import type { CanonicalRepository } from "@/server/canonical/repository";

const digest = (value: unknown) => bytesToHex(sha256(utf8ToBytes(canonicalSerializeGlobal(value))));

/**
 * Read-only M8 wiring. The optional metadata/adjustment parameters represent an
 * explicit future Canonical provider. Their absence never falls back to an
 * operation, a label, a processor or temporal proximity.
 */
export async function resolveGlobalM8PurchaseAuthority(input: {
  readonly repository: CanonicalRepository;
  readonly scope: unknown;
  readonly metadataAuthorities?: readonly GlobalPurchaseMetadataAuthority[];
  readonly adjustments?: readonly GlobalPurchaseAdjustmentInput[];
}) {
  const { repository } = input;
  const context = repository.context;
  const scope = parseGlobalAnalysisScopeV2(input.scope, {
    householdTimeZone: context.timezone,
    authorizedPersonIds: context.personIds,
  });
  if (scope.time.asOf > context.asOf) throw new TypeError("M8_RUNTIME_ASOF_MISMATCH");
  if (Object.values(scope.filters).some((values) => values.length)) throw new TypeError("M8_FILTER_PROVIDER_NOT_RESOLVED");
  if (scope.subject.kind !== "household") throw new TypeError("M8_PERSON_SCOPE_REQUIRES_FULL_COMPONENT_ATTRIBUTION_PROVIDER");

  const certifiedThroughMonth = parseYearMonth(scope.time.certifiedThrough.slice(0, 7));
  const periods = context.periods
    .filter((period) => period.householdId === context.householdId && period.month.slice(0, 7) <= certifiedThroughMonth)
    .sort((a, b) => a.month.localeCompare(b.month));
  const earliest = periods[0]?.month ?? `${certifiedThroughMonth}-01`;
  const range = { start: parseLocalDate(earliest), endExclusive: addDays(scope.time.certifiedThrough, 1) };
  const [sourceHealth, allFacts, economicFacts] = await Promise.all([
    repository.purchaseEventSourceHealth(),
    repository.loadPurchaseEvents(),
    repository.loadEconomicFacts(range),
  ]);
  const metadataAuthorities = [...(input.metadataAuthorities ?? [])];
  const metadataById = new Map(metadataAuthorities.map((row) => [row.purchaseEventId, row]));
  if (metadataById.size !== metadataAuthorities.length) throw new TypeError("M8_DUPLICATE_PURCHASE_METADATA");

  const provenance = parseGlobalValueProvenance({
    resultNature: "OBSERVED",
    precision: "EXACT",
    integrationMode: "DERIVED_FROM_OBSERVED",
    monetaryBasis: "AUTHORITATIVE_ECONOMIC",
    sourceRefs: ["canonical:purchase_events", "canonical:purchase_event_memberships", "canonical:purchase_event_timing_assertions", "canonical:financial_economic_cost_canonical"],
    factRefs: ["fct_purchase_event", "fct_economic_component"],
    evidenceRefs: allFacts.map(({ purchaseEventId }) => `purchase-event:${purchaseEventId}`).sort(),
    entityRefs: [],
    upstreamMetricRefs: [],
    policyVersions: { purchaseIdentity: "v1", purchaseAt: "v1" },
    dataRevision: context.dataRevision,
    analyticsRevision: context.analyticsRevision,
  });
  const boundary = new GlobalTemporalBoundaryResolver().resolve({
    scope,
    policy: parseGlobalTimeWindowPolicy({
      policyId: "global-purchase-certified-corpus",
      policyVersion: "v1",
      naturalGrain: "PURCHASE_EVENT",
      corpus: "CERTIFIED_HISTORY",
      lookback: { kind: "ALL_RELIABLE" },
      gapPolicy: "PRESERVE",
      comparableIntersection: "NOT_REQUIRED",
    }),
    supportPolicy: { policyRef: "global-purchase-observable-months@v1", minimumRequired: 1, strongAt: 12 },
    candidates: allFacts.map((fact) => {
      const metadata = metadataById.get(String(fact.purchaseEventId));
      const date = metadata?.purchaseAt?.date ?? scope.time.certifiedThrough;
      return {
        unitId: String(fact.purchaseEventId),
        authority: "CERTIFIED_HISTORY" as const,
        start: parseLocalDate(date),
        end: parseLocalDate(date),
        eligible: metadata?.purchaseAt !== undefined,
        observed: metadata?.purchaseAt !== undefined,
        comparable: metadata?.purchaseAt !== undefined,
        methodExcluded: metadata?.purchaseAt === undefined,
        dependencyRefs: [`purchase-event:${fact.purchaseEventId}`, ...(metadata?.purchaseAt?.evidenceRefs ?? [])],
      };
    }),
    certifiedProvenance: provenance,
  });
  const selectedIds = new Set(boundary.certifiedUnitIds);
  const facts = allFacts.filter((fact) => selectedIds.has(String(fact.purchaseEventId)));
  const componentKeys = new Set(facts.flatMap((fact) => fact.sources.filter(({ membershipKind }) => membershipKind === "CONSUMPTION_COMPONENT").map(({ canonicalComponentKey }) => String(canonicalComponentKey))));
  const selectedEconomicFacts = economicFacts.filter((fact) => componentKeys.has(String(fact.canonicalComponentKey)));
  const merchantIds = [...new Set(selectedEconomicFacts.flatMap(({ merchant }) => merchant.kind === "resolved" ? [String(merchant.id)] : []))].sort();
  const merchantRows = merchantIds.length === 0 ? [] : await repository.loadEntityRows("merchants", "merchant_id", merchantIds);

  const dependencyDigests: Record<string, string> = {};
  const register = (ref: string, value: unknown) => {
    const valueDigest = digest(value);
    if (dependencyDigests[ref] !== undefined && dependencyDigests[ref] !== valueDigest) throw new TypeError(`M8_CONTRADICTORY_DEPENDENCY:${ref}`);
    dependencyDigests[ref] = valueDigest;
  };
  for (const fact of facts) {
    register(`purchase-event:${fact.purchaseEventId}`, fact);
    for (const ref of fact.sources.flatMap(({ evidenceRefs }) => evidenceRefs)) register(ref, { purchaseEventId: fact.purchaseEventId, ref });
  }
  for (const fact of selectedEconomicFacts) register(`economic-component:${fact.canonicalComponentKey}`, fact);
  for (const metadata of metadataAuthorities) for (const ref of [...metadata.evidenceRefs, ...(metadata.purchaseAt?.evidenceRefs ?? [])]) register(ref, metadata);
  for (const adjustment of input.adjustments ?? []) for (const ref of adjustment.evidenceRefs) register(ref, adjustment);
  register("purchase-eligibility:unresolved", { status: "AUTHORITY_GATED", reason: "NO_CANONICAL_ELIGIBLE_PURCHASE_UNIVERSE" });

  const result = buildGlobalPurchaseMerchant({
    householdId: String(context.householdId),
    sourceRevision: String(context.dataRevision),
    certifiedThroughMonth,
    facts,
    economicFacts: selectedEconomicFacts,
    ...(metadataAuthorities.length === 0 ? {} : { metadataAuthorities }),
    ...((input.adjustments?.length ?? 0) === 0 ? {} : { adjustments: input.adjustments }),
    eligibilityUniverse: { status: "UNKNOWN", reasonCode: sourceHealth === "AVAILABLE" ? "DATA_GATED" : "AUTHORITY_GATED", evidenceRefs: ["purchase-eligibility:unresolved"] },
    observableMonths: periods.filter(({ isClosed, financeStatus }) => isClosed && financeStatus === "complete").map(({ month }) => parseYearMonth(month.slice(0, 7))),
    dependencyDigests,
  });
  const personScope = { kind: "HOUSEHOLD" as const };
  const declaration = createGlobalM8DependencyDeclaration({ personScope, authorizedPersonIds: context.personIds, merchantIds });
  const consumption = {
    factDependencyIds: ["fct_purchase_event", "fct_economic_component"],
    entityDependencyIds: ["purchase_events", ...(merchantRows.length === 0 ? [] : ["merchants"])],
    upstreamAnalyticsIds: ["economic_consumption_net_attributable"],
    otherModuleDependencyIds: ["GlobalTemporalBoundaryResolver", "GlobalMaterialityEngine"],
    policyIds: ["global-purchase-certified-corpus", "global-purchase-observable-months", "purchase-merchant-coverage", "global-materiality-merchant", "identity", "retained", "adjustment", "merchant", "coverage", "ticket", "temporal"],
  };
  assertGlobalDependencyClosure(declaration, consumption);
  return {
    ...result,
    boundary,
    dependencyDeclaration: declaration,
    sourceHash: digest(Object.entries(dependencyDigests).sort(([a], [b]) => a.localeCompare(b))),
    executionHash: digest({ result: result.inputHash, boundary: boundary.resolutionHash, declaration: computeGlobalDependencyDeclarationDigest(declaration) }),
    providerStatus: {
      purchaseEventSchema: sourceHealth === "AVAILABLE" ? "CONNECTED" : sourceHealth,
      purchaseEventData: allFacts.length === 0 ? "DATA_GATED" : "CONNECTED",
      purchaseAt: metadataAuthorities.length === 0 ? "AUTHORITY_GATED" : "CONNECTED",
      eligiblePurchaseUniverse: "AUTHORITY_GATED",
      adjustments: (input.adjustments?.length ?? 0) === 0 ? "DATA_GATED" : "CONNECTED",
      merchant: merchantRows.length === 0 ? "DATA_GATED" : "CONNECTED",
      establishment: "AUTHORITY_GATED",
      product: "DEFERRED_P10",
    },
    liveWrites: "NONE" as const,
  };
}
