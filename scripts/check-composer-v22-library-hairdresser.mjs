/** A-LIB-ONE: synthetic owner READ + actual Library/Shell handlers, no browser or storage. */
import assert from 'node:assert/strict';
import path from 'node:path';
import Module, {createRequire} from 'node:module';
import {require} from './lib/phase2-ts-loader.mjs';
import {monthFixture} from './fixtures/composer-v22-b1.mjs';
import {externalExpense} from './fixtures/planner-kernel.mjs';
import {householdId,uuid,rebuild,control,findSlot} from './fixtures/planner-headless.mjs';
const rr=process.env.PLANNER_REACT_TEST_TOOLS?createRequire(path.resolve(process.env.PLANNER_REACT_TEST_TOOLS,'package.json')):require;
const React=rr('react'),{create,act}=rr('react-test-renderer'),load=Module._load;
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
let root,board,registry,transportCalls=[],focusCount=0;
const listeners=new Map();
class NodeMock {
  constructor(props={}){this.props=props;this.open=false;this.isConnected=true;}
  focus(){focusCount++;document.activeElement=this;}
  closest(selector){return selector==='aside'?this:null;}
  contains(node){return node===this;}
  matches(){return false;}
  show(){this.open=true;}showModal(){this.open=true;}close(){this.open=false;}
  querySelector(selector){
    const found=root?.root.findAll(n=>n.type==='button'&&!n.props.disabled&&n.props['data-library-existing-action'])[0];
    return selector.includes('data-library-existing-action')&&found?new NodeMock(found.props):null;
  }
}
globalThis.HTMLElement=NodeMock;globalThis.Element=NodeMock;
globalThis.document={body:new NodeMock(),activeElement:new NodeMock(),querySelector:()=>null,querySelectorAll:()=>[],
  addEventListener:(name,fn)=>listeners.set(name,new Set([...(listeners.get(name)??[]),fn])),removeEventListener:(name,fn)=>listeners.get(name)?.delete(fn)};
