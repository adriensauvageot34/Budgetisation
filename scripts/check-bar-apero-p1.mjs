/** In-process React interaction tests. This is deliberately NOT a browser/auth certificate. */
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
const check=async(name,run)=>{try{await run();checks.push({name,status:'PASS'});console.log(name+' PASS');}catch(e){checks.push({name,status:'FAIL',message:e.message});console.log(name+' FAIL: '+e.message);}};
const text=node=>typeof node==='string'?node:node?.type==='small'||String(node?.props?.['aria-hidden'])==='true'?'':node?.children?.map(text).join('')??'';
let root,registry,requestRef,pendingOps,model,kind,id,steps,rejectNext=false;
let overrides={};
const controls=predicate=>root.root.findAll(n=>typeof n.type==='string'&&predicate(n));
const button=(label)=>{const all=controls(n=>n.type==='button'&&(text(n).trim()===label.trim()||text(n).trim()==='+ '+label.trim()||label==='Date'&&n.props['aria-label']==='Modifier la date'||label==='Lieu'&&n.props['aria-label']==='Modifier le lieu'));assert.ok(all.length,'Missing button '+label);return all[0];};
const click=async label=>{
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
const init=async(template,preset,component)=>{if(root)await act(async()=>root.unmount());overrides={};registry=new InlineEditRegistry();requestRef={current:()=>{}};registry.requestConfirmation=(message,accept,save)=>requestRef.current({message,accept,save,acceptLabel:'Abandonner cette saisie'});pendingOps=[];steps=0;id=crypto.randomUUID();kind=component;const r=await handleComposerRequest({repository,readWorld:async()=>fixture(),householdPersons:[]},householdId,{sequence:1,targetMonth:'2026-11',draft:state(),kind:'DROP',assetKey:'template:'+template,presetKey:preset,target:{kind:'BOARD_ZONE'},values:{},identity:id,selectionId:crypto.randomUUID()});assert.equal(r.ok,true,JSON.stringify(r));model=r.model;await act(async()=>{root=create(render(),{createNodeMock:element=>element.type==='dialog'?{open:false,showModal(){this.open=true;},close(){this.open=false;},querySelector(){return{focus(){}};},contains(){return false;}}:null});});};
const current=()=>model.semanticState.contexts.find(c=>c.contextOccurrenceId===id);
const save=async()=>{const dirty=controls(n=>n.props['data-bar-living-editor']!==undefined)[0]?.props['data-inline-dirty'];if(dirty)await click('Enregistrer');else await click('Date');await sync();};
const shortInput=label=>input(label);
const tile=label=>controls(n=>n.type==='button'&&n.findAll(c=>c.type==='strong'&&(text(c)===label||text(c).startsWith(label+' ×'))).length)[0];
const openTile=async label=>{if(!tile(label))await click('← Ma sortie');await act(async()=>tile(label).props.onClick());};
const navigateRoute=async dir=>{let nodes=controls(n=>n.props['data-bar-route']===dir||n.props['data-bar-add-route']===dir);if(!nodes.length){await click('← Ma sortie');nodes=controls(n=>n.props['data-bar-route']===dir||n.props['data-bar-add-route']===dir);}assert.ok(nodes.length,'Route '+dir);await act(async()=>nodes[0].props.onClick());};

const home={kind:'KNOWN',placeId:uuid(99001)},venue={kind:'KNOWN',placeId:uuid(99002)},other={kind:'TEXT',label:'Nouveau bar fixture',provenance:'USER_DECLARED_PROSPECTIVE'};
const taxi={kind:'MOBILITY_INTENT',selectionId:uuid(99003),optionKey:'taxi',provenance:'EXPLICIT_USER_DECISION',origin:venue,destination:home,returnRequired:false,pricing:{fare:{kind:'MANUAL',unitAmount:'12'},parking:{kind:'UNKNOWN'},fundingAllocations:[],preference:'FASTEST'},journey:{relation:'OWNS_JOURNEY',certainty:'CERTAIN',targetIntentId:null,externalExpenseId:null,externalCostLineIds:[],choice:null,stopIndex:null,accessLegIndex:null}};
const step=()=>controls(n=>n.props['data-bar-living-editor']!==undefined)[0].props['data-bar-step'];
try {
await check('P1-NAV-01_ALREADY_OPEN_NO_MUTATION',async()=>{
 await init('night-out','bar-apero',BarLivingEditor);await act(async()=>controls(n=>n.props['aria-label']==='Ajouter une consommation')[0].props.onClick());await click('Bière');await save();await act(async()=>admit({kind:'EDIT_NIGHT_OUT',edit:{contextOccurrenceId:id,fields:{},slots:{outbound:[{...taxi,selectionId:uuid(99020),pricing:{fare:{kind:'UNKNOWN'},parking:{kind:'UNKNOWN'},fundingAllocations:[],preference:'FASTEST'}}],return:[taxi]}}}));const before=pendingOps.length;
 for(const [label,target] of [['Lieu','place'],['Date','date'],['Personnes','people']]){await click(label);assert.equal(step(),target);}
 await openTile('Bière');assert.equal(step(),'row');const identity=current().slotSelections.extras.items[0].selectionId;
 for(const dir of ['outbound','return']){await navigateRoute(dir);assert.equal(step(),dir);}
 await click('Date');assert.equal(step(),'date');assert.equal(pendingOps.length,before);assert.equal(current().slotSelections.extras.items[0].selectionId,identity);
});
await check('P1-PLACE-01_02_03_NO_INFERRED_BINDING',async()=>{
 await init('night-out','bar-apero',BarLivingEditor);await act(async()=>admit({kind:'EDIT_NIGHT_OUT',edit:{contextOccurrenceId:id,fields:{placeRef:venue},slots:{return:[taxi]}}}));
 const op=barPlaceOperation(current(),other);assert.ok(!op.edit.slots||Object.keys(op.edit.slots).length===0,'central place must not rewrite independent route slots');
 const before=structuredClone(current().slotSelections);await act(async()=>admit(op));assert.deepEqual(current().slotSelections,before);
});
await check('P1-PRICE-01_REJECT_SILENT_FARE_LOSS',()=>assert.throws(()=>barEndpoint(taxi,'origin',other),/prix|tarif|coût/i));
await check('P1-PRICE-03_EXTERNAL_ROUTE_NOT_REOWNED',()=>{const linked={...taxi,journey:{...taxi.journey,relation:'SHARES_JOURNEY',targetIntentId:uuid(99004),choice:'MERGE'}};assert.throws(()=>barEndpoint(linked,'origin',other),/lié|externe/i);});
await check('P1-RAW-01_SAVE_AND_RESUME_DATE',async()=>{
 await init('night-out','bar-apero',BarLivingEditor);await act(async()=>controls(n=>n.props['aria-label']==='Ajouter une consommation')[0].props.onClick());await click('Bière');await change('Prix unitaire (€)','6,50');const identity=current().slotSelections.extras.items[0].selectionId;
 await click('Date');assert.equal(input('Prix unitaire (€)').props.value,'6,50');assert.equal(current().slotSelections.extras.items[0].cost.kind,'UNKNOWN');
 const saveButton=controls(n=>n.type==='button'&&n.props['data-save-workshop']!==undefined)[0];assert.ok(saveButton,'RAW guard must offer an explicit save choice');await act(async()=>saveButton.props.onClick());assert.equal(step(),'date');assert.equal(current().slotSelections.extras.items[0].cost.unitAmount,'6.50');assert.equal(current().slotSelections.extras.items[0].selectionId,identity);
});

const onRoute=navigateRoute;
const saveGuard=async()=>act(async()=>controls(n=>n.props['data-save-workshop']!==undefined)[0].props.onClick());
const installLegs=async(outbound,back)=>{await act(async()=>assert.equal(admit({kind:'EDIT_NIGHT_OUT',edit:{contextOccurrenceId:id,fields:{placeRef:venue},slots:{...(outbound?{outbound:[outbound]}:{}),...(back?{return:[back]}:{})}}}),true));};
const unknownPricing={fare:{kind:'UNKNOWN'},parking:{kind:'UNKNOWN'},fundingAllocations:[],preference:'FASTEST'};
const car={...taxi,selectionId:uuid(99007),optionKey:'car',origin:home,destination:venue,pricing:unknownPricing,route:{version:'composer-mobility-route@v1',vehicleRef:{vehicleId:uuid(99008),labelAtSelection:'Voiture fixture',provenance:'EXPLICIT_USER_DECISION'},manualFuelPrice:'1.8',toll:{kind:'MANUAL',unitAmount:'4'},stops:[{label:'Maison fixture',placeId:home.placeId,distanceToNextKm:'5',distanceSource:'MANUAL',estimatedFuelLiters:'0.4'},{label:'Ami fixture',placeId:uuid(99009),distanceToNextKm:'6',distanceSource:'MANUAL'},{label:'Bar fixture',placeId:venue.placeId,endpointSource:'ROOT_PLACE'}]}};
await check('P1-PLACE-01_UI_NO_LEGS_NO_CONFIRMATION',async()=>{
 await init('night-out','bar-apero',BarLivingEditor);const before=structuredClone(current());await click('Lieu');await click('Nom libre');await change('Nom ou adresse libre','Bar déclaré fixture');await click('Retenir ce repère');
 const after=current();assert.equal(after.fields.placeRef.label,'Bar déclaré fixture');assert.deepEqual(after.slotSelections,before.slotSelections);assert.equal(pendingOps.length,1);assert.equal(text(controls(n=>n.props.id==='workshop-confirmation-message')[0]),'');assert.ok(!controls(n=>n.props['data-save-workshop']!==undefined).length);assert.equal(step(),'summary');
});
await check('P1-PLACE-04_MULTI_STOP_LEGACY_EXTERNAL_PRESERVED',async()=>{
 await init('night-out','bar-apero',BarLivingEditor);const linked={...taxi,journey:{...taxi.journey,relation:'SHARES_JOURNEY',targetIntentId:uuid(99010),choice:'MERGE'}};await installLegs({...car,returnRequired:true},linked);
 const before=structuredClone(current());await act(async()=>admit(barPlaceOperation(current(),other)));assert.deepEqual(current().slotSelections,before.slotSelections);
 assert.throws(()=>barEndpoint({...car,returnRequired:true},'origin',other),/aller-retour/);
 const changed=barEndpoint(car,'destination',other,'UNKNOWN');assert.equal(changed.route.stops.length,3);assert.deepEqual(changed.route.stops[0],car.route.stops[0]);assert.equal(changed.route.stops[1].placeId,car.route.stops[1].placeId);assert.ok(!changed.route.stops[1].distanceToNextKm);
});
await check('P1-ROUTE-01_MODE_ONE_LEG_AND_NO_AUTOFILL',async()=>{
 await init('night-out','bar-apero',BarLivingEditor);const direct={...car,route:{...car.route,stops:[]},origin:null,plannedTime:'18:30',returnTime:null};await installLegs(direct,taxi);const back=structuredClone(current().slotSelections.return);
 await onRoute('outbound');await click('Taxi / Uber');await click('Changer de mode');assert.equal(current().slotSelections.outbound.items[0].optionKey,'taxi');assert.equal(current().slotSelections.outbound.items[0].origin,null);assert.equal(current().slotSelections.outbound.items[0].plannedTime,'18:30');assert.equal(current().slotSelections.outbound.items[0].returnTime,null);assert.deepEqual(current().slotSelections.return,back);assert.equal(current().slotSelections.outbound.items[0].selectionId,direct.selectionId);
});
await check('P1-ROUTE-02_SAME_MODE_CREATION_NO_LATER_SYNC',async()=>{
 await init('night-out','bar-apero',BarLivingEditor);await installLegs({...car,pricing:unknownPricing,route:car.route&&{...car.route,stops:[],toll:{kind:'UNKNOWN'}}});await act(async()=>admit(barSameModeReturn(current(),uuid(99011))));const back=structuredClone(current().slotSelections.return);
 const next=barEndpoint(current().slotSelections.outbound.items[0],'origin',other);await act(async()=>admit({kind:'EDIT_NIGHT_OUT',edit:{contextOccurrenceId:id,fields:{},slots:{outbound:[next]}}}));assert.deepEqual(current().slotSelections.return,back);assert.notEqual(next.origin,back.items[0].destination);
});
await check('P1-PRICE-01_UI_EXPLICIT_MANUAL_REDECLARATION_OR_UNKNOWN',async()=>{
 for(const choice of ['Conserver cet itinéraire','Retenir 12 € comme nouvelle estimation','Mettre ces prix à préciser']){
  await init('night-out','bar-apero',BarLivingEditor);await installLegs(null,taxi);model={...model,mobilityOptions:{...model.mobilityOptions,places:[{placeId:uuid(99012),name:'Autre lieu fixture',address:null,commune:null}]}};await sync();await onRoute('return');await click('Départ · Lieu enregistré');await click('Autre lieu fixture');
  assert.deepEqual(current().slotSelections.return.items[0],taxi);assert.equal(controls(n=>n.props['data-bar-price-arbitration']!==undefined).length,1);await click(choice);
  const next=current().slotSelections.return.items[0];if(choice==='Conserver cet itinéraire')assert.deepEqual(next,taxi);else {assert.equal(next.origin.placeId,uuid(99012));assert.equal(next.selectionId,taxi.selectionId);assert.deepEqual(next.destination,taxi.destination);assert.equal(next.pricing.fare.kind,choice.startsWith('Retenir')?'MANUAL':'UNKNOWN');if(choice.startsWith('Retenir'))assert.equal(next.pricing.fare.unitAmount,'12');}
 }
});
await check('P1-PRICE-02_VEHICLE_TOLL_STOPS_MANUAL_FUEL_RETAINED',async()=>{
 await init('night-out','bar-apero',BarLivingEditor);await installLegs(car,taxi);const back=structuredClone(current().slotSelections.return);
 model={...model,mobilityOptions:{places:[],vehicle:{vehicleId:uuid(99013),label:'Véhicule alternatif fixture'}}};await sync();await onRoute('outbound');await click('Utiliser Véhicule alternatif fixture');await click('Changer de véhicule');const next=current().slotSelections.outbound.items[0];assert.deepEqual(next.route.toll,car.route.toll);assert.equal(next.route.manualFuelPrice,car.route.manualFuelPrice);assert.equal(next.route.stops.length,3);assert.ok(!next.route.stops[0].estimatedFuelLiters);assert.equal(next.route.stops[0].distanceToNextKm,'5');assert.deepEqual(current().slotSelections.return,back);
});
await check('P1-PRICE-03_EXTERNAL_MODE_BLOCKED_AND_FUNDED_ENDPOINT_BLOCKED',async()=>{
 await init('night-out','bar-apero',BarLivingEditor);const linked={...taxi,journey:{...taxi.journey,relation:'SHARES_JOURNEY',targetIntentId:uuid(99010),choice:'MERGE'}};await installLegs(null,linked);const before=structuredClone(current());await onRoute('return');await click('Voiture');assert.deepEqual(current(),before);assert.ok(controls(n=>n.props.role==='alert').length);assert.throws(()=>barEndpoint({...taxi,pricing:{...taxi.pricing,fundingAllocations:[{source:'BANK',amount:'12'}]}},'origin',other,'UNKNOWN'),/financement/);
});
await check('P1-RAW-01_CANCEL_DISCARD_REJECT_INVALID_AND_RETRY',async()=>{
 await init('night-out','bar-apero',BarLivingEditor);await act(async()=>controls(n=>n.props['aria-label']==='Ajouter une consommation')[0].props.onClick());await click('Bière');const before=structuredClone(current());await change('Prix unitaire (€)','6,50');await click('Date');await click('Continuer à modifier');assert.equal(step(),'row');assert.equal(input('Prix unitaire (€)').props.value,'6,50');
 await click('Date');rejectNext=true;await saveGuard();assert.equal(step(),'row');assert.deepEqual(current(),before);assert.equal(input('Prix unitaire (€)').props.value,'6,50');assert.ok(controls(n=>n.props.role==='alert').length);
 await click('Date');await click('Abandonner cette saisie');assert.equal(step(),'date');assert.deepEqual(current(),before);
 await openTile('Bière');assert.equal(input('Prix unitaire (€)').props.value,'');await change('Prix unitaire (€)','invalide');await click('Date');assert.equal(controls(n=>n.props['data-save-workshop']!==undefined).length,0);await click('Continuer à modifier');assert.equal(input('Prix unitaire (€)').props.value,'invalide');
});
await check('P1-RAW-02_ESCAPE_RERENDER_PRESERVE_EXACT_BUFFER',async()=>{
 await init('night-out','bar-apero',BarLivingEditor);overrides={onCancel:()=>{if(registry.guard(overrides.onCancel))overrides.closed=true;}};await sync();await act(async()=>controls(n=>n.props['aria-label']==='Ajouter une consommation')[0].props.onClick());await click('Bière');await change('Prix unitaire (€)','8');const before=structuredClone(current());await sync();await sync();assert.equal(input('Prix unitaire (€)').props.value,'8');
 globalThis.document.querySelector=()=>null;let stopped=0;await act(async()=>controls(n=>n.props['data-bar-living-editor']!==undefined)[0].props.onKeyDown({key:'Escape',preventDefault(){},stopPropagation(){stopped++;}}));assert.equal(stopped,1);await click('Continuer à modifier');assert.equal(overrides.closed,undefined);assert.deepEqual(current(),before);assert.equal(input('Prix unitaire (€)').props.value,'8');
});
await check('P1-RAW-03_MANUAL_ZERO_REOPEN',async()=>{
 await init('night-out','bar-apero',BarLivingEditor);await act(async()=>controls(n=>n.props['aria-label']==='Ajouter une consommation')[0].props.onClick());await click('Bière');await change('Prix unitaire (€)','0');await click('Date');await saveGuard();await openTile('Bière');assert.equal(input('Prix unitaire (€)').props.value,'0');assert.equal(current().slotSelections.extras.items[0].cost.kind,'MANUAL');
});
await check('P1-RAW_ALL_OTHER_BUFFERS_CONTINUE_TO_ORIGINAL_TARGET',async()=>{
 await init('night-out','bar-apero',BarLivingEditor);await click('Lieu');await click('Nom libre');await change('Nom ou adresse libre','Repère fixture');await click('Date');await saveGuard();assert.equal(step(),'date');assert.equal(current().fields.placeRef.label,'Repère fixture');
 await act(async()=>admit({kind:'EDIT_NIGHT_OUT',edit:{contextOccurrenceId:id,fields:{},slots:{return:[{...taxi,pricing:{fare:{kind:'UNKNOWN'},parking:{kind:'UNKNOWN'},fundingAllocations:[],preference:'FASTEST'}}]}}}));await onRoute('return');await click('Préciser le prix du trajet');await change('Coût prévu du billet ou de la course (€)','12');await click('Date');await saveGuard();assert.equal(step(),'date');assert.equal(current().slotSelections.return.items[0].pricing.fare.unitAmount,'12');
 await click('Date');await click('Montant direct');await click('Entrées / contribution');await change('Coût prévu (€)','20');await click('Date');await saveGuard();assert.equal(step(),'date');assert.equal(current().slotSelections.main.items[0].cost.unitAmount,'20');
 await click('Personnes');const person=controls(n=>n.props['data-question-dock']!==undefined)[0].findAll(n=>n.type==='button'&&typeof n.props['aria-pressed']==='boolean'&&text(n).trim()!=='')[0];assert.ok(person);await act(async()=>person.props.onClick());await click('Date');assert.equal(step(),'date');assert.equal(current().fields.participantRefs.length,1);
});
await check('P1-UNDO-01_EXACT_FUNDED_BEER_ID_BINDING',async()=>{
 await init('night-out','bar-apero',BarLivingEditor);await act(async()=>controls(n=>n.props['aria-label']==='Ajouter une consommation')[0].props.onClick());await click('Bière');await change('Prix unitaire (€)','6');await save();const beer=current().slotSelections.extras.items[0];await act(async()=>admit({kind:'EDIT_NIGHT_OUT',edit:{contextOccurrenceId:id,fields:{},slots:{extras:[{...beer,quantity:'2',fundingAllocations:[{source:'BANK',amount:'12'}],binding:{mode:'EXTRA_TO_SLOT'}}]}}}));const before=structuredClone(model.semanticState);await openTile('Bière');await click('Retirer');assert.equal(current().slotSelections.extras.items.length,0);model=visualDraftModel(model,before);await sync();assert.deepEqual(current().slotSelections.extras.items[0],before.contexts.find(c=>c.contextOccurrenceId===id).slotSelections.extras.items[0]);
});
await check('P1-UNDO-02_ATOMIC_VENUE_ENDPOINT_PRICES_REDO',async()=>{
 await init('night-out','bar-apero',BarLivingEditor);await installLegs({...car,route:{...car.route,stops:[],toll:{kind:'UNKNOWN'}}},taxi);const before=structuredClone(model.semanticState);const changed=barEndpoint(taxi,'origin',other,'UNKNOWN');await act(async()=>admit({kind:'EDIT_NIGHT_OUT',edit:{contextOccurrenceId:id,fields:{placeRef:other},slots:{return:[changed]}}}));const after=structuredClone(model.semanticState);assert.deepEqual(current().slotSelections.outbound,before.contexts.find(c=>c.contextOccurrenceId===id).slotSelections.outbound);model=visualDraftModel(model,before);await sync();assert.deepEqual(model.semanticState,before);model=visualDraftModel(model,after);await sync();assert.deepEqual(model.semanticState,after);assert.equal(current().slotSelections.return.items.length,1);
});
await check('P1-NET_CONFIRMATION_REJECTS_CHANGED_CONTEXT',async()=>{
 await init('night-out','bar-apero',BarLivingEditor);await installLegs(null,{...taxi,optionKey:'car'});await onRoute('return');await click('Taxi / Uber');await act(async()=>admit({kind:'EDIT_NIGHT_OUT',edit:{contextOccurrenceId:id,fields:{timingNote:'Modification intervenue fixture'}}}));const before=structuredClone(current());await click('Changer de mode');assert.deepEqual(current(),before);assert.ok(controls(n=>n.props.role==='alert').length);
});
await check('P1-NET_RAW_DIALOG_CANNOT_SAVE_CHANGED_BUFFER',async()=>{
 await init('night-out','bar-apero',BarLivingEditor);await act(async()=>controls(n=>n.props['aria-label']==='Ajouter une consommation')[0].props.onClick());await click('Bière');await change('Prix unitaire (€)','6');await click('Date');await change('Prix unitaire (€)','8');await saveGuard();assert.equal(step(),'row');assert.equal(input('Prix unitaire (€)').props.value,'8');assert.equal(current().slotSelections.extras.items[0].cost.kind,'UNKNOWN');
});
await check('P1-NAV-03_LOCKED_NO_LOCAL_ADMISSION',async()=>{
 await init('night-out','bar-apero',BarLivingEditor);await act(async()=>controls(n=>n.props['aria-label']==='Ajouter une consommation')[0].props.onClick());await click('Bière');const before=structuredClone(current());overrides={busy:true};await sync();await change('Prix unitaire (€)','9');assert.equal(button('Enregistrer').props.disabled,true);assert.deepEqual(current(),before);assert.equal(registry.count(),1);
});


await check('P1-NAV-02_COMPACT_EXACT_COMPONENT_TARGET',async()=>{
 const {BarLivingCard}=require('@/app/mois-a-venir/composer/bar-living-card');await init('night-out','bar-apero',BarLivingEditor);await act(async()=>controls(n=>n.props['aria-label']==='Ajouter une consommation')[0].props.onClick());await click('Bière');await change('Prix unitaire (€)','9');await save();const selection=current().slotSelections.extras.items[0];let target;
 await act(async()=>root.unmount());await act(async()=>{root=create(React.createElement(BarLivingCard,{card:model.board.contexts.find(c=>c.contextOccurrenceId===id),model,living:{open:(_,next)=>target=next,close(){}},busy:false,preserved:false,preserve(){},drag(){}}));});await openTile('Bière');assert.equal(target,'component:extras:'+selection.selectionId);
 await act(async()=>root.unmount());overrides={initialTarget:target};await act(async()=>{root=create(render());});assert.equal(step(),'row');assert.equal(input('Prix unitaire (€)').props.value,'9');assert.equal(current().slotSelections.extras.items[0].selectionId,selection.selectionId);
});
await check('P1-PRICE_TARGETED_PARKING_QUOTE_AND_MISMATCH',()=>{
 const parking={...taxi,pricing:{...taxi.pricing,fare:{kind:'UNKNOWN'},parking:{kind:'MANUAL',unitAmount:'3'}}};const next=barEndpoint(parking,'origin',other);assert.deepEqual(next.pricing.parking,parking.pricing.parking);assert.equal(next.pricing.fare.kind,'UNKNOWN');
 const quote={...taxi,pricing:{...taxi.pricing,fare:{kind:'QUOTE',quoteKey:'synthetic-quote-only'}}};assert.throws(()=>barEndpoint(quote,'origin',other),/prix/);assert.throws(()=>barEndpoint(quote,'origin',other,'RETAIN_MANUAL'),/prix/);assert.equal(barEndpoint(quote,'origin',other,'UNKNOWN').pricing.fare.kind,'UNKNOWN');assert.equal(quote.pricing.fare.kind,'QUOTE');
 assert.throws(()=>barEndpoint({...car,destination:{kind:'TEXT',label:'Endpoint autonome différent'}},'destination',other,'UNKNOWN'),/correspondent/);
});


await check('P1-RAW_SAVE_THEN_ADD_PRESERVES_JUST_ADMITTED_PRICE',async()=>{
 await init('night-out','bar-apero',BarLivingEditor);await act(async()=>controls(n=>n.props['aria-label']==='Ajouter une consommation')[0].props.onClick());await click('Bière');await change('Prix unitaire (€)','6,50');
 await act(async()=>controls(n=>n.props['aria-label']==='Ajouter une consommation')[0].props.onClick());await saveGuard();await click('Cocktail');assert.equal(current().slotSelections.extras.items.length,2);assert.equal(current().slotSelections.extras.items[0].cost.kind,'MANUAL');assert.equal(current().slotSelections.extras.items[0].cost.unitAmount,'6.50');assert.equal(current().slotSelections.extras.items[1].label,'Cocktail');
});


await check('P1-RAW_UNDO_DOES_NOT_SAVE_THEN_RESTORE_STALE_HISTORY',async()=>{
 await init('night-out','bar-apero',BarLivingEditor);await act(async()=>controls(n=>n.props['aria-label']==='Ajouter une consommation')[0].props.onClick());await click('Bière');await change('Prix unitaire (€)','8');const before=structuredClone(current());let continued=false;
 await act(async()=>assert.equal(registry.guard(()=>{continued=true;},undefined,false),false));assert.equal(controls(n=>n.props['data-save-workshop']!==undefined).length,0);await click('Continuer à modifier');assert.equal(continued,false);assert.deepEqual(current(),before);assert.equal(input('Prix unitaire (€)').props.value,'8');
 await act(async()=>registry.guard(()=>{continued=true;},undefined,false));await click('Abandonner cette saisie');assert.equal(continued,true);assert.deepEqual(current(),before);
});

fs.mkdirSync('outputs/bar-p1',{recursive:true});fs.writeFileSync('outputs/bar-p1/p1-results.json',JSON.stringify({method:'REAL_REACT_HANDLERS_IN_PROCESS_NOT_BROWSER_NOT_AUTH',checks},null,2));
if(checks.some(c=>c.status==='FAIL'))process.exitCode=1;
}finally{if(root)await act(async()=>root.unmount());await pg.close();}
