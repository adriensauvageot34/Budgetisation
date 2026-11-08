import assert from 'node:assert/strict';
import {require} from './lib/phase2-ts-loader.mjs';
import {readMonthFixture} from './fixtures/composer-v22-b1.mjs';
import {uuid,householdId} from './fixtures/planner-headless.mjs';
const {handleComposerRequest}=require('@/server/phase2/planner/composer-service');
const {evaluatePlanScenario}=require('@/server/phase2/planner/preview');
const {editGuidedContext}=require('@/domain/phase2/planner/guided-context-edit');
const {presetCreationFields}=require('@/domain/phase2/planner/composer-presets');
const {clothingItemWritable,isClothingPurchase,libraryOccurrences,filterLibraryIntentions,librarySearchAction}=require('@/domain/phase2/planner/composer-library-index');
globalThis.fetch=async()=>{throw Error('A07_REMOTE_FORBIDDEN');};
const f=await readMonthFixture(),world=structuredClone(f.world),checks=[];
const component=(id,label,amount)=>({selectionId:uuid(id),optionKey:'item',kind:'COMPONENT',provenance:'EXPLICIT_USER_DECISION',label,
 quantity:'1',unitBasis:'ITEM',cost:amount===null?{kind:'UNKNOWN'}:{kind:'MANUAL',unitAmount:amount},fundingAllocations:[],binding:{mode:'NO_RELATED_SLOT'}});
const purchase=(id,preset,item)=>({contextOccurrenceId:uuid(id),templateKey:'purchase',status:'ACTIVE',parentContextOccurrenceId:null,
 fields:{fieldSchemaVersion:'context-fields@v2',...presetCreationFields('purchase',preset)},slotSelections:{item:{items:[item]}},provenance:'EXPLICIT_USER_DECISION'});
