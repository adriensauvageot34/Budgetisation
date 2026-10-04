import assert from "node:assert/strict";
import fs from "node:fs";
import { randomUUID } from "node:crypto";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
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
const test = async (id, fn) => { await fn(); results.push({ id, status: "PASS" }); };
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

await test("CHOICE-001", () => {
  const old = settings({ version: "month-decision@v1", assumptions: { groceries: { mode: "CUSTOM", amount: "210.00" } }, goal: "500.00" });
  assert.equal(old.version, "month-decision@v2"); assert.deepEqual(old.categoryTargets, {}); assert.equal(old.assumptions.groceries.amount, "210.00");
});
await test("CHOICE-002", () => { const ctx = withTarget("300.00", "342.00"); const row = controls(run(ctx), ctx.inputs.decision).find(c => c.key === "groceries");
  assert.equal(row.varianceToTarget, "42.00"); assert.equal(row.status, "FORECAST_OVER_TARGET"); });
await test("CHOICE-003", () => { const ctx = withTarget("300.00", "270.00"); const row = controls(run(ctx), ctx.inputs.decision).find(c => c.key === "groceries");
  assert.equal(row.marginToTarget, "30.00"); assert.equal(row.status, "UNDER_TARGET"); });
await test("CHOICE-004", () => { const ctx = withTarget("300.00", "365.00", "315.00"); const row = controls(run(ctx), ctx.inputs.decision).find(c => c.key === "groceries");
  assert.equal(row.status, "ALREADY_OVER_TARGET"); assert.equal(row.realized, "315.00"); assert.equal(cat(simulate(ctx, choice("groceries", "REDUCE_AMOUNT", "999.00")).plan, "groceries").projectedMonth.central, "315.00"); });
await test("CHOICE-005", async () => { const count = writes.length + h.client.writes.length; const snapshot = JSON.stringify(h.facts.inputs);
  await actions.previewMonthChoice("2026-10", choice()); assert.equal(writes.length + h.client.writes.length, count); assert.equal(JSON.stringify(h.facts.inputs), snapshot); });
await test("CHOICE-006", async () => { const before = touched.length; await actions.previewMonthChoice("2026-10", choice());
  assert(!touched.slice(before).some(table => /operation|ledger/iu.test(table))); });
await test("CHOICE-007", async () => { await actions.previewMonthChoice("2026-10", choice()); assert.equal(h.client.rows.length, 0); assert.equal(h.client.writes.length, 0); });
await test("CHOICE-008", async () => { const before = touched.length; await actions.previewMonthChoice("2026-10", choice()); assert(!touched.slice(before).some(table => /purchase/iu.test(table))); });
await test("CHOICE-009", () => { const ctx = withTarget("300.00", "400.00", "100.00"), result = simulate(ctx, choice("groceries", "REDUCE_PERCENT", "5"));
  assert.equal(cat(result.plan, "groceries").projectedMonth.central, "385.00"); assert.equal(cat(result.plan, "groceries").observedEconomic, "100.00"); });
await test("CHOICE-010", () => { const ctx = withTarget("300.00", "327.00", "315.00"), result = simulate(ctx, choice("groceries", "REDUCE_AMOUNT", "20"));
  assert.equal(result.view.spendingReduction, "12.00"); assert.equal(cat(result.plan, "groceries").projectedMonth.central, "315.00"); });
await test("CHOICE-011", () => { const ctx = context(), before = cat(run(ctx), "household-restaurants"), result = simulate(ctx, choice("household-restaurants", "REDUCE_ONE_OCCURRENCE"));
  assert.equal(before.conditionalMedianAmount, "28.00"); assert.equal(result.view.categoryImpacts.find(c => c.key === before.key).reduction, before.conditionalMedianAmount);
  assert(propose(ctx).some(row => row.preview.choice.operations.some(op => op.strategy === "REDUCE_ONE_OCCURRENCE"))); });
await test("CHOICE-012", () => { const ctx = context({ forecast: { ...live, predictionEvidence: { ...evidence, history: { ...evidence.history,
  economicEntries: entries.filter(row => row.subcategory !== "Restaurant") } } } });
  assert(!propose(ctx).some(row => row.preview.choice.operations.some(op => op.strategy === "REDUCE_ONE_OCCURRENCE")));
  assert.throws(() => simulate(ctx, choice("household-restaurants", "REDUCE_ONE_OCCURRENCE")), /OCCURRENCE_UNAVAILABLE/u); });
