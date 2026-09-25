import Big from "big.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex, utf8ToBytes } from "@noble/hashes/utils.js";
import { canonicalSerializeGlobal } from "../../core/global-v2";
import type { ActivityOccurrenceCostFact, ActivityOccurrenceFact } from "../facts";
import { GLOBAL_GROCERY_ADAPTER_VERSION, type GlobalGroceryCandidateBundle, type GlobalGroceryMonth } from "./candidate-adapters";
import { legacyFoodEconomicComponent } from "./food-rhythm-legacy-adapter";

export const GLOBAL_FOOD_RHYTHM_METHOD_VERSION = "global_food_rhythm@v1" as const;
export const GLOBAL_FOOD_PURCHASE_AWARE_METHOD_VERSION = "global_food_rhythm@v2-purchase-aware" as const;
export const GLOBAL_FOOD_HIGHLIGHT_POLICY_VERSION = "global_food_composition_highlight@v1" as const;
export const GLOBAL_FOOD_ANNOTATION_POLICY_VERSION = "global_food_annual_annotation@v1" as const;
export const GLOBAL_FOOD_RESTAURANT_CROSS_COVERAGE_POLICY_VERSION = "global_food_restaurant_cross_coverage@v1" as const;

export const GLOBAL_FOOD_SCOPE = Object.freeze({
  courses: ["alimentation__courses_alimentaires"],
  restaurants: ["restauration__restaurant", "restauration__fast_food_snack"],
  conditionalRestaurant: {
    subcategoryKey: "alimentation__boulangerie",
    operationTypePrecis: "Repas du midi au travail",
  },
  deliveries: ["restauration__livraison_de_repas"],
} as const);

export const globalFoodHighlightPolicy = Object.freeze({
  policyVersion: GLOBAL_FOOD_HIGHLIGHT_POLICY_VERSION,
  maximumPerBucketPerMonth: 4,
  ordering: "AMOUNT_DESC_DATE_ASC_STABLE_ID_ASC",
  knownFieldsOnly: true,
} as const);

export const globalFoodAnnotationPolicy = Object.freeze({
  policyVersion: GLOBAL_FOOD_ANNOTATION_POLICY_VERSION,
  maximumAnnualAnnotations: 5,
  causalClaimsAllowed: false,
  ranking: "ABSOLUTE_MONTH_TO_MONTH_MOVEMENT_DESC_THEN_MONTH_ASC",
} as const);

export const globalFoodRestaurantCrossCoveragePolicy = Object.freeze({
  policyVersion: GLOBAL_FOOD_RESTAURANT_CROSS_COVERAGE_POLICY_VERSION,
  occurrenceCoverageMinimum: "0.7",
  financeAmountCoverageMinimum: "0.7",
  knownOccurrenceMinimum: 5,
} as const);

export type GlobalFoodBucket = "COURSES" | "RESTAURANTS" | "DELIVERIES";

export type GlobalFoodFinancialComponent = {
  readonly canonicalComponentKey: string;
  readonly economicSegmentKey: string;
  readonly operationId: string;
  readonly economicMonth: string;
  readonly economicDate: string | null;
  readonly amount: string;
  readonly subcategoryKey: string;
  readonly operationTypePrecis: string | null;
  readonly merchantLabel: string | null;
  readonly articleCount: number | null;
  readonly sourceType: "OPERATION" | "ALLOCATION" | "ITEM" | "PAYMENT_COMPONENT" | "CASH_USE";
};

/** Economic owners only. Funding and wallet movements are deliberately absent. */
export type GlobalFoodEconomicComponent = {
  readonly canonicalComponentKey: string;
  readonly economicSegmentKey: string;
  readonly purchaseIdentityKey: string;
  readonly purchaseEventId: string | null;
  readonly economicMonth: string;
  readonly economicDate: string | null;
  readonly amount: { readonly status: "KNOWN"; readonly value: string }
    | { readonly status: "LOWER_BOUND"; readonly minimum: string };
  readonly subcategoryKey: string;
  readonly semanticPurpose: "WORK_LUNCH" | null;
  readonly merchantLabel: string | null;
  readonly articleCount: number | null;
  readonly sourceType: GlobalFoodFinancialComponent["sourceType"] | "PURCHASE_COMPONENT";
};

export type GlobalFoodAmountSummary = {
  readonly status: "KNOWN" | "LOWER_BOUND";
  readonly exactKnownSubtotal: string;
  readonly minimumTotal: string;
};

