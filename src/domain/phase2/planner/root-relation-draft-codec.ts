import { COMPOSER_DRAFT_HTTP_CONTRACT } from "./composer-draft-contract";
import { canonicalPlannerJson, plannerDigestString, plannerInteger, plannerKeys, plannerMonth, plannerRecord, plannerString, plannerUuid } from "./json";
import { PLAN_SEMANTIC_STATE_VERSION, parsePlanSemanticState, semanticStateDigest } from "./semantic-state";
import { ROOT_RELATION_PLAN_VERSION } from "./root-relation-contract";
import { parseRootRelationPlanState, rootRelationStateDigest } from "./root-relation-state";
import { ROOT_RELATION_DRAFT_HTTP_CONTRACT, ROOT_RELATION_DRAFT_RECORD_VERSION, RootRelationDraftError,
  type CompatibleStoredRootRelationDraft, type RootRelationDraftDocument, type RootRelationDraftRowScope,
  type RootRelationDraftSavePacket } from "./root-relation-draft-contract";

/** Dispatch without conversion: V1 retains its historical parser and digest. */
export function readRootRelationDraftDocument(raw: unknown): RootRelationDraftDocument {
  const version = plannerRecord(raw).version;
  if (version === PLAN_SEMANTIC_STATE_VERSION) return parsePlanSemanticState(raw);
  if (version === ROOT_RELATION_PLAN_VERSION) return parseRootRelationPlanState(raw);
  throw new RootRelationDraftError("N1_DRAFT_DOCUMENT_UNSUPPORTED");
}
export function rootRelationDraftDocumentDigest(raw: unknown): string {
  const document = readRootRelationDraftDocument(raw);
  return document.version === PLAN_SEMANTIC_STATE_VERSION ? semanticStateDigest(document) : rootRelationStateDigest(document);
}
export function rootRelationDraftBase(rawId: unknown, rawNumber: unknown) {
  const revisionId = rawId === null ? null : plannerUuid(rawId), revisionNumber = plannerInteger(rawNumber);
  if ((revisionId === null) !== (revisionNumber === 0)) throw new RootRelationDraftError("N1_DRAFT_BINDING_INVALID");
  return { revisionId, revisionNumber };
}
export function parseCompatibleRootRelationDraft(raw: unknown): CompatibleStoredRootRelationDraft {
  const value = plannerRecord(raw);
  plannerKeys(value, ["draftId", "version", "lifecycle", "semanticState", "digest", "baseRevisionId", "baseRevisionNumber",
    "lastSavedAt", "archivedAt", "lastMutationRequestId", "lastMutationExpectedVersion", "lastMutationKind"]);
  const semanticState = readRootRelationDraftDocument(value.semanticState), digest = plannerDigestString(value.digest);
  if (digest !== rootRelationDraftDocumentDigest(semanticState)) throw new RootRelationDraftError("N1_DRAFT_DIGEST_MISMATCH");
  if ((value.lifecycle !== "ACTIVE" && value.lifecycle !== "ABANDONED")
    || !["SAVE", "ARCHIVE", "RESTORE"].includes(String(value.lastMutationKind))) throw new RootRelationDraftError("N1_DRAFT_METADATA_INVALID");
  const base = rootRelationDraftBase(value.baseRevisionId, value.baseRevisionNumber);
  return { draftId: plannerUuid(value.draftId), version: plannerInteger(value.version, 1), lifecycle: value.lifecycle,
    semanticState, digest, baseRevisionId: base.revisionId, baseRevisionNumber: base.revisionNumber,
    lastSavedAt: plannerString(value.lastSavedAt), archivedAt: value.archivedAt === null ? null : plannerString(value.archivedAt),
    lastMutationRequestId: plannerUuid(value.lastMutationRequestId), lastMutationExpectedVersion: plannerInteger(value.lastMutationExpectedVersion),
    lastMutationKind: value.lastMutationKind as CompatibleStoredRootRelationDraft["lastMutationKind"] };
}
/** Full candidate wire/storage record, never a confirmed Save receipt. */
export function serializeRootRelationDraftRecord(raw: unknown): string {
  return canonicalPlannerJson({ version: ROOT_RELATION_DRAFT_RECORD_VERSION, draft: parseCompatibleRootRelationDraft(raw) });
}
export function parseRootRelationDraftRecord(raw: unknown): CompatibleStoredRootRelationDraft {
  const value = plannerRecord(raw);
  if (value.version !== ROOT_RELATION_DRAFT_RECORD_VERSION) throw new RootRelationDraftError("N1_DRAFT_RECORD_UNSUPPORTED");
  plannerKeys(value, ["version", "draft"]);
  return parseCompatibleRootRelationDraft(value.draft);
}
/** Pure mapping of a future server-selected row. Scope equality is not an Auth/RLS certificate. */
export function readRootRelationDraftRow(raw: unknown, scope: RootRelationDraftRowScope): CompatibleStoredRootRelationDraft {
  const row = plannerRecord(raw), month = plannerMonth(scope.targetMonth);
  if (plannerUuid(row.owner_user_id) !== plannerUuid(scope.userId) || plannerUuid(row.household_id) !== plannerUuid(scope.householdId)
    || row.target_month !== `${month}-01`) throw new RootRelationDraftError("N1_DRAFT_SCOPE_MISMATCH");
  const draft = parseCompatibleRootRelationDraft({ draftId: row.draft_id, version: row.draft_version, lifecycle: row.lifecycle,
    semanticState: row.semantic_state, digest: row.semantic_state_digest, baseRevisionId: row.base_plan_revision_id,
    baseRevisionNumber: row.base_plan_revision_number, lastSavedAt: row.last_saved_at, archivedAt: row.archived_at,
    lastMutationRequestId: row.last_mutation_request_id, lastMutationExpectedVersion: row.last_mutation_expected_version,
    lastMutationKind: row.last_mutation_kind });
  if (draft.semanticState.targetMonth !== month) throw new RootRelationDraftError("N1_DRAFT_SCOPE_MISMATCH");
  return draft;
}
export function assertRootRelationDraftClient(contract: unknown, stored: unknown, local?: unknown): void {
  if (contract !== ROOT_RELATION_DRAFT_HTTP_CONTRACT && contract !== COMPOSER_DRAFT_HTTP_CONTRACT)
    throw new RootRelationDraftError("N1_DRAFT_TRANSPORT_UNSUPPORTED");
  const document = readRootRelationDraftDocument(stored);
  if (contract === COMPOSER_DRAFT_HTTP_CONTRACT && (document.version !== PLAN_SEMANTIC_STATE_VERSION
    || local !== undefined && readRootRelationDraftDocument(local).version !== PLAN_SEMANTIC_STATE_VERSION))
    throw new RootRelationDraftError("N1_DRAFT_OLD_CLIENT");
}
export function parseRootRelationDraftSavePacket(raw: unknown): RootRelationDraftSavePacket {
  const packet = plannerRecord(raw);
  if (packet.contract !== ROOT_RELATION_DRAFT_HTTP_CONTRACT) throw new RootRelationDraftError("N1_DRAFT_TRANSPORT_UNSUPPORTED");
  plannerKeys(packet, ["contract", "kind", "command"]);
  if (packet.kind !== "SAVE") throw new RootRelationDraftError("N1_DRAFT_METADATA_INVALID");
  const value = plannerRecord(packet.command);
  plannerKeys(value, ["targetMonth", "expectedDraftId", "expectedDraftVersion", "expectedDocumentVersion", "expectedDraftDigest",
    "expectedBaseRevisionId", "expectedBaseRevisionNumber", "requestId", "semanticState", "digest"]);
  const semanticState = parseRootRelationPlanState(value.semanticState), targetMonth = plannerMonth(value.targetMonth), digest = plannerDigestString(value.digest);
  if (semanticState.targetMonth !== targetMonth) throw new RootRelationDraftError("N1_DRAFT_SCOPE_MISMATCH");
  if (rootRelationStateDigest(semanticState) !== digest) throw new RootRelationDraftError("N1_DRAFT_DIGEST_MISMATCH");
  const expectedDraftId = value.expectedDraftId === null ? null : plannerUuid(value.expectedDraftId), expectedDraftVersion = plannerInteger(value.expectedDraftVersion);
  const expectedDraftDigest = value.expectedDraftDigest === null ? null : plannerDigestString(value.expectedDraftDigest);
  const expectedDocumentVersion = value.expectedDocumentVersion;
  if ((expectedDraftId === null) !== (expectedDraftVersion === 0) || (expectedDraftId === null) !== (expectedDraftDigest === null)
    || (expectedDraftId === null) !== (expectedDocumentVersion === null)) throw new RootRelationDraftError("N1_DRAFT_BINDING_INVALID");
  if (expectedDocumentVersion !== null && expectedDocumentVersion !== PLAN_SEMANTIC_STATE_VERSION && expectedDocumentVersion !== ROOT_RELATION_PLAN_VERSION)
    throw new RootRelationDraftError("N1_DRAFT_DOCUMENT_UNSUPPORTED");
  const base = rootRelationDraftBase(value.expectedBaseRevisionId, value.expectedBaseRevisionNumber);
  return { contract: ROOT_RELATION_DRAFT_HTTP_CONTRACT, kind: "SAVE", command: { targetMonth, expectedDraftId, expectedDraftVersion,
    expectedDocumentVersion, expectedDraftDigest, expectedBaseRevisionId: base.revisionId, expectedBaseRevisionNumber: base.revisionNumber,
    requestId: plannerUuid(value.requestId), semanticState, digest } };
}
