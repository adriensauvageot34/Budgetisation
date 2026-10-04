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


const React = require("react"), { renderToStaticMarkup } = require("react-dom/server");
const { AppRouterContext } = require("next/dist/shared/lib/app-router-context.shared-runtime");
const router = { push() {}, replace() {}, refresh() {}, prefetch() {}, back() {}, forward() {} };
const html = (Component, props) => renderToStaticMarkup(React.createElement(AppRouterContext.Provider, { value: router }, React.createElement(Component, props)));
const { projectMonthControlCenter: model, projectMonthControlWorkbench: wb } = require("@/server/phase2/month-control-center.ts");
const { monthControlCategoryPresets: presets, replaceMonthControlOperation, parseMonthControlDraft } = require("@/domain/phase2/month-control-contract.ts");
const { controlDate, controlResourceLabel } = require("@/domain/phase2/month-control-display.ts");
const { MonthControlLink } = require("@/app/mois-a-venir/month-control-center.tsx");
const { MonthControlSimulator } = require("@/app/mois-a-venir/month-control-simulator.tsx");
const { MonthControlLimits: MonthControlObjectives, MonthControlActiveChoices, MonthControlSavings } = require("@/app/mois-a-venir/month-control-choices.tsx");
const { MonthUpdatePanel: MonthResourcesPanel, MonthReliabilityPanel } = require("@/app/mois-a-venir/month-control-panels.tsx");
const src = path => fs.readFileSync(`src/${path}`, "utf8");
const nav = src("app/mois-a-venir/month-section-nav.tsx"), ui = src("app/mois-a-venir/month-control-center.tsx"), simulator = src("app/mois-a-venir/month-control-simulator.tsx"), css = src("app/mois-a-venir/month-control-center.module.css");
const base = context(), m = model(base), purpose = { kind: "FREE_EXPLORATION" }, empty = wb(base, purpose, []);
const noop = () => {}, simulatorHtml = (trial, operations = trial.operations) => html(MonthControlSimulator, { model: trial.model, trial, purpose: trial.purpose, operations, pending: false, replaceDraft: noop, recalculate: noop, apply: noop });

const countWrites = () => writes.length + h.client.writes.length;
const restaurant100 = choice("household-restaurants", "REDUCE_PERCENT", "100").operations[0], tobacco20 = choice("tobacco-vape", "REDUCE_PERCENT", "20").operations[0];
const expense = (status = "PLANNED") => ({ id: randomUUID(), targetMonth: "2026-10", status, familyKey: "food", subtypeKey: "restaurant", title: "Repas synthétique",
  plannedDate: status === "PLANNED" ? "2026-10-22" : "2026-10-10", context: {}, costItems: [{ ...item("60.00", "restaurant:main", ["restaurant"]), baselineKey: "household-restaurants" }] });
