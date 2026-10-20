/** R5 real React handlers and semantic owner, isolated PGlite. Not browser/Auth evidence. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import Module, {createRequire} from 'node:module';
import {require} from './lib/phase2-ts-loader.mjs';
import {createKernelPostgres} from './lib/planner-kernel-postgres.mjs';
import {fixture,state,uuid,householdId} from './fixtures/planner-headless.mjs';
const rendererRequire=createRequire(new URL('../outputs/l4c-test-tools/package.json',import.meta.url));
const React=rendererRequire('react'),{create,act}=rendererRequire('react-test-renderer');
const load=Module._load;
Module._load=function(name,...args){if(name==='react')return React;if(name==='react-dom')return {createPortal:node=>node};return load.call(this,name,...args);};
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
globalThis.requestAnimationFrame=callback=>{callback();return 0;};
globalThis.cancelAnimationFrame=()=>{};
globalThis.HTMLElement=class {};
globalThis.document={addEventListener(){},removeEventListener(){},activeElement:null,body:{}};
globalThis.ResizeObserver=class{observe(){} disconnect(){}};
const {InlineEditRegistry,InlineEditContext}=require('@/app/mois-a-venir/composer/inline-edit-registry');
const {WorkshopConfirmationProvider}=require('@/app/mois-a-venir/composer/workshop-confirmation');
const {WorkshopChoicesProvider}=require('@/app/mois-a-venir/composer/workshop-choices');
const {BarLivingEditor}=require('@/app/mois-a-venir/composer/bar-living-editor');
const {barPlaceOperation,barSameModeReturn,barEndpoint}=require('@/app/mois-a-venir/composer/bar-living-operations');
const {stageLocalDecision,visualDraftModel}=require('@/app/mois-a-venir/composer/local-draft');
const {handleComposerRequest}=require('@/server/phase2/planner/composer-service');
const {semanticStateDigest}=require('@/domain/phase2/planner/semantic-state');
const pg=await createKernelPostgres();
const {createPlanApplyRepository}=require('@/server/phase2/planner/repository');
const repository=createPlanApplyRepository(pg.client);
const checks=[];
const r7MemoryOnly=process.argv.includes('--r7-memory');
const check=async(name,run)=>{if(r7MemoryOnly&&!name.startsWith('R7_'))return;try{await run();checks.push({name,status:'PASS'});console.log(name+' PASS');}catch(e){checks.push({name,status:'FAIL',message:e.message});console.log(name+' FAIL: '+e.message);}};
const text=node=>typeof node==='string'?node:node?.type==='small'||String(node?.props?.['aria-hidden'])==='true'?'':node?.children?.map(text).join('')??'';
let root,registry,requestRef,pendingOps,model,kind,id,steps,rejectNext=false;
let overrides={};
const controls=predicate=>root.root.findAll(n=>typeof n.type==='string'&&predicate(n));
const button=(label)=>{const all=controls(n=>n.type==='button'&&(text(n).trim()===label.trim()||text(n).trim()==='+ '+label.trim()||label==='Date'&&n.props['aria-label']==='Modifier la date'||label==='Lieu'&&n.props['aria-label']==='Modifier le lieu'));assert.ok(all.length,'Missing button '+label);return all[0];};
const click=async label=>{
  if(label==='+ Before')label='Before';
  // Cost is now the card header value, outside this editor-only fixture. Exercise
  // its existing targetRequest boundary instead of reintroducing a fake CTA.
  if(label==='Montant direct'&&kind===BarLivingEditor){overrides={...overrides,initialTarget:'quick',targetRequest:(overrides.targetRequest??0)+1};await sync();return;}
  const matches=()=>controls(n=>n.type==='button'&&(text(n).trim()===label.trim()||text(n).trim()==='+ '+label.trim()||label==='Date'&&n.props['aria-label']==='Modifier la date'||label==='Lieu'&&n.props['aria-label']==='Modifier le lieu'));
  for(let i=0;i<12&&!matches().length;i++){
    const next=controls(n=>n.type==='button'&&n.props['aria-label']==='Pages du dock · suivante'&&!n.props.disabled)[0];
    if(next){await act(async()=>next.props.onClick());steps++;continue;}
    const back=controls(n=>n.type==='button'&&text(n)==='← Ma sortie')[0];
    if(back&&['Montant direct','Autre'].includes(label)){await act(async()=>back.props.onClick());steps++;continue;}if(label==='Montant direct'){const more=controls(n=>n.type==='button'&&text(n)==='Autre')[0];if(more){await act(async()=>more.props.onClick());continue;}}if(['Vodka','Crazy Tiger sans alcool','Diluant sans alcool','Bière','Snack','Chips','Vin','Rhum'].includes(label)){const full=controls(n=>n.type==='button'&&text(n)==='Tout le Before')[0];if(full){await act(async()=>full.props.onClick());continue;}}const all=controls(n=>n.type==='button'&&text(n)==='Tous les lieux')[0];if(all){await act(async()=>all.props.onClick());continue;}const reveal=controls(n=>n.type==='button'&&['Autres consommations','Autres objets du Before'].includes(text(n)))[0];if(reveal){await act(async()=>reveal.props.onClick());continue;}break;
  }
  await act(async()=>button(label).props.onClick());steps++;
};
const input=label=>{const field=controls(n=>n.type==='label'&&text(n).startsWith(label))[0];assert.ok(field,'Missing field '+label+'; labels='+controls(n=>n.type==='label').map(text).join(' | ')+'; buttons='+controls(n=>n.type==='button').map(text).join(' | '));return field.findByType('input');};
const change=async(label,value)=>{await act(async()=>{const node=input(label);for(let p=node.parent;p;p=p.parent)p.props.onChangeCapture?.({target:{value}});node.props.onChange({target:{value}});});steps++;};
const props=()=>({context:model.semanticState.contexts.find(c=>c.contextOccurrenceId===id),model,card:model.board.contexts.find(c=>c.contextOccurrenceId===id),semanticState:model.semanticState,targetMonth:'2026-11',householdPersons:[],options:model.mobilityOptions,busy:false,fresh:true,dockHost:{},host:{},choose:()=>{},close:()=>{},onCancel:()=>{},onSave:admit,decide:admit,saveStatus:'MEMORY',editor:model.editors.find(e=>e.assetKey==='template:'+model.semanticState.contexts.find(c=>c.contextOccurrenceId===id).templateKey),...overrides});
const admit=operation=>{if(rejectNext){rejectNext=false;return false;}const semantic=stageLocalDecision(model,model.semanticState,operation);if(!semantic)return false;pendingOps.push(operation);model=visualDraftModel(model,semantic);root?.update(render());return true;};
const render=()=>React.createElement(WorkshopConfirmationProvider,{requestRef},React.createElement(WorkshopChoicesProvider,null,React.createElement(InlineEditContext.Provider,{value:registry},React.createElement(kind,props()))));
const sync=async()=>{await act(async()=>root.update(render()));};
const init=async(template,preset,component,pristine=false)=>{if(root)await act(async()=>root.unmount());overrides={};registry=new InlineEditRegistry();requestRef={current:()=>{}};registry.requestConfirmation=(message,accept,save)=>requestRef.current({message,accept,save,acceptLabel:'Abandonner cette saisie'});pendingOps=[];steps=0;id=crypto.randomUUID();kind=component;const r=await handleComposerRequest({repository,readWorld:async()=>fixture(),householdPersons:[]},householdId,{sequence:1,targetMonth:'2026-11',draft:state(),kind:'DROP',assetKey:'template:'+template,presetKey:preset,target:{kind:'BOARD_ZONE'},values:{},identity:id,selectionId:crypto.randomUUID()});assert.equal(r.ok,true,JSON.stringify(r));model=r.model;await act(async()=>{root=create(render(),{createNodeMock:element=>element.type==='dialog'?{open:false,showModal(){this.open=true;},close(){this.open=false;},querySelector(){return{focus(){}};},contains(){return false;}}:null});});if(kind===BarLivingEditor&&!pristine){await click('Détailler');await click('Au bar');}};
const current=()=>model.semanticState.contexts.find(c=>c.contextOccurrenceId===id);
const save=async()=>{const dirty=controls(n=>n.props['data-bar-living-editor']!==undefined)[0]?.props['data-inline-dirty'];if(dirty)await click('Enregistrer');else await click('Date');await sync();};
const shortInput=label=>input(label);
const tile=label=>controls(n=>n.type==='button'&&n.findAll(c=>c.type==='strong'&&(text(c)===label||text(c).startsWith(label+' ×'))).length)[0];
const openTile=async label=>{if(!tile(label))await click('← Ma sortie');await act(async()=>tile(label).props.onClick());};
const navigateRoute=async dir=>{let nodes=controls(n=>n.props['data-bar-route']===dir||n.props['data-bar-add-route']===dir);if(!nodes.length){await click('← Ma sortie');nodes=controls(n=>n.props['data-bar-route']===dir||n.props['data-bar-add-route']===dir);}assert.ok(nodes.length,'Route '+dir);await act(async()=>nodes[0].props.onClick());};

const home={kind:'KNOWN',placeId:uuid(99001)},venue={kind:'KNOWN',placeId:uuid(99002)},other={kind:'TEXT',label:'Nouveau bar fixture',provenance:'USER_DECLARED_PROSPECTIVE'};
const taxi={kind:'MOBILITY_INTENT',selectionId:uuid(99003),optionKey:'taxi',provenance:'EXPLICIT_USER_DECISION',origin:venue,destination:home,returnRequired:false,pricing:{fare:{kind:'MANUAL',unitAmount:'12'},parking:{kind:'UNKNOWN'},fundingAllocations:[],preference:'FASTEST'},journey:{relation:'OWNS_JOURNEY',certainty:'CERTAIN',targetIntentId:null,externalExpenseId:null,externalCostLineIds:[],choice:null,stopIndex:null,accessLegIndex:null}};
const step=()=>controls(n=>n.props['data-bar-living-editor']!==undefined)[0].props['data-bar-step'];
const {barBefore,barBeforeRemove}=require('@/app/mois-a-venir/composer/bar-before');
const dock=()=>controls(n=>n.props['data-bar-dock']===true)[0];
const chooseFamily=async(label='Boissons')=>click(label);
try {
await check('R72_PRISTINE_INLINE_ENTER_BLUR_ESCAPE_RAW_AND_REJECTION',async()=>{
 await init('night-out','bar-apero',BarLivingEditor,true);
 assert.equal(controls(n=>n.props['data-bar-dock']===true).length,0);assert.equal(controls(n=>n.props['data-bar-section']).length,0);
 assert.equal(controls(n=>n.props['aria-label']==='Moments de consommation').length,0);
 const trigger=()=>controls(n=>n.props['data-bar-inline-trigger']!==undefined)[0];
 const amount=()=>controls(n=>n.props['data-bar-inline-amount']!==undefined)[0];
 const key=async value=>act(async()=>amount().props.onKeyDown({key:value,preventDefault(){},stopPropagation(){}}));
 await act(async()=>trigger().props.onClick());await act(async()=>amount().props.onChange({target:{value:'12,'}}));
 const before=semanticStateDigest(model.semanticState);await act(async()=>amount().props.onBlur());assert.equal(amount().props.value,'12,');assert.equal(semanticStateDigest(model.semanticState),before);assert.equal(registry.count(),1);
 await key('Escape');assert.equal(semanticStateDigest(model.semanticState),before);assert.equal(registry.count(),0);
 await act(async()=>trigger().props.onClick());await act(async()=>amount().props.onChange({target:{value:'15'}}));await key('Enter');
 assert.equal(current().fields.nightOutConsumption.mode,'DIRECT');assert.equal(current().slotSelections.extras.items.length,1);assert.equal(current().slotSelections.extras.items[0].cost.unitAmount,'15');
 const written=pendingOps.length;await act(async()=>trigger().props.onClick());await act(async()=>amount().props.onChange({target:{value:'0'}}));await act(async()=>amount().props.onBlur());assert.equal(pendingOps.length,written+1);assert.equal(current().slotSelections.extras.items[0].cost.unitAmount,'0');
 await act(async()=>trigger().props.onClick());await act(async()=>amount().props.onChange({target:{value:'20'}}));rejectNext=true;await key('Enter');assert.equal(amount().props.value,'20');assert.equal(current().slotSelections.extras.items[0].cost.unitAmount,'0');await key('Escape');
 await click('Détailler');assert.equal(current().fields.nightOutConsumption.mode,'DETAILED');assert.equal(controls(n=>n.props['data-bar-section']).length,0);
 await click('Au bar');await chooseFamily();await click('Bière');await click('Before');await chooseFamily('Restauration');await click('Chips');
 assert.equal(controls(n=>n.props['data-bar-section']==='extras').length,1);assert.equal(controls(n=>n.props['data-bar-section']==='before').length,1);
 assert.ok(controls(n=>n.props['data-bar-moment-slot']!==undefined).length>=2);
});
await check('R5_FAMILIES_OBJECTS_NO_NAVIGATION_MIX',async()=>{
 await init('night-out','bar-apero',BarLivingEditor);
 assert.equal(dock().props['data-dock-nature'],'FAMILIES');
 assert.deepEqual(dock().findAll(n=>n.type==='strong').map(text),['Boissons','Restauration']);
 await chooseFamily();assert.equal(dock().props['data-dock-nature'],'OBJECTS');
 assert.ok(!dock().findAll(n=>n.type==='strong').map(text).some(x=>['Before','Montant direct','Lieu','Date','Personnes','Restauration'].includes(x)));
});
await check('R5_F11_FIVE_COCKTAILS_DISTINCT_IDS_SAME_CATALOGUE',async()=>{
 await init('night-out','bar-apero',BarLivingEditor);await chooseFamily();
 for(let i=0;i<5;i++){await click('Cocktail');assert.equal(step(),'row');assert.equal(dock().props['data-dock-nature'],'OBJECTS');}
 const drinks=current().slotSelections.extras.items;assert.equal(drinks.length,5);assert.equal(new Set(drinks.map(i=>i.selectionId)).size,5);assert.ok(drinks.every(i=>i.cost.kind==='UNKNOWN'));
 assert.equal(controls(n=>n.props['aria-label']?.startsWith('Pages du dock')).length,0);
});
await check('R5_BEFORE_EMPTY_THEN_CHIPS_NO_PHANTOM_BOTTLE',async()=>{
 await init('night-out','bar-apero',BarLivingEditor);const original=semanticStateDigest(model.semanticState);
 await click('+ Before');assert.equal(semanticStateDigest(model.semanticState),original);assert.equal(barBefore(model.semanticState,current()),null);
 await chooseFamily('Restauration');await click('Chips');
 const before=barBefore(model.semanticState,current());assert.equal(before.bottle.label,'Chips');assert.equal(before.extras.length,0);assert.equal(before.bottle.cost.kind,'UNKNOWN');
 assert.equal(current().slotSelections.extras?.items?.length??0,0);
});
await check('R5_BEFORE_PRIMARY_REMOVAL_ATOMIC_RETAINS_CHILD_AND_REMAINING_DATA',async()=>{
 await init('night-out','bar-apero',BarLivingEditor);await click('+ Before');await chooseFamily();await click('Vodka');await click('Bière');
 const before=barBefore(model.semanticState,current());const original=JSON.parse(JSON.stringify(before.extras[0]));
 await act(async()=>admit(barBeforeRemove(model.semanticState,current(),before.bottle.selectionId)));
 const after=barBefore(model.semanticState,current());assert.equal(after.child.contextOccurrenceId,before.child.contextOccurrenceId);assert.equal(after.link.selectionId,before.link.selectionId);
 assert.deepEqual(after.bottle,{...original,optionKey:'activity'});assert.equal(after.extras.length,0);
});
await check('R5_RAW_TRAILING_COMMA_NOT_ADMITTED_AND_NAVIGATION_CANCEL_RETAINS',async()=>{
 await init('night-out','bar-apero',BarLivingEditor);await chooseFamily();await click('Bière');
 await change('Prix unitaire (€)','12,');const count=pendingOps.length;assert.equal(button('Enregistrer').props.disabled,true);
 assert.equal(current().slotSelections.extras.items[0].cost.kind,'UNKNOWN');
 await click('Date');assert.equal(pendingOps.length,count);assert.equal(step(),'row');
 const dialog=controls(n=>n.type==='dialog')[0];assert(dialog);await act(async()=>dialog.findAll(n=>n.type==='button'&&text(n).includes('Continuer'))[0].props.onClick());
 assert.equal(input('Prix unitaire (€)').props.value,'12,');assert.equal(pendingOps.length,count);
 await change('Prix unitaire (€)','12,50');await click('Enregistrer');assert.equal(current().slotSelections.extras.items[0].cost.unitAmount,'12.50');
});
await check('R5_DATE_TOGGLE_ATOMIC_RETURN_NO_DOCK',async()=>{
 await init('night-out','bar-apero',BarLivingEditor);await click('Date');assert.equal(dock(),undefined);
 await act(async()=>controls(n=>n.props['aria-label']==='2026-11-12')[0].props.onClick());assert.equal(step(),'summary');assert.equal(current().fields.plannedDate,'2026-11-12');
 await click('Date');assert.equal(dock(),undefined);await act(async()=>controls(n=>n.props['aria-label']==='2026-11-12')[0].props.onClick());assert.equal(current().fields.plannedDate,null);
});
await check('R5_PEOPLE_MULTITOGGLE_NO_FINANCIAL_INFERENCE',async()=>{
 await init('night-out','bar-apero',BarLivingEditor);await act(async()=>controls(n=>n.props['aria-label']?.startsWith('Modifier les personnes'))[0].props.onClick());
 const choices=dock().findAll(n=>n.type==='button');assert.ok(choices.length>1);
 await act(async()=>choices[0].props.onClick());assert.equal(step(),'people');assert.equal(current().fields.participantRefs.length,1);
 assert.equal(current().slotSelections.main?.items?.length??0,0);assert.equal(current().slotSelections.extras?.items?.length??0,0);
 await act(async()=>dock().findAll(n=>n.type==='button')[0].props.onClick());assert.equal(current().fields.participantRefs.length,0);
});
await check('R5_REJECTED_MUTATION_RETAINS_CONTEXT_AND_NOT_SUCCESS',async()=>{
 await init('night-out','bar-apero',BarLivingEditor);await chooseFamily();const old=semanticStateDigest(model.semanticState);rejectNext=true;
 await click('Bière');assert.equal(semanticStateDigest(model.semanticState),old);assert.equal(step(),'drinks');assert.ok(controls(n=>n.props.role==='alert').length);
});

await check('R5_MOMENT_FAMILY_MEMORY_AND_NO_DUPLICATE_BEFORE_LAUNCHER',async()=>{
 await init('night-out','bar-apero',BarLivingEditor);await chooseFamily();await click('Bière');await click('← Ma sortie');await click('+ Before');await chooseFamily('Restauration');await click('Chips');
 await click('← Ma sortie');assert.equal(controls(n=>n.type==='button'&&text(n)==='+ Before').length,0);
 await act(async()=>controls(n=>n.props['aria-label']==='Ajouter une consommation')[0].props.onClick());assert.equal(dock().props['aria-label'],'Boissons');
 await click('← Ma sortie');await act(async()=>controls(n=>n.props['aria-label']==='Compléter le Before')[0].props.onClick());assert.equal(dock().props['aria-label'],'Restauration');
});
await check('R5_VENUE_REMOVE_RETAINS_AUTONOMOUS_LEGS_AND_OTHER_FIELDS',async()=>{
 await init('night-out','bar-apero',BarLivingEditor);await act(async()=>admit(barPlaceOperation(current(),other)));
 await act(async()=>admit({kind:'EDIT_NIGHT_OUT',edit:{contextOccurrenceId:id,fields:{plannedDate:'2026-11-12',participantRefs:[{kind:'TEXT',label:'Personne fictive'}]},slots:{return:[taxi]}}}));
 const old=structuredClone(current());await act(async()=>controls(n=>n.props['aria-label']==='Retirer le lieu de la sortie')[0].props.onClick());
 assert.equal(current().fields.placeRef,null);assert.equal(current().fields.venueDecision,null);assert.deepEqual(current().slotSelections,old.slotSelections);assert.equal(current().fields.plannedDate,old.fields.plannedDate);assert.deepEqual(current().fields.participantRefs,old.fields.participantRefs);
});

await check('R7_REOPEN_FAMILY_MEMORY_PRESERVES_MOMENT_OWNER',async()=>{
 await init('night-out','bar-apero',BarLivingEditor);
 let remembered;overrides={onViewChange:view=>{remembered=structuredClone(view);}};await sync();
 await chooseFamily();await click('Bière');await click('← Ma sortie');
 assert.equal(dock().props['data-dock-nature'],'OBJECTS');assert.equal(dock().props['aria-label'],'Boissons');
 await click('+ Before');await chooseFamily('Restauration');await click('Chips');
 const before=barBefore(model.semanticState,current()),bar=structuredClone(current().slotSelections.extras);
 const beforeId=before.child.contextOccurrenceId,first=before.bottle.selectionId;
 await act(async()=>root.unmount());root=null;
 overrides={...overrides,initialBarView:remembered,initialTarget:'summary'};
 await act(async()=>{root=create(render());});
 assert.equal(dock().props['data-dock-nature'],'OBJECTS');assert.equal(dock().props['aria-label'],'Restauration');
 await click('Chips');
 const restored=barBefore(model.semanticState,current());
 assert.equal(restored.child.contextOccurrenceId,beforeId);assert.equal(restored.bottle.selectionId,first);
 assert.equal(restored.extras.length,1);assert.deepEqual(current().slotSelections.extras,bar);
 await click('← Ma sortie');await click('Au bar');
 assert.equal(dock().props['aria-label'],'Boissons');assert.equal(dock().props['data-dock-nature'],'OBJECTS');
});


await check('R5_NO_MATCH_SEARCH_STAYS_MOUNTED_AND_FREE_PERSON_IS_EXPLICIT',async()=>{
 await init('night-out','bar-apero',BarLivingEditor);await act(async()=>controls(n=>n.props['aria-label']?.startsWith('Modifier les personnes'))[0].props.onClick());
 const old=semanticStateDigest(model.semanticState);let search=controls(n=>n.type==='input'&&n.props['aria-label']==='Chercher une personne')[0];
 await act(async()=>search.props.onChange({target:{value:'Invité fictif ZYX'}}));assert.ok(dock());assert.equal(semanticStateDigest(model.semanticState),old);
 await click('Ajouter « Invité fictif ZYX »');assert.deepEqual(current().fields.participantRefs,[{kind:'TEXT',label:'Invité fictif ZYX'}]);
 search=controls(n=>n.type==='input'&&n.props['aria-label']==='Chercher une personne')[0];await act(async()=>search.props.onChange({target:{value:'Amandine'}}));
 assert.equal(controls(n=>n.type==='button'&&text(n)==='Ajouter « Amandine »').length,0);assert.ok(dock());
});

} finally {if(root)await act(async()=>root.unmount());await pg.close();}
const proofDir=r7MemoryOnly?'docs/status/bar-r7/proofs':'docs/status/subassets-r5/proofs';
fs.mkdirSync(proofDir,{recursive:true});
fs.writeFileSync(proofDir+(r7MemoryOnly?'/memory-interactions.json':'/react-interactions.json'),JSON.stringify({environment:'REACT_PGLITE_SYNTHETIC_ONLY',checks},null,2)+'\n');
if(checks.some(c=>c.status==='FAIL'))process.exitCode=1;
