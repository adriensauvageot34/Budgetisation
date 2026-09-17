import type { GlobalTimelineV2Event } from "@/query-api/global-v2";

export type TimelineDensityMode = "PRINCIPAL" | "EXTENDED";

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
