import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
import { randomUUID } from "node:crypto";
import { planningHarness, value, item } from "./lib/planned-actions-harness.mjs";
import { expenseDraft } from "./lib/planned-expense-memory-client.mjs";
const require = createRequire(import.meta.url);
const product = require("../src/domain/phase2/planned-product.ts");
const b = require("../src/domain/phase2/planned-builder.ts");
const rules = require("../src/domain/phase2/planned-rules.ts");
const assets = require("../src/domain/phase2/planned-assets.ts");
const { rankPlacesForPlannedContext } = require("../src/domain/phase2/planned-places.ts");
const { derivePlannedPlaceRoles } = require("../src/domain/phase2/planned-place-rules.ts");
const h = planningHarness();
const results = [];
function check(name, work) { work(); results.push({ name, status: "PASS" }); }
const draft = (familyKey, subtypeKey, context = {}, costItems = []) => ({ familyKey, subtypeKey, context,
  title: "Projet synthétique", plannedDate: "2026-10-15", costItems });
const quick = (family = "food", subtype = "restaurant", context = {}, amount = "50.00") =>
  b.setQuickBaseline(b.setQuickTotal(b.createBuilderState(draft(family, subtype, context)), amount), null);
const line = (key, path, amount = "10.00") => ({ ...item(amount, key, path), label: assets.plannedAsset(key)?.label ?? "Total" });
const place = (name, subtype, usage = "Courses", nature = "Commerce") => ({ placeId: randomUUID(), name,
  subtype, usage, nature, privatePlace: false, commune: null, relationships: [] });
const mcdo = place("McDonald’s", "Restauration", "Restaurant", "Restaurant / bar");
const bk = place("Burger King Odysseum", "Restauration", "Restaurant", "Restaurant / bar");
const thai = place("Thai to Box", "Restaurant / à emporter", "Restaurant", "Restaurant / bar");
const classic = place("Restaurant synthétique", "Restaurant", "Restaurant", "Restaurant / bar");
const supermarket = place("Supermarché synthétique", "Supermarché");
const barber = place("Dali Barber", "Coiffeur / barber", "Soins personnels");
const dbha = place("DBHA Coiff", "Coiffeur / barber", "Soins personnels");
const pharmacy = place("Pharmacie synthétique", "Pharmacie", "Santé");
const cosmetic = place("Cosmétiques synthétiques", "Cosmétique", "Beauté");
const club = place("Club synthétique", "Boîte de nuit / club", "Bar / soirée", "Lieu de loisirs");
const bar = place("Bar synthétique", "Bar", "Bar", "Restaurant / bar");
const allPlaces = [mcdo, bk, thai, classic, supermarket, barber, dbha, pharmacy, cosmetic, club, bar];
const resolved = (familyKey, subtypeKey, modifiers) => rules.resolvePlannedContext({ familyKey, subtypeKey, modifiers });
const ids = (rows) => rows.map((row) => row.place.placeId);