globalThis.window={location:{search:'',pathname:'/synthetic-composer'},addEventListener(){},removeEventListener(){}};
Object.defineProperty(globalThis,'navigator',{value:{onLine:true},configurable:true});
globalThis.localStorage={getItem(){return null;},setItem(){throw Error('A_LIB_ONE_STORAGE_FORBIDDEN');}};
globalThis.fetch=async()=>{throw Error('A_LIB_ONE_NETWORK_FORBIDDEN');};
let inline;
const empty=()=>null;
Module._load=function(name,parent,...args){
  if(name==='react')return React;
  if(parent?.filename?.endsWith('composer-shell.tsx')){
    const mocks={'./composer-board':{ComposerBoard:p=>{board=p;registry=React.useContext(inline.InlineEditContext);return null;}},
      './composer-cockpit':{ComposerCockpit:empty},'./composer-financial-inspector':{ComposerFinancialInspector:empty},
      './context-palette':{ContextPalette:empty},'./balance-layer':{BalanceLayer:empty},'./month-reuse':{MonthReuse:empty},'./atomic-popover':{AtomicPopover:empty}};
    if(mocks[name])return mocks[name];
  }
  if(name==='./editor-chunks'&&/composer-(shell|library)\.tsx$/.test(parent?.filename??''))return {
    editorChunks:{},preloadEditorForAsset(){},preloadEditorForPreset(){}};
  return load.call(this,name,parent,...args);
};
inline=require('@/app/mois-a-venir/composer/inline-edit-registry');
const {ComposerShell}=require('@/app/mois-a-venir/composer/composer-shell');
const {handleComposerRequest}=require('@/server/phase2/planner/composer-service');
const {composerLibraryIndex,libraryOccurrences,filterLibraryIntentions,librarySearchAction}=require('@/domain/phase2/planner/composer-library-index');
const {semanticStateDigest}=require('@/domain/phase2/planner/semantic-state');
const fixtures=[],checks=[];
async function fixture(count){
  const f=monthFixture();
  const expenses=Array.from({length:count},(_,i)=>({...externalExpense(95001+i*10),familyKey:'purchase',subtypeKey:'beauty',title:'Coiffeur',
    plannedDate:`2026-11-${i?'20':'10'}`,costItems:[{id:uuid(95002+i*10),assetKey:'beauty:hairdresser',label:'Prestation synthétique',quantity:'1',unitAmount:'25.00',baselineKey:null}]}));
  f.world.externalIntents=expenses;f.world.sources.plannedExpenses=expenses;rebuild(f.world);
  f.semantic={...f.semantic,controls:[control(findSlot(f.world,'groceries').slotIdentityKey,{amount:'300.00'},96001)]};
  f.before=JSON.stringify(f.world);f.expenses=expenses;
  const response=await handleComposerRequest(f.deps,householdId,{kind:'READ',sequence:0,targetMonth:'2026-11',draft:f.semantic});
  assert.equal(response.ok,true,response.message);f.model=response.model;fixtures.push(f);return f;
}
const zero=await fixture(0),one=await fixture(1),many=await fixture(2);
const buttons=()=>root.root.findAll(n=>n.type==='button');
const existing=()=>buttons().filter(n=>n.props['data-library-existing-action']);
const search=()=>root.root.find(n=>n.type==='input'&&n.props['data-library-search']!==undefined);
const textOf=node=>Array.isArray(node)?node.map(textOf).join(''):typeof node==='string'?node:(node?.children??[]).map(textOf).join('');
const invoke=async node=>{document.activeElement=new NodeMock(node.props);await act(async()=>node.props.onClick());};
const query=async value=>act(async()=>search().props.onChange({target:{value}}));
const enter=async()=>act(async()=>search().props.onKeyDown({key:'Enter',preventDefault(){},currentTarget:new NodeMock()}));
async function mount(model){
  if(root)await act(async()=>root.unmount());transportCalls=[];
  await act(async()=>{root=create(React.createElement(ComposerShell,{initialModel:model,transport:async()=>{transportCalls.push('FORBIDDEN');throw Error('A_LIB_ONE_TRANSPORT_FORBIDDEN');}}),
    {createNodeMock:element=>new NodeMock(element.props)});});
}
const check=async(name,fn)=>{await fn();checks.push(name);console.log(name+' PASS');};
try{
  await check('L01_ZERO_INFORMATIVE_NO_CREATION',async()=>{
    await mount(zero.model);await query('Coiffeur');assert.equal(existing().length,0);
    assert.match(textOf(root.toJSON()),/Aucune intention correspondante/);await enter();
    assert.equal(board.focused,null);assert.equal(board.model.semanticState.contexts.length,0);assert.deepEqual(transportCalls,[]);
  });
  await check('L02_ONE_EXACT_REFERENCE_READ',async()=>{
    await mount(one.model);await query('Coiffeur');assert.equal(existing().length,1);assert.match(textOf(existing()[0]),/Voir Coiffeur/);
    assert.match(textOf(existing()[0]),/10 nov/);assert.equal(buttons().filter(n=>n.props['data-library-add-action']).length,0);
    await enter();assert.equal(board.focused,`external:${one.expenses[0].id}`);assert.equal(board.reveal.targetRef,board.focused);
    assert.deepEqual(transportCalls,[]);assert.equal(libraryOccurrences(board.model)[0].action,'VIEW');
  });
  await check('L03_N_HOMONYMS_EXPLICIT_CHOICE',async()=>{
    await mount(many.model);await query('Coiffeur');assert.equal(existing().length,2);
    assert.match(textOf(existing()[0]),/10 nov/);assert.match(textOf(existing()[1]),/20 nov/);
    const before=focusCount;await enter();assert.equal(board.focused,null);assert(focusCount>before);
    const ids=existing().map(n=>n.props['data-library-existing-action']);assert.equal(new Set(ids).size,2);
    await invoke(existing()[1]);assert.equal(board.focused,`external:${many.expenses[1].id}`);assert.notEqual(board.focused,ids[0]);
    assert.equal(board.model.board.contexts.find(c=>c.contextOccurrenceId===board.focused).externalIntentId,many.expenses[1].id);
  });
  await check('L04_RETURN_MONTH_LOCAL_DECISION_AND_IDENTITIES',async()=>{
    const before=semanticStateDigest(many.model.semanticState);await invoke(buttons().find(n=>n.props['data-library-open']!==undefined));
    assert.equal(document.activeElement.props['data-library-search'],true);assert.equal(search().props.value,'Coiffeur');
    await invoke(existing()[0]);assert.equal(board.focused,`external:${many.expenses[0].id}`);assert.equal(board.model.board.targetMonth,'2026-11');
    assert.equal(semanticStateDigest(board.model.semanticState),before);assert.deepEqual(board.model.semanticState.controls,many.semantic.controls);
    assert.deepEqual(board.model.semanticState.contexts,[]);assert.deepEqual(transportCalls,[]);
  });
  await check('L05_NO_EDIT_CAPABILITY_SERVER_REFUSAL',async()=>{
    const card=one.model.board.contexts[0];assert.equal(card.readOnly,true);assert.deepEqual(card.capabilityRefs,[]);
    const response=await handleComposerRequest(one.deps,householdId,{kind:'EDIT_CONTEXT',sequence:1,targetMonth:'2026-11',draft:one.semantic,contextOccurrenceId:card.contextOccurrenceId,values:{label:'Forbidden'}});
    assert.equal(response.ok,false);assert.equal(response.code,'COMPOSER_CONTEXT_LOCKED');
    const forged=structuredClone(one.model);forged.board.contexts[0].capabilityRefs=['PATCH_CONTEXT'];assert.equal(libraryOccurrences(forged)[0].action,'VIEW');
  });
  await check('L06_TYPED_OWNER_AND_MONTH_NO_LABEL_IDENTITY',()=>{
    const matching=model=>filterLibraryIntentions(composerLibraryIndex(model).occurrences,'Coiffeur');
    const renamed=structuredClone(one.model);renamed.board.contexts[0].label='Prestation personnalisée';assert.equal(matching(renamed).length,1);
    for(const alter of [c=>c.fields.costItems[0].assetKey='beauty:shampoo',c=>c.externalIntentId=uuid(95999),c=>c.readOnly=false,
      c=>c.fields.plannedDate='2026-12-10',c=>c.templateKey='other-context']){
      const model=structuredClone(one.model);alter(model.board.contexts[0]);assert.equal(matching(model).length,0);
    }
    const wrongMonth=structuredClone(one.model);wrongMonth.board.targetMonth='2026-12';assert.equal(matching(wrongMonth).length,0);
    const index=composerLibraryIndex(many.model);assert.equal(librarySearchAction(index.intentions.filter(i=>i.search.includes('coiffeur')),matching(many.model),'coiffeur').kind,'FOCUS');
  });
  await check('L07_RAW_REGISTERED_BUFFER_PRESERVED',async()=>{
    await mount(many.model);await query('Coiffeur');let discarded=false;
    await act(async()=>registry.set('synthetic-raw',{targetRef:'synthetic-editor',dimension:'amount',kind:'RAW',discard:()=>{discarded=true;},flush(){}}));
    await invoke(existing()[1]);assert.equal(registry.count(),1);assert.equal(discarded,false);
    assert.equal(board.focused,null);await invoke(buttons().find(n=>n.props['data-keep-editing']));
    assert.equal(registry.count(),1);assert.equal(discarded,false);assert.equal(board.focused,null);
    assert.equal(board.model.semanticState.controls[0].value.amount,'300.00');assert.deepEqual(transportCalls,[]);
  });
  await check('L08_NO_WRITER_NO_SOURCE_OR_STATUS_MUTATION',()=>{
    for(const f of fixtures){assert.equal(JSON.stringify(f.world),f.before);assert.deepEqual(f.writes,[]);}
    assert.deepEqual(transportCalls,[]);assert.equal(board.model.activeRevisionId,many.model.activeRevisionId);
    assert.deepEqual(board.model.board.draft,many.model.board.draft);
  });
  console.log(JSON.stringify({status:'PASS',checks,level:'OWNER_READ_AND_REACT_LIBRARY_SHELL_HANDLERS',browser:'NOT_RUN',board:'STUBBED_GEOMETRY_NOT_TESTED',
    ids:many.expenses.map(e=>({businessId:e.id,contextOccurrenceId:`external:${e.id}`})),sql:0,remote:0,writers:0,apply:0}));
}finally{if(root)await act(async()=>root.unmount());Module._load=load;}
