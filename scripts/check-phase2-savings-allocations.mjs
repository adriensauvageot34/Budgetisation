import assert from "node:assert/strict";
import fs from "node:fs";
import { randomUUID } from "node:crypto";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { require } from "./lib/phase2-ts-loader.mjs";
import { forecast, inputs } from "./check-phase2-october-contract.mjs";
import { planningHarness, item, value } from "./lib/planned-actions-harness.mjs";
import { fixtureCase } from "./lib/phase2-temporal-fixture.mjs";

const { monthInputsSchema, deriveMonthScenario } = require("@/server/phase2/month-scenario.ts");
const { projectMonthDecision } = require("@/server/phase2/month-decision-projection.ts");
const { parseMonthDecisionSettings } = require("@/domain/phase2/month-decision-contract.ts");
const { makeForecastCheckpoint, explainForecastChange, readForecastMemory } = require("@/server/phase2/forecast-memory.ts");
const { forecastTemporalPolicy } = require("@/server/phase2/forecast-temporal-policy.ts");
const { projectMonthCalendar } = require("@/app/mois-a-venir/planned-expenses-projection.ts");
const monthly = require("@/server/phase2/month-inputs.ts");
const realReadInputs = monthly.readMonthInputs, realSaveInputs = monthly.saveMonthInputs;
const results = [], writes = [];
const test = async (id, fn) => { await fn(); results.push({ id, status: "PASS" }); };
const configured = process.env.PHASE2_FORECAST_TEMPORAL_MODE;
delete process.env.PHASE2_FORECAST_TEMPORAL_MODE;
const run = (current = inputs, snapshot = forecast, date = "2026-09-28") => deriveMonthScenario(snapshot, current, null, date).economicPlan;
const baseline = run();
const legacyPayload = structuredClone(inputs);

