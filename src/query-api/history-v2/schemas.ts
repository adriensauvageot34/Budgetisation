import {
  createCollectionValueSchema,
  createDisplayNodeSchema,
  createMetricValueSchema,
  parsePolicyVersions,
  parsePublicationMeta,
  parseQualityEnvelope,
  policyVersionsEqual,
  type CollectionValue,
  type MetricValue,
} from "../../core/history-v2";
import { parseResourceInputHash } from "../../analytics/history-v2";
import { parseHouseholdId } from "../../core/identity";
import { parseMoney } from "../../core/money";
import {
  addDays,
  parseHouseholdTimeZone,
  parseLocalDate,
  parseYearMonth,
  yearMonthOf,
} from "../../core/time";
import {
  createRuntimeSchema,
  hasOwn,
  parseStrictRecord,
  parseStringLiteral,
  requireProperty,
  type RuntimeSchema,
  type UnknownRecord,
} from "../../core/validation";
import { parseQueryCapabilities } from "../capabilities";
import {
  parseQueryResourceKey,
  queryResourceKeys,
  type QueryResourceKey,
} from "../request";
import { assertReadModelPublicationCompatibility } from "./builders";
import type {
  BankInflowSummary,
  CalendarItemSummary,
  DayHoverReadModel,
  EconomicExpenseSummary,
  JournalContinuousEvent,
  JournalDayReadModel,
  JournalMomentSummary,
  JournalTimelineItem,
  LifeMarkerReadModel,
  MonthCalendarDayReadModel,
  MonthCalendarReadModel,
  MonthHighlightReadModel,
  MonthQuickOverviewReadModel,
  ParticipantSummary,
  PersonContextSummary,
  QueryTargetRef,
  RefundMovementSummary,
  RibbonOverflowReadModel,
  RibbonSegmentReadModel,
  SourceRef,
  TechnicalMovementSummary,
  WeekDayReadModel,
  WeekReadModel,
} from "./types";

const stringSchema = createRuntimeSchema((value: unknown) => nonEmpty(value, "string"));
const moneySchema = createRuntimeSchema(parseMoney);
const dateSchema = createRuntimeSchema(parseLocalDate);
const countSchema = createRuntimeSchema((value: unknown) => integer(value, "count"));
const metricMoneySchema = createMetricValueSchema(moneySchema);
const metricCountSchema = createMetricValueSchema(countSchema);
const metricMoneyNodeSchema = createDisplayNodeSchema(metricMoneySchema);
const metricCountNodeSchema = createDisplayNodeSchema(metricCountSchema);

function nonEmpty(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim().length === 0 || value !== value.trim()) {
    throw new TypeError(`${field} doit être une chaîne non vide sans espace périphérique.`);
  }
  return value;
}

function integer(value: unknown, field: string, min = 0, max = Number.MAX_SAFE_INTEGER): number {
  if (!Number.isSafeInteger(value) || (value as number) < min || (value as number) > max) {
    throw new TypeError(`${field} doit être un entier entre ${min} et ${max}.`);
  }
  return value as number;
}

function booleanValue(value: unknown, field: string): boolean {
  if (typeof value !== "boolean") throw new TypeError(`${field} doit être booléen.`);
  return value;
}

function array<T>(value: unknown, parser: (entry: unknown) => T, field: string): readonly T[] {
  if (!Array.isArray(value)) throw new TypeError(`${field} doit être un tableau.`);
  return value.map(parser);
}

function optionalQuality(record: UnknownRecord) {
  return hasOwn(record, "quality") ? parseQualityEnvelope(record.quality) : undefined;
}

function assertUnique(values: readonly string[], field: string): void {
  if (new Set(values).size !== values.length) throw new TypeError(`${field} contient un doublon.`);
}

function parseSourceRef(value: unknown): SourceRef {
  const record = parseStrictRecord(value, ["kind", "id"], "SourceRef");
  return {
    kind: nonEmpty(requireProperty(record, "kind", "SourceRef"), "SourceRef.kind"),
    id: nonEmpty(requireProperty(record, "id", "SourceRef"), "SourceRef.id"),
  };
}

const sourceRefSchema = createRuntimeSchema(parseSourceRef);

function sourceRefs(value: unknown, field: string): readonly SourceRef[] {
  const parsed = array(value, parseSourceRef, field);
  assertUnique(parsed.map(({ kind, id }) => `${kind}\u0000${id}`), field);
  return parsed;
}

function parseQueryTargetRef(value: unknown): QueryTargetRef {
  const record = parseStrictRecord(value, ["resource", "params"], "QueryTargetRef");
  const resource = parseQueryResourceKey(requireProperty(record, "resource", "QueryTargetRef"));
  const rawParams = requireProperty(record, "params", "QueryTargetRef");
  if (typeof rawParams !== "object" || rawParams === null || Array.isArray(rawParams)) {
    throw new TypeError("QueryTargetRef.params doit être un objet.");
  }
  const params = Object.fromEntries(Object.entries(rawParams).map(([key, entry]) => [
    nonEmpty(key, "QueryTargetRef.params key"),
    nonEmpty(entry, `QueryTargetRef.params.${key}`),
  ]));
  return { resource, params };
}

