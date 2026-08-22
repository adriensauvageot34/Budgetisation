export type {
  AnalysisPeriodFinanceStatus,
  ExcludedReferencePeriod,
  FinancialAnalysisPeriodProjection,
  MonthReferenceWindow,
  ReferenceExclusionReason,
  ReferencePeriodCandidate,
  ReferenceWindowRequest,
} from "./types";
export type {
  MonthlyEconomicObservation,
  TypicalMonthMetric,
  TypicalMonthSemantic,
} from "./typical-month";
export {
  calculateRollingComparisonTypicalMonths,
  calculateTypicalMonthCost,
  medianMoney,
  TYPICAL_MONTH_METHOD_VERSION,
  TYPICAL_MONTH_METRIC_ID,
  TYPICAL_MONTH_REQUESTED_PERIOD_COUNT,
} from "./typical-month";
export {
  assertMonthReferenceWindow,
  financialReferenceCandidateFromAnalysisPeriod,
  selectComparisonReferenceWindow,
  selectCurrentReferenceWindow,
} from "./windows";
