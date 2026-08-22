import { parseMetricId } from "../../core/identity";
import { parseMethodVersion } from "../../core/versions";
import { TYPICAL_MONTH_METHOD_VERSION } from "../references";
import { FUEL_TRIP_ESTIMATE_METHOD_VERSION } from "../provenance";
import type {
  ActiveMetricId,
  MetricRegistryEntry,
} from "./types";

export const metricMethodVersions = {
  economic_consumption_net_attributable: parseMethodVersion(
    "economic_consumption_net_attributable@v1",
  ),
  typical_month_cost: TYPICAL_MONTH_METHOD_VERSION,
  localized_spend: parseMethodVersion("localized_spend@v1"),
  category_amount: parseMethodVersion("category_amount@v1"),
  merchant_net_amount: parseMethodVersion("merchant_net_amount@v1"),
  life_scope_amount: parseMethodVersion("life_scope_amount@v1"),
  purchase_count: parseMethodVersion("purchase_count@v1"),
  person_day_count: parseMethodVersion("person_day_count@v1"),
  place_visit_count: parseMethodVersion("place_visit_count@v1"),
  distinct_visit_days: parseMethodVersion("distinct_visit_days@v1"),
  activity_frequency: parseMethodVersion("activity_frequency@v1"),
  fuel_trip_estimate: FUEL_TRIP_ESTIMATE_METHOD_VERSION,
} as const satisfies Record<ActiveMetricId, import("../../core/versions").MethodVersion>;

