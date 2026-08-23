import { activeMetricIds } from "../../analytics/production";
import {
  queryResourceKeys,
  type QueryResourceName,
} from "../request";
import {
  queryFilterKeys,
  type QueryCapabilityMaximum,
  type QuerySectionKey,
} from "./types";

const querySectionKeyPattern = /^[a-z][a-z0-9_]*$/;

export const querySectionKeys = Object.freeze({
  methodology: "methodology" as QuerySectionKey<"methodology">,
  catalog: "catalog" as QuerySectionKey<"catalog">,
  calendar: "calendar" as QuerySectionKey<"calendar">,
  summary: "summary" as QuerySectionKey<"summary">,
  header: "header" as QuerySectionKey<"header">,
  finance: "finance" as QuerySectionKey<"finance">,
  contexts: "contexts" as QuerySectionKey<"contexts">,
  activities: "activities" as QuerySectionKey<"activities">,
  places: "places" as QuerySectionKey<"places">,
  merchants: "merchants" as QuerySectionKey<"merchants">,
  operations: "operations" as QuerySectionKey<"operations">,
  actual: "actual" as QuerySectionKey<"actual">,
  typical: "typical" as QuerySectionKey<"typical">,
  baseline: "baseline" as QuerySectionKey<"baseline">,
  habits: "habits" as QuerySectionKey<"habits">,
  profiles: "profiles" as QuerySectionKey<"profiles">,
  universe: "universe" as QuerySectionKey<"universe">,
  comparisons: "comparisons" as QuerySectionKey<"comparisons">,
  structure: "structure" as QuerySectionKey<"structure">,
  breakdown: "breakdown" as QuerySectionKey<"breakdown">,
  evolution: "evolution" as QuerySectionKey<"evolution">,
  marked_facts: "marked_facts" as QuerySectionKey<"marked_facts">,
  lived: "lived" as QuerySectionKey<"lived">,
  moments: "moments" as QuerySectionKey<"moments">,
  target: "target" as QuerySectionKey<"target">,
  identity: "identity" as QuerySectionKey<"identity">,
  spatial: "spatial" as QuerySectionKey<"spatial">,
  headline: "headline" as QuerySectionKey<"headline">,
  narrative: "narrative" as QuerySectionKey<"narrative">,
  participants: "participants" as QuerySectionKey<"participants">,
  timeline: "timeline" as QuerySectionKey<"timeline">,
  evidence: "evidence" as QuerySectionKey<"evidence">,
  classification: "classification" as QuerySectionKey<"classification">,
  links: "links" as QuerySectionKey<"links">,
  composition: "composition" as QuerySectionKey<"composition">,
  traceability: "traceability" as QuerySectionKey<"traceability">,
  gallery: "gallery" as QuerySectionKey<"gallery">,
});

export type QuerySectionName =
  | "methodology"
  | "catalog"
  | "calendar"
  | "summary"
  | "header"
  | "finance"
  | "contexts"
  | "activities"
  | "places"
  | "merchants"
  | "operations"
  | "actual"
  | "typical"
  | "baseline"
  | "habits"
  | "profiles"
  | "universe"
  | "comparisons"
  | "structure"
  | "breakdown"
  | "evolution"
  | "marked_facts"
  | "lived"
  | "moments"
  | "target"
  | "identity"
  | "spatial"
  | "headline"
  | "narrative"
  | "participants"
  | "timeline"
  | "evidence"
  | "classification"
  | "links"
  | "composition"
  | "traceability"
  | "gallery";

export function parseQuerySectionKey(
  value: unknown,
): QuerySectionKey<QuerySectionName> {
  if (typeof value !== "string" || !querySectionKeyPattern.test(value)) {
    throw new TypeError("QuerySectionKey doit être en lower_snake_case ASCII.");
  }
  const section = Object.values(querySectionKeys).find(
    (candidate) => candidate === value,
  );
  if (section === undefined) {
    throw new TypeError("QuerySectionKey absente du registre fermé.");
  }
  return section;
}

