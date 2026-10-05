import "server-only";
import Big from "big.js";
import type { ConstraintResult } from "@/domain/phase2/planner/diagnostics";
import type { CompiledComponent, CompiledPlanSlot, PlanningWorldFacts } from "@/domain/phase2/planner/compiler-contract";
import type { ContextualEffect } from "@/domain/phase2/planner/component-contract";
import { matchesForecastCategory } from "../remaining-month-forecast";

export const KERNEL_CONSTRAINT_POLICY = "planner-kernel-constraints@v1";
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
    } else {
      if (slot.baseline.inclusion !== "CENTRAL") add("BLOCK", "OWNED_SLOT_CONDITION_UNRESOLVED", slot.baseline.planSlotId, slot.baseline.sourceRefs);
      if (slot.financeKey && slots.filter(s => s.financeKey === slot.financeKey).length !== 1)
        add("BLOCK", "OWNED_SLOT_FINANCIAL_MAPPING_AMBIGUOUS", slot.baseline.planSlotId);
      if (slot.remainingEconomicAmount === null) add("BLOCK", "OWNED_SLOT_COST_UNKNOWN", slot.baseline.planSlotId, slot.baseline.sourceRefs);
      const reference = world.forecast.referencePlan;
      const matches = [...(reference?.necessary ?? []), ...(reference?.flexible ?? [])].filter(p => p.key === slot.financeKey);
      if (matches.length !== 1) add("BLOCK", "OWNED_SLOT_FINANCIAL_REFERENCE_UNRESOLVED", slot.baseline.planSlotId);
      // C2's bridge certifies generic unobserved capacity. Reconciliation with already observed
      // occurrences belongs to domain adapters; never silently count them a second time.
      if (slot.financeKey && world.forecast.predictionEvidence?.currentEconomicEntries.some(e => e.date <= world.asOfDate && matchesForecastCategory(slot.financeKey!, e)))
        add("BLOCK", "OWNED_SLOT_OBSERVED_RECONCILIATION_REQUIRED", slot.baseline.planSlotId);
    }
  }
  for (const component of components) {
    if (component.cost.kind === "QUOTE") {
      const quote = world.costQuotes[component.cost.quoteKey];
      if (quote && (!Number.isFinite(Date.parse(quote.observedAt)) || Date.parse(quote.observedAt) > Date.parse(world.baseline.knowledgeCutoff)))
        add("BLOCK", "QUOTE_OUTSIDE_KNOWLEDGE_CUTOFF", component.componentId, component.evaluation.support);
    }
    if (component.evaluation.economicAmount === null) add("BLOCK", "COMPONENT_COST_UNKNOWN", component.componentId, component.evaluation.support);
    if (component.fundingAllocations.length && component.evaluation.economicAmount !== null
      && !component.fundingAllocations.reduce((n, a) => n.plus(a.amount), new Big(0)).eq(component.evaluation.economicAmount))
      add("BLOCK", "COMPONENT_FUNDING_SUM_INVALID", component.componentId);
    if (!component.fundingAllocations.length && component.externalEntryId === null)
      add("WARN", "COMPONENT_FUNDING_UNKNOWN", component.componentId);
  }
  for (const effect of effects) if (effect.economicRelation === "UNKNOWN")
    add("WARN", "DISPLACEMENT_UNKNOWN_NO_SUBTRACTION", effect.componentId, effect.evidenceRefs);
  for (const reserve of world.baseline.unresolvedReserves)
    add("WARN", "BASELINE_UNRESOLVED_RESERVE_PRESERVED", reserve.reserveKey, reserve.sourceRefs);
  return results;
}