function parseCalendarItemSummary(value: unknown): CalendarItemSummary {
  const record = parseStrictRecord(value, [
    "calendarItemId", "semanticTypeKey", "title", "iconKey", "renderMode",
    "markerTier", "priorityBand", "priorityWeight", "dateLabel", "startTime",
    "participantIds", "externalParticipants", "sourceRefs", "quality",
  ], "CalendarItemSummary");
  const renderMode = parseStringLiteral<CalendarItemSummary["renderMode"]>(
    requireProperty(record, "renderMode", "CalendarItemSummary"),
    new Set(["Context", "Marker", "Ribbon", "DetailOnly"]),
    "CalendarItemSummary.renderMode",
  );
  const markerTier = hasOwn(record, "markerTier")
    ? parseStringLiteral<NonNullable<CalendarItemSummary["markerTier"]>>(record.markerTier, new Set(["Dominant", "Standard", "Secondary"]), "markerTier")
    : undefined;
  if ((renderMode === "Marker") !== (markerTier !== undefined)) {
    throw new TypeError("CalendarItemSummary Marker exige markerTier et les autres modes l'interdisent.");
  }
  const participants = array(requireProperty(record, "participantIds", "CalendarItemSummary"), (entry) => nonEmpty(entry, "participantId"), "participantIds");
  const external = array(requireProperty(record, "externalParticipants", "CalendarItemSummary"), (entry) => nonEmpty(entry, "externalParticipant"), "externalParticipants");
  assertUnique(participants, "participantIds");
  assertUnique(external, "externalParticipants");
  return {
    calendarItemId: nonEmpty(requireProperty(record, "calendarItemId", "CalendarItemSummary"), "calendarItemId"),
    semanticTypeKey: nonEmpty(requireProperty(record, "semanticTypeKey", "CalendarItemSummary"), "semanticTypeKey"),
    title: nonEmpty(requireProperty(record, "title", "CalendarItemSummary"), "title"),
    iconKey: nonEmpty(requireProperty(record, "iconKey", "CalendarItemSummary"), "iconKey"),
    renderMode,
    ...(markerTier === undefined ? {} : { markerTier }),
    priorityBand: integer(requireProperty(record, "priorityBand", "CalendarItemSummary"), "priorityBand", 1, 5) as 1 | 2 | 3 | 4 | 5,
    priorityWeight: integer(requireProperty(record, "priorityWeight", "CalendarItemSummary"), "priorityWeight"),
    ...(hasOwn(record, "dateLabel") ? { dateLabel: nonEmpty(record.dateLabel, "dateLabel") } : {}),
    ...(hasOwn(record, "startTime") ? { startTime: nonEmpty(record.startTime, "startTime") } : {}),
    participantIds: participants,
    externalParticipants: external,
    sourceRefs: sourceRefs(requireProperty(record, "sourceRefs", "CalendarItemSummary"), "sourceRefs"),
    ...(optionalQuality(record) === undefined ? {} : { quality: optionalQuality(record)! }),
  };
}

const calendarItemSchema = createRuntimeSchema(parseCalendarItemSummary);
const calendarItemCollectionSchema = createCollectionValueSchema(calendarItemSchema);

function parsePersonContext(value: unknown): PersonContextSummary {
  const record = parseStrictRecord(value, ["personId", "displayInitial", "contextTypeKey", "label", "iconKey", "sourceRefs", "quality"], "PersonContextSummary");
  return {
    personId: nonEmpty(requireProperty(record, "personId", "PersonContextSummary"), "personId"),
    displayInitial: nonEmpty(requireProperty(record, "displayInitial", "PersonContextSummary"), "displayInitial"),
    contextTypeKey: nonEmpty(requireProperty(record, "contextTypeKey", "PersonContextSummary"), "contextTypeKey"),
    label: nonEmpty(requireProperty(record, "label", "PersonContextSummary"), "label"),
    iconKey: nonEmpty(requireProperty(record, "iconKey", "PersonContextSummary"), "iconKey"),
    sourceRefs: sourceRefs(requireProperty(record, "sourceRefs", "PersonContextSummary"), "sourceRefs"),
    ...(optionalQuality(record) === undefined ? {} : { quality: optionalQuality(record)! }),
  };
}

const personContextSchema = createRuntimeSchema(parsePersonContext);
const personContextCollectionNodeSchema = createDisplayNodeSchema(createCollectionValueSchema(personContextSchema));

function parseExpense(value: unknown): EconomicExpenseSummary {
  const record = parseStrictRecord(value, [
    "expenseEventId", "economicDate", "label", "eventKind", "amount", "sourceRefs",
    "merchantLabel", "effectiveTime", "placeLabel", "narrativeOwnerId", "quality",
  ], "EconomicExpenseSummary");
  const amount = parseMoney(requireProperty(record, "amount", "EconomicExpenseSummary"));
  if (Number(amount) <= 0) throw new TypeError("EconomicExpenseSummary.amount doit être strictement positif.");
  return {
    expenseEventId: nonEmpty(requireProperty(record, "expenseEventId", "EconomicExpenseSummary"), "expenseEventId"),
    economicDate: parseLocalDate(requireProperty(record, "economicDate", "EconomicExpenseSummary")),
    label: nonEmpty(requireProperty(record, "label", "EconomicExpenseSummary"), "label"),
    eventKind: parseStringLiteral(requireProperty(record, "eventKind", "EconomicExpenseSummary"), new Set(["PURCHASE_EVENT", "CASH_USE", "ECONOMIC_CHARGE"]), "eventKind"),
    amount,
    sourceRefs: sourceRefs(requireProperty(record, "sourceRefs", "EconomicExpenseSummary"), "sourceRefs"),
    ...(hasOwn(record, "merchantLabel") ? { merchantLabel: nonEmpty(record.merchantLabel, "merchantLabel") } : {}),
    ...(hasOwn(record, "effectiveTime") ? { effectiveTime: nonEmpty(record.effectiveTime, "effectiveTime") } : {}),
    ...(hasOwn(record, "placeLabel") ? { placeLabel: nonEmpty(record.placeLabel, "placeLabel") } : {}),
    ...(hasOwn(record, "narrativeOwnerId") ? { narrativeOwnerId: nonEmpty(record.narrativeOwnerId, "narrativeOwnerId") } : {}),
    ...(optionalQuality(record) === undefined ? {} : { quality: optionalQuality(record)! }),
  };
}

