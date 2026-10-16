import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import Module from 'node:module';
import ts from 'typescript';
import {execFileSync} from 'node:child_process';
import {require} from './lib/phase2-ts-loader.mjs';
import {createKernelPostgres} from './lib/planner-kernel-postgres.mjs';
import {fixture,state,uuid,householdId,rebuild,control,renewalMonth} from './fixtures/planner-headless.mjs';
const {handleComposerRequest}=require('@/server/phase2/planner/composer-service');
const {createPlanApplyRepository}=require('@/server/phase2/planner/repository');
const {normalizeControlInput,controlInputValue}=require('@/domain/phase2/planner/control-input');
const {stageLocalDecision,visualDraftModel}=require('@/app/mois-a-venir/composer/local-draft');
const {monthReuseProposals}=require('@/domain/phase2/planner/month-reuse');
const {parsePlanSemanticState,semanticStateDigest}=require('@/domain/phase2/planner/semantic-state');
const {previewPlanScenario}=require('@/server/phase2/planner/apply');
const {planningBaselineDigest}=require('@/server/phase2/planner/baseline');
const React=require('react'),{renderToStaticMarkup}=require('react-dom/server');
const {FixedChargeCard,FixedChargesDetails}=require('@/app/mois-a-venir/composer/fixed-charges');
const {BoardCarousel}=require('@/app/mois-a-venir/composer/board-carousel');
const {COMPOSER_PRESETS}=require('@/domain/phase2/planner/composer-presets');
const pg=await createKernelPostgres(),world=fixture();
globalThis.fetch=async()=>{throw Error('L33_REMOTE_FORBIDDEN');};
const deps={repository:createPlanApplyRepository(pg.client),readWorld:async()=>world,householdPersons:[]};
let sequence=0; const req=(op,draft)=>handleComposerRequest(deps,householdId,{sequence:++sequence,targetMonth:'2026-11',draft,...op});
const ok=r=>{assert.equal(r.ok,true,JSON.stringify(r));return r.model;};
const cards=m=>[...m.board.baselineControls,...m.board.discretionaryControls,...m.board.savings];
const mutate=(m,key,value)=>req({kind:'MUTATE',mutation:{kind:'SET_STATE',targetRef:key,value}},m.semanticState);
const checks=[];const check=async(name,fn)=>{await fn();checks.push({name,status:'EXECUTED_PASS'});console.log(name+' PASS');};
try {
 const initial=ok(await req({kind:'READ'},state()));
 const base='b777374fe8399e7abf22967c98caef2013876507',file='src/server/phase2/planner/balance-assistant.ts';
 const oldModule=new Module(path.resolve(file));oldModule.filename=path.resolve(file);oldModule.paths=Module._nodeModulePaths(path.dirname(oldModule.filename));
 oldModule._compile(ts.transpileModule(execFileSync('git',['show',base+':'+file],{encoding:'utf8'}),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,oldModule.filename);
 const preview=await previewPlanScenario(deps,householdId,initial.semanticState);
 const oldCaps=oldModule.exports.publishAdjustmentCapabilities(world,initial.semanticState,preview);
 const matrix=preview.compiled.planSlots.map(slot=>{const c=cards(initial).find(c=>c.targetRef===slot.baseline.slotIdentityKey);return {
  identity:c.targetRef,label:c.label,kind:slot.baseline.kind,owner:world.baseline.sourceRefs.filter(r=>slot.baseline.sourceRefs.includes(r.sourceKey)).map(r=>r.owner),
  sourceRefs:slot.baseline.sourceRefs,baseline:slot.baseline.baselineValue,baselineCapabilities:slot.baseline.capabilities,gate:slot.baseline.simpleAuthority?.gate??null,
  floor:slot.baseline.simpleAuthority?.hardFloor??null,renewal:slot.baseline.renewalAuthority??null,
  before:oldCaps.find(cap=>cap.targetRef===c.targetRef)??null,after:c.capability,editor:initial.controlEditors.find(e=>e.targetRef===c.targetRef),
  scope:{month:initial.semanticState.targetMonth,subject:slot.baseline.scope},classification:!c.capability?.actions.length?'BLOCKED_MISSING_OWNER':c.capability.flexibility==='LOCKED'?'INTENDED_CONSTRAINT':'CONFIRMED_CODE'};});
 const renewal=renewalMonth().world,renewalDeps={...deps,readWorld:async()=>renewal};
 const renewalModel=ok(await handleComposerRequest(renewalDeps,householdId,{kind:'READ',sequence:++sequence,targetMonth:'2026-11',draft:state()}));
 for(const c of cards(renewalModel).filter(c=>!matrix.some(r=>r.identity===c.targetRef))){const slot=renewal.baseline.slots.find(s=>s.slotIdentityKey===c.targetRef);matrix.push({identity:c.targetRef,label:c.label,kind:slot?.kind,baseline:slot?.baselineValue,renewal:slot?.renewalAuthority,baselineCapabilities:slot?.capabilities,after:c.capability,editor:renewalModel.controlEditors.find(e=>e.targetRef===c.targetRef),scope:{month:'2026-11'},classification:c.capability?.flexibility==='LOCKED'?'INTENDED_CONSTRAINT':'CONFIRMED_CODE'});}
 fs.writeFileSync('docs/status/evidence/l3-3-composer-workshop/capability-matrix.json',JSON.stringify({environment:'SYNTHETIC_ONLY',controls:matrix,obligations:world.baseline.structuralFacts.obligations},null,2));
 const coffee=cards(initial).find(c=>c.label.includes('Café'));
 assert.ok(coffee,'Fixture must have coffee');
 let current=initial;
 await check('T01-COFFEE-ZERO-KNOWN-UNKNOWN',async()=>{
  current=ok(await mutate(initial,coffee.targetRef,{count:'0'}));
  assert.equal(cards(current).find(c=>c.targetRef===coffee.targetRef).value.economicAmount,'0.00');
  const slot=world.baseline.slots.find(c=>c.slotIdentityKey===coffee.targetRef),prior=slot.baselineValue;
  slot.baselineValue={...prior,unitAmount:null}; world.baseline.digest=planningBaselineDigest(world.baseline);
  const unknown=ok(await mutate(initial,coffee.targetRef,{count:'0'}));assert.equal(cards(unknown).find(c=>c.targetRef===coffee.targetRef).value.unitAmount,null);assert.equal(cards(unknown).find(c=>c.targetRef===coffee.targetRef).value.economicAmount,'0.00');
  slot.baselineValue=prior; world.baseline.digest=planningBaselineDigest(world.baseline);
 });
 await check('T02-T03-PRICE-COUNT-PRESERVED-AND-OFFICIAL-COST',async()=>{
  current=ok(await mutate(initial,coffee.targetRef,{count:'12',unitAmount:'1.80'}));
  assert.equal(cards(current).find(c=>c.targetRef===coffee.targetRef).value.economicAmount,'21.60');
  const price=controlInputValue(cards(current).find(c=>c.targetRef===coffee.targetRef),'unitAmount','2.10');
  current=ok(await mutate(current,coffee.targetRef,price));assert.equal(cards(current).find(c=>c.targetRef===coffee.targetRef).value.economicAmount,'25.20');
  const value=controlInputValue(cards(current).find(c=>c.targetRef===coffee.targetRef),'count','13');
  assert.deepEqual(value,{count:'13',unitAmount:'2.10'});
  const operation={kind:'MUTATE',mutation:{kind:'SET_STATE',targetRef:coffee.targetRef,value}};
  const local=stageLocalDecision(current,current.semanticState,operation);const visual=visualDraftModel(current,local);
  assert.deepEqual(controlInputValue(cards(visual).find(c=>c.targetRef===coffee.targetRef),'count','14'),{count:'14',unitAmount:'2.10'});
  const before=current.semanticState;current=ok(await req(operation,current.semanticState));assert.deepEqual(current.semanticState,local);
  assert.deepEqual(parsePlanSemanticState(JSON.parse(JSON.stringify(before))),before);
  assert.deepEqual(parsePlanSemanticState(JSON.parse(JSON.stringify(current.semanticState))),current.semanticState);
 });
 await check('T04-T05-SERVER-ADMISSION-AND-PROTECTIONS',async()=>{
  for(const value of [{count:'-1'},{count:'1.2'},{count:'10000'},{count:'1',unitAmount:'-1'},{count:'1',unitAmount:'2.001'},{amount:'3'}]) assert.equal((await mutate(initial,coffee.targetRef,value)).ok,false,JSON.stringify(value));
  const protectedModel=ok(await req({kind:'PRESERVE',targetRef:coffee.targetRef,preserve:true},current.semanticState));
  assert.equal((await mutate(protectedModel,coffee.targetRef,{count:'0'})).ok,false);
  assert.equal((await mutate(initial,'non-existent',{amount:'1'})).ok,false);
  const wrong=await handleComposerRequest(deps,householdId,{kind:'READ',sequence:++sequence,targetMonth:'2026-12',draft:state()});assert.equal(wrong.ok,false);
 });
 await check('T06-LEGACY-COUNT-ONLY-AND-BASELINE-NONMUTATION',async()=>{
  const legacy=state([control(coffee.targetRef,{count:'2'},310)]);const a=await previewPlanScenario(deps,householdId,legacy),b=await previewPlanScenario(deps,householdId,parsePlanSemanticState(JSON.parse(JSON.stringify(legacy))));
  assert.equal(a.compiledManifestDigest,b.compiledManifestDigest);assert.deepEqual(a.projection,b.projection);
  assert.equal(legacy.controls[0].value.unitAmount,undefined);assert.equal(world.baseline.slots.find(s=>s.slotIdentityKey===coffee.targetRef).baselineValue.count,coffee.value.count);
 });
 await check('T07-FRENCH-NORMALIZATION-INVALID-NOT-ZERO',()=>{
  for(const [input,expected]of [['1 234,50','1234.50'],['1\u202f234.50','1234.50'],['0','0.00'],['12,5','12.50'],['0012.50','12.50']])assert.equal(normalizeControlInput(input),expected);
  for(const bad of ['','x','-1','1,234','12 34','1.2.3'])assert.throws(()=>normalizeControlInput(bad));assert.throws(()=>normalizeControlInput('1.2',true));
 });
 await check('T11-T12-T13-EXPLICIT-REUSE-NO-OVERWRITE',()=>{
  const digest=semanticStateDigest(initial.semanticState),proposals=monthReuseProposals(initial);assert.equal(semanticStateDigest(initial.semanticState),digest);assert.ok(proposals.length);
  for(const p of proposals)assert.equal(p.reference.suggestionPolicy,'OFFER_PREFILL');
  assert.ok(!monthReuseProposals(current).some(p=>p.targetRef===coffee.targetRef));
 });
 await check('T04-T05-REAL-FLOOR-EXTERNAL-SAVINGS-AND-RENEWALS',async()=>{
  const baseline=structuredClone(world.baseline);
  const g=world.baseline.slots.find(s=>s.semanticKey==='groceries');g.simpleAuthority={...g.simpleAuthority,hardFloor:{amount:'100.00',authority:'CANONICAL_OBSERVED_CONSUMPTION',evidenceRefs:['synthetic-current-consumption']}};
  world.baseline.digest=planningBaselineDigest(world.baseline);
  assert.equal((await mutate(initial,g.slotIdentityKey,{amount:'99.00'})).ok,false);
  const reservation=world.baseline.structuralFacts.savingsReservations.find(r=>r.reservationId!=='policy:safety-reserve');reservation.adjustability='PROTECTED';world.baseline.digest=planningBaselineDigest(world.baseline);
  const guarded=ok(await req({kind:'READ'},state()));const saving=cards(guarded).find(c=>c.targetRef==='savings:'+reservation.reservationId);
  assert.equal(saving.capability.fields.amount.status,'PROTECTED_BY_RULE');assert.equal((await mutate(guarded,saving.targetRef,{amount:'0.00'})).ok,false);
  const external=cards(guarded).find(c=>c.label==='Trajets travail fixes');assert.equal((await mutate(guarded,external.targetRef,{count:'0'})).ok,false);
  world.baseline=baseline;
 });
 await check('T17-T18-PURCHASE-COVERAGE-COST-AND-ROUNDTRIP',async()=>{
  const id=uuid(33400),created=ok(await req({kind:'DROP',assetKey:'template:purchase',target:{kind:'BOARD_ZONE'},values:{},identity:id,selectionId:uuid(33401),presetKey:'trash-bags'},initial.semanticState));
  const purchase=created.semanticState.contexts.find(c=>c.contextOccurrenceId===id);assert.equal(purchase.fields.productLabel,'Sacs-poubelle');assert.equal(purchase.fields.plannedDate,undefined);
  let model=ok(await req({kind:'EDIT_PRESET_CONTEXT',edit:{contextOccurrenceId:id,slots:{item:[{selectionId:uuid(33402),kind:'COMPONENT',optionKey:'item',label:'Sacs-poubelle',quantity:'1',unitBasis:'SHARED',provenance:'EXPLICIT_USER_DECISION',cost:{kind:'MANUAL',unitAmount:'4.00'},binding:{mode:'CONFIRMED_CONSUMPTION'},fundingAllocations:[]}]}}},created.semanticState));
  const covered=await previewPlanScenario(deps,householdId,model.semanticState);assert.equal(covered.compiled.components.filter(c=>c.contextOccurrenceId===id).length,1);assert.equal(covered.compiled.components.find(c=>c.contextOccurrenceId===id).evaluation.economicAmount,'4.00');
  const before=model.semanticState.contexts.find(c=>c.contextOccurrenceId===id),item=before.slotSelections.item.items[0];
  model=ok(await req({kind:'EDIT_PRESET_CONTEXT',edit:{contextOccurrenceId:id,slots:{item:[{...item,cost:{kind:'MANUAL',unitAmount:'5.00'}}]}}},model.semanticState));
  const after=model.semanticState.contexts.find(c=>c.contextOccurrenceId===id);assert.deepEqual(after.fields,before.fields);assert.deepEqual(after.slotSelections.item.items[0].binding,item.binding);assert.equal(after.slotSelections.item.items[0].selectionId,item.selectionId);
  assert.deepEqual(parsePlanSemanticState(JSON.parse(JSON.stringify(model.semanticState))),model.semanticState);
  const extra=await previewPlanScenario(deps,householdId,{...model.semanticState,contexts:model.semanticState.contexts.map(c=>c.contextOccurrenceId===id?{...c,slotSelections:{item:{items:[{...item,binding:{mode:'EXTRA_TO_SLOT'}}]}}}:c)});
  assert.equal(extra.compiled.components.filter(c=>c.contextOccurrenceId===id).length,1);assert.equal(extra.compiled.mobilityIntents.length,0);
 });
 await check('T15-T16-T20-READONLY-STRUCTURAL-UNKNOWN-AND-PAGINATION',()=>{
  const facts=[{factKey:'obligation:known',label:'Charge synthétique',value:{low:'50.00',central:'50.00',high:'50.00'},knowledge:'KNOWN',provenance:['CANONICAL_FACT'],sourceRefs:['existing-owner'],dueDate:'2026-11-15',metadata:{ownerAuthority:'Fixture owner'}},
    {factKey:'obligation:unknown',label:'Charge inconnue',value:{low:null,central:null,high:null},knowledge:'UNKNOWN',provenance:['CANONICAL_FACT'],sourceRefs:['existing-owner'],dueDate:null,metadata:{ownerAuthority:'Fixture owner'}}];
  const digest=semanticStateDigest(current.semanticState);
  const html=renderToStaticMarkup(React.createElement(FixedChargeCard,{facts,open(){},reattach(){}}));assert.match(html,/1 montant/);assert.match(html,/1 à préciser/);assert.ok(!html.includes('0,00'));
  const details=renderToStaticMarkup(React.createElement(FixedChargesDetails,{facts,detached:new Set(),toggle(){},close(){}}));assert.match(details,/2026-11-15/);assert.match(details,/Fixture owner/);assert.match(details,/Charge inconnue/);
  const card={id:'fixed:group',kind:'FIXED',iconKey:'home',width:230,height:160,density:'NORMAL',spatialFamily:'OTHER',facts,detached:false};
  const single=renderToStaticMarkup(React.createElement(BoardCarousel,{model:initial,inventory:[card],focused:null,render:()=>null,emptyClick(){},dropProps:{}}));assert.ok(!single.includes('data-carousel-nav'));
  const many=renderToStaticMarkup(React.createElement(BoardCarousel,{model:initial,inventory:Array.from({length:30},(_,n)=>({...card,id:'fixed:'+n})),focused:null,render:()=>null,emptyClick(){},dropProps:{}}));assert.ok(many.includes('data-carousel-nav'));
  assert.equal(semanticStateDigest(current.semanticState),digest);
 });
 await check('L33-SCOPE-EXACT-OWNER-ALLOWLIST' ,()=>{
  const allowed=new Set(['src/domain/phase2/planner/adjustment-contract.ts','src/domain/phase2/planner/composer-contract.ts','src/domain/phase2/planner/control-input.ts','src/domain/phase2/planner/month-reuse.ts',
   'src/server/phase2/planner/control-fields.ts','src/server/phase2/planner/balance-assistant.ts','src/server/phase2/planner/composer-service.ts','src/server/phase2/planner/constraint-engine.ts','src/server/phase2/planner/plan-slot-resolver.ts','src/server/phase2/planner/read-model.ts',
   // PRE-L4 C1: exact server admission and immutable historical-read paths.
   'src/server/phase2/planner/historical-control-admission.ts','src/server/phase2/planner/apply.ts','src/server/phase2/planner/compiler.ts',
   'src/server/phase2/planner/preview.ts','src/server/phase2/planner/draft-reader.ts','src/server/phase2/planner/effective-month-scenario.ts',
   'src/server/phase2/planner/effective-simulation.ts','src/server/phase2/planner/world-reader.ts','src/server/phase2/planner/prospective-mobility-pricing.ts']);
  const changed=execFileSync('git',['diff',base,'--name-only','--','src/server','src/domain','supabase','src/app/mois-a-venir/composer/durable-draft.ts','src/app/mois-a-venir/composer/preview-scheduler.ts'],{encoding:'utf8'}).trim().split(/\r?\n/).filter(Boolean);
  assert.deepEqual(changed.filter(f=>!allowed.has(f)),[]);
 });
 await check('T03-APPLY-RELOAD-PRICE-IDENTITY-CAS-ISOLATED',async()=>{
  const ready=ok(await req({kind:'READ'},current.semanticState));
  const applied=await req({kind:'APPLY',command:{...ready.proof,applyRequestId:uuid(33900)}},ready.semanticState);assert.equal(applied.ok,true,JSON.stringify(applied));
  const reload=ok(await req({kind:'READ'}));assert.deepEqual(reload.semanticState,ready.semanticState);const decision=reload.semanticState.controls.find(c=>c.decisionSlotKey===coffee.targetRef);assert.equal(decision.value.unitAmount,'2.10');assert.equal(decision.value.count,'13');
  await pg.verifyCanaries();
 });
 assert.equal(COMPOSER_PRESETS.length,47);
 fs.writeFileSync('docs/status/evidence/l3-3-composer-workshop/contract-tests.json',JSON.stringify({environment:'PGLITE_SYNTHETIC_ONLY',authenticated:false,checks,financialSourceWrites:0},null,2)+'\n');
} finally {await pg.close();}
