import assert from 'node:assert/strict';
import path from 'node:path';
import Module,{createRequire} from 'node:module';
import {require} from './lib/phase2-ts-loader.mjs';
import {readMonthFixture} from './fixtures/composer-v22-b1.mjs';
import {uuid,householdId} from './fixtures/planner-headless.mjs';
const testRequire=createRequire(path.resolve('outputs/p21-react-tools/package.json'));
const React=testRequire('react'),jsx=testRequire('react/jsx-runtime'),{create,act}=testRequire('react-test-renderer');
const originalLoad=Module._load;let confirmation;
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
globalThis.fetch=async()=>{throw Error('LINKED_MOVE_REMOTE_FORBIDDEN');};
Module._load=function(name,parent,...args){
 if(name==='react')return React;if(name==='react/jsx-runtime')return jsx;
 if(name==='./workshop-confirmation')return {useWorkshopConfirmation:()=>next=>{confirmation=next;}};
 return originalLoad.call(this,name,parent,...args);
};
const {handleComposerRequest}=require('@/server/phase2/planner/composer-service');
const {linkedIntentionMoveTargets,LinkedIntentions}=require('@/app/mois-a-venir/composer/linked-intentions');
const {semanticStateDigest}=require('@/domain/phase2/planner/semantic-state');
const {componentId}=require('@/domain/phase2/planner/identity');
const f=await readMonthFixture(),world=JSON.stringify(f.world),parentId=uuid(30000),otherId=uuid(30001),childId=uuid(30002),relationId=uuid(30003);
const request=async(model,operation)=>{
 const response=await handleComposerRequest(f.deps,householdId,{sequence:0,targetMonth:'2026-11',draft:model.semanticState,...operation});
 assert(response.ok,response.code+': '+response.message);return response.model;
};
let model=f.model;
for(const id of [parentId,otherId])model=await request(model,{kind:'DROP',assetKey:'template:other-context',presetKey:'composed-outing',target:{kind:'BOARD_ZONE'},identity:id,selectionId:uuid(30010),values:{label:'Sortie homonyme'}});
model=await request(model,{kind:'DROP',assetKey:'template:activity',presetKey:'cinema',target:{kind:'CONTEXT_SOCKET',contextOccurrenceId:parentId,slotKey:'children'},identity:childId,selectionId:relationId,values:{}});
const ticket={selectionId:uuid(30004),optionKey:'activity',kind:'COMPONENT',provenance:'EXPLICIT_USER_DECISION',label:'Billet',quantity:'1',unitBasis:'ITEM',cost:{kind:'MANUAL',unitAmount:'12.00'},fundingAllocations:[],binding:{mode:'NO_RELATED_SLOT'}};
model=await request(model,{kind:'EDIT_PRESET_CONTEXT',edit:{contextOccurrenceId:childId,slots:{main:[ticket]}}});
const targets=linkedIntentionMoveTargets(model,parentId,childId);
assert.equal(targets.length,1);assert.equal(targets[0].target.contextOccurrenceId,otherId);assert.match(targets[0].label,/Sortie homonyme · 2/);
for(const anchored of [parentId,childId,otherId,componentId(parentId,'children',relationId)]){
 const protectedModel={...model,semanticState:{...model.semanticState,preferences:{...model.semanticState.preferences,anchors:[anchored]}}};
 assert.deepEqual(linkedIntentionMoveTargets(protectedModel,parentId,childId),[]);
}
const before=structuredClone(model.semanticState.contexts.find(context=>context.contextOccurrenceId===childId));
const initial=model;let accepted=[],root,setModel;
function Harness(){
 const [shown,update]=React.useState(initial);setModel=update;
 return React.createElement(LinkedIntentions,{model:shown,parentId,busy:false,decide(operation){accepted.push(operation);return true;}});
}
const ask=async()=>{confirmation=null;await act(async()=>root.root.findByProps({'data-move-linked':childId}).props.onClick());assert(confirmation);};
try{
 await act(async()=>{root=create(React.createElement(Harness));});
 await ask();assert.equal(accepted.length,0);await act(async()=>confirmation.accept());assert.equal(accepted.length,1);
 const moved=await request(model,accepted[0]);
 const after=moved.semanticState.contexts.find(context=>context.contextOccurrenceId===childId);
 assert.deepEqual(after,{...before,parentContextOccurrenceId:otherId});
 assert.equal(moved.budgetReading.byContext[childId].gross,'12.00');
 assert.equal(moved.semanticState.contexts.length,model.semanticState.contexts.length);
 assert(!moved.board.contexts.find(card=>card.contextOccurrenceId===parentId).childContextOccurrenceIds.includes(childId));
 assert(moved.board.contexts.find(card=>card.contextOccurrenceId===otherId).childContextOccurrenceIds.includes(childId));
 console.log('LM-01 Explicit reparent preserves child identity, components, official price and both homonymous projects: PASS');
 accepted=[];await ask();
 const changed=await request(model,{kind:'EDIT_PRESET_CONTEXT',edit:{contextOccurrenceId:childId,slots:{main:[{...ticket,cost:{kind:'MANUAL',unitAmount:'13.00'}}]}}});
 const digest=semanticStateDigest(changed.semanticState);
 await act(async()=>setModel(changed));await act(async()=>confirmation.accept());assert.equal(accepted.length,0);
 assert(root.root.findAllByProps({role:'alert'}).length>0);assert.equal(semanticStateDigest(changed.semanticState),digest);
 assert.equal(JSON.stringify(f.world),world);assert.deepEqual(f.writes,[]);
 console.log('LM-02 Anchors and stale confirmations refuse mutation without deleting either project: PASS');
 console.log(JSON.stringify({status:'PASS',checks:2,remoteWrites:0,apply:false,level:'LOCAL_REACT_AND_OWNER_FIXTURE'}));
}finally{if(root)await act(async()=>root.unmount());Module._load=originalLoad;}
