import {
  compareMonthReference,
  computeHistoricalRank,
  computeUsualZone,
  type BankEconomyBridge,
  type CategoryExplanation,
  type FrequencyTicketExplanation,
  type MinimalPreview,
  type SpendingAxis,
  type SpendingNatureMatrix,
  type TypicalCompositionBaseline,
} from "../../analytics/history-v2/month-balance";
import type {
  DisplayNode,
  MetricValue,
  PolicyVersions,
  PublicationMeta,
} from "../../core/history-v2";
import type { ResourceInputHash } from "../../analytics/history-v2";
import type { HouseholdId } from "../../core/identity";
import { addMoney, compareMoney, type Money } from "../../core/money";
import type { YearMonth } from "../../core/time";
import type { QueryCapabilities } from "../capabilities";
import type { ScopedMoneyMetricReadModel } from "../read-models";
import { queryResourceKeys } from "../request";
import type {
  ActivityDetailReadModel,
  ActivityLifeMoneySummary,
  BankEconomyBridgeReadModel,
  CategoryDetailReadModel,
  CategoryMonthSummary,
  MerchantPurchaseExplanation,
  MinimalPreviewReadModel,
  MomentDetailReadModel,
  MomentLifeMoneySummary,
  MonthBalanceSummaryReadModel,
  MonthCategoriesReadModel,
  MonthLifeMoneyReadModel,
  MonthSpendingNatureReadModel,
  PlaceDetailReadModel,
  PlaceLifeMoneySummary,
  SpendingNatureBucketProjection,
  SpendingSegmentDetailReadModel,
} from "./month-balance-types";
import type { CollectionNode, EconomicExpenseSummary, MetricNode, SourceRef } from "./types";

export type MonthBalanceBuilderContext = {
  readonly householdId: HouseholdId;
  readonly month: YearMonth;
  readonly resourceInputHash: ResourceInputHash;
  readonly policyVersions: PolicyVersions;
  readonly publicationMeta?: PublicationMeta;
  readonly capabilities: QueryCapabilities;
  readonly sourceRefs: readonly SourceRef[];
};

function base(context: MonthBalanceBuilderContext) {
  return {
    householdId: context.householdId,
    month: context.month,
    sourceRefs: context.sourceRefs,
    capabilities: context.capabilities,
    resourceInputHash: context.resourceInputHash,
    policyVersions: context.policyVersions,
    ...(context.publicationMeta === undefined ? {} : { publicationMeta: context.publicationMeta }),
  };
}

function visible<T>(data: T): DisplayNode<T> {
  return { visibility: "VISIBLE", data };
}

function knownCollection<T>(items: readonly T[]): CollectionNode<T> {
  return { visibility: "VISIBLE", data: { status: "KNOWN", items, totalCount: items.length } };
}

/**
 * Single adapter from the certified Analysis metric envelope to History V2.
 * Actual, Typical and Minimal stay produced by their existing engines; Bilan
 * only projects their result and never recomputes the monetary value.
 */
export function projectAnalysisMoneyMetric(
  metric: ScopedMoneyMetricReadModel,
): MetricNode<Money> {
  const envelope = metric.envelope;
  if (envelope.availability === "known") {
    return { visibility: "VISIBLE", data: { status: "KNOWN", value: envelope.value } };
  }
  if (envelope.availability === "not_applicable") {
    return { visibility: "HIDDEN", reasonCode: "POLICY_NOT_APPLICABLE" };
  }
  if (envelope.availability === "conflict") {
    return { visibility: "PLACEHOLDER", reasonCode: "DATA_CONFLICTING_AUTHORITIES" };
  }
  return { visibility: "PLACEHOLDER", reasonCode: "DATA_NO_SOURCE" };
}

