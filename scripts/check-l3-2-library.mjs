// Real Composer/Compiler/Finance V2; isolated PGlite only, all remote IO forbidden.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {require} from './lib/phase2-ts-loader.mjs';
import {createKernelPostgres} from './lib/planner-kernel-postgres.mjs';
import {fixture,state,uuid,householdId} from './fixtures/planner-headless.mjs';
const {COMPOSER_PRESETS,presetForContext,presetCreationFields,presetIllustrationPath}=require('@/domain/phase2/planner/composer-presets');
const {composerLibraryIndex,filterLibraryIntentions,libraryPresetGroup}=require('@/domain/phase2/planner/composer-library-index');
const {handleComposerRequest}=require('@/server/phase2/planner/composer-service');
const {createPlanApplyRepository}=require('@/server/phase2/planner/repository');
const {stageLocalDecision}=require('@/app/mois-a-venir/composer/local-draft');
const {parsePlanSemanticState,semanticStateDigest}=require('@/domain/phase2/planner/semantic-state');
const {previewPlanScenario}=require('@/server/phase2/planner/apply');
const {resolveEffectiveMonthScenario}=require('@/server/phase2/planner/effective-month-scenario');
const {displayEquipmentGroups}=require('@/app/mois-a-venir/composer/presentation/palette-groups');
const React=require('react'),{renderToStaticMarkup}=require('react-dom/server');
const {ComposerLibrary}=require('@/app/mois-a-venir/composer/composer-library');
const {AppliedMonthView}=require('@/app/mois-a-venir/applied-month-view');
const evidence='docs/status/evidence/l3-2-composer-library';fs.mkdirSync(evidence,{recursive:true});
globalThis.fetch=async()=>{throw Error('L32_REMOTE_FORBIDDEN');};
const pg=await createKernelPostgres(),world=fixture(),worldBefore=structuredClone(world);
const deps={repository:createPlanApplyRepository(pg.client),readWorld:async()=>world,householdPersons:[],
 readDirectWorld:async()=>({forecast:world.forecast,monthInputs:world.monthInputs,externalIntents:world.externalIntents,asOfDate:world.asOfDate}),
 validateContextReferences:async(_h,refs)=>{assert.equal(refs.personIds.length,0);assert.equal(refs.placeIds.length,0);}};
