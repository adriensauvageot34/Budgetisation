import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { parsePlanRevisionRow, parsePlanRow, type PlanRevision, type StoredPlan } from "@/domain/phase2/planner/plan-contract";
import { plannerMonth, plannerUuid } from "@/domain/phase2/planner/json";

/** Read with the authenticated household client. No writer is exposed until C2's validated Apply service. */
export interface PlanRepository {
  readActivePlan(householdId: string, targetMonth: string): Promise<StoredPlan | null>;
  readRevision(householdId: string, targetMonth: string, planId: string, revisionId: string): Promise<PlanRevision | null>;
}

export function createPlanRepository(client: SupabaseClient): PlanRepository {
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
