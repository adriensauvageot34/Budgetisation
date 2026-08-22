import { parseMetricId } from "../../core/identity";
import {
  computeScopeHash,
  normalizeAnalysisScope,
  type AnalysisScope,
} from "../../core/scope";
import {
  getAggregationCapability,
  type AnalyticFilterDimension,
} from "../aggregation";
import type {
  ContextAnalysisPlan,
  ContextCapability,
  ContextCapabilityId,
  ContextHeatmapCapability,
  ContextHeatmapCapabilityId,
} from "./types";

const economicFilters = [
  "category",
  "activity",
  "merchant",
  "place",
  "life_scope_context",
] as const;
const activityFilters = ["activity"] as const;
const merchantFilters = ["merchant"] as const;
const placeFilters = ["place"] as const;
const dayContextFilters = ["day_context"] as const;
const lifeScopeFilters = ["life_scope_context"] as const;

export const contextCapabilities = {
  category_amount: {
    id: "category_amount",
    metricId: parseMetricId("category_amount"),
    dimension: "category",
    metric: "amount",
    sourceFacts: ["fct_economic_component"],
    sourceGrains: ["canonical_economic_component"],
    allowedFilters: economicFilters,
    supportUnit: "transaction",
    status: { kind: "available" },
    additivity: "additive",
  },
  category_share: {
    id: "category_share",
    metricId: parseMetricId("category_share"),
    dimension: "category",
    metric: "share",
    sourceFacts: ["fct_economic_component"],
    sourceGrains: ["canonical_economic_component"],
    allowedFilters: economicFilters,
    supportUnit: "transaction",
    status: { kind: "available" },
    additivity: "non_additive",
  },
  category_structure: {
    id: "category_structure",
    metricId: parseMetricId("category_structure"),
    dimension: "category",
    metric: "structure",
    sourceFacts: ["fct_economic_component"],
    sourceGrains: ["canonical_economic_component"],
    allowedFilters: economicFilters,
    supportUnit: "transaction",
    status: { kind: "available" },
    additivity: "non_additive",
  },
  activity_frequency: {
    id: "activity_frequency",
    metricId: parseMetricId("activity_frequency"),
    dimension: "activity",
    metric: "frequency",
    sourceFacts: ["fct_activity_occurrence"],
    sourceGrains: ["activity_occurrence"],
    allowedFilters: activityFilters,
    supportUnit: "occurrence",
    status: { kind: "available" },
    additivity: "additive",
  },
  activity_causal_cost: {
    id: "activity_causal_cost",
    metricId: parseMetricId("activity_causal_cost"),
    dimension: "activity",
    metric: "causal_cost",
    sourceFacts: ["fct_economic_component", "fct_activity_occurrence"],
    sourceGrains: ["canonical_economic_component", "activity_occurrence"],
    allowedFilters: economicFilters,
    supportUnit: "occurrence",
    status: {
      kind: "deferred",
      reason: "activity_component_mapping_missing",
    },
    additivity: "canonical_allocation_required",
  },
  activity_cost_per_occurrence: {
    id: "activity_cost_per_occurrence",
    metricId: parseMetricId("activity_cost_per_occurrence"),
    dimension: "activity",
    metric: "cost_per_occurrence",
    sourceFacts: ["fct_economic_component", "fct_activity_occurrence"],
    sourceGrains: ["canonical_economic_component", "activity_occurrence"],
    allowedFilters: economicFilters,
    supportUnit: "occurrence",
    status: {
      kind: "deferred",
      reason: "activity_component_mapping_missing",
    },
    additivity: "non_additive",
  },
  merchant_purchase_count: {
    id: "merchant_purchase_count",
    metricId: parseMetricId("merchant_purchase_count"),
    dimension: "merchant",
    metric: "purchase_count",
    sourceFacts: ["fct_purchase_event"],
    sourceGrains: ["purchase_event"],
    allowedFilters: merchantFilters,
    supportUnit: "purchase_event",
    status: {
      kind: "deferred",
      reason: "purchase_event_merchant_projection_missing",
    },
    additivity: "additive",
  },
  merchant_net_amount: {
    id: "merchant_net_amount",
    metricId: parseMetricId("merchant_net_amount"),
    dimension: "merchant",
    metric: "net_amount",
    sourceFacts: ["fct_economic_component"],
    sourceGrains: ["canonical_economic_component"],
    allowedFilters: economicFilters,
    supportUnit: "transaction",
    status: { kind: "available" },
    additivity: "additive",
  },
  merchant_ticket: {
    id: "merchant_ticket",
    metricId: parseMetricId("merchant_ticket"),
    dimension: "merchant",
    metric: "ticket",
    sourceFacts: ["fct_purchase_event", "fct_economic_component"],
    sourceGrains: ["purchase_event", "canonical_economic_component"],
    allowedFilters: merchantFilters,
    supportUnit: "purchase_event",
    status: {
      kind: "deferred",
      reason: "purchase_event_component_mapping_missing",
    },
    additivity: "non_additive",
  },
  place_visit_count: {
    id: "place_visit_count",
    metricId: parseMetricId("place_visit_count"),
    dimension: "place",
    metric: "visit_count",
    sourceFacts: ["fct_place_visit"],
    sourceGrains: ["person_place_visit_interval"],
    allowedFilters: placeFilters,
    supportUnit: "place_visit",
    status: { kind: "available" },
    additivity: "additive",
  },
  place_distinct_visit_days: {
    id: "place_distinct_visit_days",
    metricId: parseMetricId("place_distinct_visit_days"),
    dimension: "place",
    metric: "distinct_visit_days",
    sourceFacts: ["fct_place_visit"],
    sourceGrains: ["person_place_visit_interval"],
    allowedFilters: placeFilters,
    supportUnit: "place_visit",
    status: { kind: "available" },
    additivity: "non_additive",
  },
  place_localized_spend: {
    id: "place_localized_spend",
    metricId: parseMetricId("place_localized_spend"),
    dimension: "place",
    metric: "localized_spend",
    sourceFacts: ["fct_economic_component"],
    sourceGrains: ["canonical_economic_component"],
    allowedFilters: economicFilters,
    supportUnit: "transaction",
    status: { kind: "available" },
    additivity: "canonical_allocation_required",
  },
  day_context_person_day_count: {
    id: "day_context_person_day_count",
    metricId: parseMetricId("day_context_person_day_count"),
    dimension: "day_context",
    metric: "person_day_count",
    sourceFacts: ["fct_person_day"],
    sourceGrains: ["person_local_date"],
    allowedFilters: dayContextFilters,
    supportUnit: "person_day",
    status: {
      kind: "deferred",
      reason: "person_day_context_projection_missing",
    },
    additivity: "additive",
  },
  context_causal_cost: {
    id: "context_causal_cost",
    metricId: parseMetricId("context_causal_cost"),
    dimension: "day_context",
    metric: "causal_cost",
    sourceFacts: ["fct_person_day", "fct_economic_component"],
    sourceGrains: ["person_local_date", "canonical_economic_component"],
    allowedFilters: dayContextFilters,
    supportUnit: "person_day",
    status: {
      kind: "deferred",
      reason: "contextual_economic_attribution_missing",
    },
    additivity: "canonical_allocation_required",
  },
  context_during_cost: {
    id: "context_during_cost",
    metricId: parseMetricId("context_during_cost"),
    dimension: "day_context",
    metric: "during_cost",
    sourceFacts: ["fct_person_day", "fct_economic_component"],
    sourceGrains: ["person_local_date", "canonical_economic_component"],
    allowedFilters: dayContextFilters,
    supportUnit: "person_day",
    status: {
      kind: "deferred",
      reason: "contextual_economic_timing_projection_missing",
    },
    additivity: "non_additive",
  },
  context_typical_day_cost: {
    id: "context_typical_day_cost",
    metricId: parseMetricId("context_typical_day_cost"),
    dimension: "day_context",
    metric: "typical_day_cost",
    sourceFacts: ["fct_person_day", "fct_economic_component"],
    sourceGrains: ["person_local_date", "canonical_economic_component"],
    allowedFilters: dayContextFilters,
    supportUnit: "person_day",
    status: { kind: "deferred", reason: "typical_day_method_missing" },
    additivity: "non_additive",
  },
  context_incremental_cost: {
    id: "context_incremental_cost",
    metricId: parseMetricId("context_incremental_cost"),
    dimension: "day_context",
    metric: "incremental_cost",
    sourceFacts: ["fct_person_day", "fct_economic_component"],
    sourceGrains: ["person_local_date", "canonical_economic_component"],
    allowedFilters: dayContextFilters,
    supportUnit: "person_day",
    status: {
      kind: "deferred",
      reason: "context_reference_method_missing",
    },
    additivity: "non_additive",
  },
  life_scope_amount: {
    id: "life_scope_amount",
    metricId: parseMetricId("life_scope_amount"),
    dimension: "life_scope",
    metric: "amount",
    sourceFacts: ["fct_economic_component"],
    sourceGrains: ["canonical_economic_component"],
    allowedFilters: lifeScopeFilters,
    supportUnit: "transaction",
    status: { kind: "available" },
    additivity: "additive",
  },
  life_scope_share: {
    id: "life_scope_share",
    metricId: parseMetricId("life_scope_share"),
    dimension: "life_scope",
    metric: "share",
    sourceFacts: ["fct_economic_component"],
    sourceGrains: ["canonical_economic_component"],
    allowedFilters: lifeScopeFilters,
    supportUnit: "transaction",
    status: { kind: "available" },
    additivity: "non_additive",
  },
  life_scope_structure: {
    id: "life_scope_structure",
    metricId: parseMetricId("life_scope_structure"),
    dimension: "life_scope",
    metric: "structure",
    sourceFacts: ["fct_economic_component"],
    sourceGrains: ["canonical_economic_component"],
    allowedFilters: lifeScopeFilters,
    supportUnit: "transaction",
    status: { kind: "available" },
    additivity: "non_additive",
  },
} as const satisfies Record<ContextCapabilityId, ContextCapability>;