await test("CHOICE-013", () => assert(propose(context()).some(row => row.preview.choice.operations.some(op => op.savingsId === saving.id))));
await test("CHOICE-014", () => { const protectedRow = current.declaredOutflows[0]; assert.throws(() => simulate(context(), savingsChoice(protectedRow)), /PROTECTED/u); });
await test("CHOICE-015", () => { const protectedRow = run(context()).savingsAllocations.items.find(row => row.adjustability === "PROTECTED");
  assert.equal(protectedRow.amount, "1200.00"); assert(!propose(context()).some(row => row.preview.choice.operations.some(op => op.savingsId === protectedRow.id))); });
await test("CHOICE-016", () => { const ctx = context(), before = run(ctx), result = simulate(ctx, savingsChoice());
  assert.equal(result.plan.savingsAllocations.items.find(row => row.id === saving.id).amount, "38.00");
  assert.equal(result.view.reservationRelease, "42.00"); assert.equal(result.view.spendingReduction, "0.00"); assert.equal(result.view.delta, "42.00");
  assert.deepEqual(result.plan.narrative.prediction, before.narrative.prediction); });
await test("CHOICE-017", async () => { const preview = await actions.previewMonthChoice("2026-10", choice()); const saved = await actions.applyMonthChoice("2026-10", choice(), preview.baseDigest);
  assert.equal(saved.ok, true); assert.deepEqual(saved.preview.after, preview.after); const reload = await realRead(h.client, h.householdId, "2026-10");
  assert.deepEqual(run(context({ inputs: reload.inputs })).narrative.final, preview.after); });
await test("CHOICE-018", async () => { const preview = await actions.previewMonthChoice("2026-10", savingsChoice()); const saved = await actions.applyMonthChoice("2026-10", savingsChoice(), preview.baseDigest);
  assert.equal(saved.ok, true); const reload = await realRead(h.client, h.householdId, "2026-10"); assert.deepEqual(run(context({ inputs: reload.inputs })).narrative.final, preview.after);
  assert.equal(reload.inputs.declaredOutflows.find(row => row.id === saving.id).amount, "38.00"); });
await test("CHOICE-019", async () => { await actions.updateMonthInputs(form({ intent: "save-category-target", categoryKey: "groceries", categoryTarget: "300.00" }));
  assert.equal((await realRead(h.client, h.householdId, "2026-10")).inputs.decision.categoryTargets.groceries, "300.00");
  assert.deepEqual((await realRead(h.client, h.householdId, "2026-11")).inputs.decision.categoryTargets, {}); assert.deepEqual(defaultMonthInputs().decision.categoryTargets, {}); });
await test("CHOICE-020", async () => { const count = writes.length; await assert.rejects(actions.updateMonthInputs(form({ targetMonth: "2026-09", intent: "save-category-target", categoryKey: "groceries", categoryTarget: "300" })), /PAST_READ_ONLY/u); assert.equal(writes.length, count); });
await test("CHOICE-021", async () => { const count = writes.length; await assert.rejects(actions.updateMonthInputs(form({ intent: "save-category-target", categoryKey: "nimporte-quoi", categoryTarget: "300" })));
  assert.equal(writes.length, count); assert.throws(() => derive(live, { ...current, decision: { ...current.decision, categoryTargets: { fake: "20" } } }, null, "2026-10-18"), /UNKNOWN/u); });
await test("CHOICE-022", () => { for (const amount of ["-1", "1.234", "NaN", "1e3", 5, null]) assert.throws(() => settings({ ...current.decision, categoryTargets: { groceries: amount } }));
  assert.throws(() => parseMonthChoice(choice("groceries", "REDUCE_PERCENT", "101"))); assert.throws(() => parseMonthChoice({ operations: [choice().operations[0], choice().operations[0]] })); });
