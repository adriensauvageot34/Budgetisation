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
    phase: "PENDING_P2_ENGINE",
    signals: [
      { signalId: "cost:ps5", signalType: "PERSONAL_COST", semanticKey: "gaming.ps5.purchase", ...personal(adrien), authority: "CANONICAL_DB", payerPersonId: adrien, evidenceRefs: ["payment:ps5"] },
      { signalId: "declared:gaming-shared", signalType: "DECLARED", semanticKey: "gaming", ...shared, action: "AFFIRM", value: true, authority: "USER_VALIDATED", evidenceRefs: ["declaration:gaming-shared"] },
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
    phase: "PENDING_P2_ENGINE",
    signals: [
      { signalId: "need:animal-looking", signalType: "NEED", semanticKey: "merchant.croc_au_bain", ...householdScope, needKey: "toilettage_animaux", active: true, authority: "CANONICAL_DB", evidenceRefs: ["merchant:Croc-au-Bain"] },
      { signalId: "declared:no-pet", signalType: "DECLARED", semanticKey: "household.has_pet", ...householdScope, action: "NEGATE", value: false, authority: "USER_VALIDATED", evidenceRefs: ["declaration:no-pet"] },
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
    phase: "PENDING_P2_ENGINE",
    signals: [
      { signalId: "routine:work-restaurant", signalType: "ROUTINE", semanticKey: "work_meal.adrien", ...personal(adrien), context: "ONSITE_WORK", pattern: ["WORK", "RESTAURANT", "WORK"], authority: "OBSERVED", evidenceRefs: ["routine:work-meal"] },
      { signalId: "shared:restaurants", signalType: "SHARED_ACTIVITY", semanticKey: "restaurant", ...shared, activityKey: "RESTAURANT", authority: "OBSERVED", metrics: { resolvedOccurrences: 146, sharedOccurrences: 4 }, evidenceRefs: ["m10:restaurant-support"] },
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
    phase: "PENDING_P2_ENGINE",
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
    phase: "PENDING_P2_ENGINE",
    signals: [
      { signalId: "need:groceries", signalType: "NEED", semanticKey: "groceries.organization", ...householdScope, needKey: "courses_alimentaires_foyer", active: true, authority: "CANONICAL_DB", evidenceRefs: ["need:groceries-household"] },
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
    phase: "PENDING_P2_ENGINE",
    signals: [
      { signalId: "mobility:207-household", signalType: "MOBILITY", semanticKey: "vehicle.peugeot_207", ...householdScope, mode: "CAR", vehicleRef: "vehicle:peugeot-207", authority: "CANONICAL_DB", evidenceRefs: ["vehicle:peugeot-207"] },
      { signalId: "declared:manon-work-car", signalType: "DECLARED", semanticKey: "mobility.work.manon", ...personal(manon), action: "AFFIRM", value: "CAR", context: "WORK_COMMUTE", authority: "USER_VALIDATED", evidenceRefs: ["declaration:manon-work-car"] },
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
    phase: "PENDING_P2_ENGINE",
    signals: [
      { signalId: "mobility:manon-commute", signalType: "MOBILITY", semanticKey: "mobility.work.manon", ...personal(manon), context: "WORK_COMMUTE", mode: "CAR", vehicleRef: "vehicle:peugeot-207", authority: "USER_VALIDATED", limitations: ["DISTANCE_UNKNOWN", "WORK_COST_SHARE_UNKNOWN"], evidenceRefs: ["declaration:manon-work-car"] },
      { signalId: "mobility:207-costs", signalType: "MOBILITY", semanticKey: "vehicle.peugeot_207.costs", ...householdScope, mode: "CAR", vehicleRef: "vehicle:peugeot-207", authority: "OBSERVED", metrics: { observedVehicleCost: 3564.35 }, evidenceRefs: ["m1:auto-costs"] },
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
    phase: "PENDING_P2_ENGINE",
    signals: [
      { signalId: "moment:photo", signalType: "MOMENT", semanticKey: "creative.photo.adrien", ...personal(adrien), momentRef: "moment:photo", temporalStatus: "HISTORICAL", authority: "OBSERVED", limitations: ["NO_RECENT_PURCHASE"], evidenceRefs: ["moment:photo-history"] },
      { signalId: "declared:photo-active", signalType: "DECLARED", semanticKey: "creative.photo.adrien", ...personal(adrien), action: "TEMPORAL_OVERRIDE", value: "PROJECT", authority: "USER_VALIDATED", evidenceRefs: ["declaration:photo-active"] },
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
    phase: "PENDING_P2_ENGINE",
    signals: [
      { signalId: "moment:driving-licence", signalType: "MOMENT", semanticKey: "driving_license.adrien", ...personal(adrien), momentRef: "project:driving-licence", kind: "PROJECT", temporalStatus: "PROJECT", authority: "OBSERVED", metrics: { observedAmount: 983.22 }, evidenceRefs: ["payment:driving-lessons"] },
      { signalId: "declared:licence-progress", signalType: "DECLARED", semanticKey: "driving_license.adrien", ...personal(adrien), action: "QUALIFY", value: "IN_PROGRESS", authority: "USER_VALIDATED", evidenceRefs: ["declaration:licence-in-progress"] },
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
    phase: "PENDING_P2_ENGINE",
    signals: [
      { signalId: "shared:techno-m10", signalType: "SHARED_ACTIVITY", semanticKey: "techno", ...shared, activityKey: "TECHNO", authority: "OBSERVED", metrics: { sharedOccurrences: 2, unresolvedOccurrences: 1 }, upstreamUnitRefs: ["m10:techno:shared-1", "m10:techno:shared-2", "m10:techno:unresolved-1"], evidenceRefs: ["m10:techno-support"] },
      { signalId: "declared:techno-shared", signalType: "DECLARED", semanticKey: "techno", ...shared, action: "AFFIRM", value: true, authority: "USER_VALIDATED", evidenceRefs: ["declaration:techno-shared"] },
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
    phase: "PENDING_P2_ENGINE",
    signals: [
      { signalId: "need:epilation", signalType: "NEED", semanticKey: "beauty.epilation", ...personal(manon), needKey: "epilation_manon", active: true, authority: "CANONICAL_DB", evidenceRefs: ["need:epilation"] },
      { signalId: "product:dermawax", signalType: "PRODUCT_CYCLE", semanticKey: "beauty.epilation", ...personal(manon), needKey: "epilation_manon", productKey: "dermawax", authority: "OBSERVED", groupKey: "beauty_and_care", evidenceRefs: ["product:dermawax"] },
      { signalId: "product:italwax", signalType: "PRODUCT_CYCLE", semanticKey: "beauty.epilation", ...personal(manon), needKey: "epilation_manon", productKey: "italwax", referenceChanged: true, authority: "OBSERVED", temporalStatus: "CHANGED", groupKey: "beauty_and_care", evidenceRefs: ["product:italwax"] },
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
    phase: "PENDING_P2_ENGINE",
    signals: [
      { signalId: "need:household-consumables", signalType: "NEED", semanticKey: "household.consumables", ...householdScope, needKey: "consommables_foyer", active: true, authority: "USER_VALIDATED", temporalStatus: "UNKNOWN", limitations: ["CADENCE_UNKNOWN", "ANNUAL_COST_UNKNOWN"], evidenceRefs: ["declaration:household-consumables"] },
      { signalId: "declared:consumables-recurrent", signalType: "DECLARED", semanticKey: "household.consumables", ...householdScope, action: "AFFIRM", value: ["lessive", "papier_toilette", "sacs_poubelle", "liquide_vaisselle", "cafe_dosettes", "gel_douche", "lames"], authority: "USER_VALIDATED", evidenceRefs: ["declaration:household-consumables"] },
    ],
    expected: {
      requiredTraits: [{ semanticKey: "household.consumables", scope: "HOUSEHOLD", kind: "HABIT", temporalStatus: "UNKNOWN", limitations: ["CADENCE_UNKNOWN", "ANNUAL_COST_UNKNOWN"] }],
      forbiddenClaims: ["exact repurchase cadence", "exact annual cost"],
      preservedSignalRefs: ["need:household-consumables"],
    },
  },
];

let checks = 0;
const check = (assertion) => { assertion(); checks += 1; };

check(() => assert.equal(analytics.PERSONA_SIGNAL_CONTRACT_VERSION, "v1"));
check(() => assert.deepEqual([...analytics.personaSignalTypeCatalog], ["PERSONAL_COST", "NEED", "ROUTINE", "PRODUCT_CYCLE", "MOMENT", "MOBILITY", "SHARED_ACTIVITY", "DIFFERENCE", "DECLARED"]));
check(() => assert.deepEqual([...analytics.personaScopeCatalog], ["PERSONAL", "SHARED", "HOUSEHOLD"]));
check(() => assert.deepEqual([...analytics.personaTraitKindCatalog], ["HABIT", "ROUTINE", "UNIVERSE", "PROJECT", "MOBILITY", "HOUSEHOLD_ORGANIZATION"]));
check(() => assert.deepEqual([...analytics.personaDeclaredSignalActionCatalog], ["AFFIRM", "QUALIFY", "TEMPORAL_OVERRIDE", "NEGATE"]));
check(() => assert.equal(fixtures.length, 12));
check(() => assert.deepEqual(fixtures.map(({ priority }) => priority), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]));
check(() => assert.equal(new Set(fixtures.map(({ id }) => id)).size, fixtures.length));

const signalIds = new Set();
for (const fixture of fixtures) {
  check(() => assert.equal(fixture.phase, "PENDING_P2_ENGINE", `${fixture.id} must not claim engine coverage during P1`));
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

const protectedByEngine = fixtures.filter(({ phase }) => phase === "ENGINE_ASSERTED").length;
check(() => assert.equal(protectedByEngine, 0, "P1 must not report unimplemented P2 protections as passing"));

console.log(`Persona golden P1 harness: ${fixtures.length}/${fixtures.length} fixtures structurally validated (${checks} contract checks).`);
console.log(`Persona golden engine protections: ${protectedByEngine}/${fixtures.length} active; ${fixtures.length - protectedByEngine} pending P2.`);
console.log("PERSONA_GOLDEN_HARNESS=PASS");
console.log("PERSONA_GOLDEN_ENGINE=PENDING_P2");