const allActiveMeasures = Object.freeze([...activeMetricIds]);
const allCoreFilters = Object.freeze([...queryFilterKeys]);
const momentFilters = Object.freeze(allCoreFilters.filter((filter) => filter !== "dayContext"));
const noFilters = Object.freeze([]);
const calendarMeasures = Object.freeze([
  "economic_consumption_net_attributable",
  "activity_frequency",
  "place_visit_count",
] as const);
const calendarSummaryMeasures = Object.freeze([
  ...calendarMeasures,
  "person_day_count",
] as const);
const monthInitialMeasures = Object.freeze([
  "economic_consumption_net_attributable",
  "typical_month_cost",
  "minimal_month_cost",
  "category_amount",
  "life_scope_amount",
] as const);
const breakdownMeasures = Object.freeze([
  "category_amount",
  "activity_frequency",
  "merchant_net_amount",
  "localized_spend",
  "place_visit_count",
  "distinct_visit_days",
  "life_scope_amount",
  "fixed_variable_amount",
] as const);
const evolutionMeasures = Object.freeze([
  "economic_consumption_net_attributable",
  "typical_month_cost",
  "localized_spend",
  "category_amount",
  "merchant_net_amount",
  "life_scope_amount",
  "purchase_count",
  "person_day_count",
  "place_visit_count",
  "distinct_visit_days",
  "activity_frequency",
] as const);
const contextMeasures = Object.freeze([
  "category_amount",
  "activity_frequency",
  "merchant_net_amount",
  "localized_spend",
  "life_scope_amount",
  "fixed_variable_amount",
  "place_visit_count",
  "activity_causal_cost",
  "activity_causal_median_cost_per_occurrence",
] as const);
const globalInitialMeasures = Object.freeze([
  "economic_consumption_net_attributable",
] as const);
const placeEntityMeasures = Object.freeze([
  "place_visit_count",
  "distinct_visit_days",
  "localized_spend",
  "fuel_trip_estimate",
] as const);
const merchantEntityMeasures = Object.freeze([
  "merchant_net_amount",
  "purchase_count",
] as const);
const personaEntityMeasures = Object.freeze([
  "economic_consumption_net_attributable",
  "typical_month_cost",
  "merchant_net_amount",
  "purchase_count",
  "place_visit_count",
  "activity_frequency",
] as const);
const galleryPlaceMeasures = Object.freeze([
  "place_visit_count",
  "localized_spend",
] as const);
const galleryMerchantMeasures = Object.freeze([
  "merchant_net_amount",
  "purchase_count",
] as const);

