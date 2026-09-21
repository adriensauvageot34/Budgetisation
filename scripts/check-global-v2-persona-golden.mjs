import assert from "node:assert/strict";
import { registerHooks } from "node:module";

registerHooks({
  resolve(specifier, context, nextResolve) {
    try { return nextResolve(specifier, context); } catch (originalError) {
      if (!specifier.startsWith(".") || /\.[cm]?[jt]sx?$/.test(specifier)) throw originalError;
      for (const candidate of [`${specifier}.ts`, `${specifier}/index.ts`]) {
        try { return nextResolve(candidate, context); } catch { /* next */ }
      }
      throw originalError;
    }
  },
});

const analytics = await import("../src/analytics/global-v2/index.ts");
const identity = await import("../src/core/identity/index.ts");

const uuid = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const adrien = identity.parsePersonId(uuid(1));
const manon = identity.parsePersonId(uuid(2));
const household = identity.parseHouseholdId(uuid(3));

const personal = (personId) => ({ subject: { kind: "PERSON", personId }, scope: "PERSONAL" });
const shared = { subject: { kind: "SHARED", personIds: [adrien, manon] }, scope: "SHARED" };
const householdScope = { subject: { kind: "HOUSEHOLD", householdId: household }, scope: "HOUSEHOLD" };

