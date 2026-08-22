import { parseMerchantId, parseMomentId, parsePlaceId } from "../../../core/identity";
import { createRuntimeSchema, hasOwn, parseStrictRecord, requireProperty } from "../../../core/validation";
import { parseQueryCapabilities } from "../../capabilities";
import { parseCursorPage } from "../../collections";
import { queryResourceKeys } from "../../request";
import type { ScopedCountMetricReadModel, ScopedMoneyMetricReadModel } from "../../read-models";
import { parseScopedMetricReadModel } from "../../read-models";
import { parseDisplayText } from "../shared";
import type {
  GalleryMerchantsReadModel,
  GalleryMomentsReadModel,
  GalleryPlacesReadModel,
  MerchantGalleryCard,
  MomentGalleryCard,
  PlaceGalleryCard,
} from "./types";

function parseExpectedMetric(value: unknown, metricId: string) {
  const metric = parseScopedMetricReadModel(value);
  if (metric.metricId !== metricId) throw new TypeError(`La métrique ${metricId} était attendue.`);
  return metric;
}

function parseMomentCard(value: unknown): MomentGalleryCard {
  const record = parseStrictRecord(value, ["momentId", "title"], "MomentGalleryCard");
  return {
    momentId: parseMomentId(requireProperty(record, "momentId", "MomentGalleryCard")),
    title: parseDisplayText(requireProperty(record, "title", "MomentGalleryCard"), "moment title"),
  };
}

function parsePlaceCard(value: unknown): PlaceGalleryCard {
  const record = parseStrictRecord(value, ["placeId", "label", "visitCount", "localizedSpend"], "PlaceGalleryCard");
  return {
    placeId: parsePlaceId(requireProperty(record, "placeId", "PlaceGalleryCard")),
    label: parseDisplayText(requireProperty(record, "label", "PlaceGalleryCard"), "place label"),
    ...(hasOwn(record, "visitCount")
      ? { visitCount: parseExpectedMetric(record.visitCount, "place_visit_count") as ScopedCountMetricReadModel }
      : {}),
    ...(hasOwn(record, "localizedSpend")
      ? { localizedSpend: parseExpectedMetric(record.localizedSpend, "localized_spend") as ScopedMoneyMetricReadModel }
      : {}),
  };
}

function parseMerchantCard(value: unknown): MerchantGalleryCard {
  const record = parseStrictRecord(value, ["merchantId", "label", "economicAmount", "purchaseCount"], "MerchantGalleryCard");
  return {
    merchantId: parseMerchantId(requireProperty(record, "merchantId", "MerchantGalleryCard")),
    label: parseDisplayText(requireProperty(record, "label", "MerchantGalleryCard"), "merchant label"),
    ...(hasOwn(record, "economicAmount")
      ? { economicAmount: parseExpectedMetric(record.economicAmount, "merchant_net_amount") as ScopedMoneyMetricReadModel }
      : {}),
    ...(hasOwn(record, "purchaseCount")
      ? { purchaseCount: parseExpectedMetric(record.purchaseCount, "purchase_count") as ScopedCountMetricReadModel }
      : {}),
  };
}

export function parseGalleryMomentsReadModel(value: unknown): GalleryMomentsReadModel {
  const record = parseStrictRecord(value, ["page", "capabilities"], "GalleryMomentsReadModel");
  return {
    page: parseCursorPage(requireProperty(record, "page", "GalleryMomentsReadModel"), parseMomentCard),
    capabilities: parseQueryCapabilities(requireProperty(record, "capabilities", "GalleryMomentsReadModel"), queryResourceKeys.galleryMoments),
  };
}

export function parseGalleryPlacesReadModel(value: unknown): GalleryPlacesReadModel {
  const record = parseStrictRecord(value, ["page", "capabilities"], "GalleryPlacesReadModel");
  return {
    page: parseCursorPage(requireProperty(record, "page", "GalleryPlacesReadModel"), parsePlaceCard),
    capabilities: parseQueryCapabilities(requireProperty(record, "capabilities", "GalleryPlacesReadModel"), queryResourceKeys.galleryPlaces),
  };
}

export function parseGalleryMerchantsReadModel(value: unknown): GalleryMerchantsReadModel {
  const record = parseStrictRecord(value, ["page", "capabilities"], "GalleryMerchantsReadModel");
  return {
    page: parseCursorPage(requireProperty(record, "page", "GalleryMerchantsReadModel"), parseMerchantCard),
    capabilities: parseQueryCapabilities(requireProperty(record, "capabilities", "GalleryMerchantsReadModel"), queryResourceKeys.galleryMerchants),
  };
}

export const galleryMomentsReadModelSchema = createRuntimeSchema(parseGalleryMomentsReadModel);
export const galleryPlacesReadModelSchema = createRuntimeSchema(parseGalleryPlacesReadModel);
export const galleryMerchantsReadModelSchema = createRuntimeSchema(parseGalleryMerchantsReadModel);
