import type { MonthComposerReadModel, DropTarget } from "./composer-contract";
import type { PlannerApplyCommand } from "./compiler-contract";
import type { PlanSemanticStateV1 } from "./semantic-state";
import type { PlanBalanceSuggestions, SemanticMutation } from "./adjustment-contract";

export type ComposerField = Readonly<{ key: string; label: string; kind: "TEXT" | "DATE" | "AMOUNT" | "CHOICE";
  required: boolean; choices?: readonly Readonly<{ value: string; label: string }>[]; initial?: string }>;
export type ComposerEditor = Readonly<{ assetKey: string; fields: readonly ComposerField[] }>;
export type ComposerObjectPresentation = Readonly<{
  iconKey: string;
  variant: "SIMPLE" | "HABIT" | "COMPOSITE" | "SAVINGS";
  baselineAmount: string | null;
  baselineCount: string | null;
  protectedSavings: boolean;
  reservationGauge: Readonly<{ percent: number | null; referenceAmount: string | null }> | null;
}>;
/** Display metadata only. Counts describe top-level objects; no financial authority. */
export type ComposerPresentation = Readonly<{
  elementCount: number; unresolvedCount: number;
  goalMargin: string | null;
  objects: Readonly<Record<string, ComposerObjectPresentation>>;
}>;
/** Excludes Baseline snapshots, canonical evidence and financial adapter entries. */
export type ComposerUiModel = Omit<MonthComposerReadModel, "preview"> & Readonly<{
  proof: Omit<PlannerApplyCommand, "applyRequestId">;
  appliedContextIds: readonly string[];
  editors: readonly ComposerEditor[];
  controlEditors: readonly Readonly<{ targetRef: string; fields: readonly ComposerField[] }>[];
  sectionLabels: Readonly<Record<string, string>>;
  presentation: ComposerPresentation;
}>;
export type ComposerRequest = Readonly<{ sequence: number; targetMonth: string; draft?: PlanSemanticStateV1 }> & (
  | Readonly<{ kind: "READ" }>
  | Readonly<{ kind: "MUTATE"; mutation: SemanticMutation }>
  | Readonly<{ kind: "DROP"; assetKey: string; target: DropTarget; values: Readonly<Record<string, string>>; identity: string; selectionId: string }>
  | Readonly<{ kind: "CLEAR_SOCKET"; contextOccurrenceId: string; slotKey: string; selectionId: string }>
  | Readonly<{ kind: "EDIT_CONTEXT"; contextOccurrenceId: string; values: Readonly<Record<string, string>> }>
  | Readonly<{ kind: "PRESERVE"; targetRef: string; preserve: boolean }>
  | Readonly<{ kind: "SUGGESTIONS" }>
  | Readonly<{ kind: "ACCEPT"; candidateSetDigest: string; candidateId: string }>
  | Readonly<{ kind: "APPLY"; command: PlannerApplyCommand }>
);
export type ComposerResponse = Readonly<{ sequence: number }> & (
  | Readonly<{ ok: true; model: ComposerUiModel; suggestions?: PlanBalanceSuggestions; applied?: boolean; mutationKind?: string }>
  | Readonly<{ ok: false; code: string; message: string }>
);
export type ComposerTransport = (request: ComposerRequest) => Promise<ComposerResponse>;
export type ComposerOperation = ComposerRequest extends infer Request ? Request extends ComposerRequest ? Omit<Request, "sequence" | "targetMonth" | "draft"> : never : never;
