import assert from 'node:assert/strict';
import path from 'node:path';
import Module,{createRequire} from 'node:module';
import {require} from './lib/phase2-ts-loader.mjs';
import {readMonthFixture} from './fixtures/composer-v22-b1.mjs';
import {uuid,householdId} from './fixtures/planner-headless.mjs';
const testRequire=createRequire(path.resolve(process.env.PLANNER_REACT_TEST_TOOLS||'outputs/p21-react-tools','package.json'));
const React=testRequire('react'),jsx=testRequire('react/jsx-runtime'),{create,act}=testRequire('react-test-renderer');
const originalLoad=Module._load;let confirmation;
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
globalThis.fetch=async()=>{throw Error('PROJECT_COMPLETION_REMOTE_FORBIDDEN');};
Module._load=function(name,parent,...args){
 if(name==='react')return React;if(name==='react/jsx-runtime')return jsx;
 if(name==='./workshop-confirmation')return {useWorkshopConfirmation:()=>next=>{confirmation=next;}};
 return originalLoad.call(this,name,parent,...args);
};
const {handleComposerRequest}=require('@/server/phase2/planner/composer-service');
const {projectCompletionSuggestions,ProjectCompletion,ProjectCompletionPreference}=require('@/app/mois-a-venir/composer/project-completion');
const {semanticStateDigest}=require('@/domain/phase2/planner/semantic-state');
const f=await readMonthFixture(),world=JSON.stringify(f.world),parentId=uuid(29900);let counter=29900;
const request=async(draft,operation)=>{
 const response=await handleComposerRequest(f.deps,householdId,{sequence:++counter,targetMonth:'2026-11',draft,...operation});
 assert(response.ok,response.code+': '+response.message);return response.model;
};
const add=async(model,key,parent=null,slot='children')=>request(model.semanticState,{kind:'DROP',assetKey:`template:${key==='composed-outing'?'other-context':key==='weekend-gite'?'short-stay':key==='restaurant-for-two'?'restaurant':'activity'}`,
 presetKey:key,target:parent?{kind:'CONTEXT_SOCKET',contextOccurrenceId:parent,slotKey:slot}:{kind:'BOARD_ZONE'},identity:uuid(++counter),selectionId:uuid(++counter),values:{}});
let model=await request(f.semantic,{kind:'DROP',assetKey:'template:other-context',presetKey:'composed-outing',target:{kind:'BOARD_ZONE'},identity:parentId,selectionId:uuid(++counter),values:{}});
const start=semanticStateDigest(model.semanticState);
assert.deepEqual(projectCompletionSuggestions(model,parentId).map(candidate=>candidate.category),['ACTIVITIES','MEALS']);
assert.deepEqual(projectCompletionSuggestions(model,parentId,'MEALS').map(candidate=>candidate.category),['MEALS','ACTIVITIES']);
const protectedModel={...model,semanticState:{...model.semanticState,preferences:{...model.semanticState.preferences,anchors:[parentId]}}};
assert.deepEqual(projectCompletionSuggestions(protectedModel,parentId),[]);
assert.deepEqual(projectCompletionSuggestions({...model,dropCapabilities:[]},parentId),[]);
let root,setModel,accepted=[];
function Harness(){
 const [shown,update]=React.useState(model);setModel=update;
 const [enabled,toggle]=React.useState(true),[priority,prioritize]=React.useState('BALANCED'),[dismissed,setDismissed]=React.useState({});
 return React.createElement(ProjectCompletionPreference.Provider,{value:{enabled,toggle:()=>toggle(value=>!value),priority,prioritize,dismissed,
  dismiss:(id,key)=>setDismissed(previous=>({...previous,[id]:key===null?[]:[...(previous[id]??[]),key]}))}},
  React.createElement(ProjectCompletion,{model:shown,parentId,busy:false,decide(operation){accepted.push(operation);return true;}}));
}
const text=node=>typeof node==='string'?node:(node.children??[]).map(text).join('');
const buttons=()=>root.root.findAllByType('button');
const click=async label=>{const button=buttons().find(node=>text(node)===label);assert(button,label);await act(async()=>button.props.onClick());};
try{
 await act(async()=>{root=create(React.createElement(Harness));});
 await act(async()=>root.root.findByType('select').props.onChange({target:{value:'MEALS'}}));
 assert.equal(text(buttons().find(node=>text(node).startsWith('Préparer '))),'Préparer Restaurant à deux');
 await click('Masquer Restaurant à deux');assert(!buttons().some(node=>text(node)==='Préparer Restaurant à deux'));
 await click('Désactiver pour cette session');assert(!buttons().some(node=>text(node).startsWith('Préparer ')));
 await click('Réactiver les suggestions de projet');await click('Réafficher les suggestions masquées');
 assert.equal(accepted.length,0);assert.equal(semanticStateDigest(model.semanticState),start);
 console.log('S3-01 Deterministic priority, permission filtering and reversible session controls without mutation: PASS');
 await click('Préparer Restaurant à deux');assert(confirmation);assert.equal(accepted.length,0);
 model=await add(model,'restaurant-for-two',parentId);
 await act(async()=>setModel(model));await act(async()=>confirmation.accept());assert.equal(accepted.length,0);
 console.log('S3-02 A previously adopted complement invalidates an open confirmation: PASS');
 await click('Préparer Cinéma');await act(async()=>confirmation.accept());assert.equal(accepted.length,1);
 assert.equal(accepted[0].target.contextOccurrenceId,parentId);
 model=await request(model.semanticState,accepted[0]);
 assert.deepEqual(projectCompletionSuggestions(model,parentId),[]);
 console.log('S3-03 Explicit adoption uses the existing owner and suppresses the realized suggestion: PASS');
 const weekend=await add(model,'weekend-gite');
 const stayId=weekend.semanticState.contexts.find(context=>context.templateKey==='short-stay').contextOccurrenceId;
 assert.equal(projectCompletionSuggestions(weekend,stayId).length,2);
 const culture=await add(weekend,'museum-exhibition',stayId,'activities');
 assert.deepEqual(projectCompletionSuggestions(culture,stayId).map(candidate=>candidate.preset.presetKey),['hiking-nature']);
 const complete=await add(culture,'hiking-nature',stayId,'activities');
 assert.deepEqual(projectCompletionSuggestions(complete,stayId),[]);
 assert.equal(JSON.stringify(f.world),world);assert.deepEqual(f.writes,[]);
 console.log('S3-04 Weekend complements follow the actual children without repeating an existing activity: PASS');
 console.log(JSON.stringify({status:'PASS',checks:4,remoteWrites:0,apply:false,level:'LOCAL_REACT_AND_OWNER_FIXTURE'}));
}finally{if(root)await act(async()=>root.unmount());Module._load=originalLoad;}
