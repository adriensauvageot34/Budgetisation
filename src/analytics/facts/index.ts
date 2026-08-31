export type {
  ActivityOccurrenceFact,
  ActivityOccurrenceCostFact,
  ActivityCausalFinancialLink,
  ActivityCausalRelationType,
  ActivityOccurrenceValidationStatus,
  AnalyticCategoryValue,
  AnalyticDateValue,
  AnalyticDimensionValue,
  AnalyticFact,
  AnalyticFactSource,
  AnalyticGrain,
  AnalyticTextDimensionValue,
  CanonicalComponentKey,
  CanonicalPlaceValue,
  CashUseId,
  EconomicComponentFact,
  EconomicTiming,
  EconomicTimingSegment,
  EconomicTimingSegmentKey,
  LifeEventSeriesId,
  PersonDayFact,
  PersonDayId,
  PersonDayObservability,
  PlaceVisitInterval,
  PlaceVisitFact,
  PlaceVisitKey,
  PlaceVisitTimePrecision,
  PurchaseEventFact,
  PurchaseEventId,
  PurchaseEventKey,
  PurchaseEventSource,
  PurchaseEventSourceKind,
  PurchaseEventTiming,
} from "./types";
export type {
  ComponentAxisClassification,
  ComponentClassificationAssertion,
  ComponentClassificationAuthority,
  ComponentClassificationAxis,
  ComponentClassificationCandidate,
  ComponentClassificationValue,
  EconomicComponentClassificationFact,
} from "./component-classification";
export {
  normalizeComponentClassificationValue,
  resolveEconomicComponentClassifications,
} from "./component-classification";
export type {
  ContinuityQualifier,
  LifeEventContinuityFact,
} from "./continuity";
export { continuityForSpanBehavior } from "./continuity";
export type { PurchaseEventTimingAssertion } from "./purchase-event";
export { resolvePurchaseEventTiming } from "./purchase-event";
export {
  buildActivityOccurrenceCostFacts,
  isCausalActivityRelation,
  medianKnownActivityCausalCost,
  parseActivityCausalFinancialLinks,
} from "./activity-cost";
export {
  partitionEconomicComponentsForStructure,
  type CanonicalStructurePartition,
} from "./structure";
export {
  activityOccurrenceFactSchema,
  analyticFactSchema,
  economicComponentFactSchema,
  parseActivityOccurrenceFact,
  parseAnalyticDateValue,
  parseAnalyticFact,
  parseCanonicalComponentKey,
  parseCashUseId,
  parseEconomicComponentFact,
  parsePersonDayFact,
  parsePlaceVisitFact,
  parsePurchaseEventFact,
  parsePurchaseEventId,
  personDayFactSchema,
  placeVisitFactSchema,
  purchaseEventFactSchema,
} from "./validation";
export type {
  CategoryAggregation,
  CategoryAggregationKey,
} from "./operations";
export {
  aggregateEconomicNetByCategory,
  aggregateLocalizedSpend,
  countActivityOccurrences,
  countDistinctVisitDays,
  countPersonDays,
  countPlaceVisits,
  countPurchaseEvents,
  dedupeActivityOccurrences,
  dedupeEconomicComponents,
  dedupePersonDays,
  dedupePlaceVisits,
  dedupePurchaseEvents,
  reconcileCategoryAggregation,
  sumEconomicNet,
} from "./operations";
export type {
  HistoricalEconomicTimingInput,
  HistoricalEconomicTimingResolution,
  HistoricalEconomicTimingSource,
} from "./economic-timing";
export { resolveHistoricalEconomicTiming } from "./economic-timing";
export type {
  ActivityOccurrenceCanonicalCandidate,
  CanonicalHouseholdContext,
  EconomicComponentProjectionInput,
  PurchaseEventCanonicalSource,
} from "./canonical";
export {
  assertCanonicalSourceAttributionControls,
  canonicalFactSources,
  parseActivityOccurrenceCanonicalCandidate,
  parseCanonicalHouseholdContext,
  parseCanonicalHouseholdScope,
  parsePurchaseEventCanonicalSources,
  projectActivityOccurrenceFact,
  projectEconomicComponentFact,
  projectPersonDayFact,
  projectPlaceVisitFact,
  projectPurchaseEventFact,
} from "./canonical";