export type GlobalFoodActivityLabel = {
  readonly activityId: string;
  readonly label: string;
};

export type GlobalFoodCompositionHighlight = {
  readonly highlightId: string;
  readonly stableSourceId: string;
  readonly amount: string;
  readonly sourceType: GlobalFoodEconomicComponent["sourceType"];
  readonly amountKnowledge?: "KNOWN" | "LOWER_BOUND";
  readonly rankingKnowledge?: "EXACT" | "MINIMUM_ONLY";
  readonly date?: string;
  readonly label?: string;
  readonly basketClass?: "SMALL" | "INTERMEDIATE" | "LARGE";
  readonly articleCount?: number;
  readonly activityContext?: {
    readonly occurrenceId: string;
    readonly activityId: string;
    readonly label: string;
  };
};

export type GlobalFoodGroceryBehavior = {
  readonly occurrenceCount: number;
  readonly knownCostOccurrenceCount: number;
  readonly coverage: string;
  readonly basketStructure: GlobalGroceryMonth["basketStructure"];
  readonly financialAmountAvailable: true;
};

export type GlobalFoodRestaurantBehavior = {
  readonly paymentCount: number;
  readonly purchaseCount?: number;
  readonly semanticOccurrenceCount: number;
  readonly knownCostOccurrenceCount: number;
  readonly occurrenceCoverage: string;
  readonly linkedFinanceAmountCoverage: string;
  readonly medianCost:
    | { readonly status: "KNOWN"; readonly value: string }
    | { readonly status: "GATED"; readonly reasonCode: "FOOD_RESTAURANT_CROSS_COVERAGE_INSUFFICIENT" };
};

export type GlobalFoodDeliveryBehavior = {
  readonly paymentCount: number;
  readonly purchaseCount?: number;
  readonly countLabel: "paiements de livraison";
  readonly occurrenceStatus: "UNKNOWN";
  readonly reasonCode: "NO_DELIVERY_OCCURRENCE_AUTHORITY";
};

export type GlobalFoodRhythmMonth = {
  readonly month: string;
  readonly courses: string;
  readonly restaurants: string;
  readonly deliveries: string;
  readonly total: string;
  readonly nonGroceryAmount: string;
  readonly nonGroceryShare: string | null;
  readonly amountKnowledge?: { readonly courses: GlobalFoodAmountSummary; readonly restaurants: GlobalFoodAmountSummary; readonly deliveries: GlobalFoodAmountSummary; readonly total: GlobalFoodAmountSummary };
  readonly nonGroceryShareKnowledge?: { readonly status: "KNOWN"; readonly value: string | null } | { readonly status: "GATED"; readonly reasonCode: "LOWER_BOUND_RATIO" };
  readonly groceryBehavior: GlobalFoodGroceryBehavior;
  readonly restaurantBehavior: GlobalFoodRestaurantBehavior;
  readonly deliveryBehavior: GlobalFoodDeliveryBehavior;
  readonly compositionHighlights: {
    readonly courses: readonly GlobalFoodCompositionHighlight[];
    readonly restaurants: readonly GlobalFoodCompositionHighlight[];
    readonly deliveries: readonly GlobalFoodCompositionHighlight[];
  };
  readonly quality: {
    readonly monetaryAuthority: "FINANCE_CANONICAL";
    readonly financialKnowledge: "KNOWN" | "LOWER_BOUND";
    readonly groceryBasketKnowledge: "KNOWN" | "GATED";
    readonly restaurantMedianKnowledge: "KNOWN" | "GATED";
    readonly deliveryOccurrenceKnowledge: "UNKNOWN";
    readonly limitationCodes: readonly string[];
  };
};

export type GlobalFoodAnnualAnnotation = {
  readonly annotationId: string;
  readonly kind: "MONTH_TO_MONTH_VARIATION";
  readonly fromMonth: string;
  readonly toMonth: string;
  readonly text: string;
  readonly coursesChange: string;
  readonly nonGroceryChange: string;
};

