import assert from "node:assert/strict";
import fs from "node:fs";
import { randomUUID } from "node:crypto";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { require } from "./lib/phase2-ts-loader.mjs";
import { forecast, inputs } from "./check-phase2-october-contract.mjs";
import { planningHarness, item, value } from "./lib/planned-actions-harness.mjs";
import { fixtureCase } from "./lib/phase2-temporal-fixture.mjs";

const { parseMonthlyBenefitWallets, validateWalletMonth } = require("@/domain/phase2/benefit-wallets.ts");
const { HOUSEHOLD_BENEFIT_USAGE_POLICY: policy } = require("@/domain/phase2/benefit-wallet-policy.ts");
const { resolveBenefitWalletBalance: resolve, projectWalletSpendCapacity: capacity, projectMonthlyBenefitWallets: project } = require("@/server/phase2/benefit-wallet-funding.ts");
const { deriveMonthScenario: derive, monthInputsSchema } = require("@/server/phase2/month-scenario.ts");
const { makeAsOfContext } = require("@/server/phase2/forecast-opportunities.ts");
const { makeForecastCheckpoint, explainForecastChange } = require("@/server/phase2/forecast-memory.ts");
const { forecastTemporalPolicy } = require("@/server/phase2/forecast-temporal-policy.ts");
const monthly = require("@/server/phase2/month-inputs.ts");
const realRead = monthly.readMonthInputs, realSave = monthly.saveMonthInputs;
const configured = process.env.PHASE2_FORECAST_TEMPORAL_MODE;
delete process.env.PHASE2_FORECAST_TEMPORAL_MODE;
const results = [], writes = [], reads = [];
const test = async (id, fn) => { await fn(); results.push({ id, status: "PASS" }); };
const range = amount => ({ low: amount, central: amount, high: amount });
const observation = (amount, date, extra = {}) => ({ id: randomUUID(), amount, asOfDate: date, provenance: "USER_DECLARED", ...extra });
const wallets = (swile = [], edenred = [], loading = null) => ({
  SWILE: { provider: "SWILE", balanceObservations: swile, expectedLoading: loading },
  EDENRED: { provider: "EDENRED", balanceObservations: edenred, expectedLoading: null },
});
const canonical = (provider = "SWILE", ownerPersonId = "a", extra = {}) => ({ id: randomUUID(), provider, ownerPersonId,
  currency: "EUR", status: "ACTIVE", coverageStart: null, coverageEnd: null, openingBalance: null, closingBalance: null, coverageIntervals: [], ...extra });
const known = (amount = "224.00", date = "2026-10-01") => resolve({ asOf: date, observations: [observation(amount, date)] });
const cap = (extra = {}) => capacity({ asOf: "2026-10-01", start: "2026-10-05", end: "2026-10-08", balance: known(), loading: null, policy, planned: [], ...extra });
const run = (current = inputs, snapshot = forecast, date = "2026-10-01") => derive(snapshot, current, null, date).economicPlan;
const early = observation("34.00", "2026-10-01"), late = observation("224.00", "2026-10-08");
const monthlyWith = walletInputs => ({ ...inputs, benefitWallets: walletInputs });
const base = run();

