import {
  historyV2PolicyRegistry,
  parseDisplayRole,
  type DisplayNode,
  type DisplayRole,
  type HistoryV2ReasonCode,
  type HistoryV2Result,
} from "../../core/history-v2";

export const qualityVisibilityPolicyVersion =
  historyV2PolicyRegistry.quality_visibility;

export type VisibilityEligibility =
  | "ELIGIBLE"
  | "TRIGGER_UNPROVEN"
  | "NOT_ELIGIBLE"
  | "NOT_MATERIAL"
  | "FEATURE_DEFERRED";

export type VisibilityPolicyInput<T> = {
  readonly role: DisplayRole;
  readonly result: HistoryV2Result<T>;
  readonly eligibility?: VisibilityEligibility;
  readonly partialPresentation?: "VISIBLE" | "PLACEHOLDER";
  readonly knownEmptyInformative?: boolean;
  readonly notApplicableVisibility?: "PLACEHOLDER" | "HIDDEN";
};

function qualityOf<T>(result: HistoryV2Result<T>) {
  return result.quality;
}

function resultReason<T>(
  result: HistoryV2Result<T>,
  fallback: HistoryV2ReasonCode,
): HistoryV2ReasonCode {
  return qualityOf(result)?.reasonCode ?? fallback;
}

function placeholder<T>(
  result: HistoryV2Result<T>,
  reasonCode: HistoryV2ReasonCode,
): DisplayNode<HistoryV2Result<T>> {
  const quality = qualityOf(result);
  return {
    visibility: "PLACEHOLDER",
    reasonCode,
    ...(quality === undefined ? {} : { quality }),
  };
}

function hidden<T>(
  result: HistoryV2Result<T>,
  reasonCode?: HistoryV2ReasonCode,
): DisplayNode<HistoryV2Result<T>> {
  const quality = qualityOf(result);
  return {
    visibility: "HIDDEN",
    ...(reasonCode === undefined ? {} : { reasonCode }),
    ...(quality === undefined ? {} : { quality }),
  };
}

function visible<T>(
  result: HistoryV2Result<T>,
): DisplayNode<HistoryV2Result<T>> {
  const quality = qualityOf(result);
  return {
    visibility: "VISIBLE",
    data: result,
    ...(quality?.reasonCode === undefined
      ? {}
      : { reasonCode: quality.reasonCode }),
    ...(quality === undefined ? {} : { quality }),
  };
}

function isKnownEmptyCollection<T>(result: HistoryV2Result<T>): boolean {
  return result.status === "KNOWN"
    && "items" in result
    && result.items.length === 0;
}

function ineligibleReason(
  eligibility: Exclude<VisibilityEligibility, "ELIGIBLE">,
): HistoryV2ReasonCode {
  switch (eligibility) {
    case "NOT_MATERIAL":
      return "POLICY_NOT_MATERIAL";
    case "FEATURE_DEFERRED":
      return "FEATURE_DEFERRED";
    case "NOT_ELIGIBLE":
    case "TRIGGER_UNPROVEN":
      return "POLICY_NOT_ELIGIBLE";
  }
}

export function resolveHistoryV2DisplayNode<T>(
  input: VisibilityPolicyInput<T>,
): DisplayNode<HistoryV2Result<T>> {
  const role = parseDisplayRole(input.role);
  const eligibility = input.eligibility ?? "ELIGIBLE";
  if (eligibility !== "ELIGIBLE") {
    const reasonCode = ineligibleReason(eligibility);
    if (
      eligibility === "FEATURE_DEFERRED"
      || role === "CONDITIONAL"
      || role === "DETAIL"
    ) {
      return hidden(input.result, reasonCode);
    }
    return placeholder(input.result, reasonCode);
  }

  switch (input.result.status) {
    case "KNOWN":
      if (
        isKnownEmptyCollection(input.result)
        && !input.knownEmptyInformative
        && role !== "CORE"
      ) {
        return hidden(input.result, "COLLECTION_KNOWN_EMPTY");
      }
      return visible(input.result);
    case "PARTIAL":
      return input.partialPresentation === "VISIBLE"
        ? visible(input.result)
        : placeholder(
            input.result,
            resultReason(input.result, "DATA_PARTIAL_SOURCE"),
          );
    case "UNKNOWN":
      return placeholder(
        input.result,
        resultReason(input.result, "DATA_NO_SOURCE"),
      );
    case "CONFLICT":
      return placeholder(
        input.result,
        resultReason(input.result, "DATA_CONFLICTING_AUTHORITIES"),
      );
    case "NOT_APPLICABLE": {
      const visibility = input.notApplicableVisibility
        ?? (role === "CORE" ? "PLACEHOLDER" : "HIDDEN");
      const reasonCode = resultReason(
        input.result,
        "POLICY_NOT_APPLICABLE",
      );
      return visibility === "PLACEHOLDER"
        ? placeholder(input.result, reasonCode)
        : hidden(input.result, reasonCode);
    }
  }
}