export type GlobalFoodRhythmProjection = {
  readonly period: { readonly startMonth: string; readonly endMonth: string };
  /** Purchase identities already admitted by the FOOD classifier; used only for secondary funding presentation. */
  readonly fundingEligiblePurchaseEventIds?: readonly string[];
  readonly annual: {
    readonly courses: string;
    readonly restaurants: string;
    readonly deliveries: string;
    readonly total: string;
    readonly nonGroceryAmount: string;
    readonly nonGroceryShare: string | null;
    readonly nonGroceryShareKnowledge?: { readonly status: "KNOWN"; readonly value: string | null } | { readonly status: "GATED"; readonly reasonCode: "LOWER_BOUND_RATIO" };
    readonly amountKnowledge?: { readonly courses: GlobalFoodAmountSummary; readonly restaurants: GlobalFoodAmountSummary; readonly deliveries: GlobalFoodAmountSummary; readonly total: GlobalFoodAmountSummary };
    readonly financialKnowledge?: "KNOWN" | "LOWER_BOUND";
    readonly groceryBehavior: {
      readonly knownCostOccurrenceCount: number;
      readonly eligibleMonthCount: number;
      readonly historicalComparisonGate: GlobalGroceryCandidateBundle["historicalComparisonGate"];
      readonly thresholds: GlobalGroceryCandidateBundle["thresholds"];
    };
    readonly restaurantBehavior: GlobalFoodRestaurantBehavior;
    readonly deliveryBehavior: GlobalFoodDeliveryBehavior;
  };
  readonly months: readonly GlobalFoodRhythmMonth[];
  readonly annotations: readonly GlobalFoodAnnualAnnotation[];
  readonly policies: {
    readonly foodScope: typeof GLOBAL_FOOD_SCOPE;
    readonly groceryBasket: GlobalGroceryCandidateBundle["basketPolicy"];
    readonly highlights: typeof globalFoodHighlightPolicy;
    readonly annotations: typeof globalFoodAnnotationPolicy;
    readonly restaurantCrossCoverage: typeof globalFoodRestaurantCrossCoveragePolicy;
  };
  readonly reconciliation: {
    readonly status: "PASS";
    readonly groceryFinanceStatus: "PASS";
    readonly monthlyBucketSumsMatchTotal: true;
    readonly monthlyNonGrocerySumsMatch: true;
    readonly annualBucketSumsMatchMonths: true;
    readonly annualTotalMatchesMonths: true;
  };
  readonly methodVersion: typeof GLOBAL_FOOD_RHYTHM_METHOD_VERSION | typeof GLOBAL_FOOD_PURCHASE_AWARE_METHOD_VERSION;
  readonly inputHash: string;
};

type ClassifiedComponent = GlobalFoodEconomicComponent & { readonly bucket: GlobalFoodBucket };
type CostContext = {
  readonly cost: ActivityOccurrenceCostFact;
  readonly occurrence: ActivityOccurrenceFact;
  readonly activityLabel: string | undefined;
};

const digest = (value: unknown): string => bytesToHex(sha256(utf8ToBytes(canonicalSerializeGlobal(value))));
const sum = <T>(values: readonly T[], pick: (value: T) => Big): Big => values.reduce((total, value) => total.plus(pick(value)), new Big(0));
const uniqueCount = (values: readonly string[]): number => new Set(values).size;
const amountMinimum = (amount: GlobalFoodEconomicComponent["amount"]): string => amount.status === "KNOWN" ? amount.value : amount.minimum;

function amountSummary(components: readonly GlobalFoodEconomicComponent[]): GlobalFoodAmountSummary {
  return {
    status: components.some(({ amount }) => amount.status === "LOWER_BOUND") ? "LOWER_BOUND" : "KNOWN",
    exactKnownSubtotal: sum(components.filter(({ amount }) => amount.status === "KNOWN"), ({ amount }) => new Big(amountMinimum(amount))).toString(),
    minimumTotal: sum(components, ({ amount }) => new Big(amountMinimum(amount))).toString(),
  };
}

function assertMonth(value: string, field: string): void {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/u.test(value)) throw new TypeError(`${field} must be YYYY-MM.`);
}

