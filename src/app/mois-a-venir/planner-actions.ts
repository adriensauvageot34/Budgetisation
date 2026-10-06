"use server";

import { parseInstant } from "@/core/time";
import { plannerMonth } from "@/domain/phase2/planner/json";
import { parsePlanSemanticState } from "@/domain/phase2/planner/semantic-state";
import type { PlanSemanticStateV1 } from "@/domain/phase2/planner/semantic-state";
import type { PlannerApplyCommand } from "@/domain/phase2/planner/compiler-contract";
import { getAuthenticatedBootstrapClient } from "@/server/bootstrap/auth";
import { getBootstrapContext } from "@/server/bootstrap/context";
import { createAuthorizedRuntimeContext } from "@/server/canonical/context";
import { createCanonicalReadClient } from "@/server/canonical/client";
import { CanonicalRepository } from "@/server/canonical/repository";
import { createPlannerDependencies } from "@/server/phase2/planner/world-reader";
import { readMonthComposer as readComposer } from "@/server/phase2/planner/read-model";
import { previewPlanScenario as previewScenario, applyPlanScenario as applyScenario } from "@/server/phase2/planner/apply";
import { readPlanBalanceSuggestions as readSuggestions, acceptPlanBalanceSuggestion as acceptSuggestion } from "@/server/phase2/planner/balance-assistant";

async function authorizedPlanner() {
  const { supabase, user } = await getAuthenticatedBootstrapClient();
  const bootstrap = await getBootstrapContext();
  if (bootstrap.user.id !== user.id) throw new TypeError("PLANNER_SESSION_CHANGED");
  const now = new Date().toISOString();
  const context = createAuthorizedRuntimeContext(bootstrap, parseInstant(now));
  return { householdId: String(context.householdId),
    deps: createPlannerDependencies(new CanonicalRepository(createCanonicalReadClient(), context), supabase, () => now) };
}
function draftForMonth(targetMonth: string, raw: PlanSemanticStateV1) {
  const month = plannerMonth(targetMonth), state = parsePlanSemanticState(raw);
  if (state.targetMonth !== month) throw new TypeError("PLANNER_DRAFT_MONTH_INVALID");
  return state;
}
/** Household is derived from the authenticated server context, never client supplied. */
export async function readMonthComposer(targetMonth: string, draft?: PlanSemanticStateV1) {
  const month = plannerMonth(targetMonth), state = draft ? draftForMonth(month, draft) : undefined;
  const { deps, householdId } = await authorizedPlanner();
  return readComposer(deps, householdId, month, state);
}
export async function previewPlanScenario(targetMonth: string, draft: PlanSemanticStateV1) {
  const state = draftForMonth(targetMonth, draft), { deps, householdId } = await authorizedPlanner();
  return previewScenario(deps, householdId, state);
}
export async function applyPlanScenario(targetMonth: string, draft: PlanSemanticStateV1, command: PlannerApplyCommand) {
  const state = draftForMonth(targetMonth, draft), { deps, householdId } = await authorizedPlanner();
  return applyScenario(deps, householdId, state, command);
}
export async function readPlanBalanceSuggestions(targetMonth: string, draft?: PlanSemanticStateV1) {
  const month = plannerMonth(targetMonth), state = draft ? draftForMonth(month, draft) : undefined;
  const { deps, householdId } = await authorizedPlanner();
  return readSuggestions(deps, householdId, month, state);
}
export async function acceptPlanBalanceSuggestion(targetMonth: string, draft: PlanSemanticStateV1, candidateSetDigest: string, candidateId: string) {
  const state = draftForMonth(targetMonth, draft), { deps, householdId } = await authorizedPlanner();
  return acceptSuggestion(deps, householdId, state.targetMonth, state, candidateSetDigest, candidateId);
}
