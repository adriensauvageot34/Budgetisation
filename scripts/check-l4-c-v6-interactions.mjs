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
const text=node=>typeof node==='string'?node:node?.type==='small'?'':node?.children?.map(text).join('')??'';
let root,registry,requestRef,pendingOps,model,kind,id,steps,rejectNext=false;
const controls=predicate=>root.root.findAll(n=>typeof n.type==='string'&&predicate(n));
const button=(label)=>{const all=controls(n=>n.type==='button'&&text(n)===label);assert.ok(all.length,'Missing button '+label);return all[0];};
const click=async label=>{await act(async()=>button(label).props.onClick());steps++;};
const input=label=>{const field=controls(n=>n.type==='label'&&text(n).startsWith(label))[0];assert.ok(field,'Missing field '+label+'; labels='+controls(n=>n.type==='label').map(text).join(' | ')+'; buttons='+controls(n=>n.type==='button').map(text).join(' | '));return field.findByType('input');};
const change=async(label,value)=>{await act(async()=>{const node=input(label);for(let p=node.parent;p;p=p.parent)p.props.onChangeCapture?.({target:{value}});node.props.onChange({target:{value}});});steps++;};
const props=()=>({context:model.semanticState.contexts.find(c=>c.contextOccurrenceId===id),model,card:model.board.contexts.find(c=>c.contextOccurrenceId===id),semanticState:model.semanticState,targetMonth:'2026-11',householdPersons:[],options:model.mobilityOptions,busy:false,fresh:true,dockHost:{},host:{},choose:()=>{},close:()=>{},onCancel:()=>{},onSave:admit,decide:admit,saveStatus:'MEMORY',editor:model.editors.find(e=>e.assetKey==='template:'+model.semanticState.contexts.find(c=>c.contextOccurrenceId===id).templateKey)});
const admit=operation=>{if(rejectNext){rejectNext=false;return false;}const semantic=stageLocalDecision(model,model.semanticState,operation);if(!semantic)return false;pendingOps.push(operation);model=visualDraftModel(model,semantic);return true;};
const render=()=>React.createElement(WorkshopConfirmationProvider,{requestRef},React.createElement(WorkshopChoicesProvider,null,React.createElement(InlineEditContext.Provider,{value:registry},React.createElement(kind,props()))));
const sync=async()=>{await act(async()=>root.update(render()));};
const init=async(template,preset,component)=>{if(root)await act(async()=>root.unmount());registry=new InlineEditRegistry();requestRef={current:()=>{}};registry.requestConfirmation=(message,accept)=>requestRef.current({message,accept,acceptLabel:'Abandonner cette saisie'});pendingOps=[];steps=0;id=crypto.randomUUID();kind=component;const r=await handleComposerRequest({repository,readWorld:async()=>fixture(),householdPersons:[]},householdId,{sequence:1,targetMonth:'2026-11',draft:state(),kind:'DROP',assetKey:'template:'+template,presetKey:preset,target:{kind:'BOARD_ZONE'},values:{},identity:id,selectionId:crypto.randomUUID()});assert.equal(r.ok,true,JSON.stringify(r));model=r.model;await act(async()=>{root=create(render(),{createNodeMock:element=>element.type==='dialog'?{open:false,showModal(){this.open=true;},close(){this.open=false;},querySelector(){return{focus(){}};},contains(){return false;}}:null});});};
try {
await check('RAW_DEFER_CANCEL_ACCEPT_STALE_AND_SCOPE',()=>{
 const r=new InlineEditRegistry();let accept,changed=0,discard=0;r.requestConfirmation=(_,a)=>accept=a;
 const raw={targetRef:'a',dimension:'price',kind:'RAW',discard:()=>discard++,flush:()=>assert.fail('RAW flushed')};r.set('a',raw);
 assert.equal(r.guard(()=>changed++),false);assert.equal(changed,0);assert.equal(r.count(),1); // cancel = no continuation
 accept();assert.equal(changed,1);assert.equal(discard,1);accept();assert.equal(changed,1);
 r.set('a',raw);r.guard(()=>changed++);r.set('a',{...raw});accept();assert.equal(changed,1);assert.equal(r.count(),1);
 assert.equal(r.guard(()=>changed++,new Set(['b'])),true);assert.equal(r.count(),1);
});
await check('RESTAURANT_RAW_CANCEL_ESCAPE_ACCEPT_AND_NO_ADMISSION',async()=>{
 await init('restaurant','restaurant-for-two',RestaurantEditor);await click('Montant rapide');await change('Coût prévu à notre charge','60');await click('Conserver ce coût');await sync();assert.equal(pendingOps.length,1);
 await click('Montant rapide');await change('Coût prévu à notre charge','61');const digest=semanticStateDigest(model.semanticState);assert.equal(registry.count(),1);
 await click('← Retour au résumé');assert.equal(input('Coût prévu à notre charge').props.value,'61');assert.equal(semanticStateDigest(model.semanticState),digest);
 assert.equal(button('Continuer à modifier').props.autoFocus,true);await click('Continuer à modifier');assert.equal(input('Coût prévu à notre charge').props.value,'61');
 await click('← Retour au résumé');await act(async()=>controls(n=>n.type==='dialog'&&n.props['data-workshop-confirmation']!==undefined)[0].props.onCancel({preventDefault(){}}));assert.equal(input('Coût prévu à notre charge').props.value,'61');
 await click('← Retour au résumé');await click('Abandonner cette saisie');assert.equal(registry.count(),0);assert.equal(pendingOps.length,1);assert.equal(semanticStateDigest(model.semanticState),digest);
 await click('Montant rapide');assert.equal(input('Coût prévu à notre charge').props.value,'60');
});
await check('RESTAURANT_TOTAL_DETAIL_45_PLUS_15_AND_CANCEL',async()=>{
 await click('Détailler');assert.equal(pendingOps.length,1);await click('Continuer à modifier');assert.equal(input('Coût prévu à notre charge').props.value,'60');
 await click('Détailler');await click('Préparer les postes');await change('Coût prévu par lot','45');await click('Conserver ce poste');await sync();
 await click('Compléments');await click('Dessert');await change('Prix unitaire prévu','15');await click('Conserver ce poste');await sync();
 const c=props().context;assert.equal(c.slotSelections.meal.items[0].cost.unitAmount,'45');assert.equal(c.slotSelections.extras.items[0].cost.unitAmount,'15');assert.equal(pendingOps.length,3);
});
await check('DELIVERY_INCLUDED_FEE_CANCEL_THEN_EXPLICIT_EXTRA',async()=>{
 await init('delivery','uber-eats-order',RestaurantEditor);await click('Commande complète');await change('Coût prévu à notre charge','35');await click('Conserver ce coût');await sync();
 await click('Frais non inclus');await click('Livraison');await click('Inclus · garder le total');assert.equal(pendingOps.length,1);
 await click('Livraison');await click('Supplément réel');await change('Prix unitaire prévu','5');await click('Conserver ce poste');await sync();assert.equal(props().context.slotSelections.meal.items[0].cost.unitAmount,'35');assert.equal(props().context.slotSelections.extras.items[0].cost.unitAmount,'5');
});
await check('GIFT_OBJECT_OCCASION_PRICE_ONLY_UNKNOWN_AND_REJECT',async()=>{
 await init('gift','gift-present',GiftEditor);await click('Objet');await change('Quel objet ou produit','Livre libre');await click('Retour au résumé');await click('Occasion');await click('Anniversaire');await click('Retour au résumé');await click('Prix');await change('Prix unitaire prévu','-1');await click('Conserver ce poste');assert.equal(pendingOps.length,0);assert.equal(input('Prix unitaire prévu').props.value,'-1');
 await change('Prix unitaire prévu','20');await click('Conserver ce poste');await sync();const c=structuredClone(props().context);assert.equal(c.fields.objectLabel,'Livre libre');assert.equal(c.fields.occasion,'Anniversaire');assert.ok(!c.fields.plannedDate);
 await click('Prix');await change('Prix unitaire prévu','21');await click('Conserver ce poste');await sync();assert.deepEqual(props().context.fields,c.fields);assert.equal(props().context.slotSelections.item.items[0].selectionId,c.slotSelections.item.items[0].selectionId);
});
await check('NIGHT_SHARED_PRICE_DIRECT_NO_FORCED_PEOPLE',async()=>{
 await init('night-out','bar-apero',NightOutEditor);await click('Bouteille partagée');await click('Mon choix, à saisir');assert.equal(controls(n=>n.type==='section'&&n.props['data-workshop-page']==='price').length,1);
 await change('Coût prévu par lot','25');await click('Conserver ce poste');await sync();const c=props().context;assert.equal(c.slotSelections.extras.items[0].unitBasis,'SHARED');assert.equal(c.slotSelections.extras.items[0].quantity,'1');assert.ok(!c.fields.participantRefs?.length);
});
await check('COMPONENT_ADAPTER_PRESERVES_PERSON_QUOTE_FUNDING_AND_UNKNOWN',()=>{
 const base=buildComponentRow({...fresh('Billets'),unitBasis:'PERSON',quantity:'2',personCount:'3',amount:'20',costMode:'MANUAL'},'activity');const row=fromSelection(base);const values=componentEditorValues(row,{needOccurrenceId:'exact-owned-reference',unmodified:'preserved'});assert.equal(values.quantity,'2');assert.equal(values.personCount,'3');assert.equal(values.needOccurrenceId,'exact-owned-reference');assert.equal(values.unmodified,'preserved');assert.equal(values.unitBasis,'PERSON');assert.equal(componentEditorValues({...row,costMode:'UNKNOWN'},values).costMode,'UNKNOWN');
});

await check('A1_PERSON_TARIFF_AND_QUANTITY_EXPLICIT',async()=>{
 await init('activity','spa-relax',RestaurantEditor);await click('Tarif et quantité');await change('Coût prévu par lot','20');await click('Quantité · 1');await click('Par personne');await change('Personnes explicitement tarifées','2');await click('Retour au prix');await click('Conserver ce poste');await sync();const item=props().context.slotSelections.main.items[0];assert.equal(item.quantity,'2');assert.equal(item.cost.unitAmount,'20');assert.equal(item.pricedParticipantCount,2);
});
await check('R2_FAST_FOOD_DIRECT_PRICE_NO_PERSON_DATE',async()=>{
 await init('fast-food','chicken-snack',RestaurantEditor);await click('Montant rapide');await change('Coût prévu à notre charge','15');await click('Conserver ce coût');await sync();assert.equal(props().context.slotSelections.meal.items[0].cost.unitAmount,'15');assert.ok(!props().context.fields.plannedDate);assert.ok(!props().context.fields.participantRefs?.length);
});
await check('M1_TWO_PACKS_PRICE_CHANGE_PRESERVES_IDENTITIES',async()=>{
 await init('purchase','laundry-detergent',RestaurantEditor);await click('Articles');await change('Coût prévu par lot','6');await click('Quantité · 1');await click('Unités au total');await change('Quantité totale','2');await click('Retour au prix');await click('Conserver ce poste');await sync();const first=props().context.slotSelections.item.items[0];assert.equal(first.quantity,'2');await click('Coût direct');await change('Prix unitaire prévu','7');await click('Conserver ce poste');await sync();assert.equal(props().context.slotSelections.item.items[0].selectionId,first.selectionId);assert.equal(props().context.slotSelections.item.items[0].quantity,'2');assert.equal(props().context.slotSelections.item.items[0].cost.unitAmount,'7');
});
await check('W1_TOTAL_AND_PRICE_PER_NIGHT_WITHOUT_INVENTED_DATES',async()=>{
 await init('short-stay','weekend-gite',ShortStayEditor);await click('Hébergement et postes');await click('Prix total');await change('Coût total prévu','240');await click('Conserver et prévisualiser');await sync();const old=props().context.slotSelections.lodging.items[0];assert.equal(old.lodgingPricing.basis,'TOTAL');assert.equal(old.quantity,'1');assert.ok(!props().context.fields.plannedDate);
});
await check('V1_FAMILY_AND_FRIEND_FIELDS_USE_SEPARATE_PUBLISHED_WRITERS',async()=>{
 await init('family-visit','fontes-family-visit',FamilyVisitEditor);await click('Dates');await click('Un dimanche, plus tard…');await change('Repère de temps','Un dimanche');await click('Conserver et prévisualiser');await sync();assert.equal(props().context.fields.timingNote,'Un dimanche');assert.equal(pendingOps[0].kind,'EDIT_FAMILY_VISIT');
 await init('friend-visit',COMPOSER_PRESETS.find(p=>p.templateKey==='friend-visit').presetKey,CatalogContextEditor);const field=props().editor.fields.find(f=>f.key==='timingNote');await click(field.label);await change(field.label,'Un autre dimanche');await click('Conserver et prévisualiser');await sync();assert.equal(props().context.fields.timingNote,'Un autre dimanche');assert.equal(pendingOps[0].kind,'EDIT_CONTEXT');
});
await check('B1_COMPONENT_EDITOR_SEVEN_PRODUCTS_PRICE_ONLY_REPLAY',async()=>{
 await init('beauty-restock','mascara',CatalogContextEditor);assert.ok(button('Prix direct'));
 const cap=model.dropCapabilities.find(c=>c.target.contextOccurrenceId===id&&c.resolution!=='BLOCKED'&&model.library.searchableAssets.some(a=>a.assetKey===c.sourceAssetKey&&a.optionKind==='COMPONENT'));
 const asset=model.library.searchableAssets.find(a=>a.assetKey===cap.sourceAssetKey);
 for(let index=0;index<7;index++){const r=await handleComposerRequest({repository,readWorld:async()=>fixture(),householdPersons:[]},householdId,{sequence:index+2,targetMonth:'2026-11',draft:model.semanticState,kind:'DROP',assetKey:asset.assetKey,target:cap.target,identity:crypto.randomUUID(),selectionId:crypto.randomUUID(),values:{label:'Produit fixture '+index,quantity:'1',unitBasis:'ITEM',costMode:index===6?'UNKNOWN':'AUTO',amount:index===6?'':String(index+1)}});assert.equal(r.ok,true,r.code);model=r.model;}
 const before=structuredClone(props().context.slotSelections.products.items),selected=before[2];let saved,component,values={};
 await act(async()=>root.unmount());await act(async()=>{root=create(React.createElement(WorkshopConfirmationProvider,{requestRef},React.createElement(WorkshopChoicesProvider,null,React.createElement(EquipmentComponentEditor,{asset,target:cap.target,model,selection:selected,values,busy:false,host:{},onSummary(){},onValues:next=>values=next,onSave:(next,item)=>{saved=next;component=item;}}))));});
 await change('Prix unitaire prévu','9');await click('Conserver ce poste');assert.ok(saved);assert.equal(saved.quantity,'1');
 const response=await handleComposerRequest({repository,readWorld:async()=>fixture(),householdPersons:[]},householdId,{sequence:20,targetMonth:'2026-11',draft:model.semanticState,kind:'MUTATE',mutation:{kind:'PATCH_CONTEXT',contextOccurrenceId:id,slotKey:cap.target.slotKey,items:before.map(item=>item.selectionId===selected.selectionId?component:item)}});assert.equal(response.ok,true,response.code);const after=response.model.semanticState.contexts.find(c=>c.contextOccurrenceId===id).slotSelections.products.items;
 assert.equal(after.length,7);for(const prior of before)if(prior.selectionId!==selected.selectionId)assert.deepEqual(after.find(s=>s.selectionId===prior.selectionId),prior);assert.equal(after.find(s=>s.selectionId===selected.selectionId).cost.unitAmount,'9');
});
await check('REJECTED_ADMISSION_KEEPS_RAW_AND_RETRY',async()=>{
 await init('restaurant','restaurant-for-two',RestaurantEditor);await click('Montant rapide');await change('Coût prévu à notre charge','61');rejectNext=true;await click('Conserver ce coût');assert.equal(pendingOps.length,0);assert.equal(input('Coût prévu à notre charge').props.value,'61');assert.equal(registry.count(),1);assert.ok(controls(n=>n.props.role==='alert').length);await click('Conserver ce coût');await sync();assert.equal(pendingOps.length,1);
});
await check('REFERENCE_NEVER_ADOPTED_ON_RENDER_OR_UPDATE',async()=>{
 if(root)await act(async()=>root.unmount());let changed=0,saved=0,reference='8';
 const Ref=()=>{const [row,setRow]=React.useState({...fresh('Produit fixture'),amount:'5',costMode:'MANUAL'});return React.createElement(WorkshopComponentRow,{title:'Produit fixture',row,reference:{value:reference,caption:'Owner fixture',period:'Période fixture'},onChange:next=>{changed++;setRow(next);},onSave:()=>saved++});};
 await act(async()=>{root=create(React.createElement(Ref));});assert.equal(input('Prix unitaire prévu').props.value,'5');assert.equal(changed,0);assert.equal(saved,0);
 await click('Prix observé · 8 €');assert.equal(input('Prix unitaire prévu').props.value,'8');assert.equal(saved,0);reference='9';await act(async()=>root.update(React.createElement(Ref)));assert.equal(input('Prix unitaire prévu').props.value,'8');assert.equal(changed,1);await click('Conserver ce poste');assert.equal(saved,1);
});
const openings=[];
await check('47_PRESET_REACT_SUMMARIES_AND_PUBLISHED_ENTRY_POINTS',async()=>{
 for(const preset of COMPOSER_PRESETS){const Component=['restaurant','fast-food','delivery','activity','purchase'].includes(preset.templateKey)?RestaurantEditor:preset.templateKey==='night-out'?NightOutEditor:preset.templateKey==='gift'?GiftEditor:preset.templateKey==='family-visit'?FamilyVisitEditor:preset.templateKey==='short-stay'?ShortStayEditor:CatalogContextEditor;
 await init(preset.templateKey,preset.presetKey,Component);assert.ok(controls(n=>n.type==='button').length);assert.ok(controls(n=>n.props['data-question-dock']!==undefined).length);assert.equal(pendingOps.length,0);assert.ok(!props().context.fields.plannedDate);if(preset.presetKey==='home-evening')assert.ok(!controls(n=>n.type==='button'&&text(n)==='Transport').length);
 openings.push({preset:preset.presetKey,template:preset.templateKey,status:'SUMMARY_RENDERED_REACT_ONLY',inputs:controls(n=>n.type==='input').length,selects:controls(n=>n.type==='select').length});}
 assert.equal(openings.length,47);
});
fs.mkdirSync('outputs/l4c',{recursive:true});fs.writeFileSync('outputs/l4c/react-openings.json',JSON.stringify(openings,null,2));
fs.mkdirSync('outputs/l4c',{recursive:true});fs.writeFileSync('outputs/l4c/react-interactions.json',JSON.stringify({environment:'REACT_TEST_RENDERER_IN_PROCESS',browser:'NOT_RUN_DISABLED_IN_WORK_SETTINGS',auth:'NOT_RUN_AUTH',checks,remoteWrites:0},null,2));
console.log(checks.length+' React interaction groups PASS (not browser)');
} finally {if(root)await act(async()=>root.unmount());await pg.close();}
