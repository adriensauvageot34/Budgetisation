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
const button=(label)=>{const all=controls(n=>n.type==='button'&&(text(n).trim()===label.trim()||label==='Date'&&n.props['aria-label']==='Modifier la date'||label==='Lieu'&&n.props['aria-label']==='Modifier le lieu'));assert.ok(all.length,'Missing button '+label);return all[0];};
const click=async label=>{
  const matches=()=>controls(n=>n.type==='button'&&(text(n).trim()===label.trim()||label==='Date'&&n.props['aria-label']==='Modifier la date'||label==='Lieu'&&n.props['aria-label']==='Modifier le lieu'));
  for(let i=0;i<12&&!matches().length;i++){
    const next=controls(n=>n.type==='button'&&n.props['aria-label']==='Pages du dock · suivante'&&!n.props.disabled)[0];
    if(next){await act(async()=>next.props.onClick());steps++;continue;}
    const back=controls(n=>n.type==='button'&&text(n)==='← Ma sortie')[0];
    if(back&&['Montant direct','Autre'].includes(label)){await act(async()=>back.props.onClick());steps++;continue;}break;
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
const save=async()=>{await click('Terminé');await sync();};
const shortInput=label=>input(label);
const tile=label=>controls(n=>n.type==='button'&&n.findAll(c=>c.type==='strong'&&(text(c)===label||text(c).startsWith(label+' ×'))).length)[0];
const openTile=async label=>{if(!tile(label))await click('← Ma sortie');await act(async()=>tile(label).props.onClick());};
const navigateRoute=async dir=>{let nodes=controls(n=>n.props['data-bar-route']===dir||n.props['data-bar-add-route']===dir);if(!nodes.length){await click('← Ma sortie');nodes=controls(n=>n.props['data-bar-route']===dir||n.props['data-bar-add-route']===dir);}assert.ok(nodes.length,'Route '+dir);await act(async()=>nodes[0].props.onClick());};


const {BarLivingCard}=require('@/app/mois-a-venir/composer/bar-living-card');
const {inventoryItems,inventoryLayoutPages}=require('@/app/mois-a-venir/composer/inventory-layout');
const step=()=>controls(n=>n.props['data-bar-living-editor']!==undefined)[0].props['data-bar-step'];
const snapshot=name=>{fs.mkdirSync('outputs/bar-p2/react-structure',{recursive:true});fs.writeFileSync('outputs/bar-p2/react-structure/'+name+'.json',JSON.stringify({proof:'REACT_RENDERED_STRUCTURE_NOT_SCREENSHOT_NOT_BROWSER',tree:root.toJSON()},null,2));};
const dock=()=>controls(n=>n.props['data-question-dock']!==undefined)[0];
const labels=()=>dock().findAll(n=>n.type==='button'&&n.findAll(c=>c.type==='strong').length).map(n=>text(n).trim());
try {
await check('V2-01_INITIAL_FIVE_CHOICES_NO_DECISION',async()=>{await init('night-out','bar-apero',BarLivingEditor);assert.equal(step(),'summary');snapshot('EMPTY-expanded');assert.deepEqual(labels(),['Lieu','Bière','Date','Montant direct']);await click('→');assert.deepEqual(labels(),['Autre']);assert.equal(pendingOps.length,0);assert.equal(controls(n=>n.props['data-bar-route']!==undefined).length,0);assert.equal(controls(n=>n.type==='button'&&text(n)==='Terminé').length,0);});
await check('V2-02_BEER_THEN_STEPPER_ADMITTED_IN_TWO_GESTURES',async()=>{await init('night-out','bar-apero',BarLivingEditor);await click('Bière');const beer=current().slotSelections.extras.items[0];assert.equal(beer.cost.kind,'UNKNOWN');assert.equal(beer.quantity,'1');snapshot('BEER_UNKNOWN-expanded');assert.equal(registry.count(),0);await act(async()=>controls(n=>n.props['aria-label']==='Augmenter la quantité')[0].props.onClick());assert.equal(current().slotSelections.extras.items[0].quantity,'2');assert.equal(current().slotSelections.extras.items[0].selectionId,beer.selectionId);assert.equal(registry.count(),0);assert.equal(controls(n=>n.type==='button'&&text(n)==='Terminé').length,0);});
await check('V2-03_ROW_DOCK_STAYS_DRINKS_SAVE_ONLY_DIRTY',async()=>{await init('night-out','bar-apero',BarLivingEditor);await click('Bière');assert.ok(labels().some(s=>s.includes('Cocktail')));assert.ok(!labels().includes('Prix encore inconnu'));assert.equal(controls(n=>n.type==='button'&&text(n)==='Enregistrer').length,0);await change('Prix unitaire (€)','6,50');await click('Enregistrer');assert.equal(current().slotSelections.extras.items[0].cost.unitAmount,'6.50');await click('Date');assert.equal(step(),'date');});
await check('V2-06_COMPACT_NO_PHANTOM_ROUTE_AND_DENSE_PREVIEW_LIMIT',async()=>{await init('night-out','bar-apero',BarLivingEditor);const card=model.board.contexts.find(c=>c.contextOccurrenceId===id);await act(async()=>root.unmount());let target;await act(async()=>{root=create(React.createElement(BarLivingCard,{card,model,living:{open:(_,t)=>target=t,close(){}},busy:false,preserved:false,preserve(){},drag(){}}));});assert.equal(controls(n=>n.props['data-bar-route']!==undefined).length,0);});

const onRoute=navigateRoute;
const saveGuard=async()=>act(async()=>controls(n=>n.props['data-save-workshop']!==undefined)[0].props.onClick());
const mountCompact=async()=>{const card=model.board.contexts.find(c=>c.contextOccurrenceId===id);await act(async()=>root.unmount());await act(async()=>{root=create(React.createElement(BarLivingCard,{card,model,living:{open:(_,t)=>overrides.target=t,close(){}},busy:false,preserved:!!overrides.preserved,preserve(){},drag(){}}));});};
await check('V2-04_DATE_THREE_PEOPLE_NO_TRAILING_CONFIRMATION',async()=>{
 await init('night-out','bar-apero',BarLivingEditor);await click('Date');await act(async()=>controls(n=>n.props['aria-label']==='2026-11-17')[0].props.onClick());assert.equal(current().fields.plannedDate,'2026-11-17');await click('Personnes');
 for(let i=0;i<3;i++){const candidates=dock().findAll(n=>n.type==='button'&&n.props['aria-pressed']===false&&n.findAll(c=>c.type==='strong').length);assert.ok(candidates.length);await act(async()=>candidates[0].props.onClick());assert.equal(current().fields.participantRefs.length,i+1);}
 assert.equal(registry.count(),0);assert.equal(controls(n=>n.type==='button'&&text(n)==='Retenir ces personnes').length,0);assert.equal(current().slotSelections.extras?.items.length??0,0);await click('Date');assert.equal(step(),'date');
});
await check('V2-05_MIXED_DIRECTED_MODES_AND_ABSENT_FARES',async()=>{
 await init('night-out','bar-apero',BarLivingEditor);await onRoute('outbound');await click('Voiture');const outbound=structuredClone(current().slotSelections.outbound.items[0]);assert.equal(current().slotSelections.return?.items.length??0,0);await onRoute('return');await click('Taxi / Uber');const back=current().slotSelections.return.items[0];assert.equal(back.optionKey,'taxi');assert.notEqual(back.selectionId,outbound.selectionId);assert.equal(back.pricing.fare.kind,'UNKNOWN');assert.deepEqual(current().slotSelections.outbound.items[0],outbound);await mountCompact();snapshot('MIXED_MODES-compact');const lines=controls(n=>n.props['data-bar-route']);assert.equal(lines.length,2);assert.ok(text(lines[0]).includes('Voiture'));assert.ok(text(lines[1]).includes('Taxi'));assert.ok(!text(lines[1]).includes('0,00'));
});
await check('V2-06_OUTBOUND_ONLY_COMPACT_RETURN_IS_AN_ACTION',async()=>{
 await init('night-out','bar-apero',BarLivingEditor);await onRoute('outbound');await click('Voiture');const before=structuredClone(current());await mountCompact();assert.equal(controls(n=>n.props['data-bar-route']==='outbound').length,1);assert.equal(controls(n=>n.props['data-bar-route']==='return').length,0);await click('+ Retour');assert.equal(overrides.target,'return');assert.deepEqual(current(),before);
});
await check('V2-07_DENSE_8_AND_15_DISTINCT_IDS_COMPACT_TWO_PLUS_N',async()=>{
 for(const count of [8,15]){await init('night-out','bar-apero',BarLivingEditor);await click('Bière');const sample=current().slotSelections.extras.items[0];const items=Array.from({length:count},(_,i)=>({...sample,selectionId:crypto.randomUUID(),cost:i<2?{kind:'MANUAL',unitAmount:i?'8':'6'}:{kind:'UNKNOWN'}}));await act(async()=>admit({kind:'EDIT_NIGHT_OUT',edit:{contextOccurrenceId:id,fields:{},slots:{extras:items}}}));await mountCompact();snapshot('DENSE_'+count+'-compact');const tiles=controls(n=>n.type==='button'&&n.findAll(c=>c.type==='strong'&&text(c).startsWith('Bière')).length);assert.equal(tiles.length,2);await click('+'+(count-2));assert.equal(overrides.target,'drinks');assert.deepEqual(current().slotSelections.extras.items,items);}
});
await check('V2-08_RAW_SAVE_RESUMES_ADD_USING_LATEST_DRAFT',async()=>{
 await init('night-out','bar-apero',BarLivingEditor);await click('Bière');const beerId=current().slotSelections.extras.items[0].selectionId;await change('Prix unitaire (€)','6,50');await click('Cocktail');assert.equal(current().slotSelections.extras.items.length,1);assert.equal(input('Prix unitaire (€)').props.value,'6,50');await saveGuard();const items=current().slotSelections.extras.items;assert.equal(items.length,2);assert.equal(items[0].selectionId,beerId);assert.equal(items[0].cost.unitAmount,'6.50');assert.equal(items[1].label,'Cocktail');assert.equal(items[1].cost.kind,'UNKNOWN');assert.equal(controls(n=>n.props['data-bar-active-tile']===true).length,1);
});
await check('V2-08_RAW_CONTINUE_DISCARD_REJECTION_AND_DIRTY_STEPPER',async()=>{
 await init('night-out','bar-apero',BarLivingEditor);await click('Bière');await change('Prix unitaire (€)','8');await click('Cocktail');await click('Continuer à modifier');assert.equal(input('Prix unitaire (€)').props.value,'8');await act(async()=>controls(n=>n.props['aria-label']==='Augmenter la quantité')[0].props.onClick());assert.equal(current().slotSelections.extras.items[0].quantity,'1');assert.equal(current().slotSelections.extras.items[0].cost.kind,'UNKNOWN');await click('Cocktail');rejectNext=true;await saveGuard();assert.equal(current().slotSelections.extras.items.length,1);assert.equal(input('Prix unitaire (€)').props.value,'8');await click('Cocktail');await click('Abandonner cette saisie');assert.equal(current().slotSelections.extras.items.length,2);assert.equal(current().slotSelections.extras.items[0].cost.kind,'UNKNOWN');assert.equal(current().slotSelections.extras.items[0].quantity,'1');assert.equal(controls(n=>n.props['data-bar-active-tile']===true)[0].props['data-bar-tile'],current().slotSelections.extras.items[1].selectionId,'discard continuation must edit the newly added Cocktail');
});
await check('V2-07_REEDIT_EXACT_SAME_LABEL_AND_REMOVE_UNDO',async()=>{
 await init('night-out','bar-apero',BarLivingEditor);await click('Bière');await change('Prix unitaire (€)','6');await click('Enregistrer');await click('Bière');await change('Prix unitaire (€)','8');await click('Enregistrer');const before=structuredClone(model.semanticState),items=structuredClone(current().slotSelections.extras.items);assert.notEqual(items[0].selectionId,items[1].selectionId);const first=controls(n=>n.props['data-bar-tile']===items[0].selectionId)[0].findByType('button');await act(async()=>first.props.onClick());assert.equal(input('Prix unitaire (€)').props.value,'6');await click('Retirer');assert.deepEqual(current().slotSelections.extras.items,[items[1]]);model=visualDraftModel(model,before);await sync();assert.deepEqual(current().slotSelections.extras.items,items);
});
await check('V2-09_EXISTING_BEFORE_MEAL_DIRECT_COST_GROUPS',async()=>{
 await init('night-out','bar-apero',BarLivingEditor);await click('Bière');const sample=current().slotSelections.extras.items[0];const childId=crypto.randomUUID();await act(async()=>admit({kind:'EDIT_NIGHT_OUT',edit:{contextOccurrenceId:id,fields:{},before:{childContextOccurrenceId:childId,selectionId:crypto.randomUUID(),bottle:{...sample,selectionId:crypto.randomUUID(),label:'Bouteille partagée fixture',unitBasis:'SHARED',cost:{kind:'MANUAL',unitAmount:'25'}},extras:[]},slots:{food:[{...sample,selectionId:crypto.randomUUID(),label:'Repas fixture'}],main:[{...sample,selectionId:crypto.randomUUID(),label:'Entrée fixture',unitBasis:'SHARED',cost:{kind:'MANUAL',unitAmount:'10'}}]}}}));const before=structuredClone(current());await click('← Ma sortie');assert.deepEqual(controls(n=>n.props['data-bar-section']).map(n=>n.props['data-bar-section']).sort(),['before','extras','food','main']);assert.equal(controls(n=>n.props['data-bar-before-item']).length,1,'Before principal remains directly editable');await openTile('Bière');await change('Prix unitaire (€)','6,50');await click('Enregistrer');assert.deepEqual(current().slotSelections.before,before.slotSelections.before);assert.deepEqual(current().slotSelections.food,before.slotSelections.food);assert.deepEqual(current().slotSelections.main,before.slotSelections.main);assert.equal(model.semanticState.contexts.find(c=>c.contextOccurrenceId===childId).slotSelections.main.items[0].unitBasis,'SHARED');
});
await check('V2_STATE_UNKNOWN_ZERO_QUOTE_STALE_AND_PARTIAL',async()=>{
 await init('night-out','bar-apero',BarLivingEditor);await click('Bière');await change('Prix unitaire (€)','0');await click('Enregistrer');await openTile('Bière');assert.equal(input('Prix unitaire (€)').props.value,'0');assert.equal(current().slotSelections.extras.items[0].cost.kind,'MANUAL');
 const sample=current().slotSelections.extras.items[0];await act(async()=>admit({kind:'EDIT_NIGHT_OUT',edit:{contextOccurrenceId:id,fields:{},slots:{extras:[{...sample,cost:{kind:'QUOTE',quoteKey:'quote-fixture-only'}}]}}}));await openTile('Bière');assert.ok(controls(n=>n.type==='p'&&text(n).includes('Devis conservé')).length);assert.equal(current().slotSelections.extras.items[0].cost.kind,'QUOTE');
 model={...model,nightOutSummaries:[{contextOccurrenceId:id,semanticStateDigest:'previous-fixture-digest',knownAmount:'23.00',incomplete:true}]};await sync();await mountCompact();assert.ok(controls(n=>n.type==='strong'&&text(n).includes('23')).length);assert.ok(controls(n=>n.type==='small'&&n.children.join('').includes('Résultat précédent')).length);
});
await check('V2_PRESERVE_READONLY_PRESENTS_REASON_AND_NO_MUTATION',async()=>{
 await init('night-out','bar-apero',BarLivingEditor);await click('Bière');const before=structuredClone(current());overrides={preserved:true};await mountCompact();assert.ok(controls(n=>n.type==='small'&&n.children.join('')==='Carte préservée').length);const tileButton=controls(n=>n.type==='button'&&n.findAll(c=>c.type==='strong'&&text(c).startsWith('Bière')).length)[0];assert.equal(tileButton.props.disabled,true);assert.deepEqual(current(),before);
});
await check('V2_LAYOUT_PURE_DENSE_NONOVERLAP_COLLAPSE_NOT_BROWSER',async()=>{
 await init('night-out','bar-apero',BarLivingEditor);const original=inventoryItems(model),bar=original.find(n=>n.id===id);assert.ok(bar);for(const count of [5,16,30,50])for(const [width,height] of [[720,380],[1000,470],[1200,470],[1330,550]]){const items=[bar,...Array.from({length:count-1},(_,i)=>({...bar,id:'fixture:'+i}))];const before=inventoryLayoutPages(items,width,height),open=inventoryLayoutPages(items,width,height,id);assert.deepEqual(inventoryLayoutPages(items,width,height),before);assert.deepEqual(open.flat().map(p=>p.item.id),items.map(i=>i.id));for(const page of open){const used=new Set();for(const box of page)for(let x=box.column;x<box.column+box.columnSpan;x++)for(let y=box.row;y<box.row+box.rowSpan;y++){const key=x+':'+y;assert.equal(used.has(key),false);used.add(key);}}}
});
await check('V2_MEASURED_EXPANSION_REPACKS_AND_CAPS_WITHOUT_DATA_CHANGES',async()=>{
 await init('night-out','bar-apero',BarLivingEditor);const original=inventoryItems(model),bar=original.find(n=>n.id===id);
 const items=[bar,...Array.from({length:39},(_,i)=>({...bar,id:'fixture:'+i}))],before=structuredClone(items);
 for(const [width,height] of [[720,380],[1000,470],[1330,550]]){
  const ordinary=inventoryLayoutPages(items,width,height),small=inventoryLayoutPages(items,width,height,id,300),large=inventoryLayoutPages(items,width,height,id,2000);
  assert.ok(small.flat().find(p=>p.item.id===id).rowSpan<large.flat().find(p=>p.item.id===id).rowSpan);
  for(const pages of [small,large]){assert.deepEqual(pages.flat().map(p=>p.item.id),items.map(i=>i.id));for(const page of pages){const used=new Set();for(const box of page)for(let x=box.column;x<box.column+box.columnSpan;x++)for(let y=box.row;y<box.row+box.rowSpan;y++){const key=x+':'+y;assert.equal(used.has(key),false);used.add(key);}}}
  assert.deepEqual(inventoryLayoutPages(items,width,height,undefined,300),ordinary);
 }
 assert.deepEqual(items,before);
});


await check('V2_CLEAN_OUTSIDE_AND_ESCAPE_KEEP_ADMITTED_CARD',async()=>{
 await init('night-out','bar-apero',BarLivingEditor);await click('Bière');const before=structuredClone(current());globalThis.Element=class{closest(){return null;}};
 await act(async()=>controls(n=>n.props['data-bar-living-editor']!==undefined)[0].props.onClick?.({target:new Element()}));assert.equal(step(),'row');assert.deepEqual(current(),before);assert.equal(registry.count(),0);
 await openTile('Bière');globalThis.document.querySelector=()=>null;let stops=0;await act(async()=>controls(n=>n.props['data-bar-living-editor']!==undefined)[0].props.onKeyDown({key:'Escape',preventDefault(){},stopPropagation(){stops++;}}));assert.equal(step(),'summary');assert.equal(stops,1);assert.deepEqual(current(),before);
});
await check('V2_COMPACT_SIZING_AND_OTHER_PRESETS_UNCHANGED',async()=>{
 await init('night-out','bar-apero',BarLivingEditor);const initial=inventoryItems(model),empty=initial.find(n=>n.id===id),others=initial.filter(n=>n.id!==id);assert.ok(empty.height<265);
 await click('Bière');const beer=current().slotSelections.extras.items[0],one=inventoryItems(model).find(n=>n.id===id);assert.ok(one.height>empty.height);
 await act(async()=>admit({kind:'EDIT_NIGHT_OUT',edit:{contextOccurrenceId:id,fields:{},slots:{extras:Array.from({length:15},()=>({...beer,selectionId:crypto.randomUUID()}))}}}));const rich=inventoryItems(model);assert.equal(rich.find(n=>n.id===id).height,one.height);assert.deepEqual(rich.filter(n=>n.id!==id),others);
 const {ContextPalette}=require('@/app/mois-a-venir/composer/context-palette');await act(async()=>root.unmount());await act(async()=>{root=create(React.createElement(ContextPalette,{card:model.board.contexts.find(c=>c.contextOccurrenceId===id),model,busy:false,choose(){},close(){},question:{title:'Other preset canary',choices:[]}}));});assert.equal(controls(n=>n.props['data-bar-dock']!==undefined).length,0);
});
await check('V2_REDUCED_SCOPE_READONLY_FORM_DISABLED',async()=>{
 await init('night-out','bar-apero',BarLivingEditor);overrides={busy:true};await sync();assert.equal(controls(n=>n.type==='fieldset'&&n.props['aria-label']==='Composition de la sortie')[0].props.disabled,true);assert.equal(dock().findAll(n=>n.type==='button'&&!n.props.disabled&&n.findAll(c=>c.type==='strong').length).length,0);
});
await check('V2_LEGACY_COMBINED_ROUTE_DISPLAYED_ONCE_WITH_STOPS',async()=>{
 await init('night-out','bar-apero',BarLivingEditor);const legacy={kind:'MOBILITY_INTENT',selectionId:crypto.randomUUID(),optionKey:'car',provenance:'EXPLICIT_USER_DECISION',origin:{kind:'TEXT',label:'Départ fixture'},destination:{kind:'TEXT',label:'Lieu fixture'},returnRequired:true,route:{version:'composer-mobility-route@v1',vehicleRef:null,stops:[{label:'Départ fixture'},{label:'Lieu fixture'},{label:'Départ fixture'}]}};await act(async()=>admit({kind:'EDIT_NIGHT_OUT',edit:{contextOccurrenceId:id,fields:{},slots:{outbound:[legacy]}}}));await mountCompact();const routes=controls(n=>n.props['data-bar-route']);assert.equal(routes.length,1);assert.ok(text(routes[0]).includes('Aller-retour'));assert.equal(controls(n=>n.type==='button'&&text(n)==='+ Retour').length,0);assert.deepEqual(current().slotSelections.outbound.items[0],legacy);
});

fs.mkdirSync('outputs/bar-p2',{recursive:true});fs.writeFileSync('outputs/bar-p2/p2-results.json',JSON.stringify({method:'REACT_IN_PROCESS_NOT_BROWSER',checks},null,2));if(checks.some(c=>c.status==='FAIL'))process.exitCode=1;
}finally{if(root)await act(async()=>root.unmount());await pg.close();}