export const metricRegistry = {
  economic_consumption_net_attributable: {
    metricId: parseMetricId("economic_consumption_net_attributable"),
    semanticName: "Consommation économique nette attribuable",
    grain: ["canonical_economic_component"],
    sourceFact: ["fct_economic_component"],
    productionStrategy: "sum_economic_net",
    dateBasis: "economic_timing",
    dimensions: [],
    allowedFilters: ["category", "activity", "merchant", "place"],
    monetaryBasis: "economic_net",
    supportPolicy: { kind: "source_provided", unit: "transaction" },
    availabilityRules: ["source_availability"],
    additivity: { kind: "additive" },
    provenanceRule: "observed",
    comparisonCapabilities: [
      "same_metric",
      "actual_vs_typical_month",
      "actual_vs_adjusted_minimal",
    ],
    methodVersion:
      metricMethodVersions.economic_consumption_net_attributable,
    unit: "EUR/month",
    outputKind: "money",
    allowedTimeKinds: ["month"],
    aggregationCapabilityId: "economic_net_total",
  },
  typical_month_cost: {
    metricId: parseMetricId("typical_month_cost"),
    semanticName: "Coût du mois typique",
    grain: ["reference_month"],
    sourceFact: ["fct_economic_component"],
    productionStrategy: "typical_month",
    dateBasis: "observation_window",
    dimensions: ["month"],
    allowedFilters: [],
    monetaryBasis: "economic_net",
    referenceMethod: "comparison_reference",
    referenceWindow: { requestedPeriods: 12 },
    supportPolicy: { kind: "typical_month", unit: "month" },
    availabilityRules: ["method_defined"],
    additivity: { kind: "non_additive", recomputeOnTargetGroup: true },
    provenanceRule: "derived",
    comparisonCapabilities: [
      "actual_vs_typical_month",
      "typical_vs_minimal",
    ],
    methodVersion: metricMethodVersions.typical_month_cost,
    unit: "EUR/month",
    outputKind: "money",
    allowedTimeKinds: ["month"],
  },
  localized_spend: {
    metricId: parseMetricId("localized_spend"),
    semanticName: "Dépense nette localisée",
    grain: ["canonical_economic_component"],
    sourceFact: ["fct_economic_component"],
    productionStrategy: "localized_spend",
    dateBasis: "economic_timing",
    dimensions: ["place"],
    allowedFilters: ["category", "activity", "merchant", "place"],
    monetaryBasis: "economic_net",
    supportPolicy: { kind: "source_provided", unit: "transaction" },
    availabilityRules: ["source_availability", "required_place_filter"],
    additivity: {
      kind: "conditionally_additive",
      condition: "operation_place_canonical",
    },
    provenanceRule: "observed",
    comparisonCapabilities: ["same_metric"],
    methodVersion: metricMethodVersions.localized_spend,
    unit: "EUR",
    outputKind: "money",
    allowedTimeKinds: ["month", "global"],
    aggregationCapabilityId: "place_month_localized_spend",
    contextCapabilityId: "place_localized_spend",
  },
  category_amount: {
    metricId: parseMetricId("category_amount"),
    semanticName: "Montant net par catégorie sélectionnée",
    grain: ["canonical_economic_component"],
    sourceFact: ["fct_economic_component"],
    productionStrategy: "sum_economic_net",
    dateBasis: "economic_timing",
    dimensions: ["category"],
    allowedFilters: ["category", "activity", "merchant", "place"],
    monetaryBasis: "economic_net",
    supportPolicy: { kind: "source_provided", unit: "transaction" },
    availabilityRules: ["source_availability", "required_category_filter"],
    additivity: { kind: "additive" },
    provenanceRule: "observed",
    comparisonCapabilities: ["same_metric"],
    methodVersion: metricMethodVersions.category_amount,
    unit: "EUR",
    outputKind: "money",
    allowedTimeKinds: ["month", "global"],
    aggregationCapabilityId: "economic_net_by_category",
    contextCapabilityId: "category_amount",
  },
  merchant_net_amount: {
    metricId: parseMetricId("merchant_net_amount"),
    semanticName: "Montant net du marchand sélectionné",
    grain: ["canonical_economic_component"],
    sourceFact: ["fct_economic_component"],
    productionStrategy: "sum_economic_net",
    dateBasis: "economic_timing",
    dimensions: ["merchant"],
    allowedFilters: ["category", "activity", "merchant", "place"],
    monetaryBasis: "economic_net",
    supportPolicy: { kind: "source_provided", unit: "transaction" },
    availabilityRules: ["source_availability", "required_merchant_filter"],
    additivity: { kind: "additive" },
    provenanceRule: "observed",
    comparisonCapabilities: ["same_metric"],
    methodVersion: metricMethodVersions.merchant_net_amount,
    unit: "EUR",
    outputKind: "money",
    allowedTimeKinds: ["month", "global"],
    aggregationCapabilityId: "merchant_month_net",
    contextCapabilityId: "merchant_net_amount",
  },
  life_scope_amount: {
    metricId: parseMetricId("life_scope_amount"),
    semanticName: "Montant net du contexte de vie sélectionné",
    grain: ["canonical_economic_component"],
    sourceFact: ["fct_economic_component"],
    productionStrategy: "sum_economic_net",
    dateBasis: "economic_timing",
    dimensions: [],
    allowedFilters: ["life_scope_context"],
    monetaryBasis: "economic_net",
    supportPolicy: { kind: "source_provided", unit: "transaction" },
    availabilityRules: ["source_availability", "required_life_scope_filter"],
    additivity: { kind: "additive" },
    provenanceRule: "observed",
    comparisonCapabilities: ["same_metric"],
    methodVersion: metricMethodVersions.life_scope_amount,
    unit: "EUR",
    outputKind: "money",
    allowedTimeKinds: ["month", "global"],
    contextCapabilityId: "life_scope_amount",
  },
  purchase_count: {
    metricId: parseMetricId("purchase_count"),
    semanticName: "Nombre d’actes d’achat",
    grain: ["purchase_event"],
    sourceFact: ["fct_purchase_event"],
    productionStrategy: "count_purchase_events",
    dateBasis: "purchase_event_date",
    dimensions: [],
    allowedFilters: [],
    supportPolicy: { kind: "source_provided", unit: "purchase_event" },
    availabilityRules: ["source_availability"],
    additivity: { kind: "additive" },
    provenanceRule: "observed",
    comparisonCapabilities: ["same_metric"],
    methodVersion: metricMethodVersions.purchase_count,
    unit: "count",
    outputKind: "count",
    allowedTimeKinds: ["month", "global"],
  },
  person_day_count: {
    metricId: parseMetricId("person_day_count"),
    semanticName: "Nombre de jours-personnes observés",
    grain: ["person_local_date"],
    sourceFact: ["fct_person_day"],
    productionStrategy: "count_person_days",
    dateBasis: "person_local_date",
    dimensions: ["subject"],
    allowedFilters: [],
    supportPolicy: { kind: "source_provided", unit: "person_day" },
    availabilityRules: ["source_availability"],
    additivity: { kind: "additive" },
    provenanceRule: "observed",
    comparisonCapabilities: ["same_metric"],
    methodVersion: metricMethodVersions.person_day_count,
    unit: "count",
    outputKind: "count",
    allowedTimeKinds: ["month", "global"],
  },
  place_visit_count: {
    metricId: parseMetricId("place_visit_count"),
    semanticName: "Nombre de visites de lieu",
    grain: ["person_place_visit_interval"],
    sourceFact: ["fct_place_visit"],
    productionStrategy: "count_place_visits",
    dateBasis: "place_visit_interval",
    dimensions: ["place"],
    allowedFilters: ["place"],
    supportPolicy: { kind: "source_provided", unit: "place_visit" },
    availabilityRules: ["source_availability"],
    additivity: { kind: "additive" },
    provenanceRule: "observed",
    comparisonCapabilities: ["same_metric"],
    methodVersion: metricMethodVersions.place_visit_count,
    unit: "count",
    outputKind: "count",
    allowedTimeKinds: ["month", "global"],
    aggregationCapabilityId: "place_month_visits",
    contextCapabilityId: "place_visit_count",
  },
  distinct_visit_days: {
    metricId: parseMetricId("distinct_visit_days"),
    semanticName: "Nombre de jours distincts visités",
    grain: ["person_place_visit_interval"],
    sourceFact: ["fct_place_visit"],
    productionStrategy: "count_distinct_visit_days",
    dateBasis: "place_visit_interval",
    dimensions: ["place"],
    allowedFilters: ["place"],
    supportPolicy: { kind: "source_provided", unit: "place_visit" },
    availabilityRules: ["source_availability"],
    additivity: { kind: "non_additive", recomputeOnTargetGroup: true },
    provenanceRule: "observed",
    comparisonCapabilities: ["same_metric"],
    methodVersion: metricMethodVersions.distinct_visit_days,
    unit: "count",
    outputKind: "count",
    allowedTimeKinds: ["month", "global"],
    aggregationCapabilityId: "place_month_distinct_visit_days",
    contextCapabilityId: "place_distinct_visit_days",
  },
  activity_frequency: {
    metricId: parseMetricId("activity_frequency"),
    semanticName: "Fréquence d’activité mensuelle",
    grain: ["activity_occurrence"],
    sourceFact: ["fct_activity_occurrence"],
    productionStrategy: "count_activity_occurrences",
    dateBasis: "activity_occurrence_date",
    dimensions: ["activity", "month"],
    allowedFilters: ["activity"],
    supportPolicy: { kind: "source_provided", unit: "occurrence" },
    availabilityRules: ["source_availability"],
    additivity: { kind: "additive" },
    provenanceRule: "observed",
    comparisonCapabilities: [
      "same_metric",
      "activity_frequency_vs_habitual",
    ],
    methodVersion: metricMethodVersions.activity_frequency,
    unit: "count/month",
    outputKind: "count",
    allowedTimeKinds: ["month"],
    aggregationCapabilityId: "activity_month_frequency",
    contextCapabilityId: "activity_frequency",
  },
  fuel_trip_estimate: {
    metricId: parseMetricId("fuel_trip_estimate"),
    semanticName: "Estimation du carburant d’un trajet",
    grain: ["estimation_input"],
    sourceFact: [],
    productionStrategy: "fuel_trip_estimate",
    dateBasis: "observation_window",
    dimensions: [],
    allowedFilters: [],
    monetaryBasis: "estimated_cost",
    supportPolicy: { kind: "optional", unit: "transaction" },
    availabilityRules: ["method_defined"],
    additivity: { kind: "non_additive", recomputeOnTargetGroup: true },
    provenanceRule: "estimated",
    comparisonCapabilities: ["same_metric"],
    methodVersion: metricMethodVersions.fuel_trip_estimate,
    unit: "EUR",
    outputKind: "money",
    allowedTimeKinds: ["month"],
  },
} as const satisfies Record<ActiveMetricId, MetricRegistryEntry>;

