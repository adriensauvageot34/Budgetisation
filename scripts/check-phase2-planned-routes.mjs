import assert from "node:assert/strict";
import fs from "node:fs";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { forecast, inputs } from "./check-phase2-october-contract.mjs";
const require = createRequire(import.meta.url);
const { parsePlannedExpenseDraft, createPlannedExpense, readPlannedExpenses, updatePlannedExpense,
  markPlannedExpenseRealized, restorePlannedExpense } = require("../src/server/phase2/planned-expenses.ts");
const { resolvePlannedRoute, routeSegments, assertRouteContinuity, deduplicateRouteStops, stopForPlace } = require("../src/domain/phase2/planned-routes.ts");
const { createBuilderState, setBuilderChildPlace, addBuilderChildRouteStop, removeBuilderChild, undoBuilderChange,
  editBuilderDraft, invalidateRouteDistances } = require("../src/domain/phase2/planned-builder.ts");
const { deriveMonthScenario } = require("../src/server/phase2/month-scenario.ts");
const { placesForChildModule } = require("../src/domain/phase2/planned-places.ts");
const { SOCIAL_CONTACTS_V1 } = require("../src/domain/phase2/planned-rules.ts");
const known = () => ({ kind: "KNOWN", placeId: randomUUID() });
const home = known(), rootPlace = known(), restaurant = known(), activity = known();
const vehicle = { label: "Véhicule", consumptionL100Km: "8.836", fuelPricePerLiter: "1.996", fuelPriceSource: "Observation datée",
  fuelPriceObservedAt: "2026-07-01T00:00:00Z", fuelPriceQuality: "P4_NATIONAL_FALLBACK" };
const cost = (assetKey, path, amount = "25.00") => ({ id: randomUUID(), assetKey, modulePath: path, label: "Coût", quantity: "1", unitAmount: amount, baselineKey: null });
const visit = () => ({ familyKey: "visit_trip", subtypeKey: "friend_visit", title: "Voir Lucas", plannedDate: null,
  context: { personVisited: { kind: "CONTACT", contactKey: "lucas" }, place: rootPlace },
  costItems: [cost("restaurant:main", ["visit_friend", "restaurant"])] });
const parse = (draft) => parsePlannedExpenseDraft(draft, "2026-10");
const route = (stops) => ({ mode: "CAR", stops, fuelEstimate: resolvePlannedRoute(stops, [], vehicle).fuelEstimate });
const fuel = (estimate, root = "visit_friend") => ({ ...cost("transport:fuel_usage", [root], estimate.cost), priceSource: "CALCULATED" });
// LP-01/02/03, META-06: independent local place, no child transport, no implied route inclusion.
let state = createBuilderState(visit());
const originalCost = structuredClone(state.draft.costItems);
state = setBuilderChildPlace(state, "restaurant", restaurant);
assert.deepEqual(state.draft.costItems, originalCost);
assert.equal(state.draft.context.route, undefined);
assert.deepEqual(parse(state.draft).context.childLocalPlaceRefs.restaurant, restaurant);
state = editBuilderDraft(state, { ...state.draft, context: { ...state.draft.context,
  route: { mode: "CAR", stops: [stopForPlace(home, "Maison", "DIRECT_PLACE"), stopForPlace(rootPlace, "Lucas", "ROOT_PLACE")] } } });
assert(!state.draft.context.route.stops.some((stop) => stop.childModule));
state = addBuilderChildRouteStop(state, "restaurant", "Restaurant");
assert.equal(state.draft.context.route.stops.length, 3);
assert.equal(state.draft.context.route.stops[2].endpointSource, "CHILD_LOCAL_PLACE");
assert.equal(addBuilderChildRouteStop(state, "restaurant", "Restaurant"), state);
// LP-04/05: orphan, nested transport, route binding and merchant negatives.
assert.throws(() => parse({ ...visit(), costItems: [cost("gift:flowers", ["visit_friend", "gift"])],
  context: { ...visit().context, gift: { recipient: "Lucas", occasion: "Sans occasion" }, childLocalPlaceRefs: { restaurant } } }), /CHILD_PLACE_INVALID/);
