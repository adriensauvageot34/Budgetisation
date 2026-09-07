import assert from "node:assert/strict";
import fs from "node:fs";
import { registerHooks } from "node:module";

registerHooks({
  resolve(specifier, context, nextResolve) {
    try { return nextResolve(specifier, context); } catch (originalError) {
      if (!specifier.startsWith(".") || /\.[cm]?[jt]sx?$/.test(specifier)) throw originalError;
      for (const candidate of [`${specifier}.ts`, `${specifier}/index.ts`]) {
        try { return nextResolve(candidate, context); } catch { /* continue */ }
      }
      throw originalError;
    }
  },
});

const globalCore = await import("../src/core/global-v2/index.ts");
const globalEconomic = await import("../src/analytics/global-v2/index.ts");
const money = await import("../src/core/money/index.ts");
const time = await import("../src/core/time/index.ts");
const identity = await import("../src/core/identity/index.ts");
const scopeCore = await import("../src/core/scope/index.ts");

let checks = 0;
const check = (callback) => { callback(); checks += 1; };
const rejects = (callback, pattern) => check(() => assert.throws(callback, pattern));
const uuid = (suffix) => `00000000-0000-4000-8000-${String(suffix).padStart(12, "0")}`;
const householdId = identity.parseHouseholdId(uuid(1));
const timezone = time.parseHouseholdTimeZone("Europe/Paris");
const month = (value) => time.parseYearMonth(value);
const localDate = (value) => time.parseLocalDate(value);
const asMoney = money.parseMoney;

const produced = (metricId, value, options = {}) => ({
  metricId: identity.parseMetricId(metricId),
  scopeHash: scopeCore.computeScopeHash(scopeCore.normalizeAnalysisScope({
    subject: { kind: "household" },
    time: { kind: "month", month: month(options.month ?? "2026-07") },
  })),
  availability: options.availability ?? "known",
  value: (options.availability ?? "known") === "known" ? asMoney(value) : null,
  unit: "EUR",
  provenance: "derived",
  methodVersion: `${metricId}@v1`,
  ...(options.coverage === undefined ? {} : { coverage: options.coverage }),
});

const provenance = globalCore.parseGlobalValueProvenance({
  resultNature: "OBSERVED",
  precision: "EXACT",
  integrationMode: "DERIVED_FROM_OBSERVED",
  monetaryBasis: "AUTHORITATIVE_ECONOMIC",
  sourceRefs: ["canonical:economic-components"],
  factRefs: ["fact:economic-component"],
  evidenceRefs: ["period:certified"],
  entityRefs: [],
  upstreamMetricRefs: ["metric:economic-consumption-net-attributable"],
  policyVersions: { economicTiming: "v1" },
  dataRevision: "1",
  analyticsRevision: "79",
});

const scope = globalCore.parseGlobalAnalysisScopeV2({
  subject: { kind: "household" },
  time: { kind: "global_v2", asOf: "2026-08-01T00:00:00Z", certifiedThrough: "2026-07-31", liveThrough: "2026-08-01" },
}, { householdTimeZone: timezone, authorizedPersonIds: [] });

