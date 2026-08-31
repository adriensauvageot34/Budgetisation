import assert from "node:assert/strict";
import { registerHooks } from "node:module";

registerHooks({
  resolve(specifier, context, nextResolve) {
    try {
      return nextResolve(specifier, context);
    } catch (originalError) {
      if (!specifier.startsWith(".") || /\.[cm]?[jt]sx?$/.test(specifier)) throw originalError;
      for (const candidate of [`${specifier}.ts`, `${specifier}/index.ts`]) {
        try { return nextResolve(candidate, context); } catch { /* continue */ }
      }
      throw originalError;
    }
  },
});

const calendar = await import("../src/analytics/history-v2/calendar/index.ts");
const daily = await import("../src/analytics/history-v2/daily-finance/index.ts");

const uuid = (suffix) => `00000000-0000-4000-8000-${suffix.padStart(12, "0")}`;
const householdId = uuid("1");
const authority = { kind: "OBSERVED_CANONICAL", authority: "test", sourceRefs: ["fixture"] };
const knownContinuous = { status: "KNOWN", value: "CONTINUOUS" };
let checks = 0;
const check = (callback) => { callback(); checks += 1; };

check(() => {
  calendar.assertCalendarCatalogsExhaustive();
  assert.equal(Object.keys(calendar.LIFE_EVENT_ACTIVITY_CATALOG).length, 25);
  assert.equal(Object.keys(calendar.MOMENT_CATALOG).length, 20);
});
check(() => assert.throws(() => calendar.requireLifeEventCatalogEntry("unknown"), /non contractuel/));
check(() => assert.throws(() => calendar.requireMomentCatalogEntry("unknown"), /non contractuel/));

function life(overrides) {
  return {
    lifeEventId: uuid(overrides.id), typeKey: "demarche_admin", title: `LE ${overrides.id}`,
    startDate: "2026-05-12", endDate: "2026-05-12", validationStatus: "Confirmé",
    participantIds: [uuid("2")], authority, ...overrides,
  };
}
function moment(overrides) {
  return {
    momentId: uuid(overrides.id), type: "Soirée", title: `Moment ${overrides.id}`,
    startDate: "2026-05-12", endDate: "2026-05-12", participantIds: [uuid("2")],
    authority, ...overrides,
  };
}
function calendarInput(overrides = {}) {
  return {
    householdId, month: "2026-05", lifeEvents: [], moments: [], contexts: [],
    momentLifeEvents: [], sourceCompleteness: "KNOWN", ...overrides,
  };
}

const fused = calendar.buildCalendarSemanticMonthArtifact(calendarInput({
  lifeEvents: [life({ id: "10", typeKey: "sortie_soiree" })],
  moments: [moment({ id: "20" })],
  momentLifeEvents: [{ momentId: uuid("20"), lifeEventId: uuid("10"), relationType: "Événement principal", validationStatus: "Confirmé" }],
}));
check(() => {
  assert.equal(fused.items.status, "KNOWN");
  assert.equal(fused.items.items.length, 1);
  assert.equal(fused.items.items[0].sourceKind, "fused");
  assert.equal(fused.items.items[0].rawOccurrenceCount, 1);
  assert.deepEqual(fused.items.items[0].sourceRefs, [`life_event:${uuid("10")}`, `moment:${uuid("20")}`]);
});

