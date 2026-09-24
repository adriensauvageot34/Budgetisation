import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import Big from "big.js";

registerHooks({
  resolve(specifier, context, nextResolve) {
    try { return nextResolve(specifier, context); } catch (originalError) {
      if (!specifier.startsWith(".") || /\.[cm]?[jt]sx?$/u.test(specifier)) throw originalError;
      for (const candidate of [`${specifier}.ts`, `${specifier}/index.ts`]) {
        try { return nextResolve(candidate, context); } catch { /* continue */ }
      }
      throw originalError;
    }
  },
});

const {
  GLOBAL_CAR_MOBILITY_COMPARISON_REASONS,
  GLOBAL_CAR_MOBILITY_RHYTHM_METHOD_VERSION,
  buildGlobalCarMobilityRhythmProjection,
} = await import("../src/analytics/global-v2/car-mobility-rhythm.ts");
const {
  MONTHLY_MOBILITY_NARRATIVE_METHOD_VERSION,
  MOBILITY_ROUTINE_GROUP_POLICY,
  MOBILITY_USAGE_BAND_POLICY,
} = await import("../src/analytics/global-v2/monthly-mobility-narrative.ts");

const FUEL_SUBCATEGORY_ID = "6cc50f88-4a9c-5f10-a56b-3643f3bcbab0";
const monthlyGoldens = [
  ["2025-08", 40, "1011.664", "84.130875", "142.601833125", "130.46"],
  ["2025-09", 45, "686.272", "57.660979", "98.715596048", "180.07"],
  ["2025-10", 61, "562.793", "51.517590", "87.219279870", "43.46"],
  ["2025-11", 63, "301.743", "30.955127", "53.552369710", "66.30"],
  ["2025-12", 53, "410.753", "39.131861", "66.250240673", "84.09"],
  ["2026-01", 60, "261.481", "27.243484", "46.722575060", "85.59"],
  ["2026-02", 63, "772.738", "66.145484", "114.563978288", "50.43"],
  ["2026-03", 65, "1004.511", "82.188531", "158.048545113", "88.81"],
  ["2026-04", 72, "653.059", "56.739839", "115.465572365", "145.51"],
  ["2026-05", 55, "501.450", "44.439705", "92.345706990", "127.68"],
  ["2026-06", 47, "472.483", "42.600976", "84.222129552", "0"],
  ["2026-07", 60, "731.185", "64.515893", "128.773722428", "195.11"],
];
const paidComponents = new Map([
  ["2025-08", ["39.61", "9.97", "22.67", "0.07", "58.14"]],
  ["2025-09", ["67.48", "45.52", "6", "9.77", "51.30"]],
  ["2025-10", ["43.46"]],
  ["2025-11", ["66.30"]],
  ["2025-12", ["64.02", "20.07"]],
  ["2026-01", ["75.59", "10"]],
  ["2026-02", ["50.43"]],
  ["2026-03", ["44.03", "44.78"]],
  ["2026-04", ["72.57", "72.94"]],
  ["2026-05", ["58.95", "68.73"]],
  ["2026-06", []],
  ["2026-07", ["71.18", "63.44", "60.49"]],
]);

let legIndex = 0;
const mobilityLegs = monthlyGoldens.flatMap(([month, count, km, liters, cost]) =>
  Array.from({ length: count }, (_, index) => {
    legIndex += 1;
    const carriesTotals = index === 0;
    return {
      fact: "fct_mobility_leg",
      legId: `leg-${String(legIndex).padStart(4, "0")}`,
      householdId: "household-1",
      vehicleId: "vehicle-1",
      date: `${month}-${String((index % 28) + 1).padStart(2, "0")}`,
      origin: { placeId: "home", sourceLabel: "Maison", resolutionState: "EXPLICIT_MAPPING" },
      destination: { placeId: "destination", sourceLabel: "Destination", resolutionState: "EXPLICIT_MAPPING" },
      distanceKm: carriesTotals ? km : "0",
      durationSeconds: null,
      durationNoTrafficSeconds: null,
      estimatedFuelLiters: carriesTotals ? liters : "0",
      estimatedFuelCost: carriesTotals ? cost : "0",
      fuel: { fuelType: "SP95", pricePerLiter: "1.8", pricePeriod: month, geoScope: "NATIONAL", source: "fixture", quality: "P4_NATIONAL_FALLBACK", observationId: null },
      time: { observedTime: null, authority: "UNKNOWN", type: "UNKNOWN", routeTimeBasis: null, routeProxyTimes: [] },
      consumptionModelRef: "fixture-consumption@v1",
      routeMethodRef: "fixture-route@v1",
      source: { datasetId: "dataset-1", sourceLegId: `source-${legIndex}`, group: "NAV", sheet: "fixture", reconstruction: "fixture", quality: "CERTIFIED", status: "CERTIFIED_SOURCE", confidence: "HIGH", sourceRowHash: `hash-${legIndex}` },
      methodVersion: "mobility_leg@v1",
      evidenceRefs: [`fixture:leg:${legIndex}`],
      provenance: "estimated",
    };
  }));

