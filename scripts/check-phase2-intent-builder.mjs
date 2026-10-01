import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import fs from "node:fs";
import { forecast, inputs } from "./check-phase2-october-contract.mjs";
const require = createRequire(import.meta.url);
const builder = require("../src/domain/phase2/planned-builder.ts");
const ux = require("../src/domain/phase2/planned-ux.ts");
const rules = require("../src/domain/phase2/planned-rules.ts");
const { habitualPlaceSuggestions, rankPlacesForPlannedContext } = require("../src/domain/phase2/planned-places.ts");
const routes = require("../src/domain/phase2/planned-routes.ts");
const server = require("../src/server/phase2/planned-expenses.ts");
const adrien = randomUUID(), manon = randomUUID(), household = randomUUID();
const people = [{ personId: adrien, displayName: "Adrien" }, { personId: manon, displayName: "Manon" }];
const draft = (familyKey, subtypeKey, context = {}, costItems = []) => ({ familyKey, subtypeKey, context, costItems, title: "Projet", plannedDate: null });
const quick = (family, subtype, amount, context = {}) => builder.setQuickBaseline(builder.setQuickTotal(builder.createBuilderState(draft(family, subtype, context)), amount), null);
const line = (key, amount, module) => ({ id: randomUUID(), assetKey: key, label: key, unitAmount: amount, quantity: "1", baselineKey: null, modulePath: [module] });
const parse = state => server.parsePlannedExpenseDraft(builder.materializeBuilderDraft(state), "2026-10");
assert.equal(ux.BUILDER_INTENTS.length, 9);
assert.equal(new Set(ux.BUILDER_INTENTS.map(part => part.key)).size, 9);

// Restaurant: derived header, total funding, honest meal/alcohol distinction.
let restaurant = quick("food", "restaurant", "60", { companionMode: "COUPLE", socialOccasion: "OTHER_SPECIAL", occasionLabel: "Saint-Valentin" });
assert.equal(ux.deriveProjectTitle(restaurant.draft, []), "Soirée en amoureux pour la Saint-Valentin");
restaurant = builder.fundBuilderTotal(restaurant, "SWILE", "20", "45");
assert.equal(server.grossPlannedExpenseCost(parse(restaurant)), "60.00");
assert.deepEqual(restaurant.draft.costItems[0].fundingAllocations, [{ source: "SWILE", amount: "20.00" }, { source: "BANK", amount: "25.00" }]);
assert(!restaurant.draft.costItems[1].fundingAllocations);

// Opening detail immediately removes the total without creating an empty line; Undo restores it.
const detail = builder.itemizeBuilderCosts(quick("food", "restaurant", "60"));
assert.equal(builder.materializeBuilderDraft(detail).costItems.length, 0);
assert.equal(builder.materializeBuilderDraft(builder.undoBuilderChange(detail)).costItems[0].unitAmount, "60.00");
assert.throws(() => builder.commitBuilderCost(detail, line("restaurant:main", "", "restaurant")), /LOCAL_COST_INVALID/);

// Delivery: providers do not create fees; 32 = meal26 + delivery3 + service3, before/after funding.
const deliveryContext = { purchaseMode: "DELIVERY", deliveryProviderKey: "UBER_EATS", deliveryProvider: "Uber Eats", seller: "Domino’s" };
let order = quick("food", "fast_food", "32", deliveryContext);
assert.equal(order.draft.costItems.length, 0);
const fee = line("fast_food:delivery_fee", "3", "fast_food");
order = builder.commitBuilderCost(order, fee);
order = builder.commitBuilderCost(order, line("fast_food:service_fee", "3", "fast_food"));
assert.equal(order.quickTotal, "26.00");
assert.equal(server.grossPlannedExpenseCost(parse(order)), "32.00");
order = builder.fundBuilderTotal(order, "SWILE", "20");
order = builder.commitBuilderCost(order, { ...fee, unitAmount: "4" });
assert.equal(server.grossPlannedExpenseCost(parse(order)), "32.00");
assert.equal(ux.draftSummary(parse(order).costItems).swile, "20.00");
assert.equal(server.grossPlannedExpenseCost(parse(builder.removeBuilderCost(order, fee.id))), "32.00");

