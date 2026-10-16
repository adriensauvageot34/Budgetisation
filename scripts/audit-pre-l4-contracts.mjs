// Focused A0 evidence: no product edits, remote I/O, or refreshed goldens.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {require} from './lib/phase2-ts-loader.mjs';
import {createKernelPostgres} from './lib/planner-kernel-postgres.mjs';
import {fixture,state,uuid,householdId,control} from './fixtures/planner-headless.mjs';
const {handleComposerRequest}=require('@/server/phase2/planner/composer-service');
const {createPlanApplyRepository}=require('@/server/phase2/planner/repository');
const {previewPlanScenario}=require('@/server/phase2/planner/apply');
const {planningBaselineDigest}=require('@/server/phase2/planner/baseline');
const {semanticStateDigest}=require('@/domain/phase2/planner/semantic-state');
const {controlInputValue,controlAccessLabel}=require('@/domain/phase2/planner/control-input');
const {monthReuseProposals}=require('@/domain/phase2/planner/month-reuse');
const {resolveContextTemplate}=require('@/server/phase2/planner/context-registry');
const {COMPOSER_PRESETS}=require('@/domain/phase2/planner/composer-presets');
const {ComposerCard}=require('@/app/mois-a-venir/composer/composer-card');
const {ComposerFinancialInspector}=require('@/app/mois-a-venir/composer/composer-financial-inspector');
const React=require('react'),{renderToStaticMarkup}=require('react-dom/server');
globalThis.fetch=async()=>{throw Error('A0_REMOTE_FORBIDDEN');};
const out='docs/status/evidence/pre-l4-audit';fs.mkdirSync(out,{recursive:true});
function fingerprints(){
 const walk=dir=>fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(dir+'/'+e.name):[dir+'/'+e.name]);
 const files=[...['src','public','supabase'].flatMap(walk),...['package.json','package-lock.json','next.config.ts'].filter(f=>fs.existsSync(f))];
 fs.writeFileSync(out+'/product-fingerprints.json',JSON.stringify({base:'5cfb1211d114ddaa574f63372cdb9c4cfc7e660d',files:files.map(file=>({file,sha256:crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')}))},null,2)+'\n');
}
if(process.argv.includes('--fingerprints-only')){fingerprints();console.log('A0-FINGERPRINTS PASS');process.exit(0);}
const pg=await createKernelPostgres(),world=fixture(),deps={repository:createPlanApplyRepository(pg.client),readWorld:async()=>world,householdPersons:[]};
let sequence=0;const req=(operation,draft)=>handleComposerRequest(deps,householdId,{sequence:++sequence,targetMonth:'2026-11',draft,...operation});
const ok=r=>{assert.equal(r.ok,true,JSON.stringify(r));return r.model;};
const cards=m=>[...m.board.baselineControls,...m.board.discretionaryControls,...m.board.savings];
const change=(m,ref,value)=>req({kind:'MUTATE',mutation:{kind:'SET_STATE',targetRef:ref,value}},m.semanticState);
const checks=[],observations=[];
async function check(id,fn){await fn();checks.push({id,status:'EXECUTED_PASS',environment:'REAL_SERVICES_PGLITE_SYNTHETIC_ONLY'});console.log(id+' PASS');}
try{
 const initial=ok(await req({kind:'READ'},state()));
 const groceries=cards(initial).find(c=>c.label==='Courses'),coffee=cards(initial).find(c=>c.label.includes('Café')),clothes=cards(initial).find(c=>c.label==='Vêtements');
 await check('A0-P01-COURSES-250-300-SUBSTITUTION',async()=>{
  let m=ok(await change(initial,groceries.targetRef,{amount:'250.00'}));m=ok(await change(m,groceries.targetRef,{amount:'300.00'}));
  assert.equal(cards(m).find(c=>c.targetRef===groceries.targetRef).value.amount,'300.00');assert.equal(m.semanticState.controls.filter(c=>c.decisionSlotKey===groceries.targetRef).length,1);
  const p=await previewPlanScenario(deps,householdId,m.semanticState);assert.equal(p.compiled.planSlots.find(s=>s.baseline.slotIdentityKey===groceries.targetRef).effectiveAmount,'300.00');
 });
 await check('A0-P02-COFFEE-SEQUENCE-ZERO-AND-RESTORE',async()=>{
  let m=ok(await change(initial,coffee.targetRef,{count:'12',unitAmount:'1.80'}));
  assert.equal(cards(m).find(c=>c.targetRef===coffee.targetRef).value.economicAmount,'21.60');
  m=ok(await change(m,coffee.targetRef,controlInputValue(cards(m).find(c=>c.targetRef===coffee.targetRef),'unitAmount','2.10')));
  assert.equal(cards(m).find(c=>c.targetRef===coffee.targetRef).value.economicAmount,'25.20');const retained=m.semanticState;
  m=ok(await change(m,coffee.targetRef,controlInputValue(cards(m).find(c=>c.targetRef===coffee.targetRef),'count','0')));
  assert.equal(cards(m).find(c=>c.targetRef===coffee.targetRef).value.economicAmount,'0.00');assert.equal(m.semanticState.controls[0].value.unitAmount,'2.10');
  const restored=ok(await req({kind:'READ'},retained));assert.equal(cards(restored).find(c=>c.targetRef===coffee.targetRef).value.economicAmount,'25.20');
  const slot=world.baseline.slots.find(s=>s.slotIdentityKey===coffee.targetRef),prior=slot.baselineValue;
  slot.baselineValue={...prior,unitAmount:null};world.baseline.digest=planningBaselineDigest(world.baseline);
  const zero=ok(await change(initial,coffee.targetRef,{count:'0'}));assert.equal(cards(zero).find(c=>c.targetRef===coffee.targetRef).value.economicAmount,'0.00');assert.equal(cards(zero).find(c=>c.targetRef===coffee.targetRef).value.unitAmount,null);
  slot.baselineValue=prior;world.baseline.digest=planningBaselineDigest(world.baseline);
 });
 await check('A0-P03-COUNT-DOES-NOT-ADOPT-HISTORICAL-PRICE',async()=>{
  const m=ok(await change(initial,coffee.targetRef,controlInputValue(coffee,'count','13')));assert.equal(m.semanticState.controls[0].value.unitAmount,undefined);
  const next=ok(await change(m,coffee.targetRef,controlInputValue(cards(m).find(c=>c.targetRef===coffee.targetRef),'unitAmount','2.10')));assert.equal(next.semanticState.controls[0].value.count,'13');
 });
 await check('A0-P04-OPTIONAL-UNDECIDED-AND-VOLUNTARY-ZERO',async()=>{
  const props=card=>({card,presentation:initial.presentation.objects[card.targetRef],busy:false,preserved:false,edit(){},preserve(){},mutate(){},hover(){},details(){}});
  const before=renderToStaticMarkup(React.createElement(ComposerCard,props(clothes)));assert.match(before,/À définir/);assert.equal(clothes.value.decisionValue,null);
  const m=ok(await change(initial,clothes.targetRef,{amount:'0.00'})),card=cards(m).find(c=>c.targetRef===clothes.targetRef);
  assert.equal(card.value.decisionValue.amount,'0.00');const after=renderToStaticMarkup(React.createElement(ComposerCard,{...props(card),presentation:m.presentation.objects[card.targetRef]}));assert.match(after,/Prévu/);assert.ok(!after.includes('À définir'));
 });
 await check('A0-P05-CURRENT-VS-FUTURE-MONTH-SCOPE',async()=>{
  const draft=state([control(groceries.targetRef,{amount:'300.00'},441)]),digest=semanticStateDigest(draft),before=world.asOfDate;
  for(const date of ['2026-10-16','2026-11-15']){world.asOfDate=date;const m=ok(await req({kind:'READ'},draft));assert.equal(cards(m).find(c=>c.targetRef===groceries.targetRef).value.amount,'300.00');assert.equal(semanticStateDigest(m.semanticState),digest);}
  world.asOfDate=before;
 });
 const inspector=renderToStaticMarkup(React.createElement(ComposerFinancialInspector,{model:initial,mode:'FINANCE',stale:false,focused:null,focus(){},close(){}}));
 assert.equal(controlAccessLabel(clothes),'Choix de ce mois');assert.match(inspector,/Retrouver mes décisions/);
 observations.push({id:'A0-D02',classification:'CONFIRMED_DEFECT',environment:'SOURCE_AND_REAL_REACT_SSR',problem:'Editable reference with no explicit decision is labelled Choix de ce mois in inspector and manage library',decisionValue:clothes.value.decisionValue,baselineAmount:clothes.value.amount});
 fs.writeFileSync(out+'/inspector-undecided.html',inspector);
 await check('A0-P08-REUSE-NO-OVERWRITE-AND-POLICY',async()=>{
  const digest=semanticStateDigest(initial.semanticState),proposals=monthReuseProposals(initial);assert.equal(semanticStateDigest(initial.semanticState),digest);
  for(const p of proposals)assert.equal(p.reference.suggestionPolicy,'OFFER_PREFILL');
  const explicit=ok(await change(initial,groceries.targetRef,{amount:'250.00'}));assert.ok(!monthReuseProposals(explicit).some(p=>p.targetRef===groceries.targetRef));
 });
 await check('A0-P11-OFFICIAL-PLAN-ISOLATED-AND-IDENTITY',async()=>{
  const m=ok(await change(initial,coffee.targetRef,{count:'12',unitAmount:'2.10'}));const applied=await req({kind:'APPLY',command:{...m.proof,applyRequestId:uuid(449)}},m.semanticState);assert.equal(applied.ok,true,JSON.stringify(applied));
  const reload=ok(await req({kind:'READ'}));assert.deepEqual(reload.semanticState,m.semanticState);assert.equal(reload.activeRevisionNumber,1);await pg.verifyCanaries();
 });
 const keys=['techno-night','weekend-gite','fontes-family-visit','clothing-shopping','gift-present'];
 const scenarios=keys.map(key=>{const p=COMPOSER_PRESETS.find(p=>p.presetKey===key);const t=resolveContextTemplate(p.templateKey);return {preset:p,template:t};});
 fs.writeFileSync(out+'/l4-contracts-published.json',JSON.stringify(scenarios,null,2)+'\n');
}finally{await pg.close();fs.writeFileSync(out+'/targeted-contracts.json',JSON.stringify({checks,observations,remoteCalls:0,productionWrites:0},null,2)+'\n');}
fingerprints();
