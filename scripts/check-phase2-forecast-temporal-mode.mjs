import assert from "node:assert/strict";
import fs from "node:fs";
import { randomUUID } from "node:crypto";
import { require } from "./lib/phase2-ts-loader.mjs";
import { fixtureCase } from "./lib/phase2-temporal-fixture.mjs";
const { forecastRemainingMonth } = require("@/server/phase2/remaining-month-forecast.ts");
const { activeForecastTemporalMode, DEFAULT_FORECAST_TEMPORAL_MODE, forecastTemporalPolicy } = require("@/server/phase2/forecast-temporal-policy.ts");
const { sourceCoverage, makeAsOfContext, FORECAST_SOURCES } = require("@/server/phase2/forecast-opportunities.ts");
const { reconcileFixedOccurrences } = require("@/server/phase2/planned-observation-reconciliation.ts");
const { projectBankCashAsOf } = require("@/server/phase2/bank-cash-projection.ts");
const { makeForecastCheckpoint, insertForecastCheckpoint, calibrateForecast, comparableForecastCheckpoints } = require("@/server/phase2/forecast-memory.ts");
const results = [];
const test = async (id, fn) => { await fn(); results.push({ id, status: "PASS" }); };
const configured = process.env.PHASE2_FORECAST_TEMPORAL_MODE;
delete process.env.PHASE2_FORECAST_TEMPORAL_MODE;
const month = "2026-07", asOf = "2026-07-18";
const component = (key, amount) => ({ key, method: "PUBLISHED_SYNTHETIC_PRIOR", low: amount, central: amount, high: amount, observationCount: 0, provenance: [], note: null });
const reference = { targetMonth: month, necessary: [component("groceries", "200.00"), component("tobacco-vape", "300.00"), component("manon-work-mobility", "60.00")],
  flexible: [component("adrien-work-meals", "80.00"), component("manon-work-meals", "70.00"), component("adrien-work-coffee", "20.00"), component("household-restaurants", "30.00")],
  restaurantCorpus: [], estimatedDays: {}, excludedRestaurantSubcategories: [], necessaryTotal: {}, flexibleTotal: {} };
const evidence = { history: { startMonth: "2026-01", endMonth: "2026-06", economicEntries: [], mobilityLegs: [] },
  currentEconomicEntries: [], currentMobilityLegs: [], observedThrough: null, timezone: "Europe/Paris", personNamesById: { adrien: "Adrien" } };
const run = (day = asOf, facts = evidence, projects = [], mode) => forecastRemainingMonth(reference, facts, day, projects, {}, {}, mode);
const categories = result => [...result.essential, ...result.optional];
const category = (result, key) => categories(result).find(c => c.key === key);
const fullCoverage = day => Object.fromEntries(FORECAST_SOURCES.map(source => [source, sourceCoverage(source, `${month}-01`, day, [{ start: `${month}-01`, end: day }], "FULL", day)]));
const actual = (key, amount, extra = {}) => ({ operationId: randomUUID(), date: "2026-07-10", amount, amountStatus: "KNOWN", fundingComplete: true, funding: { BANK: amount },
  subcategory: { "groceries": "Courses alimentaires", "tobacco-vape": "Bureau de tabac / presse", "adrien-work-meals": "Fast-food / snack", "household-restaurants": "Restaurant" }[key],
  person: key === "adrien-work-meals" ? "Adrien" : null, need: key === "adrien-work-meals" ? "Repas du midi au travail" : null, merchant: null, ...extra });
const project = (amount, baselineKey = "household-restaurants", extra = {}) => ({ id: randomUUID(), targetMonth: month, status: "PLANNED", plannedDate: "2026-07-22", context: {},
  costItems: [{ id: randomUUID(), quantity: "1", unitAmount: amount, label: "Synthetic expense", assetKey: "restaurant:main", modulePath: ["restaurant"], baselineKey,
    fundingAllocations: [{ source: "BANK", amount }] }], ...extra });

