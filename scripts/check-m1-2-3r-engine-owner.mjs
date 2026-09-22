import assert from "node:assert/strict";
import { registerHooks } from "node:module";

registerHooks({ resolve(specifier, context, nextResolve) {
  try { return nextResolve(specifier, context); } catch (error) {
    if (!specifier.startsWith(".") || /\.[cm]?[jt]sx?$/.test(specifier)) throw error;
    for (const candidate of [`${specifier}.ts`, `${specifier}/index.ts`]) {
      try { return nextResolve(candidate, context); } catch { /* continue */ }
    }
    throw error;
  }
} });

const a = await import("../src/analytics/global-v2/index.ts");
const identity = await import("../src/core/identity/index.ts");
const money = await import("../src/core/money/index.ts");
const scope = await import("../src/core/scope/index.ts");
const time = await import("../src/core/time/index.ts");

let checks = 0;
const check = (fn) => { fn(); checks += 1; };
const uuid = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const householdId = identity.parseHouseholdId(uuid(1));
const personA = identity.parsePersonId(uuid(2));
const personB = identity.parsePersonId(uuid(3));
const zone = time.parseHouseholdTimeZone("Europe/Paris");
const asMoney = money.parseMoney;
const month = time.parseYearMonth;
const produced = (metricId, value, targetMonth, availability = "known") => ({
  metricId: identity.parseMetricId(metricId),
  scopeHash: scope.computeScopeHash(scope.normalizeAnalysisScope({ subject: { kind: "household" }, time: { kind: "month", month: targetMonth } })),
  availability,
  ...(availability === "known" ? { value: asMoney(value) } : {}),
  unit: "EUR/month",
  provenance: "derived",
  methodVersion: `${metricId}@v1`,
});
const monthly = Array.from({ length: 12 }, (_, index) => {
  const targetMonth = month(`2025-${String(index + 1).padStart(2, "0")}`);
  return { month: targetMonth, actual: produced("economic_consumption_net_attributable", String(100 + index * 10), targetMonth), isComplete: true, isComparable: true, isMethodExcluded: false, dependencyRefs: [`actual:${targetMonth}`] };
});
const minimalUnknown = (targetMonth) => a.adaptGlobalMinimal({ metric: produced("minimal_month_cost", "0", targetMonth, "unknown"), neutralVariableComponents: [], mandatoryMonthlyObligationsAndProvisions: [] });
const periodMinimal = a.adaptGlobalMinimal({
  metric: produced("minimal_month_cost", "80", month("2025-12"), "known"),
  neutralVariableComponents: [{ canonicalComponentKey: "minimal:annual", amount: asMoney("80"), support: { n: 12, unit: "month", level: "sufficient" }, coverage: { level: "complete" }, provenance: "derived" }],
  mandatoryMonthlyObligationsAndProvisions: [],
});
const history = monthly.map((entry) => ({
  month: entry.month,
  actual: a.adaptGlobalActual(entry.actual),
  typical: a.buildGlobalTypicalPair({ householdId, householdTimeZone: zone, targetMonth: entry.month, months: monthly.filter(({ month: value }) => value <= entry.month) }),
  minimal: minimalUnknown(entry.month),
  dependencyRefs: entry.dependencyRefs,
}));
const dim = (value) => ({ kind: "resolved", value });
const structure = a.buildGlobalEconomicStructure([
  { canonicalComponentKey: "component:1", amount: asMoney("70"), necessity: dim("Indispensable"), behavior: dim("Fixe"), lifeScope: dim("Vie courante") },
  { canonicalComponentKey: "component:2", amount: asMoney("20"), necessity: dim("Contraint"), behavior: dim("Variable"), lifeScope: dim("Hors quotidien") },
  { canonicalComponentKey: "component:3", amount: asMoney("10"), necessity: { kind: "unknown" }, behavior: dim("Variable"), lifeScope: { kind: "conflict" } },
]);
const temporal = a.buildGlobalM1Temporal({ certifiedThroughMonth: month("2025-12"), months: monthly });
const declaration = a.createGlobalM1DependencyDeclaration({ personScope: { kind: "HOUSEHOLD" }, authorizedPersonIds: [] });
const recurrenceObservations = [
  { recurrenceId: "rent", occurrenceId: "operation:1", economicDate: "2025-10-01", amount: asMoney("600"), evidenceRefs: ["operation:1"] },
  { recurrenceId: "rent", occurrenceId: "operation:2", economicDate: "2025-11-01", amount: asMoney("600"), evidenceRefs: ["operation:2"] },
  { recurrenceId: "facts-only", occurrenceId: "operation:3", economicDate: "2025-12-02", amount: asMoney("25"), evidenceRefs: ["operation:3"] },
];
const recurrenceAuthorities = [{ recurrenceId: "rent", expectedOccurrenceAmount: asMoney("600"), expectedOccurrencesPerYear: 12, lifecycle: "ACTIVE", change: "NEW", effectiveFrom: "2025-01-01", declaredAt: "2025-01-01T00:00:00Z", sourceRevision: "1", evidenceRefs: ["authority:rent"] }];
const build = (extra = {}) => a.buildGlobalM1OwnerV2({
  targetMonth: month("2025-12"), certifiedThrough: "2025-12-31", asOf: "2026-01-01T00:00:00Z",
  dataRevision: "1", analyticsRevision: "79", history, periodMinimal, structure, temporal,
  recurrenceObservations, recurrenceAuthorities, dependencyDeclaration: declaration,
  factsDigest: "facts:digest", classificationsDigest: "classifications:digest", ...extra,
});
const owner = build();

