import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import path from "node:path";
import Big from "big.js";
import { forecast, inputs, deriveMonthScenario } from "./check-phase2-october-contract.mjs";

const require = createRequire(import.meta.url);
const root = process.cwd();
const { PLANNED_ASSETS, plannedAsset, assetsForModule, suggestedAssetQuantity, PLANNED_EXPENSE_SUBTYPES } =
  require(path.resolve(root, "src/domain/phase2/planned-assets.ts"));
const { placesForPlannedContext } = require(path.resolve(root, "src/domain/phase2/planned-places.ts"));
const { estimatePlannedCarRoute } = require(path.resolve(root, "src/server/phase2/planned-context.ts"));
const { parsePlannedExpenseDraft } = require(path.resolve(root, "src/server/phase2/planned-expenses.ts"));
const { projectPlannedExpenseCards, projectMonthCalendar } =
  require(path.resolve(root, "src/app/mois-a-venir/planned-expenses-projection.ts"));

const month = "2026-10";
const line = (key, quantity, unitAmount, allocations, baselineKey = null, modulePath) => ({
  id: randomUUID(), assetKey: key, label: plannedAsset(key)?.label ?? "Personnalisé", quantity, unitAmount,
  baselineKey, ...(allocations ? { fundingAllocations: allocations } : {}), ...(modulePath ? { modulePath } : {}),
});
const draft = (familyKey, subtypeKey, costItems, context = {}) => ({ familyKey, subtypeKey,
  title: "Projet", plannedDate: "2026-10-20", costItems, context });
const saved = (costItems, id = randomUUID()) => ({ id, targetMonth: month, status: "PLANNED", costItems });
const plan = (items) => deriveMonthScenario(forecast, inputs, null, "2026-09-28", items).economicPlan;

assert.equal(new Set(PLANNED_ASSETS.map((asset) => asset.assetKey)).size, PLANNED_ASSETS.length);
assert(PLANNED_EXPENSE_SUBTYPES.outing.includes("club_festival"));
assert(!PLANNED_EXPENSE_SUBTYPES.activity.includes("club_festival"));
assert(PLANNED_EXPENSE_SUBTYPES.purchase.includes("home_equipment"));

// ASSET-01: selection proposes two beers for two participants; no CostItem is created by this pure suggestion.
assert.equal(suggestedAssetQuantity(plannedAsset("bar:beer"), 2), "2");
assert.equal(suggestedAssetQuantity(plannedAsset("bar:tapas"), 2), "1");
// ASSET-02: the visible house-party preset stays two editable catalog suggestions.
assert.deepEqual(assetsForModule("house_party").slice(0, 2).map((asset) =>
  [asset.label, asset.defaultQuantity, asset.defaultUnitAmount]),
[["Vodka", "1", "16.00"], ["Crazy Tiger", "2", "3.00"]]);

// ASSET-03: nested restaurant is one top-level trip with a preserved module path.
const trip = parsePlannedExpenseDraft(draft("visit_trip", "trip_stay",
  [line("restaurant:main", "1", "25.00", undefined, null, ["trip", "restaurant"])]), month);
assert.equal(trip.costItems[0].modulePath.join("/"), "trip/restaurant");
assert.equal(plan([saved(trip.costItems)]).plannedExpenses.grossCost, "25.00");

// ASSET-04/05: meal funding partitions one economic cost; alcohol cannot use meal benefits.
const restaurant = parsePlannedExpenseDraft(draft("food", "restaurant", [
  line("restaurant:main", "1", "25.00", [{ source: "SWILE", amount: "25.00" }]),
  line("restaurant:wine_glass", "1", "15.00"),
]), month);
const restaurantPlan = plan([saved(restaurant.costItems)]);
assert.equal(restaurantPlan.plannedExpenses.grossCost, "40.00");
assert.equal(restaurantPlan.plannedFunding.swile.reserved, "25.00");
assert.equal(restaurantPlan.plannedFunding.bankAllocated, "15.00");
assert.throws(() => parsePlannedExpenseDraft(draft("food", "restaurant", [
  line("restaurant:wine_glass", "1", "15.00", [{ source: "SWILE", amount: "15.00" }]),
]), month), /FUNDING_INELIGIBLE/);

