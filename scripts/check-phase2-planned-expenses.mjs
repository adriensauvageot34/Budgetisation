import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import path from "node:path";
import { forecast, inputs, deriveMonthScenario } from "./check-phase2-october-contract.mjs";

const require = createRequire(import.meta.url);
const { parsePlannedExpenseDraft, grossPlannedExpenseCost, simulatePlannedExpense,
  readPlannedExpenses, createPlannedExpense, updatePlannedExpense, deletePlannedExpense,
  markPlannedExpenseRealized, restorePlannedExpense } =
  require(path.resolve("src/server/phase2/planned-expenses.ts"));
const { saveMonthInputs } = require(path.resolve("src/server/phase2/month-inputs.ts"));

const month = "2026-10";
const cost = (amount, baselineKey = null, label = "Coût") => ({ id: randomUUID(), label, amount, baselineKey });
const expense = (items, status = "PLANNED", id = randomUUID()) => ({ id, targetMonth: month, status, costItems: items });
const story = (items) => deriveMonthScenario(forecast, inputs, null, "2026-09-28", items).economicPlan;
const amounts = (items) => story(items).scenarios;
const golden = (items, lowConsumption, central, highConsumption) => assert.deepEqual(amounts(items), {
  lowConsumption, central, highConsumption,
});
golden([], "1170.76", "915.83", "555.76");
const party47 = expense([cost("47.00", null, "Soirée")]);
const shoes100 = expense([cost("100.00", null, "Chaussures")]);
golden([party47], "1123.76", "868.83", "508.76");
golden([party47, shoes100], "1023.76", "768.83", "408.76");
const party72 = { ...party47, costItems: [cost("72.00", null, "Soirée")] };
golden([party72, shoes100], "998.76", "743.83", "383.76");
golden([shoes100], "1070.76", "815.83", "455.76");

const restaurant60 = expense([cost("60.00", "household-restaurants", "Restaurant")]);
golden([restaurant60], "1160.76", "915.83", "555.76");
assert.deepEqual(story([restaurant60]).plannedExpenses.netImpact, { low: "10.00", central: "0.00", high: "0.00" });
const mixed85 = expense([cost("25.00", null, "Entrée"), cost("20.00", null, "Boissons"),
  cost("40.00", "household-restaurants", "Restaurant")]);
golden([mixed85], "1125.76", "870.83", "510.76");
assert.deepEqual(story([mixed85]).plannedExpenses, {
  grossCost: "85.00", plannedGross: "85.00", declaredRealizedGross: "0.00",
  netImpact: { low: "45.00", central: "45.00", high: "45.00" },
  absorbedByBaseline: { low: "40.00", central: "40.00", high: "40.00" },
});

const restaurant50 = expense([cost("50.00", "household-restaurants", "Autre restaurant")]);
assert.deepEqual(story([restaurant60, restaurant50]).plannedExpenses.netImpact,
  { low: "60.00", central: "41.87", high: "0.00" }, "one shared baseline for both restaurants");
assert.deepEqual(story([restaurant60, restaurant50]).plannedExpenses.absorbedByBaseline,
  { low: "50.00", central: "68.13", high: "110.00" });
const realized = { ...restaurant60, status: "DECLARED_REALIZED" };
assert.deepEqual(amounts([realized]), amounts([restaurant60]), "status changes presentation, not finance");
assert.equal(story([realized]).plannedExpenses.declaredRealizedGross, "60.00");
assert.deepEqual(amounts([party47, shoes100].filter((item) => item.id !== party47.id)), amounts([shoes100]));
assert.deepEqual(amounts([party47, shoes100].map((item) => item.id === party47.id ? party72 : item)), amounts([party72, shoes100]),
  "editing replaces the expense with the same ID");
assert.throws(() => story([{ ...party47, targetMonth: "2026-11" }]), /PLANNED_EXPENSE_SCENARIO_INPUT_INVALID/);
assert.throws(() => story([party47, party47]), /PLANNED_EXPENSE_SCENARIO_INPUT_INVALID/);
assert.equal(inputs.plannedEvents.length, 0, "legacy events stay empty");
const householdId = randomUUID();
const userId = randomUUID();
const partyDraft = { familyKey: "outing", subtypeKey: "private_party", title: "Soirée", plannedDate: "2026-10-20",
  costItems: [cost("25.00", null, "Entrée"), cost("22.00", null, "Boissons")], context: {} };
assert.equal(grossPlannedExpenseCost(parsePlannedExpenseDraft(partyDraft, month)), "47.00");
assert.throws(() => parsePlannedExpenseDraft({ ...partyDraft, plannedDate: "2026-11-01" }, month), /DATE_MONTH_INVALID/);
assert.throws(() => parsePlannedExpenseDraft({ ...partyDraft, familyKey: "Maison" }, month), /FAMILY_INVALID/);
assert.throws(() => parsePlannedExpenseDraft({ ...partyDraft, familyKey: "activity", subtypeKey: "trip_stay" }, month), /SUBTYPE_INVALID/);
assert.throws(() => parsePlannedExpenseDraft({ ...partyDraft, familyKey: "visit_trip", subtypeKey: "concert_festival" }, month), /SUBTYPE_INVALID/);
assert.throws(() => parsePlannedExpenseDraft({ ...partyDraft, costItems: [cost("0.00")] }, month), /AMOUNT_INVALID/);
assert.throws(() => parsePlannedExpenseDraft({ ...partyDraft, costItems: [cost("47.00", "tobacco-vape")] }, month), /BASELINE_INVALID/);
assert.throws(() => parsePlannedExpenseDraft({ ...partyDraft, context: { unknown: true } }, month), /CONTEXT_FIELDS_INVALID/);
assert.throws(() => parsePlannedExpenseDraft({ ...partyDraft, familyKey: "food", subtypeKey: "work_meal",
  context: {} }, month), /WORK_MEAL_PERSON_REQUIRED/);
