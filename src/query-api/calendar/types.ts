import type {
  ActivityOccurrenceValidationStatus,
  PlaceVisitTimePrecision,
} from "../../analytics/facts";
import type {
  ActivityId,
  CategoryId,
  LifeEventId,
  MerchantId,
  OperationId,
  PlaceId,
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
  | {
      readonly kind: "known";
      readonly values: readonly DayContext[];
    }
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

export type HistoryCalendarMonthReadModel = {
  readonly month: YearMonth;
  readonly timezone: HouseholdTimeZone;
  readonly subject: ReadModelSubject;
  readonly summary: CalendarMonthSummary;
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

export type BoundedPreview<T> = {
  readonly items: readonly T[];
  readonly maxItems: number;
  readonly truncated: boolean;
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

export type DayActivityPreviewItem = {
  readonly lifeEventId: LifeEventId;
  readonly activityId?: ActivityId;
  readonly label: string;
  readonly startsOn: LocalDate;
  readonly endsOn: LocalDate;
  readonly validationStatus: ActivityOccurrenceValidationStatus;
  readonly causalAmount?: MoneyMetricEnvelope;
};

export type DayPlaceVisitPreviewItem = {
  readonly placeId: PlaceId;
  readonly visitStart?: Instant;
  readonly visitEnd?: Instant;
  readonly visitState: "known" | "partial" | "unknown";
  readonly timePrecision: PlaceVisitTimePrecision;
  readonly localizedSpend?: MoneyMetricEnvelope;
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

export type HistoryDayDetailReadModel = {
  readonly date: LocalDate;
  readonly timezone: HouseholdTimeZone;
  readonly subject: ReadModelSubject;
  readonly header: DayHeaderReadModel;
  readonly finance: DayFinanceReadModel;
  readonly contexts: DayContextsReadModel;
  readonly activities: BoundedPreview<DayActivityPreviewItem>;
  readonly places: BoundedPreview<DayPlaceVisitPreviewItem>;
  readonly operations: BoundedPreview<DayOperationPreviewItem>;
  readonly capabilities: QueryCapabilities;
};