export function isContextCapabilityId(
  value: unknown,
): value is ContextCapabilityId {
  return (
    typeof value === "string" &&
    Object.prototype.hasOwnProperty.call(contextCapabilities, value)
  );
}

export function getContextCapability(value: unknown): ContextCapability {
  if (!isContextCapabilityId(value)) {
    throw new TypeError("La combinaison contexte/métrique n'est pas autorisée.");
  }
  return contextCapabilities[value];
}

export function createContextAnalysisPlan(
  scope: AnalysisScope,
  capabilityId: ContextCapabilityId,
): ContextAnalysisPlan {
  const capability = getContextCapability(capabilityId);
  const normalizedScope = normalizeAnalysisScope(scope);
  const filters = [
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
  for (const [property, dimension] of filters) {
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
    scopeHash: computeScopeHash(normalizedScope),
  };
}

const contextHeatmapCapabilityIds: ReadonlySet<string> = new Set<
  ContextHeatmapCapabilityId
>([
  "activity_month_frequency",
  "activity_month_causal_cost",
  "activity_month_median_cost_per_occurrence",
  "activity_weekday_frequency",
  "merchant_month_purchase_count",
  "merchant_month_net",
  "merchant_month_median_ticket",
  "place_month_visits",
  "place_month_localized_spend",
]);

export function isContextHeatmapCapabilityId(
  value: unknown,
): value is ContextHeatmapCapabilityId {
  return typeof value === "string" && contextHeatmapCapabilityIds.has(value);
}

export function getContextHeatmapCapability(
  value: unknown,
): ContextHeatmapCapability {
  if (!isContextHeatmapCapabilityId(value)) {
    throw new TypeError("La heatmap demandée n'est pas whitelistée.");
  }
  return getAggregationCapability(value) as ContextHeatmapCapability;
}
