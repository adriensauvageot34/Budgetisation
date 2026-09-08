import assert from "node:assert/strict";
import fs from "node:fs";
import Module, { createRequire } from "node:module";
import path from "node:path";
import process from "node:process";
import ts from "typescript";

const require = createRequire(import.meta.url);
const repositoryRoot = process.cwd();
const originalResolveFilename = Module._resolveFilename;
const originalLoad = Module._load;
Module._load = function loadModule(request, parent, isMain) {
  if (request === "server-only") return {};
  return originalLoad.call(this, request, parent, isMain);
};
Module._resolveFilename = function resolveModule(request, parent, isMain, options) {
  const resolvedRequest = request.startsWith("@/")
    ? path.join(repositoryRoot, "src", request.slice(2))
    : request;
  try { return originalResolveFilename.call(this, resolvedRequest, parent, isMain, options); }
  catch (originalError) {
    if (path.extname(resolvedRequest) !== "") throw originalError;
    for (const candidate of [`${resolvedRequest}.ts`, `${resolvedRequest}.tsx`, path.join(resolvedRequest, "index.ts")]) {
      try { return originalResolveFilename.call(this, candidate, parent, isMain, options); } catch { /* next */ }
    }
    throw originalError;
  }
};
for (const extension of [".ts", ".tsx"]) {
  require.extensions[extension] = (module, filename) => {
    const source = fs.readFileSync(filename, "utf8");
    const output = ts.transpileModule(source, {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true, jsx: ts.JsxEmit.ReactJSX },
      fileName: filename,
    }).outputText;
    module._compile(output, filename);
  };
}

const baseline = require(path.join(repositoryRoot, "src/analytics/baseline/index.ts"));
const globalEconomic = require(path.join(repositoryRoot, "src/analytics/global-v2/economic-function.ts"));
const temporal = require(path.join(repositoryRoot, "src/analytics/global-v2/temporal-descriptive.ts"));
const minimalResolver = require(path.join(repositoryRoot, "src/server/analytics/minimal-source-resolver.ts"));

let checks = 0;
const check = (callback) => { callback(); checks += 1; };
const targetMonth = "2026-02";
const authorityIdentity = {
  authorityId: "authority:variable-essential",
  effectiveFrom: "2025-01-01",
  declaredAt: "2025-01-01T00:00:00Z",
  sourceRevision: 1,
  authorityType: "RETROSPECTIVE_DECLARATION",
  declaredByRef: "test:operator",
  validationRef: "test:validation",
  methodVersion: "minimal_historical_authority@v1",
  evidenceRefs: ["test:evidence"],
};
const knowledgeAsOf = "2026-02-28T23:59:59Z";
const rule = (family = "VARIABLE_ESSENTIAL", overrides = {}) => ({ ...authorityIdentity, family, ...overrides });
const observation = (month, amount, overrides = {}) => ({
  month, status: "KNOWN", amount: String(amount), eligible: true, evidenceRefs: [`fact:${month}`], ...overrides,
});
const months = Array.from({ length: 12 }, (_, index) => `2025-${String(index + 1).padStart(2, "0")}`);
const twelve = months.map((month, index) => observation(month, index * 10));
const calculateQ25 = (observations = twelve, ruleOverride = rule()) => baseline.calculateVariableEssentialQ25({
  canonicalComponentKey: "component:variable", targetMonth, knowledgeAsOf, observations, rule: ruleOverride,
});

const q25 = calculateQ25();
check(() => assert.equal(q25.status, "KNOWN"));
check(() => assert.equal(q25.component.amount, "27.5"));
check(() => assert.equal(q25.component.support.n, 12));
check(() => assert.equal(q25.methodVersion, "minimal_variable_essential_q25@v2"));

const five = calculateQ25(twelve.slice(0, 5));
check(() => assert.equal(five.status, "UNKNOWN"));
check(() => assert.equal(five.reasonCode, "INSUFFICIENT_ELIGIBLE_OBSERVATIONS"));
const six = calculateQ25(twelve.slice(0, 6));
check(() => assert.equal(six.status, "KNOWN"));
check(() => assert.equal(six.component.amount, "12.5"));

const thirteen = [observation("2024-12", 9999), ...twelve];
check(() => assert.equal(calculateQ25(thirteen).component.amount, "27.5"));
const future = observation("2026-03", 9999);
check(() => assert.equal(calculateQ25([...twelve, future]).inputHash, q25.inputHash));
check(() => assert.equal(calculateQ25(twelve.map((item) => item.month === "2025-06"
  ? { month: "2025-06", status: "UNKNOWN", eligible: true, evidenceRefs: ["gap:2025-06"] }
  : item)).component.amount, "25"));