const absorbed = calendar.buildCalendarSemanticMonthArtifact(calendarInput({
  lifeEvents: [
    life({ id: "30", typeKey: "celebration", title: "Parent" }),
    life({ id: "31", typeKey: "pharmacie", title: "Enfant", parentLifeEventId: uuid("30") }),
  ],
}));
check(() => {
  assert.equal(absorbed.items.items.length, 1);
  assert.equal(absorbed.items.items[0].rawOccurrenceCount, 2);
});
const multipleChildrenAbsorbed = calendar.buildCalendarSemanticMonthArtifact(calendarInput({
  lifeEvents: [
    life({ id: "301", typeKey: "celebration", title: "Parent multiple" }),
    life({ id: "302", typeKey: "pharmacie", title: "Enfant A", parentLifeEventId: uuid("301") }),
    life({ id: "303", typeKey: "repas_restaurant", title: "Enfant B", parentLifeEventId: uuid("301") }),
  ],
  moments: [moment({ id: "304", type: "Fête / célébration" })],
  momentLifeEvents: [{
    momentId: uuid("304"),
    lifeEventId: uuid("301"),
    relationType: "Événement principal",
    validationStatus: "Confirmé",
  }],
}));
check(() => {
  assert.equal(multipleChildrenAbsorbed.items.items.length, 1);
  assert.equal(multipleChildrenAbsorbed.items.items[0].rawOccurrenceCount, 3);
  assert.deepEqual(multipleChildrenAbsorbed.items.items[0].memberSourceIds, [
    `life_event:${uuid("301")}`,
    `life_event:${uuid("302")}`,
    `life_event:${uuid("303")}`,
    `moment:${uuid("304")}`,
  ]);
});
const promoted = calendar.buildCalendarSemanticMonthArtifact(calendarInput({
  lifeEvents: [life({ id: "32", typeKey: "pharmacie", parentLifeEventId: uuid("999") })],
}));
check(() => assert.equal(promoted.items.items.length, 1, "un enfant sans parent doit être promu"));

const relationSemantics = calendar.buildCalendarSemanticMonthArtifact(calendarInput({
  lifeEvents: [
    life({ id: "33", typeKey: "pharmacie" }),
    life({ id: "34", typeKey: "demarche_admin" }),
  ],
  moments: [moment({ id: "35" })],
  momentLifeEvents: [
    { momentId: uuid("35"), lifeEventId: uuid("33"), relationType: "Composant", validationStatus: "Confirmé" },
    { momentId: uuid("35"), lifeEventId: uuid("34"), relationType: "Préparation", validationStatus: "Confirmé" },
  ],
}));
check(() => {
  assert.equal(relationSemantics.items.items.length, 2, "Composant est absorbé, Préparation reste autonome");
  assert.ok(relationSemantics.items.items.some(({ memberSourceIds }) => memberSourceIds.includes(`life_event:${uuid("33")}`)));
  assert.ok(relationSemantics.items.items.some(({ calendarItemId }) => calendarItemId === `life_event:${uuid("34")}`));
});

const specificVisibility = calendar.buildCalendarSemanticMonthArtifact(calendarInput({
  lifeEvents: [
    life({ id: "36", typeKey: "courses_alimentaires", explicitMonthVisibility: false }),
    life({ id: "37", typeKey: "shopping_commerce", explicitMonthVisibility: true }),
  ],
}));
check(() => {
  assert.equal(specificVisibility.items.items.find(({ calendarItemId }) => calendarItemId.endsWith(uuid("36"))).monthVisibility, false);
  assert.equal(specificVisibility.items.items.find(({ calendarItemId }) => calendarItemId.endsWith(uuid("37"))).monthVisibility, true);
});

const aggregate = calendar.buildCalendarSemanticMonthArtifact(calendarInput({
  lifeEvents: [
    life({ id: "40", typeKey: "pharmacie", title: undefined }),
    life({ id: "41", typeKey: "pharmacie", title: undefined }),
  ],
}));
check(() => {
  assert.equal(aggregate.items.items.length, 1);
  assert.equal(aggregate.items.items[0].sourceKind, "aggregate");
  assert.equal(aggregate.items.items[0].rawOccurrenceCount, 2, "l'agrégation visuelle conserve le compte analytique brut");
  assert.equal(aggregate.items.items[0].memberSourceIds.length, 2);
});

const topThree = calendar.buildCalendarSemanticMonthArtifact(calendarInput({
  lifeEvents: [life({ id: "50", typeKey: "demarche_admin" })],
  moments: [moment({ id: "51", type: "Anniversaire" }), moment({ id: "52", type: "Soirée techno" }), moment({ id: "53", type: "Sortie / plage" })],
}));
check(() => {
  const day = topThree.days.find(({ date }) => date === "2026-05-12");
  assert.equal(day.markers.length, 3);
  assert.equal(day.hiddenMarkerGroupCount, 1, "+N compte les groupes et non les sources");
});

