import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex, utf8ToBytes } from "@noble/hashes/utils.js";
import {
  assertCapabilityRespectsAuthorityGates,
  canonicalSerializeGlobal,
  type GlobalCapability,
} from "../../core/global-v2";

export const GLOBAL_PRODUCT_CAPABILITY_FREEZE_VERSION = "global-product-capability-freeze@v1";

export type GlobalProductCapabilityClass =
  | "AVAILABLE_AND_REQUIRED"
  | "DATA_GATED_IMPLEMENTABLE"
  | "AUTHORITY_GATED_UNAVAILABLE"
  | "DEFERRED_BY_CONTRACT"
  | "REQUIRES_T01";

type ProductGate = {
  readonly capabilityId: string;
  readonly authorityGateIds: readonly string[];
  readonly classification: GlobalProductCapabilityClass;
  readonly reasonCode: string;
};

const PRODUCT_GATES: readonly ProductGate[] = Object.freeze([
  { capabilityId: "CAP-ENG-022", authorityGateIds: ["AG002"], classification: "AUTHORITY_GATED_UNAVAILABLE", reasonCode: "PURCHASE_CYCLE_AUTHORITY_UNAVAILABLE" },
  { capabilityId: "CAP-ENG-023", authorityGateIds: ["AG003"], classification: "AUTHORITY_GATED_UNAVAILABLE", reasonCode: "PRODUCT_PRICE_AUTHORITY_UNAVAILABLE" },
  { capabilityId: "CAP-ENG-024", authorityGateIds: ["AG004"], classification: "AUTHORITY_GATED_UNAVAILABLE", reasonCode: "PERSONAL_PRICE_INDEX_AUTHORITY_UNAVAILABLE" },
  { capabilityId: "CAP-M08-017", authorityGateIds: ["AG012"], classification: "AUTHORITY_GATED_UNAVAILABLE", reasonCode: "PURCHASE_LINE_FACT_AUTHORITY_UNAVAILABLE" },
  { capabilityId: "CAP-M08-018", authorityGateIds: ["AG013"], classification: "AUTHORITY_GATED_UNAVAILABLE", reasonCode: "PRODUCT_FAMILY_AUTHORITY_UNAVAILABLE" },
  { capabilityId: "CAP-M08-019", authorityGateIds: ["AG014"], classification: "AUTHORITY_GATED_UNAVAILABLE", reasonCode: "PRODUCT_VARIANT_AUTHORITY_UNAVAILABLE" },
  { capabilityId: "CAP-M08-020", authorityGateIds: ["AG015"], classification: "AUTHORITY_GATED_UNAVAILABLE", reasonCode: "PRODUCT_FORMAT_AUTHORITY_UNAVAILABLE" },
  { capabilityId: "CAP-M08-021", authorityGateIds: ["AG016"], classification: "AUTHORITY_GATED_UNAVAILABLE", reasonCode: "NORMALIZED_UNIT_AUTHORITY_UNAVAILABLE" },
  { capabilityId: "CAP-M08-022", authorityGateIds: ["AG017"], classification: "AUTHORITY_GATED_UNAVAILABLE", reasonCode: "PRODUCT_ACQUISITION_AUTHORITY_UNAVAILABLE" },
  { capabilityId: "CAP-M08-023", authorityGateIds: ["AG018"], classification: "AUTHORITY_GATED_UNAVAILABLE", reasonCode: "PRODUCT_CADENCE_AUTHORITY_UNAVAILABLE" },
  { capabilityId: "CAP-M08-024", authorityGateIds: ["AG019"], classification: "AUTHORITY_GATED_UNAVAILABLE", reasonCode: "PRODUCT_LIFECYCLE_AUTHORITY_UNAVAILABLE" },
  { capabilityId: "CAP-M08-025", authorityGateIds: ["AG020"], classification: "AUTHORITY_GATED_UNAVAILABLE", reasonCode: "PRODUCT_SUBSTITUTION_AUTHORITY_UNAVAILABLE" },
  { capabilityId: "CAP-M08-026", authorityGateIds: ["AG021"], classification: "AUTHORITY_GATED_UNAVAILABLE", reasonCode: "PERSONAL_CONSUMPTION_PRICE_INDEX_AUTHORITY_UNAVAILABLE" },
  { capabilityId: "CAP-M09-017", authorityGateIds: ["AG022"], classification: "DEFERRED_BY_CONTRACT", reasonCode: "PERSONAL_REFERENCE_COST_DEFERRED_TO_PERSONA_OWNER" },
]);

const digest = (value: unknown) => bytesToHex(sha256(utf8ToBytes(canonicalSerializeGlobal(value))));

/**
 * P10 closes the negative contract. Raw items, price observations and labels are
 * evidence of data presence only; none can open an authority gate.
 */
export function buildGlobalProductCapabilityClosure(input: {
  readonly rawOperationItemCount: number;
  readonly rawProductObservationCount: number;
  readonly rawPriceObservationCount: number;
  readonly evidenceRefs: readonly string[];
}) {
  if (![input.rawOperationItemCount, input.rawProductObservationCount, input.rawPriceObservationCount]
    .every((value) => Number.isSafeInteger(value) && value >= 0)) throw new TypeError("P10_INVALID_RAW_PRODUCT_COUNTS");
  const evidenceRefs = [...new Set(input.evidenceRefs)].sort();
  if (evidenceRefs.length === 0) throw new TypeError("P10_PRODUCT_GATE_EVIDENCE_REQUIRED");
  const capabilities = PRODUCT_GATES.map((gate): GlobalCapability & { readonly classification: GlobalProductCapabilityClass } => ({
    ...assertCapabilityRespectsAuthorityGates({
      capabilityId: gate.capabilityId,
      state: "UNAVAILABLE",
      authorityGateIds: gate.authorityGateIds,
      reasonCodes: ["AUTHORITY_NOT_PROVEN_GA0", gate.reasonCode],
      supportedPersonScopes: [],
      supportedEntityScopes: [],
      evidenceRefs,
      policyRef: GLOBAL_PRODUCT_CAPABILITY_FREEZE_VERSION,
    }),
    classification: gate.classification,
  }));
  return {
    status: "AUTHORITY_GATED" as const,
    capabilities,
    rawInputsAreAuthority: false as const,
    forbiddenFallbacks: [
      "BANK_ITEM_AS_PURCHASE_LINE", "PRICE_OBSERVATION_AS_ACQUISITION", "MERCHANT_AS_PRODUCT",
      "CATEGORY_AS_PRODUCT_FAMILY", "TEXT_AS_PRODUCT_IDENTITY", "DEFAULT_QUANTITY_ONE",
      "TOTAL_SPEND_AS_INFLATION", "PAYER_AS_BENEFICIARY",
    ] as const,
    requiresT01: true as const,
    methodVersion: GLOBAL_PRODUCT_CAPABILITY_FREEZE_VERSION,
    inputHash: digest({ input: { ...input, evidenceRefs }, gates: PRODUCT_GATES, version: GLOBAL_PRODUCT_CAPABILITY_FREEZE_VERSION }),
  };
}

export function globalProductGateCatalog() {
  return PRODUCT_GATES;
}