const expenseSchema = createRuntimeSchema(parseExpense);
const expenseCollectionNodeSchema = createDisplayNodeSchema(createCollectionValueSchema(expenseSchema));

function parseHover(value: unknown): DayHoverReadModel {
  const record = parseStrictRecord(value, ["date", "economicAmount", "contexts", "calendarEvents", "activeRibbons", "economicExpenses", "hiddenExpenseCount", "sourceRefs", "quality"], "DayHoverReadModel");
  return {
    date: parseLocalDate(requireProperty(record, "date", "DayHoverReadModel")),
    economicAmount: metricMoneyNodeSchema.parse(requireProperty(record, "economicAmount", "DayHoverReadModel")),
    contexts: personContextCollectionNodeSchema.parse(requireProperty(record, "contexts", "DayHoverReadModel")),
    calendarEvents: createDisplayNodeSchema(calendarItemCollectionSchema).parse(requireProperty(record, "calendarEvents", "DayHoverReadModel")),
    activeRibbons: createDisplayNodeSchema(calendarItemCollectionSchema).parse(requireProperty(record, "activeRibbons", "DayHoverReadModel")),
    economicExpenses: expenseCollectionNodeSchema.parse(requireProperty(record, "economicExpenses", "DayHoverReadModel")),
    hiddenExpenseCount: metricCountSchema.parse(requireProperty(record, "hiddenExpenseCount", "DayHoverReadModel")),
    sourceRefs: sourceRefs(requireProperty(record, "sourceRefs", "DayHoverReadModel"), "sourceRefs"),
    ...(optionalQuality(record) === undefined ? {} : { quality: optionalQuality(record)! }),
  };
}

const hoverNodeSchema = createDisplayNodeSchema(createRuntimeSchema(parseHover));

function parsePersonContextRecord(value: unknown) {
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new TypeError("personContexts doit être un objet.");
  return Object.fromEntries(Object.entries(value).map(([key, entry]) => [
    nonEmpty(key, "personContexts key"),
    createDisplayNodeSchema(personContextSchema).parse(entry),
  ]));
}

function parseDay(value: unknown, markerLimit: 3 | 6, week: boolean): MonthCalendarDayReadModel | WeekDayReadModel {
  const keys = [
    "date", week ? "inReferenceMonth" : "inSelectedMonth", ...(week ? [] : ["targetMonth"]),
    "economicAmount", "personContexts", "orderedMarkerGroups", "visibleMarkers",
    "hiddenMarkerCount", "activeRibbonItemIds", "hover", "journalRef", "sourceRefs", "quality",
  ];
  const record = parseStrictRecord(value, keys, week ? "WeekDayReadModel" : "MonthCalendarDayReadModel");
  const ordered = calendarItemCollectionSchema.parse(requireProperty(record, "orderedMarkerGroups", "CalendarDay"));
  const visible = array(requireProperty(record, "visibleMarkers", "CalendarDay"), parseCalendarItemSummary, "visibleMarkers");
  if (visible.length > markerLimit) throw new TypeError(`visibleMarkers est limité à ${markerLimit}.`);
  if (ordered.status === "KNOWN" || ordered.status === "PARTIAL") {
    const expected = ordered.items.slice(0, markerLimit).map(({ calendarItemId }) => calendarItemId);
    const actual = visible.map(({ calendarItemId }) => calendarItemId);
    if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new TypeError("visibleMarkers doit être le préfixe exact de orderedMarkerGroups.");
  }
  const common = {
    date: parseLocalDate(requireProperty(record, "date", "CalendarDay")),
    economicAmount: metricMoneyNodeSchema.parse(requireProperty(record, "economicAmount", "CalendarDay")),
    personContexts: parsePersonContextRecord(requireProperty(record, "personContexts", "CalendarDay")),
    orderedMarkerGroups: ordered,
    visibleMarkers: visible,
    hiddenMarkerCount: metricCountSchema.parse(requireProperty(record, "hiddenMarkerCount", "CalendarDay")),
    activeRibbonItemIds: array(requireProperty(record, "activeRibbonItemIds", "CalendarDay"), (entry) => nonEmpty(entry, "activeRibbonItemId"), "activeRibbonItemIds"),
    hover: hoverNodeSchema.parse(requireProperty(record, "hover", "CalendarDay")),
    journalRef: parseQueryTargetRef(requireProperty(record, "journalRef", "CalendarDay")),
    sourceRefs: sourceRefs(requireProperty(record, "sourceRefs", "CalendarDay"), "sourceRefs"),
    ...(optionalQuality(record) === undefined ? {} : { quality: optionalQuality(record)! }),
  };
  return week
    ? { ...common, inReferenceMonth: booleanValue(requireProperty(record, "inReferenceMonth", "WeekDay"), "inReferenceMonth") }
    : {
        ...common,
        inSelectedMonth: booleanValue(requireProperty(record, "inSelectedMonth", "MonthDay"), "inSelectedMonth"),
        targetMonth: parseYearMonth(requireProperty(record, "targetMonth", "MonthDay")),
      };
}

