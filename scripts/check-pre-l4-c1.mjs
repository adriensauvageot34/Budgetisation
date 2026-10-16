import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import Module from 'node:module';
import ts from 'typescript';
import {execFileSync} from 'node:child_process';
import {require} from './lib/phase2-ts-loader.mjs';
import {fixture,state,control,uuid,householdId,renewalMonth} from './fixtures/planner-headless.mjs';
import {createKernelPostgres} from './lib/planner-kernel-postgres.mjs';
import {providers} from './fixtures/planner-mobility.mjs';
const {handleComposerRequest}=require('@/server/phase2/planner/composer-service');
const {previewPlanScenario,applyPlanScenario}=require('@/server/phase2/planner/apply');
const {resolveEffectiveMonthScenario}=require('@/server/phase2/planner/effective-month-scenario');
const {createPlanApplyRepository}=require('@/server/phase2/planner/repository');
const {planningBaselineDigest}=require('@/server/phase2/planner/baseline');
const {preparePlanningMobility}=require('@/server/phase2/planner/prospective-mobility-pricing');
const resolver=require('@/server/phase2/planner/plan-slot-resolver');
const {historicalControlAdmission}=require('@/server/phase2/planner/historical-control-admission');
const {InlineEditRegistry}=require('@/app/mois-a-venir/composer/inline-edit-registry');
globalThis.fetch=async()=>{throw Error('C1_REMOTE_FORBIDDEN');};
const out='docs/status/evidence/pre-l4-c1';fs.mkdirSync(out,{recursive:true});
const pg=await createKernelPostgres();let world=fixture(),sequence=0,requestId=46000;
const deps={repository:createPlanApplyRepository(pg.client),readWorld:async()=>world,householdPersons:[],
  prepareWorld:(world,semantic,historical)=>preparePlanningMobility(world,semantic,providers().value,historical),
  readDirectWorld:async()=>{throw Error('C1_OFFICIAL_READ_EXPECTED');}};
const req=(op,draft)=>handleComposerRequest(deps,householdId,{sequence:++sequence,targetMonth:'2026-11',...op,...(draft?{draft}:{})});
const ok=r=>{assert.equal(r.ok,true,JSON.stringify(r));return r.model;};
const command=p=>({expectedActiveRevisionId:p.baseActiveRevisionId,expectedActiveRevisionNumber:p.baseRevisionNumber,
  expectedBaselineDigest:p.baselineDigest,expectedPreviewDigest:p.previewDigest,applyRequestId:uuid(++requestId)});
