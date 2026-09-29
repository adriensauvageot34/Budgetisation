import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import path from "node:path";
import "./check-phase2-october-contract.mjs";

const require = createRequire(import.meta.url);
const root = process.cwd();
const { PLANNED_EXPENSE_SUBTYPES, ASSET_MODULES, ASSET_CATALOG, plannedAsset } =
  require(path.resolve(root, "src/domain/phase2/planned-assets.ts"));
const { PLACE_ROLES_V1 } = require(path.resolve(root, "src/domain/phase2/planned-contract.ts"));
const { CONTEXT_REGISTRY, MODULE_EDGES, DELIVERY_PROVIDERS, SOCIAL_CONTACTS_V1, BRING_ITEMS_LENS,
  FISHING_ASSET_LENS,
  ACTIVITY_PLACE_HINTS, resolvePlannedContext, validateModulePath, moduleAvailability,
  deliveryFeeSuggestions } =
  require(path.resolve(root, "src/domain/phase2/planned-rules.ts"));
const { PLACE_ROLE_RULES, derivePlannedPlaceRoles } =
  require(path.resolve(root, "src/domain/phase2/planned-place-rules.ts"));
const { rankPlacesForPlannedContext } = require(path.resolve(root, "src/domain/phase2/planned-places.ts"));
const { parsePlannedExpenseDraft } = require(path.resolve(root, "src/server/phase2/planned-expenses.ts"));

const expectedContextCount = 38;
assert.equal(CONTEXT_REGISTRY.length, expectedContextCount);
assert.equal(new Set(CONTEXT_REGISTRY.map((context) => context.key)).size, expectedContextCount);
for (const [familyKey, subtypes] of Object.entries(PLANNED_EXPENSE_SUBTYPES)) {
  for (const subtypeKey of subtypes.length ? subtypes : [null]) {
    const matches = CONTEXT_REGISTRY.filter((context) => context.familyKey === familyKey && context.subtypeKey === subtypeKey);
    assert.equal(matches.length, 1, `${familyKey}.${subtypeKey} has exactly one ContextKey`);
    const resolved = resolvePlannedContext({ familyKey, subtypeKey });
    assert.equal(resolved.rootModule, matches[0].rootModule);
    assert(resolved.rootModule);
    assert(!Object.values(resolved.fields).some((policy) => !["HIDDEN", "OPTIONAL", "REQUIRED"].includes(policy)));
    assert.equal(resolved.fields.place, resolved.place.field);
    assert(!resolved.children.some((edge) => edge.availability === "FORBIDDEN"));
    if (familyKey === "activity") {
      assert(resolved.place.source);
      if (subtypeKey !== "other_activity") assert(ACTIVITY_PLACE_HINTS[subtypeKey]);
    }
    if (familyKey === "purchase") assert(resolved.place.source);
  }
}
assert.throws(() => resolvePlannedContext({ familyKey: "food", subtypeKey: "not-real" }), /CONTEXT_UNKNOWN/);

assert.equal(new Set(ASSET_CATALOG.map((asset) => asset.assetKey)).size, ASSET_CATALOG.length);
assert.equal(new Set(PLACE_ROLES_V1).size, 20);
const knownRoles = new Set(PLACE_ROLES_V1);
for (const rule of PLACE_ROLE_RULES) for (const role of rule.add) assert(knownRoles.has(role));
for (const context of CONTEXT_REGISTRY) {
  const resolved = resolvePlannedContext(context);
  for (const role of resolved.place.allowedRoles) assert(knownRoles.has(role));
}
assert(!ASSET_CATALOG.some((asset) => "nestedModule" in asset));
for (const forbidden of ["bar:transport", "visit_friend:gift", "groceries:beauty", "gift:restaurant"])
  assert.equal(plannedAsset(forbidden), undefined, `${forbidden} is an edge, not an asset`);
assert(plannedAsset("groceries:dessert"));
assert.equal(plannedAsset("visit_family:flowers"), undefined);
assert(BRING_ITEMS_LENS.SIMPLE.includes("gift:flowers"));
assert.equal(new Set(MODULE_EDGES.map((edge) => `${edge.fromRoot}/${edge.childModule}`)).size, MODULE_EDGES.length);
for (const edge of MODULE_EDGES) {
  assert.notEqual(edge.fromRoot, edge.childModule);
  assert.notEqual(edge.childModule, "transport");
  assert(ASSET_MODULES.includes(edge.childModule));
  assert(ASSET_CATALOG.some((asset) => asset.module === edge.childModule));
  assert(["HIDDEN", "OPTIONAL", "REQUIRED"].includes(edge.localPlacePolicy));
  assert(["NEVER", "AVAILABLE", "SUGGESTED"].includes(edge.rootTransportStopAvailability));
}
for (const keys of Object.values(BRING_ITEMS_LENS)) for (const key of keys) assert(plannedAsset(key));
for (const key of FISHING_ASSET_LENS) assert(plannedAsset(key));
assert.equal(resolvePlannedContext({ familyKey: "activity", subtypeKey: "fishing" }).rootModule, "activity");
assert(!ASSET_CATALOG.some((asset) => asset.module === "bring_items" || asset.assetKey.startsWith("bring_items:")));
assert(BRING_ITEMS_LENS.APERO_PARTY.includes("house_party:beer"));

