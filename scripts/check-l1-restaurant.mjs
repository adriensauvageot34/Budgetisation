import assert from 'node:assert/strict';
import fs from 'node:fs';
import { require } from './lib/phase2-ts-loader.mjs';
import { createKernelPostgres } from './lib/planner-kernel-postgres.mjs';
import { fixture, state, uuid, householdId, weekendMonth } from './fixtures/planner-headless.mjs';
const { handleComposerRequest } = require('@/server/phase2/planner/composer-service');
const { createPlanApplyRepository } = require('@/server/phase2/planner/repository');
const { previewPlanScenario } = require('@/server/phase2/planner/apply');
const { editRestaurant } = require('@/domain/phase2/planner/restaurant-edit');
const { stageLocalDecision } = require('@/app/mois-a-venir/composer/local-draft');
const { semanticStateDigest, parsePlanSemanticState } = require('@/domain/phase2/planner/semantic-state');
const { finishComparison } = require('@/app/mois-a-venir/composer/comparison');
const { nextUnansweredQuestion } = require('@/domain/phase2/question-navigation');
const { AppliedMonthView } = require('@/app/mois-a-venir/applied-month-view');
const { resolveEffectiveMonthScenario } = require('@/server/phase2/planner/effective-month-scenario');
const React = require('react'), { renderToStaticMarkup } = require('react-dom/server');
globalThis.fetch = async () => { throw Error('L1_REMOTE_NETWORK_FORBIDDEN'); };
const pg = await createKernelPostgres(), world = fixture(), initialWorld = structuredClone(world);
let reads = 0, sequence = 0;
const repository = createPlanApplyRepository(pg.client);
const deps = { repository, householdPersons: [1,2].map(n=>({personId:uuid(n),displayName:`Personne ${n}`})),
  readWorld: async () => { reads++; return world; },
  readDirectWorld: async () => ({ forecast:world.forecast,monthInputs:world.monthInputs,externalIntents:world.externalIntents,asOfDate:world.asOfDate }),
  validateContextReferences: async (_h, refs) => { if(refs.personIds.some(id=>![uuid(1),uuid(2)].includes(id)) || refs.placeIds.some(id=>!world.mobilityFacts.places.some(p=>p.placeId===id))) throw TypeError('CONTEXT_REFERENCE_NOT_ADMITTED'); } };
