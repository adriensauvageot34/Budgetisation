import "server-only";
import type { PlanningWorldFacts, PlanScenarioPreview } from "@/domain/phase2/planner/compiler-contract";
import type { StoredPlan } from "@/domain/phase2/planner/plan-contract";
import { plannerDigest, plannerMonth, plannerUuid } from "@/domain/phase2/planner/json";
import type { MonthInputs, MonthScenario } from "../month-scenario";
import { deriveMonthScenario } from "../month-scenario";
import type { PlannedExpense } from "../planned-expenses";
import type { MonthChoiceContext } from "../month-choices";
import type { EffectiveMonthDependencies, DirectMonthFacts } from "./effective-month-scenario";
import { assertRevisionEvidence } from "./revision-evidence";
import { evaluateHistoricalPlanScenario } from "./preview";
import { historicalControlAdmission } from "./historical-control-admission";
import { slotReferenceKeys } from "./plan-slot-resolver";
import type { CompiledPlanSlot } from "@/domain/phase2/planner/compiler-contract";
import type { PlanReadRepository } from "./repository";

/** Request-local simulation boundary. It substitutes prospective inputs, never observed facts,
 * and never mutates the immutable semantic state. No cross-request World reuse. */
export function planEffectiveSimulation(stored: StoredPlan, world: PlanningWorldFacts, current: PlanScenarioPreview,
  repository: PlanReadRepository) {
  const revision = stored.activeRevision!;
  const cache = new Map<string, PlanScenarioPreview>();
  const key = (inputs: MonthInputs, expenses: readonly PlannedExpense[]) => plannerDigest({inputs,expenses});
  cache.set(key(world.monthInputs, world.externalIntents), current);
  const evaluate = (inputs = world.monthInputs, expenses = world.externalIntents) => {
    if (expenses.some(e => e.householdId !== world.baseline.householdId || e.targetMonth !== world.baseline.targetMonth))
      throw new TypeError("PLANNED_EFFECTIVE_SCOPE_INVALID");
    const digest = key(inputs, expenses);
    let result = cache.get(digest);
    if (!result) {
      result = evaluateHistoricalPlanScenario({...world,monthInputs:inputs,externalIntents:expenses}, revision,
        {expectedActiveRevisionId:revision.planRevisionId,expectedActiveRevisionNumber:revision.revisionNumber}, false);
      cache.set(digest,result);
    }
    return {scenario:result.scenario,economicKnown:result.projection.plan.economicMonthEndRemainder !== null,preview:result};
  };
  const owned = (revision.compiledManifest.planSlots as unknown as readonly CompiledPlanSlot[]).filter(slot=>slot.owned);
  const ownership = {categoryKeys:[...new Set(owned.flatMap(slotReferenceKeys))],
    savingsIds:owned.filter(slot=>slot.role==="SAVINGS").map(slot=>slot.baseline.slotIdentityKey.slice(8))};
  const baseDigest = plannerDigest({revisionId:revision.planRevisionId,manifest:current.compiledManifestDigest});
  // Monthly undo already hashes inputs and expenses. Keep its authority stamp
  // stable across that explicit input change, while binding the immutable Plan.
  const choiceAuthorityDigest = plannerDigest(JSON.parse(JSON.stringify({revisionId:revision.planRevisionId,
    baselineSources:world.baseline.sourceRefs.filter(ref=>ref.owner!=="phase2_month_inputs"&&ref.owner!=="phase2_planned_expenses"),modelVersions:world.modelVersions,
    costQuotes:world.costQuotes,mobilityFacts:world.mobilityFacts??null})));
  const assertCurrent = async () => {
    const pointer = repository.readActivePointer ? await repository.readActivePointer(revision.householdId,revision.targetMonth)
      : (await repository.readActivePlan(revision.householdId,revision.targetMonth))?.plan;
    if (!pointer || pointer.activeRevisionId !== revision.planRevisionId || pointer.activeRevisionNumber !== revision.revisionNumber)
      throw new TypeError("PLANNED_EFFECTIVE_PLAN_STALE");
  };
  return {owner:"PLAN_V1" as const,revisionId:revision.planRevisionId,baseDigest,choiceAuthorityDigest,ownership,
    forecast:world.forecast,inputs:world.monthInputs,expenses:world.externalIntents,asOf:world.asOfDate,
    evaluate,assertCurrent,
    assertIndependent(id:string) {
      if(current.compiled.contexts.some(c=>c.externalIntentId===id)||current.compiled.journeys.some(j=>j.externalExpenseId===id))
        throw new TypeError("PLANNED_EFFECTIVE_LINKED_INTENTION");
    },
    assertExpected(expected?:string|null,digest?:string) {
      if(expected !== revision.planRevisionId || digest !== undefined && digest !== baseDigest)
        throw new TypeError("PLANNED_EFFECTIVE_PLAN_STALE");
    }};
}

