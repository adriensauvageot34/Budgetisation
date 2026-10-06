import "server-only";
import { plannerDigest } from "@/domain/phase2/planner/json";
import type { BaselineConsumptionManifest, CompiledComponent, CompiledPlanSlot, CompiledSemanticPlanV1,
  FinancialScenarioAdapterInputV1, PlanningWorldFacts } from "@/domain/phase2/planner/compiler-contract";
import type { PlannedExpenseScenarioEntry } from "../planned-expenses";
import { deriveMonthScenario, monthInputsSchema } from "../month-scenario";
import { sumReferenceComponents } from "../month-reference";
import { compare } from "./baseline-evidence";
import { slotReferenceKeys } from "./plan-slot-resolver";

export const FINANCIAL_ADAPTER_VERSION = "planner-financial-adapter@v3-economic-mobility";
export function buildFinancialAdapterInput(world: PlanningWorldFacts, slots: readonly CompiledPlanSlot[],
  components: readonly CompiledComponent[], consumptions: readonly BaselineConsumptionManifest[]): FinancialScenarioAdapterInputV1 {
  const owned = slots.filter(s => s.owned), keys = new Set(owned.flatMap(slotReferenceKeys));
  const raw = structuredClone(world.monthInputs);
  const neutralized = Object.keys(raw.decision?.assumptions ?? {}).filter(key => keys.has(key));
  const effectiveMonthInputs = monthInputsSchema.parse({ ...raw, ...(raw.decision ? { decision: { ...raw.decision,
    assumptions: Object.fromEntries(Object.entries(raw.decision.assumptions).filter(([key]) => !keys.has(key))),
    categoryTargets: Object.fromEntries(Object.entries(raw.decision.categoryTargets).filter(([key]) => !keys.has(key))) } } : {}),
    declaredOutflows: raw.declaredOutflows.map(r => {
      const slot = owned.find(s => s.role === "SAVINGS" && s.baseline.slotIdentityKey === `savings:${r.id}`);
      return slot ? { ...r, amount: slot.effectiveAmount } : r;
    }) });
  const owners: { plannedEntryId: string; ownerRef: string }[] = [];
  const entries: PlannedExpenseScenarioEntry[] = [];
  const synthetic = (ownerRef: string, amount: string, label: string, funding: CompiledComponent["fundingAllocations"], date: string | null, assetKey: string | null = null) => {
    if (amount === "0.00") return;
    const id = `planner:${plannerDigest({ ownerRef }).slice(0, 32)}`;
    owners.push({ plannedEntryId: id, ownerRef });
    entries.push({ id, targetMonth: world.baseline.targetMonth, status: "PLANNED", plannedDate: date,
      costItems: [{ id: `${id}:cost`, label, assetKey, quantity: "1", unitAmount: amount, baselineKey: null,
        fundingAllocations: funding, priceSource: "MANUAL" }] });
  };
  for (const slot of owned.filter(s => s.role === "BEHAVIOR")) if (slot.remainingEconomicAmount !== null)
    synthetic(slot.baseline.planSlotId, slot.remainingEconomicAmount, slot.baseline.semanticKey, [], null);
  for (const component of components.filter(c => c.externalEntryId === null)) if (component.evaluation.economicAmount !== null)
    synthetic(component.componentId, component.evaluation.economicAmount, component.label, component.fundingAllocations, component.plannedDate, component.assetKey ?? null);
  for (const external of world.externalIntents) entries.push({ id: external.id, targetMonth: external.targetMonth,
    status: external.status, plannedDate: external.plannedDate, context: external.context,
    costItems: external.costItems.map(line => keys.has(line.baselineKey ?? "") ? { ...line, baselineKey: null } : line) });
  if (new Set(entries.map(e => e.id)).size !== entries.length) throw new TypeError("PLANNER_FINANCIAL_ENTRY_DUPLICATE");
  return { effectiveMonthInputs, plannedExpenseEntries: entries.sort((a, b) => compare(a.id, b.id)), adapterManifest: {
    planOwnedDecisionSlots: owned.map(s => s.baseline.slotIdentityKey), baselineConsumptions: consumptions,
    syntheticPlannedEntryOwners: owners.sort((a, b) => compare(a.plannedEntryId, b.plannedEntryId)),
    neutralizedLegacyAssumptions: [...new Set(neutralized)].sort(compare) } };
}

/** The bridge replaces owned reference components with their residual capacity and explicit
 * components. These are request-local entries; the V2 financial owner still calculates the month. */
export function financialAdapterForecast(world: PlanningWorldFacts, slots: readonly CompiledPlanSlot[]) {
  const reference = world.forecast.referencePlan;
  if (!reference) throw new TypeError("PLANNER_FINANCIAL_REFERENCE_MISSING");
  const owned = new Set(slots.filter(s => s.owned).flatMap(slotReferenceKeys));
  const necessary = reference.necessary.filter(p => !owned.has(p.key)), flexible = reference.flexible.filter(p => !owned.has(p.key));
  return { ...world.forecast, referencePlan: { ...reference, necessary, flexible,
    necessaryTotal: sumReferenceComponents(necessary), flexibleTotal: sumReferenceComponents(flexible) } };
}
export function deriveCompiledMonthScenario(world: PlanningWorldFacts, compiled: CompiledSemanticPlanV1) {
  const adapter = compiled.financialAdapterInput;
  return deriveMonthScenario(financialAdapterForecast(world, compiled.planSlots), adapter.effectiveMonthInputs, null,
    world.asOfDate, adapter.plannedExpenseEntries);
}