await test("WALLET-001", () => {
  const parsed = monthInputsSchema.parse({ ...inputs, benefit: { currentBalance: { amount: "34.00", asOfDate: "2026-10-01" }, expectedLoading: { amount: "190.00", expectedDate: "2026-10-08" } } });
  assert.equal(parsed.benefitWallets.SWILE.balanceObservations[0].amount, "34.00");
  assert.equal(parsed.benefitWallets.SWILE.expectedLoading.amount, "190.00");
  assert.equal(parsed.benefitWallets.EDENRED.balanceObservations.length, 0);
});
await test("WALLET-002", () => {
  assert.equal(resolve({ asOf: "2026-10-08", observations: [late, early] }).amount, "224.00");
  assert.equal(resolve({ asOf: "2026-10-01", observations: [late, early] }).amount, "34.00");
});
await test("WALLET-003", () => {
  const w = monthInputsSchema.parse(inputs).benefitWallets;
  const plan = run(monthlyWith({ ...w, SWILE: { ...w.SWILE, balanceObservations: [early] } }));
  assert.equal(plan.totalResources, base.totalResources);
  assert.deepEqual(plan.scenarios, base.scenarios);
  assert.deepEqual(plan.bankCash, base.bankCash);
  assert.equal(plan.savingsAllocations.protectedTotal, "1200.00");
});
await test("WALLET-004", () => {
  const model = project({ wallets: wallets([early, late], [], { amount: "190.00", expectedDate: "2026-10-08" }),
    resourceOverrides: {}, context: makeAsOfContext("2026-10", "2026-10-08"), personNamesById: {}, expenses: [], categories: [] }).wallets.SWILE;
  assert.equal(model.usableStock, "224.00"); assert.equal(model.futureKnownLoading, "0.00");
  assert.equal(model.expectedLoading.amount, "190.00"); assert.equal(model.currentBalanceKnowledge.amount, "224.00");
});
await test("WALLET-005", () => {
  const parsed = monthInputsSchema.parse(monthlyWith(wallets([early, observation("210.00", "2026-10-08")])));
  assert.equal(parsed.benefitWallets.SWILE.expectedLoading, null);
  assert.equal(parsed.declaredResources["benefit:swile"], undefined);
});
await test("WALLET-006", () => {
  const parsed = monthInputsSchema.parse(monthlyWith(wallets([late], [observation("73.00", "2026-10-08")])));
  const models = project({ wallets: parsed.benefitWallets, resourceOverrides: {}, context: makeAsOfContext("2026-10", "2026-10-08"), personNamesById: {}, expenses: [], categories: [] }).wallets;
  assert.equal(models.SWILE.usableStock, "224.00"); assert.equal(models.EDENRED.usableStock, "73.00");
});
await test("WALLET-007", () => {
  const balance = resolve({ asOf: "2026-10-15", observations: [late] });
  assert.equal(balance.status, "OBSERVED_STALE"); assert.equal(balance.amount, null); assert.equal(balance.latestObservation.amount, "224.00");
});
await test("WALLET-008", () => {
  const w = canonical("SWILE", "a", { coverageIntervals: [{ start: "2026-10-09", end: "2026-10-11" }, { start: "2026-10-12", end: "2026-10-15" }] });
  const credit = { id: randomUUID(), walletId: w.id, date: "2026-10-10", kind: "CREDIT", amount: "10.00" };
  const debit = { id: randomUUID(), walletId: w.id, date: "2026-10-13", kind: "PURCHASE_DEBIT", amount: "20.00" };
  const balance = resolve({ asOf: "2026-10-15", observations: [late], wallet: w, ledger: [credit, debit, debit, { ...credit, id: randomUUID(), walletId: randomUUID(), amount: "999.00" }] });
  assert.equal(balance.status, "RECONSTRUCTED"); assert.equal(balance.amount, "214.00");
  assert.equal(resolve({ asOf: "2026-10-15", observations: [late], wallet: { ...w, coverageIntervals: [{ start: "2026-10-10", end: "2026-10-15" }] }, ledger: [debit] }).amount, null);
});
await test("WALLET-009", () => {
  assert.equal(policy.dailyCap, "25.00"); assert.deepEqual(policy.eligibleWeekdays, [1, 2, 3, 4, 5, 6]);
  assert.equal(cap({ policy: { ...policy, dailyCap: "10.00" } }).usableCapacity, "40.00");
});
await test("WALLET-010", () => assert.equal(cap({ start: "2026-10-04", end: "2026-10-04" }).usableCapacity, "0.00"));
await test("WALLET-011", () => { assert.equal(cap().eligibleDaysRemaining, 4); assert.equal(cap().calendarCapacity, "100.00"); assert.equal(cap().usableCapacity, "100.00"); });
await test("WALLET-012", () => {
  const c = cap({ planned: [{ date: "2026-10-05", amount: "18.00" }, { date: "2026-10-05", amount: "12.00" }] });
  assert.equal(c.plannedReserved, "30.00"); assert.equal(c.plannedSupported, "25.00"); assert.equal(c.shortfall, "5.00");
});
await test("WALLET-013", () => {
  const c = cap({ planned: [{ date: "2026-10-05", amount: "30.00" }] });
  assert.equal(c.plannedSupported, "25.00"); assert.equal(c.fundingToComplete, "5.00");
});
await test("WALLET-014", () => {
  const c = cap({ start: "2026-10-04", planned: [{ date: "2026-10-04", amount: "30.00" }] });
  assert.equal(c.plannedSupported, "0.00"); assert.equal(c.shortfall, "30.00"); assert.equal(c.plannedReserved, "30.00");
});
const category = (key = "adrien-work-meals") => ({ key, remainingForecastEconomic: range("40.00"), remainingForecastBankCash: range(null),
  expectedFunding: { BANK: range(null) }, limitationCodes: ["EXPECTED_FUNDING_UNKNOWN"], opportunities: [5, 6, 7, 8, 9].map(day => ({
    id: `opportunity-${key}-${day}`, date: `2026-10-0${day}`, state: "FUTURE", expectedEconomic: range("8.00") })) });