await test("MODE-01-DEFAULT", () => {
  assert.equal(DEFAULT_FORECAST_TEMPORAL_MODE, "FULL_MONTH_SAFE");
  assert.equal(activeForecastTemporalMode(), "FULL_MONTH_SAFE");
  assert.equal(run().forecastTemporalMode, "FULL_MONTH_SAFE");
});
await test("MODE-02-NO-TIME-DECAY", () => {
  for (const complete of [false, true]) {
    const first = run("2026-07-01", { ...evidence, coverageBySource: complete ? fullCoverage("2026-07-01") : {} });
    for (const day of [asOf, "2026-07-31", "2026-08-05"]) {
      const later = run(day, { ...evidence, coverageBySource: complete ? fullCoverage(day) : {} });
      for (const c of categories(first)) {
        assert.deepEqual(category(later, c.key).remaining, c.remaining, `${c.key} cannot shrink from time or coverage alone`);
        assert.deepEqual(category(later, c.key).projectedMonth, c.projectedMonth);
        assert.equal(category(later, c.key).expiredExpectedEconomic, "0.00");
      }
    }
  }
  assert.equal(category(run(), "adrien-work-meals").remaining.central, "80.00");
  assert.equal(category(run(), "tobacco-vape").remaining.central, "300.00");
});
await test("MODE-03-OBSERVED-REPLACEMENT", () => {
  for (const [key, amount, expected] of [["adrien-work-meals", "16.00", "64.00"], ["tobacco-vape", "80.00", "220.00"], ["groceries", "50.00", "150.00"]]) {
    const result = category(run(asOf, { ...evidence, currentEconomicEntries: [actual(key, amount)] }), key);
    assert.equal(result.observedEconomic, amount); assert.equal(result.remaining.central, expected);
    assert.equal(result.projectedMonth.central, category(run(), key).projectedMonth.central);
  }
});
await test("MODE-04-PLANNED-ABSORPTION", () => {
  const result = run(asOf, evidence, [project("50.00")]), c = category(result, "household-restaurants");
  assert.equal(c.plannedEconomic, "50.00"); assert.equal(c.absorbedByHabit.central, "30.00");
  assert.equal(c.remaining.central, "0.00"); assert.equal(c.projectedMonth.central, "50.00");
  assert.equal(result.projectImpact.central, "20.00");
  const tobacco = category(run(asOf, { ...evidence, currentEconomicEntries: [actual("tobacco-vape", "80.00")] }, [project("40.00", "tobacco-vape")]), "tobacco-vape");
  assert.equal(tobacco.remaining.central, "180.00"); assert.equal(tobacco.projectedMonth.central, "300.00");
});
await test("MODE-05-DECLARED-STILL-ACTIVE", () => {
  const p = project("50.00"), planned = category(run(asOf, evidence, [p]), "household-restaurants");
  const declared = category(run(asOf, evidence, [{ ...p, status: "DECLARED_REALIZED" }]), "household-restaurants");
  assert.equal(declared.declaredRealizedEconomic, "50.00"); assert.equal(declared.plannedEconomic, "0.00");
  assert.deepEqual(declared.projectedMonth, planned.projectedMonth); assert.deepEqual(declared.remaining, planned.remaining);
});
await test("MODE-06-NO-OBSERVED-PLANNED-DOUBLE-COUNT", () => {
  const row = actual("household-restaurants", "51.00"), p = project("50.00", "household-restaurants", { plannedDate: row.date,
    context: { realityLink: { kind: "OPERATION", id: row.operationId, linkedAt: "2026-07-18T12:00:00Z", linkMode: "USER_CONFIRMED" } } });
  for (const status of ["PLANNED", "DECLARED_REALIZED"]) {
    const result = run(asOf, { ...evidence, currentEconomicEntries: [row] }, [{ ...p, status }]), c = category(result, "household-restaurants");
    assert.equal(result.reconciliation.length, 1); assert.equal(c.observedEconomic, "51.00");
    assert.equal(c.plannedEconomic, "0.00"); assert.equal(c.declaredRealizedEconomic, "0.00"); assert.equal(c.projectedMonth.central, "51.00");
  }
});
await test("MODE-07-EXPIRATION-DISABLED-REAL-HISTORY", () => {
  const sample = fixtureCase(month, asOf), silent = { ...sample.evidence, currentEconomicEntries: [], currentMobilityLegs: [] };
  const first = forecastRemainingMonth(sample.reference, silent, `${month}-01`, []);
  const safe = forecastRemainingMonth(sample.reference, silent, asOf, []);
  const temporal = forecastRemainingMonth(sample.reference, silent, asOf, [], {}, {}, "AS_OF_TEMPORAL");
  for (const c of categories(safe)) {
    assert.equal(c.opportunityCounts?.expired ?? 0, 0); assert.equal(c.expiredExpectedEconomic, "0.00");
    assert.deepEqual(c.remaining, category(first, c.key).remaining);
    assert(!c.limitationCodes.some(code => code.startsWith("BOUNDED_NOWCAST")));
    assert.equal((Number(c.pendingExpectedEconomic.central) + Number(c.futureExpectedEconomic.central)).toFixed(2), c.remaining.central);
  }
  assert(categories(temporal).some(c => (c.opportunityCounts?.expired ?? 0) > 0));
  assert(Number(category(temporal, "manon-work-mobility").remaining.central) < Number(category(safe, "manon-work-mobility").remaining.central));
});
await test("MODE-08-FIXED-LIFECYCLE", () => {
  const due = { key: "obligation:series", date: "2026-07-05", amount: "47.00", label: "Fixed" };
  assert.equal(reconcileFixedOccurrences([due], [], month, asOf, "2026-07-15")[0].state, "OVERDUE_UNOBSERVED");
  assert.equal(reconcileFixedOccurrences([due], [], month, "2026-07-06", null)[0].state, "PENDING_OBSERVATION");
  assert.equal(reconcileFixedOccurrences([{ ...due, date: "2026-07-20" }], [], month, asOf, null)[0].state, "UPCOMING");
  const debit = { id: randomUUID(), date: due.date, amount: "48.20", direction: "OUT", merchant: null, recurrenceSeriesId: "series" };
  assert.equal(reconcileFixedOccurrences([due], [debit], month, asOf, "2026-07-15")[0].state, "OBSERVED");
  const safe = run(), cash = projectBankCashAsOf({ context: makeAsOfContext(month, asOf), balance: { status: "KNOWN", amount: "500.00", provenance: [] },
    income: [], fixed: reconcileFixedOccurrences([due], [], month, asOf, "2026-07-15"), expenses: [project("50.00")], matchedExpenseIds: [], essential: safe.essential, optional: safe.optional });
  assert.equal(cash.remainingCertainBankOutflows.amount, "47.00"); assert.equal(cash.plannedBankCashRemaining.amount, "50.00");
  assert.equal(cash.plannedAvailable.amount, "403.00");
  assert.equal(category(safe, "manon-work-mobility").remainingForecastBankCash.central, "0.00");
});
await test("MODE-09-REACTIVATION", () => {
  const sample = fixtureCase(month, asOf), explicit = forecastRemainingMonth(sample.reference, sample.evidence, asOf, [], {}, {}, "AS_OF_TEMPORAL");
  process.env.PHASE2_FORECAST_TEMPORAL_MODE = "AS_OF_TEMPORAL";
  try { assert.deepEqual(forecastRemainingMonth(sample.reference, sample.evidence, asOf, []), explicit); }
  finally { delete process.env.PHASE2_FORECAST_TEMPORAL_MODE; }
  process.env.PHASE2_FORECAST_TEMPORAL_MODE = "invalid";
  try { assert.throws(activeForecastTemporalMode, /INVALID_FORECAST_TEMPORAL_MODE/); }
  finally { delete process.env.PHASE2_FORECAST_TEMPORAL_MODE; }
});
await test("MODE-10-MEMORY-ISOLATION", () => {
  const sample = fixtureCase(month, asOf), months = ["2026-02", "2026-03", "2026-04", "2026-05"];
  const rows = mode => months.map(m => ({ checkpoint_id: randomUUID(), target_month: `${m}-01`, as_of_date: `${m}-18`, computed_at: `${m}-18T12:00:00Z`,
    model_version: forecastTemporalPolicy(mode).modelVersion, input_digest: "0".repeat(64), payload: { categories: [{ key: "tobacco-vape", projected: { low: "0.00", central: "200.00", high: "400.00" } }], provenance: { hasUserAssumptions: false } } }));
  const safeRows = rows("FULL_MONTH_SAFE"), temporalRows = rows("AS_OF_TEMPORAL"), facts = { ...sample.evidence, completeMonthsBySource: { BANK: months } };
  assert.deepEqual(calibrateForecast(temporalRows, facts, asOf), {});
  assert.deepEqual(calibrateForecast(safeRows, facts, asOf, "AS_OF_TEMPORAL"), {});
  assert(calibrateForecast(safeRows, facts, asOf)["tobacco-vape:FULL_MONTH"]);
  assert(calibrateForecast(temporalRows, facts, asOf, "AS_OF_TEMPORAL")["tobacco-vape:MID"]);
  assert.equal(comparableForecastCheckpoints([...safeRows, ...temporalRows], "2026-02").length, 1);
});

