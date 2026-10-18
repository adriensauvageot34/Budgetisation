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
const button=(label)=>{const all=controls(n=>n.type==='button'&&(text(n).trim()===label.trim()||text(n).trim()==='+ '+label.trim()||n.props['aria-label']===label||label==='Date'&&n.props['aria-label']==='Modifier la date'||label==='Lieu'&&n.props['aria-label']==='Modifier le lieu'));assert.ok(all.length,'Missing button '+label);return all[0];};
const click=async label=>{
  const matches=()=>controls(n=>n.type==='button'&&(text(n).trim()===label.trim()||text(n).trim()==='+ '+label.trim()||n.props['aria-label']===label||label==='Date'&&n.props['aria-label']==='Modifier la date'||label==='Lieu'&&n.props['aria-label']==='Modifier le lieu'));
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
const save=async()=>{await click('Terminé');await sync();};
const shortInput=label=>input(label);
const tile=label=>controls(n=>n.type==='button'&&n.findAll(c=>c.type==='strong'&&(text(c)===label||text(c).startsWith(label+' ×'))).length)[0];
const openTile=async label=>{if(!tile(label))await click('← Ma sortie');await act(async()=>tile(label).props.onClick());};
const navigateRoute=async dir=>{let nodes=controls(n=>n.props['data-bar-route']===dir||n.props['data-bar-add-route']===dir);if(!nodes.length){await click('← Ma sortie');nodes=controls(n=>n.props['data-bar-route']===dir||n.props['data-bar-add-route']===dir);}assert.ok(nodes.length,'Route '+dir);await act(async()=>nodes[0].props.onClick());};


const step=()=>controls(n=>n.props['data-bar-living-editor']!==undefined)[0].props['data-bar-step'];
const dock=()=>controls(n=>n.props['data-question-dock']!==undefined)[0];
const byLabel=label=>controls(n=>n.type==='button'&&n.props['aria-label']===label)[0];
try{
 await check('R022_R238_CLICK_EMPTY_IS_NEUTRAL_AND_RAW_SURVIVES',async()=>{
  await init('night-out','bar-apero',BarLivingEditor);await click('Bière');await change('Prix unitaire (€)','18,50');
  const editor=controls(n=>n.props['data-bar-living-editor']!==undefined)[0],before=JSON.stringify(model.semanticState);
  await act(async()=>editor.props.onClick?.({target:{closest:()=>null}}));assert.equal(step(),'row');assert.equal(input('Prix unitaire (€)').props.value,'18,50');assert.equal(JSON.stringify(model.semanticState),before);
  await click('Date');await click('Continuer à modifier');assert.equal(step(),'row');assert.equal(input('Prix unitaire (€)').props.value,'18,50');
 });
 await check('R164_R165_PLUS_TARD_IS_NEUTRAL_WITHOUT_MUTATION',async()=>{
  await init('night-out','bar-apero',BarLivingEditor);await click('Lieu');const before=JSON.stringify(model.semanticState);await click('Plus tard');assert.equal(step(),'summary');assert.equal(JSON.stringify(model.semanticState),before);
 });
 await check('R003_R166_R173_R177_R179_DATE_REMAINS_TARGETED',async()=>{
  await init('night-out','bar-apero',BarLivingEditor);await click('Date');const slots=JSON.stringify(current().slotSelections);
  await act(async()=>byLabel('2026-11-17').props.onClick());assert.equal(step(),'date');assert.equal(current().fields.plannedDate,'2026-11-17');assert.equal(JSON.stringify(current().slotSelections),slots);
  assert.equal(controls(n=>n.props['data-question-dock']!==undefined).length,0);await click('Retirer la date');assert.equal(step(),'date');assert.equal(current().fields.plannedDate,null);
 });
 await check('R181_R182_R183_CALENDAR_ROVING_FOCUS_MONTH_BOUNDS',async()=>{
  const calendar=controls(n=>n.props['data-bar-calendar']!==undefined)[0];assert.equal(controls(n=>n.props['data-bar-day']&&n.props.tabIndex===0).length,1);
  let prevented=0,stopped=0;await act(async()=>calendar.props.onKeyDown({key:'ArrowRight',target:{closest:()=>({dataset:{barDay:'1'}})},preventDefault(){prevented++;},stopPropagation(){stopped++;}}));
  assert.equal(byLabel('2026-11-02').props.tabIndex,0);assert.equal(prevented,1);assert.equal(stopped,1);
  await act(async()=>calendar.props.onKeyDown({key:'ArrowLeft',target:{closest:()=>({dataset:{barDay:'1'}})},preventDefault(){},stopPropagation(){}}));assert.equal(byLabel('2026-11-01').props.tabIndex,0);
 });
 await check('R143_R151_R169_R170_R201_ONE_LOCAL_SEARCH_RESUMES',async()=>{
  await init('night-out','bar-apero',BarLivingEditor);await click('Lieu');await change('Chercher dans les lieux enregistrés','ÉCOLE');assert.equal(controls(n=>n.props['data-question-dock']!==undefined).length,0);
  assert.equal(controls(n=>n.type==='input'&&n.props['aria-label']==='Chercher parmi les lieux enregistrés').length,0);
  await click('Date');await click('Lieu');assert.equal(input('Chercher dans les lieux enregistrés').props.value,'ÉCOLE');
  const {barPlaces}=require('@/app/mois-a-venir/composer/bar-place-knowledge');assert.equal(barPlaces([{placeId:uuid(555),name:'Ecole Café',privatePlace:false,commune:'Ville',nature:'Commerce',usage:'Bar',relationships:[]}],'école').length,1);
 });
 await check('R199_PUBLIC_HOMONYMS_HAVE_VISIBLE_ADDRESS_PROVENANCE',async()=>{
  await init('night-out','bar-apero',BarLivingEditor);model={...model,mobilityOptions:{...model.mobilityOptions,places:['A','B'].map((address,i)=>({placeId:uuid(600+i),name:'Bar jumeau',privatePlace:false,commune:'Ville fixture',address:'Quai '+address,nature:'Commerce',usage:'Bar',relationships:[]}))}};await sync();await click('Lieu');
  const choices=controls(n=>n.type==='button'&&n.props['data-show-hint']===true);assert.equal(choices.length,2);assert.ok(choices[0].findAll(n=>n.type==='small').length);assert.match(choices[0].props.title,/Quai A/);assert.match(choices[1].props.title,/Quai B/);assert.equal(current().fields.placeRef,undefined);
 });
 // WAVE_2_TESTS
 await check('R223_R224_BEFORE_FIRST_ITEM_RESPECTS_PUBLISHED_UNITS',async()=>{
  const {barBefore}=require('@/app/mois-a-venir/composer/bar-before');
  await init('night-out','bar-apero',BarLivingEditor);await click('Autre');await click('Before');await click('Bière');let b=barBefore(model.semanticState,current());assert.equal(b.bottle.unitBasis,'ITEM');assert.equal(b.bottle.cost.kind,'UNKNOWN');
  await init('night-out','bar-apero',BarLivingEditor);await click('Autre');await click('Before');await click('Chips');b=barBefore(model.semanticState,current());assert.equal(b.bottle.unitBasis,'SHARED');assert.equal(b.bottle.quantity,'1');assert.equal(b.bottle.cost.kind,'UNKNOWN');
 });
 await check('R246_R252_GROUPED_60_TO_UNKNOWN_ATOMIC_AND_REVERSIBLE',async()=>{
  await init('night-out','bar-apero',BarLivingEditor);await click('Montant direct');await click('Consommations regroupées');await change('Coût prévu (€)','60');await click('Retenir ce coût');assert.equal(step(),'summary');
  const prior=structuredClone(model.semanticState),n=pendingOps.length;await click('Bière');assert.equal(step(),'coverage');assert.deepEqual(model.semanticState,prior);await click('Détailler à la place');assert.equal(pendingOps.length,n+1);assert.equal(current().slotSelections.main.items.length,0);assert.equal(current().slotSelections.extras.items[0].cost.kind,'UNKNOWN');
  const result=await handleComposerRequest({repository,readWorld:async()=>fixture()},householdId,{kind:'READ',sequence:100,targetMonth:'2026-11',draft:model.semanticState});assert.equal(result.ok,true,result.code);assert.equal(result.model.nightOutSummaries[0].knownAmount,null);assert.equal(result.model.nightOutSummaries[0].incomplete,true);
  model=visualDraftModel(model,prior);await sync();assert.deepEqual(model.semanticState,prior);
 });
 await check('R238_DIRTY_ROW_RAW_EXACT',async()=>{
  await init('night-out','bar-apero',BarLivingEditor);await click('Bière');await change('Prix unitaire (€)','17,');await click('Date');await click('Continuer à modifier');assert.equal(input('Prix unitaire (€)').props.value,'17,');assert.equal(current().slotSelections.extras.items[0].cost.kind,'UNKNOWN');
 });
 await check('R005_R244_HEADER_TARGET_EDITS_EXISTING_GLOBAL_ONLY',async()=>{
  await init('night-out','bar-apero',BarLivingEditor);await click('Montant direct');await click('Consommations regroupées');await change('Coût prévu (€)','60');await click('Retenir ce coût');const original=current().slotSelections.main.items[0];
  overrides={initialTarget:'quick'};await act(async()=>root.unmount());await act(async()=>{root=create(render());});assert.equal(step(),'quick');assert.equal(input('Coût prévu (€)').props.value,'60');await change('Coût prévu (€)','65');await click('Retenir ce coût');assert.equal(current().slotSelections.main.items[0].selectionId,original.selectionId);assert.equal(current().slotSelections.main.items[0].cost.unitAmount,'65');assert.equal(current().slotSelections.main.items.length,1);
 });
 await check('R259_QUICK_PARTIAL_EDIT_KEEPS_FUNDING_AND_UNKNOWN_FIELDS',async()=>{
  await init('night-out','bar-apero',BarLivingEditor);await click('Montant direct');await change('Coût prévu (€)','60');await click('Retenir ce coût');const original=current().slotSelections.main.items[0];const rich={...original,fundingAllocations:[{source:'BANK',amount:'15'}],futureFixture:{unknown:'retained'},binding:{mode:'NO_RELATED_SLOT'}};await act(async()=>admit({kind:'EDIT_NIGHT_OUT',edit:{contextOccurrenceId:id,fields:{},slots:{main:[rich]}}}));await click('Montant direct');await change('Coût prévu (€)','65');await click('Retenir ce coût');const changed=current().slotSelections.main.items[0];assert.deepEqual(changed.fundingAllocations,rich.fundingAllocations);assert.deepEqual(changed.futureFixture,rich.futureFixture);assert.deepEqual(changed.binding,rich.binding);assert.equal(changed.selectionId,rich.selectionId);
  await act(async()=>admit({kind:'EDIT_NIGHT_OUT',edit:{contextOccurrenceId:id,fields:{},slots:{main:[{...changed,quantity:'2'}]}}}));const before=structuredClone(model.semanticState);await click('Montant direct');await change('Coût prévu (€)','70');await click('Retenir ce coût');assert.deepEqual(model.semanticState,before);assert.ok(controls(n=>n.props.role==='alert').some(n=>text(n).includes('unité détaillée')));
 });
 // WAVE_5_TESTS
 await check('R327_PAGED_DOCK_NO_SCROLL_READS_OR_REOBSERVE_ON_40_EDITS',async()=>{
  const {ContextPalette}=require('@/app/mois-a-venir/composer/context-palette');await act(async()=>root.unmount());let observers=0,reads=0;const PreviousObserver=globalThis.ResizeObserver;globalThis.ResizeObserver=class{constructor(){observers++;}observe(){}disconnect(){}};
  const node={clientWidth:850,get scrollLeft(){reads++;return 0;},get scrollWidth(){reads++;return 850;},set scrollLeft(value){},querySelector(){return null;}};
  const renderPalette=(edit)=>React.createElement(ContextPalette,{card:props().card,model,busy:false,appearance:'bar',choose(){},close(){},question:{title:'Fixture pagination',identity:'stable',choices:Array.from({length:12},(_,i)=>({key:String(i),label:'Choix '+i,iconKey:'activity',choose(){}})),search:{value:String(edit),change(){},label:'Recherche fixture'}}});
  try{await act(async()=>{root=create(renderPalette(0),{createNodeMock:element=>element.props['data-palette-options']!==undefined?node:null});});for(let i=1;i<=40;i++)await act(async()=>root.update(renderPalette(i)));assert.equal(reads,0);assert.equal(observers,1);}finally{await act(async()=>root.unmount());root=null;globalThis.ResizeObserver=PreviousObserver;}
 });
 // WAVE_4_TESTS
 await check('R093_R100_R102_R103_REAL_ASSET_ART_AND_VECTOR_FALLBACK',async()=>{
  const {BarProductVisual}=require('@/app/mois-a-venir/composer/bar-product-visual');if(root)await act(async()=>root.unmount());await act(async()=>{root=create(React.createElement('div',null,['bar:beer','bar:cocktail','house_party:snack'].map(assetKey=>React.createElement(BarProductVisual,{assetKey,key:assetKey}))));});assert.equal(controls(n=>n.type==='img').length,1);assert.equal(controls(n=>n.type==='svg').length,2);assert.ok(controls(n=>n.type==='span').every(n=>n.props['aria-hidden']==='true'));assert.equal(controls(n=>n.type==='img')[0].props.src,'/planned-visuals/builder/clay/drinks/beer.webp');
 });
 await check('R116_R117_R120_COMPACT_FAITHFUL_RUBRICS_NO_FAKE_EMPTY_INVITATION',async()=>{
  await init('night-out','bar-apero',BarLivingEditor);await click('Bière');const item=current().slotSelections.extras.items[0];await act(async()=>admit({kind:'EDIT_NIGHT_OUT',edit:{contextOccurrenceId:id,fields:{plannedDate:'2026-11-17'},slots:{food:[{...item,selectionId:crypto.randomUUID(),label:'Repas fixture'}],main:[{...item,selectionId:crypto.randomUUID(),label:'Entrée fixture'}]}}}));const {BarLivingCard}=require('@/app/mois-a-venir/composer/bar-living-card');await act(async()=>root.unmount());await act(async()=>{root=create(React.createElement(BarLivingCard,{card:props().card,model,living:{open(){},close(){}},busy:false,preserved:false,preserve(){},drag(){}}));});assert.deepEqual(controls(n=>n.type==='h4').map(text),['Au bar','Repas','Entrées / contribution']);assert.equal(controls(n=>n.type==='button'&&text(n).includes('Composer cette sortie')).length,0);
 });
 // WAVE_3_TESTS
 await check('R278_REVERSE_ONE_LEG_INVALIDATES_PRICES_AND_PRESERVES_ID',async()=>{
  const {barReverseLeg}=require('@/app/mois-a-venir/composer/bar-living-operations');const leg={kind:'MOBILITY_INTENT',selectionId:uuid(799),optionKey:'taxi',origin:{kind:'KNOWN',placeId:uuid(790)},destination:{kind:'KNOWN',placeId:uuid(791)},returnRequired:false,pricing:{fare:{kind:'MANUAL',unitAmount:'12'},parking:{kind:'MANUAL',unitAmount:'3'},fundingAllocations:[],preference:'FASTEST'}};const reversed=barReverseLeg(leg);assert.deepEqual(reversed.origin,leg.destination);assert.deepEqual(reversed.destination,leg.origin);assert.equal(reversed.selectionId,leg.selectionId);assert.equal(reversed.pricing.fare.kind,'UNKNOWN');assert.equal(reversed.pricing.parking.kind,'UNKNOWN');assert.equal(leg.pricing.fare.unitAmount,'12');assert.throws(()=>barReverseLeg({...leg,pricing:{...leg.pricing,fundingAllocations:[{source:'BANK',amount:'12'}]}}),/financement/);
 });
 await check('R009_R132_HOME_DOCK_NO_REDUNDANT_NAVIGATION',async()=>{
  await init('night-out','bar-apero',BarLivingEditor);const labels=dock().findAll(n=>n.type==='strong').map(text);assert.deepEqual(labels,['Bière','Before','Bouteille partagée','Autre']);assert.equal(pendingOps.length,0);
 });
 await check('R219_R222_BEFORE_CONTEXTUAL_COMPLEMENTS_NO_AUTO_MUTATION',async()=>{
  await init('night-out','bar-apero',BarLivingEditor);await click('Before');await click('Vodka');const prior=structuredClone(model.semanticState),labels=dock().findAll(n=>n.type==='strong').map(text);assert.ok(labels.includes('Diluant sans alcool'));assert.ok(!labels.includes('Rhum'));await click('Tout le Before');assert.deepEqual(model.semanticState,prior);await click('Rhum');assert.equal(model.semanticState.contexts.find(c=>c.parentContextOccurrenceId===id).slotSelections.extras.items[0].cost.kind,'UNKNOWN');
 });
 await check('R141_R142_R200_R283_R289_ENDPOINT_ROLE_SEARCH_NOT_28_PAGES',async()=>{
  const {barEndpointSuggestions}=require('@/app/mois-a-venir/composer/bar-place-knowledge');const p=(i,name,extra={})=>({placeId:uuid(i),name,commune:'Ville',nature:'Commerce',usage:'Bar',subtype:null,privatePlace:false,relationships:[],...extra}),home=p(701,'Maison',{nature:'Domicile privé',usage:'Domicile',subtype:'Domicile principal',privatePlace:true}),bar=p(702,'Bar fixture'),airport=p(703,'Aéroport',{address:'Quai École'}),venue={kind:'KNOWN',placeId:bar.placeId};
  assert.deepEqual(barEndpointSuggestions([airport,bar,home],[],'outbound','origin',venue,venue).map(x=>x.place.placeId),[home.placeId]);assert.equal(barEndpointSuggestions([airport,bar,home],[],'return','origin',{kind:'KNOWN',placeId:home.placeId},venue)[0].place.placeId,bar.placeId);assert.equal(barEndpointSuggestions([airport,bar,home],[],'outbound','origin',venue,venue,'ecole')[0].place.placeId,airport.placeId);assert.equal(barEndpointSuggestions([airport,bar,home],[],'outbound','origin',venue,venue,'',true).length,2);
 });
 await check('R271_R281_MODE_ENDPOINT_FOLLOWUP_AND_INDEPENDENT_RETURN',async()=>{
  await init('night-out','bar-apero',BarLivingEditor);await navigateRoute('outbound');await click('Taxi / Uber');assert.equal(step(),'endpoint');assert.equal(current().slotSelections.outbound.items[0].origin,null);assert.equal(current().slotSelections.return?.items.length??0,0);
  await change('Autre point du trajet','Départ libre fixture');await click('Retenir ce point libre');assert.equal(step(),'endpoint');await change('Autre point du trajet','Arrivée libre fixture');await click('Retenir ce point libre');assert.equal(step(),'outbound');const leg=structuredClone(current().slotSelections.outbound.items[0]);await navigateRoute('return');await click('Reprendre le trajet inverse');assert.deepEqual(current().slotSelections.outbound.items[0],leg);assert.notEqual(current().slotSelections.return.items[0].selectionId,leg.selectionId);assert.equal(current().slotSelections.return.items[0].pricing.fare.kind,'UNKNOWN');
 });
 await check('R235_R237_NEW_LINE_AND_RAW_EXPANSION_RETAIN_TARGET',async()=>{
  await init('night-out','bar-apero',BarLivingEditor);await click('Bière');await change('Prix unitaire (€)','8,');assert.deepEqual(dock().findAll(n=>n.type==='strong').map(text),['Autres consommations']);await click('Autres consommations');assert.ok(dock().findAll(n=>n.type==='strong').map(text).includes('+ Bière'));await click('Bière');await click('Continuer à modifier');assert.equal(input('Prix unitaire (€)').props.value,'8,');assert.equal(current().slotSelections.extras.items.length,1);
 });
 await pg.verifyCanaries();assert.deepEqual(await pg.counts(),{plans:0,revisions:0});
 fs.mkdirSync('outputs/bar-350',{recursive:true});fs.writeFileSync('outputs/bar-350/waves-react.json',JSON.stringify({proof:'PASS_REACT_AND_OWNER_FIXTURE_NOT_BROWSER_NOT_AUTH',checks,remoteWrites:0},null,2));
 if(checks.some(c=>c.status==='FAIL'))process.exitCode=1;
}finally{if(root)await act(async()=>root.unmount());await pg.close();}
