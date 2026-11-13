import assert from 'node:assert/strict';
import path from 'node:path';
import Module,{createRequire} from 'node:module';
import {require} from './lib/phase2-ts-loader.mjs';
import {readMonthFixture} from './fixtures/composer-v22-b1.mjs';
import {uuid,householdId} from './fixtures/planner-headless.mjs';
const testRequire=createRequire(path.resolve('outputs/p21-react-tools/package.json'));
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
const digest=semanticStateDigest(model.semanticState);let root,setStatus,opened=[];
function Harness(){
 const [status,update]=React.useState('FRESH');setStatus=update;
 return React.createElement(BudgetPreviewStatus.Provider,{value:status},React.createElement(ComposerLibrary,{model,openToken:0,busy:false,selected:null,
  choose(){assert.fail('Reading must not add');},choosePreset(){assert.fail('Reading must not add');},drag(){},inspectContext(){},openContext:id=>opened.push(id)}));
}
const text=node=>typeof node==='string'?node:(node.children??[]).map(text).join('');
const rows=()=>root.root.findAll(node=>node.type==='button'&&node.props['data-library-existing-action']);
try{
 await act(async()=>{root=create(React.createElement(Harness));});
 const tab=root.root.findAllByType('button').find(node=>text(node)==='Mes intentions');assert(tab);
 await act(async()=>tab.props.onClick());assert.equal(rows().length,keys.length);
 await act(async()=>rows()[0].props.onClick());assert.deepEqual(opened,[rows()[0].props['data-library-existing-action']]);
 const filter=root.root.findByProps({'aria-label':'Filtrer les intentions du mois'});
 await act(async()=>filter.props.onChange({target:{value:'INCOMPLETE'}}));
 const expected=model.board.contexts.filter(card=>card.knowledge==='UNKNOWN'||card.knowledge==='PARTIAL').length;
 assert.equal(rows().length,expected);
 await act(async()=>setStatus('STALE'));assert.equal(rows().length,0);
 assert(root.root.findAllByProps({role:'status'}).some(node=>text(node).includes('Actualisez la projection')));
 assert.equal(semanticStateDigest(model.semanticState),digest);assert.deepEqual(f.writes,[]);
 console.log('MI-01 Published evenings, meals and gifts reopen with exact identities: PASS');
 console.log('MI-02 Month list, official incompleteness and stale protection are read-only: PASS');
 console.log(JSON.stringify({status:'PASS',checks:2,remoteWrites:0,apply:false,level:'LOCAL_LIBRARY_AND_OWNER'}));
}finally{if(root)await act(async()=>root.unmount());Module._load=originalLoad;}