const mealProjection = (extra = {}) => project({ wallets: wallets([early], [observation("30.00", "2026-10-01")]), resourceOverrides: {},
  context: makeAsOfContext("2026-10", "2026-10-01"), personNamesById: { a: "Adrien", m: "Manon" },
  evidence: { wallets: [canonical("SWILE", "a"), canonical("EDENRED", "m")], ledger: [] }, expenses: [], categories: [category()], ...extra });
await test("WALLET-015", () => {
  const c = mealProjection({ evidence: { wallets: [canonical("SWILE", null)], ledger: [] } }).categories[0];
  assert.equal(c.expectedFunding.SWILE.central, "0.00"); assert.equal(c.expectedFunding.BANK.central, null); assert.equal(c.expectedFunding.UNKNOWN.central, "40.00");
});
await test("WALLET-016", () => {
  const c = mealProjection({ wallets: wallets([observation("30.00", "2026-10-01")]) }).categories[0];
  assert.equal(c.expectedFunding.SWILE.central, "30.00"); assert.equal(c.expectedFunding.BANK.central, "10.00"); assert.equal(c.expectedFunding.UNKNOWN.central, "0.00");
  assert.deepEqual(c.remainingForecastEconomic, range("40.00"));
});
await test("WALLET-017", () => {
  const c = mealProjection({ categories: [category("manon-work-meals")] }).categories[0];
  assert.equal(c.expectedFunding.EDENRED.central, "30.00"); assert.equal(c.expectedFunding.BANK.central, "10.00");
  const swapped = mealProjection({ evidence: { wallets: [canonical("EDENRED", "a"), canonical("SWILE", "m")], ledger: [] } }).categories[0];
  assert.equal(swapped.expectedFunding.EDENRED.central, "30.00"); assert.equal(swapped.expectedFunding.SWILE.central, "0.00");
});
await test("WALLET-018", () => {
  const c = mealProjection({ wallets: wallets() }).categories[0];
  assert.equal(c.expectedFunding.BANK.central, null); assert.equal(c.fundingToComplete.central, "40.00");
});
const sample = fixtureCase("2026-10", "2026-10-18");
const live = { ...forecast, meta: { ...forecast.meta, sourceRevision: 1 }, predictionEvidence: sample.evidence };
await test("WALLET-019", () => {
  process.env.PHASE2_FORECAST_TEMPORAL_MODE = "FULL_MONTH_SAFE";
  const first = run(inputs, live, "2026-10-01"), later = run(inputs, live, "2026-10-18");
  const get = p => [...p.narrative.prediction.essential, ...p.narrative.prediction.optional];
  assert.deepEqual(get(first).map(c => c.remainingForecastEconomic), get(later).map(c => c.remainingForecastEconomic));
  assert.deepEqual(first.scenarios, later.scenarios);
});
await test("WALLET-020", () => {
  process.env.PHASE2_FORECAST_TEMPORAL_MODE = "AS_OF_TEMPORAL";
  const ordinary = run(inputs, live, "2026-10-18"), w = monthInputsSchema.parse(inputs).benefitWallets;
  const enriched = run(monthlyWith({ ...w, SWILE: { ...w.SWILE, balanceObservations: [observation("99.00", "2026-10-18")] } }), live, "2026-10-18");
  assert.equal(enriched.narrative.prediction.forecastTemporalMode, "AS_OF_TEMPORAL");
  assert.deepEqual(enriched.scenarios, ordinary.scenarios); assert.deepEqual(enriched.monthlyLayers, ordinary.monthlyLayers);
  const economics = p => [...p.narrative.prediction.essential, ...p.narrative.prediction.optional].map(c => ({ key: c.key, projected: c.projectedMonth, remaining: c.remainingForecastEconomic, observed: c.observedEconomic, expired: c.expiredExpectedEconomic, future: c.futureExpectedEconomic }));
  assert.deepEqual(economics(enriched), economics(ordinary));
});
delete process.env.PHASE2_FORECAST_TEMPORAL_MODE;

