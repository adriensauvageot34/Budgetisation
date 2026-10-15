// Actual server actions + Compiler/V2 + C0/PE/MonthInputs migrations on synthetic
// PostgreSQL. No network, real credentials, household data or live Auth JWT.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import Big from 'big.js';
import { performance } from 'node:perf_hooks';
import { require } from './lib/phase2-ts-loader.mjs';
import { planningHarness, value, item, draft } from './lib/planned-actions-harness.mjs';
import { fixture, control, context, seal, uuid, householdId, userId } from './fixtures/planner-kernel.mjs';
import { state, weekendMonth, activity } from './fixtures/planner-headless.mjs';
import { createKernelPostgres } from './lib/planner-kernel-postgres.mjs';
import { prospectivePostgres } from './lib/b3-prospective-postgres.mjs';
import { expenseDraft } from './lib/planned-expense-memory-client.mjs';
const monthly=require('@/server/phase2/month-inputs'),realRead=monthly.readMonthInputs,realSave=monthly.saveMonthInputs;
const h=planningHarness({householdId,userId}),a=h.actions,s=h.service;
const pg=await createKernelPostgres({plannedExpenses:true,monthlyInputs:true}),sql=prospectivePostgres(pg);
const originalFrom=h.client.from.bind(h.client);
h.client.from=table=>['phase2_month_plans','phase2_month_plan_revisions'].includes(table)?pg.client.from(table)
  :['phase2_month_inputs','phase2_planned_expenses'].includes(table)?sql.from(table):originalFrom(table);
monthly.readMonthInputs=realRead;monthly.saveMonthInputs=realSave;
const { createPlanApplyRepository }=require('@/server/phase2/planner/repository');
const { previewPlanScenario,applyPlanScenario }=require('@/server/phase2/planner/apply');
const { loadEffectiveMonthSimulation,effectiveChoiceContext }=require('@/server/phase2/planner/effective-simulation');
const { evaluatePlanScenario }=require('@/server/phase2/planner/preview');
const { resolveEffectiveMonthScenario }=require('@/server/phase2/planner/effective-month-scenario');
const { plannerDigest }=require('@/domain/phase2/planner/json');
const { deriveMonthScenario }=require('@/server/phase2/month-scenario');
const { reconcilePlannedObservations }=require('@/server/phase2/planned-observation-reconciliation');
const { matchesForecastCategory }=require('@/server/phase2/remaining-month-forecast');
const { simulateMonthChoice,monthChoiceDigest }=require('@/server/phase2/month-choices');
const { projectMonthControlCenter }=require('@/server/phase2/month-control-center');
const repository=createPlanApplyRepository(pg.client),month='2026-11';
let world=fixture(),worldReads=0,request=97000,failWorld=false;
process.env.SUPABASE_SECRET_KEY='synthetic-b3-undo-key-not-a-credential';
const historyMonths=['2026-04','2026-05','2026-06','2026-07','2026-08','2026-09'];
world.forecast.predictionEvidence={history:{startMonth:historyMonths[0],endMonth:historyMonths.at(-1),mobilityLegs:[],economicEntries:historyMonths.flatMap(month=>[
  {date:`${month}-02`,subcategory:'Courses alimentaires',amount:'100.00'},
  {date:`${month}-10`,subcategory:'Restaurant',amount:'120.00'}].map((row,i)=>({...row,operationId:`synthetic:${month}:${i}`,person:null,preciseType:null,merchant:null})))},
  currentEconomicEntries:[],currentMobilityLegs:[],completeMonths:historyMonths,observedThrough:'2026-09-30',coverageThrough:'2026-09-30',personNamesById:{}};