let sequence=0;const request=(operation,draft)=>handleComposerRequest(deps,householdId,{sequence:++sequence,targetMonth:'2026-11',draft,...operation});
const ok=r=>{assert.equal(r.ok,true,r.code+': '+r.message);return r.model;};
const checks=[],coverage=[];const check=async(name,fn)=>{await fn();checks.push(name);console.log(name+' PASS');};
const historical=new Set([...JSON.parse(fs.readFileSync('docs/status/evidence/l2a-composer-presets/illustrations.json','utf8')),...JSON.parse(fs.readFileSync('docs/status/evidence/l2b-composer-library/illustrations.json','utf8'))].map(p=>p.presetKey));
const added=COMPOSER_PRESETS.filter(p=>!historical.has(p.presetKey));
const shapes={activity:['main','activity'],gift:['item','gift'],purchase:['item','item'],'beauty-restock':['products','product'],'short-stay':['lodging','lodging']};
const selection=(id,key,label,amount)=>({selectionId:id,optionKey:key,kind:'COMPONENT',provenance:'EXPLICIT_USER_DECISION',label,quantity:'1',unitBasis:'SHARED',cost:amount===null?{kind:'UNKNOWN'}:{kind:'MANUAL',unitAmount:amount},fundingAllocations:[],binding:{mode:'NO_RELATED_SLOT'}});
try{
const initial=ok(await request({kind:'READ'},state())),index=composerLibraryIndex(initial);
await check('L32-CATALOG-47-13-HISTORICAL-26-AND-COMPATIBILITY',()=>{
 assert.equal(added.length,21);assert.equal(COMPOSER_PRESETS.length,47);assert.equal(index.intentions.filter(i=>!i.preset).length,13);
 const previous=execFileSync('git',['show','3bde89c:src/domain/phase2/planner/composer-presets.ts'],{encoding:'utf8'});
 for(const key of historical){assert.ok(COMPOSER_PRESETS.some(p=>p.presetKey===key));assert.ok(previous.includes('presetKey: "'+key+'"'));}
 const future={templateKey:'purchase',fields:{composerPresentation:{version:'composer-context-presentation@v1',presetKey:'future-compatible'}}};assert.equal(presetForContext(future),undefined);
 assert.equal(presetForContext({templateKey:'purchase',fields:{}}),undefined);assert.throws(()=>presetCreationFields('purchase','concert'),/MISMATCH/);
 const html=renderToStaticMarkup(React.createElement(ComposerLibrary,{model:initial,openToken:0,busy:false,selected:null,choose(){},choosePreset(){},drag(){},inspectContext(){}}));
 assert.equal((html.match(/data-preset=/g)||[]).length,6);assert.ok(html.includes('Autre intention'));assert.ok(!html.includes('data-asset="template:night-out"'));
 assert.ok(!html.includes('Ma voiture')&&!html.includes('>Santé<'));assert.equal(libraryPresetGroup(COMPOSER_PRESETS.find(p=>p.presetKey==='shein-purchase')),'Acheter chez…');
 assert.equal(libraryPresetGroup(COMPOSER_PRESETS.find(p=>p.presetKey==='clothing-shopping')),'Choisir un achat');
});
await check('L32-SEARCH-EXACT-SYNONYMS-AND-ALL-GENERICS',()=>{
 for(const [query,key] of [['éponge','sponges'],['sacs poubelle','trash-bags'],['sac-poubelle','trash-bags'],['lave-vaisselle','dishwasher-tablets'],['serpillière','floor-cleaner'],['crème visage','face-moisturizer'],['crayon sourcil','eyebrow-pencil'],['toner','facial-toner'],['cadeau','gift-present'],['hôtel','hotel-night'],['soirée libre','template:night-out']]){
  const found=filterLibraryIntentions(index.intentions,query);assert.ok(found.some(i=>i.preset?.presetKey===key||i.key===key),query);if(['éponge','toner','cadeau','sacs poubelle','lave-vaisselle'].includes(query))assert.equal(found[0].preset?.presetKey,key,query);
 }
 for(const item of index.intentions.filter(i=>!i.preset)) assert.ok(filterLibraryIntentions(index.intentions,item.label).some(i=>i.key===item.key));
 assert.equal(index.intentions.filter(i=>i.label==='Voir des amis').length,1);
});
const contexts=[];
for(const [i,preset]of added.entries()){
 await check(preset.presetKey+'-ADMISSION-IDENTITY-EDIT-ROUNDTRIP',async()=>{
  const id=uuid(35000+i),op={kind:'DROP',assetKey:'template:'+preset.templateKey,presetKey:preset.presetKey,target:{kind:'BOARD_ZONE'},values:{},identity:id,selectionId:uuid(35100+i)};
  const created=ok(await request(op,state()));assert.deepEqual(stageLocalDecision(initial,initial.semanticState,op),created.semanticState);
  const c=created.semanticState.contexts.find(c=>c.contextOccurrenceId===id);assert.equal(presetForContext(c).presetKey,preset.presetKey);assert.deepEqual(c.slotSelections,{});
  for(const field of ['plannedDate','participantRefs','recipientRef','personVisitedRef','placeRef','nightCount'])assert.equal(c.fields[field],undefined);
  assert.equal(JSON.stringify(c).includes('productAssetRef'),false);
  if(preset.templateKey==='beauty-restock') assert.equal(c.fields.productLabel,undefined); // Intent label is not a certified selected product.
  if(preset.categoryKey==='HOME')assert.equal(c.fields.productLabel,preset.defaults.productLabel);
  if(preset.presetKey==='hotel-night')assert.equal(c.fields.lodgingKind,'HOTEL');
  if(preset.presetKey==='stay-with-relatives')assert.equal(c.fields.lodgingKind,'RELATIVE');
  const [slot,option]=shapes[preset.templateKey],item=selection(uuid(35200+i),option,'Produit explicitement choisi '+preset.label,null);
  const withProduct=ok(await request({kind:'MUTATE',mutation:{kind:'PATCH_CONTEXT',contextOccurrenceId:id,slotKey:slot,items:[item]}},created.semanticState));
  const partial=ok(await request({kind:'MUTATE',mutation:{kind:'PATCH_CONTEXT',contextOccurrenceId:id,slotKey:slot,items:[{...item,cost:{kind:'MANUAL',unitAmount:'40.00'}}]}},withProduct.semanticState));
  const changed=partial.semanticState.contexts.find(c=>c.contextOccurrenceId===id);assert.deepEqual(changed.fields,c.fields);assert.equal(changed.slotSelections[slot].items[0].selectionId,item.selectionId);
  const restored=parsePlanSemanticState(JSON.parse(JSON.stringify(partial.semanticState)));assert.equal(semanticStateDigest(restored),semanticStateDigest(partial.semanticState));
  assert.equal(presetForContext({...changed,fields:{...changed.fields,label:'Renommé'}}).presetKey,preset.presetKey);
  assert.deepEqual(parsePlanSemanticState(JSON.parse(JSON.stringify(created.semanticState))),created.semanticState); // Undo snapshot.
  assert.deepEqual(parsePlanSemanticState(JSON.parse(JSON.stringify(partial.semanticState))),partial.semanticState); // Redo snapshot.
  contexts.push(changed);coverage.push({presetKey:preset.presetKey,templateKey:preset.templateKey,defaults:preset.defaults,identity:id,selectionId:item.selectionId,unknownPriceAccepted:true,serverLocalParity:true,roundTrip:true});
 });
}
const semantic=parsePlanSemanticState({...state(),contexts});
await check('L32-BATCH-FINANCE-PARITY-UNKNOWN-ZERO-NO-DOUBLE-COUNT',async()=>{
 const manual=parsePlanSemanticState({...semantic,contexts:contexts.map(c=>{const fields={...c.fields};delete fields.composerPresentation;return {...c,fields};})});
 const a=await previewPlanScenario(deps,householdId,semantic),b=await previewPlanScenario(deps,householdId,manual);
 assert.deepEqual(a.scenario,b.scenario);assert.deepEqual(a.compiled.components,b.compiled.components);assert.deepEqual(a.compiled.journeyPrices,b.compiled.journeyPrices);
 assert.equal(a.compiled.components.length,21);assert.ok(a.compiled.components.every(c=>c.evaluation.economicAmount==='40.00'));assert.equal(a.compiled.mobilityIntents.length,0);
 const unknown=parsePlanSemanticState({...semantic,contexts:contexts.map(c=>({...c,slotSelections:Object.fromEntries(Object.entries(c.slotSelections).map(([k,v])=>[k,{items:v.items.map(item=>({...item,cost:{kind:'UNKNOWN'}}))}]))}))});
 const u=await previewPlanScenario(deps,householdId,unknown);assert.ok(u.compiled.components.every(c=>c.evaluation.economicAmount===null));
 const zero=parsePlanSemanticState({...unknown,contexts:unknown.contexts.map(c=>({...c,slotSelections:Object.fromEntries(Object.entries(c.slotSelections).map(([k,v])=>[k,{items:v.items.map(item=>({...item,cost:{kind:'MANUAL',unitAmount:'0.00'}}))}]))}))});
 assert.ok((await previewPlanScenario(deps,householdId,zero)).compiled.components.every(c=>c.evaluation.economicAmount==='0.00'));
});
await check('L32-APPLY-RELOAD-MONPLAN-REEDIT-ISOLATED',async()=>{
 const ready=ok(await request({kind:'READ'},semantic));const applied=await request({kind:'APPLY',command:{...ready.proof,applyRequestId:uuid(35900)}},ready.semanticState);assert.equal(applied.ok,true,applied.code+': '+applied.message);
 const reload=ok(await request({kind:'READ'}));assert.deepEqual(reload.semanticState,ready.semanticState);
 const effective=await resolveEffectiveMonthScenario(deps,householdId,'2026-11');const html=renderToStaticMarkup(React.createElement(AppliedMonthView,{projection:effective.projection,semanticState:effective.semanticState,plan:null,revision:1,today:world.asOfDate,persons:[],composerHref:'/composer'}));
 for(const p of added){const c=reload.semanticState.contexts.find(c=>presetForContext(c)?.presetKey===p.presetKey);assert.ok(c);assert.ok(html.includes(p.label.replaceAll('’','&#x27;'))||html.includes(p.label));const edit=stageLocalDecision(reload,reload.semanticState,{kind:'EDIT_CONTEXT',contextOccurrenceId:c.contextOccurrenceId,values:{label:'Réédition conservée'}});const changed=edit.contexts.find(x=>x.contextOccurrenceId===c.contextOccurrenceId);assert.deepEqual(changed.slotSelections,c.slotSelections);assert.equal(presetForContext(changed).presetKey,p.presetKey);}
});
await check('L32-ART-HISTORICAL-BYTES-AND-21-NATIVE-ORIGINALS',()=>{
 const art=JSON.parse(fs.readFileSync(evidence+'/illustrations.json','utf8')),old=[...JSON.parse(fs.readFileSync('docs/status/evidence/l2a-composer-presets/illustrations.json','utf8')),...JSON.parse(fs.readFileSync('docs/status/evidence/l2b-composer-library/illustrations.json','utf8'))];assert.equal(art.length,21);
 const hashes=[];for(const p of COMPOSER_PRESETS){const bytes=fs.readFileSync('public'+presetIllustrationPath(p)),hash=crypto.createHash('sha256').update(bytes).digest('hex');assert.equal([...old,...art].find(a=>a.presetKey===p.presetKey).sha256,hash);assert.equal(bytes.readUInt16LE(26)&0x3fff,1200);assert.equal(bytes.readUInt16LE(28)&0x3fff,600);hashes.push(hash);}assert.equal(new Set(hashes).size,47);
});
assert.deepEqual(world,worldBefore);
fs.writeFileSync(evidence+'/contract-tests.json',JSON.stringify({environment:'PGLITE_SYNTHETIC_ONLY',authenticated:false,checks,coverage,remoteWrites:0,productionApply:false},null,2)+'\n');
}finally{await pg.db.close();}
