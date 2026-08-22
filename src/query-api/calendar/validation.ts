import {
  parseActivityId,
  parseCategoryId,
  parseLifeEventId,
  parseMerchantId,
  parseOperationId,
  parsePlaceId,
} from "../../core/identity";
import { parseMoney } from "../../core/money";
import {
  parseDayContext,
  parseLifeScopeContext,
  type DayContext,
  type LifeScopeContext,
} from "../../core/scope";
import {
  parseHouseholdTimeZone,
  parseInstant,
  parseLocalDate,
  parseYearMonth,
  yearMonthOf,
} from "../../core/time";
import {
  hasOwn,
  parseStrictRecord,
  parseStringLiteral,
  requireProperty,
} from "../../core/validation";
import { parseQueryCapabilities } from "../capabilities";
import { queryResourceKeys } from "../request";
import {
  parseCountEnvelope,
  parseMoneyEnvelope,
  parsePeriodCompleteness,
  parseReadModelSubject,
} from "../read-models";
import { listCivilMonthDates } from "./dates";
import type {
  BoundedPreview,
  CalendarDayCell,
  CalendarFlag,
  CalendarMonthSummary,
  DayActivityPreviewItem,
  DayContextReadModel,
  DayContextsReadModel,
  DayFinanceReadModel,
  DayHeaderReadModel,
  DayObservability,
  DayOperationPreviewItem,
  DayPlaceVisitPreviewItem,
  HistoryCalendarMonthReadModel,
  HistoryCalendarMonthSummaryReadModel,
  HistoryDayDetailReadModel,
  LifeScopeSummary,
} from "./types";

const observabilityValues: ReadonlySet<string> = new Set<DayObservability>([
  "observable",
  "partial",
  "unobserved",
]);
const dayContextOrder: readonly DayContext[] = [
  "work_onsite",
  "remote",
  "weekend_home",
  "leave_home",
];
const lifeScopeOrder: readonly LifeScopeContext[] = [
  "Vie courante",
  "Hors quotidien",
];
const calendarFlagOrder: readonly CalendarFlag[] = [
  "has_operations",
  "has_activity",
  "has_place_visit",
  "has_outside_daily_life",
  "partial_data",
  "conflict",
  "incomplete_period",
];
const validationStatuses: ReadonlySet<string> = new Set(["Confirmé", "Déduit"]);
const visitStates: ReadonlySet<string> = new Set(["known", "partial", "unknown"]);
const timePrecisions: ReadonlySet<string> = new Set([
  "exact",
  "approximate",
  "time_range",
  "unknown",
]);

function parseBoolean(value: unknown, name: string): boolean {
  if (typeof value !== "boolean") throw new TypeError(`${name} doit être booléen.`);
  return value;
}

function parseNonEmptyLabel(value: unknown, name: string): string {
  if (typeof value !== "string" || value.trim().length === 0 || value !== value.trim()) {
    throw new TypeError(`${name} doit être une chaîne non vide normalisée.`);
  }
  return value;
}

function parseDayObservability(value: unknown): DayObservability {
  return parseStringLiteral<DayObservability>(
    value,
    observabilityValues,
    "DayObservability",
  );
}

function assertUniqueOrdered<T extends string>(
  values: readonly T[],
  order: readonly T[],
  name: string,
): void {
  if (new Set(values).size !== values.length) {
    throw new TypeError(`${name} contient des doublons.`);
  }
  let previous = -1;
  for (const value of values) {
    const current = order.indexOf(value);
    if (current < 0 || current <= previous) {
      throw new TypeError(`${name} n'est pas ordonné contractuellement.`);
    }
    previous = current;
  }
}

export function parseDayContextReadModel(value: unknown): DayContextReadModel {
  const candidate = parseStrictRecord(value, ["kind", "values"], "DayContextReadModel");
  const kind = requireProperty(candidate, "kind", "DayContextReadModel");
  if (kind === "known") {
    const record = parseStrictRecord(value, ["kind", "values"], "DayContextReadModel");
    const rawValues = requireProperty(record, "values", "DayContextReadModel");
    if (!Array.isArray(rawValues)) {
      throw new TypeError("DayContextReadModel.values doit être un tableau.");
    }
    const values = rawValues.map(parseDayContext);
    assertUniqueOrdered(values, dayContextOrder, "DayContextReadModel.values");
    return { kind, values };
  }
  if (kind === "unknown" || kind === "conflict") {
    parseStrictRecord(value, ["kind"], "DayContextReadModel");
    return { kind };
  }
  throw new TypeError("DayContextReadModel.kind est invalide.");
}