function parseRibbonSegment(value: unknown): RibbonSegmentReadModel {
  const record = parseStrictRecord(value, ["calendarItemId", "weekStart", "startColumn", "endColumn", "lane", "title", "iconKey", "sourceRefs"], "RibbonSegmentReadModel");
  const startColumn = integer(requireProperty(record, "startColumn", "RibbonSegment"), "startColumn", 1, 7);
  const endColumn = integer(requireProperty(record, "endColumn", "RibbonSegment"), "endColumn", 1, 7);
  if (endColumn < startColumn) throw new TypeError("RibbonSegment endColumn doit être >= startColumn.");
  return {
    calendarItemId: nonEmpty(requireProperty(record, "calendarItemId", "RibbonSegment"), "calendarItemId"),
    weekStart: parseLocalDate(requireProperty(record, "weekStart", "RibbonSegment")),
    startColumn,
    endColumn,
    lane: integer(requireProperty(record, "lane", "RibbonSegment"), "lane", 1, 4) as 1 | 2 | 3 | 4,
    title: nonEmpty(requireProperty(record, "title", "RibbonSegment"), "title"),
    iconKey: nonEmpty(requireProperty(record, "iconKey", "RibbonSegment"), "iconKey"),
    sourceRefs: sourceRefs(requireProperty(record, "sourceRefs", "RibbonSegment"), "sourceRefs"),
  };
}

function parseRibbonOverflow(value: unknown): RibbonOverflowReadModel {
  const record = parseStrictRecord(value, ["weekStart", "count"], "RibbonOverflowReadModel");
  return { weekStart: parseLocalDate(requireProperty(record, "weekStart", "RibbonOverflow")), count: integer(requireProperty(record, "count", "RibbonOverflow"), "count") };
}

const ribbonSegmentCollectionSchema = createCollectionValueSchema(createRuntimeSchema(parseRibbonSegment));
const ribbonOverflowCollectionSchema = createCollectionValueSchema(createRuntimeSchema(parseRibbonOverflow));

function parseMeta(record: UnknownRecord) {
  const resourceInputHash = parseResourceInputHash(requireProperty(record, "resourceInputHash", "HistoryV2ReadModel"));
  const policyVersions = parsePolicyVersions(requireProperty(record, "policyVersions", "HistoryV2ReadModel"));
  const publicationMeta = hasOwn(record, "publicationMeta") ? parsePublicationMeta(record.publicationMeta) : undefined;
  assertReadModelPublicationCompatibility({ policyVersions, ...(publicationMeta === undefined ? {} : { publicationMeta }) });
  return { resourceInputHash, policyVersions, ...(publicationMeta === undefined ? {} : { publicationMeta }) };
}

function parseMonthCalendar(value: unknown): MonthCalendarReadModel {
  const record = parseStrictRecord(value, [
    "householdId", "month", "timeZone", "gridStartDate", "gridEndDate", "weeks", "daysByDate",
    "ribbonSegments", "ribbonOverflow", "quickOverviewRef", "sourceRefs", "capabilities",
    "resourceInputHash", "policyVersions", "publicationMeta", "quality",
  ], "MonthCalendarReadModel");
  const month = parseYearMonth(requireProperty(record, "month", "MonthCalendarReadModel"));
  const weeks = array(requireProperty(record, "weeks", "MonthCalendarReadModel"), (entry) => {
    const row = parseStrictRecord(entry, ["weekStart", "weekEnd", "dayDates"], "MonthWeekRow");
    const dayDates = array(requireProperty(row, "dayDates", "MonthWeekRow"), parseLocalDate, "dayDates");
    if (dayDates.length !== 7) throw new TypeError("MonthWeekRow exige exactement 7 dates.");
    for (let index = 1; index < 7; index += 1) if (dayDates[index] !== addDays(dayDates[index - 1], 1)) throw new TypeError("MonthWeekRow dates non contiguës.");
    if (Temporal.PlainDate.from(dayDates[0]).dayOfWeek !== 1) throw new TypeError("MonthWeekRow doit commencer lundi.");
    return { weekStart: parseLocalDate(requireProperty(row, "weekStart", "MonthWeekRow")), weekEnd: parseLocalDate(requireProperty(row, "weekEnd", "MonthWeekRow")), dayDates: dayDates as MonthCalendarReadModel["weeks"][number]["dayDates"] };
  }, "weeks");
  if (weeks.length < 4 || weeks.length > 6) throw new TypeError("Month Calendar exige 4 à 6 semaines.");
  const rawDays = requireProperty(record, "daysByDate", "MonthCalendarReadModel");
  if (typeof rawDays !== "object" || rawDays === null || Array.isArray(rawDays)) throw new TypeError("daysByDate doit être un objet.");
  const daysByDate = Object.fromEntries(Object.entries(rawDays).map(([date, day]) => {
    const parsedDate = parseLocalDate(date);
    const parsedDay = parseDay(day, 3, false) as MonthCalendarDayReadModel;
    if (parsedDay.date !== parsedDate) throw new TypeError("daysByDate key/date incohérent.");
    return [date, parsedDay];
  }));
  const expectedDates = weeks.flatMap(({ dayDates }) => dayDates);
  if (expectedDates.length !== Object.keys(daysByDate).length || expectedDates.some((date) => daysByDate[date] === undefined)) throw new TypeError("daysByDate doit couvrir exactement la grille.");
  return {
    householdId: parseHouseholdId(requireProperty(record, "householdId", "MonthCalendarReadModel")),
    month,
    timeZone: parseHouseholdTimeZone(requireProperty(record, "timeZone", "MonthCalendarReadModel")),
    gridStartDate: parseLocalDate(requireProperty(record, "gridStartDate", "MonthCalendarReadModel")),
    gridEndDate: parseLocalDate(requireProperty(record, "gridEndDate", "MonthCalendarReadModel")),
    weeks,
    daysByDate,
    ribbonSegments: ribbonSegmentCollectionSchema.parse(requireProperty(record, "ribbonSegments", "MonthCalendarReadModel")),
    ribbonOverflow: ribbonOverflowCollectionSchema.parse(requireProperty(record, "ribbonOverflow", "MonthCalendarReadModel")),
    quickOverviewRef: parseQueryTargetRef(requireProperty(record, "quickOverviewRef", "MonthCalendarReadModel")),
    sourceRefs: sourceRefs(requireProperty(record, "sourceRefs", "MonthCalendarReadModel"), "sourceRefs"),
    capabilities: parseQueryCapabilities(requireProperty(record, "capabilities", "MonthCalendarReadModel"), queryResourceKeys.historyMonthCalendar),
    ...parseMeta(record),
    ...(optionalQuality(record) === undefined ? {} : { quality: optionalQuality(record)! }),
  };
}

