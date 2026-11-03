import type { StoredComposerDraft } from "./composer-draft-contract";
import type { PlanSemanticStateV1 } from "./semantic-state";
import type { RootRelationPlanState } from "./root-relation-contract";

/** Candidate only: no route or durable writer implements this contract in N1-C-A. */
export const ROOT_RELATION_DRAFT_HTTP_CONTRACT = "composer-draft-http@2-root-relations" as const;
export const ROOT_RELATION_DRAFT_RECORD_VERSION = "composer-root-relation-draft-record@1" as const;
export type RootRelationDraftDocument = PlanSemanticStateV1 | RootRelationPlanState;
export type CompatibleStoredRootRelationDraft = Omit<StoredComposerDraft, "semanticState"> & Readonly<{
  semanticState: RootRelationDraftDocument;
}>;
export type RootRelationDraftSaveCommand = Readonly<{
  targetMonth: string;
  expectedDraftId: string | null;
  expectedDraftVersion: number;
  expectedDocumentVersion: RootRelationDraftDocument["version"] | null;
  expectedDraftDigest: string | null;
  expectedBaseRevisionId: string | null;
  expectedBaseRevisionNumber: number;
  requestId: string;
  semanticState: RootRelationPlanState;
  digest: string;
}>;
export type RootRelationDraftSavePacket = Readonly<{
  contract: typeof ROOT_RELATION_DRAFT_HTTP_CONTRACT;
  kind: "SAVE";
  command: RootRelationDraftSaveCommand;
}>;
export type RootRelationDraftBase = Readonly<{ revisionId: string | null; revisionNumber: number }>;
export type RootRelationDraftRowScope = Readonly<{ userId: string; householdId: string; targetMonth: string }>;
export type RootRelationDraftErrorCode =
  | "N1_DRAFT_TRANSPORT_UNSUPPORTED" | "N1_DRAFT_RECORD_UNSUPPORTED" | "N1_DRAFT_DOCUMENT_UNSUPPORTED"
  | "N1_DRAFT_DIGEST_MISMATCH" | "N1_DRAFT_SCOPE_MISMATCH" | "N1_DRAFT_BINDING_INVALID"
  | "N1_DRAFT_METADATA_INVALID" | "N1_DRAFT_CONFLICT" | "N1_DRAFT_BASE_STALE" | "N1_DRAFT_REQUEST_ID_REUSED"
  | "N1_DRAFT_DOWNGRADE_REFUSED" | "N1_DRAFT_OLD_CLIENT" | "N1_DRAFT_DIRTY_RELOAD"
  | "N1_DRAFT_STALE_RESPONSE" | "N1_DRAFT_RECEIPT_INVALID" | "N1_DRAFT_LOCAL_CHANGED" | "N1_DRAFT_TOO_LARGE";
export class RootRelationDraftError extends TypeError {
  constructor(readonly code: RootRelationDraftErrorCode) { super(code); this.name = "RootRelationDraftError"; }
}