await test("SAVE-001", () => assert.equal(monthInputsSchema.parse(legacyPayload).declaredOutflows[0].adjustability, "PROTECTED"));
await test("SAVE-002", () => {
  const row = monthInputsSchema.parse(legacyPayload).declaredOutflows[0];
  assert.equal(row.source, "MONTH_INPUT"); assert.equal(row.annualGoalRef, null);
  assert.equal(JSON.stringify(inputs), JSON.stringify(legacyPayload), "normalization does not mutate stored data");
});
await test("SAVE-003", () => assert.equal(baseline.savingsAllocations.total, "1200.00"));
await test("SAVE-004", () => {
  assert.equal(baseline.savingsAllocations.protectedTotal, "1200.00");
  assert.equal(baseline.savingsAllocations.adjustableTotal, "0.00");
});
await test("SAVE-005", () => {
  assert(!baseline.certainOutflows.items.some(row => row.key === inputs.declaredOutflows[0].id || row.kind === "SAVINGS"));
  assert(!baseline.certainOutflows.groups.some(row => row.label === "Épargne"));
});
await test("SAVE-006", () => assert.equal(baseline.certainOutflows.total, "847.23"));
await test("SAVE-007", () => assert.equal(baseline.afterCertainOutflows, "3081.76"));
await test("SAVE-008", () => {
  assert.equal(baseline.afterSavingsAllocations, "1881.76");
  assert.equal(baseline.monthlyLayers.afterSavingsAllocations, "1881.76");
});
await test("SAVE-009", () => {
  assert.deepEqual(baseline.scenarios, { lowConsumption: "1170.76", central: "915.83", highConsumption: "555.76" });
  assert.deepEqual(baseline.scenarios, baseline.narrative.final);
  const unreserved = run({ ...inputs, declaredOutflows: [] });
  assert.deepEqual(baseline.necessaryVariables, unreserved.necessaryVariables);
  assert.deepEqual(baseline.flexibleVariables, unreserved.flexibleVariables);
  assert.deepEqual(deriveMonthScenario(forecast, inputs, null, "2026-09-28").economicCost,
    deriveMonthScenario(forecast, { ...inputs, declaredOutflows: [] }, null, "2026-09-28").economicCost,
    "a reservation never becomes economic consumption");
  for (const key of Object.keys(baseline.scenarios))
    assert.equal((Number(unreserved.scenarios[key]) - Number(baseline.scenarios[key])).toFixed(2), "1200.00");
  const decision = projectMonthDecision(baseline, parseMonthDecisionSettings(), "2026-10", "2026-09-28", []);
  assert.equal(decision.visible.savingsDelta, 1200); assert.equal(decision.visible.projectDelta, 0);
});
const sample = fixtureCase("2026-10", "2026-10-18");
const live = { ...forecast, meta: { ...forecast.meta, sourceRevision: 1 }, predictionEvidence: sample.evidence };
await test("SAVE-010", () => {
  const ordinary = run(inputs, live, "2026-10-18");
  const changed = run({ ...inputs, decision: parseMonthDecisionSettings({ ...parseMonthDecisionSettings(), assumptions: { "tobacco-vape": { mode: "LOWER" } } }) }, live, "2026-10-18");
  assert.deepEqual(changed.savingsAllocations, ordinary.savingsAllocations);
  assert.equal(changed.afterSavingsAllocations, ordinary.afterSavingsAllocations);
  assert.notEqual(changed.narrative.final.central, ordinary.narrative.final.central, "behavioral lever actually changed consumption");
  assert.throws(() => parseMonthDecisionSettings({ ...parseMonthDecisionSettings(),
    assumptions: { [inputs.declaredOutflows[0].id]: { mode: "LOWER" } } }), /MONTH_ASSUMPTION_INVALID/,
    "a protected allocation cannot be targeted by behavioral levers");
});
const adjustable = { id: randomUUID(), label: "Noël", amount: "120.00", dueDate: "2026-10-20", kind: "SAVINGS", adjustability: "ADJUSTABLE" };
await test("SAVE-011", () => {
  const plan = run({ ...inputs, declaredOutflows: [...inputs.declaredOutflows, adjustable] });
  assert.equal(plan.savingsAllocations.total, "1320.00"); assert.equal(plan.savingsAllocations.protectedTotal, "1200.00");
  assert.equal(plan.savingsAllocations.adjustableTotal, "120.00"); assert.equal(plan.afterSavingsAllocations, "1761.76");
  assert.equal(plan.savingsAllocations.items[1].adjustability, "ADJUSTABLE");
});
await test("SAVE-012", () => {
  const plans = [];
  for (const mode of ["FULL_MONTH_SAFE", "AS_OF_TEMPORAL"]) {
    process.env.PHASE2_FORECAST_TEMPORAL_MODE = mode;
    const plan = run(inputs, live, "2026-10-18"), unreserved = run({ ...inputs, declaredOutflows: [] }, live, "2026-10-18");
    assert.equal(plan.narrative.prediction.forecastTemporalMode, mode);
    for (const key of Object.keys(plan.scenarios)) assert.equal((Number(unreserved.scenarios[key]) - Number(plan.scenarios[key])).toFixed(2), "1200.00");
    plans.push(plan);
  }
  assert.deepEqual(plans[0].savingsAllocations, plans[1].savingsAllocations);
  assert.equal(plans[0].afterSavingsAllocations, plans[1].afterSavingsAllocations);
  delete process.env.PHASE2_FORECAST_TEMPORAL_MODE;
});
await test("SAVE-013", () => {
  // Both a pre-transfer and a post-transfer stock remain observations, untouched.
  for (const amount of ["2000.00", "800.00"]) {
    const current = { ...inputs, openingBalance: { amount, asOfDate: "2026-10-18" } };
    const plan = run(current, live, "2026-10-18"), unreserved = run({ ...current, declaredOutflows: [] }, live, "2026-10-18");
    assert.deepEqual(plan.bankCash.currentRealBankBalance, unreserved.bankCash.currentRealBankBalance);
    assert.equal(plan.bankCash.currentRealBankBalance.amount, amount);
    assert.equal(plan.bankCash.savingsBudgetReservation.amount, "1200.00");
    assert.equal(plan.bankCash.afterSavings.status, "UNKNOWN"); assert.equal(plan.bankCash.plannedAvailable.amount, null);
    assert(plan.bankCash.limitations.includes("BANK_BALANCE_SAVINGS_SCOPE_UNRESOLVED"));
  }
});

