import assert from "node:assert/strict";
import Module from "node:module";
import { require } from "./lib/phase2-ts-loader.mjs";

const { ARCHIVED_REALIZED_MONTHS, isArchivedRealizedMonth, realizedComposerHref } = require("@/domain/phase2/planner/realized-month-entry");
const { realizedPlace, probableMerchantPlace } = require("@/server/phase2/planner/realized-places");
const { buildHistoricalRealizedContext } = require("@/server/phase2/planner/historical-realized-context");
const { detailedRealizedCards } = require("@/app/mois-a-venir/composer/realized-card-view");

assert.equal(ARCHIVED_REALIZED_MONTHS.length, 11);
for (const month of ARCHIVED_REALIZED_MONTHS) assert.equal(realizedComposerHref(month), `/mois-a-venir/composer?month=${month}`);
assert.ok(["2026-03", "2026-04", "2026-05", "2026-06"].every(isArchivedRealizedMonth));
assert.equal(isArchivedRealizedMonth("2026-07"), false);
assert.match(probableMerchantPlace("Maison Regnier", "Paiement par carte - X1111 MAISON REGNIER CHAUD")?.address ?? "", /Chaudes-Aigues/);

const person = { adrien: "person-a", manon: "person-m" };
const loc = "2025-10-18", next = "2025-10-19", before = "2025-10-17";
const places = [
  { place_id: "home", commune: "Montpellier", nom_canonique: "Domicile du foyer", private_place: true, adresse: "adresse privée" },
  { place_id: "fontes", commune: "Fontès", nom_canonique: "Lieu privé", private_place: true },
  { place_id: "servian", commune: "Servian", nom_canonique: "Lieu privé", private_place: true, adresse: "adresse privée" },
  { place_id: "shop", commune: "Servian", nom_canonique: "Magasin de test", private_place: false },
  { place_id: "site", commune: "Montpellier", nom_canonique: "Bureau de test", private_place: false },
];
const lookup = id => {
  const row = places.find(place => place.place_id === id);
  return row && realizedPlace(row, "confirmed");
};
assert.equal(lookup("home").address, undefined);
assert.equal(realizedPlace({ place_id: "venue", private_place: false, nom_canonique: "Domaine de la Clausade" }, "confirmed").town, "Mauguio");
assert.equal(realizedPlace({ place_id: "venue", private_place: true, nom_canonique: "Domaine de la Clausade" }, "confirmed"), undefined);
const serignan = realizedPlace({ place_id: "shop-a", private_place: false, nom_canonique: "Carrefour Sérignan", commune: "Sérignan" }, "confirmed");
assert.equal(serignan.address, "Route de Valras, 34410 Sérignan");
assert.match(new URL(serignan.mapsUrl).searchParams.get("query"), /Carrefour Sérignan.*34410/u);
const longchamp = { place_id: "shop-b", private_place: false, nom_canonique: "Le Longchamp – Valras", commune: "Valras-Plage" };
assert.equal(realizedPlace(longchamp, "confirmed").address, "31 rue Charles-Thomas, 34350 Valras-Plage");
assert.equal(realizedPlace({ ...longchamp, commune: "Autre commune" }, "confirmed").address, undefined);
const observed = (id, kind, start, end, ids = [], parent = null) => ({
  lifeEventId: id, activityId: kind, startDate: start, endDate: end, participantIds: ids, parentLifeEventId: parent,
  validationStatus: "Confirmé",
});
const events = [
  observed("visit-1", "visite_famille", before, loc, [person.adrien, person.manon]),
  observed("visit-2", "visite_famille", loc, next, [person.adrien, person.manon]),
  observed("shopping", "courses_alimentaires", next, next, [person.manon]),
  observed("work-site", "travail_site", before, before, [person.adrien]),
  observed("work-meal", "repas_restaurant", before, before, [person.adrien], "work-site"),
  observed("unpaid-lesson", "lecon_conduite", before, before, [person.adrien]),
];
const eventPlaces = ["fontes", "servian", "shop", "site", "site", "site"];
const details = events.map((event, index) => ({ life_event_id: event.lifeEventId, primary_place_id: eventPlaces[index] }));
const presence = [
  { personId: person.adrien, placeId: "fontes", localDate: before },
  { personId: person.manon, placeId: "fontes", localDate: before },
  { personId: person.adrien, placeId: "servian", localDate: loc },
  { personId: person.manon, placeId: "servian", localDate: loc },
  { personId: person.manon, placeId: "servian", localDate: next },
];
const leg = (id, date, origin, destination) => ({ legId: id, date, origin: { placeId: origin }, destination: { placeId: destination },
  vehicleId: "vehicle", source: { status: "CERTIFIED_SOURCE" }, time: {}, distanceKm: "30.00", estimatedFuelCost: "4.25" });
