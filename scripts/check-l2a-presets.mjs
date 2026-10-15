import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { require } from './lib/phase2-ts-loader.mjs';
import { createKernelPostgres } from './lib/planner-kernel-postgres.mjs';
import { fixture, state, uuid, householdId } from './fixtures/planner-headless.mjs';
const { COMPOSER_PRESETS, presetForContext, presetIllustrationPath } = require('@/domain/phase2/planner/composer-presets');
const { handleComposerRequest } = require('@/server/phase2/planner/composer-service');
const { createPlanApplyRepository } = require('@/server/phase2/planner/repository');
const { stageLocalDecision } = require('@/app/mois-a-venir/composer/local-draft');
const { parsePlanSemanticState, semanticStateDigest } = require('@/domain/phase2/planner/semantic-state');
const { previewPlanScenario } = require('@/server/phase2/planner/apply');
const { resolveEffectiveMonthScenario } = require('@/server/phase2/planner/effective-month-scenario');
const { AppliedMonthView } = require('@/app/mois-a-venir/applied-month-view');
const React = require('react'), { renderToStaticMarkup } = require('react-dom/server');
globalThis.fetch = async () => { throw Error('L2A_REMOTE_FORBIDDEN'); };
const pg = await createKernelPostgres(), world = fixture(), originalWorld = structuredClone(world);
const deps = { repository: createPlanApplyRepository(pg.client), readWorld: async () => world,
  readDirectWorld: async () => ({forecast:world.forecast,monthInputs:world.monthInputs,externalIntents:world.externalIntents,asOfDate:world.asOfDate}),
  householdPersons:[{personId:uuid(1),displayName:'Alice Fixture'}],
  validateContextReferences: async (_h,refs) => { if(refs.personIds.some(id=>id!==uuid(1)) || refs.placeIds.length) throw TypeError('FOREIGN_REF'); } };
let sequence=0, model;
const checks=[];
const check=async(name,fn)=>{await fn(); checks.push(name); console.log(name+' PASS');};
const request=(op,draft=model?.semanticState)=>handleComposerRequest(deps,householdId,{sequence:++sequence,targetMonth:'2026-11',draft,...op});
const ok=r=>{assert.equal(r.ok,true,r.code+': '+r.message); return r.model;};
const compile=semantic=>previewPlanScenario(deps,householdId,semantic);
const component=(id,option,amount,label='Décision de test',provenance='EXPLICIT_USER_DECISION')=>({selectionId:id,kind:'COMPONENT',optionKey:option,provenance,
  label,quantity:'1',unitBasis:'SHARED',cost:amount===null?{kind:'UNKNOWN'}:{kind:'MANUAL',unitAmount:amount},fundingAllocations:[],binding:{mode:['delivery','item'].includes(option)?'EXTRA_TO_SLOT':'NO_RELATED_SLOT'}});
