import assert from 'node:assert/strict';
import fs from 'node:fs';
import Module from 'node:module';
import {execFileSync} from 'node:child_process';
import ts from 'typescript';
import {performance} from 'node:perf_hooks';
import {require} from './lib/phase2-ts-loader.mjs';
import {createKernelPostgres} from './lib/planner-kernel-postgres.mjs';
import {p10Month} from './fixtures/planner-p10.mjs';
import {householdId,uuid} from './fixtures/planner-headless.mjs';
import {providers} from './fixtures/planner-mobility.mjs';
const {handleComposerRequest}=require('@/server/phase2/planner/composer-service');
const {createPlanApplyRepository}=require('@/server/phase2/planner/repository');
const {preparePlanningMobility}=require('@/server/phase2/planner/prospective-mobility-pricing');
const {stageLocalDecision,visualDraftModel}=require('@/app/mois-a-venir/composer/local-draft');
const legacy=new Module(process.cwd()+'/scripts/p2-old-local.ts');legacy.filename=legacy.id;legacy.paths=require.resolve.paths('typescript');
legacy._compile(ts.transpileModule(execFileSync('git',['show','a934f60f7f796b4522cbccfbb7b01edfab96dea5:src/app/mois-a-venir/composer/local-draft.ts'],{encoding:'utf8'}),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,legacy.filename);
const fixture=p10Month(),pg=await createKernelPostgres(),owner=providers(),checks=[];let reads=0;
const deps={repository:createPlanApplyRepository(pg.client),readWorld:async()=>{reads++;return fixture.world;},prepareWorld:(world,state)=>preparePlanningMobility(world,state,owner.value)};
try{
  let response=await handleComposerRequest(deps,householdId,{kind:'READ',targetMonth:'2026-11',sequence:1,draft:fixture.semantic});assert.equal(response.ok,true,response.code);
  let draft=response.model.semanticState;
  for(let i=1;i<=20;i++)draft=stageLocalDecision(response.model,draft,{kind:'DROP',assetKey:'template:night-out',target:{kind:'BOARD_ZONE'},identity:uuid(60000+i),selectionId:uuid(61000+i),values:{}});
  response=await handleComposerRequest(deps,householdId,{kind:'READ',targetMonth:'2026-11',sequence:2,draft});assert.equal(response.ok,true,response.code);
  const model=response.model,amount=model.board.baselineControls.find(c=>c.label==='Courses'),before=reads;
  const operations=[
    {kind:'MUTATE',mutation:{kind:'SET_STATE',targetRef:amount.targetRef,value:{amount:'350'}}},
    {kind:'EDIT_CONTEXT',contextOccurrenceId:uuid(60001),values:{label:'Synthetic renamed evening'}},
    {kind:'DROP',assetKey:model.library.searchableAssets.find(a=>a.assetKey.startsWith('option:night-out:extras:')).assetKey,target:{kind:'CONTEXT_SOCKET',contextOccurrenceId:uuid(60001),slotKey:'extras'},identity:uuid(60001),selectionId:uuid(62001),values:{amount:'12',quantity:'3'}},
    {kind:'DROP',assetKey:'context-occurrence:'+uuid(60020),target:{kind:'TRASH'},identity:uuid(60020),selectionId:uuid(60020),values:{}}
  ];
  for(const operation of operations){
    let changed=stageLocalDecision(model,model.semanticState,operation);
    assert.deepEqual(changed,legacy.exports.stageLocalDecision(model,model.semanticState,operation));
    if(!changed){
      // Complex equipment remains on its existing validated server path.
      const server=await handleComposerRequest(deps,householdId,{...operation,targetMonth:'2026-11',sequence:3,draft:model.semanticState});
      assert.equal(server.ok,true,server.code);changed=server.model.semanticState;
    }
    const a=legacy.exports.visualDraftModel(model,changed),b=visualDraftModel(model,changed);
    assert.deepEqual(b,a,'presentation values must remain identical to P1');assert.equal(b.board.cockpit,model.board.cockpit,'no local finance');
    const untouched=b.board.contexts.find(c=>c.contextOccurrenceId===uuid(60002));assert.equal(untouched,model.board.contexts.find(c=>c.contextOccurrenceId===uuid(60002)));
    checks.push('P2-PRESENTATION-PARITY-'+operation.kind);console.log(checks.at(-1)+' PASS');
  }
  // Only the known complex equipment fallback above may read sources.
  assert.equal(reads,before+1);await pg.verifyCanaries();
  const changed=stageLocalDecision(model,model.semanticState,operations[0]),pairs=[];
  for(let i=0;i<80;i++){const pair={};for(const variant of i%2?['P2','P1']:['P1','P2']){const at=performance.now();(variant==='P1'?legacy.exports.visualDraftModel:visualDraftModel)(model,changed);pair[variant]=performance.now()-at;}pairs.push(pair);}
  const stats=variant=>{const a=pairs.map(p=>p[variant]).sort((a,b)=>a-b);return{n:a.length,p50:a[39],p95:a[75]};};
  const result={status:'EXECUTED_PASS_SYNTHETIC_ONLY',checks,unchangedCardsReuse:true,localWorldReads:0,complexFallbackWorldReads:1,remoteWrites:0,visualModelCpuMs:{P1:stats('P1'),P2:stats('P2'),pairs}};
  if(process.env.P14_P2_PRESENTATION_REPORT)fs.writeFileSync(process.env.P14_P2_PRESENTATION_REPORT,JSON.stringify(result,null,2));console.log(JSON.stringify(result));
}finally{await pg.close();}
