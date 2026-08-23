import type { MoneyComparisonResult, ComparisonQualification } from "../../../analytics/comparisons";
import type { ActiveMetricId } from "../../../analytics/production";
import type { ActivityId, CategoryId, MerchantId, MetricId, MomentId, OperationId, PersonId, PlaceId } from "../../../core/identity";
import type { AnalysisTargetSubject } from "../../../core/scope";
import type { Instant, LocalDate, YearMonth } from "../../../core/time";
import type { QueryCapabilities } from "../../capabilities";
import type { PeriodCompleteness, ReadModelSubject, ScopedCountMetricReadModel, ScopedMetricReadModel, ScopedMoneyMetricReadModel } from "../../read-models";
import type { AnalysisBreakdownReadModel, AnalysisContextsReadModelBase } from "../shared/types";

export type AnalysisManualSummary = { readonly source: "manual"; readonly text: string; readonly updatedAt?: Instant };
export type AnalysisDestination =
  | { readonly kind: "target"; readonly target: AnalysisTargetSubject }
  | { readonly kind: "moment"; readonly momentId: MomentId }
  | { readonly kind: "merchant"; readonly merchantId: MerchantId }
  | { readonly kind: "place"; readonly placeId: PlaceId }
  | { readonly kind: "operation"; readonly operationId: OperationId }
  | { readonly kind: "methodology"; readonly metricId: MetricId };

export type MarkedFactKind = "family" | "category" | "activity" | "context" | "moment" | "operation" | "merchant" | "place" | "structure";
export type MarkedFactEvidence =
  | { readonly kind: "metric"; readonly metricId: MetricId }
  | { readonly kind: "comparison"; readonly targetMetricId: MetricId; readonly referenceMetricId: MetricId };
export type MarkedFactReadModel = {
  readonly id: string;
  readonly kind: MarkedFactKind;
  readonly title: string;
  readonly description?: string;
  readonly primaryMetric: ScopedMetricReadModel;
  readonly secondaryMetric?: ScopedMetricReadModel;
  readonly comparison?: MoneyComparisonResult;
  readonly qualification: ComparisonQualification;
  readonly evidence: readonly MarkedFactEvidence[];
  readonly destination?: AnalysisDestination;
};
export type MarkedFactsSelection =
  | { readonly kind: "available"; readonly methodVersion: string }
  | { readonly kind: "unavailable"; readonly reason: "materiality_rules_missing" };

export type AnalysisMonthInitialReadModel = {
  readonly month: YearMonth;
  readonly subject: ReadModelSubject;
  readonly periodCompleteness: PeriodCompleteness;
  readonly actual: ScopedMoneyMetricReadModel;
  readonly typical?: ScopedMoneyMetricReadModel;
  readonly minimal?: ScopedMoneyMetricReadModel;
  readonly actualVsTypical?: MoneyComparisonResult;
  readonly typicalVsMinimal?: MoneyComparisonResult;
  readonly economicRevenue?: ScopedMoneyMetricReadModel;
  readonly economicBalance?: ScopedMoneyMetricReadModel;
  readonly markedFacts: readonly MarkedFactReadModel[];
  readonly markedFactsSelection: MarkedFactsSelection;
  readonly manualSummary?: AnalysisManualSummary | null;
  readonly capabilities: QueryCapabilities;
};

export type AnalysisMonthBreakdownReadModel = { readonly month: YearMonth; readonly subject: ReadModelSubject; readonly breakdown: AnalysisBreakdownReadModel };
export type AnalysisMonthEvolutionSeriesId = "economic_total" | "daily_life" | "outside_daily_life";
export type AnalysisMonthEvolutionPoint = {
  readonly period: YearMonth;
  readonly metric: ScopedMoneyMetricReadModel;
  readonly rollingTypical?: ScopedMoneyMetricReadModel;
  readonly comparison?: MoneyComparisonResult;
  readonly periodCompleteness: PeriodCompleteness;
};
export type AnalysisMonthEvolutionSeries = { readonly id: AnalysisMonthEvolutionSeriesId; readonly label: string; readonly metricId: ActiveMetricId; readonly points: readonly AnalysisMonthEvolutionPoint[] };
export type AnalysisMonthEvolutionReadModel = { readonly month: YearMonth; readonly subject: ReadModelSubject; readonly series: readonly AnalysisMonthEvolutionSeries[]; readonly capabilities: QueryCapabilities };