assert.throws(() => parse({ ...visit(), costItems: [cost("transport:parking", ["visit_friend", "restaurant", "transport"])] }), /MODULE_PATH/);
assert.throws(() => parse({ ...visit(), costItems: [cost("transport:parking", ["visit_friend", "transport"])] }), /MODULE_PATH|CHILD_FORBIDDEN|MODULE_EDGE/);
const completeStops = state.draft.context.route.stops.map((stop, i, all) => ({ ...stop, distanceToNextKm: i === all.length - 1 ? null : "12.000", distanceSource: i === all.length - 1 ? undefined : "MANUAL" }));
const boundRoute = route(completeStops);
const valid = { ...state.draft, context: { ...state.draft.context, route: boundRoute }, costItems: [...state.draft.costItems, fuel(boundRoute.fuelEstimate)] };
parse(valid);
assert.throws(() => parse({ ...valid, costItems: [...valid.costItems, { ...fuel(boundRoute.fuelEstimate), quantity: "2" }] }), /CAR_ESTIMATE_REQUIRED/);
assert.throws(() => parse({ ...visit(), context: { ...visit().context, childLocalPlaceRefs: { restaurant: { kind: "TEXT", label: "Uber Eats" } } } }), /MERCHANT_AS_PLACE/);
for (const stops of [completeStops.map((stop) => stop.childModule ? { ...stop, placeId: randomUUID() } : stop),
  completeStops.map((stop) => stop.endpointSource === "ROOT_PLACE" ? { ...stop, placeId: randomUUID() } : stop),
  completeStops.map((stop, i) => i === 0 ? { ...stop, placeId: undefined, label: "Uber Eats" } : stop)])
  assert.throws(() => parse({ ...valid, context: { ...valid.context, route: { ...boundRoute, stops } } }), /ENDPOINT|MERCHANT/);
// LP-06: strict consecutive identity collapses, distant repetition remains.
const duplicate = [stopForPlace(home, "Maison", "DIRECT_PLACE"), stopForPlace(rootPlace, "Lucas", "ROOT_PLACE"),
  stopForPlace(rootPlace, "Restaurant sur place", "CHILD_LOCAL_PLACE", "restaurant"), stopForPlace(home, "Maison", "DIRECT_PLACE")];
assert.equal(deduplicateRouteStops(duplicate).length, 3);
assert.equal(deduplicateRouteStops([{ label: "A" }, { label: "a" }]).length, 2);
const segments = routeSegments(deduplicateRouteStops(duplicate));
assertRouteContinuity(segments);
assert.throws(() => assertRouteContinuity([{ origin: { label: "A" }, destination: { label: "B" } }, { origin: { label: "A" }, destination: { label: "C" } }]), /DISCONTINUOUS/);
// LP-07/08: two different child types; two instances cannot be expressed in the V1 map/path contract.
parse({ familyKey: "visit_trip", subtypeKey: "trip_stay", title: "Séjour", plannedDate: null,
  context: { childLocalPlaceRefs: { restaurant, activity } }, costItems: [cost("restaurant:main", ["trip", "restaurant"]), cost("activity:ticket", ["trip", "activity"])] });
assert.throws(() => parse({ ...visit(), costItems: [{ ...visit().costItems[0], moduleInstanceId: "second-restaurant" }] }), /FIELDS_INVALID/);
assert.throws(() => parse({ ...visit(), context: { ...visit().context, childLocalPlaceRefs: { restaurant: [restaurant, known()] } } }), /PLACE/);
// Direction, median, method segregation, route-specific liters and one-sided PARTIAL. Synthetic fixtures after live revalidation.
const history = [10, 12, 90].map((km, i) => ({ originPlaceId: home.placeId, destinationPlaceId: rootPlace.placeId,
  distanceKm: String(km), fuelLiters: ["0.8", "1.0", "8.0"][i], method: "method-v2", date: `2026-07-0${i + 1}` }));
