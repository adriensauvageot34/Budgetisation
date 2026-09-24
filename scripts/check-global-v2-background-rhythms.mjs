import assert from "node:assert/strict";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { registerHooks } from "node:module";

const root = process.cwd();
registerHooks({ resolve(specifier, context, next) {
  if (specifier === "server-only") return { url: "data:text/javascript,export{}", shortCircuit: true };
  if (specifier.startsWith("@/")) specifier = pathToFileURL(path.join(root, "src", specifier.slice(2))).href;
  try { return next(specifier, context); } catch (error) {
    if (!specifier.startsWith(".") && !specifier.startsWith("file:")) throw error;
    if (/\.[cm]?[jt]s$/u.test(specifier)) throw error;
    for (const candidate of [`${specifier}.ts`, `${specifier}/index.ts`]) try { return next(candidate, context); } catch { /* next */ }
    throw error;
  }
} });

const core = await import("../src/core/global-v2/index.ts");
const query = await import("../src/query-api/global-v2/index.ts");
const planApi = await import("../src/server/analytics/materialization/global-query-plan.ts");
const candidateApi = await import("../src/server/analytics/global-v2-candidate.ts");
const { carMobilityProjectionFixture } = await import("./check-global-v2-car-mobility-rhythm.mjs");
const { foodRhythmProjectionFixture } = await import("./check-global-v2-food-rhythm.mjs");

