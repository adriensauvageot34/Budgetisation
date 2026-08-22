import type { AnalysisPeriodFinanceStatus } from "../../analytics/references";
import type { MetricId } from "../../core/identity";
import type {
  CountMetricUnit,
  MonetaryMetricUnit,
  Money,
} from "../../core/money";
import type { MetricEnvelope } from "../../core/metrics";
import type { NormalizedAnalysisScope, ScopeHash } from "../../core/scope";

export type PeriodCompleteness = AnalysisPeriodFinanceStatus;
export type ReadModelSubject = NormalizedAnalysisScope["subject"];

export type MoneyMetricEnvelope = MetricEnvelope<Money, MonetaryMetricUnit>;
export type CountMetricEnvelope = MetricEnvelope<
  number,
  CountMetricUnit
>;

export type ScopedMoneyMetricReadModel = {
  readonly metricId: MetricId;
  readonly scopeHash: ScopeHash;
  readonly envelope: MoneyMetricEnvelope;
};

export type ScopedCountMetricReadModel = {
  readonly metricId: MetricId;
  readonly scopeHash: ScopeHash;
  readonly envelope: CountMetricEnvelope;
};

export type ScopedMetricReadModel =
  | ScopedMoneyMetricReadModel
  | ScopedCountMetricReadModel;
