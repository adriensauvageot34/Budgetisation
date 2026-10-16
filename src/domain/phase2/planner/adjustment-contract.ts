import type { PlannerJsonObject } from "./json";
import type { PlanSemanticStateV1, PlannedContextState } from "./semantic-state";
import type { PlanProjectionV1 } from "./projection-contract";
import type { PlannerKnowledge } from "./diagnostics";
import type { ComponentSelectionV1 } from "./component-contract";
export type SemanticMutation =
  | Readonly<{ kind: "SET_STATE"; targetRef: string; value: PlannerJsonObject }>
  | Readonly<{ kind: "REMOVE_CONTEXT"; contextOccurrenceId: string }>
  | Readonly<{ kind: "PATCH_CONTEXT"; contextOccurrenceId: string; slotKey: string; items: readonly ComponentSelectionV1[] }>
  | Readonly<{ kind: "ADD_CONTEXT"; context: PlannedContextState }>
  | Readonly<{ kind: "ATTACH_CONTEXT"; context: PlannedContextState; parentContextOccurrenceId: string; slotKey: string; selectionId: string }>
  | Readonly<{ kind: "REPARENT_CONTEXT"; contextOccurrenceId: string; parentContextOccurrenceId: string; slotKey: string; selectionId: string }>;
export type AdjustmentPreset = Readonly<{ label: string; semanticMutation: SemanticMutation }>;
export type ControlDimension = "amount" | "count" | "unitAmount";
export type ControlFieldCapability = Readonly<{
  status: "EDITABLE" | "PROTECTED_BY_RULE" | "READ_ONLY_EXTERNAL_OWNER" | "NEEDS_INPUT_GATE" | "NO_PUBLISHED_CAPABILITY" | "STALE_OR_UNAVAILABLE";
  minimum: string; maximum: string; step: string; integer: boolean;
}>;
export type AdjustmentCapability = Readonly<{ targetRef: string; label: string;
  actions: readonly ("SET_SLOT_AMOUNT" | "SET_SLOT_OCCURRENCES" | "SET_SLOT_UNIT_AMOUNT" | "SET_SAVINGS_ALLOCATION" | "REMOVE_CONTEXT" | "PATCH_CONTEXT" | "ADD_CONTEXT")[];
  fields?: Readonly<Partial<Record<ControlDimension, ControlFieldCapability>>>;
  flexibility: "LOCKED" | "SAFE_FLEX" | "STRETCH_FLEX" | "FREE"; knowledge: PlannerKnowledge;
  hardReducibleRoom: string | null; softReducibleRoom: string | null;
  naturalPresets: readonly AdjustmentPreset[]; rationaleCodes: readonly string[] }>;
export type AdjustmentCandidate = Readonly<{ candidateId: string; targetRef: string; label: string;
  semanticMutation: SemanticMutation; projection: PlanProjectionV1; projectionDigest: string; compiledManifestDigest: string;
  impactOnMonthEnd: string | null; knowledge: PlannerKnowledge; rationaleCodes: readonly string[] }>;
export type PlanBalanceSuggestions = Readonly<{ version: string; semanticStateDigest: string; basePreviewDigest: string;
  candidateSetDigest: string; capabilities: readonly AdjustmentCapability[]; candidates: readonly AdjustmentCandidate[];
  resolutionSuggestions: readonly Readonly<{ targetRef: string; rationaleCodes: readonly string[] }>[] }>;
export type AcceptedAdjustment = Readonly<{ semanticState: PlanSemanticStateV1; invalidatedCandidateSetDigest: string;
  suggestions: PlanBalanceSuggestions; projection: PlanProjectionV1 }>;