const fixtures = [
  {
    priority: 1,
    id: "P1-PS5-PAYER-NOT-USER",
    goldenRefs: ["GD-N01", "GD-C02"],
    phase: "ENGINE_ASSERTED",
    signals: [
      { signalId: "cost:ps5", signalType: "PERSONAL_COST", semanticKey: "gaming.ps5.purchase", ...personal(adrien), authority: "CANONICAL_DB", dimension: "FINANCE", payerPersonId: adrien, sourceModule: "M1", evidenceRefs: ["payment:ps5"] },
      { signalId: "declared:gaming-shared", signalType: "DECLARED", semanticKey: "gaming", ...shared, action: "AFFIRM", value: true, kind: "UNIVERSE", family: "LEISURE_AND_ACTIVITIES", authority: "USER_VALIDATED", dimension: "USAGE", sourceModule: "DECLARED", evidenceRefs: ["declaration:gaming-shared"] },
    ],
    expected: {
      requiredTraits: [{ semanticKey: "gaming", scope: "SHARED", kind: "UNIVERSE" }],
      forbiddenClaims: ["gaming.scope=PERSONAL inferred only from payerPersonId"],
      preservedSignalRefs: ["cost:ps5"],
    },
  },
  {
    priority: 2,
    id: "P1-CROC-AU-BAIN-NOT-PET",
    goldenRefs: ["GD-N24", "GD-C16"],
    phase: "ENGINE_ASSERTED",
    signals: [
      { signalId: "need:animal-looking", signalType: "NEED", semanticKey: "merchant.croc_au_bain", ...householdScope, needKey: "toilettage_animaux", active: true, kind: "UNIVERSE", family: "PERSONAL_CARE", authority: "CANONICAL_DB", groupKey: "household.pet", sourceModule: "M2", evidenceRefs: ["merchant:Croc-au-Bain"] },
      { signalId: "declared:no-pet", signalType: "DECLARED", semanticKey: "household.has_pet", ...householdScope, action: "NEGATE", value: false, authority: "USER_VALIDATED", groupKey: "household.pet", targetSemanticKeys: ["merchant.croc_au_bain"], sourceModule: "DECLARED", evidenceRefs: ["declaration:no-pet"] },
    ],
    expected: {
      requiredTraits: [],
      forbiddenClaims: ["household owns a dog", "merchant.croc_au_bain implies pet ownership"],
      preservedSignalRefs: ["need:animal-looking"],
    },
  },
  {
    priority: 3,
    id: "P1-RESTAURANT-NOT-SHARED-BY-DEFAULT",
    goldenRefs: ["GD-N08"],
    phase: "ENGINE_ASSERTED",
    signals: [
      { signalId: "routine:work-restaurant", signalType: "ROUTINE", semanticKey: "work_meal.adrien", ...personal(adrien), kind: "ROUTINE", family: "FOOD_AND_WORK_MEALS", context: "ONSITE_WORK", pattern: ["WORK", "RESTAURANT", "WORK"], authority: "OBSERVED", sourceModule: "M4", evidenceRefs: ["routine:work-meal"] },
      { signalId: "shared:restaurants", signalType: "SHARED_ACTIVITY", semanticKey: "restaurant", ...shared, activityKey: "RESTAURANT", authority: "OBSERVED", dimension: "PARTICIPATION", sourceModule: "M10", metrics: { resolvedOccurrences: 146, sharedOccurrences: 4 }, evidenceRefs: ["m10:restaurant-support"] },
    ],
    expected: {
      requiredTraits: [{ semanticKey: "work_meal.adrien", scope: "PERSONAL", kind: "ROUTINE" }],
      forbiddenClaims: ["restaurant category implies SHARED activity"],
      preservedSignalRefs: ["shared:restaurants"],
    },
  },
  {
    priority: 4,
    id: "P1-CARD-SUFFIX-NOT-PERSON",
    goldenRefs: ["GD-N13", "GD-A05"],
    phase: "ENGINE_ASSERTED",
    signals: [
      { signalId: "difference:cards", signalType: "DIFFERENCE", semanticKey: "payment_instruments.card_suffixes", ...householdScope, differenceRef: "X3366-vs-X3879", authority: "OBSERVED", evidenceRefs: ["card:X3366", "card:X3879"] },
    ],
    expected: {
      requiredTraits: [],
      forbiddenClaims: ["X3366 identifies Manon", "X3879 identifies Adrien"],
      preservedSignalRefs: ["difference:cards"],
    },
  },
  {
    priority: 5,
    id: "P1-HOUSEHOLD-NOT-FIFTY-FIFTY",
    goldenRefs: ["GD-N04", "GD-C08"],
    phase: "ENGINE_ASSERTED",
    signals: [
      { signalId: "need:groceries", signalType: "NEED", semanticKey: "groceries.organization", ...householdScope, needKey: "courses_alimentaires_foyer", active: true, kind: "HOUSEHOLD_ORGANIZATION", family: "PERSONAL_PURCHASES", authority: "CANONICAL_DB", dimension: "ORGANIZATION", sourceModule: "M2", evidenceRefs: ["need:groceries-household"] },
    ],
    expected: {
      requiredTraits: [{ semanticKey: "groceries.organization", scope: "HOUSEHOLD", kind: "HOUSEHOLD_ORGANIZATION" }],
      forbiddenClaims: ["HOUSEHOLD implies beneficiary shares 50/50"],
      preservedSignalRefs: ["need:groceries"],
    },
  },
  {
    priority: 6,
    id: "P1-PEUGEOT-HOUSEHOLD-NOT-MANON-OWNED",
    goldenRefs: ["GD-N05", "GD-C09"],
    phase: "ENGINE_ASSERTED",
    signals: [
      { signalId: "mobility:207-household", signalType: "MOBILITY", semanticKey: "vehicle.peugeot_207", ...householdScope, kind: "HOUSEHOLD_ORGANIZATION", family: "MOBILITY", mode: "CAR", vehicleRef: "vehicle:peugeot-207", authority: "CANONICAL_DB", dimension: "OWNERSHIP", sourceModule: "VEHICLE_AUTHORITY", evidenceRefs: ["vehicle:peugeot-207"] },
      { signalId: "declared:manon-work-car", signalType: "DECLARED", semanticKey: "mobility.work.manon", ...personal(manon), action: "AFFIRM", value: "CAR", kind: "MOBILITY", family: "MOBILITY", context: "WORK_COMMUTE", authority: "USER_VALIDATED", dimension: "USAGE", limitations: ["DISTANCE_UNKNOWN", "FUEL_COST_UNKNOWN"], sourceModule: "DECLARED", evidenceRefs: ["declaration:manon-work-car"] },
    ],
    expected: {
      requiredTraits: [
        { semanticKey: "vehicle.peugeot_207", scope: "HOUSEHOLD", kind: "HOUSEHOLD_ORGANIZATION" },
        { semanticKey: "mobility.work.manon", scope: "PERSONAL", kind: "MOBILITY" },
      ],
      forbiddenClaims: ["Peugeot 207 owner is Manon"],
      preservedSignalRefs: ["mobility:207-household", "declared:manon-work-car"],
    },
  },
  {
    priority: 7,
    id: "P1-WORK-CAR-NOT-ALL-AUTO-COSTS",
    goldenRefs: ["GD-N18", "GD-C09"],
    phase: "ENGINE_ASSERTED",
    signals: [
      { signalId: "mobility:manon-commute", signalType: "MOBILITY", semanticKey: "mobility.work.manon", ...personal(manon), context: "WORK_COMMUTE", mode: "CAR", vehicleRef: "vehicle:peugeot-207", authority: "USER_VALIDATED", dimension: "USAGE", sourceModule: "DECLARED", limitations: ["DISTANCE_UNKNOWN", "FUEL_COST_UNKNOWN", "WORK_COST_SHARE_UNKNOWN"], evidenceRefs: ["declaration:manon-work-car"] },
      { signalId: "mobility:207-costs", signalType: "MOBILITY", semanticKey: "vehicle.peugeot_207.costs", ...householdScope, mode: "CAR", vehicleRef: "vehicle:peugeot-207", authority: "OBSERVED", dimension: "FINANCE", sourceModule: "M1", metrics: { observedVehicleCost: 3564.35 }, evidenceRefs: ["m1:auto-costs"] },
    ],
    expected: {
      requiredTraits: [{ semanticKey: "mobility.work.manon", scope: "PERSONAL", kind: "MOBILITY", limitations: ["WORK_COST_SHARE_UNKNOWN"] }],
      forbiddenClaims: ["all observedVehicleCost is Manon work cost"],
      preservedSignalRefs: ["mobility:207-costs"],
    },
  },
  {
    priority: 8,
    id: "P1-PHOTO-ACTIVE-WITHOUT-RECENT-PURCHASE",
    goldenRefs: ["GD-N15", "GD-A11"],
    phase: "ENGINE_ASSERTED",
    signals: [
      { signalId: "moment:photo", signalType: "MOMENT", semanticKey: "creative.photo.adrien", ...personal(adrien), momentRef: "moment:photo", kind: "PROJECT", family: "LEISURE_AND_ACTIVITIES", temporalStatus: "HISTORICAL", authority: "OBSERVED", sourceModule: "M6", limitations: ["NO_RECENT_PURCHASE"], evidenceRefs: ["moment:photo-history"] },
      { signalId: "declared:photo-active", signalType: "DECLARED", semanticKey: "creative.photo.adrien", ...personal(adrien), action: "TEMPORAL_OVERRIDE", value: "PROJECT", kind: "PROJECT", family: "LEISURE_AND_ACTIVITIES", authority: "USER_VALIDATED", dimension: "TEMPORALITY", sourceModule: "DECLARED", evidenceRefs: ["declaration:photo-active"] },
    ],
    expected: {
      requiredTraits: [{ semanticKey: "creative.photo.adrien", scope: "PERSONAL", kind: "PROJECT", temporalStatus: "PROJECT" }],
      forbiddenClaims: ["absence of recent purchase implies inactive photo project"],
      preservedSignalRefs: ["moment:photo"],
    },
  },
  {
    priority: 9,
    id: "P1-DRIVING-LICENCE-IN-PROGRESS",
    goldenRefs: ["GD-N16", "GD-A12"],
    phase: "ENGINE_ASSERTED",
    signals: [
      { signalId: "moment:driving-licence", signalType: "MOMENT", semanticKey: "driving_license.adrien", ...personal(adrien), momentRef: "project:driving-licence", kind: "PROJECT", family: "MOBILITY", temporalStatus: "PROJECT", authority: "OBSERVED", sourceModule: "M6", metrics: { observedAmount: 983.22 }, limitations: ["FINAL_COST_UNKNOWN"], evidenceRefs: ["payment:driving-lessons"] },
      { signalId: "declared:licence-progress", signalType: "DECLARED", semanticKey: "driving_license.adrien", ...personal(adrien), action: "QUALIFY", value: "IN_PROGRESS", kind: "PROJECT", family: "MOBILITY", authority: "USER_VALIDATED", sourceModule: "DECLARED", evidenceRefs: ["declaration:licence-in-progress"] },
    ],
    expected: {
      requiredTraits: [{ semanticKey: "driving_license.adrien", scope: "PERSONAL", kind: "PROJECT", temporalStatus: "PROJECT" }],
      forbiddenClaims: ["driving licence obtained", "observedAmount is final project cost"],
      preservedSignalRefs: ["moment:driving-licence"],
    },
  },
  {
    priority: 10,
    id: "P1-TECHNO-SHARED-WITHOUT-M10-REWRITE",
    goldenRefs: ["GD-N19", "GD-C01"],
    phase: "ENGINE_ASSERTED",
    signals: [
      { signalId: "shared:techno-m10", signalType: "SHARED_ACTIVITY", semanticKey: "techno", ...shared, activityKey: "TECHNO", authority: "OBSERVED", dimension: "PARTICIPATION", sourceModule: "M10", metrics: { sharedOccurrences: 2, unresolvedOccurrences: 1 }, upstreamUnitRefs: ["m10:techno:shared-1", "m10:techno:shared-2", "m10:techno:unresolved-1"], evidenceRefs: ["m10:techno-support"] },
      { signalId: "declared:techno-shared", signalType: "DECLARED", semanticKey: "techno", ...shared, action: "AFFIRM", value: true, kind: "UNIVERSE", family: "LEISURE_AND_ACTIVITIES", authority: "USER_VALIDATED", dimension: "USAGE", sourceModule: "DECLARED", evidenceRefs: ["declaration:techno-shared"] },
    ],
    expected: {
      requiredTraits: [{ semanticKey: "techno", scope: "SHARED", kind: "UNIVERSE" }],
      forbiddenClaims: ["declaration rewrites unresolved M10 occurrence as SHARED"],
      preservedSignalRefs: ["shared:techno-m10"],
    },
  },
  {
    priority: 11,
    id: "P1-PRODUCT-CHANGE-SAME-NEED",
    goldenRefs: ["GD-N10", "GD-M09"],
    phase: "ENGINE_ASSERTED",
    signals: [
      { signalId: "need:epilation", signalType: "NEED", semanticKey: "beauty.epilation", ...personal(manon), needKey: "epilation_manon", active: true, kind: "HABIT", family: "PERSONAL_CARE", authority: "CANONICAL_DB", sourceModule: "M2", groupKey: "beauty_and_care", evidenceRefs: ["need:epilation"] },
      { signalId: "product:dermawax", signalType: "PRODUCT_CYCLE", semanticKey: "beauty.epilation", ...personal(manon), needKey: "epilation_manon", productKey: "dermawax", family: "PERSONAL_CARE", authority: "OBSERVED", sourceModule: "M8", metrics: { occurrenceCount: 3 }, groupKey: "beauty_and_care", evidenceRefs: ["product:dermawax"] },
      { signalId: "product:italwax", signalType: "PRODUCT_CYCLE", semanticKey: "beauty.epilation", ...personal(manon), needKey: "epilation_manon", productKey: "italwax", family: "PERSONAL_CARE", referenceChanged: true, authority: "OBSERVED", sourceModule: "M8", temporalStatus: "CHANGED", metrics: { occurrenceCount: 2 }, groupKey: "beauty_and_care", evidenceRefs: ["product:italwax"] },
    ],
    expected: {
      requiredTraits: [{ semanticKey: "beauty.epilation", scope: "PERSONAL", kind: "HABIT", temporalStatus: "CHANGED" }],
      forbiddenClaims: ["Italwax creates a new Need", "Dermawax ending means epilation ended"],
      preservedSignalRefs: ["need:epilation", "product:dermawax", "product:italwax"],
    },
  },
  {
    priority: 12,
    id: "P1-HOUSEHOLD-CONSUMABLES-NO-INVENTED-CADENCE",
    goldenRefs: ["GD-G04", "GD-C15"],
    phase: "ENGINE_ASSERTED",
    signals: [
      { signalId: "need:household-consumables", signalType: "NEED", semanticKey: "household.consumables", ...householdScope, needKey: "consommables_foyer", active: true, kind: "HABIT", family: "PRODUCTS_AND_CONSUMPTION", authority: "USER_VALIDATED", temporalStatus: "UNKNOWN", sourceModule: "M2", limitations: ["CADENCE_UNKNOWN", "ANNUAL_COST_UNKNOWN"], evidenceRefs: ["declaration:household-consumables"] },
      { signalId: "declared:consumables-recurrent", signalType: "DECLARED", semanticKey: "household.consumables", ...householdScope, action: "AFFIRM", value: ["lessive", "papier_toilette", "sacs_poubelle", "liquide_vaisselle", "cafe_dosettes", "gel_douche", "lames"], kind: "HABIT", family: "PRODUCTS_AND_CONSUMPTION", authority: "USER_VALIDATED", sourceModule: "DECLARED", evidenceRefs: ["declaration:household-consumables"] },
    ],
    expected: {
      requiredTraits: [{ semanticKey: "household.consumables", scope: "HOUSEHOLD", kind: "HABIT", temporalStatus: "UNKNOWN", limitations: ["CADENCE_UNKNOWN", "ANNUAL_COST_UNKNOWN"] }],
      forbiddenClaims: ["exact repurchase cadence", "exact annual cost"],
      preservedSignalRefs: ["need:household-consumables"],
    },
  },
];

