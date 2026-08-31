import {
  getMetricRegistryEntry,
} from "../../analytics/production/registry";
import {
  createRuntimeSchema,
  type RuntimeSchema,
} from "../../core/validation";
import type { NormalizedAnalysisScope } from "../../core/scope";
import { addDays, yearMonthOf } from "../../core/time";
import { canonicalSerializeQueryParams } from "./cache-key";
import {
  parseMetricCatalogCollectionParams,
  parseMetricCatalogPreviewParams,
  type MetricCatalogCollectionParams,
  type MetricCatalogPreviewParams,
  type NormalizedMetricCatalogCollectionParams,
  type NormalizedMetricCatalogPreviewParams,
} from "./catalog-params";
import {
  parseEntityLifeEventParams,
  parseEntityMerchantParams,
  parseEntityMomentParams,
  parseEntityOperationParams,
  parseEntityPersonaParams,
  parseEntityPlaceParams,
  parseGalleryMerchantsParams,
  parseGalleryMomentsParams,
  parseGalleryPlacesParams,
  parseMetricMethodologyParams,
  type EntityLifeEventParams,
  type EntityMerchantParams,
  type EntityMomentParams,
  type EntityOperationParams,
  type EntityPersonaParams,
  type EntityPlaceParams,
  type GalleryMerchantsParams,
  type GalleryMomentsParams,
  type GalleryPlacesParams,
  type MetricMethodologyParams,
  type NormalizedGalleryMerchantsParams,
  type NormalizedGalleryMomentsParams,
  type NormalizedGalleryPlacesParams,
} from "./exploration-params";
import {
  parseQueryResourceKeySyntax,
  type QueryResourceKey,
} from "./resource-key";
import {
  parseOperationsBrowseParams,
  type NormalizedOperationsBrowseParams,
  type OperationsBrowseParams,
} from "./operations-params";
import {
  parseAnalysisBreakdownParams,
  parseAnalysisEvolutionParams,
  parseAnalysisGlobalHabitsParams,
  parseAnalysisGlobalProfilesParams,
  parseAnalysisMonthStructureParams,
  parseAnalysisTargetParams,
  parseEmptyQueryParams,
  parseHistoryDayDetailParams,
  parseHistoryActivityDetailParams,
  parseHistoryCategoryDetailParams,
  parseHistoryMomentDetailParams,
  parseHistoryPlaceDetailParams,
  parseHistorySpendingSegmentDetailParams,
  parseHistoryWeekParams,
  type AnalysisBreakdownParams,
  type AnalysisEvolutionParams,
  type AnalysisGlobalHabitsParams,
  type AnalysisGlobalProfilesParams,
  type AnalysisMonthStructureParams,
  type AnalysisTargetParams,
  type EmptyQueryParams,
  type HistoryDayDetailParams,
  type HistoryActivityDetailParams,
  type HistoryCategoryDetailParams,
  type HistoryMomentDetailParams,
  type HistoryPlaceDetailParams,
  type HistorySpendingSegmentDetailParams,
  type HistoryWeekParams,
  type NormalizedAnalysisBreakdownParams,
  type NormalizedAnalysisEvolutionParams,
  type NormalizedAnalysisGlobalHabitsParams,
  type NormalizedAnalysisMonthStructureParams,
} from "./read-model-params";

const queryResourceNames = [
  "metric_methodology",
  "metric_catalog_preview",
  "metric_catalog_collection",
  "history_calendar_month",
  "history_calendar_month_summary",
  "history_day_detail",
  "history_month_calendar",
  "history_week",
  "history_day_journal",
  "history_month_overview",
  "history_month_balance_summary",
  "history_bank_economy_bridge",
  "history_month_categories",
  "history_category_detail",
  "history_month_spending_nature",
  "history_spending_segment_detail",
  "history_minimal_preview",
  "history_month_life_money",
  "history_activity_detail",
  "history_moment_detail",
  "history_place_detail",
  "analysis_month_initial",
  "analysis_month_breakdown",
  "analysis_month_evolution",
  "analysis_month_structure",
  "analysis_month_lived",
  "analysis_month_moments",
  "analysis_target",
  "analysis_month_contexts",
  "analysis_global_initial",
  "analysis_global_baseline",
  "analysis_global_typical",
  "analysis_global_breakdown",
  "analysis_global_evolution",
  "analysis_global_contexts",
  "analysis_global_habits",
  "analysis_global_profiles",
  "analysis_global_universe",
  "entity_place",
  "entity_merchant",
  "entity_moment",
  "entity_persona",
  "entity_life_event",
  "entity_operation",
  "gallery_moments",
  "gallery_places",
  "gallery_merchants",
  "operations_browse",
] as const;

