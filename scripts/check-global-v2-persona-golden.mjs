import assert from "node:assert/strict";
import path from "node:path";
import { registerHooks } from "node:module";
import { pathToFileURL } from "node:url";

const root = process.cwd();

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "server-only") return { url: "data:text/javascript,export{}", shortCircuit: true };
    if (specifier.startsWith("@/")) specifier = pathToFileURL(path.join(root, "src", specifier.slice(2))).href;
    try { return nextResolve(specifier, context); } catch (originalError) {
      if ((!specifier.startsWith(".") && !specifier.startsWith("file:")) || /\.[cm]?[jt]sx?$/.test(specifier)) throw originalError;
      for (const candidate of [`${specifier}.ts`, `${specifier}/index.ts`]) {
        try { return nextResolve(candidate, context); } catch { /* next */ }
      }
      throw originalError;
    }
  },
});

const analytics = await import("../src/analytics/global-v2/index.ts");
const personaAdapters = await import("../src/server/analytics/global-v2-persona-signals.ts");
const m2Authority = await import("../src/server/analytics/global-v2-need-subject-authority.ts");
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
const featuredTraits = (output) => output.profiles.flatMap(({ featuredTraits: traits }) => traits);
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
  check(() => assert.ok(output.profiles.every((profile) => profile.featuredTraits.every((trait) =>
    profile.allTraits.some(({ traitId }) => traitId === trait.traitId)
    && trait.selection?.featured === true
    && trait.explanation !== undefined)), `${fixture.id} featured traits must remain explainable allTraits members`));
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
check(() => assert.ok(positiveOutputs.every(({ output }) => output.profiles.every((profile) => profile.featuredTraits.every((trait) =>
  profile.allTraits.some(({ traitId }) => traitId === trait.traitId)
  && trait.explanation?.reasonCodes.length > 0)))));

const protectedByEngine = fixtures.filter(({ phase }) => phase === "ENGINE_ASSERTED").length;
check(() => assert.equal(protectedByEngine, fixtures.length));

