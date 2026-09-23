import { sha1 } from "@noble/hashes/legacy.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex, concatBytes, hexToBytes, utf8ToBytes } from "@noble/hashes/utils.js";
import type { MobilityContextResolution } from "./mobility-context";

export const MOBILITY_TRIP_CONTEXT_METHOD_VERSION = "mobility_trip_context@v1" as const;

const LINK_NAMESPACE = "9389ed84-af5c-5a38-8425-3b6ce4f76187";

export type MobilityTripContextRelation =
  | "PRIMARY_CONTEXT"
  | "ENVELOPING_CONTEXT"
  | "DESTINATION_CONTEXT"
  | "ORIGIN_CONTEXT"
  | "STOP_CONTEXT"
  | "ACCESS_CONTEXT"
  | "ASSOCIATED_CONTEXT";

export type MobilityTripContextLinkMethod =
  | "EXACT_PLACE_TIME"
  | "EXACT_PLACE_DATE"
  | "ENCLOSING_MOMENT"
  | "CONFIRMED_MOMENT_LIFE_EVENT"
  | "ROUTINE_ACTIVITY_MATCH"
  | "ACCESS_TO_MOMENT"
  | "EXPLICIT_ASSERTION";

export type MobilityTripContextReasonCode =
  | "NO_SEMANTIC_CONTEXT_CANDIDATE"
  | "CONTEXT_TIME_MISMATCH"
  | "CONTEXT_PLACE_MISMATCH"
  | "CONTEXT_PLACE_AUTHORITY_MISSING"
  | "MULTIPLE_PRIMARY_CONTEXT_CANDIDATES"
  | "CONTEXT_HIERARCHY_AMBIGUOUS"
  | "CONTEXT_EVENT_VALIDATION_TOO_WEAK"
  | "CONTEXT_TRIP_PARTIAL_BOUNDARY"
  | "CONTEXT_ACCESS_RELATION_UNPROVEN"
  | "CONTEXT_LINK_CONFLICT"
  | "CONTEXT_ALREADY_REPRESENTED_BY_MOMENT"
  | "NO_NARRATIVE_SEMANTIC_ASSERTION";

export type MobilityTripContextLeg = {
  readonly mobilityLegId: string;
  readonly sequenceIndex: number;
  readonly travelDate: string;
  readonly originPlaceId: string | null;
  readonly destinationPlaceId: string | null;
};

export type MobilityTripContextTrip = {
  readonly mobilityTripId: string;
  readonly householdId: string;
  readonly startDate: string;
  readonly endDate: string;
  readonly boundaryStatus: string;
  readonly legs: readonly MobilityTripContextLeg[];
};

export type MobilityTripLifeEventAuthority = {
  readonly lifeEventId: string;
  readonly householdId: string;
  readonly validationStatus: "CONFIRMED" | "DERIVED" | "WEAK";
  readonly principalPlaceIds: readonly string[];
  readonly accessPlaceIds: readonly string[];
  readonly evidenceRefs: readonly string[];
};

export type MobilityTripMomentLifeEventLink = {
  readonly lifeEventId: string;
  readonly relationType: "PRIMARY_EVENT" | "COMPONENT" | "PREPARATION";
  readonly validationStatus: "CONFIRMED" | "DERIVED" | "WEAK";
  readonly evidenceRefs: readonly string[];
};

export type MobilityTripMomentAuthority = {
  readonly momentId: string;
  readonly householdId: string;
  readonly startDate: string | null;
  readonly endDate: string | null;
  readonly hasActiveSemanticAssertion: boolean;
  readonly linkedLifeEvents: readonly MobilityTripMomentLifeEventLink[];
  readonly evidenceRefs: readonly string[];
};

export type MobilityTripContextLink = {
  readonly mobilityTripContextLinkId: string;
  readonly householdId: string;
  readonly mobilityTripId: string;
  readonly lifeEventId: string | null;
  readonly momentId: string | null;
  readonly relationType: MobilityTripContextRelation;
  readonly anchorLegId: string | null;
  readonly anchorPlaceId: string | null;
  readonly linkMethod: MobilityTripContextLinkMethod;
  readonly validationStatus: "CONFIRMED" | "DERIVED";
  readonly authority: string;
  readonly provenance: readonly string[];
  readonly evidenceRefs: readonly string[];
  readonly sourceRevision: number;
};

