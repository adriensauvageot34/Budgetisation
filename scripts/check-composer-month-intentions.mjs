import assert from 'node:assert/strict';
import path from 'node:path';
import Module,{createRequire} from 'node:module';
import {require} from './lib/phase2-ts-loader.mjs';
import {readMonthFixture} from './fixtures/composer-v22-b1.mjs';
import {uuid,householdId} from './fixtures/planner-headless.mjs';
const testRequire=createRequire(path.resolve(process.env.PLANNER_REACT_TEST_TOOLS||'outputs/p21-react-tools','package.json'));
const React=testRequire('react'),jsx=testRequire('react/jsx-runtime'),{create,act}=testRequire('react-test-renderer');
const originalLoad=Module._load;
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
globalThis.window={addEventListener(){},removeEventListener(){}};
globalThis.localStorage={getItem(){return null;},setItem(){assert.fail('No favorite changed');}};
globalThis.fetch=async()=>{throw Error('MONTH_INTENTIONS_REMOTE_FORBIDDEN');};
Module._load=function(name,parent,...args){if(name==='react')return React;if(name==='react/jsx-runtime')return jsx;return originalLoad.call(this,name,parent,...args);};
const {ComposerLibrary}=require('@/app/mois-a-venir/composer/composer-library');
const {BudgetPreviewStatus}=require('@/app/mois-a-venir/composer/intent-budget-impact');
const {composerPreset}=require('@/domain/phase2/planner/composer-presets');
const {libraryOccurrences}=require('@/domain/phase2/planner/composer-library-index');
const {assetEditorKind}=require('@/app/mois-a-venir/composer/asset-editor-routing');
const {handleComposerRequest}=require('@/server/phase2/planner/composer-service');
const {semanticStateDigest}=require('@/domain/phase2/planner/semantic-state');
const f=await readMonthFixture();let model=f.model;
const keys=['bar-apero','techno-night','uber-eats-order','chicken-snack','gift-present','home-evening'];
for(const [index,key] of keys.entries()){
 const response=await handleComposerRequest(f.deps,householdId,{kind:'DROP',sequence:index,targetMonth:'2026-11',draft:model.semanticState,
  assetKey:`template:${composerPreset(key).templateKey}`,presetKey:key,target:{kind:'BOARD_ZONE'},identity:uuid(30600+index),selectionId:uuid(30610+index),values:{}});
 assert(response.ok,response.code);model=response.model;
 assert.equal(libraryOccurrences(model).find(row=>row.contextOccurrenceId===uuid(30600+index))?.action,'EDIT');
}
for(const operation of [
 {assetKey:'template:gift',presetKey:'gift-present',target:{kind:'BOARD_ZONE'},identity:uuid(30620),selectionId:uuid(30621),values:{}},
 {assetKey:'template:activity',target:{kind:'BOARD_ZONE'},identity:uuid(30622),selectionId:uuid(30623),values:{label:'Initiation libre'}},
 {assetKey:'template:other-context',presetKey:'composed-outing',target:{kind:'BOARD_ZONE'},identity:uuid(30630),selectionId:uuid(30631),values:{label:'Projet culturel'}},
 {assetKey:'context-occurrence:'+uuid(30604),target:{kind:'CONTEXT_SOCKET',contextOccurrenceId:uuid(30630),slotKey:'children'},identity:uuid(30604),selectionId:uuid(30632),values:{}},
]){
 const response=await handleComposerRequest(f.deps,householdId,{kind:'DROP',sequence:0,targetMonth:'2026-11',draft:model.semanticState,...operation});
 assert(response.ok,response.code);model=response.model;
}
const gifts=libraryOccurrences(model).filter(row=>row.presetKey==='gift-present');
assert.deepEqual(gifts.map(row=>row.occurrence),[1,2]);
const freeActivity=libraryOccurrences(model).find(row=>row.contextOccurrenceId===uuid(30622));
assert(freeActivity);assert.equal(freeActivity.presetKey,null);assert.equal(freeActivity.action,'EDIT');
assert.equal(assetEditorKind('activity',undefined),'catalog');
const digest=semanticStateDigest(model.semanticState);let root,setStatus,opened=[],prepared=[],searchFocus=0,focusedButton=null;
class Button{constructor(label,visible=true){this.label=label;this.visible=visible;}getClientRects(){return this.visible?[{}]:[];}focus(){focusedButton=this.label;}}
globalThis.HTMLButtonElement=Button;
function Harness(){
 const [status,update]=React.useState('FRESH');setStatus=update;
 return React.createElement(BudgetPreviewStatus.Provider,{value:status},React.createElement(ComposerLibrary,{model,openToken:0,busy:false,selected:null,
  choose(){assert.fail('Reading must not add');},choosePreset(){assert.fail('Reading must not add');},drag(){},inspectContext(){},openContext:id=>opened.push(id),
  prepareProject:starter=>prepared.push(starter.key)}));
}
const text=node=>typeof node==='string'?node:(node.children??[]).map(text).join('');
const rows=()=>root.root.findAll(node=>node.type==='button'&&node.props['data-library-existing-action']);
try{
 await act(async()=>{root=create(React.createElement(Harness),{createNodeMock:element=>element.props['data-library-search']?{focus(){searchFocus++;},closest(){return null;}}:null});});
 const tab=root.root.findAllByType('button').find(node=>text(node)==='Mes intentions');assert(tab);
 await act(async()=>tab.props.onClick());assert.equal(rows().length,keys.length+3);
 await act(async()=>rows()[0].props.onClick());assert.deepEqual(opened,[rows()[0].props['data-library-existing-action']]);
 const search=root.root.findByProps({'data-library-search':true});
 await act(async()=>search.props.onChange({target:{value:'Uber Eats'}}));
 await act(async()=>search.props.onKeyDown({key:'Enter',preventDefault(){}}));assert.equal(opened.at(-1),uuid(30602));
 await act(async()=>search.props.onKeyDown({key:'Escape',preventDefault(){},stopPropagation(){}}));assert.equal(search.props.value,'');assert(searchFocus>0);
 const hidden=new Button('hidden',false),first=new Button('first'),last=new Button('last');
 const scroll=root.root.findByProps({'data-library-scroll':true}),event=key=>({key,target:first,currentTarget:{querySelectorAll:()=>[hidden,first,last]},preventDefault(){},stopPropagation(){}});
 await act(async()=>scroll.props.onKeyDown(event('Home')));assert.equal(focusedButton,'first');
 await act(async()=>scroll.props.onKeyDown(event('End')));assert.equal(focusedButton,'last');
 const beforeFocus=searchFocus;await act(async()=>scroll.props.onKeyDown(event('ArrowUp')));assert.equal(searchFocus,beforeFocus+1);
 await act(async()=>search.props.onChange({target:{value:'culturel'}}));
 assert.equal(rows().length,2);
 const gift=root.root.findByProps({'data-library-existing-action':uuid(30604)});assert.match(text(gift),/Intention 1/);
 await act(async()=>search.props.onChange({target:{value:''}}));
 const filter=root.root.findByProps({'aria-label':'Filtrer les intentions du mois'});
 await act(async()=>filter.props.onChange({target:{value:'INCOMPLETE'}}));
 const expected=model.board.contexts.filter(card=>card.knowledge==='UNKNOWN'||card.knowledge==='PARTIAL').length;
 assert.equal(rows().length,expected);
 await act(async()=>setStatus('STALE'));assert.equal(rows().length,0);
 assert(root.root.findAllByProps({role:'status'}).some(node=>text(node).includes('Actualisez la projection')));
 const addTab=root.root.findAllByType('button').find(node=>text(node)==='À ajouter');
 await act(async()=>addTab.props.onClick());
 await act(async()=>search.props.onChange({target:{value:'quilles dîner'}}));
 assert(root.root.findByProps({'data-library-project-action':'bowling-and-dinner'}));
 assert.doesNotMatch(text(root.root),/Aucune intention correspondante/);
 await act(async()=>search.props.onKeyDown({key:'Enter',preventDefault(){}}));
 assert.deepEqual(prepared,['bowling-and-dinner']);
 assert.equal(semanticStateDigest(model.semanticState),digest);assert.deepEqual(f.writes,[]);
 console.log('MI-01 Published evenings, meals and gifts reopen with exact identities: PASS');
 console.log('MI-02 Month list, official incompleteness and stale protection are read-only: PASS');
 console.log('MI-03 Keyboard skips hidden controls, returns to search and only opens the exact existing intention: PASS');
 console.log('MI-04 A unique project search result opens its preview without adding a decision: PASS');
 console.log(JSON.stringify({status:'PASS',checks:4,remoteWrites:0,apply:false,level:'LOCAL_LIBRARY_AND_OWNER'}));
}finally{if(root)await act(async()=>root.unmount());Module._load=originalLoad;}
