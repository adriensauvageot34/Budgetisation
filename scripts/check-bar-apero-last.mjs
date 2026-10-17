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
const mountCompact=async()=>{const card=model.board.contexts.find(c=>c.contextOccurrenceId===id);await act(async()=>root.unmount());await act(async()=>{root=create(React.createElement(BarLivingCard,{card,model,living:{open:(_,t)=>overrides.target=t,close(){}},busy:false,preserved:!!overrides.preserved,preserve(){},drag(){}}));});};
try{
 const {barBefore}=require('@/app/mois-a-venir/composer/bar-before');
 const seedRich=async()=>{await init('night-out','bar-apero',BarLivingEditor);await click('Bière');await change('Prix unitaire (€)','6');await click('Enregistrer');const sample=current().slotSelections.extras.items[0],childId=crypto.randomUUID();const bottle={...sample,selectionId:crypto.randomUUID(),optionKey:'activity',unitBasis:'SHARED',cost:{kind:'MANUAL',unitAmount:'25'}};
 await act(async()=>admit({kind:'EDIT_NIGHT_OUT',edit:{contextOccurrenceId:id,fields:{},before:{childContextOccurrenceId:childId,selectionId:crypto.randomUUID(),bottle,extras:Array.from({length:8},(_,i)=>({...sample,selectionId:crypto.randomUUID(),label:'Before '+i}))},slots:{extras:Array.from({length:15},(_,i)=>({...sample,selectionId:crypto.randomUUID(),label:'Boisson '+i,cost:{kind:i%2?'UNKNOWN':'MANUAL',...(i%2?{}:{unitAmount:'6'})}}))}}}));await sync();return childId;};
 await check('FINAL-UX-01_06_DATE_SCENE_NO_DENSE_ITEMS_CONTEXTUAL_DOCK',async()=>{
  await seedRich();const before=structuredClone(model.semanticState);await click('Date');assert.equal(controls(n=>n.props['data-bar-calendar']!==undefined).length,1);assert.equal(controls(n=>n.props['data-bar-tile']).length,0);assert.equal(controls(n=>n.props['data-bar-before-item']).length,0);assert.deepEqual(model.semanticState,before);assert.equal(dock().findAll(n=>n.type==='button'&&text(n)==='Bière').length,0);const date=controls(n=>n.type==='button'&&n.props['aria-label']==='2026-11-17')[0];await act(async()=>date.props.onClick());assert.equal(current().fields.plannedDate,'2026-11-17');assert.deepEqual(current().slotSelections,before.contexts.find(c=>c.contextOccurrenceId===id).slotSelections);
 });
 await check('FINAL-UX-02_VENUE_PRIMARY_SEARCH_NOT_AFTER_ITEMS',async()=>{const before=JSON.stringify(model.semanticState);await click('Lieu');assert.equal(controls(n=>n.props['data-bar-local-places']!==undefined).length,1);assert.equal(controls(n=>n.props['data-bar-tile']).length,0);assert.equal(controls(n=>n.props['data-bar-before-item']).length,0);assert.equal(JSON.stringify(model.semanticState),before);});
 await check('FINAL-UX-04_PAGED_15_DRINKS_9_BEFORE_REACH_ALL_IDS',async()=>{await click('← Ma sortie');await click('Autre');await click('Before');const before=JSON.stringify(model.semanticState),wanted=barBefore(model.semanticState,current());const seen=new Set();for(let i=0;i<3;i++){for(const n of controls(n=>n.props['data-bar-before-item']))seen.add(n.props['data-bar-before-item']);if(i<2)await act(async()=>controls(n=>n.type==='button'&&n.props['aria-label']===(step()==='before'?'Pages du Before · suivante':'Pages des consommations · suivante'))[0].props.onClick());}assert.equal(seen.size,9);assert.equal(JSON.stringify(model.semanticState),before);await click('Au bar');const drinks=new Set();for(let i=0;i<4;i++){for(const n of controls(n=>n.props['data-bar-tile']))drinks.add(n.props['data-bar-tile']);if(i<3)await act(async()=>controls(n=>n.type==='button'&&n.props['aria-label']===(step()==='before'?'Pages du Before · suivante':'Pages des consommations · suivante'))[0].props.onClick());}assert.equal(drinks.size,15);assert.equal(barBefore(model.semanticState,current()).child.contextOccurrenceId,wanted.child.contextOccurrenceId);});
 await check('FINAL-UX-03_TARGETED_REEDIT_CLEAN_CARD_NO_CLONE',async()=>{await click('← Ma sortie');const item=current().slotSelections.extras.items[0],count=current().slotSelections.extras.items.length;await act(async()=>tile(item.label).props.onClick());assert.equal(controls(n=>n.props['data-bar-active-tile']===true).length,1);assert.equal(controls(n=>n.props['data-bar-tile']).length,1);assert.equal(input('Prix unitaire (€)').props.value,'6');await change('Prix unitaire (€)','8');await click('Date');await click('Continuer à modifier');assert.equal(input('Prix unitaire (€)').props.value,'8');await click('Enregistrer');assert.equal(current().slotSelections.extras.items[0].selectionId,item.selectionId);assert.equal(current().slotSelections.extras.items.length,count);});
 await check('FINAL-UX-05_BEFORE_MINIATURE_DIRECT_CHILD_TARGET',async()=>{await mountCompact();assert.equal(controls(n=>n.props['data-bar-before-miniature']!==undefined).length,1);assert.equal(controls(n=>n.type==='strong'&&text(n)==='Moment lié').length,0);await click('Avant de sortir · 9 objets');assert.equal(overrides.target,'before');const first=barBefore(model.semanticState,current()).bottle;const target='component:before-main:'+first.selectionId;const buttons=controls(n=>n.type==='button'&&n.findAll(c=>c.type==='strong'&&text(c).startsWith(first.label)).length);await act(async()=>buttons[0].props.onClick());assert.equal(overrides.target,target);});
 await check('FINAL-DELETE-01_02_SECONDARY_ACCESSIBLE_REMOVAL_PENDING_HONEST',async()=>{overrides={};kind=BarLivingCard;overrides={card:model.board.contexts.find(c=>c.contextOccurrenceId===id),model,living:{removingId:id,open(){},close(){}},busy:true,preserved:false,preserve(){},remove(){},drag(){}};await sync();assert.equal(controls(n=>n.type==='button'&&text(n)==='Retirer ce moment').length,0);assert.equal(controls(n=>n.type==='details').length,1);assert.equal(controls(n=>n.props['data-bar-removal-pending']!==undefined).length,1);assert.equal(button('Retirer la sortie').props.disabled,true);});
 await check('FINAL-DELETE-05_REAL_SHELL_PENDING_REJECTION_SUCCESS_UNDO',async()=>{
  await seedRich();const before=structuredClone(model.semanticState),initial=model;
  await act(async()=>root.unmount());
  globalThis.window={addEventListener(){},removeEventListener(){}};
  Object.defineProperty(globalThis,'navigator',{configurable:true,value:{onLine:true}});
  globalThis.document.querySelector=()=>null;
  globalThis.document.querySelectorAll=()=>[];
  let board,shellRegistry,resolveRequest,requests=[],discarded=0;
  const previousLoad=Module._load;
  Module._load=function(name,...args){if(name==='./composer-board')return {ComposerBoard:props=>{board=props;shellRegistry=React.useContext(InlineEditContext);return null;}};return previousLoad.call(this,name,...args);};
  const {ComposerShell}=require('@/app/mois-a-venir/composer/composer-shell');Module._load=previousLoad;
  const transport=request=>{requests.push(request);return new Promise(resolve=>{resolveRequest=resolve;});};
  await act(async()=>{root=create(React.createElement(ComposerShell,{initialModel:initial,transport}));});
  const removal={kind:'DROP',assetKey:'context-occurrence:'+id,target:{kind:'TRASH'},values:{},identity:crypto.randomUUID(),selectionId:crypto.randomUUID()};
  await act(async()=>shellRegistry.set('raw-before',{targetRef:id,dimension:'bar',kind:'RAW',flush(){},discard(){discarded++;}}));
  await act(async()=>{board.request(removal);});assert.equal(requests.length,0);assert.equal(shellRegistry.count(),1);
  await click('Continuer à modifier');assert.equal(requests.length,0);assert.equal(discarded,0);
  await act(async()=>{board.request(removal);});await click('Abandonner cette saisie');assert.equal(discarded,1);
  assert.equal(requests.length,1);assert.equal(board.livingBar.removingId,id);assert.equal(board.busy,true);assert.deepEqual(board.model.semanticState,before);
  await act(async()=>resolveRequest({ok:false,sequence:requests[0].sequence,code:'TEST_REJECTED',message:'Retrait refusé pour ce test.'}));
  assert.equal(board.livingBar.removingId,undefined);assert.equal(board.busy,false);assert.deepEqual(board.model.semanticState,before);
  assert.equal(controls(n=>n.props['data-apply']!==undefined)[0].props.disabled,true);
  await act(async()=>{board.request(removal);});assert.equal(requests.length,2);
  const response=await handleComposerRequest({repository,readWorld:async()=>fixture(),householdPersons:[]},householdId,requests[1]);assert.equal(response.ok,true);
  await act(async()=>resolveRequest(response));assert.equal(board.model.semanticState.contexts.some(c=>c.contextOccurrenceId===id),false);assert.equal(board.livingBar.removingId,undefined);
  const undo=controls(n=>n.type==='button'&&n.props['aria-label']==='Annuler la dernière modification du brouillon')[0];assert.equal(undo.props.disabled,false);
  await act(async()=>undo.props.onClick());assert.deepEqual(board.model.semanticState,before);
 });
 await pg.verifyCanaries();const counts=await pg.counts();assert.deepEqual(counts,{plans:0,revisions:0});fs.mkdirSync('outputs/bar-last',{recursive:true});fs.writeFileSync('outputs/bar-last/ux-results.json',JSON.stringify({proof:'REACT_TRANSITIONS_NOT_BROWSER_GEOMETRY',checks,remoteWrites:0,counts},null,2));if(checks.some(c=>c.status==='FAIL'))process.exitCode=1;
}finally{if(root)await act(async()=>root.unmount());await pg.close();}