export function buildMonthBalanceSummaryReadModel(input: {
  readonly context: MonthBalanceBuilderContext;
  readonly actual: MetricNode<Money>;
  readonly typical: MetricNode<Money>;
  readonly minimal: MetricNode<Money>;
  readonly comparableActualsIncludingCurrent: readonly Money[];
  readonly typicalSupportMonths: number;
  readonly importedSummary: MonthBalanceSummaryReadModel["importedSummary"];
}): MonthBalanceSummaryReadModel {
  const actual = input.actual.visibility === "VISIBLE" && input.actual.data.status === "KNOWN" ? input.actual.data.value : undefined;
  const typical = input.typical.visibility === "VISIBLE" && input.typical.data.status === "KNOWN" ? input.typical.data.value : undefined;
  const minimal = input.minimal.visibility === "VISIBLE" && input.minimal.data.status === "KNOWN" ? input.minimal.data.value : undefined;
  const unavailable = (): DisplayNode<MetricValue<never>> => ({ visibility: "PLACEHOLDER", reasonCode: "DATA_NO_SOURCE" });
  return {
    ...base(input.context),
    actualValue: input.actual,
    typicalValue: input.typical,
    minimalValue: input.minimal,
    actualVsTypical: actual === undefined || typical === undefined ? unavailable() : visible({ status: "KNOWN", value: compareMonthReference({ actual, reference: typical }) }),
    actualVsMinimal: actual === undefined || minimal === undefined ? unavailable() : visible({ status: "KNOWN", value: compareMonthReference({ actual, reference: minimal }) }),
    usualZone: typical === undefined ? unavailable() : visible(computeUsualZone({ typical, supportMonths: input.typicalSupportMonths })),
    historicalRank: actual === undefined ? unavailable() : visible(computeHistoricalRank({ current: actual, comparableActualsIncludingCurrent: input.comparableActualsIncludingCurrent })),
    importedSummary: input.importedSummary,
    bridgeRef: { resource: queryResourceKeys.historyBankEconomyBridge, params: {} },
  };
}

export function buildBankEconomyBridgeReadModel(input: { readonly context: MonthBalanceBuilderContext; readonly bridge: BankEconomyBridge }): BankEconomyBridgeReadModel {
  return { ...base(input.context), bridge: input.bridge.visible ? visible(input.bridge) : { visibility: "HIDDEN" } };
}

export function buildMonthCategoriesReadModel(input: { readonly context: MonthBalanceBuilderContext; readonly categories: readonly CategoryMonthSummary[]; readonly otherAmount: MetricNode<Money>; readonly unclassifiedAmount: MetricNode<Money> }): MonthCategoriesReadModel {
  return { ...base(input.context), categories: knownCollection(input.categories), otherAmount: input.otherAmount, unclassifiedAmount: input.unclassifiedAmount };
}

export function buildCategoryDetailReadModel(input: { readonly context: MonthBalanceBuilderContext; readonly category: CategoryMonthSummary; readonly typicalComposition: TypicalCompositionBaseline; readonly explanation: CategoryExplanation; readonly frequencyTicket: FrequencyTicketExplanation; readonly merchantAndPurchaseDrivers: readonly MerchantPurchaseExplanation[]; readonly lifecycleBadges: CategoryDetailReadModel["lifecycleBadges"]; readonly classifications: { readonly necessity: SpendingAxis; readonly behavior: SpendingAxis; readonly lifeScope: SpendingAxis; readonly matrix: SpendingNatureMatrix } }): CategoryDetailReadModel {
  if (input.merchantAndPurchaseDrivers.length > 3) throw new TypeError("Merchant + Purchase explanations sont limitées à trois.");
  const purchaseIds = input.merchantAndPurchaseDrivers.flatMap((driver) => driver.purchaseEventId === undefined ? [] : [driver.purchaseEventId]);
  if (new Set(purchaseIds).size !== purchaseIds.length) throw new TypeError("Un Purchase Event ne peut expliquer deux fois une catégorie.");
  const categoryActual = input.category.actual.status === "KNOWN" || input.category.actual.status === "PARTIAL"
    ? input.category.actual.value
    : undefined;
  for (const [axis, value] of Object.entries({
    necessity: input.classifications.necessity,
    behavior: input.classifications.behavior,
    lifeScope: input.classifications.lifeScope,
  })) {
    if (
      categoryActual !== undefined
      && compareMoney(addMoney(value.classifiedAmount, value.unclassifiedAmount), categoryActual) !== 0
    ) {
      throw new TypeError(`La vue ${axis} doit se réconcilier avec le total de catégorie.`);
    }
  }
  return {
    ...base(input.context),
    category: input.category,
    typicalComposition: visible(input.typicalComposition),
    explanation: input.explanation.visible ? visible(input.explanation) : { visibility: "HIDDEN" },
    frequencyTicket: visible(input.frequencyTicket),
    merchantAndPurchaseDrivers: knownCollection(input.merchantAndPurchaseDrivers),
    lifecycleBadges: input.lifecycleBadges,
    classificationViews: {
      necessity: visible(input.classifications.necessity),
      behavior: visible(input.classifications.behavior),
      lifeScope: visible(input.classifications.lifeScope),
      matrix: visible(input.classifications.matrix),
    },
  };
}

