import Big from "big.js";
import { parseMoney } from "../../core/money";
import type { ActivityOccurrenceCostFact, PurchaseAwareEconomicFact } from "../facts";

/** Adjust only existing causal grocery costs whose Operation owner was superseded by a known purchase gross. */
export function projectPurchaseAwareGroceryCausalCosts(input: {
  readonly costs: readonly ActivityOccurrenceCostFact[];
  readonly purchaseFacts: readonly PurchaseAwareEconomicFact[];
}): readonly ActivityOccurrenceCostFact[] {
  const mixedByKey = new Map(input.purchaseFacts.flatMap((fact) =>
    fact.sourceOperation.kind === "resolved"
      && fact.economicAmount.status === "KNOWN"
      && fact.bankAmount.status === "KNOWN"
      ? [[String(fact.canonicalComponentKey), fact] as const] : []));
  return input.costs.map((cost) => {
    if (String(cost.activityId) !== "courses_alimentaires" || cost.causalCost.availability !== "known") return cost;
    const linkedKeys = [...new Set(cost.evidence.map(({ canonicalComponentKey }) => String(canonicalComponentKey)))];
    const matched = linkedKeys.flatMap((key) => mixedByKey.get(key) ?? []);
    if (matched.length === 0) return cost;
    const corrected = matched.reduce((total, fact) => total
      .plus(fact.economicAmount.status === "KNOWN" ? fact.economicAmount.value : "0")
      .minus(fact.bankAmount.status === "KNOWN" ? fact.bankAmount.value : "0"), new Big(cost.causalCost.value));
    if (corrected.lt(0)) throw new TypeError(`GROCERY_PURCHASE_CAUSAL_COST_NEGATIVE:${cost.occurrenceId}`);
    return { ...cost, causalCost: { availability: "known" as const, value: parseMoney(corrected.toString()) } };
  });
}
