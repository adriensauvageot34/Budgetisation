import { Temporal } from "@js-temporal/polyfill";

import {
  computeResourceInputHash,
  resolveHistoryV2DisplayNode,
} from "../../analytics/history-v2";
import type {
  CalendarDayProjection,
  CalendarSemanticItem,
  CalendarSemanticMonthArtifact,
} from "../../analytics/history-v2/calendar";
import type {
  DailyEconomicAmount,
  DailyEconomicLedgerMonthArtifact,
  EconomicExpenseEvent,
} from "../../analytics/history-v2/daily-finance";
import type { HouseholdId } from "../../core/identity";
import {
  policyVersionsEqual,
  resolvePolicyVersions,
  type CollectionValue,
  type HistoryV2PolicyId,
  type MetricValue,
  type PolicyVersions,
  type PublicationMeta,
} from "../../core/history-v2";
import {
  addMoney,
  compareMoney,
  parseMoney,
  type Money,
} from "../../core/money";
import {
  addDays,
  addMonths,
  parseLocalDate,
  type HouseholdTimeZone,
  type LocalDate,
  type YearMonth,
  yearMonthOf,
} from "../../core/time";
import type { QueryCapabilities } from "../capabilities";
import { queryResourceKeys } from "../request";
import type {
  BankInflowSummary,
  CalendarItemSummary,
  CollectionNode,
  DayHoverReadModel,
  EconomicExpenseSummary,
  HistoryV2ReadModelMeta,
  JournalContinuousEvent,
  JournalDayReadModel,
  JournalMomentSummary,
  JournalTimelineItem,
  LifeMarkerFamily,
  LifeMarkerReadModel,
  MetricNode,
  MonthCalendarDayReadModel,
  MonthCalendarReadModel,
  MonthHighlightReadModel,
  MonthQuickOverviewReadModel,
  MonthWeekRow,
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

const zero = parseMoney("0");

export type PersonDirectoryEntry = {
  readonly personId: string;
  readonly displayInitial: string;
  readonly label: string;
  readonly sourceRefs: readonly SourceRef[];
};

export type EconomicExpenseDescriptor = {
  readonly expenseEventId: string;
  readonly label: string;
  readonly sourceRefs: readonly SourceRef[];
  readonly merchantLabel?: string;
  readonly effectiveTime?: string;
  readonly placeLabel?: string;
  /** Only an authoritative narrative/causal link may populate this field. */
  readonly narrativeOwnerId?: string;
};

export type HistoryV2ReadModelBuilderContext = {
  readonly householdId: HouseholdId;
  readonly timeZone: HouseholdTimeZone;
  readonly capabilities: QueryCapabilities;
  readonly calendarArtifacts: readonly CalendarSemanticMonthArtifact[];
  readonly dailyArtifacts: readonly DailyEconomicLedgerMonthArtifact[];
  readonly personDirectory: readonly PersonDirectoryEntry[];
  readonly expenseDescriptors: readonly EconomicExpenseDescriptor[];
  readonly publicationMeta?: PublicationMeta;
};

export type JournalSupplement = {
  readonly refundsAndAdjustments: CollectionValue<RefundMovementSummary>;
  readonly inflows: CollectionValue<BankInflowSummary>;
  readonly technicalMovements: CollectionValue<TechnicalMovementSummary>;
  readonly causalCostByCalendarItemId: Readonly<Record<string, MetricValue<Money>>>;
  readonly placeByCalendarItemId?: Readonly<Record<string, string>>;
};

export type SpentDuringWindow = {
  readonly startDate?: LocalDate;
  readonly endDate?: LocalDate;
  /** Required with endTime when a single-day Moment is a punctual window. */
  readonly startTime?: string;
  readonly endTime?: string;
};

export type ExplicitIncidentHighlight = {
  readonly highlightId: string;
  readonly calendarItemId: string;
  readonly title: string;
  readonly dateLabel: string;
  readonly iconKey: string;
  readonly startDate: LocalDate;
  readonly endDate?: LocalDate;
  readonly sourceRefs: readonly SourceRef[];
  readonly causalCost: MetricValue<Money>;
};

export type MonthOverviewSupplement = {
  readonly bankOutflows: MetricValue<Money>;
  readonly bankInflows: MetricValue<Money>;
  readonly causalCostByCalendarItemId: Readonly<Record<string, MetricValue<Money>>>;
  readonly imageRefByCalendarItemId?: Readonly<Record<string, string>>;
  readonly placeByCalendarItemId?: Readonly<Record<string, string>>;
  readonly explicitIncidentHighlights: readonly ExplicitIncidentHighlight[];
};

function uniqueStrings(values: readonly string[]): readonly string[] {
  return [...new Set(values)].sort();
}

function uniqueSourceRefs(values: readonly SourceRef[]): readonly SourceRef[] {
  const byKey = new Map(values.map((value) => [`${value.kind}\u0000${value.id}`, value]));
  return [...byKey.values()].sort((left, right) =>
    left.kind.localeCompare(right.kind) || left.id.localeCompare(right.id));
}

export function parseArtifactSourceRef(value: string): SourceRef {
  const separator = value.indexOf(":");
  return separator <= 0 || separator === value.length - 1
    ? { kind: "canonical", id: value }
    : { kind: value.slice(0, separator), id: value.slice(separator + 1) };
}

function sourceRefsForItem(item: CalendarSemanticItem): readonly SourceRef[] {
  return uniqueSourceRefs(item.sourceRefs.map(parseArtifactSourceRef));
}

function calendarSummary(item: CalendarSemanticItem): CalendarItemSummary {
  return {
    calendarItemId: item.calendarItemId,
    semanticTypeKey: item.semanticTypeKey,
    title: item.title,
    iconKey: item.iconKey,
    renderMode: item.renderMode,
    ...(item.markerTier === undefined ? {} : { markerTier: item.markerTier }),
    priorityBand: item.priorityBand,
    priorityWeight: item.priorityWeight,
    ...(item.startDate === undefined
      ? item.anchorDate === undefined ? {} : { dateLabel: item.anchorDate }
      : {
          dateLabel: item.endDate === item.startDate
            ? item.startDate
            : `${item.startDate} – ${item.endDate}`,
        }),
    ...(item.startTime === undefined ? {} : { startTime: item.startTime }),
    participantIds: item.householdParticipants,
    externalParticipants: item.externalParticipants ?? [],
    sourceRefs: sourceRefsForItem(item),
    ...(item.quality === undefined ? {} : { quality: item.quality }),
  };
}

function mapCollection<T, U>(
  source: CollectionValue<T>,
  project: (value: T) => U,
): CollectionValue<U> {
  switch (source.status) {
    case "KNOWN":
      return {
        status: "KNOWN",
        items: source.items.map(project),
        totalCount: source.totalCount,
        ...(source.quality === undefined ? {} : { quality: source.quality }),
      };
    case "PARTIAL":
      return {
        status: "PARTIAL",
        items: source.items.map(project),
        partialMeaning: "OBSERVED_ONLY",
        knownCount: source.knownCount,
        ...(source.quality === undefined ? {} : { quality: source.quality }),
      };
    default:
      return {
        status: source.status,
        ...(source.quality === undefined ? {} : { quality: source.quality }),
      };
  }
}

function metricNode<T>(value: MetricValue<T>, role: "CORE" | "DETAIL" | "CONDITIONAL" = "CORE"): MetricNode<T> {
  return resolveHistoryV2DisplayNode({
    role,
    result: value,
    partialPresentation: "VISIBLE",
  }) as MetricNode<T>;
}

function collectionNode<T>(
  value: CollectionValue<T>,
  role: "CORE" | "DETAIL" | "CONDITIONAL" = "DETAIL",
): CollectionNode<T> {
  return resolveHistoryV2DisplayNode({
    role,
    result: value,
    partialPresentation: "VISIBLE",
  }) as CollectionNode<T>;
}

function calendarByMonth(context: HistoryV2ReadModelBuilderContext): ReadonlyMap<YearMonth, CalendarSemanticMonthArtifact> {
  return new Map(context.calendarArtifacts.map((artifact) => [artifact.month, artifact]));
}

function dailyByMonth(context: HistoryV2ReadModelBuilderContext): ReadonlyMap<YearMonth, DailyEconomicLedgerMonthArtifact> {
  return new Map(context.dailyArtifacts.map((artifact) => [artifact.month, artifact]));
}

function mondayOf(date: LocalDate): LocalDate {
  return addDays(date, 1 - Temporal.PlainDate.from(date).dayOfWeek);
}

function monthGrid(month: YearMonth): {
  readonly start: LocalDate;
  readonly end: LocalDate;
  readonly weeks: readonly MonthWeekRow[];
} {
  const monthStart = parseLocalDate(`${month}-01`);
  const monthEnd = addDays(parseLocalDate(`${addMonths(month, 1)}-01`), -1);
  const start = mondayOf(monthStart);
  const end = addDays(mondayOf(monthEnd), 6);
  const weeks: MonthWeekRow[] = [];
  for (let weekStart = start; weekStart <= end; weekStart = addDays(weekStart, 7)) {
    const dates = Array.from({ length: 7 }, (_, index) => addDays(weekStart, index)) as unknown as MonthWeekRow["dayDates"];
    weeks.push({ weekStart, weekEnd: dates[6], dayDates: dates });
  }
  return { start, end, weeks };
}

function artifactDay(
  artifacts: ReadonlyMap<YearMonth, CalendarSemanticMonthArtifact>,
  date: LocalDate,
): { readonly artifact?: CalendarSemanticMonthArtifact; readonly day?: CalendarDayProjection } {
  const artifact = artifacts.get(yearMonthOf(date));
  return { artifact, day: artifact?.days.find((candidate) => candidate.date === date) };
}

function dailyAmount(
  artifacts: ReadonlyMap<YearMonth, DailyEconomicLedgerMonthArtifact>,
  date: LocalDate,
): MetricValue<Money> {
  const artifact = artifacts.get(yearMonthOf(date));
  const day = artifact?.days.find((candidate) => candidate.date === date);
  return day?.economicAmount ?? {
    status: "UNKNOWN",
    quality: { reasonCode: "DATA_NO_SOURCE" },
  };
}

function itemCovers(item: CalendarSemanticItem, date: LocalDate): boolean {
  if (item.startDate !== undefined && item.endDate !== undefined) {
    return item.startDate <= date && date <= item.endDate;
  }
  return item.anchorDate === date;
}

function activeRibbonItems(
  artifact: CalendarSemanticMonthArtifact | undefined,
  date: LocalDate,
): readonly CalendarSemanticItem[] {
  if (artifact?.items.status !== "KNOWN" && artifact?.items.status !== "PARTIAL") return [];
  const byId = new Map(artifact.items.items.map((item) => [item.calendarItemId, item]));
  const row = artifact.ribbonWeeks.find(({ weekStart }) => weekStart === mondayOf(date));
  if (row === undefined) return [];
  return row.segments
    .filter(({ segmentStart, segmentEnd }) => segmentStart <= date && date <= segmentEnd)
    .sort((left, right) => left.lane - right.lane || left.ribbonItemId.localeCompare(right.ribbonItemId))
    .flatMap(({ ribbonItemId }) => {
      const item = byId.get(ribbonItemId);
      return item === undefined ? [] : [item];
    });
}

function contextSummaries(
  day: CalendarDayProjection | undefined,
  directory: ReadonlyMap<string, PersonDirectoryEntry>,
): CollectionValue<PersonContextSummary> {
  if (day === undefined) {
    return { status: "UNKNOWN", quality: { reasonCode: "DATA_NO_SOURCE" } };
  }
  const summaries: PersonContextSummary[] = [];
  let missingDirectory = false;
  for (const item of day.contextItems) {
    for (const personId of item.householdParticipants) {
      const person = directory.get(personId);
      if (person === undefined) {
        missingDirectory = true;
        continue;
      }
      summaries.push({
        personId,
        displayInitial: person.displayInitial,
        contextTypeKey: item.semanticTypeKey,
        label: item.title,
        iconKey: item.iconKey,
        sourceRefs: uniqueSourceRefs([...person.sourceRefs, ...sourceRefsForItem(item)]),
        ...(item.quality === undefined ? {} : { quality: item.quality }),
      });
    }
  }
  summaries.sort((left, right) => left.personId.localeCompare(right.personId) || left.contextTypeKey.localeCompare(right.contextTypeKey));
  const contextTypesByPerson = new Map<string, Set<string>>();
  for (const summary of summaries) {
    const values = contextTypesByPerson.get(summary.personId) ?? new Set<string>();
    values.add(summary.contextTypeKey);
    contextTypesByPerson.set(summary.personId, values);
  }
  if ([...contextTypesByPerson.values()].some((values) => values.size > 1)) {
    return {
      status: "CONFLICT",
      quality: { reasonCode: "DATA_CONFLICTING_AUTHORITIES" },
    };
  }
  return missingDirectory
    ? {
        status: "PARTIAL",
        items: summaries,
        partialMeaning: "OBSERVED_ONLY",
        knownCount: summaries.length,
        quality: { reasonCode: "DATA_PARTIAL_SOURCE" },
      }
    : { status: "KNOWN", items: summaries, totalCount: summaries.length };
}

function expenseEventDate(event: EconomicExpenseEvent): LocalDate | undefined {
  return event.effectiveEconomicDate.status === "KNOWN"
    || event.effectiveEconomicDate.status === "PARTIAL"
    ? event.effectiveEconomicDate.value
    : undefined;
}

function expenseSummariesForDate(
  artifact: DailyEconomicLedgerMonthArtifact | undefined,
  date: LocalDate,
  descriptors: ReadonlyMap<string, EconomicExpenseDescriptor>,
): CollectionValue<EconomicExpenseSummary> {
  if (artifact === undefined) {
    return { status: "UNKNOWN", quality: { reasonCode: "DATA_NO_SOURCE" } };
  }
  let incomplete = artifact.expenseEvents.some((event) =>
    expenseEventDate(event) === undefined && compareMoney(event.economicAmount, zero) > 0);
  const values = artifact.expenseEvents.flatMap((event): EconomicExpenseSummary[] => {
    if (expenseEventDate(event) !== date || compareMoney(event.economicAmount, zero) <= 0) return [];
    const descriptor = descriptors.get(event.expenseEventId);
    if (descriptor === undefined) {
      incomplete = true;
      return [];
    }
    return [{
      expenseEventId: event.expenseEventId,
      economicDate: date,
      label: descriptor.label,
      eventKind: event.kind === "CANONICAL_CHARGE" ? "ECONOMIC_CHARGE" : event.kind,
      amount: event.economicAmount,
      sourceRefs: uniqueSourceRefs([
        ...descriptor.sourceRefs,
        ...event.componentKeys.map((id) => ({ kind: "economic_component", id })),
      ]),
      ...(descriptor.merchantLabel === undefined ? {} : { merchantLabel: descriptor.merchantLabel }),
      ...(descriptor.effectiveTime === undefined ? {} : { effectiveTime: descriptor.effectiveTime }),
      ...(descriptor.placeLabel === undefined ? {} : { placeLabel: descriptor.placeLabel }),
      ...(descriptor.narrativeOwnerId === undefined ? {} : { narrativeOwnerId: descriptor.narrativeOwnerId }),
    }];
  });
  values.sort((left, right) =>
    compareMoney(right.amount, left.amount)
    || left.label.localeCompare(right.label, "fr")
    || (left.effectiveTime ?? "").localeCompare(right.effectiveTime ?? "")
    || left.expenseEventId.localeCompare(right.expenseEventId));
  return incomplete
    ? {
        status: "PARTIAL",
        items: values,
        partialMeaning: "OBSERVED_ONLY",
        knownCount: values.length,
        quality: { reasonCode: "DATA_PARTIAL_SOURCE" },
      }
    : { status: "KNOWN", items: values, totalCount: values.length };
}

function prefixCollection<T>(source: CollectionValue<T>, limit: number): CollectionValue<T> {
  if (source.status === "KNOWN") {
    const items = source.items.slice(0, limit);
    return { status: "KNOWN", items, totalCount: items.length, ...(source.quality === undefined ? {} : { quality: source.quality }) };
  }
  if (source.status === "PARTIAL") {
    const items = source.items.slice(0, limit);
    return {
      status: "PARTIAL",
      items,
      partialMeaning: "OBSERVED_ONLY",
      knownCount: items.length,
      ...(source.quality === undefined ? {} : { quality: source.quality }),
    };
  }
  return source;
}

function hiddenCount<T>(source: CollectionValue<T>, visibleCount: number): MetricValue<number> {
  if (source.status === "KNOWN") return { status: "KNOWN", value: Math.max(0, source.items.length - visibleCount) };
  if (source.status === "PARTIAL") {
    return {
      status: "PARTIAL",
      value: Math.max(0, source.items.length - visibleCount),
      partialMeaning: "OBSERVED_ONLY",
      quality: source.quality ?? { reasonCode: "DATA_PARTIAL_SOURCE" },
    };
  }
  return { status: source.status, ...(source.quality === undefined ? {} : { quality: source.quality }) };
}

function target(resource: QueryTargetRef["resource"], params: Record<string, string>): QueryTargetRef {
  return { resource, params: Object.freeze({ ...params }) };
}

function hoverForDay(input: {
  readonly date: LocalDate;
  readonly amount: MetricValue<Money>;
  readonly contexts: CollectionValue<PersonContextSummary>;
  readonly markers: CollectionValue<CalendarItemSummary>;
  readonly ribbons: CollectionValue<CalendarItemSummary>;
  readonly expenses: CollectionValue<EconomicExpenseSummary>;
}): DayHoverReadModel {
  const visibleExpenses = prefixCollection(input.expenses, 3);
  const sourceRefs = uniqueSourceRefs([
    ...(input.contexts.status === "KNOWN" || input.contexts.status === "PARTIAL"
      ? input.contexts.items.flatMap(({ sourceRefs }) => sourceRefs) : []),
    ...(input.markers.status === "KNOWN" || input.markers.status === "PARTIAL"
      ? input.markers.items.flatMap(({ sourceRefs }) => sourceRefs) : []),
    ...(input.ribbons.status === "KNOWN" || input.ribbons.status === "PARTIAL"
      ? input.ribbons.items.flatMap(({ sourceRefs }) => sourceRefs) : []),
    ...(visibleExpenses.status === "KNOWN" || visibleExpenses.status === "PARTIAL"
      ? visibleExpenses.items.flatMap(({ sourceRefs }) => sourceRefs) : []),
  ]);
  return {
    date: input.date,
    economicAmount: metricNode(input.amount, "CORE"),
    contexts: collectionNode(input.contexts, "DETAIL"),
    calendarEvents: collectionNode(input.markers, "DETAIL"),
    activeRibbons: collectionNode(input.ribbons, "DETAIL"),
    economicExpenses: collectionNode(visibleExpenses, "DETAIL"),
    hiddenExpenseCount: hiddenCount(input.expenses, visibleExpenses.status === "KNOWN" || visibleExpenses.status === "PARTIAL" ? visibleExpenses.items.length : 0),
    sourceRefs,
  };
}

function dayReadModel(
  context: HistoryV2ReadModelBuilderContext,
  date: LocalDate,
  selectedMonth: YearMonth,
  markerLimit: 3 | 6,
): MonthCalendarDayReadModel {
  const calendars = calendarByMonth(context);
  const daily = dailyByMonth(context);
  const { artifact, day } = artifactDay(calendars, date);
  const directory = new Map(context.personDirectory.map((entry) => [entry.personId, entry]));
  const descriptors = new Map(context.expenseDescriptors.map((entry) => [entry.expenseEventId, entry]));
  const orderedMarkers: CollectionValue<CalendarItemSummary> = day === undefined
    ? { status: "UNKNOWN", quality: { reasonCode: "DATA_NO_SOURCE" } }
    : mapCollection(day.orderedMarkerGroups, calendarSummary);
  const visibleMarkers = orderedMarkers.status === "KNOWN" || orderedMarkers.status === "PARTIAL"
    ? orderedMarkers.items.slice(0, markerLimit)
    : [];
  const contexts = contextSummaries(day, directory);
  const ribbons = activeRibbonItems(artifact, date);
  const ribbonCollection: CollectionValue<CalendarItemSummary> = artifact === undefined
    ? { status: "UNKNOWN", quality: { reasonCode: "DATA_NO_SOURCE" } }
    : artifact.items.status === "PARTIAL"
      ? {
          status: "PARTIAL",
          items: ribbons.map(calendarSummary),
          partialMeaning: "OBSERVED_ONLY",
          knownCount: ribbons.length,
          quality: artifact.items.quality,
        }
      : { status: "KNOWN", items: ribbons.map(calendarSummary), totalCount: ribbons.length };
  const amount = dailyAmount(daily, date);
  const expenses = expenseSummariesForDate(daily.get(yearMonthOf(date)), date, descriptors);
  const personContexts = Object.fromEntries(
    (contexts.status === "KNOWN" || contexts.status === "PARTIAL" ? contexts.items : [])
      .map((summary) => [summary.personId, { visibility: "VISIBLE" as const, data: summary }]),
  );
  const sourceRefs = uniqueSourceRefs([
    ...(orderedMarkers.status === "KNOWN" || orderedMarkers.status === "PARTIAL"
      ? orderedMarkers.items.flatMap(({ sourceRefs }) => sourceRefs) : []),
    ...(ribbonCollection.status === "KNOWN" || ribbonCollection.status === "PARTIAL"
      ? ribbonCollection.items.flatMap(({ sourceRefs }) => sourceRefs) : []),
    ...(contexts.status === "KNOWN" || contexts.status === "PARTIAL"
      ? contexts.items.flatMap(({ sourceRefs }) => sourceRefs) : []),
    ...(expenses.status === "KNOWN" || expenses.status === "PARTIAL"
      ? expenses.items.flatMap(({ sourceRefs }) => sourceRefs) : []),
  ]);
  return {
    date,
    inSelectedMonth: yearMonthOf(date) === selectedMonth,
    targetMonth: yearMonthOf(date),
    economicAmount: metricNode(amount, "CORE"),
    personContexts,
    orderedMarkerGroups: orderedMarkers,
    visibleMarkers,
    hiddenMarkerCount: hiddenCount(orderedMarkers, visibleMarkers.length),
    activeRibbonItemIds: ribbons.map(({ calendarItemId }) => calendarItemId),
    hover: {
      visibility: "VISIBLE",
      data: hoverForDay({
        date,
        amount,
        contexts,
        markers: orderedMarkers,
        ribbons: ribbonCollection,
        expenses,
      }),
    },
    journalRef: target(queryResourceKeys.historyDayJournal, { date }),
    sourceRefs,
    ...(artifact === undefined ? { quality: { reasonCode: "DATA_NO_SOURCE" } } : {}),
  };
}

function dependencyArtifacts(
  context: HistoryV2ReadModelBuilderContext,
  months: readonly YearMonth[],
): readonly (CalendarSemanticMonthArtifact | DailyEconomicLedgerMonthArtifact)[] {
  const wanted = new Set(months);
  return [
    ...context.calendarArtifacts.filter(({ month }) => wanted.has(month)),
    ...context.dailyArtifacts.filter(({ month }) => wanted.has(month)),
  ];
}

function policies(
  direct: readonly HistoryV2PolicyId[],
  dependencies: readonly (CalendarSemanticMonthArtifact | DailyEconomicLedgerMonthArtifact)[],
): PolicyVersions {
  const inherited = dependencies.flatMap((artifact) =>
    Object.keys(artifact.dependencyPolicies) as HistoryV2PolicyId[]);
  return resolvePolicyVersions([...direct, ...inherited]);
}

function meta(input: {
  readonly context: HistoryV2ReadModelBuilderContext;
  readonly resourceId: string;
  readonly months: readonly YearMonth[];
  readonly directPolicies: readonly HistoryV2PolicyId[];
  readonly directFacts?: readonly { readonly factType: string; readonly identity: string; readonly value: unknown }[];
}): HistoryV2ReadModelMeta {
  const dependencies = dependencyArtifacts(input.context, input.months);
  const resourceInputHash = computeResourceInputHash({
    identity: input.resourceId,
    facts: (input.directFacts ?? []).map((fact) => ({
      factType: fact.factType,
      identity: fact.identity,
      value: JSON.parse(JSON.stringify(fact.value)) as never,
    })),
    dependencies: dependencies.map((artifact) => ({
      dependencyId: `${artifact.artifactFamily}:${artifact.month}`,
      dependencyHash: artifact.artifactInputHash,
    })),
  });
  const policyVersions = policies(input.directPolicies, dependencies);
  const publicationMeta = input.context.publicationMeta;
  if (publicationMeta !== undefined) {
    if (!policyVersionsEqual(publicationMeta.policyVersions, policyVersions)) {
      throw new TypeError("PublicationMeta ne correspond pas aux policies de la ressource.");
    }
  }
  return {
    resourceInputHash,
    policyVersions,
    ...(publicationMeta === undefined ? {} : { publicationMeta }),
  };
}

function ribbonProjection(
  context: HistoryV2ReadModelBuilderContext,
  weekStarts: readonly LocalDate[],
): {
  readonly segments: CollectionValue<RibbonSegmentReadModel>;
  readonly overflow: CollectionValue<RibbonOverflowReadModel>;
} {
  const calendars = calendarByMonth(context);
  const segments: RibbonSegmentReadModel[] = [];
  const overflows: RibbonOverflowReadModel[] = [];
  let missing = false;
  let partial = false;
  for (const weekStart of weekStarts) {
    const referenceMonth = yearMonthOf(addDays(weekStart, 3));
    const weekMonths = uniqueStrings(
      Array.from({ length: 7 }, (_, index) => yearMonthOf(addDays(weekStart, index))),
    ) as readonly YearMonth[];
    const orderedMonths = [referenceMonth, ...weekMonths.filter((month) => month !== referenceMonth)];
    const candidates = orderedMonths.flatMap((month) => {
      const artifact = calendars.get(month);
      const row = artifact?.ribbonWeeks.find((candidate) => candidate.weekStart === weekStart);
      if (artifact === undefined || row === undefined) {
        missing = true;
        return [];
      }
      partial ||= artifact.items.status === "PARTIAL";
      return [{ artifact, row }];
    });
    // Monthly Calendar artifacts assign lanes independently. A cross-month
    // union therefore remains explicitly PARTIAL until the snapshot lot can
    // freeze a week-closure artifact; the builder preserves every source lane
    // and never invents a replacement layout.
    partial ||= weekMonths.length > 1;
    const seenItems = new Set<string>();
    for (const { artifact, row } of candidates) {
      const itemById = new Map(
        artifact.items.status === "KNOWN" || artifact.items.status === "PARTIAL"
          ? artifact.items.items.map((item) => [item.calendarItemId, item]) : [],
      );
      for (const segment of row.segments) {
        if (seenItems.has(segment.ribbonItemId)) continue;
        const item = itemById.get(segment.ribbonItemId);
        if (item === undefined) {
          partial = true;
          continue;
        }
        seenItems.add(segment.ribbonItemId);
        segments.push({
          calendarItemId: item.calendarItemId,
          weekStart,
          startColumn: segment.startColumn,
          endColumn: segment.endColumn,
          lane: segment.lane,
          title: item.title,
          iconKey: item.iconKey,
          sourceRefs: sourceRefsForItem(item),
        });
      }
    }
    const observedOverflow = candidates.reduce((value, { row }) => Math.max(value, row.ribbonOverflow), 0);
    overflows.push({ weekStart, count: observedOverflow });
  }
  const status = missing || partial ? "PARTIAL" as const : "KNOWN" as const;
  return {
    segments: status === "KNOWN"
      ? { status, items: segments, totalCount: segments.length }
      : { status, items: segments, partialMeaning: "OBSERVED_ONLY", knownCount: segments.length, quality: { reasonCode: "DATA_PARTIAL_SOURCE" } },
    overflow: status === "KNOWN"
      ? { status, items: overflows, totalCount: overflows.length }
      : { status, items: overflows, partialMeaning: "OBSERVED_ONLY", knownCount: overflows.length, quality: { reasonCode: "DATA_PARTIAL_SOURCE" } },
  };
}

export function buildMonthCalendarReadModel(
  context: HistoryV2ReadModelBuilderContext,
  month: YearMonth,
): MonthCalendarReadModel {
  const grid = monthGrid(month);
  const dates = grid.weeks.flatMap(({ dayDates }) => dayDates);
  const months = uniqueStrings(dates.map(yearMonthOf)) as readonly YearMonth[];
  const days = dates.map((date) => dayReadModel(context, date, month, 3));
  const ribbon = ribbonProjection(context, grid.weeks.map(({ weekStart }) => weekStart));
  return {
    householdId: context.householdId,
    month,
    timeZone: context.timeZone,
    gridStartDate: grid.start,
    gridEndDate: grid.end,
    weeks: grid.weeks,
    daysByDate: Object.freeze(Object.fromEntries(days.map((day) => [day.date, day]))),
    ribbonSegments: ribbon.segments,
    ribbonOverflow: ribbon.overflow,
    quickOverviewRef: target(queryResourceKeys.historyMonthOverview, {}),
    sourceRefs: uniqueSourceRefs(days.flatMap(({ sourceRefs }) => sourceRefs)),
    capabilities: context.capabilities,
    ...meta({
      context,
      resourceId: "history_month_calendar",
      months,
      directPolicies: ["week_journal_projection", "quality_visibility", "facts_hash"],
    }),
  };
}

export function buildWeekReadModel(
  context: HistoryV2ReadModelBuilderContext,
  weekStart: LocalDate,
): WeekReadModel {
  if (Temporal.PlainDate.from(weekStart).dayOfWeek !== 1) {
    throw new TypeError("history_week exige un weekStart lundi.");
  }
  const dates = Array.from({ length: 7 }, (_, index) => addDays(weekStart, index));
  const referenceMonth = yearMonthOf(dates[3]);
  const days = dates.map((date): WeekDayReadModel => {
    const base = dayReadModel(context, date, referenceMonth, 6);
    const { inSelectedMonth: _inSelectedMonth, targetMonth: _targetMonth, ...rest } = base;
    return { ...rest, inReferenceMonth: yearMonthOf(date) === referenceMonth };
  }) as unknown as WeekReadModel["days"];
  const ribbon = ribbonProjection(context, [weekStart]);
  const months = uniqueStrings(dates.map(yearMonthOf)) as readonly YearMonth[];
  return {
    householdId: context.householdId,
    weekStart,
    weekEnd: dates[6],
    referenceMonth,
    days,
    ribbonSegments: ribbon.segments,
    ribbonOverflow: ribbon.overflow,
    sourceRefs: uniqueSourceRefs(days.flatMap(({ sourceRefs }) => sourceRefs)),
    capabilities: context.capabilities,
    ...meta({
      context,
      resourceId: "history_week",
      months,
      directPolicies: ["week_journal_projection", "quality_visibility", "facts_hash"],
    }),
  };
}

function collectionForDate<T extends { readonly date: LocalDate }>(
  source: CollectionValue<T>,
  date: LocalDate,
): CollectionValue<T> {
  return mapCollection(source, (value) => value).status === "KNOWN"
    ? { status: "KNOWN", items: (source as Extract<CollectionValue<T>, { status: "KNOWN" }>).items.filter((item) => item.date === date), totalCount: (source as Extract<CollectionValue<T>, { status: "KNOWN" }>).items.filter((item) => item.date === date).length }
    : source.status === "PARTIAL"
      ? {
          status: "PARTIAL",
          items: source.items.filter((item) => item.date === date),
          partialMeaning: "OBSERVED_ONLY",
          knownCount: source.items.filter((item) => item.date === date).length,
          ...(source.quality === undefined ? {} : { quality: source.quality }),
        }
      : source;
}

const localTimePattern = /^(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/;

function comparableLocalTime(value: string | undefined): string | undefined {
  if (value === undefined || !localTimePattern.test(value)) return undefined;
  return value.length === 5 ? `${value}:00` : value;
}

function uniqueExpenseEvents(
  expenses: readonly EconomicExpenseSummary[],
): readonly EconomicExpenseSummary[] | undefined {
  const byId = new Map<string, EconomicExpenseSummary>();
  for (const expense of expenses) {
    const existing = byId.get(expense.expenseEventId);
    if (existing === undefined) {
      byId.set(expense.expenseEventId, expense);
      continue;
    }
    if (
      existing.economicDate !== expense.economicDate
      || existing.amount !== expense.amount
      || existing.effectiveTime !== expense.effectiveTime
    ) {
      return undefined;
    }
  }
  return [...byId.values()];
}

/**
 * Keeps the authoritative narrative/causal projection separate from temporal
 * inclusion. This selection is also the Journal display de-duplication source.
 */
export function selectCausalExpenses(
  expenses: CollectionValue<EconomicExpenseSummary>,
  narrativeOwnerId: string,
): CollectionValue<EconomicExpenseSummary> {
  if (expenses.status !== "KNOWN" && expenses.status !== "PARTIAL") return expenses;
  const items = expenses.items.filter((expense) =>
    expense.narrativeOwnerId === narrativeOwnerId);
  return expenses.status === "KNOWN"
    ? {
        status: "KNOWN",
        items,
        totalCount: items.length,
        ...(expenses.quality === undefined ? {} : { quality: expenses.quality }),
      }
    : {
        status: "PARTIAL",
        items,
        partialMeaning: "OBSERVED_ONLY",
        knownCount: items.length,
        ...(expenses.quality === undefined ? {} : { quality: expenses.quality }),
      };
}

/**
 * Sums human economic expenses by effective economic timing only. Narrative
 * ownership and causal links are deliberately absent from this contract.
 */
export function computeSpentDuring(input: {
  readonly expenses: CollectionValue<EconomicExpenseSummary>;
  readonly window: SpentDuringWindow;
}): MetricValue<Money> {
  const { startDate, endDate } = input.window;
  if (startDate === undefined || endDate === undefined) {
    return { status: "UNKNOWN", quality: { reasonCode: "DATA_UNASSIGNED_TIMING" } };
  }
  if (startDate > endDate) {
    return { status: "CONFLICT", quality: { reasonCode: "DATA_CONFLICTING_AUTHORITIES" } };
  }

  const punctual = startDate === endDate;
  const startTime = comparableLocalTime(input.window.startTime);
  const endTime = comparableLocalTime(input.window.endTime);
  if (punctual && input.window.startTime === undefined && input.window.endTime === undefined) {
    return { status: "NOT_APPLICABLE", quality: { reasonCode: "POLICY_NOT_APPLICABLE" } };
  }
  if (punctual && (startTime === undefined || endTime === undefined)) {
    return { status: "UNKNOWN", quality: { reasonCode: "DATA_UNASSIGNED_TIMING" } };
  }
  if (punctual && startTime! > endTime!) {
    return { status: "CONFLICT", quality: { reasonCode: "DATA_CONFLICTING_AUTHORITIES" } };
  }
  if (input.expenses.status !== "KNOWN" && input.expenses.status !== "PARTIAL") {
    return { status: input.expenses.status, ...(input.expenses.quality === undefined ? {} : { quality: input.expenses.quality }) };
  }

  const unique = uniqueExpenseEvents(input.expenses.items);
  if (unique === undefined) {
    return { status: "CONFLICT", quality: { reasonCode: "DATA_CONFLICTING_AUTHORITIES" } };
  }
  const inDateWindow = unique.filter(({ economicDate }) =>
    startDate <= economicDate && economicDate <= endDate);
  const imprecisePunctualExpenses = punctual
    ? inDateWindow.filter(({ effectiveTime }) =>
        comparableLocalTime(effectiveTime) === undefined)
    : [];
  const included = punctual
    ? inDateWindow.filter(({ effectiveTime }) => {
        const time = comparableLocalTime(effectiveTime);
        return time !== undefined && startTime! <= time && time <= endTime!;
      })
    : inDateWindow;
  const amount = included
    .map(({ amount: value }) => value)
    .reduce(addMoney, zero);

  const incomplete = input.expenses.status === "PARTIAL"
    || imprecisePunctualExpenses.length > 0;
  if (!incomplete) {
    return { status: "KNOWN", value: amount };
  }
  const quality = imprecisePunctualExpenses.length > 0
    ? { reasonCode: "DATA_UNASSIGNED_TIMING" as const }
    : input.expenses.quality ?? { reasonCode: "DATA_PARTIAL_SOURCE" as const };
  return included.length > 0
    ? {
        status: "PARTIAL",
        value: amount,
        partialMeaning: "OBSERVED_ONLY",
        quality,
      }
    : { status: "UNKNOWN", quality };
}

function participantsForItem(
  item: CalendarSemanticItem,
  directory: ReadonlyMap<string, PersonDirectoryEntry>,
): readonly ParticipantSummary[] {
  return [
    ...item.householdParticipants.flatMap((participantId): ParticipantSummary[] => {
      const person = directory.get(participantId);
      return person === undefined ? [] : [{ participantId, label: person.label, kind: "HOUSEHOLD", sourceRefs: person.sourceRefs }];
    }),
    ...(item.externalParticipants ?? []).map((participantId): ParticipantSummary => ({
      participantId,
      label: participantId,
      kind: "EXTERNAL",
      sourceRefs: [{ kind: "external_participant", id: participantId }],
    })),
  ];
}

function allExpenseSummaries(
  context: HistoryV2ReadModelBuilderContext,
  descriptorById: ReadonlyMap<string, EconomicExpenseDescriptor>,
): CollectionValue<EconomicExpenseSummary> {
  const output: EconomicExpenseSummary[] = [];
  let partial = false;
  for (const artifact of context.dailyArtifacts) {
    for (const event of artifact.expenseEvents) {
      const date = expenseEventDate(event);
      if (date === undefined || compareMoney(event.economicAmount, zero) <= 0) {
        partial ||= date === undefined && compareMoney(event.economicAmount, zero) > 0;
        continue;
      }
      const descriptor = descriptorById.get(event.expenseEventId);
      if (descriptor === undefined) {
        partial = true;
        continue;
      }
      output.push({
        expenseEventId: event.expenseEventId,
        economicDate: date,
        label: descriptor.label,
        eventKind: event.kind === "CANONICAL_CHARGE" ? "ECONOMIC_CHARGE" : event.kind,
        amount: event.economicAmount,
        sourceRefs: uniqueSourceRefs([...descriptor.sourceRefs, ...event.componentKeys.map((id) => ({ kind: "economic_component", id }))]),
        ...(descriptor.narrativeOwnerId === undefined ? {} : { narrativeOwnerId: descriptor.narrativeOwnerId }),
        ...(descriptor.merchantLabel === undefined ? {} : { merchantLabel: descriptor.merchantLabel }),
        ...(descriptor.effectiveTime === undefined ? {} : { effectiveTime: descriptor.effectiveTime }),
        ...(descriptor.placeLabel === undefined ? {} : { placeLabel: descriptor.placeLabel }),
      });
    }
  }
  return partial
    ? { status: "PARTIAL", items: output, partialMeaning: "OBSERVED_ONLY", knownCount: output.length, quality: { reasonCode: "DATA_PARTIAL_SOURCE" } }
    : { status: "KNOWN", items: output, totalCount: output.length };
}

function journalMoment(
  item: CalendarSemanticItem,
  expenses: CollectionValue<EconomicExpenseSummary>,
  supplement: JournalSupplement,
): JournalMomentSummary | undefined {
  const momentRef = sourceRefsForItem(item).find(({ kind }) => kind === "moment");
  if (momentRef === undefined && item.sourceKind !== "fused") return undefined;
  const causal = selectCausalExpenses(expenses, item.calendarItemId);
  const visible = prefixCollection(causal, 3);
  const causalCost = supplement.causalCostByCalendarItemId[item.calendarItemId]
    ?? { status: "UNKNOWN" as const, quality: { reasonCode: "DATA_NO_SOURCE" as const } };
  const spentDuring = computeSpentDuring({
    expenses,
    window: {
      ...(item.startDate === undefined ? {} : { startDate: item.startDate }),
      ...(item.endDate === undefined ? {} : { endDate: item.endDate }),
      ...(item.startTime === undefined ? {} : { startTime: item.startTime }),
    },
  });
  return {
    momentId: momentRef?.id ?? item.calendarItemId,
    causalCost: metricNode(causalCost, "DETAIL"),
    spentDuring: metricNode(spentDuring, "DETAIL"),
    causalExpenses: collectionNode(visible, "DETAIL"),
    hiddenCausalExpenseCount: hiddenCount(causal, visible.status === "KNOWN" || visible.status === "PARTIAL" ? visible.items.length : 0),
    detailRef: target(queryResourceKeys.historyMomentDetail, { momentId: momentRef?.id ?? item.calendarItemId }),
  };
}

export function buildJournalDayReadModel(
  context: HistoryV2ReadModelBuilderContext,
  date: LocalDate,
  supplement: JournalSupplement,
): JournalDayReadModel {
  const calendars = calendarByMonth(context);
  const daily = dailyByMonth(context);
  const { artifact, day } = artifactDay(calendars, date);
  const directory = new Map(context.personDirectory.map((entry) => [entry.personId, entry]));
  const descriptors = new Map(context.expenseDescriptors.map((entry) => [entry.expenseEventId, entry]));
  const contexts = contextSummaries(day, directory);
  const ribbons = activeRibbonItems(artifact, date);
  const items = artifact?.items.status === "KNOWN" || artifact?.items.status === "PARTIAL"
    ? artifact.items.items.filter((item) => itemCovers(item, date)) : [];
  const timelineItems = items.filter(({ renderMode }) => renderMode === "Marker" || renderMode === "DetailOnly");
  const expenseCollection = allExpenseSummaries(context, descriptors);
  const timeline = timelineItems.map((item): JournalTimelineItem => ({
    calendarItemId: item.calendarItemId,
    title: item.title,
    iconKey: item.iconKey,
    ...(item.startTime === undefined ? {} : { startTime: item.startTime }),
    ...(item.startDate === undefined ? {} : { dateLabel: item.startDate === item.endDate ? item.startDate : `${item.startDate} – ${item.endDate}` }),
    participants: participantsForItem(item, directory),
    ...(supplement.placeByCalendarItemId?.[item.calendarItemId] === undefined ? {} : { placeLabel: supplement.placeByCalendarItemId[item.calendarItemId] }),
    ...(journalMoment(item, expenseCollection, supplement) === undefined ? {} : { moment: journalMoment(item, expenseCollection, supplement)! }),
    sourceRefs: sourceRefsForItem(item),
    ...(item.quality === undefined ? {} : { quality: item.quality }),
  }));
  const timed = timeline.filter((item) => item.startTime !== undefined).sort((left, right) =>
    left.startTime!.localeCompare(right.startTime!) || left.calendarItemId.localeCompare(right.calendarItemId));
  const order = new Map((day?.orderedMarkerGroups.status === "KNOWN" || day?.orderedMarkerGroups.status === "PARTIAL"
    ? day.orderedMarkerGroups.items : []).map((item, index) => [item.calendarItemId, index]));
  const untimed = timeline.filter((item) => item.startTime === undefined).sort((left, right) =>
    (order.get(left.calendarItemId) ?? Number.MAX_SAFE_INTEGER) - (order.get(right.calendarItemId) ?? Number.MAX_SAFE_INTEGER)
    || left.calendarItemId.localeCompare(right.calendarItemId));
  const participants = new Map<string, ParticipantSummary>();
  for (const item of items) {
    for (const participant of participantsForItem(item, directory)) participants.set(participant.participantId, participant);
  }
  const continuous: JournalContinuousEvent[] = ribbons.flatMap((item) =>
    item.startDate === undefined || item.endDate === undefined ? [] : [{
      calendarItemId: item.calendarItemId,
      title: item.title,
      iconKey: item.iconKey,
      startDate: item.startDate,
      endDate: item.endDate,
      sourceRefs: sourceRefsForItem(item),
      ...(item.quality === undefined ? {} : { quality: item.quality }),
    }]);
  const expensesForDay = expenseCollection.status === "KNOWN" || expenseCollection.status === "PARTIAL"
    ? {
        ...expenseCollection,
        items: expenseCollection.items.filter((expense) => expense.economicDate === date && expense.narrativeOwnerId === undefined),
        ...(expenseCollection.status === "KNOWN"
          ? { totalCount: expenseCollection.items.filter((expense) => expense.economicDate === date && expense.narrativeOwnerId === undefined).length }
          : { knownCount: expenseCollection.items.filter((expense) => expense.economicDate === date && expense.narrativeOwnerId === undefined).length }),
      } as CollectionValue<EconomicExpenseSummary>
    : expenseCollection;
  const sourceRefs = uniqueSourceRefs([
    ...items.flatMap(sourceRefsForItem),
    ...(expenseCollection.status === "KNOWN" || expenseCollection.status === "PARTIAL" ? expenseCollection.items.flatMap(({ sourceRefs }) => sourceRefs) : []),
  ]);
  return {
    householdId: context.householdId,
    date,
    economicAmount: metricNode(dailyAmount(daily, date), "CORE"),
    dayParticipants: collectionNode({ status: "KNOWN", items: [...participants.values()], totalCount: participants.size }, "DETAIL"),
    contexts: collectionNode(contexts, "DETAIL"),
    activeContinuousEvents: collectionNode({ status: "KNOWN", items: continuous, totalCount: continuous.length }, "DETAIL"),
    timedTimeline: collectionNode({ status: "KNOWN", items: timed, totalCount: timed.length }, "DETAIL"),
    untimedEvents: collectionNode({ status: "KNOWN", items: untimed, totalCount: untimed.length }, "DETAIL"),
    otherMovements: {
      otherExpenses: collectionNode(expensesForDay, "DETAIL"),
      refundsAndAdjustments: collectionNode(collectionForDate(supplement.refundsAndAdjustments, date), "DETAIL"),
      inflows: collectionNode(collectionForDate(supplement.inflows, date), "DETAIL"),
      technicalMovements: collectionNode(collectionForDate(supplement.technicalMovements, date), "DETAIL"),
    },
    navigation: {
      previousDate: addDays(date, -1),
      previousRef: target(queryResourceKeys.historyDayJournal, { date: addDays(date, -1) }),
      nextDate: addDays(date, 1),
      nextRef: target(queryResourceKeys.historyDayJournal, { date: addDays(date, 1) }),
    },
    sourceRefs,
    capabilities: context.capabilities,
    ...meta({
      context,
      resourceId: "history_day_journal",
      months: uniqueStrings([yearMonthOf(date), ...context.dailyArtifacts.map(({ month }) => month)]) as readonly YearMonth[],
      directPolicies: ["week_journal_projection", "quality_visibility", "facts_hash"],
      directFacts: [{ factType: "journal_supplement", identity: date, value: supplement }],
    }),
  };
}

const lifeMarkerOrder: readonly LifeMarkerFamily[] = [
  "TRAVEL_STAY",
  "IMPORTANT_VISITS",
  "DRIVING",
  "LEAVE_REST",
  "WORK_RHYTHM",
];

function daysCoveredInMonth(item: CalendarSemanticItem, month: YearMonth): readonly LocalDate[] {
  const start = item.startDate ?? item.anchorDate;
  const end = item.endDate ?? item.anchorDate;
  if (start === undefined || end === undefined) return [];
  const monthStart = parseLocalDate(`${month}-01`);
  const monthEnd = addDays(parseLocalDate(`${addMonths(month, 1)}-01`), -1);
  const values: LocalDate[] = [];
  for (let date = start < monthStart ? monthStart : start; date <= (end > monthEnd ? monthEnd : end); date = addDays(date, 1)) values.push(date);
  return values;
}

function buildLifeMarkers(
  artifact: CalendarSemanticMonthArtifact | undefined,
  month: YearMonth,
): CollectionValue<LifeMarkerReadModel> {
  if (artifact === undefined || (artifact.items.status !== "KNOWN" && artifact.items.status !== "PARTIAL")) {
    return { status: "UNKNOWN", quality: { reasonCode: "DATA_NO_SOURCE" } };
  }
  const items = artifact.items.items;
  const familyData: Record<LifeMarkerFamily, { label: string; unit: "DAY" | "SESSION"; items: CalendarSemanticItem[] }> = {
    TRAVEL_STAY: { label: "Voyages et séjours", unit: "DAY", items: items.filter((item) => ["voyage_sejour", "voyage", "week-end-escapade"].includes(item.semanticTypeKey)) },
    IMPORTANT_VISITS: { label: "Visites importantes", unit: "SESSION", items: items.filter((item) => ["visite_famille", "visite_ami", "visite-familiale"].includes(item.semanticTypeKey)) },
    DRIVING: { label: "Conduite", unit: "SESSION", items: items.filter((item) => ["lecon_conduite", "examen_permis"].includes(item.semanticTypeKey)) },
    LEAVE_REST: { label: "Congés et repos", unit: "DAY", items: items.filter((item) => item.semanticTypeKey === "conge_repos") },
    WORK_RHYTHM: { label: "Rythme de travail", unit: "DAY", items: items.filter((item) => item.semanticTypeKey === "travail_site" || item.semanticTypeKey === "teletravail") },
  };
  const markers = lifeMarkerOrder.flatMap((family): LifeMarkerReadModel[] => {
    const group = familyData[family];
    if (group.items.length === 0) return [];
    const value = group.unit === "DAY"
      ? new Set(group.items.flatMap((item) => daysCoveredInMonth(item, month))).size
      : group.items.reduce((sum, item) => sum + item.rawOccurrenceCount, 0);
    const secondaryBreakdown = family === "WORK_RHYTHM"
      ? Object.fromEntries(["travail_site", "teletravail"].flatMap((type) => {
          const count = new Set(group.items.filter(({ semanticTypeKey }) => semanticTypeKey === type).flatMap((item) => daysCoveredInMonth(item, month))).size;
          return count === 0 ? [] : [[type, count]];
        }))
      : undefined;
    return [{
      family,
      label: group.label,
      primaryValue: metricNode({ status: "KNOWN", value }, "DETAIL"),
      unit: group.unit,
      ...(secondaryBreakdown === undefined || Object.keys(secondaryBreakdown).length === 0 ? {} : { secondaryBreakdown }),
      sourceRefs: uniqueSourceRefs(group.items.flatMap(sourceRefsForItem)),
    }];
  });
  return artifact.items.status === "PARTIAL"
    ? { status: "PARTIAL", items: markers, partialMeaning: "OBSERVED_ONLY", knownCount: markers.length, quality: artifact.items.quality }
    : { status: "KNOWN", items: markers, totalCount: markers.length };
}

function knownCost(value: MetricNode<Money>): Money | undefined {
  return value.visibility === "VISIBLE" && value.data.status === "KNOWN" ? value.data.value : undefined;
}

function highlightDuration(value: MonthHighlightReadModel, month: YearMonth): number {
  const item = { startDate: value.startDate, endDate: value.endDate ?? value.startDate, anchorDate: value.startDate } as CalendarSemanticItem;
  return daysCoveredInMonth(item, month).length;
}

function highlightComparator(month: YearMonth, byItem: ReadonlyMap<string, CalendarSemanticItem>) {
  return (left: MonthHighlightReadModel, right: MonthHighlightReadModel): number => {
    const leftItem = left.calendarItemId === undefined ? undefined : byItem.get(left.calendarItemId);
    const rightItem = right.calendarItemId === undefined ? undefined : byItem.get(right.calendarItemId);
    const continuityRank = (item: CalendarSemanticItem | undefined) => item?.continuityQualifier?.status === "KNOWN" && item.continuityQualifier.value === "CONTINUOUS" ? 1 : 0;
    const leftCost = knownCost(left.causalCost);
    const rightCost = knownCost(right.causalCost);
    const costCompare = leftCost === undefined || rightCost === undefined ? 0 : compareMoney(rightCost, leftCost);
    return (rightItem?.priorityBand ?? 0) - (leftItem?.priorityBand ?? 0)
      || right.narrativeClass - left.narrativeClass
      || (rightItem?.priorityWeight ?? 0) - (leftItem?.priorityWeight ?? 0)
      || continuityRank(rightItem) - continuityRank(leftItem)
      || highlightDuration(right, month) - highlightDuration(left, month)
      || costCompare
      || left.startDate.localeCompare(right.startDate)
      || left.highlightId.localeCompare(right.highlightId);
  };
}

export function buildMonthQuickOverviewReadModel(
  context: HistoryV2ReadModelBuilderContext,
  month: YearMonth,
  supplement: MonthOverviewSupplement,
): MonthQuickOverviewReadModel {
  const artifact = calendarByMonth(context).get(month);
  const ledger = dailyByMonth(context).get(month);
  const items = artifact?.items.status === "KNOWN" || artifact?.items.status === "PARTIAL" ? artifact.items.items : [];
  const byItem = new Map(items.map((item) => [item.calendarItemId, item]));
  const candidates: MonthHighlightReadModel[] = items.flatMap((item): MonthHighlightReadModel[] => {
    const isClass3 = (item.sourceKind === "moment" || item.sourceKind === "fused") && item.spanBehavior !== "PROJECT_PERIOD";
    const isClass2 = item.sourceKind !== "moment" && item.sourceKind !== "fused" && item.monthVisibility && item.priorityBand >= 4 && item.renderMode !== "Context";
    if (!isClass3 && !isClass2) return [];
    const startDate = item.startDate ?? item.anchorDate;
    if (startDate === undefined) return [];
    return [{
      highlightId: `calendar:${item.calendarItemId}`,
      narrativeClass: isClass3 ? 3 : 2,
      calendarItemId: item.calendarItemId,
      title: item.title,
      dateLabel: item.endDate === undefined || item.endDate === startDate ? startDate : `${startDate} – ${item.endDate}`,
      iconKey: item.iconKey,
      ...(supplement.imageRefByCalendarItemId?.[item.calendarItemId] === undefined ? {} : { imageRef: supplement.imageRefByCalendarItemId[item.calendarItemId] }),
      ...(item.householdParticipants.length === 0 ? {} : { participantIds: item.householdParticipants }),
      ...(supplement.placeByCalendarItemId?.[item.calendarItemId] === undefined ? {} : { placeLabel: supplement.placeByCalendarItemId[item.calendarItemId] }),
      causalCost: metricNode(supplement.causalCostByCalendarItemId[item.calendarItemId] ?? { status: "UNKNOWN", quality: { reasonCode: "DATA_NO_SOURCE" } }, "DETAIL"),
      startDate,
      ...(item.endDate === undefined || item.endDate === startDate ? {} : { endDate: item.endDate }),
      sourceRefs: sourceRefsForItem(item),
      ...(item.quality === undefined ? {} : { quality: item.quality }),
    }];
  });
  for (const incident of supplement.explicitIncidentHighlights) {
    candidates.push({
      highlightId: incident.highlightId,
      narrativeClass: 1,
      calendarItemId: incident.calendarItemId,
      title: incident.title,
      dateLabel: incident.dateLabel,
      iconKey: incident.iconKey,
      causalCost: metricNode(incident.causalCost, "DETAIL"),
      startDate: incident.startDate,
      ...(incident.endDate === undefined ? {} : { endDate: incident.endDate }),
      sourceRefs: incident.sourceRefs,
    });
  }
  const dedupedByIdentity = new Map<string, MonthHighlightReadModel>();
  for (const candidate of candidates) {
    const identity = candidate.calendarItemId ?? candidate.highlightId;
    const current = dedupedByIdentity.get(identity);
    if (current === undefined || candidate.narrativeClass > current.narrativeClass) {
      dedupedByIdentity.set(identity, candidate);
    }
  }
  const deduped = [...dedupedByIdentity.values()].sort(highlightComparator(month, byItem));
  const highlights: CollectionValue<MonthHighlightReadModel> = artifact === undefined
    ? { status: "UNKNOWN", quality: { reasonCode: "DATA_NO_SOURCE" } }
    : artifact.items.status === "PARTIAL"
      ? { status: "PARTIAL", items: deduped.slice(0, 5), partialMeaning: "OBSERVED_ONLY", knownCount: Math.min(5, deduped.length), quality: artifact.items.quality }
      : { status: "KNOWN", items: deduped.slice(0, 5), totalCount: Math.min(5, deduped.length) };
  const totalEligibleHighlights: MetricValue<number> = artifact === undefined
    ? { status: "UNKNOWN", quality: { reasonCode: "DATA_NO_SOURCE" } }
    : artifact.items.status === "PARTIAL"
      ? { status: "PARTIAL", value: deduped.length, partialMeaning: "OBSERVED_ONLY", quality: artifact.items.quality }
      : { status: "KNOWN", value: deduped.length };
  const lifeMarkers = buildLifeMarkers(artifact, month);
  const economicActual: MetricValue<Money> = ledger === undefined
    ? { status: "UNKNOWN", quality: { reasonCode: "DATA_NO_SOURCE" } }
    : { status: "KNOWN", value: ledger.actualMonthAmount };
  return {
    householdId: context.householdId,
    month,
    flows: {
      bankOutflows: metricNode(supplement.bankOutflows, "CORE"),
      economicActual: metricNode(economicActual, "CORE"),
      bankInflows: metricNode(supplement.bankInflows, "CORE"),
    },
    lifeMarkers: collectionNode(lifeMarkers, "DETAIL"),
    highlights: collectionNode(highlights, "DETAIL"),
    totalEligibleHighlights,
    sourceRefs: uniqueSourceRefs([
      ...(artifact?.items.status === "KNOWN" || artifact?.items.status === "PARTIAL" ? artifact.items.items.flatMap(sourceRefsForItem) : []),
      ...supplement.explicitIncidentHighlights.flatMap(({ sourceRefs }) => sourceRefs),
    ]),
    capabilities: context.capabilities,
    ...meta({
      context,
      resourceId: "history_month_overview",
      months: [month],
      directPolicies: ["month_overview_selection", "quality_visibility", "facts_hash"],
      directFacts: [{ factType: "month_overview_supplement", identity: month, value: supplement }],
    }),
  };
}

export function assertReadModelPublicationCompatibility(input: {
  readonly policyVersions: PolicyVersions;
  readonly publicationMeta?: PublicationMeta;
}): void {
  if (input.publicationMeta === undefined) return;
  if (
    !policyVersionsEqual(input.publicationMeta.policyVersions, input.policyVersions)
  ) {
    throw new TypeError("PublicationMeta incompatible avec le ReadModel History V2.");
  }
}
