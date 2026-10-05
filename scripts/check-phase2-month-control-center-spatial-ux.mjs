const { MonthPilotEditor } = require("@/app/mois-a-venir/month-pilot-editor.tsx");
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
  { date: `${month}-08`, subcategory: "Restaurant", amount: "28.00" },
  { date: `${month}-24`, subcategory: "Restaurant", amount: "28.00" },
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
  assert(["phase2_month_inputs", "phase2_planned_expenses", "persons"].includes(table), `Historical authority reached: ${table}`);
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

const React = require("react"), { renderToStaticMarkup } = require("react-dom/server"), { AppRouterContext } = require("next/dist/shared/lib/app-router-context.shared-runtime");
const { MonthLocalFocusProvider } = require("@/app/mois-a-venir/month-control-focus.tsx");
const { MonthControlCenter } = require("@/app/mois-a-venir/month-control-center.tsx");
const { monthControlSection, monthControlDestination, monthControlUrl } = require("@/domain/phase2/month-control-contract.ts");
const { projectMonthControlCenter: model, projectMonthControlWorkbench: wb } = require("@/server/phase2/month-control-center.ts");
const { MonthControlSavings, MonthChoiceFocus } = require("@/app/mois-a-venir/month-control-choices.tsx");
const { MonthWorkspaceRoot: MonthChoicesHub, MonthPilotIndex: MonthControlLimits, MonthPilotIndex: MonthControlActiveChoices } = require("@/app/mois-a-venir/month-control-workspace.tsx");
const { MonthUpdatePanel, MonthReliabilityPanel } = require("@/app/mois-a-venir/month-control-panels.tsx");
const { WalletBalanceForm, WalletLoadingForm } = require("@/app/mois-a-venir/month-control-update.tsx");
const { stepCurrencyDraft, CurrencyStepper, HumanDateField } = require("@/app/mois-a-venir/currency-stepper.tsx");
const router = { push() {}, replace() {}, refresh() {}, prefetch() {}, back() {}, forward() {} };
const html = (Component, props, section = "choices", entity = null) => renderToStaticMarkup(React.createElement(AppRouterContext.Provider, { value: router }, React.createElement(MonthLocalFocusProvider, { value: { section, entity, openEntity() {} } }, React.createElement(Component, props))));
const src = name => fs.readFileSync(`src/app/mois-a-venir/${name}`, "utf8");
const center = src("month-control-center.tsx"), choiceUi = src("month-control-choices.tsx"), updateUi = src("month-control-update.tsx"), understandUi = src("month-control-panels.tsx");
const base = context(), m = model(base), scenario = derive(live, current, null, base.asOf, []);
const updateHtml = (entity = null, value = m, sc = scenario) => html(MonthUpdatePanel, { forecast: live, scenario: sc, model: value }, "update", entity);
const choiceFocusHtml = entity => html(MonthChoiceFocus, { model: m }, "choices", entity);
const reset = () => { h.facts.inputs["2026-10"] = structuredClone(current); };
const countWrites = () => writes.length + h.client.writes.length;

