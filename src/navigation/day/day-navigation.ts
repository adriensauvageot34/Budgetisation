import {
  addDays,
  parseLocalDate,
  parseYearMonth,
  yearMonthOf,
  type LocalDate,
} from "../../core/time";
import { rootNavigationContextSchema, type RootNavigationContext } from "../contracts/routes";
import type {
  CalendarMonthRootContext,
  DayDrawerNavigationState,
  DayRouteCanonicalization,
} from "../contracts/day-drawer";
import type { NavigationHistoryState } from "../contracts/history";

export function buildOpenDayRoot(value: unknown): CalendarMonthRootContext {
  const date = parseLocalDate(value);
  return {
    area: "calendar",
    context: {
      kind: "calendar_month",
      month: yearMonthOf(date),
      day: date,
    },
  };
}

export function getPreviousDay(value: unknown): LocalDate {
  return addDays(parseLocalDate(value), -1);
}

export function getNextDay(value: unknown): LocalDate {
  return addDays(parseLocalDate(value), 1);
}

export function buildPreviousDayRoot(value: unknown): CalendarMonthRootContext {
  return buildOpenDayRoot(getPreviousDay(value));
}

export function buildNextDayRoot(value: unknown): CalendarMonthRootContext {
  return buildOpenDayRoot(getNextDay(value));
}

export function buildCloseDayRoot(
  root: CalendarMonthRootContext,
): CalendarMonthRootContext {
  const parsed = rootNavigationContextSchema.parse(root);
  if (
    !("area" in parsed) ||
    parsed.area !== "calendar" ||
    parsed.context.kind !== "calendar_month"
  ) {
    throw new TypeError("La fermeture Day exige un contexte Calendar Month.");
  }
  return {
    area: "calendar",
    context: { kind: "calendar_month", month: parsed.context.month },
  };
}

export function canonicalizeDayRoute(
  routeMonth: unknown,
  day: unknown,
): DayRouteCanonicalization {
  const previousMonth = parseYearMonth(routeMonth);
  const root = buildOpenDayRoot(day);
  return root.context.month === previousMonth
    ? { kind: "unchanged", root }
    : { kind: "replace", previousMonth, root };
}

export function getDayDrawerNavigationState(
  root: RootNavigationContext,
): DayDrawerNavigationState | null {
  const parsed = rootNavigationContextSchema.parse(root);
  if (
    "area" in parsed &&
    parsed.area === "calendar" &&
    parsed.context.kind === "calendar_month" &&
    parsed.context.day !== undefined
  ) {
    return { date: parsed.context.day };
  }
  return null;
}

export function isDayDrawerSuspended(
  historyState: NavigationHistoryState,
): boolean {
  return (
    historyState.exploration !== null &&
    getDayDrawerNavigationState(historyState.root) !== null
  );
}
