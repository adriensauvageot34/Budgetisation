import {
  parseSupport,
  type Support,
  type SupportLevel,
  type SupportUnit,
} from "../../core/metrics";

export type SupportPolicyId =
  | "typical_month"
  | "neutral_day"
  | "independent_28d_block"
  | "median_ticket"
  | "activity_causal_cost"
  | "seasonality";

type ReliableSupportCounts = {
  readonly eligibleN?: number;
  readonly observableN?: number;
  readonly excludedN?: number;
};

const policyUnits = {
  typical_month: "month",
  neutral_day: "day",
  independent_28d_block: "independent_28d_block",
  median_ticket: "purchase_event",
  activity_causal_cost: "occurrence",
  seasonality: "year",
} as const satisfies Record<SupportPolicyId, SupportUnit>;

export function supportLevelForPolicy(
  policy: SupportPolicyId,
  n: number,
): SupportLevel {
  if (!Number.isSafeInteger(n) || n < 0) {
    throw new TypeError("Support.n doit être un entier positif ou nul.");
  }
  switch (policy) {
    case "typical_month":
      return n >= 9 ? "sufficient" : n >= 6 ? "limited" : "insufficient";
    case "neutral_day":
      return n >= 10 ? "sufficient" : n >= 5 ? "limited" : "insufficient";
    case "independent_28d_block":
      return n >= 9 ? "sufficient" : n >= 6 ? "limited" : "insufficient";
    case "median_ticket":
    case "activity_causal_cost":
      return n >= 8 ? "sufficient" : n >= 5 ? "limited" : "insufficient";
    case "seasonality":
      return n >= 3 ? "sufficient" : n === 2 ? "limited" : "insufficient";
  }
}

export function supportForPolicy(
  policy: SupportPolicyId,
  n: number,
  counts: ReliableSupportCounts = {},
): Support {
  return parseSupport({
    n,
    unit: policyUnits[policy],
    level: supportLevelForPolicy(policy, n),
    ...(counts.eligibleN === undefined
      ? {}
      : { eligibleN: counts.eligibleN }),
    ...(counts.observableN === undefined
      ? {}
      : { observableN: counts.observableN }),
    ...(counts.excludedN === undefined
      ? {}
      : { excludedN: counts.excludedN }),
  });
}

export function assertHomogeneousSupportUnits(
  values: readonly unknown[],
): readonly Support[] {
  const supports = values.map(parseSupport);
  const units = new Set(supports.map(({ unit }) => unit));
  if (units.size > 1) {
    throw new TypeError(
      "Des supports hétérogènes ne peuvent pas être additionnés.",
    );
  }
  return supports;
}