const first=purchase(97001,'clothing-shopping',component(97011,'T-shirt','20.00'));
first.slotSelections.extras={items:[{...component(97021,'Livraison','4.00'),optionKey:'extra'}]};
const sibling=purchase(97002,'clothing-shopping',component(97012,'T-shirt',null));
const amazon=purchase(97003,'amazon-purchase',component(97013,'T-shirt','30.00'));
export const seeded={...f.semantic,contexts:[first,sibling,amazon]};
const read=async(draft,operation={kind:'READ'})=>{const r=await handleComposerRequest(f.deps,householdId,{sequence:0,targetMonth:'2026-11',draft,...operation});assert(r.ok,r.code);return r.model;};
const compile=draft=>evaluatePlanScenario(f.world,draft,{expectedActiveRevisionId:null,expectedActiveRevisionNumber:0}).compiled;
const check=async(name,run)=>{await run();checks.push(name);console.log(name+' PASS');};
const model=await read(seeded),card=m=>m.board.contexts.find(c=>c.contextOccurrenceId===first.contextOccurrenceId),item=first.slotSelections.item.items[0];
await check('A07-C01-OWNER-EXACT-SEARCH-HOMONYMS-NO-AUTO-ADD',async()=>{
 assert(isClothingPurchase(first));assert(!isClothingPurchase(amazon));assert(clothingItemWritable(model,first,card(model)));
 const rows=filterLibraryIntentions(libraryOccurrences(model),'T-shirt');
 const clothing=rows.filter(row=>row.presetKey==='clothing-shopping');assert.equal(clothing.length,2);
 assert(clothing.every(row=>row.action==='EDIT'));assert.deepEqual(librarySearchAction([],clothing,'T-shirt'),{kind:'FOCUS'});
 const named={...seeded,contexts:[{...first,fields:{...first.fields,productLabel:'Crop-top synthétique'}},sibling,amazon]};
 const found=filterLibraryIntentions(libraryOccurrences(await read(named)),'Crop-top synthétique');assert.equal(found.length,1);assert.equal(found[0].contextOccurrenceId,first.contextOccurrenceId);
 const mismatched=structuredClone(model),mismatchedCard=mismatched.board.contexts.find(c=>c.contextOccurrenceId===amazon.contextOccurrenceId);
 mismatchedCard.fields={...mismatchedCard.fields,...presetCreationFields('purchase','clothing-shopping')};
 assert(!libraryOccurrences(mismatched).some(row=>row.contextOccurrenceId===amazon.contextOccurrenceId));
});
await check('A07-C02-QUANTITY-SAME-IDS-SINGLE-COMPILER-CONTRIBUTION',async()=>{
 const next=await read(seeded,{kind:'EDIT_PRESET_CONTEXT',edit:{contextOccurrenceId:first.contextOccurrenceId,slots:{item:[{...item,quantity:'3'}]}}});
 const changed=next.semanticState.contexts[0];assert.equal(changed.contextOccurrenceId,first.contextOccurrenceId);
 assert.equal(changed.slotSelections.item.items[0].selectionId,item.selectionId);assert.deepEqual(changed.slotSelections.extras,first.slotSelections.extras);
 assert.deepEqual(next.semanticState.contexts.slice(1),seeded.contexts.slice(1));
 const before=compile(seeded),after=compile(next.semanticState);assert.equal(after.components.length,before.components.length);
 assert.equal(after.components.find(c=>c.contextOccurrenceId===first.contextOccurrenceId&&c.label==='T-shirt').evaluation.economicAmount,'60.00');
});
await check('A07-C03-UNKNOWN-ZERO-AND-QUOTE-REMAIN-DISTINCT',async()=>{
 for(const [cost,amount] of [[{kind:'UNKNOWN'},null],[{kind:'MANUAL',unitAmount:'0.00'},'0.00'],[{kind:'QUOTE',quoteKey:'synthetic-clothing-quote'},null]]){
  const next=await read(seeded,{kind:'EDIT_PRESET_CONTEXT',edit:{contextOccurrenceId:first.contextOccurrenceId,slots:{item:[{...item,cost}]}}});
  assert.deepEqual(next.semanticState.contexts[0].slotSelections.item.items[0].cost,cost);
  assert.equal(compile(next.semanticState).components.find(c=>c.contextOccurrenceId===first.contextOccurrenceId&&c.label==='T-shirt').evaluation.economicAmount,amount);
 }
});
await check('A07-C04-SIZE-SKU-STOCK-BRAND-AND-SECOND-ITEM-REFUSED',async()=>{
 for(const key of ['size','sku','stock','brand'])assert.throws(()=>editGuidedContext(seeded,{contextOccurrenceId:first.contextOccurrenceId,fields:{[key]:'synthetic'}}),/FIELD_INVALID/);
 assert.throws(()=>editGuidedContext(seeded,{contextOccurrenceId:first.contextOccurrenceId,slots:{item:[item,{...item,selectionId:uuid(97999)}]}}),/SLOT_INVALID/);
});
await check('A07-C05-PRESERVE-ANCHOR-AND-OTHER-OWNER-REFUSED',async()=>{
 for(const preferences of [{...seeded.preferences,anchors:[first.contextOccurrenceId]},{...seeded.preferences,flexibility:{[first.contextOccurrenceId]:'PRESERVE'}}])
  assert.throws(()=>editGuidedContext({...seeded,preferences},{contextOccurrenceId:first.contextOccurrenceId,slots:{item:[{...item,quantity:'2'}]}}),/LOCKED/);
 const other={...first,templateKey:'beauty-restock'};assert(!isClothingPurchase(other));assert(!clothingItemWritable(model,other,card(model)));
});
await check('A07-C06-REFERENCE-AND-DROP-ABSENCE-DO-NOT-INVENT-A-PRODUCT',async()=>{
 const missing={...model,library:{...model.library,searchableAssets:model.library.searchableAssets.filter(a=>a.assetKey!=='option:purchase:item:item')}};
 assert(!clothingItemWritable(missing,first,card(missing)));
 const noDrop={...model,dropCapabilities:model.dropCapabilities.filter(d=>d.sourceAssetKey!=='option:purchase:item:item')};
 assert(!clothingItemWritable(noDrop,first,card(noDrop)));assert.deepEqual(first.slotSelections.item.items[0].cost,{kind:'MANUAL',unitAmount:'20.00'});
});
await check('A07-C07-LABEL-EDIT-RETURNS-TO-SAME-OCCURRENCE',async()=>{
 const next=await read(seeded,{kind:'EDIT_PRESET_CONTEXT',edit:{contextOccurrenceId:first.contextOccurrenceId,slots:{item:[{...item,label:'Jean synthétique'}]}}});
 const found=filterLibraryIntentions(libraryOccurrences(next),'Jean synthétique');assert.equal(found.length,1);assert.equal(found[0].contextOccurrenceId,first.contextOccurrenceId);
 assert.deepEqual(compile(next.semanticState).components.map(c=>c.evaluation.economicAmount),compile(seeded).components.map(c=>c.evaluation.economicAmount));
 assert.deepEqual(next.semanticState.contexts[0].fields,first.fields);
});
await check('A07-C08-READ-IS-FINANCIALLY-NEUTRAL-NO-WRITER',async()=>{
 assert.deepEqual(compile((await read(seeded)).semanticState).financialAdapterInput,compile(seeded).financialAdapterInput);
 assert.deepEqual(f.world,world);assert.equal(f.writes.length,0);
});
console.log(JSON.stringify({status:'PASS',cases:checks.length,checks,writers:0,worldUnchanged:true}));
