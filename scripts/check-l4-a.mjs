import assert from 'node:assert/strict';
import fs from 'node:fs';
import {require} from './lib/phase2-ts-loader.mjs';
import {createKernelPostgres} from './lib/planner-kernel-postgres.mjs';
import {fixture,state,uuid,householdId} from './fixtures/planner-headless.mjs';
import {p09CompatibilityMonth} from './fixtures/planner-p09.mjs';
import {providers} from './fixtures/planner-mobility.mjs';
const {handleComposerRequest}=require('@/server/phase2/planner/composer-service');
const {createPlanApplyRepository}=require('@/server/phase2/planner/repository');
const {previewPlanScenario}=require('@/server/phase2/planner/apply');
const {parsePlanSemanticState,semanticStateDigest}=require('@/domain/phase2/planner/semantic-state');
const {stageLocalDecision}=require('@/app/mois-a-venir/composer/local-draft');
const {buildComponentRow,fresh,fromSelection}=require('@/app/mois-a-venir/composer/night-out-editor');
const {editNightOut}=require('@/domain/phase2/planner/night-out-edit');
const {preparePlanningMobility}=require('@/server/phase2/planner/prospective-mobility-pricing');
const {declareComponentQuantity}=require('@/domain/phase2/planner/component-quantity');
const {InlineEditRegistry}=require('@/app/mois-a-venir/composer/inline-edit-registry');
const {ComposerResponseGate}=require('@/app/mois-a-venir/composer/draft-controller');
const pg=await createKernelPostgres(), repository=createPlanApplyRepository(pg.client), world=fixture();
let reads=0, sequence=0;
const deps={repository,householdPersons:[{personId:uuid(1),displayName:'Alice Fixture'}],readWorld:async()=>{reads++;return world;},
  prepareWorld:(world,draft)=>preparePlanningMobility(world,draft,providers().value),
  readDirectWorld:async()=>({forecast:world.forecast,monthInputs:world.monthInputs,externalIntents:world.externalIntents,asOfDate:world.asOfDate}),
  validateContextReferences:async(_household,refs)=>{if(refs.personIds.some(id=>id!==uuid(1)))throw TypeError('CONTEXT_PERSON_NOT_IN_HOUSEHOLD');}};
