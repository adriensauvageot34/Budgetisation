import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { plannerDigest, plannerDigestString, plannerInteger, plannerMonth, plannerRecord, plannerUuid } from "@/domain/phase2/planner/json";
import { parsePlanSemanticState, semanticStateDigest } from "@/domain/phase2/planner/semantic-state";
import type { ComposerDraftLifecycleCommand, ComposerDraftResult, ComposerDraftSaveCommand,
  ComposerDraftSnapshot, StoredComposerDraft } from "@/domain/phase2/planner/composer-draft-contract";

type Scope = Readonly<{ supabase: SupabaseClient; userId: string; householdId: string }>;
type PlanBase = Readonly<{ planId: string | null; revisionId: string | null; revisionNumber: number }>;
const table = "phase2_composer_drafts";
const monthDate = (value: string) => `${plannerMonth(value)}-01`;

function parseRow(value: unknown, targetMonth: string): StoredComposerDraft {
  const row = plannerRecord(value);
  const semanticState = parsePlanSemanticState(row.semantic_state);
  const digest = plannerDigestString(row.semantic_state_digest);
  if (semanticState.targetMonth !== targetMonth || String(row.target_month) !== monthDate(targetMonth)
    || digest !== semanticStateDigest(semanticState)) throw new TypeError("COMPOSER_DRAFT_DIGEST_OR_MONTH_INVALID");
  const lifecycle = row.lifecycle;
  const lastMutationKind = row.last_mutation_kind;
  if (lifecycle !== "ACTIVE" && lifecycle !== "ABANDONED") throw new TypeError("COMPOSER_DRAFT_LIFECYCLE_INVALID");
  if (lastMutationKind !== "SAVE" && lastMutationKind !== "ARCHIVE" && lastMutationKind !== "RESTORE")
    throw new TypeError("COMPOSER_DRAFT_MUTATION_INVALID");
  const baseRevisionId = row.base_plan_revision_id === null ? null : plannerUuid(row.base_plan_revision_id);
  return {
    draftId: plannerUuid(row.draft_id), version: plannerInteger(row.draft_version, 1), lifecycle,
    semanticState, digest, baseRevisionId, baseRevisionNumber: plannerInteger(row.base_plan_revision_number),
    lastSavedAt: String(row.last_saved_at), archivedAt: row.archived_at === null ? null : String(row.archived_at),
    lastMutationRequestId: plannerUuid(row.last_mutation_request_id),
    lastMutationExpectedVersion: plannerInteger(row.last_mutation_expected_version), lastMutationKind,
  };
}

async function readBase(scope: Scope, targetMonth: string): Promise<PlanBase> {
  const { data, error } = await scope.supabase.from("phase2_month_plans")
    .select("plan_id,active_revision_id,active_revision_number")
    .eq("household_id", scope.householdId).eq("target_month", monthDate(targetMonth)).abortSignal(AbortSignal.timeout(15000)).maybeSingle();
  if (error) throw error;
  return { planId: data?.active_revision_id ? plannerUuid(data.plan_id) : null,
    revisionId: data?.active_revision_id ? plannerUuid(data.active_revision_id) : null,
    revisionNumber: data ? plannerInteger(data.active_revision_number) : 0 };
}

async function readRows(scope: Scope, targetMonth: string): Promise<StoredComposerDraft[]> {
  const { data, error } = await scope.supabase.from(table).select("*")
    .eq("owner_user_id", scope.userId).eq("household_id", scope.householdId)
    .eq("target_month", monthDate(targetMonth)).order("created_at", { ascending: false })
    .abortSignal(AbortSignal.timeout(15000));
  if (error) throw error;
  return (data ?? []).map(row => parseRow(row, targetMonth));
}

