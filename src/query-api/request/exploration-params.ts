import {
  isActiveMetricId,
  type ActiveMetricId,
} from "../../analytics/production";
import {
  parseActivityId,
  parseLifeEventId,
  parseMerchantId,
  parseMomentId,
  parseOperationId,
  parsePersonId,
  parsePlaceId,
  type ActivityId,
  type LifeEventId,
  type MerchantId,
  type MomentId,
  type OperationId,
  type PersonId,
  type PlaceId,
} from "../../core/identity";
import { parseYearMonth, type YearMonth } from "../../core/time";
import {
  createRuntimeSchema,
  hasOwn,
  parseStrictRecord,
  requireProperty,
} from "../../core/validation";
import {
  defineCollectionPolicy,
  parseCollectionRequestParams,
  type CollectionRequestParams,
  type CursorToken,
  type SortDirection,
  type SortSpec,
} from "../collections";
import { parseQueryResourceKeySyntax } from "./resource-key";

export type EntityPlaceParams = { readonly placeId: PlaceId };
export type EntityMerchantParams = { readonly merchantId: MerchantId };
export type EntityMomentParams = { readonly momentId: MomentId };
export type PersonaTarget =
  | { readonly kind: "person"; readonly personId: PersonId }
  | { readonly kind: "ensemble" };
export type EntityPersonaParams = { readonly target: PersonaTarget };
export type EntityLifeEventParams = { readonly lifeEventId: LifeEventId };
export type EntityOperationParams = { readonly operationId: OperationId };
export type MetricMethodologyParams = {
  readonly metricId: ActiveMetricId;
  readonly asOf: YearMonth;
};

export function parseEntityPlaceParams(value: unknown): EntityPlaceParams {
  const record = parseStrictRecord(value, ["placeId"], "EntityPlaceParams");
  return {
    placeId: parsePlaceId(requireProperty(record, "placeId", "EntityPlaceParams")),
  };
}

export function parseEntityMerchantParams(value: unknown): EntityMerchantParams {
  const record = parseStrictRecord(value, ["merchantId"], "EntityMerchantParams");
  return {
    merchantId: parseMerchantId(
      requireProperty(record, "merchantId", "EntityMerchantParams"),
    ),
  };
}

export function parseEntityMomentParams(value: unknown): EntityMomentParams {
  const record = parseStrictRecord(value, ["momentId"], "EntityMomentParams");
  return {
    momentId: parseMomentId(requireProperty(record, "momentId", "EntityMomentParams")),
  };
}

export function parsePersonaTarget(value: unknown): PersonaTarget {
  const record = parseStrictRecord(value, ["kind", "personId"], "PersonaTarget");
  const kind = requireProperty(record, "kind", "PersonaTarget");
  if (kind === "ensemble") {
    if (hasOwn(record, "personId")) {
      throw new TypeError("Persona ensemble ne porte pas de PersonId.");
    }
    return { kind };
  }
  if (kind !== "person") throw new TypeError("PersonaTarget.kind est invalide.");
  return {
    kind,
    personId: parsePersonId(requireProperty(record, "personId", "PersonaTarget")),
  };
}

export function parseEntityPersonaParams(value: unknown): EntityPersonaParams {
  const record = parseStrictRecord(value, ["target"], "EntityPersonaParams");
  return {
    target: parsePersonaTarget(requireProperty(record, "target", "EntityPersonaParams")),
  };
}

export function parseEntityLifeEventParams(value: unknown): EntityLifeEventParams {
  const record = parseStrictRecord(value, ["lifeEventId"], "EntityLifeEventParams");
  return {
    lifeEventId: parseLifeEventId(
      requireProperty(record, "lifeEventId", "EntityLifeEventParams"),
    ),
  };
}

export function parseEntityOperationParams(value: unknown): EntityOperationParams {
  const record = parseStrictRecord(value, ["operationId"], "EntityOperationParams");
  return {
    operationId: parseOperationId(
      requireProperty(record, "operationId", "EntityOperationParams"),
    ),
  };
}

export function parseMetricMethodologyParams(value: unknown): MetricMethodologyParams {
  const record = parseStrictRecord(
    value,
    ["metricId", "asOf"],
    "MetricMethodologyParams",
  );
  const metricId = requireProperty(record, "metricId", "MetricMethodologyParams");
  if (!isActiveMetricId(metricId)) {
    throw new TypeError("MetricMethodologyParams.metricId n'est pas actif.");
  }
  return {
    metricId,
    asOf: parseYearMonth(requireProperty(record, "asOf", "MetricMethodologyParams")),
  };
}

export type MomentsGallerySortKey = "recent";
export type PlacesGallerySortKey = "frequent" | "spent" | "recent";
export type MerchantsGallerySortKey = "spent" | "frequent" | "recent";

export type MomentsGalleryFiltersInput = {
  readonly activityIds?: readonly ActivityId[];
  readonly placeIds?: readonly PlaceId[];
};
export type MomentsGalleryFilters = {
  readonly activityIds: readonly ActivityId[];
  readonly placeIds: readonly PlaceId[];
};
export type PlacesGalleryFiltersInput = {
  readonly activityIds?: readonly ActivityId[];
};
export type PlacesGalleryFilters = {
  readonly activityIds: readonly ActivityId[];
};
export type MerchantsGalleryFiltersInput = {
  readonly placeIds?: readonly PlaceId[];
  readonly activityIds?: readonly ActivityId[];
};
export type MerchantsGalleryFilters = {
  readonly placeIds: readonly PlaceId[];
  readonly activityIds: readonly ActivityId[];
};