function parseWeek(value: unknown): WeekReadModel {
  const record = parseStrictRecord(value, [
    "householdId", "weekStart", "weekEnd", "referenceMonth", "days", "ribbonSegments", "ribbonOverflow",
    "sourceRefs", "capabilities", "resourceInputHash", "policyVersions", "publicationMeta", "quality",
  ], "WeekReadModel");
  const weekStart = parseLocalDate(requireProperty(record, "weekStart", "WeekReadModel"));
  if (Temporal.PlainDate.from(weekStart).dayOfWeek !== 1) throw new TypeError("WeekReadModel.weekStart doit être lundi.");
  const days = array(requireProperty(record, "days", "WeekReadModel"), (entry) => parseDay(entry, 6, true) as WeekDayReadModel, "days");
  if (days.length !== 7 || days.some((day, index) => day.date !== addDays(weekStart, index))) throw new TypeError("WeekReadModel exige exactement 7 jours contigus.");
  const referenceMonth = parseYearMonth(requireProperty(record, "referenceMonth", "WeekReadModel"));
  if (referenceMonth !== yearMonthOf(days[3].date)) throw new TypeError("referenceMonth doit être le mois du jeudi.");
  return {
    householdId: parseHouseholdId(requireProperty(record, "householdId", "WeekReadModel")),
    weekStart,
    weekEnd: parseLocalDate(requireProperty(record, "weekEnd", "WeekReadModel")),
    referenceMonth,
    days: days as unknown as WeekReadModel["days"],
    ribbonSegments: ribbonSegmentCollectionSchema.parse(requireProperty(record, "ribbonSegments", "WeekReadModel")),
    ribbonOverflow: ribbonOverflowCollectionSchema.parse(requireProperty(record, "ribbonOverflow", "WeekReadModel")),
    sourceRefs: sourceRefs(requireProperty(record, "sourceRefs", "WeekReadModel"), "sourceRefs"),
    capabilities: parseQueryCapabilities(requireProperty(record, "capabilities", "WeekReadModel"), queryResourceKeys.historyWeek),
    ...parseMeta(record),
    ...(optionalQuality(record) === undefined ? {} : { quality: optionalQuality(record)! }),
  };
}

function parseParticipant(value: unknown): ParticipantSummary {
  const record = parseStrictRecord(value, ["participantId", "label", "kind", "sourceRefs"], "ParticipantSummary");
  return {
    participantId: nonEmpty(requireProperty(record, "participantId", "ParticipantSummary"), "participantId"),
    label: nonEmpty(requireProperty(record, "label", "ParticipantSummary"), "label"),
    kind: parseStringLiteral(requireProperty(record, "kind", "ParticipantSummary"), new Set(["HOUSEHOLD", "EXTERNAL"]), "kind"),
    sourceRefs: sourceRefs(requireProperty(record, "sourceRefs", "ParticipantSummary"), "sourceRefs"),
  };
}

const participantSchema = createRuntimeSchema(parseParticipant);

function parseJournalMoment(value: unknown): JournalMomentSummary {
  const record = parseStrictRecord(value, ["momentId", "causalCost", "spentDuring", "causalExpenses", "hiddenCausalExpenseCount", "detailRef"], "JournalMomentSummary");
  return {
    momentId: nonEmpty(requireProperty(record, "momentId", "JournalMomentSummary"), "momentId"),
    causalCost: metricMoneyNodeSchema.parse(requireProperty(record, "causalCost", "JournalMomentSummary")),
    spentDuring: metricMoneyNodeSchema.parse(requireProperty(record, "spentDuring", "JournalMomentSummary")),
    causalExpenses: expenseCollectionNodeSchema.parse(requireProperty(record, "causalExpenses", "JournalMomentSummary")),
    hiddenCausalExpenseCount: metricCountSchema.parse(requireProperty(record, "hiddenCausalExpenseCount", "JournalMomentSummary")),
    detailRef: parseQueryTargetRef(requireProperty(record, "detailRef", "JournalMomentSummary")),
  };
}

