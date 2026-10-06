import type { HistoricalReferenceSet } from "./baseline-contract";
import type { PlannerKnowledge } from "./diagnostics";

export type SimpleDomain = "groceries" | "tobacco-vape" | "adrien-work-meals" | "manon-work-meals"
  | "restaurants" | "fast-food" | "delivery" | "clothing" | "home-small" | "games-digital";
export type SimpleSlotAuthority = Readonly<{
  version: string; domain: SimpleDomain;
  referenceKeys: readonly string[]; ownershipGroup: string;
  gate: "AVAILABLE" | "NEEDS_NEW_INPUT"; reason: string | null;
  optionalBudget: boolean;
  occurrenceModel: Readonly<{ version: string; basis: "CANONICAL_OCCURRENCE" | "WORK_LUNCH_DATE";
    count: string | null; unitAmount: string | null }> | null;
  hardFloor: Readonly<{ amount: string; authority: "CANONICAL_OBSERVED_CONSUMPTION"; evidenceRefs: readonly string[] }> | null;
}>;
export type SimpleAdjustmentCapability = Readonly<{
  slotIdentityKey: string; domain: string; label: string;
  actions: readonly ("SET_SLOT_AMOUNT" | "SET_SLOT_OCCURRENCES" | "SET_SAVINGS_ALLOCATION")[];
  flexibility: "LOCKED" | "SAFE_FLEX" | "FREE";
  knowledge: PlannerKnowledge; gate: "AVAILABLE" | "NEEDS_NEW_INPUT";
  historicalReferences: HistoricalReferenceSet | null;
  hardConstraints: readonly Readonly<{ code: string; amount: string | null; evidenceRefs: readonly string[] }>[];
  softConstraints: readonly Readonly<{ code: string; evidenceRefs: readonly string[] }>[];
  naturalPresets: readonly Readonly<{ label: string; value: Readonly<{ amount?: string; count?: string }> }>[];
}>;
