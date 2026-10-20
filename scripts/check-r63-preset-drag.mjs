/** Synthetic transport + actual Compiler + library handlers. Never a native DnD certificate. */
import assert from 'node:assert/strict';
import Module,{createRequire} from 'node:module';
import {require} from './lib/phase2-ts-loader.mjs';
import {createKernelPostgres} from './lib/planner-kernel-postgres.mjs';
import {fixture,state,householdId} from './fixtures/planner-headless.mjs';
const rr=createRequire(new URL('../outputs/l4c-test-tools/package.json',import.meta.url));
const React=rr('react'),{create,act}=rr('react-test-renderer'),load=Module._load;
Module._load=function(name,...args){return name==='react'?React:load.call(this,name,...args);};
const {presetDragSource,preparedDrop,ComposerInteractionContext}=require('@/app/mois-a-venir/composer/interactions');
const {composerPreset,presetForContext}=require('@/domain/phase2/planner/composer-presets');
const {ComposerLibrary}=require('@/app/mois-a-venir/composer/composer-library');
const {PresetIllustration}=require('@/app/mois-a-venir/composer/preset-illustration');
const {handleComposerRequest}=require('@/server/phase2/planner/composer-service');
const {createPlanApplyRepository}=require('@/server/phase2/planner/repository');
const pg=await createKernelPostgres(),deps={repository:createPlanApplyRepository(pg.client),readWorld:async()=>fixture(),householdPersons:[]};
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
globalThis.localStorage={getItem(){return null;}};
globalThis.window={addEventListener(){},removeEventListener(){}};
let sequence=0,root,checks=0;const starts=[],clicks=[];
const request=(draft,op)=>handleComposerRequest(deps,householdId,{...op,sequence:++sequence,targetMonth:'2026-11',draft});
try{
 const read=await request(state(),{kind:'READ'});assert.equal(read.ok,true);const model=read.model;
 for(const key of ['bar-apero','techno-night','mascara']){
  const preset=composerPreset(key),asset=model.library.searchableAssets.find(a=>a.templateKey===preset.templateKey),source=model.presentation.dragSources[asset.assetKey];
  const drag=presetDragSource(model,source,key);assert.equal(drag.presetKey,key);assert.equal(drag.label,preset.label);
  const identity=crypto.randomUUID(),selectionId=crypto.randomUUID(),op=preparedDrop(drag,{kind:'BOARD_ZONE'},identity,selectionId);
  assert.equal(op.presetKey,key);
  const dropped=await request(model.semanticState,op),clicked=await request(model.semanticState,{kind:'DROP',assetKey:asset.assetKey,presetKey:key,target:{kind:'BOARD_ZONE'},identity,selectionId,values:{}});
  assert.equal(dropped.ok,true,dropped.message);assert.equal(clicked.ok,true,clicked.message);assert.deepEqual(dropped.model.semanticState,clicked.model.semanticState);
  const context=dropped.model.semanticState.contexts.find(c=>c.contextOccurrenceId===identity);assert.equal(presetForContext(context)?.presetKey,key);
  assert.equal(dropped.model.semanticState.contexts.filter(c=>c.contextOccurrenceId===identity).length,1);
  const replay=await request(dropped.model.semanticState,op);
  if(replay.ok)assert.equal(replay.model.semanticState.contexts.filter(c=>c.contextOccurrenceId===identity).length,1);
  else assert.equal(dropped.model.semanticState.contexts.filter(c=>c.contextOccurrenceId===identity).length,1);
  checks++;
 }
 const source=model.presentation.dragSources['template:night-out'];
 assert.equal(presetDragSource(model,source,'mascara'),null);assert.equal(presetDragSource(model,source,'not-a-preset'),null);checks++;
 const blocked={...model,dropCapabilities:model.dropCapabilities.map(d=>d.sourceAssetKey===source.assetKey&&d.target.kind==='BOARD_ZONE'?{...d,resolution:'BLOCKED'}:d)};
 assert.equal(presetDragSource(blocked,source,'bar-apero'),null);checks++;
 const props={model,openToken:0,busy:false,selected:null,choose(){},choosePreset:(asset,key)=>clicks.push([asset.assetKey,key]),drag(){},inspectContext(){}};
 await act(async()=>{root=create(React.createElement(ComposerInteractionContext.Provider,{value:{start:(key,event,preset)=>starts.push([key,preset]),end(){}}},React.createElement(ComposerLibrary,props)));});
 for(const key of ['bar-apero','techno-night']){
  const tile=root.root.find(n=>n.type==='button'&&n.props['data-preset']===key);assert.equal(tile.props.draggable,true);
  await act(async()=>tile.props.onDragStart({stopPropagation(){},preventDefault(){throw Error('admitted source rejected');}}));
  assert.deepEqual(starts.at(-1),['template:night-out',key]);
  await act(async()=>tile.props.onClick());assert.deepEqual(clicks.at(-1),['template:night-out',key]);checks++;
 }
 assert.equal(starts.length,2);assert.equal(clicks.length,2);assert.ok(root.root.findAllByType(PresetIllustration).every(n=>n.findByType('img').props.draggable===false));checks++;
 await act(async()=>{root.unmount();root=create(React.createElement(ComposerLibrary,props));});
 let refused=false;await act(async()=>root.root.find(n=>n.type==='button'&&n.props['data-preset']==='bar-apero').props.onDragStart({stopPropagation(){},preventDefault(){refused=true;}}));assert.equal(refused,true);checks++;
 console.log(JSON.stringify({status:'PASS',checks,presets:['bar-apero','techno-night','mascara'],level:'SYNTHETIC_TRANSPORT_COMPILER_REACT',nativeBrowser:'NOT_RUN',remoteWrites:0,apply:false}));
}finally{await act(async()=>root?.unmount());await pg.close();}
