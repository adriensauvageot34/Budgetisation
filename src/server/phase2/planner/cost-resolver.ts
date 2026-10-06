import "server-only";
import { plannedLineGross } from "@/domain/phase2/planned-money";
import { decisionAmount } from "@/domain/phase2/month-decision-contract";
import { plannerKeys, plannerRecord, plannerString } from "@/domain/phase2/planner/json";
import type { ComponentRequest, KernelCost, PlanningWorldFacts } from "@/domain/phase2/planner/compiler-contract";
import type { CostEvaluation } from "@/domain/phase2/planner/component-contract";
import type { FundingAllocation } from "../planned-expenses";

export const KERNEL_COST_MODEL = "planner-kernel-cost@v1";
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
export function resolveComponentCost(request: ComponentRequest, world: PlanningWorldFacts): CostEvaluation {
  const candidate = request.cost.kind === "QUOTE" ? world.costQuotes[request.cost.quoteKey] : null;
  const quote = candidate && Number.isFinite(Date.parse(candidate.observedAt))
    && Date.parse(candidate.observedAt) <= Date.parse(world.baseline.knowledgeCutoff) ? candidate : null;
  const unitAmount = request.cost.kind === "MANUAL" ? request.cost.unitAmount : quote?.unitAmount ?? null;
  const unknown = unitAmount === null;
  return { economicAmount: unknown ? null : plannedLineGross({ quantity: request.quantity, unitAmount: decisionAmount(unitAmount) }),
    knowledge: unknown ? "UNKNOWN" : request.cost.kind === "MANUAL" ? "DECLARED" : "KNOWN", confidence: unknown ? "LOW" : "HIGH",
    range: null, rangeSemantics: null, basis: { kind: request.cost.kind === "QUOTE" ? "CURRENT_QUOTE" : "QUANTITY_X_RATE", quantity: request.quantity,
      unitAmount, quoteKey: request.cost.kind === "QUOTE" ? request.cost.quoteKey : null },
    support: quote ? [quote.evidenceRef] : [], provenance: unknown ? [] : [request.cost.kind === "MANUAL" ? "EXPLICIT_USER_DECISION" : "CANONICAL_FACT"],
    assumptions: [], freshness: quote?.observedAt ?? null, modelVersion: quote?.modelVersion ?? KERNEL_COST_MODEL };
}