const positiveFixtures = [
  {
    id: "ANGE_COMPOSITE",
    signals: [
      { signalId: "ange:need", signalType: "NEED", semanticKey: "work_meal.adrien", ...personal(adrien), needKey: "repas_travail_adrien", active: true, kind: "HABIT", family: "FOOD_AND_WORK_MEALS", context: "ONSITE_WORK", authority: "CANONICAL_DB", sourceModule: "M2", evidenceRefs: ["need:repas-travail-adrien"] },
      { signalId: "ange:routine", signalType: "ROUTINE", semanticKey: "work_meal.adrien", ...personal(adrien), kind: "ROUTINE", family: "FOOD_AND_WORK_MEALS", context: "ONSITE_WORK", pattern: ["WORK", "ANGE", "WORK"], temporalStatus: "STABLE", authority: "OBSERVED", sourceModule: "M4", metrics: { occurrenceCount: 39 }, evidenceRefs: ["routine:work-ange-work"] },
      { signalId: "ange:cost", signalType: "PERSONAL_COST", semanticKey: "work_meal.adrien", ...personal(adrien), kind: "HABIT", family: "FOOD_AND_WORK_MEALS", context: "ONSITE_WORK", beneficiaryPersonId: adrien, authority: "CANONICAL_DB", sourceModule: "M1", metrics: { observedAmount: 239 }, limitations: ["MEAL_CARD_COSTS_MISSING"], evidenceRefs: ["cost:ange-personal"] },
      { signalId: "ange:declared", signalType: "DECLARED", semanticKey: "work_meal.adrien", ...personal(adrien), action: "AFFIRM", value: "CAFE_OR_LUNCH", kind: "ROUTINE", family: "FOOD_AND_WORK_MEALS", context: "ONSITE_WORK", authority: "USER_VALIDATED", sourceModule: "DECLARED", evidenceRefs: ["declaration:ange-cafe-or-lunch"] },
    ],
    expected: { semanticKey: "work_meal.adrien", scope: "PERSONAL", kind: "ROUTINE" },
  },
  {
    id: "MASCARA_HABIT",
    signals: [
      { signalId: "mascara:cycle", signalType: "PRODUCT_CYCLE", semanticKey: "beauty.mascara", ...personal(manon), needKey: "maquillage_manon_mascara", productKey: "benefit_badgal_bang", family: "PERSONAL_CARE", authority: "OBSERVED", temporalStatus: "STABLE", sourceModule: "M8", metrics: { occurrenceCount: 6, medianGapDays: 65, typicalPrice: 32 }, evidenceRefs: ["product:mascara-cycle"] },
    ],
    expected: { semanticKey: "beauty.mascara", scope: "PERSONAL", kind: "HABIT" },
  },
  { id: "GAMING_SHARED", signals: fixtures[0].signals, expected: { semanticKey: "gaming", scope: "SHARED", kind: "UNIVERSE" } },
  { id: "PHOTO_ACTIVE", signals: fixtures[7].signals, expected: { semanticKey: "creative.photo.adrien", scope: "PERSONAL", kind: "PROJECT" } },
  { id: "MANON_MOBILITY", signals: fixtures[6].signals, expected: { semanticKey: "mobility.work.manon", scope: "PERSONAL", kind: "MOBILITY" } },
  {
    id: "GROCERIES_ORGANIZATION",
    signals: [
      { signalId: "groceries:need", signalType: "NEED", semanticKey: "groceries.organization", ...householdScope, needKey: "courses_alimentaires_foyer", active: true, kind: "HOUSEHOLD_ORGANIZATION", family: "PERSONAL_PURCHASES", groupKey: "groceries", authority: "CANONICAL_DB", dimension: "ORGANIZATION", sourceModule: "M2", evidenceRefs: ["need:groceries"] },
      { signalId: "groceries:adrien", signalType: "ROUTINE", semanticKey: "groceries.organization", ...personal(adrien), kind: "HOUSEHOLD_ORGANIZATION", family: "PERSONAL_PURCHASES", groupKey: "groceries", pattern: ["SMALL_GROCERIES", "NEAR_HOME"], authority: "OBSERVED", dimension: "ORGANIZATION", sourceModule: "M4", evidenceRefs: ["routine:adrien-small-groceries"] },
      { signalId: "groceries:manon", signalType: "ROUTINE", semanticKey: "groceries.organization", ...personal(manon), kind: "HOUSEHOLD_ORGANIZATION", family: "PERSONAL_PURCHASES", groupKey: "groceries", pattern: ["LARGE_GROCERIES", "CAR"], authority: "OBSERVED", dimension: "ORGANIZATION", sourceModule: "M4", evidenceRefs: ["routine:manon-large-groceries"] },
    ],
    expected: { semanticKey: "groceries.organization", scope: "HOUSEHOLD", kind: "HOUSEHOLD_ORGANIZATION" },
  },
];

