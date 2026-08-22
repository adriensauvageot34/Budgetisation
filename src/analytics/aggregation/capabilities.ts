import { normalizeAnalysisScope, type AnalysisScope } from "../../core/scope";
import type {
  AdditivityPolicy,
  AggregationCapability,
  AggregationCapabilityId,
  AggregationPlan,
  AggregationValue,
  AnalyticFilterDimension,
} from "./types";

const economicFilters = [
  "category",
  "activity",
  "merchant",
  "place",
] as const;

const activityFilters = ["activity"] as const;
const purchaseFilters = ["merchant"] as const;
const placeVisitFilters = ["place"] as const;

export const aggregationCapabilities = {
  economic_net_total: {
    id: "economic_net_total",
    sourceFact: "fct_economic_component",
    sourceGrain: "canonical_economic_component",
    dateBasis: "economic_timing",
    dedupeRule: "canonical_component_key",
    allowedDimensions: [],
    allowedFilters: economicFilters,
    measure: "economic_net",
    method: "sum_net",
    additivity: { kind: "additive" },
    canonicalPrerequisites: [],
  },
  economic_net_by_category: {
    id: "economic_net_by_category",
    sourceFact: "fct_economic_component",
    sourceGrain: "canonical_economic_component",
    dateBasis: "economic_timing",
    dedupeRule: "canonical_component_key",
    allowedDimensions: ["category"],
    allowedFilters: economicFilters,
    measure: "economic_net",
    method: "sum_net",
    additivity: { kind: "additive" },
    canonicalPrerequisites: [],
  },
  activity_month_frequency: {
    id: "activity_month_frequency",
    sourceFact: "fct_activity_occurrence",
    sourceGrain: "activity_occurrence",
    dateBasis: "activity_occurrence_date",
    dedupeRule: "activity_occurrence_key",
    allowedDimensions: ["activity", "month"],
    allowedFilters: activityFilters,
    measure: "activity_frequency",
    method: "count_source_grain",
    additivity: { kind: "additive" },
    canonicalPrerequisites: [],
  },
  activity_month_causal_cost: {
    id: "activity_month_causal_cost",
    sourceFact: "fct_economic_component",
    sourceGrain: "canonical_economic_component",
    dateBasis: "economic_timing",
    dedupeRule: "canonical_component_key",
    allowedDimensions: ["activity", "month"],
    allowedFilters: economicFilters,
    measure: "activity_causal_cost",
    method: "sum_net",
    additivity: {
      kind: "conditionally_additive",
      condition: "canonical_component_allocation",
    },
    canonicalPrerequisites: ["activity_occurrence_component_mapping"],
  },
  activity_month_median_cost_per_occurrence: {
    id: "activity_month_median_cost_per_occurrence",
    sourceFact: "fct_activity_occurrence",
    sourceGrain: "activity_occurrence",
    dateBasis: "activity_occurrence_date",
    dedupeRule: "activity_occurrence_key",
    allowedDimensions: ["activity", "month"],
    allowedFilters: activityFilters,
    measure: "median_activity_cost_per_occurrence",
    method: "median_causal_cost_per_occurrence",
    additivity: {
      kind: "non_additive",
      recomputeOnTargetGroup: true,
    },
    canonicalPrerequisites: ["activity_occurrence_component_mapping"],
  },
  activity_weekday_frequency: {
    id: "activity_weekday_frequency",
    sourceFact: "fct_activity_occurrence",
    sourceGrain: "activity_occurrence",
    dateBasis: "activity_occurrence_date",
    dedupeRule: "activity_occurrence_key",
    allowedDimensions: ["activity", "weekday"],
    allowedFilters: activityFilters,
    measure: "activity_frequency",
    method: "count_source_grain",
    additivity: { kind: "additive" },
    canonicalPrerequisites: [],
  },
  merchant_month_purchase_count: {
    id: "merchant_month_purchase_count",
    sourceFact: "fct_purchase_event",
    sourceGrain: "purchase_event",
    dateBasis: "purchase_event_date",
    dedupeRule: "purchase_event_key",
    allowedDimensions: ["merchant", "month"],
    allowedFilters: purchaseFilters,
    measure: "purchase_count",
    method: "count_source_grain",
    additivity: { kind: "additive" },
    canonicalPrerequisites: [],
  },
  merchant_month_net: {
    id: "merchant_month_net",
    sourceFact: "fct_economic_component",
    sourceGrain: "canonical_economic_component",
    dateBasis: "economic_timing",
    dedupeRule: "canonical_component_key",
    allowedDimensions: ["merchant", "month"],
    allowedFilters: economicFilters,
    measure: "merchant_net",
    method: "sum_net",
    additivity: { kind: "additive" },
    canonicalPrerequisites: [],
  },
  merchant_month_median_ticket: {
    id: "merchant_month_median_ticket",
    sourceFact: "fct_purchase_event",
    sourceGrain: "purchase_event",
    dateBasis: "purchase_event_date",
    dedupeRule: "purchase_event_key",
    allowedDimensions: ["merchant", "month"],
    allowedFilters: purchaseFilters,
    measure: "median_ticket",
    method: "median_ticket",
    additivity: {
      kind: "non_additive",
      recomputeOnTargetGroup: true,
    },
    canonicalPrerequisites: ["purchase_event_component_mapping"],
  },
  place_month_visits: {
    id: "place_month_visits",
    sourceFact: "fct_place_visit",
    sourceGrain: "person_place_visit_interval",
    dateBasis: "place_visit_interval",
    dedupeRule: "place_visit_key",
    allowedDimensions: ["place", "month"],
    allowedFilters: placeVisitFilters,
    measure: "place_visit_count",
    method: "count_source_grain",
    additivity: { kind: "additive" },
    canonicalPrerequisites: [],
  },
  place_month_distinct_visit_days: {
    id: "place_month_distinct_visit_days",
    sourceFact: "fct_place_visit",
    sourceGrain: "person_place_visit_interval",
    dateBasis: "place_visit_interval",
    dedupeRule: "place_visit_key",
    allowedDimensions: ["place", "month"],
    allowedFilters: placeVisitFilters,
    measure: "distinct_visit_days",
    method: "count_distinct_visit_days",
    additivity: {
      kind: "non_additive",
      recomputeOnTargetGroup: true,
    },
    canonicalPrerequisites: [],
  },
  place_month_localized_spend: {
    id: "place_month_localized_spend",
    sourceFact: "fct_economic_component",
    sourceGrain: "canonical_economic_component",
    dateBasis: "economic_timing",
    dedupeRule: "canonical_component_key",
    allowedDimensions: ["place", "month"],
    allowedFilters: economicFilters,
    measure: "localized_spend",
    method: "sum_net",
    additivity: {
      kind: "conditionally_additive",
      condition: "operation_place_canonical",
    },
    canonicalPrerequisites: ["operation_place_canonical"],
  },
} as const satisfies Record<AggregationCapabilityId, AggregationCapability>;

