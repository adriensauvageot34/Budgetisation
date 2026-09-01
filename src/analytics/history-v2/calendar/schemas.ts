import {
  createCollectionValueSchema,
  createMetricValueSchema,
  parseCalendarFilterTag,
  parseProvenance,
  parseQualityEnvelope,
} from "../../../core/history-v2";
import {
  createRuntimeSchema,
  hasOwn,
  parseStrictRecord,
  parseStringLiteral,
  requireProperty,
  type UnknownRecord,
} from "../../../core/validation";
import { parseLocalDate, parseYearMonth } from "../../../core/time";
import { parseMoney } from "../../../core/money";
import { parseHouseholdId } from "../../../core/identity";
import { parseArtifactInputHash } from "../facts-hash";
import type {
  CalendarRibbonSegment,
  CalendarSemanticItem,
  CalendarSemanticMonthArtifact,
  ContinuityQualifier,
} from "./types";

const renderModes = new Set(["Context", "Marker", "Ribbon", "DetailOnly"]);
const sourceKinds = new Set(["life_event", "moment", "fused", "context", "aggregate", "economic"]);
const titleKinds = new Set(["EXPLICIT_HUMAN", "GENERATED_WITH_PLACE", "GENERIC_FALLBACK"]);
const markerTiers = new Set(["Dominant", "Standard", "Secondary"]);
const spanBehaviors = new Set(["POINT", "DAILY_CONTEXT", "AUTO_CONTINUOUS", "EXPLICIT_CONTINUITY", "PROJECT_PERIOD", "INCIDENT_PERIOD"]);
const qualifiers = new Set(["CONTINUOUS", "NOT_CONTINUOUS"]);

function stringValue(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim().length === 0) throw new TypeError(`${field} invalide.`);
  return value;
}

function stringArray(value: unknown, field: string): readonly string[] {
  if (!Array.isArray(value)) throw new TypeError(`${field} doit être un tableau.`);
  const parsed = value.map((entry, index) => stringValue(entry, `${field}[${index}]`));
  if (new Set(parsed).size !== parsed.length) throw new TypeError(`${field} contient un doublon.`);
  return parsed;
}

function integer(value: unknown, field: string, min = 0, max = Number.MAX_SAFE_INTEGER): number {
  if (!Number.isSafeInteger(value) || (value as number) < min || (value as number) > max) {
    throw new TypeError(`${field} doit être un entier entre ${min} et ${max}.`);
  }
  return value as number;
}

function optionalDate(record: UnknownRecord, key: string) {
  return hasOwn(record, key) ? parseLocalDate(record[key]) : undefined;
}

const continuitySchema = createMetricValueSchema(createRuntimeSchema((value) =>
  parseStringLiteral<ContinuityQualifier>(value, qualifiers, "ContinuityQualifier")));
const moneyMetricSchema = createMetricValueSchema(createRuntimeSchema(parseMoney));