let checks = 0;
const check = (assertion) => { assertion(); checks += 1; };

check(() => assert.equal(analytics.PERSONA_SIGNAL_CONTRACT_VERSION, "v1"));
check(() => assert.deepEqual([...analytics.personaSignalTypeCatalog], ["PERSONAL_COST", "NEED", "ROUTINE", "PRODUCT_CYCLE", "MOMENT", "MOBILITY", "SHARED_ACTIVITY", "DIFFERENCE", "DECLARED"]));
check(() => assert.deepEqual([...analytics.personaScopeCatalog], ["PERSONAL", "SHARED", "HOUSEHOLD"]));
check(() => assert.deepEqual([...analytics.personaTraitKindCatalog], ["HABIT", "ROUTINE", "UNIVERSE", "PROJECT", "MOBILITY", "HOUSEHOLD_ORGANIZATION"]));
check(() => assert.deepEqual([...analytics.personaDeclaredSignalActionCatalog], ["AFFIRM", "QUALIFY", "TEMPORAL_OVERRIDE", "NEGATE"]));
check(() => assert.deepEqual([...analytics.personaClaimDimensionCatalog], ["FINANCE", "USAGE", "OWNERSHIP", "PARTICIPATION", "TEMPORALITY", "ORGANIZATION", "GENERAL"]));
check(() => assert.equal(fixtures.length, 12));
check(() => assert.deepEqual(fixtures.map(({ priority }) => priority), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]));
check(() => assert.equal(new Set(fixtures.map(({ id }) => id)).size, fixtures.length));