const id=uuid(16000), selectionId=uuid(16001), extraId=uuid(16002);
const request = (op,draft) => handleComposerRequest(deps,householdId,{sequence:++sequence,targetMonth:'2026-11',draft,...op});
const ok = r=>{assert.equal(r.ok,true,`${r.code}: ${r.message}`);return r.model;};
const checks=[];
const check=async(name,fn)=>{await fn();checks.push(name);console.log(`${name} PASS`);};
const context = model=>model.semanticState.contexts.find(c=>c.contextOccurrenceId===id);
const edit=(fields={},slots)=>({kind:'EDIT_RESTAURANT',edit:{contextOccurrenceId:id,fields,...(slots?{slots}:{})}});
const component=(amount,selection=selectionId,option='restaurant',extra={})=>({selectionId:selection,optionKey:option,kind:'COMPONENT',provenance:'EXPLICIT_USER_DECISION',label:option==='extra'?'Boisson hors repas':'Addition totale',quantity:'1',unitBasis:'SHARED',cost:amount===null?{kind:'UNKNOWN'}:{kind:'MANUAL',unitAmount:amount},fundingAllocations:[],binding:{mode:option==='extra'?'NO_RELATED_SLOT':'EXTRA_TO_SLOT'},...extra});
const compile = model=>previewPlanScenario(deps,householdId,model.semanticState);
try {
  const initial=ok(await request({kind:'READ'},state()));
  const drop={kind:'DROP',assetKey:'template:restaurant',target:{kind:'BOARD_ZONE'},values:{},identity:id,selectionId:uuid(16003)};
  const added=ok(await request(drop,initial.semanticState));
  await check('L1-01-CONTEXT-IDENTITY-NO-OTHER-WRITER',()=>{
    assert.equal(context(added).templateKey,'restaurant');
    assert.equal(context(added).contextOccurrenceId,id);
    assert.deepEqual(stageLocalDecision(initial,initial.semanticState,drop),added.semanticState);
  });
  const fields={participantRefs:[{kind:'HOUSEHOLD_PERSON',personId:uuid(1)},{kind:'HOUSEHOLD_PERSON',personId:uuid(2)}],placeRef:null,plannedDate:null};
  const configured=ok(await request(edit(fields,{meal:[component('60.00')]}),added.semanticState));
  await check('L1-02-03-04-05-TWO-PEOPLE-ONE-60-UNKNOWN-PLACE-DATE',async()=>{
    const p=await compile(configured);assert.equal(p.compiled.components.length,1);
    assert.equal(p.compiled.components[0].evaluation.economicAmount,'60.00');
    assert.equal(context(configured).fields.plannedDate,null);assert.equal(context(configured).fields.placeRef,null);
  });
  const detailed=ok(await request(edit({}, {meal:[component('40.00')],extras:[component('20.00',extraId,'extra')]}),configured.semanticState));
  await check('L1-06-07-TOTAL-TO-DETAIL-NO-PARENT-TOTAL',async()=>{
    const p=await compile(detailed);assert.deepEqual(p.compiled.components.map(c=>c.evaluation.economicAmount).sort(),['20.00','40.00']);
    assert.equal(context(detailed).slotSelections.meal.items[0].selectionId,selectionId);
    assert.deepEqual(stageLocalDecision(configured,configured.semanticState,edit({}, {meal:[component('40.00')],extras:[component('20.00',extraId,'extra')]})),detailed.semanticState);
  });
  const total=ok(await request(edit({}, {meal:[component('70.00')],extras:[]}),detailed.semanticState));
  await check('L1-08-15-PARTIAL-70-KEEPS-ALL-FIELDS',async()=>{
    assert.equal((await compile(total)).compiled.components.length,1);
    assert.equal((await compile(total)).compiled.components[0].evaluation.economicAmount,'70.00');
    assert.deepEqual(context(total).fields,context(configured).fields);
  });
  await check('L1-09-UNKNOWN-IS-NOT-ZERO',async()=>{
    const unknown=ok(await request(edit({}, {meal:[component(null)]}),total.semanticState));
    assert.equal((await compile(unknown)).compiled.components[0].evaluation.economicAmount,null);
    assert.deepEqual(context(unknown).fields,context(total).fields);
    const zero=ok(await request(edit({}, {meal:[component('0.00')]}),total.semanticState));
    assert.equal((await compile(zero)).compiled.components[0].evaluation.economicAmount,'0.00');
  });
  await check('L1-10-11-REAL-COMPILER-BINDINGS',async()=>{
    for(const [mode,relation] of [['CONFIRMED_CONSUMPTION','CONSUMES_SLOT'],['EXTRA_TO_SLOT','EXTRA_TO_SLOT']]) {
      const linked=ok(await request(edit({}, {meal:[component('40.00',selectionId,'restaurant',{binding:{mode}})]}),total.semanticState));
      const p=await compile(linked);assert.equal(p.compiled.components[0].binding.relation,relation);
    }
  });
  await check('L1-12-RESTAURANT-CHILD-IN-STAY-KEEPS-PARENT',async()=>{
    const f=weekendMonth(),child=f.semantic.contexts.find(c=>c.templateKey==='restaurant');
    const changed=editRestaurant(f.semantic,{contextOccurrenceId:child.contextOccurrenceId,fields:{participantRefs:fields.participantRefs}});
    assert.equal(changed.contexts.find(c=>c.contextOccurrenceId===child.contextOccurrenceId).parentContextOccurrenceId,child.parentContextOccurrenceId);
    assert.deepEqual(changed.contexts.find(c=>c.templateKey==='short-stay'),f.semantic.contexts.find(c=>c.templateKey==='short-stay'));
  });
  const car={selectionId:uuid(16004),optionKey:'car',kind:'MOBILITY_INTENT',provenance:'EXPLICIT_USER_DECISION',origin:null,destination:null,returnRequired:true};
  const carModel=ok(await request(edit({}, {transport:[car]}),total.semanticState));
  await check('L1-13-14-MODE-REPLACEMENT-ONE-INTENT',async()=>{
    const train={selectionId:car.selectionId,optionKey:'train',kind:'MOBILITY_INTENT',provenance:'EXPLICIT_USER_DECISION',returnRequired:false,
      pricing:{fare:{kind:'MANUAL',unitAmount:'15.00'},parking:{kind:'UNKNOWN'},fundingAllocations:[],preference:'FASTEST'}};
    const changed=ok(await request(edit({}, {transport:[train]}),carModel.semanticState));
    const p=await compile(changed);assert.equal(p.compiled.mobilityIntents.length,1);assert.equal(p.compiled.mobilityIntents[0].mode,'TRAIN');
    assert.equal(context(changed).slotSelections.transport.items[0].route,undefined);
    assert.equal(context(changed).slotSelections.transport.items[0].selectionId,car.selectionId);
  });
  await check('L1-16-BACK-AND-DEPENDENT-FIELDS',()=>{
    const before=reads, changed=editRestaurant(total.semanticState,{contextOccurrenceId:id,fields:{plannedDate:'2026-11-15'}});
    assert.deepEqual(changed.contexts[0].fields.participantRefs,fields.participantRefs);
    assert.deepEqual(changed.contexts[0].slotSelections,context(total).slotSelections);assert.equal(reads,before);
    assert.equal(nextUnansweredQuestion([{id:'a'},{id:'b'}],null,id=>id==='a').id,'b');
  });
  await check('L1-17-18-19-IMMUTABLE-ROUNDTRIP-COMPARISON',()=>{
    const round= parsePlanSemanticState(JSON.parse(JSON.stringify(detailed.semanticState)));
    assert.equal(semanticStateDigest(round),semanticStateDigest(detailed.semanticState));
    const snapshot={model:configured,past:[added.semanticState],future:[],suggestions:null};
    assert.deepEqual(finishComparison(snapshot,detailed,false),snapshot);
    assert.equal(context(configured).slotSelections.meal.items[0].cost.unitAmount,'60.00');
    assert.deepEqual(stageLocalDecision(configured,configured.semanticState,edit({}, {meal:[component('70.00')],extras:[]})),total.semanticState);
  });
  await check('L1-21-APPLY-RELOAD-PERSISTED-C0-ISOLATED',async()=>{
    const fresh=ok(await request({kind:'READ'},total.semanticState));
    const applied=await request({kind:'APPLY',command:{...fresh.proof,applyRequestId:uuid(16005)}},fresh.semanticState);
    assert.equal(applied.applied,true,`${applied.code}: ${applied.message}`);
    const reload=ok(await request({kind:'READ'}));assert.deepEqual(reload.semanticState,total.semanticState);
    const effective=await resolveEffectiveMonthScenario(deps,householdId,'2026-11');
    const html=renderToStaticMarkup(React.createElement(AppliedMonthView,{projection:effective.projection,semanticState:effective.semanticState,plan:null,revision:1,today:world.asOfDate,persons:deps.householdPersons,composerHref:'/mois-a-venir/composer?month=2026-11'}));assert.match(html,/Restaurant/);assert.match(html,/70/);
    const refused=await request({kind:'APPLY',command:{...fresh.proof,applyRequestId:uuid(16006)}},total.semanticState);assert.equal(refused.ok,false);
  });
  await check('L1-22-SUGGESTION-NOT-A-DECISION',async()=>{
    const suggested=ok(await request(edit({}, {meal:[component('60.00',selectionId,'restaurant',{provenance:'PERSONAL_SUGGESTION'})]}),total.semanticState));
    assert.equal((await compile(suggested)).compiled.components.length,0);
  });
  await check('L1-23-NO-HISTORICAL-WRITER-OR-SNAPSHOT-MODIFICATION',()=>assert.deepEqual(world,initialWorld));
  await check('L1-24-SAME-INTENTION-OLD-NEW-PATH-PARITY',async()=>{
    const legacyMeal=ok(await request({kind:'MUTATE',mutation:{kind:'PATCH_CONTEXT',contextOccurrenceId:id,slotKey:'meal',items:[component('70.00')]}},configured.semanticState));
    const legacy=ok(await request({kind:'MUTATE',mutation:{kind:'PATCH_CONTEXT',contextOccurrenceId:id,slotKey:'extras',items:[]}},legacyMeal.semanticState));
    assert.deepEqual(legacy.semanticState,total.semanticState);
    const a=await compile(legacy),b=await compile(total);
    assert.equal(a.compiledManifestDigest,b.compiledManifestDigest);assert.deepEqual(a.scenario,b.scenario);assert.equal(a.previewDigest,b.previewDigest);
  });
  await check('L1-25-FOREIGN-REFERENCES-AND-PRESERVE-REFUSED',async()=>{
    assert.equal((await request(edit({participantRefs:[{kind:'HOUSEHOLD_PERSON',personId:uuid(999)}]}),total.semanticState)).ok,false);
    assert.equal((await request(edit({placeRef:{kind:'KNOWN',placeId:uuid(998)}}),total.semanticState)).ok,false);
    const protectedState={...total.semanticState,preferences:{anchors:[id],flexibility:{}}};
    assert.throws(()=>editRestaurant(protectedState,{contextOccurrenceId:id,fields:{plannedDate:null}}),/LOCKED/);
    assert.throws(()=>editRestaurant(total.semanticState,{contextOccurrenceId:id,slots:{meal:[component('5'),component('9',extraId)]}}),/SLOT_INVALID/);
  });
  fs.mkdirSync('docs/status/evidence/l0-l1-composer-restaurant',{recursive:true});
  fs.writeFileSync('docs/status/evidence/l0-l1-composer-restaurant/contract-tests.json',JSON.stringify({environment:'PGLITE_SYNTHETIC_ONLY',checks,reads,remoteWrites:0,productionApply:0},null,2));
} finally { await pg.db.close(); }
