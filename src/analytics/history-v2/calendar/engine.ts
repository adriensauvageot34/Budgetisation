import { Temporal } from "@js-temporal/polyfill";

import { computeArtifactInputHash } from "../facts-hash";
import { addDays, addMonths, parseLocalDate } from "../../../core/time";
import type { LocalDate } from "../../../core/time";
import {
  assertCalendarCatalogsExhaustive,
  requireLifeEventCatalogEntry,
  requireMomentCatalogEntry,
  type CalendarCatalogEntry,
} from "./catalog";
import type {
  CalendarAggregationPolicy,
  CalendarDayProjection,
  CalendarLifeEventSource,
  CalendarMomentSource,
  CalendarRibbonOverflowSegment,
  CalendarRibbonSegment,
  CalendarRibbonWeek,
  CalendarSemanticEngineInput,
  CalendarSemanticItem,
  CalendarSemanticMonthArtifact,
  CalendarTitleKind,
  MomentLifeEventRelationSource,
} from "./types";

type InternalItem = {
  item: CalendarSemanticItem;
  aggregationPolicy: CalendarAggregationPolicy;
  seriesId?: string;
  narrativeOwner: string;
  validationStatus: "Confirmé" | "Déduit" | "other";
};

const defaultAuthority = Object.freeze({
  kind: "DERIVED" as const,
  authority: "calendar_semantics@v1",
  methodId: "calendar-semantic-engine",
  methodVersion: "v1",
});

function sortedUnique<T extends string>(values: readonly T[]): readonly T[] {
  return [...new Set(values)].sort();
}

function hasDuration(startDate: LocalDate, endDate: LocalDate): boolean {
  return endDate > startDate;
}

function intersects(
  start: LocalDate,
  end: LocalDate,
  monthStart: LocalDate,
  monthEnd: LocalDate,
): boolean {
  return start <= monthEnd && end >= monthStart;
}

function titleFor(
  explicit: string | undefined,
  generatedPlaceTitle: string | undefined,
  fallback: string,
  suppliedKind?: CalendarTitleKind,
): { title: string; titleKind: CalendarTitleKind } {
  if (explicit !== undefined && explicit.trim().length > 0) {
    return { title: explicit.trim(), titleKind: suppliedKind ?? "EXPLICIT_HUMAN" };
  }
  if (generatedPlaceTitle !== undefined && generatedPlaceTitle.trim().length > 0) {
    return { title: generatedPlaceTitle.trim(), titleKind: "GENERATED_WITH_PLACE" };
  }
  return { title: fallback, titleKind: "GENERIC_FALLBACK" };
}

function resolveMonthVisibility(
  catalog: CalendarCatalogEntry,
  explicitMonthVisibility: boolean | undefined,
): boolean {
  switch (catalog.monthVisibility) {
    case "YES":
    case "CONTEXT_BAND":
      return true;
    case "NO":
      return false;
    case "IF_SPECIFIC":
      return explicitMonthVisibility === true;
  }
}

function ribbonDecision(
  catalog: CalendarCatalogEntry,
  startDate: LocalDate,
  endDate: LocalDate,
  continuityQualifier: CalendarSemanticItem["continuityQualifier"],
  issues: string[],
  issueIdentity: string,
): CalendarSemanticItem["renderMode"] {
  if (catalog.renderMode !== "Marker" || !hasDuration(startDate, endDate)) {
    return catalog.renderMode;
  }
  if (catalog.spanBehavior === "AUTO_CONTINUOUS") return "Ribbon";
  if (catalog.spanBehavior === "EXPLICIT_CONTINUITY") {
    if (
      continuityQualifier?.status === "KNOWN"
      && continuityQualifier.value === "CONTINUOUS"
    ) {
      return "Ribbon";
    }
    if (continuityQualifier?.status === "CONFLICT") {
      issues.push(`DATA_CONFLICTING_AUTHORITIES:${issueIdentity}`);
    } else if (continuityQualifier === undefined || continuityQualifier.status === "UNKNOWN") {
      issues.push(`DATA_NO_CONTINUITY_ASSERTION:${issueIdentity}`);
    }
  }
  return catalog.renderMode;
}

