import {
  calendarFilterTags,
  type CalendarFilterSelection,
  type CollectionValue,
  type MetricValue,
} from "@/core/history-v2";
import type { CalendarItemSummary } from "@/query-api";

export type FilteredMarkerProjection = {
  readonly items: readonly CalendarItemSummary[];
  readonly hidden: MetricValue<number>;
};

export function projectFilteredMarkers(
  source: CollectionValue<CalendarItemSummary>,
  filters: CalendarFilterSelection,
  limit: number,
): FilteredMarkerProjection {
  const ordered = source.status === "KNOWN" || source.status === "PARTIAL"
    ? source.items
    : [];
  const allTagsSelected = filters.tags.length === calendarFilterTags.length
    && calendarFilterTags.every((tag) => filters.tags.includes(tag));
  const filtered = ordered.filter((item) =>
    item.filterTags.length === 0
      ? allTagsSelected
      : item.filterTags.some((tag) => filters.tags.includes(tag))
  );
  const hidden: MetricValue<number> = source.status === "KNOWN"
    ? { status: "KNOWN", value: Math.max(0, filtered.length - limit) }
    : source.status === "PARTIAL"
      ? {
          status: "PARTIAL",
          value: Math.max(0, filtered.length - limit),
          partialMeaning: "OBSERVED_ONLY",
          ...(source.quality === undefined ? {} : { quality: source.quality }),
        }
      : {
          status: "UNKNOWN",
          ...(source.quality === undefined
            ? { quality: { reasonCode: "DATA_NO_SOURCE" } }
            : { quality: source.quality }),
        };
  return { items: filtered.slice(0, limit), hidden };
}
