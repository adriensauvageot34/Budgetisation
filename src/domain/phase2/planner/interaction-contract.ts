import type { PlannerJsonObject } from "./json";
import type { ConstraintResult } from "./diagnostics";
import type { PlanControlDecision, PlannedContextState } from "./semantic-state";

/** Mutation language only; C2/C4 own execution and template-specific patch validation. */
export type SemanticMutationPrototype = Readonly<{ kind: "SET_STATE"; decisionSlotKey: string; decision: PlanControlDecision | null }
  | { kind: "ADD_CONTEXT"; context: PlannedContextState }
  | { kind: "PATCH_CONTEXT"; contextOccurrenceId: string; patch: PlannerJsonObject }
  | { kind: "CANCEL_CONTEXT"; contextOccurrenceId: string }>;
export type ComposerAssetView = Readonly<{ assetKey: string;
  kind: "CONTEXT_ASSET" | "SLOT_OPTION_ASSET" | "PLAN_CONTROL" | "RESERVATION_CONTROL";
  label: string; iconKey: string; capabilityRef: string;
  provenance: "STRUCTURAL_DEFAULT" | "PERSONAL_SUGGESTION" | "EXPLICIT_USER_DECISION" | "DERIVED_CONSEQUENCE" }>;
export type DropCapability = Readonly<{ sourceAssetKey: string;
  target: Readonly<{ kind: "BOARD_ZONE" | "CONTEXT_SOCKET" | "TRASH"; contextOccurrenceId?: string; slotKey?: string }>;
  resolution: "ACCEPTED" | "NEEDS_CHOICE" | "BLOCKED"; semanticAction: SemanticMutationPrototype | null;
  previewSupported: boolean; constraint?: ConstraintResult; choices?: readonly PlannerJsonObject[] }>;