const signalIds = new Set();
for (const fixture of fixtures) {
  check(() => assert.equal(fixture.phase, "ENGINE_ASSERTED", `${fixture.id} must be backed by a P2 engine assertion`));
  check(() => assert.ok(fixture.goldenRefs.length > 0, `${fixture.id} needs Golden references`));
  check(() => assert.ok(fixture.signals.length > 0, `${fixture.id} needs synthetic signals`));
  check(() => assert.ok(fixture.expected.forbiddenClaims.length > 0, `${fixture.id} needs at least one forbidden claim`));
  check(() => assert.ok(fixture.expected.preservedSignalRefs.length > 0, `${fixture.id} needs an upstream preservation assertion`));
  for (const signal of fixture.signals) {
    check(() => assert.ok(analytics.personaSignalTypeCatalog.includes(signal.signalType), `${fixture.id}:${signal.signalId} has an unknown signal type`));
    check(() => assert.ok(signal.signalId && signal.semanticKey, `${fixture.id} has an incomplete signal identity`));
    check(() => assert.equal(signalIds.has(signal.signalId), false, `duplicate signal id ${signal.signalId}`));
    signalIds.add(signal.signalId);
    const expectedScope = { PERSON: "PERSONAL", SHARED: "SHARED", HOUSEHOLD: "HOUSEHOLD" }[signal.subject.kind];
    check(() => assert.equal(signal.scope, expectedScope, `${fixture.id}:${signal.signalId} has mismatched subject/scope`));
    if (signal.signalType === "DECLARED") check(() => assert.ok(analytics.personaDeclaredSignalActionCatalog.includes(signal.action), `${fixture.id}:${signal.signalId} has an unknown declaration action`));
  }
  for (const expectedTrait of fixture.expected.requiredTraits) {
    check(() => assert.ok(analytics.personaScopeCatalog.includes(expectedTrait.scope), `${fixture.id} has an unknown expected scope`));
    check(() => assert.ok(analytics.personaTraitKindCatalog.includes(expectedTrait.kind), `${fixture.id} has an unknown expected kind`));
  }
  for (const signalRef of fixture.expected.preservedSignalRefs) {
    check(() => assert.ok(fixture.signals.some(({ signalId }) => signalId === signalRef), `${fixture.id} preserves an unknown signal`));
  }
}