check("INTENT: direct restaurant and complete context reachability", () => {
  assert.deepEqual(product.PLANNED_INTENTS.find((intent) => intent.label === "Restaurant"), { label: "Restaurant", family: "food", subtype: "restaurant" });
  assert.deepEqual(product.PLANNED_INTENTS.find((intent) => intent.label === "Voir quelqu’un").choices, ["family_visit", "friend_visit"]);
  for (const context of rules.CONTEXT_REGISTRY) assert(product.PLANNED_INTENTS.some((intent) => intent.family === context.familyKey
    && (intent.subtype === context.subtypeKey || intent.subtype === null && (!intent.choices || intent.choices.includes(context.subtypeKey)))));
});
check("PLACES: specific roles before broad metadata", () => {
  assert.deepEqual(ids(rankPlacesForPlannedContext(allPlaces, resolved("food", "fast_food"), {})).sort(), [mcdo, bk, thai].map((p) => p.placeId).sort());
  assert.deepEqual(ids(rankPlacesForPlannedContext(allPlaces, resolved("food", "restaurant"))), [classic.placeId]);
  assert(!derivePlannedPlaceRoles(club).includes("BAR")); assert(derivePlannedPlaceRoles(club).includes("NIGHT_OUT"));
  assert(!ids(rankPlacesForPlannedContext(allPlaces, resolved("outing", "bar"))).includes(club.placeId));
});
check("PLACES: asset-aware beauty, gifts and household", () => {
  const beauty = resolved("purchase", "beauty");
  assert(!ids(rankPlacesForPlannedContext(allPlaces, beauty, { assetKeys: ["beauty:mascara"] })).includes(barber.placeId));
  assert.deepEqual(ids(rankPlacesForPlannedContext(allPlaces, beauty, { assetKeys: ["beauty:hairdresser"] })).sort(), [barber.placeId, dbha.placeId].sort());
  assert(ids(rankPlacesForPlannedContext(allPlaces, beauty, { assetKeys: ["beauty:shampoo"] })).includes(supermarket.placeId));
  assert(ids(rankPlacesForPlannedContext(allPlaces, resolved("purchase", "household"))).includes(supermarket.placeId));
  assert(ids(rankPlacesForPlannedContext(allPlaces, resolved("purchase", "gift"), { giftAssetKey: "gift:chocolate" })).includes(supermarket.placeId));
  assert.equal(rankPlacesForPlannedContext(allPlaces, resolved("activity", "cinema")).length, 0);
  assert(!ids(rankPlacesForPlannedContext(allPlaces, resolved("activity", "other_activity"))).includes(club.placeId));
});
check("QUICK: restaurant 50 + root transport, no forced detail and no double counting", () => {
  const initial = quick(); const state = b.editBuilderDraft(initial, { ...initial.draft, costItems: [line("transport:uber", ["restaurant"], "18.00")] });
  const materialized = b.materializeBuilderDraft(state); assert.equal(state.costMode, "QUICK_TOTAL");
  assert.equal(materialized.costItems.length, 2); assert.equal(b.deriveBuilderReadiness(state).saveReady, true);
  assert.equal(materialized.costItems.reduce((sum, part) => sum + Number(part.unitAmount), 0), 68);
  assert.equal(h.service.parsePlannedExpenseDraft(materialized, "2026-10").costItems[1].baselineKey, null);
  const split = b.splitRestaurantQuickTotal({ ...state, quickTotal: "60.00" }, "45.00");
  assert.equal(b.materializeBuilderDraft(split).costItems.reduce((sum, part) => sum + Number(part.unitAmount), 0), 78);
  assert.equal(split.draft.costItems.filter((part) => part.assetKey === null).length, 0);
  assert.equal(b.undoBuilderChange(split).quickTotal, "60.00");
  const forged = { ...state, draft: { ...state.draft, costItems: [...state.draft.costItems, line("restaurant:main", ["restaurant"])] } };
  assert.equal(b.deriveBuilderReadiness(forged).previewReady, false);
});
check("QUICK: atomic replacement and Undo preserve the user's total", () => {
  const detailed = b.itemizeBuilderCosts(quick());
  const replacement = b.replaceBuilderAggregate(detailed, line("restaurant:main", ["restaurant"], "45.00"));
  assert.equal(replacement.draft.costItems.length, 1); assert.equal(replacement.draft.costItems[0].assetKey, "restaurant:main");
  assert.equal(b.undoBuilderChange(replacement).draft.costItems[0].unitAmount, "50.00");
});
check("CONTACTS: host auto-place, text places, real participants and manual quantities", () => {
  const own = quick("outing", "house_party", { housePartyPlaceMode: "OTHER_HOME" });
  const hosted = b.changeBuilderContext(own, { ...own.draft.context, host: { kind: "CONTACT", contactKey: "lucas" } });
  assert.equal(hosted.draft.context.place.placeId, rules.SOCIAL_CONTACTS_V1.find((contact) => contact.key === "lucas").places[0].placeId);
  assert.equal(b.deriveBuilderReadiness(own).saveReady, false);
  const greg = b.changeBuilderContext(quick("visit_trip", "friend_visit"), { personVisited: { kind: "CONTACT", contactKey: "greg" } });
  assert.equal(greg.draft.context.place.label, "Saint-Jean-de-Védas");
  const father = b.changeBuilderContext(quick("visit_trip", "family_visit"), { personVisited: { kind: "CONTACT", contactKey: "adrien_father" } });
  assert.equal(father.draft.context.place.label, "Servian");
  const ids = [randomUUID(), randomUUID()], ref = { kind: "CONTACT", contactKey: "lucas" };
  const context = { participantPersonIds: ids, participantRefs: [ref, { kind: "TEXT", label: "Invitée synthétique" }],
    host: ref, hostParticipates: true, additionalGuestCount: 1 };
  assert.equal(product.plannedParticipantCount(context), 5, "host selected as contact counted once");
  const cost = line("club:ticket", ["club"]);
  let state = b.createBuilderState(draft("outing", "club_festival", {}, [cost]));
  state.origins[`quantity.${cost.id}`] = "AUTO_DERIVED";
  state = b.changeBuilderContext(state, { participantPersonIds: ids, participantRefs: [ref] });
  assert.equal(state.draft.costItems[0].quantity, "3");
  state.origins[`quantity.${cost.id}`] = "EXPLICIT";
  assert.equal(b.changeBuilderContext(state, { participantPersonIds: ids }).draft.costItems[0].quantity, "3");
});
check("ADDONS: BringItems and prefilled gift independent of Quick Total", () => {
  for (const visitFormat of Object.keys(rules.BRING_ITEMS_LENS)) {
    const context = { visitFormat, personVisited: { kind: "CONTACT", contactKey: "lucas" } };
    const lens = product.builderAssetChoices(resolved("visit_trip", "friend_visit", context), "visit_friend", context, "BRING_ITEMS");
    assert.deepEqual(lens.map((asset) => asset.assetKey), rules.BRING_ITEMS_LENS[visitFormat]);
  }
  const state = b.acceptBuilderChild(quick("visit_trip", "friend_visit", { personVisited: { kind: "CONTACT", contactKey: "lucas" }, socialOccasion: "BIRTHDAY" }), "gift");
  const brought = b.replaceBuilderAggregate(state, line("visit_friend:brought_food", ["visit_friend"]));
  assert.equal(brought.costMode, "QUICK_TOTAL"); assert.equal(b.materializeBuilderDraft(brought).costItems.length, 2);
  assert.equal(state.draft.context.gift.recipient, "Lucas"); assert.equal(state.costMode, "QUICK_TOTAL"); assert.equal(state.draft.costItems.length, 0);
});
check("DELIVERY: provider fees blank, seller independent, takeaway no fees", () => {
  assert(rules.deliveryFeeSuggestions("UBER_EATS").every((fee) => fee.amount === null));
  assert.equal(product.builderAssetChoices(resolved("food", "fast_food", { purchaseMode: "TAKEAWAY" }), "fast_food", { purchaseMode: "TAKEAWAY" }).filter((asset) => /fee/u.test(asset.assetKey)).length, 0);
  const context = { purchaseMode: "DELIVERY", deliveryProviderKey: "UBER_EATS", deliveryProvider: "Uber Eats", seller: "McDonald’s" };
  assert.equal(resolved("food", "fast_food", context).transport, "FORBIDDEN");
  const payload = draft("food", "fast_food", context, [line("fast_food:burger", ["fast_food"])]);
  assert.equal(h.service.parsePlannedExpenseDraft(payload, "2026-10").context.seller, "McDonald’s");
});
check("ASSETS/FUNDING: root transport only, meal/nonalcohol semantics, proper fallbacks", () => {
  for (const [family, subtype] of [["food", "restaurant"], ["outing", "bar"], ["outing", "club_festival"]]) {
    const r = resolved(family, subtype);
    assert(product.builderAssetChoices(r, r.rootModule, {}).every((asset) => !product.LEGACY_TRANSPORT_ASSETS.includes(asset.assetKey)));
  }
  for (const [family, subtype] of [["outing", "other_outing"], ["purchase", "other_purchase"]]) {
    const r = resolved(family, subtype); assert.equal(product.builderAssetChoices(r, "other", {}).length, 0); assert(r.children.length);
  }
  for (const key of ["house_party:crazy_tiger", "house_party:mixer", "club:soft", "club:water", "bar:tapas", "groceries:drinks"]) assert.equal(assets.plannedAsset(key).fundingEligibility, "MEAL");
  for (const key of ["house_party:vodka", "restaurant:beer", "gift:chocolate", "transport:uber", "household:laundry"]) assert.equal(assets.plannedAsset(key).fundingEligibility, "BANK");
});
check("READINESS: stage-specific cost blockers and explicit place repair", () => {
  const state = b.createBuilderState(draft("food", "restaurant"));
  assert.equal(b.builderIssuesForStep(state, 3).length, 0); assert(b.builderIssuesForStep(state, 4).some((issue) => issue.code === "COST_REQUIRED"));
  const bad = b.createBuilderState(draft("purchase", "beauty", { place: { kind: "KNOWN", placeId: barber.placeId } }, [line("beauty:mascara", ["beauty"])]));
  assert.equal(b.deriveBuilderReadiness(bad, { places: allPlaces }).saveReady, false); assert.equal(bad.draft.context.place.placeId, barber.placeId);
});
check("NEGATIVE: invalid contacts, host boundary, free transport costs, wallet alcohol", () => {
  const parse = (payload) => h.service.parsePlannedExpenseDraft(payload, "2026-10");
  assert.throws(() => parse(draft("food", "restaurant", { participantRefs: [{ kind: "CONTACT", contactKey: "imaginary" }] }, [line("restaurant:main", ["restaurant"])])), /CONTACT_INVALID/u);
  assert.throws(() => parse(draft("food", "restaurant", { host: { kind: "CONTACT", contactKey: "lucas" } }, [line("restaurant:main", ["restaurant"])])), /HOST_FORBIDDEN/u);
  assert.throws(() => parse(draft("food", "restaurant", { transportMode: "FREE" }, [line("transport:uber", ["restaurant"])])), /FREE_COST_INVALID/u);
  assert.throws(() => parse(draft("food", "restaurant", {}, [{ ...line("restaurant:beer", ["restaurant"]), fundingAllocations: [{ source: "SWILE", amount: "10.00" }] }])), /FUNDING/u);
});

