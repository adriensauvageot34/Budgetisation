import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { randomUUID, createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { forecast, inputs } from "./check-phase2-october-contract.mjs";
import { planningHarness, value } from "./lib/planned-actions-harness.mjs";
const require = createRequire(import.meta.url);
const { createBuilderState, synchronizeIntentBuilder, materializeBuilderDraft, deriveBuilderReadiness, commitBuilderCost,
  splitRestaurantQuickTotal, setQuickTotal, undoBuilderChange, discardSuspended } = require("../src/domain/phase2/planned-builder.ts");
const { beginProjectV2, emptyWizardSession, nextUsefulQuestion, applyProjectAnswer, answerWizard, backWizard, jumpWizard,
  wizardKnowledge, projectNights, PROJECT_QUESTIONS, deferProjectTransportPrice } = require("../src/domain/phase2/planned-question-engine.ts");
const { intentForDraft, draftSummary } = require("../src/domain/phase2/planned-ux.ts");
const { SOCIAL_CONTACTS_V1 } = require("../src/domain/phase2/planned-rules.ts");
const { parsePlannedExpenseDraft } = require("../src/server/phase2/planned-expenses.ts");
const { parsePlannedProject } = require("../src/domain/phase2/planned-project.ts");
const { calculateRouteFuel } = require("../src/domain/phase2/planned-routes.ts");
const { groceryBasketEstimate } = require("../src/domain/phase2/planned-price-estimates.ts");
const { simulatePlannedExpenseScenario } = require("../src/server/phase2/month-scenario.ts");
const { inferredActivitySubtype } = require("../src/domain/phase2/planned-project-entities.ts");
const adrien = randomUUID(), manon = randomUUID(), homeId = randomUUID();
const marc = SOCIAL_CONTACTS_V1.find(c => c.key === "manon_father"), lucas = SOCIAL_CONTACTS_V1.find(c => c.key === "lucas");
const env = { persons: [{ personId: adrien, displayName: "Adrien" }, { personId: manon, displayName: "Manon" }], places: [
  { placeId: homeId, name: "Domicile", commune: "Montpellier", nature: "Domicile privé", usage: "Domicile", subtype: "Domicile principal", privatePlace: true, relationships: [{ personName: "Manon", role: "HOUSEHOLD_HOME" }] },
  { placeId: marc.places[0].placeId, name: "Fontès", commune: "Fontès", privatePlace: true, nature: "Domicile", usage: "Famille", carVisitDates12Months: ["2026-06-01", "2026-07-01", "2026-08-01"] },
  { placeId: lucas.places[0].placeId, name: "Chez Lucas", commune: "Montpellier", privatePlace: true, nature: "Domicile", usage: "Ami" },
] };
const vehicle = { label: "Véhicule fixture", consumptionL100Km: "6.000", fuelPricePerLiter: "1.900", fuelPriceSource: "Prix fixture" };
const line = (assetKey, path, amount, quantity = "1") => ({ id: randomUUID(), assetKey, label: assetKey, quantity, unitAmount: amount, modulePath: path, baselineKey: null });
const initialize = (familyKey, subtypeKey) => beginProjectV2(createBuilderState({ familyKey, subtypeKey, title: "Projet", plannedDate: null, context: {}, costItems: [] }), env);
const sync = state => synchronizeIntentBuilder(state, env.places, env.persons);
function manualCar(state) {
  const stops = state.draft.context.route.stops.map((s, i, a) => ({ ...s, distanceToNextKm: i === a.length - 1 ? null : "5.000", ...(i < a.length - 1 ? { distanceSource: "MANUAL" } : {}) }));
  const fuelEstimate = calculateRouteFuel(stops, vehicle);
  return { ...state, draft: { ...state.draft, context: { ...state.draft.context, route: { ...state.draft.context.route, stops, fuelEstimate } },
    costItems: [...state.draft.costItems, { ...line("transport:fuel_usage", [require("../src/domain/phase2/planned-assets.ts").rootAssetModule(state.draft.familyKey, state.draft.subtypeKey)], fuelEstimate.cost), priceSource: "CALCULATED" }] } };
}
const traces = {};
async function timedCar(state) {
  const { estimatePlannedCar } = require("../src/server/phase2/planned-car-estimation.ts");
  const { applyCarResult } = require("../src/domain/phase2/planned-car.ts");
  const places = env.places.map((p, i) => ({ ...p, coordinates: { latitude: 43.5 + i / 10, longitude: 3.3 + i / 10, source: "CANONICAL" } }));
  const geometry = [{ encodedPolyline: "_p~iF~ps|U_ulLnnqC_mqNvxq`@", precision: 5 }];
  const result = await estimatePlannedCar({ stops: state.draft.context.route.stops, plannedDate: state.draft.plannedDate, plannedTime: null, timeKind: "DEPARTURE", tripTiming: state.draft.context.visitTiming },
    { places, vehicle: { ...vehicle, label: "Peugeot 207", consumptionL100Km: "8.836", vehicleId: randomUUID(), fuelType: "SP95" }, history: [] }, {
      route: { geocode: async () => { throw Error("Fixture has coordinates"); }, estimateCarRoute: async request => ({ provider: "TOMTOM", distanceKm: "60", durationSeconds: 3000, liters: "4", geometry,
        geometryHash: createHash("sha256").update(JSON.stringify(geometry)).digest("hex"), hasToll: false, segments: request.coordinates.slice(1).map(() => ({ distanceKm: "60", liters: "4" })), timeBasis: "UNKNOWN_TIME_MEDIAN_08_14_18", sampleTimes: ["08:00", "14:00", "18:00"].map(t => `${request.plannedDate}T${t}`), routeMethodRef: "fixture", consumptionModelRef: require("../src/domain/phase2/planned-car.ts").PEUGEOT_207_ROUTING_PROFILE.modelKey }) },
      fuel: { getReference: async () => ({ pricePerLiter: "1.900", source: "FR_GOV_FUEL_INSTANT_V2", methodRef: "fixture", observedAt: "2026-10-01T10:00:00Z", calculatedAt: "2026-10-01T11:00:00Z", quality: "FRESH", sampleCount: 3, radiusKm: 15, minimum: "1.8", maximum: "2" }) },
      toll: { estimateTolls: async route => ({ status: "NONE", amount: "0.00", currency: "EUR", provider: "HERE", methodRef: "fixture", routeImportedFrom: "TOMTOM", geometryHash: route.geometryHash, components: [] }) },
    });
  return { ...state, draft: applyCarResult(state.draft, result, randomUUID) };
}
async function golden(name, family, subtype, answers, sideEffects = {}) {
  let state = initialize(family, subtype), session = emptyWizardSession(), trace = [];
  for (let i = 0; i < 40; i++) {
    const question = nextUsefulQuestion({ draft: state.draft, intent: intentForDraft(state.draft), env, session });
    trace.push(question.id);
    if (question.id === "review") break;
    assert(Object.hasOwn(answers, question.id), `${name}: unexpected useful question ${question.id}`);
    state = sync(applyProjectAnswer(state, question.id, answers[question.id], env));
    if (sideEffects[question.id]) state = sync(await sideEffects[question.id](state));
    session = answerWizard(session, question.id, answers[question.id]);
  }
  assert.equal(trace.at(-1), "review", `${name}: finite route`);
  const draft = materializeBuilderDraft(state);
  assert.equal(deriveBuilderReadiness(state).previewReady, true, `${name}: readiness`);
  assert.deepEqual(parsePlannedExpenseDraft(draft, draft.plannedDate?.slice(0, 7) ?? "2026-10", "PREVIEW"), parsePlannedExpenseDraft(draft, draft.plannedDate?.slice(0, 7) ?? "2026-10"), `${name}: parse parity`);
  traces[name] = trace;
  return { state, session, draft };
}
const restaurant = await golden("Restaurant", "food", "restaurant", { participants: adrien, date: { date: "2026-10-16", moment: "EVENING" }, occasion: "NONE", entity: { label: "Au Bureau", address: "1 avenue de la mer, Montpellier" }, transport: "CAR", transportDetails: "DONE", costMode: "DETAIL", costDetails: "DONE" },
  { transportDetails: manualCar, costDetails: state => commitBuilderCost(state, line("restaurant:starter", ["restaurant"], "4.00")) });
assert.equal(restaurant.draft.costItems.find(c => c.assetKey === "restaurant:starter").unitAmount, "4.00");
const fast = await golden("FastFoodDelivery", "food", "fast_food", { channel: "DELIVERY", participants: "BOTH", entity: { label: "Snack choisi" }, date: null, provider: { key: "UBER_EATS", label: "Uber Eats" }, costMode: "TOTAL", costTotal: "25.00", addons: "DONE" });
assert(!traces.FastFoodDelivery.includes("transport")); assert(!fast.draft.costItems.some(c => c.assetKey?.endsWith("fee")));
const work = await golden("WorkMealFromHome", "food", "work_meal", { workPerson: adrien, date: "2026-10-16", workMode: "FROM_HOME", moment: "NONE", addons: "DONE" });
assert.equal(work.draft.costItems.length, 0); assert(!traces.WorkMealFromHome.includes("entity")); assert(!traces.WorkMealFromHome.includes("costMode"));
const evidence = ["20", "40", "60"].map((amount, i) => ({ operationId: String(i), amount, subcategory: "Courses alimentaires", date: "2026-09-01" }));
const estimate = groceryBasketEstimate(evidence); assert.equal(estimate.unitAmount, "40.00"); assert.equal(groceryBasketEstimate(evidence.slice(0, 2)), null);
const groceries = await golden("UsualGroceries", "food", "groceries", { groceriesNature: "USUAL", date: null, entity: { label: "Enseigne choisie" }, channel: "DELIVERY", provider: { key: "DIRECT", label: "Directement par le commerce" }, costMode: "ESTIMATE", costEstimate: "DONE", addons: "DONE" },
  { costEstimate: state => commitBuilderCost(state, { ...line("groceries:food", ["groceries"], estimate.unitAmount), baselineKey: "groceries", priceSource: "LAST_KNOWN", priceSourceLabel: estimate.sourceLabel }) });
assert.equal(groceries.draft.costItems[0].baselineKey, "groceries");
const party = await golden("PrivatePartyLucas", "outing", "bar", { partyKind: "house_party", participants: "BOTH", host: "lucas", occasion: "NONE", date: null, transport: "FREE", costMode: "LATER", addons: "DONE" });
assert.equal(party.draft.context.place.placeId, lucas.places[0].placeId); assert(!traces.PrivatePartyLucas.includes("entity"));
const visit = await golden("VisitFontes", "visit_trip", "friend_visit", { participants: "BOTH", contact: marc.key, format: "SIMPLE", occasion: "NONE", date: { date: "2026-10-16", endDate: "2026-10-16", moment: "NONE", returnMoment: "NONE" }, transport: "CAR", transportDetails: "DONE", costMode: "LATER" }, { transportDetails: timedCar });
assert.equal(visit.draft.context.place.placeId, marc.places[0].placeId); assert(!traces.VisitFontes.includes("entity"));
const cinemaSubtype = inferredActivitySubtype({ types: ["movie_theater"] }); assert.equal(cinemaSubtype, "cinema");
const activity = await golden("ActivityCinema", "activity", "other_activity", { entity: { label: "Pathé Odysseum", subtype: cinemaSubtype }, participants: "BOTH", date: null, transport: "FREE", costMode: "TOTAL", costTotal: "24.00", addons: "DONE" });
assert.equal(activity.draft.subtypeKey, "cinema");
const purchase = await golden("OnlinePurchase", "purchase", "other_purchase", { entity: { label: "Mascara", subtype: "beauty" }, participants: manon, date: null, channel: "DELIVERY", seller: { label: "Boutique choisie" }, costMode: "TOTAL", costTotal: "12.00", addons: "DONE" });
assert.equal(purchase.draft.context.seller, "Boutique choisie"); assert.notEqual(purchase.draft.context.seller, purchase.draft.context.project.entity.label);
assert(!traces.OnlinePurchase.includes("transport")); assert(!purchase.state.suspended.length, "initial subtype deduction is not a destructive root reset");
const trip = await golden("AnnecyStay", "visit_trip", "trip_stay", { tripKind: "STAY", entity: { label: "Annecy" }, date: { date: "2026-11-06", endDate: "2026-11-08" }, participants: "BOTH", transport: "LATER", lodging: "RELATIVE", costMode: "LATER", addons: "DONE" });
assert.equal(projectNights(trip.draft), 2);

// Partial transport/lodging prices keep known facts; pricing repairs only the matching component.
const deferredToll = deferProjectTransportPrice(visit.state, "Péages");
assert(deferredToll.draft.costItems.some(i => i.assetKey === "transport:fuel_usage"));
assert(deferredToll.draft.context.project.unpricedComponents.includes("Péages"));
const pricedToll = commitBuilderCost(deferredToll, line("transport:toll", ["visit"], "5.00"));
assert(!pricedToll.draft.context.project.unpricedComponents.includes("Péages"));
assert(pricedToll.draft.context.project.unpricedComponents.includes("Budget principal"));
let lodging = applyProjectAnswer(trip.state, "lodging", "HOTEL", env);
lodging = commitBuilderCost(lodging, line("trip:hotel", ["trip"], "90.00", "2"));
assert(!lodging.draft.context.project.unpricedComponents.includes("Hébergement"));
const relative = applyProjectAnswer(lodging, "lodging", "RELATIVE", env);
assert(!relative.draft.costItems.some(i => i.assetKey === "trip:hotel"));
assert(relative.suspended.some(s => s.path.startsWith("cost.")));
assert.equal(undoBuilderChange(relative).draft.costItems.filter(i => i.assetKey === "trip:hotel").length, 1);
const journey = require("../src/domain/phase2/planned-visits.ts").plannedJourneyTiming(trip.draft);
assert.equal(journey.outbound.date, "2026-11-06"); assert.equal(journey.return.date, "2026-11-08");
assert.equal(materializeBuilderDraft(applyProjectAnswer(lodging, "costMode", "FREE", env)).costItems.find(i => i.assetKey === "trip:hotel").unitAmount, "90.00", "principal budget never removes lodging");
let overnight = applyProjectAnswer(activity.state, "date", { date: "2026-10-16", endDate: "2026-10-18" }, env);
overnight = applyProjectAnswer(overnight, "lodging", "HOTEL", env);
overnight = commitBuilderCost(overnight, line("trip:hotel", ["activity"], "75.00", "2"));
parsePlannedExpenseDraft(materializeBuilderDraft(overnight), "2026-10");
const dayOnly = applyProjectAnswer(overnight, "date", "2026-10-16", env);
assert.equal(dayOnly.draft.context.project.lodging, undefined); assert(dayOnly.suspended.some(i => i.path.startsWith("cost.")));
const eventDraft = { ...party.draft, subtypeKey: "club_festival", plannedDate: "2026-10-16", context: { project: { version: 2, entity: { kind: "EVENT", label: "Festival explicite" } }, outingKind: "EVENT", place: { kind: "TEXT", label: "Lieu de l’événement", provenance: "USER_DECLARED_PROSPECTIVE" }, endDate: "2026-10-18" } };
const events = require("../src/domain/phase2/planned-project-entities.ts").projectEventCandidates([{ id: randomUUID(), status: "PLANNED", draft: eventDraft }], "Festival");
assert.equal(events.length, 1);
const chosenEvent = applyProjectAnswer(initialize("activity", "other_activity"), "entity", { kind: "EVENT", label: "Festival explicite", date: "2026-10-16", endDate: "2026-10-18" }, env);
const googleActivity = applyProjectAnswer(initialize("activity", "other_activity"), "entity", { label: "Cinéma fixture", googlePlaceId: "ChIJactivity_fixture", city: "Ville fixture", address: "Adresse externe non persistée", subtype: "cinema" }, env);
assert(!JSON.stringify(googleActivity.draft).includes("Adresse externe non persistée"));
assert.deepEqual(require("../src/domain/phase2/planned-project.ts").projectGoogleDestination(googleActivity.draft), { placeId: "ChIJactivity_fixture", kind: "ACTIVITY" });
const googleSeller = applyProjectAnswer(purchase.state, "seller", { label: "Vendeur fixture", googlePlaceId: "ChIJseller_fixture", address: "Adresse vendeur externe non persistée" }, env);
assert(!JSON.stringify(googleSeller.draft).includes("Adresse vendeur externe non persistée"));
assert.deepEqual(require("../src/domain/phase2/planned-project.ts").projectGoogleDestination(googleSeller.draft), { placeId: "ChIJseller_fixture", kind: "RETAIL" });
assert(!require("../src/domain/phase2/planned-question-engine.ts").visibleProjectQuestions({ draft: chosenEvent.draft, env, intent: "activity", session: answerWizard(emptyWizardSession(), "entity", { date: "2026-10-16" }) }).some(q => q.id === "date"));

// Upstream edits retain independent decisions and suspend only incompatible explicit fees/routes.
let delivery = commitBuilderCost(fast.state, line("fast_food:delivery_fee", ["fast_food"], "3.00"), false);
delivery = applyProjectAnswer(delivery, "channel", "PICKUP", env);
assert(!delivery.draft.costItems.some(c => c.assetKey === "fast_food:delivery_fee"));
assert(delivery.suspended.some(s => s.path.startsWith("cost.")));
assert.equal(delivery.draft.context.project.entity.label, fast.draft.context.project.entity.label);
assert.deepEqual(delivery.draft.context.participantPersonIds, fast.draft.context.participantPersonIds);
assert.equal(deriveBuilderReadiness(delivery).saveReady, false);
assert.equal(undoBuilderChange(delivery).draft.context.purchaseMode, "DELIVERY");
assert.equal(undoBuilderChange(delivery).draft.costItems.filter(c => c.assetKey === "fast_food:delivery_fee").length, 1);
let history = answerWizard(answerWizard(emptyWizardSession(), "entity", { label: "A" }), "date", null);
assert.equal(backWizard(history).current, "date");
history = answerWizard(history, "entity", { label: "B" }); assert.equal(history.answers.date, null);
assert.equal(nextUsefulQuestion({ draft: purchase.draft, env, intent: "purchase", session: jumpWizard(emptyWizardSession(), "costMode") }).id, "costMode");
let edits = answerWizard(jumpWizard(emptyWizardSession(), "costMode"), "costMode", "TOTAL");
assert.equal(nextUsefulQuestion({ draft: purchase.draft, env, intent: "purchase", session: edits }).id, "costTotal");
edits = answerWizard(edits, "costTotal", "13.00"); assert.equal(nextUsefulQuestion({ draft: purchase.draft, env, intent: "purchase", session: edits }).id, "review");

let quick = setQuickTotal(initialize("food", "restaurant"), "60.00"); quick = sync(quick);
let split = splitRestaurantQuickTotal(quick, "45.00"); assert.equal(draftSummary(materializeBuilderDraft(split).costItems).gross, "60.00");
const meal = split.draft.costItems.find(c => c.assetKey === "restaurant:meal_total");
split = commitBuilderCost(split, { ...meal, unitAmount: "50.00" }); assert.equal(draftSummary(materializeBuilderDraft(split).costItems).gross, "65.00");
const own = { ...party.draft, context: { ...party.draft.context, housePartyPlaceMode: "OWN_HOME", host: undefined, place: { kind: "KNOWN", placeId: homeId }, transportMode: undefined } };
const linkEnv = { ...env, linkedProjects: [{ id: randomUUID(), draft: own, status: "PLANNED" }] };
const linked = applyProjectAnswer(groceries.state, "link", linkEnv.linkedProjects[0].id, linkEnv);
assert.equal(linked.draft.context.project.shareTransport, true); assert.deepEqual(linked.draft.costItems, groceries.state.draft.costItems);
assert.equal(applyProjectAnswer(linked, "link", "NONE", linkEnv).draft.context.project.linkedProjectId, undefined);

assert.throws(() => parsePlannedProject({ version: 2, knowledge: {} }), /PROJECT_INVALID/);
assert.throws(() => parsePlannedProject({ version: 2, financialScope: { count: 1, personIds: [adrien, manon] } }), /PROJECT_INVALID/);
assert.throws(() => parsePlannedProject({ version: 2, shareTransport: true }), /PROJECT_INVALID/);
assert.throws(() => parsePlannedProject({ version: 2, unpricedComponents: [""] }), /PROJECT_INVALID/);
assert.throws(() => parsePlannedExpenseDraft({ ...purchase.draft, context: { ...purchase.draft.context, project: { ...purchase.draft.context.project, entity: { kind: "PRODUCT", label: "Mascara" } }, place: { kind: "TEXT", label: "Mascara" } } }, "2026-10"), /PROJECT_INVALID|PLACE_FORBIDDEN/);
const likely = wizardKnowledge({ draft: { ...visit.draft, context: { ...visit.draft.context, transportMode: undefined } }, session: emptyWizardSession(), env, intent: "visit" });
assert.equal(likely.transport.state, "LIKELY");
assert.equal(PROJECT_QUESTIONS.find(q => q.id === "channel").advanceMode, "AUTO");
assert.equal(PROJECT_QUESTIONS.find(q => q.id === "costTotal").advanceMode, "EXPLICIT");
// Root scenarios are computed by the existing canonical engine; a draft creates no DB operation.
const draft = fast.draft;
const preview = simulatePlannedExpenseScenario(forecast, inputs, [], { id: randomUUID(), targetMonth: "2026-10", status: "PLANNED", costItems: draft.costItems, context: draft.context }, "2026-10-01");
assert(preview.economicPlan);
const unknown = materializeBuilderDraft(applyProjectAnswer(initialize("food", "restaurant"), "costMode", "LATER", env));
assert.equal(unknown.costItems.length, 0); assert.deepEqual(unknown.context.project.unpricedComponents, ["Budget principal"]);
const serverCode = readFileSync("src/server/phase2/planned-expenses.ts", "utf8");
assert(!/\.from\("(?:operations|life_events|mobility_legs|financial_economic_cost_canonical)"\)\.(?:insert|update|upsert|delete)/u.test(serverCode));

// Real Preview/Save/Update/reload/lifecycle boundaries, only I/O replaced by synthetic fixtures.
const h = planningHarness();
h.client.persons.push(...env.persons.map(p => ({ person_id: p.personId, display_name: p.displayName, status: "active", household_id: h.householdId })));
const rangeCandidate = { ...trip.draft, plannedDate: "2026-10-02", context: { ...trip.draft.context, endDate: "2026-10-04",
  project: { ...trip.draft.context.project, moment: "EVENING", returnMoment: "NONE" } } };
for (const candidate of [fast.draft, work.draft, purchase.draft, rangeCandidate]) {
  const count = h.client.writes.length, p = value(await h.actions.previewPlannedExpense("2026-10", candidate));
  assert.equal(h.client.writes.length, count, "Preview never writes");
  const saved = value(await h.actions.savePlannedExpense("2026-10", candidate, { id: randomUUID() }));
  const before = require("../src/server/phase2/month-scenario.ts").deriveMonthScenario(h.forecast, h.facts.inputs["2026-10"], null, new Date().toISOString().slice(0, 10),
    (await h.service.readPlannedExpenses(h.client, h.householdId, "2026-10")).filter(i => i.id !== saved.expense.id)).economicPlan;
  const impact = require("../src/server/phase2/planned-impact.ts").projectPlannedExpenseImpact(before, saved.scenario.economicPlan, saved.expense);
  for (const axis of ["grossCost", "fuelUsage", "payableGross", "netAdditionalImpact", "funding"]) assert.deepEqual(impact[axis], p[axis], `V2 parity ${axis}`);
  const reloaded = (await h.service.readPlannedExpenses(h.client, h.householdId, "2026-10")).find(i => i.id === saved.expense.id);
  assert.deepEqual(reloaded.context, saved.expense.context);
  assert.equal(reloaded.plannedDate, saved.expense.plannedDate);
}

// V2.2: social participation is intent, never a quantity/funding multiplier.
const group = await golden("RestaurantGroup", "food", "restaurant", { participants: "GROUP", socialParticipants: { personIds: [adrien, manon], contactKeys: [lucas.key], guests: 2 },
  date: { date: "2026-10-10", moment: "EVENING" }, occasion: "NONE", entity: { label: "Comptoir choisi", address: "Montpellier" }, transport: "FREE", costMode: "TOTAL", costTotal: "60.00" });
assert.equal(require("../src/domain/phase2/planned-product.ts").plannedParticipantCount(group.draft.context), 5);
assert.equal(group.draft.context.project.financialScope.count, 2);
assert.equal(draftSummary(group.draft.costItems).gross, "60.00");
assert(!traces.RestaurantGroup.includes("moment") && !traces.RestaurantGroup.includes("addons") && !traces.RestaurantGroup.includes("groupScope"));
assert.equal(require("../src/domain/phase2/planned-question-engine.ts").wizardHasPreviousUserDecision(emptyWizardSession()), false);
assert.equal(require("../src/domain/phase2/planned-question-engine.ts").wizardHasPreviousUserDecision({ ...emptyWizardSession(), intentChosen: true }), true);
let dates = answerWizard(answerWizard(emptyWizardSession(), "participants", "BOTH"), "date", { date: "2026-10-10", moment: "EVENING" });
assert.equal(backWizard(dates).current, "date"); assert.equal(backWizard(backWizard(dates)).current, "participants");
const isabelle = SOCIAL_CONTACTS_V1.find(c => c.label.includes("Isabelle"));
let servian = applyProjectAnswer(applyProjectAnswer(initialize("visit_trip", "friend_visit"), "participants", "BOTH", env), "contact", isabelle.key, env);
servian = applyProjectAnswer(servian, "date", { date: "2026-10-02", endDate: "2026-10-04", moment: "EVENING", returnMoment: "NONE" }, env);
servian = applyProjectAnswer(servian, "costMode", "LATER", env);
assert.equal(servian.draft.context.visitTiming.return.date, "2026-10-04");
assert.equal(require("../src/domain/phase2/planned-visits.ts").plannedJourneyTiming(servian.draft).return.date, "2026-10-04");
const dateSelector = require("../src/domain/phase2/planned-dates.ts");
assert.equal(dateSelector.getPlannedExpenseDateRange(servian.draft).isRange, true);
assert.equal(dateSelector.getPlannedExpenseDateRange({ ...servian.draft, context: { ...servian.draft.context, endDate: undefined } }).endDate, "2026-10-04", "old rows remain ranges");
assert.deepEqual(parsePlannedExpenseDraft(servian.draft, "2026-10", "PREVIEW"), parsePlannedExpenseDraft(servian.draft, "2026-10"));
assert.throws(() => parsePlannedExpenseDraft({ ...servian.draft, context: { ...servian.draft.context, endDate: "2026-10-05" } }, "2026-10"), /PROJECT_INVALID/);
assert.throws(() => parsePlannedProject({ version: 2, returnMoment: "EXACT" }), /PROJECT_INVALID/);
assert.equal(applyProjectAnswer(servian, "date", null, env).draft.context.visitTiming, undefined);
const crossingProject = { ...rangeCandidate, plannedDate: "2026-10-30", context: { ...rangeCandidate.context, endDate: "2026-11-03" } };
const crossingSaved = value(await h.actions.savePlannedExpense("2026-10", crossingProject, { id: randomUUID() })).expense;
const readOnlyCount = h.client.writes.length;
assert.deepEqual((await h.service.readPlannedCalendarCarryovers(h.client, h.householdId, "2026-11")).map(p => p.id), [crossingSaved.id]);
assert.equal((await h.service.readPlannedExpenses(h.client, h.householdId, "2026-11")).length, 0, "continuation never becomes a November expense");
assert.equal((await h.service.readPlannedCalendarCarryovers(h.client, randomUUID(), "2026-11")).length, 0, "carryover references remain household scoped");
assert.equal(h.client.writes.length, readOnlyCount);
const partial = { ...fast.draft, costItems: [], context: { ...fast.draft.context, project: { ...fast.draft.context.project, unpricedComponents: ["Budget principal"] } } };
const partialSaved = value(await h.actions.savePlannedExpense("2026-10", partial, { id: randomUUID() })).expense;
const updatedPartial = value(await h.actions.savePlannedExpense("2026-10", { ...partial, title: "Budget à compléter" }, { id: partialSaved.id, expectedUpdatedAt: partialSaved.updatedAt })).expense;
const writesBeforeDeclaration = h.client.writes.length;
await assert.rejects(() => h.service.declarePlannedExpense(h.client, h.householdId, updatedPartial.id, h.userId, partial, updatedPartial.updatedAt, async () => {}), /PLANNED_REALITY_BUDGET_UNKNOWN/);
assert.equal(h.client.writes.length, writesBeforeDeclaration);
const foreignPerson = { ...purchase.draft, context: { ...purchase.draft.context, project: { ...purchase.draft.context.project, financialScope: { personIds: [randomUUID()], count: 1 } } } };
assert.equal((await h.actions.savePlannedExpense("2026-10", foreignPerson, { id: randomUUID() })).ok, false);
const foreignLink = { ...purchase.draft, context: { ...purchase.draft.context, project: { ...purchase.draft.context.project, linkedProjectId: randomUUID(), shareTransport: true } } };
assert.equal((await h.actions.savePlannedExpense("2026-10", foreignLink, { id: randomUUID() })).ok, false);
assert.equal(h.client.writes.length, writesBeforeDeclaration, "invalid live refs zero write");
const canonical = require("../src/server/canonical/client.ts");
const originalCanonicalClient = canonical.createCanonicalReadClient;
let owner = randomUUID();
canonical.createCanonicalReadClient = () => ({ from(table) { if (table !== "benefit_wallets") return originalCanonicalClient().from(table); return {
  select() { return this; }, eq() { return this; }, then(resolve, reject) { return Promise.resolve({ data: [{ provider: "SWILE", owner_person_id: owner, status: "ACTIVE" }], error: null }).then(resolve, reject); }
}; } });
const funded = { ...fast.draft, costItems: fast.draft.costItems.map(i => ({ ...i, assetKey: "fast_food:meal_total", fundingAllocations: [{ source: "SWILE", amount: "25.00" }] })) };
assert.equal((await h.actions.savePlannedExpense("2026-10", funded, { id: randomUUID() })).issue.code, "PLANNED_PROJECT_WALLET_OWNER_INVALID", "foreign wallet owner rejected");
assert.equal(h.client.writes.length, writesBeforeDeclaration);
owner = adrien;
value(await h.actions.savePlannedExpense("2026-10", funded, { id: randomUUID() }));
assert(h.client.writes.every(w => w.table === "phase2_planned_expenses"));
console.log(JSON.stringify({ questionEngine: "PASS", nineGoldenTraces: traces, dependencyInvalidation: "PASS", decisionBack: "PASS", summaryEdit: "PASS", split60to65: "PASS", explicitLink: "PASS", negativePayloads: "PASS", structuralPreviewSaveParity: "PASS", serverPreviewSaveReload: "PASS", unknownBudgetLifecycle: "PASS", crossHouseholdRefs: "PASS", partialPriceRepairUndo: "PASS", historicalWrites: 0 }));