export const calendarSemanticItemSchema = createRuntimeSchema((value: unknown): CalendarSemanticItem => {
  const record = parseStrictRecord(value, [
    "calendarItemId", "sourceKind", "sourceRefs", "filterTags", "itemKind", "semanticTypeKey", "title", "titleKind",
    "iconKey", "renderMode", "markerTier", "priorityBand", "priorityWeight", "spanBehavior",
    "continuityQualifier", "anchorDate", "startDate", "endDate", "startTime",
    "householdParticipants", "externalParticipants", "parentItemId", "memberSourceIds",
    "rawOccurrenceCount", "monthVisibility", "authority", "quality",
  ], "CalendarSemanticItem");
  const renderMode = parseStringLiteral<CalendarSemanticItem["renderMode"]>(requireProperty(record, "renderMode", "CalendarSemanticItem"), renderModes, "CalendarSemanticItem.renderMode");
  const markerTier = hasOwn(record, "markerTier")
    ? parseStringLiteral<NonNullable<CalendarSemanticItem["markerTier"]>>(record.markerTier, markerTiers, "CalendarSemanticItem.markerTier")
    : undefined;
  if ((renderMode === "Marker") !== (markerTier !== undefined)) {
    throw new TypeError("Un Marker exige markerTier et les autres modes l'interdisent.");
  }
  const startDate = optionalDate(record, "startDate");
  const endDate = optionalDate(record, "endDate");
  if ((startDate === undefined) !== (endDate === undefined) || (startDate !== undefined && endDate! < startDate)) {
    throw new TypeError("CalendarSemanticItem porte un intervalle incohérent.");
  }
  const monthVisibility = requireProperty(record, "monthVisibility", "CalendarSemanticItem");
  if (typeof monthVisibility !== "boolean") throw new TypeError("monthVisibility doit être booléen.");
  return {
    calendarItemId: stringValue(requireProperty(record, "calendarItemId", "CalendarSemanticItem"), "calendarItemId"),
    sourceKind: parseStringLiteral(requireProperty(record, "sourceKind", "CalendarSemanticItem"), sourceKinds, "sourceKind"),
    sourceRefs: stringArray(requireProperty(record, "sourceRefs", "CalendarSemanticItem"), "sourceRefs"),
    filterTags: (() => {
      const tags = requireProperty(record, "filterTags", "CalendarSemanticItem");
      if (!Array.isArray(tags)) throw new TypeError("CalendarSemanticItem.filterTags doit être un tableau.");
      const parsed = tags.map(parseCalendarFilterTag);
      if (new Set(parsed).size !== parsed.length) throw new TypeError("CalendarSemanticItem.filterTags contient un doublon.");
      return parsed;
    })(),
    itemKind: parseStringLiteral(requireProperty(record, "itemKind", "CalendarSemanticItem"), new Set(["LIFE", "ECONOMIC"]), "itemKind"),
    semanticTypeKey: stringValue(requireProperty(record, "semanticTypeKey", "CalendarSemanticItem"), "semanticTypeKey"),
    title: stringValue(requireProperty(record, "title", "CalendarSemanticItem"), "title"),
    titleKind: parseStringLiteral(requireProperty(record, "titleKind", "CalendarSemanticItem"), titleKinds, "titleKind"),
    iconKey: stringValue(requireProperty(record, "iconKey", "CalendarSemanticItem"), "iconKey"),
    renderMode,
    ...(markerTier === undefined ? {} : { markerTier }),
    priorityBand: integer(requireProperty(record, "priorityBand", "CalendarSemanticItem"), "priorityBand", 1, 5) as 1 | 2 | 3 | 4 | 5,
    priorityWeight: integer(requireProperty(record, "priorityWeight", "CalendarSemanticItem"), "priorityWeight"),
    spanBehavior: parseStringLiteral(requireProperty(record, "spanBehavior", "CalendarSemanticItem"), spanBehaviors, "spanBehavior"),
    ...(hasOwn(record, "continuityQualifier") ? { continuityQualifier: continuitySchema.parse(record.continuityQualifier) } : {}),
    ...(optionalDate(record, "anchorDate") === undefined ? {} : { anchorDate: optionalDate(record, "anchorDate")! }),
    ...(startDate === undefined ? {} : { startDate, endDate: endDate! }),
    ...(hasOwn(record, "startTime") ? { startTime: stringValue(record.startTime, "startTime") } : {}),
    householdParticipants: stringArray(requireProperty(record, "householdParticipants", "CalendarSemanticItem"), "householdParticipants"),
    ...(hasOwn(record, "externalParticipants") ? { externalParticipants: stringArray(record.externalParticipants, "externalParticipants") } : {}),
    ...(hasOwn(record, "parentItemId") ? { parentItemId: stringValue(record.parentItemId, "parentItemId") } : {}),
    memberSourceIds: stringArray(requireProperty(record, "memberSourceIds", "CalendarSemanticItem"), "memberSourceIds"),
    rawOccurrenceCount: integer(requireProperty(record, "rawOccurrenceCount", "CalendarSemanticItem"), "rawOccurrenceCount"),
    monthVisibility,
    authority: parseProvenance(requireProperty(record, "authority", "CalendarSemanticItem")),
    ...(hasOwn(record, "quality") ? { quality: parseQualityEnvelope(record.quality) } : {}),
  };
});