const first = wb(base, purpose, [restaurant100]), second = wb(base, purpose, [restaurant100, tobacco20]);
await test("UX-001", () => { const story = src("app/mois-a-venir/month-story.tsx"); for (const text of ["Préciser le disponible bancaire", "Gérer les charges du mois", "Comprendre la fiabilité"]) assert(!story.includes(text)); assert.match(story, /ScenarioMilestone title="Projection de fin de mois"[^]*?\/>(?:\s*)<\/div>;/u); }, "STATIC");
await test("UX-002", () => { assert(nav.includes("data-month-actions")); assert(nav.includes("ml-auto flex shrink-0 items-center gap-2.5")); const actions = nav.slice(nav.indexOf("data-month-actions")); assert(actions.indexOf("<MonthControlLink") < actions.indexOf("+ Ajouter une dépense")); assert(!actions.includes("tabsViewport")); }, "STATIC");
await test("UX-003", () => { const markup = html(MonthControlLink, { section: "overview", actionableCount: 3 }); assert(markup.includes("notificationBadge")); assert(markup.includes("3 éléments à vérifier")); assert(!markup.includes("· 3")); assert(markup.includes("Centre de contrôle")); });
await test("UX-004", () => { assert(!html(MonthControlLink, { section: "overview", actionableCount: 0 }).includes("notificationBadge")); assert(css.includes("position: absolute; top: -6px; right: -6px")); });
await test("UX-005", () => { assert(m.rootCauses.some(row => row.key === "imports" && !row.actionable)); assert.equal(m.actionableCount, m.tensions.length + m.rootCauses.filter(row => row.actionable).length); assert.equal(new Set(m.rootCauses.map(row => row.key)).size, m.rootCauses.length); });
await test("UX-006", () => { assert.equal(m.goalState, "NO_GOALS_DEFINED"); assert(!m.headline.includes("respectés")); assert(m.headline.includes("pas encore défini")); });
await test("UX-007", () => { const ctx = { ...base, inputs: schema.parse({ ...current, decision: { ...current.decision, categoryTargets: { groceries: "9999" }, goal: "0" } }) }; assert.equal(model(ctx).goalState, "ALL_GOALS_MET"); assert(model(ctx).headline.includes("objectifs sont respectés")); });
await test("UX-008", () => { const result = model(withTarget("300", "342")); assert.equal(result.goalState, "GOALS_NEED_ATTENTION"); assert(result.headline.includes("demande votre attention")); });
await test("UX-009", () => { assert.equal(m.defaultPurpose.kind, "FREE_EXPLORATION"); assert(empty.shortcuts.length > 0); const rendered = simulatorHtml(empty); assert(rendered.includes("Que voulez-vous changer ?")); assert(rendered.includes("Restaurants du foyer")); assert(!rendered.includes("On ne faisait plus de restaurant")); assert(!rendered.includes("Explorer quand même")); });
await test("UX-010", () => { const rendered = simulatorHtml(empty); assert(!rendered.includes("Appliquer ce scénario au mois")); assert(!rendered.includes("Réinitialiser")); assert(!rendered.includes("<table")); });
await test("UX-011", () => { const rendered = html(MonthControlObjectives, { model: m, choosePurpose: noop }); for (const text of ["Mes repères", "Prévu", "Définir un repère", "Objectif de fin de mois"]) assert(rendered.includes(text)); assert(!rendered.includes('<input')); });
await test("UX-012", () => { const rendered = html(MonthControlObjectives, { model: m, choosePurpose: noop }); assert(rendered.includes("À suivre")); assert(!empty.shortcuts.some(row => row.categoryKey === "manon-work-mobility")); });
await test("UX-013", () => { const control = m.categoryControls.find(row => row.key === "household-restaurants"), values = presets(control.key, control.label, control.capabilities); assert(values.some(row => row.operation.percent === "100")); assert(values.some(row => row.operation.percent === "50")); assert(values.some(row => row.operation.strategy === "REDUCE_ONE_OCCURRENCE")); });
await test("UX-014", () => { const before = cat(run(base), "household-restaurants"), result = simulate(base, { operations: [restaurant100] }); assert.equal(cat(result.plan, "household-restaurants").projectedMonth.central, categoryDecisionFacts(before).irreversibleFloor); assert.equal(result.nextInputs.decision.assumptions["household-restaurants"].amount, "0.00"); });
await test("UX-015", () => { const observed = { ...entries.find(row => row.subcategory === "Restaurant"), operationId: "observed-restaurant", date: "2026-10-02", amount: "25.00" }; const ctx = { ...base, forecast: { ...live, predictionEvidence: { ...evidence, currentEconomicEntries: [observed] } } }; const result = simulate(ctx, { operations: [restaurant100] }); assert.equal(cat(result.plan, "household-restaurants").observedEconomic, "25.00"); assert.equal(cat(result.plan, "household-restaurants").projectedMonth.central, "25.00"); });
await test("UX-016", () => { const ctx = { ...base, expenses: [expense()] }, before = run(ctx), result = simulate(ctx, { operations: [restaurant100] }); assert.equal(cat(result.plan, "household-restaurants").projectedMonth.central, "60.00"); assert.deepEqual(result.plan.plannedExpenses, before.plannedExpenses); });
await test("UX-017", () => { const ctx = { ...base, expenses: [expense("DECLARED_REALIZED")] }, result = simulate(ctx, { operations: [restaurant100] }); assert.equal(cat(result.plan, "household-restaurants").declaredRealizedEconomic, "60.00"); assert.equal(cat(result.plan, "household-restaurants").projectedMonth.central, "60.00"); });
await test("UX-018", () => { const result = simulate(base, choice("household-restaurants", "REDUCE_ONE_OCCURRENCE")); assert.equal(result.view.categoryImpacts.find(row => row.key === "household-restaurants").reduction, cat(run(base), "household-restaurants").conditionalMedianAmount); });
await test("UX-019", () => { const half = empty.shortcuts.find(row => row.categoryKey === "household-restaurants" && row.operation.percent === "50"); assert.deepEqual(half.preview, simulate(base, { operations: [half.operation] }).view); });
for (const percent of ["5", "10", "20"]) await test(`UX-TOBACCO-${percent}`, () => { const offer = empty.shortcuts.find(row => row.categoryKey === "tobacco-vape" && row.operation.percent === percent); assert(offer); assert.deepEqual(offer.preview, simulate(base, { operations: [offer.operation] }).view); });
for (const amount of ["25", "50", "100"]) await test(`UX-GROCERIES-${amount}`, () => { const offer = empty.shortcuts.find(row => row.categoryKey === "groceries" && row.operation.amount === amount); assert(offer); assert.deepEqual(offer.preview, simulate(base, { operations: [offer.operation] }).view); });
await test("UX-020", () => { const ctx = withTarget("100", "38"), result = simulate(ctx, choice("groceries", "REDUCE_AMOUNT", "100")); assert.equal(result.view.spendingReduction, "38.00"); assert.equal(cat(result.plan, "groceries").projectedMonth.central, "0.00"); });
await test("UX-021", () => { const ctx = withTarget("300", "350", "96"), result = simulate(ctx, choice("groceries", "REDUCE_AMOUNT", "999")); assert.equal(cat(result.plan, "groceries").projectedMonth.central, "96.00"); assert(simulator.includes('stage === "HOW"')); assert(!simulator.includes("<select")); });
await test("UX-022", () => { const rendered = simulatorHtml(first); assert(rendered.includes("1 choix sur 2")); assert(rendered.includes("Voir le détail")); assert(!rendered.includes("<table")); assert(rendered.includes("Ajouter un deuxième choix")); assert(rendered.includes("Appliquer ce scénario")); });
await test("UX-023", () => assert.deepEqual(second.preview, simulate(base, { operations: [restaurant100, tobacco20] }).view));
await test("UX-024", () => { assert(!first.shortcuts.some(row => row.categoryKey === "household-restaurants")); assert(first.shortcuts.some(row => row.categoryKey === "tobacco-vape")); const offer = first.shortcuts.find(row => row.operation.percent === "20"); assert.deepEqual(offer.preview.after, second.preview.after); });
await test("UX-025", () => { assert.equal(second.shortcuts.length, 0); assert.equal(second.offers.length, 0); assert.throws(() => replaceMonthControlOperation(second.operations, choice().operations[0]), /FULL/u); assert.throws(() => parseMonthControlDraft([...second.operations, choice().operations[0]])); });
await test("UX-026", () => { assert(css.includes(".actionFooter { flex: 0 0 auto")); assert(simulatorHtml(first).includes("Rien n’est encore enregistré")); }, "STATIC");
await test("UX-027", () => { const protectedId = current.declaredOutflows[0].id; assert(!empty.offers.some(row => row.operation.savingsId === protectedId)); assert.equal(first.model.projectionSummary.protectedSavings, second.scenario.projectionSummary.protectedSavings); assert(simulator.includes("Réservation ajustable")); });
await test("UX-028", () => { assert.equal(second.reservationRelease, "0.00"); assert.equal(second.spendingReduction, second.budgetMarginGain); const savings = wb(base, purpose, savingsChoice().operations); assert.equal(savings.spendingReduction, "0.00"); assert.equal(savings.reservationRelease, "42.00"); });
await test("UX-029", () => { const constrained = m.categoryControls.find(row => row.key === "manon-work-mobility"); assert.equal(presets(constrained.key, constrained.label, constrained.capabilities).length, 0); const restricted = { ...m.categoryControls[0].capabilities, strategies: ["REDUCE_AMOUNT"] }; assert.equal(presets("tobacco-vape", "Tabac", restricted).length, 0); });
await test("UX-030", () => { const rendered = html(MonthControlActiveChoices, { model: m }); assert(rendered.includes("Aucun ajustement actif")); assert(!rendered.includes("Swile")); assert(!rendered.includes("Banque")); });
await test("UX-031", () => { assert.throws(() => schema.parse({ ...current, openingBalance: { amount: "100.00", asOfDate: null } }), /DATE_INVALID/u); assert(!m.observations.some(row => row.key === "bank")); assert(m.observations.every(row => row.amount !== null && row.date !== null)); });
await test("UX-032", () => { assert(m.rootCauses.some(row => row.key === "imports" && !row.actionable)); assert(m.rootCauses.filter(row => row.actionable).every(row => row.key !== "imports")); assert(!src("app/mois-a-venir/month-control-center.tsx").includes("MonthControlOverview")); });
await test("UX-033", () => { assert(ui.includes("Mes choix")); assert(ui.includes("Mettre à jour")); assert(ui.includes("Comprendre")); assert(!ui.includes("Hypothèses & exceptions")); });
await test("UX-034", () => { const rendered = html(MonthControlActiveChoices, { model: m }); assert(rendered.includes("Aucun ajustement actif")); assert(rendered.includes("Ajouter un ajustement")); assert(!rendered.includes("Hypothèses")); });
await test("UX-035", () => { const rendered = html(MonthResourcesPanel, { forecast: live, scenario: derive(live, current, null, base.asOf, []), model: m }); assert(rendered.includes("Confirmé")); assert(rendered.includes("13 octobre")); assert(!rendered.includes("Oui, prévu")); assert(!rendered.includes("type=\"number\"")); });
await test("UX-036", () => { assert.equal(controlDate("2026-10-13"), "13 octobre"); assert.equal(controlDate("2026-09-28", true), "28 septembre 2026"); assert.equal(controlResourceLabel("Nextly – Loyer"), "Loyer"); assert(m.activeDecisions.some(row => row.key === "fixed:obligation:rent" && row.value.includes("Ajustée à"))); });
await test("UX-037", () => { const rendered = html(MonthResourcesPanel, { forecast: live, scenario: derive(live, current, null, base.asOf, []), model: m, today: base.asOf }); assert.equal((rendered.match(/data-wallet-checklist="SWILE"/g) ?? []).length, 1); assert.equal((rendered.match(/data-wallet-checklist="EDENRED"/g) ?? []).length, 1); assert(rendered.includes("Chargement octobre")); assert(rendered.includes("Solde actuel à renseigner")); assert(!rendered.includes("type=\"number\"")); });
await test("UX-038", () => { const scenario = run(base); assert.notEqual(scenario.benefitWallets.SWILE.expectedLoading.amount, scenario.benefitWallets.SWILE.currentBalanceKnowledge.amount); assert.notEqual(scenario.bankCash.currentRealBankBalance.amount, scenario.benefitWallets.SWILE.expectedLoading.amount); assert(src("app/mois-a-venir/month-control-update.tsx").includes('intent="save-bank-balance"')); });
await test("UX-039", () => { const rendered = html(MonthReliabilityPanel, { model: m }); for (const text of ["Comprendre", "Dépenses du mois", "Banque", "Swile &amp; Edenred", "Mode prudent actif", "Historique des estimations"]) assert(rendered.includes(text)); for (const value of ["FULL_MONTH_SAFE", String(m.reliability.publicationId), String(m.reliability.revision)]) if (value.length > 8) assert(!rendered.includes(value)); assert(!src("app/mois-a-venir/month-control-panels.tsx").includes("reliability.publicationId")); });
await test("UX-040", async () => { const before = countWrites(), snapshot = JSON.stringify(h.facts.inputs); await actions.previewMonthControlCenter("2026-10", purpose, [restaurant100, tobacco20]); assert.equal(countWrites(), before); assert.equal(JSON.stringify(h.facts.inputs), snapshot); });
await test("UX-041", async () => { const preview = await actions.previewMonthControlCenter("2026-10", purpose, [restaurant100, tobacco20]), before = countWrites(); assert((await actions.applyMonthChoice("2026-10", { operations: [restaurant100, tobacco20] }, preview.baseDigest)).ok); assert.equal(countWrites() - before, 1); const reload = await realRead(h.client, h.householdId, "2026-10"); assert.deepEqual(run({ ...base, inputs: reload.inputs }).narrative.final, preview.preview.after); h.facts.inputs["2026-10"] = structuredClone(current); });
await test("UX-042", async () => { const preview = await actions.previewMonthControlCenter("2026-10", purpose, [restaurant100]), before = countWrites(); h.facts.inputs["2026-10"].openingBalance = { amount: "200", asOfDate: "2026-10-18" }; const result = await actions.applyMonthChoice("2026-10", { operations: [restaurant100] }, preview.baseDigest); assert.equal(result.code, "STALE_PREVIEW"); assert.equal(countWrites(), before); h.facts.inputs["2026-10"] = structuredClone(current); });
await test("UX-043", () => { assert.equal(h.client.writes.length, 0); assert(touched.every(table => ["phase2_month_inputs", "phase2_planned_expenses", "persons"].includes(table))); assert(writes.every(row => row.table === "phase2_month_inputs")); });
await test("UX-044", () => { assert.equal(m.reliability.mode, "FULL_MONTH_SAFE"); assert.deepEqual(wb({ ...base, asOf: "2026-10-01" }, purpose, [restaurant100]).preview.after, wb({ ...base, asOf: "2026-10-28" }, purpose, [restaurant100]).preview.after); });
await test("UX-045", () => { process.env.PHASE2_FORECAST_TEMPORAL_MODE = "AS_OF_TEMPORAL"; try { assert.deepEqual(wb(base, purpose, [restaurant100]).preview, simulate(base, { operations: [restaurant100] }).view); } finally { delete process.env.PHASE2_FORECAST_TEMPORAL_MODE; } });
await test("UX-046", () => { for (const source of [ui, simulator, src("app/mois-a-venir/month-control-choices.tsx")]) { assert(!source.includes("new Big")); assert(!source.includes("deriveMonthScenario(")); assert(!source.includes("simulateMonthChoice(")); } assert(src("server/phase2/month-control-center.ts").includes("simulateMonthChoice(scenarioCtx")); }, "STATIC");
await test("UX-047", () => { const correction = wb(withTarget("300", "342"), { kind: "CATEGORY_CORRECTION", categoryKey: "groceries" }, []); assert(correction.shortcuts.every(row => row.categoryKey === "groceries")); assert(correction.offers.every(row => row.operation.categoryKey === "groceries")); });
await test("UX-048", () => { const unavailable = model({ ...base, inputs: defaultMonthInputs() }); assert.equal(unavailable.projectionSummary.economic, null); assert.equal(unavailable.defaultPurpose.kind, "NONE"); assert.equal(wb({ ...base, inputs: defaultMonthInputs() }, { kind: "NONE" }, []).shortcuts.length, 0); });
await test("UX-049", () => { assert(ui.includes("target.parentElement")); assert(ui.includes("parent instanceof HTMLDetailsElement")); }, "STATIC");
await test("UX-050", () => { assert.equal(controlDate(undefined), "à confirmer"); assert.equal(controlDate(""), "à confirmer"); });
await test("UX-051", () => { const ctx = { ...base, inputs: defaultMonthInputs() }, value = model(ctx); const rendered = html(MonthResourcesPanel, { forecast: live, scenario: derive(live, ctx.inputs, null, base.asOf, []), model: value, today: base.asOf }); assert(rendered.includes('data-wallet-checklist="SWILE"')); assert(!rendered.includes("NaN")); assert(!rendered.includes('type="number"')); });
if (configured !== undefined) process.env.PHASE2_FORECAST_TEMPORAL_MODE = configured;
fs.mkdirSync("outputs", { recursive: true });
fs.writeFileSync("outputs/phase2-month-control-center-ux-tests.json", JSON.stringify({ status: "PASS", scope: "Synthetic fixtures, real generic engine/server actions, SSR presentation and explicit static boundaries; no live writes.", historicalWrites: 0, plannedExpenseWrites: 0, monthlyFixtureWrites: writes.length, results }, null, 2));
console.log(`PASS ${results.length}/${results.length} control center UX checks`);
