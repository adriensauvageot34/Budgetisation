import "server-only";
import Big from "big.js";
import type { MonthEconomicPlan } from "./month-scenario";
import type { PlannedExpenseDraft } from "@/domain/phase2/planned-contract";
import { plannedLineGross, costItemCashTreatment } from "@/domain/phase2/planned-money";

/** Display projection only. The scenario delta, rather than a separate cost-minus-baseline engine,
 * is the authority for the additional impact. Caller supplies a before-plan excluding the edited ID. */
export function projectPlannedExpenseImpact(before: MonthEconomicPlan, after: MonthEconomicPlan, draft: PlannedExpenseDraft) {
  const scenarios = ["low", "central", "high"] as const;
  const scenarioKey = { low: "lowConsumption", central: "central", high: "highConsumption" } as const;
  const gross = draft.costItems.reduce((sum, item) => sum.plus(plannedLineGross(item)), new Big(0));
  const fuel = draft.costItems.filter((item) => costItemCashTreatment(item) === "ECONOMIC_ONLY")
    .reduce((sum, item) => sum.plus(plannedLineGross(item)), new Big(0));
  const netAdditionalImpact = Object.fromEntries(scenarios.map((key) => [key,
    new Big(before.scenarios[scenarioKey[key]]).minus(after.scenarios[scenarioKey[key]]).toFixed(2)])) as Record<typeof scenarios[number], string>;
  // Certified for the V1 baseline-displacement model only. Revisit if MonthScenario gains other effects.
  const absorbedByBaseline = Object.fromEntries(scenarios.map((key) =>
    [key, gross.minus(netAdditionalImpact[key]).toFixed(2)])) as Record<typeof scenarios[number], string>;
  return { grossCost: gross.toFixed(2), fuelUsage: fuel.toFixed(2), payableGross: gross.minus(fuel).toFixed(2),
    netAdditionalImpact, absorbedByBaseline, before: before.scenarios, after: after.scenarios, funding: after.plannedFunding };
}
