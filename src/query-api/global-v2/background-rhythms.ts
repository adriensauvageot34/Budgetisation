import type { GlobalCarMobilityRhythmProjection, GlobalFoodRhythmProjection } from "../../analytics/global-v2";
import Big from "big.js";
import { canonicalSerializeGlobal } from "../../core/global-v2";
import {
  createRuntimeSchema,
  hasOwn,
  parseStrictRecord,
  requireProperty,
  type RuntimeSchema,
} from "../../core/validation";
import type { GlobalReadModelPublicationMeta, GlobalReadModelResourceMeta } from "./types";

export const GLOBAL_BACKGROUND_RHYTHMS_ANNUAL_PAYLOAD_BUDGET_BYTES = 48 * 1024;
export const GLOBAL_BACKGROUND_RHYTHM_MONTH_DETAIL_PAYLOAD_BUDGET_BYTES = 24 * 1024;
export const GLOBAL_BACKGROUND_RHYTHMS_FEATURE_PAYLOAD_BUDGET_BYTES = 150 * 1024;
export const GLOBAL_BACKGROUND_RHYTHMS_MAX_FEATURE_SNAPSHOTS = 13;

export const globalBackgroundRhythmsResourceDefinition = Object.freeze({
  resource: "analysis_global_background_rhythms",
  moduleKey: "RHYTHM",
  moduleRole: "PRESENTATION_ONLY",
  capabilityId: "GLOBAL_BACKGROUND_RHYTHMS",
  group: "exploration",
  paramsKind: "empty",
  family: "global_exploration",
  schemaVersion: "global-background-rhythms@v1",
  transport: { priority: "BACKGROUND", activation: "NEAR_VIEWPORT" },
  availability: "AVAILABLE",
} as const);

export const globalBackgroundRhythmMonthDetailResourceDefinition = Object.freeze({
  resource: "analysis_global_background_rhythm_month_detail",
  moduleKey: "RHYTHM",
  moduleRole: "PRESENTATION_ONLY",
  capabilityId: "GLOBAL_BACKGROUND_RHYTHM_MONTH_DETAIL",
  group: "entity_detail",
  paramsKind: "rhythm_month",
  family: "global_entity_detail",
  schemaVersion: "global-background-rhythm-month-detail@v1",
  transport: { priority: "DIRECT", activation: "ON_DEMAND_CLICK" },
  availability: "AVAILABLE",
} as const);

export type GlobalBackgroundRhythmDomain = "CAR_MOBILITY";
export type GlobalBackgroundRhythmMonthParams = Readonly<{ domain: GlobalBackgroundRhythmDomain; month: string }>;

type CarMonth = GlobalCarMobilityRhythmProjection["months"][number];
type FoodMonth = GlobalFoodRhythmProjection["months"][number];
type FoodHighlight = FoodMonth["compositionHighlights"]["courses"][number];

export type GlobalBackgroundFoodHighlightTuple = readonly [
  highlightId: string,
  stableSourceId: string,
  amount: string,
  sourceType: FoodHighlight["sourceType"],
  date: string | null,
  label: string | null,
  basketClass: FoodHighlight["basketClass"] | null,
  articleCount: number | null,
  occurrenceId: string | null,
  activityId: string | null,
  activityLabel: string | null,
];

export type GlobalBackgroundFoodMonth = readonly [
  month: string,
  courses: string,
  restaurants: string,
  deliveries: string,
  total: string,
  nonGroceryAmount: string,
  nonGroceryShare: string | null,
  groceryBehavior: readonly [occurrenceCount: number, knownCostOccurrenceCount: number, coverage: string, basketStructure: FoodMonth["groceryBehavior"]["basketStructure"]],
  restaurantBehavior: readonly [paymentCount: number, semanticOccurrenceCount: number, knownCostOccurrenceCount: number, occurrenceCoverage: string, linkedFinanceAmountCoverage: string, medianCost: FoodMonth["restaurantBehavior"]["medianCost"]],
  deliveryPaymentCount: number,
  compositionHighlights: readonly [courses: readonly GlobalBackgroundFoodHighlightTuple[], restaurants: readonly GlobalBackgroundFoodHighlightTuple[], deliveries: readonly GlobalBackgroundFoodHighlightTuple[]],
  quality: readonly [groceryBasketKnowledge: string, restaurantMedianKnowledge: string, limitationCodes: readonly string[]],
];

export type GlobalBackgroundRhythmDestination = Readonly<{
  targetId: string;
  kind: "GLOBAL_QUERY" | "ENTITY";
  resource: string;
  instanceKey?: string;
  entityRef: string;
  scopeHash: string;
  sourcePublicationId: string;
  sourceAnalyticsRevision: number;
}>;

export type GlobalBackgroundCarMonthSummary = Omit<CarMonth, "detail">;

export type GlobalBackgroundRhythmsReadModel = Readonly<{
  kind: "global_background_rhythms";
  schemaVersion: "global-background-rhythms@v1";
  resource: "analysis_global_background_rhythms";
  moduleKey: "RHYTHM";
  period: { readonly startMonth: string; readonly endMonth: string };
  food: Readonly<{
    annual: GlobalFoodRhythmProjection["annual"];
    months: readonly GlobalBackgroundFoodMonth[];
    constants: Readonly<{
      financialAmountAvailable: true;
      deliveryCountLabel: FoodMonth["deliveryBehavior"]["countLabel"];
      deliveryOccurrenceStatus: FoodMonth["deliveryBehavior"]["occurrenceStatus"];
      deliveryReasonCode: FoodMonth["deliveryBehavior"]["reasonCode"];
      monetaryAuthority: FoodMonth["quality"]["monetaryAuthority"];
      financialKnowledge: FoodMonth["quality"]["financialKnowledge"];
      deliveryOccurrenceKnowledge: FoodMonth["quality"]["deliveryOccurrenceKnowledge"];
    }>;
    annotations: GlobalFoodRhythmProjection["annotations"];
    methodVersion: GlobalFoodRhythmProjection["methodVersion"];
    inputHash: string;
  }>;
  carMobility: Readonly<{
    annual: GlobalCarMobilityRhythmProjection["annual"];
    usageComposition: CarMonth["usageComposition"];
    months: readonly GlobalBackgroundCarMonthSummary[];
    annotations: readonly Readonly<{ code: string; text: string }>[];
    metadata: readonly Readonly<{ key: string; value: string }>[];
    methodVersion: GlobalCarMobilityRhythmProjection["methodVersion"];
    inputHash: string;
  }>;
  quality: Readonly<{
    food: { readonly completeMonthCount: 12; readonly reconciliationStatus: "PASS" };
    carMobility: GlobalCarMobilityRhythmProjection["annual"]["quality"];
  }>;
  destinations: readonly GlobalBackgroundRhythmDestination[];
  publicationMeta: GlobalReadModelPublicationMeta;
  resourceMeta: GlobalReadModelResourceMeta;
}>;

