import assert from 'node:assert/strict';
import {require} from './lib/phase2-ts-loader.mjs';
import {readMonthFixture} from './fixtures/composer-v22-b1.mjs';
import {uuid,householdId} from './fixtures/planner-headless.mjs';
const {handleComposerRequest}=require('@/server/phase2/planner/composer-service');
const {evaluatePlanScenario}=require('@/server/phase2/planner/preview');
const {presetCreationFields}=require('@/domain/phase2/planner/composer-presets');
const {editShortStay}=require('@/domain/phase2/planner/short-stay-edit');
const {validateStayCalendar}=require('@/app/mois-a-venir/composer/short-stay-editor');
const {componentId}=require('@/domain/phase2/planner/identity');
const {shortStaySuggestions,shortStayTransportModes}=require('@/app/mois-a-venir/composer/short-stay-suggestions');
const {stageLocalDecision}=require('@/app/mois-a-venir/composer/local-draft');
globalThis.fetch=async()=>{throw Error('A06_REMOTE_FORBIDDEN');};
const f=await readMonthFixture(),before=structuredClone(f.world),checks=[];
const lodging={selectionId:uuid(96011),optionKey:'lodging',kind:'COMPONENT',provenance:'EXPLICIT_USER_DECISION',label:'Hôtel synthétique',
  quantity:'1',unitBasis:'ITEM',cost:{kind:'MANUAL',unitAmount:'200.00'},fundingAllocations:[],binding:{mode:'NO_RELATED_SLOT'},
  lodgingPricing:{version:'lodging-pricing@v1',basis:'TOTAL',nightCount:2}};
const stay=(id,selectionId,date)=>({contextOccurrenceId:uuid(id),templateKey:'short-stay',status:'ACTIVE',parentContextOccurrenceId:null,
  fields:{...presetCreationFields('short-stay','weekend-gite'),fieldSchemaVersion:'context-fields@v5',label:'Week-end synthétique',plannedDate:date,endDate:`2026-11-${Number(date.slice(-2))+2}`,nightCount:2,lodgingKind:'HOTEL'},
  slotSelections:{lodging:{items:[{...lodging,selectionId:uuid(selectionId)}]}},provenance:'EXPLICIT_USER_DECISION'});