function lifeEventItem(
  source: CalendarLifeEventSource,
  issues: string[],
): InternalItem {
  const catalog = requireLifeEventCatalogEntry(source.typeKey);
  const resolvedTitle = titleFor(
    source.title,
    source.generatedPlaceTitle,
    source.typeKey,
    source.titleKind,
  );
  const sourceRef = `life_event:${source.lifeEventId}`;
  const continuityQualifier = source.continuityQualifier;
  const renderMode = ribbonDecision(
    catalog,
    source.startDate,
    source.endDate,
    continuityQualifier,
    issues,
    sourceRef,
  );
  const item: CalendarSemanticItem = {
    calendarItemId: sourceRef,
    sourceKind: "life_event",
    sourceRefs: [sourceRef],
    semanticTypeKey: source.typeKey,
    ...resolvedTitle,
    iconKey: catalog.iconKey,
    renderMode,
    ...(renderMode === "Marker" && catalog.markerTier !== undefined
      ? { markerTier: catalog.markerTier }
      : {}),
    priorityBand: catalog.priorityBand,
    priorityWeight: catalog.priorityWeight,
    spanBehavior: catalog.spanBehavior,
    ...(continuityQualifier === undefined ? {} : { continuityQualifier }),
    ...(source.startDate === source.endDate ? { anchorDate: source.startDate } : {}),
    startDate: source.startDate,
    endDate: source.endDate,
    ...(source.startTime === undefined ? {} : { startTime: source.startTime }),
    householdParticipants: sortedUnique(source.participantIds),
    ...(source.externalParticipants === undefined
      ? {}
      : { externalParticipants: sortedUnique(source.externalParticipants) }),
    ...(source.parentLifeEventId === undefined
      ? {}
      : { parentItemId: `life_event:${source.parentLifeEventId}` }),
    memberSourceIds: [sourceRef],
    rawOccurrenceCount: 1,
    monthVisibility: resolveMonthVisibility(catalog, source.explicitMonthVisibility),
    authority: source.authority ?? defaultAuthority,
  };
  return {
    item,
    aggregationPolicy: catalog.aggregationPolicy,
    ...(source.seriesId === undefined ? {} : { seriesId: source.seriesId }),
    narrativeOwner: source.title === undefined
      ? "standalone"
      : `standalone-title:${source.title.trim()}`,
    validationStatus: source.validationStatus,
  };
}

function momentItem(source: CalendarMomentSource, issues: string[]): InternalItem {
  const catalog = requireMomentCatalogEntry(source.type);
  const sourceRef = `moment:${source.momentId}`;
  const title = titleFor(source.title, undefined, catalog.normalizedKey, source.titleKind);
  // A standalone Moment has no continuity assertion of its own. Keep the safe
  // non-ribbon mode here; fusion may later import the principal Life Event's
  // explicit continuity authority.
  const renderMode = catalog.renderMode;
  return {
    item: {
      calendarItemId: sourceRef,
      sourceKind: "moment",
      sourceRefs: [sourceRef],
      semanticTypeKey: catalog.normalizedKey,
      ...title,
      iconKey: catalog.iconKey,
      renderMode,
      ...(renderMode === "Marker" && catalog.markerTier !== undefined
        ? { markerTier: catalog.markerTier }
        : {}),
      priorityBand: catalog.priorityBand,
      priorityWeight: catalog.priorityWeight,
      spanBehavior: catalog.spanBehavior,
      ...(source.startDate === source.endDate ? { anchorDate: source.startDate } : {}),
      startDate: source.startDate,
      endDate: source.endDate,
      householdParticipants: sortedUnique(source.participantIds ?? []),
      memberSourceIds: [sourceRef],
      rawOccurrenceCount: 1,
      monthVisibility: resolveMonthVisibility(catalog, undefined),
      authority: source.authority ?? defaultAuthority,
    },
    aggregationPolicy: catalog.aggregationPolicy,
    narrativeOwner: sourceRef,
    validationStatus: "other",
  };
}

