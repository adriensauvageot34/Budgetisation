import "server-only";
import Big from "big.js";
import type { ComponentSelectionV1 } from "@/domain/phase2/planner/component-contract";
import type { ComponentRequest, CompiledPlanSlot, PlanningWorldFacts, SlotBinding } from "@/domain/phase2/planner/compiler-contract";

/** A semantic Need link is authorized against the server's admitted read-model,
 * never against a client supplied cadence, product replacement or due date. */
export function resolveRenewalComponentBinding(item: Extract<ComponentSelectionV1, { kind: "COMPONENT" }>,
  slots: readonly CompiledPlanSlot[], world: PlanningWorldFacts): SlotBinding {
  const need = world.baseline.renewals?.needOccurrences.find(n => n.needOccurrenceId === item.needOccurrenceId);
  const slot = slots.find(s => s.baseline.renewalAuthority?.needOccurrenceId === item.needOccurrenceId);
  if (!need || !slot) throw new TypeError("RENEWAL_COMPONENT_OCCURRENCE_UNKNOWN");
  if (!new Big(item.quantity).eq(1)) throw new TypeError("RENEWAL_COMPONENT_REQUIRES_ONE_ACQUISITION");
  const mode = item.binding?.mode ?? "AUTO";
  const none: SlotBinding = { slotIdentityKey: null, relation: "NO_RELATED_SLOT", displacement: "KNOWN", amount: null, count: null };
  if (mode === "NO_RELATED_SLOT") return none;
  if (mode === "EXTRA_TO_SLOT") return { ...none, slotIdentityKey: slot.baseline.slotIdentityKey, relation: "EXTRA_TO_SLOT" };
  // Explicit/manual purchases of uncalibrated Needs add their stated cost without
  // claiming a baseline reservation, cadence or economic displacement.
  if (!need.autoEligible && !slot.decisionId) return none;
  if (slot.effectiveCount === null || slot.effectiveUnitAmount === null) return { slotIdentityKey: slot.baseline.slotIdentityKey,
    relation: "UNRESOLVED", displacement: "UNKNOWN", amount: null, count: null };
  return { slotIdentityKey: slot.baseline.slotIdentityKey, relation: "CONSUMES_SLOT", displacement: "KNOWN", amount: null, count: "1.00" };
}
export function validateRenewalComponentConsumptions(requests: readonly ComponentRequest[], slots: readonly CompiledPlanSlot[]) {
  const used = new Set<string>();
  for (const request of requests) {
    if (!request.needOccurrenceId || request.binding.relation === "EXTRA_TO_SLOT") continue;
    const slot = slots.find(s => s.baseline.renewalAuthority?.needOccurrenceId === request.needOccurrenceId);
    if (!slot?.baseline.renewalAuthority?.conditional) continue;
    if (used.has(request.needOccurrenceId)) throw new TypeError("RENEWAL_OCCURRENCE_CONSUMED_TWICE");
    used.add(request.needOccurrenceId);
  }
}