const temporalCandidates = [
  { unitId: "month:2025-06", authority: "CERTIFIED_HISTORY", start: localDate("2025-06-01"), end: localDate("2025-06-30"), eligible: true, observed: true, comparable: true, methodExcluded: false, dependencyRefs: ["fact:jun"] },
  { unitId: "month:2025-07", authority: "CERTIFIED_HISTORY", start: localDate("2025-07-01"), end: localDate("2025-07-31"), eligible: true, observed: false, comparable: true, methodExcluded: false, dependencyRefs: ["gap:jul"] },
  { unitId: "month:2025-08", authority: "CERTIFIED_HISTORY", start: localDate("2025-08-01"), end: localDate("2025-08-31"), eligible: true, observed: true, comparable: true, methodExcluded: false, dependencyRefs: ["fact:aug"] },
  { unitId: "month:2025-09", authority: "CERTIFIED_HISTORY", start: localDate("2025-09-01"), end: localDate("2025-09-30"), eligible: false, observed: true, comparable: false, methodExcluded: false, dependencyRefs: ["fact:sep"] },
  { unitId: "day:2026-08-01", authority: "LIVE_TAIL", start: localDate("2026-08-01"), end: localDate("2026-08-01"), eligible: true, observed: true, comparable: true, methodExcluded: false, dependencyRefs: ["fact:live"] },
];
const temporalPolicy = {
  policyId: "global-economic-natural-month",
  policyVersion: "v1",
  naturalGrain: "MONTH",
  corpus: "CERTIFIED_PLUS_DESCRIPTIVE_LIVE_TAIL",
  lookback: { kind: "LAST_ELIGIBLE_UNITS", count: 12 },
  gapPolicy: "PRESERVE",
  comparableIntersection: "EXACT_NATURAL_UNIT",
};
const resolver = new globalEconomic.GlobalTemporalBoundaryResolver();
const temporal = resolver.resolve({
  scope,
  policy: temporalPolicy,
  supportPolicy: { policyRef: "global-typical-support@v1", minimumRequired: 2, strongAt: 12 },
  candidates: temporalCandidates,
  certifiedProvenance: provenance,
  liveTailProvenance: provenance,
});
check(() => assert.deepEqual(temporal.certifiedUnitIds, ["month:2025-06", "month:2025-08"]));
check(() => assert.deepEqual(temporal.liveTailUnitIds, ["day:2026-08-01"]));
check(() => assert.deepEqual(temporal.window.gapDates, ["2025-07-01"]));
check(() => assert.equal(temporal.window.certified.support.gapCount, 1));
check(() => assert.equal(temporal.window.certified.start, "2025-06-01"));
check(() => assert.ok(temporal.excludedUnitIds.includes("month:2025-09")));
rejects(() => resolver.resolve({
  scope,
  policy: { ...temporalPolicy, corpus: "CERTIFIED_HISTORY" },
  supportPolicy: { policyRef: "support@v1", minimumRequired: 1, strongAt: 2 },
  candidates: [{ ...temporalCandidates[0], end: localDate("2026-08-01") }],
  certifiedProvenance: provenance,
}), /certifiedThrough/);
rejects(() => resolver.resolve({
  scope,
  policy: temporalPolicy,
  supportPolicy: { policyRef: "support@v1", minimumRequired: 1, strongAt: 2 },
  candidates: [{ ...temporalCandidates[4], start: localDate("2026-07-31") }],
  certifiedProvenance: provenance,
  liveTailProvenance: provenance,
}), /disjointe/);
const noLaterData = resolver.resolve({
  scope,
  policy: { ...temporalPolicy, corpus: "CERTIFIED_HISTORY" },
  supportPolicy: { policyRef: "support@v1", minimumRequired: 1, strongAt: 2 },
  candidates: temporalCandidates.filter(({ authority }) => authority === "CERTIFIED_HISTORY"),
  certifiedProvenance: provenance,
});
const withExcludedLaterData = resolver.resolve({
  scope,
  policy: { ...temporalPolicy, corpus: "CERTIFIED_HISTORY" },
  supportPolicy: { policyRef: "support@v1", minimumRequired: 1, strongAt: 2 },
  candidates: [...temporalCandidates.filter(({ authority }) => authority === "CERTIFIED_HISTORY"), temporalCandidates[4]],
  certifiedProvenance: provenance,
});
check(() => assert.equal(noLaterData.resolutionHash, withExcludedLaterData.resolutionHash));

const actual = globalEconomic.adaptGlobalActual(produced("economic_consumption_net_attributable", "100"), provenance);
check(() => assert.equal(actual.value.status, "KNOWN"));
check(() => assert.equal(actual.value.value, "100"));
const partialActual = globalEconomic.adaptGlobalActual(produced("economic_consumption_net_attributable", "80", { coverage: { level: "partial" } }));
check(() => assert.equal(partialActual.value.status, "PARTIAL"));
rejects(() => globalEconomic.adaptGlobalActual(produced("minimal_month_cost", "100")), /Actual exige/);

