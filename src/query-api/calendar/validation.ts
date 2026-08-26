import {
  parseLifeEventId,
  parseMomentId,
  parseOperationId,
  parsePersonId,
  parsePlaceId,
} from "../../core/identity";
import {
  parseDayContext,
  parseLifeScopeContext,
  type DayContext,
  type LifeScopeContext,
} from "../../core/scope";
import {
  parseHouseholdTimeZone,
  compareYearMonth,
  parseInstant,
  parseLocalDate,
  parseYearMonth,
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
  CalendarDayCell,
  CalendarDayMarker,
  CalendarExplorationTarget,
  CalendarFlag,
  CalendarMarkerKind,
  CalendarMonthHighlight,
  CalendarMonthNavigation,
  CalendarMonthSummary,
  CalendarPlaceRef,
  CalendarSpanningEvent,
  DayContextReadModel,
  DayObservability,
  HistoryCalendarMonthReadModel,
  HistoryCalendarMonthSummaryReadModel,
  LifeScopeSummary,
} from "./types";

const observabilityValues = new Set<DayObservability>([
  "observable",
  "partial",
  "unobserved",
]);
const markerKindValues = new Set<CalendarMarkerKind>([
  "work",
  "remote_work",
  "travel",
  "driving",
  "health",
  "meal",
  "shopping",
  "culture",
  "family",
  "celebration",
  "administrative",
  "home",
  "place",
  "moment",
  "activity",
  "finance",
  "other",
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

function parseBoolean(value: unknown, name: string): boolean {
  if (typeof value !== "boolean") throw new TypeError(`${name} doit être booléen.`);
  return value;
}

export function parseCalendarLabel(value: unknown, name: string): string {
  if (typeof value !== "string" || value.trim().length === 0 || value !== value.trim()) {
    throw new TypeError(`${name} doit être une chaîne non vide normalisée.`);
  }
  return value;
}

function parseStableId(value: unknown, name: string): string {
  return parseCalendarLabel(value, name);
}

function parsePriority(value: unknown, name: string): number {
  if (!Number.isSafeInteger(value) || (value as number) < 0 || (value as number) > 1000) {
    throw new TypeError(`${name} doit être un entier compris entre 0 et 1000.`);
  }
  return value as number;
}

function assertUniqueOrdered<T extends string>(
  values: readonly T[],
  order: readonly T[],
  name: string,
): void {
  if (new Set(values).size !== values.length) throw new TypeError(`${name} contient des doublons.`);
  let previous = -1;
  for (const value of values) {
    const current = order.indexOf(value);
    if (current < 0 || current <= previous) {
      throw new TypeError(`${name} n'est pas ordonné contractuellement.`);
    }
    previous = current;
  }
}

function parseParticipantIds(value: unknown, name: string) {
  if (!Array.isArray(value)) throw new TypeError(`${name} doit être un tableau.`);
  const participantIds = value.map(parsePersonId);
  if (new Set(participantIds).size !== participantIds.length) {
    throw new TypeError(`${name} contient des doublons.`);
  }
  if (participantIds.some((id, index) => index > 0 && participantIds[index - 1]! > id)) {
    throw new TypeError(`${name} doit être trié.`);
  }
  return participantIds;
}

export function parseCalendarMarkerKind(value: unknown): CalendarMarkerKind {
  return parseStringLiteral(value, markerKindValues, "CalendarMarkerKind");
}

export function parseCalendarExplorationTarget(value: unknown): CalendarExplorationTarget {
  const candidate = parseStrictRecord(value, ["kind", "id"], "CalendarExplorationTarget");
  const kind = requireProperty(candidate, "kind", "CalendarExplorationTarget");
  const id = requireProperty(candidate, "id", "CalendarExplorationTarget");
  if (kind === "moment") return { kind, id: parseMomentId(id) };
  if (kind === "life_event") return { kind, id: parseLifeEventId(id) };
  if (kind === "place") return { kind, id: parsePlaceId(id) };
  if (kind === "operation") return { kind, id: parseOperationId(id) };
  throw new TypeError("CalendarExplorationTarget.kind est invalide.");
}

export function parseCalendarPlaceRef(value: unknown): CalendarPlaceRef {
  const record = parseStrictRecord(value, ["placeId", "label"], "CalendarPlaceRef");
  return {
    placeId: parsePlaceId(requireProperty(record, "placeId", "CalendarPlaceRef")),
    label: parseCalendarLabel(
      requireProperty(record, "label", "CalendarPlaceRef"),
      "CalendarPlaceRef.label",
    ),
  };
}

export function parseCalendarDayMarker(value: unknown): CalendarDayMarker {
  const record = parseStrictRecord(
    value,
    ["id", "kind", "label", "priority", "participantIds", "startAt", "endAt", "place", "economicAmount", "target"],
    "CalendarDayMarker",
  );
  const startAt = hasOwn(record, "startAt") ? parseInstant(record.startAt) : undefined;
  const endAt = hasOwn(record, "endAt") ? parseInstant(record.endAt) : undefined;
  if (startAt !== undefined && endAt !== undefined && endAt < startAt) {
    throw new TypeError("CalendarDayMarker doit respecter startAt <= endAt.");
  }
  return {
    id: parseStableId(requireProperty(record, "id", "CalendarDayMarker"), "CalendarDayMarker.id"),
    kind: parseCalendarMarkerKind(requireProperty(record, "kind", "CalendarDayMarker")),
    label: parseCalendarLabel(requireProperty(record, "label", "CalendarDayMarker"), "CalendarDayMarker.label"),
    priority: parsePriority(requireProperty(record, "priority", "CalendarDayMarker"), "CalendarDayMarker.priority"),
    participantIds: parseParticipantIds(requireProperty(record, "participantIds", "CalendarDayMarker"), "CalendarDayMarker.participantIds"),
    ...(startAt === undefined ? {} : { startAt }),
    ...(endAt === undefined ? {} : { endAt }),
    ...(hasOwn(record, "place") ? { place: parseCalendarPlaceRef(record.place) } : {}),
    ...(hasOwn(record, "economicAmount") ? { economicAmount: parseMoneyEnvelope(record.economicAmount) } : {}),
    ...(hasOwn(record, "target") ? { target: parseCalendarExplorationTarget(record.target) } : {}),
  };
}

function parseDatedNarrative<T extends "CalendarSpanningEvent" | "CalendarMonthHighlight">(
  value: unknown,
  name: T,
) {
  const record = parseStrictRecord(
    value,
    name === "CalendarSpanningEvent"
      ? ["id", "kind", "label", "priority", "startsOn", "endsOn", "participantIds", "target"]
      : ["id", "kind", "label", "startsOn", "endsOn", "participantIds", "target"],
    name,
  );
  const startsOn = parseLocalDate(requireProperty(record, "startsOn", name));
  const endsOn = parseLocalDate(requireProperty(record, "endsOn", name));
  if (endsOn < startsOn) throw new TypeError(`${name} doit respecter startsOn <= endsOn.`);
  return {
    record,
    startsOn,
    endsOn,
    base: {
      id: parseStableId(requireProperty(record, "id", name), `${name}.id`),
      kind: parseCalendarMarkerKind(requireProperty(record, "kind", name)),
      label: parseCalendarLabel(requireProperty(record, "label", name), `${name}.label`),
      startsOn,
      endsOn,
      participantIds: parseParticipantIds(requireProperty(record, "participantIds", name), `${name}.participantIds`),
      ...(hasOwn(record, "target") ? { target: parseCalendarExplorationTarget(record.target) } : {}),
    },
  };
}

export function parseCalendarSpanningEvent(value: unknown): CalendarSpanningEvent {
  const parsed = parseDatedNarrative(value, "CalendarSpanningEvent");
  if (parsed.startsOn === parsed.endsOn) {
    throw new TypeError("CalendarSpanningEvent doit couvrir plusieurs jours.");
  }
  return {
    ...parsed.base,
    priority: parsePriority(
      requireProperty(parsed.record, "priority", "CalendarSpanningEvent"),
      "CalendarSpanningEvent.priority",
    ),
  };
}

export function parseCalendarMonthHighlight(value: unknown): CalendarMonthHighlight {
  return parseDatedNarrative(value, "CalendarMonthHighlight").base;
}

export function parseDayContextReadModel(value: unknown): DayContextReadModel {
  const candidate = parseStrictRecord(value, ["kind", "values"], "DayContextReadModel");
  const kind = requireProperty(candidate, "kind", "DayContextReadModel");
  if (kind === "known") {
    const rawValues = requireProperty(candidate, "values", "DayContextReadModel");
    if (!Array.isArray(rawValues)) throw new TypeError("DayContextReadModel.values doit être un tableau.");
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
  const record = parseStrictRecord(value, ["availability", "entries"], "LifeScopeSummary");
  const availability = requireProperty(record, "availability", "LifeScopeSummary");
  const rawEntries = requireProperty(record, "entries", "LifeScopeSummary");
  if (!Array.isArray(rawEntries)) throw new TypeError("LifeScopeSummary.entries doit être un tableau.");
  if (availability === "unknown" || availability === "conflict") {
    if (rawEntries.length !== 0) throw new TypeError("LifeScopeSummary indisponible ne porte aucune entrée.");
    return { availability, entries: [] };
  }
  if (availability !== "known") throw new TypeError("LifeScopeSummary.availability est invalide.");
  const entries = rawEntries.map((entry) => {
    const item = parseStrictRecord(entry, ["context", "economicAmount"], "LifeScopeSummary.entry");
    return {
      context: parseLifeScopeContext(requireProperty(item, "context", "LifeScopeSummary.entry")),
      economicAmount: parseMoneyEnvelope(requireProperty(item, "economicAmount", "LifeScopeSummary.entry")),
    };
  });
  assertUniqueOrdered(entries.map(({ context }) => context), lifeScopeOrder, "LifeScopeSummary.entries");
  return { availability, entries };
}

function parseCalendarFlags(value: unknown): readonly CalendarFlag[] {
  if (!Array.isArray(value)) throw new TypeError("CalendarDayCell.flags doit être un tableau.");
  const flags = value.map((flag) => parseStringLiteral<CalendarFlag>(flag, new Set(calendarFlagOrder), "CalendarFlag"));
  assertUniqueOrdered(flags, calendarFlagOrder, "CalendarDayCell.flags");
  return flags;
}

function parseMarkerArray(value: unknown, name: string): readonly CalendarDayMarker[] {
  if (!Array.isArray(value)) throw new TypeError(`${name} doit être un tableau.`);
  const markers = value.map(parseCalendarDayMarker);
  if (new Set(markers.map(({ id }) => id)).size !== markers.length) {
    throw new TypeError(`${name} contient des identités dupliquées.`);
  }
  return markers;
}

export function parseCalendarDayCell(value: unknown): CalendarDayCell {
  const record = parseStrictRecord(
    value,
    ["date", "observability", "dayContext", "lifeScopeSummary", "economicAmount", "operationCount", "activityOccurrenceCount", "placeVisitCount", "markers", "hasDetail", "flags"],
    "CalendarDayCell",
  );
  return {
    date: parseLocalDate(requireProperty(record, "date", "CalendarDayCell")),
    observability: parseStringLiteral(requireProperty(record, "observability", "CalendarDayCell"), observabilityValues, "DayObservability"),
    dayContext: parseDayContextReadModel(requireProperty(record, "dayContext", "CalendarDayCell")),
    lifeScopeSummary: parseLifeScopeSummary(requireProperty(record, "lifeScopeSummary", "CalendarDayCell")),
    economicAmount: parseMoneyEnvelope(requireProperty(record, "economicAmount", "CalendarDayCell")),
    ...(hasOwn(record, "operationCount") ? { operationCount: parseCountEnvelope(record.operationCount) } : {}),
    ...(hasOwn(record, "activityOccurrenceCount") ? { activityOccurrenceCount: parseCountEnvelope(record.activityOccurrenceCount) } : {}),
    ...(hasOwn(record, "placeVisitCount") ? { placeVisitCount: parseCountEnvelope(record.placeVisitCount) } : {}),
    markers: parseMarkerArray(requireProperty(record, "markers", "CalendarDayCell"), "CalendarDayCell.markers"),
    hasDetail: parseBoolean(requireProperty(record, "hasDetail", "CalendarDayCell"), "CalendarDayCell.hasDetail"),
    flags: parseCalendarFlags(requireProperty(record, "flags", "CalendarDayCell")),
  };
}

export function parseCalendarMonthSummary(value: unknown): CalendarMonthSummary {
  const record = parseStrictRecord(
    value,
    ["economicAmount", "observableDayCount", "dayContextCounts", "daysWithActivity", "daysWithPlaceVisit", "daysOutsideDailyLife", "periodCompleteness"],
    "CalendarMonthSummary",
  );
  let dayContextCounts: CalendarMonthSummary["dayContextCounts"];
  if (hasOwn(record, "dayContextCounts")) {
    if (!Array.isArray(record.dayContextCounts)) throw new TypeError("CalendarMonthSummary.dayContextCounts doit être un tableau.");
    dayContextCounts = record.dayContextCounts.map((value) => {
      const item = parseStrictRecord(value, ["context", "count"], "DayContextCount");
      return {
        context: parseDayContext(requireProperty(item, "context", "DayContextCount")),
        count: parseCountEnvelope(requireProperty(item, "count", "DayContextCount")),
      };
    });
    assertUniqueOrdered(dayContextCounts.map(({ context }) => context), dayContextOrder, "CalendarMonthSummary.dayContextCounts");
  }
  return {
    economicAmount: parseMoneyEnvelope(requireProperty(record, "economicAmount", "CalendarMonthSummary")),
    ...(hasOwn(record, "observableDayCount") ? { observableDayCount: parseCountEnvelope(record.observableDayCount) } : {}),
    ...(dayContextCounts === undefined ? {} : { dayContextCounts }),
    ...(hasOwn(record, "daysWithActivity") ? { daysWithActivity: parseCountEnvelope(record.daysWithActivity) } : {}),
    ...(hasOwn(record, "daysWithPlaceVisit") ? { daysWithPlaceVisit: parseCountEnvelope(record.daysWithPlaceVisit) } : {}),
    ...(hasOwn(record, "daysOutsideDailyLife") ? { daysOutsideDailyLife: parseCountEnvelope(record.daysOutsideDailyLife) } : {}),
    periodCompleteness: parsePeriodCompleteness(requireProperty(record, "periodCompleteness", "CalendarMonthSummary")),
  };
}

function parseMonthNavigation(value: unknown): CalendarMonthNavigation {
  const record = parseStrictRecord(value, ["previous", "next"], "CalendarMonthNavigation");
  return {
    ...(hasOwn(record, "previous") ? { previous: parseYearMonth(record.previous) } : {}),
    ...(hasOwn(record, "next") ? { next: parseYearMonth(record.next) } : {}),
  };
}

export function parseHistoryCalendarMonthReadModel(value: unknown): HistoryCalendarMonthReadModel {
  const record = parseStrictRecord(
    value,
    ["month", "timezone", "subject", "navigation", "summary", "highlights", "spanningEvents", "days", "capabilities"],
    "HistoryCalendarMonthReadModel",
  );
  const month = parseYearMonth(requireProperty(record, "month", "HistoryCalendarMonthReadModel"));
  const rawDays = requireProperty(record, "days", "HistoryCalendarMonthReadModel");
  if (!Array.isArray(rawDays)) throw new TypeError("HistoryCalendarMonthReadModel.days doit être un tableau.");
  const days = rawDays.map(parseCalendarDayCell);
  const expectedDates = listCivilMonthDates(month);
  if (days.length !== expectedDates.length || days.some((day, index) => day.date !== expectedDates[index])) {
    throw new TypeError("Calendar Month doit contenir chaque date civile, unique et triée.");
  }
  const rawHighlights = requireProperty(record, "highlights", "HistoryCalendarMonthReadModel");
  const rawSpanning = requireProperty(record, "spanningEvents", "HistoryCalendarMonthReadModel");
  if (!Array.isArray(rawHighlights) || rawHighlights.length > 4) {
    throw new TypeError("Calendar Month porte au plus quatre temps forts.");
  }
  if (!Array.isArray(rawSpanning)) throw new TypeError("spanningEvents doit être un tableau.");
  const highlights = rawHighlights.map(parseCalendarMonthHighlight);
  const spanningEvents = rawSpanning.map(parseCalendarSpanningEvent);
  if (new Set(highlights.map(({ id }) => id)).size !== highlights.length || new Set(spanningEvents.map(({ id }) => id)).size !== spanningEvents.length) {
    throw new TypeError("Les repères Calendar doivent avoir des identités uniques.");
  }
  const navigation = parseMonthNavigation(requireProperty(record, "navigation", "HistoryCalendarMonthReadModel"));
  if (navigation.previous !== undefined && compareYearMonth(navigation.previous, month) >= 0) {
    throw new TypeError("Le mois précédent Calendar doit précéder le mois courant.");
  }
  if (navigation.next !== undefined && compareYearMonth(navigation.next, month) <= 0) {
    throw new TypeError("Le mois suivant Calendar doit suivre le mois courant.");
  }
  const monthDates = listCivilMonthDates(month);
  const monthStart = monthDates[0]!;
  const monthEnd = monthDates.at(-1)!;
  if (highlights.some((item) => item.startsOn > monthEnd || item.endsOn < monthStart) || spanningEvents.some((item) => item.startsOn > monthEnd || item.endsOn < monthStart)) {
    throw new TypeError("Les repères Calendar doivent chevaucher le mois demandé.");
  }
  return {
    month,
    timezone: parseHouseholdTimeZone(requireProperty(record, "timezone", "HistoryCalendarMonthReadModel")),
    subject: parseReadModelSubject(requireProperty(record, "subject", "HistoryCalendarMonthReadModel")),
    navigation,
    summary: parseCalendarMonthSummary(requireProperty(record, "summary", "HistoryCalendarMonthReadModel")),
    highlights,
    spanningEvents,
    days,
    capabilities: parseQueryCapabilities(requireProperty(record, "capabilities", "HistoryCalendarMonthReadModel"), queryResourceKeys.historyCalendarMonth),
  };
}

export function parseHistoryCalendarMonthSummaryReadModel(value: unknown): HistoryCalendarMonthSummaryReadModel {
  const record = parseStrictRecord(value, ["month", "timezone", "subject", "summary", "capabilities"], "HistoryCalendarMonthSummaryReadModel");
  return {
    month: parseYearMonth(requireProperty(record, "month", "HistoryCalendarMonthSummaryReadModel")),
    timezone: parseHouseholdTimeZone(requireProperty(record, "timezone", "HistoryCalendarMonthSummaryReadModel")),
    subject: parseReadModelSubject(requireProperty(record, "subject", "HistoryCalendarMonthSummaryReadModel")),
    summary: parseCalendarMonthSummary(requireProperty(record, "summary", "HistoryCalendarMonthSummaryReadModel")),
    capabilities: parseQueryCapabilities(requireProperty(record, "capabilities", "HistoryCalendarMonthSummaryReadModel"), queryResourceKeys.historyCalendarMonthSummary),
  };
}
