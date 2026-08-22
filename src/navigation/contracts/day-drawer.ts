import type { LocalDate, YearMonth } from "../../core/time";
import type { CalendarRouteContext } from "./routes";

export type CalendarMonthRouteContext = Extract<
  CalendarRouteContext,
  { readonly kind: "calendar_month" }
>;

export type CalendarMonthRootContext = {
  readonly area: "calendar";
  readonly context: CalendarMonthRouteContext;
};

export type DayDrawerNavigationState = {
  readonly date: LocalDate;
};

export type DayRouteCanonicalization =
  | {
      readonly kind: "unchanged";
      readonly root: CalendarMonthRootContext;
    }
  | {
      readonly kind: "replace";
      readonly previousMonth: YearMonth;
      readonly root: CalendarMonthRootContext;
    };