const first=stay(96001,96011,'2026-11-13'),sibling=stay(96002,96012,'2026-11-20');
export const seeded={...f.semantic,contexts:[first,sibling]};
const compile=draft=>evaluatePlanScenario(f.world,draft,{expectedActiveRevisionId:null,expectedActiveRevisionNumber:0}).compiled;
const request=async(draft,operation={kind:'READ'})=>{
  const r=await handleComposerRequest(f.deps,householdId,{sequence:0,targetMonth:'2026-11',draft,...operation});
  assert.equal(r.ok,true,r.code);return r.model;
};
const check=async(name,run)=>{await run();checks.push(name);console.log(name+' PASS');};
const financial=compile(seeded).financialAdapterInput;
await check('A06-C01-PUBLISHED-OWNER-SOCKETS-AND-READ-NO-DELTA',async()=>{
  const model=await request(seeded),card=model.board.contexts.find(c=>c.contextOccurrenceId===first.contextOccurrenceId);
  assert(card.capabilityRefs.includes('PATCH_CONTEXT'));
  for(const [slot,option,cardinality] of [['lodging','lodging','REQUIRED_ONE'],['extras','extra','REPEATING']]){
    const socket=card.sockets.find(s=>s.slotKey===slot);assert.equal(socket.cardinality,cardinality);
    assert(socket.capabilityRefs.includes(`short-stay:${slot}:SELECT_COMPONENT`));
    assert(model.dropCapabilities.some(d=>d.sourceAssetKey===`option:short-stay:${slot}:${option}`&&d.target.contextOccurrenceId===first.contextOccurrenceId&&d.semanticAction==='PATCH_CONTEXT'));
  }
  assert.deepEqual(compile(model.semanticState).financialAdapterInput,financial);
  assert.deepEqual(compile(seeded).components.map(c=>c.evaluation.economicAmount),['200.00','200.00']);
});
await check('A06-C02-PER-NIGHT-TWO-NIGHTS-COMPILER-IDENTITIES',async()=>{
  const nightly={...lodging,quantity:'2',cost:{kind:'MANUAL',unitAmount:'100.00'},lodgingPricing:{version:'lodging-pricing@v1',basis:'PER_NIGHT',nightCount:2}};
  const m=await request(seeded,{kind:'EDIT_SHORT_STAY',edit:{contextOccurrenceId:first.contextOccurrenceId,fields:{},slots:{lodging:[nightly]}}});
  assert.deepEqual(compile(m.semanticState).financialAdapterInput,financial);
  assert.deepEqual(m.semanticState.contexts[1],sibling);assert.equal(m.semanticState.contexts[0].slotSelections.lodging.items[0].selectionId,lodging.selectionId);
});
await check('A06-C03-UNKNOWN-DURATION-AND-UNKNOWN-PRICE-ARE-NOT-ZERO',async()=>{
  const nightly={...lodging,cost:{kind:'MANUAL',unitAmount:'100.00'},lodgingPricing:{version:'lodging-pricing@v1',basis:'PER_NIGHT',nightCount:null}};
  const a=await request(seeded,{kind:'EDIT_SHORT_STAY',edit:{contextOccurrenceId:first.contextOccurrenceId,fields:{nightCount:null},slots:{lodging:[nightly]}}});
  assert.equal(compile(a.semanticState).components.find(c=>c.contextOccurrenceId===first.contextOccurrenceId).evaluation.economicAmount,null);
  const b=await request(seeded,{kind:'EDIT_SHORT_STAY',edit:{contextOccurrenceId:first.contextOccurrenceId,fields:{},slots:{lodging:[{...lodging,cost:{kind:'UNKNOWN'}}]}}});
  assert.equal(compile(b.semanticState).components.find(c=>c.contextOccurrenceId===first.contextOccurrenceId).evaluation.economicAmount,null);
  const c=await request(seeded,{kind:'EDIT_SHORT_STAY',edit:{contextOccurrenceId:first.contextOccurrenceId,fields:{},slots:{lodging:[{...lodging,cost:{kind:'MANUAL',unitAmount:'0.00'}}]}}});
  assert.equal(compile(c.semanticState).components.find(c=>c.contextOccurrenceId===first.contextOccurrenceId).evaluation.economicAmount,'0.00');
});
await check('A06-C04-EXPLICIT-SUPPLEMENT-UNKNOWN-SINGLE-ADDITIVE-LINE',async()=>{
  const tax={...lodging,selectionId:uuid(96021),optionKey:'extra',label:'Taxe de séjour',cost:{kind:'UNKNOWN'}};delete tax.lodgingPricing;
  const m=await request(seeded,{kind:'EDIT_SHORT_STAY',edit:{contextOccurrenceId:first.contextOccurrenceId,fields:{},slots:{extras:[tax]}}});
  const compiled=compile(m.semanticState);assert.equal(compiled.components.length,3);
  assert.equal(compiled.components.find(c=>c.label==='Taxe de séjour').evaluation.economicAmount,null);
  assert.equal(compiled.components.find(c=>c.contextOccurrenceId===first.contextOccurrenceId&&c.label===lodging.label).evaluation.economicAmount,'200.00');
  const next=await request(m.semanticState,{kind:'EDIT_SHORT_STAY',edit:{contextOccurrenceId:first.contextOccurrenceId,fields:{},slots:{extras:[{...tax,cost:{kind:'MANUAL',unitAmount:'8.00'}}]}}});
  assert.equal(compile(next.semanticState).components.length,3);
  assert.equal(compile(next.semanticState).components.find(c=>c.label==='Taxe de séjour').evaluation.economicAmount,'8.00');
  assert.deepEqual(next.semanticState.contexts[1],sibling);
});
await check('A06-C05-UNPUBLISHED-DEPOSIT-BOOKING-HOTEL-DATES-REFUSED',async()=>{
  for(const key of ['depositIncluded','reservationRef','hotelCheckIn','paymentStatus']){
    assert.throws(()=>editShortStay(seeded,{contextOccurrenceId:first.contextOccurrenceId,fields:{[key]:key==='depositIncluded'?'50.00':'synthetic'}}),/SHORT_STAY_FIELD_INVALID/);
  }
  assert.deepEqual(compile(seeded).financialAdapterInput,financial); // No representation of an included deposit is fabricated.
});
await check('A06-C06-CALENDAR-CONFLICT-AND-INDEPENDENT-SELECTION-UNCHANGED',async()=>{
  validateStayCalendar(first.fields);
  assert.throws(()=>validateStayCalendar({...first.fields,endDate:'2026-11-16'}),/dates indiquent 3 nuit/);
  const next=editShortStay(seeded,{contextOccurrenceId:first.contextOccurrenceId,fields:{plannedDate:'2026-11-14',endDate:'2026-11-16'}});
  assert.deepEqual(next.contexts[0].slotSelections,first.slotSelections);assert.deepEqual(next.contexts[1],sibling);
});
await check('A06-C07-CONTEXT-PRESERVE-ANCHOR-AND-TARGET-REFUSED',async()=>{
  for(const preferences of [{...seeded.preferences,anchors:[first.contextOccurrenceId]}, {...seeded.preferences,flexibility:{[first.contextOccurrenceId]:'PRESERVE'}}])
    assert.throws(()=>editShortStay({...seeded,preferences},{contextOccurrenceId:first.contextOccurrenceId,fields:{label:'Change'}}),/LOCKED/);
  assert.throws(()=>editShortStay(seeded,{contextOccurrenceId:uuid(96999),fields:{label:'Change'}}),/TARGET_INVALID/);
  assert(componentId(first.contextOccurrenceId,'lodging',lodging.selectionId));
});
await check('A06-C08-LEGACY-AND-MOBILITY-UNCHANGED-BY-STAY-FIELDS',async()=>{
  const legacy={...lodging,quantity:'3',cost:{kind:'MANUAL',unitAmount:'20.00'}};delete legacy.lodgingPricing;
  const transport={selectionId:uuid(96031),kind:'MOBILITY_INTENT',optionKey:'free',provenance:'EXPLICIT_USER_DECISION',origin:null,destination:null,returnRequired:true};
  const draft={...seeded,contexts:[{...first,slotSelections:{lodging:{items:[legacy]},transport:{items:[transport]}}},sibling]};
  const before=compile(draft).financialAdapterInput;
  const model=await request(draft,{kind:'EDIT_SHORT_STAY',edit:{contextOccurrenceId:first.contextOccurrenceId,fields:{label:'Week-end renommé'}}});
  assert.deepEqual(model.semanticState.contexts[0].slotSelections,draft.contexts[0].slotSelections);
  assert.deepEqual(compile(model.semanticState).financialAdapterInput,before);
  assert.equal(compile(model.semanticState).components.find(c=>c.contextOccurrenceId===first.contextOccurrenceId&&c.label===lodging.label).evaluation.economicAmount,'60.00');
});
const target=(model,id=first.contextOccurrenceId)=>model.semanticState.contexts.find(c=>c.contextOccurrenceId===id);
const suggestions=(model,id)=>{
  const context=target(model,id);
  return shortStaySuggestions(context,model,shortStayTransportModes(context,model));
};
const withStay=changes=>({...seeded,contexts:[{...first,...changes},sibling]});
const extra=(id,label,unitAmount)=>({selectionId:uuid(id),optionKey:'extra',kind:'COMPONENT',provenance:'EXPLICIT_USER_DECISION',
  label,quantity:'1',unitBasis:'ITEM',cost:{kind:'MANUAL',unitAmount}});