export type QueryResourceName = (typeof queryResourceNames)[number];

export const queryResourceKeys = Object.freeze({
  metricMethodology:
    parseQueryResourceKeySyntax<"metric_methodology">("metric_methodology"),
  metricCatalogPreview:
    parseQueryResourceKeySyntax<"metric_catalog_preview">(
      "metric_catalog_preview",
    ),
  metricCatalogCollection:
    parseQueryResourceKeySyntax<"metric_catalog_collection">(
      "metric_catalog_collection",
    ),
  historyCalendarMonth:
    parseQueryResourceKeySyntax<"history_calendar_month">(
      "history_calendar_month",
    ),
  historyCalendarMonthSummary:
    parseQueryResourceKeySyntax<"history_calendar_month_summary">(
      "history_calendar_month_summary",
    ),
  historyDayDetail:
    parseQueryResourceKeySyntax<"history_day_detail">("history_day_detail"),
  historyMonthCalendar:
    parseQueryResourceKeySyntax<"history_month_calendar">("history_month_calendar"),
  historyWeek: parseQueryResourceKeySyntax<"history_week">("history_week"),
  historyDayJournal:
    parseQueryResourceKeySyntax<"history_day_journal">("history_day_journal"),
  historyMonthOverview:
    parseQueryResourceKeySyntax<"history_month_overview">("history_month_overview"),
  historyMonthBalanceSummary:
    parseQueryResourceKeySyntax<"history_month_balance_summary">("history_month_balance_summary"),
  historyBankEconomyBridge:
    parseQueryResourceKeySyntax<"history_bank_economy_bridge">("history_bank_economy_bridge"),
  historyMonthCategories:
    parseQueryResourceKeySyntax<"history_month_categories">("history_month_categories"),
  historyCategoryDetail:
    parseQueryResourceKeySyntax<"history_category_detail">("history_category_detail"),
  historyMonthSpendingNature:
    parseQueryResourceKeySyntax<"history_month_spending_nature">("history_month_spending_nature"),
  historySpendingSegmentDetail:
    parseQueryResourceKeySyntax<"history_spending_segment_detail">("history_spending_segment_detail"),
  historyMinimalPreview:
    parseQueryResourceKeySyntax<"history_minimal_preview">("history_minimal_preview"),
  historyMonthLifeMoney:
    parseQueryResourceKeySyntax<"history_month_life_money">("history_month_life_money"),
  historyActivityDetail:
    parseQueryResourceKeySyntax<"history_activity_detail">("history_activity_detail"),
  historyMomentDetail:
    parseQueryResourceKeySyntax<"history_moment_detail">("history_moment_detail"),
  historyPlaceDetail:
    parseQueryResourceKeySyntax<"history_place_detail">("history_place_detail"),
  analysisMonthInitial:
    parseQueryResourceKeySyntax<"analysis_month_initial">(
      "analysis_month_initial",
    ),
  analysisMonthBreakdown:
    parseQueryResourceKeySyntax<"analysis_month_breakdown">(
      "analysis_month_breakdown",
    ),
  analysisMonthEvolution:
    parseQueryResourceKeySyntax<"analysis_month_evolution">(
      "analysis_month_evolution",
    ),
  analysisMonthStructure:
    parseQueryResourceKeySyntax<"analysis_month_structure">("analysis_month_structure"),
  analysisMonthLived:
    parseQueryResourceKeySyntax<"analysis_month_lived">("analysis_month_lived"),
  analysisMonthMoments:
    parseQueryResourceKeySyntax<"analysis_month_moments">("analysis_month_moments"),
  analysisTarget:
    parseQueryResourceKeySyntax<"analysis_target">("analysis_target"),
  analysisMonthContexts:
    parseQueryResourceKeySyntax<"analysis_month_contexts">(
      "analysis_month_contexts",
    ),
  analysisGlobalInitial:
    parseQueryResourceKeySyntax<"analysis_global_initial">(
      "analysis_global_initial",
    ),
  analysisGlobalBaseline:
    parseQueryResourceKeySyntax<"analysis_global_baseline">("analysis_global_baseline"),
  analysisGlobalTypical:
    parseQueryResourceKeySyntax<"analysis_global_typical">("analysis_global_typical"),
  analysisGlobalBreakdown:
    parseQueryResourceKeySyntax<"analysis_global_breakdown">(
      "analysis_global_breakdown",
    ),
  analysisGlobalEvolution:
    parseQueryResourceKeySyntax<"analysis_global_evolution">(
      "analysis_global_evolution",
    ),
  analysisGlobalContexts:
    parseQueryResourceKeySyntax<"analysis_global_contexts">(
      "analysis_global_contexts",
    ),
  analysisGlobalHabits:
    parseQueryResourceKeySyntax<"analysis_global_habits">("analysis_global_habits"),
  analysisGlobalProfiles:
    parseQueryResourceKeySyntax<"analysis_global_profiles">("analysis_global_profiles"),
  analysisGlobalUniverse:
    parseQueryResourceKeySyntax<"analysis_global_universe">("analysis_global_universe"),
  entityPlace: parseQueryResourceKeySyntax<"entity_place">("entity_place"),
  entityMerchant:
    parseQueryResourceKeySyntax<"entity_merchant">("entity_merchant"),
  entityMoment: parseQueryResourceKeySyntax<"entity_moment">("entity_moment"),
  entityPersona:
    parseQueryResourceKeySyntax<"entity_persona">("entity_persona"),
  entityLifeEvent:
    parseQueryResourceKeySyntax<"entity_life_event">("entity_life_event"),
  entityOperation:
    parseQueryResourceKeySyntax<"entity_operation">("entity_operation"),
  galleryMoments:
    parseQueryResourceKeySyntax<"gallery_moments">("gallery_moments"),
  galleryPlaces:
    parseQueryResourceKeySyntax<"gallery_places">("gallery_places"),
  galleryMerchants:
    parseQueryResourceKeySyntax<"gallery_merchants">("gallery_merchants"),
  operationsBrowse:
    parseQueryResourceKeySyntax<"operations_browse">("operations_browse"),
});

