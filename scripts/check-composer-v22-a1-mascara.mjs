import assert from 'node:assert/strict';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {existsSync} from 'node:fs';
const repo=path.resolve(import.meta.dirname,'..');process.chdir(repo);
const {readMonthFixture}=await import(pathToFileURL(path.join(repo,'scripts/fixtures/composer-v22-b1.mjs')));
const {householdId,uuid}=await import(pathToFileURL(path.join(repo,'scripts/fixtures/planner-headless.mjs')));
const {require}=await import(pathToFileURL(path.join(repo,'scripts/lib/phase2-ts-loader.mjs')));
const {handleComposerRequest}=require('@/server/phase2/planner/composer-service');
const {composerLibraryIndex,filterLibraryIntentions}=require('@/domain/phase2/planner/composer-library-index');
const {presetForContext,composerPreset,presetIllustrationPath}=require('@/domain/phase2/planner/composer-presets');
const {stageLocalDecision}=require('@/app/mois-a-venir/composer/local-draft');
const {parsePlanSemanticState}=require('@/domain/phase2/planner/semantic-state');
const {evaluatePlanScenario}=require('@/server/phase2/planner/preview');
const {EquipmentComponentEditor,componentEditorValues}=require('@/app/mois-a-venir/composer/equipment-component-editor');
const {fresh,buildComponentRow}=require('@/app/mois-a-venir/composer/night-out-components');
const {beautyProductSuggestions,editBeautyProductPriceAndQuantity}=require('@/app/mois-a-venir/composer/beauty-product-edit');
const {clayBarArtwork}=require('@/app/mois-a-venir/clay-v22-media');
const React=require('react'),{renderToStaticMarkup}=require('react-dom/server');
let remote=0;globalThis.fetch=async()=>{remote++;throw Error('A1_REMOTE_FORBIDDEN');};
const f=await readMonthFixture(),worldBefore=JSON.stringify(f.world),checks=[];let sequence=0;
const run=async(name,fn)=>{await fn();checks.push(name);console.log(name+' PASS');};
const request=(model,op)=>handleComposerRequest(f.deps,householdId,{sequence:++sequence,targetMonth:'2026-11',draft:model.semanticState,...op});
const ok=r=>{assert.equal(r.ok,true,r.code+': '+r.message);return r.model;};
const id=uuid(92001),otherId=uuid(92002),selectionId=uuid(92003);
const drop={kind:'DROP',assetKey:'template:beauty-restock',presetKey:'mascara',target:{kind:'BOARD_ZONE'},values:{},identity:id,selectionId:uuid(92004)};
let model=f.model;
await run('A1-01-SEARCH-ONE-EXPLICIT-MASCARA-PRESET',()=>{
 const matches=filterLibraryIntentions(composerLibraryIndex(model).intentions,'mascara').filter(match=>match.asset.templateKey==='beauty-restock');
 assert.equal(matches.length,1);assert.equal(matches[0].preset.presetKey,'mascara');assert.equal(matches[0].asset.templateKey,'beauty-restock');
});
await run('A1-02-ONE-CONTEXT-LOCAL-SERVER-PARITY-NO-ADOPTED-PRICE',async()=>{
 const local=stageLocalDecision(model,model.semanticState,drop);model=ok(await request(model,drop));assert.deepEqual(local,model.semanticState);
 assert.equal(model.semanticState.contexts.length,1);const c=model.semanticState.contexts[0];assert.equal(c.contextOccurrenceId,id);
 assert.equal(presetForContext(c).presetKey,'mascara');assert.deepEqual(c.slotSelections,{});assert.equal(c.fields.productLabel,undefined);
 assert.equal(c.fields.participantRefs,undefined);assert.equal(model.cardKnowledge['template:beauty-restock'].dimensions[0].value,null);
 const suggestions=beautyProductSuggestions(c,model);assert.equal(suggestions.length,1);assert.equal(suggestions[0].label,'Préciser le produit');
});
await run('A1-03-REPLAY-NEVER-DUPLICATES-IDENTITY',async()=>{
 const replay=await request(model,drop);if(replay.ok)assert.equal(replay.model.semanticState.contexts.filter(c=>c.contextOccurrenceId===id).length,1);
 assert.equal(model.semanticState.contexts.length,1);
});
await run('A1-04-PRESET-TEMPLATE-MISMATCH-REFUSED',async()=>{
 const bad=await request(model,{...drop,assetKey:'template:restaurant',identity:uuid(92010)});assert.equal(bad.ok,false);
});
await run('A1-05-DATE-AND-IDENTITY-EDITS-ONLY-PUBLISHED-FIELDS',async()=>{
 model=ok(await request(model,{kind:'EDIT_CONTEXT',contextOccurrenceId:id,values:{plannedDate:'2026-11-20'}}));
 assert.equal(model.semanticState.contexts[0].fields.plannedDate,'2026-11-20');
 const bad=await request(model,{kind:'EDIT_CONTEXT',contextOccurrenceId:id,values:{participantRefs:[{kind:'TEXT',label:'Invented'}]}});assert.equal(bad.ok,false);
});
await run('A1-06-TWO-EXPLICIT-MASCARAS-ARE-NEVER-MERGED-BY-LABEL',async()=>{
 model=ok(await request(model,{...drop,identity:otherId,selectionId:uuid(92011)}));assert.equal(model.semanticState.contexts.length,2);
 const other=structuredClone(model.semanticState.contexts.find(c=>c.contextOccurrenceId===otherId));
 model=ok(await request(model,{kind:'EDIT_CONTEXT',contextOccurrenceId:id,values:{label:'Same intention renamed'}}));
 assert.deepEqual(model.semanticState.contexts.find(c=>c.contextOccurrenceId===otherId),other);
 assert.equal(presetForContext(model.semanticState.contexts.find(c=>c.contextOccurrenceId===id)).presetKey,'mascara');
});
const target={kind:'CONTEXT_SOCKET',contextOccurrenceId:id,slotKey:'products'};
await run('A1-07-PRODUCT-UNKNOWN-ONE-SELECTION',async()=>{
 model=ok(await request(model,{kind:'DROP',assetKey:'option:beauty-restock:products:product',target,identity:uuid(92012),selectionId,
 values:{label:'Synthetic mascara',quantity:'1',unitBasis:'ITEM',costMode:'UNKNOWN',amount:'',funding:'',fundingAmount:'',binding:'AUTO'}}));
 const items=model.semanticState.contexts.find(c=>c.contextOccurrenceId===id).slotSelections.products.items;
 assert.equal(items.length,1);assert.equal(items[0].selectionId,selectionId);assert.equal(items[0].cost.kind,'UNKNOWN');
 const c=model.semanticState.contexts.find(c=>c.contextOccurrenceId===id);
 const suggestions=beautyProductSuggestions(c,model);
 assert.equal(suggestions.length,1);assert.equal(suggestions[0].route.selection.selectionId,selectionId);
 assert.equal(suggestions[0].label,'Préciser le prix du produit');
 const missingRoute={...model,dropCapabilities:model.dropCapabilities.filter(drop=>drop.target.contextOccurrenceId!==id)};
 assert.deepEqual(beautyProductSuggestions(c,missingRoute),[]);
 const preview=evaluatePlanScenario(f.world,model.semanticState,{expectedActiveRevisionId:null,expectedActiveRevisionNumber:0});
 assert.equal(preview.compiled.components.find(c=>c.contextOccurrenceId===id).evaluation.economicAmount,null);
});
await run('A1-08-EXPLICIT-ZERO-IS-NOT-UNKNOWN-IDENTITY-PRESERVED',async()=>{
 const c=model.semanticState.contexts.find(c=>c.contextOccurrenceId===id),item=c.slotSelections.products.items[0];
 model=ok(await request(model,{kind:'MUTATE',mutation:{kind:'PATCH_CONTEXT',contextOccurrenceId:id,slotKey:'products',items:[{...item,cost:{kind:'MANUAL',unitAmount:'0.00'}}]}}));
 const changed=model.semanticState.contexts.find(c=>c.contextOccurrenceId===id);assert.deepEqual(changed.fields,c.fields);
 assert.equal(changed.slotSelections.products.items[0].selectionId,selectionId);
 const preview=evaluatePlanScenario(f.world,model.semanticState,{expectedActiveRevisionId:null,expectedActiveRevisionNumber:0});
 assert.equal(preview.compiled.components.find(c=>c.contextOccurrenceId===id).evaluation.economicAmount,'0.00');
});
await run('A1-09-PRODUCT-NAME-QUANTITY-PRICE-EDITS-ONLY-OWN-SELECTION',async()=>{
 const c=model.semanticState.contexts.find(c=>c.contextOccurrenceId===id),item=c.slotSelections.products.items[0],other=structuredClone(model.semanticState.contexts.find(c=>c.contextOccurrenceId===otherId));
 const priced=editBeautyProductPriceAndQuantity(item,'2','12,50','MANUAL');
 model=ok(await request(model,{kind:'MUTATE',mutation:{kind:'PATCH_CONTEXT',contextOccurrenceId:id,slotKey:'products',items:[{...priced,label:'Synthetic named product'}]}}));
 const updated=model.semanticState.contexts.find(c=>c.contextOccurrenceId===id);assert.equal(updated.slotSelections.products.items.length,1);
 assert.equal(updated.slotSelections.products.items[0].selectionId,selectionId);assert.deepEqual(updated.fields,c.fields);
 assert.equal(updated.slotSelections.products.items[0].needOccurrenceId,undefined);
 assert.equal(beautyProductSuggestions(updated,model)[0].label,'Modifier prix et quantité');
 assert.deepEqual(model.semanticState.contexts.find(c=>c.contextOccurrenceId===otherId),other);
 const preview=evaluatePlanScenario(f.world,model.semanticState,{expectedActiveRevisionId:null,expectedActiveRevisionNumber:0});
 assert.equal(preview.compiled.components.find(c=>c.contextOccurrenceId===id).evaluation.economicAmount,'25.00');
});
await run('A1-10-INVALID-PRICE-AND-QUANTITY-REFUSED',async()=>{
 const item=model.semanticState.contexts.find(c=>c.contextOccurrenceId===id).slotSelections.products.items[0];
 for(const changed of [{...item,quantity:'0'},{...item,cost:{kind:'MANUAL',unitAmount:'-1'}}]){
  const bad=await request(model,{kind:'MUTATE',mutation:{kind:'PATCH_CONTEXT',contextOccurrenceId:id,slotKey:'products',items:[changed]}});assert.equal(bad.ok,false);
 }
});
await run('A1-S01-CONSULT-ONLY-AN-EXISTING-PUBLISHED-NEED',()=>{
 const linked=structuredClone(model),context=linked.semanticState.contexts.find(c=>c.contextOccurrenceId===id);
 const needId=uuid(92901);
 context.slotSelections.products.items[0].needOccurrenceId=needId;
 assert(!beautyProductSuggestions(context,linked).some(candidate=>candidate.kind==='NEED'));
 const editor=linked.editors.find(e=>e.assetKey==='option:beauty-restock:products:product');
 const needs=editor.fields.find(field=>field.key==='needOccurrenceId');
 assert(needs);
 needs.choices.push({value:needId,label:'Besoin synthétique publié'});
 const before=JSON.stringify(linked);
 assert.equal(beautyProductSuggestions(context,linked).find(candidate=>candidate.kind==='NEED')?.caption,'Besoin synthétique publié');
 assert.equal(JSON.stringify(linked),before);
});
await run('A1-11-REFERENCE-PRICE-DOES-NOT-PREFILL-OR-ADOPT-ITSELF',()=>{
 const dim=model.cardKnowledge['template:beauty-restock'].dimensions[0];
 const knowledge={...model.cardKnowledge['template:beauty-restock'],dimensions:[{...dim,value:'88.00',evidenceState:'PARTIAL',suggestionPolicy:'OFFER_PREFILL',sourceAuthority:'SYNTHETIC_REFERENCE_ONLY',coverageFrom:'2026-01',coverageTo:'2026-06'}]};
 const asset=model.library.searchableAssets.find(a=>a.assetKey==='option:beauty-restock:products:product');
 const markup=renderToStaticMarkup(React.createElement(EquipmentComponentEditor,{asset,target,model,values:{},knowledge,busy:false,onValues(){throw Error('Unexpected adoption');},onSave(){throw Error('Unexpected adoption');},onSummary(){}}));
 assert.match(markup,/Prix observé/);assert.match(markup,/88\.00/);
 const priceInput=markup.match(/<input[^>]*placeholder="Encore inconnu"[^>]*>/)?.[0];assert(priceInput);assert.match(priceInput,/value=""/);
 assert.match(markup,/Coût à préciser/);
});
await run('A1-12-ROUNDTRIP-WORLD-IMMUTABLE-NO-WRITER-SQL-REMOTE',()=>{
 assert.deepEqual(parsePlanSemanticState(JSON.parse(JSON.stringify(model.semanticState))),model.semanticState);
 assert.equal(JSON.stringify(f.world),worldBefore);assert.deepEqual(f.writes,[]);assert.equal(remote,0);
});
await run('A1-13-FIRST-PRODUCT-FRENCH-PRICE-MATCHES-CANONICAL-COMPONENT',async()=>{
 for(const [index,input] of ['12,50',' 12,50 ','12.50','0','UNKNOWN'].entries()){
  const owner=uuid(92050+index*10),sid=uuid(92051+index*10),created=ok(await request(f.model,{...drop,identity:owner,selectionId:uuid(92052+index*10)}));
  const row={...fresh('Synthetic mascara'),quantity:'2',costMode:input==='UNKNOWN'?'UNKNOWN':'MANUAL',amount:input==='UNKNOWN'?'12,50':input};
  const component=buildComponentRow(row,'product'),values=componentEditorValues(row,{});
  const result=await request(created,{kind:'DROP',assetKey:'option:beauty-restock:products:product',target:{...target,contextOccurrenceId:owner},identity:uuid(92053+index*10),selectionId:sid,values});
  const next=ok(result),item=next.semanticState.contexts.find(c=>c.contextOccurrenceId===owner).slotSelections.products.items[0];
  assert.deepEqual(item.cost,component.cost);assert.equal(item.quantity,component.quantity);assert.equal(item.selectionId,sid);
  assert.equal(next.semanticState.contexts.length,1);assert.equal(row.amount,input==='UNKNOWN'?'12,50':input);
  if(input==='UNKNOWN')assert.equal(item.cost.kind,'UNKNOWN');
  else assert.equal(values.amount,input.trim().replace(',','.'));
 }
});
await run('A1-14-BAR-AND-RESTAURANT-PRESETS-LOCAL-SERVER-PARITY',async()=>{
 const {COMPOSER_PRESETS}=require('@/domain/phase2/planner/composer-presets');
 for(const [index,preset] of [COMPOSER_PRESETS.find(p=>p.presetKey==='bar-apero'),COMPOSER_PRESETS.find(p=>p.templateKey==='restaurant')].entries()){
  assert(preset);const operation={...drop,assetKey:'template:'+preset.templateKey,presetKey:preset.presetKey,identity:uuid(92100+index),selectionId:uuid(92110+index)};
  const next=ok(await request(f.model,operation));assert.deepEqual(stageLocalDecision(f.model,f.model.semanticState,operation),next.semanticState);
  assert.equal(next.semanticState.contexts.length,1);assert.equal(presetForContext(next.semanticState.contexts[0]).presetKey,preset.presetKey);
  assert.deepEqual(next.semanticState.contexts[0].slotSelections,{});
  const slotKey=preset.templateKey==='restaurant'?'meal':'extras',optionKey=preset.templateKey==='restaurant'?'restaurant':'extra';
  const row={...fresh('Synthetic regression component'),costMode:'MANUAL',amount:'12,50'};
  const component=buildComponentRow(row,optionKey),values=componentEditorValues(row,{}),sid=uuid(92120+index);
  const withComponent=ok(await request(next,{kind:'DROP',assetKey:`option:${preset.templateKey}:${slotKey}:${optionKey}`,
   target:{kind:'CONTEXT_SOCKET',contextOccurrenceId:operation.identity,slotKey},identity:uuid(92130+index),selectionId:sid,values}));
  const item=withComponent.semanticState.contexts[0].slotSelections[slotKey].items[0];
  assert.deepEqual(item.cost,component.cost);assert.equal(item.selectionId,sid);
  assert.equal(withComponent.semanticState.contexts.length,1);
 }
 assert.equal(JSON.stringify(f.world),worldBefore);assert.deepEqual(f.writes,[]);assert.equal(remote,0);
});
await run('P21-BEAUTY-REUSE-EXACT-OWNER-AND-CLAY',async()=>{
 const presets=['eyeliner','eyebrow-pencil','hair-wax','face-cleanser','makeup-remover','facial-toner','face-serum','face-moisturizer','care-lotion'];
 for(const [index,presetKey] of presets.entries()){
  const owner=uuid(93000+index*10), sid=uuid(93001+index*10);
  const next=ok(await request(f.model,{...drop,presetKey,identity:owner,selectionId:uuid(93002+index*10)}));
  const context=next.semanticState.contexts.find(row=>row.contextOccurrenceId===owner);
  const suggestions=beautyProductSuggestions(context,next);
  assert.equal(suggestions.length,1);
  assert.equal(suggestions[0].route.target.contextOccurrenceId,owner);
  assert(clayBarArtwork(suggestions[0].catalogAssetKey) || existsSync(path.join(repo,'public',presetIllustrationPath(composerPreset(suggestions[0].presetArtwork)))));
  const chosen=ok(await request(next,{kind:'DROP',assetKey:suggestions[0].route.asset.assetKey,target:suggestions[0].route.target,
   identity:uuid(93003+index*10),selectionId:sid,values:{label:'Produit de recette',quantity:'1',costMode:'UNKNOWN'}}));
  const adopted=chosen.semanticState.contexts.find(row=>row.contextOccurrenceId===owner);
  assert.equal(adopted.slotSelections.products.items[0].cost.kind,'UNKNOWN');
  assert.equal(beautyProductSuggestions(adopted,chosen)[0].route.selection.selectionId,sid);
 }
 assert.deepEqual(f.writes,[]);
});
const evidence={status:'PASS',level:'SYNTHETIC_MEMORY_ACTUAL_COMPOSER_AND_COMPILER',checks,sql:0,remote,writers:f.writes.length,apply:false,persistence:false};
console.log(JSON.stringify(evidence));
console.log('A1 '+checks.length+'/'+checks.length+' PASS · SQL=0 remote=0 writers=0 · no Apply');
