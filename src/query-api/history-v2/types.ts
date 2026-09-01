import type { QueryCapabilities } from "../capabilities";
import type { QueryResourceKey } from "../request";
import type { ResourceInputHash } from "../../analytics/history-v2";
import type { HouseholdId } from "../../core/identity";
import type {
  CollectionValue,
  CalendarFilterTag,
  DisplayNode,
  MetricValue,
  PolicyVersions,
  PublicationMeta,
  QualityEnvelope,
} from "../../core/history-v2";
import type { Money } from "../../core/money";
import type {
  HouseholdTimeZone,
  LocalDate,
  YearMonth,
} from "../../core/time";

export type SourceRef = {
  readonly kind: string;
  readonly id: string;
};

export type QueryTargetRef = {
  readonly resource: QueryResourceKey;
  readonly params: Readonly<Record<string, string>>;
};

export type MetricNode<T> = DisplayNode<MetricValue<T>>;
export type CollectionNode<T> = DisplayNode<CollectionValue<T>>;

/**
 * A read-only draft exposes only an internal per-resource input digest.
 * PublicationMeta is present only after the snapshot lot has allocated the
 * immutable monthly publication and its Household-scoped common factsHash.
 */
export type HistoryV2ReadModelMeta = {
  readonly resourceInputHash: ResourceInputHash;
  readonly policyVersions: PolicyVersions;
  readonly publicationMeta?: PublicationMeta;
};

export type PersonContextSummary = {
  readonly personId: string;
  readonly displayInitial: string;
  readonly contextTypeKey: string;
  readonly label: string;
  readonly iconKey: string;
  readonly sourceRefs: readonly SourceRef[];
  readonly quality?: QualityEnvelope;
};

export type CalendarItemSummary = {
  readonly calendarItemId: string;
  readonly semanticTypeKey: string;
  readonly title: string;
  readonly iconKey: string;
  readonly renderMode: "Context" | "Marker" | "Ribbon" | "DetailOnly";
  readonly markerTier?: "Dominant" | "Standard" | "Secondary";
  readonly priorityBand: 1 | 2 | 3 | 4 | 5;
  readonly priorityWeight: number;
  readonly dateLabel?: string;
  readonly startTime?: string;
  readonly participantIds: readonly string[];
  readonly externalParticipants: readonly string[];
  readonly sourceRefs: readonly SourceRef[];
  readonly filterTags: readonly CalendarFilterTag[];
  readonly itemKind: "LIFE" | "ECONOMIC";
  readonly targetRef?: QueryTargetRef;
  readonly quality?: QualityEnvelope;
};

export type EconomicExpenseSummary = {
  readonly expenseEventId: string;
  readonly economicDate: LocalDate;
  readonly label: string;
  readonly eventKind: "PURCHASE_EVENT" | "CASH_USE" | "ECONOMIC_CHARGE";
  readonly amount: Money;
  readonly sourceRefs: readonly SourceRef[];
  readonly merchantLabel?: string;
  readonly effectiveTime?: string;
  readonly placeLabel?: string;
  readonly narrativeOwnerId?: string;
  readonly quality?: QualityEnvelope;
};

export type UnassignedEconomicExpenseSummary = Omit<EconomicExpenseSummary, "economicDate">;

export type DayHoverReadModel = {
  readonly date: LocalDate;
  readonly economicAmount: MetricNode<Money>;
  readonly economicAmountExcludingFixed: MetricNode<Money>;
  readonly contexts: CollectionNode<PersonContextSummary>;
  readonly calendarEvents: CollectionNode<CalendarItemSummary>;
  readonly activeRibbons: CollectionNode<CalendarItemSummary>;
  readonly economicExpenses: CollectionNode<EconomicExpenseSummary>;
  readonly hiddenExpenseCount: MetricValue<number>;
  readonly sourceRefs: readonly SourceRef[];
  readonly quality?: QualityEnvelope;
};

export type MonthWeekRow = {
  readonly weekStart: LocalDate;
  readonly weekEnd: LocalDate;
  readonly dayDates: readonly [
    LocalDate,
    LocalDate,
    LocalDate,
    LocalDate,
    LocalDate,
    LocalDate,
    LocalDate,
  ];
};

export type MonthCalendarDayReadModel = {
  readonly date: LocalDate;
  readonly inSelectedMonth: boolean;
  readonly targetMonth: YearMonth;
  readonly economicAmount: MetricNode<Money>;
  readonly economicAmountExcludingFixed: MetricNode<Money>;
  readonly personContexts: Readonly<Record<string, DisplayNode<PersonContextSummary>>>;
  readonly orderedMarkerGroups: CollectionValue<CalendarItemSummary>;
  readonly visibleMarkers: readonly CalendarItemSummary[];
  readonly hiddenMarkerCount: MetricValue<number>;
  readonly activeRibbonItemIds: readonly string[];
  readonly hover: DisplayNode<DayHoverReadModel>;
  readonly journalRef: QueryTargetRef;
  readonly sourceRefs: readonly SourceRef[];
  readonly quality?: QualityEnvelope;
};

