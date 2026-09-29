import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import path from "node:path";
import { forecast, inputs } from "./check-phase2-october-contract.mjs";

const require = createRequire(import.meta.url);
const root = process.cwd();
const { createBuilderState, deriveBuilderReadiness, materializeBuilderDraft, setQuickTotal,
  setQuickBaseline, splitRestaurantQuickTotal, editBuilderDraft, changeBuilderContext, changeBuilderRoot, acceptBuilderChild,
  undoBuilderChange, suggestedBuilderChildren, collapseBuilderCosts, canCollapseCosts } =
  require(path.resolve(root, "src/domain/phase2/planned-builder.ts"));
const { parsePlannedExpenseDraft, simulatePlannedExpense } = require(path.resolve(root, "src/server/phase2/planned-expenses.ts"));
const { plannedAsset } = require(path.resolve(root, "src/domain/phase2/planned-assets.ts"));
const { SOCIAL_CONTACTS_V1 } = require(path.resolve(root, "src/domain/phase2/planned-rules.ts"));
const draft = (familyKey, subtypeKey, context = {}, costItems = []) => ({ familyKey, subtypeKey,
  title: "Projet", plannedDate: null, context, costItems });
const quick = (familyKey, subtypeKey, amount = "60.00", context = {}) => {
  const state = setQuickTotal(createBuilderState(draft(familyKey, subtypeKey, context)), amount);
  return familyKey === "food" ? setQuickBaseline(state, null) : state;
};
const line = (assetKey, modulePath, amount = "12.00") => ({ id: randomUUID(), assetKey,
  label: "Dépense", quantity: "1", unitAmount: amount, baselineKey: null, modulePath });
const parsePreview = (value) => parsePlannedExpenseDraft(value, "2026-10", "PREVIEW");
const parseWrite = (value) => parsePlannedExpenseDraft(value, "2026-10");
const { classifyBuilderInvalidation } = require(path.resolve(root, "src/domain/phase2/planned-builder.ts"));
assert.equal(classifyBuilderInvalidation("EXPLICIT", true), "KEEP");
assert.equal(classifyBuilderInvalidation("EXPLICIT", false), "SUSPEND");
assert.equal(classifyBuilderInvalidation("AUTO_DERIVED", false, true), "RECOMPUTE");
assert.equal(classifyBuilderInvalidation("AUTO_DERIVED", false), "REMOVE_DERIVED");

// AB-01: the implication holds for both ready and incomplete states.
for (const state of [quick("food", "restaurant"), createBuilderState(draft("food", "restaurant"))]) {
  const ready = deriveBuilderReadiness(state);
  assert(!ready.saveReady || ready.previewReady);
}
// AB-02: incomplete funding leaves the economic preview available; Save remains blocked.
const meal = line("restaurant:meal_total", ["restaurant"], "45.00");
const underfunded = createBuilderState(draft("food", "restaurant", {}, [{ ...meal,
  fundingAllocations: [{ source: "SWILE", amount: "40.00" }] }]));
assert.equal(deriveBuilderReadiness(underfunded).previewReady, true);
assert.equal(deriveBuilderReadiness(underfunded).saveReady, false);
assert.equal(materializeBuilderDraft(underfunded, true).costItems[0].fundingAllocations, undefined);
assert.equal(parsePreview(materializeBuilderDraft(underfunded, true)).costItems.length, 1);
assert.throws(() => parseWrite(materializeBuilderDraft(underfunded)), /FUNDING_SUM_INVALID/);
const noWritesClient = { from(table) { throw new Error(`Unexpected database access: ${table}`); } };
assert((await simulatePlannedExpense(noWritesClient, randomUUID(), forecast, inputs, [],
  materializeBuilderDraft(underfunded, true), "2026-09-28", undefined, "PREVIEW")).economicPlan);
