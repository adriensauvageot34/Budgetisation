import "server-only";
import { plannerMonth, plannerUuid } from "@/domain/phase2/planner/json";
import type { PlannerDependencies } from "./apply";
import type { MonthForecastSnapshot } from "../month-forecast-snapshot";
import type { PlannedExpenseScenarioEntry } from "../planned-expenses";
import { deriveMonthScenario, type MonthInputs } from "../month-scenario";
import { evaluateHistoricalPlanScenario } from "./preview";
import { historicalControlAdmission } from "./historical-control-admission";
import { assertRevisionEvidence } from "./revision-evidence";
import { officialPlanComparison } from "./official-comparison";
import type { ActivePlanPointer } from "@/domain/phase2/planner/official-comparison-contract";
import { planEffectiveSimulation } from "./effective-simulation";

export type DirectMonthFacts = Readonly<{ forecast: MonthForecastSnapshot; monthInputs: MonthInputs;
  externalIntents: readonly PlannedExpenseScenarioEntry[]; asOfDate: string }>;
export type EffectiveMonthDependencies = PlannerDependencies & Readonly<{
  readDirectWorld(householdId: string, targetMonth: string): Promise<DirectMonthFacts>;
  captureSimulation?(simulation:ReturnType<typeof planEffectiveSimulation>):void }>;
/** Applied-month owner shared by Composer and the monthly view. With no active Plan, invoke the
 * existing V2 flow exactly, without requiring C1 owners or altering its inputs. */
export async function resolveEffectiveMonthScenario(deps: EffectiveMonthDependencies, householdId: string, targetMonth: string) {
  const household = plannerUuid(householdId), month = plannerMonth(targetMonth);
  const stored = await deps.repository.readActivePlan(household, month);
  if (!stored?.activeRevision) {
    const direct = await deps.readDirectWorld(household, month);
    if (direct.forecast.meta.targetMonth !== month) throw new TypeError("PLANNER_DIRECT_SCOPE_INVALID");
    return { owner: "DIRECT_V2" as const, scenario: deriveMonthScenario(direct.forecast, direct.monthInputs, null,
      direct.asOfDate, direct.externalIntents), revision: null, preview: null, semanticState: null, projection: null,
      evidenceStatus: "NOT_APPLICABLE" as const, comparison: null };
  }
  const revision = stored.activeRevision;
  if (stored.plan.householdId !== household || stored.plan.targetMonth !== month || revision.householdId !== household
    || revision.targetMonth !== month || revision.planId !== stored.plan.planId
    || revision.planRevisionId !== stored.plan.activeRevisionId || revision.revisionNumber !== stored.plan.activeRevisionNumber)
    throw new TypeError("PLANNER_REVISION_SCOPE_INVALID");
  assertRevisionEvidence(revision);
  const world = await deps.readWorld(household, month);
  if (world.baseline.householdId !== household) throw new TypeError("PLANNER_WORLD_HOUSEHOLD_INVALID");
  const prepared = deps.prepareWorld ? await deps.prepareWorld(world, revision.semanticState, historicalControlAdmission(revision)) : world;
  const preview = evaluateHistoricalPlanScenario(prepared, revision, { expectedActiveRevisionId: stored.plan.activeRevisionId,
    expectedActiveRevisionNumber: stored.plan.activeRevisionNumber });
  const evidence = revision.projectionEvidence;
  const sameAuthorities = preview.compiledManifestDigest === revision.compiledManifestDigest;
  if (sameAuthorities && preview.projectionDigest !== evidence.projectionDigest) throw new TypeError("PLANNER_IMMEDIATE_RELOAD_DIVERGED");
  let pointer: ActivePlanPointer | null = null, pointerAvailable = true;
  try {
    // Older adapters remain compatible. The runtime repository uses a single narrow SELECT.
    pointer = deps.repository.readActivePointer ? await deps.repository.readActivePointer(household, month)
      : (await deps.repository.readActivePlan(household, month))?.plan ?? null;
  } catch (error) {
    if (error instanceof TypeError) throw error;
    pointerAvailable = false;
  }
  const evidenceStatus = sameAuthorities ? "EXACT" as const : "CHANGED_AUTHORITIES" as const;
  deps.captureSimulation?.(planEffectiveSimulation(stored,prepared,preview,deps.repository));
  return { owner: "PLAN_V1" as const, scenario: preview.scenario, revision, preview,
    semanticState: revision.semanticState, projection: preview.projection,
    evidenceStatus, comparison: officialPlanComparison(revision, preview, prepared, evidenceStatus, pointer, pointerAvailable) };
}
