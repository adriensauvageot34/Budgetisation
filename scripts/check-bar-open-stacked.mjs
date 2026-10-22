/** Targeted interaction/owner proof. No native input or authenticated claim. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import Module,{createRequire} from 'node:module';
import {require} from './lib/phase2-ts-loader.mjs';
import {barCompactMonth} from './fixtures/bar-compact-clay.mjs';
import {householdId,uuid} from './fixtures/planner-headless.mjs';
import {createKernelPostgres} from './lib/planner-kernel-postgres.mjs';
import {userId} from './fixtures/planner-kernel.mjs';
const rr=createRequire(new URL('../outputs/l4c-test-tools/package.json',import.meta.url));
const React=rr('react'),{create,act}=rr('react-test-renderer'),load=Module._load;
Module._load=function(name,...args){if(name==='react')return React;if(name==='react-dom')return{createPortal:n=>n};return load.call(this,name,...args);};
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
globalThis.requestAnimationFrame=cb=>{cb();return 0;};globalThis.cancelAnimationFrame=()=>{};
globalThis.HTMLElement=class{};globalThis.HTMLInputElement=class extends globalThis.HTMLElement{};globalThis.ResizeObserver=class{observe(){}disconnect(){}};
globalThis.document={activeElement:null,body:{},addEventListener(){},removeEventListener(){},querySelector(){return null;}};
globalThis.fetch=async()=>{throw Error('REMOTE_NETWORK_FORBIDDEN');};
const {BarLivingEditor}=require('@/app/mois-a-venir/composer/bar-living-editor');
const {WorkshopConfirmationProvider}=require('@/app/mois-a-venir/composer/workshop-confirmation');
const {WorkshopChoicesProvider}=require('@/app/mois-a-venir/composer/workshop-choices');
const {InlineEditRegistry,InlineEditContext}=require('@/app/mois-a-venir/composer/inline-edit-registry');
const {ComposerInteractionContext}=require('@/app/mois-a-venir/composer/interactions');
const {stageLocalDecision,visualDraftModel}=require('@/app/mois-a-venir/composer/local-draft');
const {nightOutConsumption}=require('@/domain/phase2/planner/night-out-consumption');
const {barBefore}=require('@/app/mois-a-venir/composer/bar-before');
const {handleComposerRequest}=require('@/server/phase2/planner/composer-service');
const {createPlanApplyRepository}=require('@/server/phase2/planner/repository');
const {editNightOut}=require('@/domain/phase2/planner/night-out-edit');
const {plannerDigest}=require('@/domain/phase2/planner/json');
const {parsePlanSemanticState,semanticStateDigest}=require('@/domain/phase2/planner/semantic-state');
const {saveComposerDraft,readComposerDrafts}=require('@/server/phase2/planner/composer-draft-service');
const pg=await createKernelPostgres(),fixture=barCompactMonth('mixed'),id=uuid(99500),childId=uuid(99501);
// Explicit owner default in the input fixture: an unrelated DROP normalizes
// omitted bindings to AUTO. Compare complete decisions rather than conflating
// this pre-existing normalization with a change to a component.
for(const c of fixture.semantic.contexts)for(const slot of Object.values(c.slotSelections))for(const item of slot.items)if(item.kind==='COMPONENT')item.binding??={mode:'AUTO'};
globalThis.window={addEventListener(){},removeEventListener(){}};
const deps={repository:createPlanApplyRepository(pg.client),readWorld:async()=>fixture.world,readMobilityOptions:async()=>({places:fixture.world.mobilityFacts.places,vehicle:fixture.world.mobilityFacts.vehicle}),householdPersons:[]};
let root,model,ops=[],dragKey,sequence=0,initialTarget;const checks=[];
const parent=()=>model.semanticState.contexts.find(c=>c.contextOccurrenceId===id);
const child=()=>barBefore(model.semanticState,parent())?.child;
const registry=new InlineEditRegistry(),requestRef={current(){}};
registry.requestConfirmation=(message,accept,save)=>requestRef.current({message,accept,save,acceptLabel:'Abandonner cette saisie'});
const nodes=predicate=>root.root.findAll(n=>typeof n.type==='string'&&predicate(n));
const text=n=>typeof n==='string'?n:n?.children?.map(text).join('')??'';
const button=label=>nodes(n=>n.type==='button'&&(n.props['aria-label']===label||text(n)===label))[0];
const click=async label=>{const b=button(label);assert(b,`Missing ${label}`);await act(async()=>b.props.onClick());};
const enterRow=async(isComposing=false)=>{const field=nodes(n=>n.type==='fieldset'&&typeof n.props.onKeyDown==='function')[0];assert(field);await act(async()=>field.props.onKeyDown({key:'Enter',target:new HTMLInputElement(),nativeEvent:{isComposing},preventDefault(){},stopPropagation(){}}));};
const editorProps=()=>({initialTarget,context:parent(),card:model.board.contexts.find(c=>c.contextOccurrenceId===id),model,semanticState:model.semanticState,targetMonth:'2026-11',householdPersons:[],options:model.mobilityOptions,busy:false,fresh:true,dockHost:{},onCancel(){},onSave:operation=>{
 const next=stageLocalDecision(model,model.semanticState,operation);if(!next)return false;ops.push(operation);model=visualDraftModel(model,next);root.update(render());return true;
}});
const render=()=>React.createElement(WorkshopConfirmationProvider,{requestRef},React.createElement(WorkshopChoicesProvider,null,
 React.createElement(InlineEditContext.Provider,{value:registry},React.createElement(ComposerInteractionContext.Provider,{value:{start(key){dragKey=key;},end(){}}},React.createElement(BarLivingEditor,editorProps())))));
const confirmation=()=>nodes(n=>n.type==='dialog'&&n.props['data-workshop-confirmation']!==undefined)[0];
try{
 const read=await handleComposerRequest(deps,householdId,{kind:'READ',sequence:++sequence,targetMonth:'2026-11',draft:fixture.semantic});assert(read.ok,read.message);model=read.model;const homeOption=model.mobilityOptions.places.find(p=>p.privatePlace);assert.equal(homeOption.routeResolvable,true);assert.equal(homeOption.coordinates,undefined);assert.equal(homeOption.address,undefined);
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
 await click('Détailler les consommations');assert.equal(nightOutConsumption(parent()).mode,'DIRECT');await click('Détailler Au bar');assert.equal(nightOutConsumption(parent()).mode,'DETAILED');assert.deepEqual(parent().slotSelections.extras,originalParent.slotSelections.extras);checks.push('DETAILS_RESTORE_EXACT_IDENTITIES');
 await click('Ajouter un objet au Before');await click('Boissons');await click('Rhum');
 assert.equal(child().slotSelections.extras.items.length,beforeState.slotSelections.extras.items.length+1);assert.deepEqual(parent().slotSelections.extras,originalParent.slotSelections.extras);checks.push('PLUS_BEFORE_OWNS_ADDITION');
 const beforeQuantity=structuredClone(child());
 const input=label=>nodes(n=>n.type==='input'&&n.props['aria-label']===label)[0];
 await act(async()=>input('Quantité totale').props.onChange({target:{value:'2'}}));await enterRow();
 await click(nodes(n=>n.type==='button'&&n.props['aria-label']?.startsWith('Rhum · Quantité 2 ·'))[0].props['aria-label']);
 await act(async()=>input('Prix unitaire (€)').props.onChange({target:{value:'8'}}));const beforeIme=structuredClone(model.semanticState);await enterRow(true);assert.deepEqual(model.semanticState,beforeIme);await enterRow();
 const changed=child().slotSelections.extras.items.find(i=>i.label==='Rhum');assert.equal(changed.quantity,'2');assert.equal(changed.cost.unitAmount,'8');
 assert.deepEqual(child().slotSelections.extras.items.filter(i=>i.selectionId!==changed.selectionId),beforeQuantity.slotSelections.extras.items.filter(i=>i.selectionId!==changed.selectionId));
 assert.deepEqual(parent().slotSelections.extras,originalParent.slotSelections.extras);checks.push('QUANTITY_PRICE_ONLY_TOUCH_SELECTED_BEFORE_ITEM');
 await click(nodes(n=>n.type==='button'&&n.props['aria-label']?.startsWith('Rhum · Quantité 2 ·'))[0].props['aria-label']);
 const row=nodes(n=>n.props['data-bar-active-tile']===true)[0];const quantity=row.findAll(n=>n.type==='input'&&n.props['aria-label']?.includes('Quantité'))[0]
   ??row.findAll(n=>n.type==='input')[0];assert(quantity);
 await act(async()=>quantity.props.onChange({target:{value:'2,'}}));
 assert.equal(nodes(n=>n.props['data-bar-before-drag']!==undefined).length,0,'RAW removes drag admission');
 const beforeRaw=structuredClone(model.semanticState);await enterRow();assert.deepEqual(model.semanticState,beforeRaw);await click('Ajouter une consommation');assert.match(text(confirmation()),/saisie/i);assert.deepEqual(model.semanticState,beforeRaw);
 await click('Continuer à modifier');assert.equal(nodes(n=>n.type==='input'&&n.props.value==='2,').length,1);checks.push('RAW_TRANSITION_CANCEL_PRESERVES_BUFFER');
 await click('Ajouter une consommation');await click('Abandonner cette saisie');await click('Boissons');await click('Bière');
 assert.equal(parent().slotSelections.extras.items.length,originalParent.slotSelections.extras.items.length+1);assert.equal(child().slotSelections.extras.items.length,beforeState.slotSelections.extras.items.length+1);checks.push('PLUS_AU_BAR_NEVER_WRITES_BEFORE');
 const final=await handleComposerRequest(deps,householdId,{kind:'READ',sequence:++sequence,targetMonth:'2026-11',draft:model.semanticState});assert(final.ok,final.message);checks.push('COMPILER_READ_RETAINS_ADMITTED_STATE');

 // Empty / partially populated / DIRECT are independent entry states, never
 // inferred from the already populated mixed fixture above.
 const mount=async semantic=>{
   if(root)await act(async()=>root.unmount());root=null;ops=[];
   const read=await handleComposerRequest(deps,householdId,{kind:'READ',sequence:++sequence,targetMonth:'2026-11',draft:semantic});assert(read.ok,read.message);model=read.model;
   const admitted=structuredClone(model.semanticState);
   await act(async()=>{root=create(render(),{createNodeMock:e=>e.type==='dialog'?{open:false,showModal(){this.open=true;},close(){this.open=false;},contains(){return false;},querySelector(){return{focus(){}};}}:null});});
   assert.deepEqual(model.semanticState,admitted,'mount is presentation only');assert.equal(ops.length,0);return admitted;
 };
 const empty=()=>barCompactMonth('meta').semantic;
 const assertEntry=()=>{assert(button('+ Before'),'missing empty Before entry');assert(button('+ Au bar'),'missing empty Au bar entry');};
 await mount(barCompactMonth('empty').semantic);assertEntry();assert.equal(parent().fields.plannedDate,null);assert.equal(parent().fields.placeRef,null);checks.push('NO_METADATA_EMPTY_ENTRY_NO_INVENTED_DECISION');
 await mount(empty());assertEntry();await click('+ Before');assert.equal(ops.length,0);await click('Boissons');await click('Vodka');
 assert(child());assert.equal(child().slotSelections.main.items[0].label,'Vodka');assert.equal(parent().slotSelections.extras?.items.length??0,0);checks.push('EMPTY_CREATE_BEFORE');
 await mount(empty());assertEntry();await click('+ Au bar');assert.equal(ops.length,0);await click('Boissons');await click('Bière');
 assert.equal(parent().slotSelections.extras.items[0].label,'Bière');assert.equal(child(),undefined);checks.push('EMPTY_ADD_AU_BAR');
 await mount(barCompactMonth('before').semantic);assert(button('Ajouter un objet au Before'));assert(button('+ Au bar'));
 const existingBefore=structuredClone(child());await click('+ Au bar');await click('Boissons');await click('Cocktail');assert.deepEqual(child(),existingBefore);checks.push('BEFORE_PRESENT_BAR_EMPTY_BOTH_PATHS');
 const onlyBar=structuredClone(barCompactMonth('mixed').semantic);onlyBar.contexts=onlyBar.contexts.filter(c=>c.contextOccurrenceId!==childId);delete onlyBar.contexts[0].slotSelections.before;
 await mount(onlyBar);assert(button('+ Before'));assert(nodes(n=>n.props['aria-label']?.startsWith('Planche de tapas · Quantité 1 ·')).length);assert(button('Ajouter une consommation'));checks.push('BAR_PRESENT_BEFORE_ABSENT');
 const twenty=structuredClone(onlyBar);twenty.contexts[0].slotSelections.extras.items=Array.from({length:20},(_,i)=>({...structuredClone(onlyBar.contexts[0].slotSelections.extras.items[0]),selectionId:uuid(99900+i),label:`Consommation synthétique ${i+1}`}));
 const twentyAdmitted=await mount(twenty);assert.equal(parent().slotSelections.extras.items.length,20);assert.equal(model.board.contexts.find(c=>c.contextOccurrenceId===id).sockets.find(s=>s.slotKey==='extras').currentItems.length,20);
 assert.equal(nodes(n=>n.props['data-bar-group']!==undefined).reduce((sum,n)=>sum+Number(n.props['data-bar-group-lines']),0),20);assert(button('+ Before'));assert(button('Ajouter une consommation'));assert.deepEqual(model.semanticState,twentyAdmitted);checks.push('TWENTY_EXISTING_COMPONENTS_MODEL_AND_RENDER_PARITY');
 let detailedEmpty=empty();detailedEmpty=editNightOut(detailedEmpty,{contextOccurrenceId:id,fields:{},consumption:{mode:'DETAILED',expectedContextDigest:plannerDigest(detailedEmpty.contexts[0]),acceptLegacy:true}});
 await mount(detailedEmpty);assertEntry();await click('+ Au bar');assert.equal(ops.length,0);assert(button('Boissons'));checks.push('DETAILED_EMPTY_ADDITION_AVAILABLE');
 await mount(empty());await click('Détailler les consommations');assert.equal(nightOutConsumption(parent()).mode,'DETAILED');assert(button('Boissons'));assert(button('+ Before'));assert(button('+ Au bar'));checks.push('CHOOSE_DETAILS_OPENS_EMPTY_DOCK');
 let direct=empty();direct=editNightOut(direct,{contextOccurrenceId:id,fields:{},consumption:{mode:'DIRECT',amount:'40',selectionId:uuid(99981),expectedContextDigest:plannerDigest(direct.contexts[0]),acceptLegacy:true}});
 const directAdmitted=await mount(direct);assertEntry();await click('+ Before');assert.equal(ops.length,0);assert.deepEqual(model.semanticState,directAdmitted);
 await click('+ Au bar');assert(confirmation(),'DIRECT needs explicit confirmation before switching');assert.equal(ops.length,0);await click('Annuler');assert.deepEqual(model.semanticState,directAdmitted);
 await click('+ Au bar');await click('Détailler Au bar');assert.equal(nightOutConsumption(parent()).mode,'DETAILED');assert(nightOutConsumption(parent()).inactive.some(i=>i.selectionId===uuid(99981)));assert(button('Boissons'));checks.push('DIRECT_NO_AUTOMATIC_TRANSITION_AND_CANCEL_PRESERVES');
 await mount(onlyBar);const beforeDeletion=structuredClone(model.semanticState),priorCount=model.presentation.elementCount;
 const lastTile=nodes(n=>n.type==='button'&&n.props['aria-label']?.startsWith('Planche de tapas · Quantité 1 ·'))[0],lastSource=model.presentation.dragSources[lastTile.props['data-drag-source']];assert(lastSource?.removeOperation);assert.equal(lastTile.props.draggable,true);
 await act(async()=>lastTile.props.onDragStart({stopPropagation(){}}));assert.equal(dragKey,lastSource.sourceKey);
 const removeLast=await handleComposerRequest(deps,householdId,{...lastSource.removeOperation,sequence:++sequence,targetMonth:'2026-11',draft:model.semanticState});assert(removeLast.ok,removeLast.message);model=removeLast.model;await act(async()=>root.update(render()));
 assert.equal(parent().slotSelections.extras.items.length,0);assert(button('+ Before'));assert(button('+ Au bar'));checks.push('LAST_ITEM_REMOVAL_KEEPS_ACCESS');
 const deletedRead=await handleComposerRequest(deps,householdId,{kind:'READ',sequence:++sequence,targetMonth:'2026-11',draft:model.semanticState});assert(deletedRead.ok);assert.equal(deletedRead.model.presentation.elementCount,priorCount,'removing a component is not removing a Board root');
 await mount(beforeDeletion);assert.deepEqual(parent().slotSelections.extras,beforeDeletion.contexts[0].slotSelections.extras);assert(button('Ajouter une consommation'));checks.push('UNDO_SNAPSHOT_RESTORES_VISIBLE_IDENTITIES');
 // Exercise the existing Draft RPC/services on synthetic Postgres only.
 await pg.db.exec('reset role; alter table auth.users add column raw_app_meta_data jsonb;');
 for(const file of ['20261011130256_p07b_m0_phase2_composer_drafts_fixture_gate.sql','20261011150830_p07_composer_draft_access_v2.sql'])await pg.db.exec('begin;'+fs.readFileSync('supabase/migrations/'+file,'utf8')+'commit;');
 await pg.db.exec('update private.phase2_composer_draft_access set enabled_for_all=true; set role authenticated;');
 const supabase={from(table){assert(['phase2_composer_drafts','phase2_month_plans'].includes(table));const filters=[];const q={select(){return q;},eq(k,v){assert.match(k,/^[a-z_]+$/);filters.push([k,v]);return q;},order(){return q;},abortSignal(){return q;},maybeSingle(){q.single=true;return q;},then(resolve,reject){return pg.db.query(`select to_jsonb(t) as row from public.${table} t where ${filters.map(([k],i)=>k+'=$'+(i+1)).join(' and ')}`,filters.map(([,v])=>v)).then(r=>({data:q.single?r.rows[0]?.row??null:r.rows.map(x=>x.row),error:null}),e=>({data:null,error:e})).then(resolve,reject);}};return q;},rpc(name,args){assert.equal(name,'save_phase2_composer_draft_v2');const q={abortSignal(){return q;},then(resolve,reject){const keys=['household_id','target_month','expected_draft_id','expected_draft_version','save_request_id','base_plan_id','base_plan_revision_id','base_plan_revision_number','semantic_state','semantic_state_digest'];return pg.db.query(`select public.save_phase2_composer_draft_v2(${keys.map((_,i)=>'$'+(i+1)).join(',')}) as result`,keys.map(k=>k==='semantic_state'?JSON.stringify(args['p_'+k]):args['p_'+k])).then(r=>({data:r.rows[0].result,error:null}),e=>({data:null,error:e})).then(resolve,reject);}};return q;}};
 await mount(fixture.semantic);const toSave=structuredClone(model.semanticState),scope={supabase,userId,householdId};
 const saved=await saveComposerDraft(scope,{targetMonth:'2026-11',semanticState:toSave,digest:semanticStateDigest(toSave),requestId:crypto.randomUUID(),expectedDraftId:null,expectedDraftVersion:0,expectedBaseRevisionId:null,expectedBaseRevisionNumber:0});assert(saved.ok,JSON.stringify(saved));
 const reloaded=(await readComposerDrafts(scope,'2026-11')).active.semanticState;assert.deepEqual(parsePlanSemanticState(reloaded),toSave);await mount(reloaded);
 assert(nodes(n=>n.props['data-bar-before-item']).length===5);assert(nodes(n=>n.props['data-bar-tile']).length===1);checks.push('OFFICIAL_DRAFT_SAVE_RELOAD_COMPONENTS_VISIBLE_SYNTHETIC');
 const beforeRemount=structuredClone(model.semanticState);await mount(beforeRemount);assert.deepEqual(model.semanticState,beforeRemount);assert(button('Ajouter un objet au Before'));assert(button('Ajouter une consommation'));checks.push('CLOSE_REOPEN_RETAINS_MOMENTS_AND_IDENTITIES');
 // Compact editing must retain every richer economic attribute on partial edits.
 for(const basis of ['ITEM','SHARED','PERSON']){
   const scene=barCompactMonth('mixed').semantic,selected=scene.contexts[0].slotSelections.extras.items[0];
   Object.assign(selected,{unitBasis:basis,cost:{kind:'QUOTE',quoteKey:'synthetic-component-quote'},fundingAllocations:[{source:'BANK',amount:'3'}],label:'Nom personnalisé'});
   if(basis==='PERSON')Object.assign(selected,{quantity:'4',quantityEvidenceVersion:'component-quantity@v1',quantityPerPerson:'2',pricedParticipantCount:2});
   await mount(scene);await click(nodes(n=>n.type==='button'&&n.props['aria-label']?.startsWith('Nom personnalisé ·'))[0].props['aria-label']);
   assert.equal(nodes(n=>n.props['data-bar-item-details']!==undefined).length,0);assert.equal(nodes(n=>n.props['data-workshop-component']!==undefined).length,0);
   for(const label of ['Retirer ce poste','Unité, financement et nom','Enregistrer'])assert.equal(button(label),undefined);assert.equal(nodes(n=>n.props['data-bar-active-tile']===true)[0].findAll(n=>n.type==='button'&&['Options','Retirer ce poste'].includes(text(n))).length,0);
   const old=structuredClone(parent().slotSelections.extras.items[0]);await click('Augmenter la quantité');
   const changed=parent().slotSelections.extras.items[0];assert.deepEqual(changed.cost,old.cost);assert.deepEqual(changed.fundingAllocations,old.fundingAllocations);assert.equal(changed.selectionId,old.selectionId);assert.equal(changed.label,old.label);assert.equal(changed.unitBasis,basis);
   if(basis==='PERSON'){assert.equal(changed.quantityPerPerson,'3');assert.equal(changed.pricedParticipantCount,2);assert.equal(changed.quantity,'6');}
   const selectedTile=nodes(n=>n.type==='button'&&n.props['aria-label']?.startsWith('Nom personnalisé ·'))[0];await click(selectedTile.props['aria-label']);
   const price=nodes(n=>n.type==='input'&&n.props['aria-label']?.startsWith('Prix '))[0];assert(price);await act(async()=>price.props.onChange({target:{value:'7,50'}}));await enterRow();
   const priced=parent().slotSelections.extras.items[0];assert.deepEqual(priced.cost,{kind:'MANUAL',unitAmount:'7.50'});assert.deepEqual(priced.fundingAllocations,old.fundingAllocations);assert.equal(priced.label,old.label);
   checks.push(`COMPACT_${basis}_QUOTE_FUNDING_ENTER_PARTIAL_EDIT_NO_DOCK_ACTIONS`);
 }
 const {BarMetadata}=require('@/app/mois-a-venir/composer/bar-living-details');const {BarLivingCard}=require('@/app/mois-a-venir/composer/bar-living-card');
 await mount(barCompactMonth('long').semantic);await act(async()=>root.unmount());
 const headerCard=model.board.contexts.find(c=>c.contextOccurrenceId===id),targets=[];
 for(const expanded of [false,true]){
   await act(async()=>{root=create(React.createElement(BarLivingCard,{card:headerCard,model,living:{id:expanded?id:undefined,open:(c,target)=>targets.push(target),close(){}},busy:false,preserved:false,preserve(){},drag(){}}));});
   assert.equal(nodes(n=>n.props['data-bar-closed-place']!==undefined).length,1);assert.equal(nodes(n=>n.props['data-bar-closed-date']!==undefined).length,1);assert.equal(nodes(n=>n.props['data-bar-closed-people']!==undefined).length,1);assert.match(text(root.toJSON()),/\+4/);assert.equal(nodes(n=>n.props['aria-label']==='Actions de la sortie').length,0);
   await act(async()=>nodes(n=>n.props['data-bar-closed-place']!==undefined)[0].props.onClick());assert.equal(targets.at(-1),'place');await act(async()=>root.unmount());
 }
 await act(async()=>{root=create(React.createElement(BarMetadata,{fields:parent().fields,model,editing:true,open(){}}));});assert.equal(nodes(n=>n.type==='button').length,0);checks.push('SHARED_HEADER_LONG_PLACE_DATE_PEOPLE_AND_NO_REDUNDANT_METADATA');
 await act(async()=>root.unmount());const {BarRouteLine}=require('@/app/mois-a-venir/composer/bar-living-details');const {mobilityIntentId}=require('@/domain/phase2/planner/identity');
 const ref={kind:'KNOWN',placeId:fixture.world.mobilityFacts.places[0].placeId};
 const line={kind:'MOBILITY_INTENT',selectionId:uuid(99701),optionKey:'car',provenance:'EXPLICIT_USER_DECISION',origin:ref,destination:{kind:'TEXT',label:'Le Boom Boom'},route:{vehicleRef:{vehicleId:uuid(9150),labelAtSelection:'Véhicule conservé',provenance:'EXPLICIT_USER_DECISION'},stops:[]}};
 const copy=structuredClone(line);const routeModel={...model,nightOutSummaries:[{contextOccurrenceId:id,semanticStateDigest:model.board.draft.semanticStateDigest}],mobilityOptions:{...model.mobilityOptions,places:fixture.world.mobilityFacts.places},mobilitySummaries:[{contextOccurrenceId:id,ownerIntentId:mobilityIntentId(id,'outbound'),economicFuel:'0.68',status:'PARTIAL',fallbacks:['TOLL_UNAVAILABLE']}]};
 await act(async()=>{root=create(React.createElement(BarRouteLine,{compact:true,slot:'outbound',leg:line,model:routeModel,contextId:id,open(){}}));});
 assert.match(text(root.toJSON()),/Domicile.*Voiture.*Le Boom Boom.*≈ 0,68/);assert(!/Aller|Estimation partielle|Tarif inconnu/.test(text(root.toJSON())));assert.equal(nodes(n=>n.type==='details').length,0);assert.equal(nodes(n=>n.props['data-bar-vehicle-capsule']!==undefined).length,0);assert.match(nodes(n=>n.type==='button')[0].props.title,/usage partiel.*achat de carburant/);assert.deepEqual(line,copy);checks.push('COMPACT_ROUTE_PARTIAL_NO_VEHICLE_DUPLICATE_NO_DECISION_MUTATION');
 for(const [cost,stale,failed] of [[null,false,false],['0.68',true,false],['0.68',false,true],['0.00',false,false]]){
   const variant={...routeModel,nightOutSummaries:stale?[]:routeModel.nightOutSummaries,mobilitySummaries:[{...routeModel.mobilitySummaries[0],economicFuel:cost}]};
   await act(async()=>root.update(React.createElement(BarRouteLine,{compact:true,slot:'outbound',leg:line,model:variant,contextId:id,failed,open(){}})));
   assert.equal(text(root.toJSON()).includes('€'),cost!==null&&!stale&&!failed);assert(!/Tarif inconnu|Estimation partielle/.test(text(root.toJSON())));
 }
 checks.push('COMPACT_COST_UNKNOWN_STALE_FAILED_HIDDEN_KNOWN_ZERO_VISIBLE');
 initialTarget='outbound';await mount(barCompactMonth('tall').semantic);const beforeRouteNavigation=structuredClone(model.semanticState);
 const routeControls=nodes(n=>n.props['data-bar-route-controls']!==undefined)[0];assert(routeControls);
 for(const label of ['Modifier le départ','Modifier l’arrivée','Heure de départ','Inverser ce sens','Retirer ce trajet'])assert(routeControls.findAll(n=>n.type==='button'&&(n.props['aria-label']===label||text(n)===label)).length,label);
 const modeDock=nodes(n=>n.props['data-bar-dock']===true)[0];assert(modeDock);assert.equal(modeDock.props['data-dock-nature'],'MODES');assert(!/Modifier le départ|Inverser ce sens|Heure de départ/.test(text(modeDock)));
 await click('Modifier le départ');assert.equal(nodes(n=>n.props['data-bar-dock']===true).length,0);assert(nodes(n=>n.props['data-bar-route-search']!==undefined).length);assert(!text(root.toJSON()).includes('Choisissez une adresse vérifiée'));assert.deepEqual(model.semanticState,beforeRouteNavigation);checks.push('ROUTE_TOOLS_AND_ADDRESSES_IN_CARD_DOCK_MODES_ONLY_NO_MUTATION');
 await pg.verifyCanaries();assert.deepEqual(await pg.counts(),{plans:0,revisions:0});
 console.log(JSON.stringify({status:'PASS',checks,level:'REACT_REAL_OWNERS_PGLITE_SYNTHETIC_NOT_NATIVE_OR_AUTH',remoteWrites:0}));
}finally{if(root)await act(async()=>root.unmount());await pg.close();}
