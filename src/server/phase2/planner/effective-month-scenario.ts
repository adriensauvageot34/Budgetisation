import "server-only";
import { plannerMonth, plannerUuid } from "@/domain/phase2/planner/json";
import type { PlannerDependencies } from "./apply";
import type { MonthForecastSnapshot } from "../month-forecast-snapshot";
import type { PlannedExpenseScenarioEntry } from "../planned-expenses";
import { deriveMonthScenario, type MonthInputs } from "../month-scenario";
import { evaluatePlanScenario } from "./preview";
import { assertRevisionEvidence } from "./revision-evidence";

export type DirectMonthFacts = Readonly<{ forecast: MonthForecastSnapshot; monthInputs: MonthInputs;
  externalIntents: readonly PlannedExpenseScenarioEntry[]; asOfDate: string }>;
export type EffectiveMonthDependencies = PlannerDependencies & Readonly<{
  readDirectWorld(householdId: string, targetMonth: string): Promise<DirectMonthFacts> }>;
/** Final headless owner. Routes/UI cutover is a later lot. With no active Plan, invoke the
 * existing V2 flow exactly, without requiring C1 owners or altering its inputs. */
export async function resolveEffectiveMonthScenario(deps: EffectiveMonthDependencies, householdId: string, targetMonth: string) {
  const household = plannerUuid(householdId), month = plannerMonth(targetMonth);
  const stored = await deps.repository.readActivePlan(household, month);
  if (!stored?.activeRevision) {
    const direct = await deps.readDirectWorld(household, month);
    if (direct.forecast.meta.targetMonth !== month) throw new TypeError("PLANNER_DIRECT_SCOPE_INVALID");
    return { owner: "DIRECT_V2" as const, scenario: deriveMonthScenario(direct.forecast, direct.monthInputs, null,
      direct.asOfDate, direct.externalIntents), revision: null, preview: null, semanticState: null, projection: null,
      evidenceStatus: "NOT_APPLICABLE" as const };
  }
  const world = await deps.readWorld(household, month), revision = stored.activeRevision;
  assertRevisionEvidence(revision);
  if (world.baseline.householdId !== household) throw new TypeError("PLANNER_WORLD_HOUSEHOLD_INVALID");
  const prepared = deps.prepareWorld ? await deps.prepareWorld(world, revision.semanticState) : world;
  const preview = evaluatePlanScenario(prepared, revision.semanticState, { expectedActiveRevisionId: stored.plan.activeRevisionId,
    expectedActiveRevisionNumber: stored.plan.activeRevisionNumber });
  const evidence = revision.projectionEvidence;
  const sameAuthorities = preview.compiledManifestDigest === revision.compiledManifestDigest;
  if (sameAuthorities && preview.projectionDigest !== evidence.projectionDigest) throw new TypeError("PLANNER_IMMEDIATE_RELOAD_DIVERGED");
  return { owner: "PLAN_V1" as const, scenario: preview.scenario, revision, preview,
    semanticState: revision.semanticState, projection: preview.projection,
    evidenceStatus: sameAuthorities ? "EXACT" as const : "CHANGED_AUTHORITIES" as const };
}
