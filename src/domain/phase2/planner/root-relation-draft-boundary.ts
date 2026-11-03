import { canonicalPlannerJson, plannerDigestString, plannerInteger, plannerKeys, plannerRecord, plannerUuid } from "./json";
import { ROOT_RELATION_PLAN_VERSION } from "./root-relation-contract";
import { parseRootRelationPlanState } from "./root-relation-state";
import { ROOT_RELATION_DRAFT_HTTP_CONTRACT, RootRelationDraftError, type RootRelationDraftBase } from "./root-relation-draft-contract";
import { parseCompatibleRootRelationDraft, parseRootRelationDraftSavePacket, readRootRelationDraftDocument,
  rootRelationDraftBase, rootRelationDraftDocumentDigest } from "./root-relation-draft-codec";

/** Organization validity is separate from Mobility completeness, Save policy and Apply.
 * No caller-supplied grant can open the unimplemented durable path. G-A remains undecided. */
export const rootRelationDraftSaveReadiness = (rawDocument: unknown) => {
  parseRootRelationPlanState(rawDocument);
  return { organization: "STRUCTURALLY_VALID" as const, mobility: "NOT_EVALUATED" as const,
  save: "BLOCKED" as const, apply: "NOT_EVALUATED" as const,
  blockers: ["AUTHENTICATED_N1_ADMISSION_REQUIRED", "DURABLE_WRITER_NOT_INSTALLED", "G_A_SAVE_POLICY_UNDECIDED"] as const };
};

/** Pure precondition check, not an owner grant, RPC, Save receipt or retry writer. */
export function prepareRootRelationDraftSave(rawPacket: unknown, rawCurrent: unknown | null, rawBase: RootRelationDraftBase) {
  const packet = parseRootRelationDraftSavePacket(rawPacket), command = packet.command;
  const current = rawCurrent === null ? null : parseCompatibleRootRelationDraft(rawCurrent);
  const base = rootRelationDraftBase(rawBase.revisionId, rawBase.revisionNumber);
  if (current && (current.semanticState.targetMonth !== command.targetMonth || current.lifecycle !== "ACTIVE"))
    throw new RootRelationDraftError("N1_DRAFT_SCOPE_MISMATCH");
  if (base.revisionId !== command.expectedBaseRevisionId || base.revisionNumber !== command.expectedBaseRevisionNumber
    || current && (current.baseRevisionId !== base.revisionId || current.baseRevisionNumber !== base.revisionNumber))
    throw new RootRelationDraftError("N1_DRAFT_BASE_STALE");
  // A lost response must be reconciled by an authoritative read/receipt, never by replaying this preparation as a write.
  if (current?.lastMutationRequestId === command.requestId) throw new RootRelationDraftError("N1_DRAFT_REQUEST_ID_REUSED");
  if ((current?.draftId ?? null) !== command.expectedDraftId || (current?.version ?? 0) !== command.expectedDraftVersion
    || (current?.digest ?? null) !== command.expectedDraftDigest
    || (current?.semanticState.version ?? null) !== command.expectedDocumentVersion)
    throw new RootRelationDraftError("N1_DRAFT_CONFLICT");
  const serialized = canonicalPlannerJson(command.semanticState), bytes = new TextEncoder().encode(serialized).byteLength;
  if (bytes > 1048576) throw new RootRelationDraftError("N1_DRAFT_TOO_LARGE");
  return { kind: "PREPARED_LOCAL_ONLY" as const, packet,
    storage: { semantic_state: command.semanticState, semantic_state_digest: command.digest, compactBytes: bytes },
    writable: false as const, readiness: rootRelationDraftSaveReadiness(command.semanticState) };
}

