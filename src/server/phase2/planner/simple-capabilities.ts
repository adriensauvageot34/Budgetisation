import "server-only";
import Big from "big.js";
import type { PlanningBaselineV1 } from "@/domain/phase2/planner/baseline-contract";
import type { SimpleAdjustmentCapability } from "@/domain/phase2/planner/simple-lever-contract";

const labels: Readonly<Record<string, string>> = { groceries: "Courses", "tobacco-vape": "Tabac / vape", "adrien-work-meals": "Repas travail Adrien",
  "manon-work-meals": "Repas travail Manon", restaurants: "Restaurants", "fast-food": "Fast-food", delivery: "Livraison",
  clothing: "Vêtements", "home-small": "Maison petit", "games-digital": "Jeux / numérique ponctuel" };
/** Read-only capability publication. Presets are suggestions and carry no decision. */
export function publishSimpleCapabilities(baseline: PlanningBaselineV1): readonly SimpleAdjustmentCapability[] {
  const capabilities: SimpleAdjustmentCapability[] = baseline.slots.filter(slot => slot.simpleAuthority).map(slot => {
    const simple = slot.simpleAuthority!, history = slot.historicalReferences ?? null;
    return { slotIdentityKey: slot.slotIdentityKey, domain: simple.domain, label: labels[simple.domain]!,
      actions: [slot.kind === "AMOUNT" ? "SET_SLOT_AMOUNT" : "SET_SLOT_OCCURRENCES"], flexibility: simple.optionalBudget ? "FREE" : "SAFE_FLEX",
      knowledge: slot.knowledge, gate: simple.gate, historicalReferences: history,
      hardConstraints: simple.hardFloor ? [{ code: "REAL_STRUCTURAL_FLOOR", amount: simple.hardFloor.amount, evidenceRefs: simple.hardFloor.evidenceRefs }] : [],
      softConstraints: simple.gate === "NEEDS_NEW_INPUT" ? [{ code: simple.reason!, evidenceRefs: slot.sourceRefs }]
        : simple.domain === "home-small" ? [{ code: "HOME_PROJECT_OUTSIDE_SIMPLE_SLOT", evidenceRefs: slot.sourceRefs }] : [],
      naturalPresets: history && simple.gate === "AVAILABLE" ? (["low", "central", "high"] as const).flatMap(key => {
        const reference = history.range[key];
        if (reference === null || simple.hardFloor && slot.kind === "AMOUNT" && new Big(reference).lt(simple.hardFloor.amount)) return [];
        // Distribution quantiles may be fractional; a proposed explicit occurrence count is discrete.
        return [{ label: key, value: slot.kind === "AMOUNT" ? { amount: reference } : { count: new Big(reference).round(0).toFixed(0) } }];
      }) : [] };
  });
  for (const reservation of baseline.structuralFacts.savingsReservations.filter(r => r.reservationId !== "policy:safety-reserve")) {
    const protectedSaving = reservation.adjustability === "PROTECTED";
    capabilities.push({ slotIdentityKey: `savings:${reservation.reservationId}`, domain: "savings", label: reservation.label,
      actions: protectedSaving ? [] : ["SET_SAVINGS_ALLOCATION"], flexibility: protectedSaving ? "LOCKED" : "SAFE_FLEX", knowledge: "KNOWN", gate: "AVAILABLE",
      historicalReferences: null, hardConstraints: protectedSaving ? [{ code: "PROTECTED_SAVINGS_LOCKED", amount: reservation.amount, evidenceRefs: reservation.sourceRefs }] : [],
      softConstraints: [], naturalPresets: protectedSaving ? [] : [{ label: "current", value: { amount: reservation.amount } }] });
  }
  return structuredClone(capabilities);
}