export function isAggregationCapabilityId(
  value: unknown,
): value is AggregationCapabilityId {
  return (
    typeof value === "string" &&
    Object.prototype.hasOwnProperty.call(aggregationCapabilities, value)
  );
}

export function getAggregationCapability(
  value: unknown,
): AggregationCapability {
  if (!isAggregationCapabilityId(value)) {
    throw new TypeError("La combinaison dimensions/mesure n'est pas autorisée.");
  }
  return aggregationCapabilities[value];
}

export function createAggregationPlan(
  scope: AnalysisScope,
  capabilityId: AggregationCapabilityId,
): AggregationPlan {
  const capability = getAggregationCapability(capabilityId);
  const normalizedScope = normalizeAnalysisScope(scope);
  const scopeFilters = [
    ["categoryIds", "category"],
    ["activityIds", "activity"],
    ["merchantIds", "merchant"],
    ["placeIds", "place"],
    ["lifeScopeContext", "life_scope_context"],
    ["dayContext", "day_context"],
  ] as const satisfies readonly (readonly [
    keyof typeof normalizedScope.filters,
    AnalyticFilterDimension,
  ])[];
  for (const [property, dimension] of scopeFilters) {
    if (
      normalizedScope.filters[property].length > 0 &&
      !capability.allowedFilters.includes(dimension)
    ) {
      throw new TypeError(
        `Le filtre ${dimension} n'est pas compatible avec ${capability.id}.`,
      );
    }
  }
  return {
    ...capability,
    normalizedScope,
    groupBy: capability.allowedDimensions,
    personRollup: "canonical_allocation_required",
  };
}

export function canRollUpAggregation(
  policy: AdditivityPolicy,
  canonicalConditionSatisfied = false,
): boolean {
  switch (policy.kind) {
    case "additive":
      return true;
    case "conditionally_additive":
      return canonicalConditionSatisfied;
    case "non_additive":
      return false;
  }
}

export function canRollPersonGroupsToHousehold(
  hasCanonicalPersonAllocation: boolean,
): boolean {
  return hasCanonicalPersonAllocation;
}

export const aggregationValue = {
  known<Value>(value: Value): AggregationValue<Value> {
    return { availability: "known", value };
  },
  unknown(): AggregationValue<never> {
    return { availability: "unknown" };
  },
  notApplicable(): AggregationValue<never> {
    return { availability: "not_applicable" };
  },
  conflict(): AggregationValue<never> {
    return { availability: "conflict" };
  },
};
