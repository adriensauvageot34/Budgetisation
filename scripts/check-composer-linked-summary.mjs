import assert from 'node:assert/strict';
import path from 'node:path';
import Module,{createRequire} from 'node:module';
import {require} from './lib/phase2-ts-loader.mjs';
import {readMonthFixture} from './fixtures/composer-v22-b1.mjs';
import {uuid,householdId} from './fixtures/planner-headless.mjs';
const testRequire=createRequire(path.resolve('outputs/p21-react-tools/package.json'));
const React=testRequire('react'),jsx=testRequire('react/jsx-runtime'),{create,act}=testRequire('react-test-renderer');
const originalLoad=Module._load;globalThis.IS_REACT_ACT_ENVIRONMENT=true;
globalThis.fetch=async()=>{throw Error('LINKED_SUMMARY_REMOTE_FORBIDDEN');};
Module._load=function(name,parent,...args){if(name==='react')return React;if(name==='react/jsx-runtime')return jsx;return originalLoad.call(this,name,parent,...args);};
const {handleComposerRequest}=require('@/server/phase2/planner/composer-service');
const {LinkedIntentions}=require('@/app/mois-a-venir/composer/linked-intentions');
const {BudgetPreviewStatus}=require('@/app/mois-a-venir/composer/intent-budget-impact');
const {semanticStateDigest}=require('@/domain/phase2/planner/semantic-state');
const f=await readMonthFixture(),parentId=uuid(31200),ids=Array.from({length:5},(_,index)=>uuid(31201+index));let model=f.model;
const request=async operation=>{
 const response=await handleComposerRequest(f.deps,householdId,{sequence:0,targetMonth:'2026-11',draft:model.semanticState,...operation});assert(response.ok,response.code);model=response.model;
};
await request({kind:'DROP',assetKey:'template:other-context',presetKey:'composed-outing',target:{kind:'BOARD_ZONE'},identity:parentId,selectionId:uuid(31210),values:{}});
for(const [index,id] of ids.entries())await request({kind:'DROP',assetKey:'template:activity',presetKey:'cinema',target:{kind:'CONTEXT_SOCKET',contextOccurrenceId:parentId,slotKey:'children'},identity:id,selectionId:uuid(31211+index),values:{}});
await request({kind:'EDIT_PRESET_CONTEXT',edit:{contextOccurrenceId:ids[0],slots:{main:[{selectionId:uuid(31220),kind:'COMPONENT',optionKey:'activity',label:'Gratuit explicitement déclaré',provenance:'EXPLICIT_USER_DECISION',quantity:'1',unitBasis:'ITEM',cost:{kind:'MANUAL',unitAmount:'0.00'},fundingAllocations:[],binding:{mode:'NO_RELATED_SLOT'}}]}}});
model={...model,semanticState:{...model.semanticState,preferences:{...model.semanticState.preferences,anchors:[ids[1]]}}};
await request({kind:'READ'});const digest=semanticStateDigest(model.semanticState);let root,setStatus,opened=[];
function Harness(){const [status,update]=React.useState('FRESH');setStatus=update;return React.createElement(BudgetPreviewStatus.Provider,{value:status},React.createElement(LinkedIntentions,{model,parentId,busy:false,open:id=>opened.push(id),decide(){assert.fail('Filtering must not adopt');}}));}
const text=node=>typeof node==='string'?node:(node.children??[]).map(text).join('');
const rows=()=>root.root.findAll(node=>node.type==='li'&&node.props['data-linked-intention']);
const filter=async key=>act(async()=>root.root.findByProps({'data-linked-filter':key}).props.onClick());
try{
 await act(async()=>{root=create(React.createElement(Harness));});assert.equal(rows().length,5);
 assert.match(text(root.root),/4 à compléter · 5 en consultation/);
 await filter('INCOMPLETE');assert.equal(rows().length,4);assert(!rows().some(row=>row.props['data-linked-intention']===ids[0]));assert.match(text(rows()[0]),/Cinéma · 2/);
 await filter('READ_ONLY');assert.equal(rows().length,5,'The owner protects the composition containing an anchored child');
 const selected=rows().find(row=>row.props['data-linked-intention']===ids[1]);
 await act(async()=>selected.findAllByType('button')[0].props.onClick());assert.deepEqual(opened,[ids[1]]);
 await filter('INCOMPLETE');await act(async()=>setStatus('STALE'));assert.equal(rows().length,0);
 assert.match(text(root.root),/Attendez la nouvelle projection/);
 assert.equal(semanticStateDigest(model.semanticState),digest);assert.deepEqual(f.writes,[]);
 console.log(JSON.stringify({status:'PASS',checks:2,remoteWrites:0,apply:false,level:'LOCAL_LINKED_SUMMARY_AND_OWNER'}));
}finally{if(root)await act(async()=>root.unmount());Module._load=originalLoad;}
