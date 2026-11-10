import "server-only";
import { plannedLineGross } from "@/domain/phase2/planned-money";
import { decisionAmount } from "@/domain/phase2/month-decision-contract";
import type { ComponentRequest, PlanningWorldFacts } from "@/domain/phase2/planner/compiler-contract";
import type { CostEvaluation } from "@/domain/phase2/planner/component-contract";
export { parseKernelCost, parseKernelFunding } from "@/domain/phase2/planner/component-input";

export const KERNEL_COST_MODEL = "planner-kernel-cost@v1";
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
