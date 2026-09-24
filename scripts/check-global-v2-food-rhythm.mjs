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
  GLOBAL_FOOD_HIGHLIGHT_POLICY_VERSION,
  GLOBAL_FOOD_RHYTHM_METHOD_VERSION,
  buildGlobalFoodRhythmProjection,
} = await import("../src/analytics/global-v2/food-rhythm.ts");
const {
  GLOBAL_GROCERY_ADAPTER_VERSION,
  globalGroceryBasketPolicy,
} = await import("../src/analytics/global-v2/candidate-adapters.ts");

const goldens = [
  ["2025-08", "479.74", "38.80", "0.00", "518.54"],
  ["2025-09", "662.71", "242.13", "26.35", "931.19"],
  ["2025-10", "546.58", "77.05", "0.00", "623.63"],
  ["2025-11", "417.80", "184.10", "30.80", "632.70"],
  ["2025-12", "280.98", "113.90", "67.17", "462.05"],
  ["2026-01", "536.38", "56.85", "10.75", "603.98"],
  ["2026-02", "356.29", "59.85", "0.00", "416.14"],
  ["2026-03", "248.47", "68.15", "0.00", "316.62"],
  ["2026-04", "353.74", "77.65", "0.00", "431.39"],
  ["2026-05", "397.06", "127.30", "0.00", "524.36"],
  ["2026-06", "556.16", "163.55", "24.10", "743.81"],
  ["2026-07", "439.97", "94.20", "0.00", "534.17"],
];
const groceryOccurrenceCounts = [8, 6, 6, 10, 9, 10, 10, 8, 12, 11, 11, 9];
const groceryKnownCounts = [8, 4, 6, 9, 7, 9, 8, 5, 9, 9, 8, 5];
const restaurantOccurrenceCounts = [7, 9, 11, 10, 16, 9, 16, 17, 18, 11, 14, 10];
const restaurantKnownCounts = [3, 0, 3, 4, 4, 1, 2, 2, 1, 2, 5, 1];
const coursePaymentCounts = [16, 17, 14, 12, 13, 18, 15, 9, 18, 14, 17, 16];
const restaurantPaymentCounts = [4, 12, 8, 10, 8, 6, 8, 9, 10, 8, 12, 5];
const deliveryPaymentCounts = [0, 1, 0, 1, 4, 1, 0, 0, 0, 0, 1, 0];
const eligibleMonths = new Set(goldens.filter((_, index) => groceryKnownCounts[index] / groceryOccurrenceCounts[index] >= 0.7).map(([month]) => month));

function splitAmount(total, count) {
  if (count === 0) return [];
  return Array.from({ length: count }, (_, index) => index === count - 1
    ? new Big(total).minus(count - 1).toString()
    : "1");
}

let componentIndex = 0;
function financeComponents(month, bucket, total, count, monthIndex) {
  return splitAmount(total, count).map((amount, index) => {
    componentIndex += 1;
    const isExactWorkBakery = bucket === "RESTAURANTS" && month === "2025-08" && index === 0;
    return {
      canonicalComponentKey: `component:${bucket}:${month}:${index}`,
      economicSegmentKey: `segment:${String(componentIndex).padStart(4, "0")}`,
      operationId: `operation:${bucket}:${month}:${index}`,
      economicMonth: month,
      economicDate: `${month}-${String((index % 27) + 1).padStart(2, "0")}`,
      amount,
      subcategoryKey: bucket === "COURSES"
        ? "alimentation__courses_alimentaires"
        : bucket === "DELIVERIES"
          ? "restauration__livraison_de_repas"
          : isExactWorkBakery
            ? "alimentation__boulangerie"
            : index % 2 === 0 ? "restauration__restaurant" : "restauration__fast_food_snack",
      operationTypePrecis: isExactWorkBakery ? "Repas du midi au travail" : null,
      merchantLabel: index % 3 === 0 ? `${bucket} marchand ${monthIndex}-${index}` : null,
      articleCount: bucket === "COURSES" && index % 4 === 0 ? index + 1 : null,
      sourceType: "OPERATION",
    };
  });
}

