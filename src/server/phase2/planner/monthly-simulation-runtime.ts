import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { PlannedExpense } from "../planned-expenses";
import type { DirectMonthFacts } from "./effective-month-scenario";
import { createPlanApplyRepository } from "./repository";
import { authorizedPlanner } from "./runtime";
import { loadEffectiveMonthSimulation } from "./effective-simulation";

/** The existing light monthly readers are retained when there is no Plan.
 * Authenticated Canonical/World is constructed lazily only on the PLAN_V1 branch. */
export function monthlyEffectiveSimulation(client:SupabaseClient,household:string,month:string,
  direct:Omit<DirectMonthFacts,"externalIntents"> & {externalIntents:readonly PlannedExpense[]}) {
  let runtime:ReturnType<typeof authorizedPlanner>|undefined;
  const planner=()=>runtime??=authorizedPlanner().then(value=>{
    if(value.householdId!==household)throw new TypeError("PLANNED_EFFECTIVE_SCOPE_INVALID");return value;
  });
  return loadEffectiveMonthSimulation({repository:createPlanApplyRepository(client),
    readWorld:async(h,m)=>(await planner()).deps.readWorld(h,m),
    prepareWorld:async(w,s)=>{const deps=(await planner()).deps;return deps.prepareWorld?deps.prepareWorld(w,s):w;},
    readDirectWorld:async()=>direct},household,month,direct);
}
