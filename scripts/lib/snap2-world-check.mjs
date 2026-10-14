// Actual World/Baseline/Compiler/Finance with unrelated owners returning fixtures.
import assert from 'node:assert/strict';
import {performance} from 'node:perf_hooks';
import {require} from './phase2-ts-loader.mjs';
import {fixture,state,householdId,nightMonth,weekendMonth,externalMonth} from '../fixtures/planner-headless.mjs';
import {uuid} from '../fixtures/canonical-p14-p3.mjs';
import {nativeSourceClient} from './snap2-native-postgres.mjs';
const {CanonicalRepository}=require('@/server/canonical/repository');
const {plannerDigest}=require('@/domain/phase2/planner/json');
export async function checkNativeWorld({admin,port,data,scope,key}){
 const world=fixture(),sources=world.sources;let live=structuredClone(world.monthInputs),planned=[];
 sources.evidence.bankObservations=sources.evidence.bankObservations.map(o=>{
  const entry=sources.evidence.history.economicEntries.find(e=>e.operationId===o.id);
  return {...o,date:entry.date,amount:entry.amount,direction:'OUT',merchant:entry.merchant};});
 require('@/server/phase2/live-month-forecast').loadMonthForecastAuthorities=async()=>({publication:{publication_id:world.forecast.meta.sourcePublicationId,
  source_revision:world.forecast.meta.sourceRevision,published_analytics_revision:world.forecast.meta.analyticsRevision},background:{food:sources.food}});
 require('@/server/phase2/month-planning-read').readPlanningMonthForecast=async()=>structuredClone(world.forecast);
 require('@/server/phase2/month-prediction-evidence').readMonthPredictionEvidence=async()=>sources.evidence;
 require('@/server/phase2/month-inputs').readMonthInputs=async()=>({inputs:structuredClone(live)});
 require('@/server/phase2/planned-expenses').readPlannedExpenses=async()=>structuredClone(planned);
 require('@/server/phase2/planned-context').readPlannedContextOptions=async()=>({places:world.mobilityFacts.places,vehicle:world.mobilityFacts.vehicle});
 require('@/server/analytics/global-v2-persona-signals').resolveGlobalPersonaProductObservations=async()=>[];
 const {createPlannerDependencies}=require('@/server/phase2/planner/world-reader');
 const {handleComposerRequest}=require('@/server/phase2/planner/composer-service');
 const empty=()=>{const q={select:()=>q,eq:()=>q,lte:()=>q,order:()=>q,range:()=>q,in:()=>q,then:(a,b)=>Promise.resolve({data:[],error:null}).then(a,b)};return q;};
 const request=async(enabled,draft=state(),kind='READ',command)=>{
  process.env.COMPOSER_P14_SNAP1_ACTIVITY_HISTORY=enabled?'1':'0';const source=nativeSourceClient(admin),before=port.reader.metrics.length;
  const client={from:table=>['needs','person_habit_assertions'].includes(table)?empty():source.client.from(table)};
  const repo=new CanonicalRepository(client,data.context);
  repo.loadMobilityLegFacts=async()=>[];repo.loadPurchaseAwareCanonical=async()=>({status:'PASS',facts:[]});
  repo.loadPlaceVisits=async()=>[];repo.loadPersonDays=async()=>[];repo.loadLifeEventLocalizationRows=async()=>[];
  const deps=createPlannerDependencies(repo,client,()=>data.context.asOf,port.store);
  let loaded;const original=deps.readComposerWorld;
  deps.readComposerWorld=async(...args)=>{loaded=await original(...args);return loaded;};
  deps.repository={readActivePlan:async()=>null,readAppliedRequest:async()=>null,applyRevision:async()=>{throw Error('SNAP2_APPLY_FORBIDDEN');}};
  const at=performance.now(),result=await handleComposerRequest(deps,householdId,{kind,targetMonth:'2026-11',draft,sequence:0,...(command?{command}:{})});
  if(kind!=='APPLY'&&kind!=='CHECK_APPLY')assert.equal(result.ok,true,result.code);
  return {result,ms:performance.now()-at,reads:source.calls.length+port.reader.metrics.length-before,
   raw:source.calls.length,inspect:port.reader.metrics.length-before,slot:loaded?.baseline.slots.find(s=>s.simpleAuthority?.domain==='groceries')?.slotIdentityKey,
   digest:plannerDigest(JSON.parse(JSON.stringify(result)))};
 };
 const generation=(await port.store.inspect(scope,key)).generation,checks=[],benchmarks=[];
 const parity=async(draft=state())=>{const a=await request(false,draft),b=await request(true,draft);
  assert.deepEqual(b.result,a.result);assert.equal(b.inspect,1);assert.equal(b.raw,7);return b;};
 for(const draft of [state(),nightMonth().semantic,weekendMonth(false).semantic,weekendMonth(true).semantic])await parity(draft);
 checks.push('World/Baseline/M7/Compiler/Finance: four drafts, exact models and digests');
 const a=await parity();live.safetyReserve='71.00';const b=await parity();assert.notEqual(a.digest,b.digest);
 live.declaredResources['benefit:swile']='17.00';world.forecast.meta.analyticsRevision+=1;const changed=await parity();assert.notEqual(b.digest,changed.digest);
 planned=externalMonth().world.externalIntents;const external=await parity();assert.notEqual(external.digest,changed.digest);planned=[];
 checks.push('MonthInputs / declared Wallet resource / Forecast publication / PlannedExpense change; artifact generation unchanged');
 assert.ok(changed.slot);
 const edited=state([{decisionId:uuid(9800),decisionSlotKey:changed.slot,kind:'SET_STATE',value:{amount:'350.00'},provenance:'EXPLICIT_USER_DECISION'}]);
 assert.notEqual((await parity(edited)).digest,changed.digest);checks.push('Live semantic Draft changes Preview, no historical invalidation');
 assert.equal((await port.store.inspect(scope,key)).generation,generation);
 const proof={...changed.result.model.proof,expectedBaselineDigest:'0'.repeat(64),applyRequestId:uuid(9900)};
 const apply=await request(true,state(),'APPLY',proof);assert.equal(apply.result.ok,false);assert.equal(apply.result.code,'PLANNER_PREVIEW_STALE');assert.ok(apply.raw>0);assert.equal(apply.inspect,0);
 const recovery=await request(true,state(),'CHECK_APPLY',proof);assert.equal(recovery.result.code,'COMPOSER_APPLY_UNCONFIRMED');assert.equal(recovery.inspect,0);
 checks.push('Apply / commit recovery stay authoritative direct; no writer invoked');
 for(let i=0;i<12;i++){const pair={};for(const side of i%2?['hit','direct']:['direct','hit']){
  const value=await request(side==='hit');delete value.result;pair[side]=value;}
  assert.equal(pair.hit.digest,pair.direct.digest);benchmarks.push(pair);}
 return {checks,benchmarks,authenticated:'NOT_RUN',financialWrites:0};
}