/** Reject stale/foreign/financially dirty reloads; returns a value, never installs it in Composer. */
export function validateRootRelationDraftReload(localDocument: unknown,
  known: Readonly<{ draftId: string; version: number; digest: string }>, rawIncoming: unknown) {
  const local = readRootRelationDraftDocument(localDocument), incoming = parseCompatibleRootRelationDraft(rawIncoming);
  if (local.version === ROOT_RELATION_PLAN_VERSION && incoming.semanticState.version !== ROOT_RELATION_PLAN_VERSION)
    throw new RootRelationDraftError("N1_DRAFT_DOWNGRADE_REFUSED");
  if (incoming.semanticState.targetMonth !== local.targetMonth || incoming.draftId !== plannerUuid(known.draftId)
    || incoming.lifecycle !== "ACTIVE") throw new RootRelationDraftError("N1_DRAFT_SCOPE_MISMATCH");
  const version = plannerInteger(known.version, 1), digest = plannerDigestString(known.digest);
  if (incoming.version < version) throw new RootRelationDraftError("N1_DRAFT_STALE_RESPONSE");
  if (incoming.version === version && incoming.digest !== digest) throw new RootRelationDraftError("N1_DRAFT_CONFLICT");
  if (rootRelationDraftDocumentDigest(local) !== digest) throw new RootRelationDraftError("N1_DRAFT_DIRTY_RELOAD");
  return incoming;
}

/** Candidate receipt validator only. A validated mock is NOT a durable Saved status. */
export function validateRootRelationDraftSaveReceipt(rawPacket: unknown, rawReceipt: unknown,
  rawKnown: unknown | null, localDocument: unknown) {
  const { command } = parseRootRelationDraftSavePacket(rawPacket), receipt = plannerRecord(rawReceipt);
  if (receipt.contract !== ROOT_RELATION_DRAFT_HTTP_CONTRACT) throw new RootRelationDraftError("N1_DRAFT_TRANSPORT_UNSUPPORTED");
  plannerKeys(receipt, ["contract", "kind", "draft", "replayed"]);
  if (receipt.kind !== "SAVE_RECEIPT" || typeof receipt.replayed !== "boolean") throw new RootRelationDraftError("N1_DRAFT_RECEIPT_INVALID");
  const saved = parseCompatibleRootRelationDraft(receipt.draft), known = rawKnown === null ? null : parseCompatibleRootRelationDraft(rawKnown);
  if (saved.semanticState.version !== ROOT_RELATION_PLAN_VERSION || saved.semanticState.targetMonth !== command.targetMonth
    || saved.lifecycle !== "ACTIVE" || saved.version !== command.expectedDraftVersion + 1
    || command.expectedDraftId !== null && saved.draftId !== command.expectedDraftId
    || saved.lastMutationRequestId !== command.requestId || saved.lastMutationExpectedVersion !== command.expectedDraftVersion
    || saved.lastMutationKind !== "SAVE" || saved.baseRevisionId !== command.expectedBaseRevisionId
    || saved.baseRevisionNumber !== command.expectedBaseRevisionNumber || saved.digest !== command.digest
    || canonicalPlannerJson(saved.semanticState) !== canonicalPlannerJson(command.semanticState))
    throw new RootRelationDraftError("N1_DRAFT_RECEIPT_INVALID");
  if (known && (known.draftId !== saved.draftId || known.version > saved.version)) throw new RootRelationDraftError("N1_DRAFT_STALE_RESPONSE");
  if (known && (known.semanticState.targetMonth !== command.targetMonth || known.lifecycle !== "ACTIVE"))
    throw new RootRelationDraftError("N1_DRAFT_SCOPE_MISMATCH");
  if (!known && command.expectedDraftId !== null) throw new RootRelationDraftError("N1_DRAFT_BINDING_INVALID");
  if (known && known.version < saved.version && (known.version !== command.expectedDraftVersion
    || known.digest !== command.expectedDraftDigest || known.semanticState.version !== command.expectedDocumentVersion))
    throw new RootRelationDraftError("N1_DRAFT_CONFLICT");
  if (known && known.version === saved.version && known.digest !== saved.digest) throw new RootRelationDraftError("N1_DRAFT_CONFLICT");
  if (rootRelationDraftDocumentDigest(localDocument) !== command.digest) throw new RootRelationDraftError("N1_DRAFT_LOCAL_CHANGED");
  return { kind: "VALIDATED_RECEIPT_ONLY" as const, draft: saved, replayed: receipt.replayed };
}
