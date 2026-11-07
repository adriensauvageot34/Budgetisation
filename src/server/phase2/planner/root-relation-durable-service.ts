import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { canonicalPlannerJson, plannerMonth, plannerUuid, plannerRecord } from "@/domain/phase2/planner/json";
import { readRootRelationDraftRow, parseRootRelationDraftSavePacket } from "@/domain/phase2/planner/root-relation-draft-codec";
import { prepareRootRelationDraftSave, validateRootRelationDraftSaveReceipt } from "@/domain/phase2/planner/root-relation-draft-boundary";
import { rootRelationBaseState } from "@/domain/phase2/planner/root-relation-state";
import { rootRelationDocument, composerLocalFrameDigest } from "@/domain/phase2/planner/root-relation-local";
import { rootRelationFinancialReadSnapshot, type RootRelationDurableSnapshot, type RootRelationDurableReceipt } from "@/domain/phase2/planner/root-relation-durable-contract";
import type { RootRelationDraftSavePacket } from "@/domain/phase2/planner/root-relation-draft-contract";
import type { RootRelationServerScope } from "./root-relation-admission";
import { handleRootRelationRequest } from "./root-relation-admission";
import { rootRelationDurableEnabled, rootRelationDurablePolicy } from "./root-relation-durable-policy";
import type { RootRelationWriter } from "./root-relation-durable-writer";

export type RootRelationDurableScope = Readonly<{ supabase: SupabaseClient; userId: string; householdId: string;
  admission: Omit<RootRelationServerScope, "readDrafts">; writer?: RootRelationWriter;
  /** Must rebuild verified identity and C4 dependencies after the SQL authority lock. No cached publication. */
  refresh?: () => Promise<RootRelationDurableScope> }>;

/** Reads complete documents under the ordinary authenticated user's RLS client, never a secret reader. */
export async function readRootRelationDurableDrafts(scope: RootRelationDurableScope, targetMonth: string): Promise<RootRelationDurableSnapshot> {
  const month = plannerMonth(targetMonth);
  const [rows, plan] = await Promise.all([
    scope.supabase.from("phase2_composer_drafts").select("*").eq("owner_user_id", scope.userId)
      .eq("household_id", scope.householdId).eq("target_month", `${month}-01`).order("created_at", { ascending: false }),
    scope.supabase.from("phase2_month_plans").select("active_revision_id,active_revision_number")
      .eq("household_id", scope.householdId).eq("target_month", `${month}-01`).maybeSingle(),
  ]);
  if (rows.error || plan.error) throw new TypeError("N1_DRAFT_READ_UNAVAILABLE");
  const parsed = (rows.data ?? []).map(row => readRootRelationDraftRow(row, { ...scope, targetMonth: month }));
  const active = parsed.filter(row => row.lifecycle === "ACTIVE");
  if (active.length > 1) throw new TypeError("N1_DRAFT_ACTIVE_DUPLICATE");
  const revisionId = plan.data?.active_revision_id ?? null, revisionNumber = plan.data?.active_revision_number ?? 0;
  return { active: active[0] ?? null, archives: parsed.filter(row => row.lifecycle === "ABANDONED"),
    activePlanRevisionId: revisionId, activePlanRevisionNumber: revisionNumber,
    baseStale: !!active[0] && (active[0].baseRevisionId !== revisionId || active[0].baseRevisionNumber !== revisionNumber) };
}