const trips = [leg("out", before, "home", "fontes"), leg("between", loc, "fontes", "servian"), leg("back", next, "servian", "home")];
const ctx = buildHistoricalRealizedContext(events.map((event, i) => ({
  event, title: event.lifeEventId, placeIds: [eventPlaces[i]], places: [lookup(eventPlaces[i])],
})), presence, trips, lookup, person);
assert.equal(ctx.rootId("visit-2"), "visit-1");
assert.equal(ctx.rootId("shopping"), "visit-1");
assert.equal(ctx.paymentEvent(next, lookup("shop")), "visit-1");
assert.equal(ctx.paymentEvent(next, lookup("site")), undefined);
assert.equal(ctx.purchaseTown(next, "Paiement par carte - X1111 Boutique Servian")?.town, "Servian");
assert.equal(ctx.purchaseTown(next, "Paiement par carte - X1111 Boutique Fontès"), undefined);
assert.equal(ctx.purchaseTown(next, "Paiement par carte - X1111 Amazon Servian"), undefined);
assert.equal(ctx.familyParticipant(loc, "servian"), "Couple");
assert.equal(ctx.familyParticipant(next, "servian"), "Manon");
assert.deepEqual(ctx.assignedLegs().result.get("visit-1").map(row => row.legId), ["out", "between", "back"]);

const shortVisit = { event: observed("day-visit", "visite_famille", loc, loc, [person.manon]),
  title: "Visite", placeIds: ["servian"], places: [lookup("servian")] };
const familyStay = { event: observed("long-stay", "visite_famille", before, next, [person.manon]),
  title: "Séjour", placeIds: ["fontes"], places: [lookup("fontes")] };
const familyContext = checkedLegs => buildHistoricalRealizedContext([familyStay, shortVisit], [], checkedLegs, lookup, person);
assert.equal(familyContext(trips).rootId("day-visit"), "long-stay");
assert.equal(familyContext(trips).assignedLegs().result.get("long-stay").length, 3);
assert.equal(familyContext([]).rootId("day-visit"), "day-visit");

const bank = [
  ["coffee-1", before, "-1.40", "Café test", "alimentation__cafe_au_travail", null],
  ["coffee-2", before, "-1.40", "Café test", "alimentation__cafe_au_travail", null],
  ["meal", before, "-6.00", "Déjeuner test", "alimentation__boulangerie", "site"],
  ["shop", next, "-34.00", "Courses test", "alimentation__courses_alimentaires", "shop"],
].map(([id, date, amount, label, subcat, place]) => ({
  operationId: id, bankAmount: amount, preciseType: id === "meal" ? "Repas du midi au travail" : undefined,
  raw: { flux: "Dépense", date_transaction_precision: "Jour exact", date_transaction_reelle: date,
    ...(id === "coffee-1" ? { moment_id: "moment-stay" } : {}) },
  row: { bankDate: date, bankLabel: label, category: { id: "food", label: "Alimentation" }, subcategory: { id: subcat, label },
    canonicalPlace: place ? { id: place } : undefined },
}));
const labels = {
  categoryKeys: new Map([["food", "alimentation"]]), subcategoryKeys: new Map(bank.map(item => [item.row.subcategory.id, item.row.subcategory.id])),
  merchantIdentity: new Map(), places: new Map(), merchantKeys: new Map(),
};
class Repo {
  async loadOperationsByBankRange() { return bank; }
  async loadEconomicFacts() { return []; }
  async loadActivityOccurrences() { return events; }
  async loadLifeEventRecords() { return details; }
  async loadLifeEventLocalizationRows() { return []; }
  async loadRealizedMerchantPlaceAliases() { return []; }
  async loadFinancialLinkRowsByOperationIds() {
    return [
      { operation_id: "meal", life_event_id: "work-meal", relation_type: "Paiement_activite" },
      { operation_id: "coffee-1", life_event_id: "visit-1", relation_type: "Effectue_pendant", validation_status: "Confirmé" },
    ];
  }
  async loadMomentLifeEventRowsByLifeEventIds() {
    return [{ moment_id: "moment-stay", life_event_id: "visit-1", relation_type: "Événement principal" }];
  }
  async loadActivityCausalFinancialLinkRows() { return []; }
  async loadMobilityLegFacts() { return trips; }
  async loadLifeEventParticipationRows() { return []; }
  async loadPlaceVisits() { return presence; }
  async loadEntityRows() { return places; }
}
const stubs = {
  "@/server/canonical/repository": { CanonicalRepository: Repo },
  "@/server/canonical/client": { createCanonicalReadClient: () => ({}) },
  "@/server/canonical/context": { createAuthorizedRuntimeContext: () => ({}) },
  "@/server/query/sources/shared": { operationFromCanonicalRow: row => row },
  "@/server/query/sources/operations": { buildOperationRow: op => op.row, groupFactsByOperation: () => new Map(),
    loadOperationReferenceLabels: async () => labels },
};
const originalLoad = Module._load;
Module._load = (name, ...args) => stubs[name] ?? originalLoad.call(Module, name, ...args);
const { readRealizedMonth } = require("@/server/phase2/planner/realized-month");
const bootstrap = { household: { householdId: "test", timezone: "Europe/Paris" },
  persons: [{ personId: person.adrien, displayName: "Adrien Test" }, { personId: person.manon, displayName: "Manon Test" }] };
