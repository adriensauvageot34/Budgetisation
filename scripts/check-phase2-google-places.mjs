import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { randomUUID } from "node:crypto";
import { mock } from "node:test";
import fs from "node:fs";
import "./check-phase2-october-contract.mjs";
import { plannedExpenseMemoryClient } from "./lib/planned-expense-memory-client.mjs";
const require = createRequire(import.meta.url);
const domain = require("../src/domain/phase2/restaurant-places.ts");
const { GoogleRestaurantPlaces, AUTOCOMPLETE_MASK, DETAILS_MASK } = require("../src/server/places/google-places.ts");
const restaurant = require("../src/domain/phase2/planned-restaurant.ts");
const builder = require("../src/domain/phase2/planned-builder.ts");
const flow = require("../src/domain/phase2/planned-restaurant-builder.ts");
const server = require("../src/server/phase2/planned-expenses.ts");
const car = require("../src/server/phase2/planned-car-estimation.ts");
const placeId = "ChIJtest_restaurant", photoName = `places/${placeId}/photos/TEST_photo`;
const details = { id: placeId, displayName: { text: "Google restaurant display" }, formattedAddress: "12 rue de test, Montpellier",
  location: { latitude: 43.6, longitude: 3.8 }, primaryType: "korean_restaurant", types: ["korean_restaurant", "restaurant", "food"],
  photos: [{ name: photoName, authorAttributions: [{ displayName: "Author", uri: "https://maps.google.com/test" }] }] };
const prediction = (id = placeId, types = ["restaurant"]) => ({ placePrediction: { placeId: id, types,
  structuredFormat: { mainText: { text: "Google restaurant" }, secondaryText: { text: "Montpellier" } } } });
assert.deepEqual(domain.normalizeRestaurantSuggestions({ suggestions: [prediction(), prediction("ChIJbank", ["bank", "food"]), prediction("ChIJshop", ["clothing_store"])] }).map(p => p.placeId), [placeId]);
assert(domain.isRestaurantType(["cafe"])); assert(domain.isRestaurantType(["french_restaurant"])); assert(!domain.isRestaurantType(["gas_station"]));
assert.equal(domain.normalizeRestaurantDetails(details).photoAvailable, true);
assert.equal(domain.normalizeRestaurantDetails({ ...details, photos: [] }).photoAvailable, false);
assert.equal(domain.normalizeRestaurantDetails({ ...details, formattedAddress: undefined, location: undefined }).formattedAddress, null);
assert.throws(() => domain.normalizeRestaurantDetails({ ...details, types: ["bank"] }), /RESTAURANT_INVALID/);
assert.deepEqual(domain.photoAuthors([{ displayName: "Author", uri: "javascript:bad" }]), [{ displayName: "Author", uri: null }]);
assert.equal(domain.selectRestaurantCardPhoto({ photos: [{ name: "https://bad" }, details.photos[0]] }).name, photoName);

// Real scheduling with a deterministic clock: no requests before 300ms, stale results ignored, one token per session.
mock.timers.enable({ apis: ["setTimeout"] });
let tokens = 0, calls = [];
const search = new domain.RestaurantSearchSession(() => `token-${++tokens}`);
const capture = (request, current) => calls.push({ request, current });
search.schedule("", "Montpellier", capture); search.schedule("Y", "Montpellier", capture); mock.timers.tick(1000); assert.equal(calls.length, 0);
search.schedule("Yo", "Montpellier", capture); mock.timers.tick(299); assert.equal(calls.length, 0);
search.schedule("Young", "Montpellier", capture); mock.timers.tick(300); assert.equal(calls.length, 1); assert.equal(calls[0].request.sessionToken, "token-1");
search.schedule("Young Min", "Montpellier", capture); assert.equal(calls[0].current(), false); mock.timers.tick(300);
assert.equal(calls[1].request.sessionToken, "token-1"); search.schedule("Young Min", "Montpellier", capture); mock.timers.tick(300); assert.equal(calls.length, 2);
assert.equal(search.sessionToken(), "token-1"); search.complete(); search.schedule("Marine", "Sète", capture); mock.timers.tick(300);
assert.equal(calls.at(-1).request.sessionToken, "token-2"); assert.equal(calls.at(-1).request.city, "Sète"); search.cancel(); mock.timers.reset();

