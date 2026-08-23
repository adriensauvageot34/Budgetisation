import { Temporal } from "@js-temporal/polyfill";
import type {
  GlobalWindow,
  HouseholdTimeZone,
  Instant,
  LocalDate,
  YearMonth,
} from "./types";

const yearMonthPattern = /^(\d{4})-(\d{2})$/;
const localDatePattern = /^\d{4}-\d{2}-\d{2}$/;
const instantPattern =
  /^\d{4}-\d{2}-\d{2}[Tt]\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:[Zz]|[+-]\d{2}:\d{2})$/;
const rawOffsetPattern = /^[+-]\d{2}:\d{2}$/;
const globalWindows: ReadonlySet<string> = new Set<GlobalWindow>([
  "last_12_months",
  "last_6_months",
  "last_3_months",
  "last_complete_summer",
]);

export function parseYearMonth(value: unknown): YearMonth {
  if (typeof value !== "string") {
    throw new TypeError("YearMonth doit être une chaîne YYYY-MM.");
  }
  const match = yearMonthPattern.exec(value);
  const month = match ? Number(match[2]) : Number.NaN;
  if (!match || month < 1 || month > 12) {
    throw new TypeError("YearMonth doit être une chaîne YYYY-MM valide.");
  }
  return value as YearMonth;
}

export function formatYearMonth(value: YearMonth): string {
  const parsed = parseYearMonth(value);
  const monthNames = [
    "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
    "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre",
  ] as const;
  return `${monthNames[Number(parsed.slice(5, 7)) - 1]} ${parsed.slice(0, 4)}`;
}

export function compareYearMonth(a: YearMonth, b: YearMonth): -1 | 0 | 1 {
  if (a === b) return 0;
  return a < b ? -1 : 1;
}

export function addMonths(month: YearMonth, delta: number): YearMonth {
  if (!Number.isSafeInteger(delta)) {
    throw new TypeError("Le décalage mensuel doit être un entier sûr.");
  }

  const year = Number(month.slice(0, 4));
  const monthIndex = Number(month.slice(5, 7)) - 1;
  const absoluteMonth = year * 12 + monthIndex + delta;
  if (absoluteMonth < 0) throw new RangeError("YearMonth sort de la plage YYYY-MM.");

  const targetYear = Math.floor(absoluteMonth / 12);
  const targetMonth = (absoluteMonth % 12) + 1;
  if (targetYear > 9999) throw new RangeError("YearMonth sort de la plage YYYY-MM.");

  return parseYearMonth(
    `${targetYear.toString().padStart(4, "0")}-${targetMonth
      .toString()
      .padStart(2, "0")}`,
  );
}

export function parseLocalDate(value: unknown): LocalDate {
  if (typeof value !== "string" || !localDatePattern.test(value)) {
    throw new TypeError("LocalDate doit être une chaîne YYYY-MM-DD.");
  }

  try {
    if (Temporal.PlainDate.from(value).toString() !== value) throw new RangeError();
  } catch {
    throw new TypeError("LocalDate doit être une date grégorienne valide.");
  }

  return value as LocalDate;
}

export function formatLocalDate(value: LocalDate): string {
  return value;
}

export function addDays(date: LocalDate, delta: number): LocalDate {
  if (!Number.isSafeInteger(delta)) {
    throw new TypeError("Le décalage journalier doit être un entier sûr.");
  }
  return parseLocalDate(Temporal.PlainDate.from(date).add({ days: delta }).toString());
}

export function yearMonthOf(date: LocalDate): YearMonth {
  return parseYearMonth(date.slice(0, 7));
}

export function parseGlobalWindow(value: unknown): GlobalWindow {
  if (typeof value !== "string" || !globalWindows.has(value)) {
    throw new TypeError("GlobalWindow doit être une fenêtre prédéfinie valide.");
  }
  return value as GlobalWindow;
}

export function parseInstant(value: unknown): Instant {
  if (typeof value !== "string" || !instantPattern.test(value)) {
    throw new TypeError("Instant doit inclure une date, une heure et un offset.");
  }

  try {
    return Temporal.Instant.from(value).toString() as Instant;
  } catch {
    throw new TypeError("Instant doit être un timestamp ISO 8601 valide.");
  }
}

export function parseHouseholdTimeZone(value: unknown): HouseholdTimeZone {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.trim() !== value ||
    rawOffsetPattern.test(value)
  ) {
    throw new TypeError("HouseholdTimeZone doit être une timezone IANA valide.");
  }

  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value }).format(0);
  } catch {
    throw new TypeError("HouseholdTimeZone doit être une timezone IANA valide.");
  }

  return value as HouseholdTimeZone;
}

export function isHouseholdTimeZone(value: unknown): value is HouseholdTimeZone {
  try {
    parseHouseholdTimeZone(value);
    return true;
  } catch {
    return false;
  }
}