const monthlyInputs = [
  ["2025-12", "50", true], ["2026-01", "0", true], ["2026-02", "60", true],
  ["2026-03", "70", true], ["2026-04", "80", true], ["2026-05", "90", true],
  ["2026-06", "100", true], ["2026-07", "110", true],
].map(([period, value, complete]) => ({
  month: month(period),
  actual: produced("economic_consumption_net_attributable", value, { month: period }),
  isComplete: complete,
  isComparable: true,
  isMethodExcluded: false,
  dependencyRefs: [`actual:${period}`],
}));
const typical = globalEconomic.buildGlobalTypicalPair({ householdId, householdTimeZone: timezone, targetMonth: month("2026-07"), months: monthlyInputs });
check(() => assert.deepEqual(typical.referenceMonths, ["2025-12", "2026-01", "2026-02", "2026-03", "2026-04", "2026-05", "2026-06"]));
check(() => assert.deepEqual(typical.stateMonths, ["2025-12", "2026-01", "2026-02", "2026-03", "2026-04", "2026-05", "2026-06", "2026-07"]));
check(() => assert.equal(typical.reference.status, "KNOWN"));
check(() => assert.equal(typical.reference.value, "70"));
check(() => assert.equal(typical.state.value, "75"));
const insufficient = globalEconomic.buildGlobalTypicalPair({ householdId, householdTimeZone: timezone, targetMonth: month("2026-03"), months: monthlyInputs });
check(() => assert.equal(insufficient.reference.status, "UNKNOWN"));
check(() => assert.equal(insufficient.reference.support.includedUnits, 3));
const partialMonth = monthlyInputs.map((entry) => entry.month === "2026-06" ? { ...entry, actual: produced("economic_consumption_net_attributable", "100", { month: "2026-06", coverage: { level: "partial" } }) } : entry);
const typicalWithoutPartial = globalEconomic.buildGlobalTypicalPair({ householdId, householdTimeZone: timezone, targetMonth: month("2026-07"), months: partialMonth });
check(() => assert.ok(!typicalWithoutPartial.referenceMonths.includes("2026-06")));
const typicalWithFuture = globalEconomic.buildGlobalTypicalPair({ householdId, householdTimeZone: timezone, targetMonth: month("2026-07"), months: [...monthlyInputs, { ...monthlyInputs[0], month: month("2026-08"), actual: produced("economic_consumption_net_attributable", "9999", { month: "2026-08" }), dependencyRefs: ["actual:2026-08"] }] });
check(() => assert.equal(typicalWithFuture.reference.value, typical.reference.value));

const minimalComponent = (key, amount, coverage = "complete") => ({
  canonicalComponentKey: key,
  amount: asMoney(amount),
  support: { n: 6, unit: "month", level: "sufficient" },
  coverage: { level: coverage },
  provenance: "derived",
});
const minimal = globalEconomic.adaptGlobalMinimal({
  metric: produced("minimal_month_cost", "75"),
  neutralVariableComponents: [minimalComponent("minimal:variable:food", "25")],
  mandatoryMonthlyObligationsAndProvisions: [minimalComponent("minimal:recurrence:rent", "50")],
});
check(() => assert.equal(minimal.neutralVariableComponents[0].amount, "25"));
check(() => assert.equal(minimal.mandatoryMonthlyObligationsAndProvisions[0].amount, "50"));
rejects(() => globalEconomic.adaptGlobalMinimal({ ...minimal, metric: produced("minimal_month_cost", "76") }), /réconcilient/);

const bridge = globalEconomic.buildGlobalBankEconomyBridge({
  bankOutflows: asMoney("110"), actual: asMoney("100"), linesComplete: true,
  lines: [
    { lineId: "cash", kind: "CASH_USE", label: "Cash économique", signedAmount: asMoney("10"), sourceRefs: ["cash:1"] },
    { lineId: "refund", kind: "REFUND_ECONOMIC_REATTACHMENT", label: "Remboursement économique", signedAmount: asMoney("-20"), sourceRefs: ["refund:1"] },
  ],
});
check(() => assert.equal(bridge.bridgeCalculatedActual, "100"));
check(() => assert.equal(bridge.residual, "0"));
check(() => assert.equal(bridge.result.status, "KNOWN"));
const partialBridge = globalEconomic.buildGlobalBankEconomyBridge({ bankOutflows: asMoney("110"), actual: asMoney("100"), linesComplete: false, lines: [] });
check(() => assert.equal(partialBridge.result.status, "PARTIAL"));