function fuseAndAbsorb(
  lifeEvents: readonly CalendarLifeEventSource[],
  moments: readonly CalendarMomentSource[],
  relations: readonly MomentLifeEventRelationSource[],
  issues: string[],
): InternalItem[] {
  const lifeById = new Map(lifeEvents.map((source) => [source.lifeEventId, source]));
  const momentById = new Map(moments.map((source) => [source.momentId, source]));
  const items = new Map<string, InternalItem>();
  for (const source of lifeEvents) items.set(`life_event:${source.lifeEventId}`, lifeEventItem(source, issues));
  for (const source of moments) items.set(`moment:${source.momentId}`, momentItem(source, issues));

  const accepted = relations.filter(({ validationStatus }) =>
    validationStatus === "Confirmé" || validationStatus === "Déduit");
  for (const relation of accepted) {
    const life = lifeById.get(relation.lifeEventId);
    const moment = momentById.get(relation.momentId);
    if (life === undefined || moment === undefined) continue;
    const lifeKey = `life_event:${relation.lifeEventId}`;
    const momentKey = `moment:${relation.momentId}`;
    const lifeInternal = items.get(lifeKey);
    const momentInternal = items.get(momentKey);
    if (lifeInternal === undefined || momentInternal === undefined) continue;
    if (relation.relationType === "Préparation") continue;
    if (relation.relationType === "Composant") {
      items.delete(lifeKey);
      items.set(momentKey, {
        ...momentInternal,
        item: {
          ...momentInternal.item,
          sourceRefs: sortedUnique([...momentInternal.item.sourceRefs, lifeKey]),
          memberSourceIds: sortedUnique([...momentInternal.item.memberSourceIds, lifeKey]),
        },
      });
      continue;
    }

    const momentCatalog = requireMomentCatalogEntry(moment.type);
    const continuity = lifeInternal.item.continuityQualifier;
    const renderMode = ribbonDecision(
      momentCatalog,
      life.startDate,
      life.endDate,
      continuity,
      issues,
      momentKey,
    );
    items.delete(lifeKey);
    items.set(momentKey, {
      ...momentInternal,
      validationStatus: life.validationStatus,
      item: {
        ...momentInternal.item,
        sourceKind: "fused",
        sourceRefs: sortedUnique([...momentInternal.item.sourceRefs, lifeKey]),
        memberSourceIds: sortedUnique([...momentInternal.item.memberSourceIds, lifeKey]),
        rawOccurrenceCount: 1,
        renderMode,
        ...(renderMode === "Marker" && momentCatalog.markerTier !== undefined
          ? { markerTier: momentCatalog.markerTier }
          : { markerTier: undefined }),
        startDate: life.startDate,
        endDate: life.endDate,
        ...(life.startDate === life.endDate
          ? { anchorDate: life.startDate }
          : { anchorDate: undefined }),
        ...(continuity === undefined ? {} : { continuityQualifier: continuity }),
        householdParticipants: sortedUnique([
          ...momentInternal.item.householdParticipants,
          ...life.participantIds,
        ]),
      },
    });
  }
  const result = [...items.values()].map((value) => ({
    ...value,
    item: stripUndefined(value.item),
  }));
  for (const { item } of result) {
    if (
      item.sourceKind === "moment"
      && item.spanBehavior === "EXPLICIT_CONTINUITY"
      && item.startDate !== undefined
      && item.endDate !== undefined
      && hasDuration(item.startDate, item.endDate)
    ) {
      issues.push(`DATA_NO_CONTINUITY_ASSERTION:${item.calendarItemId}`);
    }
  }
  return result;
}

