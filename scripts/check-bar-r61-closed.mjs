/** Targeted real Compiler + in-process React reception. Not a browser/Auth certificate. */
import assert from 'node:assert/strict';
import Module,{createRequire} from 'node:module';
import {require} from './lib/phase2-ts-loader.mjs';
import {createKernelPostgres} from './lib/planner-kernel-postgres.mjs';
import {fixture,state,householdId} from './fixtures/planner-headless.mjs';
const rr=createRequire(new URL('../outputs/l4c-test-tools/package.json',import.meta.url));
const React=rr('react'),{create,act}=rr('react-test-renderer'),load=Module._load;
Module._load=function(name,...args){return name==='react'?React:load.call(this,name,...args);};
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
globalThis.requestAnimationFrame=cb=>{cb();return 0;};globalThis.cancelAnimationFrame=()=>{};
globalThis.document={activeElement:null,body:{}};globalThis.HTMLElement=class{};
const {BarLivingCard}=require('@/app/mois-a-venir/composer/bar-living-card');
const {BarComponentGroup}=require('@/app/mois-a-venir/composer/bar-component-group');
const {ComposerInteractionContext}=require('@/app/mois-a-venir/composer/interactions');
const {AtomicPopover}=require('@/app/mois-a-venir/composer/atomic-popover');
const {barClosedFixture}=require('@/server/recette/bar-closed-fixture');
const {handleComposerRequest}=require('@/server/phase2/planner/composer-service');
const {createPlanApplyRepository}=require('@/server/phase2/planner/repository');
const pg=await createKernelPostgres(),deps={repository:createPlanApplyRepository(pg.client),readWorld:async()=>fixture(),householdPersons:[]};
// Install UI-only globals after PGlite has initialized in its Node environment.
globalThis.window={addEventListener(){},removeEventListener(){}};
let sequence=0,checks=0,root,opened=[],removed=0,selected=0,dragStarts=0;const id=crypto.randomUUID();
const call=async(draft,op={kind:'READ'})=>{const r=await handleComposerRequest(deps,householdId,{...op,sequence:++sequence,targetMonth:'2026-11',draft});assert.equal(r.ok,true,r.message);return r.model;};
const text=n=>typeof n==='string'?n:(n?.children??[]).map(text).join(' ');
try{
 const seed=await call(state(),{kind:'DROP',assetKey:'template:night-out',presetKey:'bar-apero',target:{kind:'BOARD_ZONE'},identity:id,selectionId:crypto.randomUUID(),values:{}});
 const models={};for(const kind of ['empty','partial','rich','three','five','long'])models[kind]=await call(barClosedFixture(seed.semanticState,id,kind));
 const render=async(model,extra={})=>{await act(async()=>{root?.unmount();root=create(React.createElement(ComposerInteractionContext.Provider,{value:{grabbed:null,start(){dragStarts++;},end(){}}},React.createElement(BarLivingCard,{card:model.board.contexts.find(c=>c.contextOccurrenceId===id),model,living:{open:(_c,target)=>opened.push(target),close(){}},busy:false,preserved:false,preserve(){},remove:()=>removed++,drag(){selected++;},...extra}))); });return root.root;};
 for(const kind of ['empty','partial','rich']){const tree=await render(models[kind]);assert.equal(tree.findAll(n=>n.type==='details').length,0);assert.equal(tree.findAll(n=>n.props['aria-label']==='Préserver les choix de cette sortie').length,0);assert.equal(tree.findAll(n=>n.type==='button'&&n.props['aria-label']==='Déplacer Bar / Apéro').length,0);assert.equal(tree.findByType('article').props.tabIndex,0);checks++;}
 let tree=await render(models.empty);assert.match(text(root.toJSON()),/Coût à préciser/);assert.doesNotMatch(text(root.toJSON()),/Montant partiel/);checks++;
 tree=await render(models.partial);const status=tree.findAll(n=>n.props.className?.includes('barClosedCostStatus'))[0];assert.match(status.props['aria-label'],/certains prix restent à préciser/);assert.match(text(root.toJSON()),/Montant partiel/);assert.match(text(root.toJSON()),/\+ \?/);checks++;
 tree=await render(models.rich);const lot=tree.findAll(n=>n.props['aria-label']==='Consommation commune (lot)');assert.equal(lot.length,1);assert.doesNotMatch(text(root.toJSON()),/Lot partagé/);assert.ok(tree.findAll(n=>n.type==='img').some(n=>n.props.src.includes('shared-bottle-closed')));checks++;
 const groups=tree.findAllByType(BarComponentGroup);assert.deepEqual(groups.map(n=>n.props.group.items.length).sort(),[1,2]);const beer=groups.find(n=>n.props.group.items.length===2),popover=beer.findByType(AtomicPopover);let details;await act(async()=>{details=create(popover.props.children(()=>{}));});assert.equal(details.root.findAll(n=>n.props['data-bar-group-line']).length,2);await act(async()=>details.root.findAll(n=>n.props['data-bar-group-line'])[1].props.onClick());assert.match(opened.at(-1),/component:extras:ba610000/);await act(async()=>details.unmount());checks++;
 const surface=tree.findByType('article');const target={};
 await act(async()=>surface.props.onKeyDown({key:'Delete',target,currentTarget:target,preventDefault(){},stopPropagation(){}}));assert.equal(removed,1);
 await act(async()=>surface.props.onKeyDown({key:' ',target,currentTarget:target,preventDefault(){},stopPropagation(){}}));assert.equal(selected,1);checks++;
 // Pointer orchestration only, NOT a native browser drag certificate.
 class Target {constructor(control=false){this.control=control;}closest(){return this.control?this:null;}contains(){return true;}}
 globalThis.Element=Target;
 const background=new Target(),control=new Target(true);
 await act(async()=>surface.props.onPointerDown({button:0,clientX:0,clientY:0,target:control,currentTarget:background}));
 await act(async()=>new Promise(r=>setTimeout(r,195)));assert.equal(tree.findByType('article').props['data-drag-armed'],false);
 await act(async()=>surface.props.onPointerDown({button:0,clientX:0,clientY:0,target:background,currentTarget:background}));
 await act(async()=>new Promise(r=>setTimeout(r,195)));assert.equal(tree.findByType('article').props['data-drag-armed'],true);
 await act(async()=>tree.findByType('article').props.onDragStart({target:background,currentTarget:background,preventDefault(){throw Error('armed drag rejected');},stopPropagation(){}}));assert.equal(dragStarts,1);
 await act(async()=>tree.findByType('article').props.onDragEnd());checks++;
 tree=await render(models.rich,{preserved:true});
 await act(async()=>tree.findByType('article').props.onKeyDown({key:'Delete',target,currentTarget:target,preventDefault(){},stopPropagation(){}}));assert.equal(removed,1);assert.equal(tree.findByType('article').props.draggable,false);assert.equal(tree.findAll(n=>n.type==='button'&&n.props['aria-label']==='Ouvrir Bar / Apéro')[0].props.disabled,false);checks++;
 const stale=structuredClone(models.partial);stale.nightOutSummaries[0].semanticStateDigest='stale';await render(stale);assert.match(text(root.toJSON()),/Estimation à actualiser/);assert.doesNotMatch(text(root.toJSON()),/Montant partiel/);checks++;
 // Presentation branch of an authoritative complete summary, not a new pricing rule.
 const complete=structuredClone(models.rich);complete.nightOutSummaries[0].incomplete=false;await render(complete);assert.doesNotMatch(text(root.toJSON()),/Montant partiel/);checks++;
 const removedModel=await call(models.rich.semanticState,{kind:'DROP',assetKey:`context-occurrence:${id}`,target:{kind:'TRASH'},identity:crypto.randomUUID(),selectionId:crypto.randomUUID(),values:{}});assert.equal(removedModel.semanticState.contexts.some(c=>c.contextOccurrenceId===id),false);const restored=await call(models.rich.semanticState);assert.deepEqual(restored.semanticState.contexts.find(c=>c.contextOccurrenceId===id),models.rich.semanticState.contexts.find(c=>c.contextOccurrenceId===id));checks++;
 for(const [kind,count] of [['three',3],['five',5],['long',5]]){tree=await render(models[kind]);assert.equal(tree.findAllByType(BarComponentGroup).length,count);assert.equal(tree.findAllByType(BarComponentGroup).flatMap(n=>n.props.group.items).length,count+1);checks++;}
 console.log(JSON.stringify({status:'PASS',checks,level:'SYNTHETIC_COMPILER_AND_REACT_INTERACTIONS',remoteWrites:0,apply:false}));
}finally{await act(async()=>root?.unmount());await pg.close();}
