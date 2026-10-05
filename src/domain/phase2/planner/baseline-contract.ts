import type { PlannerJsonObject } from "./json";
import type { PlannerDiagnostic, PlannerKnowledge, PlannerProvenance } from "./diagnostics";

/** Source-specific evidence/value/capability envelopes are refined by C1/C3, without a second fact store. */
export type BaselineSourceRef = PlannerJsonObject;
export type BaselineStructuralFact = PlannerJsonObject;
export type BaselineSavingsReservation = PlannerJsonObject;
export type ExternalKnownContext = PlannerJsonObject;
export type UnresolvedBehavioralReserve = PlannerJsonObject;
export type HistoricalReferenceSet = PlannerJsonObject;
export type PlanSlotValue = PlannerJsonObject;
export type SlotCapability = PlannerJsonObject;
export type PlanningPlanSlot = Readonly<{ planSlotId: string; slotIdentityKey: string; controlKey: string | null;
  kind: "AMOUNT" | "OCCURRENCE" | "CONDITIONAL_OCCURRENCE"; semanticKey: string;
  scope: Readonly<{ kind: "HOUSEHOLD" | "PERSON"; personId?: string }>;
  inclusion: "CENTRAL" | "CONDITIONAL" | "SUGGESTION_ONLY" | "UNRESOLVED_RESERVE";
  baselineValue: PlanSlotValue; historicalReferences?: HistoricalReferenceSet; knowledge: PlannerKnowledge;
  provenance: readonly PlannerProvenance[]; capabilities: readonly SlotCapability[] }>;
export type PlanningBaselineV1 = Readonly<{ version: "planning-baseline@v1"; householdId: string; targetMonth: string;
  knowledgeCutoff: string; digest: string; sourceRefs: readonly BaselineSourceRef[];
  structuralFacts: Readonly<{ resources: readonly BaselineStructuralFact[]; obligations: readonly BaselineStructuralFact[];
    savingsReservations: readonly BaselineSavingsReservation[]; externalKnownContexts: readonly ExternalKnownContext[] }>;
  slots: readonly PlanningPlanSlot[]; unresolvedReserves: readonly UnresolvedBehavioralReserve[];
  modelVersions: Readonly<Record<string, string>>; diagnostics: readonly PlannerDiagnostic[] }>;
