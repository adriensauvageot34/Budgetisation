import {
  analysisGlobalBreakdownReadModelSchema,
  analysisGlobalBaselineReadModelSchema,
  analysisGlobalContextsReadModelSchema,
  analysisGlobalEvolutionReadModelSchema,
  analysisGlobalHabitsReadModelSchema,
  analysisGlobalInitialReadModelSchema,
  analysisGlobalProfilesReadModelSchema,
  analysisGlobalTypicalReadModelSchema,
  analysisGlobalUniverseReadModelSchema,
  analysisMonthBreakdownReadModelSchema,
  analysisMonthContextsReadModelSchema,
  analysisMonthEvolutionReadModelSchema,
  analysisMonthInitialReadModelSchema,
  analysisMonthLivedReadModelSchema,
  analysisMonthMomentsReadModelSchema,
  analysisMonthStructureReadModelSchema,
  analysisTargetReadModelSchema,
  type AnalysisGlobalBreakdownReadModel,
  type AnalysisGlobalBaselineReadModel,
  type AnalysisGlobalContextsReadModel,
  type AnalysisGlobalEvolutionReadModel,
  type AnalysisGlobalHabitsReadModel,
  type AnalysisGlobalInitialReadModel,
  type AnalysisGlobalProfilesReadModel,
  type AnalysisGlobalTypicalReadModel,
  type AnalysisGlobalUniverseReadModel,
  type AnalysisMonthBreakdownReadModel,
  type AnalysisMonthContextsReadModel,
  type AnalysisMonthEvolutionReadModel,
  type AnalysisMonthInitialReadModel,
  type AnalysisMonthLivedReadModel,
  type AnalysisMonthMomentsReadModel,
  type AnalysisMonthStructureReadModel,
  type AnalysisTargetReadModel,
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
  operationsBrowseReadModelSchema,
  type OperationsBrowseReadModel,
} from "./operations";
import {
  journalDayReadModelSchema,
  monthCalendarReadModelSchema,
  monthQuickOverviewReadModelSchema,
  weekReadModelSchema,
  activityDetailReadModelSchema,
  bankEconomyBridgeReadModelSchema,
  categoryDetailReadModelSchema,
  minimalPreviewReadModelSchema,
  momentDetailReadModelSchema,
  monthBalanceSummaryReadModelSchema,
  monthCategoriesReadModelSchema,
  monthLifeMoneyReadModelSchema,
  monthSpendingNatureReadModelSchema,
  placeDetailReadModelSchema,
  spendingSegmentDetailReadModelSchema,
  type ActivityDetailReadModel,
  type BankEconomyBridgeReadModel,
  type CategoryDetailReadModel,
  type JournalDayReadModel,
  type MinimalPreviewReadModel,
  type MomentDetailReadModel,
  type MonthBalanceSummaryReadModel,
  type MonthCalendarReadModel,
  type MonthCategoriesReadModel,
  type MonthLifeMoneyReadModel,
  type MonthQuickOverviewReadModel,
  type MonthSpendingNatureReadModel,
  type PlaceDetailReadModel,
  type SpendingSegmentDetailReadModel,
  type WeekReadModel,
} from "./history-v2";
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
  readonly history_month_calendar: MonthCalendarReadModel;
  readonly history_week: WeekReadModel;
  readonly history_day_journal: JournalDayReadModel;
  readonly history_month_overview: MonthQuickOverviewReadModel;
  readonly history_month_balance_summary: MonthBalanceSummaryReadModel;
  readonly history_bank_economy_bridge: BankEconomyBridgeReadModel;
  readonly history_month_categories: MonthCategoriesReadModel;
  readonly history_category_detail: CategoryDetailReadModel;
  readonly history_month_spending_nature: MonthSpendingNatureReadModel;
  readonly history_spending_segment_detail: SpendingSegmentDetailReadModel;
  readonly history_minimal_preview: MinimalPreviewReadModel;
  readonly history_month_life_money: MonthLifeMoneyReadModel;
  readonly history_activity_detail: ActivityDetailReadModel;
  readonly history_moment_detail: MomentDetailReadModel;
  readonly history_place_detail: PlaceDetailReadModel;
  readonly analysis_month_initial: AnalysisMonthInitialReadModel;
  readonly analysis_month_breakdown: AnalysisMonthBreakdownReadModel;
  readonly analysis_month_evolution: AnalysisMonthEvolutionReadModel;
  readonly analysis_month_structure: AnalysisMonthStructureReadModel;
  readonly analysis_month_lived: AnalysisMonthLivedReadModel;
  readonly analysis_month_moments: AnalysisMonthMomentsReadModel;
  readonly analysis_target: AnalysisTargetReadModel;
  readonly analysis_month_contexts: AnalysisMonthContextsReadModel;
  readonly analysis_global_initial: AnalysisGlobalInitialReadModel;
  readonly analysis_global_baseline: AnalysisGlobalBaselineReadModel;
  readonly analysis_global_typical: AnalysisGlobalTypicalReadModel;
  readonly analysis_global_breakdown: AnalysisGlobalBreakdownReadModel;
  readonly analysis_global_evolution: AnalysisGlobalEvolutionReadModel;
  readonly analysis_global_contexts: AnalysisGlobalContextsReadModel;
  readonly analysis_global_habits: AnalysisGlobalHabitsReadModel;
  readonly analysis_global_profiles: AnalysisGlobalProfilesReadModel;
  readonly analysis_global_universe: AnalysisGlobalUniverseReadModel;
  readonly entity_place: EntityPlaceReadModel;
  readonly entity_merchant: EntityMerchantReadModel;
  readonly entity_moment: EntityMomentReadModel;
  readonly entity_persona: EntityPersonaReadModel;
  readonly entity_life_event: EntityLifeEventReadModel;
  readonly entity_operation: EntityOperationReadModel;
  readonly gallery_moments: GalleryMomentsReadModel;
  readonly gallery_places: GalleryPlacesReadModel;
  readonly gallery_merchants: GalleryMerchantsReadModel;
  readonly operations_browse: OperationsBrowseReadModel;
};