const local = { placeId: randomUUID(), name: "Young Min", commune: "Montpellier", nature: "Commerce", usage: "Restaurant", subtype: "Restaurant", privatePlace: false, relationships: [], googlePlaceId: placeId };
assert.equal(domain.knownRestaurantSuggestions([local, { ...local, privatePlace: true }, { ...local, commune: "Sète" }], "Montpellier", "young").length, 1);
assert.equal(domain.knownRestaurantSuggestions([local], "Sète").length, 0);
assert.equal(domain.deduplicateRestaurantSuggestions(domain.normalizeRestaurantSuggestions({ suggestions: [prediction()] }), [local]).length, 0);
const previousRef = { googlePlaceId: placeId, label: "Own intention", city: "Montpellier" };
assert.equal(domain.usedRestaurantSuggestions([previousRef, previousRef, { ...previousRef, city: "Sète" }], "Montpellier", "own").length, 1);
assert.equal(domain.deduplicateRestaurantSuggestions(domain.normalizeRestaurantSuggestions({ suggestions: [prediction()] }), [], [previousRef]).length, 0);
assert(!domain.isRestaurantType(["bar"]), "Restaurant registry does not permit a bar-only venue");
const network = [];
const provider = new GoogleRestaurantPlaces({ key: "TEST_SERVER_KEY", geocode: async (city) => { assert.equal(city, "Sète"); return { latitude: 43.4, longitude: 3.7 }; },
  fetch: async (url, init) => { network.push({ url: new URL(url), init });
    return Response.json(url.includes(":autocomplete") ? { suggestions: [prediction()] } : url.includes("/media?") ? { photoUri: "https://lh3.googleusercontent.com/transient" } : details); } });
const token = randomUUID(); await provider.autocomplete("Young Min", token, "Montpellier"); await provider.autocomplete("Marine", token, "Sète");
for (const call of network) { assert.equal(call.url.origin, "https://places.googleapis.com"); assert(!call.url.href.includes("TEST_SERVER_KEY")); assert.equal(call.init.cache, "no-store"); assert.equal(call.init.headers["X-Goog-FieldMask"], AUTOCOMPLETE_MASK); assert(!AUTOCOMPLETE_MASK.includes("*")); }
const montpellier = JSON.parse(network[0].init.body), elsewhere = JSON.parse(network[1].init.body);
assert.equal(montpellier.locationBias.circle.center.latitude, 43.6108); assert.equal(montpellier.regionCode, "fr"); assert.deepEqual(montpellier.includedRegionCodes, ["fr"]);
assert.equal(montpellier.locationRestriction, undefined); assert.equal(elsewhere.locationBias.circle.center.latitude, 43.4); assert.equal(elsewhere.input, "Marine");
await provider.details(placeId, token); assert.equal(network.at(-1).url.searchParams.get("sessionToken"), token); assert.equal(network.at(-1).init.headers["X-Goog-FieldMask"], DETAILS_MASK);
assert(!/rating|reviews|phone|website|\*/i.test(DETAILS_MASK));
const photo = await provider.photo(placeId); assert.equal(photo.photoUri, "https://lh3.googleusercontent.com/transient"); assert.equal(photo.authors[0].displayName, "Author");
assert.equal(network.at(-1).url.searchParams.get("skipHttpRedirect"), "true");
assert.equal(await new GoogleRestaurantPlaces({ key: "mock", fetch: async () => Response.json({ ...details, photos: [] }) }).photo(placeId), null);
let refusedCalls = 0;
await assert.rejects(new GoogleRestaurantPlaces({ key: "mock", fetch: async () => { refusedCalls++; return Response.json({ secret: "SHOULD_NOT_LEAK" }, { status: 403 }); } }).autocomplete("Test", token, "Montpellier"), error => !error.message.includes("SHOULD_NOT_LEAK"));
assert.equal(refusedCalls, 1, "4xx does not retry");
let transientCalls = 0;
await new GoogleRestaurantPlaces({ key: "mock", fetch: async () => ++transientCalls === 1 ? new Response(null, { status: 503 }) : Response.json({ suggestions: [] }) }).autocomplete("Test", token, "Montpellier");
assert.equal(transientCalls, 2, "One retry for transient errors");

