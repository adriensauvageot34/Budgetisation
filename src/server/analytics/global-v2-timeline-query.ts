import "server-only";

import type {
  TimelineSemanticComparatorProjection,
  TimelineSemanticComparisonResult,
  TimelineSemanticProjection,
  TimelineSemanticProjectionEvent,
} from "@/analytics/global-v2";
import {
  buildGlobalLifeTimelineV2ReadModel,
  buildGlobalTimelineEventComparisonReadModel,
  parseGlobalLifeTimelineV2ReadModel,
  type GlobalLifeTimelineV2Snapshot,
  type GlobalReadModelPublicationMeta,
  type GlobalReadModelResourceMeta,
  type GlobalTimelineComparisonDescriptor,
  type GlobalTimelineComparisonEventObservation,
  type GlobalTimelineComparisonLevel,
  type GlobalTimelineComparisonPeerObservation,
  type GlobalTimelineEventComparisonReadModel,
  type GlobalTimelineEventCost,
  type GlobalTimelineV2Event,
  type GlobalV2QueryParams,
} from "@/query-api/global-v2";

type ResourceMetaFactory = (
  resource: "analysis_global_life_timeline" | "analysis_global_timeline_event_comparison",
  params: GlobalV2QueryParams,
) => GlobalReadModelResourceMeta;

function queryCost(event: TimelineSemanticProjectionEvent): GlobalTimelineEventCost {
  return event.eventCost.status === "KNOWN"
    ? { authority: event.eventCost.authority, status: "KNOWN", value: event.eventCost.value } as GlobalTimelineEventCost
    : { authority: event.eventCost.authority, status: event.eventCost.status } as GlobalTimelineEventCost;
}

function materialityStatus(comparison: TimelineSemanticComparisonResult): GlobalTimelineComparisonDescriptor["materiality"] {
  return comparison.materiality.status === "MATERIAL" || comparison.materiality.status === "NOT_MATERIAL"
    ? comparison.materiality.status
    : "UNKNOWN";
}

function comparisonLabel(comparison: TimelineSemanticComparisonResult): string {
  if (comparison.level === "SAME_SERIES") return "Même série";
  if (comparison.level === "SAME_CLOSE_FAMILY") return "Famille proche";
  if (comparison.level === "SAME_INTERMEDIATE_FAMILY") return "Famille intermédiaire";
  return "Vue large";
}

function eventObservation(event: TimelineSemanticProjectionEvent): GlobalTimelineComparisonEventObservation {
  return {
    eventRef: event.eventRef,
    sourceKind: event.sourceKind,
    canonicalName: event.canonicalName,
    startDate: event.startDate,
    endDate: event.endDate ?? event.startDate,
    visibilityTier: event.visibilityTier,
    eventCost: queryCost(event),
  };
}

function peerObservation(event: TimelineSemanticProjectionEvent): GlobalTimelineComparisonPeerObservation {
  const observation = eventObservation(event);
  if (observation.eventCost.status !== "KNOWN") throw new TypeError(`GLOBAL_TIMELINE_QUERY_PEER_COST_NOT_KNOWN:${event.eventRef}`);
  return observation as GlobalTimelineComparisonPeerObservation;
}

