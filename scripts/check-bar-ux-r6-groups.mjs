import assert from 'node:assert/strict';
import {require} from './lib/phase2-ts-loader.mjs';
import {createKernelPostgres} from './lib/planner-kernel-postgres.mjs';
import {fixture,state,householdId} from './fixtures/planner-headless.mjs';
const {handleComposerRequest}=require('@/server/phase2/planner/composer-service');
const {editNightOut,substituteNightOutCoverage}=require('@/domain/phase2/planner/night-out-edit');
const {componentPresentationGroups}=require('@/domain/phase2/planner/component-group-presentation');
const {fresh,buildComponentRow}=require('@/app/mois-a-venir/composer/night-out-components');
const {PLANNED_ASSET_CATALOG_VERSION}=require('@/domain/phase2/planned-assets');
const pg=await createKernelPostgres();
const {createPlanApplyRepository}=require('@/server/phase2/planner/repository');
const deps={repository:createPlanApplyRepository(pg.client),readWorld:async()=>fixture(),householdPersons:[]};
let sequence=0,checks=0;
const call=async(draft,operation={kind:'READ'})=>{const r=await handleComposerRequest(deps,householdId,{...operation,sequence:++sequence,targetMonth:'2026-11',draft});assert.equal(r.ok,true,r.message);return r.model;};
const line=(amount,asset='bar:beer',unitBasis='ITEM',label='Bière')=>buildComponentRow({...fresh(label),costMode:amount===null?'UNKNOWN':'MANUAL',amount:amount??'',unitBasis,assetRef:{catalogVersion:PLANNED_ASSET_CATALOG_VERSION,assetKey:asset,labelAtSelection:label,provenance:'EXPLICIT_USER_DECISION'}},'extra');
try{
 const id=crypto.randomUUID();const initial=await call(state(),{kind:'DROP',assetKey:'template:night-out',presetKey:'bar-apero',target:{kind:'BOARD_ZONE'},values:{},identity:id,selectionId:crypto.randomUUID()});
 const set=async(items,extra={})=>{const semantic=editNightOut(initial.semanticState,{contextOccurrenceId:id,fields:{},slots:{extras:items},...extra});const frozen=JSON.stringify(semantic);const model=await call(semantic);assert.equal(JSON.stringify(semantic),frozen);return model;};
 for(const [prices,known,incomplete] of [[['8','9'],'17.00',false],[['8','8'],'16.00',false],[['8',null],'8.00',true],[[null,null],null,true],[['0','0'],'0.00',false]]){
  const items=prices.map(p=>line(p)),model=await set(items),groups=model.nightOutComponentGroups.filter(g=>g.contextOccurrenceId===id&&g.slotKey==='extras');
  assert.equal(groups.length,1);assert.equal(groups[0].quantity,'2');assert.equal(groups[0].knownAmount,known);assert.equal(groups[0].incomplete,incomplete);assert.deepEqual(new Set(groups[0].selectionIds),new Set(items.map(i=>i.selectionId)));checks++;}
 const items=[line('8'),line('9')],reversed=componentPresentationGroups([...items].reverse());assert.deepEqual(componentPresentationGroups(items),reversed);checks++;
 const different=[line('8'),line('9','house_party:beer')];assert.equal(componentPresentationGroups(different).length,2);checks++;
 assert.equal(componentPresentationGroups([line('8'),line('9','bar:beer','SHARED')]).length,2);checks++;
 const shared=[line('8','bar:beer','SHARED'),line('9','bar:beer','SHARED')];const sm=await set(shared);assert.equal(sm.nightOutComponentGroups.find(g=>g.slotKey==='extras'&&g.contextOccurrenceId===id).knownAmount,'17.00');checks++;
 const beforeItems=[line('12','house_party:beer'),line(null,'house_party:beer')],child=crypto.randomUUID();beforeItems[0]={...beforeItems[0],optionKey:'activity'};
 const bm=await set(items,{before:{childContextOccurrenceId:child,selectionId:crypto.randomUUID(),bottle:beforeItems[0],extras:[beforeItems[1]]}});
 assert.equal(bm.nightOutComponentGroups.find(g=>g.contextOccurrenceId===child&&g.slotKey==='$before').knownAmount,'12.00');assert.equal(bm.nightOutComponentGroups.find(g=>g.contextOccurrenceId===id&&g.slotKey==='extras').knownAmount,'17.00');checks++;
 const dense=Array.from({length:25},()=>line(null));const dm=await set(dense);assert.equal(dm.nightOutComponentGroups.find(g=>g.contextOccurrenceId===id&&g.slotKey==='extras').selectionIds.length,25);checks++;
 const removed=await set(items.slice(1));assert.equal(removed.semanticState.contexts.find(c=>c.contextOccurrenceId===id).slotSelections.extras.items.length,1);const undo=await set(items);assert.deepEqual(undo.semanticState.contexts.find(c=>c.contextOccurrenceId===id).slotSelections.extras.items,items);checks++;
 const aggregateId=crypto.randomUUID();const aggregate={...line('60','bar:beer','SHARED','Bière'),optionKey:'main',selectionId:aggregateId,economicScope:{version:'component-economic-scope@v1',kind:'AGGREGATED_SUBSTITUTIVE_ESTIMATE',coveredSelectionIds:[aggregateId]}};
 const direct=await set([],{slots:{main:[aggregate],extras:[]},before:{childContextOccurrenceId:child,selectionId:crypto.randomUUID(),bottle:beforeItems[0],extras:[]}});
 const parent=direct.semanticState.contexts.find(c=>c.contextOccurrenceId===id);const op=substituteNightOutCoverage(parent,aggregate.selectionId,items[0]);const detailed=await call(editNightOut(direct.semanticState,op));const p=detailed.semanticState.contexts.find(c=>c.contextOccurrenceId===id);
 assert.equal(p.slotSelections.main.items.length,0);assert.deepEqual(p.slotSelections.extras.items,[items[0]]);assert.deepEqual(p.slotSelections.before,parent.slotSelections.before);assert.ok(detailed.semanticState.contexts.some(c=>c.contextOccurrenceId===child));checks++;
 console.log(JSON.stringify({status:'PASS',checks,proof:'SYNTHETIC_COMPILER_AND_SERVER_PROJECTION',remoteWrites:0,noApply:true}));
}finally{await pg.close();}
