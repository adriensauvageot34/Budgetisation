import type { Money } from "../../core/money";
import type { LocalDate } from "../../core/time";
import {
  resolveTimelineSemanticClassification,
  type TimelineSemanticClassification,
} from "./timeline-semantic-taxonomy";
import type { TimelineLifeEventCost } from "./timeline-event-cost";

export const TIMELINE_SEMANTIC_PROJECTION_VERSION = "timeline-semantic-projection@v1" as const;

export type TimelineSemanticProjectionAssertion = Readonly<{
  eventRef:
    | Readonly<{ sourceKind: "MOMENT"; momentId: string }>
    | Readonly<{ sourceKind: "LIFE_EVENT"; lifeEventId: string }>;
  visibilityTier: "PRINCIPAL" | "EXTENDED";
  closeFamilyKey: string;
  taxonomyVersion: string;
}>;

type TimelineSemanticSourceOntology = Readonly<{
  typeKey: string;
  typeLabel: string;
  familyKey: string;
}>;

type TimelineSemanticPlaceOwner = Readonly<{
  placeRef: string;
  label?: string;
  subtypeLabel?: string;
}>;

export type TimelineSemanticMomentOwner = TimelineSemanticSourceOntology & Readonly<{
  momentId: string;
  canonicalName: string;
  startDate: LocalDate;
  endDate: LocalDate | null;
  participantRefs: readonly string[];
  places: readonly TimelineSemanticPlaceOwner[];
  causalCost:
    | Readonly<{ status: "KNOWN" | "PARTIAL"; value: Money }>
    | Readonly<{ status: "UNKNOWN" | "NOT_APPLICABLE" | "CONFLICT" }>;
  seriesRef?: string;
}>;

export type TimelineSemanticLifeEventOwner = TimelineSemanticSourceOntology & Readonly<{
  lifeEventId: string;
  canonicalTitle?: string;
  startDate: LocalDate;
  endDate: LocalDate | null;
  participantRefs: readonly string[];
  places: readonly TimelineSemanticPlaceOwner[];
  parentLifeEventRef?: string;
  seriesRef?: string;
  ownedByCertifiedMoment: boolean;
}>;

export type TimelineSemanticEventCost =
  | Readonly<{ authority: "M6_CAUSAL"; status: "KNOWN"; value: Money }>
  | Readonly<{ authority: "M6_CAUSAL"; status: "PARTIAL" | "UNKNOWN" | "NOT_APPLICABLE" | "CONFLICT" }>
  | Readonly<{ authority: "CANONICAL_LINKED"; status: "KNOWN"; value: Money }>
  | Readonly<{ authority: "CANONICAL_LINKED"; status: "UNKNOWN" | "CONFLICT" }>
  | Readonly<{ authority: "NONE"; status: "UNKNOWN" }>;

export type TimelineSemanticProjectionEvent = Readonly<{
  eventRef: `moment:${string}` | `life-event:${string}`;
  sourceKind: "MOMENT" | "LIFE_EVENT";
  canonicalName: string;
  startDate: LocalDate;
  endDate: LocalDate | null;
  visibilityTier: "PRINCIPAL" | "EXTENDED";
  semanticClassification: TimelineSemanticClassification;
  sourceOntology: Readonly<{
    typeKey: string;
    typeLabel: string;
    familyKey: string;
  }>;
  eventCost: TimelineSemanticEventCost;
  series?: Readonly<{ seriesRef: string; label?: string }>;
  places: readonly Readonly<{
    placeRef: string;
    label?: string;
    subtypeLabel?: string;
  }>[];
  participants: Readonly<{
    count: number;
    participantRefs: readonly string[];
  }>;
  momentDetailAvailable: boolean;
}>;

export type TimelineSemanticProjection = Readonly<{
  methodVersion: typeof TIMELINE_SEMANTIC_PROJECTION_VERSION;
  sourceRevision: number;
  sortContract: "startDate ASC, eventRef ASC";
  events: readonly TimelineSemanticProjectionEvent[];
  counts: Readonly<{
    topLevel: number;
    principal: number;
    extendedOnly: number;
  }>;
}>;

