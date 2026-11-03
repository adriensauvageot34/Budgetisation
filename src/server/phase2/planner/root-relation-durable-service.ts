import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { canonicalPlannerJson, plannerMonth, plannerUuid } from "@/domain/phase2/planner/json";
import { readRootRelationDraftRow, parseRootRelationDraftSavePacket } from "@/domain/phase2/planner/root-relation-draft-codec";
import { prepareRootRelationDraftSave, validateRootRelationDraftSaveReceipt } from "@/domain/phase2/planner/root-relation-draft-boundary";
import { rootRelationBaseState } from "@/domain/phase2/planner/root-relation-state";
import { rootRelationDocument } from "@/domain/phase2/planner/root-relation-local";
import type { RootRelationDurableSnapshot } from "@/domain/phase2/planner/root-relation-durable-contract";
import type { RootRelationServerScope } from "./root-relation-admission";
import { handleRootRelationRequest } from "./root-relation-admission";
import { rootRelationDurableEnabled, rootRelationDurablePolicy } from "./root-relation-durable-policy";

export type RootRelationDurableScope = Readonly<{ supabase: SupabaseClient; userId: string; householdId: string;
  admission: Omit<RootRelationServerScope, "readDrafts"> }>;

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

/** Full authority and G-A are checked before a writer is even obtained. There is deliberately no client-supplied policy. */
export async function saveRootRelationDurableDraft(scope: RootRelationDurableScope, raw: unknown) {
  if (!rootRelationDurableEnabled()) throw new TypeError("N1_DURABLE_DISABLED");
  if (plannerUuid(scope.userId) !== plannerUuid(scope.admission.userId)
    || plannerUuid(scope.householdId) !== plannerUuid(scope.admission.householdId)) throw new TypeError("N1_DRAFT_SCOPE_MISMATCH");
  const packet = parseRootRelationDraftSavePacket(raw), command = packet.command;
  const snapshot = await readRootRelationDurableDrafts(scope, command.targetMonth), current = snapshot.active;
  // N1-B admits members only from an existing privately saved Draft. No invented authority on create.
  if (!current) throw new TypeError("N1_DRAFT_ACCESS_DENIED");
  const asFinancial = (draft: typeof current) => ({ ...draft, semanticState: draft.semanticState.version === "month-plan-state@v1"
    ? draft.semanticState : rootRelationBaseState(draft.semanticState) }); // Owner READ projection only, never writer input.
  const frame = { draft: rootRelationBaseState(command.semanticState), relations: command.semanticState.rootRelations };
  const admitted = await handleRootRelationRequest({ ...scope.admission, readDrafts: async () => ({ ...snapshot,
    active: asFinancial(current), archives: snapshot.archives.map(asFinancial) }) }, {
    kind: "READ", sequence: 0, targetMonth: command.targetMonth,
    binding: { draftId: current.draftId, version: current.version }, frame,
  });
  if (!admitted.ok) throw new TypeError(admitted.code);
  if (canonicalPlannerJson(rootRelationDocument(admitted.frame)) !== canonicalPlannerJson(command.semanticState))
    throw new TypeError("N1_DRAFT_AUTHORITY_MISMATCH");
  // Reconciliation uses the very same full-mutation receipt validator as a normal response.
  const replay = current.lastMutationRequestId === command.requestId ? validateRootRelationDraftSaveReceipt(packet,
    { contract: packet.contract, kind: "SAVE_RECEIPT", draft: current, replayed: true }, current, command.semanticState) : null;
  if (!replay) prepareRootRelationDraftSave(packet, current, { revisionId: snapshot.activePlanRevisionId, revisionNumber: snapshot.activePlanRevisionNumber });
  const policy = rootRelationDurablePolicy(command.semanticState);
  if (!policy.admitted) throw new TypeError(policy.code);
  if (replay) return replay;
  // No received transaction-bound C4 authority protocol exists yet. Never substitute a client token
  // or enable a service-role RPC to paper over that missing security boundary.
  throw new TypeError("N1_SQL_AUTHORITY_NOT_RECEIVED");
}