/** Exercise real persistence/authenticated actions against only in-memory prospective tables. */
const h = planningHarness(), originalFrom = h.client.from.bind(h.client);
h.client.from = table => {
  if (table !== "phase2_month_inputs") return originalFrom(table);
  const filters = {};
  return {
    select() { return this; }, eq(key, value) { filters[key] = value; return this; },
    async maybeSingle() {
      assert.equal(filters.household_id, h.householdId);
      const payload = h.facts.inputs[filters.target_month.slice(0, 7)];
      return { data: payload ? { payload: structuredClone(payload), updated_at: null, updated_by: h.userId } : null, error: null };
    },
    async upsert(row, options) {
      assert.equal(row.household_id, h.householdId); assert.equal(row.updated_by, h.userId);
      assert.equal(options.onConflict, "household_id,target_month");
      h.facts.inputs[row.target_month.slice(0, 7)] = structuredClone(row.payload);
      writes.push({ table, operation: "upsert" }); return { error: null };
    },
  };
};
monthly.readMonthInputs = realReadInputs; monthly.saveMonthInputs = realSaveInputs;
require("@/server/phase2/planning-date.ts").planningDate = () => "2026-10-18";
require("@/server/phase2/month-forecast-snapshot.ts").queryMonthForecast = async () => live;
const actions = require("@/app/mois-a-venir/actions.ts");
const form = values => { const form = new FormData(); for (const [key, value] of Object.entries({ targetMonth: "2026-10", ...values })) form.set(key, value); return form; };
await test("SAVE-015", async () => {
  const stored = await realReadInputs(h.client, h.householdId, "2026-10");
  assert.equal(stored.inputs.declaredOutflows[0].adjustability, "PROTECTED");
  await realSaveInputs(h.client, h.householdId, "2026-10", h.userId, stored.inputs);
  const reload = await realReadInputs(h.client, h.householdId, "2026-10");
  assert.deepEqual(reload.inputs, stored.inputs);
  assert.deepEqual(run(reload.inputs), baseline);
});
await test("SAVE-016", async () => {
  await actions.updateMonthInputs(form({ intent: "add-declared-savings", outflowLabel: "Billets", outflowAmount: "40.00" }));
  await actions.updateMonthInputs(form({ intent: "add-declared-savings", outflowLabel: "Noël", outflowAmount: "120.00", outflowDate: "2026-10-20", outflowAdjustability: "ADJUSTABLE" }));
  const current = (await realReadInputs(h.client, h.householdId, "2026-10")).inputs;
  assert.equal(current.declaredOutflows[1].adjustability, "PROTECTED");
  assert.equal(current.declaredOutflows[2].adjustability, "ADJUSTABLE");
  for (const mode of ["FULL_MONTH_SAFE", "AS_OF_TEMPORAL"]) {
    process.env.PHASE2_FORECAST_TEMPORAL_MODE = mode;
    const draft = { familyKey: "food", subtypeKey: "restaurant", title: "Projet synthétique", plannedDate: "2026-10-22", context: {},
      costItems: [{ ...item("50.00", "restaurant:main", ["restaurant"]), baselineKey: "household-restaurants" }] };
    const beforeWrites = writes.length + h.client.writes.length;
    const preview = value(await h.actions.previewPlannedExpense("2026-10", draft));
    assert.equal(writes.length + h.client.writes.length, beforeWrites);
    const saved = value(await h.actions.savePlannedExpense("2026-10", draft, { id: randomUUID() }));
    assert.deepEqual(saved.scenario.economicPlan.scenarios, preview.after);
    assert.deepEqual(saved.scenario.economicPlan.bankCash, preview.bankCash);
    const rows = await h.service.readPlannedExpenses(h.client, h.householdId, "2026-10");
    const reload = deriveMonthScenario(live, (await realReadInputs(h.client, h.householdId, "2026-10")).inputs, null, "2026-10-18", rows).economicPlan;
    assert.deepEqual(reload, saved.scenario.economicPlan);
    assert.equal(reload.savingsAllocations.total, "1360.00");
  }
  for (const row of current.declaredOutflows.slice(1)) await actions.updateMonthInputs(form({ intent: "remove-declared-outflow", outflowId: row.id }));
  assert.deepEqual((await realReadInputs(h.client, h.householdId, "2026-10")).inputs.declaredOutflows, monthInputsSchema.parse(inputs).declaredOutflows);
  delete process.env.PHASE2_FORECAST_TEMPORAL_MODE;
});
await test("SAVE-014", () => {
  assert(writes.length > 0 && h.client.writes.length > 0, "real monthly/planned persistence paths were exercised");
  assert(writes.every(write => write.table === "phase2_month_inputs"));
  assert(h.client.writes.every(write => write.table === "phase2_planned_expenses"));
});
await test("SAVE-017-INVALID-METADATA", async () => {
  for (const metadata of [{ adjustability: "FREE" }, { source: "OBSERVED" }, { source: "ANNUAL_PLAN" }, { source: "ANNUAL_PLAN", annualGoalRef: " " }, { annualGoalRef: "fabricated" }])
    assert.throws(() => monthInputsSchema.parse({ ...inputs, declaredOutflows: [{ ...inputs.declaredOutflows[0], ...metadata }] }), /SAVINGS_/);
  const count = writes.length;
  await assert.rejects(actions.updateMonthInputs(form({ intent: "add-declared-savings", outflowLabel: "Invalid", outflowAmount: "10", outflowAdjustability: "FREE" })), /SAVINGS_ADJUSTABILITY_INVALID/);
  assert.equal(writes.length, count);
});
await test("SAVE-018-ANNUAL-CONTRACT", () => {
  const plan = run({ ...inputs, declaredOutflows: [{ ...inputs.declaredOutflows[0], source: "ANNUAL_PLAN", annualGoalRef: "synthetic-goal-reference" }] });
  assert.equal(plan.savingsAllocations.items[0].annualGoalRef, "synthetic-goal-reference");
  assert.equal(plan.savingsAllocations.items[0].source, "ANNUAL_PLAN");
  assert.equal(plan.afterSavingsAllocations, "1881.76");
});
await test("SAVE-019-CALENDAR", () => {
  for (const dueDate of [null, "2026-10-20"]) {
    const plan = run({ ...inputs, declaredOutflows: [{ ...inputs.declaredOutflows[0], dueDate }] });
    const calendar = projectMonthCalendar(plan.certainOutflows.items, []);
    assert(!JSON.stringify(calendar).includes(inputs.declaredOutflows[0].id));
    assert(!JSON.stringify(calendar).includes("Épargne voyage"));
  }
});
await test("SAVE-020-CHECKPOINT-COMPATIBILITY", async () => {
  const checkpoint = makeForecastCheckpoint({ ...forecast, meta: { ...forecast.meta, sourceRevision: 1 } }, inputs, baseline, "2026-09-28");
  assert.equal(checkpoint.payload.budgetLayersVersion, "month-budget-layers@v2");
  assert.deepEqual(checkpoint.payload.savingsAllocations, baseline.savingsAllocations);
  assert.equal(checkpoint.payload.components[inputs.declaredOutflows[0].id].amount, "-1200.00");
  const { budgetLayersVersion, savingsAllocations, monthlyLayers, bankCash, ...legacy } = checkpoint.payload;
  const row = { checkpoint_id: randomUUID(), target_month: "2026-10-01", as_of_date: "2026-09-28", computed_at: "2026-09-28T12:00:00Z",
    model_version: forecastTemporalPolicy().modelVersion, input_digest: "0".repeat(64), payload: legacy };
  const readClient = { from(table) { assert.equal(table, "phase2_forecast_checkpoints"); return {
    select() { return this; }, eq() { return this; }, gte() { return this; }, lte() { return this; }, order() { return this; },
    async range() { return { data: [row], error: null }; },
  }; } };
  const memory = await readForecastMemory(readClient, h.householdId, "2026-10");
  assert.equal(memory[0].payload.budgetLayersVersion, undefined);
  const change = explainForecastChange(baseline, memory, "2026-10");
  assert.equal(change.delta, "0.00"); assert.deepEqual(change.changes, []);
});
await test("SAVE-021-UI", () => {
  const { MonthSavingsSection } = require("@/app/mois-a-venir/month-savings-section.tsx");
  const plan = run({ ...inputs, declaredOutflows: [...inputs.declaredOutflows, adjustable] });
  const html = renderToStaticMarkup(React.createElement(MonthSavingsSection, { savings: plan.savingsAllocations, targetMonth: "2026-10" }));
  for (const text of ["Ce qu’on met de côté", "Épargne voyage", "Noël", "Protégée · non négociable", "Ajustable · réservée", "outflowAdjustability", "remove-declared-outflow"])
    assert(html.includes(text), text);
  assert(html.includes('value="PROTECTED" selected=""'), "new allocations default protected");
  const source = fs.readFileSync("src/app/mois-a-venir/month-story.tsx", "utf8");
  assert(source.indexOf("Après nos charges certaines") < source.indexOf("<MonthSavingsSection"));
  assert(source.indexOf("<MonthSavingsSection") < source.indexOf("Après nos cagnottes"));
  assert(source.indexOf("Après nos cagnottes") < source.indexOf("<PlannedExpensesControl"));
  assert(!source.includes('group.label === "Épargne"'));
});
if (configured === undefined) delete process.env.PHASE2_FORECAST_TEMPORAL_MODE; else process.env.PHASE2_FORECAST_TEMPORAL_MODE = configured;
fs.mkdirSync("outputs", { recursive: true });
fs.writeFileSync("outputs/phase2-savings-allocations-tests.json", JSON.stringify({ results, historicalWrites: 0, liveDatabaseWrites: 0,
  monthlyWrites: writes.length, plannedWrites: h.client.writes.length }, null, 2) + "\n");
console.log(`PASS SAVINGS_ALLOCATIONS: ${results.length} checks; legacy, budget layers, both modes, bank scope guard, actions, Preview/Save/reload, checkpoints, calendar and UI; zero historical/live writes`);
