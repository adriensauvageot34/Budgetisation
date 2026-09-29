import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import path from "node:path";
import { forecast, inputs, deriveMonthScenario } from "./check-phase2-october-contract.mjs";

const require = createRequire(import.meta.url);
const { readPlannedExpenses, createPlannedExpense, updatePlannedExpense, deletePlannedExpense,
  markPlannedExpenseRealized, restorePlannedExpense, simulatePlannedExpense } =
  require(path.resolve("src/server/phase2/planned-expenses.ts"));
const { projectPlannedExpenseCards, projectMonthCalendar } =
  require(path.resolve("src/app/mois-a-venir/planned-expenses-projection.ts"));

const householdId = randomUUID();
const userId = randomUUID();
const month = "2026-10";
const rows = [];
const client = { from(table) {
  assert.equal(table, "phase2_planned_expenses", "no second persistence source");
  let operation = "read";
  let payload;
  const filters = [];
  const query = {
    select() { return query; }, eq(key, value) { filters.push([key, value]); return query; }, order() { return query; },
    insert(value) { operation = "insert"; payload = value; return query; },
    update(value) { operation = "update"; payload = value; return query; },
    delete() { operation = "delete"; return query; },
    execute() {
      const selected = rows.filter((row) => filters.every(([key, value]) => row[key] === value));
      if (operation === "insert") {
        const row = { ...payload, created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
        rows.push(row); return { data: row, error: null };
      }
      if (operation === "update") {
        if (!selected[0]) return { data: null, error: new Error("not found") };
        Object.assign(selected[0], payload); return { data: selected[0], error: null };
      }
      if (operation === "delete") {
        if (!selected[0]) return { data: null, error: new Error("not found") };
        const row = selected[0]; rows.splice(rows.indexOf(row), 1); return { data: row, error: null };
      }
      return { data: selected, error: null };
    },
    single() { const result = query.execute(); return { ...result, data: Array.isArray(result.data) ? result.data[0] ?? null : result.data }; },
    then(resolve, reject) { return Promise.resolve(query.execute()).then(resolve, reject); },
  };
  return query;
} };
const cost = (amount, label, baselineKey = null) => ({ id: randomUUID(), assetKey: null,
  label, quantity: "1", unitAmount: amount, baselineKey });
const partyDraft = (amount, date) => ({ familyKey: "outing", subtypeKey: "house_party", title: "Soirée",
  plannedDate: date, costItems: [cost(amount, "Entrée")], context: { place: { kind: "TEXT", label: "Maison" } } });
const shoesDraft = { familyKey: "purchase", subtypeKey: "clothing", title: "Chaussures", plannedDate: null,
  costItems: [cost("100.00", "Chaussures")], context: { purchaseMode: "IN_STORE" } };
const snapshot = async () => {
  const saved = await readPlannedExpenses(client, householdId, month); // Fresh authoritative read, as on reload.
  const cards = projectPlannedExpenseCards(saved);
  const calendar = projectMonthCalendar([], cards);
  const plan = deriveMonthScenario(forecast, inputs, null, "2026-09-28", saved).economicPlan;
  return { saved, cards, calendar, plan };
};
const assertReload = async (expectedCount) => {
  const first = await snapshot();
  const reloaded = await snapshot();
  assert.deepEqual(reloaded.cards, first.cards, "reload derives the same list from the table");
  assert.deepEqual(reloaded.calendar, first.calendar, "reload derives the same calendar from the table");
  assert.deepEqual(reloaded.plan.scenarios, first.plan.scenarios, "reload derives the same forecast from the table");
  assert.equal(reloaded.saved.length, expectedCount);
  return reloaded;
};

const simulatedParty = await simulatePlannedExpense(client, householdId, forecast, inputs, [], partyDraft("47.00", "2026-10-20"), "2026-09-28");
assert.equal(rows.length, 0, "simulation never writes a draft");
const party = await createPlannedExpense(client, householdId, month, userId, partyDraft("47.00", "2026-10-20"));
let state = await assertReload(1);
assert.equal(state.cards[0].id, party.id);
assert.equal(state.calendar.entries[0].key, party.id);
assert.equal(state.calendar.entries[0].amount, "47.00");
assert.deepEqual(state.plan.scenarios, simulatedParty.economicPlan.scenarios, "simulate equals save, reload and derive");
assert.deepEqual(state.plan.scenarios, { lowConsumption: "1123.76", central: "868.83", highConsumption: "508.76" });

const shoes = await createPlannedExpense(client, householdId, month, userId, shoesDraft);
state = await assertReload(2);
assert(state.cards.some((item) => item.id === shoes.id));
assert(!state.calendar.entries.some((item) => item.key === shoes.id), "undated purchase stays out of calendar");
assert.equal(state.plan.scenarios.central, "768.83");

const updated = await updatePlannedExpense(client, householdId, party.id, userId, partyDraft("72.00", "2026-10-20"));
state = await assertReload(2);
assert.equal(updated.id, party.id);
assert.equal(state.cards.find((item) => item.id === party.id).grossCost, "72.00");
assert.equal(state.calendar.entries.find((item) => item.key === party.id).amount, "72.00");
assert.equal(state.plan.scenarios.central, "743.83", "47 -> 72 changes forecast by -25");

await updatePlannedExpense(client, householdId, party.id, userId, partyDraft("72.00", "2026-10-21"));
state = await assertReload(2);
assert.equal(state.cards.find((item) => item.id === party.id).plannedDate, "2026-10-21");
assert.equal(state.calendar.entries.find((item) => item.key === party.id).date, "2026-10-21");
assert.equal(state.plan.scenarios.central, "743.83");

await updatePlannedExpense(client, householdId, party.id, userId, partyDraft("72.00", null));
state = await assertReload(2);
assert(state.cards.some((item) => item.id === party.id));
assert(!state.calendar.entries.some((item) => item.key === party.id));
assert.equal(state.plan.scenarios.central, "743.83");

await updatePlannedExpense(client, householdId, party.id, userId, partyDraft("72.00", "2026-10-21"));
state = await assertReload(2);
assert.equal(state.calendar.entries.find((item) => item.key === party.id).date, "2026-10-21");
assert.equal(state.plan.scenarios.central, "743.83");

await markPlannedExpenseRealized(client, householdId, party.id, userId);
state = await assertReload(2);
assert.equal(state.cards.find((item) => item.id === party.id).status, "DECLARED_REALIZED");
assert.equal(state.calendar.entries.find((item) => item.key === party.id).nature, "DECLARED_REALIZED");
assert.equal(state.plan.scenarios.central, "743.83");
assert.equal(state.plan.plannedExpenses.declaredRealizedGross, "72.00");

await restorePlannedExpense(client, householdId, party.id, userId);
state = await assertReload(2);
assert.equal(state.cards.find((item) => item.id === party.id).status, "PLANNED");
assert.equal(state.calendar.entries.find((item) => item.key === party.id).nature, "PLANNED_EXPENSE");
assert.equal(state.plan.scenarios.central, "743.83");

await deletePlannedExpense(client, householdId, party.id);
state = await assertReload(1);
assert(!state.cards.some((item) => item.id === party.id));
assert(!state.calendar.entries.some((item) => item.key === party.id));
assert.equal(state.plan.scenarios.central, "815.83");
assert.equal(rows.length, 1, "only the undated shoes remain in the prospective table");
console.log("PASS: 10 Planned Expenses list/calendar/forecast synchronization and reload invariants");
