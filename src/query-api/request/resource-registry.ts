import {
  getMetricRegistryEntry,
} from "../../analytics/production/registry";
import {
  createRuntimeSchema,
  type RuntimeSchema,
} from "../../core/validation";
import type { NormalizedAnalysisScope } from "../../core/scope";
import { yearMonthOf } from "../../core/time";
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
  parseAnalysisBreakdownParams,
  parseAnalysisEvolutionParams,
  parseEmptyQueryParams,
  parseHistoryDayDetailParams,
  type AnalysisBreakdownParams,
  type AnalysisEvolutionParams,
  type EmptyQueryParams,
  type HistoryDayDetailParams,
  type NormalizedAnalysisBreakdownParams,
} from "./read-model-params";

const queryResourceNames = [
  "metric_methodology",
  "metric_catalog_preview",
  "metric_catalog_collection",
  "history_calendar_month",
  "history_calendar_month_summary",
  "history_day_detail",
  "analysis_month_initial",
  "analysis_month_breakdown",
  "analysis_month_evolution",
  "analysis_month_contexts",
  "analysis_global_initial",
  "analysis_global_breakdown",
  "analysis_global_evolution",
  "analysis_global_contexts",
  "entity_place",
  "entity_merchant",
  "entity_moment",
  "entity_persona",
  "entity_life_event",
  "entity_operation",
  "gallery_moments",
  "gallery_places",
  "gallery_merchants",
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
  analysisMonthContexts:
    parseQueryResourceKeySyntax<"analysis_month_contexts">(
      "analysis_month_contexts",
    ),
  analysisGlobalInitial:
    parseQueryResourceKeySyntax<"analysis_global_initial">(
      "analysis_global_initial",
    ),
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
});

export type QueryParamsByResource = {
  readonly metric_methodology: MetricMethodologyParams;
  readonly metric_catalog_preview: MetricCatalogPreviewParams;
  readonly metric_catalog_collection: MetricCatalogCollectionParams;
  readonly history_calendar_month: EmptyQueryParams;
  readonly history_calendar_month_summary: EmptyQueryParams;
  readonly history_day_detail: HistoryDayDetailParams;
  readonly analysis_month_initial: EmptyQueryParams;
  readonly analysis_month_breakdown: AnalysisBreakdownParams;
  readonly analysis_month_evolution: AnalysisEvolutionParams;
  readonly analysis_month_contexts: EmptyQueryParams;
  readonly analysis_global_initial: EmptyQueryParams;
  readonly analysis_global_breakdown: AnalysisBreakdownParams;
  readonly analysis_global_evolution: AnalysisEvolutionParams;
  readonly analysis_global_contexts: EmptyQueryParams;
  readonly entity_place: EntityPlaceParams;
  readonly entity_merchant: EntityMerchantParams;
  readonly entity_moment: EntityMomentParams;
  readonly entity_persona: EntityPersonaParams;
  readonly entity_life_event: EntityLifeEventParams;
  readonly entity_operation: EntityOperationParams;
  readonly gallery_moments: GalleryMomentsParams;
  readonly gallery_places: GalleryPlacesParams;
  readonly gallery_merchants: GalleryMerchantsParams;
};

export type NormalizedQueryParamsByResource = {
  readonly metric_methodology: MetricMethodologyParams;
  readonly metric_catalog_preview: NormalizedMetricCatalogPreviewParams;
  readonly metric_catalog_collection: NormalizedMetricCatalogCollectionParams;
  readonly history_calendar_month: EmptyQueryParams;
  readonly history_calendar_month_summary: EmptyQueryParams;
  readonly history_day_detail: HistoryDayDetailParams;
  readonly analysis_month_initial: EmptyQueryParams;
  readonly analysis_month_breakdown: NormalizedAnalysisBreakdownParams;
  readonly analysis_month_evolution: AnalysisEvolutionParams;
  readonly analysis_month_contexts: EmptyQueryParams;
  readonly analysis_global_initial: EmptyQueryParams;
  readonly analysis_global_breakdown: NormalizedAnalysisBreakdownParams;
  readonly analysis_global_evolution: AnalysisEvolutionParams;
  readonly analysis_global_contexts: EmptyQueryParams;
  readonly entity_place: EntityPlaceParams;
  readonly entity_merchant: EntityMerchantParams;
  readonly entity_moment: EntityMomentParams;
  readonly entity_persona: EntityPersonaParams;
  readonly entity_life_event: EntityLifeEventParams;
  readonly entity_operation: EntityOperationParams;
  readonly gallery_moments: NormalizedGalleryMomentsParams;
  readonly gallery_places: NormalizedGalleryPlacesParams;
  readonly gallery_merchants: NormalizedGalleryMerchantsParams;
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
    | "breakdown"
    | "evolution"
    | "contexts";
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

function assertBreakdownMetricTime(
  expectedTimeKind: NormalizedAnalysisScope["time"]["kind"],
  _scope: NormalizedAnalysisScope,
  params: NormalizedAnalysisBreakdownParams,
): void {
  if (!getMetricRegistryEntry(params.measure).allowedTimeKinds.includes(expectedTimeKind)) {
    throw new TypeError("Breakdown MetricId est incompatible avec le scope.");
  }
}

function assertEvolutionMetricTime(
  _scope: NormalizedAnalysisScope,
  params: AnalysisEvolutionParams,
): void {
  if (!getMetricRegistryEntry(params.metricId).allowedTimeKinds.includes("month")) {
    throw new TypeError("Evolution MetricId doit être une métrique mensuelle.");
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
    paramsSchema: createRuntimeSchema(parseAnalysisEvolutionParams),
    normalizeParams: freezeCanonicalParams,
    projection: "evolution",
    allowedTimeKinds: ["month"],
    validateRequest: assertEvolutionMetricTime,
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
    validateRequest: assertEvolutionMetricTime,
  },
  analysis_global_contexts: {
    key: queryResourceKeys.analysisGlobalContexts,
    paramsSchema: emptyParamsSchema("AnalysisGlobalContextsParams"),
    normalizeParams: freezeCanonicalParams,
    projection: "contexts",
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
