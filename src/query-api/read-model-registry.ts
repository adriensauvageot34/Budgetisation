import {
  analysisGlobalBreakdownReadModelSchema,
  analysisGlobalContextsReadModelSchema,
  analysisGlobalEvolutionReadModelSchema,
  analysisGlobalInitialReadModelSchema,
  analysisMonthBreakdownReadModelSchema,
  analysisMonthContextsReadModelSchema,
  analysisMonthEvolutionReadModelSchema,
  analysisMonthInitialReadModelSchema,
  type AnalysisGlobalBreakdownReadModel,
  type AnalysisGlobalContextsReadModel,
  type AnalysisGlobalEvolutionReadModel,
  type AnalysisGlobalInitialReadModel,
  type AnalysisMonthBreakdownReadModel,
  type AnalysisMonthContextsReadModel,
  type AnalysisMonthEvolutionReadModel,
  type AnalysisMonthInitialReadModel,
} from "./analysis";
import {
  historyCalendarMonthReadModelSchema,
  historyCalendarMonthSummaryReadModelSchema,
  historyDayDetailReadModelSchema,
  type HistoryCalendarMonthReadModel,
  type HistoryCalendarMonthSummaryReadModel,
  type HistoryDayDetailReadModel,
} from "./calendar";
import {
  entityLifeEventReadModelSchema,
  entityMerchantReadModelSchema,
  entityMomentReadModelSchema,
  entityOperationReadModelSchema,
  entityPersonaReadModelSchema,
  entityPlaceReadModelSchema,
  galleryMerchantsReadModelSchema,
  galleryMomentsReadModelSchema,
  galleryPlacesReadModelSchema,
  metricCatalogCollectionReadModelSchema,
  metricCatalogPreviewReadModelSchema,
  metricMethodologyReadModelSchema,
  type EntityLifeEventReadModel,
  type EntityMerchantReadModel,
  type EntityMomentReadModel,
  type EntityOperationReadModel,
  type EntityPersonaReadModel,
  type EntityPlaceReadModel,
  type GalleryMerchantsReadModel,
  type GalleryMomentsReadModel,
  type GalleryPlacesReadModel,
  type MetricCatalogCollectionReadModel,
  type MetricCatalogPreviewReadModel,
  type MetricMethodologyReadModel,
} from "./exploration";
import {
  queryResourceKeys,
  registeredQueryResourceKeys,
  type QueryResourceName,
} from "./request";

export type QueryDataByResource = {
  readonly metric_methodology: MetricMethodologyReadModel;
  readonly metric_catalog_preview: MetricCatalogPreviewReadModel;
  readonly metric_catalog_collection: MetricCatalogCollectionReadModel;
  readonly history_calendar_month: HistoryCalendarMonthReadModel;
  readonly history_calendar_month_summary: HistoryCalendarMonthSummaryReadModel;
  readonly history_day_detail: HistoryDayDetailReadModel;
  readonly analysis_month_initial: AnalysisMonthInitialReadModel;
  readonly analysis_month_breakdown: AnalysisMonthBreakdownReadModel;
  readonly analysis_month_evolution: AnalysisMonthEvolutionReadModel;
  readonly analysis_month_contexts: AnalysisMonthContextsReadModel;
  readonly analysis_global_initial: AnalysisGlobalInitialReadModel;
  readonly analysis_global_breakdown: AnalysisGlobalBreakdownReadModel;
  readonly analysis_global_evolution: AnalysisGlobalEvolutionReadModel;
  readonly analysis_global_contexts: AnalysisGlobalContextsReadModel;
  readonly entity_place: EntityPlaceReadModel;
  readonly entity_merchant: EntityMerchantReadModel;
  readonly entity_moment: EntityMomentReadModel;
  readonly entity_persona: EntityPersonaReadModel;
  readonly entity_life_event: EntityLifeEventReadModel;
  readonly entity_operation: EntityOperationReadModel;
  readonly gallery_moments: GalleryMomentsReadModel;
  readonly gallery_places: GalleryPlacesReadModel;
  readonly gallery_merchants: GalleryMerchantsReadModel;
};

export const queryDataSchemaByResource = Object.freeze({
  metric_methodology: metricMethodologyReadModelSchema,
  metric_catalog_preview: metricCatalogPreviewReadModelSchema,
  metric_catalog_collection: metricCatalogCollectionReadModelSchema,
  history_calendar_month: historyCalendarMonthReadModelSchema,
  history_calendar_month_summary: historyCalendarMonthSummaryReadModelSchema,
  history_day_detail: historyDayDetailReadModelSchema,
  analysis_month_initial: analysisMonthInitialReadModelSchema,
  analysis_month_breakdown: analysisMonthBreakdownReadModelSchema,
  analysis_month_evolution: analysisMonthEvolutionReadModelSchema,
  analysis_month_contexts: analysisMonthContextsReadModelSchema,
  analysis_global_initial: analysisGlobalInitialReadModelSchema,
  analysis_global_breakdown: analysisGlobalBreakdownReadModelSchema,
  analysis_global_evolution: analysisGlobalEvolutionReadModelSchema,
  analysis_global_contexts: analysisGlobalContextsReadModelSchema,
  entity_place: entityPlaceReadModelSchema,
  entity_merchant: entityMerchantReadModelSchema,
  entity_moment: entityMomentReadModelSchema,
  entity_persona: entityPersonaReadModelSchema,
  entity_life_event: entityLifeEventReadModelSchema,
  entity_operation: entityOperationReadModelSchema,
  gallery_moments: galleryMomentsReadModelSchema,
  gallery_places: galleryPlacesReadModelSchema,
  gallery_merchants: galleryMerchantsReadModelSchema,
} as const satisfies {
  readonly [Name in QueryResourceName]: import("../core/validation").RuntimeSchema<
    QueryDataByResource[Name]
  >;
});

export const queryLotBReadModelSchemas = Object.freeze({
  [queryResourceKeys.historyCalendarMonth]: historyCalendarMonthReadModelSchema,
  [queryResourceKeys.historyCalendarMonthSummary]: historyCalendarMonthSummaryReadModelSchema,
  [queryResourceKeys.historyDayDetail]: historyDayDetailReadModelSchema,
  [queryResourceKeys.analysisMonthInitial]: analysisMonthInitialReadModelSchema,
  [queryResourceKeys.analysisMonthBreakdown]: analysisMonthBreakdownReadModelSchema,
  [queryResourceKeys.analysisMonthEvolution]: analysisMonthEvolutionReadModelSchema,
  [queryResourceKeys.analysisMonthContexts]: analysisMonthContextsReadModelSchema,
  [queryResourceKeys.analysisGlobalInitial]: analysisGlobalInitialReadModelSchema,
  [queryResourceKeys.analysisGlobalBreakdown]: analysisGlobalBreakdownReadModelSchema,
  [queryResourceKeys.analysisGlobalEvolution]: analysisGlobalEvolutionReadModelSchema,
  [queryResourceKeys.analysisGlobalContexts]: analysisGlobalContextsReadModelSchema,
});

export function findSchemaRegistryOrphans(): readonly QueryResourceName[] {
  const schemas = new Set(Object.keys(queryDataSchemaByResource));
  return registeredQueryResourceKeys.filter((key) => !schemas.has(key)) as QueryResourceName[];
}