export const activeMetricIds = Object.freeze(
  Object.keys(metricRegistry) as ActiveMetricId[],
);

export function isActiveMetricId(value: unknown): value is ActiveMetricId {
  return (
    typeof value === "string" &&
    Object.prototype.hasOwnProperty.call(metricRegistry, value)
  );
}

export function getMetricRegistryEntry(value: unknown): MetricRegistryEntry {
  if (!isActiveMetricId(value)) {
    throw new TypeError("MetricId absent du Metric Registry actif.");
  }
  return metricRegistry[value];
}

const implementedProductionStrategies: ReadonlySet<string> = new Set([
  "sum_economic_net",
  "typical_month",
  "localized_spend",
  "count_purchase_events",
  "count_person_days",
  "count_place_visits",
  "count_distinct_visit_days",
  "count_activity_occurrences",
  "fuel_trip_estimate",
]);

export function findOrphanActiveMetricIds(): readonly ActiveMetricId[] {
  return activeMetricIds.filter(
    (metricId) =>
      !implementedProductionStrategies.has(
        metricRegistry[metricId].productionStrategy,
      ),
  );
}

export type MethodSemanticChange =
  | "formula"
  | "statistic"
  | "admissibility"
  | "exclusion"
  | "reference_window"
  | "support_threshold"
  | "attribution"
  | "composite_provenance"
  | "comparison_rule"
  | "result_tie_break"
  | "published_semantics";

export type MethodTechnicalChange =
  | "sql_index"
  | "query_optimization"
  | "internal_refactor"
  | "file_move"
  | "cache"
  | "result_preserving_rename";

export function requiresMethodVersionBump(
  change: MethodSemanticChange | MethodTechnicalChange,
): change is MethodSemanticChange {
  return new Set<string>([
    "formula",
    "statistic",
    "admissibility",
    "exclusion",
    "reference_window",
    "support_threshold",
    "attribution",
    "composite_provenance",
    "comparison_rule",
    "result_tie_break",
    "published_semantics",
  ]).has(change);
}
