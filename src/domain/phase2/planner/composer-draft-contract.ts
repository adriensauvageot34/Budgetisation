import type { PlanSemanticStateV1 } from "./semantic-state";

export type StoredComposerDraft = Readonly<{
  draftId: string;
  version: number;
  lifecycle: "ACTIVE" | "ABANDONED";
  semanticState: PlanSemanticStateV1;
  digest: string;
  baseRevisionId: string | null;
  baseRevisionNumber: number;
  lastSavedAt: string;
  archivedAt: string | null;
  lastMutationRequestId: string;
  lastMutationExpectedVersion: number;
  lastMutationKind: "SAVE" | "ARCHIVE" | "RESTORE";
}>;

export type ComposerDraftSnapshot = Readonly<{
  active: StoredComposerDraft | null;
  archives: readonly StoredComposerDraft[];
  activePlanRevisionId: string | null;
  activePlanRevisionNumber: number;
  baseStale: boolean;
}>;

export type ComposerDraftSaveCommand = Readonly<{
  targetMonth: string;
  expectedDraftId: string | null;
  expectedDraftVersion: number;
  expectedBaseRevisionId: string | null;
  expectedBaseRevisionNumber: number;
  requestId: string;
  semanticState: PlanSemanticStateV1;
  digest: string;
}>;

export type ComposerDraftLifecycleCommand = Readonly<{
  targetMonth: string;
  draftId: string;
  expectedDraftVersion: number;
  requestId: string;
}>;

export type ComposerDraftResult =
  | Readonly<{ ok: true; draft: StoredComposerDraft; replayed: boolean }>
  | Readonly<{ ok: false; code: "CONFLICT" | "BASE_STALE" | "TOO_LARGE" | "INVALID" | "ACCESS_DENIED" | "UNAVAILABLE";
    message: string; latest: ComposerDraftSnapshot | null }>;
