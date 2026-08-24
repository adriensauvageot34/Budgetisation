import { Temporal } from "@js-temporal/polyfill";
import {
  addDays,
  addMonths,
  compareYearMonth,
  parseLocalDate,
  parseYearMonth,
  yearMonthOf,
  type LocalDate,
  type YearMonth,
} from "@/core/time";
import {
  listCivilMonthDates,
  queryResourceKeys,
  type CalendarDayCell,
  type HistoryCalendarMonthReadModel,
  type HistoryCalendarMonthSummaryReadModel,
} from "@/query-api";
import {
  parseCalendarWeekRef,
  type CalendarWeekRef,
} from "@/navigation";

export type CalendarResourcePlan = {
  readonly resource:
    | typeof queryResourceKeys.historyCalendarMonth
    | typeof queryResourceKeys.historyCalendarMonthSummary;
  readonly months: readonly YearMonth[];
};

export type MonthGridSlot =
  | { readonly kind: "padding"; readonly key: string }
  | { readonly kind: "day"; readonly key: LocalDate; readonly day: CalendarDayCell };

export type CalendarWeekSelection = {
  readonly week: CalendarWeekRef;
  readonly month: YearMonth;
  readonly start: LocalDate;
  readonly end: LocalDate;
  readonly days: readonly [
    CalendarDayCell,
    CalendarDayCell,
    CalendarDayCell,
    CalendarDayCell,
    CalendarDayCell,
    CalendarDayCell,
    CalendarDayCell,
  ];
  readonly resourcePlan: CalendarResourcePlan;
};

export type CalendarWeekRange = {
  readonly week: CalendarWeekRef;
  readonly month: YearMonth;
  readonly start: LocalDate;
  readonly end: LocalDate;
  readonly months: readonly [YearMonth] | readonly [YearMonth, YearMonth];
};

export function selectTwelveCompleteMonthSummaries(
  summaries: readonly HistoryCalendarMonthSummaryReadModel[],
): readonly HistoryCalendarMonthSummaryReadModel[] {
  const complete: HistoryCalendarMonthSummaryReadModel[] = [];
  for (const model of summaries) {
    if (model.summary.periodCompleteness === "complete") complete.push(model);
  }
  complete.sort((left, right) => compareYearMonth(left.month, right.month));
  return complete.slice(-12);
}

export function planTwelveMonthSummaries(lastMonth: YearMonth): CalendarResourcePlan {
  const months: YearMonth[] = [];
  let month = addMonths(parseYearMonth(lastMonth), -11);
  for (let index = 0; index < 12; index += 1) {
    months.push(month);
    month = addMonths(month, 1);
  }
  return {
    resource: queryResourceKeys.historyCalendarMonthSummary,
    months,
  };
}

export function buildMonthGrid(
  model: HistoryCalendarMonthReadModel,
): readonly MonthGridSlot[] {
  const sourceByDate = new Map<LocalDate, CalendarDayCell>();
  for (const day of model.days) sourceByDate.set(day.date, day);
  const dates = listCivilMonthDates(model.month);
  const firstDate = dates[0];
  if (firstDate === undefined) return [];
  const slots: MonthGridSlot[] = [];
  const leading = Temporal.PlainDate.from(firstDate).dayOfWeek - 1;
  for (let index = 0; index < leading; index += 1) {
    slots.push({ kind: "padding", key: `leading-${index}` });
  }
  for (const date of dates) {
    const day = sourceByDate.get(date);
    if (day !== undefined) slots.push({ kind: "day", key: date, day });
  }
  const trailing = (7 - (slots.length % 7)) % 7;
  for (let index = 0; index < trailing; index += 1) {
    slots.push({ kind: "padding", key: `trailing-${index}` });
  }
  return slots;
}

function weekNumber(date: LocalDate): number {
  const value = Temporal.PlainDate.from(date).weekOfYear;
  if (value === undefined) throw new TypeError(`Semaine ISO indisponible pour ${date}.`);
  return value;
}

export function calendarWeekRefFor(date: LocalDate): CalendarWeekRef {
  return parseCalendarWeekRef(`semaine-${String(weekNumber(date)).padStart(2, "0")}`);
}

export function monthGridWeekRefs(
  model: HistoryCalendarMonthReadModel,
): readonly CalendarWeekRef[] {
  const refs: CalendarWeekRef[] = [];
  for (const date of listCivilMonthDates(model.month)) {
    const plain = Temporal.PlainDate.from(date);
    if (plain.dayOfWeek === 1 || refs.length === 0) {
      const ref = calendarWeekRefFor(date);
      if (refs[refs.length - 1] !== ref) refs.push(ref);
    }
  }
  return refs;
}

export function calendarWeekRange(
  month: YearMonth,
  week: CalendarWeekRef,
): CalendarWeekRange {
  const parsedMonth = parseYearMonth(month);
  let anchor: LocalDate | undefined;
  for (const date of listCivilMonthDates(parsedMonth)) {
    if (calendarWeekRefFor(date) === week) {
      anchor = date;
      break;
    }
  }
  if (anchor === undefined) {
    throw new TypeError(`${week} n'appartient pas au mois ${parsedMonth}.`);
  }
  const start = addDays(anchor, -(Temporal.PlainDate.from(anchor).dayOfWeek - 1));
  const end = addDays(start, 6);
  const startMonth = yearMonthOf(start);
  const endMonth = yearMonthOf(end);
  return {
    week,
    month: parsedMonth,
    start,
    end,
    months: startMonth === endMonth ? [startMonth] : [startMonth, endMonth],
  };
}

export function selectCalendarWeek(
  month: YearMonth,
  week: CalendarWeekRef,
  models: readonly HistoryCalendarMonthReadModel[],
): CalendarWeekSelection {
  if (models.length < 1 || models.length > 2) {
    throw new RangeError("Une semaine Calendar exige un ou deux read models mensuels.");
  }
  const sourceByDate = new Map<LocalDate, CalendarDayCell>();
  for (const model of models) {
    for (const day of model.days) sourceByDate.set(day.date, day);
  }
  const range = calendarWeekRange(month, week);
  const selected: CalendarDayCell[] = [];
  for (let index = 0; index < 7; index += 1) {
    const date = addDays(range.start, index);
    const day = sourceByDate.get(date);
    if (day === undefined) {
      throw new TypeError(`Le jour ${date} manque au read model de la semaine.`);
    }
    selected.push(day);
  }
  const months: YearMonth[] = [];
  for (const day of selected) {
    const selectedMonth = yearMonthOf(day.date);
    if (!months.includes(selectedMonth)) months.push(selectedMonth);
  }
  if (months.length > 2) throw new RangeError("Une semaine civile ne peut couvrir plus de deux mois.");
  if (selected.length !== 7) throw new RangeError("Une semaine Calendar exige exactement sept jours.");
  return {
    week,
    month: range.month,
    start: range.start,
    end: range.end,
    days: [
      selected[0]!,
      selected[1]!,
      selected[2]!,
      selected[3]!,
      selected[4]!,
      selected[5]!,
      selected[6]!,
    ],
    resourcePlan: {
      resource: queryResourceKeys.historyCalendarMonth,
      months,
    },
  };
}

export function adjacentWeek(
  start: LocalDate,
  offset: -1 | 1,
): { readonly month: YearMonth; readonly week: CalendarWeekRef } {
  const target = parseLocalDate(addDays(start, offset * 7));
  return { month: yearMonthOf(target), week: calendarWeekRefFor(target) };
}