const dim = (kind, value) => kind === "resolved" ? { kind, value } : { kind };
const component = (key, amount, necessity, behavior, lifeScope) => ({
  canonicalComponentKey: key,
  amount: asMoney(amount),
  necessity: dim(...necessity), behavior: dim(...behavior), lifeScope: dim(...lifeScope),
});
const structure = globalEconomic.buildGlobalEconomicStructure([
  component("a", "40", ["resolved", "Need"], ["resolved", "Fixed"], ["resolved", "Household"]),
  component("b", "20", ["unknown"], ["resolved", "Variable"], ["conflict"]),
]);
check(() => assert.equal(structure.necessity.amounts.Need, "40"));
check(() => assert.equal(structure.necessity.unknownAmount, "20"));
check(() => assert.equal(structure.behavior.amounts.Variable, "20"));
check(() => assert.equal(structure.lifeScope.conflictAmount, "20"));
check(() => assert.equal(structure.necessity.coverage, 0.5));
const reorderedStructure = globalEconomic.buildGlobalEconomicStructure([
  component("b", "20", ["unknown"], ["resolved", "Variable"], ["conflict"]),
  component("a", "40", ["resolved", "Need"], ["resolved", "Fixed"], ["resolved", "Household"]),
]);
check(() => assert.equal(structure.inputHash, reorderedStructure.inputHash));
const changedStructure = globalEconomic.buildGlobalEconomicStructure([
  component("a", "41", ["resolved", "Need"], ["resolved", "Fixed"], ["resolved", "Household"]),
  component("b", "20", ["unknown"], ["resolved", "Variable"], ["conflict"]),
]);
check(() => assert.notEqual(structure.inputHash, changedStructure.inputHash));
rejects(() => globalEconomic.buildGlobalEconomicStructure([
  component("a", "40", ["resolved", "Need"], ["resolved", "Fixed"], ["resolved", "Household"]),
  component("a", "40", ["resolved", "Need"], ["resolved", "Fixed"], ["resolved", "Household"]),
]), /dupliquée/);

const personA = identity.parsePersonId(uuid(2));
const personB = identity.parsePersonId(uuid(3));
const personFact = (key, amount, person) => ({
  fact: "fct_economic_component", householdId, householdTimeZone: timezone,
  canonicalComponentKey: key, sourceOperation: { kind: "unknown" },
  gross: asMoney(amount), refundApplied: asMoney("0"), net: asMoney(amount),
  bankDate: { kind: "unknown" }, economicTiming: { kind: "unknown" }, person,
  category: { kind: "unknown" }, subcategory: { kind: "unknown" }, activity: { kind: "unknown" },
  merchant: { kind: "unknown" }, moment: { kind: "unknown" }, canonicalPlace: { kind: "unknown" },
  necessity: { kind: "unknown" }, behavior: { kind: "unknown" }, lifeScope: { kind: "unknown" },
});
const personFacts = [
  personFact(`operation:${uuid(20)}`, "100", { kind: "shared", shares: [{ personId: personA, share: "0.6", evidenceRefs: ["beneficiary-share:a"] }, { personId: personB, share: "0.4", evidenceRefs: ["beneficiary-share:b"] }], evidenceRefs: ["share-proof"], payerEvidenceRefs: [] }),
  personFact(`operation:${uuid(21)}`, "40", { kind: "unknown", reasonCode: "NO_EXPLICIT_BENEFICIARY", payerEvidenceRefs: ["payer:a"] }),
];
const personal = globalEconomic.buildGlobalPersonalEconomicSelection({ facts: personFacts, personId: personA, emptyPeriodQualified: true });
check(() => assert.equal(personal.attributableAmount, "60"));
check(() => assert.equal(personal.unattributableAmount, "40"));
check(() => assert.equal(personal.value.status, "PARTIAL"));
check(() => assert.notEqual(personal.amountCoverage, 1));
const noAuthority = globalEconomic.buildGlobalPersonalEconomicSelection({ facts: [personFacts[1]], personId: personA, emptyPeriodQualified: true });
check(() => assert.equal(noAuthority.value.status, "UNKNOWN"));
const qualifiedEmpty = globalEconomic.buildGlobalPersonalEconomicSelection({ facts: [], personId: personA, emptyPeriodQualified: true });
check(() => assert.deepEqual(qualifiedEmpty.value, { status: "KNOWN", value: "0" }));