let checks = 0;
const check = (fn) => { fn(); checks += 1; };
const rejects = (fn, pattern) => check(() => assert.throws(fn, (error) => pattern.test(`${error.message} ${JSON.stringify(error.issues ?? [])}`)));
const months = Array.from({ length: 12 }, (_, index) => {
  const value = index + 1;
  return `2026-${String(value).padStart(2, "0")}`;
});
const h = (char) => char.repeat(64);
const publicationMeta = { publicationId: "00000000-0000-4000-8000-000000000606", revision: 96, factsHash: h("a"), generatedAt: "2026-09-24T10:00:00Z", profileId: "global-v2-household@v1", manifestHash: h("b") };
const scope = core.normalizeGlobalAnalysisScopeV2({ subject: { kind: "household" }, time: { kind: "global_v2", asOf: "2027-01-02T10:00:00Z", certifiedThrough: "2026-12-31" } }, { householdTimeZone: "Europe/Paris", authorizedPersonIds: [] });
const scopeHash = core.computeGlobalAnalysisScopeV2Hash(scope);
const dependencies = [
  { authority: "METRIC", family: "global_food_rhythm_projection", identity: "global_food_rhythm@v1", digest: h("c"), required: true },
  { authority: "METRIC", family: "global_car_mobility_rhythm_projection", identity: "global_car_mobility_rhythm@v1", digest: h("d"), required: true },
];
const resourceMeta = (resource, params) => ({
  contractVersion: query.globalV2QueryRegistry[resource].contractVersion,
  methodSignature: planApi.globalV2QueryMethodSignature(resource),
  policyVersions: query.globalV2QueryRegistry[resource].policyVersions,
  resourceInputHash: planApi.globalV2QueryResourceInputHash({ resource, scope, params, dependencies }),
});
const totals = (factor = 1) => ({ distanceKm: String(10 * factor), estimatedFuelLiters: String(factor), estimatedFuelCost: String(2 * factor) });
const carQuality = { estimateCoverage: "1", resolvedEstimateCount: 1, eligibleLegCount: 1, estimateKnowledge: "KNOWN", measurementNature: "ESTIMATED", corpusCompleteness: "UNKNOWN", corpusCompletenessReason: "REAL_WORLD_MOBILITY_EXHAUSTIVENESS_NOT_PROVEN" };
const modeled = (factor = 1) => ({ estimatedFuelCost: String(2 * factor), distanceKm: String(10 * factor), estimatedFuelLiters: String(factor), legCount: 1, dataNature: "ESTIMATED", dateBasis: "MOBILITY_LEG_DATE" });
const paid = (factor = 1) => ({ amount: String(3 * factor), operationCount: 1, financialComponentCount: 1, dataNature: "OBSERVED", dateBasis: "ECONOMIC_TIMING" });
const narrativeSummary = { routineGroupCount: 1, tripSummaryCount: 1, contextOnlyCount: 1, suppressedTripCount: 0, visibleItemCount: 3 };
const detailFor = (month) => ({
  routineGroups: [{ routineGroupId: `routine:${month}`, pattern: "WORK_ONLY", title: "Trajets de travail", semanticFamily: "WORK", semanticTier: 1, usageBand: "AROUND_WORK", occurrenceCount: 2, annualOccurrenceCount: 24, mobilityTripIds: [`trip:${month}:a`, `trip:${month}:b`], monthContribution: totals(2), fullTrips: totals(2) }],
  tripSummaries: [{ tripSummaryId: `summary:${month}`, mobilityTripId: `trip:${month}:c`, title: "Sortie", semanticFamily: "LEISURE", semanticTier: 2, usageBand: "OUTSIDE_WORK", multiDay: false, crossMonth: false, startDate: `${month}-10`, endDate: `${month}-10`, targetKind: "MOMENT", targetRef: `moment:${month}`, monthContribution: totals(), fullTrip: totals() }],
  contextOnly: [{ contextOnlyId: `context:${month}`, mobilityTripId: `trip:${month}:d`, title: "Anniversaire", semanticFamily: "FAMILY", semanticTier: 1, usageBand: "OUTSIDE_WORK", relationType: "PRIMARY_CONTEXT", targetKind: "MOMENT", targetRef: `moment:${month}` }],
  destinations: [{ targetKind: "MOMENT", targetRef: `moment:${month}`, title: "Anniversaire" }, { targetKind: "LIFE_EVENT", targetRef: `life-event:${month}`, title: "Déplacement familial" }],
  suppressedRemainder: { tripCount: 0, mobilityTripIds: [], displayText: "+ 0 autres déplacements inclus dans le total mensuel", internalReconciliation: totals(0) },
});
const carMonths = months.map((month, index) => ({
  month,
  modeledUsage: modeled(index + 1),
  observedFuelPaid: paid(index + 1),
  usageComposition: { aroundWorkEstimatedFuelCost: String(index + 1), outsideWorkEstimatedFuelCost: String(index + 1), unresolvedEstimatedFuelCost: "0", classificationCoverage: "1", classificationStatus: "COMPLETE" },
  narrativeSummary: index < 2 ? narrativeSummary : { routineGroupCount: 0, tripSummaryCount: 0, contextOnlyCount: 0, suppressedTripCount: 0, visibleItemCount: 0 },
  detailAvailable: index < 2,
  detail: index < 2 ? detailFor(month) : null,
  quality: carQuality,
}));
const carMobility = {
  period: { startMonth: months[0], endMonth: months[11] },
  annual: { modeledUsage: { ...modeled(78), legCount: 12 }, observedFuelPaid: { ...paid(78), operationCount: 12, financialComponentCount: 12 }, quality: { ...carQuality, resolvedEstimateCount: 12, eligibleLegCount: 12 } },
  months: carMonths,
  comparisonContract: { status: "NOT_RECONCILABLE", reasonCodes: ["PURCHASE_VS_CONSUMPTION_TIMING_MISMATCH", "FUEL_INVENTORY_UNOBSERVED", "MOBILITY_COVERAGE_NOT_EQUIVALENT_TO_FINANCE_COVERAGE", "ESTIMATED_VS_OBSERVED_MONETARY_BASIS"] },
  reconciliation: { status: "PASS", uniqueLegCount: 12, duplicateLegCount: 0, monthlyModeledCostMatchesAnnual: true, monthlyDistanceMatchesAnnual: true, monthlyLitersMatchesAnnual: true, monthlyLegCountMatchesAnnual: true, monthlyUsageCompositionMatchesModeled: true },
  policies: { projection: {}, narrativeMethodVersion: "monthly_mobility_narrative@v1", narrativeRoutinePolicyRef: "mobility-routine-group@v1", narrativeUsageBandPolicyRef: "mobility-usage-band-positive-evidence@v1" },
  methodVersion: "global_car_mobility_rhythm@v1",
  inputHash: h("e"),
};
const highlight = (month, bucket) => ({ highlightId: `highlight:${month}:${bucket}`, stableSourceId: `source:${month}:${bucket}`, amount: "10", sourceType: "OPERATION", date: `${month}-05`, label: bucket });
const foodMonths = months.map((month, index) => ({
  month, courses: "100", restaurants: "20", deliveries: "10", total: "130", nonGroceryAmount: "30", nonGroceryShare: "0.230769",
  groceryBehavior: { occurrenceCount: 2, knownCostOccurrenceCount: 2, coverage: "1", basketStructure: { status: "GATED", reasonCode: "SUPPORT" }, financialAmountAvailable: true },
  restaurantBehavior: { paymentCount: 1, semanticOccurrenceCount: 1, knownCostOccurrenceCount: 1, occurrenceCoverage: "1", linkedFinanceAmountCoverage: "1", medianCost: { status: "KNOWN", value: "20" } },
  deliveryBehavior: { paymentCount: 1, countLabel: "paiements de livraison", occurrenceStatus: "UNKNOWN", reasonCode: "NO_DELIVERY_OCCURRENCE_AUTHORITY" },
  compositionHighlights: { courses: [highlight(month, "courses")], restaurants: [highlight(month, "restaurants")], deliveries: [highlight(month, "deliveries")] },
  quality: { monetaryAuthority: "FINANCE_CANONICAL", financialKnowledge: "KNOWN", groceryBasketKnowledge: "GATED", restaurantMedianKnowledge: "KNOWN", deliveryOccurrenceKnowledge: "UNKNOWN", limitationCodes: [] },
}));
const food = {
  period: { startMonth: months[0], endMonth: months[11] },
  annual: { courses: "1200", restaurants: "240", deliveries: "120", total: "1560", nonGroceryAmount: "360", nonGroceryShare: "0.230769", groceryBehavior: { knownCostOccurrenceCount: 24, eligibleMonthCount: 12, historicalComparisonGate: "AVAILABLE", thresholds: { p25: "20", p75: "50" } }, restaurantBehavior: foodMonths[0].restaurantBehavior, deliveryBehavior: { ...foodMonths[0].deliveryBehavior, paymentCount: 12 } },
  months: foodMonths,
  annotations: [{ annotationId: "food-annotation:1", kind: "MONTH_TO_MONTH_VARIATION", fromMonth: months[0], toMonth: months[1], text: "Variation mensuelle", coursesChange: "0", nonGroceryChange: "0" }],
  policies: {}, reconciliation: { status: "PASS", groceryFinanceStatus: "PASS", monthlyBucketSumsMatchTotal: true, monthlyNonGrocerySumsMatch: true, annualBucketSumsMatchMonths: true, annualTotalMatchesMonths: true },
  methodVersion: "global_food_rhythm@v1", inputHash: h("f"),
};