function stripUndefined<T extends object>(value: T): T {
  return Object.fromEntries(
    Object.entries(value).filter(([, child]) => child !== undefined),
  ) as T;
}

function covers(item: CalendarSemanticItem, date: LocalDate): boolean {
  const start = item.startDate ?? item.anchorDate;
  const end = item.endDate ?? item.anchorDate;
  return start !== undefined && end !== undefined && start <= date && end >= date;
}

function absorbChildren(items: InternalItem[]): InternalItem[] {
  const bySource = new Map<string, InternalItem>();
  for (const internal of items) {
    for (const sourceId of internal.item.memberSourceIds) bySource.set(sourceId, internal);
  }
  const absorbed = new Set<string>();
  const replacements = new Map<string, InternalItem>();
  for (const child of items) {
    const parentId = child.item.parentItemId;
    const childDate = child.item.anchorDate ?? child.item.startDate;
    if (parentId === undefined || childDate === undefined) continue;
    const parent = bySource.get(parentId);
    if (
      parent === undefined
      || parent.item.calendarItemId === child.item.calendarItemId
      || !parent.item.monthVisibility
      || parent.item.renderMode === "DetailOnly"
      || !covers(parent.item, childDate)
    ) continue;
    absorbed.add(child.item.calendarItemId);
    const accumulatedParent = replacements.get(parent.item.calendarItemId) ?? parent;
    replacements.set(parent.item.calendarItemId, {
      ...accumulatedParent,
      item: {
        ...accumulatedParent.item,
        sourceRefs: sortedUnique([...accumulatedParent.item.sourceRefs, ...child.item.sourceRefs]),
        memberSourceIds: sortedUnique([...accumulatedParent.item.memberSourceIds, ...child.item.memberSourceIds]),
        rawOccurrenceCount: accumulatedParent.item.rawOccurrenceCount + child.item.rawOccurrenceCount,
      },
    });
  }
  return items
    .filter(({ item }) => !absorbed.has(item.calendarItemId))
    .map((internal) => replacements.get(internal.item.calendarItemId) ?? internal);
}

function sameParticipants(left: CalendarSemanticItem, right: CalendarSemanticItem): boolean {
  return left.householdParticipants.join("\u0000") === right.householdParticipants.join("\u0000");
}

function aggregateItems(items: InternalItem[]): InternalItem[] {
  const passthrough: InternalItem[] = [];
  const groups = new Map<string, InternalItem[]>();
  for (const internal of items) {
    const { item, aggregationPolicy } = internal;
    const date = item.anchorDate;
    if (aggregationPolicy === "NONE" || date === undefined || item.sourceKind === "fused") {
      passthrough.push(internal);
      continue;
    }
    const relationKey = aggregationPolicy === "SAME_SERIES_DAY"
      ? internal.seriesId
      : item.semanticTypeKey;
    if (relationKey === undefined) {
      passthrough.push(internal);
      continue;
    }
    const key = [aggregationPolicy, date, relationKey, item.householdParticipants.join(","), internal.narrativeOwner].join("|");
    const group = groups.get(key) ?? [];
    if (group.every(({ item: other }) => sameParticipants(item, other))) {
      group.push(internal);
      groups.set(key, group);
    } else {
      passthrough.push(internal);
    }
  }
  for (const [key, group] of groups) {
    if (group.length === 1) {
      passthrough.push(group[0]);
      continue;
    }
    const representative = group[0];
    const memberSourceIds = sortedUnique(group.flatMap(({ item }) => item.memberSourceIds));
    passthrough.push({
      ...representative,
      narrativeOwner: `aggregate:${key}`,
      item: {
        ...representative.item,
        calendarItemId: `aggregate:${key}:${memberSourceIds.join("+")}`,
        sourceKind: "aggregate",
        sourceRefs: sortedUnique(group.flatMap(({ item }) => item.sourceRefs)),
        memberSourceIds,
        rawOccurrenceCount: group.reduce((sum, { item }) => sum + item.rawOccurrenceCount, 0),
        title: `${representative.item.title} ×${group.length}`,
      },
    });
  }
  return passthrough;
}

