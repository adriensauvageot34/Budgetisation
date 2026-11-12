/** Synthetic Restaurant UI handlers; DOM/portal nodes are mocked, no SQL or durable transport. */
import assert from 'node:assert/strict';
import path from 'node:path';
import Module,{createRequire} from 'node:module';
import {execFileSync} from 'node:child_process';
import {require} from './lib/phase2-ts-loader.mjs';
import {readMonthFixture} from './fixtures/composer-v22-b1.mjs';
import {uuid,householdId} from './fixtures/planner-headless.mjs';
const rr=process.env.PLANNER_REACT_TEST_TOOLS?createRequire(path.resolve(process.env.PLANNER_REACT_TEST_TOOLS,'package.json')):require;
const React=rr('react'),jsx=rr('react/jsx-runtime'),{create,act}=rr('react-test-renderer'),load=Module._load;
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
globalThis.requestAnimationFrame=()=>1;globalThis.cancelAnimationFrame=()=>{};
globalThis.document={body:{}};
let remote=0;globalThis.fetch=async()=>{remote++;throw Error('A3_REMOTE_FORBIDDEN');};
Module._load=function(name,parent,...args){
 if(name==='react')return React;if(name==='react/jsx-runtime')return jsx;
 if(name==='react-dom')return {createPortal:children=>children};
 if(name==='./context-palette'&&parent?.filename?.endsWith('restaurant-editor.tsx'))return {ContextPalette:({question})=>React.createElement('nav',null,question?.choices.map(c=>React.createElement('button',{key:c.key,onClick:c.choose},c.label)))};
 return load.call(this,name,parent,...args);
};
const {handleComposerRequest}=require('@/server/phase2/planner/composer-service');
const {presetCreationFields}=require('@/domain/phase2/planner/composer-presets');
const {stageLocalDecision}=require('@/app/mois-a-venir/composer/local-draft');
const {evaluatePlanScenario}=require('@/server/phase2/planner/preview');
const {RestaurantEditor}=require('@/app/mois-a-venir/composer/restaurant-editor');
const {PlannedContactField}=require('@/app/mois-a-venir/planned-people-fields');
const {InlineEditContext,InlineEditRegistry}=require('@/app/mois-a-venir/composer/inline-edit-registry');
const fixture=await readMonthFixture(),worldBefore=JSON.stringify(fixture.world),id=uuid(94001),selectionId=uuid(94002),otherId=uuid(94003);
const meal={selectionId,optionKey:'restaurant',kind:'COMPONENT',provenance:'EXPLICIT_USER_DECISION',label:'Addition synthétique',quantity:'1',unitBasis:'SHARED',cost:{kind:'MANUAL',unitAmount:'40.00'},fundingAllocations:[],binding:{mode:'EXTRA_TO_SLOT'}};
const initial={contextOccurrenceId:id,templateKey:'restaurant',status:'ACTIVE',parentContextOccurrenceId:null,
 fields:{fieldSchemaVersion:'context-fields@v2',...presetCreationFields('restaurant','restaurant-for-two'),participantRefs:[{kind:'TEXT',label:'Alice synthétique'},{kind:'TEXT',label:'Bob synthétique'}],plannedDate:'2026-11-12',placeRef:{kind:'TEXT',label:'Lieu synthétique',provenance:'USER_DECLARED_PROSPECTIVE'}},
 slotSelections:{meal:{items:[meal]},extras:{items:[{...meal,selectionId:uuid(94004),optionKey:'extra',label:'Supplément explicitement hors addition',cost:{kind:'MANUAL',unitAmount:'5.00'},binding:{mode:'NO_RELATED_SLOT'}}]}},provenance:'EXPLICIT_USER_DECISION'};
const other={...structuredClone(initial),contextOccurrenceId:otherId,fields:{...initial.fields,plannedDate:'2026-11-20'},slotSelections:{}};
async function modelFor(patch){const semantic={...fixture.semantic,contexts:[structuredClone(initial),structuredClone(other)]};if(patch)patch(semantic);
 const r=await handleComposerRequest(fixture.deps,householdId,{kind:'READ',sequence:0,targetMonth:'2026-11',draft:semantic});assert.equal(r.ok,true,r.message);return r.model;}
