import assert from "node:assert/strict";
import fs from "node:fs";
import { randomUUID } from "node:crypto";
import { require } from "./lib/phase2-ts-loader.mjs";
import { forecast, inputs } from "./check-phase2-october-contract.mjs";
import { planningHarness, item } from "./lib/planned-actions-harness.mjs";

const { deriveMonthScenario: derive, monthInputsSchema: schema, defaultMonthInputs } = require("@/server/phase2/month-scenario.ts");
const { parseMonthDecisionSettings: settings, defaultMonthDecisionSettings } = require("@/domain/phase2/month-decision-contract.ts");
const { parseMonthChoice } = require("@/domain/phase2/month-choice-contract.ts");
const { simulateMonthChoice: simulate, proposeMonthChoices: propose } = require("@/server/phase2/month-choices.ts");
const { projectCategoryControls: controls, categoryDecisionFacts } = require("@/server/phase2/month-category-controls.ts");
const { projectMonthDecision } = require("@/server/phase2/month-decision-projection.ts");
const monthly = require("@/server/phase2/month-inputs.ts"), realRead = monthly.readMonthInputs, realSave = monthly.saveMonthInputs;
const configured = process.env.PHASE2_FORECAST_TEMPORAL_MODE;
delete process.env.PHASE2_FORECAST_TEMPORAL_MODE;
const results = [], writes = [], touched = [];
const test = async (id, fn, kind = "BEHAVIOR") => { await fn(); results.push({ id, kind, status: "PASS" }); console.log(`${id} PASS`); };
const months = ["2026-04", "2026-05", "2026-06", "2026-07", "2026-08", "2026-09"];
const entries = months.flatMap(month => [
  { date: `${month}-02`, subcategory: "Courses alimentaires", amount: "100.00" },
  { date: `${month}-25`, subcategory: "Courses alimentaires", amount: "200.00" },
  { date: `${month}-08`, subcategory: "Restaurant", amount: "43.50" },
  { date: `${month}-24`, subcategory: "Restaurant", amount: "43.50" },
  { date: `${month}-05`, subcategory: "Bureau de tabac / presse", amount: "100.00" },
  { date: `${month}-09`, subcategory: "Boulangerie", amount: "8.00", person: "Adrien", preciseType: "Repas du midi au travail" },
].map((row, index) => ({ operationId: `${month}:${index}`, person: null, preciseType: null, merchant: null, ...row })));
const oracleAmounts = ['479.74','662.71','546.58','417.80','251.30','547.71','363.95','259.16','353.74','397.06','556.16','439.97'];
const oracleEntries = oracleAmounts.map((amount,i) => { const date=new Date(Date.UTC(2025,7+i,2)).toISOString().slice(0,10); return {...entries[0],operationId:'oracle:'+i,date,amount,amountStatus:'KNOWN'}; });
const evidence = { history: { startMonth: "2025-08", endMonth: "2026-07", economicEntries: oracleEntries, mobilityLegs: [] },
  currentEconomicEntries: [], currentMobilityLegs: [], observedThrough: "2026-09-30", coverageThrough: "2026-09-30", completeMonths: months, personNamesById: {} };
const live = { ...forecast, meta: { ...forecast.meta, sourceRevision: 1 }, predictionEvidence: evidence, forecastMemory: [] };
const saving = { id: randomUUID(), label: "Noël", amount: "80.00", dueDate: null, kind: "SAVINGS", source: "MONTH_INPUT", annualGoalRef: null, adjustability: "ADJUSTABLE" };
const current = schema.parse({ ...inputs, decision: defaultMonthDecisionSettings(), declaredOutflows: [...inputs.declaredOutflows, saving] });
const context = (extra = {}) => ({ forecast: live, inputs: current, expenses: [], asOf: "2026-10-18", ...extra });
const run = ctx => derive(ctx.forecast, ctx.inputs, null, ctx.asOf, ctx.expenses).economicPlan;
const cat = (plan, key) => [...plan.narrative.prediction.essential, ...plan.narrative.prediction.optional].find(row => row.key === key);
const choice = (categoryKey = "groceries", strategy = "REDUCE_AMOUNT", value = "20.00") => ({ operations: [{ kind: "CATEGORY", categoryKey, strategy,
  ...(strategy === "REDUCE_AMOUNT" ? { amount: value } : strategy === "REDUCE_PERCENT" ? { percent: value } : {}) }] });