const shapes={'night-out':['main','main'],'delivery':['meal','delivery'],'activity':['main','activity'],'family-visit':['hospitality','hospitality'],'purchase':['item','item']};
try {
  model=ok(await request({kind:'READ'},state()));
  await check('L2A-ART-5-ORIGINAL-UNIQUE-1200x600',()=>{
    assert.equal(COMPOSER_PRESETS.length,5);
    const art=JSON.parse(fs.readFileSync('docs/status/evidence/l2a-composer-presets/illustrations.json','utf8'));
    assert.equal(new Set(COMPOSER_PRESETS.map(p=>p.presetKey)).size,5);
    assert.equal(new Set(COMPOSER_PRESETS.map(p=>presetIllustrationPath(p))).size,5);
    const hashes=COMPOSER_PRESETS.map(p=>{
      const path='public'+presetIllustrationPath(p), bytes=fs.readFileSync(path);
      assert.ok(!path.includes('/builder/')); assert.equal(bytes.toString('ascii',0,4),'RIFF'); assert.equal(bytes.toString('ascii',8,12),'WEBP');
      const chunk=bytes.toString('ascii',12,16);
      if(chunk==='VP8 ') { assert.equal(bytes.readUInt16LE(26)&0x3fff,1200); assert.equal(bytes.readUInt16LE(28)&0x3fff,600); }
      else throw Error('Expected lossy Q82 VP8 export');
      const hash=crypto.createHash('sha256').update(bytes).digest('hex');
      assert.equal(art.find(a=>a.presetKey===p.presetKey).sha256,hash);
      return hash;
    });
    assert.equal(new Set(hashes).size,5);
  });
  for(const [index,preset] of COMPOSER_PRESETS.entries()) {
    const id=uuid(18000+index), selection=uuid(18100+index), [slot,option]=shapes[preset.templateKey];
    const drop={kind:'DROP',assetKey:'template:'+preset.templateKey,presetKey:preset.presetKey,target:{kind:'BOARD_ZONE'},values:{},identity:id,selectionId:uuid(18200+index)};
    const prior=model, added=ok(await request(drop));
    await check(preset.presetKey+'-CAPABILITY-LOCAL-SERVER-NO-INVENTED-PRICE',()=>{
      assert.deepEqual(stageLocalDecision(prior,prior.semanticState,drop),added.semanticState);
      const c=added.semanticState.contexts.find(c=>c.contextOccurrenceId===id);
      assert.equal(presetForContext(c).presetKey,preset.presetKey);assert.deepEqual(c.slotSelections,{});
      assert.equal(c.fields.plannedDate,undefined);assert.equal(c.fields.placeRef,undefined);
      assert.equal(c.fields.merchantRef,undefined);
    });
    model=added;
    const edit=(amount,patch={})=>preset.templateKey==='night-out'
      ?{kind:'EDIT_NIGHT_OUT',edit:{contextOccurrenceId:id,fields:patch,slots:{main:[component(selection,option,amount)]}}}
      :preset.templateKey==='family-visit'
        ?{kind:'EDIT_FAMILY_VISIT',edit:{contextOccurrenceId:id,fields:patch,hospitality:[component(selection,option,amount)]}}
        :{kind:'EDIT_PRESET_CONTEXT',edit:{contextOccurrenceId:id,fields:patch,slots:{[slot]:[component(selection,option,amount)]}}};
    // Family uses its already-published mutation to replace hospitality.
    const applyEdit=async amount=>{
      if(preset.templateKey==='family-visit') return ok(await request({kind:'MUTATE',mutation:{kind:'PATCH_CONTEXT',contextOccurrenceId:id,slotKey:slot,items:[component(selection,option,amount)]}}));
      return ok(await request(edit(amount)));
    };
    model=ok(await request({kind:'EDIT_CONTEXT',contextOccurrenceId:id,values:{plannedDate:null,...(preset.templateKey==='purchase'?{productLabel:'Pantalon',merchantLabel:null}:{participantRefs:[{kind:'HOUSEHOLD_PERSON',personId:uuid(1)}]})}}));
    const beforeBudget=model;
    model=await applyEdit('40.00');
    await check(preset.presetKey+'-EDIT-PARTIAL-KEEPS-IDENTITY-FIELDS',()=>{
      const c=model.semanticState.contexts.find(c=>c.contextOccurrenceId===id);
      assert.deepEqual(c.fields,beforeBudget.semanticState.contexts.find(c=>c.contextOccurrenceId===id).fields);
      assert.equal(c.slotSelections[slot].items[0].selectionId,selection);
      assert.equal(presetForContext({...c,fields:{...c.fields,label:'Titre libre sans indice'}}).presetKey,preset.presetKey);
      assert.equal(semanticStateDigest(parsePlanSemanticState(JSON.parse(JSON.stringify(model.semanticState)))),semanticStateDigest(model.semanticState));
      const undo=beforeBudget.semanticState,redo=model.semanticState;
      assert.equal(presetForContext(undo.contexts.find(c=>c.contextOccurrenceId===id)).presetKey,preset.presetKey);
      assert.deepEqual(parsePlanSemanticState(JSON.parse(JSON.stringify(redo))),redo);
    });
    await check(preset.presetKey+'-MANUAL-PRESET-FINANCIAL-PARITY',async()=>{
      const manual=parsePlanSemanticState({...model.semanticState,contexts:model.semanticState.contexts.map(c=>{const fields={...c.fields};delete fields.composerPresentation;return {...c,fields};})});
      const a=await compile(model.semanticState),b=await compile(manual);
      assert.deepEqual(a.scenario,b.scenario);
      assert.deepEqual(a.compiled.components,b.compiled.components);
      assert.deepEqual(a.compiled.journeyPrices,b.compiled.journeyPrices);
      assert.equal(a.compiled.mobilityIntents.length,0);
      assert.equal(a.compiled.components.filter(c=>c.contextOccurrenceId===id).length,1);
      if(['delivery','purchase'].includes(preset.templateKey)) assert.ok(a.compiled.components.some(c=>c.contextOccurrenceId===id && c.binding.relation==='EXTRA_TO_SLOT'));
    });
    await check(preset.presetKey+'-UNKNOWN-NE-ZERO-NO-SILENT-SUGGESTION',async()=>{
      const saved=model;
      model=await applyEdit(null);assert.equal((await compile(model.semanticState)).compiled.components.find(c=>c.contextOccurrenceId===id)?.evaluation.economicAmount,null);
      model=await applyEdit('0.00');assert.equal((await compile(model.semanticState)).compiled.components.find(c=>c.contextOccurrenceId===id)?.evaluation.economicAmount,'0.00');
      const suggested=structuredClone(saved.semanticState);suggested.contexts.find(c=>c.contextOccurrenceId===id).slotSelections[slot].items[0].provenance='PERSONAL_SUGGESTION';
      assert.equal((await compile(suggested)).compiled.components.filter(c=>c.contextOccurrenceId===id).length,0);
      model=saved;
    });
  }
  await check('L2A-SCOPE-PRESERVE-INVALID-PRESET-AND-DELIVERY-TRANSPORT-REFUSED',async()=>{
    assert.equal((await request({kind:'DROP',assetKey:'template:delivery',presetKey:'techno-night',target:{kind:'BOARD_ZONE'},values:{},identity:uuid(18500),selectionId:uuid(18501)})).ok,false);
    const delivery=model.semanticState.contexts.find(c=>c.templateKey==='delivery');
    assert.equal((await request({kind:'EDIT_PRESET_CONTEXT',edit:{contextOccurrenceId:delivery.contextOccurrenceId,slots:{transport:[]}}})).ok,false);
    const protectedState={...model.semanticState,preferences:{anchors:[delivery.contextOccurrenceId],flexibility:{}}};
    assert.throws(()=>stageLocalDecision(model,protectedState,{kind:'EDIT_PRESET_CONTEXT',edit:{contextOccurrenceId:delivery.contextOccurrenceId,fields:{label:'Non'}}}),/LOCKED/);
    const invalid=structuredClone(model.semanticState);invalid.contexts[0].fields.composerPresentation.presetKey='forged';
    assert.throws(()=>parsePlanSemanticState(invalid),/PRESENTATION_INVALID/);
  });
  await check('L2A-DELIVERY-CLOTHING-TOTAL-DETAIL-REPLACEMENT-AND-ENVELOPE',async()=>{
    for(const template of ['delivery','purchase']) {
      const c=model.semanticState.contexts.find(c=>c.templateKey===template),[slot,option]=shapes[template];
      const old=c.slotSelections[slot].items[0], extraId=uuid(template==='delivery'?18700:18701);
      const operation=slots=>({kind:'EDIT_PRESET_CONTEXT',edit:{contextOccurrenceId:c.contextOccurrenceId,slots}});
      const detailed=ok(await request(operation({[slot]:[component(old.selectionId,option,'30.00')],extras:[component(extraId,'extra','10.00','Frais non inclus')]})));
      assert.deepEqual(stageLocalDecision(model,model.semanticState,operation({[slot]:[component(old.selectionId,option,'30.00')],extras:[component(extraId,'extra','10.00','Frais non inclus')]})),detailed.semanticState);
      const p=await compile(detailed.semanticState), own=p.compiled.components.filter(x=>x.contextOccurrenceId===c.contextOccurrenceId);
      assert.deepEqual(own.map(x=>x.evaluation.economicAmount).sort(),['10.00','30.00']);
      const total=ok(await request(operation({[slot]:[component(old.selectionId,option,'40.00')],extras:[]}),detailed.semanticState));
      assert.equal((await compile(total.semanticState)).compiled.components.filter(x=>x.contextOccurrenceId===c.contextOccurrenceId).length,1);
      assert.deepEqual(total.semanticState.contexts.find(x=>x.contextOccurrenceId===c.contextOccurrenceId).fields,c.fields);
      const consume=component(old.selectionId,option,'40.00');consume.binding={mode:'CONFIRMED_CONSUMPTION'};
      const consumed=ok(await request(operation({[slot]:[consume]})));
      assert.equal((await compile(consumed.semanticState)).compiled.components.find(x=>x.contextOccurrenceId===c.contextOccurrenceId).binding.relation,'CONSUMES_SLOT');
    }
  });
  await check('L2A-PRESET-TECHNO-SHARED-BOTTLE-ONE-COST',async()=>{
    const c=model.semanticState.contexts.find(c=>c.templateKey==='night-out');
    const bottle=component(uuid(18710),'extra','20.00','Bouteille partagée');
    const changed=ok(await request({kind:'EDIT_NIGHT_OUT',edit:{contextOccurrenceId:c.contextOccurrenceId,fields:{},slots:{extras:[bottle]}}}));
    const compiled=(await compile(changed.semanticState)).compiled;
    assert.equal(compiled.components.filter(x=>x.label==='Bouteille partagée').length,1);
    assert.equal(compiled.components.find(x=>x.label==='Bouteille partagée').evaluation.economicAmount,'20.00');
    assert.equal(presetForContext(changed.semanticState.contexts.find(x=>x.contextOccurrenceId===c.contextOccurrenceId)).presetKey,'techno-night');
  });
  await check('L2A-APPLY-RELOAD-PLANREVISION-MONPLAN-REEDIT',async()=>{
    model=ok(await request({kind:'READ'}));
    const expected=model.semanticState;
    const applied=await request({kind:'APPLY',command:{...model.proof,applyRequestId:uuid(18600)}});
    assert.equal(applied.ok,true,applied.code);assert.equal(applied.applied,true);
    model=ok(await request({kind:'READ'},undefined));assert.deepEqual(model.semanticState,expected);
    const effective=await resolveEffectiveMonthScenario(deps,householdId,'2026-11');
    const html=renderToStaticMarkup(React.createElement(AppliedMonthView,{projection:effective.projection,semanticState:effective.semanticState,plan:null,revision:1,today:world.asOfDate,persons:deps.householdPersons,composerHref:'/composer'}));
    for(const p of COMPOSER_PRESETS){assert.ok(html.includes(p.label.replaceAll('’','&#x27;')) || html.includes(p.label));assert.ok(effective.semanticState.contexts.some(c=>presetForContext(c)?.presetKey===p.presetKey));}
    for(const c of model.semanticState.contexts) {
      const changed=ok(await request({kind:'EDIT_CONTEXT',contextOccurrenceId:c.contextOccurrenceId,values:{label:'Titre libre'}},expected));
      assert.deepEqual(changed.semanticState.contexts.find(x=>x.contextOccurrenceId===c.contextOccurrenceId).slotSelections,c.slotSelections);
      assert.equal(presetForContext(changed.semanticState.contexts.find(x=>x.contextOccurrenceId===c.contextOccurrenceId)).presetKey,presetForContext(c).presetKey);
    }
  });
  await check('L2A-HISTORICAL-STATE-READABLE-NO-OTHER-OWNER',async()=>{
    assert.equal((await request({kind:'READ'},state())).ok,true);assert.deepEqual(world,originalWorld);
    assert.equal(presetForContext({templateKey:'activity',fields:{label:'Soirée techno'}}),undefined);
  });
  fs.writeFileSync('docs/status/evidence/l2a-composer-presets/contract-tests.json',JSON.stringify({environment:'PGLITE_SYNTHETIC_ONLY',checks,productionWrites:0,authenticated:false},null,2)+'\n');
} finally {await pg.db.close();}
