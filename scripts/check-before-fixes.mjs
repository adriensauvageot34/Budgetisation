/** C-N2 F01/F02/F03: permanent synthetic regressions, real owner/staging/handler.
 * No SQL, writer, auth account, network, Save or Apply. */
import assert from 'node:assert/strict';import fs from 'node:fs';
import{require}from'./lib/phase2-ts-loader.mjs';
import{d1Fixture,parentId,beforeId,toGlobal}from'./check-bar-d1-global.mjs';
import{fixture,householdId,uuid}from'./fixtures/planner-headless.mjs';
const{editNightOut}=require('@/domain/phase2/planner/night-out-edit');
const{barBeforeMomentPatch,barBeforeRemove,barBeforeDelete,barBefore}=require('@/app/mois-a-venir/composer/bar-before');
const{parsePlanSemanticState,semanticStateDigest}=require('@/domain/phase2/planner/semantic-state');
const{parseBeforeMoment}=require('@/domain/phase2/planner/before-moment');
const{validateContextGraph}=require('@/server/phase2/planner/context-selections');
const{handleComposerRequest}=require('@/server/phase2/planner/composer-service');
const{stageLocalDecision}=require('@/app/mois-a-venir/composer/local-draft');
const{plannerDigest}=require('@/domain/phase2/planner/json');
const{componentId}=require('@/domain/phase2/planner/identity');
globalThis.fetch=async()=>{throw Error('BEFORE_FIXES_NETWORK_FORBIDDEN');};
const world=fixture(),worldBytes=JSON.stringify(world),deps={repository:{readActivePlan:async()=>null},readWorld:async()=>world,householdPersons:[],
  validateContextReferences:async(_h,refs)=>assert.equal(refs.personIds.length,0)};
const source=d1Fixture(),sourceBytes=JSON.stringify(source),checks=[],observations={};
const parent=s=>s.contexts.find(c=>c.contextOccurrenceId===parentId),child=s=>s.contexts.find(c=>c.contextOccurrenceId===beforeId);
const server=(state,operation)=>handleComposerRequest(deps,householdId,{sequence:1,targetMonth:state.targetMonth,draft:state,...operation});
async function model(state){const result=await server(state,{kind:'READ'});assert.equal(result.ok,true,JSON.stringify(result));return result.model;}
const main=child(source).slotSelections.main.items[0],extra=child(source).slotSelections.extras.items[0];
const marked=(state=source,mainItem=main,extras=[extra])=>editNightOut(state,barBeforeMomentPatch(state,parent(state),mainItem,extras,
  {placeRef:{kind:'TEXT',label:'Lieu synthétique conservé'},participantRefs:['A','B','C'].map(n=>({kind:'TEXT',label:n+' synthétique'}))}).edit);
async function check(id,run){await run();checks.push({id,result:'PASS'});console.log(id+' PASS');}
async function admitted(state,operation){
  const bytes=JSON.stringify(state),local=stageLocalDecision(await model(state),state,operation),remote=await server(state,operation);
  assert.ok(local);assert.equal(remote.ok,true,JSON.stringify(remote));assert.deepEqual(local,remote.model.semanticState);assert.equal(JSON.stringify(state),bytes);
  return local;
}
async function refused(state,operation,code){
  const bytes=JSON.stringify(state);assert.throws(()=>editNightOut(state,operation.edit),code);
  let local;try{local=stageLocalDecision(await model(state),state,operation);}catch(error){assert.match(error.message,code);local=null;}
  assert.equal(local,null,'Staging must refuse without returning an admitted state');
  const remote=await server(state,operation);assert.equal(remote.ok,false,JSON.stringify(remote));assert.match(remote.code,code);
  assert.equal(JSON.stringify(state),bytes);return remote.code;
}
const reject=refused;
const pending={kind:'UNRESOLVED',selectionId:uuid(99771),optionKey:'unresolved',provenance:'EXPLICIT_USER_DECISION'};