history.push({ originPlaceId: home.placeId, destinationPlaceId: rootPlace.placeId, distanceKm: "999", fuelLiters: "99", method: "old-method", date: "2025-01-01" });
const pair = [stopForPlace(home, "Maison", "DIRECT_PLACE"), stopForPlace(rootPlace, "Lucas", "ROOT_PLACE"), stopForPlace(home, "Maison", "DIRECT_PLACE")];
const partial = resolvePlannedRoute(pair, history, vehicle);
assert.equal(partial.status, "PARTIAL"); assert.equal(partial.stops[0].distanceToNextKm, "12.000");
assert.equal(partial.stops[1].distanceToNextKm, null); assert.equal(partial.fuelEstimate, null);
const completed = resolvePlannedRoute(partial.stops.map((stop, i) => i === 1 ? { ...stop, distanceToNextKm: "15.000", distanceSource: "MANUAL" } : stop), history, vehicle);
assert.equal(completed.fuelEstimate.distanceKm, "27.00");
assert.equal(completed.fuelEstimate.liters, "2.325"); assert.equal(completed.fuelEstimate.cost, "4.64");
// META-07: reorder re-resolves all affected segments, keeping root and child refs.
const beforeRefs = structuredClone(state.draft.context.childLocalPlaceRefs);
const reordered = invalidateRouteDistances([completeStops[0], completeStops[2], completeStops[1]]);
assert(reordered.slice(0, -1).every((stop) => stop.distanceToNextKm === ""));
assert.deepEqual(state.draft.context.childLocalPlaceRefs, beforeRefs);
assert.equal(resolvePlannedRoute(reordered, history, vehicle).status, "PARTIAL");
const stateBeforeReorder = createBuilderState(valid);
const stateAfterReorder = editBuilderDraft(stateBeforeReorder, { ...valid, context: { ...valid.context, route: { mode: "CAR", stops: reordered } },
  costItems: valid.costItems.filter((item) => item.assetKey !== "transport:fuel_usage") });
assert.deepEqual(undoBuilderChange(stateAfterReorder).draft, valid, "Undo preserves explicit manual distances when reordering");
assert.throws(() => parse({ ...valid, context: { ...valid.context, route: { ...valid.context.route, segments: [
  { origin: "Maison", destination: "Lucas" }, { origin: "Maison", destination: "Restaurant" }] } } }), /ROUTE_INVALID/);
