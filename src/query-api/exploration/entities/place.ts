import type {
  ActivityId,
  MerchantId,
  PersonId,
  PlaceId,
} from "../../../core/identity";
import {
  parseActivityId,
  parseMerchantId,
  parsePersonId,
  parsePlaceId,
} from "../../../core/identity";
import { parseInstant, parseLocalDate, type Instant, type LocalDate } from "../../../core/time";
import {
  createRuntimeSchema,
  hasOwn,
  parseStrictRecord,
  requireProperty,
} from "../../../core/validation";
import type { QueryCapabilities } from "../../capabilities";
import { queryResourceKeys } from "../../request";
import type {
  ScopedCountMetricReadModel,
  ScopedMoneyMetricReadModel,
} from "../../read-models";
import { parseScopedMetricReadModel } from "../../read-models";
import type { EntityIdentity, EntityPreview } from "../shared";
import {
  parseDisplayText,
  parseEntityCapabilities,
  parseEntityIdentity,
  parseEntityPreview,
} from "../shared";

export type GeoCoordinates = { readonly latitude: number; readonly longitude: number };
export type PlaceSpatialState =
  | { readonly state: "known"; readonly coordinates: GeoCoordinates }
  | { readonly state: "partial"; readonly coordinates?: GeoCoordinates }
  | { readonly state: "conflict"; readonly candidates: readonly GeoCoordinates[] }
  | { readonly state: "unknown" };

export type PlaceActivityPreviewItem = {
  readonly activityId: ActivityId;
  readonly label: string;
};
export type PlaceMerchantPreviewItem = {
  readonly merchantId: MerchantId;
  readonly label: string;
};
export type PlaceVisitPreviewItem = {
  readonly visitKey: string;
  readonly personId: PersonId;
  readonly localDate: LocalDate;
  readonly visitStart?: Instant;
  readonly visitEnd?: Instant;
  readonly state: "known" | "partial" | "unknown";
};

export type PlaceHeadlineReadModel = {
  readonly visitCount?: ScopedCountMetricReadModel;
  readonly distinctVisitDays?: ScopedCountMetricReadModel;
  readonly localizedSpend?: ScopedMoneyMetricReadModel;
  readonly accessCostEstimate?: ScopedMoneyMetricReadModel;
};

export type EntityPlaceReadModel = {
  readonly id: PlaceId;
  readonly identity: EntityIdentity;
  readonly spatial: PlaceSpatialState;
  readonly headline: PlaceHeadlineReadModel;
  readonly activityPreview: EntityPreview<PlaceActivityPreviewItem>;
  readonly merchantPreview: EntityPreview<PlaceMerchantPreviewItem>;
  readonly visitPreview: EntityPreview<PlaceVisitPreviewItem>;
  readonly capabilities: QueryCapabilities;
};

function parseCoordinates(value: unknown): GeoCoordinates {
  const record = parseStrictRecord(value, ["latitude", "longitude"], "GeoCoordinates");
  const latitude = requireProperty(record, "latitude", "GeoCoordinates");
  const longitude = requireProperty(record, "longitude", "GeoCoordinates");
  if (
    typeof latitude !== "number" || !Number.isFinite(latitude) || latitude < -90 || latitude > 90 ||
    typeof longitude !== "number" || !Number.isFinite(longitude) || longitude < -180 || longitude > 180
  ) {
    throw new TypeError("GeoCoordinates est invalide.");
  }
  return { latitude, longitude };
}

function parseSpatial(value: unknown): PlaceSpatialState {
  const record = parseStrictRecord(value, ["state", "coordinates", "candidates"], "PlaceSpatialState");
  const state = requireProperty(record, "state", "PlaceSpatialState");
  if (state === "known") {
    return { state, coordinates: parseCoordinates(requireProperty(record, "coordinates", "PlaceSpatialState")) };
  }
  if (state === "partial") {
    const coordinates = hasOwn(record, "coordinates") ? parseCoordinates(record.coordinates) : undefined;
    return { state, ...(coordinates === undefined ? {} : { coordinates }) };
  }
  if (state === "conflict") {
    const candidates = requireProperty(record, "candidates", "PlaceSpatialState");
    if (!Array.isArray(candidates) || candidates.length < 2) {
      throw new TypeError("Un conflit géographique exige au moins deux candidats.");
    }
    return { state, candidates: candidates.map(parseCoordinates) };
  }
  if (state === "unknown") return { state };
  throw new TypeError("PlaceSpatialState.state est invalide.");
}

function parseExpectedMetric(value: unknown, metricId: string) {
  const metric = parseScopedMetricReadModel(value);
  if (metric.metricId !== metricId) throw new TypeError(`La métrique ${metricId} était attendue.`);
  return metric;
}

