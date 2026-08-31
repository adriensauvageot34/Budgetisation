import {
  HISTORY_V2_CONTRACT_VERSION,
  LEGACY_CONTRACT_VERSION,
} from "../../core/api";
import {
  historyV2PolicyIds,
  type HistoryV2PolicyId,
} from "../../core/history-v2";
import type { ContractVersion } from "../../core/versions";
import type { QueryResourceKey } from "./resource-key";
import {
  isQueryResourceName,
  type QueryResourceName,
} from "./resource-registry";

export type LegacyV1ResourceContract = {
  readonly contractVersion: ContractVersion;
  readonly family: "legacy_v1";
};

export type HistoryV2ResourceContract = {
  readonly contractVersion: ContractVersion;
  readonly family: "history_v2";
  readonly policyIds: readonly HistoryV2PolicyId[];
  readonly metricIds: readonly string[];
};

export type QueryResourceContract =
  | LegacyV1ResourceContract
  | HistoryV2ResourceContract;

const legacyV1ResourceContract = Object.freeze({
  contractVersion: LEGACY_CONTRACT_VERSION,
  family: "legacy_v1",
} satisfies LegacyV1ResourceContract);

function sortedUniqueNonEmpty(
  values: readonly string[],
  fieldName: string,
): readonly string[] {
  if (values.some((value) => value.trim().length === 0)) {
    throw new TypeError(`${fieldName} refuse les identifiants vides.`);
  }
  const sorted = [...values].sort();
  if (new Set(sorted).size !== sorted.length) {
    throw new TypeError(`${fieldName} refuse les doublons.`);
  }
  return Object.freeze(sorted);
}

export function defineHistoryV2ResourceContract(input: {
  readonly policyIds: readonly HistoryV2PolicyId[];
  readonly metricIds?: readonly string[];
}): HistoryV2ResourceContract {
  const knownPolicies = new Set<string>(historyV2PolicyIds);
  if (input.policyIds.some((policyId) => !knownPolicies.has(policyId))) {
    throw new TypeError("Une ressource History V2 référence une policy inconnue.");
  }
  const policyIds = sortedUniqueNonEmpty(
    input.policyIds,
    "HistoryV2ResourceContract.policyIds",
  ) as readonly HistoryV2PolicyId[];
  if (
    !policyIds.includes("quality_visibility")
    || !policyIds.includes("facts_hash")
  ) {
    throw new TypeError(
      "Une ressource History V2 doit dépendre de quality_visibility et facts_hash.",
    );
  }
  return Object.freeze({
    contractVersion: HISTORY_V2_CONTRACT_VERSION,
    family: "history_v2",
    policyIds,
    metricIds: sortedUniqueNonEmpty(
      input.metricIds ?? [],
      "HistoryV2ResourceContract.metricIds",
    ),
  });
}