const noReferenceClient = {};
const simulated = await simulatePlannedExpense(noReferenceClient, householdId, forecast, inputs, [], partyDraft, "2026-09-28");
assert.deepEqual(simulated.economicPlan.scenarios, amounts([party47]), "draft and saved use the same engine");
assert.deepEqual((await simulatePlannedExpense(noReferenceClient, householdId, forecast, inputs, [],
  { ...partyDraft, plannedDate: null }, "2026-09-28")).economicPlan.scenarios, simulated.economicPlan.scenarios,
"a null date never changes the financial result");
const savedParty = { ...party47, ...partyDraft, householdId, createdBy: userId, updatedBy: userId,
  createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
const updatedDraft = { ...partyDraft, costItems: [cost("72.00", null, "Soirée")] };
const simulatedEdit = await simulatePlannedExpense(noReferenceClient, householdId, forecast, inputs,
  [savedParty], updatedDraft, "2026-09-28", savedParty.id);
assert.deepEqual(simulatedEdit.economicPlan.scenarios, amounts([party72]), "edit replaces the old entity by ID");

const rows = [];
const memoryClient = { from(table) {
  assert.equal(table, "phase2_planned_expenses", "CRUD writes only the prospective table");
  let operation = "read";
  let payload;
  const filters = [];
  const query = {
    select() { return query; },
    eq(key, value) { filters.push([key, value]); return query; },
    order() { return query; },
    insert(value) { operation = "insert"; payload = value; return query; },
    update(value) { operation = "update"; payload = value; return query; },
    delete() { operation = "delete"; return query; },
    execute() {
      const selected = rows.filter((row) => filters.every(([key, value]) => row[key] === value));
      if (operation === "insert") {
        const row = { ...payload, created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
        rows.push(row);
        return { data: row, error: null };
      }
      if (operation === "update") {
        const row = selected[0];
        if (!row) return { data: null, error: new Error("No matching row") };
        Object.assign(row, payload);
        return { data: row, error: null };
      }
      if (operation === "delete") {
        const row = selected[0];
        if (!row) return { data: null, error: new Error("No matching row") };
        rows.splice(rows.indexOf(row), 1);
        return { data: row, error: null };
      }
      return { data: selected, error: null };
    },
    single() {
      const result = query.execute();
      return { ...result, data: Array.isArray(result.data) ? result.data[0] ?? null : result.data };
    },
    then(resolve, reject) { return Promise.resolve(query.execute()).then(resolve, reject); },
  };
  return query;
} };
const created = await createPlannedExpense(memoryClient, householdId, month, userId, partyDraft);
assert.equal(created.status, "PLANNED");
assert.equal(created.createdBy, userId);
assert.equal((await readPlannedExpenses(memoryClient, householdId, month)).length, 1);
const edited = await updatePlannedExpense(memoryClient, householdId, created.id, userId, updatedDraft);
assert.equal(edited.id, created.id);
assert.equal(edited.createdBy, created.createdBy);
assert.equal(grossPlannedExpenseCost(edited), "72.00");
assert.deepEqual((await simulatePlannedExpense(memoryClient, householdId, forecast, inputs,
  [created], updatedDraft, "2026-09-28", created.id)).economicPlan.scenarios,
  deriveMonthScenario(forecast, inputs, null, "2026-09-28", [edited]).economicPlan.scenarios,
  "simulate(edit) equals saved and reloaded derivation");
const realizedRow = await markPlannedExpenseRealized(memoryClient, householdId, created.id, userId);
assert.equal(realizedRow.status, "DECLARED_REALIZED");
assert.deepEqual(amounts([edited]), amounts([realizedRow]));
await assert.rejects(updatePlannedExpense(memoryClient, householdId, created.id, userId, partyDraft), /REALIZED_EDIT_FORBIDDEN/);
const restoredRow = await restorePlannedExpense(memoryClient, householdId, created.id, userId);
assert.equal(restoredRow.status, "PLANNED");
await deletePlannedExpense(memoryClient, householdId, created.id);
assert.deepEqual(await readPlannedExpenses(memoryClient, householdId, month), []);
let savedSettings;
await saveMonthInputs({ from(table) {
  assert.equal(table, "phase2_month_inputs");
  return { upsert(row) { savedSettings = row.payload; return Promise.resolve({ error: null }); } };
} }, householdId, month, userId, inputs);
assert.equal(Object.hasOwn(savedSettings, "plannedEvents"), false, "monthly settings never rewrite the legacy event field");
console.log("PASS: Planned Expenses October goldens, shared baseline, lifecycle, edit, delete, isolation");
