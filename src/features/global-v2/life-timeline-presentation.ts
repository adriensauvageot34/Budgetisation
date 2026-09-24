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
const moneyWithCentsFormatter = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 2,
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
  if (event.eventCost.status !== "KNOWN") return "Coût non établi";
  const amount = Number(event.eventCost.value);
  return (Number.isInteger(amount) ? moneyFormatter : moneyWithCentsFormatter).format(amount);
}

export function hasTimelineComparisonAffordance(event: GlobalTimelineV2Event): boolean {
  return orderedTimelineComparisonLevels(event).length > 0;
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
  if (level === "SAME_SERIES") return event.series?.label ?? "Même série";
  if (level === "SAME_CLOSE_FAMILY") return event.semanticClassification.close.label;
  if (level === "SAME_INTERMEDIATE_FAMILY") return event.semanticClassification.intermediate.label;
  return event.semanticClassification.grand.label;
}

export type TimelineComparisonPeerSet = Readonly<{
  level: GlobalTimelineComparisonLevel;
  peerRefs: readonly string[];
}>;

function samePeerSet(left: readonly string[], right: readonly string[]): boolean {
  if (left.length !== right.length) return false;
  const rightRefs = new Set(right);
  return left.every((eventRef) => rightRefs.has(eventRef));
}

/** UI-only dedupe: server cohorts remain untouched and GRAND remains available to backend consumers. */
export function visibleTimelineComparisonLevels(
  event: GlobalTimelineV2Event,
  loadedPeerSets: readonly TimelineComparisonPeerSet[],
): readonly GlobalTimelineComparisonDescriptor[] {
  const peerSets = new Map(loadedPeerSets.map(({ level, peerRefs }) => [level, peerRefs]));
  const visible: GlobalTimelineComparisonDescriptor[] = [];
  let previousPeerRefs: readonly string[] | undefined;
  for (const descriptor of orderedTimelineComparisonLevels(event)) {
    const peerRefs = peerSets.get(descriptor.level);
    if (peerRefs !== undefined && previousPeerRefs !== undefined && samePeerSet(previousPeerRefs, peerRefs)) continue;
    visible.push(descriptor);
    if (peerRefs !== undefined) previousPeerRefs = peerRefs;
  }
  return visible.slice(0, 3);
}

export function timelineComparisonRequest(eventRef: GlobalTimelineV2Event["eventRef"], comparisonLevel: GlobalTimelineComparisonLevel) {
  return {
    resource: "analysis_global_timeline_event_comparison" as const,
    params: { eventRef, comparisonLevel },
  };
}
