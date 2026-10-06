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
const evidence = { history: { startMonth: months[0], endMonth: months.at(-1), economicEntries: entries, mobilityLegs: [] },
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
  assert(["phase2_month_inputs", "phase2_planned_expenses", "persons", "phase2_month_plans"].includes(table), `Historical authority reached: ${table}`);
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

const { MonthPilotAdd, MonthPilotSummary, MonthPilotSaving, pilotCandidates } = require("@/app/mois-a-venir/month-pilot-scenario.tsx");
const { projectCategoryObservedHistory: history } = require("@/server/phase2/month-category-history.ts");
const src = file => fs.readFileSync(file, "utf8");
const center = src("src/app/mois-a-venir/month-control-center.tsx"), editSource = src("src/app/mois-a-venir/month-pilot-editor.tsx");
const two = [op("313.00", "tobacco-vape"), op("78.00", "household-restaurants")];
await test("MULTI-001", () => assert(!center.includes("MonthControlSimulator")));
await test("MULTI-002", () => assert(markup(MonthPilotAdd, { model: m, operations: [op("403.00")] }).includes("Restaurants du foyer")));
await test("MULTI-003", () => assert(!markup(MonthPilotAdd, {model:m,operations:[]}).includes("Étape")));
await test("MULTI-004", () => assert(!markup(MonthPilotSummary,{model:m,operations:two,trial:wb(base,{kind:"FREE_EXPLORATION"},two),pending:false,apply(){},remove(){}}).includes("Votre simulation")));
await test("MULTI-005", () => assert.equal(pilotCandidates(m,two).length,0));
await test("MULTI-006", () => assert.equal(pilotCandidates({...m,pilotCandidates:[]},[]).length,0));
await test("MULTI-008", () => assert(center.includes('setFocus("pilot"); setInfo(false); updateLocation("center", "pilot")')));
await test("MULTI-009", () => assert(!center.includes("Recalculer le scénario")));
await test("MULTI-010", () => assert(editSource.includes('Number(value) === Number(category.forecast)) reset()')));
await test("COND-001", () => assert(!editor().includes('Appliquer à')));
await test("COND-002", () => assert(editor({...base,inputs:{...base.inputs,decision:{...base.inputs.decision,categoryTargets:{}}}}).includes('+ Définir une cible')));
await test("COND-003", () => assert(!editor(base,[op("472.00")]).includes('Remplacer la cible par')));
await test("COND-004", () => assert(editor(base,[op("403.00")]).includes('Remplacer la cible par')));
await test("COND-005", () => assert(editor(base,[op("403.00"),op("78.00","household-restaurants")]).includes('Retirer Courses du scénario')));
await test("COND-006", () => {assert(editSource.includes('!!error'));assert(editSource.includes('disabled={!fresh || !trial?.applicable}'));assert(editSource.includes('Impossible à appliquer'));});
await test("COND-007", () => assert(m.categoryTestPresets.groceries.every(row=>Number(row.amount)!==447)));
await test("COND-008", () => assert(model(withTarget("472.00","447.00","430.00")).categoryTestPresets.groceries.every(row=>Number(row.amount)>=430)));
const certified = {...evidence,completeMonthsBySource:{BANK:months,SWILE:months,EDENRED:months}};
const historical = history("groceries",certified,"2026-10-18","2026-10");
await test("HIST-001", () => {const html=editor({...base,forecast:{...base.forecast,predictionEvidence:{...evidence,history:{...evidence.history,economicEntries:[]}}}});assert(html.includes('Historique insuffisant'));assert(html.includes('Mois bas'));assert(html.includes('Médiane'));assert(html.includes('Mois haut'));});
await test("HIST-002", () => {assert.equal(historical.status,'AVAILABLE');assert.equal(historical.min,'300.00');assert.equal(historical.median,'300.00');assert.equal(historical.max,'300.00');});
await test("HIST-RAIL-SSR",()=>{const ctx={...base,forecast:{...base.forecast,predictionEvidence:certified}};const html=editor(ctx);assert(html.includes('Historique personnel'));assert(html.includes('Tester médiane historique'));assert(html.includes('Position du prévu et du test dans l’historique'));assert(html.includes('Mois bas'));assert(html.includes('Mois haut'));});
await test("HIST-003", () => {const ctx=base;const certifiedCtx={...ctx,forecast:{...ctx.forecast,predictionEvidence:certified}};const a=model(certifiedCtx);const b=wb(certifiedCtx,{kind:'FREE_EXPLORATION'},[op('403.00')]);assert.deepEqual(a.categoryHistory,b.scenario.categoryHistory);});
await test("HIST-004", () => {assert(editSource.includes('commit(value)'));assert.equal(replay(op(historical.median)).view.categoryImpacts.find(row=>row.key==='groceries').after,'300.00');});
await test("HIST-005", () => assert(!src('src/server/phase2/month-category-history.ts').includes('baselineProvision')));
await test("HIST-006", () => {const d=history('groceries',evidence,'2026-10-18','2026-10').diagnostic;assert.equal(d.rejectedMonths.length,0);assert.equal(d.acceptedMonths.length,6);});
await test("HIST-LOCAL-COVERAGE", () => {const d=history('tobacco-vape',{...certified,completeMonthsBySource:{BANK:months}},'2026-10-18','2026-10');assert.equal(d.count,6);assert.equal(history('groceries',{...certified,completeMonthsBySource:{BANK:months}},'2026-10-18','2026-10').count,6);});
await test("HIST-PARTIAL", () => {const ev={...certified,history:{...certified.history,economicEntries:certified.history.economicEntries.map(row=>({...row,amountStatus:'PARTIAL'}))}};assert.equal(history('groceries',ev,'2026-10-18','2026-10').count,0);});
await test("HIST-FUTURE", () => assert.equal(history('groceries',certified,'2026-04-01','2026-04').count,0));
await test("ELIGIBLE-PROTECTED",()=>{assert(!m.pilotCandidates.some(row=>row.target==='category:manon-work-mobility'));assert(!pilotCandidates({...m,editable:false},[]).length);});
await test("APPLY-001",()=>assert(center.includes('updateLocation("center", "pilot")')));
await test("APPLY-002",()=>assert(center.includes('setOperations([])')));
await test("APPLY-003",()=>assert(center.includes('setUndoToken(result.undoToken)')));
await test("APPLY-004",()=>assert(center.includes('operations.length === 0 && focus === "pilot:review"')));
await test("STALE-EXACT-INTENT",()=>assert(center.includes('trialKey === JSON.stringify([model.baseDigest, purpose, operations])')));
await test("MULTI-007",async()=>{h.facts.inputs['2026-10']=structuredClone(current);const preview=await actions.previewMonthControlCenter('2026-10',{kind:'FREE_EXPLORATION'},two);const saved=await actions.applyMonthChoice('2026-10',{operations:two},preview.baseDigest);assert(saved.ok);const read=await actions.previewMonthControlCenter('2026-10',{kind:'FREE_EXPLORATION'},[]);assert.equal(read.model.categoryControls.find(row=>row.key==='tobacco-vape').forecast,'313.00');assert.equal(read.model.categoryControls.find(row=>row.key==='household-restaurants').forecast,'78.00');const undo=await actions.undoMonthChoice('2026-10',saved.undoToken);assert(undo.ok);assert.deepEqual(schema.parse(h.facts.inputs['2026-10']),current);});
await test("WRITE-MONO-UNDO",async()=>{h.facts.inputs['2026-10']=structuredClone(current);const original=model(context()).categoryControls.find(row=>row.key==='groceries').forecast;const operation=op((Number(original)*.9).toFixed(2));const preview=await actions.previewMonthControlCenter('2026-10',{kind:'FREE_EXPLORATION'},[operation]);const saved=await actions.applyMonthChoice('2026-10',{operations:[operation]},preview.baseDigest);assert(saved.ok);const read=await actions.previewMonthControlCenter('2026-10',{kind:'FREE_EXPLORATION'},[]);assert.equal(read.model.categoryControls.find(row=>row.key==='groceries').forecast,operation.amount);assert((await actions.undoMonthChoice('2026-10',saved.undoToken)).ok);assert.deepEqual(schema.parse(h.facts.inputs['2026-10']),current);});
await test("WRITE-TARGET",async()=>{h.facts.inputs['2026-10']=structuredClone(current);const before=model(context()).categoryControls.find(row=>row.key==='groceries').forecast;assert((await actions.updateMonthControlInputs(form({intent:'save-category-target',categoryKey:'groceries',categoryTarget:'382.00'}))).ok);const read=await actions.previewMonthControlCenter('2026-10',{kind:'FREE_EXPLORATION'},[]);assert.equal(read.model.categoryControls.find(row=>row.key==='groceries').target,'382.00');assert.equal(read.model.categoryControls.find(row=>row.key==='groceries').forecast,before);assert((await actions.updateMonthControlInputs(form({intent:'save-category-target',categoryKey:'groceries',categoryTarget:'450.00'}))).ok);const changed=await actions.previewMonthControlCenter('2026-10',{kind:'FREE_EXPLORATION'},[]);assert.equal(changed.model.categoryControls.find(row=>row.key==='groceries').target,'450.00');assert.equal(changed.model.categoryControls.find(row=>row.key==='groceries').forecast,before);});
await test("WRITE-STALE",async()=>{h.facts.inputs['2026-10']=structuredClone(current);const draft=[op('403.00')];const preview=await actions.previewMonthControlCenter('2026-10',{kind:'FREE_EXPLORATION'},draft);h.facts.inputs['2026-10'].decision.categoryTargets.groceries='450.00';const count=writes.length;assert.equal((await actions.applyMonthChoice('2026-10',{operations:draft},preview.baseDigest)).ok,false);assert.equal(writes.length,count);const fresh=await actions.previewMonthControlCenter('2026-10',{kind:'FREE_EXPLORATION'},draft);assert((await actions.applyMonthChoice('2026-10',{operations:draft},fresh.baseDigest)).ok);});
await test("MULTI-SAVINGS-DIRECT",()=>{const operations=[op("403.00"),{kind:"SAVINGS",savingsId:saving.id,strategy:"TEST_SAVINGS",amount:"40.00"}];const trial=wb(base,{kind:"FREE_EXPLORATION"},operations);assert.equal(trial.scenario.savings.find(row=>row.id===saving.id).amount,"40.00");assert.equal(trial.scenario.projectionSummary.remainingDailyLife,wb(base,{kind:"FREE_EXPLORATION"},[operations[0]]).scenario.projectionSummary.remainingDailyLife);const html=markup(MonthPilotSaving,{model:m,saving:m.savings.find(row=>row.id===saving.id),operations,trial,pending:false,apply(){},remove(){},replaceDraft(){}});assert(html.includes('Montant testé (€)'));assert(html.includes('Appliquer les 2 changements'));assert(!html.includes('Étape'));});
console.log('V5 '+results.length+'/'+results.length+' PASS');
if(configured!==undefined)process.env.PHASE2_FORECAST_TEMPORAL_MODE=configured;
