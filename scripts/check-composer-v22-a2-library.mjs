/** React handler/identity tests in memory. The node mocks are not a browser certificate. */
import assert from 'node:assert/strict';
import path from 'node:path';
import Module,{createRequire} from 'node:module';
import {require} from './lib/phase2-ts-loader.mjs';
import {readMonthFixture} from './fixtures/composer-v22-b1.mjs';
import {householdId,uuid} from './fixtures/planner-headless.mjs';
const rr=process.env.PLANNER_REACT_TEST_TOOLS?createRequire(path.resolve(process.env.PLANNER_REACT_TEST_TOOLS,'package.json')):require;
const React=rr('react'),{create,act}=rr('react-test-renderer'),load=Module._load;
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
let root,board,registry,fieldNode,focusCount=0,transportCalls=[];
const listeners=new Map();
class NodeMock {
  constructor(props={}){this.props=props;this.open=false;this.isConnected=true;}
  focus(){focusCount++;document.activeElement=this;for(const fn of listeners.get('focusin')??[])fn({target:this});}
  closest(selector){return selector==='aside'?this:null;}
  contains(node){return node===this;}
  matches(selector){return this.props['data-probe-input']?selector.includes('input'):false;}
  show(){this.open=true;}showModal(){this.open=true;}close(){this.open=false;}
  querySelector(selector){
    if(selector.includes('data-library-existing-action')||selector.includes('data-library-add-action')){
      const found=root.root.findAll(n=>n.type==='button'&&!n.props.disabled&&(n.props['data-library-existing-action']||n.props['data-library-add-action']))[0];
      return found?new NodeMock(found.props):null;
    }
    return fieldNode??new NodeMock();
  }
}
globalThis.HTMLElement=NodeMock;globalThis.Element=NodeMock;
globalThis.document={body:new NodeMock(),activeElement:new NodeMock(),querySelector:selector=>selector==='[data-restaurant-editor]'?new NodeMock():null,querySelectorAll:()=>[],
 addEventListener:(name,fn)=>listeners.set(name,new Set([...(listeners.get(name)??[]),fn])),removeEventListener:(name,fn)=>listeners.get(name)?.delete(fn)};
globalThis.window={location:{search:'',pathname:'/fixture'},addEventListener(){},removeEventListener(){}};
Object.defineProperty(globalThis,'navigator',{value:{onLine:true},configurable:true});
globalThis.localStorage={getItem(){return null;},setItem(){}};
globalThis.fetch=async()=>{throw Error('A2_REMOTE_FORBIDDEN');};
let inline;
function ProbeEditor({context,onCancel,close,editorKind}){
 const [raw,setRaw]=React.useState('');const input=React.useRef(null);
 inline.useWorkshopRaw(context.contextOccurrenceId,!!raw,()=>setRaw(''));
 return React.createElement('section',{'data-probe-editor':context.contextOccurrenceId,'data-probe-template':context.templateKey,'data-probe-kind':editorKind},
  React.createElement('input',{ref:input,'data-probe-input':true,value:raw,onChange:event=>setRaw(event.target.value)}),
  React.createElement('button',{'data-probe-close':true,onClick:onCancel??close},'Retour'));
}
const ProbeCatalog=props=>React.createElement(ProbeEditor,{...props,editorKind:'catalog'});
const ProbeRestaurant=props=>React.createElement(ProbeEditor,{...props,editorKind:'restaurant'});
function ProbeBoard(props){board=props;registry=React.useContext(inline.InlineEditContext);return props.contextGuide??null;}
const nullComponent=()=>null;
Module._load=function(name,parent,...args){
 if(name==='react')return React;
 if(parent?.filename?.endsWith('composer-shell.tsx')){
  const mocks={'./composer-board':{ComposerBoard:ProbeBoard},'./composer-cockpit':{ComposerCockpit:nullComponent},
   './composer-financial-inspector':{ComposerFinancialInspector:nullComponent},'./context-palette':{ContextPalette:nullComponent},
   './balance-layer':{BalanceLayer:nullComponent},'./month-reuse':{MonthReuse:nullComponent},'./atomic-popover':{AtomicPopover:nullComponent}};
  if(mocks[name])return mocks[name];
 }
 if(name==='./editor-chunks'&&/composer-(shell|library)\.tsx$/.test(parent?.filename??''))return {
  editorChunks:{catalog:async()=>ProbeCatalog,restaurant:async()=>ProbeRestaurant},preloadEditorForAsset(){},preloadEditorForPreset(){}};
 return load.call(this,name,parent,...args);
};
inline=require('@/app/mois-a-venir/composer/inline-edit-registry');
const {ComposerShell}=require('@/app/mois-a-venir/composer/composer-shell');
const {composerLibraryIndex,filterLibraryIntentions,libraryOccurrences,librarySearchAction}=require('@/domain/phase2/planner/composer-library-index');
const {presetCreationFields,composerPreset}=require('@/domain/phase2/planner/composer-presets');
const {handleComposerRequest}=require('@/server/phase2/planner/composer-service');
const f=await readMonthFixture(),beforeWorld=JSON.stringify(f.world);
const context=(id,key,date)=>{const preset=composerPreset(key);return {contextOccurrenceId:uuid(id),templateKey:preset.templateKey,status:'ACTIVE',parentContextOccurrenceId:null,
 fields:{fieldSchemaVersion:'context-fields@v2',...presetCreationFields(preset.templateKey,key),...(date?{plannedDate:date}:{})},slotSelections:{},provenance:'EXPLICIT_USER_DECISION'};};