export type QueryParamsByResource = {
  readonly metric_methodology: MetricMethodologyParams;
  readonly metric_catalog_preview: MetricCatalogPreviewParams;
  readonly metric_catalog_collection: MetricCatalogCollectionParams;
  readonly history_calendar_month: EmptyQueryParams;
  readonly history_calendar_month_summary: EmptyQueryParams;
  readonly history_day_detail: HistoryDayDetailParams;
  readonly history_month_calendar: EmptyQueryParams;
  readonly history_week: HistoryWeekParams;
  readonly history_day_journal: HistoryDayDetailParams;
  readonly history_month_overview: EmptyQueryParams;
  readonly history_month_balance_summary: EmptyQueryParams;
  readonly history_bank_economy_bridge: EmptyQueryParams;
  readonly history_month_categories: EmptyQueryParams;
  readonly history_category_detail: HistoryCategoryDetailParams;
  readonly history_month_spending_nature: EmptyQueryParams;
  readonly history_spending_segment_detail: HistorySpendingSegmentDetailParams;
  readonly history_minimal_preview: EmptyQueryParams;
  readonly history_month_life_money: EmptyQueryParams;
  readonly history_activity_detail: HistoryActivityDetailParams;
  readonly history_moment_detail: HistoryMomentDetailParams;
  readonly history_place_detail: HistoryPlaceDetailParams;
  readonly analysis_month_initial: EmptyQueryParams;
  readonly analysis_month_breakdown: AnalysisBreakdownParams;
  readonly analysis_month_evolution: EmptyQueryParams;
  readonly analysis_month_structure: AnalysisMonthStructureParams;
  readonly analysis_month_lived: EmptyQueryParams;
  readonly analysis_month_moments: EmptyQueryParams;
  readonly analysis_target: AnalysisTargetParams;
  readonly analysis_month_contexts: EmptyQueryParams;
  readonly analysis_global_initial: EmptyQueryParams;
  readonly analysis_global_baseline: EmptyQueryParams;
  readonly analysis_global_typical: EmptyQueryParams;
  readonly analysis_global_breakdown: AnalysisBreakdownParams;
  readonly analysis_global_evolution: AnalysisEvolutionParams;
  readonly analysis_global_contexts: EmptyQueryParams;
  readonly analysis_global_habits: AnalysisGlobalHabitsParams;
  readonly analysis_global_profiles: AnalysisGlobalProfilesParams;
  readonly analysis_global_universe: EmptyQueryParams;
  readonly entity_place: EntityPlaceParams;
  readonly entity_merchant: EntityMerchantParams;
  readonly entity_moment: EntityMomentParams;
  readonly entity_persona: EntityPersonaParams;
  readonly entity_life_event: EntityLifeEventParams;
  readonly entity_operation: EntityOperationParams;
  readonly gallery_moments: GalleryMomentsParams;
  readonly gallery_places: GalleryPlacesParams;
  readonly gallery_merchants: GalleryMerchantsParams;
  readonly operations_browse: OperationsBrowseParams;
};

