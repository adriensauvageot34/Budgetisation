import Big from "big.js";
import { decisionAmount } from "../month-decision-contract";

export const COMPONENT_QUANTITY_EVIDENCE_VERSION = "component-quantity@v1" as const;
export type DeclaredComponentQuantity = Readonly<{ quantity: string; quantityEvidenceVersion?: typeof COMPONENT_QUANTITY_EVIDENCE_VERSION;
  quantityPerPerson?: string; pricedParticipantCount?: number }>;

/** Explicit unit conversion only. The Compiler still prices the one stored total quantity. */
export function declareComponentQuantity(mode: "TOTAL_UNITS" | "PER_PERSON" | "TOTAL_BUDGET", units: string,
  participantCount?: number): DeclaredComponentQuantity {
  const perUnit = mode === "TOTAL_BUDGET" ? "1" : decisionAmount(units);
  if (new Big(perUnit).lte(0)) throw new TypeError("PLANNER_QUANTITY_INVALID");
  if (mode === "PER_PERSON" && (!Number.isSafeInteger(participantCount) || participantCount! < 1 || participantCount! > 50))
    throw new TypeError("CONTEXT_PERSON_QUANTITY_INVALID");
  const quantity = mode === "PER_PERSON" ? new Big(perUnit).times(participantCount!).toString() : perUnit;
  if (new Big(quantity).gt(9999)) throw new TypeError("PLANNER_QUANTITY_INVALID");
  return { quantity, ...(mode === "PER_PERSON" ? { quantityEvidenceVersion: COMPONENT_QUANTITY_EVIDENCE_VERSION,
    quantityPerPerson: perUnit, pricedParticipantCount: participantCount! } : {}) };
}

/** Old decisions without per-person evidence remain valid and retain their exact total. */
export function validateComponentQuantity(quantity: string, unitBasis: unknown, version: unknown,
  perPerson: unknown, participantCount: unknown): void {
  declareComponentQuantity("TOTAL_UNITS", quantity);
  const hasEvidence = version !== undefined || perPerson !== undefined || participantCount !== undefined;
  if (!hasEvidence) return;
  if (version !== COMPONENT_QUANTITY_EVIDENCE_VERSION || unitBasis !== "PERSON" || typeof perPerson !== "string" || typeof participantCount !== "number")
    throw new TypeError("CONTEXT_PERSON_QUANTITY_INVALID");
  const declared = declareComponentQuantity("PER_PERSON", perPerson, participantCount);
  if (!new Big(declared.quantity).eq(quantity)) throw new TypeError("CONTEXT_PERSON_QUANTITY_INVALID");
}
