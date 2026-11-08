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
assert.deepEqual(f.world,before);assert.equal(f.writes.length,0);
console.log(JSON.stringify({status:'PASS',cases:checks.length,checks,writers:f.writes.length,worldUnchanged:true}));
