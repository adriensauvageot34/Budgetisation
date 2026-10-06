import "server-only";
import Big from "big.js";
import { decisionAmount } from "@/domain/phase2/month-decision-contract";
import { isDecisionCategoryKey } from "@/domain/phase2/month-choice-contract";
import { planSlotId } from "@/domain/phase2/planner/identity";
import { plannerKeys, plannerRecord } from "@/domain/phase2/planner/json";
import type { PlanningBaselineV1, PlanningPlanSlot } from "@/domain/phase2/planner/baseline-contract";
import type { ComponentRequest, CompiledComponent, CompiledPlanSlot, BaselineConsumptionManifest } from "@/domain/phase2/planner/compiler-contract";
import type { PlanSemanticStateV1 } from "@/domain/phase2/planner/semantic-state";
import type { ContextualEffect } from "@/domain/phase2/planner/component-contract";
import { compare, emptyValue } from "./baseline-evidence";

const cents = (value: Big): string => value.toFixed(2);
export function materializePlanSlots(baseline: PlanningBaselineV1, state: PlanSemanticStateV1, forced: readonly string[] = []): CompiledPlanSlot[] {
  const slots: PlanningPlanSlot[] = [...baseline.slots, ...baseline.structuralFacts.savingsReservations.filter(r => r.reservationId !== "policy:safety-reserve").map(r => {
    const key = `savings:${r.reservationId}`;
    return { planSlotId: planSlotId(key), slotIdentityKey: key, controlKey: key, semanticKey: key, kind: "AMOUNT" as const, scope: { kind: "HOUSEHOLD" as const },
      inclusion: "CENTRAL" as const, baselineValue: { ...emptyValue(), amount: r.amount }, knowledge: "KNOWN" as const, provenance: ["CANONICAL_FACT" as const],
      sourceRefs: r.sourceRefs, capabilities: r.adjustability === "PROTECTED" ? [] : [{ action: "SET_AMOUNT" as const, availability: "AVAILABLE" as const, reason: r.adjustability }] };
  })];
  if (new Set(slots.map(s => s.slotIdentityKey)).size !== slots.length) throw new TypeError("PLANNER_SLOT_DUPLICATE");
  const controls = new Map(state.controls.map(c => [c.decisionSlotKey, c]));
  const pending = new Set(controls.keys());
  const assigned = new Set<string>();
  const resolved = slots.map(slot => {
    const decision = controls.get(slot.slotIdentityKey) ?? (slot.controlKey ? controls.get(slot.controlKey) : undefined);
    if (controls.has(slot.slotIdentityKey) && slot.controlKey && slot.controlKey !== slot.slotIdentityKey && controls.has(slot.controlKey))
      throw new TypeError("PLANNER_CONTROL_ALIAS_CONFLICT");
    if (decision) {
      if (assigned.has(decision.decisionSlotKey)) throw new TypeError("PLANNER_CONTROL_TARGET_AMBIGUOUS");
      assigned.add(decision.decisionSlotKey);
      const action = slot.kind === "AMOUNT" ? "SET_AMOUNT" : "SET_COUNT";
      const protectedSaving = slot.slotIdentityKey.startsWith("savings:") && !slot.capabilities.length;
      if (!protectedSaving && !slot.capabilities.some(c => c.action === action && c.availability === "AVAILABLE")) throw new TypeError("PLANNER_SLOT_CONTROL_UNAVAILABLE");
      const allowPriceInput = slot.kind !== "AMOUNT" && slot.simpleAuthority?.gate === "NEEDS_NEW_INPUT";
      plannerKeys(plannerRecord(decision.value), slot.kind === "AMOUNT" ? ["amount"] : allowPriceInput ? ["count", "unitAmount"] : ["count"],
        slot.kind === "AMOUNT" ? ["amount"] : ["count"]);
      if (slot.simpleAuthority && slot.kind !== "AMOUNT" && !new Big(decisionAmount(decision.value.count)).round(0).eq(decisionAmount(decision.value.count))) throw new TypeError("SIMPLE_OCCURRENCE_COUNT_MUST_BE_INTEGER");
      pending.delete(decision.decisionSlotKey);
    }
    const effectiveAmount = slot.kind === "AMOUNT" ? decision ? decisionAmount(decision.value.amount) : slot.baselineValue.amount : null;
    const effectiveCount = slot.kind === "AMOUNT" ? null : decision ? decisionAmount(decision.value.count) : slot.baselineValue.count;
    const effectiveUnitAmount = decision?.value.unitAmount !== undefined ? decisionAmount(decision.value.unitAmount) : slot.baselineValue.unitAmount;
    const role = slot.slotIdentityKey.startsWith("savings:") ? "SAVINGS" as const : "BEHAVIOR" as const;
    const financeKey = role === "SAVINGS" ? null : isDecisionCategoryKey(slot.controlKey ?? "") ? slot.controlKey
      : isDecisionCategoryKey(slot.semanticKey) ? slot.semanticKey : null;
    return { baseline: slot, role, financeKey, owned: !!decision || forced.includes(slot.slotIdentityKey), decisionId: decision?.decisionId ?? null,
      effectiveAmount, effectiveCount, effectiveUnitAmount, remainingAmount: effectiveAmount, remainingCount: effectiveCount,
      remainingEconomicAmount: role === "SAVINGS" ? null : slot.kind === "AMOUNT" ? effectiveAmount
        : effectiveCount !== null && new Big(effectiveCount).eq(0) ? "0.00"
        : effectiveCount !== null && effectiveUnitAmount !== null ? cents(new Big(effectiveCount).times(effectiveUnitAmount)) : null };
  });
  if (pending.size) throw new TypeError(`PLANNER_CONTROL_TARGET_UNKNOWN:${[...pending][0]}`);
  expandSimpleOwnership(resolved);
  return resolved.sort((a, b) => compare(a.baseline.slotIdentityKey, b.baseline.slotIdentityKey));
}