export type GlobalBackgroundRhythmMonthDetailReadModel = Readonly<{
  kind: "global_background_rhythm_month_detail";
  schemaVersion: "global-background-rhythm-month-detail@v1";
  resource: "analysis_global_background_rhythm_month_detail";
  moduleKey: "RHYTHM";
  domain: "CAR_MOBILITY";
  month: string;
  routineGroups: NonNullable<CarMonth["detail"]>["routineGroups"];
  tripSummaries: NonNullable<CarMonth["detail"]>["tripSummaries"];
  contextOnly: NonNullable<CarMonth["detail"]>["contextOnly"];
  suppressedRemainder: NonNullable<CarMonth["detail"]>["suppressedRemainder"];
  destinations: readonly GlobalBackgroundRhythmDestination[];
  quality: Readonly<{
    mobility: CarMonth["quality"];
    narrative: CarMonth["narrativeSummary"] & Readonly<{ limitationCodes: readonly string[] }>;
  }>;
  publicationMeta: GlobalReadModelPublicationMeta;
  resourceMeta: GlobalReadModelResourceMeta;
}>;

export type GlobalBackgroundRhythmSnapshots = Readonly<{
  annual: GlobalBackgroundRhythmsReadModel;
  monthlyDetails: readonly Readonly<{ params: GlobalBackgroundRhythmMonthParams; payload: GlobalBackgroundRhythmMonthDetailReadModel }>[];
  annualSerializedBytes: number;
  maximumMonthlyDetailSerializedBytes: number;
  featureTotalSerializedBytes: number;
  detailAvailableMonths: readonly string[];
  expectedFeatureSnapshotCount: number;
}>;

const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/u;
const HASH = /^[0-9a-f]{64}$/u;
const FORBIDDEN_FIELDS = new Set(["fuelExplainedShare", "explainedAmount", "variance", "residual", "paidVsEstimatedRatio"]);

function text(value: unknown, label: string): string {
  if (typeof value !== "string" || value.length === 0 || value !== value.trim()) throw new TypeError(`${label}_INVALID`);
  return value;
}

function integer(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) throw new TypeError(`${label}_INVALID`);
  return value;
}

function decimal(value: unknown, label: string): string {
  const result = text(value, label);
  if (!/^-?(?:0|[1-9]\d*)(?:\.\d+)?$/u.test(result)) throw new TypeError(`${label}_INVALID`);
  return result;
}

function month(value: unknown, label: string): string {
  const result = text(value, label);
  if (!MONTH.test(result)) throw new TypeError(`${label}_INVALID`);
  return result;
}

function array(value: unknown, label: string, maximum?: number): readonly unknown[] {
  if (!Array.isArray(value) || (maximum !== undefined && value.length > maximum)) throw new TypeError(`${label}_INVALID`);
  return value;
}

function assertNoForbiddenFields(value: unknown): void {
  if (Array.isArray(value)) return void value.forEach(assertNoForbiddenFields);
  if (value === null || typeof value !== "object") return;
  for (const key of Reflect.ownKeys(value)) {
    if (typeof key !== "string" || FORBIDDEN_FIELDS.has(key)) throw new TypeError("GLOBAL_BACKGROUND_RHYTHM_FORBIDDEN_FIELD");
    assertNoForbiddenFields((value as Record<string, unknown>)[key]);
  }
}

function parsePublicationMeta(value: unknown): GlobalReadModelPublicationMeta {
  const record = parseStrictRecord(value, ["publicationId", "revision", "factsHash", "generatedAt", "profileId", "manifestHash"], "GlobalBackgroundPublicationMeta");
  const factsHash = text(requireProperty(record, "factsHash", "GlobalBackgroundPublicationMeta"), "factsHash");
  const manifestHash = text(requireProperty(record, "manifestHash", "GlobalBackgroundPublicationMeta"), "manifestHash");
  if (!HASH.test(factsHash) || !HASH.test(manifestHash)) throw new TypeError("GLOBAL_BACKGROUND_PUBLICATION_HASH_INVALID");
  const profileId = text(requireProperty(record, "profileId", "GlobalBackgroundPublicationMeta"), "profileId");
  if (profileId !== "global-v2-household@v1") throw new TypeError("GLOBAL_BACKGROUND_PROFILE_INVALID");
  return {
    publicationId: text(requireProperty(record, "publicationId", "GlobalBackgroundPublicationMeta"), "publicationId"),
    revision: integer(requireProperty(record, "revision", "GlobalBackgroundPublicationMeta"), "revision"),
    factsHash,
    generatedAt: text(requireProperty(record, "generatedAt", "GlobalBackgroundPublicationMeta"), "generatedAt"),
    profileId,
    manifestHash,
  } as GlobalReadModelPublicationMeta;
}

function parseResourceMeta(value: unknown): GlobalReadModelResourceMeta {
  const record = parseStrictRecord(value, ["contractVersion", "methodSignature", "policyVersions", "resourceInputHash"], "GlobalBackgroundResourceMeta");
  const policies = parseStrictRecord(requireProperty(record, "policyVersions", "GlobalBackgroundResourceMeta"), Object.keys(requireProperty(record, "policyVersions", "GlobalBackgroundResourceMeta") as object), "GlobalBackgroundPolicyVersions");
  const policyVersions = Object.fromEntries(Object.entries(policies).map(([key, entry]) => [text(key, "policyKey"), text(entry, `policy:${key}`)]));
  const methodSignature = text(requireProperty(record, "methodSignature", "GlobalBackgroundResourceMeta"), "methodSignature");
  const resourceInputHash = text(requireProperty(record, "resourceInputHash", "GlobalBackgroundResourceMeta"), "resourceInputHash");
  if (!HASH.test(methodSignature) || !HASH.test(resourceInputHash)) throw new TypeError("GLOBAL_BACKGROUND_RESOURCE_HASH_INVALID");
  return { contractVersion: text(requireProperty(record, "contractVersion", "GlobalBackgroundResourceMeta"), "contractVersion"), methodSignature, policyVersions, resourceInputHash };
}

