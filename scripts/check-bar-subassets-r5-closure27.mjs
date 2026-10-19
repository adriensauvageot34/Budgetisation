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
const check=async(name,run)=>{try{await run();checks.push({name,status:'PASS'});console.log(name+' PASS');}catch(e){checks.push({name,status:'FAIL',message:e.message});console.log(name+' FAIL: '+e.message);}};
const text=node=>typeof node==='string'?node:node?.type==='small'||String(node?.props?.['aria-hidden'])==='true'?'':node?.children?.map(text).join('')??'';
let root,registry,requestRef,pendingOps,model,kind,id,steps,rejectNext=false;
let overrides={};
const controls=predicate=>root.root.findAll(n=>typeof n.type==='string'&&predicate(n));
const button=(label)=>{const all=controls(n=>n.type==='button'&&(text(n).trim()===label.trim()||text(n).trim()==='+ '+label.trim()||label==='Date'&&n.props['aria-label']==='Modifier la date'||label==='Lieu'&&n.props['aria-label']==='Modifier le lieu'));assert.ok(all.length,'Missing button '+label);return all[0];};
const click=async label=>{
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
const {barBefore,barBeforeRemove}=require('@/app/mois-a-venir/composer/bar-before');
const dock=()=>controls(n=>n.props['data-bar-dock']===true)[0];
const chooseFamily=async(label='Boissons')=>click(label);
try {
await check('C27_L1_SINGLE_COST_ACCESS_AND_ANCHORED_SCOPE',async()=>{
 await init('night-out','bar-apero',BarLivingEditor);
 assert.equal(controls(n=>n.type==='button'&&n.props['aria-label']==='Modifier le coût prévu').length,0);
 await click('Montant direct');
 assert.equal(controls(n=>n.props['data-bar-cost-popover']!==undefined).length,1);
 assert.equal(controls(n=>n.props['data-bar-dock']===true).length,0);
 await click('Entrées / contribution');await change('Coût prévu (€)','0');await click('Retenir ce coût');
 assert.equal(current().slotSelections.main.items[0].cost.kind,'MANUAL');
 assert.equal(current().slotSelections.main.items[0].cost.unitAmount,'0');
 assert.equal(current().slotSelections.main.items[0].economicScope.kind,'ADDITIVE_CONTRIBUTION');
});
await check('C27_L1_INCOMPLETE_QUICK_RAW_ESCAPE_IS_GUARDED',async()=>{
 await init('night-out','bar-apero',BarLivingEditor);await click('Montant direct');
 await click('Consommations regroupées');await change('Coût prévu (€)','12,');
 assert.equal(button('Retenir ce coût').props.disabled,true);
 const pop=controls(n=>n.props['data-bar-cost-popover']!==undefined)[0];
 await act(async()=>pop.props.onKeyDown({key:'Escape',preventDefault(){},stopPropagation(){}}));
 assert.equal(step(),'quick');assert.equal(pendingOps.length,0);
 await click('Continuer à modifier');assert.equal(input('Coût prévu (€)').props.value,'12,');
 await change('Coût prévu (€)','60');await click('Retenir ce coût');
 assert.equal(current().slotSelections.main.items[0].cost.unitAmount,'60');
 assert.equal(current().slotSelections.main.items[0].economicScope.kind,'AGGREGATED_SUBSTITUTIVE_ESTIMATE');
});
await check('C27_L1_REJECTED_COST_PRESERVES_BUFFER',async()=>{
 await init('night-out','bar-apero',BarLivingEditor);await click('Montant direct');
 await click('Entrées / contribution');await change('Coût prévu (€)','25');rejectNext=true;await click('Retenir ce coût');
 assert.equal(step(),'quick');assert.equal(input('Coût prévu (€)').props.value,'25');
 assert.equal(pendingOps.length,0);
 assert(controls(n=>n.props.role==='alert').some(n=>text(n).includes('pas été admis')));
});
} finally {
 if(root)await act(async()=>root.unmount());await pg.db.close();
 fs.mkdirSync('docs/status/subassets-r5/proofs',{recursive:true});
 fs.writeFileSync('docs/status/subassets-r5/proofs/closure27-l1.json',JSON.stringify({method:'REACT_OWNER_PGLITE_NOT_BROWSER',checks},null,2));
 if(checks.some(c=>c.status==='FAIL'))process.exitCode=1;
}