await check('F01-A_CURRENT_REMOVAL_BOTH_BOUNDARIES',async()=>{
  for(const state of [marked(),marked(source,null,[]),toGlobal(marked())]){
    const ui=await model(state),operation=ui.presentation.dragSources['context-occurrence:'+beforeId].removeOperation,command=operation.edit.before;
    assert.equal(command.version,'before-moment-remove@v1');assert.equal(command.parentContextOccurrenceId,parentId);
    assert.equal(command.childContextOccurrenceId,beforeId);assert.equal(command.selectionId,parent(state).slotSelections.before.items[0].selectionId);
    assert.equal(command.expectedStateDigest,plannerDigest(state));assert.deepEqual(barBeforeDelete(state,parent(state)),operation);
    const after=await admitted(state,operation);assert.equal(child(after),undefined);assert.deepEqual(parent(after).slotSelections.before.items,[]);
    assert.deepEqual(parent(after).slotSelections.return,parent(state).slotSelections.return);
  }
});
await check('F01-B_R03_STALE_SOURCE_AND_BLIND_NULL_REFUSED',async()=>{
  const x=marked(),ui=await model(x),old=ui.presentation.dragSources['context-occurrence:'+beforeId].removeOperation;
  const gone=await admitted(x,old),y=editNightOut(gone,barBeforeMomentPatch(gone,parent(gone),main,[extra],
    {label:'Before Y',placeRef:{kind:'TEXT',label:'Lieu Y'},participantRefs:[{kind:'TEXT',label:'Personne Y'}]}).edit);
  assert.notEqual(barBefore(y,parent(y)).child.contextOccurrenceId,beforeId);
  await reject(y,old,/BEFORE_MOMENT_REMOVAL_TARGET_INVALID/);
  await reject(y,{kind:'EDIT_NIGHT_OUT',edit:{contextOccurrenceId:parentId,fields:{},before:null}},/BEFORE_MOMENT_OWNER_REQUIRED/);
  observations.R03='REFUSED_STAGING_AND_HANDLER_REPLACEMENT_INTACT';
});
await check('F01-C_STALE_DIGEST_REFUSED',async()=>{
  const state=marked(),operation=barBeforeDelete(state,parent(state));
  const changed=editNightOut(state,barBeforeMomentPatch(state,parent(state),{...main,label:'Poste précisé'},[extra],{label:'Moment précisé'}).edit);
  await reject(changed,operation,/BEFORE_MOMENT_STALE/);
});
await check('F01-D_FORGED_TARGET_REFUSED',async()=>{
  const state=marked(),operation=barBeforeDelete(state,parent(state));
  for(const key of ['parentContextOccurrenceId','childContextOccurrenceId','selectionId']){
    const forged=structuredClone(operation);forged.edit.before[key]=uuid(99780);await reject(state,forged,/BEFORE_MOMENT_REMOVAL_TARGET_INVALID/);
  }
  const two=structuredClone(state);two.contexts.push({...structuredClone(parent(state)),contextOccurrenceId:uuid(99781),slotSelections:{}});
  const forged=barBeforeDelete(two,parent(two));forged.edit.contextOccurrenceId=uuid(99781);await reject(two,forged,/BEFORE_MOMENT_REMOVAL_TARGET_INVALID/);
});
await check('F01-E_PROTECTIONS_STAGING_AND_HANDLER',async()=>{
  const state=marked(),link=parent(state).slotSelections.before.items[0].selectionId;
  for(const ref of [parentId,beforeId,parentId+':before',beforeId+':main',componentId(parentId,'before',link),componentId(beforeId,'main',main.selectionId)]){
    for(const preferences of [{anchors:[ref],flexibility:{}},{anchors:[],flexibility:{[ref]:'PRESERVE'}}]){
      const locked={...state,preferences};await reject(locked,barBeforeDelete(locked,parent(locked)),/COMPOSER_CONTEXT_LOCKED/);
    }
  }
});
await check('F01-F_LEGACY_VALID_NULL_REMAINS_VALID',async()=>{
  const result=await admitted(source,barBeforeDelete(source,parent(source)));assert.equal(child(result),undefined);
});
await check('R04_STALE_ITEM_REMOVAL_REMAINS_REFUSED',async()=>{
  const state=marked(),operation=barBeforeRemove(state,parent(state),main.selectionId),changed=editNightOut(state,{contextOccurrenceId:parentId,fields:{label:'Bar modifié'}});
  await reject(changed,operation,/BEFORE_MOMENT_STALE/);observations.R04='REFUSED_BEFORE_MOMENT_STALE';
});
await check('F02-A_LAST_REAL_ITEM_TO_NONE',async()=>{
  for(const state of [marked(source,main,[]),editNightOut(source,{contextOccurrenceId:parentId,fields:{},before:{childContextOccurrenceId:beforeId,
    selectionId:parent(source).slotSelections.before.items[0].selectionId,bottle:main,extras:[]}})]){
    const after=await admitted(state,barBeforeRemove(state,parent(state),main.selectionId));
    assert.equal(child(after).fields.beforeMoment.consumption,'NONE');assert.equal(child(after).contextOccurrenceId,beforeId);
    assert.deepEqual(parent(after).slotSelections.before,parent(state).slotSelections.before);
    for(const key of ['placeRef','participantRefs'])assert.deepEqual(child(after).fields[key],child(state).fields[key]);
  }
});
await check('F02-B_REAL_EXTRA_PROMOTED_WITH_ID',async()=>{
  for(const state of [source,marked()]){
    const after=await admitted(state,barBeforeRemove(state,parent(state),main.selectionId));
    assert.equal(child(after).slotSelections.main.items[0].selectionId,extra.selectionId);assert.deepEqual(child(after).slotSelections.extras.items,[]);
  }
});
await check('F02-C_R02_UNRESOLVED_EXTRA_PRESERVED',async()=>{
  const raw=structuredClone(source);child(raw).slotSelections.extras={items:[pending]};
  const state=parsePlanSemanticState(raw),bytes=JSON.stringify(state);validateContextGraph(state);await model(state);
  assert.throws(()=>barBeforeRemove(state,parent(state),main.selectionId),/Résolvez ou retirez explicitement/);
  assert.equal(JSON.stringify(state),bytes);observations.R02='HELPER_REFUSAL_FULL_SNAPSHOT_INTACT';
});
await check('F02-D_MIXED_EXTRAS_REFUSED_WITHOUT_LOSS',async()=>{
  for(const extras of [[extra,pending],[pending,extra]]){
    const raw=structuredClone(source);child(raw).slotSelections.extras={items:extras};const state=parsePlanSemanticState(raw),bytes=JSON.stringify(state);
    validateContextGraph(state);await model(state);assert.throws(()=>barBeforeRemove(state,parent(state),main.selectionId),/Résolvez ou retirez explicitement/);assert.equal(JSON.stringify(state),bytes);
  }
});
await check('F02-E_LEGACY_INCOMPLETE_READ_AND_MARKED_INVARIANT',async()=>{
  const raw=structuredClone(source);child(raw).slotSelections.extras={items:[pending]};const state=parsePlanSemanticState(raw),digest=semanticStateDigest(state);
  assert.equal(semanticStateDigest(parsePlanSemanticState(state)),digest);assert.equal(child(state).fields.beforeMoment,undefined);
  assert.equal(semanticStateDigest((await model(state)).semanticState),digest);
  const invalid=structuredClone(marked());child(invalid).slotSelections.extras={items:[pending]};const bytes=JSON.stringify(invalid);
  assert.throws(()=>parsePlanSemanticState(invalid),/BEFORE_MOMENT_ITEMS_INVALID/);assert.throws(()=>validateContextGraph(invalid),/BEFORE_MOMENT_ITEMS_INVALID/);assert.equal(JSON.stringify(invalid),bytes);
});
await check('F03_VALID_NONE_ITEMS_AND_LEGACY',()=>{
  for(const state of [source,marked(),marked(source,null,[])]){
    const bytes=JSON.stringify(state);parsePlanSemanticState(state);validateContextGraph(state);assert.equal(JSON.stringify(state),bytes);
  }
});
await check('F03_R01_MALFORMED_ENUM_REJECTED_AT_SNAPSHOT_AND_GRAPH',()=>{
  const invalid=[['arrayItems',['ITEMS']],['arrayNone',['NONE']],['emptyArray',[]],['object',{value:'ITEMS'}],['boolean',true],['number',1],['null',null],['undefined',undefined],['unknownString','OTHER']];
  observations.markerRefusals=[];
  for(const [name,value]of invalid){
    const raw=structuredClone(marked());child(raw).fields.beforeMoment.consumption=value;const before=structuredClone(raw);
    assert.throws(()=>parseBeforeMoment(child(raw).fields.beforeMoment));assert.throws(()=>parsePlanSemanticState(raw));assert.throws(()=>validateContextGraph(raw));
    assert.deepEqual(raw,before);observations.markerRefusals.push(name);
  }
  observations.R01='STRICT_REFUSAL_PARSER_SNAPSHOT_GRAPH';
});
await check('F03_MALFORMED_VERSION_AND_KEYS_REJECTED',()=>{
  for(const corrupt of [m=>m.version=['before-moment@v1'],m=>m.version={value:'before-moment@v1'},m=>m.version='before-moment@v2',m=>m.version=null,m=>m.version=1,m=>m.version=true,m=>m.version=undefined,m=>delete m.version,m=>m.extra='forged',m=>delete m.consumption]){
    const raw=structuredClone(marked());corrupt(child(raw).fields.beforeMoment);const before=structuredClone(raw);
    assert.throws(()=>parsePlanSemanticState(raw));assert.throws(()=>validateContextGraph(raw));assert.deepEqual(raw,before);
  }
});
assert.equal(JSON.stringify(source),sourceBytes);assert.equal(JSON.stringify(world),worldBytes);
fs.mkdirSync('outputs/before-fixes',{recursive:true});fs.writeFileSync('outputs/before-fixes/fixes.json',JSON.stringify({checks,observations,level:'EDITOR_LOCAL_SYNTHETIC',network:0,sql:0,writers:0,SAVED:'NOT_RUN',FRESH:'NOT_RUN',APPLIED:'NOT_RUN'},null,2));console.log(JSON.stringify({result:'PASS',checks:checks.length}));