function parseTimeline(value: unknown): JournalTimelineItem {
  const record = parseStrictRecord(value, ["calendarItemId", "title", "iconKey", "startTime", "dateLabel", "participants", "placeLabel", "moment", "sourceRefs", "quality"], "JournalTimelineItem");
  return {
    calendarItemId: nonEmpty(requireProperty(record, "calendarItemId", "JournalTimelineItem"), "calendarItemId"),
    title: nonEmpty(requireProperty(record, "title", "JournalTimelineItem"), "title"),
    iconKey: nonEmpty(requireProperty(record, "iconKey", "JournalTimelineItem"), "iconKey"),
    ...(hasOwn(record, "startTime") ? { startTime: nonEmpty(record.startTime, "startTime") } : {}),
    ...(hasOwn(record, "dateLabel") ? { dateLabel: nonEmpty(record.dateLabel, "dateLabel") } : {}),
    participants: array(requireProperty(record, "participants", "JournalTimelineItem"), parseParticipant, "participants"),
    ...(hasOwn(record, "placeLabel") ? { placeLabel: nonEmpty(record.placeLabel, "placeLabel") } : {}),
    ...(hasOwn(record, "moment") ? { moment: parseJournalMoment(record.moment) } : {}),
    sourceRefs: sourceRefs(requireProperty(record, "sourceRefs", "JournalTimelineItem"), "sourceRefs"),
    ...(optionalQuality(record) === undefined ? {} : { quality: optionalQuality(record)! }),
  };
}

function parseContinuous(value: unknown): JournalContinuousEvent {
  const record = parseStrictRecord(value, ["calendarItemId", "title", "iconKey", "startDate", "endDate", "sourceRefs", "quality"], "JournalContinuousEvent");
  const startDate = parseLocalDate(requireProperty(record, "startDate", "JournalContinuousEvent"));
  const endDate = parseLocalDate(requireProperty(record, "endDate", "JournalContinuousEvent"));
  if (endDate < startDate) throw new TypeError("JournalContinuousEvent intervalle invalide.");
  return {
    calendarItemId: nonEmpty(requireProperty(record, "calendarItemId", "JournalContinuousEvent"), "calendarItemId"),
    title: nonEmpty(requireProperty(record, "title", "JournalContinuousEvent"), "title"),
    iconKey: nonEmpty(requireProperty(record, "iconKey", "JournalContinuousEvent"), "iconKey"),
    startDate,
    endDate,
    sourceRefs: sourceRefs(requireProperty(record, "sourceRefs", "JournalContinuousEvent"), "sourceRefs"),
    ...(optionalQuality(record) === undefined ? {} : { quality: optionalQuality(record)! }),
  };
}

function parseMovement<T extends RefundMovementSummary | BankInflowSummary | TechnicalMovementSummary>(value: unknown, kind: "refund" | "inflow" | "technical"): T {
  const keys = ["movementId", "date", "label", "amount", "sourceRefs", ...(kind === "refund" ? ["relatedExpenseEventId"] : []), ...(kind === "technical" ? ["movementKind"] : [])];
  const record = parseStrictRecord(value, keys, `${kind} movement`);
  return {
    movementId: nonEmpty(requireProperty(record, "movementId", kind), "movementId"),
    date: parseLocalDate(requireProperty(record, "date", kind)),
    label: nonEmpty(requireProperty(record, "label", kind), "label"),
    amount: parseMoney(requireProperty(record, "amount", kind)),
    sourceRefs: sourceRefs(requireProperty(record, "sourceRefs", kind), "sourceRefs"),
    ...(hasOwn(record, "relatedExpenseEventId") ? { relatedExpenseEventId: nonEmpty(record.relatedExpenseEventId, "relatedExpenseEventId") } : {}),
    ...(hasOwn(record, "movementKind") ? { movementKind: parseStringLiteral(record.movementKind, new Set(["TRANSFER", "CARD_PAYMENT", "CASH_WITHDRAWAL", "OTHER_TECHNICAL"]), "movementKind") } : {}),
  } as T;
}