export type RibbonSegmentReadModel = {
  readonly calendarItemId: string;
  readonly weekStart: LocalDate;
  readonly startColumn: number;
  readonly endColumn: number;
  readonly lane: 1 | 2 | 3 | 4;
  readonly title: string;
  readonly iconKey: string;
  readonly eventStartDate: LocalDate;
  readonly eventEndDate: LocalDate;
  readonly targetRef: QueryTargetRef;
  readonly sourceRefs: readonly SourceRef[];
};

export type RibbonOverflowReadModel = {
  readonly weekStart: LocalDate;
  readonly count: number;
  readonly items: readonly RibbonOverflowItemReadModel[];
};

export type RibbonOverflowItemReadModel = {
  readonly calendarItemId: string;
  readonly title: string;
  readonly iconKey: string;
  readonly segmentStart: LocalDate;
  readonly segmentEnd: LocalDate;
  readonly targetRef: QueryTargetRef;
  readonly sourceRefs: readonly SourceRef[];
};

export type MonthCalendarReadModel = HistoryV2ReadModelMeta & {
  readonly householdId: HouseholdId;
  readonly month: YearMonth;
  readonly timeZone: HouseholdTimeZone;
  readonly gridStartDate: LocalDate;
  readonly gridEndDate: LocalDate;
  readonly weeks: readonly MonthWeekRow[];
  readonly daysByDate: Readonly<Record<string, MonthCalendarDayReadModel>>;
  readonly ribbonSegments: CollectionValue<RibbonSegmentReadModel>;
  readonly ribbonOverflow: CollectionValue<RibbonOverflowReadModel>;
  readonly unassignedTiming: DisplayNode<MonthUnassignedTimingSummary>;
  readonly quickOverviewRef: QueryTargetRef;
  readonly sourceRefs: readonly SourceRef[];
  readonly capabilities: QueryCapabilities;
  readonly quality?: QualityEnvelope;
};

export type MonthUnassignedTimingSummary = {
  readonly count: MetricValue<number>;
  readonly amount: MetricNode<Money>;
  readonly topExpenses: CollectionNode<UnassignedEconomicExpenseSummary>;
  readonly hiddenCount: MetricValue<number>;
  readonly sourceRefs: readonly SourceRef[];
};

export type WeekDayReadModel = Omit<
  MonthCalendarDayReadModel,
  "inSelectedMonth" | "targetMonth" | "visibleMarkers"
> & {
  readonly inReferenceMonth: boolean;
  readonly visibleMarkers: readonly CalendarItemSummary[];
};

export type WeekReadModel = HistoryV2ReadModelMeta & {
  readonly householdId: HouseholdId;
  readonly weekStart: LocalDate;
  readonly weekEnd: LocalDate;
  readonly referenceMonth: YearMonth;
  readonly days: readonly [
    WeekDayReadModel,
    WeekDayReadModel,
    WeekDayReadModel,
    WeekDayReadModel,
    WeekDayReadModel,
    WeekDayReadModel,
    WeekDayReadModel,
  ];
  readonly ribbonSegments: CollectionValue<RibbonSegmentReadModel>;
  readonly ribbonOverflow: CollectionValue<RibbonOverflowReadModel>;
  readonly sourceRefs: readonly SourceRef[];
  readonly capabilities: QueryCapabilities;
  readonly quality?: QualityEnvelope;
};

export type ParticipantSummary = {
  readonly participantId: string;
  readonly label: string;
  readonly kind: "HOUSEHOLD" | "EXTERNAL";
  readonly sourceRefs: readonly SourceRef[];
};

export type JournalTimelineItem = {
  readonly calendarItemId: string;
  readonly title: string;
  readonly iconKey: string;
  readonly startTime?: string;
  readonly dateLabel?: string;
  readonly participants: readonly ParticipantSummary[];
  readonly placeLabel?: string;
  readonly moment?: JournalMomentSummary;
  readonly sourceRefs: readonly SourceRef[];
  readonly quality?: QualityEnvelope;
};

export type JournalMomentSummary = {
  readonly momentId: string;
  readonly causalCost: MetricNode<Money>;
  readonly spentDuring: MetricNode<Money>;
  readonly causalExpenses: CollectionNode<EconomicExpenseSummary>;
  readonly hiddenCausalExpenseCount: MetricValue<number>;
  readonly detailRef: QueryTargetRef;
};

export type JournalContinuousEvent = {
  readonly calendarItemId: string;
  readonly title: string;
  readonly iconKey: string;
  readonly startDate: LocalDate;
  readonly endDate: LocalDate;
  readonly sourceRefs: readonly SourceRef[];
  readonly quality?: QualityEnvelope;
};

export type RefundMovementSummary = {
  readonly movementId: string;
  readonly date: LocalDate;
  readonly label: string;
  readonly amount: Money;
  readonly relatedExpenseEventId?: string;
  readonly sourceRefs: readonly SourceRef[];
};