type GalleryInput<SortKey extends string, Filters extends object> = {
  readonly search?: string | null;
  readonly sort?: { readonly key: SortKey; readonly direction?: SortDirection };
  readonly filters?: Filters;
  readonly cursor?: CursorToken | null;
  readonly limit?: number;
};

export type GalleryMomentsParams = GalleryInput<
  MomentsGallerySortKey,
  MomentsGalleryFiltersInput
>;
export type GalleryPlacesParams = GalleryInput<
  PlacesGallerySortKey,
  PlacesGalleryFiltersInput
>;
export type GalleryMerchantsParams = GalleryInput<
  MerchantsGallerySortKey,
  MerchantsGalleryFiltersInput
>;
export type NormalizedGalleryMomentsParams = CollectionRequestParams<
  SortSpec<MomentsGallerySortKey>,
  MomentsGalleryFilters
>;
export type NormalizedGalleryPlacesParams = CollectionRequestParams<
  SortSpec<PlacesGallerySortKey>,
  PlacesGalleryFilters
>;
export type NormalizedGalleryMerchantsParams = CollectionRequestParams<
  SortSpec<MerchantsGallerySortKey>,
  MerchantsGalleryFilters
>;

function parseIdArray<Id extends string>(
  value: unknown,
  parser: (candidate: unknown) => Id,
  name: string,
): readonly Id[] {
  if (value === undefined) return [];
  if (!Array.isArray(value)) throw new TypeError(`${name} doit être un tableau.`);
  return [...new Set(value.map(parser))].sort();
}

function parseMomentsFilters(value: unknown): MomentsGalleryFilters {
  const record = parseStrictRecord(value, ["activityIds", "placeIds"], "MomentsGalleryFilters");
  return {
    activityIds: parseIdArray(record.activityIds, parseActivityId, "activityIds"),
    placeIds: parseIdArray(record.placeIds, parsePlaceId, "placeIds"),
  };
}

function parsePlacesFilters(value: unknown): PlacesGalleryFilters {
  const record = parseStrictRecord(value, ["activityIds"], "PlacesGalleryFilters");
  return {
    activityIds: parseIdArray(record.activityIds, parseActivityId, "activityIds"),
  };
}

function parseMerchantsFilters(value: unknown): MerchantsGalleryFilters {
  const record = parseStrictRecord(
    value,
    ["placeIds", "activityIds"],
    "MerchantsGalleryFilters",
  );
  return {
    placeIds: parseIdArray(record.placeIds, parsePlaceId, "placeIds"),
    activityIds: parseIdArray(record.activityIds, parseActivityId, "activityIds"),
  };
}

export const galleryMomentsPolicy = defineCollectionPolicy({
  resource: parseQueryResourceKeySyntax<"gallery_moments">("gallery_moments"),
  cursorPolicyVersion: "gallery_moments_v1",
  defaultLimit: 24,
  maxLimit: 50,
  defaultSort: { key: "recent", direction: "desc" },
  allowedSorts: [
    { key: "recent", defaultDirection: "desc", nulls: "last", stableIdKind: "string" },
  ],
  search: { kind: "enabled", searchableFields: ["title"], maxLength: 100 },
  localFiltersSchema: createRuntimeSchema(parseMomentsFilters),
  normalizeLocalFilters: parseMomentsFilters,
});

export const galleryPlacesPolicy = defineCollectionPolicy({
  resource: parseQueryResourceKeySyntax<"gallery_places">("gallery_places"),
  cursorPolicyVersion: "gallery_places_v1",
  defaultLimit: 24,
  maxLimit: 50,
  defaultSort: { key: "frequent", direction: "desc" },
  allowedSorts: [
    { key: "frequent", defaultDirection: "desc", nulls: "last", stableIdKind: "string" },
    { key: "spent", defaultDirection: "desc", nulls: "last", stableIdKind: "string" },
    { key: "recent", defaultDirection: "desc", nulls: "last", stableIdKind: "string" },
  ],
  search: { kind: "enabled", searchableFields: ["label"], maxLength: 100 },
  localFiltersSchema: createRuntimeSchema(parsePlacesFilters),
  normalizeLocalFilters: parsePlacesFilters,
});

export const galleryMerchantsPolicy = defineCollectionPolicy({
  resource: parseQueryResourceKeySyntax<"gallery_merchants">("gallery_merchants"),
  cursorPolicyVersion: "gallery_merchants_v1",
  defaultLimit: 24,
  maxLimit: 50,
  defaultSort: { key: "spent", direction: "desc" },
  allowedSorts: [
    { key: "spent", defaultDirection: "desc", nulls: "last", stableIdKind: "string" },
    { key: "frequent", defaultDirection: "desc", nulls: "last", stableIdKind: "string" },
    { key: "recent", defaultDirection: "desc", nulls: "last", stableIdKind: "string" },
  ],
  search: { kind: "enabled", searchableFields: ["label"], maxLength: 100 },
  localFiltersSchema: createRuntimeSchema(parseMerchantsFilters),
  normalizeLocalFilters: parseMerchantsFilters,
});

export const parseGalleryMomentsParams = (value: unknown): NormalizedGalleryMomentsParams =>
  parseCollectionRequestParams(value, galleryMomentsPolicy);
export const parseGalleryPlacesParams = (value: unknown): NormalizedGalleryPlacesParams =>
  parseCollectionRequestParams(value, galleryPlacesPolicy);
export const parseGalleryMerchantsParams = (value: unknown): NormalizedGalleryMerchantsParams =>
  parseCollectionRequestParams(value, galleryMerchantsPolicy);