function parseDestination(value: unknown): GlobalBackgroundRhythmDestination {
  const record = parseStrictRecord(value, ["targetId", "kind", "resource", "instanceKey", "entityRef", "scopeHash", "sourcePublicationId", "sourceAnalyticsRevision"], "GlobalBackgroundDestination");
  const kind = text(requireProperty(record, "kind", "GlobalBackgroundDestination"), "kind");
  if (kind !== "GLOBAL_QUERY" && kind !== "ENTITY") throw new TypeError("GLOBAL_BACKGROUND_DESTINATION_KIND_INVALID");
  const instanceKey = hasOwn(record, "instanceKey") ? text(record.instanceKey, "instanceKey") : undefined;
  if (kind === "GLOBAL_QUERY" && instanceKey === undefined) throw new TypeError("GLOBAL_BACKGROUND_DESTINATION_INSTANCE_MISSING");
  return {
    targetId: text(requireProperty(record, "targetId", "GlobalBackgroundDestination"), "targetId"),
    kind,
    resource: text(requireProperty(record, "resource", "GlobalBackgroundDestination"), "resource"),
    ...(instanceKey === undefined ? {} : { instanceKey }),
    entityRef: text(requireProperty(record, "entityRef", "GlobalBackgroundDestination"), "entityRef"),
    scopeHash: text(requireProperty(record, "scopeHash", "GlobalBackgroundDestination"), "scopeHash"),
    sourcePublicationId: text(requireProperty(record, "sourcePublicationId", "GlobalBackgroundDestination"), "sourcePublicationId"),
    sourceAnalyticsRevision: integer(requireProperty(record, "sourceAnalyticsRevision", "GlobalBackgroundDestination"), "sourceAnalyticsRevision"),
  };
}

function exact(value: unknown, keys: readonly string[], label: string): Readonly<Record<string, unknown>> {
  return parseStrictRecord(value, keys, label);
}

function validateMetricTotals(value: unknown, label: string): void {
  const record = exact(value, ["distanceKm", "estimatedFuelLiters", "estimatedFuelCost"], label);
  decimal(requireProperty(record, "distanceKm", label), `${label}.distanceKm`);
  decimal(requireProperty(record, "estimatedFuelLiters", label), `${label}.estimatedFuelLiters`);
  decimal(requireProperty(record, "estimatedFuelCost", label), `${label}.estimatedFuelCost`);
}

function validateModeledUsage(value: unknown, label: string): void {
  const record = exact(value, ["estimatedFuelCost", "distanceKm", "estimatedFuelLiters", "legCount", "dataNature", "dateBasis"], label);
  decimal(requireProperty(record, "estimatedFuelCost", label), `${label}.estimatedFuelCost`);
  decimal(requireProperty(record, "distanceKm", label), `${label}.distanceKm`);
  decimal(requireProperty(record, "estimatedFuelLiters", label), `${label}.estimatedFuelLiters`);
  integer(requireProperty(record, "legCount", label), `${label}.legCount`);
  if (record.dataNature !== "ESTIMATED" || record.dateBasis !== "MOBILITY_LEG_DATE") throw new TypeError(`${label}_INVALID`);
}

function validateObservedFuel(value: unknown, label: string): void {
  const record = exact(value, ["amount", "operationCount", "financialComponentCount", "dataNature", "dateBasis"], label);
  decimal(requireProperty(record, "amount", label), `${label}.amount`);
  integer(requireProperty(record, "operationCount", label), `${label}.operationCount`);
  integer(requireProperty(record, "financialComponentCount", label), `${label}.financialComponentCount`);
  if (record.dataNature !== "OBSERVED" || record.dateBasis !== "ECONOMIC_TIMING") throw new TypeError(`${label}_INVALID`);
}

function validateCarQuality(value: unknown, label: string): void {
  const record = exact(value, ["estimateCoverage", "resolvedEstimateCount", "eligibleLegCount", "estimateKnowledge", "measurementNature", "corpusCompleteness", "corpusCompletenessReason"], label);
  decimal(requireProperty(record, "estimateCoverage", label), `${label}.estimateCoverage`);
  integer(requireProperty(record, "resolvedEstimateCount", label), `${label}.resolvedEstimateCount`);
  integer(requireProperty(record, "eligibleLegCount", label), `${label}.eligibleLegCount`);
  if (!["KNOWN", "PARTIAL", "UNKNOWN"].includes(String(record.estimateKnowledge)) || record.measurementNature !== "ESTIMATED" || record.corpusCompleteness !== "UNKNOWN" || record.corpusCompletenessReason !== "REAL_WORLD_MOBILITY_EXHAUSTIVENESS_NOT_PROVEN") throw new TypeError(`${label}_INVALID`);
}

function validateUsageComposition(value: unknown, label: string): void {
  const record = exact(value, ["aroundWorkEstimatedFuelCost", "outsideWorkEstimatedFuelCost", "unresolvedEstimatedFuelCost", "classificationCoverage", "classificationStatus"], label);
  for (const key of ["aroundWorkEstimatedFuelCost", "outsideWorkEstimatedFuelCost", "unresolvedEstimatedFuelCost", "classificationCoverage"] as const) decimal(requireProperty(record, key, label), `${label}.${key}`);
  if (!["COMPLETE", "PARTIAL", "UNAVAILABLE"].includes(String(record.classificationStatus))) throw new TypeError(`${label}_INVALID`);
}

function validateNarrativeSummary(value: unknown, label: string): void {
  const record = exact(value, ["routineGroupCount", "tripSummaryCount", "contextOnlyCount", "suppressedTripCount", "visibleItemCount"], label);
  for (const key of ["routineGroupCount", "tripSummaryCount", "contextOnlyCount", "suppressedTripCount", "visibleItemCount"] as const) integer(requireProperty(record, key, label), `${label}.${key}`);
}

function validateCarMonth(value: unknown, label: string): void {
  const record = exact(value, ["month", "modeledUsage", "observedFuelPaid", "usageComposition", "narrativeSummary", "detailAvailable", "quality"], label);
  month(requireProperty(record, "month", label), `${label}.month`);
  validateModeledUsage(requireProperty(record, "modeledUsage", label), `${label}.modeledUsage`);
  validateObservedFuel(requireProperty(record, "observedFuelPaid", label), `${label}.observedFuelPaid`);
  validateUsageComposition(requireProperty(record, "usageComposition", label), `${label}.usageComposition`);
  validateNarrativeSummary(requireProperty(record, "narrativeSummary", label), `${label}.narrativeSummary`);
  if (typeof record.detailAvailable !== "boolean") throw new TypeError(`${label}.detailAvailable_INVALID`);
  validateCarQuality(requireProperty(record, "quality", label), `${label}.quality`);
}

function validateFoodHighlight(value: unknown, label: string): void {
  if (!Array.isArray(value) || value.length !== 11) throw new TypeError(`${label}_INVALID`);
  text(value[0], `${label}.highlightId`);
  text(value[1], `${label}.stableSourceId`);
  decimal(value[2], `${label}.amount`);
  text(value[3], `${label}.sourceType`);
  for (const index of [4, 5, 8, 9, 10]) if (value[index] !== null) text(value[index], `${label}[${index}]`);
  if (value[6] !== null && !["SMALL", "INTERMEDIATE", "LARGE"].includes(String(value[6]))) throw new TypeError(`${label}.basketClass_INVALID`);
  if (value[7] !== null) integer(value[7], `${label}.articleCount`);
}

