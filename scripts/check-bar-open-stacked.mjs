/** Targeted interaction/owner proof. No native input or authenticated claim. */
import assert from 'node:assert/strict';
import Module,{createRequire} from 'node:module';
import {require} from './lib/phase2-ts-loader.mjs';
import {barCompactMonth} from './fixtures/bar-compact-clay.mjs';
import {householdId,uuid} from './fixtures/planner-headless.mjs';
import {createKernelPostgres} from './lib/planner-kernel-postgres.mjs';
const rr=createRequire(new URL('../outputs/l4c-test-tools/package.json',import.meta.url));
const React=rr('react'),{create,act}=rr('react-test-renderer'),load=Module._load;
Module._load=function(name,...args){if(name==='react')return React;if(name==='react-dom')return{createPortal:n=>n};return load.call(this,name,...args);};
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
globalThis.requestAnimationFrame=cb=>{cb();return 0;};globalThis.cancelAnimationFrame=()=>{};
globalThis.HTMLElement=class{};globalThis.ResizeObserver=class{observe(){}disconnect(){}};
globalThis.document={activeElement:null,body:{},addEventListener(){},removeEventListener(){},querySelector(){return null;}};
globalThis.fetch=async()=>{throw Error('REMOTE_NETWORK_FORBIDDEN');};
const {BarLivingEditor}=require('@/app/mois-a-venir/composer/bar-living-editor');
const {WorkshopConfirmationProvider}=require('@/app/mois-a-venir/composer/workshop-confirmation');
const {WorkshopChoicesProvider}=require('@/app/mois-a-venir/composer/workshop-choices');
const {InlineEditRegistry,InlineEditContext}=require('@/app/mois-a-venir/composer/inline-edit-registry');
const {ComposerInteractionContext}=require('@/app/mois-a-venir/composer/interactions');
const {stageLocalDecision,visualDraftModel}=require('@/app/mois-a-venir/composer/local-draft');
const {nightOutConsumption}=require('@/domain/phase2/planner/night-out-consumption');
const {handleComposerRequest}=require('@/server/phase2/planner/composer-service');
const {createPlanApplyRepository}=require('@/server/phase2/planner/repository');
const pg=await createKernelPostgres(),fixture=barCompactMonth('mixed'),id=uuid(99500),childId=uuid(99501);
// Explicit owner default in the input fixture: an unrelated DROP normalizes
// omitted bindings to AUTO. Compare complete decisions rather than conflating
// this pre-existing normalization with a change to a component.
for(const c of fixture.semantic.contexts)for(const slot of Object.values(c.slotSelections))for(const item of slot.items)if(item.kind==='COMPONENT')item.binding??={mode:'AUTO'};
globalThis.window={addEventListener(){},removeEventListener(){}};
const deps={repository:createPlanApplyRepository(pg.client),readWorld:async()=>fixture.world,householdPersons:[]};
let root,model,ops=[],dragKey,sequence=0;const checks=[];
const parent=()=>model.semanticState.contexts.find(c=>c.contextOccurrenceId===id);
const child=()=>model.semanticState.contexts.find(c=>c.contextOccurrenceId===childId);
const registry=new InlineEditRegistry(),requestRef={current(){}};
registry.requestConfirmation=(message,accept,save)=>requestRef.current({message,accept,save,acceptLabel:'Abandonner cette saisie'});
const nodes=predicate=>root.root.findAll(n=>typeof n.type==='string'&&predicate(n));
const text=n=>typeof n==='string'?n:n?.children?.map(text).join('')??'';
const button=label=>nodes(n=>n.type==='button'&&(n.props['aria-label']===label||text(n)===label))[0];
const click=async label=>{const b=button(label);assert(b,`Missing ${label}`);await act(async()=>b.props.onClick());};
const editorProps=()=>({context:parent(),card:model.board.contexts.find(c=>c.contextOccurrenceId===id),model,semanticState:model.semanticState,targetMonth:'2026-11',householdPersons:[],options:model.mobilityOptions,busy:false,fresh:true,dockHost:{},onCancel(){},onSave:operation=>{
 const next=stageLocalDecision(model,model.semanticState,operation);if(!next)return false;ops.push(operation);model=visualDraftModel(model,next);root.update(render());return true;
}});
const render=()=>React.createElement(WorkshopConfirmationProvider,{requestRef},React.createElement(WorkshopChoicesProvider,null,
 React.createElement(InlineEditContext.Provider,{value:registry},React.createElement(ComposerInteractionContext.Provider,{value:{start(key){dragKey=key;},end(){}}},React.createElement(BarLivingEditor,editorProps())))));
