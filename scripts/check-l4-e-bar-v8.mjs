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
const {WorkshopComponentRow}=require('@/app/mois-a-venir/composer/workshop-component-row');
const {RestaurantEditor}=require('@/app/mois-a-venir/composer/restaurant-editor');
const {GiftEditor}=require('@/app/mois-a-venir/composer/gift-editor');
const {BarLivingEditor}=require('@/app/mois-a-venir/composer/bar-living-editor');
const {barPlaceOperation,barSameModeReturn,barEndpoint}=require('@/app/mois-a-venir/composer/bar-living-operations');
const {inventoryItems,inventoryLayoutPages}=require('@/app/mois-a-venir/composer/inventory-layout');
const {NightOutEditor}=require('@/app/mois-a-venir/composer/night-out-workshop');
const {EquipmentComponentEditor,componentEditorValues}=require('@/app/mois-a-venir/composer/equipment-component-editor');
const {CatalogContextEditor}=require('@/app/mois-a-venir/composer/catalog-context-editor');
const {ShortStayEditor}=require('@/app/mois-a-venir/composer/short-stay-editor');
const {FamilyVisitEditor}=require('@/app/mois-a-venir/composer/family-visit-editor');
const {fresh,fromSelection,buildComponentRow}=require('@/app/mois-a-venir/composer/night-out-components');
const {stageLocalDecision,visualDraftModel}=require('@/app/mois-a-venir/composer/local-draft');
const {handleComposerRequest}=require('@/server/phase2/planner/composer-service');
const {semanticStateDigest}=require('@/domain/phase2/planner/semantic-state');
const pg=await createKernelPostgres();
const {createPlanApplyRepository}=require('@/server/phase2/planner/repository');
const repository=createPlanApplyRepository(pg.client);
const {COMPOSER_PRESETS}=require('@/domain/phase2/planner/composer-presets');
const checks=[];
const check=async(name,run)=>{await run();checks.push({name,status:'EXECUTED_PASS_REACT_IN_PROCESS_SYNTHETIC_ONLY'});console.log(name+' PASS');};
const text=node=>typeof node==='string'?node:node?.type==='small'||String(node?.props?.['aria-hidden'])==='true'?'':node?.children?.map(text).join('')??'';
let root,registry,requestRef,pendingOps,model,kind,id,steps,rejectNext=false;
const controls=predicate=>root.root.findAll(n=>typeof n.type==='string'&&predicate(n));
const button=(label)=>{const all=controls(n=>n.type==='button'&&(text(n).trim()===label.trim()||label==='Date'&&n.props['aria-label']==='Modifier la date'||label==='Lieu'&&n.props['aria-label']==='Modifier le lieu'));assert.ok(all.length,'Missing button '+label);return all[0];};
const click=async label=>{
  for(let i=0;i<12&&!controls(n=>n.type==='button'&&text(n).trim()===label.trim()).length;i++){
    const next=controls(n=>n.type==='button'&&n.props['aria-label']==='Pages du dock · suivante'&&!n.props.disabled)[0];
    if(next){await act(async()=>next.props.onClick());steps++;continue;} const back=controls(n=>n.type==='button'&&text(n)==='← Ma sortie')[0];if(back&&['Montant direct','Autre'].includes(label)){await act(async()=>back.props.onClick());steps++;continue;}break;
  }
  await act(async()=>button(label).props.onClick());steps++;
};
const openRoute=async direction=>{if(!controls(n=>n.props['data-bar-route']===direction).length){const back=controls(n=>n.type==='button'&&text(n)==='← Ma sortie')[0];if(back)await act(async()=>back.props.onClick());}await act(async()=>controls(n=>n.props['data-bar-route']===direction)[0].props.onClick());};
const openTile=async label=>{if(!tile(label)){const back=controls(n=>n.type==='button'&&text(n)==='← Ma sortie')[0];if(back)await act(async()=>back.props.onClick());}assert.ok(tile(label),'Missing component '+label);await act(async()=>tile(label).props.onClick());};
const input=label=>{const field=controls(n=>n.type==='label'&&text(n).startsWith(label))[0];assert.ok(field,'Missing field '+label+'; labels='+controls(n=>n.type==='label').map(text).join(' | ')+'; buttons='+controls(n=>n.type==='button').map(text).join(' | '));return field.findByType('input');};
const change=async(label,value)=>{await act(async()=>{const node=input(label);for(let p=node.parent;p;p=p.parent)p.props.onChangeCapture?.({target:{value}});node.props.onChange({target:{value}});});steps++;};
const props=()=>({context:model.semanticState.contexts.find(c=>c.contextOccurrenceId===id),model,card:model.board.contexts.find(c=>c.contextOccurrenceId===id),semanticState:model.semanticState,targetMonth:'2026-11',householdPersons:[],options:model.mobilityOptions,busy:false,fresh:true,dockHost:{},host:{},choose:()=>{},close:()=>{},onCancel:()=>{},onSave:admit,decide:admit,saveStatus:'MEMORY',editor:model.editors.find(e=>e.assetKey==='template:'+model.semanticState.contexts.find(c=>c.contextOccurrenceId===id).templateKey)});
const admit=operation=>{if(rejectNext){rejectNext=false;return false;}const semantic=stageLocalDecision(model,model.semanticState,operation);if(!semantic)return false;pendingOps.push(operation);model=visualDraftModel(model,semantic);root?.update(render());return true;};
const render=()=>React.createElement(WorkshopConfirmationProvider,{requestRef},React.createElement(WorkshopChoicesProvider,null,React.createElement(InlineEditContext.Provider,{value:registry},React.createElement(kind,props()))));
const sync=async()=>{await act(async()=>root.update(render()));};
const init=async(template,preset,component)=>{if(root)await act(async()=>root.unmount());registry=new InlineEditRegistry();requestRef={current:()=>{}};registry.requestConfirmation=(message,accept,save)=>requestRef.current({message,accept,save,acceptLabel:'Abandonner cette saisie'});pendingOps=[];steps=0;id=crypto.randomUUID();kind=component;const r=await handleComposerRequest({repository,readWorld:async()=>fixture(),householdPersons:[]},householdId,{sequence:1,targetMonth:'2026-11',draft:state(),kind:'DROP',assetKey:'template:'+template,presetKey:preset,target:{kind:'BOARD_ZONE'},values:{},identity:id,selectionId:crypto.randomUUID()});assert.equal(r.ok,true,JSON.stringify(r));model=r.model;await act(async()=>{root=create(render(),{createNodeMock:element=>element.type==='dialog'?{open:false,showModal(){this.open=true;},close(){this.open=false;},querySelector(){return{focus(){}};},contains(){return false;}}:null});});};
const current=()=>model.semanticState.contexts.find(c=>c.contextOccurrenceId===id);
const save=async()=>{const dirty=controls(n=>n.props['data-bar-living-editor']!==undefined)[0]?.props['data-inline-dirty'];if(dirty)await click('Enregistrer');else await click('Date');await sync();};
const shortInput=label=>input(label);
const tile=label=>controls(n=>n.type==='button'&&n.findAll(c=>c.type==='strong'&&(text(c)===label||text(c).startsWith(label+' ×'))).length)[0];
try {
await check('V8_ADD_REMOVE_BEFORE_FIRST_SOCKET_PROJECTION',async()=>{
 await init('night-out','bar-apero',BarLivingEditor);
 model={...model,board:{...model.board,contexts:model.board.contexts.map(c=>c.contextOccurrenceId===id?{...c,sockets:[]}:c)}};await sync();
 await act(async()=>controls(n=>n.props['aria-label']==='Ajouter une consommation')[0].props.onClick());await click('Bière');assert.equal(current().slotSelections.extras.items.length,1);
 await click('Retirer');await sync();
 assert.equal(current().slotSelections.extras.items.length,0);assert.equal(pendingOps.length,2);
});
await check('V6_V8_COMPARABLE_UNKNOWN_BEER_ADMISSION_EFFORT',async()=>{
 await init('night-out','bar-apero',NightOutEditor);steps=0;
 await click('Consommations');await click('Bière');assert.equal(pendingOps.length,0);
 await click('Prix à préciser');await click('Conserver ce poste');await sync();
 const old=steps;assert.equal(current().slotSelections.extras.items[0].cost.kind,'UNKNOWN');
 await init('night-out','bar-apero',BarLivingEditor);steps=0;
 await click('Bière');const next=steps;
 assert.equal(current().slotSelections.extras.items[0].cost.kind,'UNKNOWN');assert.equal(old,4);assert.equal(next,1);
 fs.mkdirSync('outputs/l4e',{recursive:true});fs.writeFileSync('outputs/l4e/effort.json',JSON.stringify({method:'ACTUAL_REACT_HANDLERS_NOT_BROWSER_NOT_KEYSTROKES',samePreset:'bar-apero',start:'existing empty card editor',finish:'one explicitly chosen beer, quantity1, UNKNOWN price admitted',v6ControlActions:old,p2ControlActions:next,latency:'NOT_MEASURED',geometry:'NOT_MEASURED'},null,2));
});
await check('V8_P2_NEUTRAL_ENTRY_AND_QUICK_UNKNOWN_ADMISSION',async()=>{
 await init('night-out','bar-apero',BarLivingEditor);
 assert.equal(controls(n=>n.props['data-bar-step']==='summary').length,1);
 await act(async()=>controls(n=>n.props['aria-label']==='Ajouter une consommation')[0].props.onClick());await click('Bière');
 assert.equal(current().slotSelections.extras.items.length,1);
 const beer=current().slotSelections.extras.items[0];assert.equal(beer.quantity,'1');assert.equal(beer.cost.kind,'UNKNOWN');
 assert.equal(registry.count(),0);assert.equal(shortInput('Prix unitaire (€)').props.value,'');
 await save();assert.equal(pendingOps.length,1);assert.equal(current().slotSelections.extras.items[0].selectionId,beer.selectionId);
 assert.ok(!current().fields.plannedDate);assert.ok(!current().slotSelections.outbound?.items.length);
});
await check('V8_RAW_CANCEL_ESCAPE_DISCARD_PRESERVES_ADMITTED_UNKNOWN',async()=>{
 await openTile('Bière');await change('Prix unitaire (€)','8');
 const digest=semanticStateDigest(model.semanticState),before=pendingOps.length;
 await act(async()=>controls(n=>n.type==='button'&&n.props['aria-label']==='Ajouter une consommation')[0].props.onClick());assert.equal(registry.count(),1);assert.equal(shortInput('Prix unitaire (€)').props.value,'8');
 await click('Continuer à modifier');assert.equal(shortInput('Prix unitaire (€)').props.value,'8');
 await act(async()=>controls(n=>n.type==='button'&&n.props['aria-label']==='Ajouter une consommation')[0].props.onClick());await act(async()=>controls(n=>n.type==='dialog'&&n.props['data-workshop-confirmation']!==undefined)[0].props.onCancel({preventDefault(){}}));
 assert.equal(registry.count(),1);await act(async()=>controls(n=>n.type==='button'&&n.props['aria-label']==='Ajouter une consommation')[0].props.onClick());await click('Abandonner cette saisie');
 assert.equal(registry.count(),0);assert.equal(semanticStateDigest(model.semanticState),digest);assert.equal(pendingOps.length,before);
 assert.equal(current().slotSelections.extras.items[0].cost.kind,'UNKNOWN');
});
await check('V8_DIRECT_REEDIT_8_PLUS_12_AND_QUANTITY_IDENTITY',async()=>{
 await openTile('Bière');await change('Prix unitaire (€)','8');await save();
 const first=current().slotSelections.extras.items[0];await click('Cocktail');await change('Prix unitaire (€)','12');await save();
 assert.equal(current().slotSelections.extras.items[0].selectionId,first.selectionId);
 const response=await handleComposerRequest({repository,readWorld:async()=>fixture(),householdPersons:[]},householdId,{kind:'READ',sequence:20,targetMonth:'2026-11',draft:model.semanticState});
 assert.equal(response.ok,true,response.code);model=response.model;await sync();
 const amounts=model.board.contexts.find(c=>c.contextOccurrenceId===id).sockets.find(s=>s.slotKey==='extras').evaluations.map(e=>e.economicAmount).sort();
 assert.deepEqual(amounts,['12.00','8.00']);
 await openTile('Bière');await act(async()=>controls(n=>n.type==='button'&&n.props['aria-label']==='Augmenter la quantité')[0].props.onClick());await save();
 assert.equal(current().slotSelections.extras.items[0].quantity,'2');assert.equal(current().slotSelections.extras.items[0].selectionId,first.selectionId);
});
await check('V8_REMOVE_UNDO_RESTORE_IDENTITIES_AND_PRICE',async()=>{
 const before=structuredClone(model.semanticState),beer=before.contexts.find(c=>c.contextOccurrenceId===id).slotSelections.extras.items[0];
 await openTile('Bière');await click('Retirer');await sync();
 assert.equal(current().slotSelections.extras.items.length,1);assert.equal(current().slotSelections.extras.items[0].label,'Cocktail');
 model=visualDraftModel(model,before);await sync();assert.deepEqual(current().slotSelections.extras.items[0],beer);
});
await check('V8_REJECTED_SAVE_RETRY_AND_ZERO_DISTINCT_FROM_UNKNOWN',async()=>{
 await openTile('Bière');await change('Prix unitaire (€)','0');rejectNext=true;await click('Enregistrer');
 assert.equal(registry.count(),1);assert.equal(shortInput('Prix unitaire (€)').props.value,'0');assert.ok(controls(n=>n.props.role==='alert').length);
 await save();assert.equal(current().slotSelections.extras.items[0].cost.kind,'MANUAL');assert.equal(current().slotSelections.extras.items[0].cost.unitAmount,'0');
});
await check('V8_OWNED_RETURN_AND_PLACE_INVALIDATION_ATOMIC_UNDO',async()=>{
 const home={kind:'KNOWN',placeId:uuid(99001)},venue={kind:'KNOWN',placeId:uuid(99002)};
 const car={kind:'MOBILITY_INTENT',selectionId:uuid(99003),optionKey:'car',provenance:'EXPLICIT_USER_DECISION',origin:home,destination:venue,returnRequired:false,
  route:{version:'composer-mobility-route@v1',vehicleRef:{vehicleId:uuid(99004),labelAtSelection:'Véhicule fixture',provenance:'EXPLICIT_USER_DECISION'},manualFuelPrice:'1.80',toll:{kind:'MANUAL',unitAmount:'5'},
    stops:[{label:'Départ fixture',placeId:home.placeId,coordinates:{lat:43,lng:3},distanceToNextKm:'10',distanceSource:'TOMTOM'},{label:'Bar fixture',placeId:venue.placeId,endpointSource:'ROOT_PLACE',coordinates:{lat:43.1,lng:3.1}}]},
  pricing:{fare:{kind:'MANUAL',unitAmount:'10'},parking:{kind:'MANUAL',unitAmount:'2'},fundingAllocations:[{source:'BANK',amount:'12'}],preference:'FASTEST'}};
 assert.equal(admit({kind:'EDIT_NIGHT_OUT',edit:{contextOccurrenceId:id,fields:{placeRef:venue},slots:{outbound:[car]}}}),true);await sync();
 const backId=uuid(99005);assert.equal(admit(barSameModeReturn(current(),backId)),true);await sync();
 const back=current().slotSelections.return.items[0];assert.equal(back.selectionId,backId);assert.deepEqual(back.origin,venue);assert.deepEqual(back.destination,home);
 assert.equal(back.returnRequired,false);assert.equal(back.pricing.fare.kind,'UNKNOWN');assert.deepEqual(back.pricing.fundingAllocations,[]);assert.deepEqual(back.route.vehicleRef,car.route.vehicleRef);assert.ok(!back.route.toll);
 assert.deepEqual(current().slotSelections.outbound.items[0],car);assert.throws(()=>barSameModeReturn(current(),crypto.randomUUID()));
 const before=structuredClone(model.semanticState),food=structuredClone(current().slotSelections.extras);
 assert.equal(admit(barPlaceOperation(current(),{kind:'TEXT',label:'Autre bar fixture',provenance:'USER_DECLARED_PROSPECTIVE'})),true);await sync();
 const after=current(),out=after.slotSelections.outbound.items[0],ret=after.slotSelections.return.items[0];
 assert.deepEqual(out,car);assert.deepEqual(ret,back);
 const explicit=barEndpoint({...car,pricing:{...car.pricing,fundingAllocations:[]}},'destination',{kind:'TEXT',label:'Autre bar fixture'},'UNKNOWN');assert.deepEqual(out.origin,home);assert.deepEqual(ret.destination,home);
 assert.equal(explicit.pricing.fare.kind,'UNKNOWN');assert.equal(explicit.pricing.parking.kind,'UNKNOWN');assert.deepEqual(explicit.pricing.fundingAllocations,[]);
 assert.deepEqual(out.route.vehicleRef,car.route.vehicleRef);assert.equal(out.route.manualFuelPrice,'1.80');assert.equal(explicit.route.toll.kind,'UNKNOWN');
 assert.ok(!explicit.route.stops[0].distanceToNextKm);assert.ok(!explicit.route.stops[1].coordinates);assert.deepEqual(after.slotSelections.extras,food);
 model=visualDraftModel(model,before);await sync();assert.deepEqual(current().slotSelections.outbound.items[0],car);
 const linked={...car,journey:{relation:'SHARES_JOURNEY',certainty:'CERTAIN',targetIntentId:uuid(99006),externalExpenseId:null,externalCostLineIds:[],choice:'MERGE',stopIndex:null,accessLegIndex:null}};
 assert.throws(()=>barEndpoint(linked,'destination',{kind:'TEXT',label:'Nouveau repère'}),/externe/);assert.equal(linked.journey.relation,'SHARES_JOURNEY');assert.equal(linked.journey.certainty,'CERTAIN');
 assert.throws(()=>barSameModeReturn({...current(),slotSelections:{outbound:{items:[{...car,returnRequired:true}]}}},crypto.randomUUID()),/aller-retour/);
});
await check('V8_RETURN_MODE_CHANGE_NO_RESIDUAL_CAR_COST',async()=>{
 const configured=structuredClone(current().slotSelections.outbound.items[0]);
 model={...model,mobilityOptions:{places:[],vehicle:{vehicleId:configured.route.vehicleRef.vehicleId,label:configured.route.vehicleRef.labelAtSelection,consumptionL100Km:'8',fuelPricePerLiter:'1.8',fuelPriceSource:'Synthetic'}}};await sync();
 await openRoute('outbound');await click('Utiliser '+configured.route.vehicleRef.labelAtSelection);await sync();
 assert.deepEqual(current().slotSelections.outbound.items[0].route.stops,configured.route.stops);assert.equal(current().slotSelections.outbound.items[0].route.manualFuelPrice,configured.route.manualFuelPrice);assert.deepEqual(current().slotSelections.outbound.items[0].route.toll,configured.route.toll);
 const before=structuredClone(current().slotSelections.outbound.items[0]);await act(async()=>{root.unmount();root=create(render());});
 const routeButtons=controls(n=>n.type==='button'&&(n.props['data-bar-route']==='return'||n.props['data-bar-add-route']==='return'));assert.equal(routeButtons.length,1);await act(async()=>routeButtons[0].props.onClick());
 const taxis=controls(n=>n.type==='button'&&text(n)==='Taxi / Uber');assert.ok(taxis.length);await act(async()=>taxis[0].props.onClick());await click('Changer de mode');await sync();
 const back=current().slotSelections.return.items[0];assert.equal(back.optionKey,'taxi');assert.ok(!back.route);assert.equal(back.pricing.fare.kind,'UNKNOWN');assert.deepEqual(current().slotSelections.outbound.items[0],before);
 const returnButton=controls(n=>n.type==='button'&&(n.props['data-bar-route']==='return'||n.props['data-bar-add-route']==='return'))[0];await act(async()=>returnButton.props.onClick());
 await click('Préciser le prix du trajet');await change('Coût prévu du billet ou de la course (€)','12');await click('Retenir le coût du trajet');await sync();
 const priced=current().slotSelections.return.items[0];assert.equal(priced.pricing.fare.unitAmount,'12');assert.deepEqual(priced.origin,back.origin);assert.deepEqual(priced.destination,back.destination);assert.equal(priced.selectionId,back.selectionId);assert.deepEqual(current().slotSelections.outbound.items[0],before);
});
await check('V8_LAYOUT_EXPANSION_DENSE_PAGES_AND_EXACT_COLLAPSE',()=>{
 const original=inventoryItems(model);const bar=original.find(n=>n.id===id)??original.find(n=>n.kind!=='FIXED');assert.ok(bar);
 for(const count of [5,16,30,50]){const dense=[bar,...Array.from({length:count-1},(_,i)=>({...bar,id:'neighbor:'+i,width:230,height:240}))];
 for(const [width,height] of [[1000,470],[1200,470],[1330,550]]){
  const baseline=inventoryLayoutPages(dense,width,height),open=inventoryLayoutPages(dense,width,height,bar.id),closed=inventoryLayoutPages(dense,width,height);
  assert.deepEqual(closed,baseline);if(count>=16)assert.ok(open.length>1);
  const a=baseline.flat().find(p=>p.item.id===bar.id),b=open.flat().find(p=>p.item.id===bar.id);assert.ok(b.columnSpan>a.columnSpan);assert.ok(b.rowSpan>a.rowSpan);
  for(const page of open){const cells=new Set();for(const p of page)for(let x=p.column;x<p.column+p.columnSpan;x++)for(let y=p.row;y<p.row+p.rowSpan;y++){const key=x+':'+y;assert.equal(cells.has(key),false);cells.add(key);}}
  assert.deepEqual(open.flat().map(p=>p.item.id),dense.map(n=>n.id));
 }}
});
await check('V8_SYNTHETIC_APPLY_READ_REEDIT_COMPLETE_COST',async()=>{
 await init('night-out','bar-apero',BarLivingEditor);await act(async()=>controls(n=>n.props['aria-label']==='Ajouter une consommation')[0].props.onClick());await click('Bière');await change('Prix unitaire (€)','8');await save();await click('Cocktail');await change('Prix unitaire (€)','12');await save();
 const deps={repository,readWorld:async()=>fixture(),householdPersons:[]};
 let response=await handleComposerRequest(deps,householdId,{kind:'READ',sequence:90,targetMonth:'2026-11',draft:model.semanticState});assert.equal(response.ok,true,response.code);
 const proof=response.model.proof,expected=structuredClone(model.semanticState);
 response=await handleComposerRequest(deps,householdId,{kind:'APPLY',sequence:91,targetMonth:'2026-11',draft:expected,command:{...proof,applyRequestId:crypto.randomUUID()}});
 assert.equal(response.ok,true,JSON.stringify({code:response.code,message:response.message}));assert.equal(response.applied,true);
 const reload=await handleComposerRequest(deps,householdId,{kind:'READ',sequence:92,targetMonth:'2026-11'});assert.equal(reload.ok,true,reload.code);
 const reloaded=reload.model.semanticState.contexts.find(c=>c.contextOccurrenceId===id);assert.deepEqual(reloaded.slotSelections,current().slotSelections);
 assert.deepEqual(reloaded.fields,current().fields);model=reload.model;await sync();
 await openTile('Bière');await change('Prix unitaire (€)','9');await save();assert.equal(current().slotSelections.extras.items[0].cost.unitAmount,'9');
});
await check('V8_COMPACT_COMPONENT_DIRECT_TARGET_REOPEN_AND_PROTECTION',async()=>{
 const {BarLivingCard}=require('@/app/mois-a-venir/composer/bar-living-card');
 if(root)await act(async()=>root.unmount());let target;
 const value=model.board.contexts.find(c=>c.contextOccurrenceId===id),selection=current().slotSelections.extras.items[0];
 await act(async()=>{root=create(React.createElement(BarLivingCard,{card:value,model,living:{open:(_,next)=>target=next,close(){}},busy:false,preserved:false,preserve(){},drag(){}}));});
 await openTile('Bière');assert.equal(target,`component:extras:${selection.selectionId}`);
 await act(async()=>root.unmount());const previousProps=props;
 await act(async()=>{root=create(React.createElement(WorkshopConfirmationProvider,{requestRef},React.createElement(WorkshopChoicesProvider,null,React.createElement(InlineEditContext.Provider,{value:registry},React.createElement(BarLivingEditor,{...previousProps(),initialTarget:target})))));});
 assert.equal(input('Prix unitaire (€)').props.value,'9');assert.equal(current().slotSelections.extras.items[0].selectionId,selection.selectionId);
 const protectedDraft=structuredClone(model.semanticState);protectedDraft.preferences.flexibility[id]='PRESERVE';
 assert.throws(()=>stageLocalDecision(model,protectedDraft,{kind:'EDIT_NIGHT_OUT',edit:{contextOccurrenceId:id,fields:{label:'Forbidden'}}}),/LOCKED/);
 assert.equal(stageLocalDecision(model,protectedDraft,{kind:'CLEAR_SOCKET',contextOccurrenceId:id,slotKey:'extras',selectionId:selection.selectionId}),null);
});
await check('V8_GOOGLE_OFFICIAL_VENUE_TRANSIENT_STALE_AND_FAILURE',async()=>{
 if(root)await act(async()=>root.unmount());
 const {BarPlaceSearch}=require('@/app/mois-a-venir/composer/bar-place-search');const calls=[],pending=[];let adopted=[];
 const previous=globalThis.fetch;globalThis.fetch=async(path,options)=>{assert.ok(['/api/places/autocomplete','/api/places/details'].includes(path));const body=JSON.parse(options.body);assert.equal(body.context.kind,'BAR_APERO');calls.push({path,body});return await new Promise(resolve=>pending.push({resolve,signal:options.signal}));};
 const mount=()=>React.createElement(BarPlaceSearch,{places:[{placeId:uuid(98001),name:'Bar fixture connu',googlePlaceId:'known_google_123',relationships:[]}],onKnown:placeId=>adopted.push(placeId)});
 try{
  await act(async()=>{root=create(mount());});await change('Ville','Ville fixture');await change('Chercher un bar','Alpha');await act(async()=>new Promise(r=>setTimeout(r,330)));assert.equal(calls.length,1);const token=calls[0].body.sessionToken;
  await change('Chercher un bar','Beta');assert.equal(pending[0].signal.aborted,true);await act(async()=>{pending[0].resolve({ok:true,json:async()=>({suggestions:[{source:'google_places',placeId:'stale_123',primaryText:'Périmé',secondaryText:null}]})});});
  assert.equal(controls(n=>n.type==='button'&&text(n).includes('Périmé')).length,0);await act(async()=>new Promise(r=>setTimeout(r,330)));assert.equal(calls[1].body.sessionToken,token);
  await act(async()=>pending[1].resolve({ok:true,json:async()=>({suggestions:[{source:'google_places',placeId:'known_google_123',primaryText:'Bar fixture connu',secondaryText:'Ville fixture'}]})}));
  await click('Bar fixture connu · Ville fixture');assert.equal(calls[2].path,'/api/places/details');assert.equal(calls[2].body.sessionToken,token);
  await act(async()=>pending[2].resolve({ok:true,json:async()=>({place:{provider:'google_places',placeId:'known_google_123',displayName:'Bar fixture connu',formattedAddress:'Adresse synthétique',lat:43,lng:3,types:['bar'],photoAttributions:[]}})}));
  await click('Retenir ce lieu enregistré');assert.deepEqual(adopted,[uuid(98001)]);
  await change('Chercher un bar','Gamma');await act(async()=>new Promise(r=>setTimeout(r,330)));assert.notEqual(calls[3].body.sessionToken,token);
  await act(async()=>pending[3].resolve({ok:true,json:async()=>({suggestions:[{source:'google_places',placeId:'new_google_123',primaryText:'Nouveau bar',secondaryText:null}]})}));
  await click('Nouveau bar · ');await act(async()=>pending[4].resolve({ok:true,json:async()=>({place:{provider:'google_places',placeId:'new_google_123',displayName:'Nouveau bar',formattedAddress:'Adresse synthétique',types:['bar']}})}));
  assert.equal(controls(n=>n.type==='button'&&text(n)==='Retenir ce lieu enregistré').length,0);assert.ok(controls(n=>n.type==='p'&&text(n).includes('Ce lieu n’est pas encore enregistré')).length);assert.equal(adopted.length,1);
  await change('Chercher un bar','Delta');await act(async()=>new Promise(r=>setTimeout(r,330)));await act(async()=>pending[5].resolve({ok:false,status:429}));assert.ok(controls(n=>n.props.role==='status'&&text(n).includes('limitée')).length);
  await change('Chercher un bar','Epsilon');await act(async()=>new Promise(r=>setTimeout(r,330)));await act(async()=>pending[6].resolve({ok:true,json:async()=>{throw new SyntaxError('Unexpected token <');}}));assert.ok(controls(n=>n.props.role==='status'&&text(n).includes('Recherche indisponible')).length);assert.equal(adopted.length,1);
  for(const [status,query,expected] of [[401,'Zeta','Connectez-vous'],[403,'Eta','Accès à la recherche refusé']]){
    await change('Chercher un bar',query);await act(async()=>new Promise(r=>setTimeout(r,330)));await act(async()=>pending.at(-1).resolve({ok:false,status}));
    assert.ok(controls(n=>n.props.role==='status'&&text(n).includes(expected)).length);assert.equal(adopted.length,1);
  }
  await change('Chercher un bar','Theta');await act(async()=>new Promise(r=>setTimeout(r,330)));await act(async()=>pending.at(-1).resolve({ok:true,json:async()=>({suggestions:[{source:'google_places',placeId:'invalid_details_123',primaryText:'Détail fixture',secondaryText:'Ville fixture'}]})}));
  await click('Détail fixture · Ville fixture');await act(async()=>pending.at(-1).resolve({ok:true,json:async()=>({place:{provider:'google_places',placeId:'wrong_details_123',displayName:'Autre identité'}})}));
  assert.ok(controls(n=>n.props.role==='status'&&text(n).includes('Lieu non admissible')).length);assert.equal(adopted.length,1);
 }finally{globalThis.fetch=previous;}
});

await check('V8_INLINE_CALENDAR_PEOPLE_AND_SUMMARY_NO_FINANCE_MULTIPLICATION',async()=>{
 await init('night-out','bar-apero',BarLivingEditor);await click('Date');assert.equal(controls(n=>n.props['data-bar-calendar']!==undefined).length,1);
 await act(async()=>controls(n=>n.type==='button'&&n.props['aria-label']==='2026-11-15')[0].props.onClick());await sync();assert.equal(current().fields.plannedDate,'2026-11-15');
 await act(async()=>controls(n=>n.type==='button'&&n.props['aria-label']?.startsWith('Modifier les personnes'))[0].props.onClick());
 for(const person of ['Ami test','Camille test','Alex test']){await change('Autre prénom',person);await click('Ajouter ce prénom');}
 /* P2: each person toggle is already an admitted decision. */await sync();assert.equal(current().fields.participantRefs.length,3);assert.equal(registry.count(),0);assert.equal(current().fields.plannedDate,'2026-11-15');
 await click('Date');await click('Montant direct');await click('Consommations regroupées');await change('Coût prévu (€)','20');await click('Retenir ce coût');await sync();
 const shared=current().slotSelections.main.items[0];assert.equal(shared.unitBasis,'SHARED');assert.equal(shared.quantity,'1');assert.equal(shared.cost.unitAmount,'20');
 const response=await handleComposerRequest({repository,readWorld:async()=>fixture(),householdPersons:[]},householdId,{kind:'READ',sequence:110,targetMonth:'2026-11',draft:model.semanticState});assert.equal(response.ok,true,response.code);
 const amounts=response.model.board.contexts.find(c=>c.contextOccurrenceId===id).sockets.find(s=>s.slotKey==='main').evaluations.map(e=>e.economicAmount);assert.deepEqual(amounts,['20.00']);
 model=response.model;await sync();const fields=structuredClone(current().fields);await click('Bière');assert.equal(controls(n=>n.props['data-bar-step']==='coverage').length,1);assert.equal(current().slotSelections.main.items[0].selectionId,shared.selectionId);
 await click('Ne rien ajouter');assert.equal(current().slotSelections.extras.items.length,0);await click('Bière');await click('Détailler à la place');await change('Prix unitaire (€)','8');await save();
 assert.equal(current().slotSelections.main.items.length,0);assert.deepEqual(current().fields,fields);await click('Cocktail');await change('Prix unitaire (€)','12');await save();
 const read=await handleComposerRequest({repository,readWorld:async()=>fixture(),householdPersons:[]},householdId,{kind:'READ',sequence:111,targetMonth:'2026-11',draft:model.semanticState});assert.equal(read.ok,true,read.code);assert.equal(read.model.nightOutSummaries.find(x=>x.contextOccurrenceId===id).knownAmount,'20.00');
});
await check('V8_TOTAL_DETAIL_CONFIRM_CANCEL_ACCEPT_AND_UNDO_PRESERVES_IDS',async()=>{
 const details=structuredClone(model.semanticState),ids=current().slotSelections.extras.items.map(x=>x.selectionId);await click('Date');await click('Montant direct');await click('Consommations regroupées');await change('Coût prévu (€)','30');await click('Retenir ce coût');
 await click('Continuer à modifier');assert.deepEqual(current().slotSelections.extras.items.map(x=>x.selectionId),ids);assert.equal(input('Coût prévu (€)').props.value,'30');
 await click('Retenir ce coût');await click('Remplacer par le total');await sync();assert.equal(current().slotSelections.extras.items.length,0);assert.equal(current().slotSelections.main.items[0].cost.unitAmount,'30');
 model=visualDraftModel(model,details);await sync();assert.deepEqual(current().slotSelections.extras.items.map(x=>x.selectionId),ids);
});
await check('V8_PARTIAL_EDIT_PRESERVES_UNKNOWN_AND_INDEPENDENT_FIELDS',async()=>{
 const before=structuredClone(current());await openTile('Bière');await change('Prix unitaire (€)','12');await save();assert.deepEqual(current().fields,before.fields);assert.equal(current().slotSelections.extras.items[0].selectionId,before.slotSelections.extras.items[0].selectionId);assert.deepEqual(current().slotSelections.extras.items[1],before.slotSelections.extras.items[1]);
});
fs.mkdirSync('outputs/l4e',{recursive:true});fs.writeFileSync('outputs/l4e/interactions.json',JSON.stringify({method:'REACT_IN_PROCESS_PORTALS_AND_REFS_SIMULATED_NOT_BROWSER',checks},null,2));
console.log('V8 '+checks.length+' groups PASS; browser/auth NOT_RUN');
}finally{if(root)await act(async()=>root.unmount());await pg.close();}
