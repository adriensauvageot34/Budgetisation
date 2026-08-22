export type { ExactRatio } from "./exact-ratio";
export { exactRatioFromDivision } from "./exact-ratio";
export type {
  ComparableMetric,
  ComparisonCapability,
  ComparisonCapabilityId,
  ComparisonDelta,
  ComparisonQualification,
  ComparisonReason,
  ComparisonReferenceAuthorization,
  ComparisonReferenceKind,
  ComparisonRelation,
  ComparisonRequest,
  ComparisonResult,
  ComparisonSemantic,
  CoverageCompatibility,
  MoneyComparisonRequest,
  MoneyComparisonResult,
  RatioComparisonRequest,
  RatioComparisonResult,
} from "./types";
export {
  comparisonCapabilities,
  getComparisonCapability,
  isComparisonCapabilityId,
} from "./capabilities";
export {
  compareMoneyMetrics,
  compareRatioMetrics,
  COMPARISON_METHOD_VERSION,
} from "./engine";
