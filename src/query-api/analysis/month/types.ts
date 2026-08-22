import type { ActiveMetricId } from "../../../analytics/production";
import type { YearMonth } from "../../../core/time";
import type { QueryCapabilities } from "../../capabilities";
import type {
  PeriodCompleteness,
  ReadModelSubject,
  ScopedMoneyMetricReadModel,
} from "../../read-models";
import type {
  AnalysisBreakdownReadModel,
  AnalysisContextsReadModelBase,
  AnalysisSeriesPoint,
  AnalysisStructureReadModel,
} from "../shared/types";
import type { MoneyComparisonResult } from "../../../analytics/comparisons";

export type AnalysisMonthInitialReadModel = {
  readonly month: YearMonth;
  readonly subject: ReadModelSubject;
  readonly periodCompleteness: PeriodCompleteness;
  readonly actual: ScopedMoneyMetricReadModel;
  readonly typical?: ScopedMoneyMetricReadModel;
  readonly actualVsTypical?: MoneyComparisonResult;
  readonly structure: AnalysisStructureReadModel;
  readonly capabilities: QueryCapabilities;
};

export type AnalysisMonthBreakdownReadModel = {
  readonly month: YearMonth;
  readonly subject: ReadModelSubject;
  readonly breakdown: AnalysisBreakdownReadModel;
};

export type AnalysisMonthEvolutionReadModel = {
  readonly month: YearMonth;
  readonly subject: ReadModelSubject;
  readonly metricId: ActiveMetricId;
  readonly points: readonly AnalysisSeriesPoint[];
  readonly capabilities: QueryCapabilities;
};

export type AnalysisMonthContextsReadModel = {
  readonly month: YearMonth;
  readonly subject: ReadModelSubject;
  readonly contexts: AnalysisContextsReadModelBase;
};
