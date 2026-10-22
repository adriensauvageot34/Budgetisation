import 'server-only';
import {getAuthenticatedBootstrapClient} from '@/server/bootstrap/auth';
import {getCurrentHousehold} from '@/server/bootstrap/queries';
import type {PlannerDependencies} from '@/server/phase2/planner/apply';
import type {PlanningWorldFacts} from '@/domain/phase2/planner/compiler-contract';
import worldJson from './bar-world.json';
import {buildPlanningBaseline} from '@/server/phase2/planner/baseline';
import type {PlanningBaselineSources} from '@/server/phase2/planner/baseline-sources';
import {barReceptionEnabled,barGeometryReceptionEnabled} from './bar-reception-gate';
import {preparePlanningMobility} from '@/server/phase2/planner/prospective-mobility-pricing';
export {barReceptionEnabled} from './bar-reception-gate';

/** Real Supabase Auth, RLS and favourite persistence; financial facts are synthetic.
 * This reception host is unreachable in Production and cannot Apply a Plan.
 */
export async function barReceptionScope() {
  if(!barReceptionEnabled())throw new TypeError('BAR_RECEPTION_DISABLED');
  const {user,supabase}=await getAuthenticatedBootstrapClient();
  const geometry=barGeometryReceptionEnabled();
  let householdId='ba190000-0000-4000-8000-000000000001';
  if(geometry){
    if(user.email?.toLowerCase()!==process.env.BAR_GEOMETRY_AUTHOR?.toLowerCase())throw new TypeError('BAR_RECEPTION_DENIED');
    // Authentication only: never resolve or read this author's personal household.
  }else{
    if(user.app_metadata.bar_google_test!=='closure-20261019')throw new TypeError('BAR_RECEPTION_DENIED');
    const household=await getCurrentHousehold(supabase);
    if(!household||!['ba190000-0000-4000-8000-000000000001','ba190000-0000-4000-8000-000000000002'].includes(household.householdId))throw new TypeError('BAR_RECEPTION_DENIED');
    householdId=String(household.householdId);
  }
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
    // Real providers only after two public Google endpoints were explicitly
    // selected in this memory-only scene. Never geocode fictitious fixture bars.
    ...(geometry&&process.env.BAR_GEOMETRY_LIVE_GOOGLE==='1'?{prepareWorld:async(w:PlanningWorldFacts,s:Parameters<typeof preparePlanningMobility>[1])=>{
      const complete=s.contexts.some(c=>Object.values(c.slotSelections).some(slot=>Array.isArray(slot.items)&&slot.items.some((raw:unknown)=>{const item=raw as {kind?:string;optionKey?:string;routeEndpointBindings?:{origin?:unknown;destination?:unknown}};return item.kind==='MOBILITY_INTENT'&&item.optionKey==='car'&&!!item.routeEndpointBindings?.origin&&!!item.routeEndpointBindings?.destination;})));
      return complete?preparePlanningMobility(w,s):w;
    }}:geometry?{prepareWorld:async(w,s)=>preparePlanningMobility(w,s,{
      // Deterministic provider replies, only in this authenticated, memory-only
      // receipt. The ordinary Mobility owner computes all costs and statuses.
      route:{geocode:async()=>({latitude:43.61,longitude:3.9,source:'TOMTOM_GEOCODE'}),estimateCarRoute:async()=>({provider:'TOMTOM',distanceKm:'5',durationSeconds:600,liters:'0.34',segments:[{distanceKm:'5',liters:'0.34'}],geometry:[],geometryHash:null,hasToll:null,timeBasis:'TYPICAL_NO_DATE',sampleTimes:[],routeMethodRef:'synthetic-receipt-route@v1',consumptionModelRef:'synthetic-receipt-consumption@v1'})},
      fuel:{getReference:async()=>({pricePerLiter:'2.00',source:'FR_GOV_FUEL_INSTANT_V2',methodRef:'synthetic-receipt-fuel@v1',observedAt:'2026-10-01T10:00:00Z',calculatedAt:'2026-10-01T10:00:00Z',quality:'FRESH',sampleCount:3,radiusKm:15,minimum:'2.00',maximum:'2.00'})},
      toll:{estimateTolls:async()=>({status:'UNAVAILABLE',amount:null,currency:'EUR',provider:'HERE',methodRef:'synthetic-receipt-toll@v1',routeImportedFrom:'TOMTOM',geometryHash:null,components:[]})}
    })}:{}),
    readWorld:async(h,m)=>{if(h!==householdId||m!=='2026-11')throw new TypeError('BAR_RECEPTION_SCOPE_INVALID');return structuredClone(facts);},
    readMobilityOptions:async()=>({places:facts.mobilityFacts?.places??[],vehicle:facts.mobilityFacts?.vehicle??null,vehicleIsUnique:!!facts.mobilityFacts?.vehicle}),
    validateContextReferences:async(_h,refs)=>{if(refs.personIds.length||refs.placeIds.some(id=>!facts.mobilityFacts?.places.some(p=>p.placeId===id)))throw new TypeError('BAR_RECEPTION_REFERENCE_INVALID');}};
  return {userId:user.id,householdId,supabase,deps};
}
