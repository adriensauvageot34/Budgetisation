import "server-only";

import { queryDataSchemaByResource } from "../read-model-registry";
import {
  queryResourceKeys,
  registeredQueryResourceKeys,
  type QueryResourceName,
} from "../request";
import { defineQueryServerAdapter } from "./adapters";
import type { QueryServerAdapter } from "./types";

export const queryAdapterRegistry = Object.freeze({
  metric_methodology: defineQueryServerAdapter(queryResourceKeys.metricMethodology, (sources) => sources.readMetricMethodology),
  metric_catalog_preview: defineQueryServerAdapter(queryResourceKeys.metricCatalogPreview, (sources) => sources.readMetricCatalogPreview),
  metric_catalog_collection: defineQueryServerAdapter(queryResourceKeys.metricCatalogCollection, (sources) => sources.readMetricCatalogCollection),
  history_month_calendar: defineQueryServerAdapter(queryResourceKeys.historyMonthCalendar, (sources) => sources.readHistoryMonthCalendar),
  history_week: defineQueryServerAdapter(queryResourceKeys.historyWeek, (sources) => sources.readHistoryWeek),
  history_day_journal: defineQueryServerAdapter(queryResourceKeys.historyDayJournal, (sources) => sources.readHistoryDayJournal),
  history_month_overview: defineQueryServerAdapter(queryResourceKeys.historyMonthOverview, (sources) => sources.readHistoryMonthOverview),
  history_month_balance_summary: defineQueryServerAdapter(queryResourceKeys.historyMonthBalanceSummary, (sources) => sources.readHistoryMonthBalanceSummary),
  history_bank_economy_bridge: defineQueryServerAdapter(queryResourceKeys.historyBankEconomyBridge, (sources) => sources.readHistoryBankEconomyBridge),
  history_month_categories: defineQueryServerAdapter(queryResourceKeys.historyMonthCategories, (sources) => sources.readHistoryMonthCategories),
  history_category_detail: defineQueryServerAdapter(queryResourceKeys.historyCategoryDetail, (sources) => sources.readHistoryCategoryDetail),
  history_month_spending_nature: defineQueryServerAdapter(queryResourceKeys.historyMonthSpendingNature, (sources) => sources.readHistoryMonthSpendingNature),
  history_spending_segment_detail: defineQueryServerAdapter(queryResourceKeys.historySpendingSegmentDetail, (sources) => sources.readHistorySpendingSegmentDetail),
  history_minimal_preview: defineQueryServerAdapter(queryResourceKeys.historyMinimalPreview, (sources) => sources.readHistoryMinimalPreview),
  history_month_life_money: defineQueryServerAdapter(queryResourceKeys.historyMonthLifeMoney, (sources) => sources.readHistoryMonthLifeMoney),
  history_activity_detail: defineQueryServerAdapter(queryResourceKeys.historyActivityDetail, (sources) => sources.readHistoryActivityDetail),
  history_moment_detail: defineQueryServerAdapter(queryResourceKeys.historyMomentDetail, (sources) => sources.readHistoryMomentDetail),
  history_place_detail: defineQueryServerAdapter(queryResourceKeys.historyPlaceDetail, (sources) => sources.readHistoryPlaceDetail),
  analysis_month_initial: defineQueryServerAdapter(queryResourceKeys.analysisMonthInitial, (sources) => sources.readAnalysisMonthInitial),
  analysis_month_breakdown: defineQueryServerAdapter(queryResourceKeys.analysisMonthBreakdown, (sources) => sources.readAnalysisMonthBreakdown),
  analysis_month_evolution: defineQueryServerAdapter(queryResourceKeys.analysisMonthEvolution, (sources) => sources.readAnalysisMonthEvolution),
  analysis_month_structure: defineQueryServerAdapter(queryResourceKeys.analysisMonthStructure, (sources) => sources.readAnalysisMonthStructure),
  analysis_month_lived: defineQueryServerAdapter(queryResourceKeys.analysisMonthLived, (sources) => sources.readAnalysisMonthLived),
  analysis_month_moments: defineQueryServerAdapter(queryResourceKeys.analysisMonthMoments, (sources) => sources.readAnalysisMonthMoments),
  analysis_target: defineQueryServerAdapter(queryResourceKeys.analysisTarget, (sources) => sources.readAnalysisTarget),
  analysis_month_contexts: defineQueryServerAdapter(queryResourceKeys.analysisMonthContexts, (sources) => sources.readAnalysisMonthContexts),
  analysis_global_initial: defineQueryServerAdapter(queryResourceKeys.analysisGlobalInitial, (sources) => sources.readAnalysisGlobalInitial),
  analysis_global_baseline: defineQueryServerAdapter(queryResourceKeys.analysisGlobalBaseline, (sources) => sources.readAnalysisGlobalBaseline),
  analysis_global_typical: defineQueryServerAdapter(queryResourceKeys.analysisGlobalTypical, (sources) => sources.readAnalysisGlobalTypical),
  analysis_global_breakdown: defineQueryServerAdapter(queryResourceKeys.analysisGlobalBreakdown, (sources) => sources.readAnalysisGlobalBreakdown),
  analysis_global_evolution: defineQueryServerAdapter(queryResourceKeys.analysisGlobalEvolution, (sources) => sources.readAnalysisGlobalEvolution),
  analysis_global_contexts: defineQueryServerAdapter(queryResourceKeys.analysisGlobalContexts, (sources) => sources.readAnalysisGlobalContexts),
  analysis_global_habits: defineQueryServerAdapter(queryResourceKeys.analysisGlobalHabits, (sources) => sources.readAnalysisGlobalHabits),
  analysis_global_profiles: defineQueryServerAdapter(queryResourceKeys.analysisGlobalProfiles, (sources) => sources.readAnalysisGlobalProfiles),
  analysis_global_universe: defineQueryServerAdapter(queryResourceKeys.analysisGlobalUniverse, (sources) => sources.readAnalysisGlobalUniverse),
  entity_place: defineQueryServerAdapter(queryResourceKeys.entityPlace, (sources) => sources.readEntityPlace),
  entity_merchant: defineQueryServerAdapter(queryResourceKeys.entityMerchant, (sources) => sources.readEntityMerchant),
  entity_moment: defineQueryServerAdapter(queryResourceKeys.entityMoment, (sources) => sources.readEntityMoment),
  entity_persona: defineQueryServerAdapter(queryResourceKeys.entityPersona, (sources) => sources.readEntityPersona),
  entity_life_event: defineQueryServerAdapter(queryResourceKeys.entityLifeEvent, (sources) => sources.readEntityLifeEvent),
  entity_operation: defineQueryServerAdapter(queryResourceKeys.entityOperation, (sources) => sources.readEntityOperation),
  gallery_moments: defineQueryServerAdapter(queryResourceKeys.galleryMoments, (sources) => sources.readGalleryMoments),
  gallery_places: defineQueryServerAdapter(queryResourceKeys.galleryPlaces, (sources) => sources.readGalleryPlaces),
  gallery_merchants: defineQueryServerAdapter(queryResourceKeys.galleryMerchants, (sources) => sources.readGalleryMerchants),
  operations_browse: defineQueryServerAdapter(queryResourceKeys.operationsBrowse, (sources) => sources.readOperationsBrowse),
} as const satisfies {
  readonly [Name in QueryResourceName]: QueryServerAdapter<Name>;
});

