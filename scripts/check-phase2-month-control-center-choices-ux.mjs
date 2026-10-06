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
const { PercentStepper, RelativeAmountControl, ChoicePages } = require("@/app/mois-a-venir/month-choice-controls.tsx");
const { controlMoney: money } = require("@/domain/phase2/month-control-display.ts");
const { AdjustmentFocus, SavingsFocus } = require("@/app/mois-a-venir/month-choice-editors.tsx");
const { MonthControlSimulator } = require("@/app/mois-a-venir/month-control-simulator.tsx");
const { relativeAmountDraft, relativePercentDraft, rankChoiceCategories, choicePage } = require("@/domain/phase2/month-choice-ui-draft.ts");
const editors = src("month-choice-editors.tsx"), simulator = src("month-control-simulator.tsx"), widgets = src("month-choice-controls.tsx"), css = src("month-control-center.module.css");
const hub = html(MonthChoicesHub, { model: m, draftCount: 0 });
const centerHtml = html(MonthControlCenter, { model: m, initialSection: "choices", update: null, understand: null, children: null });
const restaurant = choice("household-restaurants", "REDUCE_PERCENT", "100").operations[0];
const tobacco = choice("tobacco-vape", "REDUCE_PERCENT", "20").operations[0];
const first = wb(base, { kind: "FREE_EXPLORATION" }, [restaurant]), second = wb(base, { kind: "FREE_EXPLORATION" }, [restaurant, tobacco]);
const simHtml = trial => html(MonthControlSimulator, { model: trial.model, trial, purpose: trial.purpose, operations: trial.operations, pending: false, replaceDraft() {}, recalculate() {}, apply() {} });
await test("CHOICES-UX-001", () => assert(!centerHtml.includes("Comprendre, décider et comparer")), "SSR");
await test("CHOICES-UX-002", () => assert(!centerHtml.includes("contextSummary")), "SSR");
for (const [id, text] of [["003", "Fin de mois"], ["004", "Définir un objectif"], ["005", "État des données"]]) await test(`CHOICES-UX-${id}`, () => assert(centerHtml.slice(0, centerHtml.indexOf('data-overlay-content')).includes(text)), "SSR");
await test("CHOICES-UX-006", () => { assert(center.includes("setToast")); assert(center.includes("10000")); assert(css.includes(".saveToast, .status, .pendingNotice { position: absolute")); }, "STATIC");
await test("CHOICES-UX-010", () => assert(!hub.includes("<h2")), "SSR");
await test("CHOICES-UX-011", () => assert.equal((hub.match(/data-control-hub=/gu) ?? []).length, 3), "SSR");
for (const [id, text] of [["012", "Piloter mon mois"], ["013", "Mettre à jour"], ["014", "Tester, se fixer un budget cible"], ["015", "Mes cagnottes"]]) await test(`CHOICES-UX-${id}`, () => assert(hub.includes(text)), "SSR");
await test("CHOICES-UX-016", () => { for (const tag of ["<form", "<input", "<select"]) assert(!hub.includes(tag)); assert.equal((hub.match(/<button /gu) ?? []).length, 3); }, "SSR");
const targetHtml = choiceFocusHtml("category:groceries"), goalHtml = choiceFocusHtml("global-goal");
await test("CHOICES-UX-020", () => { assert(targetHtml.includes("de 5 %")); assert.equal(relativeAmountDraft("497.00", -20), "397.60"); assert.equal(relativeAmountDraft("497.06", -20), "397.65"); });
await test("CHOICES-UX-021", () => assert(!targetHtml.includes("25 €")), "SSR");
await test("CHOICES-UX-022", () => assert(targetHtml.includes("Votre budget cible")), "SSR");
await test("CHOICES-UX-023", async () => { reset(); const target = relativeAmountDraft("497.00", -20); assert((await actions.updateMonthControlInputs(form({ intent: "save-category-target", categoryKey: "groceries", categoryTarget: target }))).ok); const row = (await realRead(h.client, h.householdId, "2026-10")).inputs.decision; assert.equal(row.categoryTargets.groceries, "397.60"); assert.deepEqual(Object.keys(row.categoryTargets), ["groceries"]); const next = model({ ...base, inputs: { ...current, decision: row } }); assert.equal(next.categoryControls.find(row => row.key === "groceries").target, "397.60"); reset(); });
await test("CHOICES-UX-024", () => { assert(targetHtml.includes("Saisir un montant précis")); assert(!targetHtml.includes('type="number"')); assert(widgets.includes('step="0.01"')); }, "SSR_STATIC");
await test("CHOICES-UX-025", () => assert(goalHtml.includes('name="monthGoal"') && goalHtml.includes('type="number"')), "SSR");
await test("CHOICES-UX-026", async () => { reset(); const value = relativeAmountDraft("811.00", 10); assert.equal(value, "892.10"); assert((await actions.updateMonthControlInputs(form({ intent: "save-month-goal", monthGoal: value }))).ok); assert.equal((await realRead(h.client, h.householdId, "2026-10")).inputs.decision.goal, "892.10"); reset(); });
await test("CHOICES-UX-027", () => { assert.equal(require("@/domain/phase2/month-control-display.ts").controlMoney("810.55"), "811 €"); assert.equal(require("@/domain/phase2/month-control-display.ts").controlMoney("810.55", true), "810,55 €"); });
const targeted = model(withTarget("398.00", "497.00"));
await test("CHOICES-UX-030", () => assert(html(MonthControlLimits, { model: targeted }).includes('aria-pressed="true"')), "SSR");
await test("CHOICES-UX-031", () => { const rendered = html(MonthControlLimits, { model: targeted }); for (const text of ["prévus", "Budget cible", "au-dessus"]) assert(rendered.includes(text)); });
await test("CHOICES-UX-032", () => { const rendered = html(MonthControlLimits, { model: m }); assert(rendered.includes("Suivi uniquement")); assert(rendered.includes("Trajets travail")); });
await test("CHOICES-UX-033", () => { const future = { ...m.categoryControls[0], key: "new-category", label: "Nouveau poste", target: "1.00" }; assert.equal(rankChoiceCategories([...m.categoryControls, future])[0].key, future.key); assert.equal(choicePage(Array.from({ length: 17 }, (_, i) => i), 2).length, 5); });
await test("CHOICES-UX-034", () => { const rows = Array.from({ length: 17 }, (_, i) => i); assert.deepEqual([0, 1, 2].flatMap(page => choicePage(rows, page)), rows); assert(html(ChoicePages, { count: 17, page: 0, setPage() {} }).includes("Autres postes")); });
await test("CHOICES-UX-040", () => { const rendered = simHtml(wb(base, { kind: "FREE_EXPLORATION" }, [])); assert(rendered.includes("Que voulez-vous changer")); assert(!rendered.includes("Plus aucune dépense")); assert(!rendered.includes("<select")); assert(!rendered.includes("Appliquer ce scénario")); }, "SSR");
await test("CHOICES-UX-041", () => { for (const stage of ["CATEGORY", "OPTION", "RESULT"]) assert(simulator.includes(`stage === "${stage}"`)); }, "STATIC");
await test("CHOICES-UX-042", () => { const rendered = simHtml(first); assert(rendered.includes("impactHero")); assert(rendered.includes(money(first.budgetMarginGain))); assert(rendered.indexOf("impactHero") < rendered.indexOf("forecastResult")); }, "SSR");
await test("CHOICES-UX-043", () => assert(simHtml(first).includes(money(first.scenario.projectionSummary.economic.central))), "SSR");
await test("CHOICES-UX-044", () => assert(simHtml(first).includes(" → ")), "SSR");
await test("CHOICES-UX-045", () => assert(simHtml(first).includes("Impact fin de mois")), "SSR");
await test("CHOICES-UX-046", () => assert(!simHtml(first).includes("<table")), "SSR");
await test("CHOICES-UX-047", () => { assert(simHtml(first).includes("Voir le détail")); assert(simulator.includes('setStage("DETAIL")')); assert(simulator.includes("Voir davantage")); }, "SSR_STATIC");
await test("CHOICES-UX-048", () => { assert(simHtml(first).includes("Ajouter un deuxième choix")); assert(!simHtml(first).includes("Que voulez-vous changer")); }, "SSR");
await test("CHOICES-UX-049", () => { assert(!simHtml(second).includes("Ajouter un deuxième choix")); assert.throws(() => parseMonthChoice({ operations: [...second.operations, choice().operations[0]] })); });
await test("CHOICES-UX-050", () => assert.deepEqual(second.preview, simulate(base, { operations: [restaurant, tobacco] }).view));
await test("CHOICES-UX-055", () => { assert(!simulator.includes("<select")); assert(!simulator.includes('name="reduction"')); }, "STATIC");
await test("CHOICES-UX-056", () => { for (const stage of ["HOW", "PERCENT", "AMOUNT"]) assert(simulator.includes(`stage === "${stage}"`)); }, "STATIC");
await test("CHOICES-UX-057", () => assert(simulator.includes('capabilities.strategies.includes("REDUCE_PERCENT")')), "STATIC");
await test("CHOICES-UX-058", () => assert(simulator.includes('capabilities.strategies.includes("REDUCE_AMOUNT")')), "STATIC");
await test("CHOICES-UX-060", () => { const rendered = html(MonthControlActiveChoices, { model: targeted }); assert(rendered.includes("Courses")); assert(rendered.includes("Ajustement appliqué")); });
await test("CHOICES-UX-061", () => { const rendered = html(MonthControlActiveChoices, { model: m }); assert(rendered.includes("Aucun ajustement appliqué")); assert(!rendered.includes("Ajustement appliqué")); assert(!rendered.includes("<form")); });
for (const [id, direction] of [["062", "LOWER"], ["063", "HIGHER"]]) await test(`CHOICES-UX-${id}`, () => { assert(editors.includes(`step === "${direction}"`)); assert(editors.includes("<PercentStepper")); assert(editors.includes("model.habitualControls")); }, "STATIC");
await test("CHOICES-UX-064", () => assert(editors.includes('Reste habituel prévu (€)')), "STATIC");
await test("CHOICES-UX-065", async () => { reset(); assert((await actions.updateMonthControlInputs(form({ intent: "save-month-assumption", categoryKey: "groceries", assumptionMode: "CUSTOM", assumptionAmount: "0.00" }))).ok); assert((await actions.updateMonthControlInputs(form({ intent: "clear-month-assumption", categoryKey: "groceries" }))).ok); assert.equal(h.facts.inputs["2026-10"].decision.assumptions.groceries, undefined); reset(); });
await test("CHOICES-UX-070", () => { const rendered = html(SavingsFocus, { model: m }); assert(rendered.includes("Pour quel projet")); assert(rendered.includes("Pour quoi mettez-vous")); assert(!rendered.includes('type="number"')); assert(!rendered.includes("La protéger")); }, "SSR");
await test("CHOICES-UX-071", () => assert(editors.includes("[100, 250, 500, 1000]")), "STATIC");
await test("CHOICES-UX-072", () => { assert(!editors.includes("CurrencyStepper")); assert(!editors.includes("step={50}")); assert(editors.includes("saving && Number(saving.amount) > 0")); }, "STATIC");
await test("CHOICES-UX-073", () => assert(editors.includes('step === 3 ? <div') && editors.includes("La protéger")), "STATIC");
await test("CHOICES-UX-074", () => assert(editors.includes('step === 4 ? <div') && editors.includes("Pas de date")), "STATIC");
await test("CHOICES-UX-075", () => { assert(editors.includes('step === 5')); assert(editors.includes('data-save-ready={step === 5 || remove}')); assert(center.includes('form.dataset.saveReady === "false"')); }, "STATIC");
await test("CHOICES-UX-076", () => { const rendered = choiceFocusHtml(`savings:${m.savings.find(row => row.adjustability === "ADJUSTABLE").id}`); assert(!rendered.includes("de 5 %")); assert(rendered.includes("Nouveau montant")); }, "SSR");
await test("CHOICES-UX-077", () => assert(choiceFocusHtml(`savings:${m.savings.find(row => row.adjustability === "ADJUSTABLE").id}`).includes("Nouveau montant (€)")), "SSR");
await test("CHOICES-UX-078", async () => { reset(); const row = m.savings.find(row => row.adjustability === "ADJUSTABLE"), amount = relativeAmountDraft(row.amount, -10); assert((await actions.updateMonthControlInputs(form({ intent: "update-declared-savings", outflowId: row.id, outflowLabel: row.label, outflowAmount: amount, outflowAdjustability: "ADJUSTABLE", outflowDate: "2026-10-22" }))).ok); const reload = (await realRead(h.client, h.householdId, "2026-10")).inputs.declaredOutflows.find(item => item.id === row.id); assert.equal(reload.amount, amount); assert.equal(reload.dueDate, "2026-10-22"); assert.equal(reload.id, row.id); reset(); });
await test("CHOICES-UX-079", () => { assert.throws(() => simulate(base, savingsChoice(current.declaredOutflows[0])), /PROTECTED/u); assert.equal(first.model.projectionSummary.protectedSavings, second.scenario.projectionSummary.protectedSavings); });
await test("CHOICES-UX-080", () => { assert.equal(relativeAmountDraft("1200.00", -10), "1080.00"); assert.equal(relativeAmountDraft("0.00", 20), "0.00"); assert.equal(relativeAmountDraft("0.01", -5), "0.01"); assert.equal(relativePercentDraft("100", "80"), -20); });
await test("CHOICES-UX-081", async () => { reset(); const before = countWrites(); for (const fieldValues of [{ intent: "save-category-target", categoryKey: "forged", categoryTarget: "10.00" }, { intent: "save-month-goal", monthGoal: "-1" }, { intent: "save-category-target", categoryKey: "groceries", categoryTarget: "20%" }]) assert.equal((await actions.updateMonthControlInputs(form(fieldValues))).ok, false); assert.equal(countWrites(), before); });
await test("CHOICES-UX-082", async () => { reset(); const before = countWrites(); const preview = await actions.previewMonthControlCenter("2026-10", { kind: "FREE_EXPLORATION" }, [restaurant, tobacco]); assert.equal(countWrites(), before); assert((await actions.applyMonthChoice("2026-10", { operations: [restaurant, tobacco] }, preview.baseDigest)).ok); assert.equal(countWrites() - before, 1); const reload = (await realRead(h.client, h.householdId, "2026-10")).inputs; assert.deepEqual(run({ ...base, inputs: reload }).narrative.final, preview.preview.after); reset(); });
await test("CHOICES-UX-083", async () => { reset(); const preview = await actions.previewMonthControlCenter("2026-10", { kind: "FREE_EXPLORATION" }, [restaurant]); h.facts.inputs["2026-10"].openingBalance = { amount: "100.00", asOfDate: base.asOf }; const before = countWrites(); assert.equal((await actions.applyMonthChoice("2026-10", { operations: [restaurant] }, preview.baseDigest)).code, "STALE_PREVIEW"); assert.equal(countWrites(), before); reset(); });
await test("CHOICES-UX-084", () => { assert(!css.includes("min-height: 640px")); assert(!/overflow:\s*auto/.test(css)); assert(css.includes(".actionFooter { flex: 0 0 auto")); assert(!css.includes(".actionFooter { position: sticky")); }, "STATIC");
await test("CHOICES-UX-085", () => { const ctx = { ...base, inputs: schema.parse({ ...current, decision: { ...current.decision, assumptions: { groceries: { mode: "CUSTOM", amount: "0.00" } } } }) }; const original = model(base), revised = model(ctx); assert.equal(revised.habitualControls.find(row => row.key === "groceries").forecast, original.categoryControls.find(row => row.key === "groceries").forecast); assert.equal(revised.categoryControls.find(row => row.key === "groceries").reducibleRemaining, "0.00"); });
await test("CHOICES-UX-086", () => { const ctx = withTarget("100", "350", "96"), result = simulate(ctx, choice("groceries", "REDUCE_AMOUNT", "999")); assert.equal(cat(result.plan, "groceries").observedEconomic, "96.00"); assert.equal(cat(result.plan, "groceries").projectedMonth.central, "96.00"); });
await test("CHOICES-UX-087", () => { process.env.PHASE2_FORECAST_TEMPORAL_MODE = "AS_OF_TEMPORAL"; try { assert.deepEqual(wb(base, { kind: "FREE_EXPLORATION" }, [restaurant]).preview, simulate(base, { operations: [restaurant] }).view); } finally { delete process.env.PHASE2_FORECAST_TEMPORAL_MODE; } });
await test("CHOICES-UX-088", () => { assert.equal(m.reliability.mode, "FULL_MONTH_SAFE"); assert.equal(h.client.writes.length, 0); assert(writes.every(row => row.table === "phase2_month_inputs")); assert(touched.every(table => ["phase2_month_inputs", "phase2_planned_expenses", "persons", "phase2_month_plans"].includes(table))); });
await test("CHOICES-UX-089", () => assert.deepEqual(monthControlDestination("choices", "adjustments"), { section: "choices", focus: "adjustments" }));
await test("CHOICES-UX-090", () => { assert(editors.includes('key="confirm-saving" type="submit"')); assert(editors.includes('key="continue-saving"')); assert(editors.includes('event.preventDefault(); setStep(step + 1)')); }, "STATIC_BROWSER_REGRESSION");
if (configured !== undefined) process.env.PHASE2_FORECAST_TEMPORAL_MODE = configured;
fs.mkdirSync("outputs", { recursive: true });
fs.writeFileSync("outputs/phase2-month-control-center-choices-ux-tests.json", JSON.stringify({ status: "PASS", scope: "Synthetic owner actions, pure UI draft controls, SSR and labeled static checks. Browser dimensions and interactions are recorded separately; no live writes.", historicalWrites: 0, results }, null, 2));
console.log(`PASS ${results.length}/${results.length} choices UX checks`);
