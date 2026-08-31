import { parseLocalDate, type LocalDate, type YearMonth } from "@/core/time";
import type { HistoryOverlayTarget, HistoryV2View } from "./types";

type RawSearch = Readonly<Record<string, string | string[] | undefined>>;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function nonEmpty(value: string | undefined): string | undefined {
  return value !== undefined && value.trim() === value && value.length > 0 ? value : undefined;
}

export function parseHistoryOverlaySearch(search: RawSearch): HistoryOverlayTarget | undefined {
  const journal = first(search.journal);
  if (journal !== undefined) {
    try { return { kind: "journal", date: parseLocalDate(journal) }; } catch { return undefined; }
  }
  switch (first(search.entity)) {
    case "bridge":
      return { kind: "bridge" };
    case "category": {
      const categoryId = nonEmpty(first(search.entityId));
      return categoryId === undefined ? undefined : { kind: "category", categoryId };
    }
    case "activity": {
      const activityTypeKey = nonEmpty(first(search.entityId));
      return activityTypeKey === undefined ? undefined : { kind: "activity", activityTypeKey };
    }
    case "moment": {
      const momentId = nonEmpty(first(search.entityId));
      return momentId === undefined ? undefined : { kind: "moment", momentId };
    }
    case "place": {
      const placeId = nonEmpty(first(search.entityId));
      return placeId === undefined ? undefined : { kind: "place", placeId };
    }
    case "segment": {
      const axis = first(search.axis);
      const bucket = nonEmpty(first(search.bucket));
      if ((axis === "necessity" || axis === "behavior" || axis === "lifeScope") && bucket !== undefined) {
        return { kind: "segment", params: { axis, bucket } };
      }
      const necessity = first(search.necessity);
      const behavior = first(search.behavior);
      if ((necessity === "INDISPENSABLE" || necessity === "CONSTRAINED" || necessity === "OPTIONAL") && (behavior === "FIXED" || behavior === "VARIABLE")) {
        return { kind: "segment", params: { necessity, behavior } };
      }
      return undefined;
    }
    default:
      return undefined;
  }
}

export function historyV2Href(input: {
  readonly month: YearMonth;
  readonly view: HistoryV2View;
  readonly weekStart?: LocalDate;
  readonly overlay?: HistoryOverlayTarget;
}): string {
  const query = new URLSearchParams({ view: input.view });
  if (input.weekStart !== undefined && input.view === "calendar") query.set("week", input.weekStart);
  const target = input.overlay;
  if (target?.kind === "journal") query.set("journal", target.date);
  else if (target !== undefined) {
    query.set("entity", target.kind);
    if (target.kind === "category") query.set("entityId", target.categoryId);
    if (target.kind === "activity") query.set("entityId", target.activityTypeKey);
    if (target.kind === "moment") query.set("entityId", target.momentId);
    if (target.kind === "place") query.set("entityId", target.placeId);
    if (target.kind === "segment") {
      if ("axis" in target.params) {
        query.set("axis", target.params.axis);
        query.set("bucket", target.params.bucket);
      } else {
        query.set("necessity", target.params.necessity);
        query.set("behavior", target.params.behavior);
      }
    }
  }
  return `/historique/${input.month}?${query.toString()}`;
}

export function overlayTargetKey(target: HistoryOverlayTarget): string {
  switch (target.kind) {
    case "journal": return `journal:${target.date}`;
    case "bridge": return "bridge";
    case "category": return `category:${target.categoryId}`;
    case "activity": return `activity:${target.activityTypeKey}`;
    case "moment": return `moment:${target.momentId}`;
    case "place": return `place:${target.placeId}`;
    case "segment": return `segment:${JSON.stringify(target.params)}`;
  }
}