export async function loadEffectiveMonthSimulation(deps: EffectiveMonthDependencies, householdId:string, targetMonth:string,
  direct:Omit<DirectMonthFacts,"externalIntents"> & {externalIntents:readonly PlannedExpense[]}) {
  const household=plannerUuid(householdId),month=plannerMonth(targetMonth),stored=await deps.repository.readActivePlan(household,month);
  if(direct.forecast.meta.targetMonth!==month)throw new TypeError("PLANNED_EFFECTIVE_SCOPE_INVALID");
  if(!stored?.activeRevision) return {owner:"DIRECT_V2" as const,revisionId:null,baseDigest:null,
    ownership:{categoryKeys:[] as string[],savingsIds:[] as string[]},forecast:direct.forecast,inputs:direct.monthInputs,
    expenses:direct.externalIntents,asOf:direct.asOfDate,
    evaluate(inputs=direct.monthInputs,expenses=direct.externalIntents):{scenario:MonthScenario;economicKnown:boolean;preview:null} {
      if(expenses.some(e=>e.householdId!==household||e.targetMonth!==month))throw new TypeError("PLANNED_EFFECTIVE_SCOPE_INVALID");
      return {scenario:deriveMonthScenario(direct.forecast,inputs,null,direct.asOfDate,expenses),economicKnown:true,preview:null};
    },
    assertExpected(expected?:string|null) {if(expected)throw new TypeError("PLANNED_EFFECTIVE_PLAN_STALE");},
    assertIndependent(_id:string) {},
    async assertCurrent(){
      const pointer=deps.repository.readActivePointer?await deps.repository.readActivePointer(household,month):(await deps.repository.readActivePlan(household,month))?.plan;
      if(pointer?.activeRevisionId)throw new TypeError("PLANNED_EFFECTIVE_PLAN_STALE");
    }};
  const revision=stored.activeRevision;
  if(stored.plan.householdId!==household||stored.plan.targetMonth!==month||revision.householdId!==household||revision.targetMonth!==month
    ||revision.planId!==stored.plan.planId||revision.planRevisionId!==stored.plan.activeRevisionId||revision.revisionNumber!==stored.plan.activeRevisionNumber)
    throw new TypeError("PLANNED_EFFECTIVE_SCOPE_INVALID");
  assertRevisionEvidence(revision);
  const read=await deps.readWorld(household,month);
  if(read.baseline.householdId!==household||read.baseline.targetMonth!==month||read.forecast.meta.targetMonth!==month)throw new TypeError("PLANNED_EFFECTIVE_SCOPE_INVALID");
  const world=deps.prepareWorld?await deps.prepareWorld(read,revision.semanticState,historicalControlAdmission(revision)):read;
  const current=evaluateHistoricalPlanScenario(world,revision,{expectedActiveRevisionId:revision.planRevisionId,expectedActiveRevisionNumber:revision.revisionNumber});
  if(current.compiledManifestDigest===revision.compiledManifestDigest&&current.projectionDigest!==revision.projectionEvidence.projectionDigest)
    throw new TypeError("PLANNER_IMMEDIATE_RELOAD_DIVERGED");
  return planEffectiveSimulation(stored,world,current,deps.repository);
}
export type EffectiveMonthSimulation = Awaited<ReturnType<typeof loadEffectiveMonthSimulation>>;
export function effectiveChoiceContext(simulation:EffectiveMonthSimulation):MonthChoiceContext {
  return {forecast:simulation.forecast,inputs:simulation.inputs,expenses:simulation.expenses,asOf:simulation.asOf,
    ...(simulation.owner==="PLAN_V1"?{effective:{revisionId:simulation.revisionId,authorityDigest:simulation.choiceAuthorityDigest,ownership:simulation.ownership,
      derive:(inputs:MonthInputs)=>{
        const result=simulation.evaluate(inputs);
        if(!result.economicKnown)throw new TypeError("PLANNED_EFFECTIVE_PROJECTION_UNKNOWN");
        return result.scenario;
      }}}:{})};
}