await check('A06-S01-SUGGESTIONS-FOLLOW-LODGING-AND-CALENDAR',async()=>{
  const missing=await request(withStay({fields:{...first.fields,plannedDate:null,endDate:null},slotSelections:{}}));
  assert.deepEqual(suggestions(missing).map(({kind})=>kind),['LODGING','DEPARTURE']);
  assert.equal(suggestions(missing)[0].selectionId,undefined);
  const m=await request(seeded), candidates=suggestions(m);
  assert.equal(candidates[0].selectionId,lodging.selectionId);
  assert.deepEqual(candidates.filter(c=>c.kind==='REVIEW_EXTRA').map(c=>c.visualConceptId),['v22-art:excel:479','v22-art:excel:483']);
  assert.deepEqual(compile(m.semanticState).financialAdapterInput,financial);
  const nightly={...lodging,lodgingPricing:{version:'lodging-pricing@v1',basis:'PER_NIGHT',nightCount:null}};
  const incomplete=await request(withStay({fields:{...first.fields,nightCount:null,endDate:null},slotSelections:{lodging:{items:[nightly]}}}));
  assert.deepEqual(suggestions(incomplete).slice(0,3).map(({kind})=>kind),['NIGHTS','RETURN','LODGING']);
  assert.equal(suggestions(incomplete)[1].label,'Préciser la période');
  assert.equal(suggestions(incomplete)[1].key,suggestions(missing)[1].key);
  assert.equal(compile(incomplete.semanticState).components.find(c=>c.contextOccurrenceId===first.contextOccurrenceId).evaluation.economicAmount,null);
  assert.notEqual(suggestions(m,sibling.contextOccurrenceId)[0].key,candidates[0].key);
});
await check('A06-S02-HOMONYMS-EDIT-EXACT-LINE-WITHOUT-DOUBLING-LODGING',async()=>{
  const breakfast=extra(96041,'Petit-déjeuner','6.00'), second=extra(96042,'  PETIT DÉJEUNER  ','9.00');
  const tax=extra(96043,'Taxe de séjour','4.00');
  const onlyOne=await request(withStay({slotSelections:{...first.slotSelections,extras:{items:[breakfast,tax]}}}));
  assert.deepEqual(suggestions(onlyOne).find(c=>c.topic?.key==='breakfast')?.selectionIds,[breakfast.selectionId]);
  const m=await request(withStay({slotSelections:{...first.slotSelections,extras:{items:[breakfast,second,tax]}}}));
  const candidate=suggestions(m).find(c=>c.topic?.key==='breakfast');
  assert.equal(candidate.kind,'CHOOSE_EXTRA');
  assert.deepEqual(candidate.selectionIds,[breakfast.selectionId,second.selectionId]);
  const protectedMatch=structuredClone(m);
  protectedMatch.semanticState.preferences.anchors.push(componentId(first.contextOccurrenceId,'extras',breakfast.selectionId));
  const direct=suggestions(protectedMatch).find(c=>c.topic?.key==='breakfast');
  assert.equal(direct.kind,'EDIT_EXTRA');
  assert.deepEqual(direct.selectionIds,[second.selectionId]);
  assert.equal(suggestions(m).find(c=>c.topic?.key==='tax').kind,'EDIT_EXTRA');
  const edit={contextOccurrenceId:first.contextOccurrenceId,fields:{},slots:{extras:[breakfast,{...second,cost:{kind:'MANUAL',unitAmount:'10.00'}},tax]}};
  const operation={kind:'EDIT_SHORT_STAY',edit};
  const local=stageLocalDecision(m,m.semanticState,operation);
  const after=await request(m.semanticState,operation);
  assert.deepEqual(local,after.semanticState);
  assert.deepEqual(after.semanticState.contexts[1],sibling);
  assert.deepEqual(target(after).slotSelections.lodging.items,[lodging]);
  assert.deepEqual(target(after).slotSelections.extras.items.map(item=>[item.selectionId,item.cost.unitAmount]),
    [[breakfast.selectionId,'6.00'],[second.selectionId,'10.00'],[tax.selectionId,'4.00']]);
  assert.deepEqual(compile(after.semanticState).components.filter(c=>c.contextOccurrenceId===first.contextOccurrenceId)
    .map(c=>c.evaluation.economicAmount).sort(),['10.00','200.00','4.00','6.00']);
});
await check('A06-S03-PUBLISHED-CAPABILITIES-LOCKS-AND-STALE-TARGETS',async()=>{
  const breakfast=extra(96041,'Petit-déjeuner','6.00');
  const model=await request(withStay({slotSelections:{...first.slotSelections,extras:{items:[breakfast]}}}));
  const anchored=structuredClone(model);
  anchored.semanticState.preferences.anchors.push(first.contextOccurrenceId);
  assert.deepEqual(suggestions(anchored),[]);
  const readonly=structuredClone(model);
  readonly.board.contexts[0].readOnly=true;
  assert.deepEqual(suggestions(readonly),[]);
  const locked=structuredClone(model);
  locked.semanticState.preferences.anchors.push(componentId(first.contextOccurrenceId,'extras',breakfast.selectionId));
  assert(!suggestions(locked).some(c=>c.topic?.key==='breakfast'));
  const stale=structuredClone(model);
  stale.board.contexts[0].sockets.find(s=>s.slotKey==='extras').currentItems[0].selectionId=uuid(96999);
  assert(!suggestions(stale).some(c=>c.topic));
  const noLodging=structuredClone(model);
  noLodging.dropCapabilities=noLodging.dropCapabilities.filter(d=>d.target.slotKey!=='lodging');
  assert(!suggestions(noLodging).some(c=>c.kind==='LODGING'));
});
await check('A06-S04-MOBILITY-REQUIRES-A-PUBLISHED-EXACT-ROUTE',async()=>{
  const transport={selectionId:uuid(96031),kind:'MOBILITY_INTENT',optionKey:'free',provenance:'EXPLICIT_USER_DECISION',
    origin:null,destination:null,returnRequired:true};
  const m=await request(withStay({slotSelections:{...first.slotSelections,transport:{items:[transport]}}}));
  assert.equal(suggestions(m).find(c=>c.kind==='TRANSPORT')?.selectionId,transport.selectionId);
  const withoutRoute=structuredClone(m);
  withoutRoute.editors=withoutRoute.editors.filter(e=>e.assetKey!=='option:short-stay:transport:free');
  assert(!suggestions(withoutRoute).some(c=>c.kind==='TRANSPORT'));
  const locked=structuredClone(m);
  locked.semanticState.preferences.anchors.push(componentId(first.contextOccurrenceId,'transport',transport.selectionId));
  assert(!suggestions(locked).some(c=>c.kind==='TRANSPORT'));
  assert(!suggestions(await request(seeded)).some(c=>c.kind==='TRANSPORT'));
});
assert.deepEqual(f.world,before);assert.equal(f.writes.length,0);
console.log(JSON.stringify({status:'PASS',cases:checks.length,checks,writers:f.writes.length,worldUnchanged:true}));
