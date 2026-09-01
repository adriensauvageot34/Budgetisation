import type { LocalDate, YearMonth } from "@/core/time";
import type { CalendarFilterSelection } from "@/core/history-v2";
import type {
  MonthCalendarReadModel,
  MonthQuickOverviewReadModel,
  WeekReadModel,
  HistorySpendingSegmentDetailParams,
} from "@/query-api";
import type { UiTransportState } from "@/ui";

export type HistoryV2View = "calendar";

export type HistoryCalendarFilterState = CalendarFilterSelection;

export const historyTransientDismissEvent = "history-v2:dismiss-transient";

export type HistoryV2InitialState =
  | { readonly kind: "calendar"; readonly state: UiTransportState<MonthCalendarReadModel>; readonly overview: UiTransportState<MonthQuickOverviewReadModel> }
  | { readonly kind: "week"; readonly weekStart: LocalDate; readonly state: UiTransportState<WeekReadModel>; readonly overview: UiTransportState<MonthQuickOverviewReadModel> };

export type HistoryOverlayTarget =
  | { readonly kind: "journal"; readonly date: LocalDate }
  | { readonly kind: "bridge" }
  | { readonly kind: "category"; readonly categoryId: string }
  | { readonly kind: "segment"; readonly params: HistorySpendingSegmentDetailParams }
  | { readonly kind: "activity"; readonly activityTypeKey: string }
  | { readonly kind: "moment"; readonly momentId: string }
  | { readonly kind: "place"; readonly placeId: string };

export type HistoryRouteContext = {
  readonly month: YearMonth;
  readonly view: HistoryV2View;
  readonly weekStart?: LocalDate;
};