export type NormalizedQueryParamsByResource = {
  readonly metric_methodology: MetricMethodologyParams;
  readonly metric_catalog_preview: NormalizedMetricCatalogPreviewParams;
  readonly metric_catalog_collection: NormalizedMetricCatalogCollectionParams;
  readonly history_calendar_month: EmptyQueryParams;
  readonly history_calendar_month_summary: EmptyQueryParams;
  readonly history_day_detail: HistoryDayDetailParams;
  readonly history_month_calendar: EmptyQueryParams;
  readonly history_week: HistoryWeekParams;
  readonly history_day_journal: HistoryDayDetailParams;
  readonly history_month_overview: EmptyQueryParams;
  readonly history_month_balance_summary: EmptyQueryParams;
  readonly history_bank_economy_bridge: EmptyQueryParams;
  readonly history_month_categories: EmptyQueryParams;
  readonly history_category_detail: HistoryCategoryDetailParams;
  readonly history_month_spending_nature: EmptyQueryParams;
  readonly history_spending_segment_detail: HistorySpendingSegmentDetailParams;
  readonly history_minimal_preview: EmptyQueryParams;
  readonly history_month_life_money: EmptyQueryParams;
  readonly history_activity_detail: HistoryActivityDetailParams;
  readonly history_moment_detail: HistoryMomentDetailParams;
  readonly history_place_detail: HistoryPlaceDetailParams;
  readonly analysis_month_initial: EmptyQueryParams;
  readonly analysis_month_breakdown: NormalizedAnalysisBreakdownParams;
  readonly analysis_month_evolution: EmptyQueryParams;
  readonly analysis_month_structure: NormalizedAnalysisMonthStructureParams;
  readonly analysis_month_lived: EmptyQueryParams;
  readonly analysis_month_moments: EmptyQueryParams;
  readonly analysis_target: AnalysisTargetParams;
  readonly analysis_month_contexts: EmptyQueryParams;
  readonly analysis_global_initial: EmptyQueryParams;
  readonly analysis_global_baseline: EmptyQueryParams;
  readonly analysis_global_typical: EmptyQueryParams;
  readonly analysis_global_breakdown: NormalizedAnalysisBreakdownParams;
  readonly analysis_global_evolution: NormalizedAnalysisEvolutionParams;
  readonly analysis_global_contexts: EmptyQueryParams;
  readonly analysis_global_habits: NormalizedAnalysisGlobalHabitsParams;
  readonly analysis_global_profiles: AnalysisGlobalProfilesParams;
  readonly analysis_global_universe: EmptyQueryParams;
  readonly entity_place: EntityPlaceParams;
  readonly entity_merchant: EntityMerchantParams;
  readonly entity_moment: EntityMomentParams;
  readonly entity_persona: EntityPersonaParams;
  readonly entity_life_event: EntityLifeEventParams;
  readonly entity_operation: EntityOperationParams;
  readonly gallery_moments: NormalizedGalleryMomentsParams;
  readonly gallery_places: NormalizedGalleryPlacesParams;
  readonly gallery_merchants: NormalizedGalleryMerchantsParams;
  readonly operations_browse: NormalizedOperationsBrowseParams;
};

export type QueryResourceDefinition<Name extends QueryResourceName> = {
  readonly key: QueryResourceKey<Name>;
  readonly paramsSchema: RuntimeSchema<NormalizedQueryParamsByResource[Name]>;
  readonly normalizeParams: (
    params: NormalizedQueryParamsByResource[Name],
  ) => NormalizedQueryParamsByResource[Name];
  readonly projection:
    | "detail"
    | "preview"
    | "collection"
    | "summary"
    | "initial"
    | "baseline"
    | "typical"
    | "breakdown"
    | "evolution"
    | "habits"
    | "profiles"
    | "universe"
    | "contexts"
    | "structure"
    | "lived"
    | "moments"
    | "target";
  readonly allowedTimeKinds: readonly NormalizedAnalysisScope["time"]["kind"][];
  readonly validateRequest?: (
    scope: NormalizedAnalysisScope,
    params: NormalizedQueryParamsByResource[Name],
  ) => void;
};

