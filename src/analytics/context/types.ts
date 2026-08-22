import type { MetricId } from "../../core/identity";
import type { Money } from "../../core/money";
import type { Provenance, SupportUnit } from "../../core/metrics";
import type {
  AnalysisScope,
  NormalizedAnalysisScope,
  ScopeHash,
} from "../../core/scope";
import type {
  AggregationCapability,
  AggregationCapabilityId,
  AnalyticFilterDimension,
} from "../aggregation";
import type { AnalyticFactSource, AnalyticGrain } from "../facts";

export type ContextDimension =
  | "category"
  | "activity"
  | "merchant"
  | "place"
  | "day_context"
  | "life_scope";

export type ContextMetric =
  | "amount"
  | "share"
  | "structure"
  | "frequency"
  | "causal_cost"
  | "cost_per_occurrence"
  | "purchase_count"
  | "net_amount"
  | "ticket"
  | "visit_count"
  | "distinct_visit_days"
  | "localized_spend"
  | "person_day_count"
  | "during_cost"
  | "typical_day_cost"
  | "incremental_cost";

export type ContextMetricId =
  | "category_amount"
  | "category_share"
  | "category_structure"
  | "activity_frequency"
  | "activity_causal_cost"
  | "activity_cost_per_occurrence"
  | "merchant_purchase_count"
  | "merchant_net_amount"
  | "merchant_ticket"
  | "place_visit_count"
  | "place_distinct_visit_days"
  | "place_localized_spend"
  | "day_context_person_day_count"
  | "context_causal_cost"
  | "context_during_cost"
  | "context_typical_day_cost"
  | "context_incremental_cost"
  | "life_scope_amount"
  | "life_scope_share"
  | "life_scope_structure";

export type ContextCapabilityId = ContextMetricId;

export type ContextDeferredReason =
  | "activity_component_mapping_missing"
  | "purchase_event_merchant_projection_missing"
  | "purchase_event_component_mapping_missing"
  | "person_day_context_projection_missing"
  | "contextual_economic_attribution_missing"
  | "contextual_economic_timing_projection_missing"
  | "typical_day_method_missing"
  | "context_reference_method_missing";

export type ContextCapabilityStatus =
  | { readonly kind: "available" }
  | {
      readonly kind: "deferred";
      readonly reason: ContextDeferredReason;
    };

export type ContextCapability = {
  readonly id: ContextCapabilityId;
  readonly metricId: MetricId;
  readonly dimension: ContextDimension;
  readonly metric: ContextMetric;
  readonly sourceFacts: readonly AnalyticFactSource[];
  readonly sourceGrains: readonly AnalyticGrain[];
  readonly allowedFilters: readonly AnalyticFilterDimension[];
  readonly supportUnit: SupportUnit;
  readonly status: ContextCapabilityStatus;
  readonly additivity:
    | "additive"
    | "non_additive"
    | "canonical_allocation_required";
};

export type ContextAnalysisPlan = ContextCapability & {
  readonly normalizedScope: NormalizedAnalysisScope;
  readonly scopeHash: ScopeHash;
};

export type ContextAnalysisPlanFactory = (
  scope: AnalysisScope,
  capabilityId: ContextCapabilityId,
) => ContextAnalysisPlan;

export type ContextHeatmapCapabilityId = Extract<
  AggregationCapabilityId,
  | "activity_month_frequency"
  | "activity_month_causal_cost"
  | "activity_month_median_cost_per_occurrence"
  | "activity_weekday_frequency"
  | "merchant_month_purchase_count"
  | "merchant_month_net"
  | "merchant_month_median_ticket"
  | "place_month_visits"
  | "place_month_localized_spend"
>;

export type ContextHeatmapCapability = AggregationCapability & {
  readonly id: ContextHeatmapCapabilityId;
};

export type ContextCostKind = "causal" | "during";

export type ContextCostSelection =
  | {
      readonly kind: "causal";
      readonly canonicalAttribution: "confirmed";
      readonly components: readonly unknown[];
    }
  | {
      readonly kind: "during";
      readonly temporalMembership: "confirmed";
      readonly components: readonly unknown[];
    };

export type ContextCostAggregate = {
  readonly kind: ContextCostKind;
  readonly metricId: MetricId;
  readonly value: Money;
  readonly provenance: Provenance;
  readonly overlappingContextsAdditivity: "non_additive";
};