const request=async(operation,draft)=>{const response=await handleComposerRequest(deps,householdId,{sequence:++sequence,targetMonth:'2026-11',...operation,...(draft?{draft}:{})});assert.equal(response.ok,true,`${response.code} ${response.message}`);return response.model;};
const checks=[], check=async(name,fn)=>{await fn();checks.push({name,status:'PASS_CONTRACT_PGLITE_SYNTHETIC_ONLY'});console.log(name+' PASS');};
const id=uuid(49011), get=model=>model.semanticState.contexts.find(c=>c.contextOccurrenceId===id);
const row=(number,label,qty,price,basis='ITEM',people=0)=>buildComponentRow({...fresh(label),id:uuid(number),quantity:qty,unitBasis:basis,personCount:String(people||''),costMode:'MANUAL',amount:price,fundingMode:'BANK',fundingAmount:String(Number(qty)*Number(price)*(basis==='PERSON'?people:1))},'extra');
const transport=(number,mode,amount)=>({selectionId:uuid(number),optionKey:mode,kind:'MOBILITY_INTENT',provenance:'EXPLICIT_USER_DECISION',origin:{kind:'TEXT',label:'Maison fixture'},destination:{kind:'TEXT',label:'Club fixture'},returnRequired:false,pricing:{fare:amount===null?{kind:'UNKNOWN'}:{kind:'MANUAL',unitAmount:amount},fundingAllocations:amount===null?[]:[{source:'BANK',amount}]}});
try{
  let simple=await request({kind:'DROP',assetKey:'template:night-out',presetKey:'techno-night',target:{kind:'BOARD_ZONE'},values:{},identity:id,selectionId:uuid(49012)},state());
  await check('01_CREATE_PRESET_NO_INVENTED_FACTS',()=>{assert.equal(get(simple).fields.label,'Soirée techno');for(const key of ['participantRefs','plannedDate','placeRef'])assert.ok(get(simple).fields[key]==null);});
  const main={...row(49013,'Entrées','1','30','SHARED'),optionKey:'main'};
  simple=await request({kind:'EDIT_NIGHT_OUT',edit:{contextOccurrenceId:id,fields:{},slots:{main:[main]}}},simple.semanticState);
  await check('A_MINIMAL_30_RELOAD_35_SAME_IDS',async()=>{const reload=parsePlanSemanticState(JSON.parse(JSON.stringify(simple.semanticState)));assert.equal(semanticStateDigest(reload),semanticStateDigest(simple.semanticState));const next=await request({kind:'EDIT_NIGHT_OUT',edit:{contextOccurrenceId:id,fields:{},slots:{main:[buildComponentRow({...fromSelection(main),edited:true,amount:'35',fundingAmount:'35'},'main')]}}},reload);assert.equal(get(next).slotSelections.main.items[0].selectionId,main.selectionId);assert.equal(next.semanticState.contexts.filter(c=>c.templateKey==='night-out').length,1);assert.equal(next.nightOutSummaries[0].knownAmount,'35.00');});
  const entries={...row(49014,'Entrées','1','15','PERSON',2),optionKey:'main'}, drink=row(49015,'Consommations','2','5'), shared=row(49016,'Bouteille commune','1','20','SHARED');
  let full=await request({kind:'EDIT_NIGHT_OUT',edit:{contextOccurrenceId:id,fields:{participantRefs:[{kind:'HOUSEHOLD_PERSON',personId:uuid(1)},{kind:'TEXT',label:'Invité fixture'}]},
    slots:{main:[entries],extras:[drink,shared]},before:{childContextOccurrenceId:uuid(49017),selectionId:uuid(49018),bottle:{...row(49019,'Before','1','10','SHARED'),optionKey:'activity'},extras:[]}}},simple.semanticState);
  await check('02_PERSON_ENTRIES_30_NO_GLOBAL_DUPLICATE',async()=>{const compiled=(await previewPlanScenario(deps,householdId,full.semanticState)).compiled;assert.equal(compiled.components.filter(c=>c.label==='Entrées').length,1);assert.equal(compiled.components.find(c=>c.label==='Entrées').evaluation.economicAmount,'30.00');assert.equal(get(full).slotSelections.main.items[0].quantityEvidenceVersion,'component-quantity@v1');});
  await check('03_INDIVIDUAL_DRINKS_10',async()=>{assert.equal((await previewPlanScenario(deps,householdId,full.semanticState)).compiled.components.find(c=>c.label==='Consommations').evaluation.economicAmount,'10.00');});
  await check('04_SHARED_BOTTLE_20',async()=>{assert.equal((await previewPlanScenario(deps,householdId,full.semanticState)).compiled.components.find(c=>c.label==='Bouteille commune').evaluation.economicAmount,'20.00');});
  await check('05_BEFORE_10_EXPLICIT_CHILD',()=>{assert.equal(full.semanticState.contexts.find(c=>c.contextOccurrenceId===uuid(49017)).parentContextOccurrenceId,id);assert.equal(get(full).slotSelections.before.items[0].selectionId,uuid(49018));});
  for(const [slot,number,amount] of [['outbound',49020,'12'],['return',49021,'13']])full=await request({kind:'MUTATE',mutation:{kind:'PATCH_CONTEXT',contextOccurrenceId:id,slotKey:slot,items:[transport(number,'taxi',amount)]}},full.semanticState);
  await check('06_LEGS_INDEPENDENT_IDS',()=>{assert.equal(get(full).slotSelections.outbound.items[0].selectionId,uuid(49020));assert.equal(get(full).slotSelections.return.items[0].selectionId,uuid(49021));assert.equal(full.mobilitySummaries.filter(s=>s.contextOccurrenceId===id).length,2);});
  await check('07_ORACLE_95_PARENT_NON_ADDITIVE',()=>{assert.equal(full.nightOutSummaries.find(s=>s.contextOccurrenceId===id).knownAmount,'95.00');});
  const three=await request({kind:'EDIT_NIGHT_OUT',edit:{contextOccurrenceId:id,fields:{participantRefs:[...get(full).fields.participantRefs,{kind:'TEXT',label:'Troisième fixture'}]}}},full.semanticState);
  await check('08_PEOPLE_CHANGE_NO_RETROACTIVE_MULTIPLICATION',()=>{assert.deepEqual(get(three).slotSelections,get(full).slotSelections);assert.equal(three.nightOutSummaries.find(s=>s.contextOccurrenceId===id).knownAmount,'95.00');const converted=declareComponentQuantity('PER_PERSON','1',3);assert.equal(converted.quantity,'3');});
  const changedExtras=get(three).slotSelections.extras.items.map(item=>item.selectionId===drink.selectionId?buildComponentRow({...fromSelection(item),edited:true,amount:'6',fundingAmount:'12'},'extra'):item);
  const changed=await request({kind:'EDIT_NIGHT_OUT',edit:{contextOccurrenceId:id,fields:{},slots:{extras:changedExtras}}},three.semanticState);
  await check('09_ONLY_DRINK_PRICE_PATCH',()=>{assert.deepEqual(get(changed).fields,get(three).fields);for(const slot of ['main','before','outbound','return'])assert.deepEqual(get(changed).slotSelections[slot],get(three).slotSelections[slot]);assert.deepEqual(get(changed).slotSelections.extras.items[1],shared);assert.equal(changed.nightOutSummaries.find(s=>s.contextOccurrenceId===id).knownAmount,'97.00');});
  const remove={kind:'EDIT_NIGHT_OUT',edit:{contextOccurrenceId:id,fields:{},before:null}}, removed=await request(remove,changed.semanticState);
  await check('10_REMOVE_BEFORE_ONLY_OMITTED_PRESERVED',()=>{for(const slot of ['main','extras','outbound','return'])assert.deepEqual(get(removed).slotSelections[slot],get(changed).slotSelections[slot]);assert.ok(!removed.semanticState.contexts.some(c=>c.contextOccurrenceId===uuid(49017)));assert.equal(removed.nightOutSummaries.find(s=>s.contextOccurrenceId===id).knownAmount,'87.00');});
  const unknown=await request({kind:'MUTATE',mutation:{kind:'PATCH_CONTEXT',contextOccurrenceId:id,slotKey:'return',items:[transport(49021,'train',null)]}},removed.semanticState);
  await check('11_TRANSPORT_SWITCH_INVALIDATES_OLD_FARE_UNKNOWN',()=>{assert.deepEqual(get(unknown).slotSelections.outbound,get(removed).slotSelections.outbound);assert.equal(get(unknown).slotSelections.return.items[0].pricing.fare.kind,'UNKNOWN');assert.equal(unknown.nightOutSummaries.find(s=>s.contextOccurrenceId===id).knownAmount,'74.00');assert.equal(unknown.nightOutSummaries.find(s=>s.contextOccurrenceId===id).incomplete,true);});
  await check('12_SEMANTIC_SERIALIZATION_FIELDS_AND_LEGACY',()=>{assert.deepEqual(parsePlanSemanticState(JSON.parse(JSON.stringify(full.semanticState))),full.semanticState);const legacy=p09CompatibilityMonth().semantic;const next=editNightOut(legacy,{contextOccurrenceId:legacy.contexts[0].contextOccurrenceId,fields:{label:'Nom seul'}});assert.deepEqual(next.contexts[0].slotSelections,legacy.contexts[0].slotSelections);assert.equal(next.contexts[0].fields.plannedDate,null);});
  await check('13_LOCAL_HISTORY_SNAPSHOTS',()=>{assert.deepEqual(stageLocalDecision(changed,changed.semanticState,remove),removed.semanticState);const past=[changed.semanticState],future=[removed.semanticState];assert.deepEqual(parsePlanSemanticState(past[0]),changed.semanticState);assert.deepEqual(parsePlanSemanticState(future[0]),removed.semanticState);});
  await check('14_REJECTED_MUTATION_ORIGINAL_INTACT',async()=>{const before=JSON.stringify(full.semanticState);const response=await handleComposerRequest(deps,householdId,{sequence:++sequence,targetMonth:'2026-11',draft:full.semanticState,kind:'EDIT_NIGHT_OUT',edit:{contextOccurrenceId:id,fields:{participantRefs:[{kind:'HOUSEHOLD_PERSON',personId:uuid(99999)}]}}});assert.equal(response.ok,false);assert.equal(JSON.stringify(full.semanticState),before);});
  await check('15_OUT_OF_ORDER_GATE',()=>{const gate=new ComposerResponseGate(),old=gate.next('old');gate.invalidate();const current=gate.next('new');assert.equal(gate.accepts(old,old.sequence,'new'),false);assert.equal(gate.accepts(current,current.sequence,'new'),true);});
  await check('16_RAW_NOT_FLUSHED_IMPLICITLY',()=>{const registry=new InlineEditRegistry();let discarded=0,flushed=0;registry.set('night',{targetRef:id,dimension:'night',kind:'RAW',discard:()=>discarded++,flush:()=>flushed++});assert.equal(registry.flushPending(),0);assert.equal(registry.confirmDiscard(()=>false),false);assert.equal(discarded,0);assert.equal(flushed,0);assert.equal(registry.confirmDiscard(()=>true),true);assert.equal(discarded,1);assert.equal(registry.count(),0);});
  await check('FOOD_EXISTING_CHILD_UNCHANGED_BY_NIGHT_EDIT',async()=>{const child=uuid(49030),withChild=await request({kind:'DROP',assetKey:'template:restaurant',target:{kind:'CONTEXT_SOCKET',contextOccurrenceId:id,slotKey:'food'},identity:child,selectionId:uuid(49031),values:{}},full.semanticState);const after=await request({kind:'EDIT_NIGHT_OUT',edit:{contextOccurrenceId:id,fields:{timingNote:'Fin de semaine'}}},withChild.semanticState);assert.deepEqual(after.semanticState.contexts.find(c=>c.contextOccurrenceId===child),withChild.semanticState.contexts.find(c=>c.contextOccurrenceId===child));assert.deepEqual(get(after).slotSelections.food,get(withChild).slotSelections.food);});
  await check('EXPLORATORY_UNRELATED_PRICE_PRESERVES_PROVENANCE',()=>{const legacy=p09CompatibilityMonth().semantic;const parent=legacy.contexts[0],extras=parent.slotSelections.extras.items;const next=editNightOut(legacy,{contextOccurrenceId:parent.contextOccurrenceId,fields:{},slots:{main:[{...parent.slotSelections.main.items[0],cost:{kind:'MANUAL',unitAmount:'2'}}]}});assert.deepEqual(next.contexts[0].slotSelections.extras.items,extras);});
  await pg.verifyCanaries();
  fs.mkdirSync('docs/status/evidence/l4-a',{recursive:true});
  fs.writeFileSync('docs/status/evidence/l4-a/contracts.json',JSON.stringify({status:'EXECUTED_PASS_SYNTHETIC_ONLY',checks,readWorldCalls:reads,counts:await pg.counts(),remoteWrites:0,auth:'NOT_RUN_AUTH'},null,2));
  console.log('L4-A '+checks.length+' checks PASS_PGLITE_SYNTHETIC_ONLY');
}finally{await pg.close();}