function freezeCanonicalParams<Params extends object>(params: Params): Params {
  canonicalSerializeQueryParams(params);
  return Object.freeze(params);
}

function emptyParamsSchema(typeName: string) {
  return createRuntimeSchema((value: unknown) =>
    parseEmptyQueryParams(value, typeName),
  );
}

function assertDayBelongsToScope(
  scope: NormalizedAnalysisScope,
  params: HistoryDayDetailParams,
): void {
  if (scope.time.kind !== "month" || yearMonthOf(params.date) !== scope.time.month) {
    throw new TypeError(
      "HistoryDayDetailParams.date doit appartenir au mois du scope.",
    );
  }
}

function assertWeekBelongsToScope(
  scope: NormalizedAnalysisScope,
  params: HistoryWeekParams,
): void {
  if (
    scope.time.kind !== "month"
    || yearMonthOf(addDays(params.weekStart, 3)) !== scope.time.month
  ) {
    throw new TypeError(
      "HistoryWeekParams.weekStart doit référencer un jeudi dans le mois du scope.",
    );
  }
}

function assertBreakdownMetricTime(
  expectedTimeKind: NormalizedAnalysisScope["time"]["kind"],
  _scope: NormalizedAnalysisScope,
  params: NormalizedAnalysisBreakdownParams,
): void {
  if (!getMetricRegistryEntry(params.measure).allowedTimeKinds.includes(expectedTimeKind)) {
    throw new TypeError("Breakdown MetricId est incompatible avec le scope.");
  }
}