export const calendarSemanticItemsSchema = createCollectionValueSchema(calendarSemanticItemSchema);

function parseRibbonSegment(value: unknown): CalendarRibbonSegment {
  const record = parseStrictRecord(value, ["ribbonItemId", "weekStart", "segmentStart", "segmentEnd", "originalStart", "originalEnd", "startColumn", "endColumn", "lane"], "CalendarRibbonSegment");
  return {
    ribbonItemId: stringValue(requireProperty(record, "ribbonItemId", "CalendarRibbonSegment"), "ribbonItemId"),
    weekStart: parseLocalDate(requireProperty(record, "weekStart", "CalendarRibbonSegment")),
    segmentStart: parseLocalDate(requireProperty(record, "segmentStart", "CalendarRibbonSegment")),
    segmentEnd: parseLocalDate(requireProperty(record, "segmentEnd", "CalendarRibbonSegment")),
    originalStart: parseLocalDate(requireProperty(record, "originalStart", "CalendarRibbonSegment")),
    originalEnd: parseLocalDate(requireProperty(record, "originalEnd", "CalendarRibbonSegment")),
    startColumn: integer(requireProperty(record, "startColumn", "CalendarRibbonSegment"), "startColumn", 1, 7),
    endColumn: integer(requireProperty(record, "endColumn", "CalendarRibbonSegment"), "endColumn", 1, 7),
    lane: integer(requireProperty(record, "lane", "CalendarRibbonSegment"), "lane", 1, 4) as 1 | 2 | 3 | 4,
  };
}

function parseRibbonOverflowSegment(value: unknown) {
  const record = parseStrictRecord(value, [
    "ribbonItemId", "weekStart", "segmentStart", "segmentEnd", "originalStart", "originalEnd",
  ], "CalendarRibbonOverflowSegment");
  const segmentStart = parseLocalDate(requireProperty(record, "segmentStart", "CalendarRibbonOverflowSegment"));
  const segmentEnd = parseLocalDate(requireProperty(record, "segmentEnd", "CalendarRibbonOverflowSegment"));
  if (segmentEnd < segmentStart) {
    throw new TypeError("CalendarRibbonOverflowSegment.segmentEnd doit être >= segmentStart.");
  }
  return {
    ribbonItemId: stringValue(requireProperty(record, "ribbonItemId", "CalendarRibbonOverflowSegment"), "ribbonItemId"),
    weekStart: parseLocalDate(requireProperty(record, "weekStart", "CalendarRibbonOverflowSegment")),
    segmentStart,
    segmentEnd,
    originalStart: parseLocalDate(requireProperty(record, "originalStart", "CalendarRibbonOverflowSegment")),
    originalEnd: parseLocalDate(requireProperty(record, "originalEnd", "CalendarRibbonOverflowSegment")),
  };
}