export function buildMonthSpendingNatureReadModel(input: { readonly context: MonthBalanceBuilderContext; readonly actual: MetricNode<Money>; readonly necessity: SpendingAxis; readonly behavior: SpendingAxis; readonly lifeScope: SpendingAxis; readonly matrix: SpendingNatureMatrix; readonly segments: readonly SpendingNatureBucketProjection[] }): MonthSpendingNatureReadModel {
  return { ...base(input.context), actual: input.actual, necessity: visible(input.necessity), behavior: visible(input.behavior), lifeScope: visible(input.lifeScope), matrix: visible(input.matrix), segments: knownCollection(input.segments) };
}

export function buildSpendingSegmentDetailReadModel(input: Omit<SpendingSegmentDetailReadModel, keyof ReturnType<typeof base>> & { readonly context: MonthBalanceBuilderContext }): SpendingSegmentDetailReadModel {
  const { context, ...data } = input;
  return { ...base(context), ...data };
}

export function buildMinimalPreviewReadModel(input: { readonly context: MonthBalanceBuilderContext; readonly minimal: MetricNode<Money>; readonly preview: MinimalPreview }): MinimalPreviewReadModel {
  return { ...base(input.context), minimalValue: input.minimal, preview: visible(input.preview) };
}

export function buildMonthLifeMoneyReadModel(input: { readonly context: MonthBalanceBuilderContext; readonly activities: readonly ActivityLifeMoneySummary[]; readonly moments: readonly MomentLifeMoneySummary[]; readonly places: readonly PlaceLifeMoneySummary[] }): MonthLifeMoneyReadModel {
  return { ...base(input.context), activities: knownCollection(input.activities.slice(0, 6)), moments: knownCollection(input.moments), places: knownCollection(input.places.slice(0, 6)) };
}

function uniqueExpenses(expenses: readonly EconomicExpenseSummary[], field: string): void {
  const ids = expenses.map(({ expenseEventId }) => expenseEventId);
  if (new Set(ids).size !== ids.length) throw new TypeError(`${field} contient un expenseEventId dupliqué.`);
}

export function buildActivityDetailReadModel(input: Omit<ActivityDetailReadModel, keyof ReturnType<typeof base>> & { readonly context: MonthBalanceBuilderContext }): ActivityDetailReadModel {
  const { context, ...data } = input;
  const occurrences = data.occurrences.visibility === "VISIBLE" && (data.occurrences.data.status === "KNOWN" || data.occurrences.data.status === "PARTIAL") ? data.occurrences.data.items : [];
  for (let index = 1; index < occurrences.length; index += 1) {
    const previous = occurrences[index - 1]!;
    const current = occurrences[index]!;
    if (`${previous.effectiveDate}T${previous.effectiveTime ?? ""}` > `${current.effectiveDate}T${current.effectiveTime ?? ""}`) throw new TypeError("Les occurrences Activity Detail doivent être chronologiques.");
  }
  const causal = data.causalExpenses.visibility === "VISIBLE" && (data.causalExpenses.data.status === "KNOWN" || data.causalExpenses.data.status === "PARTIAL") ? data.causalExpenses.data.items : [];
  const associated = data.associatedExpenses.visibility === "VISIBLE" && (data.associatedExpenses.data.status === "KNOWN" || data.associatedExpenses.data.status === "PARTIAL") ? data.associatedExpenses.data.items : [];
  uniqueExpenses(causal, "causalExpenses");
  uniqueExpenses(associated, "associatedExpenses");
  if (causal.some(({ expenseEventId }) => associated.some((expense) => expense.expenseEventId === expenseEventId))) throw new TypeError("Une dépense causale ne doit pas être répétée comme associée.");
  return { ...base(context), ...data };
}

export function buildMomentDetailReadModel(input: Omit<MomentDetailReadModel, keyof ReturnType<typeof base>> & { readonly context: MonthBalanceBuilderContext }): MomentDetailReadModel {
  const { context, ...data } = input;
  return { ...base(context), ...data };
}

export function buildPlaceDetailReadModel(input: Omit<PlaceDetailReadModel, keyof ReturnType<typeof base>> & { readonly context: MonthBalanceBuilderContext }): PlaceDetailReadModel {
  const { context, ...data } = input;
  const days = data.presenceDays.visibility === "VISIBLE" && (data.presenceDays.data.status === "KNOWN" || data.presenceDays.data.status === "PARTIAL") ? data.presenceDays.data.items : [];
  if (days.some((day, index) => index > 0 && days[index - 1]!.date > day.date)) throw new TypeError("Place Detail exige les jours dans l'ordre croissant.");
  return { ...base(context), ...data };
}