const ribbons = calendar.buildCalendarSemanticMonthArtifact(calendarInput({
  lifeEvents: Array.from({ length: 5 }, (_, index) => life({
    id: String(60 + index), typeKey: "voyage_sejour", title: `Voyage ${index}`,
    startDate: "2026-05-04", endDate: "2026-05-10",
  })),
}));
check(() => {
  const week = ribbons.ribbonWeeks.find(({ weekStart }) => weekStart === "2026-05-04");
  assert.equal(week.segments.length, 4);
  assert.equal(week.ribbonOverflow, 1);
  assert.equal(ribbons.days.find(({ date }) => date === "2026-05-04").hiddenMarkerGroupCount, 0, "overflow Ribbon et Marker sont distincts");
});

const explicitNoQualifier = calendar.buildCalendarSemanticMonthArtifact(calendarInput({
  lifeEvents: [life({ id: "70", typeKey: "deplacement_pro", startDate: "2026-05-04", endDate: "2026-05-05" })],
}));
check(() => {
  assert.equal(explicitNoQualifier.items.items[0].renderMode, "Marker");
  assert.ok(explicitNoQualifier.semanticIssues.some((issue) => issue.startsWith("DATA_NO_CONTINUITY_ASSERTION")));
});
const explicitContinuous = calendar.buildCalendarSemanticMonthArtifact(calendarInput({
  lifeEvents: [life({ id: "71", typeKey: "deplacement_pro", startDate: "2026-05-04", endDate: "2026-05-05", continuityQualifier: knownContinuous })],
}));
check(() => assert.equal(explicitContinuous.items.items[0].renderMode, "Ribbon"));

const fusedContinuous = calendar.buildCalendarSemanticMonthArtifact(calendarInput({
  lifeEvents: [life({ id: "72", typeKey: "deplacement_pro", startDate: "2026-05-04", endDate: "2026-05-05", continuityQualifier: knownContinuous })],
  moments: [moment({ id: "73", type: "Déplacement professionnel", startDate: "2026-05-04", endDate: "2026-05-05" })],
  momentLifeEvents: [{ momentId: uuid("73"), lifeEventId: uuid("72"), relationType: "Événement principal", validationStatus: "Confirmé" }],
}));
check(() => {
  assert.equal(fusedContinuous.items.items[0].renderMode, "Ribbon");
  assert.ok(!fusedContinuous.semanticIssues.some((issue) => issue.includes(`moment:${uuid("73")}`)), "la fusion transporte l'autorité de continuité sans faux warning");
});

check(() => calendar.calendarSemanticMonthArtifactSchema.parse(fused));
check(() => assert.equal(calendar.calendarSemanticMonthArtifactSchema.parse({ ...fused, items: { status: "PARTIAL", items: [], knownCount: 0, partialMeaning: "OBSERVED_ONLY" } }).items.status, "PARTIAL"));

function component(overrides) {
  return {
    canonicalComponentKey: overrides.key,
    amount: overrides.amount,
    economicMonth: overrides.month ?? "2026-05",
    sourceRefs: [overrides.sourceRef ?? `operation:${overrides.key}`],
    timingEvidence: [], sourceKind: "operation", provenance: authority, ...overrides,
  };
}
function purchaseEvent(id, keys, timing) {
  return {
    fact: "fct_purchase_event", householdId, householdTimeZone: "Europe/Paris",
    purchaseEventId: uuid(id),
    sources: keys.map((key) => ({ membershipKind: "CONSUMPTION_COMPONENT", kind: "operation", sourceId: key, canonicalComponentKey: key, evidenceRefs: [`event:${id}`], provenance: "EXPLICIT_USER_ASSERTION" })),
    economicAmount: keys.length === 2 ? "30" : "10", timing,
    provenance: "EXPLICIT_USER_ASSERTION",
  };
}
const knownEventTiming = { status: "KNOWN", precision: "DAY", economicDate: "2026-05-12", economicMonth: "2026-05", authority: "EXPLICIT_EVENT", evidenceRefs: ["assertion"] };