const birthday = resolvePlannedContext({ familyKey: "visit_trip", subtypeKey: "friend_visit",
  modifiers: { socialOccasion: "BIRTHDAY", visitFormat: "APERO_PARTY" } });
assert.equal(birthday.children.find((edge) => edge.childModule === "gift")?.availability, "SUGGESTED");
assert.equal(resolvePlannedContext({ familyKey: "visit_trip", subtypeKey: "family_visit",
  modifiers: { socialOccasion: "CELEBRATION" } }).children.find((edge) => edge.childModule === "gift")?.availability,
  "SUGGESTED");
assert.equal(birthday.bringItems, "SUGGESTED");
assert.equal(moduleAvailability(birthday, "gift"), "SUGGESTED");
assert.equal(moduleAvailability(birthday, "work_meal"), "FORBIDDEN");
assert(!Object.hasOwn(birthday, "selectedModules"), "suggestion does not select a module");
assert.deepEqual(birthday.children.find((edge) => edge.childModule === "restaurant")?.localPlacePolicy, "OPTIONAL");
validateModulePath(["visit_friend", "restaurant"], birthday);
for (const pathValue of [["visit_friend", "transport"], ["visit_friend", "restaurant", "gift"],
  ["restaurant", "gift"], ["visit_friend", "work_meal"]])
  assert.throws(() => validateModulePath(pathValue, birthday), /MODULE_(PATH|EDGE)_INVALID/);
assert.equal(resolvePlannedContext({ familyKey: "outing", subtypeKey: "house_party",
  modifiers: { housePartyPlaceMode: "OWN_HOME" } }).transport, "FORBIDDEN");
assert.equal(resolvePlannedContext({ familyKey: "outing", subtypeKey: "house_party",
  modifiers: { housePartyPlaceMode: "OTHER_HOME" } }).transport, "SUGGESTED");
const delivery = resolvePlannedContext({ familyKey: "food", subtypeKey: "fast_food",
  modifiers: { purchaseMode: "DELIVERY", deliveryProviderKey: "UBER_EATS" } });
assert.equal(delivery.transport, "FORBIDDEN");
assert.equal(delivery.place.physicalDestination, false);
assert.equal(delivery.fields.deliveryProvider, "REQUIRED");
assert.deepEqual(delivery.suggestedFeeAssetKeys, ["fast_food:delivery_fee", "fast_food:service_fee"]);
assert.equal(resolvePlannedContext({ familyKey: "food", subtypeKey: "fast_food",
  modifiers: { purchaseMode: "TAKEAWAY" } }).transport, "AVAILABLE");
assert.equal(resolvePlannedContext({ familyKey: "food", subtypeKey: "work_meal",
  modifiers: { workMealPerson: "ADRIEN" } }).baseline.key, "adrien-work-meals");

assert.equal(new Set(DELIVERY_PROVIDERS.map((provider) => provider.key)).size, DELIVERY_PROVIDERS.length);
assert.deepEqual(deliveryFeeSuggestions("UBER_EATS"), [
  { assetKey: "fast_food:delivery_fee", amount: null }, { assetKey: "fast_food:service_fee", amount: null },
]);
assert.deepEqual(deliveryFeeSuggestions("LADY_SUSHI"), []);
assert(PLACE_ROLE_RULES.length > 0);
assert.deepEqual(derivePlannedPlaceRoles({ nature: "Commerce", usage: "Courses", subtype: "Supermarché",
  privatePlace: false }), ["GROCERY"]);
assert(derivePlannedPlaceRoles({ nature: "Domicile privé", usage: "Ami", subtype: "Domicile d’un ami",
  privatePlace: true }).includes("FRIEND_HOME"));