// Real authenticated server actions and persistence, with only prospective in-memory tables.
const h = planningHarness(), originalFrom = h.client.from.bind(h.client);
h.client.from = table => {
  if (table !== "phase2_month_inputs") return originalFrom(table);
  const filters = {};
  return { select() { return this; }, eq(key, value) { filters[key] = value; return this; },
    async maybeSingle() { assert.equal(filters.household_id, h.householdId); return { data: { payload: structuredClone(h.facts.inputs[filters.target_month.slice(0, 7)]), updated_at: null, updated_by: h.userId }, error: null }; },
    async upsert(row, options) {
      assert.equal(row.household_id, h.householdId); assert.equal(row.updated_by, h.userId); assert.equal(options.onConflict, "household_id,target_month");
      assert.equal(row.payload.benefit, undefined, "legacy read shim is never saved as a second authority");
      h.facts.inputs[row.target_month.slice(0, 7)] = structuredClone(row.payload); writes.push({ table, operation: "upsert" }); return { error: null };
    } };
};
monthly.readMonthInputs = realRead; monthly.saveMonthInputs = realSave;
require("@/server/phase2/planning-date.ts").planningDate = () => "2026-10-18";
require("@/server/phase2/month-forecast-snapshot.ts").queryMonthForecast = async () => live;
const actions = require("@/app/mois-a-venir/actions.ts");
const form = values => { const f = new FormData(); for (const [key, value] of Object.entries({ targetMonth: "2026-10", ...values })) f.set(key, value); return f; };
await test("WALLET-023", async () => {
  const old = await realRead(h.client, h.householdId, "2026-10");
  assert.equal(old.inputs.benefitWallets.SWILE.expectedLoading.amount, inputs.declaredResources["benefit:swile"]);
  await realSave(h.client, h.householdId, "2026-10", h.userId, old.inputs);
  assert.deepEqual((await realRead(h.client, h.householdId, "2026-10")).inputs, old.inputs);
});
await test("WALLET-024", async () => {
  const add = (provider, date, amount) => actions.updateMonthInputs(form({ intent: "add-wallet-balance-observation", provider, walletBalanceDate: date, walletBalanceAmount: amount }));
  await add("SWILE", "2026-10-01", "34.00"); await add("SWILE", "2026-10-08", "224.00"); await add("EDENRED", "2026-10-08", "73.00");
  const prior = (await realRead(h.client, h.householdId, "2026-10")).inputs.benefitWallets;
  await add("SWILE", "2026-10-08", "224.00"); await add("SWILE", "2026-10-08", "225.00");
  const next = (await realRead(h.client, h.householdId, "2026-10")).inputs.benefitWallets;
  assert.equal(next.SWILE.balanceObservations.length, 2); assert.equal(next.SWILE.balanceObservations[1].id, prior.SWILE.balanceObservations[1].id);
  assert.equal(next.SWILE.balanceObservations[0].amount, "34.00"); assert.deepEqual(next.EDENRED, prior.EDENRED);
  await actions.updateMonthInputs(form({ intent: "remove-wallet-balance-observation", provider: "EDENRED", observationId: next.SWILE.balanceObservations[1].id }));
  assert.equal((await realRead(h.client, h.householdId, "2026-10")).inputs.benefitWallets.SWILE.balanceObservations.length, 2);
  const count = writes.length;
  await assert.rejects(add("ARBITRARY", "2026-10-08", "10.00"), /BENEFIT_PROVIDER_INVALID/);
  await assert.rejects(add("SWILE", "2026-10-19", "10.00"), /BENEFIT_OBSERVATION_IN_FUTURE/);
  assert.equal(writes.length, count);
});
await test("WALLET-021", async () => {
  await actions.updateMonthInputs(form({ intent: "add-wallet-balance-observation", provider: "SWILE", walletBalanceDate: "2026-10-18", walletBalanceAmount: "30.00" }));
  for (const mode of ["FULL_MONTH_SAFE", "AS_OF_TEMPORAL"]) {
    process.env.PHASE2_FORECAST_TEMPORAL_MODE = mode;
    const draft = { familyKey: "food", subtypeKey: "restaurant", title: "Synthetic wallet parity", plannedDate: "2026-10-22", context: {}, costItems: [item("30.00", "restaurant:main", ["restaurant"], [{ source: "SWILE", amount: "30.00" }])] };
    const beforeWrites = writes.length + h.client.writes.length, preview = value(await h.actions.previewPlannedExpense("2026-10", draft));
    assert.equal(writes.length + h.client.writes.length, beforeWrites);
    const saved = value(await h.actions.savePlannedExpense("2026-10", draft, { id: randomUUID() }));
    assert.deepEqual(saved.scenario.economicPlan.scenarios, preview.after); assert.deepEqual(saved.scenario.economicPlan.plannedFunding, preview.funding);
    const rows = await h.service.readPlannedExpenses(h.client, h.householdId, "2026-10");
    const reloaded = derive(live, (await realRead(h.client, h.householdId, "2026-10")).inputs, null, "2026-10-18", rows).economicPlan;
    assert.deepEqual(reloaded, saved.scenario.economicPlan);
    assert.equal(saved.expense.costItems[0].fundingAllocations.length, 1); assert.equal(saved.expense.costItems[0].fundingAllocations[0].source, "SWILE");
    assert.equal(reloaded.plannedFunding.bankAllocated, "0.00"); assert(Number(reloaded.plannedFunding.swile.shortfall) >= 5);
  }
  delete process.env.PHASE2_FORECAST_TEMPORAL_MODE;
});
await test("WALLET-025", async () => {
  await actions.updateMonthInputs(form({ intent: "save-wallet-expected-loading", provider: "SWILE", walletLoadingAmount: "190.00", walletLoadingDate: "2026-10-08" }));
  const input = (await realRead(h.client, h.householdId, "2026-10")).inputs;
  assert.equal(input.declaredResources["benefit:swile"], "190.00"); assert.equal(input.benefitWallets.SWILE.balanceObservations[0].amount, "34.00");
  const plan = run(input, live, "2026-10-18"); assert.equal(plan.benefitWallets.SWILE.usableStock, "30.00"); assert.equal(plan.benefitWallets.SWILE.futureKnownLoading, "0.00");
  await actions.updateMonthInputs(form({ intent: "clear-wallet-expected-loading", provider: "SWILE" }));
  const cleared = (await realRead(h.client, h.householdId, "2026-10")).inputs;
  assert.equal(cleared.declaredResources["benefit:swile"], undefined); assert.equal(cleared.benefitWallets.SWILE.expectedLoading, null);
  assert.deepEqual(cleared.benefitWallets.SWILE.balanceObservations, input.benefitWallets.SWILE.balanceObservations);
});
await test("WALLET-026-BOUNDARY-NEGATIVES", () => {
  for (const invalid of [wallets([observation("-1.00", "2026-10-01")]), wallets([observation("1.00", "2026-02-30")]), wallets([early, { ...early, id: randomUUID() }]), { ...wallets(), OTHER: {} }])
    assert.throws(() => monthInputsSchema.parse(monthlyWith(invalid)), /BENEFIT_/);
  assert.throws(() => validateWalletMonth(wallets([observation("1.00", "2026-09-30")]), "2026-10"), /MONTH_INVALID/);
  validateWalletMonth(wallets([observation("1.00", "2026-09-30", { isOpeningObservation: true })]), "2026-10");
  assert.throws(() => validateWalletMonth(wallets([], [], { amount: "1.00", expectedDate: "2026-11-01" }), "2026-10"), /MONTH_INVALID/);
});
await test("WALLET-036-PERSISTED-MONTH-BOUNDARY", async () => {
  const count = writes.length;
  await assert.rejects(realSave(h.client, h.householdId, "2026-10", h.userId, monthlyWith(wallets([observation("10.00", "2026-09-30")]))), /BENEFIT_OBSERVATION_MONTH_INVALID/);
  await assert.rejects(realSave(h.client, h.householdId, "2026-10", h.userId, monthlyWith(wallets([], [], { amount: "10.00", expectedDate: "2026-11-08" }))), /BENEFIT_LOADING_MONTH_INVALID/);
  assert.equal(writes.length, count);
});
await test("WALLET-027-FUTURE-RELEASE-AND-CAP", () => {
  const c = cap({ balance: known("0.00"), loading: { amount: "100.00", expectedDate: "2026-10-08" }, planned: [{ date: "2026-10-05", amount: "20.00" }] });
  assert.equal(c.plannedSupported, "0.00"); assert.equal(c.shortfall, "20.00"); assert.equal(c.usableCapacity, "25.00");
  assert.equal(c.fundsAvailableByDate["2026-10-05"], "0.00"); assert.equal(c.availableCapacity, "25.00");
  const debited = cap({ observedDebits: [{ date: "2026-10-05", amount: "18.00" }], planned: [{ date: "2026-10-05", amount: "12.00" }] });
  assert.equal(debited.plannedSupported, "7.00"); assert.equal(debited.shortfall, "5.00");
});
await test("WALLET-028-CANONICAL-ANCHORS", () => {
  const w = canonical("SWILE", "a", { openingBalance: "34.00", coverageStart: "2026-10-01", coverageIntervals: [{ start: "2026-10-01", end: "2026-10-02" }] });
  const debit = { id: randomUUID(), walletId: w.id, date: "2026-10-01", amount: "8.00", kind: "PURCHASE_DEBIT" };
  assert.equal(resolve({ asOf: "2026-10-02", observations: [], wallet: w, ledger: [debit] }).amount, "26.00");
  assert.equal(resolve({ asOf: "2026-10-02", observations: [], wallet: { ...w, coverageEnd: "2026-10-02", closingBalance: "90.00" } }).amount, "90.00");
  assert.equal(resolve({ asOf: "2026-10-02", observations: [early], wallet: { ...w, currency: "USD" }, ledger: [debit] }).amount, null);
});
await test("WALLET-034-RESERVATION-AND-EARLY-LOADING", () => {
  const c = cap({ balance: known("0.00"), loading: { amount: "30.00", expectedDate: "2026-10-08" }, planned: [{ date: null, amount: "30.00" }] });
  assert.equal(c.availableCapacity, "0.00"); assert.equal(c.fundingToComplete, "30.00");
  const loaded = cap({ balance: known("0.00"), loading: { amount: "30.00", expectedDate: "2026-10-03" } });
  assert.equal(loaded.usableCapacity, "30.00"); assert.equal(loaded.fundsAvailableByDate["2026-10-05"], "30.00");
});
await test("WALLET-035-STOCK-WITHOUT-MONTHLY-FLOW", () => {
  const scenario = derive(live, monthlyWith(wallets([early])), null, "2026-10-01");
  assert.equal(scenario.economicPlan, null);
  assert.equal(scenario.benefitWallets.SWILE.currentBalanceKnowledge.amount, "34.00");
  assert.equal(scenario.benefitPotential, "34.00");
});
await test("WALLET-029-RESERVATIONS-BEFORE-FORECAST", () => {
  const expenses = [{ plannedDate: "2026-10-05", costItems: [item("20.00", "restaurant:main", ["restaurant"], [{ source: "SWILE", amount: "20.00" }])] }];
  const c = mealProjection({ wallets: wallets([observation("30.00", "2026-10-01")]), expenses }).categories[0];
  assert.equal(c.expectedFunding.SWILE.central, "10.00"); assert.equal(c.expectedFunding.BANK.central, "30.00");
  const nonMeal = { ...category("groceries"), expectedFunding: { BANK: range("40.00") } };
  assert.deepEqual(mealProjection({ categories: [nonMeal] }).categories[0], nonMeal);
  const pending = { ...category(), opportunities: [] }, unfunded = mealProjection({ categories: [pending] }).categories[0];
  assert.equal(unfunded.expectedFunding.BANK.central, null); assert.equal(unfunded.expectedFunding.UNKNOWN.central, "40.00");
});
await test("WALLET-030-OLD-FORM-AND-DELETE", async () => {
  const prior = (await realRead(h.client, h.householdId, "2026-10")).inputs;
  await actions.updateMonthInputs(form({ intent: "save-benefit", benefitBalance: "226.00", benefitDate: "2026-10-08", benefitLoading: "190.00", loadingDate: "2026-10-08" }));
  const current = (await realRead(h.client, h.householdId, "2026-10")).inputs;
  assert.deepEqual(current.benefitWallets.EDENRED, prior.benefitWallets.EDENRED); assert.equal(current.benefitWallets.SWILE.balanceObservations.length, 3);
  await actions.updateMonthInputs(form({ intent: "remove-wallet-balance-observation", provider: "EDENRED", observationId: current.benefitWallets.EDENRED.balanceObservations[0].id }));
  const deleted = (await realRead(h.client, h.householdId, "2026-10")).inputs;
  assert.equal(deleted.benefitWallets.EDENRED.balanceObservations.length, 0); assert.deepEqual(deleted.benefitWallets.SWILE, current.benefitWallets.SWILE);
});
await test("WALLET-031-CHECKPOINTS", () => {
  const plan = run(inputs, live), cp = makeForecastCheckpoint(live, inputs, plan, "2026-10-01");
  assert.equal(cp.payload.benefitWalletsVersion, "benefit-wallets@v1");
  const { benefitWallets, benefitWalletsVersion, ...oldPayload } = cp.payload;
  const row = { checkpoint_id: randomUUID(), target_month: "2026-10-01", as_of_date: "2026-10-01", computed_at: "2026-10-01T12:00:00Z", model_version: forecastTemporalPolicy().modelVersion, input_digest: "0".repeat(64), payload: oldPayload };
  const change = explainForecastChange(plan, [row], "2026-10"); assert.equal(change.delta, "0.00"); assert.deepEqual(change.changes, []); assert.match(change.stability, /wallets.*pas directement comparable/);
  const enriched = run(monthlyWith({ ...monthInputsSchema.parse(inputs).benefitWallets, SWILE: { ...monthInputsSchema.parse(inputs).benefitWallets.SWILE, balanceObservations: [early] } }), live);
  assert.match(explainForecastChange(enriched, [{ ...row, payload: cp.payload }], "2026-10").stability, /connaissance des wallets a changé/);
});
await test("WALLET-032-UI", () => {
  const { BenefitWalletEditor, BenefitWalletFunding } = require("@/app/mois-a-venir/benefit-wallet-editor.tsx");
  const model = mealProjection();
  const html = renderToStaticMarkup(React.createElement(BenefitWalletEditor, { wallet: wallets([early, late]).SWILE, projection: { ...model.wallets.SWILE, currentBalanceKnowledge: resolve({ observations: [late], asOf: "2026-10-18" }), latestObservation: late }, targetMonth: "2026-10", today: "2026-10-18" }));
  for (const text of ["Swile", "224", "34", "Solde actuel à confirmer", "Chargement du mois", "Ajouter une nouvelle observation", 'name="provider" value="SWILE"', "remove-wallet-balance-observation"]) assert(html.includes(text), text);
  const funding = renderToStaticMarkup(React.createElement(BenefitWalletFunding, { wallets: mealProjection({ wallets: wallets() }).wallets, funding: base.plannedFunding }));
  for (const text of ["Swile", "Edenred", "Capacité utilisable", "projets", "Usage déclaré", "Réservé aux projets prévus", "à confirmer", "pas transformé en Banque certaine"]) assert(funding.includes(text), text);
});