const ledgerKnown = daily.buildDailyEconomicLedgerMonthArtifact({
  householdId, month: "2026-05", currency: "EUR", actualMonthAmount: "30",
  components: [component({ key: "a", amount: "10" }), component({ key: "b", amount: "20" })],
  purchaseEvents: [purchaseEvent("100", ["a", "b"], knownEventTiming)],
});
check(() => {
  assert.equal(ledgerKnown.assignedEconomicAmount, "30");
  assert.equal(ledgerKnown.unassignedEconomicAmount.value, "0");
  assert.equal(ledgerKnown.expenseEvents.length, 1);
  assert.equal(ledgerKnown.days.find(({ date }) => date === "2026-05-12").assignedPurchaseEventCount, 1);
  daily.assertDailyEconomicReconciliation(ledgerKnown);
});

const ledgerPartial = daily.buildDailyEconomicLedgerMonthArtifact({
  householdId, month: "2026-05", currency: "EUR", actualMonthAmount: "35",
  components: [
    component({ key: "known", amount: "10", timingEvidence: [{ kind: "TRUSTED_PURCHASE_SOURCE", date: "2026-05-02", evidenceRef: "receipt" }] }),
    component({ key: "cash", amount: "5", sourceKind: "cash_use", sourceRef: "cash_use:1", timingEvidence: [{ kind: "CASH_USE_DATE", date: "2026-05-03", evidenceRef: "cash_use:1" }] }),
    component({ key: "bank-only", amount: "20", timingEvidence: [{ kind: "BANK_DATE_FALLBACK", date: "2026-05-04", evidenceRef: "operation:bank" }] }),
  ], purchaseEvents: [],
});
check(() => {
  assert.equal(ledgerPartial.assignedEconomicAmount, "15");
  assert.equal(ledgerPartial.unassignedEconomicAmount.value, "20");
  assert.equal(ledgerPartial.days.find(({ date }) => date === "2026-05-02").economicAmount.status, "PARTIAL");
  assert.equal(ledgerPartial.days.find(({ date }) => date === "2026-05-04").economicAmount.status, "UNKNOWN");
  daily.assertDailyEconomicReconciliation(ledgerPartial);
});

const directConflict = daily.buildDailyEconomicLedgerMonthArtifact({
  householdId, month: "2026-05", currency: "EUR", actualMonthAmount: "10",
  components: [component({ key: "conflict", amount: "10", timingEvidence: [
    { kind: "EXPLICIT_CONSUMPTION_SOURCE", date: "2026-05-01", evidenceRef: "a" },
    { kind: "EXPLICIT_CONSUMPTION_SOURCE", date: "2026-05-02", evidenceRef: "b" },
  ] })], purchaseEvents: [],
});
check(() => assert.equal(directConflict.days[0].economicAmount.status, "CONFLICT"));

const convergingAuthority = daily.buildDailyEconomicLedgerMonthArtifact({
  householdId, month: "2026-05", currency: "EUR", actualMonthAmount: "10",
  components: [component({ key: "converging", amount: "10", timingEvidence: [
    { kind: "EXPLICIT_CONSUMPTION_SOURCE", date: "2026-05-06", evidenceRef: "a" },
    { kind: "EXPLICIT_CONSUMPTION_SOURCE", date: "2026-05-06", evidenceRef: "b" },
  ] })], purchaseEvents: [],
});
check(() => assert.equal(convergingAuthority.allocationEntries[0].effectiveEconomicDate.value, "2026-05-06"));