const usedSignalTypes = new Set(fixtures.flatMap(({ signals }) => signals.map(({ signalType }) => signalType)));
const usedKinds = new Set(fixtures.flatMap(({ expected }) => expected.requiredTraits.map(({ kind }) => kind)));
const usedActions = new Set(fixtures.flatMap(({ signals }) => signals.filter(({ signalType }) => signalType === "DECLARED").map(({ action }) => action)));
check(() => assert.deepEqual([...usedSignalTypes].sort(), [...analytics.personaSignalTypeCatalog].sort()));
check(() => assert.deepEqual([...usedKinds].sort(), [...analytics.personaTraitKindCatalog].sort()));
check(() => assert.deepEqual([...usedActions].sort(), [...analytics.personaDeclaredSignalActionCatalog].sort()));
check(() => assert.equal(fixtures.some(({ signals }) => signals.some(({ subject }) => subject.kind === "PERSON" && !subject.personId)), false));

const allTraits = (output) => output.profiles.flatMap(({ allTraits: traits }) => traits);
const matchingTraits = (output, expected) => allTraits(output).filter((trait) =>
  trait.semanticKey === expected.semanticKey
  && trait.scope === expected.scope
  && trait.kind === expected.kind
  && (expected.temporalStatus === undefined || trait.temporalStatus === expected.temporalStatus)
  && (expected.limitations === undefined || expected.limitations.every((value) => trait.limitations?.includes(value))));
const traitByKey = (output, semanticKey, scope) => allTraits(output).find((trait) => trait.semanticKey === semanticKey && trait.scope === scope);

const snapshots = new Map(fixtures.map((fixture) => [fixture.id, structuredClone(fixture.signals)]));
const engineOutputs = new Map(fixtures.map((fixture) => [fixture.id, analytics.buildPersonaProfile({ signals: fixture.signals })]));

for (const fixture of fixtures) {
  const output = engineOutputs.get(fixture.id);
  for (const expected of fixture.expected.requiredTraits) {
    check(() => assert.equal(matchingTraits(output, expected).length, 1, `${fixture.id} missing or duplicated ${expected.semanticKey}`));
  }
  check(() => assert.deepEqual(fixture.signals, snapshots.get(fixture.id), `${fixture.id} mutated its source signals`));
  check(() => assert.ok(output.profiles.every(({ featuredTraits }) => featuredTraits.length === 0), `${fixture.id} must not select featured traits during P2`));
}

// 1. A payer-only PS5 signal does not create personal gaming; the usage declaration creates Shared gaming.
const ps5 = engineOutputs.get("P1-PS5-PAYER-NOT-USER");
check(() => assert.equal(allTraits(ps5).some((trait) => trait.scope === "PERSONAL" && trait.semanticKey.startsWith("gaming")), false));
check(() => assert.equal(traitByKey(ps5, "gaming", "SHARED").authority, "USER_VALIDATED"));
check(() => assert.deepEqual(traitByKey(ps5, "gaming", "SHARED").dimensions, ["USAGE"]));

// 2. NEGATE removes only the Persona interpretation; its Croc au Bain source fixture remains untouched.
const pet = engineOutputs.get("P1-CROC-AU-BAIN-NOT-PET");
check(() => assert.equal(allTraits(pet).some((trait) => trait.semanticKey === "merchant.croc_au_bain" || trait.groupKey === "household.pet"), false));