const validationRank = { "Confirmé": 2, "Déduit": 1, other: 0 } as const;
const titleRank = { EXPLICIT_HUMAN: 2, GENERATED_WITH_PLACE: 1, GENERIC_FALLBACK: 0 } as const;

function markerSort(left: InternalItem, right: InternalItem): number {
  return right.item.priorityBand - left.item.priorityBand
    || Number(right.item.sourceKind === "fused") - Number(left.item.sourceKind === "fused")
    || right.item.priorityWeight - left.item.priorityWeight
    || validationRank[right.validationStatus] - validationRank[left.validationStatus]
    || titleRank[right.item.titleKind] - titleRank[left.item.titleKind]
    || Number(right.item.startTime !== undefined) - Number(left.item.startTime !== undefined)
    || (left.item.startTime ?? "99:99").localeCompare(right.item.startTime ?? "99:99")
    || left.item.calendarItemId.localeCompare(right.item.calendarItemId);
}

function datesInMonth(start: LocalDate, end: LocalDate): readonly LocalDate[] {
  const dates: LocalDate[] = [];
  for (let current = start; current <= end; current = addDays(current, 1)) dates.push(current);
  return dates;
}

function buildDays(
  internals: readonly InternalItem[],
  monthStart: LocalDate,
  monthEnd: LocalDate,
  sourceCompleteness: CalendarSemanticEngineInput["sourceCompleteness"],
): readonly CalendarDayProjection[] {
  return datesInMonth(monthStart, monthEnd).map((date) => {
    const contexts = internals
      .filter(({ item }) => item.monthVisibility && item.renderMode === "Context" && covers(item, date))
      .map(({ item }) => item)
      .sort((a, b) => b.priorityWeight - a.priorityWeight || a.calendarItemId.localeCompare(b.calendarItemId));
    const fullMarkers = internals
      .filter(({ item }) => item.monthVisibility && item.renderMode === "Marker" && (item.anchorDate ?? item.startDate) === date)
      .sort(markerSort)
      .map(({ item }) => item);
    return {
      date,
      contextItems: contexts,
      orderedMarkerGroups: sourceCompleteness === "PARTIAL"
        ? {
            status: "PARTIAL",
            items: fullMarkers,
            partialMeaning: "OBSERVED_ONLY",
            knownCount: fullMarkers.length,
            quality: { reasonCode: "DATA_PARTIAL_SOURCE" },
          }
        : {
            status: "KNOWN",
            items: fullMarkers,
            totalCount: fullMarkers.length,
          },
      markers: fullMarkers.slice(0, 3),
      hiddenMarkerGroupCount: Math.max(0, fullMarkers.length - 3),
    };
  });
}

function mondayOf(date: LocalDate): LocalDate {
  const dayOfWeek = Temporal.PlainDate.from(date).dayOfWeek;
  return addDays(date, 1 - dayOfWeek);
}

function duration(start: LocalDate, end: LocalDate): number {
  return Temporal.PlainDate.from(start).until(Temporal.PlainDate.from(end), { largestUnit: "day" }).days + 1;
}