export type AnalysisStructureView = "destination" | "nature" | "life_context";
export type AnalysisStructureDimension = "family" | "category" | "activity" | "merchant" | "place" | "fixed_variable" | "life_context" | "necessity";
export type AnalysisStructureMeasure = "amount" | "share" | "occurrences" | "cost_per_occurrence";
export type AnalysisStructureCombination = { readonly view: AnalysisStructureView; readonly dimension: AnalysisStructureDimension; readonly measures: readonly AnalysisStructureMeasure[] };
export type AnalysisMonthStructureRow = {
  readonly bucket:
    | { readonly kind: "family"; readonly familyId: string }
    | { readonly kind: "category"; readonly categoryId: CategoryId }
    | { readonly kind: "activity"; readonly activityId: ActivityId }
    | { readonly kind: "merchant"; readonly merchantId: MerchantId }
    | { readonly kind: "place"; readonly placeId: PlaceId }
    | { readonly kind: "canonical"; readonly key: string }
    | { readonly kind: "undetermined" };
  readonly label: string;
  readonly metric: ScopedMetricReadModel;
  readonly rank: number;
  readonly barPercent?: number;
  readonly destination?: AnalysisDestination;
};
export type AnalysisMonthStructureReadModel = {
  readonly month: YearMonth;
  readonly subject: ReadModelSubject;
  readonly activeView: AnalysisStructureView;
  readonly activeDimension: AnalysisStructureDimension;
  readonly activeMeasure: AnalysisStructureMeasure;
  readonly availableViews: readonly AnalysisStructureView[];
  readonly availableDimensions: readonly AnalysisStructureDimension[];
  readonly availableMeasures: readonly AnalysisStructureMeasure[];
  readonly supportedCombinations: readonly AnalysisStructureCombination[];
  readonly unavailableDimensions: readonly {
    readonly dimension: "family" | "necessity";
    readonly reason: "BLOCKED_CONTRACT";
  }[];
  readonly rows: readonly AnalysisMonthStructureRow[];
  readonly remainder?: AnalysisMonthStructureRow;
  readonly total?: ScopedMetricReadModel;
  readonly reconciliation: "exact" | "partial" | "not_applicable";
  readonly capabilities: QueryCapabilities;
};

export type AnalysisLivedSubview = "summary" | "rhythm" | "contexts" | "frequency_cost";
export type AnalysisLivedActivity = {
  readonly activityId: ActivityId;
  readonly label: string;
  readonly frequency: ScopedCountMetricReadModel;
  readonly cost?: ScopedMoneyMetricReadModel;
  readonly comparison?: MoneyComparisonResult;
  readonly qualification: ComparisonQualification;
  readonly destination: AnalysisDestination;
};
export type AnalysisFrequencyCostPoint = {
  readonly activityId: ActivityId;
  readonly label: string;
  readonly occurrences: ScopedCountMetricReadModel;
  readonly medianCausalCostPerOccurrence: ScopedMoneyMetricReadModel;
  readonly totalCausalCost: ScopedMoneyMetricReadModel;
  readonly destination: AnalysisDestination;
};
export type AnalysisMonthLivedReadModel = {
  readonly month: YearMonth;
  readonly subject: ReadModelSubject;
  readonly availableSubviews: readonly AnalysisLivedSubview[];
  readonly activities: readonly AnalysisLivedActivity[];
  readonly contexts: AnalysisContextsReadModelBase;
  readonly frequencyCost:
    | { readonly kind: "available"; readonly points: readonly AnalysisFrequencyCostPoint[] }
    | { readonly kind: "unavailable"; readonly reason: "causal_mapping_unavailable" };
  readonly capabilities: QueryCapabilities;
};

export type MomentMediaPreview = { readonly bucket: string; readonly path: string; readonly alt: string };
export type MomentPreview = {
  readonly momentId: MomentId;
  readonly title: string;
  readonly media?: MomentMediaPreview;
  readonly startDate?: LocalDate;
  readonly endDate?: LocalDate;
  readonly participants: readonly { readonly personId: PersonId; readonly label?: string }[];
  readonly duration?: string;
  readonly economicCost?: ScopedMoneyMetricReadModel;
  readonly destination: AnalysisDestination;
};
export type AnalysisMonthMomentsReadModel = { readonly month: YearMonth; readonly subject: ReadModelSubject; readonly moments: readonly MomentPreview[]; readonly capabilities: QueryCapabilities };

export type AnalysisTargetReadModel = {
  readonly time: import("../../../core/scope").AnalysisTime;
  readonly subject: ReadModelSubject;
  readonly target: AnalysisTargetSubject;
  readonly status: "available" | "outside_scope" | "unsupported" | "blocked_contract";
  readonly headlineMetrics: readonly ScopedMetricReadModel[];
  readonly capabilities: QueryCapabilities;
};

export type AnalysisMonthContextsReadModel = { readonly month: YearMonth; readonly subject: ReadModelSubject; readonly contexts: AnalysisContextsReadModelBase };
