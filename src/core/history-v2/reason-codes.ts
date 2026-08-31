import { parseStringLiteral } from "../validation";

export const historyV2ReasonCodeRegistry = Object.freeze({
  DATA_NO_SOURCE: "data",
  DATA_PARTIAL_SOURCE: "data",
  DATA_UNASSIGNED_TIMING: "data",
  DATA_UNCLASSIFIED_COMPONENT: "data",
  DATA_NO_PURCHASE_EVENT: "data",
  DATA_NO_CONTINUITY_ASSERTION: "data",
  DATA_NO_LOCATION_AUTHORITY: "data",
  DATA_NO_CAUSAL_LINK: "data",
  DATA_CONFLICTING_AUTHORITIES: "conflict",
  REFERENCE_INSUFFICIENT_SUPPORT: "reference",
  REFERENCE_LIMITED_SUPPORT: "reference",
  COVERAGE_INSUFFICIENT: "coverage",
  COVERAGE_PARTIAL: "coverage",
  POLICY_NOT_APPLICABLE: "policy",
  POLICY_NOT_MATERIAL: "policy",
  POLICY_NOT_ELIGIBLE: "policy",
  COLLECTION_KNOWN_EMPTY: "collection",
  COLLECTION_PARTIAL: "collection",
  FEATURE_DEFERRED: "feature",
  PUBLICATION_STALE: "publication",
  PUBLICATION_CONTRACT_MISMATCH: "publication",
  PUBLICATION_POLICY_MISMATCH: "publication",
  PUBLICATION_FACTS_MISMATCH: "publication",
} as const);

export type HistoryV2ReasonCode = keyof typeof historyV2ReasonCodeRegistry;
export type HistoryV2ReasonFamily =
  (typeof historyV2ReasonCodeRegistry)[HistoryV2ReasonCode];

const reasonCodes: ReadonlySet<string> = new Set(
  Object.keys(historyV2ReasonCodeRegistry),
);

export function parseHistoryV2ReasonCode(
  value: unknown,
): HistoryV2ReasonCode {
  return parseStringLiteral<HistoryV2ReasonCode>(
    value,
    reasonCodes,
    "HistoryV2ReasonCode",
  );
}

export function historyV2ReasonFamily(
  reasonCode: HistoryV2ReasonCode,
): HistoryV2ReasonFamily {
  return historyV2ReasonCodeRegistry[reasonCode];
}