const personId = randomUUID(), householdId = randomUUID(), userId = randomUUID();
let state = builder.createBuilderState({ familyKey: "food", subtypeKey: "restaurant", title: "Restaurant · intention utilisateur", plannedDate: null, costItems: [], context: {
  companionMode: "SOLO", participantPersonIds: [personId], place: { kind: "TEXT", label: "Mon choix, Montpellier", provenance: "USER_DECLARED_PROSPECTIVE" }, transportMode: "FREE",
  restaurant: { locationScope: "MONTPELLIER", city: "Montpellier", restaurantName: "Mon choix", googlePlaceId: placeId, freeTransportMode: "TRAM" },
} });
state = builder.setBuilderRootBaseline(flow.useRestaurantEstimate(state, randomUUID), null);
const parsed = server.parsePlannedExpenseDraft(builder.materializeBuilderDraft(state), "2026-10");
assert.equal(parsed.context.restaurant.googlePlaceId, placeId); assert.equal(restaurant.restaurantNeedsAddress(parsed.context, []), false);
assert.throws(() => restaurant.parseRestaurantContext({ googlePlaceId: "../secret" }), /INVALID/);
for (const field of ["formattedAddress", "photoUri", "photos", "lat", "location", "displayName"]) assert.throws(() => restaurant.parseRestaurantContext({ ...parsed.context.restaurant, [field]: "provider payload" }), /INVALID/);
assert.throws(() => restaurant.parseRestaurantContext({ ...parsed.context.restaurant, address: "Google address" }), /INVALID/);
const manual = flow.changeRestaurantContext(state, {}, { googlePlaceId: undefined, address: "User address" }); assert.equal(restaurant.restaurantNeedsAddress(manual.draft.context, []), false);
const later = flow.changeRestaurantContext(state, {}, { googlePlaceId: undefined, restaurantName: undefined });
assert.equal(restaurant.restaurantNeedsAddress(later.draft.context, []), true); assert(!restaurant.restaurantContextIssues({ ...later.draft, context: { ...later.draft.context, restaurant: { ...later.draft.context.restaurant, locationScope: "ELSEWHERE", city: "Sète" } } }).some(p => p.code === "RESTAURANT_DETAILS_REQUIRED"));
const contextService = require("../src/server/phase2/planned-context.ts"); contextService.readPlannedContextOptions = async () => ({ places: [], vehicle: null, prices: [], wallets: [] });
const client = plannedExpenseMemoryClient([], [{ person_id: personId, display_name: "Synthetic", household_id: householdId, status: "active" }]);
const preview = await server.resolvePlannedExpenseDraft(client, householdId, "2026-10", parsed, "PREVIEW");
const saved = await server.createPlannedExpense(client, householdId, "2026-10", userId, parsed, randomUUID());
const reload = (await server.readPlannedExpenses(client, householdId, "2026-10"))[0];
assert.deepEqual(preview.context.restaurant, saved.context.restaurant); assert.deepEqual(reload.context.restaurant, parsed.context.restaurant);
assert(!JSON.stringify(reload).includes(details.formattedAddress)); assert(!JSON.stringify(reload).includes(photoName)); assert(!JSON.stringify(reload).includes("googleusercontent"));
assert(client.writes.every(w => w.table === "phase2_planned_expenses"));

// Google discovers the place; the existing transport service regéocodes with TomTom and keeps the user's own label.
const home = { ...local, placeId: randomUUID(), name: "Home", googlePlaceId: undefined, usage: "Domicile", nature: "Privé", subtype: "Domicile", coordinates: { latitude: 43.5, longitude: 3.5, source: "CANONICAL" } };
const vehicle = { vehicleId: randomUUID(), label: "Peugeot 207", fuelType: "SP95", consumptionL100Km: "7", fuelPricePerLiter: "1.8", fuelPriceSource: "test" };
const input = { plannedDate: null, stops: [{ label: home.name, placeId: home.placeId, endpointSource: "DIRECT_PLACE" }, { label: parsed.context.place.label, endpointSource: "ROOT_PLACE" }] };
const orphanRoute = builder.createBuilderState({ ...parsed, context: { ...parsed.context, transportMode: "CAR", restaurant: { ...parsed.context.restaurant, freeTransportMode: undefined },
  route: { mode: "CAR", timeKind: "DEPARTURE", stops: [input.stops[0], { label: "Explicit detour", endpointSource: "DIRECT_PLACE" }, input.stops[0]] } } });