export async function readComposerDrafts(scope: Scope, targetMonth: string): Promise<ComposerDraftSnapshot> {
  plannerUuid(scope.userId); plannerUuid(scope.householdId); plannerMonth(targetMonth);
  const [rows, base] = await Promise.all([readRows(scope, targetMonth), readBase(scope, targetMonth)]);
  const active = rows.find(row => row.lifecycle === "ACTIVE") ?? null;
  if (rows.filter(row => row.lifecycle === "ACTIVE").length > 1) throw new TypeError("COMPOSER_DRAFT_ACTIVE_DUPLICATE");
  return { active, archives: rows.filter(row => row.lifecycle === "ABANDONED"),
    activePlanRevisionId: base.revisionId, activePlanRevisionNumber: base.revisionNumber,
    baseStale: !!active && (active.baseRevisionId !== base.revisionId || active.baseRevisionNumber !== base.revisionNumber) };
}

function failed(code: Exclude<ComposerDraftResult, { ok: true }>["code"], latest: ComposerDraftSnapshot | null = null): ComposerDraftResult {
  const messages = {
    CONFLICT: "Ce brouillon a changé dans un autre onglet ou appareil. Vos modifications locales restent disponibles.",
    BASE_STALE: "Le Plan actif a changé depuis ce brouillon. Choisissez explicitement comment reprendre vos essais.",
    TOO_LARGE: "Ce brouillon dépasse la limite de 1 Mio. Aucune version enregistrée n'a été écrasée.",
    INVALID: "Le brouillon contient une donnée invalide. La dernière version enregistrée reste intacte.",
    ACCESS_DENIED: "Vous n'avez pas accès à ce brouillon.",
    UNAVAILABLE: "La sauvegarde n'a pas pu être confirmée. Vos modifications restent dans cette page ; réessayez.",
  };
  return { ok: false, code, message: messages[code], latest };
}

async function latestOrNull(scope: Scope, targetMonth: string) {
  try { return await readComposerDrafts(scope, targetMonth); } catch { return null; }
}

function responseDraft(value: unknown, targetMonth: string): { draft: StoredComposerDraft; replayed: boolean } {
  const result = plannerRecord(value);
  if (typeof result.replayed !== "boolean") throw new TypeError("COMPOSER_DRAFT_RPC_RESPONSE_INVALID");
  return { draft: parseRow(result.draft, targetMonth), replayed: result.replayed };
}

export async function saveComposerDraft(scope: Scope, command: ComposerDraftSaveCommand): Promise<ComposerDraftResult> {
  let targetMonth: string;
  try {
    targetMonth = plannerMonth(command.targetMonth);
    const state = parsePlanSemanticState(command.semanticState);
    const digest = plannerDigestString(command.digest);
    const requestId = plannerUuid(command.requestId);
    const expectedId = command.expectedDraftId === null ? null : plannerUuid(command.expectedDraftId);
    const expectedVersion = plannerInteger(command.expectedDraftVersion);
    const expectedBaseId = command.expectedBaseRevisionId === null ? null : plannerUuid(command.expectedBaseRevisionId);
    const expectedBaseNumber = plannerInteger(command.expectedBaseRevisionNumber);
    if (state.targetMonth !== targetMonth || digest !== semanticStateDigest(state)
      || (expectedId === null) !== (expectedVersion === 0)
      || (expectedBaseId === null) !== (expectedBaseNumber === 0)) return failed("INVALID");
    const compactBytes = Buffer.byteLength(JSON.stringify(state));
    if (compactBytes > 1048576) return failed("TOO_LARGE");

    // Read first: a prior RPC may have committed even if its response was lost.
    const [before, base] = await Promise.all([readComposerDrafts(scope, targetMonth), readBase(scope, targetMonth)]);
    const active = before.active;
    if (active?.lastMutationRequestId === requestId && active.lastMutationKind === "SAVE"
      && active.lastMutationExpectedVersion === expectedVersion && active.digest === digest
      && plannerDigest(active.semanticState) === plannerDigest(state)) return { ok: true, draft: active, replayed: true };
    if (base.revisionId !== expectedBaseId || base.revisionNumber !== expectedBaseNumber || before.baseStale)
      return failed("BASE_STALE", before);
    if ((active?.draftId ?? null) !== expectedId || (active?.version ?? 0) !== expectedVersion)
      return failed("CONFLICT", before);

    const { data, error } = await scope.supabase.rpc("save_phase2_composer_draft_v2", {
      p_household_id: scope.householdId, p_target_month: monthDate(targetMonth),
      p_expected_draft_id: expectedId, p_expected_draft_version: expectedVersion,
      p_save_request_id: requestId, p_base_plan_id: base.planId,
      p_base_plan_revision_id: base.revisionId, p_base_plan_revision_number: base.revisionNumber,
      p_semantic_state: state, p_semantic_state_digest: digest,
    }).abortSignal(AbortSignal.timeout(15000)).then(response => response, () => ({ data: null, error: null }));
    if (!error) {
      try {
        const saved = responseDraft(data, targetMonth);
        if (saved.draft.digest === digest && plannerDigest(saved.draft.semanticState) === plannerDigest(state))
          return { ok: true, ...saved };
      } catch { /* The response may be truncated after commit; read it below. */ }
    }
    const after = await latestOrNull(scope, targetMonth);
    const committed = after?.active;
    if (committed?.lastMutationRequestId === requestId && committed.lastMutationKind === "SAVE"
      && committed.lastMutationExpectedVersion === expectedVersion && committed.digest === digest
      && plannerDigest(committed.semanticState) === plannerDigest(state))
      return { ok: true, draft: committed, replayed: true };
    if (error?.code === "40001") return failed("CONFLICT", after);
    if (error?.code === "42501") return failed("ACCESS_DENIED");
    if (error?.code === "23514" && error.message.includes("phase2_composer_drafts_size")) return failed("TOO_LARGE", after);
    if (error?.code === "22023") return failed(compactBytes > 1000000 ? "TOO_LARGE" : "INVALID", after);
    return failed("UNAVAILABLE", after);
  } catch {
    return failed("UNAVAILABLE");
  }
}