const savingsChoice = (row = saving, amount = "42.00") => ({ operations: [{ kind: "SAVINGS", savingsId: row.id, strategy: "ADJUST_SAVINGS", amount }] });
const withTarget = (amount, forecastAmount, realized = "0.00") => {
  const observed = Number(realized) ? [{ ...entries[0], operationId: "actual-groceries", date: "2026-10-02", amount: realized }] : [];
  return context({ inputs: schema.parse({ ...current, decision: { ...current.decision, categoryTargets: { groceries: amount },
    assumptions: { groceries: { mode: "CUSTOM", amount: (Number(forecastAmount) - Number(realized)).toFixed(2) } } } }),
    forecast: { ...live, predictionEvidence: { ...evidence, currentEconomicEntries: observed } } });
};
const h = planningHarness(), originalFrom = h.client.from.bind(h.client);
h.facts.inputs["2026-10"] = structuredClone(current);
h.client.from = table => {
  touched.push(table);
  // C8 cutover reads the active Plan. The original spy admits scoped reads only.
  assert(["phase2_month_inputs", "phase2_planned_expenses", "phase2_month_plans", "persons"].includes(table), `Historical authority reached: ${table}`);
  if (table !== "phase2_month_inputs") return originalFrom(table);
  const filters = {};
  return { select() { return this; }, eq(key, value) { filters[key] = value; return this; },
    async maybeSingle() { assert.equal(filters.household_id, h.householdId); const payload = h.facts.inputs[filters.target_month.slice(0, 7)];
      return { data: payload ? { payload: structuredClone(payload), updated_at: null, updated_by: h.userId } : null, error: null }; },
    async upsert(row, options) { assert.equal(row.household_id, h.householdId); assert.equal(row.updated_by, h.userId);
      assert.equal(options.onConflict, "household_id,target_month"); h.facts.inputs[row.target_month.slice(0, 7)] = structuredClone(row.payload);
      writes.push({ table, operation: "upsert" }); return { error: null }; } };
};
monthly.readMonthInputs = realRead; monthly.saveMonthInputs = realSave;
require("@/server/phase2/planning-date.ts").planningDate = () => "2026-10-18";
const snapshots = require("@/server/phase2/month-forecast-snapshot.ts");
snapshots.queryMonthForecast = snapshots.resolvePlanningMonthForecast = async () => live;
const actions = require("@/app/mois-a-venir/actions.ts");
const form = values => { const f = new FormData(); for (const [key, value] of Object.entries({ targetMonth: "2026-10", ...values })) f.set(key, value); return f; };

const { projectMonthControlCenter: model, projectMonthControlWorkbench: wb } = require("@/server/phase2/month-control-center.ts");
const { monthControlHeaderPolicy: header, replaceMonthControlOperation: replace } = require("@/domain/phase2/month-control-contract.ts");
const React = require("react"), { renderToStaticMarkup: render } = require("react-dom/server");
const { AppRouterContext } = require("next/dist/shared/lib/app-router-context.shared-runtime");
const { MonthLocalFocusProvider } = require("@/app/mois-a-venir/month-control-focus.tsx");
const { MonthPilotEditor } = require("@/app/mois-a-venir/month-pilot-editor.tsx");
const { MonthPilotIndex } = require("@/app/mois-a-venir/month-control-workspace.tsx");
const { MonthSavingEditor } = require("@/app/mois-a-venir/month-saving-editor.tsx");
const { BankStockCard } = require("@/app/mois-a-venir/bank-stock-card.tsx");
const base = withTarget("472.00", "447.00"), m = model(base);
const op = (amount, categoryKey = "groceries", testOrigin) => ({ kind: "CATEGORY", categoryKey, strategy: "TEST_AMOUNT", amount, ...(testOrigin ? { testOrigin } : {}) });
const replay = (operation, ctx = base) => simulate(ctx, { operations: [operation] });
const markup = (Component, props) => render(React.createElement(AppRouterContext.Provider, { value: { refresh() {}, push() {}, replace() {}, back() {}, forward() {}, prefetch() {} } }, React.createElement(MonthLocalFocusProvider, { value: { section: "choices", entity: null, openEntity() {} } }, React.createElement(Component, props))));
const editor = (ctx = base, operations = []) => { const value = model(ctx), trial = operations.length ? wb(ctx, { kind: "FREE_EXPLORATION" }, operations) : null; return markup(MonthPilotEditor, { model: value, category: value.categoryControls.find(row => row.key === "groceries"), trial, operations, pending: false, replaceDraft() {}, reset() {}, apply() {} }); };