// Authenticated production actions in both modes, using prospective-only memory fixtures.
const { planningHarness, item, value } = await import("./lib/planned-actions-harness.mjs");
const { deriveMonthScenario } = require("@/server/phase2/month-scenario.ts");
for (const mode of ["FULL_MONTH_SAFE", "AS_OF_TEMPORAL"]) await test(`MODE-11-PREVIEW-SAVE-RELOAD-${mode}`, async () => {
  process.env.PHASE2_FORECAST_TEMPORAL_MODE = mode;
  try {
    const h = planningHarness(), sample = fixtureCase("2026-10", "2026-10-18");
    const live = { ...h.forecast, meta: { ...h.forecast.meta, sourceRevision: 1 }, predictionEvidence: { ...sample.evidence, currentEconomicEntries: [], currentMobilityLegs: [] } };
    require("@/server/phase2/month-forecast-snapshot.ts").queryMonthForecast = async () => live;
    require("@/server/phase2/planning-date.ts").planningDate = () => "2026-10-18";
    const draft = { familyKey: "food", subtypeKey: "restaurant", title: "Mode parity", plannedDate: "2026-10-22", context: {},
      costItems: [{ ...item("50.00", "restaurant:main", ["restaurant"]), baselineKey: "household-restaurants" }] };
    const beforeWrites = h.client.writes.length;
    const preview = value(await h.actions.previewPlannedExpense("2026-10", draft)); assert.equal(h.client.writes.length, beforeWrites);
    const saved = value(await h.actions.savePlannedExpense("2026-10", draft, { id: randomUUID() }));
    assert.deepEqual(saved.scenario.economicPlan.scenarios, preview.after); assert.deepEqual(saved.scenario.economicPlan.bankCash, preview.bankCash);
    if (mode === "FULL_MONTH_SAFE") assert(Number(saved.scenario.economicPlan.plannedExpenses.absorbedByBaseline.central) > 0);
    const rows = await h.service.readPlannedExpenses(h.client, h.householdId, "2026-10");
    const reload = deriveMonthScenario(live, h.inputs, null, "2026-10-18", rows).economicPlan;
    assert.deepEqual(reload, saved.scenario.economicPlan); assert.equal(reload.narrative.prediction.forecastTemporalMode, mode);
    const checkpoint = makeForecastCheckpoint(live, h.inputs, reload, "2026-10-18");
    assert.equal(checkpoint.modelVersion, forecastTemporalPolicy(mode).modelVersion); assert.equal(checkpoint.payload.forecastTemporalMode, mode);
    const writes = [];
    await insertForecastCheckpoint({ from(table) { return { insert(row) { writes.push({ table, row }); return Promise.resolve({ error: null }); } }; } }, h.householdId, h.userId, "2026-10", "2026-10-18", checkpoint);
    assert.equal(writes[0].row.model_version, checkpoint.modelVersion); assert.equal(writes[0].table, "phase2_forecast_checkpoints");
    value(await h.actions.confirmPlannedExpenseReality("2026-10", draft, { id: saved.expense.id, expectedUpdatedAt: saved.expense.updatedAt }));
    assert(h.client.writes.every(write => write.table === "phase2_planned_expenses"));
  } finally { delete process.env.PHASE2_FORECAST_TEMPORAL_MODE; }
});
await test("MODE-12-NO-MUTATION", () => { const before = JSON.stringify(evidence); run(); run(asOf, evidence, [], "AS_OF_TEMPORAL"); assert.equal(JSON.stringify(evidence), before); });
if (configured === undefined) delete process.env.PHASE2_FORECAST_TEMPORAL_MODE; else process.env.PHASE2_FORECAST_TEMPORAL_MODE = configured;
fs.mkdirSync("outputs", { recursive: true });
fs.writeFileSync("outputs/phase2-forecast-temporal-mode-tests.json", JSON.stringify({ results, historicalWrites: 0, liveDatabaseWrites: 0 }, null, 2) + "\n");
console.log(`PASS FORECAST_TEMPORAL_MODES: ${results.length} checks; safe monthly habits, observations/plans, fixed/cash, reversible temporal mode, memory isolation, Preview/Save/reload, zero historical writes`);