const { MonthWorkspaceRoot, MonthPilotIndex, MonthInfoFacts } = require("@/app/mois-a-venir/month-control-workspace.tsx");
const { MonthUpdateSpatial } = require("@/app/mois-a-venir/month-update-spatial.tsx");
const { classifyMonthUpdateItem: classify, groupMonthUpdateItems: group, nextMonthUpdateItem: next, MONTH_UPDATE_STATUSES: statuses } = require("@/domain/phase2/month-update-status.ts");
const { monthWorkspaceFocus: focusAdapter } = require("@/domain/phase2/month-control-contract.ts");
const { projectCategoryObservedHistory: history } = require("@/server/phase2/month-category-history.ts");
const root = html(MonthWorkspaceRoot, { model: m, draftCount: 0 });
const spatial = html(MonthUpdateSpatial, { model: m, refreshing: false }, "update", "update");
const info = html(MonthInfoFacts, { model: m });
const pilot = html(MonthPilotIndex, { model: m, draftCount: 0 });
const ui = src("month-control-workspace.tsx") + src("month-pilot-editor.tsx"), spatialSource = src("month-update-spatial.tsx");
await test("CONTROL-V3-001", () => assert(!center.includes("styles.sidebar")), "STATIC");
await test("CONTROL-V3-002", () => assert(!center.includes("MONTH_CONTROL_TABS")), "STATIC");
for (const [id,label] of [["003","Piloter mon mois"],["004","Mes cagnottes"],["005","Mettre à jour"]]) await test("CONTROL-V3-"+id, () => assert(root.includes(label)), "SSR");
await test("CONTROL-V3-006", () => assert.equal((root.match(/<button /g)||[]).length,3), "SSR");
await test("CONTROL-V3-007", () => assert(!/Gérer →|Tester →|Ouvrir →|Voir →/.test(root)), "SSR");
await test("CONTROL-V3-008", () => assert(!center.slice(center.indexOf("headerAside="),center.indexOf("closeAction=")).includes("à actualiser")), "STATIC");
await test("CONTROL-V3-009", () => { assert.equal((root.match(/informations à actualiser/g)||[]).length,1); assert(!html(require("@/app/mois-a-venir/month-control-center.tsx").MonthControlLink,{actionableCount:3,section:"choices"}).includes("notificationBadge")); }, "SSR");
await test("CONTROL-V3-010", () => assert(!html(MonthWorkspaceRoot,{model:{...m,update:{...m.update,groups:{...m.update.groups,NEEDS_UPDATE:[]}}},draftCount:0}).includes("cardBadge")), "SSR");
await test("CONTROL-V3-011", () => assert(center.includes('aria-label="État des données"')), "STATIC");
await test("CONTROL-V3-012", () => assert(!center.includes('section === "understand"')), "STATIC");
await test("UPDATE-SPATIAL-001", () => { assert.equal(statuses.length,4); for(const status of statuses) assert(spatial.includes('data-update-status="'+status+'"')); }, "SSR");
await test("UPDATE-SPATIAL-002", () => { const all=Object.values(m.update.groups).flat(); assert.equal(new Set(all.map(row=>row.id)).size,all.length); assert.throws(()=>group([m.update.items[0],m.update.items[0]])); for(let bits=0;bits<16;bits++){const facts={needsUpdate:!!(bits&1),disabled:!!(bits&2),modified:!!(bits&4),explicitlyConfirmed:!!(bits&8)}; assert.equal(classify(facts),facts.needsUpdate?"NEEDS_UPDATE":facts.disabled?"DISABLED":facts.modified?"MODIFIED":facts.explicitlyConfirmed?"CONFIRMED":null);} });
await test("UPDATE-SPATIAL-003", () => assert.equal(m.update.items.find(row=>row.id==="BANK").status,"NEEDS_UPDATE"));
await test("UPDATE-SPATIAL-004", () => assert.equal(m.update.items.find(row=>row.id==="SWILE").status,"NEEDS_UPDATE"));
const rent=live.components.find(row=>row.key==="obligation:rent");
const disabledInputs=schema.parse({...current,excludedFixedObligations:[...current.excludedFixedObligations,"obligation:rent"]});
await test("UPDATE-SPATIAL-005", () => assert.equal(model({...base,inputs:disabledInputs}).update.items.find(row=>row.id===rent.key).status,"DISABLED"));
await test("UPDATE-SPATIAL-006", () => assert.equal(m.update.items.find(row=>row.id===rent.key).status,"MODIFIED"));
const salary=live.income.components.find(row=>row.central!==null);
await test("UPDATE-SPATIAL-007", () => {const changed=model({...base,inputs:schema.parse({...current,resourceOverrides:{...current.resourceOverrides,[salary.key]:"1.00"}})});assert.equal(changed.update.items.find(row=>row.id===salary.key).status,"MODIFIED");});
await test("UPDATE-SPATIAL-008", () => assert.equal(m.update.items.find(row=>row.id===salary.key).status,null));
await test("UPDATE-SPATIAL-009", () => {const changed=model({...base,inputs:schema.parse({...current,resourceOverrides:{[salary.key]:salary.central}})});assert.equal(changed.update.items.find(row=>row.id===salary.key).status,"CONFIRMED"); const ornikar=m.update.items.find(row=>row.label==="Ornikar");assert.equal(ornikar.status,"MODIFIED");});
await test("UPDATE-SPATIAL-010", () => assert.equal(m.actionableCount,m.update.groups.NEEDS_UPDATE.length));
const many=Array.from({length:12},(_,i)=>({...m.update.items[0],id:"fixture-"+i,label:"Fixture "+i,status:"MODIFIED"}));
const manyModel={...m,update:{...m.update,...group(many),items:many}};
const manyHtml=html(MonthUpdateSpatial,{model:manyModel,refreshing:false},"update","update");
await test("UPDATE-SPATIAL-011", () => assert.equal((manyHtml.match(/<li>/g)||[]).length,3),"SSR");
await test("UPDATE-SPATIAL-012", () => assert(manyHtml.includes("+ 9 autres")),"SSR");
const excludedComponents=[{...rent,key:"obligation:google",label:"Google One – Google AI Pro – 5 To"},{...rent,key:"obligation:qobuz",label:"Qobuz – Streaming musical"}];
const exclusions=model({...base,forecast:{...live,components:[...live.components.filter(row=>!excludedComponents.some(extra=>extra.key===row.key)),...excludedComponents]},inputs:schema.parse({...current,excludedFixedObligations:excludedComponents.map(row=>row.key)})});
await test("UPDATE-SPATIAL-020", () => assert(exclusions.update.groups.DISABLED.some(row=>row.label==="Google AI Pro")));
await test("UPDATE-SPATIAL-021", () => assert(exclusions.update.groups.DISABLED.some(row=>row.label==="Qobuz")));
const disabledHtml=html(MonthUpdateSpatial,{model:exclusions,refreshing:false},"update","update:status:DISABLED");
await test("UPDATE-SPATIAL-022", () => assert(disabledHtml.includes("Désactivé pour octobre")),"SSR");
await test("UPDATE-SPATIAL-023", () => assert(disabledHtml.includes("Réactiver")),"SSR");
await test("UPDATE-SPATIAL-024", async () => {reset();h.facts.inputs["2026-10"]=structuredClone(disabledInputs);assert((await actions.updateMonthControlInputs(form({intent:"restore-fixed",componentKey:rent.key}))).ok);assert(!h.facts.inputs["2026-10"].excludedFixedObligations.includes(rent.key));reset();});
await test("UPDATE-SPATIAL-030", () => assert(spatialSource.includes('openEntity(`update:status:${status}`)')),"STATIC");
await test("UPDATE-SPATIAL-031", () => assert(html(MonthUpdateSpatial,{model:m,refreshing:false},"update","update:triage:BANK").includes('name="openingAmount"')),"SSR");
await test("UPDATE-SPATIAL-032", async () => {reset();const before=model(base).update.needsUpdateCount;assert((await actions.updateMonthControlInputs(form({intent:"save-bank-balance",openingAmount:"500.00",openingDate:base.asOf}))).ok);const revised=model({...base,inputs:h.facts.inputs["2026-10"]});assert.equal(revised.update.needsUpdateCount,before-1);assert.equal(next(revised.update.items,"BANK").remaining,before-1);reset();});
await test("UPDATE-SPATIAL-033", () => {const revised=m.update.items.map(row=>row.id==="BANK"?{...row,status:"CONFIRMED"}:row);assert.equal(next(revised,"BANK").next.id,"SWILE");assert(html(MonthUpdateSpatial,{model:{...m,update:{...m.update,items:revised}},refreshing:false},"update","update:next:BANK").includes("Continuer avec Swile"));},"DOMAIN_SSR");
await test("UPDATE-SPATIAL-034", () => {const revised=m.update.items.map(row=>({...row,status:"CONFIRMED"}));assert.equal(next(revised,"BANK").next,null);assert(html(MonthUpdateSpatial,{model:{...m,update:{...m.update,items:revised}},refreshing:false},"update","update:next:BANK").includes("Tout est à jour"));},"DOMAIN_SSR");
await test("INFO-001", () => assert(center.includes("MonthInfoFacts")&&!center.includes("&& understand")),"STATIC");
await test("INFO-002", () => assert(!info.includes("<form")&&!info.includes("<button")),"SSR");
for(const [id,label] of [["003","Calculée le"],["004","Imports récents"],["005","Banque"],["006","Swile"],["007","Prudent"]]) await test("INFO-"+id,()=>assert(info.includes(label)),"SSR");
await test("INFO-008",()=>assert(!info.includes("publicationId")),"SSR");
await test("INFO-009",()=>assert(!info.includes(m.reliability.modeExplanation)),"SSR");
await test("INFO-010",()=>assert(!info.includes("Conserver cette estimation")),"SSR");
await test("INFO-011",()=>{assert(center.includes('aria-expanded={info}'));assert(center.includes('event.key === "Escape"'));assert(center.includes('document.addEventListener("pointerdown", outside)'));},"STATIC");
await test("PILOT-001",()=>{for(const label of ["Mes repères","Tester un scénario","Mes ajustements"])assert(!pilot.includes(label));},"SSR");
await test("PILOT-002",()=>assert(pilot.includes("prévus")),"SSR");
const targeted=model(withTarget("250.00","300.00"));
await test("PILOT-003",()=>assert(html(MonthPilotIndex,{model:targeted,draftCount:0}).includes("Budget cible")),"SSR");
await test("PILOT-004",()=>assert(html(MonthPilotIndex,{model:targeted,draftCount:0}).includes("Ajustement appliqué")),"SSR");
const operation=choice().operations[0],trial=wb(base,{kind:"FREE_EXPLORATION"},[operation]);
const pilotCategory=html(MonthPilotEditor,{model:m,category:m.categoryControls.find(row=>row.key==="groceries"),trial,operations:[operation],pending:false,replaceDraft(){},reset(){},apply(){}});
await test("PILOT-005",async()=>{reset();const before=countWrites();await actions.previewMonthControlCenter("2026-10",{kind:"FREE_EXPLORATION"},[operation]);assert.equal(countWrites(),before);});
await test("PILOT-006",()=>assert(pilotCategory.includes("Prévu → Testé")),"SSR");
await test("PILOT-007",()=>assert(pilotCategory.includes('value="save-category-target"')&&pilotCategory.includes("comme cible")),"SSR");
await test("PILOT-008",()=>assert(pilotCategory.includes("Appliquer à octobre")),"SSR");
await test("PILOT-009",()=>assert.deepEqual(trial.preview,simulate(base,{operations:[operation]}).view));
await test("PILOT-010",()=>{assert(!ui.includes("simulateMonthChoice("));assert(!ui.includes("deriveMonthScenario("));assert(ui.includes("trial.scenario"));},"STATIC");
const historicalMonths=["2026-04","2026-05","2026-06"];
const observedEvidence={...evidence,completeMonthsBySource:{BANK:historicalMonths,SWILE:historicalMonths,EDENRED:historicalMonths,MOBILITY:historicalMonths},history:{...evidence.history,economicEntries:historicalMonths.map((month,i)=>({...entries[0],operationId:"history-"+i,date:month+"-01",amount:String([360,445,590][i])}))}};
const observed=history("groceries",observedEvidence,historicalMonths,base.asOf,"2026-10");
await test("PILOT-HISTORY-001",()=>assert.equal(observed.min,"360.00"));
await test("PILOT-HISTORY-002",()=>assert.equal(observed.median,"445.00"));
await test("PILOT-HISTORY-003",()=>assert.equal(observed.max,"590.00"));
await test("PILOT-HISTORY-004",()=>{assert(!fs.readFileSync("src/server/phase2/month-category-history.ts","utf8").includes("projectedMonth"));assert.deepEqual(history("groceries",{...observedEvidence,irrelevantForecast:{low:1,central:2,high:3}},historicalMonths,base.asOf,"2026-10"),observed);},"DOMAIN_STATIC");
await test("PILOT-HISTORY-005",()=>{for(const historyMonths of [[],historicalMonths.slice(0,2)])assert.equal(history("groceries",{...observedEvidence,completeMonthsBySource:{BANK:historyMonths,SWILE:historyMonths,EDENRED:historyMonths}},historyMonths,base.asOf,"2026-10").status,"INSUFFICIENT");assert.equal(history("groceries",evidence,historicalMonths,base.asOf,"2026-10").status,"INSUFFICIENT");assert.equal(history("forged",observedEvidence,historicalMonths,base.asOf,"2026-10").status,"INSUFFICIENT");});
await test("DEEP-LINKS",()=>{assert.equal(focusAdapter("understand","history"),"info");assert.equal(focusAdapter("update","SWILE"),"update:item:SWILE");assert.equal(focusAdapter("choices","groceries"),"pilot:category:groceries");assert.equal(focusAdapter("choices","adjustments"),"pilot");assert(!monthControlUrl("/mois-a-venir?control=choices","choices","groceries").includes("control=choices"));});
await test("SPATIAL-ALL-ITEMS",()=>{const rendered=html(MonthUpdateSpatial,{model:manyModel,refreshing:false},"update","update:status:MODIFIED");for(const row of many)assert(rendered.includes(row.label));assert(!rendered.includes("Page 1/"));assert(!spatialSource.includes("classifyMonthUpdateItem("));},"SSR_STATIC");
await test("HISTORY-INCOMPLETE-PROVENANCE",()=>{const partial={...observedEvidence,history:{...observedEvidence.history,economicEntries:observedEvidence.history.economicEntries.map(row=>({...row,amountStatus:"PARTIAL"}))}};assert.equal(history("groceries",partial,historicalMonths,base.asOf,"2026-10").status,"INSUFFICIENT");const ambiguous={...observedEvidence,history:{...observedEvidence.history,economicEntries:historicalMonths.map(month=>({...entries[0],date:month+"-01",person:null,need:"Repas du midi au travail"}))}};assert.equal(history("manon-work-meals",ambiguous,historicalMonths,base.asOf,"2026-10").status,"INSUFFICIENT");const future = history("groceries",observedEvidence,["2026-10","2026-11"],base.asOf,"2026-10"); assert.equal(future.count,3); assert(future.diagnostic.rejectedMonths.filter(row => ["2026-10","2026-11"].includes(row.month)).every(row => row.reasons.includes("CURRENT_OR_FUTURE_MONTH")));});
await test("ZERO-HISTORICAL-WRITE",()=>{assert.equal(h.client.writes.length,0);assert(writes.every(row=>row.table==="phase2_month_inputs"));assert(touched.every(table=>["phase2_month_inputs","phase2_planned_expenses","persons"].includes(table)));});

