import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { require } from './lib/phase2-ts-loader.mjs';
import { createKernelPostgres } from './lib/planner-kernel-postgres.mjs';
import { fixture,state,uuid,householdId } from './fixtures/planner-headless.mjs';
const {COMPOSER_PRESETS,presetForContext,presetCreationFields,presetIllustrationPath}=require('@/domain/phase2/planner/composer-presets');
const {composerLibraryIndex,filterLibraryIntentions}=require('@/domain/phase2/planner/composer-library-index');
const {displayEquipmentGroups}=require('@/app/mois-a-venir/composer/presentation/palette-groups');
const {handleComposerRequest}=require('@/server/phase2/planner/composer-service');
const {createPlanApplyRepository}=require('@/server/phase2/planner/repository');
const {stageLocalDecision}=require('@/app/mois-a-venir/composer/local-draft');
const {parsePlanSemanticState,semanticStateDigest}=require('@/domain/phase2/planner/semantic-state');
const {previewPlanScenario}=require('@/server/phase2/planner/apply');
const {resolveEffectiveMonthScenario}=require('@/server/phase2/planner/effective-month-scenario');
const {CONTEXT_TEMPLATES}=require('@/server/phase2/planner/context-registry');
const React=require('react'),{renderToStaticMarkup}=require('react-dom/server');
const {ComposerLibrary}=require('@/app/mois-a-venir/composer/composer-library');
const {AppliedMonthView}=require('@/app/mois-a-venir/applied-month-view');
globalThis.fetch=async()=>{throw Error('L2B_REMOTE_FORBIDDEN');};
const evidence='docs/status/evidence/l2b-composer-library';
fs.mkdirSync(evidence,{recursive:true});
const pg=await createKernelPostgres(),world=fixture(), originalWorld=structuredClone(world);
let sequence=0,model;
const deps={repository:createPlanApplyRepository(pg.client),readWorld:async()=>world,
  readDirectWorld:async()=>({forecast:world.forecast,monthInputs:world.monthInputs,externalIntents:world.externalIntents,asOfDate:world.asOfDate}),
  householdPersons:[{personId:uuid(1),displayName:'Alice Fixture'}],validateContextReferences:async(_h,refs)=>{if(refs.personIds.some(id=>id!==uuid(1))||refs.placeIds.length)throw TypeError('FOREIGN_REF');}};
const checks=[],coverage=[];
const check=async(name,fn)=>{await fn();checks.push(name);console.log(name+' PASS');};
const request=(operation,draft=model?.semanticState)=>handleComposerRequest(deps,householdId,{sequence:++sequence,targetMonth:'2026-11',draft,...operation});
const ok=r=>{assert.equal(r.ok,true,r.code+': '+r.message);return r.model;};
const compile=s=>previewPlanScenario(deps,householdId,s);
const shapes={'night-out':['main','main'],restaurant:['meal','restaurant'],'fast-food':['meal','fast-food'],delivery:['meal','delivery'],activity:['main','activity'],
  'family-visit':['hospitality','hospitality'],'friend-visit':['hospitality','hospitality'],purchase:['item','item'],'beauty-restock':['products','product'],'short-stay':['lodging','lodging']};
const component=(id,option,amount,label)=>({selectionId:id,optionKey:option,kind:'COMPONENT',provenance:'EXPLICIT_USER_DECISION',label,quantity:'1',unitBasis:'SHARED',
  cost:amount===null?{kind:'UNKNOWN'}:{kind:'MANUAL',unitAmount:amount},fundingAllocations:[],binding:{mode:'NO_RELATED_SLOT'}});