const snapshots = query.buildGlobalBackgroundRhythmSnapshots({
  food, carMobility, publicationMeta,
  annualResourceMeta: resourceMeta("analysis_global_background_rhythms", {}),
  monthlyResourceMeta: (params) => resourceMeta("analysis_global_background_rhythm_month_detail", params),
  monthlyInstanceKey: (params) => planApi.globalV2QueryInstanceKey("analysis_global_background_rhythm_month_detail", scopeHash, params),
  scopeHash,
});

check(() => assert.equal(query.globalV2QueryRegistry.analysis_global_background_rhythms.paramsKind, "empty"));
check(() => assert.equal(query.globalV2QueryRegistry.analysis_global_background_rhythm_month_detail.paramsKind, "rhythm_month"));
check(() => assert.deepEqual(query.globalV2QueryRegistry.analysis_global_background_rhythms.transport, { priority: "BACKGROUND", activation: "NEAR_VIEWPORT" }));
check(() => assert.deepEqual(query.globalV2QueryRegistry.analysis_global_background_rhythm_month_detail.transport, { priority: "DIRECT", activation: "ON_DEMAND_CLICK" }));
check(() => assert.deepEqual(query.parseGlobalV2QueryParams("analysis_global_background_rhythms", {}), {}));
check(() => assert.deepEqual(query.parseGlobalV2QueryParams("analysis_global_background_rhythm_month_detail", { domain: "CAR_MOBILITY", month: "2026-01" }), { domain: "CAR_MOBILITY", month: "2026-01" }));
rejects(() => query.parseGlobalV2QueryParams("analysis_global_background_rhythm_month_detail", { domain: "FOOD", month: "2026-01" }), /RHYTHM_MONTH_PARAMS_INVALID/u);
rejects(() => query.parseGlobalV2QueryParams("analysis_global_background_rhythm_month_detail", { domain: "CAR_MOBILITY", month: "2026-1" }), /RHYTHM_MONTH_PARAMS_INVALID/u);
rejects(() => query.parseGlobalV2QueryParams("analysis_global_background_rhythm_month_detail", { domain: "CAR_MOBILITY", month: "2026-01", extra: true }), /clé non autorisée/u);
check(() => assert.equal(snapshots.annual.food.months.length, 12));
check(() => assert.equal(snapshots.annual.carMobility.months.length, 12));
check(() => assert.equal(new Set(snapshots.annual.food.months.map(([month]) => month)).size, 12));
check(() => assert.equal(new Set(snapshots.annual.carMobility.months.map(({ month }) => month)).size, 12));
check(() => assert.equal(snapshots.monthlyDetails.length, 2));
check(() => assert.equal(snapshots.expectedFeatureSnapshotCount, 3));
check(() => assert.equal(snapshots.monthlyDetails.length, snapshots.annual.carMobility.months.filter(({ detailAvailable }) => detailAvailable).length));
check(() => assert.ok(snapshots.annualSerializedBytes <= query.GLOBAL_BACKGROUND_RHYTHMS_ANNUAL_PAYLOAD_BUDGET_BYTES));
check(() => assert.ok(snapshots.maximumMonthlyDetailSerializedBytes <= query.GLOBAL_BACKGROUND_RHYTHM_MONTH_DETAIL_PAYLOAD_BUDGET_BYTES));
check(() => assert.ok(snapshots.featureTotalSerializedBytes <= query.GLOBAL_BACKGROUND_RHYTHMS_FEATURE_PAYLOAD_BUDGET_BYTES));
check(() => assert.equal(core.canonicalSerializeGlobal(query.parseGlobalBackgroundRhythmsReadModel(snapshots.annual)), core.canonicalSerializeGlobal(snapshots.annual)));
check(() => assert.equal(/rawLegs|raw context|contextLinks/u.test(core.canonicalSerializeGlobal(snapshots.annual)), false));
check(() => assert.ok(snapshots.monthlyDetails.every(({ payload }) => payload.routineGroups.length <= 3 && payload.tripSummaries.length <= 12 && payload.contextOnly.length <= 4)));
check(() => assert.ok(snapshots.monthlyDetails.every(({ payload }) => payload.destinations.some(({ resource }) => resource === "global_moment") && payload.destinations.some(({ resource }) => resource === "global_life_event"))));