export const queryDataSchemaByResource = Object.freeze({
  metric_methodology: metricMethodologyReadModelSchema,
  metric_catalog_preview: metricCatalogPreviewReadModelSchema,
  metric_catalog_collection: metricCatalogCollectionReadModelSchema,
  history_calendar_month: historyCalendarMonthReadModelSchema,
  history_calendar_month_summary: historyCalendarMonthSummaryReadModelSchema,
  history_day_detail: historyDayDetailReadModelSchema,
  history_month_calendar: monthCalendarReadModelSchema,
  history_week: weekReadModelSchema,
  history_day_journal: journalDayReadModelSchema,
  history_month_overview: monthQuickOverviewReadModelSchema,
  history_month_balance_summary: monthBalanceSummaryReadModelSchema,
  history_bank_economy_bridge: bankEconomyBridgeReadModelSchema,
  history_month_categories: monthCategoriesReadModelSchema,
  history_category_detail: categoryDetailReadModelSchema,
  history_month_spending_nature: monthSpendingNatureReadModelSchema,
  history_spending_segment_detail: spendingSegmentDetailReadModelSchema,
  history_minimal_preview: minimalPreviewReadModelSchema,
  history_month_life_money: monthLifeMoneyReadModelSchema,
  history_activity_detail: activityDetailReadModelSchema,
  history_moment_detail: momentDetailReadModelSchema,
  history_place_detail: placeDetailReadModelSchema,
  analysis_month_initial: analysisMonthInitialReadModelSchema,
  analysis_month_breakdown: analysisMonthBreakdownReadModelSchema,
  analysis_month_evolution: analysisMonthEvolutionReadModelSchema,
  analysis_month_structure: analysisMonthStructureReadModelSchema,
  analysis_month_lived: analysisMonthLivedReadModelSchema,
  analysis_month_moments: analysisMonthMomentsReadModelSchema,
  analysis_target: analysisTargetReadModelSchema,
  analysis_month_contexts: analysisMonthContextsReadModelSchema,
  analysis_global_initial: analysisGlobalInitialReadModelSchema,
  analysis_global_baseline: analysisGlobalBaselineReadModelSchema,
  analysis_global_typical: analysisGlobalTypicalReadModelSchema,
  analysis_global_breakdown: analysisGlobalBreakdownReadModelSchema,
  analysis_global_evolution: analysisGlobalEvolutionReadModelSchema,
  analysis_global_contexts: analysisGlobalContextsReadModelSchema,
  analysis_global_habits: analysisGlobalHabitsReadModelSchema,
  analysis_global_profiles: analysisGlobalProfilesReadModelSchema,
  analysis_global_universe: analysisGlobalUniverseReadModelSchema,
  entity_place: entityPlaceReadModelSchema,
  entity_merchant: entityMerchantReadModelSchema,
  entity_moment: entityMomentReadModelSchema,
  entity_persona: entityPersonaReadModelSchema,
  entity_life_event: entityLifeEventReadModelSchema,
  entity_operation: entityOperationReadModelSchema,
  gallery_moments: galleryMomentsReadModelSchema,
  gallery_places: galleryPlacesReadModelSchema,
  gallery_merchants: galleryMerchantsReadModelSchema,
  operations_browse: operationsBrowseReadModelSchema,
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
  [queryResourceKeys.analysisMonthStructure]: analysisMonthStructureReadModelSchema,
  [queryResourceKeys.analysisMonthLived]: analysisMonthLivedReadModelSchema,
  [queryResourceKeys.analysisMonthMoments]: analysisMonthMomentsReadModelSchema,
  [queryResourceKeys.analysisTarget]: analysisTargetReadModelSchema,
  [queryResourceKeys.analysisMonthContexts]: analysisMonthContextsReadModelSchema,
  [queryResourceKeys.analysisGlobalInitial]: analysisGlobalInitialReadModelSchema,
  [queryResourceKeys.analysisGlobalBaseline]: analysisGlobalBaselineReadModelSchema,
  [queryResourceKeys.analysisGlobalTypical]: analysisGlobalTypicalReadModelSchema,
  [queryResourceKeys.analysisGlobalBreakdown]: analysisGlobalBreakdownReadModelSchema,
  [queryResourceKeys.analysisGlobalEvolution]: analysisGlobalEvolutionReadModelSchema,
  [queryResourceKeys.analysisGlobalContexts]: analysisGlobalContextsReadModelSchema,
  [queryResourceKeys.analysisGlobalHabits]: analysisGlobalHabitsReadModelSchema,
  [queryResourceKeys.analysisGlobalProfiles]: analysisGlobalProfilesReadModelSchema,
  [queryResourceKeys.analysisGlobalUniverse]: analysisGlobalUniverseReadModelSchema,
});

export function findSchemaRegistryOrphans(): readonly QueryResourceName[] {
  const schemas = new Set(Object.keys(queryDataSchemaByResource));
  return registeredQueryResourceKeys.filter((key) => !schemas.has(key)) as QueryResourceName[];
}