export const slotReferenceKeys = (slot: CompiledPlanSlot): readonly string[] => slot.baseline.simpleAuthority?.referenceKeys ?? (slot.financeKey ? [slot.financeKey] : []);
/** Legacy dining is one reference component. Any owned member replaces the entire
 * aggregate with all three distinct capacities exactly once. */
export function expandSimpleOwnership(slots: CompiledPlanSlot[]): void {
  const groups = new Set(slots.filter(s => s.owned && s.baseline.simpleAuthority).map(s => s.baseline.simpleAuthority!.ownershipGroup));
  for (const slot of slots) if (slot.baseline.simpleAuthority && groups.has(slot.baseline.simpleAuthority.ownershipGroup)) slot.owned = true;
}

/** Semantic allocation precedes price resolution. Amount/count capacities are independent
 * of whether their economic displacement is known. */
export function bindPlanSlots(slots: CompiledPlanSlot[], requests: readonly ComponentRequest[]) {
  const consumptions: BaselineConsumptionManifest[] = [];
  for (const request of requests) {
    const binding = request.binding;
    if (binding.slotIdentityKey === null || binding.relation !== "CONSUMES_SLOT") continue;
    const slot = slots.find(s => s.baseline.slotIdentityKey === binding.slotIdentityKey);
    if (!slot || slot.role === "SAVINGS") throw new TypeError("PLANNER_BINDING_TARGET_INVALID");
    slot.owned = true;
    let amount: string | null = null, count: string | null = null;
    if (slot.baseline.kind === "AMOUNT") {
      if (binding.amount === null || binding.count !== null) throw new TypeError("PLANNER_AMOUNT_CONSUMPTION_INVALID");
      if (slot.remainingAmount !== null) { amount = cents(new Big(binding.amount).lt(slot.remainingAmount) ? new Big(binding.amount) : new Big(slot.remainingAmount)); slot.remainingAmount = cents(new Big(slot.remainingAmount).minus(amount)); }
    } else {
      if (binding.count === null || binding.amount !== null) throw new TypeError("PLANNER_OCCURRENCE_CONSUMPTION_INVALID");
      if (slot.remainingCount !== null) { count = cents(new Big(binding.count).lt(slot.remainingCount) ? new Big(binding.count) : new Big(slot.remainingCount)); slot.remainingCount = cents(new Big(slot.remainingCount).minus(count)); }
    }
    consumptions.push({ componentId: request.componentId, planSlotId: slot.baseline.planSlotId, amount, count, displacedAmount: null, evidenceRefs: slot.baseline.sourceRefs });
  }
  return consumptions;
}

export function resolveContextualEffects(slots: CompiledPlanSlot[], components: readonly CompiledComponent[], consumptions: BaselineConsumptionManifest[]): ContextualEffect[] {
  return components.map(component => {
    const binding = component.binding, slot = slots.find(s => s.baseline.slotIdentityKey === binding.slotIdentityKey);
    const allocation = consumptions.find(c => c.componentId === component.componentId), gross = component.evaluation.economicAmount;
    if (binding.slotIdentityKey !== null && !slot) throw new TypeError("PLANNER_BINDING_TARGET_UNKNOWN");
    let displaced: string | null = binding.relation === "CONSUMES_SLOT" ? null : "0.00";
    if (allocation && slot && binding.displacement === "KNOWN" && gross !== null) {
      displaced = slot.baseline.kind === "AMOUNT" ? allocation.amount === null ? null : cents(new Big(allocation.amount).gt(gross) ? new Big(gross) : new Big(allocation.amount))
        : allocation.count !== null && slot.effectiveUnitAmount !== null ? cents(new Big(allocation.count).times(slot.effectiveUnitAmount)) : null;
      if (displaced !== null && slot.remainingEconomicAmount !== null) slot.remainingEconomicAmount = cents(new Big(slot.remainingEconomicAmount).minus(displaced));
      allocation.displacedAmount = displaced;
    }
    if (binding.relation === "UNRESOLVED" || binding.displacement === "UNKNOWN") displaced = null;
    const incremental = gross !== null && displaced !== null ? cents(new Big(gross).minus(displaced)) : null;
    return { componentId: component.componentId, baselinePlanSlotId: slot?.baseline.planSlotId ?? null, slotRelation: binding.relation,
      economicRelation: displaced === null || gross === null ? "UNKNOWN" : new Big(displaced).eq(0) ? "INCREMENTAL" : new Big(gross).gt(displaced) ? "MIXED" : "DISPLACEMENT",
      grossAmount: gross, displacedAmount: displaced, incrementalAmount: incremental, knowledge: displaced === null ? "PARTIAL" : component.evaluation.knowledge,
      evidenceRefs: [...component.evaluation.support, ...(component.bindingEvidenceRefs ?? []), ...(slot?.baseline.sourceRefs ?? [])] };
  });
}