const zeroPhysical = { distanceKm: "0", estimatedFuelLiters: "0" };
const partialMonths = new Set(["2025-08", "2026-02", "2026-07"]);
const narrativeMonths = monthlyGoldens.map(([month, , , , cost], index) => {
  const unresolved = partialMonths.has(month) ? new Big(cost).div(10) : new Big(0);
  const classified = new Big(cost).minus(unresolved);
  const aroundWork = classified.times("0.6");
  const outsideWork = classified.minus(aroundWork);
  const metric = (estimatedFuelCost) => ({ ...zeroPhysical, estimatedFuelCost: new Big(estimatedFuelCost).toString() });
  const routineGroupId = `routine:${month}`;
  return {
    month,
    routineGroups: [{
      routineGroupId,
      pattern: "WORK_ONLY",
      title: "Trajets travail",
      semanticFamily: "WORK",
      semanticTier: 2,
      occurrenceCount: 1,
      annualOccurrenceCount: 12,
      mobilityTripIds: [`trip-${index}`],
      monthContribution: metric(cost),
      fullTrips: metric(cost),
    }],
    tripSummaries: [],
    contextOnly: [],
    suppressedRemainder: { tripCount: 0, mobilityTripIds: [], displayText: "Aucun autre trajet", internalReconciliation: metric("0") },
    partition: [{ mobilityTripId: `trip-${index}`, destination: "ROUTINE_GROUP", destinationRef: routineGroupId, usageBand: "AROUND_WORK" }],
    usageBands: {
      aroundWork: metric(aroundWork),
      outsideWork: metric(outsideWork),
      unresolved: metric(unresolved),
      modeledUsage: metric(cost),
      classificationCoverage: partialMonths.has(month) ? "0.9" : "1",
    },
    initialSurface: [{ kind: "ROUTINE_GROUP", ref: routineGroupId }],
  };
});

const monthlyNarrative = {
  methodVersion: MONTHLY_MOBILITY_NARRATIVE_METHOD_VERSION,
  routineGroupPolicy: MOBILITY_ROUTINE_GROUP_POLICY,
  usageBandPolicy: MOBILITY_USAGE_BAND_POLICY,
  months: narrativeMonths,
  annualNarrativeCandidates: [],
  annualUsageBands: narrativeMonths.reduce((result, month) => ({
    aroundWork: { ...zeroPhysical, estimatedFuelCost: new Big(result.aroundWork.estimatedFuelCost).plus(month.usageBands.aroundWork.estimatedFuelCost).toString() },
    outsideWork: { ...zeroPhysical, estimatedFuelCost: new Big(result.outsideWork.estimatedFuelCost).plus(month.usageBands.outsideWork.estimatedFuelCost).toString() },
    unresolved: { ...zeroPhysical, estimatedFuelCost: new Big(result.unresolved.estimatedFuelCost).plus(month.usageBands.unresolved.estimatedFuelCost).toString() },
    modeledUsage: { ...zeroPhysical, estimatedFuelCost: new Big(result.modeledUsage.estimatedFuelCost).plus(month.usageBands.modeledUsage.estimatedFuelCost).toString() },
    classificationCoverage: "0",
  }), { aroundWork: { ...zeroPhysical, estimatedFuelCost: "0" }, outsideWork: { ...zeroPhysical, estimatedFuelCost: "0" }, unresolved: { ...zeroPhysical, estimatedFuelCost: "0" }, modeledUsage: { ...zeroPhysical, estimatedFuelCost: "0" }, classificationCoverage: "0" }),
  inputHash: "narrative-input",
  outputHash: "narrative-output",
};

