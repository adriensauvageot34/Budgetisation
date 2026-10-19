import 'server-only';
import {getAuthenticatedBootstrapClient} from '@/server/bootstrap/auth';
import {getCurrentHousehold} from '@/server/bootstrap/queries';
import type {PlannerDependencies} from '@/server/phase2/planner/apply';
import type {PlanningWorldFacts} from '@/domain/phase2/planner/compiler-contract';
import worldJson from './bar-world.json';
import {buildPlanningBaseline} from '@/server/phase2/planner/baseline';
import type {PlanningBaselineSources} from '@/server/phase2/planner/baseline-sources';
import {barReceptionEnabled} from './bar-reception-gate';
export {barReceptionEnabled} from './bar-reception-gate';

/** Real Supabase Auth, RLS and favourite persistence; financial facts are synthetic.
 * This reception host is unreachable in Production and cannot Apply a Plan.
 */
export async function barReceptionScope() {
  if(!barReceptionEnabled())throw new TypeError('BAR_RECEPTION_DISABLED');
  const {user,supabase}=await getAuthenticatedBootstrapClient();
  if(user.app_metadata.bar_google_test!=='closure-20261019')throw new TypeError('BAR_RECEPTION_DENIED');
  const household=await getCurrentHousehold(supabase);
  if(!household||!['ba190000-0000-4000-8000-000000000001','ba190000-0000-4000-8000-000000000002'].includes(household.householdId))throw new TypeError('BAR_RECEPTION_DENIED');
  const householdId=String(household.householdId);
  const rebase=(value:unknown):unknown=>Array.isArray(value)?value.map(rebase):value&&typeof value==='object'
    ?Object.fromEntries(Object.entries(value).map(([k,v])=>[k,k==='householdId'?householdId:rebase(v)])):value;
  const world=rebase(worldJson) as PlanningWorldFacts & {sources:PlanningBaselineSources};
  const facts={...world,baseline:buildPlanningBaseline(world.sources)};
  if(facts.mobilityFacts)facts.mobilityFacts={...facts.mobilityFacts,places:[...facts.mobilityFacts.places,{
    placeId:'ba190000-0000-4000-8000-000000009999',
    name:'Bar fictif des Voyageurs et de la Très Longue Promenade des Démonstrations',
    commune:'Ville fictive',nature:'Commerce',usage:'Bar',subtype:null,privatePlace:false,relationships:[],
    visits12Months:0,lastVisitDate:null,address:null
  }]};
  const deps:PlannerDependencies={repository:{readActivePlan:async()=>null,readRevision:async()=>null,readAppliedRequest:async()=>null,applyRevision:async()=>{throw new TypeError('BAR_RECEPTION_APPLY_FORBIDDEN');}},
    readWorld:async(h,m)=>{if(h!==householdId||m!=='2026-11')throw new TypeError('BAR_RECEPTION_SCOPE_INVALID');return structuredClone(facts);},
    readMobilityOptions:async()=>({places:facts.mobilityFacts?.places??[],vehicle:facts.mobilityFacts?.vehicle??null}),
    validateContextReferences:async(_h,refs)=>{if(refs.personIds.length||refs.placeIds.some(id=>!facts.mobilityFacts?.places.some(p=>p.placeId===id)))throw new TypeError('BAR_RECEPTION_REFERENCE_INVALID');}};
  return {userId:user.id,householdId,supabase,deps};
}