const reattached = flow.startRestaurantCar(orphanRoute, [{ ...home, relationships: [{ personName: "Synthetic", role: "PRIMARY_HOME" }] }]);
assert.deepEqual(reattached.draft.context.route.stops.map(s => s.label), [home.name, "Explicit detour", parsed.context.place.label, home.name]);
assert.equal(flow.startRestaurantCar(reattached, [{ ...home, relationships: [{ personName: "Synthetic", role: "PRIMARY_HOME" }] }]).draft.context.route.stops.length, 4, "No duplicate root stop");
const homeOnly = { ...orphanRoute, draft: { ...orphanRoute.draft, context: { ...orphanRoute.draft.context, route: { ...orphanRoute.draft.context.route, stops: [input.stops[0]] } } } };
assert.deepEqual(flow.startRestaurantCar(homeOnly, [{ ...home, relationships: [{ personName: "Synthetic", role: "PRIMARY_HOME" }] }]).draft.context.route.stops.map(s => s.label), [home.name, parsed.context.place.label, home.name], "A city-first change restores the default round trip after duplicate homes collapse");
let geocoded;
const result = await car.estimatePlannedCar(input, { places: [home], vehicle, history: [], restaurantGooglePlaceId: placeId }, {
  restaurant: { details: async (id) => { assert.equal(id, placeId); return domain.normalizeRestaurantDetails(details); } },
  route: { geocode: async (address, bias) => { geocoded = address; assert.equal(bias, undefined, "An exact Google address elsewhere must not be biased toward home"); return { latitude: 43.61, longitude: 3.81, source: "TOMTOM" }; },
    estimateCarRoute: async () => ({ provider: "TOMTOM", distanceKm: "10", liters: "0.7", durationSeconds: 600, geometry: [], geometryHash: null, hasToll: false,
      segments: [{ distanceKm: "10", liters: "0.7" }], timeBasis: "FALLBACK", sampleTimes: [], routeMethodRef: "test", consumptionModelRef: "test" }) },
  fuel: { getReference: async () => null }, toll: { estimateTolls: async () => ({ status: "NO_TOLL", amount: "0.00", currency: "EUR", provider: "NONE", vehicleCategory: "CLASS_1", routeImportedFrom: "TOMTOM", geometryHash: null, methodRef: "test", calculatedAt: new Date().toISOString() }) },
});
assert.equal(geocoded, details.formattedAddress); assert.equal(result.stops[1].label, parsed.context.place.label);
assert.equal(result.stops[1].coordinates.source, "TOMTOM"); assert.equal(result.stops[1].coordinates.latitude, 43.61);
assert(!JSON.stringify(result).includes(details.formattedAddress)); assert.equal(result.snapshot.route.provider, "TOMTOM");
assert.equal(result.fuelEstimate.cost, "1.26");

const { restaurantPlacesRequest, allowPlacesRequest } = require("../src/server/places/http.ts");
assert.equal((await restaurantPlacesRequest(new Request("https://budget.test/api/places/autocomplete", { method: "POST" }), "autocomplete")).status, 401);
assert.equal((await restaurantPlacesRequest(new Request("https://budget.test/api/places/autocomplete", { method: "POST", headers: { origin: "https://other.test" } }), "autocomplete")).status, 403);
assert(allowPlacesRequest("test", 2, 100)); assert(allowPlacesRequest("test", 2, 100)); assert(!allowPlacesRequest("test", 2, 100)); assert(allowPlacesRequest("test", 2, 60101));
for (const file of ["restaurant-place-search.tsx", "restaurant-photo-background.tsx", "restaurant-wizard.tsx"]) {
  const source = fs.readFileSync(new URL(`../src/app/mois-a-venir/${file}`, import.meta.url), "utf8");
  assert(!source.includes("GOOGLE_MAPS_API_KEY")); assert(!source.includes("process.env")); assert(!source.includes("console.log"));
}
assert(!fs.readFileSync(new URL("../src/server/places/google-places.ts", import.meta.url), "utf8").includes("console."));
console.log("PASS Google Places: debounce/session/stale, hybrid city compatibility/dedup, New API/masks/type filtering, Details/photos/attribution, bounded retry, manual/later fallbacks, durable ID only, Preview/Save/reload, TomTom handoff, auth/rate guard, no secret/log exposure. All fixtures in memory.");
