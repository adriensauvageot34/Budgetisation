import { decisionAmount } from "../month-decision-contract";
import { plannerKeys, plannerRecord, plannerString } from "./json";
import type { KernelCost } from "./compiler-contract";
import type { FundingAllocation } from "../planned-contract";

/** Existing kernel input grammar, shared with snapshot validation. No calculation. */
export function parseKernelFunding(raw: unknown): FundingAllocation[] {
  if (!Array.isArray(raw) || raw.length > 3) throw new TypeError("PLANNER_FUNDING_INVALID");
  const values = raw.map(item => {
    const value = plannerRecord(item); plannerKeys(value, ["source", "amount"]);
    if (!["BANK", "SWILE", "EDENRED"].includes(String(value.source))) throw new TypeError("PLANNER_FUNDING_INVALID");
    if (value.source !== "BANK") throw new TypeError("PLANNER_WALLET_ELIGIBILITY_UNRESOLVED");
    return { source: "BANK" as const, amount: decisionAmount(value.amount) };
  });
  if (new Set(values.map(value => value.source)).size !== values.length) throw new TypeError("PLANNER_FUNDING_DUPLICATE");
  return values;
}
export function parseKernelCost(raw: unknown): KernelCost {
  const value = plannerRecord(raw);
  if (value.kind === "MANUAL") { plannerKeys(value, ["kind", "unitAmount"]); return { kind: "MANUAL", unitAmount: decisionAmount(value.unitAmount) }; }
  if (value.kind === "QUOTE") { plannerKeys(value, ["kind", "quoteKey"]); return { kind: "QUOTE", quoteKey: plannerString(value.quoteKey) }; }
  plannerKeys(value, ["kind"]);
  if (value.kind !== "UNKNOWN") throw new TypeError("PLANNER_COST_KIND_INVALID");
  return { kind: "UNKNOWN" };
}
