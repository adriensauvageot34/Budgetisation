import assert from "node:assert/strict";
import fs from "node:fs";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { planningHarness, value, item, draft } from "./lib/planned-actions-harness.mjs";
const require = createRequire(import.meta.url);
const h = planningHarness();
const { actions: a, service: s, client, facts, householdId, userId } = h;
const { projectPlannedExpenseCards, projectMonthCalendar } = require("../src/app/mois-a-venir/planned-expenses-projection.ts");
const { projectPlannedExpenseImpact } = require("../src/server/phase2/planned-impact.ts");
const { deriveMonthScenario } = require("../src/server/phase2/month-scenario.ts");
const { resolvePlannedContext } = require("../src/domain/phase2/planned-rules.ts");
const { plannedMutationIssue } = require("../src/domain/phase2/planned-mutations.ts");
const { calculateRouteFuel, resolvePlannedRoute } = require("../src/domain/phase2/planned-routes.ts");
const month = "2026-10";
const today = new Date().toISOString().slice(0, 10);

// PARITY-01..04: actual Preview/Save actions, resolved doctrine and all economic axes.
const cases = [draft(), { ...draft([item("60.00", "restaurant:main", ["restaurant"], [{ source: "SWILE", amount: "60.00" }])]),
  familyKey: "food", subtypeKey: "restaurant", costItems: [{ ...item("60.00", "restaurant:main", ["restaurant"],
    [{ source: "SWILE", amount: "60.00" }]), baselineKey: "household-restaurants" }] },
  draft([item("14.00"), item("36.00"), item("10.00")], null)];
for (const raw of cases) {
  const previous = await s.readPlannedExpenses(client, householdId, month);
  const writes = client.writes.length;
  const p = value(await a.previewPlannedExpense(month, raw));
  assert.equal(client.writes.length, writes, "Preview zero write");
  const request = { id: randomUUID() };
  const saved = value(await a.savePlannedExpense(month, raw, request));
  const before = deriveMonthScenario(h.forecast, facts.inputs[month], null, today, previous).economicPlan;
  const actual = projectPlannedExpenseImpact(before, saved.scenario.economicPlan, saved.expense);
  for (const axis of ["grossCost", "fuelUsage", "payableGross", "netAdditionalImpact", "absorbedByBaseline", "after", "funding"])
    assert.deepEqual(actual[axis], p[axis], `PARITY ${axis}`);
  assert.equal(saved.expense.id, request.id);
  const parsed = s.parsePlannedExpenseDraft(raw, month);
  const resolved = resolvePlannedContext({ familyKey: parsed.familyKey, subtypeKey: parsed.subtypeKey,
    modifiers: parsed.context });
  assert.equal(resolved.contextKey, resolvePlannedContext({ familyKey: raw.familyKey, subtypeKey: raw.subtypeKey,
    modifiers: raw.context }).contextKey, "client/server resolver parity");
}
// IDEMP-CREATE-01/02: two concurrent requests and network replay on the real PK boundary.
const request = { id: randomUUID() }, intent = draft();
const insertedBefore = client.writes.length;
const [left, right] = await Promise.all([a.savePlannedExpense(month, intent, request), a.savePlannedExpense(month, intent, request)]);
assert.equal(value(left).expense.id, value(right).expense.id);
value(await a.savePlannedExpense(month, intent, request));
assert.equal(client.writes.length, insertedBefore + 1);
const roots = await s.readPlannedExpenses(client, householdId, month);
const root = roots.find(row => row.id === request.id);
assert.equal(roots.filter(row => row.id === request.id).length, 1);
assert.equal(root.costItems.length, 1);
assert.equal(projectMonthCalendar([], projectPlannedExpenseCards(roots)).entries.filter(row => row.key === root.id).length, 1);
assert.equal((await a.savePlannedExpense(month, { ...intent, title: "Requête différente" }, request)).issue.code,
  "PLANNED_EXPENSE_IDEMPOTENCY_CONFLICT");