const undo = require("@/server/phase2/month-choice-undo.ts");
const originalSecret = process.env.SUPABASE_SECRET_KEY;
process.env.SUPABASE_SECRET_KEY = "synthetic-undo-check-only";
const doubleChoice = {operations:[operation,{kind:"SAVINGS",savingsId:saving.id,strategy:"ADJUST_SAVINGS",amount:"20.00"}]};
const changed = simulate(base,doubleChoice), after = {...base,inputs:changed.nextInputs};
const token = undo.makeMonthChoiceUndo(base,changed.nextInputs,doubleChoice,"fixture-household","fixture-user");
await test("POLISH-UNDO-01",()=>assert.deepEqual(undo.restoreMonthChoiceUndo(after,token,"fixture-household","fixture-user"),schema.parse(current)));
await test("POLISH-UNDO-02",()=>assert.throws(()=>undo.restoreMonthChoiceUndo(after,token,"other-household","fixture-user")));
await test("POLISH-UNDO-03",()=>assert.throws(()=>undo.restoreMonthChoiceUndo(after,token,"fixture-household","other-user")));
await test("POLISH-UNDO-04",()=>assert.throws(()=>undo.restoreMonthChoiceUndo({...after,inputs:schema.parse({...after.inputs,openingBalance:{amount:"999.00",asOfDate:base.asOf}})},token,"fixture-household","fixture-user")));
await test("POLISH-UNDO-05",()=>assert.throws(()=>undo.restoreMonthChoiceUndo(after,token.slice(0,-3)+"xyz","fixture-household","fixture-user")));
await test("POLISH-UNDO-06",()=>{const now=Date.now;Date.now=()=>now()+11*60_000;try{assert.throws(()=>undo.restoreMonthChoiceUndo(after,token,"fixture-household","fixture-user"))}finally{Date.now=now}});
await test("POLISH-UNDO-07",()=>{assert(!token.includes("fixture-household"));assert.equal(undo.restoreMonthChoiceUndo(after,token,"fixture-household","fixture-user").declaredOutflows.find(row=>row.adjustability==="PROTECTED").amount,current.declaredOutflows.find(row=>row.adjustability==="PROTECTED").amount)});
if(originalSecret===undefined)delete process.env.SUPABASE_SECRET_KEY;else process.env.SUPABASE_SECRET_KEY=originalSecret;
await test("POLISH-DIRECT-EDITOR",()=>{const rendered=html(MonthUpdateSpatial,{model:m,refreshing:false},"update","update:status:NEEDS_UPDATE");assert(rendered.includes('name="openingAmount"'));assert(!rendered.includes("Renseigner cette information"))},"SSR");
await test("POLISH-PROTECTED-READONLY",()=>{const protectedSaving=m.savings.find(row=>row.adjustability==="PROTECTED");const rendered=choiceFocusHtml('savings:'+protectedSaving.id);assert(!rendered.includes('<form'));assert(!rendered.includes('<input'));assert(rendered.includes('Intouchable ce mois-ci'))},"SSR");
await test("POLISH-OBSERVED-INCOMPLETE",()=>assert(html(MonthPilotEditor,{model:{...m,reliability:{...m.reliability,importsMissing:true}},category:m.categoryControls[0],trial:null,operations:[],pending:false,replaceDraft(){},reset(){},apply(){}}).includes('À consolider')),"SSR");
await test("POLISH-HISTORY-PLACEHOLDER",()=>{assert(pilotCategory.includes('Historique en construction'));assert(pilotCategory.includes('/3 mois comparables'));assert(!pilotCategory.includes('Mois bas'));assert(!pilotCategory.includes('Médiane'));assert(!pilotCategory.includes('Mois haut'))},"SSR");
await test("POLISH-NAVIGATION-RESET",()=>{assert(center.includes('root.scrollTop = 0'));assert(!center.includes('scrollIntoView'));assert(center.includes('preventScroll: true'))},"STATIC");
await test("POLISH-PREVIEW-SEQUENCE",()=>{assert(center.includes('sequence === request.current'));assert(center.includes('clearTimeout(previewTimer.current)'));assert(center.includes('nextOperations.length ? 180'))},"STATIC");
await test("POLISH-SHORT-DESKTOP-CSS",()=>{const css=src('month-control-center.module.css');assert(!css.includes('min-height: 640px'));assert(!css.includes('min-height: 620px'));assert(!/overflow:\s*auto/.test(css));assert(!css.includes('display: block; }.workspaceRoot'))},"STATIC");

if (configured !== undefined) process.env.PHASE2_FORECAST_TEMPORAL_MODE = configured;
fs.mkdirSync("outputs",{recursive:true});fs.writeFileSync("outputs/phase2-month-control-center-spatial-ux-tests.json",JSON.stringify({status:"PASS",scope:"Synthetic real owners/actions, pure domain and SSR; static mechanics labeled. Browser evidence separate. No live writes.",historicalWrites:0,results},null,2));console.log("PASS "+results.length+"/"+results.length+" spatial checks");