async function admitSave(scope: RootRelationDurableScope, packet: RootRelationDraftSavePacket) {
  if (plannerUuid(scope.userId) !== plannerUuid(scope.admission.userId)
    || plannerUuid(scope.householdId) !== plannerUuid(scope.admission.householdId)) throw new TypeError("N1_DRAFT_SCOPE_MISMATCH");
  const command = packet.command;
  const snapshot = await readRootRelationDurableDrafts(scope, command.targetMonth), current = snapshot.active;
  // N1-B admits members only from an existing privately saved Draft. No invented authority on create.
  if (!current) throw new TypeError("N1_DRAFT_ACCESS_DENIED");
  const financial = rootRelationFinancialReadSnapshot(snapshot);
  const frame = { draft: rootRelationBaseState(command.semanticState), relations: command.semanticState.rootRelations };
  const sourceFrame = { draft: financial.active!.semanticState,
    relations: current.semanticState.version === "month-plan-state@v1" ? [] : current.semanticState.rootRelations };
  const ownerScope = { ...scope.admission, readDrafts: async () => financial };
  const published = await handleRootRelationRequest(ownerScope, {
    kind: "READ", sequence: 0, targetMonth: command.targetMonth,
    binding: { draftId: current.draftId, version: current.version }, frame: sourceFrame,
  });
  if (!published.ok) throw new TypeError(published.code);
  const admitted = await handleRootRelationRequest(ownerScope, {
    kind: "RESTORE", sequence: 1, targetMonth: command.targetMonth,
    binding: { draftId: current.draftId, version: current.version }, frame: sourceFrame,
    proposed: frame, authorityToken: published.authorityToken, expectedStateDigest: composerLocalFrameDigest(sourceFrame),
  });
  if (!admitted.ok) throw new TypeError(admitted.code);
  if (canonicalPlannerJson(rootRelationDocument(admitted.frame)) !== canonicalPlannerJson(command.semanticState))
    throw new TypeError("N1_DRAFT_AUTHORITY_MISMATCH");
  // Reconciliation uses the very same full-mutation receipt validator as a normal response.
  const replay = current.lastMutationRequestId === command.requestId ? validateRootRelationDraftSaveReceipt(packet,
    { contract: packet.contract, kind: "SAVE_RECEIPT", draft: current, replayed: true }, current, command.semanticState) : null;
  if (!replay) prepareRootRelationDraftSave(packet, current, { revisionId: snapshot.activePlanRevisionId, revisionNumber: snapshot.activePlanRevisionNumber });
  const policy = rootRelationDurablePolicy(command.semanticState);
  return { current, replay, authority: { capabilities: admitted.capabilities, authorityToken: admitted.authorityToken, policy } };
}

/** The same actual owner is run only AFTER DB authority tables have been frozen. The
 * signing key never signs an arbitrary client document, grant, scope or admission token. */
export async function saveRootRelationDurableDraft(scope: RootRelationDurableScope, raw: unknown): Promise<RootRelationDurableReceipt> {
  if (!rootRelationDurableEnabled()) throw new TypeError("N1_DURABLE_DISABLED");
  const packet = parseRootRelationDraftSavePacket(raw);
  if (!scope.writer || !scope.refresh) {
    await admitSave(scope, packet); // Still return precise parser/private authority refusals.
    throw new TypeError("N1_SQL_AUTHORITY_NOT_RECEIVED");
  }
  return scope.writer.run({ ...scope, targetMonth: packet.command.targetMonth }, async transaction => {
    const fresh = await scope.refresh!();
    if (fresh.userId !== scope.userId || fresh.householdId !== scope.householdId || !rootRelationDurableEnabled())
      throw new TypeError("N1_DRAFT_SCOPE_MISMATCH");
    const { current, replay, authority } = await admitSave(fresh, packet);
    if (replay) return { contract: packet.contract, kind: "SAVE_RECEIPT", draft: replay.draft, replayed: true };
    const stored = plannerRecord(await transaction.commit(packet, authority));
    if (typeof stored.replayed !== "boolean") throw new TypeError("N1_DRAFT_RECEIPT_INVALID");
    const draft = readRootRelationDraftRow(stored.draft, { ...scope, targetMonth: packet.command.targetMonth });
    const receipt = { contract: packet.contract, kind: "SAVE_RECEIPT" as const, draft, replayed: stored.replayed };
    validateRootRelationDraftSaveReceipt(packet, receipt, current, packet.command.semanticState);
    return receipt;
  });
}
