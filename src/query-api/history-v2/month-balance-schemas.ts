import {
  createCollectionValueSchema,
  createDisplayNodeSchema,
  createMetricValueSchema,
  parsePolicyVersions,
  parsePublicationMeta,
  parseQualityEnvelope,
  policyVersionsEqual,
  type PolicyVersions,
} from "../../core/history-v2";
import { parseResourceInputHash } from "../../analytics/history-v2";
import { parseHouseholdId } from "../../core/identity";
import { parseMoney } from "../../core/money";
import { parseYearMonth } from "../../core/time";
import {
  createRuntimeSchema,
  hasOwn,
  parseStrictRecord,
  requireProperty,
  type RuntimeSchema,
} from "../../core/validation";
import { parseQueryCapabilities } from "../capabilities";
import { queryResourceKeys, type QueryResourceKey } from "../request";
import type {
  ActivityDetailReadModel,
  BankEconomyBridgeReadModel,
  CategoryDetailReadModel,
  MinimalPreviewReadModel,
  MomentDetailReadModel,
  MonthBalanceSummaryReadModel,
  MonthCategoriesReadModel,
  MonthLifeMoneyReadModel,
  MonthSpendingNatureReadModel,
  NewMonthSpendingNatureReadModel,
  OldMonthSpendingNatureReadModel,
  PlaceDetailReadModel,
  SpendingSegmentDetailReadModel,
} from "./month-balance-types";
import { assertReadModelPublicationCompatibility } from "./builders";
import { parseHistorySpendingSegmentDetailParams } from "../request";
import { queryTargetRefRuntimeSchema, sourceRefRuntimeSchema } from "./schemas";

const baseKeys = [
  "householdId",
  "month",
  "sourceRefs",
  "capabilities",
  "resourceInputHash",
  "policyVersions",
  "publicationMeta",
  "quality",
] as const;

function assertDeepContractValue(value: unknown, path: string, seen = new Set<object>()): void {
  if (value === undefined) throw new TypeError(`${path} ne peut pas être undefined.`);
  if (typeof value === "number" && !Number.isFinite(value)) throw new TypeError(`${path} doit être fini.`);
  if (typeof value === "function" || typeof value === "symbol" || typeof value === "bigint") throw new TypeError(`${path} n'est pas sérialisable.`);
  if (typeof value !== "object" || value === null) return;
  if (seen.has(value)) throw new TypeError(`${path} contient un cycle.`);
  seen.add(value);
  if (Array.isArray(value)) {
    value.forEach((entry, index) => assertDeepContractValue(entry, `${path}[${index}]`, seen));
  } else {
    for (const [key, entry] of Object.entries(value)) assertDeepContractValue(entry, `${path}.${key}`, seen);
  }
  seen.delete(value);
}

function parseSourceRefs(value: unknown) {
  if (!Array.isArray(value)) throw new TypeError("sourceRefs doit être un tableau.");
  const refs = value.map((entry) => sourceRefRuntimeSchema.parse(entry));
  const identities = refs.map(({ kind, id }) => `${kind}\u0000${id}`);
  if (new Set(identities).size !== identities.length) throw new TypeError("sourceRefs contient un doublon.");
  return refs;
}