const contexts=[context(93001,'mascara','2026-11-10'),context(93002,'mascara','2026-11-20'),context(93003,'restaurant-for-two'),context(93004,'amazon-purchase')];
async function modelFor(contexts){const r=await handleComposerRequest(f.deps,householdId,{kind:'READ',sequence:0,targetMonth:'2026-11',draft:{...f.semantic,contexts}});assert.equal(r.ok,true,r.message);return r.model;}
const one=await modelFor(contexts.slice(0,1)),many=await modelFor(contexts);
const checks=[];const check=async(name,fn)=>{await fn();checks.push(name);console.log(name+' PASS');};
const buttons=()=>root.root.findAll(n=>n.type==='button');
const existing=()=>buttons().filter(n=>n.props['data-library-existing-action']);
const additions=()=>buttons().filter(n=>n.props['data-library-add-action']);
const textOf=node=>typeof node==='string'?node:(node.children??[]).map(textOf).join('');
const search=()=>root.root.find(n=>n.type==='input'&&n.props['data-library-search']!==undefined);
const invoke=async(node,event={})=>{document.activeElement=new NodeMock(node.props);await act(async()=>node.props.onClick(event));};
const query=async value=>act(async()=>search().props.onChange({target:{value}}));
const enter=async()=>act(async()=>search().props.onKeyDown({key:'Enter',nativeEvent:{isComposing:false},preventDefault(){},currentTarget:new NodeMock()}));
const mountedEditor=()=>root.root.findAll(n=>n.props['data-probe-editor']&&n.type==='section');
async function mount(model){if(root)await act(async()=>root.unmount());fieldNode=null;transportCalls=[];await act(async()=>{
 root=create(React.createElement(ComposerShell,{initialModel:model,transport:async request=>{transportCalls.push(request.kind);return handleComposerRequest(f.deps,householdId,request);}}),
  {createNodeMock:element=>{const node=new NodeMock(element.props);if(element.props['data-probe-input'])fieldNode=node;return node;}});
 });}