// Stale edit before validation and a competing write after validation are both protected.
const change = { ...intent, title: "Version nouvelle" };
const updated = value(await a.savePlannedExpense(month, change, { id: root.id, expectedUpdatedAt: root.updatedAt })).expense;
const count = client.writes.length;
const stale = await a.savePlannedExpense(month, { ...intent, title: "Édition ancienne" }, { id: root.id, expectedUpdatedAt: root.updatedAt });
assert.equal(stale.issue.code, "PLANNED_EXPENSE_EDIT_STALE"); assert.equal(stale.issue.repairTarget, "reload");
assert.equal(client.writes.length, count);
client.beforeUpdate = rows => { const current = rows.find(row => row.planned_expense_id === root.id);
  current.title = "Concurrent"; current.updated_at = new Date(Date.parse(updated.updatedAt) + 2).toISOString(); };
const raced = await a.savePlannedExpense(month, { ...intent, title: "Perdant" }, { id: root.id, expectedUpdatedAt: updated.updatedAt });
assert.equal(raced.issue.code, "PLANNED_EXPENSE_EDIT_STALE"); assert.equal(client.rows.find(row => row.planned_expense_id === root.id).title, "Concurrent");
// Tampering with computed authorities is rejected, never persisted.
for (const key of ["resolvedContext", "calculatedImpact", "trustedRouteCost", "trustedFundingResult", "status"]) {
  const count = client.writes.length;
  const invalid = await a.savePlannedExpense(month, { ...intent, [key]: "FORCED" }, { id: randomUUID() });
  assert.equal(invalid.ok, false); assert.equal(invalid.issue.code, "PLANNED_EXPENSE_DRAFT_FIELDS_INVALID");
  assert.equal(client.writes.length, count);
}
// Monthly wallet drift changes the read model, not funding intention or bank allocations.
const meal = { ...draft([item("60.00", "restaurant:main", ["restaurant"], [{ source: "SWILE", amount: "60.00" }])]), familyKey: "food", subtypeKey: "restaurant" };
const p = value(await a.previewPlannedExpense(month, meal));
facts.inputs[month].resourceOverrides = { ...facts.inputs[month].resourceOverrides, "benefit:swile": "10.00" };
const current = value(await a.savePlannedExpense(month, meal, { id: randomUUID() }));
assert.notEqual(current.scenario.economicPlan.plannedFunding.swile.shortfall, p.funding.swile.shortfall);
assert.equal(current.expense.costItems[0].fundingAllocations[0].source, "SWILE");
assert.match(current.notice, /ressources du mois/u);
// Current route/fuel truth replaces old but internally valid estimates.
facts.vehicle = { label: "Véhicule test", consumptionL100Km: "8.000", fuelPricePerLiter: "2.000",
  fuelPriceSource: "PRICE_OBSERVATION", fuelPriceObservedAt: "2026-09-29", fuelPriceQuality: "P1" };
const from = randomUUID(), to = randomUUID();
facts.places = [from, to].map((placeId, index) => ({ placeId, name: `Lieu ${index}`, privatePlace: false,
  nature: "Commerce", usage: "Restaurant", subtype: null, relationships: [] }));
facts.history = [{ originPlaceId: from, destinationPlaceId: to, distanceKm: "10.000", fuelLiters: "0.800000", method: "HISTORICAL", date: "2026-09-29" }];
// Legacy persisted rows retain the historical resolver; live action/provider parity has its own car suite.
const route = resolvePlannedRoute([
  { label: "Lieu 0", placeId: from, distanceToNextKm: null }, { label: "Lieu 1", placeId: to, distanceToNextKm: null }], facts.history, facts.vehicle);
await assert.rejects(a.estimatePlannedRoute(month, { ...draft(), context: { transportMode: "FREE" } }), /PLANNED_ROUTE_FORBIDDEN/);
await assert.rejects(a.estimatePlannedRoute(month, { ...draft(), familyKey: "food", subtypeKey: "fast_food", context: { purchaseMode: "DELIVERY" } }), /PLANNED_ROUTE_FORBIDDEN/);
const car = { ...draft([item("25.00", null, ["trip"]), { ...item(route.fuelEstimate.cost, "transport:fuel_usage", ["trip"]), priceSource: "CALCULATED" }]),
  familyKey: "visit_trip", subtypeKey: "trip_stay",
  context: { route: { mode: "CAR", stops: route.stops, fuelEstimate: route.fuelEstimate } } };