function validateFoodMonth(value: unknown, label: string): void {
  if (!Array.isArray(value) || value.length !== 12) throw new TypeError(`${label}_INVALID`);
  month(value[0], `${label}.month`);
  for (let index = 1; index <= 5; index += 1) decimal(value[index], `${label}[${index}]`);
  if (value[6] !== null) decimal(value[6], `${label}.nonGroceryShare`);
  const grocery = value[7];
  if (!Array.isArray(grocery) || grocery.length !== 4) throw new TypeError(`${label}.groceryBehavior_INVALID`);
  integer(grocery[0], `${label}.groceryBehavior.occurrenceCount`);
  integer(grocery[1], `${label}.groceryBehavior.knownCostOccurrenceCount`);
  decimal(grocery[2], `${label}.groceryBehavior.coverage`);
  const basket = exact(grocery[3], ["status", "small", "intermediate", "large", "reasonCode"], `${label}.groceryBehavior.basketStructure`);
  if (basket.status === "KNOWN") {
    for (const key of ["small", "intermediate", "large"] as const) integer(requireProperty(basket, key, label), `${label}.basketStructure.${key}`);
    if (hasOwn(basket, "reasonCode")) throw new TypeError(`${label}.basketStructure_INVALID`);
  } else if (basket.status === "GATED") {
    text(requireProperty(basket, "reasonCode", label), `${label}.basketStructure.reasonCode`);
    if (["small", "intermediate", "large"].some((key) => hasOwn(basket, key))) throw new TypeError(`${label}.basketStructure_INVALID`);
  } else throw new TypeError(`${label}.basketStructure_INVALID`);
  const restaurant = value[8];
  if (!Array.isArray(restaurant) || restaurant.length !== 6) throw new TypeError(`${label}.restaurantBehavior_INVALID`);
  for (let index = 0; index <= 2; index += 1) integer(restaurant[index], `${label}.restaurantBehavior[${index}]`);
  decimal(restaurant[3], `${label}.restaurantBehavior.occurrenceCoverage`);
  decimal(restaurant[4], `${label}.restaurantBehavior.linkedFinanceAmountCoverage`);
  const median = exact(restaurant[5], ["status", "value", "reasonCode"], `${label}.restaurantBehavior.medianCost`);
  text(requireProperty(median, "status", label), `${label}.median.status`);
  if (hasOwn(median, "value")) decimal(median.value, `${label}.median.value`);
  if (hasOwn(median, "reasonCode")) text(median.reasonCode, `${label}.median.reasonCode`);
  integer(value[9], `${label}.deliveryPaymentCount`);
  const highlights = value[10];
  if (!Array.isArray(highlights) || highlights.length !== 3) throw new TypeError(`${label}.compositionHighlights_INVALID`);
  highlights.forEach((bucket, bucketIndex) => array(bucket, `${label}.compositionHighlights[${bucketIndex}]`, 4).forEach((entry, index) => validateFoodHighlight(entry, `${label}.compositionHighlights[${bucketIndex}][${index}]`)));
  const quality = value[11];
  if (!Array.isArray(quality) || quality.length !== 3) throw new TypeError(`${label}.quality_INVALID`);
  text(quality[0], `${label}.quality.groceryBasketKnowledge`);
  text(quality[1], `${label}.quality.restaurantMedianKnowledge`);
  array(quality[2], `${label}.quality.limitationCodes`).forEach((entry) => text(entry, `${label}.quality.limitationCode`));
}

function validateFoodAnnual(value: unknown): void {
  const record = exact(value, ["courses", "restaurants", "deliveries", "total", "nonGroceryAmount", "nonGroceryShare", "groceryBehavior", "restaurantBehavior", "deliveryBehavior"], "GlobalBackgroundFoodAnnual");
  for (const key of ["courses", "restaurants", "deliveries", "total", "nonGroceryAmount"] as const) decimal(requireProperty(record, key, "GlobalBackgroundFoodAnnual"), `food.annual.${key}`);
  if (record.nonGroceryShare !== null) decimal(record.nonGroceryShare, "food.annual.nonGroceryShare");
  const grocery = exact(requireProperty(record, "groceryBehavior", "GlobalBackgroundFoodAnnual"), ["knownCostOccurrenceCount", "eligibleMonthCount", "historicalComparisonGate", "thresholds"], "GlobalBackgroundFoodAnnualGrocery");
  integer(requireProperty(grocery, "knownCostOccurrenceCount", "GlobalBackgroundFoodAnnualGrocery"), "food.annual.grocery.knownCostOccurrenceCount");
  integer(requireProperty(grocery, "eligibleMonthCount", "GlobalBackgroundFoodAnnualGrocery"), "food.annual.grocery.eligibleMonthCount");
  text(requireProperty(grocery, "historicalComparisonGate", "GlobalBackgroundFoodAnnualGrocery"), "food.annual.grocery.historicalComparisonGate");
  const thresholds = exact(requireProperty(grocery, "thresholds", "GlobalBackgroundFoodAnnualGrocery"), ["p25", "p75"], "GlobalBackgroundFoodAnnualThresholds");
  decimal(requireProperty(thresholds, "p25", "GlobalBackgroundFoodAnnualThresholds"), "food.annual.grocery.p25");
  decimal(requireProperty(thresholds, "p75", "GlobalBackgroundFoodAnnualThresholds"), "food.annual.grocery.p75");
  const restaurant = exact(requireProperty(record, "restaurantBehavior", "GlobalBackgroundFoodAnnual"), ["paymentCount", "semanticOccurrenceCount", "knownCostOccurrenceCount", "occurrenceCoverage", "linkedFinanceAmountCoverage", "medianCost"], "GlobalBackgroundFoodAnnualRestaurant");
  for (const key of ["paymentCount", "semanticOccurrenceCount", "knownCostOccurrenceCount"] as const) integer(requireProperty(restaurant, key, "GlobalBackgroundFoodAnnualRestaurant"), `food.annual.restaurant.${key}`);
  decimal(requireProperty(restaurant, "occurrenceCoverage", "GlobalBackgroundFoodAnnualRestaurant"), "food.annual.restaurant.occurrenceCoverage");
  decimal(requireProperty(restaurant, "linkedFinanceAmountCoverage", "GlobalBackgroundFoodAnnualRestaurant"), "food.annual.restaurant.linkedFinanceAmountCoverage");
  const median = exact(requireProperty(restaurant, "medianCost", "GlobalBackgroundFoodAnnualRestaurant"), ["status", "value", "reasonCode"], "GlobalBackgroundFoodAnnualMedian");
  text(requireProperty(median, "status", "GlobalBackgroundFoodAnnualMedian"), "food.annual.restaurant.median.status");
  if (hasOwn(median, "value")) decimal(median.value, "food.annual.restaurant.median.value");
  if (hasOwn(median, "reasonCode")) text(median.reasonCode, "food.annual.restaurant.median.reasonCode");
  const delivery = exact(requireProperty(record, "deliveryBehavior", "GlobalBackgroundFoodAnnual"), ["paymentCount", "countLabel", "occurrenceStatus", "reasonCode"], "GlobalBackgroundFoodAnnualDelivery");
  integer(requireProperty(delivery, "paymentCount", "GlobalBackgroundFoodAnnualDelivery"), "food.annual.delivery.paymentCount");
  for (const key of ["countLabel", "occurrenceStatus", "reasonCode"] as const) text(requireProperty(delivery, key, "GlobalBackgroundFoodAnnualDelivery"), `food.annual.delivery.${key}`);
}