check(() => assert.equal(calculateQ25(twelve.map((item, index) => index === 0 ? observation(item.month, 0) : item)).component.support.n, 12));
const futureRule = calculateQ25(twelve, rule("VARIABLE_ESSENTIAL", { effectiveFrom: "2026-03-01" }));
check(() => assert.equal(futureRule.status, "UNKNOWN"));
check(() => assert.equal(futureRule.reasonCode, "RULE_NOT_EFFECTIVE"));

const declaredPlan = (includeAuthority) => ({
  canonicalComponentKey: "component:declared",
  bucket: "OBLIGATION_OR_PROVISION",
  rule: rule("DECLARED_MINIMUM", { authorityId: "authority:declared-rule" }),
  observations: [],
  ...(includeAuthority ? { declaredMinimumAuthority: {
    ...authorityIdentity, authorityId: "authority:declared-value", authorityType: "DECLARED", amount: "40",
  } } : {}),
});
const variablePlan = {
  canonicalComponentKey: "component:variable",
  bucket: "NEUTRAL_VARIABLE",
  rule: rule(),
  observations: twelve,
};
const authorityBundle = (components) => ({
  model: "BITEMPORAL_TYPED_RULE_AND_RECURRENCE_AUTHORITY_V1",
  completeness: "COMPLETE_FOR_TARGET_MONTH",
  knowledgeAsOf,
  components,
});
const declaredMissing = baseline.resolveHistoricalMinimalState({ targetMonth, authority: authorityBundle([variablePlan, declaredPlan(false)]) });
check(() => assert.equal(declaredMissing.status, "UNKNOWN"));
check(() => assert.equal(declaredMissing.componentStates.find((state) => state.canonicalComponentKey === "component:variable" || state.component?.canonicalComponentKey === "component:variable").status, "KNOWN"));
check(() => assert.equal(declaredMissing.componentStates.find((state) => state.canonicalComponentKey === "component:declared").reasonCode, "DECLARED_AUTHORITY_MISSING"));
const minimalKnown = baseline.resolveHistoricalMinimalState({ targetMonth, authority: authorityBundle([variablePlan, declaredPlan(true)]) });
check(() => assert.equal(minimalKnown.status, "KNOWN"));
check(() => assert.equal(minimalKnown.value, "67.5"));
check(() => assert.equal(minimalKnown.methodVersion, "minimal_month_cost@v2"));

const emptyBundle = {
  economicFacts: [], operations: [], allocations: [], items: [], paymentComponents: [], cashUses: [],
  baselineRules: [{ currentOnly: true }], needs: [], provisionPools: [],
  recurrenceSeries: [{ actif_prevision: true }], annualEvents: [], worksiteActivityTypeIds: [], plannedActivityDays: [],
};
const gated = minimalResolver.resolveMinimalPlanningSource({ bundle: emptyBundle, targetMonth, referenceMonths: months });
check(() => assert.equal(gated.availability, "unknown"));
check(() => assert.equal(gated.neutralVariableComponents.length, 0));
const resolved = minimalResolver.resolveMinimalPlanningSource({ bundle: { ...emptyBundle, historicalMinimalAuthority: authorityBundle([variablePlan, declaredPlan(true)]) }, targetMonth, referenceMonths: months });
check(() => assert.equal(resolved.availability, "known"));
check(() => assert.equal(resolved.neutralVariableComponents[0].amount, "27.5"));

const typicalOccurrence = globalEconomic.calculateTypicalOccurrenceCost(["90", "10", "40"]);
check(() => assert.equal(typicalOccurrence.status, "KNOWN"));
check(() => assert.equal(typicalOccurrence.value, "40"));
check(() => assert.equal(typicalOccurrence.unit, "EUR/occurrence"));
check(() => assert.equal(typicalOccurrence.support.naturalGrain, "OCCURRENCE"));
check(() => assert.deepEqual(
  globalEconomic.calculateTypicalOccurrenceCost(undefined),
  { status: "UNKNOWN", unit: "EUR/occurrence" },
));