const inputs = [
  { resource: "analysis_global_background_rhythms", scope, params: {}, payload: snapshots.annual, dependencies },
  ...snapshots.monthlyDetails.map(({ params, payload }) => ({ resource: "analysis_global_background_rhythm_month_detail", scope, params, payload, dependencies })),
];
check(() => assert.equal(planApi.buildGlobalV2QueryPlan({ instances: inputs }).instances.length, 3));
rejects(() => planApi.buildGlobalV2QueryPlan({ instances: inputs.slice(0, 2) }), /REACHABLE_INSTANCE_MISSING/u);
for (const forbidden of ["fuelExplainedShare", "explainedAmount", "variance", "residual", "paidVsEstimatedRatio"]) {
  rejects(() => query.parseGlobalBackgroundRhythmsReadModel({ ...structuredClone(snapshots.annual), [forbidden]: "0" }), /FORBIDDEN_FIELD/u);
}
rejects(() => query.parseGlobalBackgroundRhythmsReadModel({ ...structuredClone(snapshots.annual), extra: true }), /clé non autorisée/u);
const tooMany = structuredClone(snapshots.monthlyDetails[0].payload);
tooMany.tripSummaries = Array.from({ length: 13 }, () => tooMany.tripSummaries[0]);
rejects(() => query.parseGlobalBackgroundRhythmMonthDetailReadModel(tooMany), /tripSummaries_INVALID/u);