check(() => assert.equal(owner.moduleKey, "ECONOMIC"));
check(() => assert.equal(owner.state.actual.value, "210"));
check(() => assert.equal(owner.state.typicalReference.value, "150"));
check(() => assert.equal(owner.state.typicalState.value, "155"));
check(() => assert.equal(owner.state.minimalState.status, "KNOWN"));
check(() => assert.equal(owner.state.minimalState.value, "80"));
check(() => assert.equal(owner.state.comparisons.actualVsTypicalReference.value, "60"));
check(() => assert.equal(owner.state.comparisons.typicalStateVsMinimalState.status, "KNOWN"));
check(() => assert.equal(owner.state.comparisons.typicalStateVsMinimalState.value, "75"));
check(() => assert.equal(owner.history.points.length, 12));
check(() => assert.ok(owner.history.points.every((point) => point.actual.status === "KNOWN")));
check(() => assert.ok(owner.history.points.slice(6).every((point) => point.typicalState.status === "KNOWN")));
check(() => assert.ok(owner.history.points.every((point) => point.minimalState.status === "UNKNOWN")));
check(() => assert.equal(owner.history.points.at(-1).lineage.sourceRevision, "1"));
check(() => assert.equal(owner.structure.semanticBase, "ACTUAL_TARGET_MONTH"));
check(() => assert.deepEqual(owner.structure.necessity.buckets.map(({ key }) => key), ["Contraint", "Indispensable"]));
check(() => assert.ok(!JSON.stringify(owner.structure).includes("Ajustable")));
check(() => assert.equal(owner.structure.necessity.total, "100"));
check(() => assert.equal(owner.structure.necessity.unknownAmount, "10"));
check(() => assert.equal(owner.structure.lifeScope.conflictAmount, "10"));
check(() => assert.equal(owner.structure.necessity.coverage.effective, 2 / 3));
check(() => assert.equal(owner.temporal.trend.status, "KNOWN"));
check(() => assert.equal(owner.temporal.trend.relativeSlope.status, "KNOWN"));
check(() => assert.equal(owner.temporal.dispersion.minimum, "100"));
check(() => assert.equal(owner.temporal.dispersion.maximum, "210"));
check(() => assert.equal(owner.temporal.dispersion.amplitude, "110"));
check(() => assert.equal(owner.temporal.stability.classification.status, "UNKNOWN"));
check(() => assert.equal(owner.temporal.ordinaryDispersion.status, "UNKNOWN"));
check(() => assert.deepEqual(owner.recurrences.series.map(({ recurrenceId }) => recurrenceId), ["facts-only", "rent"]));
check(() => assert.equal(owner.recurrences.series.find(({ recurrenceId }) => recurrenceId === "facts-only").lifecycle.status, "UNKNOWN"));
check(() => assert.equal(owner.recurrences.series.find(({ recurrenceId }) => recurrenceId === "facts-only").typicalOccurrenceCost.value, "25"));
check(() => assert.equal(owner.recurrences.series.find(({ recurrenceId }) => recurrenceId === "rent").monthlyEquivalent.value, "600"));
check(() => assert.equal(owner.recurrences.structuralRecurringCost.status, "PARTIAL"));
check(() => assert.equal(owner.recurrences.structuralRecurringCost.value, "600"));
check(() => assert.equal(owner.recurrences.newRecurringEquivalent.value, "600"));
check(() => assert.equal(owner.recurrences.endedRecurringEquivalent.status, "UNKNOWN"));
check(() => assert.equal(owner.contributors[0].source, "RECURRENCE_CHANGE"));
check(() => assert.equal(owner.contributors[0].publicationEligible, false));
check(() => assert.equal(owner.conditional.longTerm.status, "UNKNOWN"));
check(() => assert.equal(owner.conditional.currentRegime.status, "UNKNOWN"));
check(() => assert.equal(owner.conditional.periodicity.status, "UNKNOWN"));
check(() => assert.equal(owner.temporal.currentRegimeReference.status, "UNKNOWN"));
check(() => assert.equal(owner.temporal.longTermEvolution.status, "UNKNOWN"));
check(() => assert.equal(owner.methodology.limitations.includes("GLOBAL_RETROSPECTIVE_MINIMAL_UNAVAILABLE"), false));
check(() => assert.equal(owner.methodology.revisions.analyticsRevision, "79"));
check(() => assert.equal(build().inputHash, owner.inputHash));
check(() => assert.notEqual(build({ factsDigest: "changed" }).inputHash, owner.inputHash));