export const calendarSemanticMonthArtifactSchema = createRuntimeSchema((value: unknown): CalendarSemanticMonthArtifact => {
  const record = parseStrictRecord(value, ["artifactFamily", "householdId", "month", "items", "days", "ribbonWeeks", "semanticIssues", "economicProjection", "sourceScope", "dependencyPolicies", "artifactInputHash"], "CalendarSemanticMonthArtifact");
  if (requireProperty(record, "artifactFamily", "CalendarSemanticMonthArtifact") !== "calendar_semantic_month") throw new TypeError("artifactFamily calendrier invalide.");
  const days = requireProperty(record, "days", "CalendarSemanticMonthArtifact");
  const weeks = requireProperty(record, "ribbonWeeks", "CalendarSemanticMonthArtifact");
  if (!Array.isArray(days) || !Array.isArray(weeks)) throw new TypeError("days/ribbonWeeks doivent être des tableaux.");
  // Engine outputs are reparsed item-by-item; day references must point to these parsed items.
  const parsedItems = calendarSemanticItemsSchema.parse(requireProperty(record, "items", "CalendarSemanticMonthArtifact"));
  const parsedDays = days.map((day) => {
    const row = parseStrictRecord(day, ["date", "contextItems", "orderedMarkerGroups", "markers", "hiddenMarkerGroupCount"], "CalendarDayProjection");
    const contextItems = requireProperty(row, "contextItems", "CalendarDayProjection");
    const markers = requireProperty(row, "markers", "CalendarDayProjection");
    if (!Array.isArray(contextItems) || !Array.isArray(markers)) {
      throw new TypeError("CalendarDayProjection contextItems/markers doivent être des tableaux.");
    }
    const parsedMarkers = markers.map((item) => calendarSemanticItemSchema.parse(item));
    const orderedMarkerGroups = calendarSemanticItemsSchema.parse(
      requireProperty(row, "orderedMarkerGroups", "CalendarDayProjection"),
    );
    if (
      orderedMarkerGroups.status === "KNOWN"
      || orderedMarkerGroups.status === "PARTIAL"
    ) {
      const expectedPrefix = orderedMarkerGroups.items.slice(0, 3).map(({ calendarItemId }) => calendarItemId);
      const actualPrefix = parsedMarkers.map(({ calendarItemId }) => calendarItemId);
      if (JSON.stringify(actualPrefix) !== JSON.stringify(expectedPrefix)) {
        throw new TypeError("CalendarDayProjection.markers doit être le préfixe 1-3 de orderedMarkerGroups.");
      }
    }
    return {
      date: parseLocalDate(requireProperty(row, "date", "CalendarDayProjection")),
      contextItems: contextItems.map((item) => calendarSemanticItemSchema.parse(item)),
      orderedMarkerGroups,
      markers: parsedMarkers,
      hiddenMarkerGroupCount: integer(requireProperty(row, "hiddenMarkerGroupCount", "CalendarDayProjection"), "hiddenMarkerGroupCount"),
    };
  });
  const parsedWeeks = weeks.map((week) => {
    const row = parseStrictRecord(week, ["weekStart", "segments", "overflowSegments", "ribbonOverflow"], "CalendarRibbonWeek");
    const segments = requireProperty(row, "segments", "CalendarRibbonWeek");
    const overflowSegments = requireProperty(row, "overflowSegments", "CalendarRibbonWeek");
    if (!Array.isArray(segments) || !Array.isArray(overflowSegments)) throw new TypeError("segments/overflowSegments doivent être des tableaux.");
    const parsedOverflow = overflowSegments.map(parseRibbonOverflowSegment);
    const ribbonOverflow = integer(requireProperty(row, "ribbonOverflow", "CalendarRibbonWeek"), "ribbonOverflow");
    if (ribbonOverflow !== parsedOverflow.length) throw new TypeError("ribbonOverflow doit égaler overflowSegments.length.");
    const overflowIds = parsedOverflow.map(({ ribbonItemId }) => ribbonItemId);
    if (new Set(overflowIds).size !== overflowIds.length) throw new TypeError("overflowSegments contient un Ribbon dupliqué.");
    return {
      weekStart: parseLocalDate(requireProperty(row, "weekStart", "CalendarRibbonWeek")),
      segments: segments.map(parseRibbonSegment),
      overflowSegments: parsedOverflow,
      ribbonOverflow,
    };
  });
  const projectionRecord = parseStrictRecord(
    requireProperty(record, "economicProjection", "CalendarSemanticMonthArtifact"),
    ["householdId", "month", "markers", "days", "unassignedComponentKeys", "issues", "dependencyPolicies", "projectionInputHash"],
    "CalendarEconomicProjection",
  );
  const projectionDays = requireProperty(projectionRecord, "days", "CalendarEconomicProjection");
  const unassignedComponentKeys = requireProperty(projectionRecord, "unassignedComponentKeys", "CalendarEconomicProjection");
  const projectionIssues = requireProperty(projectionRecord, "issues", "CalendarEconomicProjection");
  if (!Array.isArray(projectionDays) || !Array.isArray(unassignedComponentKeys) || !Array.isArray(projectionIssues)) {
    throw new TypeError("Collections CalendarEconomicProjection invalides.");
  }
  const projectionPoliciesRecord = parseStrictRecord(
    requireProperty(projectionRecord, "dependencyPolicies", "CalendarEconomicProjection"),
    ["calendar_amount_views", "canonical_component_classification", "daily_economic_allocation", "quality_visibility", "facts_hash"],
    "CalendarEconomicProjection.dependencyPolicies",
  );
  const projectionPolicies = {
    calendar_amount_views: parseStringLiteral<"v1">(requireProperty(projectionPoliciesRecord, "calendar_amount_views", "CalendarEconomicProjection.dependencyPolicies"), new Set(["v1"]), "calendar_amount_views"),
    canonical_component_classification: parseStringLiteral<"v1">(requireProperty(projectionPoliciesRecord, "canonical_component_classification", "CalendarEconomicProjection.dependencyPolicies"), new Set(["v1"]), "canonical_component_classification"),
    daily_economic_allocation: parseStringLiteral<"v1">(requireProperty(projectionPoliciesRecord, "daily_economic_allocation", "CalendarEconomicProjection.dependencyPolicies"), new Set(["v1"]), "daily_economic_allocation"),
    quality_visibility: parseStringLiteral<"v1">(requireProperty(projectionPoliciesRecord, "quality_visibility", "CalendarEconomicProjection.dependencyPolicies"), new Set(["v1"]), "quality_visibility"),
    facts_hash: parseStringLiteral<"v1">(requireProperty(projectionPoliciesRecord, "facts_hash", "CalendarEconomicProjection.dependencyPolicies"), new Set(["v1"]), "facts_hash"),
  } as const;
  const economicProjection = {
    householdId: parseHouseholdId(requireProperty(projectionRecord, "householdId", "CalendarEconomicProjection")),
    month: parseYearMonth(requireProperty(projectionRecord, "month", "CalendarEconomicProjection")),
    markers: calendarSemanticItemsSchema.parse(requireProperty(projectionRecord, "markers", "CalendarEconomicProjection")),
    days: projectionDays.map((entry) => {
      const day = parseStrictRecord(entry, ["date", "economicAmountExcludingFixed"], "CalendarEconomicDayProjection");
      return {
        date: parseLocalDate(requireProperty(day, "date", "CalendarEconomicDayProjection")),
        economicAmountExcludingFixed: moneyMetricSchema.parse(requireProperty(day, "economicAmountExcludingFixed", "CalendarEconomicDayProjection")),
      };
    }),
    unassignedComponentKeys: stringArray(unassignedComponentKeys, "unassignedComponentKeys"),
    issues: stringArray(projectionIssues, "issues"),
    dependencyPolicies: projectionPolicies,
    projectionInputHash: parseArtifactInputHash(requireProperty(projectionRecord, "projectionInputHash", "CalendarEconomicProjection")),
  };
  // Remaining strict substructures are produced by the engine and JSON-safe; validate their required discriminants.
  const month = parseYearMonth(requireProperty(record, "month", "CalendarSemanticMonthArtifact"));
  const householdId = parseHouseholdId(requireProperty(record, "householdId", "CalendarSemanticMonthArtifact"));
  if (economicProjection.month !== month || economicProjection.householdId !== householdId) {
    throw new TypeError("CalendarEconomicProjection doit appartenir au même foyer et au même mois que l'artifact Calendar.");
  }
  const artifact = value as CalendarSemanticMonthArtifact;
  return {
    ...artifact,
    householdId,
    month,
    items: parsedItems,
    days: parsedDays,
    ribbonWeeks: parsedWeeks,
    economicProjection,
    artifactInputHash: parseArtifactInputHash(
      requireProperty(record, "artifactInputHash", "CalendarSemanticMonthArtifact"),
    ),
  };
});
