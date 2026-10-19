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
globalThis.fetch=async()=>{throw Error('P4_REMOTE_NETWORK_FORBIDDEN');};
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
  let searchedFromStart=false;
  const matches=()=>controls(n=>n.type==='button'&&(text(n).trim()===label.trim()||text(n).trim()==='+ '+label.trim()||label==='Date'&&n.props['aria-label']==='Modifier la date'||label==='Lieu'&&n.props['aria-label']==='Modifier le lieu'));
  for(let i=0;i<12&&!matches().length;i++){
    const next=controls(n=>n.type==='button'&&n.props['aria-label']==='Pages du dock · suivante'&&!n.props.disabled)[0];
    if(next){await act(async()=>next.props.onClick());steps++;continue;}
    // Dock pagination is now deliberately retained when a scene reopens.
    // Search the other pages using their real controls; never assume page 1.
    if(!searchedFromStart){searchedFromStart=true;let previous;
      while((previous=controls(n=>n.type==='button'&&n.props['aria-label']==='Pages du dock · précédente'&&!n.props.disabled)[0])){await act(async()=>previous.props.onClick());steps++;}
      if(matches().length)break;
      if(controls(n=>n.type==='button'&&n.props['aria-label']==='Pages du dock · suivante'&&!n.props.disabled).length)continue;
    }
    const back=controls(n=>n.type==='button'&&text(n)==='← Ma sortie')[0];
    if(back&&['Montant direct','Autre','Bouteille partagée'].includes(label)){await act(async()=>back.props.onClick());steps++;continue;}if(label==='Bouteille partagée'){const more=controls(n=>n.type==='button'&&text(n)==='Autre')[0];if(more){await act(async()=>more.props.onClick());steps++;continue;}}if(label==='Montant direct'){const more=controls(n=>n.type==='button'&&text(n)==='Autre')[0];if(more){await act(async()=>more.props.onClick());continue;}}if(['Vodka','Crazy Tiger sans alcool','Diluant sans alcool','Bière','Snack','Chips','Vin','Rhum'].includes(label)){const full=controls(n=>n.type==='button'&&text(n)==='Tout le Before')[0];if(full){await act(async()=>full.props.onClick());continue;}}const all=controls(n=>n.type==='button'&&text(n)==='Tous les lieux')[0];if(all){await act(async()=>all.props.onClick());continue;}const reveal=controls(n=>n.type==='button'&&['Autres consommations','Autres objets du Before'].includes(text(n)))[0];if(reveal){await act(async()=>reveal.props.onClick());continue;}break;
  }
  assert.ok(matches().length,`Missing button ${label}; scene=${controls(n=>n.props['data-bar-step']!==undefined)[0]?.props['data-bar-step']}; dock=${controls(n=>n.props['data-question-dock']!==undefined)[0]?.findAll(n=>n.type==='strong').map(text).join('|')}`);
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
const save=async()=>{await click('Terminé');await sync();};
const shortInput=label=>input(label);
const tile=label=>controls(n=>n.type==='button'&&n.findAll(c=>c.type==='strong'&&(text(c)===label||text(c).startsWith(label+' ×'))).length)[0];