const sharedTechnoUnit = {
  unitId: "techno-1",
  resolution: "SHARED",
  evidenceRefs: ["m10:techno-1"],
};
const personalCostAuthority = ({ authorityId, recurrenceId, attributionState, personId, evidenceRefs, typicalOccurrenceAmount, supportStatus = "SUFFICIENT" }) => ({
  authorityId,
  policyRef: "global-m1-personal-cost-authority@v1",
  recurrenceId,
  economicEntityRef: `recurrence:${recurrenceId}`,
  attributionState,
  ...(personId === undefined ? {} : { personId }),
  coverage: { eligibleOccurrenceCount: 2, attributedOccurrenceCount: attributionState === "UNKNOWN" ? 0 : 2, fullyCertifiedOccurrenceCount: attributionState === "PERSONAL" ? 2 : 0, eligibleAbsoluteAmount: "39.98", attributedAbsoluteAmount: attributionState === "UNKNOWN" ? "0" : "39.98", amountRatio: attributionState === "UNKNOWN" ? 0 : 1, occurrenceRatio: attributionState === "PERSONAL" ? 1 : 0 },
  support: { observedOccurrences: supportStatus === "SUFFICIENT" ? 2 : 1, minimumRequired: 2, status: supportStatus, policyRef: "global-m1-personal-cost-authority@v1" },
  ...(typicalOccurrenceAmount === undefined ? {} : { typicalOccurrenceAmount }),
  lifecycle: { status: "KNOWN", value: "ACTIVE" },
  detailRef: { resource: "analysis_global_economic_recurrence_detail", entityRef: `recurrence:${recurrenceId}`, role: "PRIMARY" },
  evidenceRefs,
  inputHash: authorityId.padEnd(64, "0").slice(0, 64),
});
const adapterInput = {
  householdId: household,
  personIds: [adrien, manon],
  displayNamesByPersonId: { [adrien]: "Adrien", [manon]: "Manon" },
  m1: { recurrences: {
    series: [
      { recurrenceId: "card-only" },
      { recurrenceId: "beneficiary-without-proof" },
      { recurrenceId: "beneficiary-not-payer" },
      { recurrenceId: "single-beneficiary" },
      { recurrenceId: "91e58dd4-1a8d-536f-a841-eff33c136228" },
      { recurrenceId: "b2abae46-3378-5f09-897c-7c44eed28073" },
      { recurrenceId: "24c0cb89-34bf-5e2a-881d-4d4f9f7b694a" },
      { recurrenceId: "6ceae158-ebba-5208-9d41-85eac3bd4dde" },
    ],
    personalCostAuthorities: [
      personalCostAuthority({ authorityId: "card-only", recurrenceId: "card-only", attributionState: "UNKNOWN", evidenceRefs: [] }),
      personalCostAuthority({ authorityId: "beneficiary-without-proof", recurrenceId: "beneficiary-without-proof", attributionState: "PERSONAL", personId: adrien, evidenceRefs: [], typicalOccurrenceAmount: "12" }),
      personalCostAuthority({ authorityId: "beneficiary-not-payer", recurrenceId: "beneficiary-not-payer", attributionState: "PERSONAL", personId: manon, evidenceRefs: ["beneficiary:manon"], typicalOccurrenceAmount: "19.99" }),
      personalCostAuthority({ authorityId: "single-beneficiary", recurrenceId: "single-beneficiary", attributionState: "PERSONAL", personId: adrien, evidenceRefs: ["beneficiary:single"], typicalOccurrenceAmount: "11", supportStatus: "INSUFFICIENT" }),
    ],
  } },
  m2: { result: { needs: { groups: [
    { key: "groceries", dimension: { status: "KNOWN", id: "courses_alimentaires_foyer", evidenceRefs: ["need:courses"] }, subject: { scope: "HOUSEHOLD" }, activeMonths: 12, monthlyAmount: "400", typicalAmount: "380", annualAmount: "4560", evidenceRefs: ["m2:courses"] },
    { key: "work-meal", dimension: { status: "KNOWN", id: "repas_travail_personne_a", evidenceRefs: ["need:work-meal"] }, subject: { scope: "PERSONAL", personId: adrien }, activeMonths: 11, monthlyAmount: "120", typicalAmount: "100", annualAmount: "1320", evidenceRefs: ["m2:work-meal"] },
    { key: "vape", dimension: { status: "KNOWN", id: "vape_personne_a", evidenceRefs: ["need:vape"] }, subject: { scope: "PERSONAL", personId: adrien }, activeMonths: 10, monthlyAmount: "45", typicalAmount: "40", annualAmount: "450", evidenceRefs: ["m2:vape"] },
    { key: "beauty", dimension: { status: "KNOWN", id: "beaute_personne_b", evidenceRefs: ["need:beauty"] }, subject: { scope: "PERSONAL", personId: manon }, activeMonths: 12, monthlyAmount: "32", typicalAmount: "30", annualAmount: "384", evidenceRefs: ["m2:beauty"] },
    { key: "excluded", dimension: { status: "KNOWN", id: "need_outside_household", evidenceRefs: ["need:outside"] }, subject: { scope: "CONFLICT" }, activeMonths: 12, monthlyAmount: "99", typicalAmount: "90", annualAmount: "1188", evidenceRefs: ["m2:outside"] },
  ] } } },
  m4: {
    rhythms: [
      { activityId: "travail_site", personId: adrien, includedOccurrenceCount: 69, eligibleObservableDays: 200, rate: { status: "KNOWN", value: "0.345" }, cadence: { status: "KNOWN", medianIntervalDays: "2" }, support: { supportStatus: "SUFFICIENT", occurrenceCount: 69 }, dependencyRefs: ["m4:onsite-adrien"] },
      { activityId: "travail_site", personId: manon, includedOccurrenceCount: 0, eligibleObservableDays: 200, rate: { status: "KNOWN", value: "0" }, support: { supportStatus: "SUFFICIENT", occurrenceCount: 0 }, dependencyRefs: ["m4:onsite-zero"] },
    ],
    routinePatterns: [
      { routineId: "work-ange-work", scope: "PERSON", personId: adrien, eligibilityContext: "ONSITE_WORK", coreTokens: ["DAY_CONTEXT:WORK", "ACTIVITY:ANGE", "DAY_CONTEXT:WORK"], optionalTokens: [], occurrenceCount: 39, prevalence: 0.565, certificationStatus: "CERTIFIED", strength: "STRONG", evidenceRefs: ["routine:work-ange-work"] },
    ],
  },
  m6: { summaries: [] },
  m7: {
    mobilityCapabilities: { routeDistance: { state: "UNAVAILABLE", reasonCodes: ["AUTHORITY_NOT_PROVEN_GA0"] } },
    mobility: { legs: [], routes: [] },
    personPlaceRollups: [{ entityRef: "person-place:fixture-rollup", personId: adrien, placeId: "place-a", visitCount: 3, distinctVisitDays: 2, firstObservedDate: "2026-01-02", lastObservedDate: "2026-01-03", medianDurationMinutes: 35, support: { status: "SUFFICIENT", observedUnits: 2, minimumRequired: 2, policyRef: "global-m7-person-place-support@v1" }, knowledgeState: "KNOWN" }],
    personPlaceReturnPatterns: [{ entityRef: "person-place-return:fixture-pattern", personId: manon, originPlaceId: "place-a", stopPlaceId: "place-b", destinationPlaceId: "place-a", occurrenceCount: 4, distinctDayCount: 3, firstObservedDate: "2026-02-01", lastObservedDate: "2026-02-04", support: { status: "SUFFICIENT", observedUnits: 4, minimumRequired: 2, policyRef: "global-m7-person-place-support@v1" }, knowledgeState: "KNOWN" }],
  },
  m8: { capabilities: { products: { state: "UNAVAILABLE", reasonCode: "DEFERRED_P10" } } },
  productObservations: [
    { observationId: "mascara-1", subject: { kind: "PERSON", personId: manon }, needKey: "maquillage_manon_mascara", productKey: "benefit_badgal_bang", observedAt: "2026-01-01", price: "31", family: "PERSONAL_CARE", groupKey: "beauty_and_care", evidenceRefs: ["product:mascara-1"] },
    { observationId: "mascara-2", subject: { kind: "PERSON", personId: manon }, needKey: "maquillage_manon_mascara", productKey: "benefit_fan_fest", observedAt: "2026-03-07", price: "33", family: "PERSONAL_CARE", groupKey: "beauty_and_care", evidenceRefs: ["product:mascara-2"] },
  ],
  m10: {
    units: [sharedTechnoUnit],
    universes: [{
      universeId: "activity:techno", grain: "OCCURRENCE",
      support: { eligibleUnits: 2, resolvedUnits: 1, unresolvedUnits: 1, conflictUnits: 0, sharedUnits: 1, sharedObservableCoverage: 0.5, sharedRate: 1, knowledgeState: "UNKNOWN" },
      sharedUnits: [sharedTechnoUnit],
    }],
  },
  differences: [],
  certifiedThrough: "2026-07-31",
};

