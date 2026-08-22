import { Temporal } from "@js-temporal/polyfill";
import {
  addDays,
  addMonths,
  parseInstant,
  parseLocalDate,
  parseYearMonth,
  yearMonthOf,
} from "./values";
import type {
  GlobalWindow,
  HouseholdTimeZone,
  Instant,
  LocalDate,
  YearMonth,
} from "./types";

export function instantToLocalDate(
  instant: Instant,
  tz: HouseholdTimeZone,
): LocalDate {
  return parseLocalDate(
    Temporal.Instant.from(instant)
      .toZonedDateTimeISO(tz)
      .toPlainDate()
      .toString(),
  );
}

export function instantToYearMonth(
  instant: Instant,
  tz: HouseholdTimeZone,
): YearMonth {
  return yearMonthOf(instantToLocalDate(instant, tz));
}

export function startOfLocalDate(
  date: LocalDate,
  tz: HouseholdTimeZone,
): Instant {
  const zoned = Temporal.PlainDate.from(date).toZonedDateTime({
    timeZone: tz,
    plainTime: "00:00:00",
  });

  if (zoned.toPlainDate().toString() !== date) {
    throw new RangeError(`La date locale ${date} n'existe pas dans ${tz}.`);
  }

  return parseInstant(zoned.toInstant().toString());
}

export function endExclusiveOfLocalDate(
  date: LocalDate,
  tz: HouseholdTimeZone,
): Instant {
  return startOfLocalDate(addDays(date, 1), tz);
}

export function startOfYearMonth(
  month: YearMonth,
  tz: HouseholdTimeZone,
): Instant {
  return startOfLocalDate(parseLocalDate(`${month}-01`), tz);
}

export function endExclusiveOfYearMonth(
  month: YearMonth,
  tz: HouseholdTimeZone,
): Instant {
  return startOfYearMonth(addMonths(month, 1), tz);
}

function previousCompleteMonths(
  asOf: YearMonth,
  count: number,
): readonly YearMonth[] {
  return Array.from({ length: count }, (_, index) =>
    addMonths(asOf, index - count),
  );
}

export function resolveGlobalWindowMonths(
  window: GlobalWindow,
  asOf: YearMonth,
): readonly YearMonth[] {
  switch (window) {
    case "last_12_months":
      return previousCompleteMonths(asOf, 12);
    case "last_6_months":
      return previousCompleteMonths(asOf, 6);
    case "last_3_months":
      return previousCompleteMonths(asOf, 3);
    case "last_complete_summer": {
      const asOfYear = Number(asOf.slice(0, 4));
      const asOfMonth = Number(asOf.slice(5, 7));
      const summerYear = asOfMonth >= 9 ? asOfYear : asOfYear - 1;
      const june = parseYearMonth(`${summerYear.toString().padStart(4, "0")}-06`);
      return [june, addMonths(june, 1), addMonths(june, 2)];
    }
  }
}
