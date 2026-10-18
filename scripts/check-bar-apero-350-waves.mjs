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
  await init('night-out','bar-apero',BarLivingEditor);await click('Lieu');await change('Chercher dans les lieux enregistrés','ÉCOLE');assert.equal(dock().props.question,undefined);
  assert.equal(controls(n=>n.type==='input'&&n.props['aria-label']==='Chercher parmi les lieux enregistrés').length,0);
  await click('Date');await click('Lieu');assert.equal(input('Chercher dans les lieux enregistrés').props.value,'ÉCOLE');
  const {barPlaces}=require('@/app/mois-a-venir/composer/bar-place-knowledge');assert.equal(barPlaces([{placeId:uuid(555),name:'Ecole Café',privatePlace:false,commune:'Ville',nature:'Commerce',usage:'Bar',relationships:[]}],'école').length,1);
 });
 await check('R199_PUBLIC_HOMONYMS_HAVE_VISIBLE_ADDRESS_PROVENANCE',async()=>{
  await init('night-out','bar-apero',BarLivingEditor);model={...model,mobilityOptions:{...model.mobilityOptions,places:['A','B'].map((address,i)=>({placeId:uuid(600+i),name:'Bar jumeau',privatePlace:false,commune:'Ville fixture',address:'Quai '+address,nature:'Commerce',usage:'Bar',relationships:[]}))}};await sync();await click('Lieu');
  const choices=controls(n=>n.type==='button'&&n.props['data-show-hint']===true);assert.equal(choices.length,2);assert.ok(choices[0].findAll(n=>n.type==='small').length);assert.match(choices[0].props.title,/Quai A/);assert.match(choices[1].props.title,/Quai B/);assert.equal(current().fields.placeRef,undefined);
 });
 // WAVE_2_TESTS
 // WAVE_3_TESTS
 await pg.verifyCanaries();assert.deepEqual(await pg.counts(),{plans:0,revisions:0});
 fs.mkdirSync('outputs/bar-350',{recursive:true});fs.writeFileSync('outputs/bar-350/waves-react.json',JSON.stringify({proof:'PASS_REACT_AND_OWNER_FIXTURE_NOT_BROWSER_NOT_AUTH',checks,remoteWrites:0},null,2));
 if(checks.some(c=>c.status==='FAIL'))process.exitCode=1;
}finally{if(root)await act(async()=>root.unmount());await pg.close();}
