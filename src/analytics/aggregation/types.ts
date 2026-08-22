import type { Availability } from "../../core/metrics";
import type {
  AnalysisScope,
  NormalizedAnalysisScope,
} from "../../core/scope";
import type { AnalyticFactSource, AnalyticGrain } from "../facts";

export type AnalyticDimension =
  | "month"
  | "weekday"
  | "subject"
  | "category"
  | "activity"
  | "merchant"
  | "place";

export type AnalyticFilterDimension =
  | "category"
  | "activity"
  | "merchant"
  | "place"
  | "life_scope_context"
  | "day_context";

export type AnalyticDateBasis =
  | "economic_timing"
  | "bank_date"
  | "activity_occurrence_date"
  | "person_local_date"
  | "purchase_event_date"
  | "place_visit_interval"
  | "observation_window";

export type AnalyticDedupeRule =
  | "canonical_component_key"
  | "activity_occurrence_key"
  | "person_local_date"
  | "purchase_event_key"
  | "place_visit_key";

export type AdditivityPolicy =
  | { readonly kind: "additive" }
  | {
      readonly kind: "conditionally_additive";
      readonly condition:
        | "canonical_component_allocation"
        | "canonical_person_allocation"
        | "operation_place_canonical";
    }
  | {
      readonly kind: "non_additive";
      readonly recomputeOnTargetGroup: true;
    };

export type AggregationMethod =
  | "sum_net"
  | "count_source_grain"
  | "count_distinct_visit_days"
  | "median_causal_cost_per_occurrence"
  | "median_ticket";

export type AggregationMeasure =
  | "economic_net"
  | "activity_frequency"
  | "activity_causal_cost"
  | "median_activity_cost_per_occurrence"
  | "purchase_count"
  | "merchant_net"
  | "median_ticket"
  | "place_visit_count"
  | "distinct_visit_days"
  | "localized_spend";

export type AggregationCapabilityId =
  | "economic_net_total"
  | "economic_net_by_category"
  | "activity_month_frequency"
  | "activity_month_causal_cost"
  | "activity_month_median_cost_per_occurrence"
  | "activity_weekday_frequency"
  | "merchant_month_purchase_count"
  | "merchant_month_net"
  | "merchant_month_median_ticket"
  | "place_month_visits"
  | "place_month_distinct_visit_days"
  | "place_month_localized_spend";

export type CanonicalPrerequisite =
  | "activity_occurrence_component_mapping"
  | "purchase_event_component_mapping"
  | "operation_place_canonical";

export type AggregationCapability = {
  readonly id: AggregationCapabilityId;
  readonly sourceFact: AnalyticFactSource;
  readonly sourceGrain: AnalyticGrain;
  readonly dateBasis: AnalyticDateBasis;
  readonly dedupeRule: AnalyticDedupeRule;
  readonly allowedDimensions: readonly AnalyticDimension[];
  readonly allowedFilters: readonly AnalyticFilterDimension[];
  readonly measure: AggregationMeasure;
  readonly method: AggregationMethod;
  readonly additivity: AdditivityPolicy;
  readonly canonicalPrerequisites: readonly CanonicalPrerequisite[];
};

export type AggregationPlan = AggregationCapability & {
  readonly normalizedScope: NormalizedAnalysisScope;
  readonly groupBy: readonly AnalyticDimension[];
  readonly personRollup: "canonical_allocation_required";
};

export type AggregationValue<Value> =
  | { readonly availability: "known"; readonly value: Value }
  | { readonly availability: Exclude<Availability, "known"> };

export type AggregationPlanFactory = (
  scope: AnalysisScope,
  capabilityId: AggregationCapabilityId,
) => AggregationPlan;