export async function changeComposerDraftLifecycle(scope: Scope, kind: "ARCHIVE" | "RESTORE",
  command: ComposerDraftLifecycleCommand): Promise<ComposerDraftResult> {
  try {
    const month = plannerMonth(command.targetMonth);
    const id = plannerUuid(command.draftId), requestId = plannerUuid(command.requestId);
    const expectedVersion = plannerInteger(command.expectedDraftVersion, 1);
    const before = await readComposerDrafts(scope, month);
    const row = [before.active, ...before.archives].find(draft => draft?.draftId === id);
    if (row?.lastMutationRequestId === requestId && row.lastMutationKind === kind
      && row.lastMutationExpectedVersion === expectedVersion
      && row.lifecycle === (kind === "ARCHIVE" ? "ABANDONED" : "ACTIVE"))
      return { ok: true, draft: row, replayed: true };
    if (!row || row.version !== expectedVersion || row.lifecycle !== (kind === "ARCHIVE" ? "ACTIVE" : "ABANDONED")
      || kind === "RESTORE" && before.active) return failed("CONFLICT", before);
    const { data, error } = await scope.supabase.rpc(kind === "ARCHIVE"
      ? "archive_phase2_composer_draft_v2" : "restore_phase2_composer_draft_v2", {
      p_household_id: scope.householdId, p_target_month: monthDate(month), p_draft_id: id,
      p_expected_draft_version: expectedVersion,
      ...(kind === "ARCHIVE" ? { p_archive_request_id: requestId } : { p_restore_request_id: requestId }),
    }).abortSignal(AbortSignal.timeout(15000)).then(response => response, () => ({ data: null, error: null }));
    if (!error) {
      try { return { ok: true, ...responseDraft(data, month) }; }
      catch { /* Reconcile a malformed or lost response from committed SQL. */ }
    }
    const after = await latestOrNull(scope, month);
    const committed = [after?.active, ...(after?.archives ?? [])].find(draft => draft?.draftId === id);
    if (committed?.lastMutationRequestId === requestId && committed.lastMutationKind === kind
      && committed.lastMutationExpectedVersion === expectedVersion
      && committed.lifecycle === (kind === "ARCHIVE" ? "ABANDONED" : "ACTIVE"))
      return { ok: true, draft: committed, replayed: true };
    if (error?.code === "40001") return failed("CONFLICT", after);
    if (error?.code === "42501") return failed("ACCESS_DENIED");
    return failed("UNAVAILABLE", after);
  } catch { return failed("UNAVAILABLE"); }
}