export const queryCapabilityRegistry = Object.freeze({
  metric_methodology: {
    resource: queryResourceKeys.metricMethodology,
    sections: Object.freeze([querySectionKeys.methodology]),
    measures: allActiveMeasures,
    filters: noFilters,
  },
  metric_catalog_preview: {
    resource: queryResourceKeys.metricCatalogPreview,
    sections: Object.freeze([querySectionKeys.catalog]),
    measures: allActiveMeasures,
    filters: noFilters,
  },
  metric_catalog_collection: {
    resource: queryResourceKeys.metricCatalogCollection,
    sections: Object.freeze([querySectionKeys.catalog]),
    measures: allActiveMeasures,
    filters: noFilters,
  },
  history_calendar_month: {
    resource: queryResourceKeys.historyCalendarMonth,
    sections: Object.freeze([
      querySectionKeys.calendar,
      querySectionKeys.summary,
    ]),
    measures: calendarMeasures,
    filters: noFilters,
  },
  history_calendar_month_summary: {
    resource: queryResourceKeys.historyCalendarMonthSummary,
    sections: Object.freeze([querySectionKeys.summary]),
    measures: calendarSummaryMeasures,
    filters: noFilters,
  },
  history_day_detail: {
    resource: queryResourceKeys.historyDayDetail,
    sections: Object.freeze([
      querySectionKeys.header,
      querySectionKeys.finance,
      querySectionKeys.contexts,
      querySectionKeys.activities,
      querySectionKeys.places,
      querySectionKeys.operations,
    ]),
    measures: calendarSummaryMeasures,
    filters: noFilters,
  },
  analysis_month_initial: {
    resource: queryResourceKeys.analysisMonthInitial,
    sections: Object.freeze([
      querySectionKeys.actual,
      querySectionKeys.typical,
      querySectionKeys.comparisons,
      querySectionKeys.marked_facts,
    ]),
    measures: Object.freeze(["economic_consumption_net_attributable", "typical_month_cost", "minimal_month_cost", "category_amount"]),
    filters: allCoreFilters,
  },
  analysis_month_breakdown: {
    resource: queryResourceKeys.analysisMonthBreakdown,
    sections: Object.freeze([querySectionKeys.breakdown]),
    measures: breakdownMeasures,
    filters: allCoreFilters,
  },
  analysis_month_evolution: {
    resource: queryResourceKeys.analysisMonthEvolution,
    sections: Object.freeze([querySectionKeys.evolution]),
    measures: Object.freeze(["economic_consumption_net_attributable", "typical_month_cost", "life_scope_amount"]),
    filters: allCoreFilters,
  },
  analysis_month_structure: {
    resource: queryResourceKeys.analysisMonthStructure,
    sections: Object.freeze([querySectionKeys.structure]),
    measures: breakdownMeasures,
    filters: allCoreFilters,
  },
  analysis_month_lived: {
    resource: queryResourceKeys.analysisMonthLived,
    sections: Object.freeze([querySectionKeys.lived, querySectionKeys.contexts, querySectionKeys.activities]),
    measures: contextMeasures,
    filters: allCoreFilters,
  },
  analysis_month_moments: {
    resource: queryResourceKeys.analysisMonthMoments,
    sections: Object.freeze([querySectionKeys.moments]),
    measures: noFilters,
    filters: momentFilters,
  },
  analysis_target: {
    resource: queryResourceKeys.analysisTarget,
    sections: Object.freeze([querySectionKeys.target, querySectionKeys.headline]),
    measures: Object.freeze(["category_amount", "activity_frequency", "life_scope_amount"]),
    filters: allCoreFilters,
  },
  analysis_month_contexts: {
    resource: queryResourceKeys.analysisMonthContexts,
    sections: Object.freeze([querySectionKeys.contexts]),
    measures: contextMeasures,
    filters: noFilters,
  },
  analysis_global_initial: {
    resource: queryResourceKeys.analysisGlobalInitial,
    sections: Object.freeze([querySectionKeys.summary]),
    measures: globalInitialMeasures,
    filters: allCoreFilters,
  },
  analysis_global_baseline: {
    resource: queryResourceKeys.analysisGlobalBaseline,
    sections: Object.freeze([querySectionKeys.baseline]),
    measures: Object.freeze(["minimal_month_cost"]),
    filters: allCoreFilters,
  },
  analysis_global_typical: {
    resource: queryResourceKeys.analysisGlobalTypical,
    sections: Object.freeze([querySectionKeys.typical, querySectionKeys.activities]),
    measures: Object.freeze(["typical_month_cost", "activity_frequency"]),
    filters: allCoreFilters,
  },
  analysis_global_breakdown: {
    resource: queryResourceKeys.analysisGlobalBreakdown,
    sections: Object.freeze([querySectionKeys.breakdown]),
    measures: breakdownMeasures,
    filters: allCoreFilters,
  },
  analysis_global_evolution: {
    resource: queryResourceKeys.analysisGlobalEvolution,
    sections: Object.freeze([querySectionKeys.evolution]),
    measures: evolutionMeasures,
    filters: allCoreFilters,
  },
  analysis_global_contexts: {
    resource: queryResourceKeys.analysisGlobalContexts,
    sections: Object.freeze([querySectionKeys.contexts]),
    measures: contextMeasures,
    filters: noFilters,
  },
  analysis_global_habits: {
    resource: queryResourceKeys.analysisGlobalHabits,
    sections: Object.freeze([querySectionKeys.habits, querySectionKeys.contexts]),
    measures: contextMeasures,
    filters: allCoreFilters,
  },
  analysis_global_profiles: {
    resource: queryResourceKeys.analysisGlobalProfiles,
    sections: Object.freeze([querySectionKeys.profiles]),
    measures: Object.freeze(["activity_frequency", "place_visit_count", "life_scope_amount"]),
    filters: allCoreFilters,
  },
  analysis_global_universe: {
    resource: queryResourceKeys.analysisGlobalUniverse,
    sections: Object.freeze([querySectionKeys.universe, querySectionKeys.moments, querySectionKeys.places, querySectionKeys.merchants]),
    measures: Object.freeze(["place_visit_count", "localized_spend", "merchant_net_amount"]),
    filters: allCoreFilters,
  },
  entity_place: {
    resource: queryResourceKeys.entityPlace,
    sections: Object.freeze([
      querySectionKeys.identity,
      querySectionKeys.spatial,
      querySectionKeys.headline,
      querySectionKeys.activities,
      querySectionKeys.merchants,
      querySectionKeys.places,
    ]),
    measures: placeEntityMeasures,
    filters: noFilters,
  },
  entity_merchant: {
    resource: queryResourceKeys.entityMerchant,
    sections: Object.freeze([
      querySectionKeys.identity,
      querySectionKeys.spatial,
      querySectionKeys.headline,
      querySectionKeys.evolution,
      querySectionKeys.places,
      querySectionKeys.operations,
    ]),
    measures: merchantEntityMeasures,
    filters: noFilters,
  },
  entity_moment: {
    resource: queryResourceKeys.entityMoment,
    sections: Object.freeze([
      querySectionKeys.identity,
      querySectionKeys.narrative,
      querySectionKeys.participants,
      querySectionKeys.timeline,
      querySectionKeys.headline,
      querySectionKeys.evidence,
    ]),
    measures: noFilters,
    filters: noFilters,
  },
  entity_persona: {
    resource: queryResourceKeys.entityPersona,
    sections: Object.freeze([
      querySectionKeys.identity,
      querySectionKeys.headline,
      querySectionKeys.typical,
      querySectionKeys.activities,
      querySectionKeys.places,
      querySectionKeys.merchants,
    ]),
    measures: personaEntityMeasures,
    filters: noFilters,
  },
  entity_life_event: {
    resource: queryResourceKeys.entityLifeEvent,
    sections: Object.freeze([
      querySectionKeys.identity,
      querySectionKeys.participants,
      querySectionKeys.places,
      querySectionKeys.timeline,
      querySectionKeys.headline,
    ]),
    measures: noFilters,
    filters: noFilters,
  },
  entity_operation: {
    resource: queryResourceKeys.entityOperation,
    sections: Object.freeze([
      querySectionKeys.identity,
      querySectionKeys.finance,
      querySectionKeys.classification,
      querySectionKeys.links,
      querySectionKeys.composition,
      querySectionKeys.traceability,
    ]),
    measures: noFilters,
    filters: noFilters,
  },
  gallery_moments: {
    resource: queryResourceKeys.galleryMoments,
    sections: Object.freeze([querySectionKeys.gallery]),
    measures: noFilters,
    filters: noFilters,
  },
  gallery_places: {
    resource: queryResourceKeys.galleryPlaces,
    sections: Object.freeze([querySectionKeys.gallery]),
    measures: galleryPlaceMeasures,
    filters: noFilters,
  },
  gallery_merchants: {
    resource: queryResourceKeys.galleryMerchants,
    sections: Object.freeze([querySectionKeys.gallery]),
    measures: galleryMerchantMeasures,
    filters: noFilters,
  },
  operations_browse: {
    resource: queryResourceKeys.operationsBrowse,
    sections: Object.freeze([
      querySectionKeys.operations,
      querySectionKeys.finance,
      querySectionKeys.classification,
      querySectionKeys.traceability,
    ]),
    measures: noFilters,
    filters: allCoreFilters,
  },
} as const satisfies Record<QueryResourceName, QueryCapabilityMaximum>);

export function getQueryCapabilityMaximum(
  resource: import("../request").QueryResourceKey,
): QueryCapabilityMaximum {
  if (!Object.prototype.hasOwnProperty.call(queryCapabilityRegistry, resource)) {
    throw new TypeError("Ressource absente du Capability Registry.");
  }
  return queryCapabilityRegistry[
    resource as keyof typeof queryCapabilityRegistry
  ];
}
