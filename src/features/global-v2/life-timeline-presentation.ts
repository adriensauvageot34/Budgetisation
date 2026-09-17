import type { GlobalTimelineComparisonDescriptor, GlobalTimelineComparisonLevel, GlobalTimelineV2Event } from "@/query-api/global-v2";

export type TimelineDensityMode = "PRINCIPAL" | "EXTENDED";

const comparisonLevelOrder = Object.freeze([
  "SAME_SERIES",
  "SAME_CLOSE_FAMILY",
  "SAME_INTERMEDIATE_FAMILY",
] as const satisfies readonly GlobalTimelineComparisonLevel[]);

const moneyFormatter = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

/** Presentation-only filter: Query visibility remains the sole authority. */
export function timelineEventsForDensity(
  events: readonly GlobalTimelineV2Event[],
  density: TimelineDensityMode,
): readonly GlobalTimelineV2Event[] {
  return density === "PRINCIPAL"
    ? events.filter(({ visibilityTier }) => visibilityTier === "PRINCIPAL")
    : events;
}

export function timelineEventAmount(event: GlobalTimelineV2Event): string {
  return event.eventCost.status === "KNOWN"
    ? moneyFormatter.format(Number(event.eventCost.value))
    : "Coût non établi";
}

export function hasTimelineComparisonAffordance(event: GlobalTimelineV2Event): boolean {
  return event.comparisonLevels.length > 0;
}

export function orderedTimelineComparisonLevels(event: GlobalTimelineV2Event): readonly GlobalTimelineComparisonDescriptor[] {
  const byLevel = new Map(event.comparisonLevels.map((descriptor) => [descriptor.level, descriptor]));
  return comparisonLevelOrder.flatMap((level) => {
    const descriptor = byLevel.get(level);
    return descriptor === undefined ? [] : [descriptor];
  });
}

export function initialTimelineComparisonLevel(event: GlobalTimelineV2Event): GlobalTimelineComparisonLevel | undefined {
  const levels = orderedTimelineComparisonLevels(event);
  if (event.defaultComparisonLevel !== undefined && levels.some(({ level }) => level === event.defaultComparisonLevel)) return event.defaultComparisonLevel;
  return levels[0]?.level;
}

export function timelineComparisonLevelLabel(event: GlobalTimelineV2Event, level: GlobalTimelineComparisonLevel): string {
  if (level === "SAME_SERIES") return event.series?.label === undefined ? "Même série" : `Même série · ${event.series.label}`;
  if (level === "SAME_CLOSE_FAMILY") return event.semanticClassification.close.label;
  return event.semanticClassification.intermediate.label;
}

export function timelineComparisonRequest(eventRef: GlobalTimelineV2Event["eventRef"], comparisonLevel: GlobalTimelineComparisonLevel) {
  return {
    resource: "analysis_global_timeline_event_comparison" as const,
    params: { eventRef, comparisonLevel },
  };
}