const base=await modelFor();let root,model,current,accepted,pending,registry,busy;
function Harness(){const [state,setState]=React.useState(current);return React.createElement(InlineEditContext.Provider,{value:registry},React.createElement(RestaurantEditor,{context:state.contexts[0],card:model.board.contexts[0],model,creating:false,busy,close(){},decide(op){const next=stageLocalDecision(model,current,op);if(!next)return false;accepted.push(op);current=next;setState(next);return true;}}));}
const text=n=>typeof n==='string'?n:(n.children??[]).map(text).join('');
const buttons=()=>root.root.findAll(n=>n.type==='button');
const button=label=>buttons().find(n=>text(n)===label);
const removals=()=>buttons().filter(n=>n.props['aria-label']?.startsWith('Retirer '));
const click=async n=>{assert(n,'Expected visible action');assert(!n.props.disabled,'Action must be enabled');await act(async()=>n.props.onClick());};
const choose=async label=>{if(!button(label)&&button('Tous les choix du restaurant'))await click(button('Tous les choix du restaurant'));await click(button(label));};
async function mount(next=base,isBusy=false){if(root)await act(async()=>root.unmount());model=structuredClone(next);current=model.semanticState;accepted=[];pending=null;busy=isBusy;registry=new InlineEditRegistry();registry.requestConfirmation=(_message,accept)=>{pending=accept;};await act(async()=>{root=create(React.createElement(Harness));});if(button('Tous les choix du restaurant'))await click(button('Tous les choix du restaurant'));await click(button('Personnes'));}
const compiled=state=>evaluatePlanScenario(fixture.world,state,{expectedActiveRevisionId:null,expectedActiveRevisionNumber:0}).compiled.components;
const checks=[];const check=async(name,fn)=>{await fn();checks.push(name);console.log(name+' PASS');};
try{
 await check('A3-01-CORRECT-PARTICIPANT-SAME-OCCURRENCE-AND-COST',async()=>{
  await mount();assert.equal(removals().length,2);const before=structuredClone(current),beforeCompiled=compiled(current);
  await click(removals()[1]);
  assert.deepEqual(current.contexts[0].fields.participantRefs,[initial.fields.participantRefs[0]]);
  assert.equal(current.contexts[0].contextOccurrenceId,id);assert.equal(current.contexts[0].slotSelections.meal.items[0].selectionId,selectionId);
  assert.deepEqual({...current.contexts[0],fields:before.contexts[0].fields},before.contexts[0]);
  assert.deepEqual(current.contexts[1],before.contexts[1]);assert.deepEqual(compiled(current),beforeCompiled);
  assert.deepEqual(beforeCompiled.filter(c=>c.contextOccurrenceId===id).map(c=>c.evaluation.economicAmount).sort(),['40.00','5.00']);
  assert.equal(accepted.length,1);assert.deepEqual(Object.keys(accepted[0].edit),['contextOccurrenceId','fields']);
  await choose('Personnes');assert.equal(removals().length,1);
 });
 await check('A3-02-RAW-IS-KEPT-UNTIL-EXPLICIT-DISCARD',async()=>{
  await mount();await act(async()=>root.root.findByType(PlannedContactField).props.onChange({kind:'TEXT',label:'Saisie non validée'}));
  assert.equal(registry.count(),1);await click(removals()[1]);assert(pending);assert.equal(accepted.length,0);
  assert.equal(root.root.findByType(PlannedContactField).props.value.label,'Saisie non validée');
  // Keeping the question open retains the RAW; only its explicit continuation discards it.
  const accept=pending;await act(async()=>accept());assert.equal(registry.count(),0);
  assert.deepEqual(current.contexts[0].fields.participantRefs,[initial.fields.participantRefs[0]]);assert.equal(accepted.length,1);
  assert(!JSON.stringify(current).includes('Saisie non validée'));
 });
 await check('A3-03-PRESERVE-AND-MISSING-CAPABILITY-REFUSE',async()=>{
  const preserved=await modelFor(s=>{s.preferences.flexibility[id]='PRESERVE';});
  for(const guarded of [preserved,{...base,board:{...base.board,contexts:base.board.contexts.map(c=>({...c,capabilityRefs:[]}))}}]){
   await mount(guarded);const before=structuredClone(current);await click(removals()[1]);assert.deepEqual(current,before);assert.equal(accepted.length,0);
   assert(root.root.findAll(n=>n.props.role==='alert').length>0);
  }
 });
 await check('A3-04-UNKNOWN-ZERO-AND-REFERENCE-ARE-NOT-ADOPTED',async()=>{
  for(const cost of [{kind:'UNKNOWN'},{kind:'MANUAL',unitAmount:'0.00'}]){
   const next=await modelFor(s=>{s.contexts[0].slotSelections.meal.items[0].cost=cost;});
   const knowledge=next.cardKnowledge['template:restaurant'];if(knowledge)knowledge.dimensions=knowledge.dimensions.map(d=>({...d,value:'150.00',suggestionPolicy:'REFERENCE_ONLY'}));
   await mount(next);await click(removals()[1]);assert.deepEqual(current.contexts[0].slotSelections.meal.items[0].cost,cost);
   await choose('Montant rapide');assert(!buttons().some(n=>/^Prix observé /.test(text(n))));
   assert(!root.root.findAll(n=>n.type==='input').some(n=>n.props.value==='150.00'));
  }
 });
 await check('A3-05-BUSY-CONTROLS-ARE-DISABLED',async()=>{await mount(base,true);assert.equal(removals().length,2);assert(removals().every(n=>n.props.disabled));assert.equal(accepted.length,0);});
 await check('A3-06-NO-WRITER-SQL-REMOTE-OR-WORLD-CHANGE',()=>{assert.equal(JSON.stringify(fixture.world),worldBefore);assert.deepEqual(fixture.writes,[]);assert.equal(remote,0);});
 console.log(JSON.stringify({status:'PASS',checks,sourceHead:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),level:'RESTAURANT_REACT_HANDLERS_WITH_NODE_AND_PALETTE_HOST_MOCKS',browser:'NOT_RUN',sql:0,remote,writers:fixture.writes.length,save:false,apply:false}));
}finally{if(root)await act(async()=>root.unmount());Module._load=load;}