const financialComponents = goldens.flatMap(([month, courses, restaurants, deliveries], monthIndex) => [
  ...financeComponents(month, "COURSES", courses, coursePaymentCounts[monthIndex], monthIndex),
  ...financeComponents(month, "RESTAURANTS", restaurants, restaurantPaymentCounts[monthIndex], monthIndex),
  ...financeComponents(month, "DELIVERIES", deliveries, deliveryPaymentCounts[monthIndex], monthIndex),
]);
financialComponents.push({
  canonicalComponentKey: "component:bakery:excluded",
  economicSegmentKey: "segment:bakery:excluded",
  operationId: "operation:bakery:excluded",
  economicMonth: "2025-08",
  economicDate: "2025-08-31",
  amount: "999",
  subcategoryKey: "alimentation__boulangerie",
  operationTypePrecis: "Repas du midi au travail ",
  merchantLabel: "Boulangerie hors scope exact",
  articleCount: null,
  sourceType: "OPERATION",
});

const grocery = {
  adapterVersion: GLOBAL_GROCERY_ADAPTER_VERSION,
  grain: "HOUSEHOLD_MONTH",
  basketPolicy: globalGroceryBasketPolicy,
  thresholds: { p25: "18.29", p75: "51.99" },
  months: goldens.map(([month, courses], index) => {
    const known = groceryKnownCounts[index];
    const small = Math.floor(known / 3);
    const intermediate = Math.floor((known - small) / 2);
    return {
      month,
      occurrenceCount: groceryOccurrenceCounts[index],
      knownCostOccurrenceCount: known,
      coverage: known / groceryOccurrenceCounts[index],
      basketStructure: eligibleMonths.has(month)
        ? { status: "KNOWN", small, intermediate, large: known - small - intermediate }
        : { status: "GATED", reasonCode: "COVERAGE_BELOW_70_PERCENT" },
      monthlyGrocerySpend: { status: "KNOWN", value: new Big(courses).toString() },
      limitationCodes: eligibleMonths.has(month) ? [] : ["BASKET_STRUCTURE_COVERAGE_BELOW_70_PERCENT"],
    };
  }),
  eligibleMonthCount: eligibleMonths.size,
  historicalComparisonGate: "AVAILABLE",
  dependencyClosure: [],
  inputHash: "g".repeat(64),
};

const activityOccurrences = [];
const activityCosts = [];
let occurrenceIndex = 0;
function addActivityMonth(month, activityId, occurrenceCount, knownCount, componentKeys, knownValue) {
  for (let index = 0; index < occurrenceCount; index += 1) {
    occurrenceIndex += 1;
    const occurrenceId = `occurrence:${activityId}:${String(occurrenceIndex).padStart(4, "0")}`;
    activityOccurrences.push({
      fact: "fct_activity_occurrence",
      householdId: "household-1",
      householdTimeZone: "Europe/Paris",
      lifeEventId: occurrenceId,
      activityId,
      lifeEventSeriesId: null,
      parentLifeEventId: null,
      startDate: `${month}-${String((index % 27) + 1).padStart(2, "0")}`,
      endDate: `${month}-${String((index % 27) + 1).padStart(2, "0")}`,
      validationStatus: "Confirmé",
      participantIds: [],
    });
    const known = index < knownCount;
    activityCosts.push({
      fact: "fct_activity_occurrence_cost",
      householdId: "household-1",
      householdTimeZone: "Europe/Paris",
      occurrenceId,
      activityId,
      causalCost: known ? { availability: "known", value: knownValue(index) } : { availability: "unknown", value: null },
      coverage: known ? { level: "complete" } : { level: "partial" },
      support: { n: known ? 1 : 0, eligibleN: 1, observableN: 1, excludedN: known ? 0 : 1, unit: "occurrence", level: "insufficient" },
      evidence: known ? [{ financialLinkId: `link:${occurrenceId}`, canonicalComponentKey: componentKeys[index], relationType: "Paiement_activite" }] : [],
      provenance: "derived",
    });
  }
}
for (const [index, [month]] of goldens.entries()) {
  const courseComponents = financialComponents.filter(({ economicMonth, subcategoryKey }) => economicMonth === month && subcategoryKey === "alimentation__courses_alimentaires");
  const restaurantComponents = financialComponents.filter(({ economicMonth, subcategoryKey, operationTypePrecis }) => economicMonth === month && (subcategoryKey.startsWith("restauration__") && subcategoryKey !== "restauration__livraison_de_repas" || operationTypePrecis === "Repas du midi au travail"));
  addActivityMonth(month, "courses_alimentaires", groceryOccurrenceCounts[index], groceryKnownCounts[index], courseComponents.map(({ canonicalComponentKey }) => canonicalComponentKey), (costIndex) => courseComponents[costIndex].amount);
  addActivityMonth(month, "repas_restaurant", restaurantOccurrenceCounts[index], restaurantKnownCounts[index], restaurantComponents.map(({ canonicalComponentKey }) => canonicalComponentKey), () => "5.9");
}

