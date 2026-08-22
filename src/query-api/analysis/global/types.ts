import type { ActiveMetricId } from "../../../analytics/production";
import type { GlobalWindow, YearMonth } from "../../../core/time";
import type { QueryCapabilities } from "../../capabilities";
import type {
  CountMetricEnvelope,
  ReadModelSubject,
  ScopedMoneyMetricReadModel,
} from "../../read-models";
import type {
  AnalysisBreakdownReadModel,
  AnalysisContextsReadModelBase,
  AnalysisSeriesPoint,
  AnalysisStructureReadModel,
} from "../shared/types";

export type AnalysisGlobalInitialReadModel = {
  readonly observationWindow: GlobalWindow;
  readonly asOf: YearMonth;
  readonly subject: ReadModelSubject;
  readonly observedPeriodCount: CountMetricEnvelope;
  readonly monthlyTypical?: ScopedMoneyMetricReadModel;
  readonly structure: AnalysisStructureReadModel;
  readonly capabilities: QueryCapabilities;
};

export type AnalysisGlobalBreakdownReadModel = {
  readonly observationWindow: GlobalWindow;
  readonly asOf: YearMonth;
  readonly subject: ReadModelSubject;
  readonly breakdown: AnalysisBreakdownReadModel;
};

export type AnalysisGlobalEvolutionReadModel = {
  readonly observationWindow: GlobalWindow;
  readonly asOf: YearMonth;
  readonly subject: ReadModelSubject;
  readonly metricId: ActiveMetricId;
  readonly points: readonly AnalysisSeriesPoint[];
  readonly capabilities: QueryCapabilities;
};

export type AnalysisGlobalContextsReadModel = {
  readonly observationWindow: GlobalWindow;
  readonly asOf: YearMonth;
  readonly subject: ReadModelSubject;
  readonly contexts: AnalysisContextsReadModelBase;
};