function validateAnnual(value: unknown): GlobalBackgroundRhythmsReadModel {
  assertNoForbiddenFields(value);
  const record = exact(value, ["kind", "schemaVersion", "resource", "moduleKey", "period", "food", "carMobility", "quality", "destinations", "publicationMeta", "resourceMeta"], "GlobalBackgroundRhythmsReadModel");
  if (record.kind !== "global_background_rhythms" || record.schemaVersion !== "global-background-rhythms@v1" || record.resource !== "analysis_global_background_rhythms" || record.moduleKey !== "RHYTHM") throw new TypeError("GLOBAL_BACKGROUND_RHYTHMS_IDENTITY_INVALID");
  const period = exact(requireProperty(record, "period", "GlobalBackgroundRhythmsReadModel"), ["startMonth", "endMonth"], "GlobalBackgroundPeriod");
  month(requireProperty(period, "startMonth", "GlobalBackgroundPeriod"), "period.startMonth");
  month(requireProperty(period, "endMonth", "GlobalBackgroundPeriod"), "period.endMonth");
  const food = exact(requireProperty(record, "food", "GlobalBackgroundRhythmsReadModel"), ["annual", "months", "constants", "annotations", "methodVersion", "inputHash"], "GlobalBackgroundFood");
  validateFoodAnnual(requireProperty(food, "annual", "GlobalBackgroundFood"));
  const foodMonths = array(requireProperty(food, "months", "GlobalBackgroundFood"), "food.months");
  if (foodMonths.length !== 12) throw new TypeError("GLOBAL_BACKGROUND_FOOD_MONTH_COUNT_INVALID");
  foodMonths.forEach((entry, index) => validateFoodMonth(entry, `food.months[${index}]`));
  const foodConstants = exact(requireProperty(food, "constants", "GlobalBackgroundFood"), ["financialAmountAvailable", "deliveryCountLabel", "deliveryOccurrenceStatus", "deliveryReasonCode", "monetaryAuthority", "financialKnowledge", "deliveryOccurrenceKnowledge"], "GlobalBackgroundFoodConstants");
  if (foodConstants.financialAmountAvailable !== true) throw new TypeError("GLOBAL_BACKGROUND_FOOD_CONSTANTS_INVALID");
  for (const key of ["deliveryCountLabel", "deliveryOccurrenceStatus", "deliveryReasonCode", "monetaryAuthority", "financialKnowledge", "deliveryOccurrenceKnowledge"] as const) text(requireProperty(foodConstants, key, "GlobalBackgroundFoodConstants"), `food.constants.${key}`);
  const foodAnnotations = array(requireProperty(food, "annotations", "GlobalBackgroundFood"), "food.annotations", 5);
  foodAnnotations.forEach((entry, index) => {
    const annotation = exact(entry, ["annotationId", "kind", "fromMonth", "toMonth", "text", "coursesChange", "nonGroceryChange"], `food.annotations[${index}]`);
    for (const key of ["annotationId", "kind", "text"] as const) text(requireProperty(annotation, key, "FoodAnnotation"), `food.annotation.${key}`);
    month(requireProperty(annotation, "fromMonth", "FoodAnnotation"), "food.annotation.fromMonth");
    month(requireProperty(annotation, "toMonth", "FoodAnnotation"), "food.annotation.toMonth");
    decimal(requireProperty(annotation, "coursesChange", "FoodAnnotation"), "food.annotation.coursesChange");
    decimal(requireProperty(annotation, "nonGroceryChange", "FoodAnnotation"), "food.annotation.nonGroceryChange");
  });
  text(requireProperty(food, "methodVersion", "GlobalBackgroundFood"), "food.methodVersion");
  if (!HASH.test(text(requireProperty(food, "inputHash", "GlobalBackgroundFood"), "food.inputHash"))) throw new TypeError("GLOBAL_BACKGROUND_FOOD_HASH_INVALID");
  const car = exact(requireProperty(record, "carMobility", "GlobalBackgroundRhythmsReadModel"), ["annual", "usageComposition", "months", "annotations", "metadata", "methodVersion", "inputHash"], "GlobalBackgroundCar");
  const carAnnual = exact(requireProperty(car, "annual", "GlobalBackgroundCar"), ["modeledUsage", "observedFuelPaid", "quality"], "GlobalBackgroundCarAnnual");
  validateModeledUsage(requireProperty(carAnnual, "modeledUsage", "GlobalBackgroundCarAnnual"), "car.annual.modeledUsage");
  validateObservedFuel(requireProperty(carAnnual, "observedFuelPaid", "GlobalBackgroundCarAnnual"), "car.annual.observedFuelPaid");
  validateCarQuality(requireProperty(carAnnual, "quality", "GlobalBackgroundCarAnnual"), "car.annual.quality");
  validateUsageComposition(requireProperty(car, "usageComposition", "GlobalBackgroundCar"), "car.usageComposition");
  const carMonths = array(requireProperty(car, "months", "GlobalBackgroundCar"), "car.months");
  if (carMonths.length !== 12) throw new TypeError("GLOBAL_BACKGROUND_CAR_MONTH_COUNT_INVALID");
  carMonths.forEach((entry, index) => validateCarMonth(entry, `car.months[${index}]`));
  for (const [key, keys] of [["annotations", ["code", "text"]], ["metadata", ["key", "value"]]] as const) array(requireProperty(car, key, "GlobalBackgroundCar"), `car.${key}`, 5).forEach((entry, index) => {
    const item = exact(entry, keys, `car.${key}[${index}]`);
    keys.forEach((field) => text(requireProperty(item, field, `car.${key}[${index}]`), `car.${key}.${field}`));
  });
  text(requireProperty(car, "methodVersion", "GlobalBackgroundCar"), "car.methodVersion");
  if (!HASH.test(text(requireProperty(car, "inputHash", "GlobalBackgroundCar"), "car.inputHash"))) throw new TypeError("GLOBAL_BACKGROUND_CAR_HASH_INVALID");
  const uniqueFoodMonths = new Set(foodMonths.map((entry) => (entry as GlobalBackgroundFoodMonth)[0]));
  const uniqueCarMonths = new Set(carMonths.map((entry) => (entry as { month: string }).month));
  if (uniqueFoodMonths.size !== 12 || uniqueCarMonths.size !== 12) throw new TypeError("GLOBAL_BACKGROUND_MONTH_UNIQUENESS_INVALID");
  const quality = exact(requireProperty(record, "quality", "GlobalBackgroundRhythmsReadModel"), ["food", "carMobility"], "GlobalBackgroundQuality");
  const foodQuality = exact(requireProperty(quality, "food", "GlobalBackgroundQuality"), ["completeMonthCount", "reconciliationStatus"], "GlobalBackgroundFoodQuality");
  if (foodQuality.completeMonthCount !== 12 || foodQuality.reconciliationStatus !== "PASS") throw new TypeError("GLOBAL_BACKGROUND_FOOD_QUALITY_INVALID");
  validateCarQuality(requireProperty(quality, "carMobility", "GlobalBackgroundQuality"), "quality.carMobility");
  array(requireProperty(record, "destinations", "GlobalBackgroundRhythmsReadModel"), "destinations", 12).forEach(parseDestination);
  parsePublicationMeta(requireProperty(record, "publicationMeta", "GlobalBackgroundRhythmsReadModel"));
  parseResourceMeta(requireProperty(record, "resourceMeta", "GlobalBackgroundRhythmsReadModel"));
  return value as GlobalBackgroundRhythmsReadModel;
}