const projectionInput = {
  startMonth: "2025-08",
  endMonth: "2026-07",
  financialComponents,
  grocery,
  activityOccurrences,
  activityCosts,
  activityLabels: [
    { activityId: "courses_alimentaires", label: "Courses alimentaires" },
    { activityId: "repas_restaurant", label: "Repas au restaurant" },
  ],
};
const projection = buildGlobalFoodRhythmProjection(projectionInput);
export { projection as foodRhythmProjectionFixture };
let checks = 0;
const check = (assertion) => { assertion(); checks += 1; };

check(() => assert.equal(projection.methodVersion, GLOBAL_FOOD_RHYTHM_METHOD_VERSION));
check(() => assert.equal(projection.months.length, 12));
check(() => assert.equal(new Set(projection.months.map(({ month }) => month)).size, 12));
for (const [month, courses, restaurants, deliveries, total] of goldens) {
  const actual = projection.months.find((value) => value.month === month);
  check(() => assert.ok(actual));
  check(() => assert.ok(new Big(actual.courses).eq(courses)));
  check(() => assert.ok(new Big(actual.restaurants).eq(restaurants)));
  check(() => assert.ok(new Big(actual.deliveries).eq(deliveries)));
  check(() => assert.ok(new Big(actual.total).eq(total)));
  check(() => assert.ok(new Big(actual.courses).plus(actual.restaurants).plus(actual.deliveries).eq(actual.total)));
  check(() => assert.ok(new Big(actual.restaurants).plus(actual.deliveries).eq(actual.nonGroceryAmount)));
  check(() => assert.ok(actual.nonGroceryShare === null || new Big(actual.nonGroceryShare).eq(new Big(actual.nonGroceryAmount).div(actual.total))));
  check(() => assert.ok(Object.values(actual.compositionHighlights).every((values) => values.length <= 4)));
}
check(() => assert.ok(new Big(projection.annual.courses).eq("5275.88")));
check(() => assert.ok(new Big(projection.annual.restaurants).eq("1303.53")));
check(() => assert.ok(new Big(projection.annual.deliveries).eq("159.17")));
check(() => assert.ok(new Big(projection.annual.total).eq("6738.58")));
check(() => assert.ok(goldens.reduce((sum, [, courses]) => sum.plus(courses), new Big(0)).eq(projection.annual.courses)));
check(() => assert.ok(goldens.reduce((sum, [, , restaurants]) => sum.plus(restaurants), new Big(0)).eq(projection.annual.restaurants)));
check(() => assert.ok(goldens.reduce((sum, [, , , deliveries]) => sum.plus(deliveries), new Big(0)).eq(projection.annual.deliveries)));
check(() => assert.ok(goldens.reduce((sum, [, , , , total]) => sum.plus(total), new Big(0)).eq(projection.annual.total)));
const december = projection.months.find(({ month }) => month === "2025-12");
check(() => assert.deepEqual([december.courses, december.restaurants, december.deliveries, december.total], ["280.98", "113.9", "67.17", "462.05"]));
check(() => assert.ok(new Big(december.nonGroceryAmount).eq("181.07")));
check(() => assert.equal(new Big(december.nonGroceryShare).times(100).toFixed(1), "39.2"));
check(() => assert.equal(projection.reconciliation.groceryFinanceStatus, "PASS"));
check(() => assert.equal(projection.months.every((month) => new Big(month.courses).eq(grocery.months.find((candidate) => candidate.month === month.month).monthlyGrocerySpend.value)), true));
check(() => assert.equal(projection.annual.groceryBehavior.knownCostOccurrenceCount, 87));
check(() => assert.equal(projection.annual.groceryBehavior.eligibleMonthCount, 9));
check(() => assert.deepEqual(projection.annual.groceryBehavior.thresholds, { p25: "18.29", p75: "51.99" }));
check(() => assert.equal(projection.months.filter(({ groceryBehavior }) => groceryBehavior.basketStructure.status === "GATED").length, 3));
check(() => assert.equal(projection.months.filter(({ groceryBehavior }) => groceryBehavior.basketStructure.status === "GATED").every(({ courses, groceryBehavior }) => new Big(courses).gt(0) && groceryBehavior.financialAmountAvailable), true));
check(() => assert.equal(projection.annual.restaurantBehavior.semanticOccurrenceCount, 148));
check(() => assert.equal(projection.annual.restaurantBehavior.knownCostOccurrenceCount, 28));
check(() => assert.deepEqual(projection.annual.restaurantBehavior.medianCost, { status: "GATED", reasonCode: "FOOD_RESTAURANT_CROSS_COVERAGE_INSUFFICIENT" }));
check(() => assert.equal("value" in projection.annual.restaurantBehavior.medianCost, false));
check(() => assert.equal(projection.annual.deliveryBehavior.paymentCount, 8));
check(() => assert.deepEqual(projection.annual.deliveryBehavior, { paymentCount: 8, countLabel: "paiements de livraison", occurrenceStatus: "UNKNOWN", reasonCode: "NO_DELIVERY_OCCURRENCE_AUTHORITY" }));
check(() => assert.equal("occurrenceCount" in projection.annual.deliveryBehavior, false));
check(() => assert.equal("orderCount" in projection.annual.deliveryBehavior, false));
check(() => assert.equal(projection.annotations.length <= 5, true));
check(() => assert.equal(projection.annotations.every(({ text }) => !/parce|cause|explique/iu.test(text)), true));
check(() => assert.equal(projection.policies.highlights.policyVersion, GLOBAL_FOOD_HIGHLIGHT_POLICY_VERSION));
const allHighlights = projection.months.flatMap(({ compositionHighlights }) => Object.values(compositionHighlights).flat());
check(() => assert.equal(allHighlights.every((highlight) => highlight.date === undefined || financialComponents.some(({ economicSegmentKey, economicDate }) => economicSegmentKey === highlight.stableSourceId && economicDate === highlight.date)), true));
check(() => assert.equal(allHighlights.every((highlight) => highlight.label === undefined || financialComponents.some(({ economicSegmentKey, merchantLabel }) => economicSegmentKey === highlight.stableSourceId && merchantLabel === highlight.label) || ["Courses alimentaires", "Repas au restaurant"].includes(highlight.label)), true));
check(() => assert.equal(allHighlights.every((highlight) => highlight.articleCount === undefined || financialComponents.some(({ economicSegmentKey, articleCount }) => economicSegmentKey === highlight.stableSourceId && articleCount === highlight.articleCount)), true));
const exactBakery = financialComponents.find(({ operationTypePrecis }) => operationTypePrecis === "Repas du midi au travail");
const withoutExactBakery = buildGlobalFoodRhythmProjection({
  ...projectionInput,
  financialComponents: financialComponents.map((component) => component === exactBakery ? { ...component, operationTypePrecis: "Repas du midi au travail " } : component),
});
check(() => assert.ok(new Big(withoutExactBakery.annual.restaurants).eq(new Big(projection.annual.restaurants).minus(exactBakery.amount))));
const reversed = buildGlobalFoodRhythmProjection({
  ...projectionInput,
  financialComponents: [...financialComponents].reverse(),
  activityOccurrences: [...activityOccurrences].reverse(),
  activityCosts: [...activityCosts].reverse(),
  activityLabels: [...projectionInput.activityLabels].reverse(),
});
check(() => assert.deepEqual(reversed, projection));
const mismatchGrocery = {
  ...grocery,
  months: grocery.months.map((month) => month.month === "2025-12" ? { ...month, monthlyGrocerySpend: { status: "KNOWN", value: "280.99" } } : month),
};
check(() => assert.throws(() => buildGlobalFoodRhythmProjection({ ...projectionInput, grocery: mismatchGrocery }), /FOOD_GROCERY_FINANCE_RECONCILIATION_FAILED:2025-12/u));

console.log(JSON.stringify({
  status: "PASS",
  methodVersion: GLOBAL_FOOD_RHYTHM_METHOD_VERSION,
  checks,
  annual: {
    courses: projection.annual.courses,
    restaurants: projection.annual.restaurants,
    deliveries: projection.annual.deliveries,
    total: projection.annual.total,
  },
  groceryKnownCostCount: projection.annual.groceryBehavior.knownCostOccurrenceCount,
  groceryEligibleMonthCount: projection.annual.groceryBehavior.eligibleMonthCount,
  deliveryPaymentCount: projection.annual.deliveryBehavior.paymentCount,
  highlightPolicy: projection.policies.highlights.policyVersion,
  reconciliation: projection.reconciliation.status,
}));