export function parseLifeScopeSummary(value: unknown): LifeScopeSummary {
  const record = parseStrictRecord(
    value,
    ["availability", "entries"],
    "LifeScopeSummary",
  );
  const availability = requireProperty(record, "availability", "LifeScopeSummary");
  const rawEntries = requireProperty(record, "entries", "LifeScopeSummary");
  if (!Array.isArray(rawEntries)) {
    throw new TypeError("LifeScopeSummary.entries doit être un tableau.");
  }
  if (availability === "unknown" || availability === "conflict") {
    if (rawEntries.length !== 0) {
      throw new TypeError("LifeScopeSummary indisponible ne porte aucune entrée.");
    }
    return { availability, entries: [] };
  }
  if (availability !== "known") {
    throw new TypeError("LifeScopeSummary.availability est invalide.");
  }
  const entries = rawEntries.map((entry) => {
    const item = parseStrictRecord(
      entry,
      ["context", "economicAmount"],
      "LifeScopeSummary.entry",
    );
    return {
      context: parseLifeScopeContext(
        requireProperty(item, "context", "LifeScopeSummary.entry"),
      ),
      economicAmount: parseMoneyEnvelope(
        requireProperty(item, "economicAmount", "LifeScopeSummary.entry"),
      ),
    };
  });
  assertUniqueOrdered(
    entries.map(({ context }) => context),
    lifeScopeOrder,
    "LifeScopeSummary.entries",
  );
  return { availability, entries };
}

function parseCalendarFlags(value: unknown): readonly CalendarFlag[] {
  if (!Array.isArray(value)) throw new TypeError("CalendarDayCell.flags doit être un tableau.");
  const flags = value.map((flag) =>
    parseStringLiteral<CalendarFlag>(
      flag,
      new Set(calendarFlagOrder),
      "CalendarFlag",
    ),
  );
  assertUniqueOrdered(flags, calendarFlagOrder, "CalendarDayCell.flags");
  return flags;
}

export function parseCalendarDayCell(value: unknown): CalendarDayCell {
  const record = parseStrictRecord(
    value,
    [
      "date",
      "observability",
      "dayContext",
      "lifeScopeSummary",
      "economicAmount",
      "operationCount",
      "activityOccurrenceCount",
      "placeVisitCount",
      "hasDetail",
      "flags",
    ],
    "CalendarDayCell",
  );
  return {
    date: parseLocalDate(requireProperty(record, "date", "CalendarDayCell")),
    observability: parseDayObservability(
      requireProperty(record, "observability", "CalendarDayCell"),
    ),
    dayContext: parseDayContextReadModel(
      requireProperty(record, "dayContext", "CalendarDayCell"),
    ),
    lifeScopeSummary: parseLifeScopeSummary(
      requireProperty(record, "lifeScopeSummary", "CalendarDayCell"),
    ),
    economicAmount: parseMoneyEnvelope(
      requireProperty(record, "economicAmount", "CalendarDayCell"),
    ),
    ...(hasOwn(record, "operationCount")
      ? { operationCount: parseCountEnvelope(record.operationCount) }
      : {}),
    ...(hasOwn(record, "activityOccurrenceCount")
      ? {
          activityOccurrenceCount: parseCountEnvelope(
            record.activityOccurrenceCount,
          ),
        }
      : {}),
    ...(hasOwn(record, "placeVisitCount")
      ? { placeVisitCount: parseCountEnvelope(record.placeVisitCount) }
      : {}),
    hasDetail: parseBoolean(
      requireProperty(record, "hasDetail", "CalendarDayCell"),
      "CalendarDayCell.hasDetail",
    ),
    flags: parseCalendarFlags(
      requireProperty(record, "flags", "CalendarDayCell"),
    ),
  };
}