function validateRoutineGroup(value: unknown, label: string): void {
  const record = exact(value, ["routineGroupId", "pattern", "title", "semanticFamily", "semanticTier", "usageBand", "occurrenceCount", "annualOccurrenceCount", "mobilityTripIds", "monthContribution", "fullTrips"], label);
  for (const key of ["routineGroupId", "pattern", "title", "semanticFamily", "usageBand"] as const) text(requireProperty(record, key, label), `${label}.${key}`);
  for (const key of ["semanticTier", "occurrenceCount", "annualOccurrenceCount"] as const) integer(requireProperty(record, key, label), `${label}.${key}`);
  array(requireProperty(record, "mobilityTripIds", label), `${label}.mobilityTripIds`).forEach((entry) => text(entry, `${label}.mobilityTripId`));
  validateMetricTotals(requireProperty(record, "monthContribution", label), `${label}.monthContribution`);
  validateMetricTotals(requireProperty(record, "fullTrips", label), `${label}.fullTrips`);
}

function validateTripSummary(value: unknown, label: string): void {
  const record = exact(value, ["tripSummaryId", "mobilityTripId", "title", "semanticFamily", "semanticTier", "usageBand", "multiDay", "crossMonth", "startDate", "endDate", "targetKind", "targetRef", "monthContribution", "fullTrip"], label);
  for (const key of ["tripSummaryId", "mobilityTripId", "title", "semanticFamily", "usageBand", "startDate", "endDate"] as const) text(requireProperty(record, key, label), `${label}.${key}`);
  if (hasOwn(record, "targetKind")) text(record.targetKind, `${label}.targetKind`);
  if (hasOwn(record, "targetRef")) text(record.targetRef, `${label}.targetRef`);
  integer(requireProperty(record, "semanticTier", label), `${label}.semanticTier`);
  if (typeof record.multiDay !== "boolean" || typeof record.crossMonth !== "boolean") throw new TypeError(`${label}_INVALID`);
  validateMetricTotals(requireProperty(record, "monthContribution", label), `${label}.monthContribution`);
  validateMetricTotals(requireProperty(record, "fullTrip", label), `${label}.fullTrip`);
}

function validateContextOnly(value: unknown, label: string): void {
  const record = exact(value, ["contextOnlyId", "mobilityTripId", "title", "semanticFamily", "semanticTier", "usageBand", "relationType", "targetKind", "targetRef"], label);
  for (const key of ["contextOnlyId", "mobilityTripId", "title", "semanticFamily", "usageBand", "relationType"] as const) text(requireProperty(record, key, label), `${label}.${key}`);
  integer(requireProperty(record, "semanticTier", label), `${label}.semanticTier`);
  if (hasOwn(record, "targetKind")) text(record.targetKind, `${label}.targetKind`);
  if (hasOwn(record, "targetRef")) text(record.targetRef, `${label}.targetRef`);
}

function validateMonthDetail(value: unknown): GlobalBackgroundRhythmMonthDetailReadModel {
  assertNoForbiddenFields(value);
  const record = exact(value, ["kind", "schemaVersion", "resource", "moduleKey", "domain", "month", "routineGroups", "tripSummaries", "contextOnly", "suppressedRemainder", "destinations", "quality", "publicationMeta", "resourceMeta"], "GlobalBackgroundRhythmMonthDetailReadModel");
  if (record.kind !== "global_background_rhythm_month_detail" || record.schemaVersion !== "global-background-rhythm-month-detail@v1" || record.resource !== "analysis_global_background_rhythm_month_detail" || record.moduleKey !== "RHYTHM" || record.domain !== "CAR_MOBILITY") throw new TypeError("GLOBAL_BACKGROUND_MONTH_DETAIL_IDENTITY_INVALID");
  month(requireProperty(record, "month", "GlobalBackgroundMonthDetail"), "month");
  array(requireProperty(record, "routineGroups", "GlobalBackgroundMonthDetail"), "routineGroups", 3).forEach((entry, index) => validateRoutineGroup(entry, `routineGroups[${index}]`));
  array(requireProperty(record, "tripSummaries", "GlobalBackgroundMonthDetail"), "tripSummaries", 12).forEach((entry, index) => validateTripSummary(entry, `tripSummaries[${index}]`));
  array(requireProperty(record, "contextOnly", "GlobalBackgroundMonthDetail"), "contextOnly", 4).forEach((entry, index) => validateContextOnly(entry, `contextOnly[${index}]`));
  const suppressed = exact(requireProperty(record, "suppressedRemainder", "GlobalBackgroundMonthDetail"), ["tripCount", "mobilityTripIds", "displayText", "internalReconciliation"], "GlobalBackgroundSuppressedRemainder");
  integer(requireProperty(suppressed, "tripCount", "GlobalBackgroundSuppressedRemainder"), "suppressed.tripCount");
  array(requireProperty(suppressed, "mobilityTripIds", "GlobalBackgroundSuppressedRemainder"), "suppressed.mobilityTripIds").forEach((entry) => text(entry, "suppressed.mobilityTripId"));
  text(requireProperty(suppressed, "displayText", "GlobalBackgroundSuppressedRemainder"), "suppressed.displayText");
  validateMetricTotals(requireProperty(suppressed, "internalReconciliation", "GlobalBackgroundSuppressedRemainder"), "suppressed.internalReconciliation");
  array(requireProperty(record, "destinations", "GlobalBackgroundMonthDetail"), "destinations", 16).forEach(parseDestination);
  const quality = exact(requireProperty(record, "quality", "GlobalBackgroundMonthDetail"), ["mobility", "narrative"], "GlobalBackgroundMonthQuality");
  validateCarQuality(requireProperty(quality, "mobility", "GlobalBackgroundMonthQuality"), "quality.mobility");
  const narrative = exact(requireProperty(quality, "narrative", "GlobalBackgroundMonthQuality"), ["routineGroupCount", "tripSummaryCount", "contextOnlyCount", "suppressedTripCount", "visibleItemCount", "limitationCodes"], "GlobalBackgroundNarrativeQuality");
  validateNarrativeSummary(Object.fromEntries(Object.entries(narrative).filter(([key]) => key !== "limitationCodes")), "quality.narrative");
  array(requireProperty(narrative, "limitationCodes", "GlobalBackgroundNarrativeQuality"), "quality.narrative.limitationCodes").forEach((entry) => text(entry, "limitationCode"));
  parsePublicationMeta(requireProperty(record, "publicationMeta", "GlobalBackgroundMonthDetail"));
  parseResourceMeta(requireProperty(record, "resourceMeta", "GlobalBackgroundMonthDetail"));
  return value as GlobalBackgroundRhythmMonthDetailReadModel;
}