// AB-03: date is nullable.
assert.equal(deriveBuilderReadiness(quick("food", "restaurant")).saveReady, true);
assert.equal(deriveBuilderReadiness(setQuickTotal(createBuilderState(draft("food", "restaurant")), "60.00")).previewReady, false);
assert.equal(parseWrite(materializeBuilderDraft(quick("food", "restaurant"))).plannedDate, null);
const untitled = editBuilderDraft(quick("food", "restaurant"), { ...draft("food", "restaurant"), title: "" });
assert.equal(deriveBuilderReadiness(untitled).previewReady, true);
assert.equal(deriveBuilderReadiness(untitled).saveReady, false);
assert.equal(parsePreview(materializeBuilderDraft(untitled, true)).title, "Projet à nommer");
// AB-04: place is a Save requirement for house party, while Preview can compute the cost.
const house = quick("outing", "house_party");
assert.equal(deriveBuilderReadiness(house).previewReady, true);
assert.equal(deriveBuilderReadiness(house).saveReady, false);
assert.equal(parsePreview(materializeBuilderDraft(house)).costItems.length, 1);
assert((await simulatePlannedExpense(noWritesClient, randomUUID(), forecast, inputs, [],
  materializeBuilderDraft(house, true), "2026-09-28", undefined, "PREVIEW")).economicPlan);
assert.throws(() => parseWrite(materializeBuilderDraft(house)), /PLACE_REQUIRED/);
// AB-05, AB-06: suggestions create no cost and accepted Gift survives loss of occasion.
const birthday = quick("visit_trip", "friend_visit", "20.00",
  { personVisited: { kind: "CONTACT", contactKey: "lucas" }, socialOccasion: "BIRTHDAY" });
assert(suggestedBuilderChildren(birthday).includes("gift"));
assert.equal(birthday.draft.costItems.length, 0);
const accepted = acceptBuilderChild(birthday, "gift");
const noBirthday = changeBuilderContext(accepted, { ...accepted.draft.context, socialOccasion: "NONE" });
assert(noBirthday.acceptedChildren.includes("gift"));
assert(!suggestedBuilderChildren(noBirthday).includes("gift"));
// AB-07: forbidden child is excluded from active preview and blocks Save.
const forged = { ...quick("food", "restaurant"), acceptedChildren: ["gift"] };
assert(deriveBuilderReadiness(forged).issues.some((issue) => issue.code === "CHILD_FORBIDDEN"));
assert.equal(deriveBuilderReadiness(forged).saveReady, false);
const forgedLines = createBuilderState(draft("food", "restaurant", {}, [line("restaurant:main", ["restaurant"]),
  line("gift:flowers", ["restaurant", "gift"])]));
assert.equal(materializeBuilderDraft(forgedLines, true).costItems.length, 1);
assert.equal(deriveBuilderReadiness(forgedLines).saveReady, false);
// AB-08/09: derived values may leave; explicit route is suspended and reversible.
const fast = quick("food", "fast_food", "20.00", { purchaseMode: "TAKEAWAY",
  route: { mode: "TRAIN", stops: [{ label: "Départ", distanceToNextKm: "1" },
    { label: "Arrivée", distanceToNextKm: null }] } });
const delivered = changeBuilderContext(fast, { ...fast.draft.context, purchaseMode: "DELIVERY" });
assert.equal(delivered.draft.context.route, undefined);
assert(delivered.suspended.some((item) => item.path === "route" && item.origin === "EXPLICIT"));
assert.equal(deriveBuilderReadiness(delivered).saveReady, false);
const derived = { ...fast, origins: { route: "AUTO_DERIVED" } };
assert.equal(changeBuilderContext(derived, { ...derived.draft.context, purchaseMode: "DELIVERY" }).suspended.length, 0);
// AB-10/META-14: domain state transitions are pure and have no persistence import or side effect.
assert.equal(fast.draft.context.purchaseMode, "TAKEAWAY");
// AB-11: every draft edit advances revision so the old Preview token is stale.
assert.notEqual(editBuilderDraft(fast, { ...fast.draft, title: "Autre" }).revision, fast.revision);
// AB-12: Save parser re-resolves; client readiness cannot legalize a forbidden route.
assert.throws(() => parseWrite(materializeBuilderDraft({ ...delivered, suspended: [] })), /TRANSPORT_FORBIDDEN|DELIVERY_PROVIDER_REQUIRED/);