const saved=()=>s.readPlannedExpenses(h.client,householdId,month);
await realSave(h.client,householdId,month,userId,world.monthInputs);
await realSave(h.client,householdId,'2026-12',userId,world.monthInputs);
require('@/server/phase2/planning-date').planningDate=()=>world.asOfDate;
const deps={repository,readWorld:async()=>{
  worldReads++;if(failWorld)throw Error('Synthetic World unavailable');
  return {...world,monthInputs:(await realRead(h.client,householdId,month)).inputs,externalIntents:await saved()};
}};
require('@/server/phase2/planner/runtime').authorizedPlanner=async()=>({householdId,userId,supabase:h.client,deps});
require('@/server/phase2/month-prediction-evidence').readMonthPredictionEvidence=async()=>world.forecast.predictionEvidence;
const monthlyActions=require('@/app/mois-a-venir/actions');
const choice={operations:[{kind:'SAVINGS',savingsId:uuid(700),strategy:'ADJUST_SAVINGS',amount:'10.00'}]};
const direct=async()=>({forecast:world.forecast,monthInputs:(await realRead(h.client,householdId,month)).inputs,externalIntents:await saved(),asOfDate:world.asOfDate});
const effective=async()=>loadEffectiveMonthSimulation({...deps,readDirectWorld:direct},householdId,month,await direct());
const read=()=>resolveEffectiveMonthScenario({...deps,readDirectWorld:direct},householdId,month);
const checks=[],timings=[],overhead=[];
const test=async(id,run)=>{const start=performance.now();await run();checks.push(id);timings.push({id,ms:performance.now()-start});console.log(`${id} PASS`);};
async function apply(semantic){
  const preview=await previewPlanScenario(deps,householdId,semantic);
  assert.notEqual(preview.projection.applyReadiness,'BLOCKED');
  return applyPlanScenario(deps,householdId,semantic,{expectedActiveRevisionId:preview.baseActiveRevisionId,expectedActiveRevisionNumber:preview.baseRevisionNumber,
    expectedBaselineDigest:preview.baselineDigest,expectedPreviewDigest:preview.previewDigest,applyRequestId:uuid(request++)});
}
const extra=(amount='48.00',date='2026-11-15')=>draft([item(amount)],date);
const command=(p,expense,id=uuid(request++))=>({id:expense?.id??id,expectedUpdatedAt:expense?.updatedAt,
  expectedPlanRevisionId:p.planRevisionId,expectedEffectiveDigest:p.effectiveBaseDigest??undefined});
