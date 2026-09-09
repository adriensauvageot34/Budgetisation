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

const source = await import("node:fs").then(({ readFileSync }) => readFileSync("src/server/analytics/global-v2-economic-authority.ts", "utf8"));
check(() => assert.ok(!source.includes("analytics_query_snapshots")));
check(() => assert.ok(!source.includes("CertifiedHistoricalMinimalSource")));
check(() => assert.ok(source.includes("loadMinimalPlanningBundle")));
check(() => assert.ok(source.includes("recurrenceByOperation")));

console.log(`M1 2/3R engine owner: ${checks}/${checks} PASS`);
