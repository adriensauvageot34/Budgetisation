import "server-only";
import type { AdjustmentCapability } from "@/domain/phase2/planner/adjustment-contract";
import type { PlanningPlanSlot } from "@/domain/phase2/planner/baseline-contract";

/** Raised only while materializing input, before any Apply writer. Keep this
 * distinct from a parse/evidence failure after a successful commit. */
export class ControlDecisionAdmissionError extends TypeError {}

/** Field admission is published from the same slot capabilities used by the Compiler.
 * These are monthly decisions; no historical reference or source is changed. */
export function monthlyOccurrenceOverride(slot: PlanningPlanSlot): boolean {
  return slot.kind === "OCCURRENCE" && slot.capabilities.some(c => c.action === "SET_COUNT" && c.availability === "AVAILABLE")
    && (slot.provenance.includes("USER_VALIDATED_HABIT") || ["adrien-work-coffee", "adrien-work-meals", "manon-work-meals"].includes(slot.semanticKey));
}
export function allowsUnitOverride(slot: PlanningPlanSlot): boolean {
  return slot.kind !== "AMOUNT" && (monthlyOccurrenceOverride(slot)
    || slot.simpleAuthority?.gate === "NEEDS_NEW_INPUT" || !!slot.renewalAuthority && slot.baselineValue.unitAmount === null);
}
export function controlFields(slot: PlanningPlanSlot, locked: boolean): AdjustmentCapability["fields"] {
  const available = (action: "SET_AMOUNT" | "SET_COUNT") => slot.capabilities.some(c => c.action === action && c.availability === "AVAILABLE");
  const status = (admitted: boolean) => locked ? "PROTECTED_BY_RULE" as const : admitted ? "EDITABLE" as const : "NO_PUBLISHED_CAPABILITY" as const;
  return slot.kind === "AMOUNT" ? { amount: { status: status(available("SET_AMOUNT")), minimum: slot.simpleAuthority?.hardFloor?.amount ?? "0.00",
    maximum: "999999999.99", integer: false, step: "5.00" } }
    : { count: { status: status(available("SET_COUNT")), minimum: "0", maximum: slot.renewalAuthority?.conditional ? "1" : "9999", integer: true, step: "1" },
      unitAmount: { status: status(allowsUnitOverride(slot)), minimum: "0.00", maximum: "999999999.99", integer: false,
        step: slot.semanticKey === "adrien-work-coffee" ? "0.10" : "0.50" } };
}
