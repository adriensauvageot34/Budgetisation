import type {
  ActivityInterestScore,
  BankEconomyBridge,
  CategoryExplanation,
  FrequencyTicketExplanation,
  HistoricalRank,
  ImportedSummaryFreshness,
  MinimalPreview,
  MonthReferenceComparison,
  PlaceSignificanceScore,
  SpendingAxis,
  SpendingNatureMatrix,
  TypicalCompositionBaseline,
  UsualZone,
} from "../../analytics/history-v2/month-balance";
import type { DisplayNode, MetricValue, QualityEnvelope } from "../../core/history-v2";
import type { HouseholdId } from "../../core/identity";
import type { Money } from "../../core/money";
import type { LocalDate, YearMonth } from "../../core/time";
import type { QueryCapabilities } from "../capabilities";
import type {
  CollectionNode,
  EconomicExpenseSummary,
  HistoryV2ReadModelMeta,
  MetricNode,
  QueryTargetRef,
  SourceRef,
} from "./types";

export type HistoryV2MonthlyBase = HistoryV2ReadModelMeta & {
  readonly householdId: HouseholdId;
  readonly month: YearMonth;
  readonly sourceRefs: readonly SourceRef[];
  readonly capabilities: QueryCapabilities;
  readonly quality?: QualityEnvelope;
};

export type ImportedSummaryStatus = {
  readonly freshness: ImportedSummaryFreshness;
  readonly text?: string;
};

export type MonthBalanceSummaryReadModel = HistoryV2MonthlyBase & {
  readonly actualValue: MetricNode<Money>;
  readonly typicalValue: MetricNode<Money>;
  readonly minimalValue: MetricNode<Money>;
  readonly actualVsTypical: DisplayNode<MetricValue<MonthReferenceComparison>>;
  readonly actualVsMinimal: DisplayNode<MetricValue<MonthReferenceComparison>>;
  readonly usualZone: DisplayNode<MetricValue<UsualZone>>;
  readonly historicalRank: DisplayNode<MetricValue<HistoricalRank>>;
  readonly importedSummary: ImportedSummaryStatus;
  readonly bridgeRef: QueryTargetRef;
};

export type BankEconomyBridgeReadModel = HistoryV2MonthlyBase & {
  readonly bridge: DisplayNode<BankEconomyBridge>;
};

export type CategoryMonthSummary = {
  readonly categoryId: string;
  readonly label: string;
  readonly actual: MetricValue<Money>;
  readonly shareOfActual: MetricValue<number>;
  readonly typical: MetricValue<Money>;
  readonly delta: MetricValue<Money>;
  readonly material: boolean;
  readonly detailRef: QueryTargetRef;
  readonly sourceRefs: readonly SourceRef[];
};

export type MonthCategoriesReadModel = HistoryV2MonthlyBase & {
  readonly categories: CollectionNode<CategoryMonthSummary>;
  readonly otherAmount: MetricNode<Money>;
  readonly unclassifiedAmount: MetricNode<Money>;
};

export type MerchantPurchaseExplanation = {
  readonly explanationId: string;
  readonly kind: "MERCHANT" | "PURCHASE_EVENT";
  readonly label: string;
  readonly amount: Money;
  readonly contribution: Money;
  readonly rankBadge?: 1 | 2 | 3 | 4 | 5;
  readonly purchaseEventId?: string;
  readonly sourceRefs: readonly SourceRef[];
};

export type CategoryDetailReadModel = HistoryV2MonthlyBase & {
  readonly category: CategoryMonthSummary;
  readonly typicalComposition: DisplayNode<TypicalCompositionBaseline>;
  readonly explanation: DisplayNode<CategoryExplanation>;
  readonly frequencyTicket: DisplayNode<FrequencyTicketExplanation>;
  readonly merchantAndPurchaseDrivers: CollectionNode<MerchantPurchaseExplanation>;
  readonly lifecycleBadges: readonly { readonly stableId: string; readonly lifecycle: "NEW" | "REAPPEARED" }[];
  /** Server-prepared M3 projections for the three independent category tabs. */
  readonly classificationViews: {
    readonly necessity: DisplayNode<SpendingAxis>;
    readonly behavior: DisplayNode<SpendingAxis>;
    readonly lifeScope: DisplayNode<SpendingAxis>;
    readonly matrix: DisplayNode<SpendingNatureMatrix>;
  };
};

export type OldMonthSpendingNatureReadModel = HistoryV2MonthlyBase & {
  readonly actual: MetricNode<Money>;
  readonly necessity: DisplayNode<SpendingAxis>;
  readonly behavior: DisplayNode<SpendingAxis>;
  readonly lifeScope: DisplayNode<SpendingAxis>;
  readonly matrix: DisplayNode<SpendingNatureMatrix>;
};

