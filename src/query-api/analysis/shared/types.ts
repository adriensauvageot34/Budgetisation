import type {
  ContextCapabilityId,
  ContextDeferredReason,
  ContextDimension,
} from "../../../analytics/context";
import type {
  AnalyticGrain,
} from "../../../analytics/facts";
import type { MoneyComparisonResult } from "../../../analytics/comparisons";
import type { SupportUnit } from "../../../core/metrics";
import type { QueryCapabilities } from "../../capabilities";
import type {
  AnalysisBreakdownDimension,
} from "../../request";
import type {
  PeriodCompleteness,
  ScopedMetricReadModel,
  ScopedMoneyMetricReadModel,
} from "../../read-models";

export type AnalysisReconciliation = "exact" | "partial" | "not_applicable";

export type AnalysisStructureAxis =
  | "necessity"
  | "fixed_variable"
  | "life_scope";

export type AnalysisStructureAxisReadModel = {
  readonly axis: AnalysisStructureAxis;
  readonly metric: ScopedMetricReadModel;
  readonly reconciliation: AnalysisReconciliation;
};

export type AnalysisStructureReadModel = {
  readonly axes: readonly AnalysisStructureAxisReadModel[];
};

export type BreakdownBucketIdentity =
  | { readonly kind: "entity"; readonly entityId: string }
  | { readonly kind: "canonical"; readonly key: string }
  | { readonly kind: "undetermined" }
  | { readonly kind: "remainder" };

export type AnalysisBreakdownFlag = "partial_coverage" | "conflict";

export type AnalysisBreakdownRow = {
  readonly bucket: BreakdownBucketIdentity;
  readonly label: string;
  readonly metric: ScopedMetricReadModel;
  readonly comparison?: MoneyComparisonResult;
  readonly rank?: number;
  readonly flags: readonly AnalysisBreakdownFlag[];
};

export type AnalysisBreakdownReadModel = {
  readonly dimension: AnalysisBreakdownDimension;
  readonly measure: import("../../../analytics/production").ActiveMetricId;
  readonly rows: readonly AnalysisBreakdownRow[];
  readonly remainder?: AnalysisBreakdownRow;
  readonly total?: ScopedMetricReadModel;
  readonly reconciliation: AnalysisReconciliation;
  readonly capabilities: QueryCapabilities;
};

export type AnalysisSeriesPoint = {
  readonly period: import("../../../core/time").YearMonth;
  readonly metric: ScopedMetricReadModel;
  readonly comparison?: MoneyComparisonResult;
  readonly periodCompleteness: PeriodCompleteness;
};

export type AnalysisContextRow = {
  readonly key: string;
  readonly label: string;
  readonly metric: ScopedMetricReadModel;
};

export type AnalysisContextSection =
  | {
      readonly kind: "available";
      readonly capabilityId: ContextCapabilityId;
      readonly dimension: ContextDimension;
      readonly sourceGrains: readonly AnalyticGrain[];
      readonly supportUnit: SupportUnit;
      readonly overlappingContextsAdditivity: "non_additive";
      readonly rows: readonly AnalysisContextRow[];
    }
  | {
      readonly kind: "unavailable";
      readonly capabilityId: ContextCapabilityId;
      readonly reason: ContextDeferredReason;
    };

export type AnalysisContextsReadModelBase = {
  readonly sections: readonly AnalysisContextSection[];
  readonly capabilities: QueryCapabilities;
};

export type AnalysisActualVsTypical = MoneyComparisonResult;
export type AnalysisActualMetric = ScopedMoneyMetricReadModel;