// 3. Restaurant observations stay personal unless Shared authority explicitly promotes a candidate.
const restaurant = engineOutputs.get("P1-RESTAURANT-NOT-SHARED-BY-DEFAULT");
check(() => assert.equal(allTraits(restaurant).some((trait) => trait.scope === "SHARED" && trait.semanticKey === "restaurant"), false));
check(() => assert.equal(traitByKey(restaurant, "work_meal.adrien", "PERSONAL").kind, "ROUTINE"));

// 4. Card suffixes never become person subjects.
const cards = engineOutputs.get("P1-CARD-SUFFIX-NOT-PERSON");
check(() => assert.equal(allTraits(cards).some((trait) => trait.subject.kind === "PERSON"), false));

// 5. Household knowledge does not manufacture beneficiary shares or personal ownership.
const householdOutput = engineOutputs.get("P1-HOUSEHOLD-NOT-FIFTY-FIFTY");
const groceries = traitByKey(householdOutput, "groceries.organization", "HOUSEHOLD");
check(() => assert.equal(Object.keys(groceries.metrics ?? {}).some((key) => /share|50/i.test(key)), false));
check(() => assert.equal(allTraits(householdOutput).some((trait) => trait.scope === "PERSONAL" && trait.semanticKey === "groceries.organization"), false));

// 6. Household ownership and Manon's work usage remain two compatible dimensions.
const car = engineOutputs.get("P1-PEUGEOT-HOUSEHOLD-NOT-MANON-OWNED");
check(() => assert.equal(traitByKey(car, "vehicle.peugeot_207", "HOUSEHOLD").dimensions.includes("OWNERSHIP"), true));
check(() => assert.equal(allTraits(car).some((trait) => trait.scope === "PERSONAL" && trait.semanticKey === "vehicle.peugeot_207"), false));
check(() => assert.equal(traitByKey(car, "mobility.work.manon", "PERSONAL").dimensions.includes("USAGE"), true));

// 7. Partial mobility keeps unavailable measures absent and auto costs Household-scoped.
const mobility = engineOutputs.get("P1-WORK-CAR-NOT-ALL-AUTO-COSTS");
const commute = traitByKey(mobility, "mobility.work.manon", "PERSONAL");
check(() => assert.deepEqual(commute.metrics ?? {}, {}));
check(() => assert.ok(["DISTANCE_UNKNOWN", "FUEL_COST_UNKNOWN", "WORK_COST_SHARE_UNKNOWN"].every((value) => commute.limitations.includes(value))));
check(() => assert.equal(traitByKey(mobility, "vehicle.peugeot_207.costs", "HOUSEHOLD").metrics.observedVehicleCost, 3564.35));

// 8. TEMPORAL_OVERRIDE keeps photo active as a project without changing old evidence.
const photo = engineOutputs.get("P1-PHOTO-ACTIVE-WITHOUT-RECENT-PURCHASE");
check(() => assert.equal(traitByKey(photo, "creative.photo.adrien", "PERSONAL").temporalStatus, "PROJECT"));
check(() => assert.ok(traitByKey(photo, "creative.photo.adrien", "PERSONAL").signalRefs.includes("moment:photo")));

// 9. QUALIFY records IN_PROGRESS; it never emits OBTAINED or treats observed cost as final.
const licence = engineOutputs.get("P1-DRIVING-LICENCE-IN-PROGRESS");
const licenceTrait = traitByKey(licence, "driving_license.adrien", "PERSONAL");
check(() => assert.ok(licenceTrait.qualifications.includes("IN_PROGRESS")));
check(() => assert.equal(licenceTrait.qualifications.includes("OBTAINED"), false));
check(() => assert.ok(licenceTrait.limitations.includes("FINAL_COST_UNKNOWN")));

// 10. A Shared declaration creates a universe but cannot mutate M10 counts or unit refs.
const techno = engineOutputs.get("P1-TECHNO-SHARED-WITHOUT-M10-REWRITE");
check(() => assert.equal(traitByKey(techno, "techno", "SHARED").kind, "UNIVERSE"));
check(() => assert.deepEqual(fixtures[9].signals[0].metrics, { sharedOccurrences: 2, unresolvedOccurrences: 1 }));
check(() => assert.deepEqual(fixtures[9].signals[0].upstreamUnitRefs, ["m10:techno:shared-1", "m10:techno:shared-2", "m10:techno:unresolved-1"]));

// 11. Product changes merge under one stable Need and retain every source.
const epilation = engineOutputs.get("P1-PRODUCT-CHANGE-SAME-NEED");
const epilationTraits = allTraits(epilation).filter((trait) => trait.semanticKey === "beauty.epilation");
check(() => assert.equal(epilationTraits.length, 1));
check(() => assert.equal(epilationTraits[0].temporalStatus, "CHANGED"));
check(() => assert.deepEqual(epilationTraits[0].signalRefs, ["need:epilation", "product:dermawax", "product:italwax"]));

// 12. Recurrent Household consumables remain useful with cadence and annual cost absent.
const consumables = traitByKey(engineOutputs.get("P1-HOUSEHOLD-CONSUMABLES-NO-INVENTED-CADENCE"), "household.consumables", "HOUSEHOLD");
check(() => assert.deepEqual(consumables.metrics ?? {}, {}));
check(() => assert.ok(["CADENCE_UNKNOWN", "ANNUAL_COST_UNKNOWN"].every((value) => consumables.limitations.includes(value))));