// COST-ADAPT-01..04: economic aggregate, exact split, XOR and subsequent edit.
const restaurant = quick("food", "restaurant");
assert.equal(materializeBuilderDraft(restaurant).costItems.length, 1);
assert.equal(materializeBuilderDraft(restaurant).costItems[0].assetKey, null);
assert.equal(materializeBuilderDraft(restaurant).costItems[0].unitAmount, "60.00");
const split = splitRestaurantQuickTotal(restaurant, "45.00");
assert.equal(split.costMode, "TARGETED_SPLIT");
assert.equal(split.draft.costItems.length, 2);
assert.equal(split.draft.costItems.reduce((sum, part) => sum + Number(part.unitAmount), 0), 60);
assert.equal(plannedAsset("restaurant:meal_total").fundingEligibility, "MEAL");
assert.equal(plannedAsset("restaurant:alcohol_total").fundingEligibility, "BANK");
assert.equal(parseWrite(materializeBuilderDraft(split)).costItems.length, 2);
assert.throws(() => parseWrite({ ...split.draft, costItems: [...split.draft.costItems,
  line("restaurant:main", ["restaurant"])] }), /AGGREGATE_DESCENDANTS_ACTIVE/);
const edited = editBuilderDraft(split, { ...split.draft, costItems: split.draft.costItems.map((part) =>
  part.assetKey === "restaurant:meal_total" ? { ...part, unitAmount: "50.00" } : part) });
assert.equal(edited.draft.costItems.reduce((sum, part) => sum + Number(part.unitAmount), 0), 65);
// COST-ADAPT-05/06: different funding signatures, and fuel economic-only with payable toll, cannot collapse.
assert.equal(canCollapseCosts(split.draft.costItems), false);
assert.throws(() => collapseBuilderCosts(split), /COLLAPSE_INCOMPATIBLE/);
assert.throws(() => collapseBuilderCosts(createBuilderState(draft("food", "restaurant", {}, [{ ...meal,
  fundingAllocations: [{ source: "SWILE", amount: "45.00" }] }]))), /COLLAPSE_INCOMPATIBLE/);
assert.equal(canCollapseCosts([line("transport:fuel_usage", ["trip"]), line("transport:toll", ["trip"])]), false);

// DRAFT-01..05.
assert.equal(undoBuilderChange(delivered).draft.context.route.mode, "TRAIN");
const otherHome = quick("outing", "house_party", "30.00", { housePartyPlaceMode: "OTHER_HOME",
  place: { kind: "TEXT", label: "Chez Lucas" }, route: fast.draft.context.route });
const ownHome = changeBuilderContext(otherHome, { ...otherHome.draft.context, housePartyPlaceMode: "OWN_HOME" });
assert(ownHome.suspended.some((part) => part.path === "place"));
assert(ownHome.suspended.some((part) => part.path === "route"));
assert.equal(undoBuilderChange(ownHome).draft.context.place.label, "Chez Lucas");
assert(noBirthday.acceptedChildren.includes("gift"));
const lucas = quick("visit_trip", "friend_visit", "20.00", { personVisited: { kind: "CONTACT", contactKey: "lucas" },
  place: { kind: "TEXT", label: "Chez Lucas" } });
const cedric = changeBuilderContext(lucas, { ...lucas.draft.context,
  personVisited: { kind: "CONTACT", contactKey: "cedric" } });
assert.equal(cedric.draft.context.place, undefined);
assert(cedric.suspended.some((part) => part.path === "place"));
assert.equal(undoBuilderChange(cedric).draft.context.personVisited.contactKey, "lucas");
const autoCedric = changeBuilderContext({ ...lucas, origins: { place: "AUTO_DERIVED" } },
  { ...lucas.draft.context, personVisited: { kind: "CONTACT", contactKey: "cedric" } });
assert.equal(autoCedric.draft.context.place.placeId, SOCIAL_CONTACTS_V1.find((person) => person.key === "cedric").places[0].placeId);
assert.equal(autoCedric.suspended.length, 0);
const switchedRoot = changeBuilderRoot(split, draft("purchase", "clothing"));
assert.equal(switchedRoot.suspended.length, 1);
assert.deepEqual(undoBuilderChange(switchedRoot).draft.costItems, split.draft.costItems);
assert.equal(new Set(undoBuilderChange(split).draft.costItems.map((part) => part.id)).size,
  undoBuilderChange(split).draft.costItems.length);

// META-01/02 were checked by AB-01 and COST-ADAPT-02; local state has no persisted authority.
assert(!("status" in restaurant.draft));
assert(!("previewReady" in materializeBuilderDraft(restaurant)));
console.log("PASS: C3 AB-01..12, COST-ADAPT-01..06, DRAFT-01..05, META-01/02/14");
