import "server-only";
import Big from "big.js";
import type { ConstraintResult } from "@/domain/phase2/planner/diagnostics";
import type { CompiledComponent, CompiledPlanSlot, PlanningWorldFacts } from "@/domain/phase2/planner/compiler-contract";
import type { ContextualEffect } from "@/domain/phase2/planner/component-contract";
import { matchesForecastCategory } from "../remaining-month-forecast";
import { slotReferenceKeys } from "./plan-slot-resolver";
import { costItemCashTreatment } from "@/domain/phase2/planned-money";

export const KERNEL_CONSTRAINT_POLICY = "planner-kernel-constraints@v5-renewals";
export function evaluatePlanConstraints(world: PlanningWorldFacts, slots: readonly CompiledPlanSlot[],
  components: readonly CompiledComponent[], effects: readonly ContextualEffect[]): ConstraintResult[] {
  const results: ConstraintResult[] = [];
  const add = (severity: ConstraintResult["severity"], code: string, targetRef: string, evidenceRefs: readonly string[] = []) =>
    results.push({ severity, code, scope: "PLAN", targetRef, candidate: null, reference: null, evidenceRefs,
      confidence: "HIGH", remediation: null, policyVersion: KERNEL_CONSTRAINT_POLICY });
  for (const slot of slots.filter(s => s.owned)) {
    if (slot.role === "SAVINGS") {
      const reservation = world.baseline.structuralFacts.savingsReservations.find(r => `savings:${r.reservationId}` === slot.baseline.slotIdentityKey)!;
      if (reservation.adjustability === "PROTECTED" && new Big(slot.effectiveAmount!).lt(reservation.amount))
        add("BLOCK", "PROTECTED_SAVINGS_RELEASE_FORBIDDEN", slot.baseline.planSlotId, reservation.sourceRefs);
      else if (reservation.adjustability === "PROTECTED" && slot.decisionId)
        add("BLOCK", "PROTECTED_SAVINGS_LOCKED", slot.baseline.planSlotId, reservation.sourceRefs);
    } else {
      const simple = slot.baseline.simpleAuthority;
      const renewal = slot.baseline.renewalAuthority;
      const explicitInput = !!slot.decisionId && slot.remainingEconomicAmount !== null;
      if (slot.baseline.inclusion !== "CENTRAL" && !renewal && !simple?.optionalBudget && !(simple?.gate === "NEEDS_NEW_INPUT" && explicitInput))
        add("BLOCK", "OWNED_SLOT_CONDITION_UNRESOLVED", slot.baseline.planSlotId, slot.baseline.sourceRefs);
      if (simple?.hardFloor && slot.effectiveAmount !== null && new Big(slot.effectiveAmount).lt(simple.hardFloor.amount))
        add("BLOCK", "SIMPLE_REAL_HARD_FLOOR_VIOLATED", slot.baseline.planSlotId, simple.hardFloor.evidenceRefs);
      if (slot.financeKey && slots.filter(s => s.financeKey === slot.financeKey).length !== 1)
        add("BLOCK", "OWNED_SLOT_FINANCIAL_MAPPING_AMBIGUOUS", slot.baseline.planSlotId);
      if (slot.remainingEconomicAmount === null) add("BLOCK", "OWNED_SLOT_COST_UNKNOWN", slot.baseline.planSlotId, slot.baseline.sourceRefs);
      const reference = world.forecast.referencePlan;
      const keys = slotReferenceKeys(slot);
      const matches = [...(reference?.necessary ?? []), ...(reference?.flexible ?? [])].filter(p => keys.includes(p.key));
      if (simple?.optionalBudget || renewal ? matches.length > 1 : matches.length !== 1)
        add("BLOCK", "OWNED_SLOT_FINANCIAL_REFERENCE_UNRESOLVED", slot.baseline.planSlotId);
      // C2's bridge certifies generic unobserved capacity. Reconciliation with already observed
      // occurrences belongs to domain adapters; never silently count them a second time.
      if (world.forecast.predictionEvidence?.currentEconomicEntries.some(e => e.date.startsWith(world.baseline.targetMonth)
        && e.date <= world.asOfDate && keys.some(key => matchesForecastCategory(key, e))))
        add("BLOCK", "OWNED_SLOT_OBSERVED_RECONCILIATION_REQUIRED", slot.baseline.planSlotId);
    }
  }
  for (const component of components) {
    if (component.cost.kind === "QUOTE") {
      const quote = world.costQuotes[component.cost.quoteKey];
      if (quote && (!Number.isFinite(Date.parse(quote.observedAt)) || Date.parse(quote.observedAt) > Date.parse(world.baseline.knowledgeCutoff)))
        add("BLOCK", "QUOTE_OUTSIDE_KNOWLEDGE_CUTOFF", component.componentId, component.evaluation.support);
    }
    // An unresolved C4 valuation preserves the explicit life intention with an unknown
    // projection. The C2 generic bridge retains its certified refusal boundary.
    if (component.evaluation.economicAmount === null) add(component.selectionProvenance ? "WARN" : "BLOCK", "COMPONENT_COST_UNKNOWN", component.componentId, component.evaluation.support);
    if (component.fundingAllocations.length && component.evaluation.economicAmount !== null
      && !component.fundingAllocations.reduce((n, a) => n.plus(a.amount), new Big(0)).eq(component.evaluation.economicAmount))
      add("BLOCK", "COMPONENT_FUNDING_SUM_INVALID", component.componentId);
    if (!component.fundingAllocations.length && component.externalEntryId === null && costItemCashTreatment({ assetKey: component.assetKey ?? null }) !== "ECONOMIC_ONLY")
      add("WARN", "COMPONENT_FUNDING_UNKNOWN", component.componentId);
  }
  for (const effect of effects) if (effect.economicRelation === "UNKNOWN")
    add("WARN", "DISPLACEMENT_UNKNOWN_NO_SUBTRACTION", effect.componentId, effect.evidenceRefs);
  for (const reserve of world.baseline.unresolvedReserves)
    add("WARN", "BASELINE_UNRESOLVED_RESERVE_PRESERVED", reserve.reserveKey, reserve.sourceRefs);
  return results;
}
