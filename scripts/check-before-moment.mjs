/** C-N2: synthetic owner / compiler / admission tests. No SQL, writer or network. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
const baseline=process.argv.includes('--legacy-baseline');
if(baseline){
  // Read the immutable HEAD sources in memory; never change a checkout or revision.
  const original=fs.readFileSync, sources=new Map();
  for(const file of execFileSync('git',['diff','--name-only','HEAD'],{encoding:'utf8'}).trim().split(/\r?\n/).filter(f=>f.endsWith('.ts')||f.endsWith('.tsx')))
    sources.set(path.resolve(file),execFileSync('git',['show','HEAD:'+file]));
  fs.readFileSync=function(file,options){const old=sources.get(path.resolve(String(file)));return old?(typeof options==='string'||options?.encoding?old.toString(typeof options==='string'?options:options.encoding):old):original.call(this,file,options);};
}
const{require}=await import('./lib/phase2-ts-loader.mjs');
const{d1Fixture,toGlobal,toDetail,compiledD1,totalD1,parentId,beforeId}=await import('./check-bar-d1-global.mjs');
const{fixture,householdId,uuid}=await import('./fixtures/planner-headless.mjs');
const{editNightOut}=require('@/domain/phase2/planner/night-out-edit');
const{parsePlanSemanticState,semanticStateDigest}=require('@/domain/phase2/planner/semantic-state');
const{plannerDigest}=require('@/domain/phase2/planner/json');
const{manifestContextRegistry,publishContextRegistry}=require('@/server/phase2/planner/context-registry');
const parent=s=>s.contexts.find(c=>c.contextOccurrenceId===parentId),child=s=>s.contexts.find(c=>c.contextOccurrenceId===beforeId);
const legacy=d1Fixture(),bottle=child(legacy).slotSelections.main.items[0],extra=child(legacy).slotSelections.extras.items[0];
const v1=editNightOut(legacy,{contextOccurrenceId:parentId,fields:{},consumption:{mode:'DIRECT',expectedContextDigest:plannerDigest(parent(legacy)),amount:'40',selectionId:uuid(99121),acceptLegacy:true}});
const legacyStates=[legacy,toGlobal(legacy),v1,editNightOut(v1,{contextOccurrenceId:parentId,fields:{},consumption:{mode:'DETAILED',expectedContextDigest:plannerDigest(parent(v1))}})];
async function goldens(){return Promise.all(legacyStates.map(async s=>{const p=await compiledD1(s);return{semantic:semanticStateDigest(s),registry:plannerDigest(manifestContextRegistry(s)),manifest:p.compiled.manifestDigest,compiled:plannerDigest(JSON.parse(JSON.stringify(p.compiled))),projection:p.projectionDigest,total:totalD1(p)};}));}
if(baseline){console.log(JSON.stringify(await goldens()));process.exit(0);}
globalThis.fetch=async()=>{throw Error('C_N2_NETWORK_FORBIDDEN');};
const{validateContextGraph}=require('@/server/phase2/planner/context-selections');
const{handleComposerRequest}=require('@/server/phase2/planner/composer-service');
const{stageLocalDecision}=require('@/app/mois-a-venir/composer/local-draft');
const{barBefore,barBeforeMomentPatch,barBeforeRemove,barBeforeDelete}=require('@/app/mois-a-venir/composer/bar-before');
const{validateBeforeTransition}=require('@/domain/phase2/planner/before-moment');
const{globalConsumptionCoverage}=require('@/domain/phase2/planner/night-out-consumption');
const{componentId}=require('@/domain/phase2/planner/identity');
const{evaluateHistoricalPlanScenario}=require('@/server/phase2/planner/preview');
const{preparePlanningMobility}=require('@/server/phase2/planner/prospective-mobility-pricing');
const{providers}=await import('./fixtures/planner-mobility.mjs');
const checks=[],observations={};
async function check(id,run){await run();checks.push({id,result:'PASS'});console.log(id+' PASS');}
const world=fixture(),worldBefore=JSON.stringify(world),deps={repository:{readActivePlan:async()=>null},readWorld:async()=>world,householdPersons:[],
  validateContextReferences:async(_household,refs)=>{assert.equal(refs.personIds.length,0,'Unknown synthetic household person');}};
const server=(s,op)=>handleComposerRequest(deps,householdId,{sequence:1,targetMonth:s.targetMonth,draft:s,...op});
async function model(s){const r=await server(s,{kind:'READ'});assert.equal(r.ok,true,JSON.stringify(r));return r.model;}
const op=(s,main=null,extras=[],fields={})=>barBeforeMomentPatch(s,parent(s),main,extras,fields);
const apply=(s,operation)=>editNightOut(s,operation.edit);
const fields={label:'Before synthétique',plannedDate:'2026-11-12',placeRef:{kind:'TEXT',label:'Chez des amis synthétiques',provenance:'USER_DECLARED_PROSPECTIVE'},participantRefs:['A','B','C'].map(n=>({kind:'TEXT',label:'Personne '+n+' synthétique'}))};
const unowned=parsePlanSemanticState({...legacy,contexts:[{...parent(legacy),slotSelections:{...parent(legacy).slotSelections,before:{items:[]}}}]});
let none,items;
await check('E01',async()=>{
  none=apply(unowned,op(unowned,null,[],fields));validateContextGraph(none);
  const view=barBefore(none,parent(none));assert.ok(view);assert.equal(view.bottle,null);assert.equal(view.child.fields.participantRefs.length,3);
  const p=await compiledD1(none),c=p.compiled.contexts.find(c=>c.contextOccurrenceId===view.child.contextOccurrenceId);
  assert.equal(p.compiled.components.filter(c=>c.contextOccurrenceId===view.child.contextOccurrenceId).length,0);
  assert.equal(c.componentSlots.find(s=>s.slotKey==='main').state,'EMPTY');assert.equal(c.componentSlots.find(s=>s.slotKey==='main').cardinality,'OPTIONAL_ONE');
  assert.equal(p.compiled.mobilityIntents?.filter(i=>i.contextOccurrenceId===view.child.contextOccurrenceId).length??0,0);
  // Remaining tests reuse the historical child IDs to make identity comparisons explicit.
  none=apply(legacy,op(legacy,null,[],fields));
  const ui=await model(none);assert.equal(ui.board.contexts.find(c=>c.contextOccurrenceId===beforeId).sockets.find(s=>s.slotKey==='main').cardinality,'OPTIONAL_ONE');
});
await check('E02',async()=>{
  const s=apply(unowned,op(unowned));const c=barBefore(s,parent(s)).child;
  assert.equal(c.fields.placeRef,undefined);assert.equal(c.fields.participantRefs,undefined);assert.equal(parent(s).fields.nightOutConsumption,undefined);
  const bad=op(none,null,[],{participantRefs:[{kind:'HOUSEHOLD_PERSON',personId:uuid(99901)}]});
  assert.equal((await server(none,bad)).ok,false,'Known refs need owner validation, not inference');
});
await check('E03',async()=>{
  items=apply(none,op(none,{...bottle,cost:{kind:'MANUAL',unitAmount:'24'}},[{...extra,cost:{kind:'MANUAL',unitAmount:'4'}}]));
  assert.equal(child(items).contextOccurrenceId,child(none).contextOccurrenceId);assert.deepEqual(parent(items).slotSelections.before,parent(none).slotSelections.before);
  assert.equal(child(items).fields.beforeMoment.consumption,'ITEMS');assert.equal(totalD1(await compiledD1(items)),'59.00');
  const received=await server(none,op(none,bottle,[extra]));assert.equal(received.ok,true,JSON.stringify(received));
});
await check('E04',()=>{
  const updated=apply(items,op(items,{...bottle,quantity:'2',label:'Bouteille précisée',cost:{kind:'MANUAL',unitAmount:'12'}},[extra]));
  assert.equal(child(updated).slotSelections.main.items[0].selectionId,bottle.selectionId);assert.deepEqual(child(updated).fields,child(items).fields);
});
await check('E05',()=>{
  const one=apply(items,barBeforeRemove(items,parent(items),extra.selectionId)),empty=apply(one,barBeforeRemove(one,parent(one),bottle.selectionId));
  assert.equal(child(empty).fields.beforeMoment.consumption,'NONE');assert.deepEqual(child(empty).slotSelections.main.items,[]);assert.deepEqual(child(empty).fields,child(none).fields);
});
await check('E05_TRASH_OWNER_RELAY',async()=>{
  const single=apply(none,op(none,bottle,[])),ui=await model(single);
  const source=ui.presentation.dragSources[`satellite:${beforeId}:main:${bottle.selectionId}`];assert.ok(source?.removeOperation);
  assert.equal(source.removeOperation.kind,'EDIT_NIGHT_OUT');
  const local=stageLocalDecision(ui,single,source.removeOperation);assert.equal(child(local).fields.beforeMoment.consumption,'NONE');
  const remote=await server(single,source.removeOperation);assert.equal(remote.ok,true,JSON.stringify(remote));assert.equal(child(remote.model.semanticState).fields.beforeMoment.consumption,'NONE');
  const moment=ui.presentation.dragSources['context-occurrence:'+beforeId].removeOperation;assert.equal(moment.kind,'EDIT_NIGHT_OUT');assert.equal(child(apply(single,moment)),undefined);
});
await check('E06',()=>{
  const promoted=apply(items,barBeforeRemove(items,parent(items),bottle.selectionId));
  assert.equal(child(promoted).slotSelections.main.items[0].selectionId,extra.selectionId);assert.equal(child(promoted).slotSelections.main.items[0].optionKey,'activity');
  assert.equal(child(promoted).slotSelections.extras.items.length,0);
});
await check('E07',()=>{
  const previous=structuredClone(items),deleted=apply(items,barBeforeDelete(items,parent(items)));
  assert.equal(child(deleted),undefined);assert.equal(parent(deleted).slotSelections.before.items.length,0);assert.deepEqual(items,previous);
  // Pure snapshot history admission, not a persistence receipt. Shell history is tested separately.
  assert.deepEqual(parsePlanSemanticState(previous),items);
});
await check('E08',async()=>{
  const s=apply(none,op(none,null,[],{placeRef:{kind:'TEXT',label:'Autre lieu synthétique'},participantRefs:[]}));
  assert.deepEqual(child(s).slotSelections,child(none).slotSelections);assert.deepEqual((await compiledD1(s)).compiled.components,(await compiledD1(none)).compiled.components);
  const transport=parent(s).slotSelections.return,withTransport=structuredClone(s);child(withTransport).slotSelections.transport=transport;
  const retained=apply(withTransport,op(withTransport,bottle,[]));assert.deepEqual(child(retained).slotSelections.transport,transport);
  assert.deepEqual(child(apply(retained,op(retained,null,[]))).slotSelections.transport,transport);
});
await check('D01',async()=>{
  const old=JSON.parse(execFileSync(process.execPath,[process.argv[1],'--legacy-baseline'],{encoding:'utf8',maxBuffer:8*1024*1024}));
  const now=await goldens();assert.deepEqual(now,old);observations.legacyGoldens=now;
});
await check('D02',async()=>{
  const g=toGlobal(none);assert.equal(parent(g).fields.nightOutConsumption.covered.length,1);assert.ok(parent(g).fields.nightOutConsumption.covered.every(r=>r.contextOccurrenceId===parentId));
  assert.equal(parent(g).fields.nightOutConsumption.amount,'40');assert.equal(totalD1(await compiledD1(g)),'51.00');
});
await check('D03',async()=>{
  const g=toGlobal(none),withItems=apply(g,op(g,bottle,[extra]));assert.equal(parent(withItems).fields.nightOutConsumption.covered.length,3);assert.equal(totalD1(await compiledD1(withItems)),'51.00');
  const promoted=apply(withItems,barBeforeRemove(withItems,parent(withItems),bottle.selectionId));assert.equal(parent(promoted).fields.nightOutConsumption.covered.find(r=>r.contextOccurrenceId===beforeId).slotKey,'main');
  const gone=apply(promoted,barBeforeRemove(promoted,parent(promoted),extra.selectionId));assert.equal(parent(gone).fields.nightOutConsumption.covered.length,1);assert.equal(parent(gone).fields.nightOutConsumption.amount,'40');
  assert.equal(child(toDetail(gone)).fields.beforeMoment.consumption,'NONE');assert.equal(totalD1(await compiledD1(toDetail(gone))),'31.00');
  const forged=structuredClone(gone);parent(forged).fields.nightOutConsumption.covered.push({contextOccurrenceId:beforeId,slotKey:'main',selectionId:bottle.selectionId});assert.throws(()=>parsePlanSemanticState(forged),/COVERAGE_STALE/);
});
await check('D04',async()=>{
  const g=toGlobal(none),empty=editNightOut(g,{contextOccurrenceId:parentId,fields:{},slots:{extras:[]}});
  assert.deepEqual(parent(empty).fields.nightOutConsumption.covered,[]);assert.equal(totalD1(await compiledD1(empty)),'51.00');
  assert.equal(parent(none).fields.nightOutConsumption,undefined);
});
await check('D05',()=>{
  const adopted=apply(v1,op(v1,null,[]));assert.deepEqual(parent(adopted).fields.nightOutConsumption,parent(v1).fields.nightOutConsumption);assert.throws(()=>toGlobal(adopted),/V1_DIRECT_NEEDS_DETAILS/);
  assert.equal(parent(toGlobal(legacyStates[3])).fields.nightOutConsumption.legacyV1.version,'night-out-consumption@v1');
});
await check('D06',()=>{
  const bad=apply(none,op(none,{...bottle,fundingAllocations:[{source:'BANK',amount:'15'}]},[]));assert.throws(()=>toGlobal(bad),/SCOPE_NEEDS_CHOICE/);
  const taxi=parent(toGlobal(none)).slotSelections.return.items[0];assert.ok(taxi);assert.ok(!globalConsumptionCoverage(none.contexts,parent(none)).some(r=>r.slotKey==='return'));
});
await check('G01',()=>{
  for(const corrupt of [s=>child(s).parentContextOccurrenceId=null,s=>parent(s).fields.composerPresentation.presetKey='nightclub',s=>{parent(s).slotSelections.main=parent(s).slotSelections.before;parent(s).slotSelections.before={items:[]};},s=>child(s).templateKey='friend-visit']){
    const raw=structuredClone(none);corrupt(raw);assert.throws(()=>parsePlanSemanticState(raw));
  }
});
await check('G02',()=>{
  for(const key of ['main','extras'])for(const item of [bottle,{kind:'UNRESOLVED',optionKey:'unresolved',selectionId:'structural:main',provenance:'STRUCTURAL_DEFAULT'}]){
    const raw=structuredClone(none);child(raw).slotSelections[key]={items:[item]};assert.throws(()=>parsePlanSemanticState(raw),/NONE_NOT_EMPTY/);
  }
  const raw=structuredClone(none);child(raw).slotSelections.hidden={items:[bottle]};assert.throws(()=>parsePlanSemanticState(raw));
});
await check('G03',()=>{
  for(const corrupt of [s=>child(s).slotSelections.main={items:[]},s=>child(s).fields.beforeMoment.version='forged',s=>child(s).slotSelections.extras.items[0].selectionId=bottle.selectionId,s=>parent(s).slotSelections.before.items.push(parent(s).slotSelections.before.items[0])]){
    const raw=structuredClone(items);corrupt(raw);assert.throws(()=>parsePlanSemanticState(raw));
  }
  const malformed=structuredClone(items);delete child(malformed).slotSelections.main.items[0].cost;assert.throws(()=>parsePlanSemanticState(malformed));
});
await check('G04',async()=>{
  const ui=await model(items),snap=semanticStateDigest(items);
  const operations=[{kind:'EDIT_CONTEXT',contextOccurrenceId:beforeId,values:{beforeMoment:'forged'}},
    {kind:'EDIT_CONTEXT',contextOccurrenceId:beforeId,values:{label:'bypass'}},
    {kind:'MUTATE',mutation:{kind:'PATCH_CONTEXT',contextOccurrenceId:beforeId,slotKey:'main',items:[]}},
    {kind:'CLEAR_SOCKET',contextOccurrenceId:beforeId,slotKey:'main',selectionId:bottle.selectionId},
    {kind:'MUTATE',mutation:{kind:'PATCH_CONTEXT',contextOccurrenceId:parentId,slotKey:'before',items:[{...parent(items).slotSelections.before.items[0],selectionId:uuid(99887)}]}},
    {kind:'DROP',assetKey:'template:activity',target:{kind:'BOARD_ZONE'},values:{beforeMoment:'forged'},identity:uuid(99885),selectionId:uuid(99886)},
    {kind:'DROP',assetKey:'template:activity',target:{kind:'CONTEXT_SOCKET',contextOccurrenceId:parentId,slotKey:'before'},values:{},identity:uuid(99885),selectionId:uuid(99886)}];
  for(const operation of operations){let local;try{local=stageLocalDecision(ui,items,operation);}catch{local=null;}assert.equal(local,null,JSON.stringify(operation));const r=await server(items,operation);assert.equal(r.ok,false,JSON.stringify(operation));}
  const moved=structuredClone(items);child(moved).parentContextOccurrenceId=uuid(99888);const other={...structuredClone(parent(moved)),contextOccurrenceId:uuid(99888)};parent(moved).slotSelections.before={items:[]};moved.contexts.push(other);parsePlanSemanticState(moved);assert.throws(()=>validateBeforeTransition(items,moved),/IDENTITY_CHANGED/);
  const two=structuredClone(items);two.contexts.push({...structuredClone(parent(items)),contextOccurrenceId:uuid(99888),slotSelections:{}});
  const reparent={kind:'DROP',assetKey:'context-occurrence:'+beforeId,target:{kind:'CONTEXT_SOCKET',contextOccurrenceId:uuid(99888),slotKey:'before'},values:{},identity:beforeId,selectionId:parent(items).slotSelections.before.items[0].selectionId};
  assert.equal((await server(two,reparent)).ok,false);assert.equal(stageLocalDecision(await model(two),two,reparent),null);
  assert.equal(semanticStateDigest(items),snap);
});
await check('G05',()=>{
  const stale=op(none,bottle,[]),changed=editNightOut(none,{contextOccurrenceId:parentId,fields:{label:'Bar modifié'}});assert.throws(()=>apply(changed,stale),/STALE/);
  const legacyCall={contextOccurrenceId:parentId,fields:{},before:{childContextOccurrenceId:beforeId,selectionId:parent(none).slotSelections.before.items[0].selectionId,bottle,extras:[]}};assert.throws(()=>editNightOut(none,legacyCall),/OWNER_REQUIRED/);
});
await check('P01',async()=>{
  for(const ref of [parentId,beforeId,componentId(beforeId,'main',bottle.selectionId),beforeId+':main',parentId+':before',componentId(parentId,'before',parent(items).slotSelections.before.items[0].selectionId)])for(const preference of ['anchor','preserve']){
    const s={...items,preferences:preference==='anchor'?{anchors:[ref],flexibility:{}}:{anchors:[],flexibility:{[ref]:'PRESERVE'}}};
    assert.throws(()=>apply(s,op(s,null,[])),/LOCKED/);assert.throws(()=>apply(s,barBeforeDelete(s,parent(s))),/LOCKED/);
  }
  const locked={...none,preferences:{anchors:[beforeId],flexibility:{}}};assert.throws(()=>toGlobal(locked),/LOCKED/);
  assert.throws(()=>toGlobal({...items,preferences:{anchors:[componentId(beforeId,'main',bottle.selectionId)],flexibility:{}}}),/LOCKED/);
  assert.equal((await server(locked,op(locked,bottle,[]))).ok,false);
});
await check('L01',async()=>{
  for(const s of legacyStates){assert.equal(semanticStateDigest(parsePlanSemanticState(s)),semanticStateDigest(s));assert.equal(child(s).fields.beforeMoment,undefined);}
  const ordinary=parsePlanSemanticState({...none,contexts:[{...child(none),parentContextOccurrenceId:null,fields:{fieldSchemaVersion:'context-fields@v2',label:'Activité ordinaire'}}]});
  const graph=validateContextGraph(ordinary);assert.equal(graph.selections.get(beforeId).get('main')[0].kind,'UNRESOLVED');
  assert.equal(publishContextRegistry().templates.find(t=>t.templateKey==='activity').componentSlots.find(s=>s.slotKey==='main').cardinality,'REQUIRED_ONE');
});
await check('L02',()=>{
  const raw=structuredClone(toGlobal(none)),restaurantId=uuid(99890),mealId=uuid(99891);
  raw.contexts.push({contextOccurrenceId:restaurantId,templateKey:'restaurant',status:'ACTIVE',parentContextOccurrenceId:null,provenance:'EXPLICIT_USER_DECISION',fields:{fieldSchemaVersion:'context-fields@v2',restaurantIncludedDetails:{version:'restaurant-included-details@v1',mealSelectionId:mealId,items:[{detailId:uuid(99892),label:'Détail inclus',included:true,quantity:null,unitBasis:null,amount:{kind:'UNKNOWN'},provenance:'EXPLICIT_USER_DECISION'}]}},slotSelections:{meal:{items:[{...bottle,selectionId:mealId,optionKey:'restaurant'}]}}});
  const s=parsePlanSemanticState(raw);validateContextGraph(s);const r=manifestContextRegistry(s);assert.match(r.version,/v12/);assert.ok(r.templates.find(t=>t.templateKey==='restaurant').fields.some(f=>f.semanticContract==='RESTAURANT_INCLUDED_DETAILS'));assert.equal(r.templates.find(t=>t.templateKey==='night-out').version,'night-out@v5');
});
await check('L03',async()=>{
  const s=legacyStates[1],p=await compiledD1(s),revision={semanticState:s,semanticStateDigest:p.semanticStateDigest,
    householdId,targetMonth:s.targetMonth,baselineSnapshot:p.baseline,baselineDigest:p.baselineDigest,compilerVersion:p.compiled.manifest.compilerVersion,
    compiledManifest:p.compiled.manifest,compiledManifestDigest:p.compiledManifestDigest,projectionEvidence:{version:'planner-projection-evidence@v1',compiledManifestDigest:p.compiledManifestDigest,projectionDigest:p.projectionDigest,projection:p.projection},revisionId:uuid(99893),revisionNumber:1};
  const saved=JSON.stringify(revision),prepared=await preparePlanningMobility(fixture(),s,providers().value);
  const read=evaluateHistoricalPlanScenario(prepared,revision,{expectedActiveRevisionId:null,expectedActiveRevisionNumber:0});
  assert.equal(read.compiled.manifestDigest,p.compiled.manifestDigest);assert.equal(read.projectionDigest,p.projectionDigest);assert.equal(JSON.stringify(revision),saved);
});
assert.equal(JSON.stringify(world),worldBefore);
const output={level:'EDITOR_LOCAL_DOMAIN_ADMISSION',checks,observations,SAVED:'NOT_RUN',FRESH:'NOT_RUN',APPLIED:'NOT_RUN',network:0,sql:0,writers:0};
fs.mkdirSync('outputs/before-moment',{recursive:true});fs.writeFileSync('outputs/before-moment/domain.json',JSON.stringify(output,null,2));console.log(JSON.stringify({result:'PASS',checks:checks.length}));