export function getQueryServerAdapter<Name extends QueryResourceName>(
  resource: import("../request").QueryResourceKey<Name>,
): QueryServerAdapter<Name> {
  const adapter = queryAdapterRegistry[resource as QueryResourceName];
  if (adapter === undefined || adapter.resource !== resource) {
    throw new TypeError("QueryResourceKey sans adapter explicite.");
  }
  return adapter as unknown as QueryServerAdapter<Name>;
}

export type QueryRegistryParity = {
  readonly activeResources: readonly QueryResourceName[];
  readonly adapters: readonly QueryResourceName[];
  readonly schemas: readonly QueryResourceName[];
  readonly orphanResources: readonly QueryResourceName[];
  readonly orphanAdapters: readonly QueryResourceName[];
  readonly orphanSchemas: readonly QueryResourceName[];
};

export function inspectQueryRegistryParity(): QueryRegistryParity {
  const activeResources = [...registeredQueryResourceKeys] as QueryResourceName[];
  const adapters = Object.keys(queryAdapterRegistry) as QueryResourceName[];
  const schemas = Object.keys(queryDataSchemaByResource) as QueryResourceName[];
  const activeSet = new Set(activeResources);
  const adapterSet = new Set(adapters);
  const schemaSet = new Set(schemas);
  return {
    activeResources,
    adapters,
    schemas,
    orphanResources: activeResources.filter((key) => !adapterSet.has(key) || !schemaSet.has(key)),
    orphanAdapters: adapters.filter((key) => !activeSet.has(key)),
    orphanSchemas: schemas.filter((key) => !activeSet.has(key)),
  };
}

export function assertQueryRegistryParity(): void {
  const parity = inspectQueryRegistryParity();
  if (parity.orphanResources.length || parity.orphanAdapters.length || parity.orphanSchemas.length) {
    throw new TypeError("Resource Registry, Adapter Registry et Output Schema Registry divergent.");
  }
}
