import assert from 'node:assert/strict';
import path from 'node:path';
import Module,{createRequire} from 'node:module';
import {require} from './lib/phase2-ts-loader.mjs';
import {readMonthFixture} from './fixtures/composer-v22-b1.mjs';
import {uuid,householdId} from './fixtures/planner-headless.mjs';
const testRequire=createRequire(path.resolve(process.env.PLANNER_REACT_TEST_TOOLS||'outputs/p21-react-tools','package.json'));
const React=testRequire('react'),jsx=testRequire('react/jsx-runtime'),{create,act}=testRequire('react-test-renderer');
const originalLoad=Module._load;let prospective,confirmation;
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
globalThis.fetch=async()=>{throw Error('STAY_CHILD_REMOTE_FORBIDDEN');};
Module._load=function(name,parent,...args){
 if(name==='react')return React;if(name==='react/jsx-runtime')return jsx;
 if(name==='./workshop-confirmation')return {useWorkshopConfirmation:()=>next=>{confirmation=next;}};
 if(name==='./family-visit-editor'&&parent?.filename.endsWith('short-stay-editor.tsx'))return {ProspectiveContextEditor:props=>{prospective=props;return React.createElement('main',null,props.posts);}};
 return originalLoad.call(this,name,parent,...args);
};
const {ShortStayEditor}=require('@/app/mois-a-venir/composer/short-stay-editor');
const {handleComposerRequest}=require('@/server/phase2/planner/composer-service');
const {semanticStateDigest}=require('@/domain/phase2/planner/semantic-state');
const f=await readMonthFixture(),world=JSON.stringify(f.world),parentId=uuid(30400),children=[uuid(30401),uuid(30402)];
let model=f.model;
const request=async operation=>{
 const response=await handleComposerRequest(f.deps,householdId,{sequence:0,targetMonth:'2026-11',draft:model.semanticState,...operation});
 assert(response.ok,response.code);model=response.model;
};
await request({kind:'DROP',assetKey:'template:short-stay',presetKey:'weekend-gite',target:{kind:'BOARD_ZONE'},identity:parentId,selectionId:uuid(30403),values:{}});
for(const [index,id] of children.entries())await request({kind:'DROP',assetKey:'template:activity',presetKey:'cinema',target:{kind:'CONTEXT_SOCKET',contextOccurrenceId:parentId,slotKey:'activities'},identity:id,selectionId:uuid(30410+index),values:{}});
const before=semanticStateDigest(model.semanticState);let root,opened=[],operations=[];
const text=node=>typeof node==='string'?node:(node.children??[]).map(text).join('');
try{
 await act(async()=>{root=create(React.createElement(ShortStayEditor,{context:model.semanticState.contexts.find(context=>context.contextOccurrenceId===parentId),
  semanticState:model.semanticState,targetMonth:'2026-11',householdPersons:[],fresh:false,busy:false,model,
  choose(){assert.fail();},onSave:operation=>{operations.push(operation);return true;},onCancel(){},onOpenChild:id=>opened.push(id)}));});
 await act(async()=>prospective.postsQuestion.choices.find(choice=>choice.key==='activities').choose());
 await act(async()=>root.root.findByProps({'data-open-stay-child':children[0]}).props.onClick());
 const next=root.root.findAllByType('button').find(node=>text(node)==='Suivant');assert(next);
 await act(async()=>next.props.onClick());
 await act(async()=>root.root.findByProps({'data-open-stay-child':children[1]}).props.onClick());
 assert.deepEqual(opened,children);assert.equal(operations.length,0);
 console.log('SC-01 Homonymous child activities open their exact identities without mutation: PASS');
 const remove=root.root.findAllByType('button').find(node=>text(node)==='Retirer ce poste');assert(remove);
 await act(async()=>remove.props.onClick());assert(confirmation);assert.match(confirmation.message,/intention enfant, ses postes/);
 assert(root.root.findByProps({'data-open-stay-child':children[1]}));assert.equal(operations.length,0);
 await act(async()=>confirmation.accept());assert.equal(operations.length,0);assert.equal(semanticStateDigest(model.semanticState),before);
 await act(async()=>{assert(prospective.onSave({kind:'EDIT_SHORT_STAY',edit:{contextOccurrenceId:parentId,fields:{}}}));});
 assert.equal(operations.length,1);await request(operations[0]);
 assert(model.semanticState.contexts.some(context=>context.contextOccurrenceId===children[0]));
 assert.deepEqual(model.semanticState.contexts.find(context=>context.contextOccurrenceId===children[0]).slotSelections,{});
 assert.deepEqual(operations[0].edit.children,[]);
 assert(!model.semanticState.contexts.some(context=>context.contextOccurrenceId===children[1]));
 assert(model.semanticState.contexts.some(context=>context.contextOccurrenceId===parentId));
 assert.equal(JSON.stringify(f.world),world);assert.deepEqual(f.writes,[]);
 console.log('SC-02 Child removal explains its scope, remains local and reaches the owner only after stay validation: PASS');
 console.log(JSON.stringify({status:'PASS',checks:2,remoteWrites:0,apply:false,level:'LOCAL_STAY_EDITOR_AND_OWNER'}));
}finally{if(root)await act(async()=>root.unmount());Module._load=originalLoad;}