const positiveOutputs = positiveFixtures.map((fixture) => ({ fixture, output: analytics.buildPersonaProfile({ signals: fixture.signals }) }));
for (const { fixture, output } of positiveOutputs) {
  check(() => assert.equal(matchingTraits(output, fixture.expected).length, 1, `${fixture.id} positive Golden case failed`));
}

const ange = positiveFixtures[0];
const generatedAnge = analytics.generatePersonaCandidates(ange.signals);
check(() => assert.equal(generatedAnge.length, 3));
const mergedAnge = analytics.mergePersonaCandidates(generatedAnge);
check(() => assert.equal(mergedAnge.length, 1));
const declaredAnge = analytics.applyPersonaDeclarations({ candidates: mergedAnge, declarations: ange.signals.filter(({ signalType }) => signalType === "DECLARED") });
check(() => assert.equal(declaredAnge.length, 1));
check(() => assert.deepEqual(declaredAnge[0].signalRefs, ["ange:cost", "ange:declared", "ange:need", "ange:routine"]));
check(() => assert.deepEqual(declaredAnge[0].sourceModules, ["DECLARED", "M1", "M2", "M4"]));
check(() => assert.equal(analytics.buildPersonaTraits(declaredAnge).length, 1));
check(() => assert.deepEqual(
  analytics.buildPersonaProfile({ signals: [...ange.signals].reverse() }),
  analytics.buildPersonaProfile({ signals: ange.signals }),
));

const incompatibleContexts = [
  { signalId: "context:work", signalType: "ROUTINE", semanticKey: "same.semantic.key", ...personal(adrien), kind: "ROUTINE", family: "WORK_AND_DAY_CONTEXT", context: "WORK", pattern: ["WORK"], authority: "OBSERVED" },
  { signalId: "context:home", signalType: "ROUTINE", semanticKey: "same.semantic.key", ...personal(adrien), kind: "ROUTINE", family: "WORK_AND_DAY_CONTEXT", context: "HOME", pattern: ["HOME"], authority: "OBSERVED" },
];
check(() => assert.equal(analytics.mergePersonaCandidates(analytics.generatePersonaCandidates(incompatibleContexts)).length, 2));
const incompatiblePeriods = [
  { signalId: "period:old", signalType: "ROUTINE", semanticKey: "period.sensitive", ...personal(adrien), kind: "ROUTINE", family: "WORK_AND_DAY_CONTEXT", context: "WORK", pattern: ["OLD"], validFrom: "2025-01-01", validTo: "2025-06-30", authority: "OBSERVED" },
  { signalId: "period:new", signalType: "ROUTINE", semanticKey: "period.sensitive", ...personal(adrien), kind: "ROUTINE", family: "WORK_AND_DAY_CONTEXT", context: "WORK", pattern: ["NEW"], validFrom: "2026-01-01", validTo: "2026-06-30", authority: "OBSERVED" },
];
check(() => assert.equal(analytics.mergePersonaCandidates(analytics.generatePersonaCandidates(incompatiblePeriods)).length, 2));

const courses = positiveOutputs.find(({ fixture }) => fixture.id === "GROCERIES_ORGANIZATION").output;
const coursesTrait = traitByKey(courses, "groceries.organization", "HOUSEHOLD");
check(() => assert.deepEqual(coursesTrait.signalRefs, ["groceries:adrien", "groceries:manon", "groceries:need"]));
check(() => assert.deepEqual(coursesTrait.qualifications, ["LARGE_GROCERIES → CAR", "SMALL_GROCERIES → NEAR_HOME"]));
check(() => assert.equal(allTraits(courses).some((trait) => trait.scope === "PERSONAL" && trait.semanticKey === "groceries.organization"), false));

const producedKinds = new Set(positiveOutputs.flatMap(({ output }) => allTraits(output).map(({ kind }) => kind)));
check(() => assert.deepEqual([...producedKinds].sort(), [...analytics.personaTraitKindCatalog].sort()));
check(() => assert.ok(positiveOutputs.every(({ output }) => output.profiles.every(({ featuredTraits }) => featuredTraits.length === 0))));

const protectedByEngine = fixtures.filter(({ phase }) => phase === "ENGINE_ASSERTED").length;
check(() => assert.equal(protectedByEngine, fixtures.length));

console.log(`Persona golden P2 harness: ${fixtures.length}/${fixtures.length} anti-cases structurally validated (${checks} total checks).`);
console.log(`Persona golden positive cases: ${positiveFixtures.length}/${positiveFixtures.length} passed.`);
console.log(`Persona golden engine protections: ${protectedByEngine}/${fixtures.length} passed; 0 pending P2/P3.`);
console.log("PERSONA_GOLDEN_HARNESS=PASS");
console.log("PERSONA_GOLDEN_ENGINE=PASS");