export function parseCalendarMonthSummary(value: unknown): CalendarMonthSummary {
  const record = parseStrictRecord(
    value,
    [
      "economicAmount",
      "observableDayCount",
      "dayContextCounts",
      "daysWithActivity",
      "daysWithPlaceVisit",
      "daysOutsideDailyLife",
      "periodCompleteness",
    ],
    "CalendarMonthSummary",
  );
  let dayContextCounts: CalendarMonthSummary["dayContextCounts"];
  if (hasOwn(record, "dayContextCounts")) {
    if (!Array.isArray(record.dayContextCounts)) {
      throw new TypeError("CalendarMonthSummary.dayContextCounts doit être un tableau.");
    }
    dayContextCounts = record.dayContextCounts.map((value) => {
      const item = parseStrictRecord(value, ["context", "count"], "DayContextCount");
      return {
        context: parseDayContext(requireProperty(item, "context", "DayContextCount")),
        count: parseCountEnvelope(requireProperty(item, "count", "DayContextCount")),
      };
    });
    assertUniqueOrdered(
      dayContextCounts.map(({ context }) => context),
      dayContextOrder,
      "CalendarMonthSummary.dayContextCounts",
    );
  }
  return {
    economicAmount: parseMoneyEnvelope(
      requireProperty(record, "economicAmount", "CalendarMonthSummary"),
    ),
    ...(hasOwn(record, "observableDayCount")
      ? { observableDayCount: parseCountEnvelope(record.observableDayCount) }
      : {}),
    ...(dayContextCounts === undefined ? {} : { dayContextCounts }),
    ...(hasOwn(record, "daysWithActivity")
      ? { daysWithActivity: parseCountEnvelope(record.daysWithActivity) }
      : {}),
    ...(hasOwn(record, "daysWithPlaceVisit")
      ? { daysWithPlaceVisit: parseCountEnvelope(record.daysWithPlaceVisit) }
      : {}),
    ...(hasOwn(record, "daysOutsideDailyLife")
      ? { daysOutsideDailyLife: parseCountEnvelope(record.daysOutsideDailyLife) }
      : {}),
    periodCompleteness: parsePeriodCompleteness(
      requireProperty(record, "periodCompleteness", "CalendarMonthSummary"),
    ),
  };
}

export function parseHistoryCalendarMonthReadModel(
  value: unknown,
): HistoryCalendarMonthReadModel {
  const record = parseStrictRecord(
    value,
    ["month", "timezone", "subject", "summary", "days", "capabilities"],
    "HistoryCalendarMonthReadModel",
  );
  const month = parseYearMonth(
    requireProperty(record, "month", "HistoryCalendarMonthReadModel"),
  );
  const rawDays = requireProperty(record, "days", "HistoryCalendarMonthReadModel");
  if (!Array.isArray(rawDays)) {
    throw new TypeError("HistoryCalendarMonthReadModel.days doit être un tableau.");
  }
  const days = rawDays.map(parseCalendarDayCell);
  const expectedDates = listCivilMonthDates(month);
  if (
    days.length !== expectedDates.length ||
    days.some((day, index) => day.date !== expectedDates[index])
  ) {
    throw new TypeError(
      "Calendar Month doit contenir chaque date civile, unique et triée.",
    );
  }
  return {
    month,
    timezone: parseHouseholdTimeZone(
      requireProperty(record, "timezone", "HistoryCalendarMonthReadModel"),
    ),
    subject: parseReadModelSubject(
      requireProperty(record, "subject", "HistoryCalendarMonthReadModel"),
    ),
    summary: parseCalendarMonthSummary(
      requireProperty(record, "summary", "HistoryCalendarMonthReadModel"),
    ),
    days,
    capabilities: parseQueryCapabilities(
      requireProperty(record, "capabilities", "HistoryCalendarMonthReadModel"),
      queryResourceKeys.historyCalendarMonth,
    ),
  };
}

export function parseHistoryCalendarMonthSummaryReadModel(
  value: unknown,
): HistoryCalendarMonthSummaryReadModel {
  const record = parseStrictRecord(
    value,
    ["month", "timezone", "subject", "summary", "capabilities"],
    "HistoryCalendarMonthSummaryReadModel",
  );
  return {
    month: parseYearMonth(
      requireProperty(record, "month", "HistoryCalendarMonthSummaryReadModel"),
    ),
    timezone: parseHouseholdTimeZone(
      requireProperty(record, "timezone", "HistoryCalendarMonthSummaryReadModel"),
    ),
    subject: parseReadModelSubject(
      requireProperty(record, "subject", "HistoryCalendarMonthSummaryReadModel"),
    ),
    summary: parseCalendarMonthSummary(
      requireProperty(record, "summary", "HistoryCalendarMonthSummaryReadModel"),
    ),
    capabilities: parseQueryCapabilities(
      requireProperty(record, "capabilities", "HistoryCalendarMonthSummaryReadModel"),
      queryResourceKeys.historyCalendarMonthSummary,
    ),
  };
}

