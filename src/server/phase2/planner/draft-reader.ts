import "server-only";
import { snapshotWork } from "./snapshot-observation";
import { plannerMonth, plannerUuid } from "@/domain/phase2/planner/json";
import { emptyPlanSemanticState, parsePlanSemanticState } from "@/domain/phase2/planner/semantic-state";
import type { PlanSemanticStateV1 } from "@/domain/phase2/planner/semantic-state";
import type { PlannerDependencies } from "./apply";
import { evaluatePlanScenario, evaluateHistoricalPlanScenario, evaluatePlanMutation, evaluateDraftEconomicMargin } from "./preview";
import { historicalControlAdmission } from "./historical-control-admission";
import { assertRevisionEvidence } from "./revision-evidence";
/** Authenticated dependency supplies a single household. Reads only; drafts live in memory. */
async function preparePlannerDraft(deps: PlannerDependencies, householdId: string, targetMonth: string, rawDraft?: PlanSemanticStateV1) {
  const household = plannerUuid(householdId), month = plannerMonth(targetMonth);
  const [world, active] = await Promise.all([deps.readWorld(household, month), snapshotWork("Plan_Active", () => deps.repository.readActivePlan(household, month))]);
  if (world.baseline.householdId !== household || world.baseline.targetMonth !== month) throw new TypeError("PLANNER_WORLD_SCOPE_INVALID");
  if (active?.activeRevision) assertRevisionEvidence(active.activeRevision);
  const state = parsePlanSemanticState(rawDraft ?? active?.activeRevision?.semanticState ?? emptyPlanSemanticState(month));
  if (state.targetMonth !== month) throw new TypeError("PLANNER_DRAFT_MONTH_INVALID");
  const base = { expectedActiveRevisionId: active?.plan.activeRevisionId ?? null, expectedActiveRevisionNumber: active?.plan.activeRevisionNumber ?? 0 };
  const official = rawDraft === undefined ? active?.activeRevision : undefined;
  const historical = official ? historicalControlAdmission(official) : undefined;
  const prepared = deps.prepareWorld ? await snapshotWork("World_Preparation", () => deps.prepareWorld!(world, state, historical)) : world;
  return { world, prepared, active, state, base, official };
}

export async function readDraftEconomicMargin(deps: PlannerDependencies, householdId: string, targetMonth: string, draft: PlanSemanticStateV1) {
  const { prepared, state } = await preparePlannerDraft(deps, householdId, targetMonth, draft);
  return { ...evaluateDraftEconomicMargin(prepared, state), forecast: prepared.forecast };
}

export async function readPlannerDraft(deps: PlannerDependencies, householdId: string, targetMonth: string, rawDraft?: PlanSemanticStateV1) {
  const { world, prepared, active, state, base, official } = await preparePlannerDraft(deps, householdId, targetMonth, rawDraft);
  const preview = official ? evaluateHistoricalPlanScenario(prepared, official, base)
    : prepared.reconstruction ? evaluatePlanMutation(prepared, state, base) : evaluatePlanScenario(prepared, state, base);
  if (!rawDraft && active?.activeRevision && preview.compiledManifestDigest === active.activeRevision.compiledManifestDigest
    && preview.projectionDigest !== active.activeRevision.projectionEvidence.projectionDigest) throw new TypeError("PLANNER_IMMEDIATE_RELOAD_DIVERGED");
  return { world, prepared, active, state, base, preview };
}