export const queryResourceRegistry = Object.freeze({
  metric_methodology: {
    key: queryResourceKeys.metricMethodology,
    paramsSchema: createRuntimeSchema(parseMetricMethodologyParams),
    normalizeParams: freezeCanonicalParams,
    projection: "detail",
    allowedTimeKinds: ["month", "global"],
  },
  metric_catalog_preview: {
    key: queryResourceKeys.metricCatalogPreview,
    paramsSchema: createRuntimeSchema(parseMetricCatalogPreviewParams),
    normalizeParams: freezeCanonicalParams,
    projection: "preview",
    allowedTimeKinds: ["month", "global"],
  },
  metric_catalog_collection: {
    key: queryResourceKeys.metricCatalogCollection,
    paramsSchema: createRuntimeSchema(parseMetricCatalogCollectionParams),
    normalizeParams: freezeCanonicalParams,
    projection: "collection",
    allowedTimeKinds: ["month", "global"],
  },
  history_calendar_month: {
    key: queryResourceKeys.historyCalendarMonth,
    paramsSchema: emptyParamsSchema("HistoryCalendarMonthParams"),
    normalizeParams: freezeCanonicalParams,
    projection: "detail",
    allowedTimeKinds: ["month"],
  },
  history_calendar_month_summary: {
    key: queryResourceKeys.historyCalendarMonthSummary,
    paramsSchema: emptyParamsSchema("HistoryCalendarMonthSummaryParams"),
    normalizeParams: freezeCanonicalParams,
    projection: "summary",
    allowedTimeKinds: ["month"],
  },
  history_day_detail: {
    key: queryResourceKeys.historyDayDetail,
    paramsSchema: createRuntimeSchema(parseHistoryDayDetailParams),
    normalizeParams: freezeCanonicalParams,
    projection: "detail",
    allowedTimeKinds: ["month"],
    validateRequest: assertDayBelongsToScope,
  },
  history_month_calendar: {
    key: queryResourceKeys.historyMonthCalendar,
    paramsSchema: emptyParamsSchema("HistoryMonthCalendarParams"),
    normalizeParams: freezeCanonicalParams,
    projection: "detail",
    allowedTimeKinds: ["month"],
  },
  history_week: {
    key: queryResourceKeys.historyWeek,
    paramsSchema: createRuntimeSchema(parseHistoryWeekParams),
    normalizeParams: freezeCanonicalParams,
    projection: "detail",
    allowedTimeKinds: ["month"],
    validateRequest: assertWeekBelongsToScope,
  },
  history_day_journal: {
    key: queryResourceKeys.historyDayJournal,
    paramsSchema: createRuntimeSchema(parseHistoryDayDetailParams),
    normalizeParams: freezeCanonicalParams,
    projection: "detail",
    allowedTimeKinds: ["month"],
    validateRequest: assertDayBelongsToScope,
  },
  history_month_overview: {
    key: queryResourceKeys.historyMonthOverview,
    paramsSchema: emptyParamsSchema("HistoryMonthOverviewParams"),
    normalizeParams: freezeCanonicalParams,
    projection: "summary",
    allowedTimeKinds: ["month"],
  },
  history_month_balance_summary: {
    key: queryResourceKeys.historyMonthBalanceSummary,
    paramsSchema: emptyParamsSchema("HistoryMonthBalanceSummaryParams"),
    normalizeParams: freezeCanonicalParams,
    projection: "summary",
    allowedTimeKinds: ["month"],
  },
  history_bank_economy_bridge: {
    key: queryResourceKeys.historyBankEconomyBridge,
    paramsSchema: emptyParamsSchema("HistoryBankEconomyBridgeParams"),
    normalizeParams: freezeCanonicalParams,
    projection: "detail",
    allowedTimeKinds: ["month"],
  },
  history_month_categories: {
    key: queryResourceKeys.historyMonthCategories,
    paramsSchema: emptyParamsSchema("HistoryMonthCategoriesParams"),
    normalizeParams: freezeCanonicalParams,
    projection: "collection",
    allowedTimeKinds: ["month"],
  },
  history_category_detail: {
    key: queryResourceKeys.historyCategoryDetail,
    paramsSchema: createRuntimeSchema(parseHistoryCategoryDetailParams),
    normalizeParams: freezeCanonicalParams,
    projection: "detail",
    allowedTimeKinds: ["month"],
  },
  history_month_spending_nature: {
    key: queryResourceKeys.historyMonthSpendingNature,
    paramsSchema: emptyParamsSchema("HistoryMonthSpendingNatureParams"),
    normalizeParams: freezeCanonicalParams,
    projection: "summary",
    allowedTimeKinds: ["month"],
  },
  history_spending_segment_detail: {
    key: queryResourceKeys.historySpendingSegmentDetail,
    paramsSchema: createRuntimeSchema(parseHistorySpendingSegmentDetailParams),
    normalizeParams: freezeCanonicalParams,
    projection: "detail",
    allowedTimeKinds: ["month"],
  },
  history_minimal_preview: {
    key: queryResourceKeys.historyMinimalPreview,
    paramsSchema: emptyParamsSchema("HistoryMinimalPreviewParams"),
    normalizeParams: freezeCanonicalParams,
    projection: "preview",
    allowedTimeKinds: ["month"],
  },
  history_month_life_money: {
    key: queryResourceKeys.historyMonthLifeMoney,
    paramsSchema: emptyParamsSchema("HistoryMonthLifeMoneyParams"),
    normalizeParams: freezeCanonicalParams,
    projection: "summary",
    allowedTimeKinds: ["month"],
  },
  history_activity_detail: {
    key: queryResourceKeys.historyActivityDetail,
    paramsSchema: createRuntimeSchema(parseHistoryActivityDetailParams),
    normalizeParams: freezeCanonicalParams,
    projection: "detail",
    allowedTimeKinds: ["month"],
  },
  history_moment_detail: {
    key: queryResourceKeys.historyMomentDetail,
    paramsSchema: createRuntimeSchema(parseHistoryMomentDetailParams),
    normalizeParams: freezeCanonicalParams,
    projection: "detail",
    allowedTimeKinds: ["month"],
  },
  history_place_detail: {
    key: queryResourceKeys.historyPlaceDetail,
    paramsSchema: createRuntimeSchema(parseHistoryPlaceDetailParams),
    normalizeParams: freezeCanonicalParams,
    projection: "detail",
    allowedTimeKinds: ["month"],
  },
  analysis_month_initial: {
    key: queryResourceKeys.analysisMonthInitial,
    paramsSchema: emptyParamsSchema("AnalysisMonthInitialParams"),
    normalizeParams: freezeCanonicalParams,
    projection: "initial",
    allowedTimeKinds: ["month"],
  },
  analysis_month_breakdown: {
    key: queryResourceKeys.analysisMonthBreakdown,
    paramsSchema: createRuntimeSchema(parseAnalysisBreakdownParams),
    normalizeParams: freezeCanonicalParams,
    projection: "breakdown",
    allowedTimeKinds: ["month"],
    validateRequest: (scope, params) =>
      assertBreakdownMetricTime("month", scope, params),
  },
  analysis_month_evolution: {
    key: queryResourceKeys.analysisMonthEvolution,
    paramsSchema: emptyParamsSchema("AnalysisMonthEvolutionParams"),
    normalizeParams: freezeCanonicalParams,
    projection: "evolution",
    allowedTimeKinds: ["month"],
  },
  analysis_month_structure: {
    key: queryResourceKeys.analysisMonthStructure,
    paramsSchema: createRuntimeSchema(parseAnalysisMonthStructureParams),
    normalizeParams: freezeCanonicalParams,
    projection: "structure",
    allowedTimeKinds: ["month"],
  },
  analysis_month_lived: {
    key: queryResourceKeys.analysisMonthLived,
    paramsSchema: emptyParamsSchema("AnalysisMonthLivedParams"),
    normalizeParams: freezeCanonicalParams,
    projection: "lived",
    allowedTimeKinds: ["month"],
  },
  analysis_month_moments: {
    key: queryResourceKeys.analysisMonthMoments,
    paramsSchema: emptyParamsSchema("AnalysisMonthMomentsParams"),
    normalizeParams: freezeCanonicalParams,
    projection: "moments",
    allowedTimeKinds: ["month"],
  },
  analysis_target: {
    key: queryResourceKeys.analysisTarget,
    paramsSchema: createRuntimeSchema(parseAnalysisTargetParams),
    normalizeParams: freezeCanonicalParams,
    projection: "target",
    allowedTimeKinds: ["month", "global"],
  },
  analysis_month_contexts: {
    key: queryResourceKeys.analysisMonthContexts,
    paramsSchema: emptyParamsSchema("AnalysisMonthContextsParams"),
    normalizeParams: freezeCanonicalParams,
    projection: "contexts",
    allowedTimeKinds: ["month"],
  },
  analysis_global_initial: {
    key: queryResourceKeys.analysisGlobalInitial,
    paramsSchema: emptyParamsSchema("AnalysisGlobalInitialParams"),
    normalizeParams: freezeCanonicalParams,
    projection: "initial",
    allowedTimeKinds: ["global"],
  },
  analysis_global_baseline: {
    key: queryResourceKeys.analysisGlobalBaseline,
    paramsSchema: emptyParamsSchema("AnalysisGlobalBaselineParams"),
    normalizeParams: freezeCanonicalParams,
    projection: "baseline",
    allowedTimeKinds: ["global"],
  },
  analysis_global_typical: {
    key: queryResourceKeys.analysisGlobalTypical,
    paramsSchema: emptyParamsSchema("AnalysisGlobalTypicalParams"),
    normalizeParams: freezeCanonicalParams,
    projection: "typical",
    allowedTimeKinds: ["global"],
  },
  analysis_global_breakdown: {
    key: queryResourceKeys.analysisGlobalBreakdown,
    paramsSchema: createRuntimeSchema(parseAnalysisBreakdownParams),
    normalizeParams: freezeCanonicalParams,
    projection: "breakdown",
    allowedTimeKinds: ["global"],
    validateRequest: (scope, params) =>
      assertBreakdownMetricTime("global", scope, params),
  },
  analysis_global_evolution: {
    key: queryResourceKeys.analysisGlobalEvolution,
    paramsSchema: createRuntimeSchema(parseAnalysisEvolutionParams),
    normalizeParams: freezeCanonicalParams,
    projection: "evolution",
    allowedTimeKinds: ["global"],
  },
  analysis_global_contexts: {
    key: queryResourceKeys.analysisGlobalContexts,
    paramsSchema: emptyParamsSchema("AnalysisGlobalContextsParams"),
    normalizeParams: freezeCanonicalParams,
    projection: "contexts",
    allowedTimeKinds: ["global"],
  },
  analysis_global_habits: {
    key: queryResourceKeys.analysisGlobalHabits,
    paramsSchema: createRuntimeSchema(parseAnalysisGlobalHabitsParams),
    normalizeParams: freezeCanonicalParams,
    projection: "habits",
    allowedTimeKinds: ["global"],
  },
  analysis_global_profiles: {
    key: queryResourceKeys.analysisGlobalProfiles,
    paramsSchema: createRuntimeSchema(parseAnalysisGlobalProfilesParams),
    normalizeParams: freezeCanonicalParams,
    projection: "profiles",
    allowedTimeKinds: ["global"],
  },
  analysis_global_universe: {
    key: queryResourceKeys.analysisGlobalUniverse,
    paramsSchema: emptyParamsSchema("AnalysisGlobalUniverseParams"),
    normalizeParams: freezeCanonicalParams,
    projection: "universe",
    allowedTimeKinds: ["global"],
  },
  entity_place: {
    key: queryResourceKeys.entityPlace,
    paramsSchema: createRuntimeSchema(parseEntityPlaceParams),
    normalizeParams: freezeCanonicalParams,
    projection: "detail",
    allowedTimeKinds: ["month", "global"],
  },
  entity_merchant: {
    key: queryResourceKeys.entityMerchant,
    paramsSchema: createRuntimeSchema(parseEntityMerchantParams),
    normalizeParams: freezeCanonicalParams,
    projection: "detail",
    allowedTimeKinds: ["month", "global"],
  },
  entity_moment: {
    key: queryResourceKeys.entityMoment,
    paramsSchema: createRuntimeSchema(parseEntityMomentParams),
    normalizeParams: freezeCanonicalParams,
    projection: "detail",
    allowedTimeKinds: ["month", "global"],
  },
  entity_persona: {
    key: queryResourceKeys.entityPersona,
    paramsSchema: createRuntimeSchema(parseEntityPersonaParams),
    normalizeParams: freezeCanonicalParams,
    projection: "detail",
    allowedTimeKinds: ["month", "global"],
  },
  entity_life_event: {
    key: queryResourceKeys.entityLifeEvent,
    paramsSchema: createRuntimeSchema(parseEntityLifeEventParams),
    normalizeParams: freezeCanonicalParams,
    projection: "detail",
    allowedTimeKinds: ["month", "global"],
  },
  entity_operation: {
    key: queryResourceKeys.entityOperation,
    paramsSchema: createRuntimeSchema(parseEntityOperationParams),
    normalizeParams: freezeCanonicalParams,
    projection: "detail",
    allowedTimeKinds: ["month", "global"],
  },
  gallery_moments: {
    key: queryResourceKeys.galleryMoments,
    paramsSchema: createRuntimeSchema(parseGalleryMomentsParams),
    normalizeParams: freezeCanonicalParams,
    projection: "collection",
    allowedTimeKinds: ["month", "global"],
  },
  gallery_places: {
    key: queryResourceKeys.galleryPlaces,
    paramsSchema: createRuntimeSchema(parseGalleryPlacesParams),
    normalizeParams: freezeCanonicalParams,
    projection: "collection",
    allowedTimeKinds: ["month", "global"],
  },
  gallery_merchants: {
    key: queryResourceKeys.galleryMerchants,
    paramsSchema: createRuntimeSchema(parseGalleryMerchantsParams),
    normalizeParams: freezeCanonicalParams,
    projection: "collection",
    allowedTimeKinds: ["month", "global"],
  },
  operations_browse: {
    key: queryResourceKeys.operationsBrowse,
    paramsSchema: createRuntimeSchema(parseOperationsBrowseParams),
    normalizeParams: freezeCanonicalParams,
    projection: "collection",
    allowedTimeKinds: ["month", "global"],
  },
} satisfies {
  readonly [Name in QueryResourceName]: QueryResourceDefinition<Name>;
});

export const registeredQueryResourceKeys = Object.freeze(
  queryResourceNames.map((name) => queryResourceRegistry[name].key),
);

export function isQueryResourceName(
  value: unknown,
): value is QueryResourceName {
  return (
    typeof value === "string" &&
    Object.prototype.hasOwnProperty.call(queryResourceRegistry, value)
  );
}

export function parseQueryResourceKey(
  value: unknown,
): QueryResourceKey<QueryResourceName> {
  const syntacticallyValid = parseQueryResourceKeySyntax(value);
  if (!isQueryResourceName(syntacticallyValid)) {
    throw new TypeError("QueryResourceKey absente du Query Resource Registry.");
  }
  return queryResourceRegistry[syntacticallyValid as QueryResourceName].key;
}

export function getQueryResourceDefinition<Name extends QueryResourceName>(
  resource: QueryResourceKey<Name>,
): QueryResourceDefinition<Name> {
  if (!isQueryResourceName(resource)) {
    throw new TypeError("QueryResourceKey absente du Query Resource Registry.");
  }
  return queryResourceRegistry[
    resource as QueryResourceName
  ] as unknown as QueryResourceDefinition<Name>;
}
