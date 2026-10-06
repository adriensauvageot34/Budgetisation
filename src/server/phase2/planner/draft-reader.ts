import "server-only";
import { plannerMonth, plannerUuid } from "@/domain/phase2/planner/json";
import { emptyPlanSemanticState, parsePlanSemanticState } from "@/domain/phase2/planner/semantic-state";
import type { PlanSemanticStateV1 } from "@/domain/phase2/planner/semantic-state";
import type { PlannerDependencies } from "./apply";
import { evaluatePlanScenario } from "./preview";
import { assertRevisionEvidence } from "./revision-evidence";
/** Authenticated dependency supplies a single household. Reads only; drafts live in memory. */
export async function readPlannerDraft(deps: PlannerDependencies, householdId: string, targetMonth: string, rawDraft?: PlanSemanticStateV1) {
  const household = plannerUuid(householdId), month = plannerMonth(targetMonth);
  const [world, active] = await Promise.all([deps.readWorld(household, month), deps.repository.readActivePlan(household, month)]);
  if (world.baseline.householdId !== household || world.baseline.targetMonth !== month) throw new TypeError("PLANNER_WORLD_SCOPE_INVALID");
  if (active?.activeRevision) assertRevisionEvidence(active.activeRevision);
  const state = parsePlanSemanticState(rawDraft ?? active?.activeRevision?.semanticState ?? emptyPlanSemanticState(month));
  if (state.targetMonth !== month) throw new TypeError("PLANNER_DRAFT_MONTH_INVALID");
  const base = { expectedActiveRevisionId: active?.plan.activeRevisionId ?? null, expectedActiveRevisionNumber: active?.plan.activeRevisionNumber ?? 0 };
  const prepared = deps.prepareWorld ? await deps.prepareWorld(world, state) : world;
  const preview = evaluatePlanScenario(prepared, state, base);
  if (!rawDraft && active?.activeRevision && preview.compiledManifestDigest === active.activeRevision.compiledManifestDigest
    && preview.projectionDigest !== active.activeRevision.projectionEvidence.projectionDigest) throw new TypeError("PLANNER_IMMEDIATE_RELOAD_DIVERGED");
  return { world, prepared, active, state, base, preview };
}
