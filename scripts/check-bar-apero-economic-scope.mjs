import assert from 'node:assert/strict';
import fs from 'node:fs';
import {require} from './lib/phase2-ts-loader.mjs';
import {fixture,state,night,component,selections,car,providers,uuid,householdId} from './fixtures/planner-mobility.mjs';
import {createKernelPostgres} from './lib/planner-kernel-postgres.mjs';
const {editNightOut,substituteNightOutCoverage}=require('@/domain/phase2/planner/night-out-edit');
const {validateContextGraph}=require('@/server/phase2/planner/context-selections');
const {preparePlanningMobility}=require('@/server/phase2/planner/prospective-mobility-pricing');
const {evaluatePlanScenario}=require('@/server/phase2/planner/preview');
const {semanticStateDigest,parsePlanSemanticState}=require('@/domain/phase2/planner/semantic-state');
const {barBeforePatch}=require('@/app/mois-a-venir/composer/bar-before');
const scope=(id,kind='AGGREGATED_SUBSTITUTIVE_ESTIMATE',ids=[id])=>({version:'component-economic-scope@v1',kind,coveredSelectionIds:ids});
const aggregate={...component('main','60','aggregate'),economicScope:scope('aggregate'),unitBasis:'SHARED'};
const additive={...component('extra','12','independent'),economicScope:scope('independent','ADDITIVE_CONTRIBUTION')};
const unknown=component('extra',null,'beer-unknown'),world=fixture(),base={expectedActiveRevisionId:null,expectedActiveRevisionNumber:0};
const checks=[];async function test(id,run){try{await run();checks.push({id,status:'PASS'});console.log(id+' PASS');}catch(e){checks.push({id,status:'FAIL',message:e.message});console.error(id+' FAIL '+e.stack);}}
const semantic=()=>state([],[night(98020,'60',{main:selections(aggregate),extras:selections(additive),outbound:selections(car())})]);
await test('EXACT_60_REPLACEMENT_PRESERVES_12_ROUTE_UNKNOWN',async()=>{
 const before=semantic();validateContextGraph(before);const edit=substituteNightOutCoverage(before.contexts[0],'aggregate',unknown),after=editNightOut(before,edit);validateContextGraph(after);
 assert.deepEqual(after.contexts[0].slotSelections.outbound,before.contexts[0].slotSelections.outbound);
 assert.deepEqual(after.contexts[0].slotSelections.extras.items.find(i=>i.selectionId==='independent'),additive);
 assert.equal(after.contexts[0].slotSelections.main.items.length,0);assert.equal(after.contexts[0].slotSelections.extras.items.find(i=>i.selectionId==='beer-unknown').cost.kind,'UNKNOWN');
 const left=evaluatePlanScenario(await preparePlanningMobility(world,before,providers().value),before,base);
 const right=evaluatePlanScenario(await preparePlanningMobility(world,after,providers().value),after,base);
 const costs=right.compiled.components;assert.ok(costs.some(c=>c.selectionId==='independent'||c.componentId?.includes('independent'))||JSON.stringify(costs).includes('12'));
 assert.notEqual(right.projection.plan.economicMonthEndRemainder,'0.00');assert.equal(right.projection.plan.economicMonthEndRemainder,null);
 assert.notEqual(left.compiledManifestDigest,right.compiledManifestDigest);
 assert.deepEqual(parsePlanSemanticState(JSON.parse(JSON.stringify(after))),after);
 assert.throws(()=>editNightOut(after,edit),/COVERAGE_STALE/,'No duplicate mutation on replay');
 assert.equal(semanticStateDigest(before),semanticStateDigest(semantic()),'Undo snapshot remains intact');
});
await test('LEGACY_ADDITIVE_FUNDING_OVERLAP_AND_TAMPERING_REFUSED',()=>{
 const s=semantic(),ctx=s.contexts[0];
 for(const candidate of [{...aggregate,economicScope:undefined},{...aggregate,economicScope:scope('aggregate','ADDITIVE_CONTRIBUTION')},{...aggregate,fundingAllocations:[{source:'BANK',amount:'60'}]}]){
   const cleaned=JSON.parse(JSON.stringify(candidate));assert.throws(()=>substituteNightOutCoverage({...ctx,slotSelections:{...ctx.slotSelections,main:selections(cleaned)}},'aggregate',unknown));}
 assert.throws(()=>validateContextGraph(state([],[{...ctx,slotSelections:{...ctx.slotSelections,main:selections({...aggregate,economicScope:scope('aggregate',undefined,['aggregate','independent'])})}}])),/SCOPE_OVERLAP/);
 const edit=substituteNightOutCoverage(ctx,'aggregate',unknown);
 assert.throws(()=>editNightOut(s,{...edit,slots:{...edit.slots,extras:[unknown]}}),/SCOPE_MISMATCH/);
 assert.throws(()=>editNightOut(s,{...edit,coverageReplacement:{...edit.coverageReplacement,expectedComponentDigest:'outdated'}}),/COVERAGE_STALE/);
});
await test('BEFORE_AND_OTHER_SOCKETS_PRESERVED_BYTE_FOR_BYTE',()=>{
 let s=semantic();const initial=s.contexts[0];s=editNightOut(s,barBeforePatch(s,initial,component('activity','20','before-bottle'),[]).edit);
 const ctx=s.contexts[0];ctx.slotSelections.food=selections(component('restaurant','8','meal-independent'));
 const before=structuredClone(s),next=editNightOut(s,substituteNightOutCoverage(ctx,'aggregate',unknown));
 for(const slot of ['food','outbound'])assert.deepEqual(next.contexts[0].slotSelections[slot],before.contexts[0].slotSelections[slot]);
 assert.deepEqual(next.contexts[0].slotSelections.before,before.contexts[0].slotSelections.before);assert.deepEqual(next.contexts[1],before.contexts[1]);
 assert.deepEqual(s,before);
});
await test('NEW_SCOPE_PREVIEW_APPLY_RELOAD_ISOLATED_PGLITE_ONLY',async()=>{
 const pg=await createKernelPostgres();try{
 const {createPlanApplyRepository}=require('@/server/phase2/planner/repository');const {handleComposerRequest}=require('@/server/phase2/planner/composer-service');
 const repository=createPlanApplyRepository(pg.client),deps={repository,readWorld:async()=>world,prepareWorld:(w,s)=>preparePlanningMobility(w,s,providers().value)};
 const expected=state([],[night(98020,'60',{main:selections(aggregate),extras:selections(additive)})]);
 const p=await handleComposerRequest(deps,householdId,{kind:'READ',sequence:1,targetMonth:'2026-11',draft:expected});assert.equal(p.ok,true,p.code);
 const applied=await handleComposerRequest(deps,householdId,{kind:'APPLY',sequence:2,targetMonth:'2026-11',draft:expected,command:{...p.model.proof,applyRequestId:uuid(98025)}});assert.equal(applied.ok,true,applied.code);
 const saved=await repository.readActivePlan(householdId,'2026-11');assert.deepEqual(saved.activeRevision.semanticState,expected);
 assert.equal(pg.rpcCalls,1);await pg.verifyCanaries();
 }finally{await pg.close();}
});
fs.mkdirSync('outputs/bar-350',{recursive:true});fs.writeFileSync('outputs/bar-350/residual16-economic-scope.json',JSON.stringify({proof:'LOCAL_DOMAIN_FINANCE_FIXTURE_ONLY',checks},null,2));process.exitCode=checks.some(c=>c.status==='FAIL')?1:0;