function nextMonth(value: string): string {
  const [year, month] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function monthsBetween(startMonth: string, endMonth: string): readonly string[] {
  assertMonth(startMonth, "startMonth");
  assertMonth(endMonth, "endMonth");
  if (startMonth > endMonth) throw new TypeError("startMonth must not be after endMonth.");
  const months: string[] = [];
  for (let month = startMonth; month <= endMonth; month = nextMonth(month)) months.push(month);
  return months;
}

function classify(component: GlobalFoodEconomicComponent): GlobalFoodBucket | null {
  if (GLOBAL_FOOD_SCOPE.courses.some((key) => key === component.subcategoryKey)) return "COURSES";
  if (GLOBAL_FOOD_SCOPE.restaurants.some((key) => key === component.subcategoryKey)) return "RESTAURANTS";
  if (component.subcategoryKey === GLOBAL_FOOD_SCOPE.conditionalRestaurant.subcategoryKey
    && component.semanticPurpose === "WORK_LUNCH") return "RESTAURANTS";
  if (GLOBAL_FOOD_SCOPE.deliveries.some((key) => key === component.subcategoryKey)) return "DELIVERIES";
  return null;
}

function validateComponent(component: GlobalFoodEconomicComponent): void {
  assertMonth(component.economicMonth, "economicMonth");
  if (component.economicDate !== null && !/^\d{4}-\d{2}-\d{2}$/u.test(component.economicDate)) throw new TypeError("FOOD_ECONOMIC_DATE_INVALID");
  if (new Big(amountMinimum(component.amount)).lt(0)) throw new TypeError("FOOD_NEGATIVE_FINANCIAL_AMOUNT");
  if (component.articleCount !== null && (!Number.isInteger(component.articleCount) || component.articleCount < 0)) throw new TypeError("FOOD_ARTICLE_COUNT_INVALID");
}

function coverage(numerator: number | Big, denominator: number | Big): string {
  const divisor = new Big(denominator);
  return divisor.eq(0) ? "0" : new Big(numerator).div(divisor).toString();
}

function median(values: readonly string[]): string {
  const sorted = values.map((value) => new Big(value)).sort((left, right) => left.cmp(right));
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? sorted[middle]!.toString()
    : sorted[middle - 1]!.plus(sorted[middle]!).div(2).toString();
}

function costContexts(input: {
  readonly occurrences: readonly ActivityOccurrenceFact[];
  readonly costs: readonly ActivityOccurrenceCostFact[];
  readonly labels: readonly GlobalFoodActivityLabel[];
}): ReadonlyMap<string, readonly CostContext[]> {
  const occurrenceById = new Map(input.occurrences.map((occurrence) => [String(occurrence.lifeEventId), occurrence]));
  const labelByActivity = new Map(input.labels.map(({ activityId, label }) => [activityId, label]));
  const result = new Map<string, CostContext[]>();
  for (const cost of input.costs) {
    const occurrence = occurrenceById.get(String(cost.occurrenceId));
    if (occurrence === undefined || String(occurrence.activityId) !== String(cost.activityId)) continue;
    const context = { cost, occurrence, activityLabel: labelByActivity.get(String(cost.activityId)) };
    for (const { canonicalComponentKey } of cost.evidence) {
      const key = String(canonicalComponentKey);
      result.set(key, [...(result.get(key) ?? []), context]);
    }
  }
  return result;
}

function basketClass(value: string, grocery: GlobalGroceryCandidateBundle): "SMALL" | "INTERMEDIATE" | "LARGE" {
  const amount = new Big(value);
  if (amount.lte(grocery.thresholds.p25)) return "SMALL";
  if (amount.gte(grocery.thresholds.p75)) return "LARGE";
  return "INTERMEDIATE";
}

function highlight(
  component: ClassifiedComponent,
  groceryMonth: GlobalGroceryMonth,
  grocery: GlobalGroceryCandidateBundle,
  contexts: ReadonlyMap<string, readonly CostContext[]>,
  rankingKnowledge: "EXACT" | "MINIMUM_ONLY" | null,
): GlobalFoodCompositionHighlight {
  const matches = contexts.get(component.canonicalComponentKey) ?? [];
  const exactContext = matches.length === 1 ? matches[0] : undefined;
  const knownGroceryCost = component.bucket === "COURSES"
    && groceryMonth.basketStructure.status === "KNOWN"
    && exactContext?.cost.causalCost.availability === "known"
    && String(exactContext.occurrence.activityId) === "courses_alimentaires"
      ? exactContext.cost.causalCost.value
      : undefined;
  const label = component.merchantLabel?.trim() || exactContext?.activityLabel?.trim() || undefined;
  return {
    highlightId: `food-highlight:${digest([component.economicSegmentKey, component.bucket]).slice(0, 24)}`,
    stableSourceId: component.economicSegmentKey,
    amount: new Big(amountMinimum(component.amount)).toString(),
    sourceType: component.sourceType,
    ...(rankingKnowledge === null ? {} : { amountKnowledge: component.amount.status, rankingKnowledge }),
    ...(component.economicDate === null ? {} : { date: component.economicDate }),
    ...(label === undefined ? {} : { label }),
    ...(knownGroceryCost === undefined ? {} : { basketClass: basketClass(knownGroceryCost, grocery) }),
    ...(component.articleCount === null ? {} : { articleCount: component.articleCount }),
    ...(exactContext === undefined || exactContext.activityLabel === undefined ? {} : {
      activityContext: {
        occurrenceId: String(exactContext.occurrence.lifeEventId),
        activityId: String(exactContext.occurrence.activityId),
        label: exactContext.activityLabel,
      },
    }),
  };
}

function highlights(
  components: readonly ClassifiedComponent[],
  groceryMonth: GlobalGroceryMonth,
  grocery: GlobalGroceryCandidateBundle,
  contexts: ReadonlyMap<string, readonly CostContext[]>,
): readonly GlobalFoodCompositionHighlight[] {
  const rankingKnowledge = components.some(({ amount }) => amount.status === "LOWER_BOUND") ? "MINIMUM_ONLY" : "EXACT";
  return [...components]
    .sort((left, right) => new Big(amountMinimum(right.amount)).cmp(amountMinimum(left.amount))
      || (left.economicDate ?? "9999-12-31").localeCompare(right.economicDate ?? "9999-12-31")
      || left.economicSegmentKey.localeCompare(right.economicSegmentKey))
    .slice(0, globalFoodHighlightPolicy.maximumPerBucketPerMonth)
    .map((component) => highlight(component, groceryMonth, grocery, contexts,
      grocery.adapterVersion === GLOBAL_GROCERY_ADAPTER_VERSION ? null : rankingKnowledge));
}

function restaurantBehavior(input: {
  readonly components: readonly ClassifiedComponent[];
  readonly occurrences: readonly ActivityOccurrenceFact[];
  readonly costs: readonly ActivityOccurrenceCostFact[];
  readonly purchaseAware: boolean;
}): GlobalFoodRestaurantBehavior {
  const occurrences = input.occurrences.filter(({ activityId }) => String(activityId) === "repas_restaurant");
  const occurrenceIds = new Set(occurrences.map(({ lifeEventId }) => String(lifeEventId)));
  const costs = input.costs.filter(({ occurrenceId, activityId }) => occurrenceIds.has(String(occurrenceId)) && String(activityId) === "repas_restaurant");
  const known = costs.filter(({ causalCost }) => causalCost.availability === "known");
  const componentKeys = new Set(input.components.map(({ canonicalComponentKey }) => canonicalComponentKey));
  const linkedKeys = new Set(known.flatMap(({ evidence }) => evidence.map(({ canonicalComponentKey }) => String(canonicalComponentKey))).filter((key) => componentKeys.has(key)));
  const totalAmount = sum(input.components, ({ amount }) => new Big(amountMinimum(amount)));
  const linkedAmount = sum(input.components.filter(({ canonicalComponentKey }) => linkedKeys.has(canonicalComponentKey)), ({ amount }) => new Big(amountMinimum(amount)));
  const occurrenceCoverage = coverage(known.length, occurrences.length);
  const linkedFinanceAmountCoverage = coverage(linkedAmount, totalAmount);
  const eligible = known.length >= globalFoodRestaurantCrossCoveragePolicy.knownOccurrenceMinimum
    && new Big(occurrenceCoverage).gte(globalFoodRestaurantCrossCoveragePolicy.occurrenceCoverageMinimum)
    && new Big(linkedFinanceAmountCoverage).gte(globalFoodRestaurantCrossCoveragePolicy.financeAmountCoverageMinimum)
    && input.components.every(({ amount }) => amount.status === "KNOWN");
  return {
    paymentCount: uniqueCount(input.components.map(({ purchaseIdentityKey }) => purchaseIdentityKey)),
    ...(input.purchaseAware ? { purchaseCount: uniqueCount(input.components.map(({ purchaseIdentityKey }) => purchaseIdentityKey)) } : {}),
    semanticOccurrenceCount: occurrences.length,
    knownCostOccurrenceCount: known.length,
    occurrenceCoverage,
    linkedFinanceAmountCoverage,
    medianCost: eligible
      ? { status: "KNOWN", value: median(known.map(({ causalCost }) => causalCost.availability === "known" ? causalCost.value : "0")) }
      : { status: "GATED", reasonCode: "FOOD_RESTAURANT_CROSS_COVERAGE_INSUFFICIENT" },
  };
}

function deliveryBehavior(components: readonly ClassifiedComponent[], purchaseAware: boolean): GlobalFoodDeliveryBehavior {
  return {
    paymentCount: uniqueCount(components.map(({ purchaseIdentityKey }) => purchaseIdentityKey)),
    ...(purchaseAware ? { purchaseCount: uniqueCount(components.map(({ purchaseIdentityKey }) => purchaseIdentityKey)) } : {}),
    countLabel: "paiements de livraison",
    occurrenceStatus: "UNKNOWN",
    reasonCode: "NO_DELIVERY_OCCURRENCE_AUTHORITY",
  };
}

function annotations(months: readonly GlobalFoodRhythmMonth[]): readonly GlobalFoodAnnualAnnotation[] {
  return months.slice(1).flatMap((month, index) => {
    const previous = months[index]!;
    if (previous.quality.financialKnowledge !== "KNOWN" || month.quality.financialKnowledge !== "KNOWN") return [];
    const coursesChange = new Big(month.courses).minus(previous.courses);
    const nonGroceryChange = new Big(month.nonGroceryAmount).minus(previous.nonGroceryAmount);
    if (coursesChange.eq(0) && nonGroceryChange.eq(0)) return [];
    const movement = coursesChange.abs().plus(nonGroceryChange.abs());
    const direction = (value: Big) => value.gt(0) ? "augmentent" : value.lt(0) ? "baissent" : "restent stables";
    return [{
      annotationId: `food-variation:${previous.month}:${month.month}`,
      kind: "MONTH_TO_MONTH_VARIATION" as const,
      fromMonth: previous.month,
      toMonth: month.month,
      text: `Entre ${previous.month} et ${month.month}, les courses ${direction(coursesChange)} tandis que restaurants + paiements de livraison ${direction(nonGroceryChange)}.`,
      coursesChange: coursesChange.toString(),
      nonGroceryChange: nonGroceryChange.toString(),
      movement,
    }];
  }).sort((left, right) => right.movement.cmp(left.movement) || left.toMonth.localeCompare(right.toMonth))
    .slice(0, globalFoodAnnotationPolicy.maximumAnnualAnnotations)
    .map(({ movement: _movement, ...annotation }) => annotation);
}

export function buildGlobalFoodRhythmProjection(input: {
  readonly startMonth: string;
  readonly endMonth: string;
  readonly financialComponents?: readonly GlobalFoodFinancialComponent[];
  readonly economicComponents?: readonly GlobalFoodEconomicComponent[];
  readonly grocery: GlobalGroceryCandidateBundle;
  readonly activityOccurrences: readonly ActivityOccurrenceFact[];
  readonly activityCosts: readonly ActivityOccurrenceCostFact[];
  readonly activityLabels: readonly GlobalFoodActivityLabel[];
}): GlobalFoodRhythmProjection {
  const purchaseAware = input.economicComponents !== undefined;
  if (purchaseAware === (input.financialComponents !== undefined)) throw new TypeError("FOOD_ECONOMIC_INPUT_AMBIGUOUS");
  const economicComponents = input.economicComponents ?? input.financialComponents!.map(legacyFoodEconomicComponent);
  const period = monthsBetween(input.startMonth, input.endMonth);
  const periodSet = new Set(period);
  if (input.grocery.months.length !== period.length || input.grocery.months.some(({ month }) => !periodSet.has(String(month)))) {
    throw new TypeError("FOOD_GROCERY_PERIOD_MISMATCH");
  }
  economicComponents.forEach(validateComponent);
  const identities = economicComponents.map(({ economicSegmentKey }) => economicSegmentKey);
  if (new Set(identities).size !== identities.length) throw new TypeError("FOOD_FINANCIAL_COMPONENT_DUPLICATE");
  const classified = economicComponents.flatMap((component): readonly ClassifiedComponent[] => {
    if (!periodSet.has(component.economicMonth)) return [];
    const bucket = classify(component);
    return bucket === null ? [] : [{ ...component, bucket }];
  }).sort((left, right) => left.economicMonth.localeCompare(right.economicMonth) || left.economicSegmentKey.localeCompare(right.economicSegmentKey));
  const groceryByMonth = new Map(input.grocery.months.map((month) => [String(month.month), month]));
  const contexts = costContexts({ occurrences: input.activityOccurrences, costs: input.activityCosts, labels: input.activityLabels });

  const months = period.map((month): GlobalFoodRhythmMonth => {
    const groceryMonth = groceryByMonth.get(month);
    if (groceryMonth === undefined) throw new TypeError(`FOOD_GROCERY_MONTH_MISSING:${month}`);
    const components = classified.filter((component) => component.economicMonth === month);
    const coursesComponents = components.filter(({ bucket }) => bucket === "COURSES");
    const restaurantComponents = components.filter(({ bucket }) => bucket === "RESTAURANTS");
    const deliveryComponents = components.filter(({ bucket }) => bucket === "DELIVERIES");
    const coursesKnowledge = amountSummary(coursesComponents);
    const restaurantsKnowledge = amountSummary(restaurantComponents);
    const deliveriesKnowledge = amountSummary(deliveryComponents);
    const totalKnowledge = amountSummary(components);
    const courses = new Big(coursesKnowledge.minimumTotal);
    const restaurants = new Big(restaurantsKnowledge.minimumTotal);
    const deliveries = new Big(deliveriesKnowledge.minimumTotal);
    const grocerySpend = groceryMonth.monthlyGrocerySpend;
    if (grocerySpend.status === "UNKNOWN"
      || grocerySpend.status !== coursesKnowledge.status
      || !new Big(grocerySpend.status === "KNOWN" ? grocerySpend.value : grocerySpend.minimum).eq(courses)
      || (grocerySpend.status === "LOWER_BOUND" && grocerySpend.exactKnownSubtotal !== coursesKnowledge.exactKnownSubtotal)) {
      throw new TypeError(`FOOD_GROCERY_FINANCE_RECONCILIATION_FAILED:${month}`);
    }
    const nonGroceryAmount = restaurants.plus(deliveries);
    const total = courses.plus(nonGroceryAmount);
    const restaurant = restaurantBehavior({
      components: restaurantComponents,
      occurrences: input.activityOccurrences.filter(({ startDate }) => String(startDate).startsWith(month)),
      costs: input.activityCosts,
      purchaseAware,
    });
    return {
      month,
      courses: courses.toString(),
      restaurants: restaurants.toString(),
      deliveries: deliveries.toString(),
      total: total.toString(),
      nonGroceryAmount: nonGroceryAmount.toString(),
      nonGroceryShare: totalKnowledge.status === "KNOWN" && total.gt(0) ? nonGroceryAmount.div(total).toString() : null,
      ...(purchaseAware ? {
        amountKnowledge: { courses: coursesKnowledge, restaurants: restaurantsKnowledge, deliveries: deliveriesKnowledge, total: totalKnowledge },
        nonGroceryShareKnowledge: totalKnowledge.status === "KNOWN"
          ? { status: "KNOWN" as const, value: total.eq(0) ? null : nonGroceryAmount.div(total).toString() }
          : { status: "GATED" as const, reasonCode: "LOWER_BOUND_RATIO" as const },
      } : {}),
      groceryBehavior: {
        occurrenceCount: groceryMonth.occurrenceCount,
        knownCostOccurrenceCount: groceryMonth.knownCostOccurrenceCount,
        coverage: new Big(groceryMonth.coverage).toString(),
        basketStructure: groceryMonth.basketStructure,
        financialAmountAvailable: true,
      },
      restaurantBehavior: restaurant,
      deliveryBehavior: deliveryBehavior(deliveryComponents, purchaseAware),
      compositionHighlights: {
        courses: highlights(coursesComponents, groceryMonth, input.grocery, contexts),
        restaurants: highlights(restaurantComponents, groceryMonth, input.grocery, contexts),
        deliveries: highlights(deliveryComponents, groceryMonth, input.grocery, contexts),
      },
      quality: {
        monetaryAuthority: "FINANCE_CANONICAL",
        financialKnowledge: totalKnowledge.status,
        groceryBasketKnowledge: groceryMonth.basketStructure.status,
        restaurantMedianKnowledge: restaurant.medianCost.status,
        deliveryOccurrenceKnowledge: "UNKNOWN",
        limitationCodes: [
          ...(groceryMonth.basketStructure.status === "GATED" ? [groceryMonth.basketStructure.reasonCode] : []),
          ...(restaurant.medianCost.status === "GATED" ? [restaurant.medianCost.reasonCode] : []),
          "NO_DELIVERY_OCCURRENCE_AUTHORITY",
        ],
      },
    };
  });

  const annualCoursesKnowledge = amountSummary(classified.filter(({ bucket }) => bucket === "COURSES"));
  const annualRestaurantsKnowledge = amountSummary(classified.filter(({ bucket }) => bucket === "RESTAURANTS"));
  const annualDeliveriesKnowledge = amountSummary(classified.filter(({ bucket }) => bucket === "DELIVERIES"));
  const annualTotalKnowledge = amountSummary(classified);
  const annualCourses = sum(months, ({ courses }) => new Big(courses));
  const annualRestaurants = sum(months, ({ restaurants }) => new Big(restaurants));
  const annualDeliveries = sum(months, ({ deliveries }) => new Big(deliveries));
  const annualNonGrocery = annualRestaurants.plus(annualDeliveries);
  const annualTotal = annualCourses.plus(annualNonGrocery);
  const annualRestaurant = restaurantBehavior({
    components: classified.filter(({ bucket }) => bucket === "RESTAURANTS"),
    occurrences: input.activityOccurrences.filter(({ startDate }) => periodSet.has(String(startDate).slice(0, 7))),
    costs: input.activityCosts,
    purchaseAware,
  });
  const annualDelivery = deliveryBehavior(classified.filter(({ bucket }) => bucket === "DELIVERIES"), purchaseAware);
  const resultMonths = months;
  return {
    period: { startMonth: input.startMonth, endMonth: input.endMonth },
    ...(purchaseAware ? { fundingEligiblePurchaseEventIds: [...new Set(classified.flatMap(({ purchaseEventId }) => purchaseEventId === null ? [] : [purchaseEventId]))].sort() } : {}),
    annual: {
      courses: annualCourses.toString(),
      restaurants: annualRestaurants.toString(),
      deliveries: annualDeliveries.toString(),
      total: annualTotal.toString(),
      nonGroceryAmount: annualNonGrocery.toString(),
      nonGroceryShare: annualTotalKnowledge.status === "KNOWN" && annualTotal.gt(0) ? annualNonGrocery.div(annualTotal).toString() : null,
      ...(purchaseAware ? {
        amountKnowledge: { courses: annualCoursesKnowledge, restaurants: annualRestaurantsKnowledge, deliveries: annualDeliveriesKnowledge, total: annualTotalKnowledge },
        financialKnowledge: annualTotalKnowledge.status,
        nonGroceryShareKnowledge: annualTotalKnowledge.status === "KNOWN"
          ? { status: "KNOWN" as const, value: annualTotal.eq(0) ? null : annualNonGrocery.div(annualTotal).toString() }
          : { status: "GATED" as const, reasonCode: "LOWER_BOUND_RATIO" as const },
      } : {}),
      groceryBehavior: {
        knownCostOccurrenceCount: input.grocery.months.reduce((count, month) => count + month.knownCostOccurrenceCount, 0),
        eligibleMonthCount: input.grocery.eligibleMonthCount,
        historicalComparisonGate: input.grocery.historicalComparisonGate,
        thresholds: input.grocery.thresholds,
      },
      restaurantBehavior: annualRestaurant,
      deliveryBehavior: annualDelivery,
    },
    months: resultMonths,
    annotations: annotations(resultMonths),
    policies: {
      foodScope: GLOBAL_FOOD_SCOPE,
      groceryBasket: input.grocery.basketPolicy,
      highlights: globalFoodHighlightPolicy,
      annotations: globalFoodAnnotationPolicy,
      restaurantCrossCoverage: globalFoodRestaurantCrossCoveragePolicy,
    },
    reconciliation: {
      status: "PASS",
      groceryFinanceStatus: "PASS",
      monthlyBucketSumsMatchTotal: true,
      monthlyNonGrocerySumsMatch: true,
      annualBucketSumsMatchMonths: true,
      annualTotalMatchesMonths: true,
    },
    methodVersion: purchaseAware ? GLOBAL_FOOD_PURCHASE_AWARE_METHOD_VERSION : GLOBAL_FOOD_RHYTHM_METHOD_VERSION,
    inputHash: digest({
      startMonth: input.startMonth,
      endMonth: input.endMonth,
      financialComponents: [...(input.financialComponents ?? input.economicComponents ?? [])].sort((left, right) => left.economicSegmentKey.localeCompare(right.economicSegmentKey)),
      grocery: input.grocery,
      activityOccurrences: [...input.activityOccurrences].sort((left, right) => String(left.lifeEventId).localeCompare(String(right.lifeEventId))),
      activityCosts: [...input.activityCosts].sort((left, right) => String(left.occurrenceId).localeCompare(String(right.occurrenceId))),
      activityLabels: [...input.activityLabels].sort((left, right) => left.activityId.localeCompare(right.activityId)),
    }),
  };
}
