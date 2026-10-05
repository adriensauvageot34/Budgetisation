import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { parsePlanRevisionRow, parsePlanRow, type PlanRevision, type StoredPlan } from "@/domain/phase2/planner/plan-contract";
import { plannerMonth, plannerUuid, plannerRecord, plannerKeys } from "@/domain/phase2/planner/json";

export type ApplyPlanRevision = Omit<PlanRevision, "planRevisionId" | "planId" | "revisionNumber" | "parentRevisionId" | "createdBy" | "createdAt">
  & Readonly<{ expectedActiveRevisionId: string | null; expectedActiveRevisionNumber: number }>;
/** Authenticated household client; the C2 Apply service is the only caller of the atomic writer. */
export interface PlanReadRepository {
  readActivePlan(householdId: string, targetMonth: string): Promise<StoredPlan | null>;
  readRevision(householdId: string, targetMonth: string, planId: string, revisionId: string): Promise<PlanRevision | null>;
}
export interface PlanRepository extends PlanReadRepository {
  readAppliedRequest(householdId: string, targetMonth: string, applyRequestId: string): Promise<PlanRevision | null>;
  applyRevision(input: ApplyPlanRevision): Promise<StoredPlan & { revision: PlanRevision; replayed: boolean }>;
}

/** C0's read-only API remains unchanged. */
export function createPlanRepository(client: SupabaseClient): PlanReadRepository {
  async function readRevision(householdId: string, targetMonth: string, planId: string, revisionId: string): Promise<PlanRevision | null> {
    const household = plannerUuid(householdId), month = plannerMonth(targetMonth), plan = plannerUuid(planId), revision = plannerUuid(revisionId);
    const { data, error } = await client.from("phase2_month_plan_revisions").select("*")
      .eq("household_id", household).eq("target_month", `${month}-01`).eq("plan_id", plan).eq("plan_revision_id", revision).maybeSingle();
    if (error) throw error;
    if (data === null) return null;
    const result = parsePlanRevisionRow(data);
    if (result.householdId !== household || result.targetMonth !== month || result.planId !== plan || result.planRevisionId !== revision)
      throw new TypeError("PLANNER_REVISION_SCOPE_INVALID");
    return result;
  }
  return { readRevision, async readActivePlan(householdId, targetMonth) {
    const household = plannerUuid(householdId), month = plannerMonth(targetMonth);
    const { data, error } = await client.from("phase2_month_plans").select("*")
      .eq("household_id", household).eq("target_month", `${month}-01`).maybeSingle();
    if (error) throw error;
    if (data === null) return null;
    const plan = parsePlanRow(data);
    if (plan.householdId !== household || plan.targetMonth !== month) throw new TypeError("PLANNER_PLAN_SCOPE_INVALID");
    if (plan.activeRevisionId === null) return { plan, activeRevision: null };
    const activeRevision = await readRevision(household, month, plan.planId, plan.activeRevisionId);
    if (!activeRevision || activeRevision.revisionNumber !== plan.activeRevisionNumber) throw new TypeError("PLANNER_ACTIVE_REVISION_MISSING");
    // Revisions are immutable: a concurrent Apply cannot invalidate the pointer captured by this read.
    return { plan, activeRevision };
  } };
}

/** C2's dedicated authenticated RPC capability. */
export function createPlanApplyRepository(client: SupabaseClient): PlanRepository {
  return { ...createPlanRepository(client), async readAppliedRequest(householdId, targetMonth, applyRequestId) {
    const household = plannerUuid(householdId), month = plannerMonth(targetMonth), request = plannerUuid(applyRequestId);
    const { data, error } = await client.from("phase2_month_plan_revisions").select("*")
      .eq("household_id", household).eq("target_month", `${month}-01`).eq("apply_request_id", request).maybeSingle();
    if (error) throw error;
    if (data === null) return null;
    const result = parsePlanRevisionRow(data);
    if (result.householdId !== household || result.targetMonth !== month || result.applyRequestId !== request) throw new TypeError("PLANNER_REQUEST_SCOPE_INVALID");
    return result;
  }, async applyRevision(input) {
    const household = plannerUuid(input.householdId), month = plannerMonth(input.targetMonth);
    const { data, error } = await client.rpc("apply_phase2_month_plan_v1", {
      p_household_id: household, p_target_month: `${month}-01`, p_expected_active_revision_id: input.expectedActiveRevisionId,
      p_expected_active_revision_number: input.expectedActiveRevisionNumber, p_apply_request_id: input.applyRequestId,
      p_baseline_digest: input.baselineDigest, p_baseline_snapshot: input.baselineSnapshot, p_semantic_state: input.semanticState,
      p_semantic_state_digest: input.semanticStateDigest, p_change_set: input.changeSet, p_compiled_manifest: input.compiledManifest,
      p_compiled_manifest_digest: input.compiledManifestDigest, p_projection_evidence: input.projectionEvidence,
      p_preview_digest: input.previewDigest, p_compiler_version: input.compilerVersion, p_model_versions: input.modelVersions });
    if (error) throw error;
    const result = plannerRecord(data); plannerKeys(result, ["plan", "revision", "replayed"]);
    if (typeof result.replayed !== "boolean") throw new TypeError("PLANNER_RPC_RESULT_INVALID");
    const plan = parsePlanRow(result.plan), revision = parsePlanRevisionRow(result.revision);
    if (plan.householdId !== household || plan.targetMonth !== month || revision.householdId !== household || revision.targetMonth !== month
      || revision.planId !== plan.planId || revision.applyRequestId !== input.applyRequestId
      || revision.parentRevisionId !== input.expectedActiveRevisionId || revision.revisionNumber !== input.expectedActiveRevisionNumber + 1
      || !result.replayed && (plan.activeRevisionId !== revision.planRevisionId || plan.activeRevisionNumber !== revision.revisionNumber))
      throw new TypeError("PLANNER_RPC_SCOPE_INVALID");
    return { plan, revision, activeRevision: plan.activeRevisionId === revision.planRevisionId ? revision : null, replayed: result.replayed };
  } };
}