export type SpendingContributor = {
  readonly contributorId: string;
  readonly grain: "SUBCATEGORY" | "CATEGORY";
  readonly label: string;
  readonly amount: Money;
  readonly sourceRefs: readonly SourceRef[];
};

export type SpendingSegment = {
  readonly axis?: "necessity" | "behavior" | "lifeScope";
  readonly bucket?: string;
  readonly necessity?: string;
  readonly behavior?: string;
};

export type SpendingNatureBucketProjection = {
  readonly segment: SpendingSegment;
  readonly amount: Money;
  readonly shareOfActual?: number;
  readonly contributors: CollectionNode<SpendingContributor>;
  readonly otherAmount: MetricNode<Money>;
  readonly detailRef: QueryTargetRef;
  readonly quality?: QualityEnvelope;
};

export type NewMonthSpendingNatureReadModel = OldMonthSpendingNatureReadModel & {
  readonly segments: CollectionNode<SpendingNatureBucketProjection>;
};

export type MonthSpendingNatureReadModel =
  | OldMonthSpendingNatureReadModel
  | NewMonthSpendingNatureReadModel;

export type SpendingSegmentDetailReadModel = HistoryV2MonthlyBase & {
  readonly segment: SpendingSegment;
  readonly amount: MetricNode<Money>;
  readonly contributors: CollectionNode<SpendingContributor>;
  readonly otherAmount: MetricNode<Money>;
};

export type MinimalPreviewReadModel = HistoryV2MonthlyBase & {
  readonly minimalValue: MetricNode<Money>;
  readonly preview: DisplayNode<MinimalPreview>;
};

export type ActivityLifeMoneySummary = ActivityInterestScore & {
  readonly label: string;
  readonly costKind: "CAUSAL" | "ASSOCIATED" | "NONE";
  readonly cost: MetricValue<Money>;
  readonly detailRef: QueryTargetRef;
  readonly sourceRefs: readonly SourceRef[];
};

export type MomentLifeMoneySummary = {
  readonly momentId: string;
  readonly title: string;
  readonly startDate: LocalDate;
  readonly endDate?: LocalDate;
  readonly highlightRank?: 1 | 2 | 3 | 4 | 5;
  readonly causalCost: MetricValue<Money>;
  readonly imageRef?: string;
  readonly fallbackIconKey: string;
  readonly detailRef: QueryTargetRef;
  readonly sourceRefs: readonly SourceRef[];
};

export type PlaceLifeMoneySummary = PlaceSignificanceScore & {
  readonly label: string;
  readonly localizedAmount: MetricValue<Money>;
  readonly detailRef: QueryTargetRef;
  readonly sourceRefs: readonly SourceRef[];
};

export type MonthLifeMoneyReadModel = HistoryV2MonthlyBase & {
  readonly activities: CollectionNode<ActivityLifeMoneySummary>;
  readonly moments: CollectionNode<MomentLifeMoneySummary>;
  readonly places: CollectionNode<PlaceLifeMoneySummary>;
};

export type ActivityOccurrenceDetail = {
  readonly occurrenceId: string;
  readonly effectiveDate: LocalDate;
  readonly effectiveTime?: string;
  readonly momentIds: readonly string[];
  readonly placeIds: readonly string[];
  readonly categoryIds: readonly string[];
  readonly sourceRefs: readonly SourceRef[];
};

export type ActivityDetailReadModel = HistoryV2MonthlyBase & {
  readonly activity: ActivityLifeMoneySummary;
  readonly occurrences: CollectionNode<ActivityOccurrenceDetail>;
  readonly frequencyTicket: DisplayNode<FrequencyTicketExplanation>;
  readonly causalExpenses: CollectionNode<EconomicExpenseSummary>;
  readonly associatedExpenses: CollectionNode<EconomicExpenseSummary>;
};

export type MomentDetailReadModel = HistoryV2MonthlyBase & {
  readonly moment: MomentLifeMoneySummary;
  readonly causalCost: MetricNode<Money>;
  readonly spentDuring: MetricNode<Money>;
  readonly causalExpenses: CollectionNode<EconomicExpenseSummary>;
  readonly spentDuringExpenses: CollectionNode<EconomicExpenseSummary>;
};

export type PlacePresenceDay = {
  readonly date: LocalDate;
  readonly presenceCount: number;
  readonly sourceRefs: readonly SourceRef[];
};

export type PlaceDetailReadModel = HistoryV2MonthlyBase & {
  readonly place: PlaceLifeMoneySummary;
  readonly localizedCoverage: MetricValue<number>;
  readonly localizedAmount: MetricNode<Money>;
  readonly presenceDays: CollectionNode<PlacePresenceDay>;
};
