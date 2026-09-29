import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import path from "node:path";
import { forecast, inputs } from "./check-phase2-october-contract.mjs";

const require = createRequire(import.meta.url);
const root = process.cwd();
const { parsePlannedExpenseDraft, simulatePlannedExpense } =
  require(path.resolve(root, "src/server/phase2/planned-expenses.ts"));
const item = (assetKey, modulePath, amount = "12.00") => ({ id: randomUUID(), assetKey,
  label: "Coût", quantity: "1", unitAmount: amount, baselineKey: null, modulePath });
const draft = (familyKey, subtypeKey, costItems, context = {}) => ({ familyKey, subtypeKey,
  title: "Projet", plannedDate: null, costItems, context });
const parse = (value) => parsePlannedExpenseDraft(value, "2026-10");
const grocery = draft("food", "groceries", [item("groceries:food", ["groceries"])]);
assert.equal(parse(grocery).costItems.length, 1);
assert.throws(() => parse({ ...grocery, status: "DECLARED_REALIZED" }), /DRAFT_FIELDS_INVALID/);
assert.throws(() => parse({ ...grocery, costItems: [item("groceries:food", ["groceries", "beauty", "gift"])] }),
  /MODULE_PATH_INVALID/);
assert.throws(() => parse({ ...grocery, costItems: [{ ...grocery.costItems[0], moduleInstanceId: randomUUID() }] }),
  /COST_ITEM_FIELDS_INVALID/);
assert.throws(() => parse({ ...grocery, costItems: [item("groceries:food", ["groceries"]),
  item("groceries:meat", ["groceries"])] }), /AGGREGATE_DESCENDANTS_ACTIVE/);
assert.throws(() => parse(draft("food", "restaurant", [{ ...item("restaurant:main", ["restaurant"]),
  fundingAllocations: [{ source: "SWILE", amount: "11.00" }] }])), /FUNDING_SUM_INVALID/);
assert.throws(() => parse(draft("outing", "house_party", [item("house_party:beer", ["house_party"])])),
  /PLACE_REQUIRED/);
assert.throws(() => parse(draft("visit_trip", "family_visit", [item("visit_family:breakfast", ["visit_family"])],
  { personVisited: { kind: "CONTACT", contactKey: "lucas" } })), /CONTACT_CONTEXT_INVALID/);
assert.throws(() => parse(draft("food", "restaurant", [item("restaurant:main", ["restaurant"])],
  { place: { kind: "TEXT", label: "Uber Eats" } })), /MERCHANT_AS_PLACE_INVALID/);
assert.throws(() => parse(draft("food", "fast_food", [item("fast_food:burger", ["fast_food"])],
  { purchaseMode: "DELIVERY", deliveryProvider: "Uber Eats", deliveryProviderKey: "LADY_SUSHI" })),
  /DELIVERY_PROVIDER_MISMATCH/);
assert.throws(() => parse(draft("food", "fast_food", [item("fast_food:burger", ["fast_food"])],
  { purchaseMode: "DELIVERY", deliveryProviderKey: "NOT_REGISTERED" })), /DELIVERY_PROVIDER_INVALID/);
assert.throws(() => parse(draft("purchase", "gift", [{ ...item("restaurant:main", ["gift", "restaurant"]),
  baselineKey: "household-restaurants" }], { gift: { recipient: "Lucas", occasion: "Anniversaire" } })),
  /CHILD_BASELINE_FORBIDDEN/);
assert.throws(() => parse(draft("purchase", "gift", [{ ...item("restaurant:main", ["gift", "restaurant"]),
  fundingAllocations: [{ source: "SWILE", amount: "12.00" }] }],
  { gift: { recipient: "Lucas", occasion: "Anniversaire" } })), /CHILD_FUNDING_FORBIDDEN/);
assert.throws(() => parse(draft("food", "restaurant", [item("bar:beer", ["restaurant", "bar"])])),
  /MODULE_EDGE_INVALID/);
assert.throws(() => parse(draft("visit_trip", "family_visit", [{ ...item("transport:fuel_usage", ["visit_family"]),
  fundingAllocations: [{ source: "BANK", amount: "12.00" }] }],
  { personVisited: { kind: "TEXT", label: "Lucas" } })), /FUEL_FUNDING_FORBIDDEN/);
assert.throws(() => parse(draft("food", "groceries", [item("groceries:food", ["groceries"])],
  { childLocalPlaceRefs: { restaurant: { kind: "TEXT", label: "Restaurant" } } })), /CHILD_PLACE_INVALID/);
assert.throws(() => parse(draft("visit_trip", "friend_visit", [item("visit_friend:coffee", ["visit_friend"])],
  { personVisited: { kind: "TEXT", label: "Lucas" }, route: { mode: "TRAIN", stops: [
    { label: "Maison", distanceToNextKm: "1", endpointSource: "CHILD_LOCAL_PLACE", childModule: "restaurant" },
    { label: "Gare", distanceToNextKm: null } ] } })), /ROUTE_ENDPOINT_INVALID/);

const householdId = randomUUID();
const anotherHouseholdPersonId = randomUUID();
const foreignPersonDraft = draft("food", "work_meal", [item("work_meal:bakery", ["work_meal"])],
  { participantPersonIds: [anotherHouseholdPersonId] });
const householdClient = { from(table) {
  assert.equal(table, "persons");
  return { select() { return this; }, eq(key, value) {
    assert.equal(key, "household_id"); assert.equal(value, householdId);
    return Promise.resolve({ data: [], error: null });
  } };
} };
await assert.rejects(simulatePlannedExpense(householdClient, householdId, forecast, inputs,
  [], foreignPersonDraft, "2026-09-28"), /PERSON_NOT_IN_HOUSEHOLD/);

const migration = readFileSync(path.resolve(root,
  "supabase/migrations/20260929211001_phase2_planned_module_path_v1.sql"), "utf8");
assert.match(migration, /jsonb_array_length\(item->'modulePath'\) not between 1 and 2/);
assert.doesNotMatch(migration, /jsonb_array_length\(item->'modulePath'\) not between 1 and 5/);
assert.doesNotMatch(migration, /\b(?:operations|historical|analytics)_\w+\b.*(?:insert|update|delete)/i);
console.log("PASS: C2 structural, resolved context, graph, assets, finance, live references and migration shape");