// META-08: removal repairs bindings, invalidates fuel, Undo restores once.
const removed = removeBuilderChild(createBuilderState(valid), "restaurant");
assert.equal(removed.draft.context.childLocalPlaceRefs.restaurant, undefined);
assert(!removed.draft.context.route.stops.some((stop) => stop.childModule === "restaurant"));
assert(!removed.draft.costItems.some((item) => item.assetKey === "transport:fuel_usage"));
assert.deepEqual(undoBuilderChange(removed).draft, valid);
const changed = setBuilderChildPlace(createBuilderState(valid), "restaurant", { kind: "TEXT", label: "Autre restaurant" });
assert.deepEqual(changed.draft.costItems.filter((item) => item.assetKey !== "transport:fuel_usage"), originalCost);
assert(!changed.draft.context.route.stops.some((stop) => stop.childModule));
// Economic-only and lifecycle neutrality, including the calendar root boundary.
const saved = (status) => ({ id: randomUUID(), targetMonth: "2026-10", status, costItems: valid.costItems });
const a = deriveMonthScenario(forecast, inputs, null, "2026-09-30", [saved("PLANNED")]).economicPlan;
const b = deriveMonthScenario(forecast, inputs, null, "2026-09-30", [saved("DECLARED_REALIZED")]).economicPlan;
assert.deepEqual(a.scenarios, b.scenarios); assert.deepEqual(a.plannedFunding, b.plannedFunding);
assert.equal(a.plannedFunding.bankAllocated, "25.00");
assert.throws(() => parse({ ...valid, costItems: valid.costItems.map((item) => item.assetKey === "transport:fuel_usage" ? { ...item, fundingAllocations: [{ source: "BANK", amount: item.unitAmount }] } : item) }), /FUEL_FUNDING/);
assert.deepEqual(placesForChildModule([{ placeId: randomUUID(), name: "Privé", privatePlace: true, nature: "Domicile privé", usage: "Restaurant", subtype: null, relationships: [] }], "restaurant"), []);
// META-18/19: prospective service write sites are confined to its one table.
const server = fs.readFileSync("src/server/phase2/planned-expenses.ts", "utf8");
assert.doesNotMatch(server, /from\("(?:mobility_trips|mobility_legs|persons|referentiel_lieu)"\)[\s\S]{0,80}\.(?:insert|update|upsert|delete)\(/u);
// LP-02/META-18/19: execute the actual persistence/lifecycle service against a table boundary spy.
// TEXT refs require no canonical promotion. Supabase is not mutated by this test.
let storedRow;
const mutations = [];
const householdId = randomUUID(), userId = randomUUID();
const tableClient = { from(table) {
  assert.equal(table, "phase2_planned_expenses", "no historical read/write helper for TEXT promotion");
  const where = [], query = {
    select() { return this; }, eq(key, value) { where.push([key, value]); return this; }, order() { return this; },
    insert(row) { mutations.push([table, "insert"]); storedRow = { ...structuredClone(row), created_at: "2026-09-30T00:00:00Z", updated_at: "2026-09-30T00:00:00Z" }; return this; },
    update(patch) { mutations.push([table, "update"]); this.patch = structuredClone(patch); return this; },
    single() { assert(where.every(([key, value]) => storedRow[key] === value)); if (this.patch) storedRow = { ...storedRow, ...this.patch }; return Promise.resolve({ data: structuredClone(storedRow), error: null }); },
    then(resolve) { assert(where.every(([key, value]) => storedRow[key] === value)); resolve({ data: [structuredClone(storedRow)], error: null }); },
  };
  return query;
} };
const textDraft = { ...visit(), context: { personVisited: { kind: "TEXT", label: "Ami déclaré" },
  place: { kind: "TEXT", label: "Lieu principal déclaré" }, childLocalPlaceRefs: { restaurant: { kind: "TEXT", label: "Restaurant déclaré", provenance: "USER_DECLARED_PROSPECTIVE" } } } };
const created = await createPlannedExpense(tableClient, householdId, "2026-10", userId, textDraft);
assert.deepEqual((await readPlannedExpenses(tableClient, householdId, "2026-10"))[0].context, textDraft.context);
const updated = await updatePlannedExpense(tableClient, householdId, created.id, userId, { ...textDraft, title: "Titre modifié" });
assert.equal(updated.id, created.id); assert.deepEqual(updated.context.childLocalPlaceRefs, textDraft.context.childLocalPlaceRefs);
const declared = await markPlannedExpenseRealized(tableClient, householdId, created.id, userId);
assert.equal(declared.id, created.id); assert.equal(declared.status, "DECLARED_REALIZED"); assert.deepEqual(declared.costItems, created.costItems);
assert.equal((await restorePlannedExpense(tableClient, householdId, created.id, userId)).status, "PLANNED");
assert.equal(mutations.length, 4); assert(mutations.every(([table]) => table === "phase2_planned_expenses"));
console.log("PASS: C4 LP-01..08, binding, continuity, directed medians, PARTIAL/manual, fuel, META-05..08/18/19");