const ownerOutputs = query.globalPrimaryModuleCatalog.map(({ moduleKey }) => ({ moduleKey, owner: `P6Fixture${moduleKey}`, output: {}, knowledge: "UNKNOWN", capabilityState: "PARTIAL", reasonCodes: ["P6_FIXTURE"], evidenceRefs: [`fixture:${moduleKey}`] }));
const candidate = candidateApi.buildGlobalV2CandidateFromOwnerOutputs({
  project: "p6-background-rhythms-fixture",
  householdId: "00000000-0000-4000-8000-000000000606",
  householdTimeZone: "Europe/Paris",
  personIds: [],
  asOf: "2027-01-02T10:00:00Z",
  certifiedThrough: "2026-12-31",
  dataRevision: "95",
  analyticsRevision: "96",
  implementationIdentity: "1".repeat(40),
  ownerOutputs,
  candidateAdapters: { timeline: { adapterVersion: "fixture-timeline@v1", inputHash: h("7"), events: [] } },
  backgroundRhythms: { food, carMobility },
  momentComponentPresentation: { version: "fixture-moment-components@v1", inputHash: h("9") },
});
check(() => assert.equal(candidate.snapshots.filter(({ resource }) => resource === "analysis_global_background_rhythms").length, 1));
check(() => assert.equal(candidate.snapshots.filter(({ resource }) => resource === "analysis_global_background_rhythm_month_detail").length, 2));
check(() => assert.equal(candidate.artifacts.filter(({ version }) => version.family === "global_background_rhythms").length, 1));
check(() => assert.ok(candidate.versions.artifacts.some(({ family }) => family === "global_background_rhythms")));
check(() => assert.ok(candidate.manifest.requiredQueryKeys.includes(candidate.snapshots.find(({ resource }) => resource === "analysis_global_background_rhythms").key)));
check(() => assert.deepEqual(Object.keys(candidate.artifacts.find(({ version }) => version.family === "global_candidate_adapters").payload.candidateAdapters), ["timeline"]));
check(() => assert.equal(candidate.artifacts.filter(({ version }) => version.family === "global_legacy_grocery_adapter").length, 0));

const productionSizeDiagnostics = Object.fromEntries(Object.entries({
  foodAnnual: foodRhythmProjectionFixture.annual,
  foodMonths: foodRhythmProjectionFixture.months,
  foodHighlights: foodRhythmProjectionFixture.months.map(({ month, compositionHighlights }) => ({ month, compositionHighlights })),
  foodMonthsWithoutHighlights: foodRhythmProjectionFixture.months.map(({ compositionHighlights: _compositionHighlights, ...month }) => month),
  carAnnual: carMobilityProjectionFixture.annual,
  carMonthSummaries: carMobilityProjectionFixture.months.map(({ detail: _detail, ...month }) => month),
}).map(([key, value]) => [key, new TextEncoder().encode(core.canonicalSerializeGlobal(value)).byteLength]));
console.error(`P6_SIZE_DIAGNOSTICS=${JSON.stringify(productionSizeDiagnostics)}`);
const productionSizedSnapshots = query.buildGlobalBackgroundRhythmSnapshots({
  food: foodRhythmProjectionFixture,
  carMobility: carMobilityProjectionFixture,
  publicationMeta,
  annualResourceMeta: resourceMeta("analysis_global_background_rhythms", {}),
  monthlyResourceMeta: (params) => resourceMeta("analysis_global_background_rhythm_month_detail", params),
  monthlyInstanceKey: (params) => planApi.globalV2QueryInstanceKey("analysis_global_background_rhythm_month_detail", scopeHash, params),
  scopeHash,
});
check(() => assert.equal(productionSizedSnapshots.detailAvailableMonths.length, 12));
check(() => assert.equal(productionSizedSnapshots.expectedFeatureSnapshotCount, 13));
check(() => assert.equal(/mobilityLegIds|rawLegs|contextLinks/u.test(core.canonicalSerializeGlobal(productionSizedSnapshots.annual)), false));
const productionSizedRepeat = query.buildGlobalBackgroundRhythmSnapshots({
  food: foodRhythmProjectionFixture, carMobility: carMobilityProjectionFixture, publicationMeta,
  annualResourceMeta: resourceMeta("analysis_global_background_rhythms", {}),
  monthlyResourceMeta: (params) => resourceMeta("analysis_global_background_rhythm_month_detail", params),
  monthlyInstanceKey: (params) => planApi.globalV2QueryInstanceKey("analysis_global_background_rhythm_month_detail", scopeHash, params), scopeHash,
});
check(() => assert.equal(core.canonicalSerializeGlobal(productionSizedRepeat), core.canonicalSerializeGlobal(productionSizedSnapshots)));

console.log(JSON.stringify({
  checks,
  annualSerializedBytes: productionSizedSnapshots.annualSerializedBytes,
  carMonthDetailMaxBytes: productionSizedSnapshots.maximumMonthlyDetailSerializedBytes,
  featureTotalBytes: productionSizedSnapshots.featureTotalSerializedBytes,
  detailAvailableMonths: productionSizedSnapshots.detailAvailableMonths,
  expectedFeatureSnapshotCount: productionSizedSnapshots.expectedFeatureSnapshotCount,
}, null, 2));