const temporalPoints = Array.from({ length: 12 }, (_, index) => ({
  month: `2025-${String(index + 1).padStart(2, "0")}`,
  corpus: "CERTIFIED_HISTORY", status: "KNOWN", value: String(100 + index * 5), eligible: true, complete: true,
  dependencyRefs: [`actual:${index}`],
}));
const temporalResult = temporal.buildGlobalTemporalDescriptive({ certifiedThroughMonth: "2025-12", points: temporalPoints });
check(() => assert.equal(temporalResult.trend.relativeSlope.value, "0.05"));
check(() => assert.equal(temporalResult.trend.support.count, 12));
check(() => assert.equal(temporalResult.trend.methodVersion, "global_trend_theil_sen@v2"));
check(() => assert.deepEqual(
  { minimum: temporalResult.dispersion.minimum, maximum: temporalResult.dispersion.maximum, amplitude: temporalResult.dispersion.amplitude },
  { minimum: "100", maximum: "155", amplitude: "55" },
));

const unknownMinimalMetric = {
  metricId: "minimal_month_cost", scopeHash: "a".repeat(64), availability: "unknown", value: null,
  unit: "EUR/month", provenance: "derived", methodVersion: "minimal_month_cost@v1",
};
check(() => assert.equal(globalEconomic.adaptGlobalMinimal({ metric: unknownMinimalMetric, neutralVariableComponents: [], mandatoryMonthlyObligationsAndProvisions: [] }).metric.availability, "unknown"));
const officialActual = (month, value) => ({
  metricId: "economic_consumption_net_attributable", scopeHash: "b".repeat(64), availability: "known", value: String(value),
  unit: "EUR/month", provenance: "observed", methodVersion: "economic_consumption_net_attributable@v1",
});
check(() => assert.equal(globalEconomic.adaptGlobalActual(officialActual("2025-01", 100)).value.status, "KNOWN"));
const typical = globalEconomic.buildGlobalTypicalPair({
  householdId: "00000000-0000-4000-8000-000000000001",
  householdTimeZone: "Europe/Paris",
  targetMonth: "2026-02",
  months: Array.from({ length: 7 }, (_, index) => {
    const month = `2025-${String(index + 1).padStart(2, "0")}`;
    return { month, actual: officialActual(month, 100 + index * 10), isComplete: true, isComparable: true, isMethodExcluded: false, dependencyRefs: [`actual:${month}`] };
  }),
});
check(() => assert.equal(typical.reference.status, "KNOWN"));
const structure = globalEconomic.buildGlobalEconomicStructure([{
  canonicalComponentKey: "operation:1", amount: "100",
  necessity: { kind: "resolved", value: "Need" }, behavior: { kind: "resolved", value: "Fixed" }, lifeScope: { kind: "resolved", value: "Household" },
}]);
check(() => assert.equal(structure.necessity.amounts.Need, "100"));
const recurrence = globalEconomic.buildGlobalStructuralChange({
  previousAsOf: "2025-12-31", asOf: "2026-01-31", previous: [], current: [{
    recurrenceId: "recurrence:1", kind: "CONTRACTUAL", expectedOccurrenceAmount: "60", eligibleOccurrenceCosts: ["40", "20", "80"],
    expectedOccurrencesPerYear: 12, validFrom: "2025-01-01", authority: "ACTIVE_CONTRACT", minimalEligible: true, dependencyRefs: ["recurrence:1"],
  }],
});
check(() => assert.equal(recurrence.active.length, 1));
check(() => assert.equal(recurrence.active[0].typicalOccurrenceCost.value, "40"));
check(() => assert.equal(recurrence.active[0].expectedOccurrenceAmount, "60"));
check(() => assert.equal(temporalResult.trend.status, "KNOWN"));
check(() => assert.equal(temporalResult.recentChange.status, "KNOWN"));

const declaration = globalEconomic.createGlobalM1DependencyDeclaration({ personScope: { kind: "HOUSEHOLD" }, authorizedPersonIds: [] });
check(() => assert.equal(declaration.upstreamAnalytics.find(({ id }) => id === "minimal_month_cost").requirement, "OPTIONAL"));
check(() => assert.ok(declaration.entityDependencies.filter(({ id }) => id.startsWith("historical_")).every(({ requirement }) => requirement === "OPTIONAL")));

const resolverSource = fs.readFileSync(path.join(repositoryRoot, "src/server/analytics/minimal-source-resolver.ts"), "utf8");
check(() => assert.doesNotMatch(resolverSource, /bundle\.recurrenceSeries|parseRules\(bundle\.baselineRules\)|medianMoney\(|\.div\(months\.length\)/));
check(() => assert.match(resolverSource, /if \(authority === undefined\) return missingResolution\(\)/));

console.log(`M1-1R shared safe foundations: ${checks}/${checks} PASS`);
