/** Courses admission and real React handlers; no SQL, durable writer or network. */
import assert from 'node:assert/strict';
import path from 'node:path';
import Module,{createRequire} from 'node:module';
import {require} from './lib/phase2-ts-loader.mjs';
import {coursesFixture} from './fixtures/composer-v22-b2-courses.mjs';
import {householdId,findSlot} from './fixtures/planner-headless.mjs';
const rr=process.env.PLANNER_REACT_TEST_TOOLS?createRequire(path.resolve(process.env.PLANNER_REACT_TEST_TOOLS,'package.json')):require;
const React=rr('react'),jsx=rr('react/jsx-runtime'),{create,act}=rr('react-test-renderer'),load=Module._load;
Module._load=function(n,p,...args){if(n==='react')return React;if(n==='react/jsx-runtime')return jsx;return load.call(this,n,p,...args);};
globalThis.IS_REACT_ACT_ENVIRONMENT=true;let focusCount=0;
const frames=[];globalThis.requestAnimationFrame=callback=>{frames.push(callback);return 1;};globalThis.cancelAnimationFrame=()=>{};
let remote=0;globalThis.fetch=async()=>{remote++;throw Error('B2_REMOTE_FORBIDDEN');};
const {handleComposerRequest}=require('@/server/phase2/planner/composer-service');
const {stageLocalDecision,visualDraftModel}=require('@/app/mois-a-venir/composer/local-draft');
const {evaluatePlanScenario}=require('@/server/phase2/planner/preview');
const {MonthlyDraftControl}=require('@/app/mois-a-venir/composer/monthly-draft-control');
const {InlineEditContext,InlineEditRegistry}=require('@/app/mois-a-venir/composer/inline-edit-registry');
const f=coursesFixture(),worldBefore=JSON.stringify(f.world);
async function read(fixture=f,draft=fixture.semantic){const r=await handleComposerRequest(fixture.deps,householdId,{kind:'READ',sequence:0,targetMonth:fixture.semantic.targetMonth,draft});assert(r.ok,`${r.code}: ${r.message}`);return r.model;}
const base=await read(),card=m=>m.board.baselineControls.find(c=>c.targetRef===f.targetRef);
let root,model,current,registry,accepted;
function Harness(){const [s,setS]=React.useState(current);const shown=visualDraftModel(model,s);return React.createElement(InlineEditContext.Provider,{value:registry},React.createElement(MonthlyDraftControl,{model:shown,card:card(shown),groceries:true,busy:false,decide(op){const next=stageLocalDecision(model,current,op);if(!next)return false;current=next;accepted.push(op);setS(next);return true;}}));}
const text=n=>typeof n==='string'?n:(n.children??[]).map(text).join('');
const button=label=>root.root.findAll(n=>n.type==='button').find(n=>text(n)===label);
const click=async label=>{const n=button(label);assert(n);assert(!n.props.disabled);await act(async()=>n.props.onClick());};
const input=()=>root.root.findByType('input');
const fill=async value=>act(async()=>input().props.onChange({target:{value}}));
const submit=async()=>{await act(async()=>root.root.findByType('form').props.onSubmit({preventDefault(){}}));await act(async()=>{for(const frame of frames.splice(0))frame();});};
async function mount(m=base){if(root)await act(async()=>root.unmount());model=structuredClone(m);current=model.semanticState;accepted=[];registry=new InlineEditRegistry();await act(async()=>{root=create(React.createElement(Harness),{createNodeMock:e=>e.type==='button'?{focus(){focusCount++;}}:null});});}
const checks=[];async function check(name,fn){await fn();checks.push(name);console.log(name+' PASS');}
try{
 await check('B2-01-OWNER-FLOOR-AND-LOCAL-ADMISSION',async()=>{
  assert.equal(card(base).capability.fields.amount.minimum,'230.00');assert(card(base).capability.actions.includes('SET_SLOT_AMOUNT'));
  assert.equal(findSlot(f.world,'groceries').simpleAuthority.hardFloor.authority,'CANONICAL_OBSERVED_CONSUMPTION');
  await mount();await click('Ajuster la cible');assert.equal(input().props.value,'250.00');await fill('240,00');await submit();
  assert.equal(current.controls.length,1);assert.equal(current.controls[0].value.amount,'240.00');assert.equal(current.controls[0].decisionId,f.semantic.controls[0].decisionId);
  assert.equal(current.controls[0].decisionSlotKey,f.targetRef);assert.equal(current.targetMonth,'2026-11');assert.equal(accepted.length,1);assert.equal(registry.count(),0);assert(focusCount>0);
  assert.match(text(root.toJSON()),/240,00/);
  const server=await handleComposerRequest(f.deps,householdId,{kind:'MUTATE',sequence:1,targetMonth:'2026-11',draft:f.semantic,mutation:accepted[0].mutation});
  assert.equal(server.ok,true);assert.equal(server.model.semanticState.controls.length,1);
  assert.equal(server.model.semanticState.controls[0].value.amount,'240.00');
  assert.equal(server.model.semanticState.controls[0].decisionId,f.semantic.controls[0].decisionId);
 });
 await check('B2-02-FLOOR-REFUSAL-LOCAL-SERVER-AND-COMPILER',async()=>{
  await click('Ajuster la cible');await fill('220');await submit();assert.equal(accepted.length,1);assert.equal(current.controls[0].value.amount,'240.00');assert.equal(input().props.value,'220');assert(root.root.findAll(n=>n.props.role==='alert').length);
  const mutation={kind:'SET_STATE',targetRef:f.targetRef,value:{amount:'220.00'}};
  assert.throws(()=>stageLocalDecision(base,current,{kind:'MUTATE',mutation}),/COMPOSER_CONTROL_FIELD_NOT_ADMITTED/);
  const r=await handleComposerRequest(f.deps,householdId,{kind:'MUTATE',sequence:1,targetMonth:'2026-11',draft:current,mutation});assert.equal(r.ok,false);assert.equal(r.code,'COMPOSER_CONTROL_FIELD_NOT_ADMITTED');
  const compiled=evaluatePlanScenario(f.world,{...current,controls:[{...current.controls[0],value:{amount:'220.00'}}]},{expectedActiveRevisionId:null,expectedActiveRevisionNumber:0});assert(compiled.compiled.constraints.some(c=>c.code==='SIMPLE_REAL_HARD_FLOOR_VIOLATED'&&c.severity==='BLOCK'));
 });
 await check('B2-03-RAW-AND-CANCEL-ARE-NOT-DECISIONS',async()=>{
  await fill('12,');await submit();assert.equal(input().props.value,'12,');assert.equal(registry.count(),1);assert.equal(accepted.length,1);assert.equal(current.controls[0].value.amount,'240.00');await click('Annuler la saisie');assert.equal(registry.count(),0);
 });
 await check('B2-04-MONTH-ISOLATION-AND-REFERENCE-PRESERVED',async()=>{
  for(const month of ['2026-10','2026-12']){const adjacent=coursesFixture(month),snapshot=JSON.stringify(adjacent.world),m=await read(adjacent);assert.equal(m.semanticState.controls[0].value.amount,'250.00');assert.equal(JSON.stringify(adjacent.world),snapshot);}
  const cross=await handleComposerRequest(f.deps,householdId,{kind:'READ',sequence:2,targetMonth:'2026-11',draft:{...current,targetMonth:'2026-12'}});assert.equal(cross.ok,false);assert.equal(cross.code,'PLANNER_DRAFT_MONTH_INVALID');
  assert.equal(JSON.stringify(f.world),worldBefore);assert.equal(findSlot(f.world,'groceries').baselineValue.amount,'325.00');assert.equal(f.world.sources.evidence.currentEconomicEntries[0].amount,'230.00');
 });
 await check('B2-05-NO-CAPABILITY-SERVER-REFUSAL-AND-SCOPE',async()=>{
  const neg=coursesFixture('2026-11','no-capability'),m=await read(neg);await mount(m);assert(button('Ajuster la cible').props.disabled);
  const r=await handleComposerRequest(neg.deps,householdId,{kind:'MUTATE',sequence:3,targetMonth:'2026-11',draft:neg.semantic,mutation:{kind:'SET_STATE',targetRef:neg.targetRef,value:{amount:'240.00'}}});assert.equal(r.ok,false);assert.match(r.code,/COMPOSER_CONTROL_LOCKED|COMPOSER_CONTROL_FIELD_NOT_ADMITTED/);
  for(const patch of [m=>{m.semanticState.targetMonth='2026-12';},m=>{card(m).capability.flexibility='LOCKED';}]){const guarded=structuredClone(base);patch(guarded);await mount(guarded);assert(button('Ajuster la cible').props.disabled);}
 });
 await check('B2-06-NO-FINANCIAL-DUPLICATE-WRITER-OR-WORLD-MUTATION',()=>{
  assert.equal(JSON.stringify(f.world),worldBefore);assert.deepEqual(f.writes,[]);assert.equal(remote,0);assert.equal(f.semantic.contexts.length,0);assert.equal(f.semantic.controls.length,1);
 });
 await check('B2-07-REFERENCE-NOT-ADOPTED-AND-UNKNOWN-NOT-ZERO',async()=>{
  const reference=await read(f,{...f.semantic,controls:[]});await mount(reference);
  assert.equal(current.controls.length,0);assert.match(text(root.toJSON()),/aucune nouvelle cible choisie/);
  await click('Ajuster la cible');assert.equal(input().props.value,'325.00');await click('Annuler la saisie');
  assert.equal(current.controls.length,0);assert.equal(accepted.length,0);
  const unknown=structuredClone(reference);card(unknown).value.amount=null;card(unknown).value.decisionValue=null;
  await mount(unknown);await click('Ajuster la cible');assert.equal(input().props.value,'');
  assert.equal(current.controls.length,0);assert.equal(accepted.length,0);assert.equal(remote,0);assert.deepEqual(f.writes,[]);
 });
 console.log(JSON.stringify({status:'PASS',checks,level:'EDITOR_LOCAL_REACT_AND_OWNER_VALIDATORS',targetRef:f.targetRef,sql:0,remote,writers:f.writes.length,saved:false,fresh:false,apply:false,browser:'NOT_RUN_BY_THIS_SCRIPT'}));
}finally{if(root)await act(async()=>root.unmount());Module._load=load;}
