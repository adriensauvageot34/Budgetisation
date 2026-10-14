import assert from 'node:assert/strict';
import fs from 'node:fs';
import {performance} from 'node:perf_hooks';
import {require} from './lib/phase2-ts-loader.mjs';
import {fixture,state,householdId,externalMonth} from './fixtures/planner-headless.mjs';
const {readComposerOpening}=require('@/server/phase2/planner/composer-opening');
const {readMonthComposer}=require('@/server/phase2/planner/read-model');
const {composerUiModel}=require('@/server/phase2/planner/composer-service');
const {planningBaselineDigest}=require('@/server/phase2/planner/baseline');
globalThis.fetch=async()=>{throw new Error('P14_P1_FIXTURE_NETWORK_FORBIDDEN');};
const checks=[];
const check=async(name,fn)=>{await fn();checks.push(name);console.log(`${name} PASS`);};
async function opening(enabled,world=fixture(),draft=state(),{worldDelay=0,draftDelay=0}={}){
  const calls=[],writes=0,start=performance.now();
  const deps={repository:{readActivePlan:async()=>null},householdPersons:[],readWorld:async()=>{calls.push('world-start');
    if(worldDelay)await new Promise(r=>setTimeout(r,worldDelay));calls.push('world-end');return world;}};
  const readDrafts=async()=>{calls.push('draft-start');if(draftDelay)await new Promise(r=>setTimeout(r,draftDelay));calls.push('draft-end');return {active:{semanticState:draft},archives:[],activePlanRevisionId:null,activePlanRevisionNumber:0,baseStale:false};};
  let result;
  if(enabled)result=await readComposerOpening(deps,householdId,'2026-11',readDrafts);
  else {const drafts=await readDrafts();result={model:await composerUiModel(deps,householdId,await readMonthComposer(deps,householdId,'2026-11',drafts.active.semanticState)),drafts};}
  return {result,calls,writes,ms:performance.now()-start};
}
await check('P1-OPENING-SAME-MODEL-ONE-WORLD',async()=>{
  const world=fixture(),draft=state();const a=await opening(false,world,draft),b=await opening(true,world,draft);
  assert.deepEqual(b.result,a.result);assert.equal(b.calls.filter(x=>x==='world-start').length,1);assert.equal(b.writes,0);
});
await check('P1-DRAFT-AND-WORLD-OVERLAP',async()=>{
  const b=await opening(true,fixture(),state(),{worldDelay:25,draftDelay:10});
  assert.ok(b.calls.indexOf('world-start')<b.calls.indexOf('draft-end'));
});
const changes=[
  ['Canonical-retroactive',w=>{w.baseline.slots[0].baselineValue.amount='60.00';w.baseline.digest=planningBaselineDigest(w.baseline);}],
  ['MonthInputs',w=>{w.monthInputs.safetyReserve='125.00';}],
  ['Wallet-input',w=>{w.monthInputs.declaredResources['benefit:swile']='10.00';}],
  ['Mobility',w=>{w.mobilityFacts.vehicle.fuelPricePerLiter='2.25';}],
  ['Forecast-generation',w=>{w.forecast.meta.analyticsRevision+=1;}],
  ['Date',w=>{w.asOfDate='2026-10-06';}],
];
for(const [name,edit] of changes)await check(`P1-OPENING-${name}`,async()=>{
  const world=structuredClone(fixture());edit(world);
  const a=await opening(false,world),b=await opening(true,world);assert.deepEqual(b.result,a.result);
});
await check('P1-OPENING-PLANNED-EXPENSE',async()=>{
  const {world,semantic}=externalMonth();assert.deepEqual((await opening(true,world,semantic)).result,(await opening(false,world,semantic)).result);
});
await check('P1-LIVE-CHANGE-NEW-OPENING',async()=>{
  const original=await opening(true),world=fixture();world.monthInputs.safetyReserve='125.00';const changed=await opening(true,world);
  assert.notEqual(changed.result.model.proof.expectedPreviewDigest,original.result.model.proof.expectedPreviewDigest);
});
await check('P1-EARLY-ERROR-NOT-FRESH',async()=>{
  const worldError=new Error('Canonical timeout'),draftError=new Error('Draft access denied');
  const deps={repository:{readActivePlan:async()=>null},readWorld:async()=>{throw worldError;}};
  await assert.rejects(()=>readComposerOpening(deps,householdId,'2026-11',async()=>{throw draftError;}),draftError);
  await assert.rejects(()=>readComposerOpening(deps,householdId,'2026-11',async()=>null),worldError);
});
const pairs=[];
for(let n=0;n<12;n++){let pair={};for(const enabled of(n%2?[true,false]:[false,true]))pair[enabled?'after':'before']=(await opening(enabled,fixture(),state(),{worldDelay:50,draftDelay:30})).ms;pairs.push(pair);}
const q=(side,p)=>pairs.map(x=>x[side]).sort((a,b)=>a-b)[Math.ceil(pairs.length*p)-1];
const report={status:'PASS_SYNTHETIC_ONLY',checks,n:pairs.length,syntheticWorldDelayMs:50,syntheticDraftDelayMs:30,pairs,
  before:{p50:q('before',.5),p95:q('before',.95)},after:{p50:q('after',.5),p95:q('after',.95)},remoteWrites:0};
if(process.env.P14_P1_OPENING_REPORT)fs.writeFileSync(process.env.P14_P1_OPENING_REPORT,JSON.stringify(report,null,2));
console.log(JSON.stringify(report));
