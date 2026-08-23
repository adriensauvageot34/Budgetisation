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
  history_calendar_month: defineQueryServerAdapter(queryResourceKeys.historyCalendarMonth, (sources) => sources.readHistoryCalendarMonth),
  history_calendar_month_summary: defineQueryServerAdapter(queryResourceKeys.historyCalendarMonthSummary, (sources) => sources.readHistoryCalendarMonthSummary),
  history_day_detail: defineQueryServerAdapter(queryResourceKeys.historyDayDetail, (sources) => sources.readHistoryDayDetail),
  analysis_month_initial: defineQueryServerAdapter(queryResourceKeys.analysisMonthInitial, (sources) => sources.readAnalysisMonthInitial),
  analysis_month_breakdown: defineQueryServerAdapter(queryResourceKeys.analysisMonthBreakdown, (sources) => sources.readAnalysisMonthBreakdown),
  analysis_month_evolution: defineQueryServerAdapter(queryResourceKeys.analysisMonthEvolution, (sources) => sources.readAnalysisMonthEvolution),
  analysis_month_contexts: defineQueryServerAdapter(queryResourceKeys.analysisMonthContexts, (sources) => sources.readAnalysisMonthContexts),
  analysis_global_initial: defineQueryServerAdapter(queryResourceKeys.analysisGlobalInitial, (sources) => sources.readAnalysisGlobalInitial),
  analysis_global_breakdown: defineQueryServerAdapter(queryResourceKeys.analysisGlobalBreakdown, (sources) => sources.readAnalysisGlobalBreakdown),
  analysis_global_evolution: defineQueryServerAdapter(queryResourceKeys.analysisGlobalEvolution, (sources) => sources.readAnalysisGlobalEvolution),
  analysis_global_contexts: defineQueryServerAdapter(queryResourceKeys.analysisGlobalContexts, (sources) => sources.readAnalysisGlobalContexts),
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
