import Big from "big.js";
import type { PlannedPriceSuggestion } from "./planned-contract";
/** Typical observed grocery operation, not a monthly envelope divided by an invented cadence. */
export function groceryBasketEstimate(entries: readonly { operationId: string; subcategory: string; amount: string; date: string }[]): PlannedPriceSuggestion | null {
  const operations = new Map<string, Big>();
  for (const row of entries) if (row.subcategory === "Courses alimentaires" && new Big(row.amount).gt(0))
    operations.set(row.operationId, (operations.get(row.operationId) ?? new Big(0)).plus(row.amount));
  if (operations.size < 3) return null;
  const values = [...operations.values()].sort((a, b) => a.cmp(b)), middle = Math.floor(values.length / 2);
  const median = values.length % 2 ? values[middle]! : values[middle - 1]!.plus(values[middle]!).div(2);
  return { assetKey: "groceries:food", unitAmount: median.round(2).toFixed(2), sourceLabel: `${operations.size} courses observées · médiane du coût alimentaire` };
}