try{
  model=ok(await request({kind:'READ'},state()));
  await check('L2B-INDEX-ADMISSION-SEARCH-GENERICS-NO-OPTIONS',()=>{
    const index=composerLibraryIndex(model);
    assert.equal(index.intentions.filter(i=>i.preset).length,26);
    assert.equal(index.intentions.filter(i=>!i.preset).length,13);
    assert.ok(index.intentions.every(i=>i.asset.kind==='CONTEXT_ASSET'));
    for(const [term,key]of [['boite','nightclub'],['club','nightclub'],['apero','bar-apero'],['chicken','chicken-snack'],['uber','uber-eats-order'],['peche','fishing-day'],['marcher','hiking-nature'],['Fontès','fontes-family-visit'],['Servian','servian-family-visit'],['vacances','weekend-gite'],['gîte','weekend-gite'],['pantalon','clothing-shopping'],['Shein','shein-purchase'],['Amazon','amazon-purchase'],['manette','video-game-purchase'],['mascara','mascara'],['lessive','laundry-detergent']]){
      assert.ok(filterLibraryIntentions(index.intentions,term).some(i=>i.preset?.presetKey===key),term);
    }
    assert.equal(filterLibraryIntentions(index.intentions,'lave-vaisselle').length,0);
    const denied=composerLibraryIndex({...model,dropCapabilities:model.dropCapabilities.filter(d=>d.sourceAssetKey!=='template:activity')});
    assert.equal(denied.intentions.some(i=>i.preset?.templateKey==='activity'),false);
    const html=renderToStaticMarkup(React.createElement(ComposerLibrary,{model,openToken:0,busy:false,selected:null,choose(){},choosePreset(){},drag(){},inspectContext(){}}));
    assert.ok(html.includes('À ajouter')&&html.includes('À piloter'));
    assert.ok(!html.includes('data-library-group="options"'));
    assert.equal((html.match(/data-preset=/g)||[]).length,5); // Only initial social category mounted.
    assert.ok(!html.includes('HEALTH')&&!html.includes('Ma voiture'));
  });
  for(const [i,preset]of COMPOSER_PRESETS.entries()){
    const id=uuid(24000+i), selectionId=uuid(24100+i),[slot,option]=shapes[preset.templateKey];
    const prior=model;
    const drop={kind:'DROP',assetKey:'template:'+preset.templateKey,presetKey:preset.presetKey,target:{kind:'BOARD_ZONE'},values:{},identity:id,selectionId:uuid(24200+i)};
    model=ok(await request(drop));
    await check(preset.presetKey+'-CREATE-EDIT-ROUNDTRIP-PARITY',async()=>{
      assert.deepEqual(stageLocalDecision(prior,prior.semanticState,drop),model.semanticState);
      let context=model.semanticState.contexts.find(c=>c.contextOccurrenceId===id);
      assert.deepEqual(context.slotSelections,{});
      assert.equal(context.fields.plannedDate,undefined);
      assert.equal(context.fields.participantRefs,undefined);
      assert.equal(context.fields.placeRef,undefined);
      assert.equal(context.fields.personVisitedRef,undefined);
      assert.equal(presetForContext(context).presetKey,preset.presetKey);
      // No economic selection exists until an explicit admitted mutation.
      model=ok(await request({kind:'EDIT_CONTEXT',contextOccurrenceId:id,values:{plannedDate:null,...(['restaurant','fast-food','night-out'].includes(preset.templateKey)?{participantRefs:[{kind:'HOUSEHOLD_PERSON',personId:uuid(1)},{kind:'TEXT',label:'Invité fixture'}]}:{})}}));
      const before=model;
      const selection=component(selectionId,option,'40.00',preset.label+' choisi');
      const op={kind:'MUTATE',mutation:{kind:'PATCH_CONTEXT',contextOccurrenceId:id,slotKey:slot,items:[selection]}};
      model=ok(await request(op));
      assert.deepEqual(stageLocalDecision(before,before.semanticState,op),model.semanticState);
      context=model.semanticState.contexts.find(c=>c.contextOccurrenceId===id);
      assert.deepEqual(context.fields,before.semanticState.contexts.find(c=>c.contextOccurrenceId===id).fields);
      const round=parsePlanSemanticState(JSON.parse(JSON.stringify(model.semanticState)));
      assert.equal(semanticStateDigest(round),semanticStateDigest(model.semanticState));
      assert.equal(presetForContext({...context,fields:{...context.fields,label:'Renommé librement'}}).presetKey,preset.presetKey);
      assert.equal(presetForContext(before.semanticState.contexts.find(c=>c.contextOccurrenceId===id)).presetKey,preset.presetKey); // Undo
      assert.deepEqual(parsePlanSemanticState(JSON.parse(JSON.stringify(round))),model.semanticState); // Redo
      const manual=parsePlanSemanticState({...round,contexts:round.contexts.map(c=>{const fields={...c.fields};delete fields.composerPresentation;return {...c,fields};})});
      const a=await compile(round),b=await compile(manual);
      assert.deepEqual(a.scenario,b.scenario);
      assert.deepEqual(a.compiled.components,b.compiled.components);
      assert.deepEqual(a.compiled.journeyPrices,b.compiled.journeyPrices);
      const own=a.compiled.components.filter(c=>c.contextOccurrenceId===id);
      assert.equal(own.length,1);
      assert.equal(own[0].evaluation.economicAmount,'40.00'); // Not 80 with two participants.
      assert.equal(a.compiled.mobilityIntents.length,0);
      const unknown=ok(await request({...op,mutation:{...op.mutation,items:[{...selection,cost:{kind:'UNKNOWN'}}]}}));
      assert.equal((await compile(unknown.semanticState)).compiled.components.find(c=>c.contextOccurrenceId===id)?.evaluation.economicAmount,null);
      const zero=ok(await request({...op,mutation:{...op.mutation,items:[{...selection,cost:{kind:'MANUAL',unitAmount:'0.00'}}]}}));
      assert.equal((await compile(zero.semanticState)).compiled.components.find(c=>c.contextOccurrenceId===id)?.evaluation.economicAmount,'0.00');
      const suggested=structuredClone(round);suggested.contexts.find(c=>c.contextOccurrenceId===id).slotSelections[slot].items[0].provenance='PERSONAL_SUGGESTION';
      assert.equal((await compile(suggested)).compiled.components.filter(c=>c.contextOccurrenceId===id).length,0);
      coverage.push({presetKey:preset.presetKey,templateKey:preset.templateKey,status:'EXECUTED_PASS_PGLITE_SYNTHETIC_ONLY',identity:id,selectionId});
    });
  }
  await check('L2B-FASTFOOD-GUIDE-PARTIAL-ADMISSION-AND-UNKNOWN-FALLBACK',async()=>{
    const c=model.semanticState.contexts.find(c=>c.templateKey==='fast-food'),op={kind:'EDIT_PRESET_CONTEXT',edit:{contextOccurrenceId:c.contextOccurrenceId,fields:{plannedDate:null},slots:{meal:[component(uuid(24500),'fast-food','23.00','Snack choisi')]}}};
    const changed=ok(await request(op));assert.deepEqual(stageLocalDecision(model,model.semanticState,op),changed.semanticState);
    const foreign=await request({kind:'EDIT_PRESET_CONTEXT',edit:{contextOccurrenceId:c.contextOccurrenceId,fields:{participantRefs:[{kind:'HOUSEHOLD_PERSON',personId:uuid(999)}]}}});assert.equal(foreign.ok,false);
    const unknown=structuredClone(model.semanticState);unknown.contexts[0].fields.composerPresentation.presetKey='future-key';assert.equal(presetForContext(parsePlanSemanticState(unknown).contexts[0]),undefined);
    assert.throws(()=>presetCreationFields('activity','future-key'),/MISMATCH/);
    unknown.contexts[0].fields.composerPresentation.presetKey='mascara';assert.throws(()=>parsePlanSemanticState(unknown),/PRESENTATION_INVALID/);
  });
  for(const [i,template] of ['gift','home-project','other-context'].entries()) model=ok(await request({kind:'DROP',assetKey:'template:'+template,target:{kind:'BOARD_ZONE'},values:{},identity:uuid(24900+i),selectionId:uuid(24910+i)}));
  await check('L2B-ALL-PUBLISHED-OPTIONS-REACHABLE-BY-PARENT',()=>{
    const routes=new Set();
    for(const card of model.board.contexts){for(const group of displayEquipmentGroups(card,model))for(const tile of group.tiles)for(const route of tile.routes)routes.add(route.option.assetKey);}
    const old=model.library.searchableAssets.filter(a=>a.kind==='SLOT_OPTION_ASSET');
    for(const option of old)assert.ok(routes.has(option.assetKey),'Lost route: '+option.assetKey);
    assert.equal(new Set(composerLibraryIndex(model).controls.map(c=>c.capabilityRef)).size,composerLibraryIndex(model).controls.length);
    fs.writeFileSync(evidence+'/option-reachability.json',JSON.stringify({published:old.length,reachable:routes.size,missing:old.filter(a=>!routes.has(a.assetKey))},null,2)+'\n');
  });
  await check('L2B-WEEKEND-CHILD-NONADDITIVE',async()=>{
    const stay=model.semanticState.contexts.find(c=>c.templateKey==='short-stay'),child=model.semanticState.contexts.find(c=>c.templateKey==='restaurant');
    const linked=ok(await request({kind:'MUTATE',mutation:{kind:'PATCH_CONTEXT',contextOccurrenceId:stay.contextOccurrenceId,slotKey:'restaurants',items:[{kind:'CHILD_CONTEXT',selectionId:uuid(24600),optionKey:'restaurant',provenance:'EXPLICIT_USER_DECISION',childContextOccurrenceId:child.contextOccurrenceId}]}}));
    const p=await compile(linked.semanticState);assert.equal(p.compiled.components.filter(c=>c.contextOccurrenceId===stay.contextOccurrenceId).length,1);assert.equal(p.compiled.components.filter(c=>c.contextOccurrenceId===child.contextOccurrenceId).length,1);
  });
  for(let i=0;i<3;i++) model=ok(await request({kind:'MUTATE',mutation:{kind:'REMOVE_CONTEXT',contextOccurrenceId:uuid(24900+i)}}));
  await check('L2B-IMMUTABLE-APPLY-RELOAD-MONPLAN-REEDIT',async()=>{
    model=ok(await request({kind:'READ'}));
    const before=model.semanticState;
    const applied=await request({kind:'APPLY',command:{...model.proof,applyRequestId:uuid(24700)}});assert.equal(applied.ok,true,applied.code);
    model=ok(await request({kind:'READ'},undefined));assert.deepEqual(model.semanticState,before);
    const effective=await resolveEffectiveMonthScenario(deps,householdId,'2026-11');
    const html=renderToStaticMarkup(React.createElement(AppliedMonthView,{projection:effective.projection,semanticState:effective.semanticState,plan:null,revision:1,today:world.asOfDate,persons:deps.householdPersons,composerHref:'/composer'}));
    for(const p of COMPOSER_PRESETS){assert.ok(html.includes(p.label));const c=model.semanticState.contexts.find(c=>presetForContext(c)?.presetKey===p.presetKey);
      const edit=ok(await request({kind:'EDIT_CONTEXT',contextOccurrenceId:c.contextOccurrenceId,values:{label:'Titre après reprise'}},before));
      assert.deepEqual(edit.semanticState.contexts.find(x=>x.contextOccurrenceId===c.contextOccurrenceId).slotSelections,c.slotSelections);}
    assert.deepEqual(world,originalWorld);
  });
  if(!process.env.L2B_SKIP_ART) await check('L2B-21-NEW-ORIGINALS-PLUS-5-BYTE-PRESERVED',()=>{
    const art=JSON.parse(fs.readFileSync(evidence+'/illustrations.json','utf8')),old=JSON.parse(fs.readFileSync('docs/status/evidence/l2a-composer-presets/illustrations.json','utf8'));
    assert.equal(art.length,21);const hashes=[];
    for(const preset of COMPOSER_PRESETS){
      const bytes=fs.readFileSync('public'+presetIllustrationPath(preset));const hash=crypto.createHash('sha256').update(bytes).digest('hex');hashes.push(hash);
      assert.equal(bytes.toString('ascii',0,4),'RIFF');assert.equal(bytes.toString('ascii',12,16),'VP8 ');assert.equal(bytes.readUInt16LE(26)&0x3fff,1200);assert.equal(bytes.readUInt16LE(28)&0x3fff,600);
      assert.equal([...art,...old].find(a=>a.presetKey===preset.presetKey).sha256,hash);
    }assert.equal(new Set(hashes).size,26);
  });
  fs.writeFileSync(evidence+'/contract-tests.json',JSON.stringify({environment:'PGLITE_SYNTHETIC_ONLY',authenticated:false,checks,coverage,remoteWrites:0},null,2)+'\n');
}finally{await pg.db.close();}