const board = await readRealizedMonth(bootstrap, "2025-10");
Module._load = originalLoad;
assert.equal(board.operationCount, bank.length);
assert.ok(!board.cards.some(card => card.id === "events-lecon_conduite"));
assert.equal(board.totals.expense.amount, "-42.80");
assert.deepEqual(board.cards.flatMap(card => card.payments.map(payment => payment.id)).sort(), bank.map(item => item.operationId).sort());
const work = board.cards.find(card => card.work);
assert.equal(work.work.items.length, 2);
assert.equal(work.work.items.find(item => item.label === "Café test").count, 2);
assert.equal(work.work.items.find(item => item.label === "Déjeuner test").amount, "-6.00");
assert.equal(work.places[0].label, "Bureau de test");
const weekend = board.cards.find(card => card.carTrip);
assert.equal(weekend.endDate, next);
assert.equal(weekend.carTrip.estimatedFuel, "12.75");
assert.equal(weekend.carTrip.legs.find(row => row.id === "back").participant, "Manon");
assert.equal(weekend.payments[0].id, "shop");
assert.equal(weekend.amount, "-34.00");
assert.equal(weekend.relatedPayments[0].id, "coffee-1");
assert.equal(weekend.occurrences.length, 2);
assert.equal(detailedRealizedCards(weekend).length, 1);
assert.equal(detailedRealizedCards(work).length, 1);
const { ArchivedRealizedMonth } = require("@/app/mois-a-venir/composer/archived-realized-month");
const { AppRouterContext } = require("next/dist/shared/lib/app-router-context.shared-runtime");
const { createElement } = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
const html = renderToStaticMarkup(createElement(AppRouterContext.Provider, { value: {} }, createElement(ArchivedRealizedMonth, { board })));
assert.match(html, /Mois réalisé · 4 opérations bancaires/);
assert.match(html, /href="\/historique\/2025-10"/);
assert.match(html, /value="2025-12"/);
assert.match(html, /value="2026-01"/);
assert.match(html, /value="2026-03"/);
assert.match(html, /value="2026-06"/);
assert.doesNotMatch(html, /Modifier dans le brouillon|Enregistrer le Plan/);
const ski = { ...weekend, id: "event-ski", date: "2026-02-26", endDate: "2026-03-01", label: "Séjour ski" };
const march = { ...board, month: "2026-03", cards: [ski] };
const marchHtml = renderToStaticMarkup(createElement(AppRouterContext.Provider, { value: {} },
  createElement(ArchivedRealizedMonth, { board: march, initialCardId: ski.id })));
assert.match(marchHtml, /href="\/mois-a-venir\/composer\?month=2026-02&amp;carte=event-ski"/);
assert.match(marchHtml, /Paiements et trajets de mars 2026/);
const trip = { ...weekend, id: "event-spring-trip", date: "2026-03-31", endDate: "2026-04-01", label: "Déplacement professionnel" };
const aprilHtml = renderToStaticMarkup(createElement(AppRouterContext.Provider, { value: {} },
  createElement(ArchivedRealizedMonth, { board: { ...board, month: "2026-04", cards: [trip] }, initialCardId: trip.id })));
assert.match(aprilHtml, /href="\/mois-a-venir\/composer\?month=2026-03&amp;carte=event-spring-trip"/);
const juneHtml = renderToStaticMarkup(createElement(AppRouterContext.Provider, { value: {} },
  createElement(ArchivedRealizedMonth, { board: { ...board, month: "2026-06" } })));
assert.match(juneHtml, /href="\/mois-a-venir\/composer\?month=2026-07" aria-label="Mois suivant"/);
console.log("PASS: eleven realized months, work cafés, family stays, cross-month event links, confirmed venue addresses, and consistent bank totals");
