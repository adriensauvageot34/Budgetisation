/** In-process React interaction tests. This is deliberately NOT a browser/auth certificate. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import ts from 'typescript';
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
const baseline=process.env.L4C_EFFORT_BASELINE==='1';
if(baseline){for(const extension of ['.ts','.tsx']){const original=require.extensions[extension];require.extensions[extension]=(module,file)=>{if(!file.replaceAll('\\','/').includes('/src/app/mois-a-venir/composer/'))return original(module,file);let code;try{code=execFileSync('git',['show','be61864f22daf3b6546a9917758c10e0f35a4e34:'+file.slice(process.cwd().length+1).replaceAll('\\','/')],{encoding:'utf8',stdio:['ignore','pipe','ignore']});}catch{return original(module,file);}module._compile(ts.transpileModule(code,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true},fileName:file}).outputText,file);};}}
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
globalThis.window={confirm:()=>false};
const {createPlanApplyRepository}=require('@/server/phase2/planner/repository');
const repository=createPlanApplyRepository(pg.client);
const {COMPOSER_PRESETS}=require('@/domain/phase2/planner/composer-presets');
const checks=[];
const check=async(name,run)=>{await run();checks.push({name,status:'EXECUTED_PASS_REACT_IN_PROCESS_SYNTHETIC_ONLY'});console.log(name+' PASS');};
const text=node=>typeof node==='string'?node:node?.type==='small'?'':node?.children?.map(text).join('')??'';
let root,registry,requestRef,pendingOps,model,kind,id,steps;
const controls=predicate=>root.root.findAll(n=>typeof n.type==='string'&&predicate(n));
const button=(label)=>{const all=controls(n=>n.type==='button'&&text(n)===label);assert.ok(all.length,'Missing button '+label);return all[0];};
const click=async label=>{await act(async()=>button(label).props.onClick());steps++;};
const input=label=>{const field=controls(n=>n.type==='label'&&text(n).startsWith(label))[0];assert.ok(field,'Missing field '+label+'; labels='+controls(n=>n.type==='label').map(text).join(' | ')+'; buttons='+controls(n=>n.type==='button').map(text).join(' | '));return field.findByType('input');};
const change=async(label,value)=>{await act(async()=>{const node=input(label);for(let p=node.parent;p;p=p.parent)p.props.onChangeCapture?.({target:{value}});node.props.onChange({target:{value}});});steps++;};
const props=()=>({context:model.semanticState.contexts.find(c=>c.contextOccurrenceId===id),model,card:model.board.contexts.find(c=>c.contextOccurrenceId===id),semanticState:model.semanticState,targetMonth:'2026-11',householdPersons:[],options:model.mobilityOptions,busy:false,fresh:true,dockHost:{},host:{},choose:()=>{},close:()=>{},onCancel:()=>{},onSave:admit,decide:admit,saveStatus:'MEMORY',editor:model.editors.find(e=>e.assetKey==='template:'+model.semanticState.contexts.find(c=>c.contextOccurrenceId===id).templateKey)});
const admit=operation=>{const semantic=stageLocalDecision(model,model.semanticState,operation);if(!semantic)return false;pendingOps.push(operation);model=visualDraftModel(model,semantic);return true;};
const render=()=>React.createElement(WorkshopConfirmationProvider,{requestRef},React.createElement(WorkshopChoicesProvider,null,React.createElement(InlineEditContext.Provider,{value:registry},React.createElement(kind,props()))));
const sync=async()=>{await act(async()=>root.update(render()));};
const init=async(template,preset,component)=>{if(root)await act(async()=>root.unmount());registry=new InlineEditRegistry();requestRef={current:()=>{}};registry.requestConfirmation=(message,accept)=>requestRef.current({message,accept,acceptLabel:'Abandonner cette saisie'});pendingOps=[];steps=0;id=crypto.randomUUID();kind=component;const r=await handleComposerRequest({repository,readWorld:async()=>fixture(),householdPersons:[]},householdId,{sequence:1,targetMonth:'2026-11',draft:state(),kind:'DROP',assetKey:'template:'+template,presetKey:preset,target:{kind:'BOARD_ZONE'},values:{},identity:id,selectionId:crypto.randomUUID()});assert.equal(r.ok,true,JSON.stringify(r));model=r.model;await act(async()=>{root=create(render(),{createNodeMock:element=>element.type==='dialog'?{open:false,showModal(){this.open=true;},close(){this.open=false;},querySelector(){return{focus(){}};},contains(){return false;}}:null});});};
const results=[];
try {
for(const [scenario,template,preset]of [['A1','activity','spa-relax'],['A2','activity','hiking-nature'],['R1','restaurant','restaurant-for-two'],['R2','fast-food','chicken-snack'],['R3','delivery','uber-eats-order'],['P1','purchase','clothing-shopping'],['P2','purchase','amazon-purchase'],['M1','purchase','laundry-detergent']]){
 await init(template,preset,RestaurantEditor);const initialInputs=controls(n=>n.type==='input').length;
 await click(baseline?'Prévoir un budget':template==='purchase'?'Coût direct':template==='delivery'?'Commande complète':template==='activity'?'Billets / coût direct':'Montant rapide');
 if(baseline){const select=controls(n=>n.type==='select'&&n.props.value==='UNKNOWN')[0];if(select){await act(async()=>select.props.onChange({target:{value:'MANUAL'}}));steps++;}}
 const field=controls(n=>n.type==='input'&&n.props.inputMode==='decimal')[0];assert.ok(field);await act(async()=>{for(let p=field.parent;p;p=p.parent)p.props.onChangeCapture?.({target:{value:'60'}});field.props.onChange({target:{value:'60'}});});steps++;
 const visibleInputs=controls(n=>n.type==='input').length,selects=controls(n=>n.type==='select').length;
 await click(baseline?'Valider le budget':'Conserver ce coût');await sync();assert.equal(pendingOps.length,1);const simpleGestures=steps;steps=0;
 await click(baseline?'Modifier le budget':template==='purchase'?'Coût direct':template==='delivery'?'Commande complète':template==='activity'?'Billets / coût direct':'Montant rapide');const next=controls(n=>n.type==='input'&&n.props.inputMode==='decimal')[0];await act(async()=>{for(let p=next.parent;p;p=p.parent)p.props.onChangeCapture?.({target:{value:'61'}});next.props.onChange({target:{value:'61'}});});steps++;await click(baseline?'Valider le budget':'Conserver ce coût');await sync();assert.equal(pendingOps.length,2);
 results.push({scenario,template,simpleGestures,reeditGestures:steps,priceScreenDOMInputs:visibleInputs,priceScreenDOMSelects:selects,richTwoComponents:'NOT_MEASURED',scroll:'NOT_MEASURED_NO_BROWSER',initialInputs});
}
fs.mkdirSync('outputs/l4c',{recursive:true});fs.writeFileSync('outputs/l4c/effort-'+(baseline?'before':'after')+'.json',JSON.stringify({method:'ACTUAL_REACT_HANDLERS_IN_PROCESS_NOT_BROWSER',baseline:baseline?'be61864f22daf3b6546a9917758c10e0f35a4e34':null,results},null,2));console.log(JSON.stringify(results));
}finally{if(root)await act(async()=>root.unmount());await pg.close();}