// ASSET-06: a reservation over the planned pocket is an explicit alternative bank need.
const swileResource = new Big(plan([]).plannedFunding.swile.resource);
const oversized = swileResource.plus(35).toFixed(2);
const shortagePlan = plan([saved([line("restaurant:main", "1", oversized,
  [{ source: "SWILE", amount: oversized }])])]);
assert.equal(shortagePlan.plannedFunding.swile.shortfall, "35.00");
assert.equal(shortagePlan.plannedFunding.bankNeedWithShortfall, "35.00");
assert.equal(shortagePlan.plannedFunding.swile.resource, plan([]).plannedFunding.swile.resource);

const place = (name, usage, subtype, relationships = [], privatePlace = false) => ({
  placeId: randomUUID(), name, commune: null, nature: "Commerce", usage, subtype, privatePlace, relationships,
});
const foodStore = place("Grand Frais", "Courses", "Supermarché");
const bar = place("Le Café Riche", "Bar / restaurant", "Café / restaurant");
const family = place("Chez le père de Manon", "Famille", "Domicile familial",
  [{ personName: "Manon", role: "FATHER_HOME" }], true);
const other = place("Autre domicile", "Famille", "Domicile familial", [], true);
const places = [foodStore, bar, family, other];
assert.deepEqual(placesForPlannedContext(places, "food", "groceries").map((item) => item.name), ["Grand Frais"]);
assert.deepEqual(placesForPlannedContext(places, "visit_trip", "family_visit", "Père de Manon").map((item) => item.name),
  ["Chez le père de Manon"]);
assert.deepEqual(placesForPlannedContext(places, "visit_trip", "friend_visit", "Lucas"), []);

// ROUTE-01/02: each ordered segment contributes once, and the calculation is read-only.
const route = estimatePlannedCarRoute([
  { label: "Maison", distanceToNextKm: "25.50" },
  { label: "Servian", distanceToNextKm: "30.50" },
  { label: "Fontès", distanceToNextKm: "30.00" },
  { label: "Maison", distanceToNextKm: null },
], { label: "Peugeot 207", consumptionL100Km: "7.100", fuelPricePerLiter: "1.830",
  fuelPriceSource: "Prix observé" });
assert.equal(route.distanceKm, "86.00");
assert.equal(route.liters, "6.106");
assert.equal(route.cost, "11.17");
const visit = parsePlannedExpenseDraft(draft("visit_trip", "family_visit", [
  { ...line("transport:fuel_usage", "1", route.cost, undefined, null, ["visit_family", "transport"]),
    priceSource: "CALCULATED" },
], { personVisited: { kind: "TEXT", label: "Père de Manon" }, route: {
  mode: "CAR", stops: [{ label: "Maison", distanceToNextKm: "25.50" },
    { label: "Servian", distanceToNextKm: "30.50" }, { label: "Fontès", distanceToNextKm: "30.00" },
    { label: "Maison", distanceToNextKm: null }], fuelEstimate: route,
} }), month);
assert.equal(plan([saved(visit.costItems)]).plannedExpenses.grossCost, "11.17");

// SYNC-NEW-01: a quantity edit changes the same saved entity in list, calendar and forecast.
const id = randomUUID();
const before = { ...saved([line("bar:beer", "2", "6.00")], id), householdId: randomUUID(),
  familyKey: "outing", subtypeKey: "bar", title: "Bar", plannedDate: "2026-10-20", context: {},
  createdBy: randomUUID(), updatedBy: randomUUID(), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
const after = { ...before, costItems: [{ ...before.costItems[0], quantity: "3" }] };
const beforeCards = projectPlannedExpenseCards([before]);
const afterCards = projectPlannedExpenseCards([after]);
assert.equal(beforeCards[0].grossCost, "12.00");
assert.equal(afterCards[0].grossCost, "18.00");
assert.equal(projectMonthCalendar([], afterCards).entries[0].amount, "18.00");
assert.equal(new Big(plan([before]).scenarios.central).minus(plan([after]).scenarios.central).toFixed(2), "6.00");
console.log("PASS: ASSET-01..06, PLACE-01..03, ROUTE-01..02, SYNC-NEW-01");