function parseJournal(value: unknown): JournalDayReadModel {
  const record = parseStrictRecord(value, [
    "householdId", "date", "economicAmount", "dayParticipants", "contexts", "activeContinuousEvents", "timedTimeline", "untimedEvents", "otherMovements", "navigation", "sourceRefs", "capabilities", "resourceInputHash", "policyVersions", "publicationMeta", "quality",
  ], "JournalDayReadModel");
  const other = parseStrictRecord(requireProperty(record, "otherMovements", "JournalDayReadModel"), ["otherExpenses", "refundsAndAdjustments", "inflows", "technicalMovements"], "JournalOtherMovements");
  const navigation = parseStrictRecord(requireProperty(record, "navigation", "JournalDayReadModel"), ["previousDate", "previousRef", "nextDate", "nextRef"], "JournalNavigation");
  const timedTimeline = createDisplayNodeSchema(createCollectionValueSchema(createRuntimeSchema(parseTimeline))).parse(requireProperty(record, "timedTimeline", "JournalDayReadModel"));
  if (timedTimeline.visibility === "VISIBLE" && (timedTimeline.data.status === "KNOWN" || timedTimeline.data.status === "PARTIAL") && timedTimeline.data.items.some(({ startTime }) => startTime === undefined)) throw new TypeError("timedTimeline interdit les heures absentes/inventées.");
  const untimedEvents = createDisplayNodeSchema(createCollectionValueSchema(createRuntimeSchema(parseTimeline))).parse(requireProperty(record, "untimedEvents", "JournalDayReadModel"));
  if (untimedEvents.visibility === "VISIBLE" && (untimedEvents.data.status === "KNOWN" || untimedEvents.data.status === "PARTIAL") && untimedEvents.data.items.some(({ startTime }) => startTime !== undefined)) throw new TypeError("untimedEvents ne doit pas contenir d'heure.");
  return {
    householdId: parseHouseholdId(requireProperty(record, "householdId", "JournalDayReadModel")),
    date: parseLocalDate(requireProperty(record, "date", "JournalDayReadModel")),
    economicAmount: metricMoneyNodeSchema.parse(requireProperty(record, "economicAmount", "JournalDayReadModel")),
    dayParticipants: createDisplayNodeSchema(createCollectionValueSchema(participantSchema)).parse(requireProperty(record, "dayParticipants", "JournalDayReadModel")),
    contexts: personContextCollectionNodeSchema.parse(requireProperty(record, "contexts", "JournalDayReadModel")),
    activeContinuousEvents: createDisplayNodeSchema(createCollectionValueSchema(createRuntimeSchema(parseContinuous))).parse(requireProperty(record, "activeContinuousEvents", "JournalDayReadModel")),
    timedTimeline,
    untimedEvents,
    otherMovements: {
      otherExpenses: expenseCollectionNodeSchema.parse(requireProperty(other, "otherExpenses", "JournalOtherMovements")),
      refundsAndAdjustments: createDisplayNodeSchema(createCollectionValueSchema(createRuntimeSchema((entry) => parseMovement<RefundMovementSummary>(entry, "refund")))).parse(requireProperty(other, "refundsAndAdjustments", "JournalOtherMovements")),
      inflows: createDisplayNodeSchema(createCollectionValueSchema(createRuntimeSchema((entry) => parseMovement<BankInflowSummary>(entry, "inflow")))).parse(requireProperty(other, "inflows", "JournalOtherMovements")),
      technicalMovements: createDisplayNodeSchema(createCollectionValueSchema(createRuntimeSchema((entry) => parseMovement<TechnicalMovementSummary>(entry, "technical")))).parse(requireProperty(other, "technicalMovements", "JournalOtherMovements")),
    },
    navigation: {
      previousDate: parseLocalDate(requireProperty(navigation, "previousDate", "JournalNavigation")),
      previousRef: parseQueryTargetRef(requireProperty(navigation, "previousRef", "JournalNavigation")),
      nextDate: parseLocalDate(requireProperty(navigation, "nextDate", "JournalNavigation")),
      nextRef: parseQueryTargetRef(requireProperty(navigation, "nextRef", "JournalNavigation")),
    },
    sourceRefs: sourceRefs(requireProperty(record, "sourceRefs", "JournalDayReadModel"), "sourceRefs"),
    capabilities: parseQueryCapabilities(requireProperty(record, "capabilities", "JournalDayReadModel"), queryResourceKeys.historyDayJournal),
    ...parseMeta(record),
    ...(optionalQuality(record) === undefined ? {} : { quality: optionalQuality(record)! }),
  };
}

function parseLifeMarker(value: unknown): LifeMarkerReadModel {
  const record = parseStrictRecord(value, ["family", "label", "primaryValue", "unit", "secondaryBreakdown", "sourceRefs", "quality"], "LifeMarkerReadModel");
  const secondary = hasOwn(record, "secondaryBreakdown")
    ? (() => {
        if (typeof record.secondaryBreakdown !== "object" || record.secondaryBreakdown === null || Array.isArray(record.secondaryBreakdown)) throw new TypeError("secondaryBreakdown doit être un objet.");
        return Object.fromEntries(Object.entries(record.secondaryBreakdown).map(([key, entry]) => [nonEmpty(key, "secondary key"), integer(entry, `secondary.${key}`)]));
      })()
    : undefined;
  return {
    family: parseStringLiteral(requireProperty(record, "family", "LifeMarkerReadModel"), new Set(["TRAVEL_STAY", "IMPORTANT_VISITS", "DRIVING", "LEAVE_REST", "WORK_RHYTHM"]), "family"),
    label: nonEmpty(requireProperty(record, "label", "LifeMarkerReadModel"), "label"),
    primaryValue: metricCountNodeSchema.parse(requireProperty(record, "primaryValue", "LifeMarkerReadModel")),
    unit: parseStringLiteral(requireProperty(record, "unit", "LifeMarkerReadModel"), new Set(["DAY", "SESSION"]), "unit"),
    ...(secondary === undefined ? {} : { secondaryBreakdown: secondary }),
    sourceRefs: sourceRefs(requireProperty(record, "sourceRefs", "LifeMarkerReadModel"), "sourceRefs"),
    ...(optionalQuality(record) === undefined ? {} : { quality: optionalQuality(record)! }),
  };
}

