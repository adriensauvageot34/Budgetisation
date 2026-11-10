/** Actual React editor and Shell history, synthetic facts. DOM layout is not emulated. */
import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';import Module,{createRequire}from'node:module';
import{require}from'./lib/phase2-ts-loader.mjs';
import{d1Fixture,toGlobal,parentId}from'./check-bar-d1-global.mjs';
import{fixture,householdId}from'./fixtures/planner-headless.mjs';
const rr=createRequire(path.resolve(process.env.PLANNER_REACT_TEST_TOOLS??'../p-a2-library/test-tools','package.json'));
const React=rr('react'),{create,act}=rr('react-test-renderer'),load=Module._load;
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
let root,board,registry,focusCalls=0;
class NodeMock{
  constructor(props={}){this.props=props;this.open=false;this.isConnected=true;this.dataset={};this.style={setProperty(){}};this.children=[];this.scrollLeft=0;this.clientWidth=900;this.scrollWidth=900;}
  focus(){focusCalls++;document.activeElement=this;}contains(n){return n===this;}closest(){return null;}
  querySelector(){return null;}querySelectorAll(){return [];}matches(){return false;}
  show(){this.open=true;}showModal(){this.open=true;}close(){this.open=false;}
  addEventListener(){}removeEventListener(){}getBoundingClientRect(){return{width:1200,height:700,top:0,left:0,right:1200,bottom:700};}
  scrollTo(){}setAttribute(){}removeAttribute(){}
}
globalThis.HTMLElement=NodeMock;globalThis.Element=NodeMock;
globalThis.document={body:new NodeMock(),activeElement:new NodeMock(),querySelector:()=>null,querySelectorAll:()=>[],addEventListener(){},removeEventListener(){}};
globalThis.window={location:{search:'',pathname:'/synthetic-before'},addEventListener(){},removeEventListener(){}};
globalThis.requestAnimationFrame=fn=>setTimeout(fn,0);globalThis.cancelAnimationFrame=clearTimeout;
globalThis.ResizeObserver=class{observe(){}disconnect(){}};
globalThis.matchMedia=()=>({matches:true,addEventListener(){},removeEventListener(){}});
Object.defineProperty(globalThis,'navigator',{value:{onLine:true},configurable:true});
globalThis.localStorage={getItem(){return null;},setItem(){throw Error('C_N2_STORAGE_FORBIDDEN');}};
globalThis.fetch=async()=>{throw Error('C_N2_NETWORK_FORBIDDEN');};
let inline;
Module._load=function(name,parent,...args){
  if(name==='react')return React;if(name==='react-dom')return{createPortal:n=>n};
  if(parent?.filename?.endsWith('composer-shell.tsx')){
    if(name==='./composer-board')return{ComposerBoard:p=>{board=p;registry=React.useContext(inline.InlineEditContext);return null;}};
    if(['./composer-cockpit','./composer-financial-inspector','./balance-layer','./month-reuse','./atomic-popover'].includes(name))return new Proxy({},{get:()=>()=>null});
  }
  if(name==='./editor-chunks'&&/composer-(shell|library)\.tsx$/.test(parent?.filename??''))return{editorChunks:{},preloadEditorForAsset(){},preloadEditorForPreset(){}};
  return load.call(this,name,parent,...args);
};
inline=require('@/app/mois-a-venir/composer/inline-edit-registry');
const{InlineEditRegistry,InlineEditContext}=inline;
const{WorkshopConfirmationProvider}=require('@/app/mois-a-venir/composer/workshop-confirmation');
const{WorkshopChoicesProvider}=require('@/app/mois-a-venir/composer/workshop-choices');
const{BarLivingEditor}=require('@/app/mois-a-venir/composer/bar-living-editor');
const{BarLivingCard}=require('@/app/mois-a-venir/composer/bar-living-card');
const{ComposerShell}=require('@/app/mois-a-venir/composer/composer-shell');
const{handleComposerRequest}=require('@/server/phase2/planner/composer-service');
const{stageLocalDecision,visualDraftModel}=require('@/app/mois-a-venir/composer/local-draft');
const{barBefore,barBeforeMomentPatch,barBeforeRemove,barBeforeDelete}=require('@/app/mois-a-venir/composer/bar-before');
const{semanticStateDigest}=require('@/domain/phase2/planner/semantic-state');
const{plannerDigest}=require('@/domain/phase2/planner/json');
const checks=[],observations={},world=fixture(),deps={repository:{readActivePlan:async()=>null},readWorld:async()=>world,householdPersons:[]};
const initial=d1Fixture();initial.contexts=initial.contexts.filter(c=>c.contextOccurrenceId===parentId);initial.contexts[0].slotSelections.before={items:[]};
const parent=s=>s.contexts.find(c=>c.contextOccurrenceId===parentId);
async function read(s){const r=await handleComposerRequest(deps,householdId,{kind:'READ',sequence:1,targetMonth:'2026-11',draft:s});assert.equal(r.ok,true,JSON.stringify(r));return r.model;}
let model=await read(initial),overrides={},requestRef={current:()=>{}},ops=[];
const text=n=>typeof n==='string'?n:(n?.children??[]).map(text).join('');
const nodes=predicate=>root.root.findAll(n=>typeof n.type==='string'&&predicate(n));
const button=label=>{const n=nodes(n=>n.type==='button'&&(n.props['aria-label']===label||text(n)===label))[0];assert.ok(n,'Missing '+label+'; '+nodes(n=>n.type==='button').map(text).join(' | '));return n;};
const click=async label=>{const n=button(label);assert.ok(!n.props.disabled,label+' disabled');document.activeElement=new NodeMock(n.props);await act(async()=>n.props.onClick());};
const input=label=>{const n=nodes(n=>n.type==='label'&&text(n).startsWith(label))[0];assert.ok(n,'Missing field '+label);return n.findByType('input');};
const change=async(label,value)=>{const n=input(label);document.activeElement=new NodeMock(n.props);await act(async()=>n.props.onChange({target:{value}}));};
function admit(operation){const s=stageLocalDecision(model,model.semanticState,operation);assert.ok(s,'Local admission');ops.push(operation);model=visualDraftModel(model,s);root.update(render());return true;}
const props=()=>({context:parent(model.semanticState),model,card:model.board.contexts.find(c=>c.contextOccurrenceId===parentId),semanticState:model.semanticState,householdPersons:[],targetMonth:'2026-11',busy:false,fresh:false,dockHost:{},onSave:admit,onCancel(){},...overrides});
function render(){return React.createElement(WorkshopConfirmationProvider,{requestRef},React.createElement(WorkshopChoicesProvider,null,React.createElement(InlineEditContext.Provider,{value:registry},React.createElement(BarLivingEditor,props()))));}
const mock=element=>new NodeMock(element.props);
async function check(id,run){await run();checks.push({id,result:'PASS'});console.log(id+' PASS');}
try{
  registry=new InlineEditRegistry();registry.requestConfirmation=(message,accept,save)=>requestRef.current({message,accept,save,acceptLabel:'Abandonner cette saisie'});
  await act(async()=>{root=create(render(),{createNodeMock:mock});});
  await check('U01_EDITOR_RAW_DESCRIPTORS_AND_RESUME',async()=>{
    await click('Prévoir un Before');assert.equal(barBefore(model.semanticState,parent(model.semanticState)).bottle,null);
    await click('Lieu et participants du Before');await change('Lieu du Before','Chez des amis — RAW, ');
    for(const person of ['A synthétique','B synthétique','C synthétique']){await change('Personne du Before',person);await click('Ajouter cette personne au Before');}
    assert.equal(registry.count(),1);assert.equal(barBefore(model.semanticState,parent(model.semanticState)).child.fields.placeRef,undefined);
    // A same-state server read is not permission to replace the local buffer.
    const active=document.activeElement;model=await read(model.semanticState);await act(async()=>root.update(render()));
    assert.equal(input('Lieu du Before').props.value,'Chez des amis — RAW, ');assert.equal(document.activeElement,active);
    overrides={initialTarget:'date',targetRequest:1};await act(async()=>root.update(render()));
    assert.equal(input('Lieu du Before').props.value,'Chez des amis — RAW, ');assert.equal(registry.count(),1);
    const save=nodes(n=>n.type==='button'&&n.props['data-save-workshop']!==undefined)[0];assert.ok(save,'RAW save and resume');
    await act(async()=>save.props.onClick());const view=barBefore(model.semanticState,parent(model.semanticState));assert.equal(view.child.fields.placeRef.label,'Chez des amis — RAW, ');assert.equal(view.child.fields.participantRefs.length,3);assert.equal(view.child.fields.beforeMoment.consumption,'NONE');assert.equal(registry.count(),0);
    assert.equal(nodes(n=>n.props['data-bar-step']==='date').length,1);
    observations.raw={sameStateReadPreservesBuffer:true,focusObjectPreserved:true,saveResumeTarget:'date',participants:3,browserFocus:'NOT_RUN'};
  });
  await check('U03_VISIBLE_NONE_ADD_REMOVE_AND_CLOSED_CARD',async()=>{
    overrides={initialTarget:'before',targetRequest:2};await act(async()=>root.update(render()));
    assert.equal(nodes(n=>n.props['data-before-none']!==undefined).length,1);
    await click('Ajouter un objet au Before');
    await click('Boissons');
    if(!nodes(n=>n.type==='button'&&/Vodka/u.test(text(n))).length&&nodes(n=>n.type==='button'&&text(n)==='Tout le Before').length)await click('Tout le Before');
    // Exercise the real dock choices, not a synthetic UI replacement.
    const pick=nodes(n=>n.type==='button'&&/Vodka/u.test(text(n)))[0];
    if(!pick){console.log('DOCK '+nodes(n=>n.type==='button').map(text).join(' | '));}
    assert.ok(pick,'Bottle dock choice');await act(async()=>pick.props.onClick());
    const view=barBefore(model.semanticState,parent(model.semanticState));assert.ok(view.bottle);assert.equal(view.child.fields.beforeMoment.consumption,'ITEMS');
    await act(async()=>admit(barBeforeRemove(model.semanticState,parent(model.semanticState),view.bottle.selectionId)));
    overrides={initialTarget:'before',targetRequest:3};await act(async()=>root.update(render()));assert.equal(nodes(n=>n.props['data-before-none']!==undefined).length,1);
    const card=model.board.contexts.find(c=>c.contextOccurrenceId===parentId);let closed;await act(async()=>{closed=create(React.createElement(BarLivingCard,{card,model,living:{open(){},close(){}},busy:false,preserved:false,preserve(){},drag(){}}),{createNodeMock:mock});});
    assert.match(text(closed.toJSON()),/Aucune consommation prévue/);await act(async()=>closed.unmount());
  });
  await act(async()=>root.unmount());
  await check('U02_SHELL_ATOMIC_UNDO_REDO_AND_RAW_GUARD',async()=>{
    model=await read(toGlobal(model.semanticState));const calls=[];
    await act(async()=>{root=create(React.createElement(ComposerShell,{initialModel:model,transport:async request=>{calls.push(request.kind);assert.equal(request.kind,'READ');return handleComposerRequest(deps,householdId,request);}}),{createNodeMock:mock});});
    const before=structuredClone(board.model.semanticState),view=barBefore(before,parent(before));
    const main=d1Fixture().contexts.find(c=>c.parentContextOccurrenceId===parentId).slotSelections.main.items[0];
    await act(async()=>board.request(barBeforeMomentPatch(before,parent(before),main,[])));
    const withItems=structuredClone(board.model.semanticState);assert.equal(barBefore(withItems,parent(withItems)).child.fields.beforeMoment.consumption,'ITEMS');
    assert.equal(parent(withItems).fields.nightOutConsumption.covered.length,parent(before).fields.nightOutConsumption.covered.length+1);
    const history=kind=>nodes(n=>n.type==='button'&&n.props['data-history-action']===kind)[0];
    let discarded=false;await act(async()=>registry.set('synthetic-before-raw',{targetRef:view.child.contextOccurrenceId,dimension:'place',kind:'RAW',discard(){discarded=true;},flush(){}}));
    await act(async()=>history('undo').props.onClick());assert.equal(discarded,false);assert.equal(semanticStateDigest(board.model.semanticState),semanticStateDigest(withItems));assert.equal(registry.count(),1);
    await act(async()=>registry.set('synthetic-before-raw',null));await act(async()=>history('undo').props.onClick());assert.deepEqual(board.model.semanticState,before);
    await act(async()=>history('redo').props.onClick());assert.deepEqual(board.model.semanticState,withItems);
    await act(async()=>board.request(barBeforeDelete(board.model.semanticState,parent(board.model.semanticState))));assert.equal(barBefore(board.model.semanticState,parent(board.model.semanticState)),null);
    await act(async()=>history('undo').props.onClick());assert.deepEqual(board.model.semanticState,withItems);
    await act(async()=>history('redo').props.onClick());assert.equal(barBefore(board.model.semanticState,parent(board.model.semanticState)),null);
    observations.history={atomicSemanticRestore:true,markerIdsDescriptionRestored:true,globalCoverageAndAmountRestored:true,rawUndoBlocked:true,transports:calls};
  });
  fs.mkdirSync('outputs/before-moment',{recursive:true});fs.writeFileSync('outputs/before-moment/ui.json',JSON.stringify({checks,observations,level:'REACT_EDITOR_AND_SHELL',browser:'NOT_RUN_LOCAL_CONNECTION_TIMEOUT',SAVED:'NOT_RUN',FRESH:'NOT_RUN'},null,2));
  console.log(JSON.stringify({result:'PASS',checks:checks.length,focusCalls}));
}finally{if(root)await act(async()=>root.unmount());}