const oldSecret = process.env.SUPABASE_SECRET_KEY;
process.env.SUPABASE_SECRET_KEY = "synthetic-history-undo-only";
// Synthetic in-memory fixtures only: this suite never connects to Supabase.
const { projectCategoryObservedHistory: history } = require('@/server/phase2/month-category-history.ts');
const { referenceQuantile } = require('@/server/phase2/month-reference.ts');
const { requiredForecastSources } = require('@/server/phase2/forecast-opportunities.ts');
const observed=(ev=evidence,key='groceries',asOf='2026-10-18',target='2026-10')=>history(key,ev,asOf,target);
const subset = count => ({...evidence,history:{...evidence.history,economicEntries:oracleEntries.slice(0,count)}});
const mutate = (extra, index=0) => ({...evidence,history:{...evidence.history,economicEntries:oracleEntries.map((row,i)=>i===index?{...row,...extra}:row)}});
const A=observed();
await test('HIST-LOCAL-001',()=>assert.equal(observed(subset(3)).status,'AVAILABLE'));
await test('HIST-LOCAL-002',()=>{assert.equal(observed(subset(2)).status,'INSUFFICIENT');assert.equal(observed(subset(2)).min,null);});
await test('HIST-LOCAL-003',()=>assert.equal(A.count,12));
await test('HIST-LOCAL-004',()=>{assert.equal(A.min,'251.30');assert.equal(A.minMonth,'2025-12');});
await test('HIST-LOCAL-005',()=>assert.equal(A.median,'428.89'));
await test('HIST-LOCAL-006',()=>{assert.equal(A.max,'662.71');assert.equal(A.maxMonth,'2025-09');});
await test('HIST-LOCAL-007',()=>{const values=oracleAmounts.map(Number);assert.notEqual(Number(A.min),referenceQuantile(values,.25));assert.notEqual(Number(A.max),referenceQuantile(values,.75));assert(Math.abs(referenceQuantile(values,.25)-361.3975)<.00001);assert(Math.abs(referenceQuantile(values,.75)-546.8625)<.00001);});
await test('HIST-LOCAL-008',()=>{assert.equal(run(base).narrative.prediction.trainingMonths.length,5);assert.equal(model(base).categoryHistory.groceries.count,12);assert.equal(history.length,4);});
await test('HIST-LOCAL-009',()=>assert.deepEqual(observed({...evidence,completeMonthsBySource:{BANK:[],SWILE:[],EDENRED:[]},completeMonths:[]}),A));
await test('HIST-LOCAL-010',()=>{assert.deepEqual(requiredForecastSources('groceries'),['BANK','SWILE','EDENRED']);assert(cat(run(context()),'groceries').limitationCodes.includes('TRAINING_SOURCE_COVERAGE_UNCERTIFIED'));});
await test('HIST-LOCAL-011',()=>{const h=observed(mutate({amountStatus:'PARTIAL'}));assert.equal(h.count,11);assert(h.diagnostic.rejectedMonths[0].reasons.includes('PARTIAL_AMOUNT'));});
await test('HIST-LOCAL-012',()=>{for(const amount of ['Infinity','NaN','','oops']){const h=observed(mutate({amount}));assert.equal(h.count,11);assert(h.diagnostic.rejectedMonths[0].reasons.includes('NON_FINITE_AMOUNT'));}});
const ambiguous={...evidence,history:{...evidence.history,economicEntries:[...oracleEntries,{...oracleEntries[0],person:null,need:'Repas du midi au travail',subcategory:'Boulangerie',amount:'8.00'}]}};
await test('HIST-LOCAL-013',()=>{for(const key of ['adrien-work-meals','manon-work-meals'])assert(observed(ambiguous,key).diagnostic.rejectedMonths.find(row=>row.month==='2025-08').reasons.includes('AMBIGUOUS_PERSON'));});
await test('HIST-LOCAL-014',()=>assert.deepEqual(observed(ambiguous),A));
const home='Domicile Adrien & Manon',office='Promotrans – Montpellier';
const route=[{date:'2025-08-02',origin:home,destination:office,fuelCost:'3.10'},{date:'2025-08-02',origin:office,destination:home,fuelCost:'3.20'}];
await test('HIST-LOCAL-015',()=>{for(const fuelCost of [null,'NaN','Infinity']){const ev={...evidence,history:{...evidence.history,mobilityLegs:[{...route[0],fuelCost},route[1]]}};assert(observed(ev,'manon-work-mobility').diagnostic.rejectedMonths[0].reasons.includes('MOBILITY_COST_UNKNOWN'));assert.deepEqual(observed(ev),A);}const ev={...evidence,history:{...evidence.history,mobilityLegs:route,incompleteMobilityLegs:[{...route[0]}]}};assert(observed(ev,'manon-work-mobility').diagnostic.rejectedMonths[0].reasons.includes('MOBILITY_COST_UNKNOWN'));});
await test('HIST-LOCAL-016',()=>{const h=observed(evidence,'household-restaurants');assert.equal(h.count,0);assert(h.diagnostic.rejectedMonths.every(row=>row.reasons.includes('ZERO_NOT_CERTIFIED')));assert.deepEqual(observed({...evidence,completeMonths:oracleEntries.map(r=>r.date.slice(0,7))},'household-restaurants'),h);});
await test('HIST-LOCAL-017',()=>{const h=observed(mutate({amount:'0.00'}));assert.equal(h.count,12);assert.equal(h.samples[0].amount,'0.00');assert.equal(h.min,'0.00');});
const future={...evidence,history:{...evidence.history,endMonth:'2026-11',economicEntries:[...oracleEntries,...['2026-10','2026-11'].map(month=>({...oracleEntries[0],date:month+'-02'}))]}};
await test('HIST-LOCAL-018',()=>{const h=observed(future);assert.equal(h.count,12);assert(h.diagnostic.rejectedMonths.find(row=>row.month==='2026-10').reasons.includes('CURRENT_MONTH_NOT_CLOSED'));});
await test('HIST-LOCAL-019',()=>assert(observed(future).diagnostic.rejectedMonths.find(row=>row.month==='2026-11').reasons.includes('FUTURE_MONTH')));
await test('HIST-LOCAL-020',()=>assert.deepEqual(observed({...evidence,history:{...evidence.history,economicEntries:[...oracleEntries].reverse()}}),A));
await test('HIST-STABLE-001',()=>{assert.equal(model(base).categoryControls.find(r=>r.key==='groceries').forecast,'447.00');assert.deepEqual(wb(base,{kind:'FREE_EXPLORATION'},[op('403.00')]).scenario.categoryHistory.groceries,A);});
await test('HIST-STABLE-002',()=>assert.deepEqual(wb(base,{kind:'FREE_EXPLORATION'},[op('520.00')]).scenario.categoryHistory.groceries,A));
await test('HIST-STABLE-003',async()=>{h.facts.inputs['2026-10']=structuredClone(base.inputs);const preview=await actions.previewMonthControlCenter('2026-10',{kind:'FREE_EXPLORATION'},[op('403.00')]);assert((await actions.applyMonthChoice('2026-10',{operations:[op('403.00')]},preview.baseDigest)).ok);const read=await actions.previewMonthControlCenter('2026-10',{kind:'FREE_EXPLORATION'},[]);assert.equal(read.model.categoryControls.find(r=>r.key==='groceries').forecast,'403.00');assert.deepEqual(read.model.categoryHistory.groceries,A);});
await test('HIST-STABLE-004',()=>assert.deepEqual(model(withTarget('450.00','447.00')).categoryHistory.groceries,A));
await test('HIST-STABLE-005',()=>assert.deepEqual(model({...base,inputs:{...base.inputs,decision:{...base.inputs.decision,goal:'500.00'}}}).categoryHistory.groceries,A));
await test('HIST-STABLE-006',()=>assert.deepEqual(wb(base,{kind:'FREE_EXPLORATION'},[op('403.00'),op('78.00','household-restaurants')]).scenario.categoryHistory.groceries,A));
await test('HIST-NO-SECOND-AUTHORITY',()=>{const code=fs.readFileSync('src/server/phase2/month-category-history.ts','utf8');for(const name of ['projectedMonth','requiredForecastSources','trainingMonths','appliedAssumption','categoryTargets','simulateMonthChoice'])assert(!code.includes(name));});
await test('HIST-MOBILITY-LOCAL',()=>{const ev={...evidence,history:{...evidence.history,mobilityLegs:[...route,{...route[0],origin:'Elsewhere',destination:'Elsewhere',fuelCost:'NaN'}]}};const h=observed(ev,'manon-work-mobility');assert.equal(h.count,1);assert.equal(h.samples[0].amount,'6.30');assert.deepEqual(observed(ev),A);});
await test('HIST-MOBILITY-INCOMPLETE-DAY',()=>{const ev={...evidence,history:{...evidence.history,mobilityLegs:[route[0]]}};assert.equal(observed(ev,'manon-work-mobility').count,0);});
await test('HIST-COFFEE-NULL-OWNER',()=>{const ev={...evidence,history:{...evidence.history,economicEntries:oracleEntries.slice(0,3).map(r=>({...r,subcategory:'Café au travail',person:null}))}};assert.equal(observed(ev,'adrien-work-coffee').count,3);});
await test('HIST-UI-READ-MODEL',()=>{const html=editor();assert(html.includes('12 mois comparables'));assert(html.includes('déc. 2025'));assert(html.includes('sept. 2025'));});
assert(writes.every(row=>row.table==='phase2_month_inputs'));
console.log('CATEGORY OBSERVED HISTORY '+results.length+'/'+results.length+' PASS (synthetic writes only)');
if(oldSecret === undefined) delete process.env.SUPABASE_SECRET_KEY; else process.env.SUPABASE_SECRET_KEY=oldSecret;
if(configured!==undefined)process.env.PHASE2_FORECAST_TEMPORAL_MODE=configured;