// Exercise real actions and readbacks with synthetic transport only, including new reference types.
const householdPeople = ["Adrien", "Manon"].map((display_name) => ({ person_id: randomUUID(), display_name, status: "active", household_id: h.householdId }));
h.client.persons.push(...householdPeople);
h.facts.places = allPlaces;
const transportQuick = b.editBuilderDraft(quick("food", "restaurant", { participantPersonIds: householdPeople.map((p) => p.person_id),
  participantRefs: [{ kind: "CONTACT", contactKey: "lucas" }], transportMode: "TAXI" }), { ...quick().draft,
  context: { participantPersonIds: householdPeople.map((p) => p.person_id), participantRefs: [{ kind: "CONTACT", contactKey: "lucas" }], transportMode: "TAXI" }, costItems: [line("transport:uber", ["restaurant"], "18.00")] });
const payload = b.materializeBuilderDraft(transportQuick);
const writesBefore = h.client.writes.length;
const preview = value(await h.actions.previewPlannedExpense("2026-10", payload));
assert.equal(h.client.writes.length, writesBefore); assert.equal(preview.grossCost, "68.00"); assert.equal(preview.projectPayment.bank, "68.00");
const saved = value(await h.actions.savePlannedExpense("2026-10", payload, { id: randomUUID() }));
assert.deepEqual(saved.scenario.economicPlan.scenarios, preview.after);
const rows = await h.service.readPlannedExpenses(h.client, h.householdId, "2026-10");
assert.deepEqual(expenseDraft(rows[0]).context.participantRefs, payload.context.participantRefs);
const foreign = randomUUID(); h.client.persons.push({ person_id: foreign, display_name: "Foreign", status: "active", household_id: randomUUID() });
for (const field of ["participantRefs", "host"]) {
  const hostile = field === "host" ? draft("outing", "house_party", { housePartyPlaceMode: "OTHER_HOME", host: { kind: "HOUSEHOLD_PERSON", personId: foreign }, place: { kind: "TEXT", label: "Lieu synthétique" } }, [line(null, ["house_party"])])
    : { ...payload, context: { ...payload.context, participantRefs: [{ kind: "HOUSEHOLD_PERSON", personId: foreign }] } };
  const rejected = await h.actions.savePlannedExpense("2026-10", hostile, { id: randomUUID() });
  assert.equal(rejected.ok, false); assert.equal(rejected.issue.code, "PLANNED_EXPENSE_PERSON_NOT_IN_HOUSEHOLD");
}
assert(h.client.writes.every((write) => write.table === "phase2_planned_expenses"));
results.push({ name: "SERVER: new refs, cross-household rejects, Preview zero-write, Save/reload parity", status: "PASS" });
const control = fs.readFileSync("src/app/mois-a-venir/planned-expenses-control.tsx", "utf8");
assert(!control.includes(".div(2)")); assert(control.includes('setSplitMeal("")'));
assert(control.includes("✓ Ajouté")); assert(control.includes("PlannedParticipants"));
const calendar = fs.readFileSync("src/app/mois-a-venir/month-calendar.tsx", "utf8");
assert(calendar.includes("h-[74px]")); assert(!calendar.includes("h-40")); assert(calendar.includes("/brands/"));
for (const key of ["sfr", "edf", "google", "openai", "max", "pacifica", "credit-agricole", "nexity"]) assert(fs.existsSync(`public/brands/${key}.svg`));
results.push({ name: "UI boundaries: explicit mixed inputs, reset, feedback, compact calendar and local marks", status: "PASS" });
console.log(JSON.stringify({ POST_V1_FIX_PACK: "PASS", checks: results }, null, 2));