const money=scenario=>scenario.economicPlan.narrative.final.central;
const delta=(before,after)=>new Big(before).minus(after).toFixed(2);
let extraExpense,restaurant,initial,semantic,R1;
try{
  await test('B3-01_NO_PLAN_LIGHT_PARITY',async()=>{
    const reads=worldReads,writes=sql.writes.length,ctx=await effective();
    assert.equal(ctx.owner,'DIRECT_V2');assert.deepEqual(ctx.evaluate().scenario,deriveMonthScenario(world.forecast,ctx.inputs,null,world.asOfDate,[]));
    const p=value(await a.previewPlannedExpense(month,extra()));assert.equal(p.planRevisionId,null);assert.equal(p.netAdditionalImpact.central,'48.00');
    assert.equal(worldReads,reads);assert.equal(sql.writes.length,writes);
  });
  world.baseline.slots.find(slot=>slot.slotIdentityKey==='restaurants').baselineValue.unitAmount='40.00';
  const ref=world.forecast.referencePlan.flexible[0];ref.low=ref.central=ref.high='120.00';seal(world);
  semantic=state([control('groceries',{amount:'80.00'}),control('restaurants',{count:'3'},2)]);
  R1=await apply(semantic);initial=money((await read()).scenario);
  await test('B3-EXTRA_FIRST_EXTERNAL_EXPENSE_HANDLER_MOUNTED',async()=>{
    const {AppliedMonthView}=require('@/app/mois-a-venir/applied-month-view'),{PlannedExpensesControl}=require('@/app/mois-a-venir/planned-expenses-control');
    const r=await read(),props={projection:r.projection,semanticState:r.semanticState,controls:[],plan:r.scenario.economicPlan,revision:r.revision.revisionNumber,today:world.asOfDate,
      external:{targetMonth:month,expectedPlanRevisionId:r.revision.planRevisionId,expenses:[],persons:[],places:[],vehicle:null,prices:[],wallets:[],funding:r.scenario.economicPlan.plannedFunding}};
    const visit=node=>Array.isArray(node)?node.some(visit):node&&typeof node==='object'&&(node.type===PlannedExpensesControl||visit(node.props?.children));
    assert.equal(visit(AppliedMonthView(props)),true,'the existing Add expense dispatcher needs its consumer even before the first root exists');
  });
  await test('B3-02_EXTRA_PREVIEW_SAVE_RELOAD',async()=>{
    const reads=worldReads,writes=sql.writes.length,p=value(await a.previewPlannedExpense(month,extra()));
    assert.equal(worldReads,reads+1);assert.equal(sql.writes.length,writes);assert.equal(p.netAdditionalImpact.central,'48.00');
    const result=value(await a.savePlannedExpense(month,extra(),command(p)));extraExpense=result.expense;
    assert.equal(result.owner,'PLAN_V1');assert.equal(delta(initial,money(result.scenario)),'48.00');
    assert.equal(money((await read()).scenario),money(result.scenario));assert.equal((await saved()).length,1);
  });
  await test('B3-03_RESTAURANT_ABSORBED',async()=>{
    const raw={...extra('40.00'),familyKey:'food',subtypeKey:'restaurant',costItems:[{...item('40.00','restaurant:main',['restaurant']),baselineKey:'household-restaurants'}]};
    const p=value(await a.previewPlannedExpense(month,raw));assert.equal(p.netAdditionalImpact.central,'0.00');
    restaurant=value(await a.savePlannedExpense(month,raw,command(p))).expense;
    assert.equal(delta(initial,money((await read()).scenario)),'48.00');
  });
  await test('B3-04_EDIT_REPLACES_SAME_ID',async()=>{
    const raw=expenseDraft(restaurant);raw.costItems[0].unitAmount='55.00';
    const p=value(await a.previewPlannedExpense(month,raw,restaurant.id));
    const result=value(await a.savePlannedExpense(month,raw,command(p,restaurant)));
    assert.equal(result.expense.id,restaurant.id);assert.equal(result.expense.costItems[0].id,restaurant.costItems[0].id);
    assert.notEqual(result.expense.updatedAt,restaurant.updatedAt);restaurant=result.expense;
    assert.equal((await saved()).length,2);assert.deepEqual(result.scenario.economicPlan.scenarios,p.after);
  });
  await test('B3-13_OWNED_GUARDS_AND_INDEPENDENT_CHOICES',async()=>{
    const context=effectiveChoiceContext(await effective());
    assert.throws(()=>simulateMonthChoice(context,{operations:[{kind:'CATEGORY',categoryKey:'groceries',strategy:'TEST_AMOUNT',amount:'50.00'}]}),/PLAN_V3_ACTIVE_READ_ONLY/);
    const p=await monthlyActions.previewMonthChoice(month,choice),result=await monthlyActions.applyMonthChoice(month,choice,p.baseDigest);
    assert.equal(result.ok,true);assert.equal(money((await read()).scenario),p.after.central);
    const undone=await monthlyActions.undoMonthChoice(month,result.undoToken);assert.equal(undone.ok,true);
    const reads=worldReads,workbench=await monthlyActions.previewMonthControlCenter(month,{kind:'FREE_EXPLORATION'},choice.operations);
    assert.equal(worldReads,reads+1);assert.equal(workbench.preview.delta,'10.00');
    const ctx=effectiveChoiceContext(await effective()),m=projectMonthControlCenter(ctx);
    assert.equal(m.baseDigest,monthChoiceDigest(ctx));assert.ok(!m.pilotCandidates.some(row=>row.target==='category:groceries'));
    const legacyCtx={...ctx,inputs:{...ctx.inputs,decision:{...ctx.inputs.decision,categoryTargets:{groceries:'1.00'},assumptions:{groceries:{mode:'CUSTOM',amount:'1.00'}}}}};
    const effectiveControls=projectMonthControlCenter(legacyCtx);
    assert.equal(effectiveControls.settings.categoryTargets.groceries,undefined,'an owned legacy target must remain neutralized in presentation');
    assert.equal(effectiveControls.settings.assumptions.groceries,undefined);
    assert.equal(effectiveControls.baseDigest,monthChoiceDigest(legacyCtx),'freshness still binds the raw authoritative inputs');
    const reality=value(await a.previewPlannedExpense(month,expenseDraft(restaurant),restaurant.id));
    const rejected=await a.confirmPlannedExpenseReality(month,expenseDraft(restaurant),command(reality,restaurant));
    assert.equal(rejected.ok,false);assert.equal(rejected.issue.code,'PLANNED_EFFECTIVE_REAL_RECONCILIATION_REQUIRED');
  });
  // Keep restaurants unowned for the already-supported whole-expense reconciliation.
  await apply(state([control('groceries',{amount:'80.00'})]));
  const evidence={history:{startMonth:'2026-04',endMonth:'2026-09',economicEntries:[],mobilityLegs:[]},currentEconomicEntries:[],currentMobilityLegs:[],
    completeMonths:[],observedThrough:'2026-11-20',coverageThrough:'2026-11-20',personNamesById:{}};
  const fact={operationId:uuid(98100),purchaseEventId:uuid(98101),date:'2026-11-15',subcategory:'Restaurant',amount:'42.00',
    person:null,preciseType:null,merchant:'Restaurant synthétique',amountStatus:'KNOWN',fundingComplete:true,bankPaymentObserved:true,funding:{BANK:'42.00',SWILE:'0.00',EDENRED:'0.00'}};
  await test('B3-05_KNOWN_OBSERVATION_HAS_PRIORITY',async()=>{
    world.forecast.predictionEvidence=structuredClone(evidence);world.forecast.predictionEvidence.currentEconomicEntries=[fact];world.asOfDate='2026-11-20';
    const raw=expenseDraft(restaurant);raw.costItems[0].unitAmount='40.00';raw.context.realityLink={kind:'PURCHASE_EVENT',id:fact.purchaseEventId,linkedAt:'2026-11-20T00:00:00Z',linkMode:'USER_CONFIRMED'};
    const p=value(await a.previewPlannedExpense(month,raw,restaurant.id)),result=value(await a.savePlannedExpense(month,raw,command(p,restaurant)));restaurant=result.expense;
    const matches=result.scenario.economicPlan.narrative.prediction.reconciliation;
    const match=matches.find(row=>row.plannedExpenseId===restaurant.id);
    assert.equal(match.observedEconomic,'42.00');assert.equal(match.plannedEconomic,'40.00');assert.equal(match.variance,'2.00');
    assert.equal(result.scenario.economicPlan.plannedExpenses.grossCost,'128.00','80 Plan groceries + 48 independent; matched 40 suppressed');
    assert.equal(result.scenario.economicPlan.narrative.prediction.optional.find(row=>row.key==='household-restaurants').observedEconomic,'42.00');
  });
  await test('B3-06_AMBIGUOUS_OBSERVATIONS_NO_MATCH',async()=>{
    const candidate={...restaurant,context:{seller:fact.merchant},costItems:restaurant.costItems.map(row=>({...row,unitAmount:'42.00'}))};
    const reconciled=reconcilePlannedObservations([candidate],[fact,{...fact,operationId:uuid(98102),purchaseEventId:uuid(98103)}],matchesForecastCategory,{});
    assert.equal(reconciled.matches.length,0);assert.equal(reconciled.unmatchedExpenses.length,1);
  });
  await test('B3-07_PURCHASE_BANK_SINGLE_COST',async()=>{
    const plan=(await read()).scenario.economicPlan;
    const matches=plan.narrative.prediction.reconciliation;
    assert.equal(matches.length,1);assert.equal(matches[0].bankObserved,true);
    assert.equal(matches[0].unbookedBankAmount,'42.00');assert.equal(plan.plannedExpenses.grossCost,'128.00');
  });
  await test('B3-08_COMPOSITE_PARTIAL_GUARD',async()=>{
    const f=weekendMonth(true),before=plannerDigest(f.world),base={expectedActiveRevisionId:null,expectedActiveRevisionNumber:0};
    const p=evaluatePlanScenario(f.world,f.semantic,base);
    const ids=p.compiled.components.map(c=>c.componentId);assert.equal(new Set(ids).size,ids.length);
    const composite={...restaurant,costItems:[...restaurant.costItems,{...item('100.00'),modulePath:['other']}]};
    const result=reconcilePlannedObservations([composite],[fact],matchesForecastCategory,{});
    assert.equal(result.matches.length,0);assert.equal(plannerDigest(f.world),before);
  });
  await test('B3-09_INCOME_UPDATE_IMMUTABLE_PLAN',async()=>{
    const before=await read(),revision=plannerDigest(before.revision);
    const f=new FormData();for(const [key,value]of Object.entries({targetMonth:month,intent:'set-resource-override',resourceKey:'income:Digital Learning Contest',resourceAmount:'1100.00',expectedDigest:monthChoiceDigest(effectiveChoiceContext(await effective()))}))f.set(key,value);
    assert.equal((await monthlyActions.updateMonthControlInputs(f)).ok,true);
    const after=await read();assert.equal(new Big(money(after.scenario)).minus(money(before.scenario)).toFixed(2),'100.00');
    assert.equal(plannerDigest(after.revision),revision);assert.equal(after.evidenceStatus,'CHANGED_AUTHORITIES');
  });
  await test('B3-10_FORECAST_GENERATION_RECHECK',async()=>{
    const p=value(await a.previewPlannedExpense(month,extra('12.00'))),writes=sql.writes.length;
    world.forecast.meta.sourceRevision++;world.forecast.publicationMeta.revision++;world.forecast.resourceMeta.resourceInputHash='synthetic-next-generation';
    const result=await a.savePlannedExpense(month,extra('12.00'),command(p));assert.equal(result.ok,false);assert.equal(result.issue.code,'PLANNED_EFFECTIVE_PLAN_STALE');
    assert.equal(sql.writes.length,writes);assert.equal((await read()).evidenceStatus,'CHANGED_AUTHORITIES');
  });
  await test('B3-11_R1_R2_KEEP_EXTERNAL_AND_REAL',async()=>{
    const historic=plannerDigest(await repository.readRevision(householdId,month,R1.revision.planId,R1.revision.planRevisionId));
    const next=await apply(state([control('groceries',{amount:'85.00'})])),r=await read();
    assert.equal(r.revision.planRevisionId,next.revision.planRevisionId);assert.equal((await saved()).length,2);
    assert.equal(r.scenario.economicPlan.narrative.prediction.reconciliation[0].observedEconomic,'42.00');
    assert.equal(plannerDigest(await repository.readRevision(householdId,month,R1.revision.planId,R1.revision.planRevisionId)),historic);
  });
  await test('B3-12_REPORT_ONE_ROOT_BOTH_MONTHS',async()=>{
    const current=await read(),before=money(current.scenario);
    const result=value(await a.reportPlannedExpenseAction(month,{id:extraExpense.id,expectedUpdatedAt:extraExpense.updatedAt,expectedPlanRevisionId:current.revision.planRevisionId},'2026-12-15'));
    assert.equal(result.expense.id,extraExpense.id);assert.equal(result.owner,'DIRECT_V2');assert.equal(result.targetMonth,'2026-12');
    assert.ok(!(await saved()).some(row=>row.id===extraExpense.id));assert.equal((await s.readPlannedExpenses(h.client,householdId,'2026-12')).length,1);
    assert.equal(new Big(money((await read()).scenario)).minus(before).toFixed(2),'48.00');
  });
  await test('B3-14_STALE_PREVIEW_REVISION_AND_ROW_CAS',async()=>{
    const raw=extra('12.00'),p=value(await a.previewPlannedExpense(month,raw));await apply(state([control('groceries',{amount:'90.00'})]));
    const writes=sql.writes.length,result=await a.savePlannedExpense(month,raw,command(p));
    assert.equal(result.ok,false);assert.equal(result.issue.code,'PLANNED_EFFECTIVE_PLAN_STALE');assert.equal(sql.writes.length,writes);
    const stale=value(await a.previewPlannedExpense(month,expenseDraft(restaurant),restaurant.id));
    await s.updatePlannedExpense(h.client,householdId,restaurant.id,userId,expenseDraft(restaurant),restaurant.updatedAt);
    assert.equal((await a.savePlannedExpense(month,expenseDraft(restaurant),command(stale,restaurant))).ok,false);
    restaurant=(await saved()).find(row=>row.id===restaurant.id);
  });
  await test('B3-15_UNKNOWN_PRESERVES_KNOWN',async()=>{
    const f=fixture(),p=evaluatePlanScenario(f,state([], [activity(201,null),activity(202,'20.00')]),{expectedActiveRevisionId:null,expectedActiveRevisionNumber:0});
    assert.equal(p.projection.plan.economicMonthEndRemainder,null);assert.ok(p.compiled.components.some(c=>c.evaluation.economicAmount==='20.00'));
    const {projectPlannedExpenseImpact}=require('@/server/phase2/planned-impact');
    const masked=projectPlannedExpenseImpact(p.scenario.economicPlan,p.scenario.economicPlan,extra(),false);
    assert.equal(masked.grossCost,'48.00');assert.equal(masked.netAdditionalImpact.central,null);assert.equal(masked.after.central,null);
  });
  await test('B3-16_MOBILITY_USAGE_IS_NOT_BANK_CASH',async()=>{
    const f=weekendMonth(true),{preparePlanningMobility}=require('@/server/phase2/planner/prospective-mobility-pricing');
    const {providers}=await import('./fixtures/planner-mobility.mjs');
    const p=evaluatePlanScenario(await preparePlanningMobility(f.world,f.semantic,providers().value),f.semantic,{expectedActiveRevisionId:null,expectedActiveRevisionNumber:0});
    assert.ok(p.projection.funding.timing.some(row=>row.cashTreatment==='ECONOMIC_ONLY'));
    assert.ok(new Big(p.projection.mobility.usageEconomicCost).gt(0));
  });
  await test('B3-17_SCOPE_REFUSAL',async()=>{
    const writes=sql.writes.length;
    assert.equal((await a.removePlannedExpense('2026-12',{id:restaurant.id,expectedUpdatedAt:restaurant.updatedAt})).ok,false);
    const ctx=await effective();assert.throws(()=>ctx.evaluate(ctx.inputs,[{...restaurant,householdId:uuid(99991)}]),/SCOPE_INVALID/);
    const foreign=await s.readPlannedExpenses(h.client,uuid(99991),month);assert.deepEqual(foreign,[]);assert.equal(sql.writes.length,writes);
  });
  await test('B3-18_PREVIEW_READ_ZERO_WRITE',async()=>{
    const writes=sql.writes.length,rpcs=pg.rpcCalls,reads=worldReads;
    value(await a.previewPlannedExpense(month,extra()));assert.equal(worldReads,reads+1);
    await read();await monthlyActions.previewMonthChoice(month,choice);
    assert.equal(sql.writes.length,writes);assert.equal(pg.rpcCalls,rpcs);await pg.verifyCanaries();
  });
  await test('B3-EXTRA_FINANCIAL_ONLY_PREFLIGHT_PARITY',async()=>{
    const {evaluatePlanMutation}=require('@/server/phase2/planner/preview');
    for(const fixtureCase of [weekendMonth(true),weekendMonth(false),{world:fixture(),semantic:state([], [activity(201,null)])}]){
      const base={expectedActiveRevisionId:null,expectedActiveRevisionNumber:0};
      const full=evaluatePlanScenario(fixtureCase.world,fixtureCase.semantic,base),financial=evaluatePlanMutation(fixtureCase.world,fixtureCase.semantic,base);
      const {impacts:fullImpacts,...fullProjection}=full.projection,{impacts:partialImpacts,...partialProjection}=financial.projection;
      assert.deepEqual(financial.scenario,full.scenario);assert.deepEqual(partialProjection,fullProjection);
      assert.equal(financial.compiledManifestDigest,full.compiledManifestDigest);
      assert.ok(fullImpacts.length>=partialImpacts.length);
    }
  });
  await test('B3-EXTRA_UNAVAILABLE_NO_DIRECT_FALLBACK',async()=>{
    const writes=sql.writes.length;failWorld=true;
    const outcome=await a.previewPlannedExpense(month,extra());failWorld=false;
    assert.equal(outcome.ok,false);assert.equal(sql.writes.length,writes);
  });
  await test('B3-EXTRA_MONTH_INPUTS_DATABASE_CAS',async()=>{
    const previous=await realRead(h.client,householdId,month);
    const next={...previous.inputs,resourceOverrides:{...previous.inputs.resourceOverrides,'income:Digital Learning Contest':'1110.00'}};
    const first=await realSave(h.client,householdId,month,userId,next,{updatedAt:previous.updatedAt});
    await assert.rejects(()=>realSave(h.client,householdId,month,userId,previous.inputs,{updatedAt:previous.updatedAt}),/MONTH_INPUT_STALE/);
    assert.equal((await realRead(h.client,householdId,month)).inputs.resourceOverrides['income:Digital Learning Contest'],'1110.00');
    await realSave(h.client,householdId,month,userId,previous.inputs,{updatedAt:first.updatedAt});
  });
  await test('B3-EXTRA_PERSISTED_PLAN_QUOTE_BECOMES_UNKNOWN',async()=>{
    const prior=(await read()).semanticState,quotes=world.costQuotes;
    world.costQuotes={'synthetic-quote':{unitAmount:'10.00',evidenceRef:'synthetic-source',modelVersion:'synthetic-quote@v1',observedAt:'2026-10-04T00:00:00Z'}};
    const quoted=context({n:98400,slot:null,relation:'NO_RELATED_SLOT',count:null,quote:'synthetic-quote'});
    const applied=await apply(state([control('groceries',{amount:'90.00'})],[quoted]));
    const immutable=plannerDigest(applied.revision),writes=sql.writes.length;
    world.costQuotes={};const p=value(await a.previewPlannedExpense(month,extra()));
    assert.equal(p.grossCost,'48.00');assert.equal(p.netAdditionalImpact.central,null);assert.equal(p.estimatedEndOfMonth,null);
    assert.equal(p.bankCash.endOfMonth.central,null);assert.equal(p.projectionIncomplete,true);
    assert.equal(plannerDigest((await repository.readActivePlan(householdId,month)).activeRevision),immutable);assert.equal(sql.writes.length,writes);
    world.costQuotes=quotes;await apply(prior);
  });
  await test('B3-EXTRA_DECLARATION_RESTORE_DELETE_WITH_PLAN',async()=>{
    const raw=extra('8.00'),p=value(await a.previewPlannedExpense(month,raw));
    let row=value(await a.savePlannedExpense(month,raw,command(p))).expense;
    const reality=value(await a.previewPlannedExpense(month,expenseDraft(row),row.id,true));
    const declaredDraft=expenseDraft(row),declaredCommand=command(reality,row);
    row=value(await a.confirmPlannedExpenseReality(month,declaredDraft,declaredCommand)).expense;
    assert.equal(row.status,'DECLARED_REALIZED');
    const writes=sql.writes.length;
    assert.equal(value(await a.confirmPlannedExpenseReality(month,declaredDraft,declaredCommand)).expense.id,row.id);
    assert.equal(sql.writes.length,writes,'recognize declared receipt despite the now-stale initial Preview');
    const restored=value(await a.restorePlannedExpenseAction(month,{id:row.id,expectedUpdatedAt:row.updatedAt,expectedPlanRevisionId:p.planRevisionId}));
    assert.equal(restored.owner,'PLAN_V1');assert.equal(restored.expense.status,'PLANNED');
    value(await a.removePlannedExpense(month,{id:row.id,expectedUpdatedAt:restored.expense.updatedAt,expectedPlanRevisionId:p.planRevisionId}));
    assert.ok(!(await saved()).some(item=>item.id===row.id));
  });
  await test('B3-EXTRA_LINKED_ROOT_EDIT_KEEP_REPORT_GUARD',async()=>{
    const raw=extra('6.00'),p=value(await a.previewPlannedExpense(month,raw));
    let row=value(await a.savePlannedExpense(month,raw,command(p))).expense;
    const linked=context({n:98300});linked.fields.externalIntentId=row.id;linked.slotSelections={};
    const applied=await apply(state([control('groceries',{amount:'90.00'})],[linked]));
    const writes=sql.writes.length,cmd={id:row.id,expectedUpdatedAt:row.updatedAt,expectedPlanRevisionId:applied.revision.planRevisionId};
    for(const outcome of [await a.removePlannedExpense(month,cmd),await a.reportPlannedExpenseAction(month,cmd,'2026-12-15')]){
      assert.equal(outcome.ok,false);assert.equal(outcome.issue.code,'PLANNED_EFFECTIVE_LINKED_INTENTION');
    }
    assert.equal(sql.writes.length,writes);
    const changed=expenseDraft(row);changed.costItems[0].unitAmount='9.00';
    const trial=value(await a.previewPlannedExpense(month,changed,row.id));assert.equal(trial.impactBasis,'REPLACES_CURRENT');
    assert.equal(trial.netAdditionalImpact.central,'3.00');assert.equal(trial.absorbedByBaseline.central,null);
    row=value(await a.savePlannedExpense(month,changed,command(trial,row))).expense;
    assert.equal(row.id,cmd.id);assert.equal(row.costItems[0].unitAmount,'9.00');
  });
  await test('B3-EXTRA_COMMITTED_RELOAD_ERROR_NO_BLIND_RETRY',async()=>{
    const raw=extra('7.00'),p=value(await a.previewPlannedExpense(month,raw)),cmd=command(p),insert=sql.from;
    sql.from=table=>{
      const query=insert(table);if(table==='phase2_planned_expenses'){
        const single=query.single;query.single=async()=>{const result=await single();if(result.data?.planned_expense_id===cmd.id)failWorld=true;return result;};
      }return query;
    };
    const result=await a.savePlannedExpense(month,raw,cmd);failWorld=false;sql.from=insert;
    assert.equal(result.ok,false);assert.equal(result.issue.code,'PLANNED_EXPENSE_COMMITTED_RELOAD_FAILED');
    assert.equal((await saved()).filter(row=>row.id===cmd.id).length,1);
    const writes=sql.writes.length,replay=value(await a.savePlannedExpense(month,raw,cmd));
    assert.equal(replay.expense.id,cmd.id);assert.equal(sql.writes.length,writes,'lost response recovered without second INSERT');
    assert.equal((await a.savePlannedExpense(month,extra('8.00'),cmd)).issue.code,'PLANNED_EXPENSE_IDEMPOTENCY_CONFLICT');
  });
  await test('B3-EXTRA_BOUNDED_SIMULATION_COST',async()=>{
    const finance=require('@/server/phase2/planner/financial-adapter'),compile=require('@/server/phase2/planner/compiler');
    const originalFinance=finance.deriveCompiledMonthScenario,originalCompile=compile.compileSemanticPlan;
    let finances=0,compiles=0;finance.deriveCompiledMonthScenario=(...args)=>{finances++;return originalFinance(...args);};
    compile.compileSemanticPlan=(...args)=>{compiles++;return originalCompile(...args);};
    try{for(let n=0;n<5;n++){
      const facts=await direct(),raw=extra('13.00'),start=performance.now();
      const old=await s.preparePlannedExpenseSimulation(h.client,householdId,facts.forecast,facts.monthInputs,facts.externalIntents,raw,facts.asOfDate,undefined,'PREVIEW');
      deriveMonthScenario(facts.forecast,facts.monthInputs,null,facts.asOfDate,facts.externalIntents);
      const oldMs=performance.now()-start,reads=worldReads,f=finances,c=compiles,writes=sql.writes.length,b=performance.now();
      const current=value(await a.previewPlannedExpense(month,raw));
      overhead.push({sample:n+1,legacyDirectPreflightMs:oldMs,effectivePlanPreflightMs:performance.now()-b,
        addedWorldReads:worldReads-reads,compiledFinanceCalls:finances-f,compilerCalls:compiles-c,
        legacyOwner:'DIRECT_V2',currentOwner:'PLAN_V1',financialOutputsExpectedToDiffer:true});
      assert.ok(old.scenario.economicPlan);assert.equal(current.planRevisionId,(await repository.readActivePlan(householdId,month)).activeRevision.planRevisionId);
      assert.equal(worldReads,reads+1);assert.equal(sql.writes.length,writes);
    }}finally{finance.deriveCompiledMonthScenario=originalFinance;compile.compileSemanticPlan=originalCompile;}
  });
  const proof={kind:'PGLITE_SYNTHETIC_ONLY',checks,timings,worldReads,planRpcCalls:pg.rpcCalls,counts:await pg.counts(),
    performance:{samples:overhead,note:'Synthetic transport and CPU only; legacy output is financially wrong with Plan. No product-latency gain claim.'},
    prospectiveWrites:sql.writes,historicalWrites:0,realAuthJWT:'NOT_RUN',atomicCrossOwnerCommit:'NOT_IMPLEMENTED_NO_NEW_MIGRATION'};
  fs.mkdirSync('docs/status/evidence/b3-transverse-plan',{recursive:true});
  fs.writeFileSync('docs/status/evidence/b3-transverse-plan/contract-results.json',JSON.stringify(proof,null,2)+'\n');
  console.log(`PASS ${checks.length} B3 controls; real Auth/Production writes NOT_RUN`);
}finally{await pg.close();}