const timedFact = (key, amount, timingKind = "known") => ({
  canonicalComponentKey: key,
  economicTiming: timingKind === "unknown" ? { kind: "unknown" } : { kind: timingKind, segments: [
    { economicMonth: month("2026-06"), amount: asMoney("5") },
    { economicMonth: month("2026-07"), amount: asMoney(amount) },
  ] },
  bankDate: { kind: "known", date: localDate("2026-01-01") },
  necessity: { kind: "resolved", value: "Need" }, behavior: { kind: "resolved", value: "Variable" }, lifeScope: { kind: "resolved", value: "Household" },
});
const projected = globalEconomic.projectGlobalEconomicStructureMonth({ month: month("2026-07"), facts: [timedFact("timed", "12"), timedFact("unknown-timing", "99", "unknown")] });
check(() => assert.equal(projected.length, 1));
check(() => assert.equal(projected[0].amount, "12"));
check(() => assert.equal(projected[0].canonicalComponentKey, "timed"));

const recurrence = (overrides = {}) => ({
  recurrenceId: "rent",
  kind: "CONTRACTUAL",
  expectedOccurrenceAmount: asMoney("600"),
  expectedOccurrencesPerYear: 1,
  validFrom: localDate("2026-01-01"),
  authority: "ACTIVE_CONTRACT",
  minimalEligible: true,
  dependencyRefs: ["recurrence:rent"],
  ...overrides,
});
const structural = globalEconomic.buildGlobalStructuralChange({
  previousAsOf: localDate("2025-12-31"), asOf: localDate("2026-01-31"),
  previous: [], current: [recurrence()],
});
check(() => assert.equal(structural.active[0].monthlyEquivalent, "50"));
check(() => assert.equal(structural.newRecurringEquivalent, "50"));
check(() => assert.equal(structural.endedRecurringEquivalent, "0"));
const priceChange = globalEconomic.buildGlobalStructuralChange({
  previousAsOf: localDate("2026-01-31"), asOf: localDate("2026-02-28"),
  previous: [recurrence()], current: [recurrence({ expectedOccurrenceAmount: asMoney("720") })],
});
check(() => assert.equal(priceChange.priceChangeExistingRecurrences, "10"));
const future = globalEconomic.buildGlobalStructuralChange({
  previousAsOf: localDate("2026-01-31"), asOf: localDate("2026-02-28"), previous: [],
  current: [recurrence({ recurrenceId: "future", validFrom: localDate("2026-03-01"), authority: "EXPLICIT_FUTURE_AMOUNT" })],
});
check(() => assert.equal(future.active.length, 0));
const empirical = globalEconomic.buildGlobalStructuralChange({
  previousAsOf: localDate("2026-01-31"), asOf: localDate("2026-02-28"), previous: [],
  current: [recurrence({ recurrenceId: "empirical", kind: "EMPIRICAL", minimalEligible: true, authority: "HISTORICAL_ROBUST_ESTIMATE" })],
});
check(() => assert.equal(empirical.active[0].minimalEligible, false));
const single = globalEconomic.buildGlobalStructuralChange({
  previousAsOf: localDate("2026-01-31"), asOf: localDate("2026-02-28"), previous: [],
  current: [recurrence({ recurrenceId: "single", authority: "SINGLE_OCCURRENCE" })],
});
check(() => assert.equal(single.active[0].knowledge, "PARTIAL"));
const authorityPriority = globalEconomic.buildGlobalStructuralChange({
  previousAsOf: localDate("2026-01-31"), asOf: localDate("2026-02-28"), previous: [],
  current: [
    recurrence({ expectedOccurrenceAmount: asMoney("480"), authority: "HISTORICAL_ROBUST_ESTIMATE" }),
    recurrence({ expectedOccurrenceAmount: asMoney("600"), authority: "ACTIVE_CONTRACT" }),
  ],
});
check(() => assert.equal(authorityPriority.active[0].monthlyEquivalent, "50"));
rejects(() => globalEconomic.buildGlobalStructuralChange({
  previousAsOf: localDate("2026-01-31"), asOf: localDate("2026-02-28"), previous: [],
  current: [recurrence(), recurrence({ expectedOccurrenceAmount: asMoney("601") })],
}), /même priorité/);
check(() => assert.deepEqual(globalEconomic.globalM1DeferredTemporalOutputs, {
  trend: { status: "DEFERRED", owner: "P04" }, stability: { status: "DEFERRED", owner: "P04" }, recentChange: { status: "DEFERRED", owner: "P04" },
}));