function monthlySchema<T>(
  resource: QueryResourceKey,
  dataKeys: readonly string[],
  typeName: string,
): RuntimeSchema<T> {
  return createRuntimeSchema((value: unknown) => {
    const record = parseStrictRecord(value, [...baseKeys, ...dataKeys], typeName);
    const householdId = parseHouseholdId(requireProperty(record, "householdId", typeName));
    const month = parseYearMonth(requireProperty(record, "month", typeName));
    const sourceRefs = parseSourceRefs(requireProperty(record, "sourceRefs", typeName));
    const capabilities = parseQueryCapabilities(requireProperty(record, "capabilities", typeName), resource);
    const resourceInputHash = parseResourceInputHash(requireProperty(record, "resourceInputHash", typeName));
    const policyVersions: PolicyVersions = parsePolicyVersions(requireProperty(record, "policyVersions", typeName));
    const publicationMeta = hasOwn(record, "publicationMeta") ? parsePublicationMeta(record.publicationMeta) : undefined;
    if (publicationMeta !== undefined && !policyVersionsEqual(publicationMeta.policyVersions, policyVersions)) {
      throw new TypeError(`${typeName}.publicationMeta ne correspond pas aux policyVersions de la ressource.`);
    }
    assertReadModelPublicationCompatibility({ policyVersions, ...(publicationMeta === undefined ? {} : { publicationMeta }) });
    const quality = hasOwn(record, "quality") ? parseQualityEnvelope(record.quality) : undefined;
    for (const key of dataKeys) assertDeepContractValue(requireProperty(record, key, typeName), `${typeName}.${key}`);
    return {
      ...record,
      householdId,
      month,
      sourceRefs,
      capabilities,
      resourceInputHash,
      policyVersions,
      ...(publicationMeta === undefined ? {} : { publicationMeta }),
      ...(quality === undefined ? {} : { quality }),
    } as T;
  });
}

export const monthBalanceSummaryReadModelSchema = monthlySchema<MonthBalanceSummaryReadModel>(queryResourceKeys.historyMonthBalanceSummary, ["actualValue", "typicalValue", "minimalValue", "actualVsTypical", "actualVsMinimal", "usualZone", "historicalRank", "importedSummary", "bridgeRef"], "MonthBalanceSummaryReadModel");
export const bankEconomyBridgeReadModelSchema = monthlySchema<BankEconomyBridgeReadModel>(queryResourceKeys.historyBankEconomyBridge, ["bridge"], "BankEconomyBridgeReadModel");
export const monthCategoriesReadModelSchema = monthlySchema<MonthCategoriesReadModel>(queryResourceKeys.historyMonthCategories, ["categories", "otherAmount", "unclassifiedAmount"], "MonthCategoriesReadModel");
export const categoryDetailReadModelSchema = monthlySchema<CategoryDetailReadModel>(queryResourceKeys.historyCategoryDetail, ["category", "typicalComposition", "explanation", "frequencyTicket", "merchantAndPurchaseDrivers", "lifecycleBadges", "classificationViews"], "CategoryDetailReadModel");
export const oldMonthSpendingNatureReadModelSchema = monthlySchema<OldMonthSpendingNatureReadModel>(queryResourceKeys.historyMonthSpendingNature, ["actual", "necessity", "behavior", "lifeScope", "matrix"], "OldMonthSpendingNatureReadModel");

const spendingContributorSchema = createRuntimeSchema((value: unknown) => {
  const record = parseStrictRecord(value, ["contributorId", "grain", "label", "amount", "sourceRefs"], "SpendingContributor");
  const contributorId = requireProperty(record, "contributorId", "SpendingContributor");
  const grain = requireProperty(record, "grain", "SpendingContributor");
  const label = requireProperty(record, "label", "SpendingContributor");
  if (typeof contributorId !== "string" || contributorId.trim().length === 0) throw new TypeError("SpendingContributor.contributorId invalide.");
  if (grain !== "SUBCATEGORY" && grain !== "CATEGORY") throw new TypeError("SpendingContributor.grain invalide.");
  if (typeof label !== "string" || label.trim().length === 0) throw new TypeError("SpendingContributor.label invalide.");
  return {
    contributorId,
    grain,
    label,
    amount: parseMoney(requireProperty(record, "amount", "SpendingContributor")),
    sourceRefs: parseSourceRefs(requireProperty(record, "sourceRefs", "SpendingContributor")),
  };
});