assert.equal(new Set(SOCIAL_CONTACTS_V1.map((contact) => contact.key)).size, SOCIAL_CONTACTS_V1.length);
const lucas = SOCIAL_CONTACTS_V1.find((contact) => contact.key === "lucas");
assert(lucas?.places[0]?.placeId);
const candidates = [
  { placeId: lucas.places[0].placeId, name: "Chez Lucas", commune: "Saint-Jean-de-Védas",
    nature: "Domicile privé", usage: "Ami", subtype: "Domicile d’un ami", privatePlace: true, relationships: [] },
  { placeId: randomUUID(), name: "Autre domicile", commune: null,
    nature: "Domicile privé", usage: "Ami", subtype: "Domicile d’un ami", privatePlace: true, relationships: [] },
  { placeId: randomUUID(), name: "Commerce", commune: null,
    nature: "Commerce", usage: "Courses", subtype: "Supermarché", privatePlace: false, relationships: [] },
];
assert.deepEqual(rankPlacesForPlannedContext(candidates, birthday, { contactKey: "lucas" })
  .map((row) => row.place.name), ["Chez Lucas"]);
assert.deepEqual(rankPlacesForPlannedContext(candidates, birthday, { contactKey: "greg" }), [],
  "declared text home does not become canonical Place");
assert.deepEqual(rankPlacesForPlannedContext(candidates,
  resolvePlannedContext({ familyKey: "food", subtypeKey: "restaurant" })).map((row) => row.place.name), [],
  "zero compatible places never falls back to all");
assert.deepEqual(rankPlacesForPlannedContext([{ ...candidates[2], name: "Uber Eats", usage: "Livraison" }],
  resolvePlannedContext({ familyKey: "food", subtypeKey: "restaurant" })), [],
"a provider name is not a physical restaurant");

const cost = (key, modulePath) => ({ id: randomUUID(), assetKey: key, label: plannedAsset(key)?.label ?? "Coût",
  quantity: "1", unitAmount: "12.00", baselineKey: null, modulePath });
const draft = (familyKey, subtypeKey, costItems, context = {}) => ({ familyKey, subtypeKey,
  title: "Projet", plannedDate: null, costItems, context });
const validChild = draft("visit_trip", "friend_visit", [cost("restaurant:main", ["visit_friend", "restaurant"])],
  { personVisited: { kind: "CONTACT", contactKey: "lucas" } });
assert.equal(parsePlannedExpenseDraft(validChild, "2026-10").costItems.length, 1);
assert.equal(parsePlannedExpenseDraft(draft("activity", "fishing", [cost("fishing:bait", ["activity"])]),
  "2026-10").costItems.length, 1);
assert.throws(() => parsePlannedExpenseDraft(draft("activity", "cinema", [cost("fishing:bait", ["activity"])]),
  "2026-10"), /ASSET_MODULE_INVALID/);
assert.equal(parsePlannedExpenseDraft({ ...validChild,
  context: { ...validChild.context, childLocalPlaceRefs: { restaurant: { kind: "TEXT", label: "Restaurant X" } } } },
"2026-10").context.childLocalPlaceRefs.restaurant.label, "Restaurant X");
assert.throws(() => parsePlannedExpenseDraft({ ...validChild,
  costItems: [cost("restaurant:main", ["visit_friend", "restaurant", "gift"])] }, "2026-10"), /MODULE_PATH_INVALID/);
assert.throws(() => parsePlannedExpenseDraft({ ...validChild,
  costItems: [cost("restaurant:main", ["visit_friend", "gift"])] }, "2026-10"), /ASSET_MODULE_INVALID/);
assert.throws(() => parsePlannedExpenseDraft({ ...validChild,
  context: { ...validChild.context, childLocalPlaceRefs: { transport: { kind: "TEXT", label: "Autre" } } } }, "2026-10"), /CHILD_PLACE_INVALID/);
assert.throws(() => parsePlannedExpenseDraft({ ...validChild,
  context: { personVisited: { kind: "CONTACT", contactKey: "unknown" } } }, "2026-10"), /CONTACT_INVALID/);
assert.throws(() => parsePlannedExpenseDraft({ ...validChild,
  context: { ...validChild.context, deliveryProviderKey: "UBER_EATS" } }, "2026-10"),
  /DELIVERY_PROVIDER_FORBIDDEN/);
assert.throws(() => parsePlannedExpenseDraft(draft("food", "fast_food", [cost("fast_food:burger", ["fast_food"])],
  { purchaseMode: "DELIVERY", deliveryProvider: "Uber Eats", route: { mode: "TRAIN",
    stops: [{ label: "A", distanceToNextKm: "1" }, { label: "B", distanceToNextKm: null }] } }),
"2026-10"), /TRANSPORT_FORBIDDEN/);
assert.equal(parsePlannedExpenseDraft(draft("food", "fast_food", [cost("fast_food:burger", ["fast_food"])],
  { purchaseMode: "DELIVERY", deliveryProvider: "Uber Eats", deliveryProviderKey: "UBER_EATS",
    seller: "Restaurant X" }), "2026-10").context.place, undefined,
"provider and seller are not physical places");
console.log("PASS: C1 registry, graph, assets, roles, contacts, delivery and invalid payloads");