const {BarLivingCard}=require('@/app/mois-a-venir/composer/bar-living-card');
const {inventoryItems,inventoryLayoutPages}=require('@/app/mois-a-venir/composer/inventory-layout');
const step=()=>controls(n=>n.props['data-bar-living-editor']!==undefined)[0].props['data-bar-step'];
const snapshot=name=>{fs.mkdirSync('outputs/bar-p2/react-structure',{recursive:true});fs.writeFileSync('outputs/bar-p2/react-structure/'+name+'.json',JSON.stringify({proof:'REACT_RENDERED_STRUCTURE_NOT_SCREENSHOT_NOT_BROWSER',tree:root.toJSON()},null,2));};
const dock=()=>controls(n=>n.props['data-question-dock']!==undefined)[0];
const labels=()=>dock().findAll(n=>n.type==='button'&&n.findAll(c=>c.type==='strong').length).map(n=>text(n).trim());
const onRoute=async dir=>{await act(async()=>controls(n=>n.props["data-bar-route"]===dir||n.props["data-bar-add-route"]===dir)[0].props.onClick());};
const beforeAsset=()=>require('@/domain/phase2/planned-assets').assetsForModule('house_party');
const product=(asset,extra={})=>buildRow({...fresh(asset.label),assetRef:{catalogVersion:require('@/domain/phase2/planned-assets').PLANNED_ASSET_CATALOG_VERSION,assetKey:asset.assetKey,labelAtSelection:asset.label,provenance:'EXPLICIT_USER_DECISION'},unitBasis:'SHARED',...extra},'activity');
const {fresh,buildComponentRow:buildRow}=require('@/app/mois-a-venir/composer/night-out-components');
const child=()=>model.semanticState.contexts.find(c=>c.parentContextOccurrenceId===id);
try{
 await check('P4_BEFORE_DIRECT_CHILD_TILE_REEDIT',async()=>{
  await init('night-out','bar-apero',BarLivingEditor);const asset=beforeAsset().find(a=>a.assetKey==='house_party:vodka');assert.ok(asset);const bottle=product(asset,{costMode:'MANUAL',amount:'25'});await act(async()=>admit({kind:'EDIT_NIGHT_OUT',edit:{contextOccurrenceId:id,fields:{},before:{childContextOccurrenceId:crypto.randomUUID(),selectionId:crypto.randomUUID(),bottle,extras:[]}}}));
  assert.equal(controls(n=>n.props['data-bar-before-item']===bottle.selectionId).length,1,'Before bottle has no directly editable tile');
 });

 const {editNightOut}=require('@/domain/phase2/planner/night-out-edit');
 const {parsePlanSemanticState}=require('@/domain/phase2/planner/semantic-state');
 const {ComposerResponseGate}=require('@/app/mois-a-venir/composer/draft-controller');
 const states={};let serverSequence=1000;
 const read=async(label)=>{const r=await handleComposerRequest({repository,readWorld:async()=>fixture()},householdId,{kind:'READ',sequence:++serverSequence,targetMonth:'2026-11',draft:model.semanticState});assert.equal(r.ok,true,r.code+': '+r.message);model=r.model;await sync();states[label]={state:structuredClone(model.semanticState),summary:model.nightOutSummaries.find(s=>s.contextOccurrenceId===id),digest:model.board.draft.semanticStateDigest};return states[label];};
 const beforeTile=selectionId=>controls(n=>n.props['data-bar-before-item']===selectionId)[0].findAll(n=>n.type==='button')[0];
 await check('P4_P5_BEFORE_RICH_UI_PARTIAL_PATCH_SAME_IDS_AND_OWNER_SUM',async()=>{
  await init('night-out','bar-apero',BarLivingEditor);await click('Bière');await change('Prix unitaire (€)','6');await click('Enregistrer');await click('Before');await click('Vodka');await change('Prix unitaire (€)','25');await click('Enregistrer');const bottle=structuredClone(child().slotSelections.main.items[0]),childId=child().contextOccurrenceId,link=structuredClone(current().slotSelections.before);
  await click('Diluant sans alcool');await change('Prix unitaire (€)','4');await click('Enregistrer');await click('Snack');await change('Prix par lot (€)','3');await click('Enregistrer');const extras=structuredClone(child().slotSelections.extras.items),beer=structuredClone(current().slotSelections.extras.items[0]);
  await act(async()=>beforeTile(bottle.selectionId).props.onClick());await change('Prix unitaire (€)','26');await click('Enregistrer');assert.equal(child().contextOccurrenceId,childId);assert.equal(child().slotSelections.main.items[0].selectionId,bottle.selectionId);assert.deepEqual(child().slotSelections.extras.items,extras);assert.deepEqual(current().slotSelections.extras.items[0],beer);assert.deepEqual(current().slotSelections.before,link);
  const evaluated=await read('rich-before');assert.equal(evaluated.summary.knownAmount,'39.00');assert.equal(evaluated.summary.semanticStateDigest,evaluated.digest);assert.equal(model.semanticState.contexts.length,2);
 });
 await check('P4_P5_SAME_PRODUCT_TWO_CONTEXTS_NO_MERGE_NO_PARENT_COST',async()=>{
  const bottle=child().slotSelections.main.items[0],other={...bottle,selectionId:crypto.randomUUID(),optionKey:'extra',cost:{kind:'MANUAL',unitAmount:'40'}};await act(async()=>admit({kind:'EDIT_NIGHT_OUT',edit:{contextOccurrenceId:id,fields:{},slots:{extras:[...current().slotSelections.extras.items,other]}}}));
  assert.notEqual(bottle.selectionId,other.selectionId);assert.deepEqual(bottle.productAssetRef,other.productAssetRef);const r=await read('same-product-independent');assert.equal(r.summary.knownAmount,'79.00');
 });
 await check('P4_BEFORE_REMOVE_EXTRA_CARDINALITY_GROUP_CONFIRM_AND_UNDO',async()=>{
  const before=structuredClone(model.semanticState),first=child().slotSelections.extras.items[0];await act(async()=>beforeTile(first.selectionId).props.onClick());await change('Prix unitaire (€)','9');await act(async()=>controls(n=>n.props['aria-label']==='Retirer ce poste')[0].props.onClick());assert.deepEqual(model.semanticState,before,'Dirty Before extra removal must wait for consent');assert.equal(controls(n=>n.type==='dialog').length,1);await click('Continuer à modifier');assert.equal(input('Prix unitaire (€)').props.value,'9');await act(async()=>controls(n=>n.props['aria-label']==='Retirer ce poste')[0].props.onClick());await act(async()=>controls(n=>n.type==='dialog')[0].findAll(n=>n.type==='button'&&text(n)==='Retirer')[0].props.onClick());assert.equal(child().slotSelections.extras.items.length,1);assert.equal(child().slotSelections.main.items[0].cost.unitAmount,'26');
  const principal=child().slotSelections.main.items[0];await act(async()=>beforeTile(principal.selectionId).props.onClick());await act(async()=>controls(n=>n.props['aria-label']==='Retirer ce poste')[0].props.onClick());assert.ok(child());assert.ok(controls(n=>n.props.role==='alert').some(n=>text(n).includes('premier objet porte le Before')));
  const restored=structuredClone(model.semanticState);await click('Retirer le Before');assert.ok(controls(n=>n.type==='p'&&text(n).includes('ses 2 éléments')).length);await click('Continuer à modifier');assert.deepEqual(model.semanticState,restored);await click('Retirer le Before');await act(async()=>controls(n=>n.type==='dialog')[0].findAll(n=>n.type==='button'&&text(n)==='Retirer le Before')[0].props.onClick());assert.equal(model.semanticState.contexts.length,1);assert.equal(current().slotSelections.extras.items.length,2);
  model=visualDraftModel(model,restored);await sync();assert.deepEqual(model.semanticState,restored);const undoChild=child();assert.equal(undoChild.slotSelections.main.items[0].selectionId,principal.selectionId);states['before-undo']={state:structuredClone(model.semanticState)};
  // A semantic restore is the local history oracle; browser buttons are tested separately.
  assert.equal(before.contexts.find(c=>c.parentContextOccurrenceId===id).contextOccurrenceId,undoChild.contextOccurrenceId);
 });
 await check('P4_BEFORE_PRESERVE_AND_STALE_CONFIRMATION_REJECT',async()=>{
  const preserved=structuredClone(model.semanticState),childId=child().contextOccurrenceId;preserved.preferences.flexibility[childId]='PRESERVE';assert.throws(()=>editNightOut(preserved,{contextOccurrenceId:id,fields:{},before:null}),/LOCKED/);model=visualDraftModel(model,preserved);await sync();assert.equal(button('Retirer le Before').props.disabled,true);
  delete preserved.preferences.flexibility[childId];model=visualDraftModel(model,preserved);await sync();await click('Retirer le Before');const beforeState=structuredClone(model.semanticState);beforeState.contexts.find(c=>c.contextOccurrenceId===childId).fields.label='Before modifié ailleurs';model=visualDraftModel(model,beforeState);await sync();await act(async()=>controls(n=>n.type==='dialog')[0].findAll(n=>n.type==='button'&&text(n)==='Retirer le Before')[0].props.onClick());assert.equal(child().fields.label,'Before modifié ailleurs');assert.ok(controls(n=>n.props.role==='alert').some(n=>text(n).includes('changé entre-temps')));
 });
 await check('P4_BEFORE_RAW_REJECTION_CONTINUE_AND_SAVE_RETARGET',async()=>{
  await act(async()=>beforeTile(child().slotSelections.main.items[0].selectionId).props.onClick());await change('Prix unitaire (€)','28');await click('Date');await click('Continuer à modifier');assert.equal(input('Prix unitaire (€)').props.value,'28');rejectNext=true;await click('Enregistrer');assert.equal(input('Prix unitaire (€)').props.value,'28');assert.equal(child().slotSelections.main.items[0].cost.unitAmount,'26');await click('Date');await act(async()=>controls(n=>n.props['data-save-workshop']!==undefined)[0].props.onClick());assert.equal(child().slotSelections.main.items[0].cost.unitAmount,'28');assert.equal(controls(n=>n.props['data-bar-step']==='date').length,1);
 });
 await check('P4_P4_ITEM_PERSON_SHARED_PRESENTS_INDEPENDENT_AND_ZERO',async()=>{
  await init('night-out','bar-apero',BarLivingEditor);await click('Bière');await act(async()=>controls(n=>n.props['aria-label']==='Augmenter la quantité')[0].props.onClick());await change('Prix unitaire (€)','6');await click('Enregistrer');const beer=structuredClone(current().slotSelections.extras.items[0]);await click('Cocktail');await click('Unité, financement et nom');await click('Quantité · 1');await click('Par personne');await change('Unités par personne','2');await change('Personnes explicitement tarifées','2');await click('Retour au prix');await change('Prix unitaire prévu (€)','8');await click('Conserver ce poste');const cocktail=structuredClone(current().slotSelections.extras.items[1]);assert.equal(cocktail.quantity,'4');assert.equal(cocktail.quantityPerPerson,'2');assert.equal(cocktail.pricedParticipantCount,2);
  await click('Bouteille partagée');await change('Prix par lot (€)','25');await click('Enregistrer');const shared=structuredClone(current().slotSelections.extras.items[2]);assert.equal(shared.unitBasis,'SHARED');assert.equal(shared.quantity,'1');await act(async()=>admit({kind:'EDIT_NIGHT_OUT',edit:{contextOccurrenceId:id,fields:{participantRefs:Array.from({length:6},(_,i)=>({kind:'TEXT',label:'Personne fixture '+i}))}}}));assert.deepEqual(current().slotSelections.extras.items,[beer,cocktail,shared]);const r=await read('item-person-shared');assert.equal(r.summary.knownAmount,'69.00');
  await click('Bière');await change('Prix unitaire (€)','0');await click('Enregistrer');const zero=current().slotSelections.extras.items[3];assert.equal(zero.cost.kind,'MANUAL');assert.equal(zero.cost.unitAmount,'0');const z=await read('manual-zero');assert.equal(z.summary.knownAmount,'69.00');assert.equal(z.state.contexts[0].slotSelections.extras.items[3].cost.kind,'MANUAL');
 });
 await check('P4_GLOBAL_DETAILS_EXACT_CONSENT_CANCEL_REPLACE_UNDO',async()=>{
  await init('night-out','bar-apero',BarLivingEditor);for(let i=0;i<2;i++){await click('Bière');await change('Prix unitaire (€)','8');await click('Enregistrer');}const detailed=structuredClone(model.semanticState);await click('Date');await click('Montant direct');await click('Consommations regroupées');await change('Coût prévu (€)','30');for(const n of controls(n=>n.type==='button'&&text(n).startsWith('Remplacer Bière ·'))){await act(async()=>n.props.onClick());}await click('Retenir ce coût');await click('Continuer à modifier');assert.deepEqual(model.semanticState,detailed);await click('Retenir ce coût');await click('Remplacer les postes sélectionnés');let r=await read('covered-total');assert.equal(r.summary.knownAmount,'30.00');assert.equal(current().slotSelections.extras.items.length,0);model=visualDraftModel(model,detailed);await sync();r=await read('details-undo');assert.equal(r.summary.knownAmount,'16.00');assert.deepEqual(model.semanticState,detailed);
 });
 await check('P4_SHARED_TOTAL_COLLISION_CANNOT_BYPASS_COVERAGE',async()=>{
  await init('night-out','bar-apero',BarLivingEditor);await click('Montant direct');await click('Consommations regroupées');await change('Coût prévu (€)','30');await click('Retenir ce coût');const before=structuredClone(model.semanticState);await click('Bouteille partagée');assert.equal(controls(n=>n.props['data-bar-step']==='coverage').length,1);assert.deepEqual(model.semanticState,before);await click('Ne rien ajouter');assert.deepEqual(model.semanticState,before);
  await click('Bouteille partagée');await click('Détailler à la place');assert.equal(current().slotSelections.main.items.length,0);assert.equal(current().slotSelections.extras.items[0].unitBasis,'SHARED');
  // Restore the detailed two-Beer scenario used by the next quote oracle.
  await init('night-out','bar-apero',BarLivingEditor);for(let i=0;i<2;i++){await click('Bière');await change('Prix unitaire (€)','8');await click('Enregistrer');}
 });
 await check('P4_QUOTE_UNTOUCHED_REEDIT_PRESERVES_UNKNOWN_FIELDS',async()=>{
  const beer=current().slotSelections.extras.items[0];const quote={...beer,cost:{kind:'QUOTE',quoteKey:'p4-quote-synthetic'}};{const state=editNightOut(model.semanticState,{contextOccurrenceId:id,fields:{},slots:{extras:[quote,current().slotSelections.extras.items[1]]}});model=visualDraftModel(model,state);await sync();const kept=structuredClone(current());await click('Date');assert.deepEqual(current(),kept);}
 });
 await check('P4_OUTSIDE_MONTH_REJECTED_AND_PROTECTED_OWNER',async()=>{
  const prior=JSON.stringify(model.semanticState);const r=await handleComposerRequest({repository,readWorld:async()=>fixture()},householdId,{kind:'EDIT_NIGHT_OUT',sequence:++serverSequence,targetMonth:'2026-11',draft:model.semanticState,edit:{contextOccurrenceId:id,fields:{plannedDate:'2026-12-01'}}});assert.equal(r.ok,false);assert.throws(()=>require('@/server/phase2/planner/context-selections').contextDate('2026-12-01','2026-11'),/DATE/);assert.equal(JSON.stringify(model.semanticState),prior);const protectedState=structuredClone(model.semanticState);protectedState.preferences.anchors.push(id);assert.throws(()=>editNightOut(protectedState,{contextOccurrenceId:id,fields:{plannedDate:null}}),/LOCKED/);
 });
 await check('P4_FUNDING_OVER_COST_BLOCKED_WITHOUT_REWRITING_PRICE',async()=>{
  await init('night-out','bar-apero',BarLivingEditor);await click('Bière');await change('Prix unitaire (€)','12');await click('Enregistrer');const original=current().slotSelections.extras.items[0];const next={...original,cost:{kind:'MANUAL',unitAmount:'8'},fundingAllocations:[{source:'BANK',amount:'12'}]};await act(async()=>admit({kind:'EDIT_NIGHT_OUT',edit:{contextOccurrenceId:id,fields:{},slots:{extras:[next]}}}));await read('funding-invalid');assert.equal(current().slotSelections.extras.items[0].cost.unitAmount,'8');assert.equal(current().slotSelections.extras.items[0].fundingAllocations[0].amount,'12');assert.ok(model.board.diagnostics.some(d=>d.code==='COMPONENT_FUNDING_SUM_INVALID'));await act(async()=>tile('Bière').props.onClick());await click('Unité, financement et nom');await click('Financement');await click('Banque déclarée');await change('Montant Banque (€)','8');await click('Conserver ce poste');await read('funding-repaired');assert.equal(current().slotSelections.extras.items[0].cost.unitAmount,'8');assert.ok(!model.board.diagnostics.some(d=>d.code==='COMPONENT_FUNDING_SUM_INVALID'));
 });
 await check('P4_D2_RESPONSE_GATE_AND_SEMANTIC_ROUNDTRIP_NO_APPLY',async()=>{
  const gate=new ComposerResponseGate(),d1=gate.next('D1');gate.invalidate();const d2=gate.next('D2');assert.equal(gate.accepts(d1,d1.sequence,'D2'),false);assert.equal(gate.accepts(d2,d2.sequence,'D2'),true);assert.deepEqual(parsePlanSemanticState(JSON.parse(JSON.stringify(model.semanticState))),model.semanticState);await pg.verifyCanaries();assert.deepEqual(await pg.counts(),{plans:0,revisions:0});assert.equal(pg.rpcCalls,0);
 });
 await check('P4_RICH_BEFORE_PREVIEW_APPLY_RELOAD_MON_PLAN_SAME_IDS',async()=>{
  const expected=structuredClone(states['same-product-independent'].state),world=fixture(),unchanged=JSON.stringify(world);
  const deps={repository,readWorld:async()=>world};
  let r=await handleComposerRequest(deps,householdId,{kind:'READ',sequence:++serverSequence,targetMonth:'2026-11',draft:expected});assert.equal(r.ok,true,r.code);assert.equal(r.model.nightOutSummaries[0].knownAmount,'79.00');const calls=pg.rpcCalls;
  r=await handleComposerRequest(deps,householdId,{kind:'APPLY',sequence:++serverSequence,targetMonth:'2026-11',draft:expected,command:{...r.model.proof,applyRequestId:crypto.randomUUID()}});assert.equal(r.ok,true,r.code+': '+r.message);assert.equal(pg.rpcCalls,calls+1);
  r=await handleComposerRequest(deps,householdId,{kind:'READ',sequence:++serverSequence,targetMonth:'2026-11'});assert.equal(r.ok,true,r.code);assert.deepEqual(r.model.semanticState,expected);const saved=await repository.readActivePlan(householdId,'2026-11');assert.deepEqual(saved.activeRevision.semanticState,expected);assert.equal(JSON.stringify(world),unchanged);await pg.verifyCanaries();
  states['rich-before-applied-reloaded']={state:expected,summary:r.model.nightOutSummaries[0],digest:semanticStateDigest(expected),counts:await pg.counts(),applyRpcCalls:pg.rpcCalls};
 });
 await check('BAR16_REACT_60_PLUS_12_TARGETED_SUBSTITUTION_AND_RAW',async()=>{
  await init('night-out','bar-apero',BarLivingEditor);await click('Montant direct');await click('Consommations regroupées');await change('Coût prévu (€)','60');await click('Retenir ce coût');
  const aggregate=current().slotSelections.main.items[0];assert.equal(aggregate.economicScope.kind,'AGGREGATED_SUBSTITUTIVE_ESTIMATE');
  await click('Montant direct');await click('Entrées / contribution');await change('Coût prévu (€)','12');await click('Retenir ce coût');
  const independent=current().slotSelections.extras.items[0];assert.equal(independent.cost.unitAmount,'12');assert.equal(independent.economicScope.kind,'ADDITIVE_CONTRIBUTION');assert.deepEqual(current().slotSelections.main.items[0],aggregate);
  await click('Bière');assert.equal(controls(n=>n.props['data-bar-step']==='coverage').length,1);await click('Détailler à la place');
  assert.equal(current().slotSelections.main.items.length,0);assert.deepEqual(current().slotSelections.extras.items.find(i=>i.selectionId===independent.selectionId),independent);
  const beer=current().slotSelections.extras.items.find(i=>i.selectionId!==independent.selectionId);assert.equal(beer.cost.kind,'UNKNOWN');
  await change('Prix unitaire (€)','8');await click('Date');await click('Continuer à modifier');assert.equal(input('Prix unitaire (€)').props.value,'8');
 });
 fs.mkdirSync('outputs/bar-p4',{recursive:true});fs.writeFileSync('outputs/bar-p4/states.json',JSON.stringify(states,null,2));
 fs.mkdirSync('outputs/bar-p4',{recursive:true});fs.writeFileSync('outputs/bar-p4/results.json',JSON.stringify({checks,method:'REACT_SYNTHETIC'},null,2));if(checks.some(c=>c.status==='FAIL'))process.exitCode=1;
}finally{if(root)await act(async()=>root.unmount());await pg.close();}