function economicFact(month, amount, index) {
  return {
    fact: "fct_economic_component",
    householdId: "household-1",
    householdTimeZone: "Europe/Paris",
    canonicalComponentKey: `fuel-component-${index}`,
    sourceKind: "Operation_parent",
    sourceOperation: { kind: "resolved", id: `fuel-operation-${index}` },
    gross: amount,
    refundApplied: "0",
    net: amount,
    bankDate: { kind: "known", date: `${month}-10` },
    economicTiming: { kind: "known", segments: [{ segmentKey: `fuel-segment-${index}`, timingState: "known", periodStart: `${month}-10`, periodEnd: `${month}-10`, economicMonth: month, amount }] },
    person: { kind: "unknown" },
    category: { kind: "resolved", id: "transport-category" },
    subcategory: { kind: "resolved", id: FUEL_SUBCATEGORY_ID },
    activity: { kind: "unknown" },
    merchant: { kind: "unknown" },
    moment: { kind: "unknown" },
    canonicalPlace: { kind: "unknown" },
    necessity: { kind: "unknown" },
    behavior: { kind: "unknown" },
    lifeScope: { kind: "unknown" },
  };
}

let componentIndex = 0;
const economicFacts = monthlyGoldens.flatMap(([month]) => (paidComponents.get(month) ?? []).map((amount) => {
  componentIndex += 1;
  return economicFact(month, amount, componentIndex);
}));
const projectionInput = {
  startMonth: "2025-08",
  endMonth: "2026-07",
  mobilityLegs,
  monthlyNarrative,
  economicFacts,
  fuelSubcategoryId: FUEL_SUBCATEGORY_ID,
};
const projection = buildGlobalCarMobilityRhythmProjection(projectionInput);
export { projection as carMobilityProjectionFixture };
let checks = 0;
const check = (assertion) => { assertion(); checks += 1; };
const displayMoney = (value) => new Big(value).toFixed(2);

