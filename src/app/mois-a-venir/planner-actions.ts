"use server";

import { plannerMonth } from "@/domain/phase2/planner/json";
import { parsePlanSemanticState } from "@/domain/phase2/planner/semantic-state";
import type { PlanSemanticStateV1 } from "@/domain/phase2/planner/semantic-state";
import type { PlannerApplyCommand } from "@/domain/phase2/planner/compiler-contract";
import { authorizedPlanner } from "@/server/phase2/planner/runtime";
import { readMonthComposer as readComposer } from "@/server/phase2/planner/read-model";
import { previewPlanScenario as previewScenario, applyPlanScenario as applyScenario } from "@/server/phase2/planner/apply";
import { readPlanBalanceSuggestions as readSuggestions, acceptPlanBalanceSuggestion as acceptSuggestion } from "@/server/phase2/planner/balance-assistant";

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
