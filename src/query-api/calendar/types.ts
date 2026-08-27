import type {
  LifeEventId,
  MerchantId,
  MomentId,
  OperationId,
  PersonId,
  PlaceId,
  CategoryId,
} from "../../core/identity";
import type { Money } from "../../core/money";
import type { DayContext, LifeScopeContext } from "../../core/scope";
import type {
  HouseholdTimeZone,
  Instant,
  LocalDate,
  YearMonth,
} from "../../core/time";
import type { QueryCapabilities } from "../capabilities";
import type {
  CountMetricEnvelope,
  MoneyMetricEnvelope,
  PeriodCompleteness,
  ReadModelSubject,
} from "../read-models";

export type DayObservability = "observable" | "partial" | "unobserved";

export type DayContextReadModel =
  | { readonly kind: "known"; readonly values: readonly DayContext[] }
  | { readonly kind: "unknown" }
  | { readonly kind: "conflict" };

export type LifeScopeSummary =
  | {
      readonly availability: "known";
      readonly entries: readonly {
        readonly context: LifeScopeContext;
        readonly economicAmount: MoneyMetricEnvelope;
      }[];
    }
  | {
      readonly availability: "unknown" | "conflict";
      readonly entries: readonly [];
    };

export type CalendarMarkerKind =
  | "work"
  | "remote_work"
  | "travel"
  | "driving"
  | "health"
  | "meal"
  | "shopping"
  | "culture"
  | "family"
  | "celebration"
  | "administrative"
  | "home"
  | "place"
  | "moment"
  | "activity"
  | "finance"
  | "other";

export type CalendarExplorationTarget =
  | { readonly kind: "moment"; readonly id: MomentId }
  | { readonly kind: "life_event"; readonly id: LifeEventId }
  | { readonly kind: "place"; readonly id: PlaceId }
  | { readonly kind: "operation"; readonly id: OperationId };

export type CalendarPlaceRef = {
  readonly placeId: PlaceId;
  readonly label: string;
};

export type CalendarDayMarker = {
  readonly id: string;
  readonly kind: CalendarMarkerKind;
  readonly label: string;
  readonly priority: number;
  readonly participantIds: readonly PersonId[];
  readonly startAt?: Instant;
  readonly endAt?: Instant;
  readonly place?: CalendarPlaceRef;
  readonly economicAmount?: MoneyMetricEnvelope;
  readonly target?: CalendarExplorationTarget;
};

export type CalendarSpanningEvent = {
  readonly id: string;
  readonly kind: CalendarMarkerKind;
  readonly label: string;
  readonly priority: number;
  readonly startsOn: LocalDate;
  readonly endsOn: LocalDate;
  readonly participantIds: readonly PersonId[];
  readonly target?: CalendarExplorationTarget;
};

export type CalendarMonthHighlight = {
  readonly id: string;
  readonly kind: CalendarMarkerKind;
  readonly label: string;
  readonly startsOn: LocalDate;
  readonly endsOn: LocalDate;
  readonly participantIds: readonly PersonId[];
  readonly target?: CalendarExplorationTarget;
};

export type CalendarFlag =
  | "has_operations"
  | "has_activity"
  | "has_place_visit"
  | "has_outside_daily_life"
  | "partial_data"
  | "conflict"
  | "incomplete_period";

export type CalendarDayCell = {
  readonly date: LocalDate;
  readonly observability: DayObservability;
  readonly dayContext: DayContextReadModel;
  readonly lifeScopeSummary: LifeScopeSummary;
  readonly economicAmount: MoneyMetricEnvelope;
  readonly operationCount?: CountMetricEnvelope;
  readonly activityOccurrenceCount?: CountMetricEnvelope;
  readonly placeVisitCount?: CountMetricEnvelope;
  readonly markers: readonly CalendarDayMarker[];
  readonly hasDetail: boolean;
  readonly flags: readonly CalendarFlag[];
};

export type CalendarMonthSummary = {
  readonly economicAmount: MoneyMetricEnvelope;
  readonly observableDayCount?: CountMetricEnvelope;
  readonly dayContextCounts?: readonly {
    readonly context: DayContext;
    readonly count: CountMetricEnvelope;
  }[];
  readonly daysWithActivity?: CountMetricEnvelope;
  readonly daysWithPlaceVisit?: CountMetricEnvelope;
  readonly daysOutsideDailyLife?: CountMetricEnvelope;
  readonly periodCompleteness: PeriodCompleteness;
};

export type CalendarMonthNavigation = {
  readonly previous?: YearMonth;
  readonly next?: YearMonth;
};

export type HistoryCalendarMonthReadModel = {
  readonly month: YearMonth;
  readonly timezone: HouseholdTimeZone;
  readonly subject: ReadModelSubject;
  readonly navigation: CalendarMonthNavigation;
  readonly summary: CalendarMonthSummary;
  readonly highlights: readonly CalendarMonthHighlight[];
  readonly spanningEvents: readonly CalendarSpanningEvent[];
  readonly days: readonly CalendarDayCell[];
  readonly capabilities: QueryCapabilities;
};

export type HistoryCalendarMonthSummaryReadModel = {
  readonly month: YearMonth;
  readonly timezone: HouseholdTimeZone;
  readonly subject: ReadModelSubject;
  readonly summary: CalendarMonthSummary;
  readonly capabilities: QueryCapabilities;
};

export type DayHeaderReadModel = {
  readonly date: LocalDate;
  readonly observability: DayObservability;
  readonly dayContext: DayContextReadModel;
  readonly periodCompleteness: PeriodCompleteness;
};

export type DayFinanceReadModel = {
  readonly economicAmount: MoneyMetricEnvelope;
  readonly bankFlowAmount?: MoneyMetricEnvelope;
  readonly causalAmount?: MoneyMetricEnvelope;
  readonly duringAmount?: MoneyMetricEnvelope;
  readonly lifeScopeBreakdown: LifeScopeSummary;
};

export type DayContextsReadModel = {
  readonly dayContext: DayContextReadModel;
  readonly lifeScopeSummary: LifeScopeSummary;
  readonly activitiesPresent: boolean;
  readonly placesPresent: boolean;
};

export type DayOperationPreviewItem = {
  readonly operationId: OperationId;
  readonly bankDate: LocalDate;
  readonly label: string;
  readonly amount: Money;
  readonly categoryId?: CategoryId;
  readonly merchantId?: MerchantId;
  readonly placeId?: PlaceId;
};

export type DayJournalMoment = {
  readonly id: string;
  readonly kind: CalendarMarkerKind;
  readonly label: string;
  readonly startsOn: LocalDate;
  readonly endsOn: LocalDate;
  readonly participantIds: readonly PersonId[];
  readonly startAt?: Instant;
  readonly endAt?: Instant;
  readonly place?: CalendarPlaceRef;
  readonly economicAmount?: MoneyMetricEnvelope;
  readonly operations: readonly DayOperationPreviewItem[];
  readonly target?: CalendarExplorationTarget;
};

export type HistoryDayDetailReadModel = {
  readonly date: LocalDate;
  readonly timezone: HouseholdTimeZone;
  readonly subject: ReadModelSubject;
  readonly header: DayHeaderReadModel;
  readonly finance: DayFinanceReadModel;
  readonly contexts: DayContextsReadModel;
  readonly markers: readonly CalendarDayMarker[];
  readonly moments: readonly DayJournalMoment[];
  readonly unlinkedOperations: readonly DayOperationPreviewItem[];
  readonly capabilities: QueryCapabilities;
};