const withFuture = build({ history: [...history, { ...history[0], month: month("2026-01"), dependencyRefs: ["future"] }] });
check(() => assert.equal(withFuture.inputHash, owner.inputHash));
const noRecurrenceAuthority = build({ recurrenceAuthorities: [] });
check(() => assert.equal(noRecurrenceAuthority.recurrences.series.length, 2));
check(() => assert.ok(noRecurrenceAuthority.recurrences.series.every(({ lifecycle }) => lifecycle.status === "UNKNOWN")));
check(() => assert.equal(noRecurrenceAuthority.state.actual.status, "KNOWN"));
check(() => assert.equal(noRecurrenceAuthority.state.typicalState.status, "KNOWN"));
check(() => assert.equal(noRecurrenceAuthority.temporal.recentChange.status, "KNOWN"));
check(() => assert.equal(noRecurrenceAuthority.structure.behavior.total, "100"));
const withoutPeriodMinimal = build({ periodMinimal: undefined });
check(() => assert.equal(withoutPeriodMinimal.state.minimalState.status, "UNKNOWN"));
check(() => assert.ok(withoutPeriodMinimal.methodology.limitations.includes("GLOBAL_RETROSPECTIVE_MINIMAL_UNAVAILABLE")));

const attributedComponent = (key, amount, person) => ({ canonicalComponentKey: key, amount: asMoney(amount), person });
const personalObservation = (recurrenceId, occurrenceId, amount, personAttributions) => ({
  recurrenceId, occurrenceId, economicDate: `2025-12-${occurrenceId.endsWith("2") ? "02" : "01"}`, amount: asMoney(amount), evidenceRefs: [`operation:${occurrenceId}`], personAttributions,
});
const explicit = (personId, evidenceRef) => ({ kind: "resolved", id: personId, attribution: "explicit_beneficiary", evidenceRefs: [evidenceRef], payerEvidenceRefs: [] });
const unknown = (payerEvidenceRefs = []) => ({ kind: "unknown", reasonCode: "NO_EXPLICIT_BENEFICIARY", evidenceRefs: payerEvidenceRefs, payerEvidenceRefs });
const personalObservations = [
  personalObservation("unique-beneficiary", "unique-1", "20", [attributedComponent("component:unique-1", "20", explicit(personA, "beneficiary:unique-1"))]),
  personalObservation("unique-beneficiary", "unique-2", "22", [attributedComponent("component:unique-2", "22", explicit(personA, "beneficiary:unique-2"))]),
  personalObservation("payer-only", "payer-1", "30", [attributedComponent("component:payer-1", "30", unknown(["payer:person-a"]))]),
  { ...personalObservation("no-beneficiary", "none-1", "15", [attributedComponent("component:none-1", "15", unknown())]), merchantName: "OpenAI", displayName: "Adrien", cardHolderPersonId: personA, personaUsagePersonId: personA },
  personalObservation("shared-exact", "shared-1", "40", [attributedComponent("component:shared-1", "40", { kind: "shared", shares: [{ personId: personA, share: "0.25", evidenceRefs: ["share:a"] }, { personId: personB, share: "0.75", evidenceRefs: ["share:b"] }], evidenceRefs: ["share:a", "share:b"], payerEvidenceRefs: [] })]),
  personalObservation("shared-exact", "shared-2", "40", [attributedComponent("component:shared-2", "40", { kind: "shared", shares: [{ personId: personA, share: "0.25", evidenceRefs: ["share:a:2"] }, { personId: personB, share: "0.75", evidenceRefs: ["share:b:2"] }], evidenceRefs: ["share:a:2", "share:b:2"], payerEvidenceRefs: [] })]),
  personalObservation("partial-share", "partial-share-1", "40", [attributedComponent("component:partial-share-1", "40", { kind: "partial", shares: [{ personId: personA, share: "0.25", evidenceRefs: ["share:partial-a"] }], unattributedShare: "0.75", evidenceRefs: ["share:partial-a"], payerEvidenceRefs: [] })]),
  personalObservation("partial-series", "partial-series-1", "10", [attributedComponent("component:partial-series-1", "10", explicit(personA, "beneficiary:partial-series"))]),
  personalObservation("partial-series", "partial-series-2", "10", [attributedComponent("component:partial-series-2", "10", unknown())]),
  personalObservation("contradictory-series", "contradictory-1", "12", [attributedComponent("component:contradictory-1", "12", explicit(personA, "beneficiary:contradictory-a"))]),
  personalObservation("contradictory-series", "contradictory-2", "12", [attributedComponent("component:contradictory-2", "12", explicit(personB, "beneficiary:contradictory-b"))]),
  personalObservation("multiple-beneficiaries", "multiple-1", "18", [attributedComponent("component:multiple-1", "18", { kind: "conflict", reasonCode: "MULTIPLE_UNALLOCATED_BENEFICIARIES", evidenceRefs: ["beneficiary:a", "beneficiary:b"], payerEvidenceRefs: [] })]),
  personalObservation("outside-household", "outside-1", "18", [attributedComponent("component:outside-1", "18", { kind: "conflict", reasonCode: "OUT_OF_HOUSEHOLD_PERSON", evidenceRefs: ["beneficiary:outside"], payerEvidenceRefs: [] })]),
  personalObservation("payer-and-beneficiary", "payer-beneficiary-1", "9", [attributedComponent("component:payer-beneficiary-1", "9", { ...explicit(personA, "beneficiary:payer-beneficiary"), payerEvidenceRefs: ["payer:person-a"] })]),
  personalObservation("payer-and-beneficiary", "payer-beneficiary-2", "9", [attributedComponent("component:payer-beneficiary-2", "9", { ...explicit(personA, "beneficiary:payer-beneficiary:2"), payerEvidenceRefs: ["payer:person-a:2"] })]),
  personalObservation("single-certified-payment", "single-1", "11", [attributedComponent("component:single-1", "11", explicit(personA, "beneficiary:single"))]),
];
const personalOwner = build({ recurrenceObservations: personalObservations });
const personalAuthorities = new Map(personalOwner.recurrences.personalCostAuthorities.map((authority) => [authority.recurrenceId, authority]));
check(() => assert.equal(personalAuthorities.get("unique-beneficiary").attributionState, "PERSONAL"));
check(() => assert.equal(personalAuthorities.get("unique-beneficiary").personId, personA));
check(() => assert.equal(personalAuthorities.get("unique-beneficiary").typicalOccurrenceAmount, "21"));
check(() => assert.equal(personalAuthorities.get("payer-only").attributionState, "UNKNOWN"));
check(() => assert.equal(personalAuthorities.get("no-beneficiary").attributionState, "UNKNOWN"));
check(() => assert.equal(personalAuthorities.get("shared-exact").attributionState, "SHARED"));
check(() => assert.deepEqual(personalAuthorities.get("shared-exact").beneficiaryShares, [{ personId: personA, share: "0.25" }, { personId: personB, share: "0.75" }]));
check(() => assert.equal(personalAuthorities.get("partial-share").attributionState, "PARTIAL"));
check(() => assert.equal(personalAuthorities.get("partial-share").unattributedShare, "0.75"));
check(() => assert.equal(personalAuthorities.get("partial-series").attributionState, "PARTIAL"));
check(() => assert.equal(personalAuthorities.get("partial-series").coverage.amountRatio, 0.5));
check(() => assert.equal(personalAuthorities.get("contradictory-series").attributionState, "CONFLICT"));
check(() => assert.equal(personalAuthorities.get("multiple-beneficiaries").attributionState, "CONFLICT"));
check(() => assert.equal(personalAuthorities.get("outside-household").attributionState, "CONFLICT"));
check(() => assert.equal(personalAuthorities.get("payer-and-beneficiary").attributionState, "PERSONAL"));
check(() => assert.equal(personalAuthorities.get("payer-and-beneficiary").personId, personA));
check(() => assert.equal(personalAuthorities.get("single-certified-payment").attributionState, "PARTIAL"));
check(() => assert.equal(personalAuthorities.get("single-certified-payment").support.status, "INSUFFICIENT"));
check(() => assert.ok(personalOwner.recurrences.personalCostAuthorities.every(({ detailRef }) => detailRef.resource === "analysis_global_economic_recurrence_detail")));
check(() => assert.deepEqual(
  build({ recurrenceObservations: [...personalObservations].reverse() }).recurrences.personalCostAuthorities,
  personalOwner.recurrences.personalCostAuthorities,
));
check(() => assert.equal(
  build({ recurrenceObservations: structuredClone(personalObservations) }).recurrences.personalCostAuthorities.find(({ recurrenceId }) => recurrenceId === "unique-beneficiary").authorityId,
  personalAuthorities.get("unique-beneficiary").authorityId,
));

const source = await import("node:fs").then(({ readFileSync }) => readFileSync("src/server/analytics/global-v2-economic-authority.ts", "utf8"));
check(() => assert.ok(!source.includes("analytics_query_snapshots")));
check(() => assert.ok(!source.includes("CertifiedHistoricalMinimalSource")));
check(() => assert.ok(source.includes("loadMinimalPlanningBundle")));
check(() => assert.ok(source.includes("recurrenceByOperation")));
check(() => assert.ok(source.includes("personAttributions")));

console.log(`M1 2/3R engine owner: ${checks}/${checks} PASS`);