const checks=[],matrix=[];const check=async(name,fn)=>{await fn();checks.push({name,status:'EXECUTED_PASS'});console.log(name+' PASS');};
async function paths(name,key,value,{numericRejected=false,blocked=false,mutationAdmitted=false}={}) {
  const initial=ok(await req({kind:'READ'},state()));
  const draft=state([control(key,value,450)]),before=pg.rpcCalls,baselineDigest=world.baseline.digest;
  const mutation=await req({kind:'MUTATE',mutation:{kind:'SET_STATE',targetRef:key,value}},state());
  const read=await req({kind:'READ'},draft);
  let preview=null,error=null,materialized=true;
  try{resolver.materializePlanSlots(world.baseline,draft);}catch(e){materialized=false;error=e.message;}
  try{preview=await previewPlanScenario(deps,householdId,draft);}catch(e){error=e.message;}
  const apply=await req({kind:'APPLY',command:preview?command(preview):{...initial.proof,applyRequestId:uuid(++requestId)}},draft);
  const row={name,value,scope:world.baseline.slots.find(s=>s.slotIdentityKey===key)?.scope??{kind:'SAVINGS'},
    mutate:mutation.ok?'ADMITTED':mutation.code,materialize:materialized?'ADMITTED':error,
    read:read.ok?read.model.board.cockpit.applyReadiness:read.code,
    preview:preview?preview.projection.applyReadiness:error,apply:apply.ok?'APPLIED':apply.code,rpcCalls:pg.rpcCalls-before};
  matrix.push(row);
  if(numericRejected){assert.equal(mutation.ok,false);assert.equal(read.ok,false);assert.equal(materialized,false);assert.equal(preview,null);assert.equal(apply.ok,false);assert.notEqual(apply.code,'COMPOSER_APPLY_UNCONFIRMED');assert.equal(pg.rpcCalls,before);}
  else if(blocked){assert.equal(mutation.ok,mutationAdmitted);assert.equal(read.ok,true);assert.equal(preview.projection.applyReadiness,'BLOCKED');assert.equal(apply.ok,false);assert.equal(pg.rpcCalls,before);}
  else {assert.equal(mutation.ok,true);assert.equal(read.ok,true);assert.ok(preview);assert.equal(apply.ok,true,JSON.stringify(row));assert.equal(pg.rpcCalls,before+1);}
  assert.equal(world.baseline.digest,baselineDigest);
}
try {
 await check('D04-SAME-OWNER-LIMITS-ALL-NEW-DECISION-PATHS',async()=>{
  const restaurant=world.baseline.slots.find(s=>s.semanticKey==='restaurants');
  await paths('HOUSEHOLD-count-9999',restaurant.slotIdentityKey,{count:'9999'});
  await paths('HOUSEHOLD-count-10000',restaurant.slotIdentityKey,{count:'10000'},{numericRejected:true});
  await paths('HOUSEHOLD-fraction',restaurant.slotIdentityKey,{count:'1.5'},{numericRejected:true});
  await paths('HOUSEHOLD-zero',restaurant.slotIdentityKey,{count:'0'});
  const coffee=world.baseline.slots.find(s=>s.semanticKey==='adrien-work-coffee');
  await paths('PERSON-count-price',coffee.slotIdentityKey,{count:'12',unitAmount:'2.10'});
  await paths('PERSON-10000',coffee.slotIdentityKey,{count:'10000'},{numericRejected:true});
  await paths('PERSON-legacy-count-only',coffee.slotIdentityKey,{count:'2'});
  const before=structuredClone(coffee.baselineValue);coffee.baselineValue={...before,unitAmount:null};world.baseline.digest=planningBaselineDigest(world.baseline);
  await paths('UNKNOWN-price-positive-count',coffee.slotIdentityKey,{count:'2'},{blocked:true,mutationAdmitted:true});
  await paths('UNKNOWN-price-zero-count',coffee.slotIdentityKey,{count:'0'});
  await paths('UNKNOWN-price-explicit-price',coffee.slotIdentityKey,{count:'2',unitAmount:'1.80'});
  coffee.baselineValue={...before,count:null};world.baseline.digest=planningBaselineDigest(world.baseline);
  const noDecision=ok(await req({kind:'READ'},state()));
  assert.equal([...noDecision.board.baselineControls,...noDecision.board.discretionaryControls].find(c=>c.targetRef===coffee.slotIdentityKey).value.count,null);
  assert.equal(noDecision.semanticState.controls.length,0);
  matrix.push({name:'UNKNOWN-count-no-decision',read:'ADMITTED_REFERENCE_UNKNOWN',explicitDecision:false});
  coffee.baselineValue=before;world.baseline.digest=planningBaselineDigest(world.baseline);
  await paths('Noneditable-unit-price',restaurant.slotIdentityKey,{count:'2',unitAmount:'1.80'},{numericRejected:true});
 });
 await check('FLOORS-PROTECTED-SAVINGS-CONDITIONAL-RENEWAL',async()=>{
  world=fixture();const g=world.baseline.slots.find(s=>s.semanticKey==='groceries');
  g.simpleAuthority={...g.simpleAuthority,hardFloor:{amount:'100.00',authority:'CANONICAL_OBSERVED_CONSUMPTION',evidenceRefs:['synthetic-floor']}};
  world.baseline.digest=planningBaselineDigest(world.baseline);
  await paths('Floor-allowed',g.slotIdentityKey,{amount:'100.00'});
  await paths('Floor-refused',g.slotIdentityKey,{amount:'99.00'},{blocked:true});
  const r=world.baseline.structuralFacts.savingsReservations.find(r=>r.reservationId!=='policy:safety-reserve');r.adjustability='PROTECTED';
  world.baseline.digest=planningBaselineDigest(world.baseline);
  await paths('Protected-savings',`savings:${r.reservationId}`,{amount:'0.00'},{blocked:true});
  world=renewalMonth().world;
  const conditional=world.baseline.slots.find(s=>s.renewalAuthority?.conditional);
  assert.ok(conditional);
  await paths('Conditional-renewal-over-one',conditional.slotIdentityKey,{count:'2'},{numericRejected:true});
  await paths('Conditional-renewal-zero',conditional.slotIdentityKey,{count:'0'});
 });
 await check('HISTORICAL-10000-IMMUTABLE-READ-NOT-NEW-APPLY',async()=>{
  world=fixture();const key=world.baseline.slots.find(s=>s.semanticKey==='restaurants').slotIdentityKey;
  // Reconstruct precisely the audited pre-C1 interpreter. The temporary module
  // replacement exists only in this synthetic process, never in product code.
  const file='src/server/phase2/planner/plan-slot-resolver.ts';
  const legacySource=execFileSync('git',['show','0e7c892184391f5b434d2d926dbb6e1c60092ce5:'+file],{encoding:'utf8'});
  const legacy=new Module(path.resolve(file));legacy.filename=path.resolve(file);legacy.paths=Module._nodeModulePaths(path.dirname(legacy.filename));
  legacy._compile(ts.transpileModule(legacySource,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,legacy.filename);
  const current=resolver.materializePlanSlots;const old=state([control(key,{count:'10000'},450)]);let committed,cmd;
  try{resolver.materializePlanSlots=legacy.exports.materializePlanSlots;const p=await previewPlanScenario(deps,householdId,old);cmd=command(p);committed=await applyPlanScenario(deps,householdId,old,cmd);}
  finally{resolver.materializePlanSlots=current;}
  const counts=await pg.counts(),calls=pg.rpcCalls;
  const historical=ok(await req({kind:'READ'}));assert.equal(historical.semanticState.controls[0].value.count,'10000');
  const official=await resolveEffectiveMonthScenario(deps,householdId,'2026-11');assert.equal(official.semanticState.controls[0].value.count,'10000');
  assert.equal(official.evidenceStatus,'EXACT');
  assert.equal((await req({kind:'READ'},old)).ok,false);
  await assert.rejects(()=>previewPlanScenario(deps,householdId,old),/COMPOSER_CONTROL_FIELD_NOT_ADMITTED/);
  const rejected=await req({kind:'APPLY',command:{...cmd,applyRequestId:uuid(++requestId)}},old);assert.equal(rejected.code,'COMPOSER_CONTROL_FIELD_NOT_ADMITTED');
  const replay=await applyPlanScenario(deps,householdId,old,cmd);assert.equal(replay.replayed,true);assert.equal(replay.revision.planRevisionId,committed.revision.planRevisionId);
  assert.throws(()=>resolver.materializePlanSlots(world.baseline,old,[],{householdId,targetMonth:'2026-11'}),/COMPOSER_CONTROL_FIELD_NOT_ADMITTED/);
  const proof=historicalControlAdmission(committed.revision);
  assert.throws(()=>resolver.materializePlanSlots(world.baseline,state([control(key,{count:'10001'},450)]),[],proof),/COMPOSER_CONTROL_FIELD_NOT_ADMITTED/);
  assert.equal(pg.rpcCalls,calls);assert.deepEqual(await pg.counts(),counts);
  matrix.push({name:'Immutable-history-10000',officialRead:'PASS_EXACT',rawDraftRead:'REFUSED',newApply:'REFUSED',oldRequestReplay:'PASS_NO_WRITE',forgedProof:'REFUSED',changedControl:'REFUSED'});
 });
 await check('INLINE-IDENTITY-PENDING-ONCE-AND-DISCARD-CONTRACT',()=>{
  const registry=new InlineEditRegistry();let flushes=0,discards=0;
  const pending={targetRef:'HOUSEHOLD:one',dimension:'amount',kind:'PENDING',discard(){},flush(){flushes++;registry.set('HOUSEHOLD:one:amount',null);}};
  registry.set('HOUSEHOLD:one:amount',pending);assert.equal(registry.count(),1);assert.equal(registry.flushPending(),1);assert.equal(registry.flushPending(),0);assert.equal(flushes,1);
  const raw=targetRef=>({targetRef,dimension:'amount',kind:'RAW',flush(){},discard(){discards++;}});
  registry.set('PERSON:A:amount',raw('PERSON:A'));registry.set('PERSON:B:amount',raw('PERSON:B'));
  assert.equal(registry.confirmDiscard(()=>false,new Set(['PERSON:A'])),false);assert.equal(registry.count(),2);assert.equal(discards,0);
  assert.equal(registry.confirmDiscard(()=>true,new Set(['PERSON:A'])),true);assert.equal(registry.count(),1);assert.equal(discards,1);
  assert.equal(registry.confirmDiscard(()=>true),true);assert.equal(registry.count(),0);assert.equal(discards,2);
 });
 await check('WRITER-ERROR-WITH-SAME-CODE-REMAINS-UNCONFIRMED',async()=>{
  world=fixture();const key=world.baseline.slots.find(s=>s.semanticKey==='restaurants').slotIdentityKey;
  const semantic=state([control(key,{count:'2'},450)]),preview=await previewPlanScenario(deps,householdId,semantic);
  const uncertain={...deps,repository:{...deps.repository,async applyRevision(){throw new TypeError('PLANNER_FIELDS_INVALID');}}};
  const result=await handleComposerRequest(uncertain,householdId,{kind:'APPLY',sequence:++sequence,targetMonth:'2026-11',draft:semantic,command:command(preview)});
  assert.equal(result.ok,false);assert.equal(result.code,'COMPOSER_APPLY_UNCONFIRMED');
 });
 await check('FINANCIAL-CANARIES-UNCHANGED',async()=>{await pg.verifyCanaries();});
} finally {
 // Keep the executed subset and failure evidence if an assertion stops the run.
 fs.writeFileSync(out+'/contracts.json',JSON.stringify({environment:'PGLITE_SYNTHETIC_ONLY',authenticated:false,checks,matrix,remoteCalls:0},null,2)+'\n');
 await pg.close();
}