const upstreamM10Snapshot = structuredClone(adapterInput.m10);
const adapted = personaAdapters.buildGlobalV2PersonaSignals(adapterInput);
const { productObservations: _omittedProductObservations, ...adapterInputWithoutProductProvider } = adapterInput;
const adaptedWithoutProductProvider = personaAdapters.buildGlobalV2PersonaSignals(adapterInputWithoutProductProvider);
const adaptedTraits = allTraits(adapted.profile);
const adaptedBySignalId = new Map(adapted.signals.map((signal) => [signal.signalId, signal]));
const beneficiarySignal = adaptedBySignalId.get("m1:personal-cost:beneficiary-not-payer");
check(() => assert.equal(adaptedBySignalId.has("m1:personal-cost:card-only"), false));
check(() => assert.equal(adaptedBySignalId.has("m1:personal-cost:beneficiary-without-proof"), false));
check(() => assert.equal(adaptedBySignalId.has("m1:personal-cost:single-beneficiary"), false));
check(() => assert.equal(beneficiarySignal.subject.kind, "PERSON"));
check(() => assert.equal(beneficiarySignal.subject.personId, manon));
check(() => assert.equal(beneficiarySignal.beneficiaryPersonId, manon));
check(() => assert.equal(beneficiarySignal.entityRef, "recurrence:beneficiary-not-payer"));
check(() => assert.deepEqual(beneficiarySignal.evidenceRefs, ["beneficiary-not-payer", "recurrence:beneficiary-not-payer"]));
check(() => assert.equal(adapted.signals.filter(({ signalType }) => signalType === "PERSONAL_COST").length, 1));
const expectedPersonalServiceUsage = new Map([
  ["subscription.chatgpt.adrien", "recurrence:91e58dd4-1a8d-536f-a841-eff33c136228"],
  ["subscription.qobuz.adrien", "recurrence:b2abae46-3378-5f09-897c-7c44eed28073"],
  ["subscription.max.manon", "recurrence:24c0cb89-34bf-5e2a-881d-4d4f9f7b694a"],
  ["subscription.netflix.manon", "recurrence:6ceae158-ebba-5208-9d41-85eac3bd4dde"],
]);
for (const [semanticKey, entityRef] of expectedPersonalServiceUsage) {
  const usage = adapted.signals.find((signal) => signal.signalType === "DECLARED" && signal.semanticKey === semanticKey);
  const usageTrait = adaptedTraits.find((trait) => trait.semanticKey === semanticKey);
  check(() => assert.ok(usage));
  check(() => assert.equal(usage.authority, "USER_VALIDATED"));
  check(() => assert.equal(usage.dimension, "USAGE"));
  check(() => assert.equal(usage.value, "PERSONAL_USAGE"));
  check(() => assert.equal(usage.entityRef, entityRef));
  check(() => assert.deepEqual(usageTrait.entityRefs, [entityRef]));
  check(() => assert.equal(usageTrait.dimensions.includes("FINANCE"), false));
  check(() => assert.ok(usage.limitations.includes("PERSONAL_PAYMENT_NOT_ESTABLISHED")));
  check(() => assert.ok(usage.limitations.includes("PERSONAL_BENEFICIARY_COST_NOT_ESTABLISHED")));
  check(() => assert.equal(adapted.signals.some((signal) => signal.signalType === "PERSONAL_COST" && signal.semanticKey === semanticKey), false));
}
const adapterInputWithoutServiceRecurrences = structuredClone(adapterInput);
adapterInputWithoutServiceRecurrences.m1.recurrences.series = adapterInputWithoutServiceRecurrences.m1.recurrences.series
  .filter(({ recurrenceId }) => ![...expectedPersonalServiceUsage.values()].includes(`recurrence:${recurrenceId}`));
