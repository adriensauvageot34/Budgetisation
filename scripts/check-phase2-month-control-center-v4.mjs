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
for (const [id, focus, allowed] of [["HDR-001",null,true],["HDR-002","pilot",true],["HDR-003","pilot:category:groceries",false],["HDR-004","savings",false],["HDR-005","update",false],["HDR-006","update:item:BANK",false],["HDR-007","update:status:CONFIRMED",false]]) await test(id, () => assert.equal(header(focus).globalGoal, allowed));
await test("INFO-001", () => { const css = fs.readFileSync("src/app/mois-a-venir/month-control-center.module.css", "utf8"), center = fs.readFileSync("src/app/mois-a-venir/month-control-center.tsx", "utf8"); assert(css.includes("width: 46px; height: 46px")); assert(css.includes("line-height: 0")); assert(center.includes('<Info size={18} aria-hidden="true"')); assert(center.includes('aria-label="État des données"')); });
await test("PILOT-001", () => assert.equal(replay(op("469.35")).view.categoryImpacts.find(row => row.key === "groceries").after, "469.35"));
await test("PILOT-002", () => assert.equal(replay(op("424.65")).view.categoryImpacts.find(row => row.key === "groceries").after, "424.65"));
const zero = withTarget("472.00", "0.00"), zeroModel = model(zero);
await test("PILOT-003", () => assert(zeroModel.categoryTestPresets.groceries.every(row => !row.label.includes("%"))));
await test("PILOT-004", () => { const value = model(context({ inputs: schema.parse({ ...current, decision: { ...current.decision, assumptions: { "household-restaurants": { mode: "CUSTOM", amount: "0.00" } } } }) })); const preset = value.categoryTestPresets["household-restaurants"].find(row => row.testOrigin.kind === "habitualPreset"); assert(preset); assert.equal(preset.amount, "87.00"); assert.equal(preset.amount, value.habitualControls.find(row => row.key === "household-restaurants").forecast); });
await test("PILOT-005", () => { for (const amount of ["25.00", "50.00"]) assert(zeroModel.categoryTestPresets.groceries.some(row => row.amount === amount)); });
await test("PILOT-006", () => { const preset = op("402.30", "groceries", { kind: "percentagePreset", value: "-10" }); assert.deepEqual(replay(preset).view, replay(preset).view); assert.equal(replay(preset).view.categoryImpacts.find(row => row.key === "groceries").after, "402.30"); });
const floored = withTarget("472.00", "447.00", "430.00");
await test("PILOT-007", () => assert(model(floored).categoryTestPresets.groceries.every(row => Number(row.amount) >= 430)));
await test("PILOT-008", () => assert.throws(() => replay(op("429.99"), floored), /IRREVERSIBLE_FLOOR/));
await test("PILOT-009", () => assert(!editor().includes("Appliquer à")), "SSR");
await test("PILOT-010", () => { assert(editor(base, [op("403.00")]).includes("Impact fin de mois")); assert.equal(replay(op("403.00")).view.delta, "44.00"); });
await test("PILOT-011", () => { const rows = replace([], op("403.00")); assert.equal(rows.filter(row => row.categoryKey !== "groceries").length, 0); });
const withoutTarget = context({ inputs: schema.parse({ ...base.inputs, decision: { ...base.inputs.decision, categoryTargets: {} } }) });
await test("PILOT-012", () => { const rendered = editor(withoutTarget); assert(rendered.includes("+ Définir")); assert(rendered.includes('name="categoryTarget" value="447.00"')); assert(!rendered.includes("Appliquer à")); });
await test("PILOT-013", () => { const rendered = editor(withoutTarget, [op("403.00")]); assert(rendered.includes('name="categoryTarget" value="403.00"')); });
await test("PILOT-014", () => { const ctx = withTarget("403.00", "447.00"), rendered = editor(ctx, [op("403.00")]); assert(rendered.includes("Appliquer à")); assert(!rendered.includes("Remplacer le budget cible")); });
const pair = [op("403.00"), op("50.00", "household-restaurants")];
await test("MULTI-001", () => assert(editor(base, [pair[0]]).includes("Ajouter un autre poste")));
await test("MULTI-002", () => { const preview = simulate(base, { operations: pair }); assert.deepEqual(preview.view.after, run({ ...base, inputs: preview.nextInputs }).narrative.final); });
await test("MULTI-003", () => { assert.throws(() => replace(pair, op("50.00", "tobacco-vape"))); assert(!editor(base, pair).includes("Ajouter un autre poste")); });
await test("MULTI-004", () => { const trial = wb(base, { kind: "FREE_EXPLORATION" }, pair); const rendered = markup(MonthPilotIndex, { model: m, draftCount: 2, trial }); assert(rendered.includes("Dans le scénario")); assert(rendered.includes("Scénario · 2/2 postes")); });
await test("MULTI-005", () => assert.equal(pair.filter(row => row.categoryKey !== "groceries")[0].categoryKey, "household-restaurants"));
await test("APPLY-001", async () => { h.facts.inputs["2026-10"] = structuredClone(base.inputs); const preview = await actions.previewMonthChoice("2026-10", { operations: [op("403.00")] }); const result = await actions.applyMonthChoice("2026-10", { operations: [op("403.00")] }, preview.baseDigest); assert(result.ok); const reloaded = await realRead(h.client, h.householdId, "2026-10"); const after = model({ ...base, inputs: reloaded.inputs }); assert.equal(after.categoryControls.find(row => row.key === "groceries").forecast, "403.00"); assert.deepEqual(after.projectionSummary.economic, preview.after); });
await test("APPLY-002", () => assert(editor(context({ inputs: h.facts.inputs["2026-10"] })).includes("403")));
await test("APPLY-003", () => assert(!editor(context({ inputs: h.facts.inputs["2026-10"] })).includes('value="447.00"')));
await test("APPLY-004", () => assert.deepEqual(model(context({ inputs: h.facts.inputs["2026-10"] })).projectionSummary.economic, replay(op("403.00")).view.after));
for (const [id, focus] of [["SAVE-UX-001","savings"],["SAVE-UX-001-EDITOR",`savings:${saving.id}`]]) await test(id, () => assert.equal(header(focus).globalGoal, false));
const savingHtml = markup(MonthSavingEditor, { model: m, saving });
await test("SAVE-UX-002", () => assert(!savingHtml.includes("Plus d’options")));
await test("SAVE-UX-003", () => assert(savingHtml.includes("Supprimer cette cagnotte")));
await test("SAVE-UX-004", () => { const source = fs.readFileSync("src/app/mois-a-venir/month-saving-editor.tsx", "utf8"); assert(source.includes("setRemove(true)")); assert(source.includes("Cette action retire sa réservation mensuelle")); });
await test("SAVE-UX-005", () => { const ctx = context({ inputs: schema.parse({ ...current, declaredOutflows: current.declaredOutflows.map(row => row.id === saving.id ? { ...row, amount: "100.00" } : row) }) }); const result = simulate(ctx, { operations: [{ kind: "SAVINGS", strategy: "TEST_SAVINGS", savingsId: saving.id, amount: "50.00" }] }); assert.equal(result.view.reservationRelease, "50.00"); assert.equal(result.view.delta, "50.00"); assert.equal(result.view.spendingReduction, "0.00"); });
await test("SAVE-UX-006", () => assert.throws(() => simulate(base, { operations: [{ kind: "SAVINGS", strategy: "TEST_SAVINGS", savingsId: current.declaredOutflows[0].id, amount: "50" }] }), /PROTECTED/));
await test("BANK-UX-001", () => { const source = fs.readFileSync("src/app/mois-a-venir/month-story.tsx", "utf8"); assert(fs.readFileSync("src/app/mois-a-venir/bank-stock-card.tsx", "utf8").includes("data-bank-stock-card")); assert(source.includes("Disponible aujourd’hui")); });
await test("BANK-UX-002", () => assert(fs.readFileSync("src/app/mois-a-venir/bank-stock-card.tsx", "utf8").includes("balance.asOfDate")));
await test("BANK-UX-003", () => { const before = run(base), after = run({ ...base, inputs: { ...base.inputs, openingBalance: { amount: "300.00", asOfDate: base.asOf } } }); assert.equal(before.economicResources, after.economicResources); assert.deepEqual(before.narrative.final, after.narrative.final); });
await test("BANK-UX-004", () => assert(fs.readFileSync("src/app/mois-a-venir/bank-stock-card.tsx", "utf8").includes('"Solde actuel à renseigner"')));
await test("ASYNC-001", () => { const source = fs.readFileSync("src/app/mois-a-venir/month-control-center.tsx", "utf8"); assert(source.includes("sequence === request.current")); assert(source.includes("++request.current")); });
await test("HIST-001", () => { const { execFileSync } = require("node:child_process"); assert.equal(execFileSync("git", ["diff", "HEAD", "--", "src/server/phase2/month-category-history.ts"], { encoding: "utf8" }), ""); });
await test("ORIGIN-REBASE", () => { const changed = withTarget("472.00", "460.00"); assert.equal(replay(op("402.30", "groceries", { kind: "percentagePreset", value: "-10" }), changed).view.categoryImpacts.find(row => row.key === "groceries").after, "414.00"); assert.equal(replay(op("403.00"), changed).view.categoryImpacts.find(row => row.key === "groceries").after, "403.00"); });
await test("BANK-UNKNOWN-SSR", () => { const rendered = markup(BankStockCard, { balance: { status: "UNKNOWN", amount: null, reason: "TEST_UNKNOWN" } }); assert(rendered.includes("Solde actuel à renseigner")); assert(!rendered.includes("0,00")); });
await test("BANK-KNOWN-SSR", () => { const rendered = markup(BankStockCard, { balance: { status: "KNOWN", amount: "300.00", asOfDate: "2026-10-05", provenance: ["SYNTHETIC"] } }); assert(rendered.includes("300,00")); assert(rendered.includes("5 octobre")); });
await test("SAVINGS-ZERO-KEEPS-IDENTITY", () => { const result = simulate(base, { operations: [{ kind: "SAVINGS", strategy: "TEST_SAVINGS", savingsId: saving.id, amount: "0.00" }] }); assert.equal(result.nextInputs.declaredOutflows.find(row => row.id === saving.id).amount, "0.00"); });
await test("SAVINGS-INCREASE", () => { const result = simulate(base, { operations: [{ kind: "SAVINGS", strategy: "TEST_SAVINGS", savingsId: saving.id, amount: "100.00" }] }); assert.equal(result.view.reservationRelease, "-20.00"); assert.equal(result.view.spendingReduction, "0.00"); });
await test("INVALID-ORIGIN", () => { for (const testOrigin of [{ kind: "percentagePreset", value: "-101" }, { kind: "invented", value: "20" }, { kind: "amountDelta", value: "NaN" }]) assert.throws(() => parseMonthChoice({ operations: [op("100.00", "groceries", testOrigin)] })); });
await test("SAVINGS-STALE-ZERO-WRITE", async () => { h.facts.inputs["2026-10"] = structuredClone(current); const before = writes.length; const result = await actions.updateMonthControlInputs(form({ intent: "update-declared-savings", outflowId: saving.id, outflowLabel: saving.label, outflowAmount: "50.00", outflowAdjustability: "ADJUSTABLE", expectedDigest: "stale" })); assert.equal(result.ok, false); assert.equal(writes.length, before); });
await test("SAVINGS-UPDATE-PARITY", async () => { const preview = await actions.previewMonthChoice("2026-10", { operations: [{ kind: "SAVINGS", strategy: "TEST_SAVINGS", savingsId: saving.id, amount: "50.00" }] }); assert((await actions.updateMonthControlInputs(form({ intent: "update-declared-savings", outflowId: saving.id, outflowLabel: saving.label, outflowAmount: "50.00", outflowAdjustability: "ADJUSTABLE", expectedDigest: preview.baseDigest }))).ok); assert.deepEqual(run(context({ inputs: h.facts.inputs["2026-10"] })).narrative.final, preview.after); });
assert(writes.every(row => row.table === "phase2_month_inputs"));
console.log(`PASS V4 ${results.length}/${results.length}; synthetic fixtures only; no live financial writes`);