export const globalBackgroundRhythmsReadModelSchema: RuntimeSchema<GlobalBackgroundRhythmsReadModel> = createRuntimeSchema(validateAnnual);
export const globalBackgroundRhythmMonthDetailReadModelSchema: RuntimeSchema<GlobalBackgroundRhythmMonthDetailReadModel> = createRuntimeSchema(validateMonthDetail);

export const parseGlobalBackgroundRhythmsReadModel = (value: unknown): GlobalBackgroundRhythmsReadModel => globalBackgroundRhythmsReadModelSchema.parse(value);
export const parseGlobalBackgroundRhythmMonthDetailReadModel = (value: unknown): GlobalBackgroundRhythmMonthDetailReadModel => globalBackgroundRhythmMonthDetailReadModelSchema.parse(value);

function serializedBytes(value: unknown): number {
  return new TextEncoder().encode(canonicalSerializeGlobal(value)).byteLength;
}

export function buildGlobalBackgroundRhythmSnapshots(input: {
  readonly food: GlobalFoodRhythmProjection;
  readonly carMobility: GlobalCarMobilityRhythmProjection;
  readonly publicationMeta: GlobalReadModelPublicationMeta;
  readonly annualResourceMeta: GlobalReadModelResourceMeta;
  readonly monthlyResourceMeta: (params: GlobalBackgroundRhythmMonthParams) => GlobalReadModelResourceMeta;
  readonly monthlyInstanceKey: (params: GlobalBackgroundRhythmMonthParams) => string;
  readonly scopeHash: string;
}): GlobalBackgroundRhythmSnapshots {
  if (input.food.months.length !== 12 || input.carMobility.months.length !== 12) throw new TypeError("GLOBAL_BACKGROUND_RHYTHM_REQUIRES_TWELVE_MONTHS");
  const compactHighlight = (highlight: FoodHighlight): GlobalBackgroundFoodHighlightTuple => [
    highlight.highlightId,
    highlight.stableSourceId,
    highlight.amount,
    highlight.sourceType,
    highlight.date ?? null,
    highlight.label ?? null,
    highlight.basketClass ?? null,
    highlight.articleCount ?? null,
    highlight.activityContext?.occurrenceId ?? null,
    highlight.activityContext?.activityId ?? null,
    highlight.activityContext?.label ?? null,
  ];
  const foodConstantSignature = (source: FoodMonth): string => canonicalSerializeGlobal({
    financialAmountAvailable: source.groceryBehavior.financialAmountAvailable,
    deliveryCountLabel: source.deliveryBehavior.countLabel,
    deliveryOccurrenceStatus: source.deliveryBehavior.occurrenceStatus,
    deliveryReasonCode: source.deliveryBehavior.reasonCode,
    monetaryAuthority: source.quality.monetaryAuthority,
    financialKnowledge: source.quality.financialKnowledge,
    deliveryOccurrenceKnowledge: source.quality.deliveryOccurrenceKnowledge,
  });
  if (new Set(input.food.months.map(foodConstantSignature)).size !== 1) throw new TypeError("GLOBAL_BACKGROUND_FOOD_COMPACT_CONSTANT_MISMATCH");
  const foodMonths: GlobalBackgroundFoodMonth[] = [...input.food.months].sort((left, right) => left.month.localeCompare(right.month)).map((source) => [
    source.month,
    source.courses,
    source.restaurants,
    source.deliveries,
    source.total,
    source.nonGroceryAmount,
    source.nonGroceryShare,
    [source.groceryBehavior.occurrenceCount, source.groceryBehavior.knownCostOccurrenceCount, source.groceryBehavior.coverage, source.groceryBehavior.basketStructure],
    [source.restaurantBehavior.paymentCount, source.restaurantBehavior.semanticOccurrenceCount, source.restaurantBehavior.knownCostOccurrenceCount, source.restaurantBehavior.occurrenceCoverage, source.restaurantBehavior.linkedFinanceAmountCoverage, source.restaurantBehavior.medianCost],
    source.deliveryBehavior.paymentCount,
    [source.compositionHighlights.courses.map(compactHighlight), source.compositionHighlights.restaurants.map(compactHighlight), source.compositionHighlights.deliveries.map(compactHighlight)],
    [source.quality.groceryBasketKnowledge, source.quality.restaurantMedianKnowledge, source.quality.limitationCodes],
  ]);
  const carMonths = [...input.carMobility.months].sort((left, right) => left.month.localeCompare(right.month));
  if (new Set(foodMonths.map(([value]) => value)).size !== 12 || new Set(carMonths.map(({ month: value }) => value)).size !== 12) throw new TypeError("GLOBAL_BACKGROUND_RHYTHM_MONTH_DUPLICATE");
  const detailMonths = carMonths.filter(({ detailAvailable, detail }) => detailAvailable && detail !== null);
  if (detailMonths.length !== carMonths.filter(({ detailAvailable }) => detailAvailable).length) throw new TypeError("GLOBAL_BACKGROUND_RHYTHM_DETAIL_AVAILABILITY_MISMATCH");
  const annualDestinations: GlobalBackgroundRhythmDestination[] = detailMonths.map(({ month: value }) => {
    const params = { domain: "CAR_MOBILITY" as const, month: value };
    return {
      targetId: `background-rhythm:${value}`,
      kind: "GLOBAL_QUERY",
      resource: globalBackgroundRhythmMonthDetailResourceDefinition.resource,
      instanceKey: input.monthlyInstanceKey(params),
      entityRef: `car-mobility-month:${value}`,
      scopeHash: input.scopeHash,
      sourcePublicationId: input.publicationMeta.publicationId,
      sourceAnalyticsRevision: input.publicationMeta.revision,
    };
  });
  const annualModeledCost = new Big(input.carMobility.annual.modeledUsage.estimatedFuelCost);
  const annualAroundWork = carMonths.reduce((sum, value) => sum.plus(value.usageComposition.aroundWorkEstimatedFuelCost), new Big(0));
  const annualOutsideWork = carMonths.reduce((sum, value) => sum.plus(value.usageComposition.outsideWorkEstimatedFuelCost), new Big(0));
  const annualUnresolved = carMonths.reduce((sum, value) => sum.plus(value.usageComposition.unresolvedEstimatedFuelCost), new Big(0));
  const annualClassificationCoverage = annualModeledCost.eq(0) ? new Big(0) : annualModeledCost.minus(annualUnresolved).div(annualModeledCost);
  const annual: GlobalBackgroundRhythmsReadModel = {
    kind: "global_background_rhythms",
    schemaVersion: "global-background-rhythms@v1",
    resource: globalBackgroundRhythmsResourceDefinition.resource,
    moduleKey: "RHYTHM",
    period: { startMonth: foodMonths[0]![0], endMonth: foodMonths[11]![0] },
    food: {
      annual: input.food.annual,
      months: foodMonths,
      constants: {
        financialAmountAvailable: true,
        deliveryCountLabel: input.food.months[0]!.deliveryBehavior.countLabel,
        deliveryOccurrenceStatus: input.food.months[0]!.deliveryBehavior.occurrenceStatus,
        deliveryReasonCode: input.food.months[0]!.deliveryBehavior.reasonCode,
        monetaryAuthority: input.food.months[0]!.quality.monetaryAuthority,
        financialKnowledge: input.food.months[0]!.quality.financialKnowledge,
        deliveryOccurrenceKnowledge: input.food.months[0]!.quality.deliveryOccurrenceKnowledge,
      },
      annotations: input.food.annotations.slice(0, 5), methodVersion: input.food.methodVersion, inputHash: input.food.inputHash,
    },
    carMobility: {
      annual: input.carMobility.annual,
      usageComposition: {
        aroundWorkEstimatedFuelCost: annualAroundWork.toString(),
        outsideWorkEstimatedFuelCost: annualOutsideWork.toString(),
        unresolvedEstimatedFuelCost: annualUnresolved.toString(),
        classificationCoverage: annualClassificationCoverage.toString(),
        classificationStatus: annualModeledCost.eq(0) ? "UNAVAILABLE" : annualUnresolved.eq(0) ? "COMPLETE" : "PARTIAL",
      },
      months: carMonths.map(({ detail: _detail, ...summary }) => summary),
      annotations: input.carMobility.comparisonContract.reasonCodes.slice(0, 5).map((code) => ({ code, text: code })),
      metadata: [{ key: "comparisonStatus", value: input.carMobility.comparisonContract.status }],
      methodVersion: input.carMobility.methodVersion,
      inputHash: input.carMobility.inputHash,
    },
    quality: { food: { completeMonthCount: 12, reconciliationStatus: input.food.reconciliation.status }, carMobility: input.carMobility.annual.quality },
    destinations: annualDestinations,
    publicationMeta: input.publicationMeta,
    resourceMeta: input.annualResourceMeta,
  };
  const monthlyDetails = detailMonths.map((source) => {
    const params = { domain: "CAR_MOBILITY" as const, month: source.month };
    const detail = source.detail!;
    const destinations: GlobalBackgroundRhythmDestination[] = detail.destinations.map((destination) => ({
      targetId: `background-rhythm-context:${destination.targetRef}`,
      kind: "ENTITY",
      resource: destination.targetKind === "MOMENT" ? "global_moment" : "global_life_event",
      entityRef: destination.targetRef,
      scopeHash: input.scopeHash,
      sourcePublicationId: input.publicationMeta.publicationId,
      sourceAnalyticsRevision: input.publicationMeta.revision,
    }));
    const payload: GlobalBackgroundRhythmMonthDetailReadModel = {
      kind: "global_background_rhythm_month_detail",
      schemaVersion: "global-background-rhythm-month-detail@v1",
      resource: globalBackgroundRhythmMonthDetailResourceDefinition.resource,
      moduleKey: "RHYTHM",
      domain: "CAR_MOBILITY",
      month: source.month,
      routineGroups: detail.routineGroups,
      tripSummaries: detail.tripSummaries,
      contextOnly: detail.contextOnly,
      suppressedRemainder: detail.suppressedRemainder,
      destinations,
      quality: { mobility: source.quality, narrative: { ...source.narrativeSummary, limitationCodes: source.quality.estimateKnowledge === "KNOWN" ? [] : ["MOBILITY_ESTIMATE_COVERAGE_PARTIAL"] } },
      publicationMeta: input.publicationMeta,
      resourceMeta: input.monthlyResourceMeta(params),
    };
    return { params, payload: parseGlobalBackgroundRhythmMonthDetailReadModel(payload) };
  });
  const parsedAnnual = parseGlobalBackgroundRhythmsReadModel(annual);
  const annualSerializedBytes = serializedBytes(parsedAnnual);
  const monthlyBytes = monthlyDetails.map(({ payload }) => serializedBytes(payload));
  const maximumMonthlyDetailSerializedBytes = Math.max(0, ...monthlyBytes);
  const featureTotalSerializedBytes = annualSerializedBytes + monthlyBytes.reduce((sum, value) => sum + value, 0);
  if (annualSerializedBytes > GLOBAL_BACKGROUND_RHYTHMS_ANNUAL_PAYLOAD_BUDGET_BYTES) throw new TypeError(`GLOBAL_BACKGROUND_RHYTHMS_ANNUAL_BUDGET_EXCEEDED:${annualSerializedBytes}`);
  if (maximumMonthlyDetailSerializedBytes > GLOBAL_BACKGROUND_RHYTHM_MONTH_DETAIL_PAYLOAD_BUDGET_BYTES) throw new TypeError(`GLOBAL_BACKGROUND_RHYTHM_MONTH_BUDGET_EXCEEDED:${maximumMonthlyDetailSerializedBytes}`);
  if (featureTotalSerializedBytes > GLOBAL_BACKGROUND_RHYTHMS_FEATURE_PAYLOAD_BUDGET_BYTES) throw new TypeError(`GLOBAL_BACKGROUND_RHYTHMS_FEATURE_BUDGET_EXCEEDED:${featureTotalSerializedBytes}`);
  const expectedFeatureSnapshotCount = 1 + monthlyDetails.length;
  if (monthlyDetails.length > 12 || expectedFeatureSnapshotCount > GLOBAL_BACKGROUND_RHYTHMS_MAX_FEATURE_SNAPSHOTS) throw new TypeError("GLOBAL_BACKGROUND_RHYTHMS_SNAPSHOT_COUNT_INVALID");
  return { annual: parsedAnnual, monthlyDetails, annualSerializedBytes, maximumMonthlyDetailSerializedBytes, featureTotalSerializedBytes, detailAvailableMonths: detailMonths.map(({ month: value }) => value), expectedFeatureSnapshotCount };
}