try{
 await check('A2-01-ABSENT-ADDS-ONE-EXPLICIT-MASCARA',async()=>{
  await mount(f.model);await query('mascara');assert.equal(existing().length,0);assert.equal(additions().length,1);
  assert.equal(additions()[0].props.children.at(-1).props.children,'Ajouter Mascara');await enter();
  assert.equal(board.model.semanticState.contexts.length,1);assert.equal(mountedEditor()[0].props['data-probe-template'],'beauty-restock');
 });
 await check('A2-02-UNIQUE-ENTER-OPENS-EXACT-EDITOR-NO-TRANSPORT',async()=>{
  await mount(one);await query('mascara');assert.equal(existing().length,1);assert.equal(existing()[0].props['data-library-existing-action'],uuid(93001));
  const saveBefore=root.root.find(n=>n.props['data-composer']!==undefined).props['data-save-state'];
  assert.match(textOf(additions()[0]),/Ajouter un autre Mascara/);await enter();
  assert.equal(mountedEditor()[0].props['data-probe-editor'],uuid(93001));assert.equal(board.model.semanticState.contexts.length,1);assert.deepEqual(transportCalls,[]);
  assert.equal(mountedEditor()[0].props['data-probe-kind'],'catalog');
  assert.equal(root.root.find(n=>n.props['data-composer']!==undefined).props['data-save-state'],saveBefore);
  assert.notEqual(saveBefore,'SAVED');assert.match(textOf(root.root),/Brouillon en mémoire/);
 });
 await check('A2-03-TWO-HOMONYMS-ENTER-FOCUSES-WITHOUT-CHOOSING',async()=>{
  await mount(many);await query('mascara');assert.equal(existing().length,2);const focusBefore=focusCount;await enter();
  assert.equal(mountedEditor().length,0);assert(focusCount>focusBefore);assert.equal(document.activeElement.props['data-library-existing-action'],uuid(93001));
  assert.match(existing().map(textOf).join(' '),/10 nov/);assert.match(existing().map(textOf).join(' '),/20 nov/);
  await invoke(existing()[1]);assert.equal(mountedEditor()[0].props['data-probe-editor'],uuid(93002));assert.equal(board.model.semanticState.contexts.length,4);assert.deepEqual(transportCalls,[]);
 });
 await check('A2-04-ADD-ANOTHER-IS-SEPARATE-AND-CREATES-ONCE',async()=>{
  await mount(one);await query('mascara');await invoke(additions()[0]);assert.equal(board.model.semanticState.contexts.length,2);
  assert(board.model.semanticState.contexts.some(c=>c.contextOccurrenceId===uuid(93001)));assert.notEqual(mountedEditor()[0].props['data-probe-editor'],uuid(93001));
 });
 await check('A2-05-RESTAURANT-AND-AMAZON-OPEN-THEIR-OWN-CONTEXT',async()=>{
  for(const [queryText,id,template] of [['restaurant',93003,'restaurant'],['amazon',93004,'purchase']]){
   await mount(many);await query(queryText);await enter();assert.equal(mountedEditor()[0].props['data-probe-editor'],uuid(id));
   assert.equal(mountedEditor()[0].props['data-probe-template'],template);assert.equal(board.model.semanticState.contexts.length,4);assert.deepEqual(transportCalls,[]);
   assert.equal(mountedEditor()[0].props['data-probe-kind'],'restaurant');
  }
 });
 await check('A2-06-READ-ONLY-OR-MISSING-PATCH-ONLY-VIEWS',async()=>{
  for(const patch of [{readOnly:true},{capabilityRefs:[]}]){
   const model=structuredClone(one);Object.assign(model.board.contexts[0],patch);await mount(model);await query('mascara');
   assert.match(textOf(existing()[0]),/Voir Mascara/);await enter();assert.equal(mountedEditor().length,0);
   assert.equal(board.focused,uuid(93001));assert.deepEqual(transportCalls,[]);
  }
  const protectedModel=structuredClone(one);protectedModel.semanticState.preferences.anchors=[uuid(93001)];
  assert.equal(libraryOccurrences(protectedModel)[0].action,'VIEW');
 });
 await check('A2-07-OTHER-MONTH-LEGACY-AND-OTHER-PRESET-NOT-EXACT',()=>{
  const wrong=structuredClone(one);wrong.board.targetMonth='2026-10';assert.equal(libraryOccurrences(wrong).length,0);
  const dated=structuredClone(one);dated.board.contexts[0].fields.plannedDate='2026-10-10';assert.equal(libraryOccurrences(dated).length,0);
  const legacy=structuredClone(one);delete legacy.board.contexts[0].fields.composerPresentation;assert.equal(libraryOccurrences(legacy).length,0);
  const old=structuredClone(one);old.board.contexts[0].fields.composerPresentation.version='obsolete';assert.equal(libraryOccurrences(old).length,0);
  const other=structuredClone(many);const amazon=other.board.contexts.find(c=>c.templateKey==='purchase');amazon.fields.composerPresentation.presetKey='shein-purchase';amazon.label='Amazon';
  assert(!libraryOccurrences(other).some(c=>c.contextOccurrenceId===amazon.contextOccurrenceId));
 });
 await check('A2-08-EXISTING-IS-SEARCHABLE-WHEN-CREATION-IS-BLOCKED',async()=>{
  const model=structuredClone(one);model.dropCapabilities=model.dropCapabilities.filter(c=>c.sourceAssetKey!=='template:beauty-restock'||c.target.kind!=='BOARD_ZONE');
  await mount(model);await query('mascara');assert.equal(existing().length,1);assert.equal(additions().length,0);await enter();assert.equal(mountedEditor()[0].props['data-probe-editor'],uuid(93001));
 });
 await check('A2-09-ACCENTS-ALIASES-AND-AMBIGUOUS-QUERY',()=>{
  const index=composerLibraryIndex(many);assert.equal(filterLibraryIntentions(index.occurrences,'CÍLS').length,2);
  const query='acheter chez amazon',items=filterLibraryIntentions(index.intentions,query),occurrences=filterLibraryIntentions(index.occurrences,query);
  assert.equal(librarySearchAction(items,occurrences,query).contextOccurrenceId,uuid(93004));
  const broad=filterLibraryIntentions(index.intentions,'achat');assert.equal(librarySearchAction(broad,[],'achat').kind,'FOCUS');
 });
 await check('A2-10-RAW-SAME-EDITOR-KEPT-OTHER-OCCURRENCE-GUARDED',async()=>{
  await mount(many);await query('mascara');await invoke(existing()[0]);
  await act(async()=>root.root.find(n=>n.type==='input'&&n.props['data-probe-input']).props.onChange({target:{value:'RAW retained'}}));
  assert.equal(registry.count(),1);await invoke(existing()[0]);assert.equal(root.root.find(n=>n.type==='input'&&n.props['data-probe-input']).props.value,'RAW retained');
  await invoke(existing()[1]);assert.equal(mountedEditor()[0].props['data-probe-editor'],uuid(93001));assert.equal(registry.count(),1);
  const keep=buttons().find(n=>n.props['data-keep-editing']);await invoke(keep);
  assert.equal(root.root.find(n=>n.type==='input'&&n.props['data-probe-input']).props.value,'RAW retained');assert.deepEqual(transportCalls,[]);
  await invoke(existing()[1]);await invoke(buttons().find(n=>n.props['data-confirm-workshop']));assert.equal(mountedEditor()[0].props['data-probe-editor'],uuid(93002));assert.equal(registry.count(),0);
 });
 await check('A2-11-DISABLED-AND-RETURN-FOCUS',async()=>{
  await mount(one);await query('mascara');await invoke(existing()[0]);await invoke(buttons().find(n=>n.props['data-probe-close']));
  assert.equal(document.activeElement.props['data-library-existing-action'],uuid(93001));
  const {ComposerLibrary}=require('@/app/mois-a-venir/composer/composer-library');
  await act(async()=>root.update(React.createElement(ComposerLibrary,{model:one,openToken:0,busy:true,selected:null,choose(){throw Error('Unexpected create');},choosePreset(){throw Error('Unexpected create');},drag(){},inspectContext(){},openContext(){throw Error('Unexpected open');}})));
  await query('mascara');assert(existing().every(n=>n.props.disabled));assert(additions().every(n=>n.props.disabled));await enter();
 });
 await check('A2-12-PRESENTATION-ONLY-NO-FINANCIAL-STATE',()=>{
  assert.equal(JSON.stringify(f.world),beforeWorld);assert.deepEqual(f.writes,[]);
  assert(!transportCalls.some(kind=>['DROP','APPLY','SAVE'].includes(kind)));
 });
 console.log(JSON.stringify({status:'PASS',checks,level:'REACT_HANDLERS_WITH_NODE_AND_EDITOR_STUBS',browser:'NOT_RUN',sql:0,remote:0,writers:f.writes.length,apply:false}));
}finally{if(root)await act(async()=>root.unmount());Module._load=load;}
