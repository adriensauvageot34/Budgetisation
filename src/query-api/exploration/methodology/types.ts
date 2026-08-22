import type {
  AdditivityPolicy,
  AnalyticDateBasis,
  AnalyticDimension,
} from "../../../analytics/aggregation";
import type {
  AnalyticFactSource,
  AnalyticGrain,
} from "../../../analytics/facts";
import type {
  ActiveMetricId,
  MetricProvenanceRule,
  MetricSupportPolicy,
} from "../../../analytics/production";
import type { MetricId } from "../../../core/identity";
import type { YearMonth } from "../../../core/time";
import type { MethodVersion } from "../../../core/versions";
import type { QueryCapabilities } from "../../capabilities";
import type { CursorPage } from "../../collections";

export type MetricMethodologyReadModel = {
  readonly metricId: MetricId;
  readonly asOf: YearMonth;
  readonly userName: string;
  readonly description: string;
  readonly methodVersion: MethodVersion;
  readonly grain: readonly (AnalyticGrain | "reference_month" | "estimation_input")[];
  readonly sourceFact: readonly AnalyticFactSource[];
  readonly formulaDescription: string;
  readonly dateBasis: AnalyticDateBasis;
  readonly reference?: {
    readonly method: "comparison_reference";
    readonly requestedPeriods?: number;
  };
  readonly support: MetricSupportPolicy;
  readonly provenanceRule: MetricProvenanceRule;
  readonly additivity: AdditivityPolicy;
  readonly compatibleDimensions: readonly AnalyticDimension[];
  readonly capabilities: QueryCapabilities;
};

export type MetricCatalogCard = {
  readonly metricId: ActiveMetricId;
  readonly userName: string;
  readonly outputKind: "money" | "count";
};

export type MetricCatalogPreviewReadModel = {
  readonly items: readonly MetricCatalogCard[];
  readonly capabilities: QueryCapabilities;
};

export type MetricCatalogCollectionReadModel = {
  readonly page: CursorPage<MetricCatalogCard>;
  readonly capabilities: QueryCapabilities;
};