// Zero expense intentions are real empty roots. Paid restaurant remains rejected.
for (const value of [draft("visit_trip", "family_visit", { personVisited: { kind: "CONTACT", contactKey: "adrien_father" } }),
  draft("food", "work_meal", { workMealMode: "FROM_HOME", participantPersonIds: [manon] }), draft("activity", "photo_outing", { noExpense: true })]) {
  const state = builder.createBuilderState(value);
  assert(builder.deriveBuilderReadiness(state).saveReady);
  assert.equal(parse(state).costItems.length, 0);
}
assert.throws(() => server.parsePlannedExpenseDraft(draft("food", "restaurant"), "2026-10"), /COST_ITEMS_INVALID/);

// Work meal person wallet and automatic baseline are re-resolved on the server.
const walletRows = [{ provider: "SWILE", owner_person_id: adrien, status: "ACTIVE" }, { provider: "EDENRED", owner_person_id: manon, status: "ACTIVE" }];
const persons = people.map(person => ({ person_id: person.personId, display_name: person.displayName, household_id: household, status: "active" }));
const reads = [];
const client = { from(table) { reads.push(table); assert(["persons", "benefit_wallets"].includes(table)); const query = { select() { return this; }, eq() { return this; }, then(resolve,reject) { return Promise.resolve({ data: table === "persons" ? persons : walletRows, error: null }).then(resolve,reject); } }; return query; } };
const canonical = require("../src/server/canonical/client.ts");
canonical.createCanonicalReadClient = () => ({ from(table) { assert.equal(table, "benefit_wallets"); return client.from(table); } });
let work = quick("food", "work_meal", "14", { workMealMode: "BOUGHT", participantPersonIds: [manon] });
work = builder.fundBuilderTotal(work, "EDENRED", "10");
const workResolved = await server.resolvePlannedExpenseDraft(client, household, "2026-10", builder.materializeBuilderDraft(work));
assert.equal(workResolved.costItems[0].baselineKey, "manon-work-meals");
await assert.rejects(() => server.resolvePlannedExpenseDraft(client, household, "2026-10", { ...workResolved,
  costItems: [{ ...workResolved.costItems[0], fundingAllocations: [{ source: "SWILE", amount: "14" }] }] }), /WALLET_PERSON_MISMATCH/);
assert.deepEqual(ux.compatibleWallets(walletRows.map(row => ({ source: row.provider, ownerPersonId: row.owner_person_id })), work.draft.context, true).map(part => part.source), ["EDENRED"]);

// Habitual groceries and top-up replace forecast without a question.
for (const groceriesNature of ["USUAL", "TOP_UP"]) {
  const state = builder.synchronizeIntentBuilder(quick("food", "groceries", "100", { groceriesNature }), [], people);
  assert.equal(parse(state).costItems[0].baselineKey, "groceries");
  assert.equal(rules.resolvePlannedContext({ familyKey: "food", subtypeKey: "groceries", modifiers: { groceriesNature } }).baseline.mode, "AUTO");
}
assert.equal(rules.resolvePlannedContext({ familyKey: "food", subtypeKey: "groceries", modifiers: { groceriesNature: "OCCASION" } }).baseline.mode, "ASK");

// Contact primary destination, one route; removing a bakery child can never remove Servian.
const home = { label: "Maison", placeId: randomUUID(), endpointSource: "DIRECT_PLACE" };
const bakery = { label: "Boulangerie", placeId: randomUUID(), endpointSource: "DIRECT_PLACE" };
const stops = routes.ensurePrimaryRouteStop([home, bakery, home], { kind: "TEXT", label: "Servian" }, "Servian", home.placeId);
assert.deepEqual(stops.map(part => part.label), ["Maison", "Boulangerie", "Servian", "Maison"]);
assert.throws(() => routes.assertPrimaryRouteStop([home, bakery, home], { kind: "TEXT", label: "Servian" }), /PRIMARY_DESTINATION_MISSING/);
let visit = builder.changeBuilderContext(builder.createBuilderState(draft("visit_trip", "family_visit")), { personVisited: { kind: "CONTACT", contactKey: "adrien_father" } });
assert.equal(visit.draft.context.place.label, "Servian");
assert.equal(ux.deriveProjectTitle(visit.draft, []), "Voir le père d’Adrien");