export type BankInflowSummary = {
  readonly movementId: string;
  readonly date: LocalDate;
  readonly label: string;
  readonly amount: Money;
  readonly sourceRefs: readonly SourceRef[];
};

export type TechnicalMovementSummary = {
  readonly movementId: string;
  readonly date: LocalDate;
  readonly label: string;
  readonly movementKind: "TRANSFER" | "CARD_PAYMENT" | "CASH_WITHDRAWAL" | "OTHER_TECHNICAL";
  readonly amount: Money;
  readonly sourceRefs: readonly SourceRef[];
};

export type JournalDayReadModel = HistoryV2ReadModelMeta & {
  readonly householdId: HouseholdId;
  readonly date: LocalDate;
  readonly economicAmount: MetricNode<Money>;
  readonly dayParticipants: CollectionNode<ParticipantSummary>;
  readonly contexts: CollectionNode<PersonContextSummary>;
  readonly activeContinuousEvents: CollectionNode<JournalContinuousEvent>;
  readonly timedTimeline: CollectionNode<JournalTimelineItem>;
  readonly untimedEvents: CollectionNode<JournalTimelineItem>;
  readonly otherMovements: {
    readonly otherExpenses: CollectionNode<EconomicExpenseSummary>;
    readonly refundsAndAdjustments: CollectionNode<RefundMovementSummary>;
    readonly inflows: CollectionNode<BankInflowSummary>;
    readonly technicalMovements: CollectionNode<TechnicalMovementSummary>;
  };
  readonly navigation: {
    readonly previousDate: LocalDate;
    readonly previousRef: QueryTargetRef;
    readonly nextDate: LocalDate;
    readonly nextRef: QueryTargetRef;
  };
  readonly sourceRefs: readonly SourceRef[];
  readonly capabilities: QueryCapabilities;
  readonly quality?: QualityEnvelope;
};

export type MonthOverviewFlows = {
  readonly bankOutflows: MetricNode<Money>;
  readonly economicActual: MetricNode<Money>;
  readonly bankInflows: MetricNode<Money>;
};

export type LifeMarkerFamily =
  | "TRAVEL_STAY"
  | "IMPORTANT_VISITS"
  | "DRIVING"
  | "LEAVE_REST"
  | "WORK_RHYTHM";

export type LifeMarkerReadModel = {
  readonly family: LifeMarkerFamily;
  readonly label: string;
  readonly primaryValue: MetricNode<number>;
  readonly unit: "DAY" | "SESSION";
  readonly secondaryBreakdown?: Readonly<Record<string, number>>;
  readonly sourceRefs: readonly SourceRef[];
  readonly quality?: QualityEnvelope;
};

export type MonthHighlightReadModel = {
  readonly highlightId: string;
  readonly narrativeClass: 1 | 2 | 3;
  readonly calendarItemId?: string;
  readonly title: string;
  readonly dateLabel: string;
  readonly iconKey: string;
  readonly imageRef?: string;
  readonly participantIds?: readonly string[];
  readonly placeLabel?: string;
  readonly causalCost: MetricNode<Money>;
  readonly startDate: LocalDate;
  readonly endDate?: LocalDate;
  readonly sourceRefs: readonly SourceRef[];
  readonly quality?: QualityEnvelope;
};

export type EventNarrativeCard = {
  readonly cardId: string;
  readonly kind: "EVENT";
  readonly title: string;
  readonly startDate: LocalDate;
  readonly endDate?: LocalDate;
  readonly placeLabel?: string;
  readonly iconKey: string;
  readonly imageRef?: string;
  readonly causalCost: MetricNode<Money>;
  readonly targetRef: QueryTargetRef;
  readonly sourceRefs: readonly SourceRef[];
  readonly quality?: QualityEnvelope;
};

export type PlaceNarrativeCard = {
  readonly cardId: string;
  readonly kind: "PLACE";
  readonly title: string;
  readonly presenceDays?: number;
  readonly visitCount?: number;
  readonly localizedAmount: MetricNode<Money>;
  readonly iconKey: string;
  readonly imageRef?: string;
  readonly targetRef: QueryTargetRef;
  readonly sourceRefs: readonly SourceRef[];
  readonly quality?: QualityEnvelope;
};

export type MonthNarrativeCard = EventNarrativeCard | PlaceNarrativeCard;

export type MonthQuickOverviewReadModel = HistoryV2ReadModelMeta & {
  readonly householdId: HouseholdId;
  readonly month: YearMonth;
  readonly flows: MonthOverviewFlows;
  readonly lifeMarkers: CollectionNode<LifeMarkerReadModel>;
  readonly highlights: CollectionNode<MonthHighlightReadModel>;
  readonly narrativeCarousel: CollectionNode<MonthNarrativeCard>;
  readonly totalEligibleHighlights: MetricValue<number>;
  readonly sourceRefs: readonly SourceRef[];
  readonly capabilities: QueryCapabilities;
  readonly quality?: QualityEnvelope;
};