const metricMoneyNodeSchema = createDisplayNodeSchema(
  createMetricValueSchema(createRuntimeSchema(parseMoney)),
);
const contributorCollectionNodeSchema = createDisplayNodeSchema(
  createCollectionValueSchema(spendingContributorSchema),
);
const spendingNatureBucketProjectionSchema = createRuntimeSchema((value: unknown) => {
  const record = parseStrictRecord(value, ["segment", "amount", "shareOfActual", "contributors", "otherAmount", "detailRef", "quality"], "SpendingNatureBucketProjection");
  const shareOfActual = hasOwn(record, "shareOfActual") ? record.shareOfActual : undefined;
  if (shareOfActual !== undefined && (typeof shareOfActual !== "number" || !Number.isFinite(shareOfActual))) {
    throw new TypeError("SpendingNatureBucketProjection.shareOfActual invalide.");
  }
  return {
    segment: parseHistorySpendingSegmentDetailParams(requireProperty(record, "segment", "SpendingNatureBucketProjection")),
    amount: parseMoney(requireProperty(record, "amount", "SpendingNatureBucketProjection")),
    ...(shareOfActual === undefined ? {} : { shareOfActual }),
    contributors: contributorCollectionNodeSchema.parse(requireProperty(record, "contributors", "SpendingNatureBucketProjection")),
    otherAmount: metricMoneyNodeSchema.parse(requireProperty(record, "otherAmount", "SpendingNatureBucketProjection")),
    detailRef: queryTargetRefRuntimeSchema.parse(requireProperty(record, "detailRef", "SpendingNatureBucketProjection")),
    ...(hasOwn(record, "quality") ? { quality: parseQualityEnvelope(record.quality) } : {}),
  };
});
const spendingNatureSegmentsSchema = createDisplayNodeSchema(
  createCollectionValueSchema(spendingNatureBucketProjectionSchema),
);
const newMonthSpendingNatureBaseSchema = monthlySchema<NewMonthSpendingNatureReadModel>(queryResourceKeys.historyMonthSpendingNature, ["actual", "necessity", "behavior", "lifeScope", "matrix", "segments"], "NewMonthSpendingNatureReadModel");
export const newMonthSpendingNatureReadModelSchema = createRuntimeSchema((value: unknown) => {
  const parsed = newMonthSpendingNatureBaseSchema.parse(value);
  return { ...parsed, segments: spendingNatureSegmentsSchema.parse(parsed.segments) };
});
export const monthSpendingNatureReadModelSchema: RuntimeSchema<MonthSpendingNatureReadModel> = newMonthSpendingNatureReadModelSchema;
export const spendingSegmentDetailReadModelSchema = monthlySchema<SpendingSegmentDetailReadModel>(queryResourceKeys.historySpendingSegmentDetail, ["segment", "amount", "contributors", "otherAmount"], "SpendingSegmentDetailReadModel");
export const minimalPreviewReadModelSchema = monthlySchema<MinimalPreviewReadModel>(queryResourceKeys.historyMinimalPreview, ["minimalValue", "preview"], "MinimalPreviewReadModel");
export const monthLifeMoneyReadModelSchema = monthlySchema<MonthLifeMoneyReadModel>(queryResourceKeys.historyMonthLifeMoney, ["activities", "moments", "places"], "MonthLifeMoneyReadModel");
export const activityDetailReadModelSchema = monthlySchema<ActivityDetailReadModel>(queryResourceKeys.historyActivityDetail, ["activity", "occurrences", "frequencyTicket", "causalExpenses", "associatedExpenses"], "ActivityDetailReadModel");
export const momentDetailReadModelSchema = monthlySchema<MomentDetailReadModel>(queryResourceKeys.historyMomentDetail, ["moment", "causalCost", "spentDuring", "causalExpenses", "spentDuringExpenses"], "MomentDetailReadModel");
export const placeDetailReadModelSchema = monthlySchema<PlaceDetailReadModel>(queryResourceKeys.historyPlaceDetail, ["place", "localizedCoverage", "localizedAmount", "presenceDays"], "PlaceDetailReadModel");

export const historyV2MonthBalanceReadModelSchemas = Object.freeze({
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
});