function parseHeadline(value: unknown): PlaceHeadlineReadModel {
  const record = parseStrictRecord(
    value,
    ["visitCount", "distinctVisitDays", "localizedSpend", "accessCostEstimate"],
    "PlaceHeadlineReadModel",
  );
  return {
    ...(hasOwn(record, "visitCount")
      ? { visitCount: parseExpectedMetric(record.visitCount, "place_visit_count") as ScopedCountMetricReadModel }
      : {}),
    ...(hasOwn(record, "distinctVisitDays")
      ? { distinctVisitDays: parseExpectedMetric(record.distinctVisitDays, "distinct_visit_days") as ScopedCountMetricReadModel }
      : {}),
    ...(hasOwn(record, "localizedSpend")
      ? { localizedSpend: parseExpectedMetric(record.localizedSpend, "localized_spend") as ScopedMoneyMetricReadModel }
      : {}),
    ...(hasOwn(record, "accessCostEstimate")
      ? { accessCostEstimate: parseExpectedMetric(record.accessCostEstimate, "fuel_trip_estimate") as ScopedMoneyMetricReadModel }
      : {}),
  };
}

function parseActivityItem(value: unknown): PlaceActivityPreviewItem {
  const record = parseStrictRecord(value, ["activityId", "label"], "PlaceActivityPreviewItem");
  return {
    activityId: parseActivityId(requireProperty(record, "activityId", "PlaceActivityPreviewItem")),
    label: parseDisplayText(requireProperty(record, "label", "PlaceActivityPreviewItem"), "activity label"),
  };
}

function parseMerchantItem(value: unknown): PlaceMerchantPreviewItem {
  const record = parseStrictRecord(value, ["merchantId", "label"], "PlaceMerchantPreviewItem");
  return {
    merchantId: parseMerchantId(requireProperty(record, "merchantId", "PlaceMerchantPreviewItem")),
    label: parseDisplayText(requireProperty(record, "label", "PlaceMerchantPreviewItem"), "merchant label"),
  };
}

function parseVisitItem(value: unknown): PlaceVisitPreviewItem {
  const record = parseStrictRecord(
    value,
    ["visitKey", "personId", "localDate", "visitStart", "visitEnd", "state"],
    "PlaceVisitPreviewItem",
  );
  const visitKey = parseDisplayText(requireProperty(record, "visitKey", "PlaceVisitPreviewItem"), "visitKey");
  const state = requireProperty(record, "state", "PlaceVisitPreviewItem");
  if (!(state === "known" || state === "partial" || state === "unknown")) {
    throw new TypeError("PlaceVisitPreviewItem.state est invalide.");
  }
  const visitStart = hasOwn(record, "visitStart") ? parseInstant(record.visitStart) : undefined;
  const visitEnd = hasOwn(record, "visitEnd") ? parseInstant(record.visitEnd) : undefined;
  if (state === "known" && (visitStart === undefined || visitEnd === undefined)) {
    throw new TypeError("Une visite connue exige son intervalle.");
  }
  return {
    visitKey,
    personId: parsePersonId(requireProperty(record, "personId", "PlaceVisitPreviewItem")),
    localDate: parseLocalDate(requireProperty(record, "localDate", "PlaceVisitPreviewItem")),
    ...(visitStart === undefined ? {} : { visitStart }),
    ...(visitEnd === undefined ? {} : { visitEnd }),
    state,
  };
}

export function parseEntityPlaceReadModel(value: unknown): EntityPlaceReadModel {
  const record = parseStrictRecord(
    value,
    ["id", "identity", "spatial", "headline", "activityPreview", "merchantPreview", "visitPreview", "capabilities"],
    "EntityPlaceReadModel",
  );
  return {
    id: parsePlaceId(requireProperty(record, "id", "EntityPlaceReadModel")),
    identity: parseEntityIdentity(requireProperty(record, "identity", "EntityPlaceReadModel")),
    spatial: parseSpatial(requireProperty(record, "spatial", "EntityPlaceReadModel")),
    headline: parseHeadline(requireProperty(record, "headline", "EntityPlaceReadModel")),
    activityPreview: parseEntityPreview(requireProperty(record, "activityPreview", "EntityPlaceReadModel"), parseActivityItem),
    merchantPreview: parseEntityPreview(requireProperty(record, "merchantPreview", "EntityPlaceReadModel"), parseMerchantItem),
    visitPreview: parseEntityPreview(requireProperty(record, "visitPreview", "EntityPlaceReadModel"), parseVisitItem),
    capabilities: parseEntityCapabilities(requireProperty(record, "capabilities", "EntityPlaceReadModel"), queryResourceKeys.entityPlace),
  };
}

export const entityPlaceReadModelSchema = createRuntimeSchema(parseEntityPlaceReadModel);