/** Pure SH-05 transport projection. It performs no cohort or statistical calculation. */
export function buildGlobalTimelineQuerySnapshots(input: Readonly<{
  projection: TimelineSemanticProjection;
  comparator: TimelineSemanticComparatorProjection;
  publicationMeta: GlobalReadModelPublicationMeta;
  resourceMeta: ResourceMetaFactory;
}>): Readonly<{
  timeline: GlobalLifeTimelineV2Snapshot;
  comparisons: readonly Readonly<{
    params: Readonly<{ eventRef: string; comparisonLevel: GlobalTimelineComparisonLevel }>;
    payload: GlobalTimelineEventComparisonReadModel;
  }>[];
}> {
  if (input.projection.sourceRevision !== input.comparator.sourceRevision) throw new TypeError("GLOBAL_TIMELINE_QUERY_SOURCE_REVISION_MISMATCH");
  const events = new Map(input.projection.events.map((event) => [event.eventRef, event] as const));
  const cards = new Map(input.comparator.cards.map((card) => [card.eventRef, card] as const));
  const results = new Map(input.comparator.comparisons.map((comparison) => [`${comparison.eventRef}|${comparison.level}`, comparison] as const));
  if (cards.size !== events.size || [...events.keys()].some((eventRef) => !cards.has(eventRef))) throw new TypeError("GLOBAL_TIMELINE_QUERY_CARD_SET_MISMATCH");

  const timelineEvents: GlobalTimelineV2Event[] = input.projection.events.map((event) => {
    const card = cards.get(event.eventRef)!;
    const descriptors = card.comparisonLevels.map((level): GlobalTimelineComparisonDescriptor => {
      const comparison = results.get(`${event.eventRef}|${level}`);
      if (comparison === undefined || comparison.relatedPeerCount < 1) throw new TypeError(`GLOBAL_TIMELINE_QUERY_ADVERTISED_LEVEL_INVALID:${event.eventRef}:${level}`);
      return {
        level,
        label: comparisonLabel(comparison),
        supportStatus: comparison.supportStatus,
        relatedPeerCount: comparison.relatedPeerCount,
        costPeerCount: comparison.costPeerCount,
        materiality: materialityStatus(comparison),
      };
    });
    const primaryPlaceLabel = event.places.find(({ label }) => label !== undefined)?.label;
    return {
      eventRef: event.eventRef,
      sourceKind: event.sourceKind,
      canonicalName: event.canonicalName,
      startDate: event.startDate,
      endDate: event.endDate ?? event.startDate,
      visibilityTier: event.visibilityTier,
      semanticClassification: event.semanticClassification,
      eventCost: queryCost(event),
      ...(event.series === undefined ? {} : { series: event.series }),
      comparisonLevels: descriptors,
      ...(card.defaultComparisonLevel === undefined ? {} : { defaultComparisonLevel: card.defaultComparisonLevel }),
      ...(card.distinctiveComparisonLevel === undefined ? {} : { distinctiveComparisonLevel: card.distinctiveComparisonLevel }),
      ...(primaryPlaceLabel === undefined ? {} : { primaryPlaceLabel }),
      ...(event.participants.count <= 1 ? {} : { participantCount: event.participants.count }),
      ...(event.spentDuringContext === undefined ? {} : { spentDuringContext: event.spentDuringContext }),
      momentDetailAvailable: event.momentDetailAvailable,
    };
  });

  const timelineParams = {};
  const timelineSnapshot = buildGlobalLifeTimelineV2ReadModel({
    kind: "global_life_timeline",
    schemaVersion: "global-life-timeline@v2",
    resource: "analysis_global_life_timeline",
    moduleKey: "RHYTHM",
    events: timelineEvents,
    publicationMeta: input.publicationMeta,
    resourceMeta: input.resourceMeta("analysis_global_life_timeline", timelineParams),
  });
  const timeline = parseGlobalLifeTimelineV2ReadModel(timelineSnapshot);

  const comparisons = timeline.events.flatMap((timelineEvent) => timelineEvent.comparisonLevels.map(({ level }) => {
    const comparison = results.get(`${timelineEvent.eventRef}|${level}`)!;
    const source = events.get(timelineEvent.eventRef)!;
    const supportStatus = comparison.supportStatus;
    const params = { eventRef: timelineEvent.eventRef, comparisonLevel: level };
    const relatedPeers = comparison.relatedPeerRefs.map((eventRef) => {
      const event = events.get(eventRef);
      if (event === undefined) throw new TypeError(`GLOBAL_TIMELINE_QUERY_PEER_MISSING:${eventRef}`);
      return eventObservation(event);
    });
    const costComparablePeers = comparison.peerCosts.map(({ eventRef }) => {
      const event = events.get(eventRef);
      if (event === undefined) throw new TypeError(`GLOBAL_TIMELINE_QUERY_PEER_MISSING:${eventRef}`);
      return peerObservation(event);
    });
    return {
      params,
      payload: buildGlobalTimelineEventComparisonReadModel({
        kind: "global_timeline_event_comparison",
        schemaVersion: "global-timeline-event-comparison@v2",
        resource: "analysis_global_timeline_event_comparison",
        moduleKey: "RHYTHM",
        subject: eventObservation(source),
        comparison: {
          level,
          label: comparisonLabel(comparison),
          cohortKey: comparison.cohortKey,
          policyVersion: comparison.policyVersion,
        },
        support: { status: supportStatus, relatedPeerCount: comparison.relatedPeerCount, costPeerCount: comparison.costPeerCount },
        ...(comparison.median === undefined || comparison.q1 === undefined || comparison.q3 === undefined || comparison.mad === undefined ? {} : { statistics: { median: comparison.median, q1: comparison.q1, q3: comparison.q3, mad: comparison.mad } }),
        ...(comparison.absoluteDelta === undefined ? {} : { deltas: { absolute: comparison.absoluteDelta, ...(comparison.relativeDelta === undefined ? {} : { relative: comparison.relativeDelta }) } }),
        materiality: { status: materialityStatus(comparison), policyRef: comparison.materiality.policyRef },
        facetContext: comparison.requiredFacets,
        relatedPeers,
        costComparablePeers,
        publicationMeta: input.publicationMeta,
        resourceMeta: input.resourceMeta("analysis_global_timeline_event_comparison", params),
      }),
    };
  }));

  return { timeline: timelineSnapshot, comparisons };
}