await test("CHOICE-023", () => { const part = { ...live.referencePlan.necessary[0], key: "certified-habit", low: "80.00", central: "80.00", high: "80.00",
    decisionCapabilities: { label: "Habitude certifiée", role: "BEHAVIORAL", targetAllowed: true, adjustability: "ADJUSTABLE", strategies: ["REDUCE_PERCENT", "REDUCE_AMOUNT"] } };
  const ctx = context({ forecast: { ...live, referencePlan: { ...live.referencePlan, necessary: [...live.referencePlan.necessary, part] } },
    inputs: schema.parse({ ...current, decision: { ...current.decision, categoryTargets: { "certified-habit": "50" } } }) });
  const plan = run(ctx), row = controls(plan, ctx.inputs.decision).find(row => row.key === part.key); assert(row); assert.equal(row.label, part.decisionCapabilities.label);
  assert(propose(ctx).some(offer => offer.preview.choice.operations.some(op => op.categoryKey === part.key)));
  const { CategoryTargetEditor } = require("@/app/mois-a-venir/month-decision-tools.tsx"); const html = renderToStaticMarkup(React.createElement(CategoryTargetEditor, { control: row, targetMonth: "2026-10" }));
  assert(html.includes("Habitude certifiée")); assert(html.includes("certified-habit")); assert(!propose(context()).some(row => row.preview.choice.operations.some(op => op.categoryKey === "activities"))); });
await test("CHOICE-024", () => { const early = context({ asOf: "2026-10-01" }), late = context({ asOf: "2026-10-28" });
  for (const key of ["groceries", "tobacco-vape", "household-restaurants"]) assert.deepEqual(cat(run(early), key).projectedMonth, cat(run(late), key).projectedMonth);
  assert.equal(simulate(early, choice()).view.delta, simulate(late, choice()).view.delta); });
await test("CHOICE-025", () => { process.env.PHASE2_FORECAST_TEMPORAL_MODE = "AS_OF_TEMPORAL"; try { const ctx = context(), result = simulate(ctx, choice());
    assert.deepEqual(result.plan, run({ ...ctx, inputs: result.nextInputs })); assert.equal(result.plan.narrative.prediction.forecastTemporalMode, "AS_OF_TEMPORAL");
  } finally { delete process.env.PHASE2_FORECAST_TEMPORAL_MODE; } });
const expense = (status = "PLANNED") => ({ id: randomUUID(), targetMonth: "2026-10", status, familyKey: "food", subtypeKey: "restaurant", title: "Repas synthétique",
  plannedDate: status === "PLANNED" ? "2026-10-22" : "2026-10-10", context: {}, costItems: [{ ...item("60.00", "restaurant:main", ["restaurant"]), baselineKey: "household-restaurants" }] });
await test("CHOICE-026", () => { const ctx = context({ expenses: [expense()] }), before = run(ctx), result = simulate(ctx, choice("household-restaurants", "REDUCE_AMOUNT", "999"));
  assert.equal(cat(result.plan, "household-restaurants").projectedMonth.central, "60.00"); assert.deepEqual(result.plan.plannedExpenses, before.plannedExpenses);
  assert.deepEqual(cat(result.plan, "household-restaurants").absorbedByHabit, cat(before, "household-restaurants").absorbedByHabit); });
await test("CHOICE-027", () => { const ctx = context({ expenses: [expense("DECLARED_REALIZED")] }), result = simulate(ctx, choice("household-restaurants", "REDUCE_AMOUNT", "999"));
  const row = cat(result.plan, "household-restaurants"); assert.equal(row.declaredRealizedEconomic, "60.00"); assert.equal(row.observedEconomic, "0.00"); assert.equal(categoryDecisionFacts(row).realized, "60.00"); assert.equal(row.projectedMonth.central, "60.00"); });
await test("CHOICE-028", () => { const ctx = withTarget("300", "350", "96"), before = JSON.stringify(ctx), result = simulate(ctx, choice("groceries", "REDUCE_AMOUNT", "999"));
  assert.equal(cat(result.plan, "groceries").projectedMonth.central, "96.00"); assert.equal(JSON.stringify(ctx), before); });
await test("CHOICE-029", () => { const ctx = context(), result = simulate(ctx, choice("adrien-work-meals", "REDUCE_PERCENT", "5")), replay = run({ ...ctx, inputs: result.nextInputs });
  assert.deepEqual(result.plan.benefitWallets, replay.benefitWallets); assert.deepEqual(result.plan.plannedFunding, run(ctx).plannedFunding);
  assert.deepEqual(result.nextInputs.benefitWallets, schema.parse(current).benefitWallets); assert.equal(result.nextInputs.declaredResources["benefit:swile"], current.declaredResources["benefit:swile"]); });
