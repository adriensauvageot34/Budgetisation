import "server-only";
import type { CompiledSemanticPlanV1 } from "@/domain/phase2/planner/compiler-contract";
import type { PlanningBaselineV1 } from "@/domain/phase2/planner/baseline-contract";
import type { PlanSemanticStateV1 } from "@/domain/phase2/planner/semantic-state";
import { publishSimpleCapabilities } from "./simple-capabilities";

export type AppliedPlanControl = Readonly<{ slotIdentityKey: string; planSlotId: string; label: string;
  amount: string | null; count: string | null; unitAmount: string | null; decisionId: string;
  provenance: "EXPLICIT_USER_DECISION"; sourceRefs: readonly string[];
  savings: Readonly<{ reservationId: string; declaredAmount: string; adjustability: "PROTECTED" | "ADJUSTABLE";
    source: "MONTH_INPUT" | "ANNUAL_PLAN"; annualGoalRef: string | null }> | null }>;

/** A compact read of accepted controls from the already evaluated active revision. */
export function appliedPlanControls(compiled: CompiledSemanticPlanV1, state: PlanSemanticStateV1, baseline: PlanningBaselineV1): readonly AppliedPlanControl[] {
  const decisions = new Map(state.controls.map(decision => [decision.decisionId, decision]));
  const labels = new Map(publishSimpleCapabilities(baseline).map(capability => [capability.slotIdentityKey, capability.label]));
  return compiled.planSlots.flatMap(slot => {
    const decision = slot.decisionId ? decisions.get(slot.decisionId) : undefined;
    if (!decision || decision.provenance !== "EXPLICIT_USER_DECISION") return [];
    const reservation = slot.role === "SAVINGS" ? baseline.structuralFacts.savingsReservations
      .find(item => `savings:${item.reservationId}` === slot.baseline.slotIdentityKey) : undefined;
    return [{ slotIdentityKey: slot.baseline.slotIdentityKey, planSlotId: slot.baseline.planSlotId,
      label: labels.get(slot.baseline.slotIdentityKey) ?? slot.baseline.semanticKey,
      amount: typeof decision.value.amount === "string" ? decision.value.amount : null,
      count: typeof decision.value.count === "string" ? decision.value.count : null,
      unitAmount: typeof decision.value.unitAmount === "string" ? decision.value.unitAmount : null,
      decisionId: decision.decisionId,
      provenance: decision.provenance, sourceRefs: slot.baseline.sourceRefs,
      savings: reservation ? { reservationId: reservation.reservationId, declaredAmount: reservation.amount,
        adjustability: reservation.adjustability, source: reservation.source, annualGoalRef: reservation.annualGoalRef } : null }];
  });
}