const beforeFuel = value(await a.previewPlannedExpense(month, car));
const beforeCarRows = await s.readPlannedExpenses(client, householdId, month);
const savedCar = value(await a.savePlannedExpense(month, car, { id: randomUUID() }));
const beforeCarPlan = deriveMonthScenario(h.forecast, facts.inputs[month], null, today, beforeCarRows).economicPlan;
const carImpact = projectPlannedExpenseImpact(beforeCarPlan, savedCar.scenario.economicPlan, savedCar.expense);
for (const axis of ["grossCost", "fuelUsage", "payableGross", "netAdditionalImpact", "absorbedByBaseline", "after", "funding"])
  assert.deepEqual(carImpact[axis], beforeFuel[axis], `PARITY-04 route/fuel ${axis}`);
facts.vehicle.fuelPricePerLiter = "3.000";
facts.history.push({ ...facts.history[0], distanceKm: "20.000", fuelLiters: "1.600000", date: "2026-09-30" });
const refreshed = value(await a.savePlannedExpense(month, car, { id: randomUUID() }));
assert.equal(refreshed.expense.context.route.fuelEstimate.cost, "3.60");
assert.notEqual(beforeFuel.fuelUsage, refreshed.expense.context.route.fuelEstimate.cost);
assert.equal(refreshed.expense.costItems.find(row => row.assetKey === "transport:fuel_usage").unitAmount, "3.60");
const carLatestPreview = value(await a.previewPlannedExpense(month, car));
assert.equal(carLatestPreview.fuelUsage, "3.60");
assert.equal(calculateRouteFuel(refreshed.expense.context.route.stops, facts.vehicle).cost, "3.60");
// Disappearing route observations or places leave no partial row.
let n = client.writes.length; facts.history = [];
const missingEvidence = await a.savePlannedExpense(month, car, { id: randomUUID() });
assert.equal(missingEvidence.ok, false); assert.equal(missingEvidence.issue.repairTarget, "route"); assert.equal(client.writes.length, n);
facts.history = [{ originPlaceId: from, destinationPlaceId: to, distanceKm: "10.000", fuelLiters: "0.800000", method: "HISTORICAL", date: "2026-09-29" }];
facts.places = []; n = client.writes.length;
const missingPlace = await a.savePlannedExpense(month, car, { id: randomUUID() });
assert.equal(missingPlace.ok, false); assert.equal(client.writes.length, n);
assert.equal(plannedMutationIssue(new TypeError("PLANNED_EXPENSE_FUNDING_SUM_INVALID")).path, "costItems.fundingAllocations");
// Cross-household roots cannot be edited, declared, restored, reported or deleted.
const foreignId = randomUUID();
client.rows.push({ ...structuredClone(client.rows[0]), household_id: randomUUID(), planned_expense_id: foreignId });
const foreignCommand = { id: foreignId, expectedUpdatedAt: client.rows.at(-1).updated_at };
n = client.writes.length;
for (const action of [() => a.savePlannedExpense(month, intent, foreignCommand),
  () => a.confirmPlannedExpenseReality(month, intent, foreignCommand),
  () => a.restorePlannedExpenseAction(month, foreignCommand),
  () => a.reportPlannedExpenseAction(month, foreignCommand, "2026-10-26"),
  () => a.removePlannedExpense(month, foreignCommand)]) assert.equal((await action()).ok, false);
assert.equal(client.writes.length, n);
const source = fs.readFileSync("src/app/mois-a-venir/planned-expenses-control.tsx", "utf8");
assert.match(source, /currentRevision\.current !== revision/u, "stale Preview responses do not replace newer local drafts");
assert.doesNotMatch(source, /localStorage|sessionStorage/u, "no pre-existing draft recovery/cloud draft authority");
assert(client.writes.every(row => row.table === "phase2_planned_expenses"));
console.log("PASS: C6 PARITY-01..04, resolver parity, IDEMP-CREATE-01/02, tampering, live drift, CAS, META-15/16/17, Preview zero-write");