const declaration = globalEconomic.createGlobalM1DependencyDeclaration({ personScope: { kind: "HOUSEHOLD" }, authorizedPersonIds: [personA, personB] });
const temporalMonths = Array.from({ length: 12 }, (_, i) => ({
  month: month(`2025-${String(i + 1).padStart(2, "0")}`),
  actual: produced("economic_consumption_net_attributable", String(100 + i * 20), { month: `2025-${String(i + 1).padStart(2, "0")}` }),
  isComplete: true, isComparable: true, isMethodExcluded: false, dependencyRefs: [`synthetic:actual:${i}`],
}));
const temporalM1 = globalEconomic.buildGlobalM1Temporal({ certifiedThroughMonth: month("2025-12"), months: temporalMonths });
check(() => assert.equal(temporalM1.trend.slopePerMonth, "20"));
check(() => assert.equal(temporalM1.recentChange.delta, "60"));
check(() => assert.equal(temporalM1.stability.classification.status, "UNKNOWN"));
check(() => assert.equal(temporalM1.trend.driftMateriality.status, "INELIGIBLE"));
check(() => assert.equal(temporalM1.inputHash, globalEconomic.buildGlobalM1Temporal({ certifiedThroughMonth: month("2025-12"), months: [...temporalMonths].reverse() }).inputHash));
check(() => assert.equal(temporalM1.inputHash, globalEconomic.buildGlobalM1Temporal({ certifiedThroughMonth: month("2025-12"), months: [...temporalMonths, { ...temporalMonths[0], month: month("2026-01") }] }).inputHash));
check(() => assert.notEqual(temporalM1.inputHash, globalEconomic.buildGlobalM1Temporal({ certifiedThroughMonth: month("2025-12"), months: temporalMonths.map((m, i) => i === 0 ? { ...m, actual: { ...m.actual, value: asMoney("101") } } : m) }).inputHash));
check(() => assert.equal(declaration.publicationOutputs.length, 0));
check(() => assert.ok(declaration.factDependencies.some(({ id }) => id === "fct_economic_component")));
check(() => assert.ok(declaration.entityDependencies.some(({ id }) => id === "financial_source_person_links")));
check(() => assert.ok(declaration.upstreamAnalytics.some(({ id }) => id === "minimal_month_cost")));
check(() => globalCore.assertNoLiveTailStructuralDependencies(declaration, "STRUCTURAL"));
check(() => globalCore.assertGlobalDependencyClosure(declaration, {
  factDependencyIds: ["fct_economic_component", "fct_economic_component_classification"],
  entityDependencyIds: ["analysis_periods", "minimal_baseline_rules", "recurrence_series", "financial_source_person_links"],
  upstreamAnalyticsIds: ["economic_consumption_net_attributable", "typical_month_cost", "minimal_month_cost"],
  otherModuleDependencyIds: ["GlobalTemporalBoundaryResolver", "history-v2:bank-economy-bridge", "global-temporal-analysis@v1"],
  policyIds: ["global-economic-month-window", "global-typical-support", "global-economic-coverage", "timeWindow", "typicalSupport", "classificationCoverage", "recurrence", "temporalAnalysis", "temporalFinancialCoverage", "temporalMateriality"],
}));

const resolverSource = fs.readFileSync(new URL("../src/server/analytics/fact-source-resolver.ts", import.meta.url), "utf8");
check(() => assert.match(resolverSource, /resolveCanonical[\s\S]*resolveInternal\(metricId, rawScope, false\)/));
check(() => assert.match(resolverSource, /allowCertifiedHistoricalMinimal\s*&&/));
const globalSource = fs.readFileSync(new URL("../src/analytics/global-v2/economic-function.ts", import.meta.url), "utf8");
check(() => assert.doesNotMatch(globalSource, /CertifiedHistoricalMinimalSource|certifiedHistoricalValue/));

console.log(`Global V2 economic function: ${checks}/${checks} checks PASS`);