// Activity subtype, work sector, strict club/event separation, compatibility before suggestions.
const place = (name, subtype, commune="Montpellier", visits=3) => ({ placeId: randomUUID(), name, subtype, commune, nature: "Commerce", usage: "Loisir", privatePlace: false, relationships: [], visits12Months: visits, lastVisitDate: "2026-09-01" });
const bowling = place("Bowling", "Bowling"), cinema = place("Cinéma", "Cinéma"), rare = place("Autre bowling", "Bowling", "Montpellier", 1);
assert.deepEqual(rankPlacesForPlannedContext([bowling, cinema], rules.resolvePlannedContext({ familyKey: "activity", subtypeKey: "bowling" })).map(part=>part.place.name), ["Bowling"]);
assert(!habitualPlaceSuggestions([bowling,rare]).includes(rare));
const club = place("Dièze", "Club"), arena = place("Arena", "Arena");
assert.deepEqual(rankPlacesForPlannedContext([club,arena], rules.resolvePlannedContext({ familyKey:"outing", subtypeKey:"club_festival", modifiers:{outingKind:"CLUB"} })).map(part=>part.place.name), ["Dièze"]);
assert(!ux.plausibleTransportModes(draft("outing","club_festival",{place:{kind:"TEXT",label:"Dièze · Montpellier"}}),[]).includes("TRAIN"));
assert(rules.resolvePlannedContext({ familyKey: "purchase", subtypeKey: "beauty", modifiers: { purchaseMode: "ONLINE" } }).transport === "FORBIDDEN");
assert.equal(parse(quick("purchase", "beauty", "9.98", { purchaseMode: "ONLINE", seller: "Sephora" })).context.place, undefined);

// Trip uses one terminal Restaurant child, root transport, no baseline for child Restaurant.
let trip = builder.acceptBuilderChild(quick("visit_trip", "trip_stay", "200", { place: { kind:"TEXT",label:"Annecy" },transportMode:"TRAIN" }), "restaurant");
trip = builder.commitBuilderCost(trip, { ...line("restaurant:main", "30", "restaurant"), modulePath:["trip","restaurant"] });
assert.equal(parse(trip).costItems.length, 2);
assert.equal(ux.deriveProjectTitle(trip.draft,[]), "Séjour à Annecy");
assert(!parse(trip).costItems.some(part=>part.modulePath.length>2));

// Reload recovers the simple total or targeted funding UI without changing persisted intent.
const storedQuick = parse(quick("food", "restaurant", "60"));
const reloadedQuick = builder.createBuilderState(storedQuick);
assert.equal(reloadedQuick.costMode, "QUICK_TOTAL");
assert.deepEqual(builder.materializeBuilderDraft(reloadedQuick), storedQuick);
const storedFunded = parse(restaurant);
assert.equal(builder.createBuilderState(storedFunded).costMode, "TARGETED_SPLIT");
assert.deepEqual(builder.materializeBuilderDraft(builder.createBuilderState(storedFunded)), storedFunded);
const mealDetails = builder.createBuilderState(draft("food", "restaurant", {}, [line("restaurant:main", "45", "restaurant"), line("restaurant:soft", "15", "restaurant")]));
const collapsed = builder.collapseBuilderCosts(mealDetails);
assert.equal(server.grossPlannedExpenseCost(parse(collapsed)), "60.00");
assert.equal(parse(collapsed).costItems.length, 1);
assert.deepEqual(builder.undoBuilderChange(collapsed).draft, mealDetails.draft);
assert(!builder.canCollapseBuilderCosts(builder.createBuilderState(draft("food", "restaurant", {}, [line("restaurant:main", "45", "restaurant"), line("restaurant:wine_glass", "15", "restaurant")]))));

// No duplicated orchestration or banned normal UI vocabulary.
const control=fs.readFileSync("src/app/mois-a-venir/planned-expenses-control.tsx","utf8");
assert(!/Comment l’appeler|Quelques détails utiles|Annuler le dernier changement|Informations mises de côté|Rechercher un élément|Ventiler le total/u.test(control));
assert(reads.every(table=>["persons","benefit_wallets"].includes(table)));
console.log("PASS: nine intention contracts, zero roots, local confirmation, XOR/Undo, fee decomposition, wallet ownership, server baseline, compatibility, root route, human titles");