function buildRibbonWeeks(
  items: readonly CalendarSemanticItem[],
  monthStart: LocalDate,
  monthEnd: LocalDate,
): readonly CalendarRibbonWeek[] {
  const ribbons = items.filter((item) =>
    item.monthVisibility
    && item.renderMode === "Ribbon"
    && item.startDate !== undefined
    && item.endDate !== undefined);
  const weekStarts = sortedUnique(
    datesInMonth(mondayOf(monthStart), mondayOf(monthEnd)),
  ).filter((date) => Temporal.PlainDate.from(date).dayOfWeek === 1) as LocalDate[];
  const previousLane = new Map<string, 1 | 2 | 3 | 4>();
  return weekStarts.map((weekStart) => {
    const weekEnd = addDays(weekStart, 6);
    const candidates = ribbons
      .filter((item) => item.startDate! <= weekEnd && item.endDate! >= weekStart)
      .map((item) => ({
        item,
        segmentStart: (item.startDate! < weekStart ? weekStart : item.startDate!) as LocalDate,
        segmentEnd: (item.endDate! > weekEnd ? weekEnd : item.endDate!) as LocalDate,
      }))
      .sort((left, right) =>
        right.item.priorityBand - left.item.priorityBand
        || right.item.priorityWeight - left.item.priorityWeight
        || duration(right.segmentStart, right.segmentEnd) - duration(left.segmentStart, left.segmentEnd)
        || left.segmentStart.localeCompare(right.segmentStart)
        || left.item.calendarItemId.localeCompare(right.item.calendarItemId));
    const laneEnds = new Map<number, LocalDate>();
    const segments: CalendarRibbonSegment[] = [];
    const overflowSegments: CalendarRibbonOverflowSegment[] = [];
    for (const candidate of candidates) {
      const preferred = previousLane.get(candidate.item.calendarItemId);
      const laneChoices = sortedUnique([
        ...(preferred === undefined ? [] : [String(preferred)]),
        "1", "2", "3", "4",
      ]).map(Number) as (1 | 2 | 3 | 4)[];
      const lane = laneChoices.find((value) => {
        const last = laneEnds.get(value);
        return last === undefined || last < candidate.segmentStart;
      });
      if (lane === undefined) {
        overflowSegments.push({
          ribbonItemId: candidate.item.calendarItemId,
          weekStart,
          segmentStart: candidate.segmentStart,
          segmentEnd: candidate.segmentEnd,
          originalStart: candidate.item.startDate!,
          originalEnd: candidate.item.endDate!,
        });
        continue;
      }
      laneEnds.set(lane, candidate.segmentEnd);
      previousLane.set(candidate.item.calendarItemId, lane);
      segments.push({
        ribbonItemId: candidate.item.calendarItemId,
        weekStart,
        segmentStart: candidate.segmentStart,
        segmentEnd: candidate.segmentEnd,
        originalStart: candidate.item.startDate!,
        originalEnd: candidate.item.endDate!,
        startColumn: Temporal.PlainDate.from(candidate.segmentStart).dayOfWeek,
        endColumn: Temporal.PlainDate.from(candidate.segmentEnd).dayOfWeek,
        lane,
      });
    }
    return {
      weekStart,
      segments,
      overflowSegments,
      ribbonOverflow: overflowSegments.length,
    };
  });
}

function contextItems(input: CalendarSemanticEngineInput): InternalItem[] {
  const seen = new Set<string>();
  return input.contexts.flatMap((source) => {
    const identity = [source.date, source.typeKey, ...sortedUnique(source.participantIds)].join("|");
    if (seen.has(identity)) return [];
    seen.add(identity);
    const catalog = requireLifeEventCatalogEntry(source.typeKey === "conge_repos" || source.typeKey === "maladie"
      ? "journee_maison"
      : source.typeKey);
    const sourceRef = `context:${source.contextId}`;
    return [{
      item: {
        calendarItemId: sourceRef,
        sourceKind: "context" as const,
        sourceRefs: [sourceRef],
        semanticTypeKey: source.typeKey,
        title: source.title ?? source.typeKey,
        titleKind: source.title === undefined ? "GENERIC_FALLBACK" as const : "EXPLICIT_HUMAN" as const,
        iconKey: catalog.iconKey,
        renderMode: "Context" as const,
        priorityBand: catalog.priorityBand,
        priorityWeight: catalog.priorityWeight,
        spanBehavior: "DAILY_CONTEXT" as const,
        anchorDate: source.date,
        startDate: source.date,
        endDate: source.date,
        householdParticipants: sortedUnique(source.participantIds),
        memberSourceIds: [sourceRef],
        rawOccurrenceCount: 1,
        monthVisibility: true,
        authority: source.authority,
      },
      aggregationPolicy: "NONE" as const,
      narrativeOwner: sourceRef,
      validationStatus: "other" as const,
    }];
  });
}