function assertionRef(assertion: TimelineSemanticProjectionAssertion): string {
  return assertion.eventRef.sourceKind === "MOMENT"
    ? `moment:${assertion.eventRef.momentId}`
    : `life-event:${assertion.eventRef.lifeEventId}`;
}

function uniqueBy<T>(values: readonly T[], key: (value: T) => string, code: string): ReadonlyMap<string, T> {
  const result = new Map<string, T>();
  for (const value of values) {
    const identity = key(value);
    if (result.has(identity)) throw new TypeError(`${code}:${identity}`);
    result.set(identity, value);
  }
  return result;
}

function compactPlaces(
  places: readonly TimelineSemanticPlaceOwner[],
): TimelineSemanticProjectionEvent["places"] {
  const byRef = uniqueBy(places, ({ placeRef }) => placeRef, "TIMELINE_SEMANTIC_DUPLICATE_PLACE");
  return [...byRef.values()]
    .sort((left, right) => left.placeRef.localeCompare(right.placeRef))
    .map(({ placeRef, label, subtypeLabel }) => ({
      placeRef,
      ...(label === undefined ? {} : { label }),
      ...(subtypeLabel === undefined ? {} : { subtypeLabel }),
    }));
}

function participants(participantRefs: readonly string[]): TimelineSemanticProjectionEvent["participants"] {
  const refs = [...new Set(participantRefs)].sort();
  return { count: refs.length, participantRefs: refs };
}

function series(
  seriesRef: string | undefined,
  labels: Readonly<Record<string, string>>,
): TimelineSemanticProjectionEvent["series"] {
  if (seriesRef === undefined) return undefined;
  const label = labels[seriesRef];
  return { seriesRef, ...(label === undefined ? {} : { label }) };
}

function momentCost(causalCost: TimelineSemanticMomentOwner["causalCost"]): TimelineSemanticEventCost {
  return causalCost.status === "KNOWN"
    ? { authority: "M6_CAUSAL", status: "KNOWN", value: causalCost.value }
    : { authority: "M6_CAUSAL", status: causalCost.status };
}

function lifeEventCost(cost: TimelineLifeEventCost | undefined): TimelineSemanticEventCost {
  if (cost === undefined || cost.authority === "NONE") return { authority: "NONE", status: "UNKNOWN" };
  if (cost.status === "KNOWN") {
    if (cost.value === null) throw new TypeError(`TIMELINE_SEMANTIC_KNOWN_COST_VALUE_MISSING:${cost.lifeEventId}`);
    return { authority: "CANONICAL_LINKED", status: "KNOWN", value: cost.value };
  }
  return { authority: "CANONICAL_LINKED", status: cost.status };
}

function classification(assertion: TimelineSemanticProjectionAssertion): TimelineSemanticClassification {
  return resolveTimelineSemanticClassification(assertion.closeFamilyKey, assertion.taxonomyVersion);
}

function common(
  event: TimelineSemanticMomentOwner | TimelineSemanticLifeEventOwner,
  assertion: TimelineSemanticProjectionAssertion,
  seriesLabelsByRef: Readonly<Record<string, string>>,
) {
  const seriesSummary = series(event.seriesRef, seriesLabelsByRef);
  return {
    startDate: event.startDate,
    endDate: event.endDate,
    visibilityTier: assertion.visibilityTier,
    semanticClassification: classification(assertion),
    sourceOntology: {
      typeKey: event.typeKey,
      typeLabel: event.typeLabel,
      familyKey: event.familyKey,
    },
    ...(seriesSummary === undefined ? {} : { series: seriesSummary }),
    places: compactPlaces(event.places),
    participants: participants(event.participantRefs),
  };
}

/**
 * Builds the internal semantic Timeline universe only from certified owners and
 * active assertions. Names, dates, places and costs are never used to infer
 * inclusion, visibility, semantic family, ownership or financial authority.
 */