const usageWithoutObservedService = personaAdapters.buildGlobalV2PersonaSignals(adapterInputWithoutServiceRecurrences);
for (const semanticKey of expectedPersonalServiceUsage.keys()) {
  const usage = usageWithoutObservedService.signals.find((signal) => signal.signalType === "DECLARED" && signal.semanticKey === semanticKey);
  check(() => assert.ok(usage));
  check(() => assert.equal(usage.entityRef, undefined));
  check(() => assert.ok(usage.limitations.includes("HOUSEHOLD_SUBSCRIPTION_NOT_OBSERVED")));
}
check(() => assert.equal(adapted.signals.some(({ signalType, semanticKey }) => signalType === "PERSONAL_COST" && semanticKey.includes("chatgpt")), false));
check(() => assert.doesNotMatch(personaAdapters.buildGlobalPersonaDeclaredSignalsV1.toString(), /merchant|labelRef|toLowerCase|\.includes\(/u));
check(() => assert.doesNotMatch(personaAdapters.adaptGlobalM1PersonalCostSignals.toString(), /payer|card|merchant|displayName|personaUsage|OpenAI|Ornikar|Coiffeur/u));
const householdNeed = adaptedBySignalId.get("m2:need:courses_alimentaires_foyer");
check(() => assert.equal(householdNeed.subject.kind, "HOUSEHOLD"));
check(() => assert.equal(householdNeed.scope, "HOUSEHOLD"));
check(() => assert.equal(householdNeed.needKey, "courses_alimentaires_foyer"));
const workMealNeed = adaptedBySignalId.get("m2:need:repas_travail_personne_a");
const vapeNeed = adaptedBySignalId.get("m2:need:vape_personne_a");
const beautyNeed = adaptedBySignalId.get("m2:need:beaute_personne_b");
check(() => assert.deepEqual({ kind: workMealNeed.subject.kind, personId: workMealNeed.subject.personId, scope: workMealNeed.scope }, { kind: "PERSON", personId: adrien, scope: "PERSONAL" }));
check(() => assert.deepEqual({ kind: vapeNeed.subject.kind, personId: vapeNeed.subject.personId, scope: vapeNeed.scope }, { kind: "PERSON", personId: adrien, scope: "PERSONAL" }));
check(() => assert.deepEqual({ kind: beautyNeed.subject.kind, personId: beautyNeed.subject.personId, scope: beautyNeed.scope }, { kind: "PERSON", personId: manon, scope: "PERSONAL" }));
check(() => assert.equal(workMealNeed.entityRef, "need:repas_travail_personne_a"));
check(() => assert.deepEqual(workMealNeed.metrics, { activeMonths: 11, annualAmount: "1320", monthlyAmount: "120", typicalAmount: "100" }));
check(() => assert.equal(adaptedBySignalId.has("m2:need:need_outside_household"), false));
const subjectResolution = m2Authority.resolveGlobalM2NeedSubjects([
  { need_id: "canonical-personal", person_id: adrien, personne_concernee: "Texte contradictoire" },
  { need_id: "canonical-household", personne_concernee: "Nom affiché sans autorité" },
  { need_id: "canonical-outside", person_id: uuid(99), personne_concernee: "Adrien" },
  { need_id: "canonical-invalid", person_id: "Adrien" },
], [adrien, manon]);
check(() => assert.deepEqual(subjectResolution["canonical-personal"], { scope: "PERSONAL", personId: adrien }));
check(() => assert.deepEqual(subjectResolution["canonical-household"], { scope: "HOUSEHOLD" }));
check(() => assert.deepEqual(subjectResolution["canonical-outside"], { scope: "CONFLICT" }));
check(() => assert.deepEqual(subjectResolution["canonical-invalid"], { scope: "CONFLICT" }));
check(() => assert.doesNotMatch(m2Authority.resolveGlobalM2NeedSubjects.toString(), /personne_concernee|displayName|merchant|category|Adrien|Manon/u));
check(() => assert.doesNotMatch(personaAdapters.adaptGlobalM2NeedSignals.toString(), /personne_concernee|displayName|merchant|category|Adrien|Manon/u));
const m10Signal = adapted.signals.find((signal) => signal.signalType === "SHARED_ACTIVITY" && signal.semanticKey === "techno");
check(() => assert.ok(m10Signal));
check(() => assert.equal(m10Signal.sourceModule, "M10"));
check(() => assert.equal(m10Signal.metrics.sharedOccurrences, 1));
check(() => assert.deepEqual(adapterInput.m10, upstreamM10Snapshot));
const technoTraits = adaptedTraits.filter((trait) => trait.semanticKey === "techno" && trait.scope === "SHARED");
check(() => assert.equal(technoTraits.length, 1));
check(() => assert.ok(technoTraits[0].sourceModules.includes("M10")));
check(() => assert.ok(technoTraits[0].sourceModules.includes("DECLARED_V1")));
const productSignals = adapted.signals.filter((signal) => signal.signalType === "PRODUCT_CYCLE" && signal.needKey === "maquillage_manon_mascara");
check(() => assert.equal(productSignals.length, 1));
check(() => assert.equal(productSignals[0].referenceChanged, true));
check(() => assert.equal(productSignals[0].productKey, undefined));
check(() => assert.equal(productSignals[0].metrics.occurrenceCount, 2));
check(() => assert.equal(productSignals[0].metrics.medianGapDays, 65));
check(() => assert.equal(productSignals[0].metrics.typicalPrice, 32));
check(() => assert.equal(productSignals[0].metrics.firstObservedDate, "2026-01-01"));
check(() => assert.equal(productSignals[0].metrics.lastObservedDate, "2026-03-07"));
check(() => assert.equal(productSignals[0].metrics.referenceState, "CHANGED_PRODUCT"));
check(() => assert.equal(Object.hasOwn(productSignals[0].metrics, "distinctProductCount"), false));
check(() => assert.equal(productSignals[0].semanticKey, "product-need:maquillage_manon_mascara"));
check(() => assert.equal(adapted.capabilities.productCycleRuntime.state, "CONNECTED"));
check(() => assert.equal(adapted.capabilities.productCycleRuntime.source, "product_observations"));
check(() => assert.ok(adapted.limitations.includes("M8_PRODUCT_CYCLE_ENGINE_UNAVAILABLE_USING_DESCRIPTIVE_FALLBACK")));
check(() => assert.equal(adaptedWithoutProductProvider.capabilities.productCycleRuntime.state, "UNAVAILABLE"));
check(() => assert.ok(adaptedWithoutProductProvider.limitations.includes("M8_PRODUCT_OBSERVATION_PROVIDER_UNAVAILABLE")));
check(() => assert.equal(adaptedWithoutProductProvider.signals.some((signal) => signal.signalType === "PRODUCT_CYCLE"), false));
const placeRollupSignal = adaptedBySignalId.get("m7:person-place:person-place:fixture-rollup");
const returnPatternSignal = adaptedBySignalId.get("m7:person-place-return:person-place-return:fixture-pattern");
check(() => assert.deepEqual({ subject: placeRollupSignal.subject, scope: placeRollupSignal.scope, entityRef: placeRollupSignal.entityRef }, { subject: { kind: "PERSON", personId: adrien }, scope: "PERSONAL", entityRef: "person-place:fixture-rollup" }));
check(() => assert.deepEqual(placeRollupSignal.metrics, { distinctVisitDays: 2, medianDurationMinutes: 35, visitCount: 3 }));
check(() => assert.deepEqual({ subject: returnPatternSignal.subject, scope: returnPatternSignal.scope, entityRef: returnPatternSignal.entityRef }, { subject: { kind: "PERSON", personId: manon }, scope: "PERSONAL", entityRef: "person-place-return:fixture-pattern" }));
check(() => assert.deepEqual(returnPatternSignal.metrics, { distinctDayCount: 3, returnCount: 4 }));
const placeRollupTrait = adaptedTraits.find(({ semanticKey }) => semanticKey === "person-place:place-a");
check(() => assert.deepEqual(placeRollupTrait.sourceModules, ["M7"]));
check(() => assert.equal(placeRollupTrait.context, "PERSON_PLACE_ROLLUP"));
check(() => assert.equal(placeRollupTrait.semanticKey.includes("travail_site"), false));
check(() => assert.equal(adapted.profile.profiles.flatMap(({ featuredTraits }) => featuredTraits).some(({ entityRefs }) => entityRefs?.some((entityRef) => entityRef.startsWith("person-place")) === true), false));
check(() => assert.doesNotMatch(personaAdapters.adaptGlobalM7PlaceReferenceSignals.toString(), /displayName|placeLabel|Adrien|Manon|WORK_MEAL|LUNCH/u));

const resolvedProductObservations = await personaAdapters.resolveGlobalPersonaProductObservations({
  repository: {
    context: { personIds: [manon] },
    async loadPersonaProductObservationRows() {
      return [{
        observation_id: "observation-live-shape",
        date_achat: "2026-07-16",
        operation_id: "operation-live-shape",
        product_key: "benefit_badgal_bang_8_5g",
        need_key: "maquillage_manon_mascara",
        person_id: manon,
        source_enrichissement: "document_utilisateur",
        need_id: "need-mascara",
        persona_price: "32",
      }];
    },
  },
  certifiedThrough: "2026-07-31",
});
check(() => assert.equal(resolvedProductObservations.length, 1));
check(() => assert.deepEqual(resolvedProductObservations[0].subject, { kind: "PERSON", personId: manon }));
check(() => assert.equal(resolvedProductObservations[0].needKey, "maquillage_manon_mascara"));
check(() => assert.equal(resolvedProductObservations[0].productKey, "benefit_badgal_bang_8_5g"));
check(() => assert.equal(resolvedProductObservations[0].observedAt, "2026-07-16"));
check(() => assert.equal(resolvedProductObservations[0].price, "32"));
check(() => assert.deepEqual(resolvedProductObservations[0].evidenceRefs, [
  "need:need-mascara",
  "operation:operation-live-shape",
  "product-observation-source:document_utilisateur",
  "product-observation:observation-live-shape",
]));
const manonCommute = adaptedTraits.find((trait) => trait.semanticKey === "mobility.work.manon");
const adrienCommute = adaptedTraits.find((trait) => trait.semanticKey === "mobility.work.adrien");
check(() => assert.ok(["DISTANCE_UNKNOWN", "FUEL_COST_UNKNOWN", "WORK_COST_SHARE_UNKNOWN"].every((limitation) => manonCommute.limitations.includes(limitation))));
check(() => assert.deepEqual(manonCommute.metrics ?? {}, {}));
check(() => assert.equal(adrienCommute.metrics.directCost, 0));
check(() => assert.equal(Object.keys(adrienCommute.metrics).some((key) => /distance|fuel|annual|year/i.test(key)), false));
const householdCar = adaptedTraits.find((trait) => trait.semanticKey === "vehicle.peugeot_207");
check(() => assert.equal(householdCar.scope, "HOUSEHOLD"));
check(() => assert.ok(householdCar.limitations.includes("CANONICAL_VEHICLE_AUTHORITY_UNAVAILABLE")));
check(() => assert.equal(adaptedTraits.some((trait) => trait.semanticKey === "vehicle.peugeot_207" && trait.scope === "PERSONAL"), false));
const groceriesAdapterTrait = adaptedTraits.find((trait) => trait.semanticKey === "groceries.organization");
check(() => assert.equal(groceriesAdapterTrait.scope, "HOUSEHOLD"));
check(() => assert.deepEqual(groceriesAdapterTrait.qualifications, ["ADRIEN_SMALL_LOCAL_GROCERIES", "MANON_LARGE_GROCERIES"]));
check(() => assert.equal(adaptedTraits.some((trait) => trait.semanticKey === "household.has_pet" || trait.groupKey === "household.pet"), false));
check(() => assert.ok(adaptedTraits.some((trait) => trait.semanticKey === "gaming" && trait.scope === "SHARED")));
check(() => assert.ok(adaptedTraits.some((trait) => trait.semanticKey === "creative.photo.adrien" && trait.temporalStatus === "PROJECT")));
const declaredLicence = adaptedTraits.find((trait) => trait.semanticKey === "driving_license.adrien");
check(() => assert.ok(declaredLicence));
check(() => assert.equal(declaredLicence.scope, "PERSONAL"));
check(() => assert.equal(declaredLicence.kind, "PROJECT"));
check(() => assert.equal(declaredLicence.family, "MOBILITY"));
check(() => assert.equal(declaredLicence.temporalStatus, "PROJECT"));
check(() => assert.equal(declaredLicence.knowledgeStatus, "USER_VALIDATED"));
check(() => assert.deepEqual(declaredLicence.qualifications, ["IN_PROGRESS"]));
check(() => assert.equal(declaredLicence.qualifications.includes("OBTAINED"), false));
check(() => assert.equal(declaredLicence.metrics, undefined));
const declaredCreativeSupport = adaptedTraits.find((trait) => trait.semanticKey === "creative.projects.adrien");
check(() => assert.ok(declaredCreativeSupport));
check(() => assert.equal(declaredCreativeSupport.kind, "UNIVERSE"));
check(() => assert.equal(declaredCreativeSupport.temporalStatus, "UNKNOWN"));
check(() => assert.deepEqual(declaredCreativeSupport.qualifications, ["PHOTO", "MUSIC", "HOME_STUDIO"]));
check(() => assert.equal(declaredCreativeSupport.metrics, undefined));
check(() => assert.ok(declaredCreativeSupport.limitations.includes("CADENCE_NOT_DECLARED")));
const declaredCreativeUniverse = adaptedTraits.find((trait) => trait.semanticKey === "universe.creative_projects");
check(() => assert.ok(declaredCreativeUniverse));
check(() => assert.deepEqual(declaredCreativeUniverse.children.map(({ semanticKey }) => semanticKey), ["creative.photo.adrien", "creative.projects.adrien"]));
check(() => assert.ok(["HOME_STUDIO", "MUSIC", "PHOTO"].every((example) => declaredCreativeUniverse.qualifications.includes(example))));
check(() => assert.ok(adapted.profile.profiles.find((profile) => profile.scope === "PERSONAL" && profile.subject.personId === adrien)
  .featuredTraits.some(({ traitId }) => traitId === declaredCreativeUniverse.traitId)));
check(() => assert.equal(adaptedTraits.some((trait) => ["creative.music.adrien", "creative.home_studio.adrien"].includes(trait.semanticKey)), false));
check(() => assert.equal(adaptedTraits.some((trait) => trait.semanticKey.startsWith("creative.")
  && Object.keys(trait.metrics ?? {}).some((key) => /cadence|recent|spend|amount/i.test(key))), false));
check(() => assert.ok(adaptedTraits.some((trait) => trait.semanticKey === "subscription.chatgpt.adrien" && trait.scope === "PERSONAL")));
check(() => assert.equal(adaptedTraits.filter((trait) => trait.semanticKey === "routine:work-ange-work").length, 1));
check(() => assert.equal(adapted.signals.some((signal) => signal.signalId === `m4:rhythm:${manon}:travail_site`), false));
check(() => assert.ok(adapted.profile.profiles.every((profile) => profile.featuredTraits.every((trait) =>
  profile.allTraits.some(({ traitId }) => traitId === trait.traitId)
  && trait.explanation !== undefined
  && trait.selection?.methodVersion === analytics.GLOBAL_PERSONA_SELECTION_METHOD_VERSION))));
check(() => assert.ok(adapted.limitations.includes("M7_ROUTE_DISTANCE_AND_COST_AUTHORITY_UNAVAILABLE")));
check(() => assert.equal(adapted.adapterVersion, "global_persona_signal_adapter@v1"));

// P4 — grouping, featured selection and structured explainability.
check(() => assert.equal(analytics.GLOBAL_PERSONA_SELECTION_METHOD_VERSION, "global_persona_selection@v1"));
check(() => assert.equal(analytics.GLOBAL_PERSONA_GROUPING_CATALOG_VERSION, "global_persona_grouping_catalog@v1"));
const groupedGaming = traitByKey(engineOutputs.get("P1-PS5-PAYER-NOT-USER"), "gaming", "SHARED");
const groupedTechno = traitByKey(engineOutputs.get("P1-TECHNO-SHARED-WITHOUT-M10-REWRITE"), "techno", "SHARED");
check(() => assert.equal(groupedGaming.scope, "SHARED"));
check(() => assert.equal(groupedTechno.scope, "SHARED"));
check(() => assert.equal(adaptedTraits.some((trait) => trait.scope === "PERSONAL" && ["gaming", "techno"].includes(trait.semanticKey)), false));
check(() => assert.ok(adaptedTraits.some((trait) => trait.scope === "HOUSEHOLD" && trait.semanticKey === "groceries.organization")));

const beautySignals = [
  ["mascara", "beauty.mascara", "maquillage_manon_mascara"],
  ["brows", "beauty.brows", "maquillage_manon_sourcils"],
  ["epilation", "beauty.epilation", "epilation_manon"],
  ["skincare", "beauty.skincare", "skincare_manon_masque"],
].map(([id, semanticKey, needKey]) => ({
  signalId: `p4:beauty:${id}`,
  signalType: "PRODUCT_CYCLE",
  semanticKey,
  ...personal(manon),
  needKey,
  family: "PERSONAL_CARE",
  authority: "OBSERVED",
  temporalStatus: "STABLE",
  sourceModule: "M8",
  metrics: { occurrenceCount: 2 },
  evidenceRefs: [`product:${id}`],
}));
const beautyProfile = analytics.buildPersonaProfile({ signals: beautySignals });
const beautyUniverse = traitByKey(beautyProfile, "universe.beauty_and_care", "PERSONAL");
check(() => assert.ok(beautyUniverse));
check(() => assert.deepEqual(beautyUniverse.children.map(({ semanticKey }) => semanticKey), ["beauty.brows", "beauty.epilation", "beauty.mascara", "beauty.skincare"]));
check(() => assert.ok(beautyUniverse.children.every(({ traitId }) => allTraits(beautyProfile).some((trait) => trait.traitId === traitId))));
check(() => assert.ok(featuredTraits(beautyProfile).some(({ traitId }) => traitId === beautyUniverse.traitId)));
check(() => assert.equal(featuredTraits(beautyProfile).some(({ traitId }) => beautyUniverse.children.some((child) => child.traitId === traitId)), false));
check(() => assert.deepEqual(beautyUniverse.explanation, undefined));
const featuredBeauty = featuredTraits(beautyProfile).find(({ traitId }) => traitId === beautyUniverse.traitId);
check(() => assert.deepEqual(featuredBeauty.explanation.children.map(({ traitId }) => traitId), beautyUniverse.children.map(({ traitId }) => traitId)));
check(() => assert.ok(featuredBeauty.explanation.reasonCodes.includes("EXPLICIT_UNIVERSE_WITH_REAL_CHILDREN")));

const partialBeautySignals = [
  ["mascara", "maquillage_manon_mascara"],
  ["brows", "maquillage_manon_sourcils"],
].map(([id, needKey]) => ({
  signalId: `p4:runtime:${id}`,
  signalType: "PRODUCT_CYCLE",
  semanticKey: `product-need:${needKey}`,
  ...personal(manon),
  needKey,
  family: "PERSONAL_CARE",
  authority: "OBSERVED",
  sourceModule: "PRODUCT_OBSERVATIONS",
  metrics: { occurrenceCount: 2 },
  evidenceRefs: [`product-observation:${id}`],
}));
const partialBeauty = analytics.buildPersonaProfile({ signals: partialBeautySignals });
const partialBeautyUniverse = traitByKey(partialBeauty, "universe.beauty_and_care", "PERSONAL");
check(() => assert.deepEqual(partialBeautyUniverse.children.map(({ semanticKey }) => semanticKey), [
  "product-need:maquillage_manon_mascara",
  "product-need:maquillage_manon_sourcils",
]));
check(() => assert.equal(partialBeautyUniverse.children.some(({ semanticKey }) => /epilation|skincare/.test(semanticKey)), false));

const creativeSignals = [
  { signalId: "p4:creative:photo", signalType: "MOMENT", semanticKey: "creative.photo.adrien", ...personal(adrien), momentRef: "photo-project", kind: "PROJECT", family: "LEISURE_AND_ACTIVITIES", authority: "USER_VALIDATED", temporalStatus: "PROJECT", sourceModule: "M6", evidenceRefs: ["moment:photo"] },
  { signalId: "p4:creative:music", signalType: "MOMENT", semanticKey: "creative.music.adrien", ...personal(adrien), momentRef: "home-studio", kind: "PROJECT", family: "LEISURE_AND_ACTIVITIES", authority: "USER_VALIDATED", temporalStatus: "PROJECT", sourceModule: "M6", evidenceRefs: ["moment:music"] },
];
const creativeProfile = analytics.buildPersonaProfile({ signals: creativeSignals });
const creativeUniverse = traitByKey(creativeProfile, "universe.creative_projects", "PERSONAL");
check(() => assert.deepEqual(creativeUniverse.children.map(({ semanticKey }) => semanticKey), ["creative.music.adrien", "creative.photo.adrien"]));
check(() => assert.ok(featuredTraits(creativeProfile).some(({ traitId }) => traitId === creativeUniverse.traitId)));

const digitalSignals = [
  ["chatgpt", "subscription.chatgpt.adrien"],
  ["qobuz", "subscription.qobuz.adrien"],
  ["lightroom", "subscription.lightroom.adrien"],
].map(([id, semanticKey]) => ({
  signalId: `p4:digital:${id}`,
  signalType: "DECLARED",
  semanticKey,
  ...personal(adrien),
  action: "AFFIRM",
  value: true,
  kind: "HABIT",
  family: "DIGITAL_AND_SUBSCRIPTIONS",
  authority: "USER_VALIDATED",
  sourceModule: "DECLARED",
  evidenceRefs: [`declaration:${id}`],
}));
const digitalProfile = analytics.buildPersonaProfile({ signals: digitalSignals });
check(() => assert.equal(allTraits(digitalProfile).some(({ kind }) => kind === "UNIVERSE"), false));
check(() => assert.deepEqual(allTraits(digitalProfile).map(({ semanticKey }) => semanticKey), digitalSignals.map(({ semanticKey }) => semanticKey).sort()));

const manualTrait = (overrides) => ({
  traitId: "persona-trait:manual",
  semanticKey: "manual.trait",
  ...personal(adrien),
  kind: "ROUTINE",
  family: "WORK_AND_DAY_CONTEXT",
  authority: "OBSERVED",
  authorities: ["OBSERVED"],
  knowledgeStatus: "OBSERVED",
  temporalStatus: "STABLE",
  dimensions: ["USAGE"],
  signalRefs: ["manual:signal"],
  evidenceRefs: ["manual:evidence"],
  sourceModules: ["M4"],
  limitations: [],
  ...overrides,
});
const threeStrong = [0, 1, 2].map((index) => manualTrait({
  traitId: `persona-trait:strong:${index}`,
  semanticKey: `strong.${index}`,
  authority: "USER_VALIDATED",
  authorities: ["USER_VALIDATED"],
  knowledgeStatus: "USER_VALIDATED",
  signalRefs: [`strong:${index}`],
  evidenceRefs: [`strong:evidence:${index}`],
}));
check(() => assert.equal(analytics.selectFeaturedPersonaTraits({ allTraits: threeStrong }).length, 3));

const challenger = manualTrait({ traitId: "persona-trait:a-challenger", semanticKey: "stable.challenger" });
const incumbent = manualTrait({ traitId: "persona-trait:z-incumbent", semanticKey: "stable.incumbent" });
check(() => assert.equal(analytics.selectFeaturedPersonaTraits({ allTraits: [incumbent, challenger], maxFeatured: 1 })[0].traitId, challenger.traitId));
check(() => assert.equal(analytics.selectFeaturedPersonaTraits({ allTraits: [incumbent, challenger], previousFeaturedTraits: [incumbent], maxFeatured: 1 })[0].traitId, incumbent.traitId));
const strongChallenger = manualTrait({ traitId: "persona-trait:strong-challenger", semanticKey: "stable.strong-challenger", authority: "USER_VALIDATED", authorities: ["USER_VALIDATED"], knowledgeStatus: "USER_VALIDATED" });
check(() => assert.equal(analytics.selectFeaturedPersonaTraits({ allTraits: [incumbent, strongChallenger], previousFeaturedTraits: [incumbent], maxFeatured: 1 })[0].traitId, strongChallenger.traitId));

const deterministicSignals = [...beautySignals, ...creativeSignals];
check(() => assert.deepEqual(
  analytics.buildPersonaProfile({ signals: [...deterministicSignals].reverse() }),
  analytics.buildPersonaProfile({ signals: deterministicSignals }),
));

const scopeProfile = analytics.buildPersonaProfile({ signals: [
  { signalId: "p4:scope:shared", signalType: "DECLARED", semanticKey: "scope.example", ...shared, action: "AFFIRM", value: true, kind: "UNIVERSE", family: "LEISURE_AND_ACTIVITIES", authority: "USER_VALIDATED", sourceModule: "DECLARED", evidenceRefs: ["scope:shared"] },
  { signalId: "p4:scope:household", signalType: "DECLARED", semanticKey: "scope.example", ...householdScope, action: "AFFIRM", value: true, kind: "UNIVERSE", family: "LEISURE_AND_ACTIVITIES", authority: "USER_VALIDATED", sourceModule: "DECLARED", evidenceRefs: ["scope:household"] },
] });
check(() => assert.deepEqual(scopeProfile.profiles.map(({ scope }) => scope).sort(), ["HOUSEHOLD", "SHARED"]));
check(() => assert.equal(scopeProfile.profiles.some(({ allTraits: traits }) => traits.some((trait) => trait.scope !== traits[0].scope)), false));

const differenceTraits = [0, 1, 2].map((index) => manualTrait({
  traitId: `persona-trait:difference:${index}`,
  semanticKey: `difference:${index}`,
  signalRefs: [`difference:${index}`],
  evidenceRefs: [`difference:evidence:${index}`],
  sourceModules: ["M9_HISTORICAL_DIFFERENCE"],
}));
const differenceSelection = analytics.selectFeaturedPersonaTraits({ allTraits: [...differenceTraits, ...threeStrong], maxFeatured: 4 });
check(() => assert.ok(differenceSelection.filter(({ semanticKey }) => semanticKey.startsWith("difference:")).length <= 1));
check(() => assert.ok(differenceSelection.every(({ explanation }) =>
  explanation.reasonCodes.length > 0
  && Array.isArray(explanation.authorities)
  && Array.isArray(explanation.sourceModules)
  && Array.isArray(explanation.evidenceRefs)
  && Array.isArray(explanation.limitations)
  && Array.isArray(explanation.children))));

console.log(`Persona golden P2 harness: ${fixtures.length}/${fixtures.length} anti-cases structurally validated (${checks} total checks).`);
console.log(`Persona golden positive cases: ${positiveFixtures.length}/${positiveFixtures.length} passed.`);
console.log(`Persona golden engine protections: ${protectedByEngine}/${fixtures.length} passed; 0 pending P2/P3.`);
console.log("PERSONA_GOLDEN_CORE=PASS");
console.log("PERSONA_GOLDEN_ADAPTERS=PASS");
console.log("PERSONA_GOLDEN_HARNESS=PASS");
console.log("PERSONA_GOLDEN_ENGINE=PASS");
console.log("PERSONA_GOLDEN_SELECTION=PASS");