const confirmation=()=>nodes(n=>n.type==='dialog'&&n.props['data-workshop-confirmation']!==undefined)[0];
try{
 const read=await handleComposerRequest(deps,householdId,{kind:'READ',sequence:++sequence,targetMonth:'2026-11',draft:fixture.semantic});assert(read.ok,read.message);model=read.model;
 await act(async()=>{root=create(render(),{createNodeMock:e=>e.type==='dialog'?{open:false,showModal(){this.open=true;},close(){this.open=false;},contains(){return false;},querySelector(){return{focus(){}};}}:null});});
 assert.equal(nodes(n=>n.type==='nav'&&n.props['aria-label']==='Moments de consommation').length,0);
 assert.equal(nodes(n=>n.props['data-bar-return-direct']!==undefined).length,0);
 assert.equal(nodes(n=>n.type==='img'&&n.props.src?.includes('before-editorial')).length,0);
 assert.deepEqual(nodes(n=>n.props['data-bar-section']).map(n=>n.props['data-bar-section']),['before','extras']);checks.push('REDUNDANT_CONTROLS_REMOVED');
 const beforeState=structuredClone(child()),originalParent=structuredClone(parent());
 const sourceKey=`context-occurrence:${childId}`,source=model.presentation.dragSources[sourceKey];
 assert(source&&!source.protected&&source.removeOperation,'existing owner must publish whole Before removal');
 const handle=nodes(n=>n.props['data-bar-before-drag']!==undefined)[0];assert.equal(handle.props.draggable,true);
 await act(async()=>handle.props.onDragStart({stopPropagation(){},preventDefault(){throw Error('unexpected block');}}));assert.equal(dragKey,sourceKey);
 const removed=await handleComposerRequest(deps,householdId,{...source.removeOperation,sequence:++sequence,targetMonth:'2026-11',draft:model.semanticState});assert(removed.ok,removed.message);
 assert(!removed.model.semanticState.contexts.some(c=>c.contextOccurrenceId===childId));
 assert.deepEqual(removed.model.semanticState.contexts.find(c=>c.contextOccurrenceId===id).slotSelections.extras,originalParent.slotSelections.extras);
 assert(!removed.model.semanticState.contexts.find(c=>c.contextOccurrenceId===id).slotSelections.before?.items.length);
 const undo=await handleComposerRequest(deps,householdId,{kind:'READ',sequence:++sequence,targetMonth:'2026-11',draft:model.semanticState});assert(undo.ok);assert.deepEqual(undo.model.semanticState,model.semanticState);checks.push('PUBLISHED_WHOLE_BEFORE_DROP_AND_RESTORE');
 await click('Modifier le montant · proposer un montant direct pour Au bar');assert.equal(ops.length,0);assert.match(text(confirmation()),/Le Before, les trajets et les autres contributions indépendantes restent inchangés/);
 await click('Annuler');assert.deepEqual(parent(),originalParent);assert.deepEqual(child(),beforeState);checks.push('DIRECT_CANCEL_NO_MUTATION');
 await click('Modifier le montant · proposer un montant direct pour Au bar');await click('Passer au montant direct');
 const amount=()=>nodes(n=>n.type==='input'&&n.props['data-bar-inline-amount']!==undefined)[0];assert(amount());
 await act(async()=>amount().props.onChange({target:{value:'40'}}));
 await act(async()=>amount().props.onKeyDown({key:'Enter',nativeEvent:{},preventDefault(){},stopPropagation(){}}));
 assert.equal(nightOutConsumption(parent()).mode,'DIRECT');assert.deepEqual(child(),beforeState);
 assert.equal(nightOutConsumption(parent()).inactive.length,originalParent.slotSelections.extras.items.length);checks.push('DIRECT_ONLY_AU_BAR_PRESERVES_BEFORE');
 await click('Détailler les consommations');assert.equal(nightOutConsumption(parent()).mode,'DETAILED');assert.deepEqual(parent().slotSelections.extras,originalParent.slotSelections.extras);checks.push('DETAILS_RESTORE_EXACT_IDENTITIES');
 await click('Ajouter un objet au Before');await click('Boissons');await click('Rhum');
 assert.equal(child().slotSelections.extras.items.length,beforeState.slotSelections.extras.items.length+1);assert.deepEqual(parent().slotSelections.extras,originalParent.slotSelections.extras);checks.push('PLUS_BEFORE_OWNS_ADDITION');
 const beforeQuantity=structuredClone(child());
 const input=label=>nodes(n=>n.type==='input'&&n.props['aria-label']===label)[0];
 await act(async()=>input('Quantité totale').props.onChange({target:{value:'2'}}));await click('Enregistrer');
 await click(nodes(n=>n.type==='button'&&n.props['aria-label']?.startsWith('Rhum · Quantité 2 ·'))[0].props['aria-label']);
 await act(async()=>input('Prix unitaire (€)').props.onChange({target:{value:'8'}}));await click('Enregistrer');
 const changed=child().slotSelections.extras.items.find(i=>i.label==='Rhum');assert.equal(changed.quantity,'2');assert.equal(changed.cost.unitAmount,'8');
 assert.deepEqual(child().slotSelections.extras.items.filter(i=>i.selectionId!==changed.selectionId),beforeQuantity.slotSelections.extras.items.filter(i=>i.selectionId!==changed.selectionId));
 assert.deepEqual(parent().slotSelections.extras,originalParent.slotSelections.extras);checks.push('QUANTITY_PRICE_ONLY_TOUCH_SELECTED_BEFORE_ITEM');
 await click(nodes(n=>n.type==='button'&&n.props['aria-label']?.startsWith('Rhum · Quantité 2 ·'))[0].props['aria-label']);
 const row=nodes(n=>n.props['data-bar-active-tile']===true)[0];const quantity=row.findAll(n=>n.type==='input'&&n.props['aria-label']?.includes('Quantité'))[0]
   ??row.findAll(n=>n.type==='input')[0];assert(quantity);
 await act(async()=>quantity.props.onChange({target:{value:'2,'}}));
 assert.equal(nodes(n=>n.props['data-bar-before-drag']!==undefined).length,0,'RAW removes drag admission');
 const beforeRaw=structuredClone(model.semanticState);await click('Ajouter une consommation');assert.match(text(confirmation()),/saisie/i);assert.deepEqual(model.semanticState,beforeRaw);
 await click('Continuer à modifier');assert.equal(nodes(n=>n.type==='input'&&n.props.value==='2,').length,1);checks.push('RAW_TRANSITION_CANCEL_PRESERVES_BUFFER');
 await click('Ajouter une consommation');await click('Abandonner cette saisie');await click('Boissons');await click('Bière');
 assert.equal(parent().slotSelections.extras.items.length,originalParent.slotSelections.extras.items.length+1);assert.equal(child().slotSelections.extras.items.length,beforeState.slotSelections.extras.items.length+1);checks.push('PLUS_AU_BAR_NEVER_WRITES_BEFORE');
 const final=await handleComposerRequest(deps,householdId,{kind:'READ',sequence:++sequence,targetMonth:'2026-11',draft:model.semanticState});assert(final.ok,final.message);checks.push('COMPILER_READ_RETAINS_ADMITTED_STATE');
 await pg.verifyCanaries();assert.deepEqual(await pg.counts(),{plans:0,revisions:0});
 console.log(JSON.stringify({status:'PASS',checks,level:'REACT_REAL_OWNERS_PGLITE_SYNTHETIC_NOT_NATIVE_OR_AUTH',remoteWrites:0}));
}finally{if(root)await act(async()=>root.unmount());await pg.close();}
