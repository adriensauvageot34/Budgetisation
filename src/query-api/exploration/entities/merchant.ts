import type { MerchantId, OperationId, PlaceId } from "../../../core/identity";
import { parseMerchantId, parseOperationId, parsePlaceId } from "../../../core/identity";
import { parseLocalDate, type LocalDate } from "../../../core/time";
import {
  createRuntimeSchema,
  hasOwn,
  parseStrictRecord,
  requireProperty,
} from "../../../core/validation";
import { parseAnalysisSeriesPoints, type AnalysisSeriesPoint } from "../../analysis";
import type { QueryCapabilities } from "../../capabilities";
import { queryResourceKeys } from "../../request";
import type { ScopedCountMetricReadModel, ScopedMoneyMetricReadModel } from "../../read-models";
import { parseScopedMetricReadModel } from "../../read-models";
import type { ApplicabilitySection, EntityIdentity, EntityPreview } from "../shared";
import {
  parseApplicabilitySection,
  parseDisplayText,
  parseEntityCapabilities,
  parseEntityIdentity,
  parseEntityPreview,
} from "../shared";

export type MerchantSpatialMode =
  | "physical_single"
  | "physical_multi"
  | "online"
  | "non_spatial"
  | "unknown";

export type MerchantPlacePreviewItem = {
  readonly placeId: PlaceId;
  readonly label: string;
  readonly localizedSpend?: ScopedMoneyMetricReadModel;
};
export type MerchantOperationPreviewItem = {
  readonly operationId: OperationId;
  readonly bankDate: LocalDate;
  readonly label: string;
};
export type MerchantHeadlineReadModel = {
  readonly economicAmount?: ScopedMoneyMetricReadModel;
  readonly purchaseCount?: ScopedCountMetricReadModel;
};

export type EntityMerchantReadModel = {
  readonly id: MerchantId;
  readonly identity: EntityIdentity;
  readonly spatialMode: MerchantSpatialMode;
  readonly headline: MerchantHeadlineReadModel;
  readonly evolution?: readonly AnalysisSeriesPoint[];
  readonly placePreview: ApplicabilitySection<EntityPreview<MerchantPlacePreviewItem>>;
  readonly operationPreview: EntityPreview<MerchantOperationPreviewItem>;
  readonly capabilities: QueryCapabilities;
};

function parseExpectedMetric(value: unknown, metricId: string) {
  const metric = parseScopedMetricReadModel(value);
  if (metric.metricId !== metricId) throw new TypeError(`La métrique ${metricId} était attendue.`);
  return metric;
}

function parseHeadline(value: unknown): MerchantHeadlineReadModel {
  const record = parseStrictRecord(value, ["economicAmount", "purchaseCount"], "MerchantHeadlineReadModel");
  return {
    ...(hasOwn(record, "economicAmount")
      ? { economicAmount: parseExpectedMetric(record.economicAmount, "merchant_net_amount") as ScopedMoneyMetricReadModel }
      : {}),
    ...(hasOwn(record, "purchaseCount")
      ? { purchaseCount: parseExpectedMetric(record.purchaseCount, "purchase_count") as ScopedCountMetricReadModel }
      : {}),
  };
}

function parsePlaceItem(value: unknown): MerchantPlacePreviewItem {
  const record = parseStrictRecord(value, ["placeId", "label", "localizedSpend"], "MerchantPlacePreviewItem");
  return {
    placeId: parsePlaceId(requireProperty(record, "placeId", "MerchantPlacePreviewItem")),
    label: parseDisplayText(requireProperty(record, "label", "MerchantPlacePreviewItem"), "place label"),
    ...(hasOwn(record, "localizedSpend")
      ? { localizedSpend: parseExpectedMetric(record.localizedSpend, "localized_spend") as ScopedMoneyMetricReadModel }
      : {}),
  };
}

function parseOperationItem(value: unknown): MerchantOperationPreviewItem {
  const record = parseStrictRecord(value, ["operationId", "bankDate", "label"], "MerchantOperationPreviewItem");
  return {
    operationId: parseOperationId(requireProperty(record, "operationId", "MerchantOperationPreviewItem")),
    bankDate: parseLocalDate(requireProperty(record, "bankDate", "MerchantOperationPreviewItem")),
    label: parseDisplayText(requireProperty(record, "label", "MerchantOperationPreviewItem"), "operation label"),
  };
}

function parseSpatialMode(value: unknown): MerchantSpatialMode {
  if (
    value === "physical_single" || value === "physical_multi" || value === "online" ||
    value === "non_spatial" || value === "unknown"
  ) return value;
  throw new TypeError("MerchantSpatialMode est invalide.");
}

export function parseEntityMerchantReadModel(value: unknown): EntityMerchantReadModel {
  const record = parseStrictRecord(
    value,
    ["id", "identity", "spatialMode", "headline", "evolution", "placePreview", "operationPreview", "capabilities"],
    "EntityMerchantReadModel",
  );
  const spatialMode = parseSpatialMode(requireProperty(record, "spatialMode", "EntityMerchantReadModel"));
  const placePreview = parseApplicabilitySection(
    requireProperty(record, "placePreview", "EntityMerchantReadModel"),
    (candidate) => parseEntityPreview(candidate, parsePlaceItem, "MerchantPlacePreview"),
    "MerchantPlaceSection",
  );
  if ((spatialMode === "online" || spatialMode === "non_spatial") && placePreview.state !== "not_applicable") {
    throw new TypeError("Un marchand online/non spatial exige Places not_applicable.");
  }
  if (
    spatialMode === "physical_multi" &&
    placePreview.state === "available" &&
    placePreview.coverage === undefined
  ) {
    throw new TypeError("Un marchand multi-site exige une Coverage de localisation.");
  }
  return {
    id: parseMerchantId(requireProperty(record, "id", "EntityMerchantReadModel")),
    identity: parseEntityIdentity(requireProperty(record, "identity", "EntityMerchantReadModel")),
    spatialMode,
    headline: parseHeadline(requireProperty(record, "headline", "EntityMerchantReadModel")),
    ...(hasOwn(record, "evolution")
      ? { evolution: parseAnalysisSeriesPoints(record.evolution, "merchant_net_amount") }
      : {}),
    placePreview,
    operationPreview: parseEntityPreview(
      requireProperty(record, "operationPreview", "EntityMerchantReadModel"),
      parseOperationItem,
      "MerchantOperationPreview",
    ),
    capabilities: parseEntityCapabilities(requireProperty(record, "capabilities", "EntityMerchantReadModel"), queryResourceKeys.entityMerchant),
  };
}

export const entityMerchantReadModelSchema = createRuntimeSchema(parseEntityMerchantReadModel);
