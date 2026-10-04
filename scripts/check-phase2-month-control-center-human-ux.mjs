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
const { MonthWorkspaceRoot } = require("@/app/mois-a-venir/month-control-workspace.tsx");
const { monthControlSection, monthControlDestination, monthControlUrl } = require("@/domain/phase2/month-control-contract.ts");
const { projectMonthControlCenter: model, projectMonthControlWorkbench: wb } = require("@/server/phase2/month-control-center.ts");
const { MonthControlSavings, MonthChoiceFocus } = require("@/app/mois-a-venir/month-control-choices.tsx");
const { MonthPilotIndex: MonthControlLimits, MonthPilotIndex: MonthControlActiveChoices } = require("@/app/mois-a-venir/month-control-workspace.tsx");
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
await test("HUX-001", () => { assert(!center.includes("MONTH_CONTROL_TABS")); });
await test("HUX-002", () => { assert(!center.includes("styles.sidebar")); });
for (const [id, label] of [["HUX-003", "À piloter"], ["HUX-004", "Hypothèses & exceptions"], ["HUX-005", "Ressources & réserves"], ["HUX-006", "Données & fiabilité"]]) await test(id, () => assert(!center.includes(label)));
await test("HUX-007", () => { assert(center.includes('section = "choices"')); assert(src("month-section-nav.tsx").includes('<MonthControlLink section="choices"')); }, "STATIC");
for (const [id, old, expected] of [["HUX-008", "overview", "choices"], ["HUX-009", "settings", "update"], ["HUX-010", "resources", "update"], ["HUX-011", "reliability", "understand"]]) await test(id, () => assert.equal(monthControlSection(old), expected));
for (const [id, ui, forbidden] of [["HUX-012", choiceUi, "update"], ["HUX-013", choiceUi, "understand"], ["HUX-014", updateUi, "choices"], ["HUX-015", updateUi, "understand"], ["HUX-016", understandUi, "choices"], ["HUX-017", understandUi, "update"]]) await test(id, () => { assert(!ui.includes(`section="${forbidden}"`)); assert(!ui.includes("MonthControlLink")); assert(!ui.includes("navigate(")); }, "STATIC");
await test("HUX-018", () => { const rendered = updateHtml("SWILE"); assert(rendered.includes('data-local-focus="SWILE"')); assert(rendered.includes("Retour à Mettre à jour")); assert(!rendered.includes("data-update-spatial")); });
await test("HUX-019", () => { assert(updateHtml().includes("data-update-spatial")); assert(src("month-control-focus.tsx").includes("openEntity(null)")); }, "SSR_STATIC");
await test("HUX-020", async () => { reset(); const before = countWrites(); const result = await actions.updateMonthControlInputs(form({ intent: "add-wallet-balance-observation", provider: "SWILE", walletBalanceAmount: "234.56", walletBalanceDate: base.asOf })); assert(result.ok); assert.equal(countWrites() - before, 1); const reloaded = await realRead(h.client, h.householdId, "2026-10"), next = model({ ...base, inputs: reloaded.inputs }); assert(updateHtml("SWILE", next, derive(live, reloaded.inputs, null, base.asOf, [])).includes('data-local-focus="SWILE"')); assert(!center.slice(center.indexOf("const sendForm"), center.indexOf("return <ControlContext.Provider")).includes("setSection(")); reset(); });
await test("HUX-021", () => { const rendered = choiceFocusHtml(`savings:${m.savings[0].id}`); assert(rendered.includes("← Retour")); assert(rendered.includes(m.savings[0].label)); });
await test("HUX-022", async () => { reset(); const row = m.savings[0], before = countWrites(); assert((await actions.updateMonthControlInputs(form({ intent: "update-declared-savings", outflowId: row.id, outflowLabel: row.label, outflowAmount: "1250.50", outflowAdjustability: "PROTECTED" }))).ok); assert.equal(countWrites() - before, 1); const reload = await realRead(h.client, h.householdId, "2026-10"); assert.equal(reload.inputs.declaredOutflows[0].id, row.id); assert.equal(reload.inputs.declaredOutflows[0].amount, "1250.50"); const rendered = html(MonthChoiceFocus, { model: model({ ...base, inputs: reload.inputs }) }, "choices", `savings:${row.id}`); assert(rendered.includes(`data-local-focus="savings:${row.id}"`)); reset(); });
await test("HUX-023", () => assert.deepEqual(monthControlDestination("resources", "SWILE"), { section: "update", focus: "SWILE" }));
await test("HUX-024", () => { assert.deepEqual(monthControlDestination("resources", "savings"), { section: "choices", focus: "savings" }); assert(src("month-savings-section.tsx").includes('section="choices" focus={`savings:${item.id}`}')); });
await test("HUX-025", () => { const rendered = updateHtml(); assert(!rendered.includes("<form")); assert(!rendered.includes('type="number"')); assert(!rendered.includes("ResourceEditor")); });
await test("HUX-026", () => { const rendered = updateHtml("SWILE"); assert(rendered.includes('name="walletBalanceAmount"')); assert(!rendered.includes('name="walletLoadingAmount"')); });
await test("HUX-027", () => { const rendered = html(WalletBalanceForm, { model: m, provider: "SWILE" }, "update", "SWILE"); assert.equal((rendered.match(/<form /g) ?? []).length, 1); assert(rendered.includes('name="walletBalanceAmount"')); assert(!rendered.includes('name="walletLoadingAmount"')); });
await test("HUX-028", () => { const rendered = html(WalletLoadingForm, { model: m, provider: "SWILE" }, "update", "SWILE"); assert(rendered.includes('name="walletLoadingAmount"')); assert(!rendered.includes('name="walletBalanceAmount"')); assert(rendered.includes("Non précisée")); });
await test("HUX-029", () => assert(!updateHtml().includes("Voir comment le disponible est calculé")));
await test("HUX-030", () => { const rendered = updateHtml("BANK"); assert(rendered.includes('name="openingAmount"')); assert(!rendered.includes("Charges restant à débiter")); assert(src("month-control-center.module.css").includes("max-width: 720px")); });
await test("HUX-031", () => { const rendered = choiceFocusHtml("category:groceries"); assert(rendered.includes("Diminuer Votre repère de 5 %")); assert(rendered.includes("Augmenter Votre repère de 5 %")); assert(!rendered.includes("25 €")); });
await test("HUX-032", () => { assert.equal(stepCurrencyDraft("234.56", 25), "259.56"); assert.equal(stepCurrencyDraft("0.01", -25), "0.00"); assert.equal(stepCurrencyDraft("10.25", 0.01), "10.26"); assert(src("currency-stepper.tsx").includes("Saisir précisément")); assert(src("currency-stepper.tsx").includes('step="0.01"')); });
await test("HUX-033", () => { const rendered = choiceFocusHtml("global-goal"); assert(rendered.includes("Votre objectif de 5 %")); assert(rendered.includes("Fin de mois estimée")); });
await test("HUX-034", () => { const rendered = choiceFocusHtml(`savings:${m.savings[0].id}`); assert(rendered.includes("de 5 %")); assert(rendered.includes("Continuer")); assert(!rendered.includes("Supprimer cette cagnotte")); });
await test("HUX-035", () => { const rendered = choiceFocusHtml(`savings:${m.savings[0].id}`); assert(!rendered.includes("La protéger")); assert(!rendered.includes("La laisser ajustable")); assert(src("month-choice-editors.tsx").includes("jamais proposée")); assert(!rendered.includes("<select")); });
await test("HUX-036", () => { const row = live.components.find(row => /Ornikar/iu.test(row.label)); const rendered = updateHtml(row.key); for (const value of [">Oui<", ">Non<", ">Pas sûr<"]) assert(rendered.includes(value)); });
await test("HUX-037", () => { const rendered = updateHtml("obligation:rent"); for (const value of ["Comme prévu", "Pas ce mois-ci", "Montant différent"]) assert(rendered.includes(value)); });
await test("HUX-038", () => { const bank = updateHtml("BANK"), wallet = html(WalletBalanceForm, { model: m, provider: "SWILE" }); assert(bank.includes("Aujourd’hui")); assert(wallet.includes("Aujourd’hui")); assert(!bank.includes('type="date"')); });
await test("HUX-039", async () => { reset(); const key = live.income.components.find(row => row.central !== null).key; assert((await actions.updateMonthControlInputs(form({ intent: "set-resource-override", resourceKey: key, resourceAmount: "2010.50" }))).ok); const read = await realRead(h.client, h.householdId, "2026-10"), ctx = { ...base, inputs: read.inputs }, next = model(ctx); const rendered = updateHtml(`resource-${key.replace(/[^a-zA-Z0-9:-]/gu, "-")}`, next, derive(live, read.inputs, null, base.asOf, [])); assert(rendered.includes("Revenir au montant prévu")); reset(); });
await test("HUX-040", () => { for (const Component of [MonthControlLimits, MonthControlActiveChoices, MonthControlSavings]) { const rendered = html(Component, { model: m }); for (const label of ["Hypothèses personnalisées", "Exceptions actives", "FULL_MONTH_SAFE", "assumption"]) assert(!rendered.replace(/<input[^>]+>/gu, "").includes(label)); } const rendered = html(MonthReliabilityPanel, { model: m }, "understand"); assert(!rendered.includes("FULL_MONTH_SAFE")); assert(!rendered.includes("Mettre à jour Swile")); });
await test("HUX-041", () => { const urls = [monthControlUrl("/mois-a-venir?month=2026-10", "resources", "SWILE"), monthControlUrl("/mois-a-venir?month=2026-10", "resources", "reserve-1"), monthControlUrl("/mois-a-venir?month=2026-10", "choices", "groceries")]; assert(urls[0].includes("control=center&focus=update%3Aitem%3ASWILE")); assert(urls[1].includes("control=center&focus=reserve-1")); assert.equal(new URL(urls[2], "http://month.local").searchParams.get("focus"), "pilot:category:groceries"); assert(urls.every(url => !url.includes("operations"))); });
await test("HUX-042", async () => { reset(); const before = countWrites(); const result = await actions.updateMonthControlInputs(form({ intent: "set-month-fixed-state", componentKey: "obligation:rent", fixedState: "EXPECTED" })); assert(result.ok); assert.equal(countWrites() - before, 1); const read = await realRead(h.client, h.householdId, "2026-10"); assert(!read.inputs.excludedFixedObligations.includes("obligation:rent")); assert.equal(read.inputs.fixedAmountOverrides["obligation:rent"], undefined); reset(); });
await test("HUX-043", async () => { reset(); for (const state of ["ABSENT", "DIFFERENT"]) { assert((await actions.updateMonthControlInputs(form({ intent: "set-month-fixed-state", componentKey: "obligation:rent", fixedState: state, obligationAmount: "255.74", obligationDate: "2026-10-13" }))).ok); const read = await realRead(h.client, h.householdId, "2026-10"); assert.equal(read.inputs.excludedFixedObligations.includes("obligation:rent"), state === "ABSENT"); if (state === "DIFFERENT") assert.equal(read.inputs.fixedAmountOverrides["obligation:rent"].amount, "255.74"); } reset(); });
await test("HUX-044", async () => { reset(); const before = countWrites(); for (const values of [{ intent: "set-month-fixed-state", componentKey: "forged", fixedState: "EXPECTED" }, { intent: "set-month-fixed-state", componentKey: "obligation:rent", fixedState: "INVALID" }, { intent: "update-declared-savings", outflowId: randomUUID(), outflowLabel: "Foreign", outflowAmount: "50", outflowAdjustability: "PROTECTED" }, { intent: "update-declared-savings", outflowId: m.savings[0].id, outflowLabel: "Invalid", outflowAmount: "-50", outflowAdjustability: "PROTECTED" }]) assert.equal((await actions.updateMonthControlInputs(form(values))).ok, false); assert.equal(countWrites(), before); });
await test("HUX-045", async () => { reset(); for (const mode of ["LOWER", "HIGHER", "CUSTOM"]) { assert((await actions.updateMonthControlInputs(form({ intent: "save-month-assumption", categoryKey: "groceries", assumptionMode: mode, assumptionAmount: "350.00" }))).ok); assert.equal(h.facts.inputs["2026-10"].decision.assumptions.groceries.mode, mode); } assert((await actions.updateMonthControlInputs(form({ intent: "clear-month-assumption", categoryKey: "groceries" }))).ok); assert.equal(h.facts.inputs["2026-10"].decision.assumptions.groceries, undefined); reset(); });
await test("HUX-046", async () => { reset(); const before = countWrites(); wb(base, { kind: "FREE_EXPLORATION" }, []); await actions.previewMonthControlCenter("2026-10", { kind: "FREE_EXPLORATION" }, choice().operations); assert.equal(countWrites(), before); assert.equal(h.client.writes.length, 0); assert(writes.every(row => row.table === "phase2_month_inputs")); });
await test("HUX-047", () => { const htmlValue = html(MonthControlLimits, { model: m }); assert(!htmlValue.includes('type="number"')); assert(!htmlValue.includes("<form")); const rendered = html(CurrencyStepper, { value: "447.56", onChange() {}, label: "l’objectif Courses", name: "categoryTarget" }); assert(rendered.includes('name="categoryTarget" value="447.56"')); assert(!rendered.includes('type="number"')); });
await test("HUX-048", () => { const page = src("page.tsx"); assert(page.includes("monthControlDestination(params.control")); assert(!page.includes("initialSection={monthControlSection(params.control)}")); assert(!center.includes('target.querySelectorAll<HTMLDetailsElement>("details")')); }, "STATIC");
await test("HUX-049", () => { const { controlObligationLabel } = require("@/domain/phase2/month-control-display.ts"); assert.equal(controlObligationLabel("Google One – Google AI Pro – 5 To (carte X1234)"), "Google AI Pro"); assert.equal(controlObligationLabel("Ornikar / Alma – Leçons"), "Ornikar"); assert.equal(controlObligationLabel("Qobuz – Streaming musical"), "Qobuz"); assert.equal(controlObligationLabel("Nexity – Loyer"), "Loyer"); });
await test("HUX-050", () => { const rendered = html(HumanDateField, { name: "outflowDate", today: "2026-10-04", initial: "2026-10-04", optional: true }); assert(rendered.includes('type="date"')); assert(rendered.includes('name="outflowDate"')); assert(rendered.includes('value="2026-10-04"')); });
await test("HUX-051", () => { const row = { ...m.categoryControls[0], capabilities: { ...m.categoryControls[0].capabilities, targetAllowed: false } }; const restricted = { ...m, categoryControls: [row] }; const focus = html(MonthChoiceFocus, { model: restricted }, "choices", `category:${row.key}`); assert(!focus.includes('name="categoryTarget"')); });
await test("HUX-052", () => { for (const focus of ["savings", "global-goal", "goals", "simulator", "reserve-1", `savings:${randomUUID()}`]) assert.deepEqual(monthControlDestination("settings", focus), { section: "choices", focus }); });
await test("HUX-053", () => { for (const value of ["__proto__", "constructor", "toString", "forged", [], null]) assert.equal(monthControlSection(value), null); });
if (configured !== undefined) process.env.PHASE2_FORECAST_TEMPORAL_MODE = configured;
fs.mkdirSync("outputs", { recursive: true });
fs.writeFileSync("outputs/phase2-month-control-center-human-ux-tests.json", JSON.stringify({ status: "PASS", scope: "Synthetic fixtures, real monthly owner actions, SSR and explicitly identified static checks. Browser interaction/live writes are reported separately.", historicalWrites: 0, plannedExpenseWrites: 0, results }, null, 2));
console.log(`PASS ${results.length}/${results.length} human control center UX checks`);