// Production canonical adapter against a SELECT-only fixture. FULL source+instance
// proof is required for reconstruction; no provider-wide coverage borrowing.
await test("WALLET-033-READ-ONLY-ADAPTER", async () => {
  const { readMonthPredictionEvidence } = require("@/server/phase2/month-prediction-evidence.ts");
  const walletId = randomUUID(), batchId = randomUUID();
  const fixture = {
    canonical_household_scope_control: [{ household_count: 1, household_id: h.householdId, status: "READY" }],
    households: [{ timezone: "Europe/Paris" }], persons: [{ person_id: "a", display_name: "Adrien" }],
    benefit_wallets: [{ benefit_wallet_id: walletId, provider: "SWILE", owner_person_id: "a", currency: "EUR", status: "ACTIVE", source_instance_key: "synthetic-card", import_batch_id: batchId, coverage_start: "2026-10-01", coverage_end: "2026-10-08", opening_balance: "34.00", opening_balance_status: "KNOWN", closing_balance: "224.00", closing_balance_status: "KNOWN" }],
    import_batches: [{ import_batch_id: batchId, source_instance_key: "synthetic-card", source_system: "SWILE", period_start: "2026-10-01", period_end: "2026-10-15", coverage_status: "FULL", status: "imported" }, { import_batch_id: randomUUID(), source_instance_key: "other-card", source_system: "SWILE", period_start: "2026-10-16", period_end: "2026-10-18", coverage_status: "FULL", status: "imported" }],
    benefit_wallet_ledger_entries: [{ benefit_wallet_ledger_entry_id: randomUUID(), benefit_wallet_id: walletId, event_date: "2026-10-08", entry_kind: "CREDIT", amount: "190.00", currency: "EUR" }],
    phase2_month_inputs: [{ target_month: "2026-09-01", payload: monthlyWith(wallets([observation("10.00", "2026-09-30")], [], { amount: "99.00", expectedDate: "2026-09-08" })) }],
  };
  const client = { from(table) {
    const filters = [], read = () => { reads.push({ table, filters }); return { data: fixture[table] ?? [], error: null }; };
    return { select() { return this; }, eq(key, value) { filters.push([key, value]); return this; }, lt() { return this; }, lte() { return this; }, gte() { return this; }, order() { return this; },
      limit() { return this; }, async maybeSingle() { const r = read(); return { ...r, data: r.data[0] ?? null }; }, async range() { return read(); }, then(ok, fail) { return Promise.resolve(read()).then(ok, fail); } };
  } };
  const evidence = await readMonthPredictionEvidence(client, h.householdId, "2026-10", true, { asOfDate: "2026-10-18" });
  assert.equal(evidence.benefitWalletEvidence.wallets[0].ownerPersonId, "a");
  assert.deepEqual(evidence.benefitWalletEvidence.wallets[0].coverageIntervals, [{ start: "2026-10-01", end: "2026-10-15" }]);
  assert.equal(evidence.benefitWalletEvidence.ledger.length, 1);
  assert.equal(evidence.benefitWalletEvidence.openingObservations.SWILE[0].amount, "10.00");
  assert.equal(evidence.benefitWalletEvidence.openingObservations.SWILE[0].expectedLoading, undefined);
  fixture.import_batches[0].source_system = "BANK";
  const foreignCoverage = await readMonthPredictionEvidence(client, h.householdId, "2026-10", true, { asOfDate: "2026-10-18" });
  assert.equal(foreignCoverage.benefitWalletEvidence.wallets[0].coverageIntervals.length, 0,
    "a linked BANK batch never certifies Benefit ledger continuity");
  for (const table of ["benefit_wallets", "benefit_wallet_ledger_entries", "persons", "phase2_month_inputs", "purchase_events", "purchase_funding_components"])
    assert(reads.filter(r => r.table === table).every(r => r.filters.some(([key, value]) => key === "household_id" && value === h.householdId)), table);
});
await test("WALLET-022", () => {
  assert(writes.length > 0 && h.client.writes.length > 0);
  assert(writes.every(w => w.table === "phase2_month_inputs")); assert(h.client.writes.every(w => w.table === "phase2_planned_expenses"));
  assert(reads.some(r => r.table === "benefit_wallet_ledger_entries"));
});
if (configured === undefined) delete process.env.PHASE2_FORECAST_TEMPORAL_MODE; else process.env.PHASE2_FORECAST_TEMPORAL_MODE = configured;
fs.mkdirSync("outputs", { recursive: true });
fs.writeFileSync("outputs/phase2-benefit-wallets-tests.json", JSON.stringify({ status: "PASS", historicalWrites: 0, scope: "offline synthetic fixtures; no live Supabase writes", results: results.sort((a, b) => a.id.localeCompare(b.id)) }, null, 2));
console.log(`PASS: ${results.length} dated Benefit wallet checks, both modes, real Preview/Save/reload, provider actions and read-only canonical adapter`);