await test("CHOICE-030", () => { const ctx = context({ inputs: schema.parse({ ...current, decision: { ...current.decision, goal: "500.00" } }) }), result = simulate(ctx, choice());
  assert.equal(result.nextInputs.decision.goal, "500.00"); const projected = projectMonthDecision(result.plan, result.nextInputs.decision, "2026-10", ctx.asOf, []);
  assert.equal(projected.goal.central, (Number(result.plan.narrative.final.central) - 500).toFixed(2)); });
await test("CHOICE-031", async () => { const trial = await actions.previewMonthChoice("2026-10", choice()), count = writes.length;
  await actions.updateMonthInputs(form({ intent: "save-category-target", categoryKey: "groceries", categoryTarget: "280" }));
  assert.equal((await actions.applyMonthChoice("2026-10", choice(), trial.baseDigest)).ok, false); assert.equal(writes.length, count + 1);
  await actions.updateMonthInputs(form({ intent: "clear-category-target", categoryKey: "groceries" })); assert.equal((await realRead(h.client, h.householdId, "2026-10")).inputs.decision.categoryTargets.groceries, undefined); });
await test("CHOICE-032", async () => { const annual = { ...saving, source: "ANNUAL_PLAN", annualGoalRef: "synthetic-annual-goal" };
  const ctx = context({ inputs: schema.parse({ ...current, declaredOutflows: [...inputs.declaredOutflows, annual] }) }); assert.equal(simulate(ctx, savingsChoice()).view.applicable, false);
  h.facts.inputs["2026-10"] = structuredClone(ctx.inputs); const trial = await actions.previewMonthChoice("2026-10", savingsChoice()), count = writes.length;
  assert.equal((await actions.applyMonthChoice("2026-10", savingsChoice(), trial.baseDigest)).ok, false); assert.equal(writes.length, count); });
await test("CHOICE-033", () => { assert.throws(() => simulate(context(), choice("manon-work-mobility")), /FORBIDDEN/u);
  assert(!propose(context()).some(row => row.preview.choice.operations.some(op => op.categoryKey === "manon-work-mobility"))); });
await test("CHOICE-034", () => { const ctx = withTarget("300", "342"), offers = propose(ctx), combination = offers.find(row => row.preview.choice.operations.length === 2);
  assert(combination); assert.deepEqual(combination.preview, simulate(ctx, combination.preview.choice).view);
  assert.equal(combination.preview.gapCovered, Math.min(42, Number(combination.preview.delta)).toFixed(2)); });
await test("CHOICE-035", () => { const ctx = context(), snapshot = JSON.stringify(ctx); propose(ctx); assert.equal(JSON.stringify(ctx), snapshot);
  assert(writes.every(row => row.table === "phase2_month_inputs")); assert.equal(h.client.writes.length, 0); });
await test("CHOICE-036", () => { const { AppRouterContext } = require("next/dist/shared/lib/app-router-context.shared-runtime.js");
  const ctx = withTarget("300", "342"), plan = run(ctx), offers = propose(ctx);
  const { MonthDecisionTools } = require("@/app/mois-a-venir/month-decision-tools.tsx");
  const html = renderToStaticMarkup(React.createElement(AppRouterContext.Provider, { value: { refresh() {} } },
    React.createElement(MonthDecisionTools, { targetMonth: "2026-10", settings: ctx.inputs.decision,
      decision: projectMonthDecision(plan, ctx.inputs.decision, "2026-10", ctx.asOf, []), offers })));
  assert(html.includes("Explorer nos choix")); assert(html.includes("Nos objectifs")); assert(html.includes("Noël"));
  assert(!html.includes("Voyage : réduire")); assert(!html.includes("restaurant-zero")); assert(offers.length <= 9);
});
if (configured !== undefined) process.env.PHASE2_FORECAST_TEMPORAL_MODE = configured;
fs.mkdirSync("outputs", { recursive: true });
fs.writeFileSync("outputs/phase2-category-targets-choices-tests.json", JSON.stringify({ status: "PASS", scope: "Offline synthetic fixtures; real server actions and monthly JSON persistence", historicalWrites: 0,
  monthlyWrites: writes.length, plannedExpenseWrites: h.client.writes.length, results }, null, 2));
console.log(`PASS: ${results.length} category target and choice checks, pure simulation, explicit apply/reload, SAFE/ASOF and protected savings`);