function hashableItem(item: CalendarSemanticItem): Record<string, unknown> {
  return JSON.parse(JSON.stringify(item)) as Record<string, unknown>;
}

export function buildCalendarSemanticMonthArtifact(
  input: CalendarSemanticEngineInput,
): CalendarSemanticMonthArtifact {
  assertCalendarCatalogsExhaustive();
  const monthStart = parseLocalDate(`${input.month}-01`);
  const monthEnd = addDays(parseLocalDate(`${addMonths(input.month, 1)}-01`), -1);
  if (input.sourceCompleteness === "UNKNOWN") {
    return {
      artifactFamily: "calendar_semantic_month",
      householdId: input.householdId,
      month: input.month,
      items: { status: "UNKNOWN", quality: { reasonCode: "DATA_NO_SOURCE" } },
      days: [],
      ribbonWeeks: [],
      semanticIssues: ["DATA_NO_SOURCE"],
      sourceScope: { monthStart, monthEnd, includesItemsIntersectingMonth: true },
      dependencyPolicies: {
        canonical_continuity: "v1", calendar_semantics: "v1",
        quality_visibility: "v1", facts_hash: "v1",
      },
      artifactInputHash: computeArtifactInputHash({ identity: `calendar_semantic_month:${input.householdId}:${input.month}`, facts: [] }),
    };
  }
  const issues: string[] = [];
  const intersectingLifeEvents = input.lifeEvents.filter(({ startDate, endDate }) =>
    intersects(startDate, endDate, monthStart, monthEnd));
  const intersectingMoments = input.moments.filter(({ startDate, endDate }) =>
    intersects(startDate, endDate, monthStart, monthEnd));
  const prepared = fuseAndAbsorb(
    intersectingLifeEvents,
    intersectingMoments,
    input.momentLifeEvents,
    issues,
  );
  const normalized = aggregateItems(absorbChildren([
    ...prepared,
    ...contextItems({ ...input, lifeEvents: intersectingLifeEvents, moments: intersectingMoments }),
  ])).sort((a, b) => a.item.calendarItemId.localeCompare(b.item.calendarItemId));
  const items = normalized.map(({ item }) => item);
  const collection = input.sourceCompleteness === "PARTIAL"
    ? {
        status: "PARTIAL" as const,
        items,
        partialMeaning: "OBSERVED_ONLY" as const,
        knownCount: items.length,
        quality: { reasonCode: "DATA_PARTIAL_SOURCE" as const },
      }
    : { status: "KNOWN" as const, items, totalCount: items.length };
  return {
    artifactFamily: "calendar_semantic_month",
    householdId: input.householdId,
    month: input.month,
    items: collection,
    days: buildDays(normalized, monthStart, monthEnd, input.sourceCompleteness),
    ribbonWeeks: buildRibbonWeeks(items, monthStart, monthEnd),
    semanticIssues: sortedUnique(issues),
    sourceScope: { monthStart, monthEnd, includesItemsIntersectingMonth: true },
    dependencyPolicies: {
      canonical_continuity: "v1", calendar_semantics: "v1",
      quality_visibility: "v1", facts_hash: "v1",
    },
    artifactInputHash: computeArtifactInputHash({
      identity: `calendar_semantic_month:${input.householdId}:${input.month}`,
      facts: items.map((item) => ({
        factType: "calendar_semantic_item",
        identity: item.calendarItemId,
        value: hashableItem(item) as never,
      })),
    }),
  };
}

export { markerSort as compareCalendarMarkers };