// Explicit and exhaustive: adding a Query resource requires deciding its
// contract here. Existing certified resources deliberately remain V1.
export const queryResourceContractRegistry = Object.freeze({
  metric_methodology: legacyV1ResourceContract,
  metric_catalog_preview: legacyV1ResourceContract,
  metric_catalog_collection: legacyV1ResourceContract,
  history_calendar_month: legacyV1ResourceContract,
  history_calendar_month_summary: legacyV1ResourceContract,
  history_day_detail: legacyV1ResourceContract,
  history_month_calendar: defineHistoryV2ResourceContract({
    policyIds: [
      "canonical_continuity",
      "canonical_purchase_event_timing",
      "calendar_semantics",
      "daily_economic_allocation",
      "facts_hash",
      "quality_visibility",
      "week_journal_projection",
    ],
    metricIds: ["economic_consumption_net_attributable"],
  }),
  history_week: defineHistoryV2ResourceContract({
    policyIds: [
      "canonical_continuity",
      "canonical_purchase_event_timing",
      "calendar_semantics",
      "daily_economic_allocation",
      "facts_hash",
      "quality_visibility",
      "week_journal_projection",
    ],
    metricIds: ["economic_consumption_net_attributable"],
  }),
  history_day_journal: defineHistoryV2ResourceContract({
    policyIds: [
      "canonical_continuity",
      "canonical_purchase_event_timing",
      "calendar_semantics",
      "daily_economic_allocation",
      "facts_hash",
      "quality_visibility",
      "week_journal_projection",
    ],
    metricIds: ["economic_consumption_net_attributable"],
  }),
  history_month_overview: defineHistoryV2ResourceContract({
    policyIds: [
      "canonical_continuity",
      "canonical_purchase_event_timing",
      "calendar_semantics",
      "daily_economic_allocation",
      "facts_hash",
      "month_overview_selection",
      "quality_visibility",
    ],
    metricIds: ["economic_consumption_net_attributable"],
  }),
  history_month_balance_summary: defineHistoryV2ResourceContract({
    policyIds: ["canonical_purchase_event_timing", "daily_economic_allocation", "facts_hash", "month_balance_summary", "quality_visibility"],
    metricIds: ["economic_consumption_net_attributable", "typical_month_cost", "minimal_month_cost"],
  }),
  history_bank_economy_bridge: defineHistoryV2ResourceContract({
    policyIds: ["canonical_purchase_event_timing", "daily_economic_allocation", "facts_hash", "month_balance_summary", "quality_visibility"],
    metricIds: ["economic_consumption_net_attributable"],
  }),
  history_month_categories: defineHistoryV2ResourceContract({
    policyIds: ["canonical_purchase_event_timing", "category_explanation", "facts_hash", "quality_visibility"],
    metricIds: ["economic_consumption_net_attributable", "typical_month_cost", "category_amount"],
  }),
  history_category_detail: defineHistoryV2ResourceContract({
    policyIds: ["canonical_purchase_event_timing", "category_explanation", "facts_hash", "quality_visibility"],
    metricIds: ["category_amount", "merchant_net_amount", "purchase_count", "activity_frequency", "activity_causal_median_cost_per_occurrence"],
  }),
  history_month_spending_nature: defineHistoryV2ResourceContract({
    policyIds: ["canonical_component_classification", "facts_hash", "quality_visibility", "spending_nature"],
    metricIds: ["economic_consumption_net_attributable", "fixed_variable_amount", "life_scope_amount"],
  }),
  history_spending_segment_detail: defineHistoryV2ResourceContract({
    policyIds: ["canonical_component_classification", "facts_hash", "quality_visibility", "spending_nature"],
    metricIds: ["economic_consumption_net_attributable", "category_amount", "fixed_variable_amount", "life_scope_amount"],
  }),
  history_minimal_preview: defineHistoryV2ResourceContract({
    policyIds: ["canonical_component_classification", "facts_hash", "quality_visibility", "spending_nature"],
    metricIds: ["minimal_month_cost"],
  }),
  history_month_life_money: defineHistoryV2ResourceContract({
    policyIds: ["calendar_semantics", "canonical_purchase_event_timing", "facts_hash", "life_money_selection", "quality_visibility"],
    metricIds: ["economic_consumption_net_attributable", "activity_frequency", "activity_causal_cost", "localized_spend", "place_visit_count"],
  }),
  history_activity_detail: defineHistoryV2ResourceContract({
    policyIds: ["calendar_semantics", "canonical_purchase_event_timing", "facts_hash", "life_money_selection", "quality_visibility"],
    metricIds: ["activity_frequency", "activity_causal_cost", "activity_causal_median_cost_per_occurrence"],
  }),
  history_moment_detail: defineHistoryV2ResourceContract({
    policyIds: ["calendar_semantics", "canonical_purchase_event_timing", "daily_economic_allocation", "facts_hash", "life_money_selection", "quality_visibility"],
    metricIds: ["economic_consumption_net_attributable"],
  }),
  history_place_detail: defineHistoryV2ResourceContract({
    policyIds: ["calendar_semantics", "canonical_purchase_event_timing", "facts_hash", "life_money_selection", "quality_visibility"],
    metricIds: ["localized_spend", "place_visit_count", "distinct_visit_days"],
  }),
  analysis_month_initial: legacyV1ResourceContract,
  analysis_month_breakdown: legacyV1ResourceContract,
  analysis_month_evolution: legacyV1ResourceContract,
  analysis_month_structure: legacyV1ResourceContract,
  analysis_month_lived: legacyV1ResourceContract,
  analysis_month_moments: legacyV1ResourceContract,
  analysis_target: legacyV1ResourceContract,
  analysis_month_contexts: legacyV1ResourceContract,
  analysis_global_initial: legacyV1ResourceContract,
  analysis_global_baseline: legacyV1ResourceContract,
  analysis_global_typical: legacyV1ResourceContract,
  analysis_global_breakdown: legacyV1ResourceContract,
  analysis_global_evolution: legacyV1ResourceContract,
  analysis_global_contexts: legacyV1ResourceContract,
  analysis_global_habits: legacyV1ResourceContract,
  analysis_global_profiles: legacyV1ResourceContract,
  analysis_global_universe: legacyV1ResourceContract,
  entity_place: legacyV1ResourceContract,
  entity_merchant: legacyV1ResourceContract,
  entity_moment: legacyV1ResourceContract,
  entity_persona: legacyV1ResourceContract,
  entity_life_event: legacyV1ResourceContract,
  entity_operation: legacyV1ResourceContract,
  gallery_moments: legacyV1ResourceContract,
  gallery_places: legacyV1ResourceContract,
  gallery_merchants: legacyV1ResourceContract,
  operations_browse: legacyV1ResourceContract,
} satisfies Record<QueryResourceName, QueryResourceContract>);

export function getQueryResourceContract(
  resource: QueryResourceKey,
): QueryResourceContract {
  if (!isQueryResourceName(resource)) {
    throw new TypeError("QueryResourceKey absente du contrat par ressource.");
  }
  return queryResourceContractRegistry[resource as QueryResourceName];
}
