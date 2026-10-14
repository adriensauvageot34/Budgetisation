import assert from 'node:assert/strict';
import fs from 'node:fs';
import {performance} from 'node:perf_hooks';
import {require} from './lib/phase2-ts-loader.mjs';
import {createKernelPostgres} from './lib/planner-kernel-postgres.mjs';
import {fixture,state,uuid,householdId,findSlot,nightMonth,weekendMonth,context,selections,component} from './fixtures/planner-headless.mjs';
import {fixture as mobilityFixture,visit,providers,home,destination} from './fixtures/planner-mobility.mjs';
const preview=require('@/server/phase2/planner/preview'),financial=require('@/server/phase2/planner/financial-adapter');
let evaluationCalls=0,financeCalls=0,financeMs=0;const evaluatedDigests=[],digestParities=[];
const evaluate=preview.evaluatePlanScenario,derive=financial.deriveCompiledMonthScenario;
preview.evaluatePlanScenario=(...args)=>{evaluationCalls++;const result=evaluate(...args);evaluatedDigests.push({previewDigest:result.previewDigest,projectionDigest:result.projectionDigest,compiledManifestDigest:result.compiledManifestDigest});return result;};
financial.deriveCompiledMonthScenario=(...args)=>{financeCalls++;const start=performance.now();try{return derive(...args);}finally{financeMs+=performance.now()-start;}};
const {handleComposerRequest}=require('@/server/phase2/planner/composer-service');
const {preparePlanningMobility}=require('@/server/phase2/planner/prospective-mobility-pricing');
const {createPlanApplyRepository}=require('@/server/phase2/planner/repository');
const {composerMutationDependencies}=require('@/server/phase2/planner/composer-mutation-world');
const pg=await createKernelPostgres(),repository=createPlanApplyRepository(pg.client),checks=[];
globalThis.fetch=async()=>{throw Error('P2_SYNTHETIC_NETWORK_FORBIDDEN');};
const check=async(name,fn)=>{await fn();checks.push(name);console.log(`${name} PASS`);};
async function run(enabled,world,draft,operation,{delay=0,fail=false,readNext}={}){
  process.env.COMPOSER_P14_P2_SINGLE_WORLD=enabled?'1':'0';
  const before={evaluationCalls,financeCalls,financeMs,digests:evaluatedDigests.length},owner=providers(),events=[];let worldReads=0,gets=0,activeReads=0;
  const deps={repository:{...repository,readActivePlan:async(...args)=>{activeReads++;return repository.readActivePlan(...args);}},
    householdPersons:[{personId:uuid(1),displayName:'Synthetic person'}],
    readWorld:async()=>{events.push({event:'world-start',n:++worldReads,at:performance.now()});gets+=20;
      if(delay)await new Promise(r=>setTimeout(r,delay));if(fail)throw Error('SYNTHETIC_WORLD_FAILED');
      return worldReads>1&&readNext?readNext():world;},
    prepareWorld:async(w,s)=>{events.push({event:'prepare',digest:require('@/domain/phase2/planner/semantic-state').semanticStateDigest(s)});return preparePlanningMobility(w,s,owner.value);},
    readMobilityOptions:async()=>({places:world.mobilityFacts?.places??[],vehicle:world.mobilityFacts?.vehicle??null}),
    validateContextReferences:async(_h,refs)=>{if(refs.personIds.some(id=>id!==uuid(1))||refs.placeIds.some(id=>!world.mobilityFacts?.places.some(p=>p.placeId===id)))throw TypeError('CONTEXT_REFERENCE_NOT_ADMITTED');}};
  const start=performance.now(),response=await handleComposerRequest(deps,householdId,{...operation,draft,targetMonth:'2026-11',sequence:7});
  return {response,worldReads,simulatedGets:gets,activeReads,evaluationCalls:evaluationCalls-before.evaluationCalls,financeCalls:financeCalls-before.financeCalls,
    financeCpuMs:financeMs-before.financeMs,ms:performance.now()-start,events,evaluatedDigests:evaluatedDigests.slice(before.digests)};
}
const cases=[];
const base=fixture(),grocery=findSlot(base,'groceries').slotIdentityKey;
cases.push(['amount',base,state(),{kind:'MUTATE',mutation:{kind:'SET_STATE',targetRef:grocery,value:{amount:'350'}}}]);
cases.push(['drop',base,state(),{kind:'DROP',assetKey:'template:night-out',target:{kind:'BOARD_ZONE'},identity:uuid(400),selectionId:uuid(900),values:{}}]);
const night=nightMonth();
cases.push(['night-rich',night.world,night.semantic,{kind:'EDIT_NIGHT_OUT',edit:{contextOccurrenceId:uuid(400),fields:{plannedDate:null},slots:{extras:[component('extra','5','extra',{quantity:'3'})]}}}]);
cases.push(['context',night.world,night.semantic,{kind:'EDIT_CONTEXT',contextOccurrenceId:uuid(400),values:{label:'Changed synthetic night'}}]);
cases.push(['preserve',night.world,night.semantic,{kind:'PRESERVE',targetRef:uuid(400),preserve:true}]);
const stay=weekendMonth(true);
cases.push(['stay-rich',stay.world,stay.semantic,{kind:'EDIT_SHORT_STAY',edit:{contextOccurrenceId:uuid(300),fields:{plannedDate:null,endDate:null},slots:{extras:[component('extra',null,'extra')]}}}]);
const mw=mobilityFixture(),carVisit=state([], [visit(100)]);
cases.push(['car-to-train',mw,carVisit,{kind:'EDIT_FAMILY_VISIT',edit:{contextOccurrenceId:uuid(100),fields:{plannedDate:null},transport:{kind:'MOBILITY_INTENT',selectionId:uuid(992),optionKey:'train',provenance:'EXPLICIT_USER_DECISION',origin:home,destination,returnRequired:true,pricing:{fare:{kind:'MANUAL',unitAmount:'24'},fundingAllocations:[{source:'BANK',amount:'24'}]}}}}]);
try {
  for(const [name,world,draft,operation]of cases)await check('P2-MUTATION-PARITY-'+name,async()=>{
    const immutable=structuredClone(world),a=await run(false,world,draft,operation),b=await run(true,world,draft,operation);
    assert.equal(a.response.ok,true,a.response.code);assert.deepEqual(b.response,a.response);
    assert.deepEqual(b.evaluatedDigests,a.evaluatedDigests);assert.equal(b.evaluatedDigests.length,2);
    for(const digests of b.evaluatedDigests)for(const digest of Object.values(digests))assert.match(digest,/^[a-f0-9]{64}$/);
    digestParities.push({case:name,P1:a.evaluatedDigests,P2:b.evaluatedDigests});
    assert.equal(a.worldReads,2);assert.equal(b.worldReads,1);assert.equal(a.evaluationCalls,2);assert.equal(b.evaluationCalls,2);
    assert.equal(a.financeCalls,b.financeCalls);assert.equal(a.activeReads,b.activeReads);
    assert.equal(b.events.filter(e=>e.event==='prepare').length,2);assert.deepEqual(world,immutable);
    if(name==='car-to-train')assert.equal(b.response.model.mobilitySummaries[0].economicFuel,'0.00');
  });
  await check('P2-LOCKED-REFERENCE-AND-READ-ERROR-PARITY',async()=>{
    const locked=structuredClone(night.semantic);locked.preferences.anchors=[uuid(400)];
    for(const [draft,op,options]of [[locked,cases[3][3],{}],[carVisit,{kind:'EDIT_FAMILY_VISIT',edit:{contextOccurrenceId:uuid(100),fields:{placeRef:{kind:'KNOWN',placeId:uuid(99999)}}}},{}],[state(),cases[0][3],{fail:true}]]){
      const world=draft===carVisit?mw:base,a=await run(false,world,draft,op,options),b=await run(true,world,draft,op,options);
      assert.equal(a.response.ok,false);assert.deepEqual(b.response,a.response);
    }
  });
  await check('P2-NEW-REQUEST-SEES-SOURCE-CHANGE',async()=>{
    const first=await run(true,base,state(),cases[0][3]);const changed=structuredClone(base);changed.monthInputs.safetyReserve='100';
    const next=await run(true,changed,state(),cases[0][3]);assert.notEqual(first.response.model.proof.expectedPreviewDigest,next.response.model.proof.expectedPreviewDigest);
  });
  await check('P2-READ-SNAPSHOT-BOUNDARY-EXPLICIT',async()=>{
    // The old orchestration mixed two admitted snapshots; it had no equality check between them.
    const changed=structuredClone(base);changed.monthInputs.safetyReserve='125';
    const old=await run(false,base,state(),cases[0][3],{readNext:()=>changed}),one=await run(true,base,state(),cases[0][3],{readNext:()=>changed});
    assert.equal(old.response.ok,true);assert.equal(one.response.ok,true);
    assert.notEqual(old.response.model.proof.expectedPreviewDigest,one.response.model.proof.expectedPreviewDigest);
    const direct=await run(true,base,state(),cases[0][3]);assert.deepEqual(one.response,direct.response);
    const scoped=composerMutationDependencies({repository,readWorld:async()=>base},householdId,'2026-11');
    assert.throws(()=>scoped.readWorld(uuid(999),'2026-11'),/SCOPE_MISMATCH/);
    assert.throws(()=>scoped.readWorld(householdId,'2026-12'),/SCOPE_MISMATCH/);
  });
  await check('P2-APPLY-IS-NOT-MEMOIZED',async()=>{
    const draft=state(),p=await run(true,base,draft,{kind:'READ'}),changed=structuredClone(base);changed.monthInputs.safetyReserve='999';
    const a=await run(true,changed,draft,{kind:'APPLY',command:{...p.response.model.proof,applyRequestId:uuid(44001)}});
    assert.equal(a.response.ok,false);assert.equal(a.response.code,'PLANNER_PREVIEW_STALE');assert.equal(a.worldReads,1);assert.equal(pg.rpcCalls,0);
  });
  await check('P2-CONCURRENT-REQUESTS-DO-NOT-SHARE-WORLD',async()=>{
    const w=structuredClone(base);w.monthInputs.safetyReserve='50';
    const [a,b]=await Promise.all([run(true,base,state(),cases[0][3],{delay:5}),run(true,w,state(),cases[0][3],{delay:1})]);
    assert.notEqual(a.response.model.proof.expectedPreviewDigest,b.response.model.proof.expectedPreviewDigest);assert.equal(a.worldReads,1);assert.equal(b.worldReads,1);
  });
  const pairs=[];
  for(let i=0;i<8;i++){const pair={};for(const enabled of i%2?[true,false]:[false,true]){
    const r=await run(enabled,base,state(),{kind:'MUTATE',mutation:{kind:'SET_STATE',targetRef:grocery,value:{amount:String(350+i)}}},{delay:120});
    assert.equal(r.response.ok,true);pair[enabled?'P2':'P1']={ms:r.ms,worldReads:r.worldReads,simulatedGets:r.simulatedGets,evaluations:r.evaluationCalls,financeCalls:r.financeCalls,financeCpuMs:r.financeCpuMs};
  }pairs.push(pair);}
  await pg.verifyCanaries();assert.deepEqual(await pg.counts(),{plans:0,revisions:0});
  const q=(side,p)=>pairs.map(x=>x[side].ms).toSorted((a,b)=>a-b)[Math.ceil(pairs.length*p)-1];
  const report={status:'PASS_SYNTHETIC_ONLY',checks,digestParities,n:pairs.length,simulatedWorldDelayMs:120,simulatedGetsPerWorld:20,pairs,
    P1:{p50:q('P1',.5),p95:q('P1',.95)},P2:{p50:q('P2',.5),p95:q('P2',.95)},realSupabaseGetCount:'NOT_MEASURED',remoteWrites:0};
  if(process.env.P14_P2_MUTATION_REPORT)fs.writeFileSync(process.env.P14_P2_MUTATION_REPORT,JSON.stringify(report,null,2));
  console.log(JSON.stringify(report));
}finally{delete process.env.COMPOSER_P14_P2_SINGLE_WORLD;await pg.close();}