export type MobilityTripContextResolutionAudit = {
  readonly mobilityTripId: string;
  readonly status: "RESOLVED" | "UNRESOLVED" | "CONFLICT";
  readonly reasonCodes: readonly MobilityTripContextReasonCode[];
  readonly linkIds: readonly string[];
};

export type MobilityTripContextBuildResult = {
  readonly links: readonly MobilityTripContextLink[];
  readonly resolutions: readonly MobilityTripContextResolutionAudit[];
  readonly buildHash: string;
};

type Candidate = {
  readonly lifeEvent: MobilityTripLifeEventAuthority;
  readonly leg: MobilityTripContextLeg;
  readonly relationType: Exclude<MobilityTripContextRelation, "ENVELOPING_CONTEXT" | "ACCESS_CONTEXT">;
  readonly anchorPlaceId: string;
  readonly linkMethod: "EXACT_PLACE_TIME" | "EXACT_PLACE_DATE";
  readonly validationStatus: "CONFIRMED" | "DERIVED";
  readonly momentOnly: boolean;
  readonly evidenceRefs: readonly string[];
};

function unique(values: readonly string[]): readonly string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

function uuidV5(namespace: string, name: string): string {
  const namespaceBytes = hexToBytes(namespace.replaceAll("-", ""));
  const bytes = sha1(concatBytes(namespaceBytes, utf8ToBytes(name))).slice(0, 16);
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytesToHex(bytes);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function linkId(link: Omit<MobilityTripContextLink, "mobilityTripContextLinkId">): string {
  return uuidV5(LINK_NAMESPACE, [
    link.householdId,
    MOBILITY_TRIP_CONTEXT_METHOD_VERSION,
    link.mobilityTripId,
    link.lifeEventId === null ? `moment:${link.momentId}` : `life-event:${link.lifeEventId}`,
    link.relationType,
    link.anchorLegId ?? "",
    link.anchorPlaceId ?? "",
  ].join("|"));
}

function makeLink(link: Omit<MobilityTripContextLink, "mobilityTripContextLinkId">): MobilityTripContextLink {
  return { mobilityTripContextLinkId: linkId(link), ...link };
}

function endpointFor(
  leg: MobilityTripContextLeg,
  relation: MobilityContextResolution["temporalRelation"],
): string | null {
  if (relation === "ARRIVAL_TO_CONTEXT") return leg.destinationPlaceId;
  if (relation === "DEPARTURE_FROM_CONTEXT") return leg.originPlaceId;
  if (relation === "WITHIN_CONTEXT" || relation === "DATE_ONLY_CANDIDATE") {
    return leg.destinationPlaceId ?? leg.originPlaceId;
  }
  return null;
}

function candidateRelation(
  trip: MobilityTripContextTrip,
  leg: MobilityTripContextLeg,
  relation: MobilityContextResolution["temporalRelation"],
): Candidate["relationType"] {
  const isFirst = leg.sequenceIndex === 0;
  const isLast = leg.sequenceIndex === Math.max(...trip.legs.map(({ sequenceIndex }) => sequenceIndex));
  if (relation === "ARRIVAL_TO_CONTEXT") return isLast ? "DESTINATION_CONTEXT" : "STOP_CONTEXT";
  if (relation === "DEPARTURE_FROM_CONTEXT") {
    return isFirst && trip.boundaryStatus !== "CLOSED_HOME" && trip.boundaryStatus !== "CLOSED_SAME_ANCHOR"
      ? "ORIGIN_CONTEXT"
      : "STOP_CONTEXT";
  }
  return relation === "WITHIN_CONTEXT" ? "STOP_CONTEXT" : "ASSOCIATED_CONTEXT";
}

function isPartial(trip: MobilityTripContextTrip): boolean {
  return trip.boundaryStatus.startsWith("OPEN_") || trip.boundaryStatus.startsWith("WINDOW_TRUNCATED_");
}

function momentEncloses(moment: MobilityTripMomentAuthority, trip: MobilityTripContextTrip): boolean {
  return moment.startDate !== null && moment.endDate !== null
    && moment.startDate <= trip.startDate && moment.endDate >= trip.endDate;
}

function buildCandidate(
  trip: MobilityTripContextTrip,
  leg: MobilityTripContextLeg,
  context: MobilityContextResolution,
  event: MobilityTripLifeEventAuthority,
  reasons: MobilityTripContextReasonCode[],
): Candidate | null {
  if (event.validationStatus === "WEAK") {
    reasons.push("CONTEXT_EVENT_VALIDATION_TOO_WEAK");
    return null;
  }
  const placeId = endpointFor(leg, context.temporalRelation);
  if (placeId === null) {
    reasons.push("CONTEXT_PLACE_AUTHORITY_MISSING");
    return null;
  }
  const eventPlaces = new Set([...event.principalPlaceIds, ...event.accessPlaceIds]);
  if (!eventPlaces.has(placeId)) {
    reasons.push("CONTEXT_PLACE_MISMATCH");
    return null;
  }
  const exactTime = context.linkState === "LINKED" && context.temporalQuality === "EXACT";
  const exactDate = context.temporalQuality === "DATE_ONLY"
    && (context.linkState === "LINKED" || context.linkState === "AMBIGUOUS")
    && event.validationStatus === "CONFIRMED";
  const accessProxy = context.temporalQuality === "PROXY"
    && context.linkState === "AMBIGUOUS"
    && event.validationStatus === "CONFIRMED"
    && event.accessPlaceIds.includes(placeId);
  if (!exactTime && !exactDate && !accessProxy) {
    reasons.push("CONTEXT_TIME_MISMATCH");
    return null;
  }
  return {
    lifeEvent: event,
    leg,
    relationType: candidateRelation(trip, leg, context.temporalRelation),
    anchorPlaceId: placeId,
    linkMethod: exactTime ? "EXACT_PLACE_TIME" : "EXACT_PLACE_DATE",
    validationStatus: exactTime && context.knowledgeState === "CONFIRMED" ? "CONFIRMED" : "DERIVED",
    momentOnly: accessProxy,
    evidenceRefs: unique(context.evidenceRefs),
  };
}

function deduplicateCandidates(candidates: readonly Candidate[]): readonly Candidate[] {
  const grouped = new Map<string, Candidate>();
  for (const candidate of candidates) {
    const key = [candidate.lifeEvent.lifeEventId, candidate.leg.mobilityLegId, candidate.relationType, candidate.anchorPlaceId].join("|");
    const previous = grouped.get(key);
    grouped.set(key, previous === undefined ? candidate : {
      ...previous,
      validationStatus: previous.validationStatus === "CONFIRMED" || candidate.validationStatus === "CONFIRMED" ? "CONFIRMED" : "DERIVED",
      momentOnly: previous.momentOnly && candidate.momentOnly,
      evidenceRefs: unique([...previous.evidenceRefs, ...candidate.evidenceRefs]),
    });
  }
  return [...grouped.values()].sort((left, right) =>
    left.leg.sequenceIndex - right.leg.sequenceIndex
    || left.lifeEvent.lifeEventId.localeCompare(right.lifeEvent.lifeEventId)
    || left.relationType.localeCompare(right.relationType));
}

export function resolveMobilityTripContexts(input: {
  readonly trips: readonly MobilityTripContextTrip[];
  readonly mobilityContexts: readonly MobilityContextResolution[];
  readonly lifeEvents: readonly MobilityTripLifeEventAuthority[];
  readonly moments: readonly MobilityTripMomentAuthority[];
  readonly sourceRevision: number;
}): MobilityTripContextBuildResult {
  if (!Number.isSafeInteger(input.sourceRevision) || input.sourceRevision < 0) {
    throw new TypeError("sourceRevision doit être un entier positif ou nul.");
  }
  const trips = [...input.trips].sort((left, right) => left.mobilityTripId.localeCompare(right.mobilityTripId));
  const tripIds = new Set<string>();
  const legToTrip = new Map<string, MobilityTripContextTrip>();
  const legById = new Map<string, MobilityTripContextLeg>();
  for (const trip of trips) {
    if (tripIds.has(trip.mobilityTripId)) throw new TypeError(`MOBILITY_TRIP_CONTEXT_DUPLICATE_TRIP:${trip.mobilityTripId}`);
    tripIds.add(trip.mobilityTripId);
    for (const leg of trip.legs) {
      if (legToTrip.has(leg.mobilityLegId)) throw new TypeError(`MOBILITY_TRIP_CONTEXT_DUPLICATE_MEMBERSHIP:${leg.mobilityLegId}`);
      legToTrip.set(leg.mobilityLegId, trip);
      legById.set(leg.mobilityLegId, leg);
    }
  }
  const eventById = new Map(input.lifeEvents.map((event) => [event.lifeEventId, event]));
  const momentsByEvent = new Map<string, MobilityTripMomentAuthority[]>();
  for (const moment of input.moments) {
    for (const linked of moment.linkedLifeEvents) {
      const values = momentsByEvent.get(linked.lifeEventId) ?? [];
      values.push(moment);
      momentsByEvent.set(linked.lifeEventId, values);
    }
  }
  const contextsByTrip = new Map<string, MobilityContextResolution[]>();
  for (const context of input.mobilityContexts) {
    const trip = legToTrip.get(context.mobilityLegId);
    if (trip === undefined) continue;
    const values = contextsByTrip.get(trip.mobilityTripId) ?? [];
    values.push(context);
    contextsByTrip.set(trip.mobilityTripId, values);
  }

  const links: MobilityTripContextLink[] = [];
  const resolutions: MobilityTripContextResolutionAudit[] = [];
  for (const trip of trips) {
    const reasons: MobilityTripContextReasonCode[] = [];
    if (isPartial(trip)) reasons.push("CONTEXT_TRIP_PARTIAL_BOUNDARY");
    const rawCandidates: Candidate[] = [];
    for (const context of contextsByTrip.get(trip.mobilityTripId) ?? []) {
      if (context.contextKind !== "LIFE_EVENT" || context.contextRef === null) continue;
      const event = eventById.get(context.contextRef);
      if (event === undefined || event.householdId !== trip.householdId) {
        reasons.push("CONTEXT_LINK_CONFLICT");
        continue;
      }
      const leg = legById.get(context.mobilityLegId);
      if (leg === undefined) continue;
      const candidate = buildCandidate(trip, leg, context, event, reasons);
      if (candidate !== null) rawCandidates.push(candidate);
    }
    const candidates = deduplicateCandidates(rawCandidates);
    const tripLinks: MobilityTripContextLink[] = [];
    const representedEventIds = new Set<string>();

    for (const eventId of unique(candidates.map(({ lifeEvent }) => lifeEvent.lifeEventId))) {
      const eventCandidates = candidates.filter(({ lifeEvent }) => lifeEvent.lifeEventId === eventId);
      const eligibleMoments = (momentsByEvent.get(eventId) ?? []).filter((moment) => {
        const relation = moment.linkedLifeEvents.find((linked) => linked.lifeEventId === eventId);
        return moment.householdId === trip.householdId
          && relation !== undefined && relation.validationStatus !== "WEAK"
          && momentEncloses(moment, trip);
      });
      const asserted = eligibleMoments.filter(({ hasActiveSemanticAssertion }) => hasActiveSemanticAssertion);
      if (eligibleMoments.length > 0 && asserted.length === 0) reasons.push("NO_NARRATIVE_SEMANTIC_ASSERTION");
      if (asserted.length > 1) {
        reasons.push("CONTEXT_HIERARCHY_AMBIGUOUS");
        continue;
      }
      const moment = asserted[0];
      if (moment === undefined) continue;
      const hierarchy = moment.linkedLifeEvents.find((linked) => linked.lifeEventId === eventId)!;
      const access = eventCandidates.find(({ anchorPlaceId, lifeEvent }) => lifeEvent.accessPlaceIds.includes(anchorPlaceId));
      const anchor = access ?? eventCandidates[0];
      const isAccess = access !== undefined && (anchor.leg.travelDate === moment.startDate || anchor.leg.travelDate === moment.endDate);
      if (access !== undefined && !isAccess) reasons.push("CONTEXT_ACCESS_RELATION_UNPROVEN");
      const relationType: MobilityTripContextRelation = isAccess ? "ACCESS_CONTEXT" : "ENVELOPING_CONTEXT";
      tripLinks.push(makeLink({
        householdId: trip.householdId,
        mobilityTripId: trip.mobilityTripId,
        lifeEventId: null,
        momentId: moment.momentId,
        relationType,
        anchorLegId: isAccess ? anchor.leg.mobilityLegId : null,
        anchorPlaceId: isAccess ? anchor.anchorPlaceId : null,
        linkMethod: isAccess ? "ACCESS_TO_MOMENT" : "CONFIRMED_MOMENT_LIFE_EVENT",
        validationStatus: hierarchy.validationStatus === "CONFIRMED" && anchor.validationStatus === "CONFIRMED" ? "CONFIRMED" : "DERIVED",
        authority: "MOMENT_LIFE_EVENT + M7_MOBILITY_CONTEXT",
        provenance: [MOBILITY_TRIP_CONTEXT_METHOD_VERSION, "global_m7_mobility_context@v1"],
        evidenceRefs: unique([...moment.evidenceRefs, ...hierarchy.evidenceRefs, ...eventCandidates.flatMap(({ evidenceRefs }) => evidenceRefs)]),
        sourceRevision: input.sourceRevision,
      }));
      representedEventIds.add(eventId);
      reasons.push("CONTEXT_ALREADY_REPRESENTED_BY_MOMENT");
      if (hierarchy.relationType === "COMPONENT") representedEventIds.delete(eventId);
    }

    const remaining = candidates.filter(({ lifeEvent, momentOnly }) =>
      !representedEventIds.has(lifeEvent.lifeEventId) && !momentOnly);
    const primaryCandidates = remaining.filter((candidate) =>
      candidate.relationType === "DESTINATION_CONTEXT"
      && candidate.linkMethod === "EXACT_PLACE_TIME"
      && candidate.validationStatus === "CONFIRMED");
    const primaryEventIds = unique(primaryCandidates.map(({ lifeEvent }) => lifeEvent.lifeEventId));
    if (primaryEventIds.length > 1) reasons.push("MULTIPLE_PRIMARY_CONTEXT_CANDIDATES");
    for (const candidate of remaining) {
      const promotePrimary = primaryEventIds.length === 1
        && candidate.lifeEvent.lifeEventId === primaryEventIds[0]
        && remaining.every(({ lifeEvent }) => lifeEvent.lifeEventId === primaryEventIds[0]);
      tripLinks.push(makeLink({
        householdId: trip.householdId,
        mobilityTripId: trip.mobilityTripId,
        lifeEventId: candidate.lifeEvent.lifeEventId,
        momentId: null,
        relationType: promotePrimary ? "PRIMARY_CONTEXT" : candidate.relationType,
        anchorLegId: candidate.leg.mobilityLegId,
        anchorPlaceId: candidate.anchorPlaceId,
        linkMethod: candidate.linkMethod,
        validationStatus: candidate.validationStatus,
        authority: "M7_MOBILITY_CONTEXT + TRIP_LEVEL_RESOLUTION",
        provenance: [MOBILITY_TRIP_CONTEXT_METHOD_VERSION, "global_m7_mobility_context@v1"],
        evidenceRefs: unique([...candidate.evidenceRefs, ...candidate.lifeEvent.evidenceRefs]),
        sourceRevision: input.sourceRevision,
      }));
    }
    const deduped = new Map(tripLinks.map((link) => [link.mobilityTripContextLinkId, link]));
    const ordered = [...deduped.values()].sort((left, right) => left.mobilityTripContextLinkId.localeCompare(right.mobilityTripContextLinkId));
    links.push(...ordered);
    if (ordered.length === 0 && reasons.length === 0) reasons.push("NO_SEMANTIC_CONTEXT_CANDIDATE");
    if (ordered.length === 0 && !reasons.includes("NO_SEMANTIC_CONTEXT_CANDIDATE")) reasons.push("NO_SEMANTIC_CONTEXT_CANDIDATE");
    const conflict = reasons.some((reason) => reason === "CONTEXT_LINK_CONFLICT" || reason === "CONTEXT_HIERARCHY_AMBIGUOUS");
    resolutions.push({
      mobilityTripId: trip.mobilityTripId,
      status: conflict ? "CONFLICT" : ordered.length > 0 ? "RESOLVED" : "UNRESOLVED",
      reasonCodes: unique(reasons) as readonly MobilityTripContextReasonCode[],
      linkIds: ordered.map(({ mobilityTripContextLinkId }) => mobilityTripContextLinkId),
    });
  }
  const orderedLinks = [...links].sort((left, right) => left.mobilityTripId.localeCompare(right.mobilityTripId)
    || left.mobilityTripContextLinkId.localeCompare(right.mobilityTripContextLinkId));
  const buildHash = bytesToHex(sha256(utf8ToBytes(JSON.stringify({ links: orderedLinks, resolutions }))));
  return { links: orderedLinks, resolutions, buildHash };
}
