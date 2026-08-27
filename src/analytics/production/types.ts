import type { MetricId } from "../../core/identity";
import type {
  CountMetricUnit,
  MetricUnit,
  MonetaryMetricUnit,
  Money,
} from "../../core/money";
import type {
  Availability,
  Coverage,
  MetricEnvelope,
  Provenance,
  Support,
  SupportUnit,
} from "../../core/metrics";
import type {
  AnalysisScope,
  ScopeHash,
} from "../../core/scope";
import type { MethodVersion } from "../../core/versions";
import type {
  AdditivityPolicy,
  AggregationCapabilityId,
  AnalyticDateBasis,
  AnalyticDimension,
  AnalyticFilterDimension,
} from "../aggregation";
import type { ComparisonCapabilityId } from "../comparisons";
import type { ContextCapabilityId } from "../context";
import type {
  AnalyticFactSource,
  AnalyticGrain,
} from "../facts";
import type {
  EstimationTrace,
  FuelTripEstimateInput,
} from "../provenance";
import type {
  MonthReferenceWindow,
  MonthlyEconomicObservation,
} from "../references";
import type { MinimalMonthComponent } from "../baseline";

export type ActiveMetricId =
  | "economic_consumption_net_attributable"
  | "typical_month_cost"
  | "minimal_month_cost"
  | "localized_spend"
  | "category_amount"
  | "merchant_net_amount"
  | "life_scope_amount"
  | "fixed_variable_amount"
  | "purchase_count"
  | "person_day_count"
  | "place_visit_count"
  | "distinct_visit_days"
  | "activity_frequency"
  | "activity_causal_cost"
  | "activity_causal_median_cost_per_occurrence"
  | "fuel_trip_estimate";

export type MetricProductionStrategy =
  | "sum_economic_net"
  | "typical_month"
  | "minimal_month"
  | "localized_spend"
  | "count_purchase_events"
  | "count_person_days"
  | "count_place_visits"
  | "count_distinct_visit_days"
  | "count_activity_occurrences"
  | "sum_activity_causal_cost"
  | "median_activity_causal_cost"
  | "fuel_trip_estimate";

export type MetricAvailabilityRule =
  | "source_availability"
  | "method_defined"
  | "required_place_filter"
  | "required_category_filter"
  | "required_merchant_filter"
  | "required_life_scope_filter";

export type MetricProvenanceRule = Extract<
  Provenance,
  "observed" | "derived" | "estimated"
>;

export type MetricSupportPolicy =
  | { readonly kind: "source_provided"; readonly unit: SupportUnit }
  | { readonly kind: "typical_month"; readonly unit: "month" }
  | { readonly kind: "activity_causal_cost"; readonly unit: "occurrence" }
  | { readonly kind: "optional"; readonly unit: SupportUnit };

export type MetricRegistryEntry = {
  readonly metricId: MetricId;
  readonly semanticName: string;
  readonly grain: readonly (
    | AnalyticGrain
    | "reference_month"
    | "estimation_input"
  )[];
  readonly sourceFact: readonly AnalyticFactSource[];
  readonly productionStrategy: MetricProductionStrategy;
  readonly dateBasis: AnalyticDateBasis;
  readonly dimensions: readonly AnalyticDimension[];
  readonly allowedFilters: readonly AnalyticFilterDimension[];
  readonly monetaryBasis?: "economic_net" | "estimated_cost";
  readonly referenceMethod?: "comparison_reference";
  readonly referenceWindow?: { readonly requestedPeriods: number };
  readonly supportPolicy: MetricSupportPolicy;
  readonly availabilityRules: readonly MetricAvailabilityRule[];
  readonly additivity: AdditivityPolicy;
  readonly provenanceRule: MetricProvenanceRule;
  readonly comparisonCapabilities: readonly ComparisonCapabilityId[];
  readonly methodVersion: MethodVersion;
  readonly unit: MetricUnit;
  readonly outputKind: "money" | "count";
  readonly allowedTimeKinds: readonly AnalysisScope["time"]["kind"][];
  readonly aggregationCapabilityId?: AggregationCapabilityId;
  readonly contextCapabilityId?: ContextCapabilityId;
};

type UnavailableSource = {
  readonly availability: Exclude<Availability, "known">;
  readonly facts?: never;
};

type KnownFactSource = {
  readonly availability: "known";
  readonly facts: readonly unknown[];
};

type ScopedFactSource<Kind extends string> = {
  readonly kind: Kind;
  readonly scopeHash: ScopeHash;
  readonly coverage?: Coverage;
  readonly support?: Support;
} & (KnownFactSource | UnavailableSource);

export type MetricProductionSource =
  | ScopedFactSource<"economic_components">
  | ScopedFactSource<"purchase_events">
  | ScopedFactSource<"person_days">
  | ScopedFactSource<"place_visits">
  | ScopedFactSource<"activity_occurrences">
  | ScopedFactSource<"activity_occurrence_costs">
  | ({
      readonly kind: "minimal_month";
      readonly scopeHash: ScopeHash;
      readonly coverage?: Coverage;
      readonly support?: Support;
    } & (
      | { readonly availability: Exclude<Availability, "known"> }
      | {
          readonly availability: "known";
          readonly neutralVariableComponents: readonly MinimalMonthComponent[];
          readonly mandatoryMonthlyObligationsAndProvisions: readonly MinimalMonthComponent[];
        }
    ))
  | {
      readonly kind: "typical_month";
      readonly scopeHash: ScopeHash;
      readonly window: MonthReferenceWindow;
      readonly monthlyObservations: readonly MonthlyEconomicObservation[];
      readonly coverage?: Coverage;
    }
  | {
      readonly kind: "fuel_trip_estimate";
      readonly scopeHash: ScopeHash;
      readonly input: FuelTripEstimateInput;
    };

export type MetricProductionRequest = {
  readonly metricId: unknown;
  readonly scope: AnalysisScope;
  readonly source: MetricProductionSource;
};

export type ProducedMetricIdentity = {
  readonly metricId: MetricId;
  readonly scopeHash: ScopeHash;
  readonly referenceWindow?: MonthReferenceWindow;
  readonly estimationTrace?: EstimationTrace;
};

export type ProducedMoneyMetric = ProducedMetricIdentity &
  MetricEnvelope<Money, MonetaryMetricUnit>;

export type ProducedCountMetric = ProducedMetricIdentity &
  MetricEnvelope<number, CountMetricUnit>;

export type ProducedMetric = ProducedMoneyMetric | ProducedCountMetric;

export type MetricProductionOutcome =
  | { readonly ok: true; readonly metric: ProducedMetric }
  | {
      readonly ok: false;
      readonly error: import("../../core/api").ApiError;
    };