const linkedRefund = daily.buildDailyEconomicLedgerMonthArtifact({
  householdId, month: "2026-05", currency: "EUR", actualMonthAmount: "7",
  components: [
    component({ key: "charge", amount: "10", timingEvidence: [{ kind: "EXPLICIT_CONSUMPTION_SOURCE", date: "2026-05-08", evidenceRef: "charge" }] }),
    component({ key: "refund", amount: "-3", isRefund: true, linkedRefundSourceComponentKey: "charge", timingEvidence: [{ kind: "BANK_DATE_FALLBACK", date: "2026-05-20", evidenceRef: "bank-refund" }] }),
  ], purchaseEvents: [],
});
check(() => {
  assert.equal(linkedRefund.days.find(({ date }) => date === "2026-05-08").economicAmount.value, "7");
  assert.equal(linkedRefund.days.find(({ date }) => date === "2026-05-20").economicAmount.value, "0");
});

const eventConflict = daily.buildDailyEconomicLedgerMonthArtifact({
  householdId, month: "2026-05", currency: "EUR", actualMonthAmount: "10",
  components: [component({ key: "event-conflict", amount: "10", timingEvidence: [{ kind: "EXPLICIT_CONSUMPTION_SOURCE", date: "2026-05-10", evidenceRef: "lower" }] })],
  purchaseEvents: [purchaseEvent("101", ["event-conflict"], { status: "CONFLICT", precision: "MONTH", economicDate: null, economicMonth: "2026-05", authority: "EXPLICIT_EVENT", evidenceRefs: ["x", "y"] })],
});
check(() => {
  assert.equal(eventConflict.allocationEntries[0].effectiveEconomicDate.status, "CONFLICT");
  assert.equal(eventConflict.assignedEconomicAmount, "0", "un conflit Purchase Event interdit le fallback d'autorité inférieure");
});

const unlinkedRefund = daily.buildDailyEconomicLedgerMonthArtifact({
  householdId, month: "2026-05", currency: "EUR", actualMonthAmount: "-4",
  components: [component({ key: "unlinked-refund", amount: "-4", isRefund: true, timingEvidence: [
    { kind: "BANK_DATE_FALLBACK", date: "2026-05-20", evidenceRef: "bank-refund" },
    { kind: "TRUSTED_PURCHASE_SOURCE", date: "2026-05-19", evidenceRef: "unlinked-reception" },
  ] })], purchaseEvents: [],
});
check(() => {
  assert.equal(unlinkedRefund.assignedEconomicAmount, "0");
  assert.equal(unlinkedRefund.unassignedEconomicAmount.value, "-4");
});

const duplicateMembership = daily.buildDailyEconomicLedgerMonthArtifact({
  householdId, month: "2026-05", currency: "EUR", actualMonthAmount: "10",
  components: [component({ key: "two-events", amount: "10" })],
  purchaseEvents: [
    purchaseEvent("102", ["two-events"], knownEventTiming),
    purchaseEvent("103", ["two-events"], knownEventTiming),
  ],
});
check(() => assert.equal(duplicateMembership.allocationEntries[0].effectiveEconomicDate.status, "CONFLICT"));

check(() => daily.dailyEconomicLedgerMonthArtifactSchema.parse(ledgerKnown));
check(() => assert.throws(() => daily.buildDailyEconomicLedgerMonthArtifact({
  householdId, month: "2026-05", currency: "EUR", actualMonthAmount: "31",
  components: [component({ key: "mismatch", amount: "30" })], purchaseEvents: [],
}), /non réconcilié/));

for (const month of ["2026-04", "2026-05", "2026-07"]) {
  const artifact = daily.buildDailyEconomicLedgerMonthArtifact({
    householdId, month, currency: "EUR", actualMonthAmount: "1",
    components: [component({ key: `representative-${month}`, amount: "1", month, timingEvidence: [{ kind: "ECONOMIC_MONTH", month, evidenceRef: `month:${month}` }] })],
    purchaseEvents: [],
  });
  check(() => {
    assert.equal(artifact.month, month);
    assert.equal(artifact.reconciliationResidual, "0");
    daily.assertDailyEconomicReconciliation(artifact);
  });
}

console.log(`History V2 Calendar + Daily Finance: ${checks}/${checks} checks PASS`);