export function buildTimelineSemanticProjection(input: Readonly<{
  sourceRevision: number;
  moments: readonly TimelineSemanticMomentOwner[];
  lifeEvents: readonly TimelineSemanticLifeEventOwner[];
  assertions: readonly TimelineSemanticProjectionAssertion[];
  lifeEventCosts: readonly TimelineLifeEventCost[];
  seriesLabelsByRef?: Readonly<Record<string, string>>;
}>): TimelineSemanticProjection {
  if (!Number.isSafeInteger(input.sourceRevision) || input.sourceRevision <= 0) {
    throw new TypeError("TIMELINE_SEMANTIC_SOURCE_REVISION_INVALID");
  }
  const moments = uniqueBy(input.moments, ({ momentId }) => momentId, "TIMELINE_SEMANTIC_DUPLICATE_MOMENT_OWNER");
  const lifeEvents = uniqueBy(input.lifeEvents, ({ lifeEventId }) => lifeEventId, "TIMELINE_SEMANTIC_DUPLICATE_LIFE_EVENT_OWNER");
  const assertions = uniqueBy(input.assertions, assertionRef, "TIMELINE_SEMANTIC_DUPLICATE_ACTIVE_ASSERTION");
  const costs = uniqueBy(input.lifeEventCosts, ({ lifeEventId }) => lifeEventId, "TIMELINE_SEMANTIC_DUPLICATE_LIFE_EVENT_COST");
  const labels = input.seriesLabelsByRef ?? {};
  const projected: TimelineSemanticProjectionEvent[] = [];

  for (const [eventRef, assertion] of assertions) {
    if (assertion.eventRef.sourceKind === "MOMENT") {
      const moment = moments.get(assertion.eventRef.momentId);
      if (moment === undefined) throw new TypeError(`TIMELINE_SEMANTIC_ASSERTED_OWNER_MISSING:${eventRef}`);
      projected.push({
        eventRef: `moment:${moment.momentId}`,
        sourceKind: "MOMENT",
        canonicalName: moment.canonicalName,
        ...common(moment, assertion, labels),
        eventCost: momentCost(moment.causalCost),
        momentDetailAvailable: true,
      });
      continue;
    }

    const event = lifeEvents.get(assertion.eventRef.lifeEventId);
    if (event === undefined) throw new TypeError(`TIMELINE_SEMANTIC_ASSERTED_OWNER_MISSING:${eventRef}`);
    if (event.ownedByCertifiedMoment || event.parentLifeEventRef !== undefined) continue;
    if (event.canonicalTitle === undefined || event.canonicalTitle.trim() === "") {
      throw new TypeError(`TIMELINE_SEMANTIC_CANONICAL_NAME_MISSING:${eventRef}`);
    }
    projected.push({
      eventRef: `life-event:${event.lifeEventId}`,
      sourceKind: "LIFE_EVENT",
      canonicalName: event.canonicalTitle,
      ...common(event, assertion, labels),
      eventCost: lifeEventCost(costs.get(event.lifeEventId)),
      momentDetailAvailable: false,
    });
  }

  projected.sort((left, right) => left.startDate.localeCompare(right.startDate) || left.eventRef.localeCompare(right.eventRef));
  if (new Set(projected.map(({ eventRef }) => eventRef)).size !== projected.length) {
    throw new TypeError("TIMELINE_SEMANTIC_DUPLICATE_EVENT_REF");
  }
  const principal = projected.filter(({ visibilityTier }) => visibilityTier === "PRINCIPAL").length;
  return {
    methodVersion: TIMELINE_SEMANTIC_PROJECTION_VERSION,
    sourceRevision: input.sourceRevision,
    sortContract: "startDate ASC, eventRef ASC",
    events: projected,
    counts: {
      topLevel: projected.length,
      principal,
      extendedOnly: projected.length - principal,
    },
  };
}