check(() => assert.equal(projection.methodVersion, GLOBAL_CAR_MOBILITY_RHYTHM_METHOD_VERSION));
check(() => assert.equal(projection.months.length, 12));
check(() => assert.equal(new Set(projection.months.map(({ month }) => month)).size, 12));
for (const [month, legs, km, liters, cost, paid] of monthlyGoldens) {
  const actual = projection.months.find((value) => value.month === month);
  check(() => assert.ok(actual));
  check(() => assert.equal(actual.modeledUsage.legCount, legs));
  check(() => assert.ok(new Big(actual.modeledUsage.distanceKm).eq(km)));
  check(() => assert.ok(new Big(actual.modeledUsage.estimatedFuelLiters).eq(liters)));
  check(() => assert.ok(new Big(actual.modeledUsage.estimatedFuelCost).eq(cost)));
  check(() => assert.equal(displayMoney(actual.modeledUsage.estimatedFuelCost), new Big(cost).toFixed(2)));
  check(() => assert.ok(new Big(actual.observedFuelPaid.amount).eq(paid)));
  check(() => assert.ok(new Big(actual.usageComposition.aroundWorkEstimatedFuelCost)
    .plus(actual.usageComposition.outsideWorkEstimatedFuelCost)
    .plus(actual.usageComposition.unresolvedEstimatedFuelCost)
    .eq(actual.modeledUsage.estimatedFuelCost)));
  check(() => assert.equal(actual.detailAvailable, true));
}
check(() => assert.equal(projection.reconciliation.uniqueLegCount, 684));
check(() => assert.equal(projection.reconciliation.duplicateLegCount, 0));
check(() => assert.equal(projection.reconciliation.status, "PASS"));
check(() => assert.ok(new Big(projection.annual.modeledUsage.distanceKm).eq("7370.132")));
check(() => assert.ok(new Big(projection.annual.modeledUsage.estimatedFuelLiters).eq("647.270344")));
check(() => assert.ok(new Big(projection.annual.modeledUsage.estimatedFuelCost).eq("1188.481549222")));
check(() => assert.equal(displayMoney(projection.annual.modeledUsage.estimatedFuelCost), "1188.48"));
check(() => assert.ok(new Big(projection.annual.observedFuelPaid.amount).eq("1197.51")));
check(() => assert.equal(displayMoney(projection.annual.observedFuelPaid.amount), "1197.51"));
check(() => assert.equal(projection.annual.observedFuelPaid.operationCount, 26));
check(() => assert.equal(projection.annual.observedFuelPaid.financialComponentCount, 26));
check(() => assert.equal(projection.annual.quality.estimateCoverage, "1"));
check(() => assert.equal(projection.annual.quality.corpusCompleteness, "UNKNOWN"));
check(() => assert.equal(projection.annual.quality.corpusCompletenessReason, "REAL_WORLD_MOBILITY_EXHAUSTIVENESS_NOT_PROVEN"));
check(() => assert.equal(projection.annual.modeledUsage.dataNature, "ESTIMATED"));
check(() => assert.equal(projection.annual.observedFuelPaid.dataNature, "OBSERVED"));
const june = projection.months.find(({ month }) => month === "2026-06");
check(() => assert.equal(displayMoney(june.modeledUsage.estimatedFuelCost), "84.22"));
check(() => assert.equal(displayMoney(june.observedFuelPaid.amount), "0.00"));
check(() => assert.equal(projection.comparisonContract.status, "NOT_RECONCILABLE"));
check(() => assert.deepEqual(projection.comparisonContract.reasonCodes, GLOBAL_CAR_MOBILITY_COMPARISON_REASONS));
const forbidden = new Set(["difference", "ratio", "explainedShare", "unexplainedAmount", "residual", "variance", "reconciliationDelta"]);
function assertNoForbiddenFields(value) {
  if (value === null || typeof value !== "object") return;
  for (const [key, child] of Object.entries(value)) {
    assert.equal(forbidden.has(key), false, `forbidden field: ${key}`);
    assertNoForbiddenFields(child);
  }
}
check(() => assertNoForbiddenFields(projection));
const repeated = buildGlobalCarMobilityRhythmProjection(projectionInput);
check(() => assert.deepEqual(repeated, projection));
check(() => assert.equal(projection.months.filter(({ usageComposition }) => usageComposition.classificationStatus === "PARTIAL").length, 3));
check(() => assert.equal(projection.months.filter(({ detailAvailable }) => detailAvailable).length, 12));
const unavailableNarrative = {
  ...monthlyNarrative,
  months: monthlyNarrative.months.map((month) => month.month === "2026-06" ? { ...month, initialSurface: [] } : month),
};
const unavailableProjection = buildGlobalCarMobilityRhythmProjection({ ...projectionInput, monthlyNarrative: unavailableNarrative });
check(() => assert.equal(unavailableProjection.months.find(({ month }) => month === "2026-06").detailAvailable, false));
check(() => assert.equal(unavailableProjection.months.find(({ month }) => month === "2026-06").detail, null));

console.log(JSON.stringify({
  status: "PASS",
  methodVersion: GLOBAL_CAR_MOBILITY_RHYTHM_METHOD_VERSION,
  checks,
  annual: {
    legs: projection.annual.modeledUsage.legCount,
    km: projection.annual.modeledUsage.distanceKm,
    liters: projection.annual.modeledUsage.estimatedFuelLiters,
    modeledCost: projection.annual.modeledUsage.estimatedFuelCost,
    fuelPaid: projection.annual.observedFuelPaid.amount,
  },
  detailAvailableMonths: projection.months.filter(({ detailAvailable }) => detailAvailable).length,
  classificationPartialMonths: projection.months.filter(({ usageComposition }) => usageComposition.classificationStatus === "PARTIAL").length,
  reconciliation: projection.reconciliation.status,
  comparison: projection.comparisonContract.status,
}));