function parseHighlight(value: unknown): MonthHighlightReadModel {
  const record = parseStrictRecord(value, ["highlightId", "narrativeClass", "calendarItemId", "title", "dateLabel", "iconKey", "imageRef", "participantIds", "placeLabel", "causalCost", "startDate", "endDate", "sourceRefs", "quality"], "MonthHighlightReadModel");
  const startDate = parseLocalDate(requireProperty(record, "startDate", "MonthHighlightReadModel"));
  const endDate = hasOwn(record, "endDate") ? parseLocalDate(record.endDate) : undefined;
  if (endDate !== undefined && endDate < startDate) throw new TypeError("Highlight intervalle invalide.");
  return {
    highlightId: nonEmpty(requireProperty(record, "highlightId", "MonthHighlightReadModel"), "highlightId"),
    narrativeClass: integer(requireProperty(record, "narrativeClass", "MonthHighlightReadModel"), "narrativeClass", 1, 3) as 1 | 2 | 3,
    ...(hasOwn(record, "calendarItemId") ? { calendarItemId: nonEmpty(record.calendarItemId, "calendarItemId") } : {}),
    title: nonEmpty(requireProperty(record, "title", "MonthHighlightReadModel"), "title"),
    dateLabel: nonEmpty(requireProperty(record, "dateLabel", "MonthHighlightReadModel"), "dateLabel"),
    iconKey: nonEmpty(requireProperty(record, "iconKey", "MonthHighlightReadModel"), "iconKey"),
    ...(hasOwn(record, "imageRef") ? { imageRef: nonEmpty(record.imageRef, "imageRef") } : {}),
    ...(hasOwn(record, "participantIds") ? { participantIds: array(record.participantIds, (entry) => nonEmpty(entry, "participantId"), "participantIds") } : {}),
    ...(hasOwn(record, "placeLabel") ? { placeLabel: nonEmpty(record.placeLabel, "placeLabel") } : {}),
    causalCost: metricMoneyNodeSchema.parse(requireProperty(record, "causalCost", "MonthHighlightReadModel")),
    startDate,
    ...(endDate === undefined ? {} : { endDate }),
    sourceRefs: sourceRefs(requireProperty(record, "sourceRefs", "MonthHighlightReadModel"), "sourceRefs"),
    ...(optionalQuality(record) === undefined ? {} : { quality: optionalQuality(record)! }),
  };
}

function parseOverview(value: unknown): MonthQuickOverviewReadModel {
  const record = parseStrictRecord(value, ["householdId", "month", "flows", "lifeMarkers", "highlights", "totalEligibleHighlights", "sourceRefs", "capabilities", "resourceInputHash", "policyVersions", "publicationMeta", "quality"], "MonthQuickOverviewReadModel");
  const flows = parseStrictRecord(requireProperty(record, "flows", "MonthQuickOverviewReadModel"), ["bankOutflows", "economicActual", "bankInflows"], "MonthOverviewFlows");
  return {
    householdId: parseHouseholdId(requireProperty(record, "householdId", "MonthQuickOverviewReadModel")),
    month: parseYearMonth(requireProperty(record, "month", "MonthQuickOverviewReadModel")),
    flows: {
      bankOutflows: metricMoneyNodeSchema.parse(requireProperty(flows, "bankOutflows", "MonthOverviewFlows")),
      economicActual: metricMoneyNodeSchema.parse(requireProperty(flows, "economicActual", "MonthOverviewFlows")),
      bankInflows: metricMoneyNodeSchema.parse(requireProperty(flows, "bankInflows", "MonthOverviewFlows")),
    },
    lifeMarkers: createDisplayNodeSchema(createCollectionValueSchema(createRuntimeSchema(parseLifeMarker))).parse(requireProperty(record, "lifeMarkers", "MonthQuickOverviewReadModel")),
    highlights: createDisplayNodeSchema(createCollectionValueSchema(createRuntimeSchema(parseHighlight))).parse(requireProperty(record, "highlights", "MonthQuickOverviewReadModel")),
    totalEligibleHighlights: metricCountSchema.parse(requireProperty(record, "totalEligibleHighlights", "MonthQuickOverviewReadModel")),
    sourceRefs: sourceRefs(requireProperty(record, "sourceRefs", "MonthQuickOverviewReadModel"), "sourceRefs"),
    capabilities: parseQueryCapabilities(requireProperty(record, "capabilities", "MonthQuickOverviewReadModel"), queryResourceKeys.historyMonthOverview),
    ...parseMeta(record),
    ...(optionalQuality(record) === undefined ? {} : { quality: optionalQuality(record)! }),
  };
}

export const sourceRefRuntimeSchema = sourceRefSchema;
export const queryTargetRefRuntimeSchema = createRuntimeSchema(parseQueryTargetRef);
export const calendarItemSummaryRuntimeSchema = calendarItemSchema;
export const economicExpenseSummaryRuntimeSchema = expenseSchema;
export const dayHoverReadModelSchema = createRuntimeSchema(parseHover);
export const monthCalendarReadModelSchema = createRuntimeSchema(parseMonthCalendar);
export const weekReadModelSchema = createRuntimeSchema(parseWeek);
export const journalDayReadModelSchema = createRuntimeSchema(parseJournal);
export const monthQuickOverviewReadModelSchema = createRuntimeSchema(parseOverview);

export const historyV2ReadModelSchemas = Object.freeze({
  history_month_calendar: monthCalendarReadModelSchema,
  history_week: weekReadModelSchema,
  history_day_journal: journalDayReadModelSchema,
  history_month_overview: monthQuickOverviewReadModelSchema,
} satisfies Record<string, RuntimeSchema<unknown>>);
import { Temporal } from "@js-temporal/polyfill";
