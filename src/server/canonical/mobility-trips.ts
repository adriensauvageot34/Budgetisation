import "server-only";

import { createHash } from "node:crypto";
import Big from "big.js";
import type { MobilityLegFact } from "../../analytics/facts";

export const MOBILITY_TRIP_METHOD_VERSION = "mobility_trip_reconstruction@v1" as const;

const TRIP_NAMESPACE = "ea6e8cf1-6c8e-5e20-aadc-63d879f04778";
const MEMBERSHIP_NAMESPACE = "cd1080bc-3f49-53c8-856d-067c26742dd9";

export type MobilityTripShape =
  | "DIRECT"
  | "ROUND_TRIP"
  | "MULTI_STOP_CIRCUIT"
  | "LOCAL_LOOP"
  | "MULTI_DAY_JOURNEY"
  | "OPEN_CHAIN";

export type MobilityTripBoundaryStatus =
  | "CLOSED_HOME"
  | "CLOSED_SAME_ANCHOR"
  | "OPEN_START"
  | "OPEN_END"
  | "OPEN_BOTH"
  | "WINDOW_TRUNCATED_START"
  | "WINDOW_TRUNCATED_END";

export type MobilityTripKnowledgeState = "KNOWN" | "PARTIAL" | "CONFLICT";

export type MobilityTripReasonCode =
  | "TRIP_OPEN_START"
  | "TRIP_OPEN_END"
  | "TRIP_WINDOW_TRUNCATED_START"
  | "TRIP_WINDOW_TRUNCATED_END"
  | "TRIP_ENDPOINT_GAP"
  | "TRIP_AMBIGUOUS_NEXT_LEG"
  | "TRIP_OVERNIGHT_BRIDGE_UNPROVEN"
  | "TRIP_VEHICLE_DISCONTINUITY"
  | "TRIP_SOURCE_LINEAGE_CONFLICT"
  | "TRIP_DUPLICATE_LEG_MEMBERSHIP"
  | "TRIP_DAY_BOUNDARY_INCOMPLETE";

export type MobilityTripFormationBasis =
  | "SINGLETON"
  | "OBSERVED_TEMPORAL_CHAIN"
  | "UNIQUE_ENDPOINT_CHAIN"
  | "DIRECT_SOURCE_CHAIN"
  | "AUTHORITATIVE_MULTI_DAY_BRIDGE"
  | "MIXED_AUTHORITATIVE_CHAIN";

export type MobilityTripMembershipAuthority =
  | "TRIP_SEED"
  | "OBSERVED_TEMPORAL_CHAIN"
  | "UNIQUE_ENDPOINT_CHAIN"
  | "DIRECT_SOURCE_CHAIN"
  | "AUTHORITATIVE_MULTI_DAY_BRIDGE";

export type MobilityTripEndpoint = {
  readonly placeId: string | null;
  readonly sourceLabel: string | null;
  readonly sourceLatitude?: string | null;
  readonly sourceLongitude?: string | null;
};

export type MobilityTripLegInput = {
  readonly legId: string;
  readonly householdId: string;
  readonly vehicleId: string;
  readonly date: string;
  readonly observedTime: string | null;
  readonly timeAuthority: "OBSERVED" | "PROXY" | "UNKNOWN";
  readonly timeType: "DEPARTURE" | "ARRIVAL" | "UNTYPED" | "UNKNOWN";
  readonly origin: MobilityTripEndpoint;
  readonly destination: MobilityTripEndpoint;
  readonly estimatedFuelCost: string;
  readonly sourceLegId: string;
  readonly evidenceRefs: readonly string[];
};

export type MobilityTripBridge = {
  readonly fromLegId: string;
  readonly toLegId: string;
  readonly authority: "DIRECT_SOURCE_CHAIN" | "AUTHORITATIVE_MULTI_DAY_BRIDGE";
  readonly evidenceRefs: readonly string[];
};

export type MobilityTripLegMembership = {
  readonly mobilityTripLegId: string;
  readonly mobilityTripId: string;
  readonly mobilityLegId: string;
  readonly sequenceIndex: number;
  readonly membershipAuthority: MobilityTripMembershipAuthority;
  readonly evidenceRefs: readonly string[];
  readonly sourceRevision: number;
};

export type MobilityTrip = {
  readonly mobilityTripId: string;
  readonly householdId: string;
  readonly startDate: string;
  readonly endDate: string;
  readonly startedAt: string | null;
  readonly endedAt: string | null;
  readonly startPlaceId: string | null;
  readonly endPlaceId: string | null;
  readonly tripShape: MobilityTripShape;
  readonly boundaryStatus: MobilityTripBoundaryStatus;
  readonly formationBasis: MobilityTripFormationBasis;
  readonly knowledgeState: MobilityTripKnowledgeState;
  readonly reasonCodes: readonly MobilityTripReasonCode[];
  readonly methodVersion: typeof MOBILITY_TRIP_METHOD_VERSION;
  readonly evidenceRefs: readonly string[];
  readonly sourceRevision: number;
  readonly memberships: readonly MobilityTripLegMembership[];
  readonly estimatedFuelCost: string;
};

export type MobilityTripBuildResult = {
  readonly trips: readonly MobilityTrip[];
  readonly memberships: readonly MobilityTripLegMembership[];
  readonly buildHash: string;
  readonly unassignedLegIds: readonly string[];
  readonly duplicateMembershipLegIds: readonly string[];
};

function deterministicUuid(namespace: string, name: string): string {
  const namespaceBytes = Buffer.from(namespace.replaceAll("-", ""), "hex");
  const bytes = Buffer.from(createHash("sha1").update(namespaceBytes).update(name).digest().subarray(0, 16));
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function stableDigest(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function exactSourceKey(endpoint: MobilityTripEndpoint): string | null {
  if (
    endpoint.sourceLabel === null
    || endpoint.sourceLatitude == null
    || endpoint.sourceLongitude == null
  ) return null;
  return `source:${endpoint.sourceLabel.trim().toLocaleLowerCase("fr-FR")}|${endpoint.sourceLatitude}|${endpoint.sourceLongitude}`;
}

function endpointKey(endpoint: MobilityTripEndpoint): string | null {
  return endpoint.placeId === null ? exactSourceKey(endpoint) : `place:${endpoint.placeId.toLowerCase()}`;
}

function endpointsMatch(left: MobilityTripEndpoint, right: MobilityTripEndpoint): boolean {
  if (left.placeId !== null && right.placeId !== null) {
    return left.placeId.toLowerCase() === right.placeId.toLowerCase();
  }
  const leftSource = exactSourceKey(left);
  return leftSource !== null && leftSource === exactSourceKey(right);
}

function compareLegs(left: MobilityTripLegInput, right: MobilityTripLegInput): number {
  const date = left.date.localeCompare(right.date);
  if (date !== 0) return date;
  const leftObserved = left.timeAuthority === "OBSERVED" ? left.observedTime : null;
  const rightObserved = right.timeAuthority === "OBSERVED" ? right.observedTime : null;
  if (leftObserved !== null && rightObserved !== null) {
    const time = leftObserved.localeCompare(rightObserved);
    if (time !== 0) return time;
  } else if (leftObserved !== null) return -1;
  else if (rightObserved !== null) return 1;
  return left.sourceLegId.localeCompare(right.sourceLegId) || left.legId.localeCompare(right.legId);
}

function observedAfter(current: MobilityTripLegInput, candidate: MobilityTripLegInput): boolean {
  return current.date === candidate.date
    && current.timeAuthority === "OBSERVED"
    && candidate.timeAuthority === "OBSERVED"
    && current.observedTime !== null
    && candidate.observedTime !== null
    && candidate.observedTime > current.observedTime;
}

function uniqueSorted(values: readonly string[]): readonly string[] {
  return [...new Set(values)].sort();
}

function boundaryStatus(
  first: MobilityTripLegInput,
  last: MobilityTripLegInput,
  homePlaceIds: ReadonlySet<string>,
): MobilityTripBoundaryStatus {
  const startHome = first.origin.placeId !== null && homePlaceIds.has(first.origin.placeId.toLowerCase());
  const endHome = last.destination.placeId !== null && homePlaceIds.has(last.destination.placeId.toLowerCase());
  if (startHome && endHome) return "CLOSED_HOME";
  const startKey = endpointKey(first.origin);
  if (startKey !== null && startKey === endpointKey(last.destination)) return "CLOSED_SAME_ANCHOR";
  if (startHome) return "OPEN_END";
  if (endHome) return "OPEN_START";
  return "OPEN_BOTH";
}

function reasonCodesForBoundary(status: MobilityTripBoundaryStatus): MobilityTripReasonCode[] {
  switch (status) {
    case "OPEN_START": return ["TRIP_OPEN_START"];
    case "OPEN_END": return ["TRIP_OPEN_END"];
    case "OPEN_BOTH": return ["TRIP_OPEN_START", "TRIP_OPEN_END"];
    case "WINDOW_TRUNCATED_START": return ["TRIP_WINDOW_TRUNCATED_START"];
    case "WINDOW_TRUNCATED_END": return ["TRIP_WINDOW_TRUNCATED_END"];
    default: return [];
  }
}

function tripShape(chain: readonly MobilityTripLegInput[], status: MobilityTripBoundaryStatus): MobilityTripShape {
  if (chain[0].date !== chain[chain.length - 1].date) return "MULTI_DAY_JOURNEY";
  if (status === "CLOSED_SAME_ANCHOR") return "LOCAL_LOOP";
  if (status === "CLOSED_HOME") {
    if (chain.length === 2) return "ROUND_TRIP";
    if (chain.length >= 3) return "MULTI_STOP_CIRCUIT";
  }
  return chain.length === 1 ? "DIRECT" : "OPEN_CHAIN";
}

function formationBasis(authorities: readonly MobilityTripMembershipAuthority[]): MobilityTripFormationBasis {
  const edges = uniqueSorted(authorities.filter((value) => value !== "TRIP_SEED"));
  if (edges.length === 0) return "SINGLETON";
  if (edges.length > 1) return "MIXED_AUTHORITATIVE_CHAIN";
  return edges[0] as Exclude<MobilityTripFormationBasis, "SINGLETON" | "MIXED_AUTHORITATIVE_CHAIN">;
}

function startedAt(leg: MobilityTripLegInput): string | null {
  if (leg.timeAuthority !== "OBSERVED" || leg.observedTime === null) return null;
  return leg.timeType === "ARRIVAL" ? null : leg.observedTime;
}

function endedAt(leg: MobilityTripLegInput): string | null {
  if (leg.timeAuthority !== "OBSERVED" || leg.observedTime === null) return null;
  return leg.timeType === "DEPARTURE" ? null : leg.observedTime;
}

export function projectMobilityTripLegInput(fact: MobilityLegFact): MobilityTripLegInput {
  return {
    legId: fact.legId,
    householdId: fact.householdId,
    vehicleId: fact.vehicleId,
    date: fact.date,
    observedTime: fact.time.observedTime,
    timeAuthority: fact.time.authority,
    timeType: fact.time.type,
    origin: { placeId: fact.origin.placeId, sourceLabel: fact.origin.sourceLabel },
    destination: { placeId: fact.destination.placeId, sourceLabel: fact.destination.sourceLabel },
    estimatedFuelCost: fact.estimatedFuelCost,
    sourceLegId: fact.source.sourceLegId,
    evidenceRefs: fact.evidenceRefs,
  };
}

export function reconstructMobilityTrips(input: {
  readonly legs: readonly MobilityTripLegInput[];
  readonly homePlaceIds: readonly string[];
  readonly bridges?: readonly MobilityTripBridge[];
  readonly sourceRevision: number;
}): MobilityTripBuildResult {
  if (!Number.isSafeInteger(input.sourceRevision) || input.sourceRevision < 0) {
    throw new TypeError("sourceRevision doit être un entier positif ou nul.");
  }
  const sorted = [...input.legs].sort(compareLegs);
  const byId = new Map<string, MobilityTripLegInput>();
  for (const leg of sorted) {
    if (byId.has(leg.legId)) throw new TypeError(`MobilityLeg dupliqué: ${leg.legId}`);
    byId.set(leg.legId, leg);
  }
  const homePlaceIds = new Set(input.homePlaceIds.map((value) => value.toLowerCase()));
  const bridges = new Map<string, MobilityTripBridge[]>();
  for (const bridge of input.bridges ?? []) {
    const from = byId.get(bridge.fromLegId);
    const to = byId.get(bridge.toLegId);
    if (from === undefined || to === undefined) throw new TypeError("Un bridge Trip référence un leg absent.");
    if (from.householdId !== to.householdId || from.vehicleId !== to.vehicleId) {
      throw new TypeError("Un bridge Trip ne peut pas traverser un household ou un véhicule.");
    }
    if (!endpointsMatch(from.destination, to.origin)) {
      throw new TypeError("Un bridge Trip doit préserver la continuité exacte des endpoints.");
    }
    bridges.set(bridge.fromLegId, [...(bridges.get(bridge.fromLegId) ?? []), bridge]);
  }

  const assigned = new Set<string>();
  const trips: MobilityTrip[] = [];

  for (const seed of sorted) {
    if (assigned.has(seed.legId)) continue;
    const chain: MobilityTripLegInput[] = [seed];
    const authorities: MobilityTripMembershipAuthority[] = ["TRIP_SEED"];
    const edgeEvidence: string[][] = [[]];
    const conflictReasons: MobilityTripReasonCode[] = [];
    assigned.add(seed.legId);

    while (true) {
      const current = chain[chain.length - 1];
      if (current.destination.placeId !== null && homePlaceIds.has(current.destination.placeId.toLowerCase())) break;

      const explicit = (bridges.get(current.legId) ?? []).filter(({ toLegId }) => !assigned.has(toLegId));
      let candidates: MobilityTripLegInput[] = [];
      let authority: MobilityTripMembershipAuthority | null = null;
      let evidence: readonly string[] = [];
      if (explicit.length > 0) {
        candidates = explicit.map(({ toLegId }) => byId.get(toLegId) as MobilityTripLegInput);
        const kinds = uniqueSorted(explicit.map(({ authority: value }) => value));
        if (kinds.length === 1) authority = kinds[0] as MobilityTripMembershipAuthority;
        evidence = uniqueSorted(explicit.flatMap(({ evidenceRefs }) => evidenceRefs));
      } else {
        const compatible = sorted.filter((candidate) =>
          !assigned.has(candidate.legId)
          && candidate.householdId === current.householdId
          && candidate.vehicleId === current.vehicleId
          && candidate.date === current.date
          && endpointsMatch(current.destination, candidate.origin));
        const observed = compatible.filter((candidate) => observedAfter(current, candidate));
        if (observed.length > 0) {
          const earliest = observed.reduce((value, candidate) =>
            candidate.observedTime! < value ? candidate.observedTime! : value, observed[0].observedTime!);
          candidates = observed.filter(({ observedTime }) => observedTime === earliest);
          authority = "OBSERVED_TEMPORAL_CHAIN";
        } else if (compatible.length > 0) {
          candidates = compatible;
          authority = "UNIQUE_ENDPOINT_CHAIN";
        }
      }

      if (candidates.length === 0) {
        const unbridgedOvernight = sorted.some((candidate) =>
          !assigned.has(candidate.legId)
          && candidate.householdId === current.householdId
          && candidate.vehicleId === current.vehicleId
          && candidate.date > current.date
          && endpointsMatch(current.destination, candidate.origin));
        if (unbridgedOvernight) conflictReasons.push("TRIP_OVERNIGHT_BRIDGE_UNPROVEN");
        break;
      }
      if (candidates.length !== 1 || authority === null) {
        conflictReasons.push("TRIP_AMBIGUOUS_NEXT_LEG");
        break;
      }
      const next = candidates[0];
      chain.push(next);
      authorities.push(authority);
      edgeEvidence.push([...evidence]);
      assigned.add(next.legId);
    }

    const membershipIds = chain.map(({ legId }) => legId);
    const tripId = deterministicUuid(
      TRIP_NAMESPACE,
      `${seed.householdId}|${MOBILITY_TRIP_METHOD_VERSION}|${membershipIds.join(",")}`,
    );
    const status = boundaryStatus(chain[0], chain[chain.length - 1], homePlaceIds);
    const openReasons = reasonCodesForBoundary(status);
    const hasEndpointGap = status.startsWith("OPEN") && chain.some(({ origin, destination }) => endpointKey(origin) === null || endpointKey(destination) === null);
    const reasons = uniqueSorted([
      ...openReasons,
      ...conflictReasons,
      ...(hasEndpointGap ? ["TRIP_ENDPOINT_GAP" as const] : []),
    ]) as readonly MobilityTripReasonCode[];
    const knowledgeState: MobilityTripKnowledgeState = conflictReasons.length > 0
      ? "CONFLICT"
      : status.startsWith("OPEN") || hasEndpointGap
        ? "PARTIAL"
        : "KNOWN";
    const memberships = chain.map((leg, index): MobilityTripLegMembership => ({
      mobilityTripLegId: deterministicUuid(MEMBERSHIP_NAMESPACE, `${tripId}|${leg.legId}`),
      mobilityTripId: tripId,
      mobilityLegId: leg.legId,
      sequenceIndex: index,
      membershipAuthority: authorities[index],
      evidenceRefs: uniqueSorted([...leg.evidenceRefs, ...edgeEvidence[index]]),
      sourceRevision: input.sourceRevision,
    }));
    trips.push({
      mobilityTripId: tripId,
      householdId: seed.householdId,
      startDate: chain[0].date,
      endDate: chain[chain.length - 1].date,
      startedAt: startedAt(chain[0]),
      endedAt: endedAt(chain[chain.length - 1]),
      startPlaceId: chain[0].origin.placeId,
      endPlaceId: chain[chain.length - 1].destination.placeId,
      tripShape: tripShape(chain, status),
      boundaryStatus: status,
      formationBasis: formationBasis(authorities),
      knowledgeState,
      reasonCodes: reasons,
      methodVersion: MOBILITY_TRIP_METHOD_VERSION,
      evidenceRefs: uniqueSorted(chain.flatMap(({ evidenceRefs }) => evidenceRefs)),
      sourceRevision: input.sourceRevision,
      memberships,
      estimatedFuelCost: chain.reduce((sum, { estimatedFuelCost }) => sum.plus(estimatedFuelCost), new Big(0)).toFixed(),
    });
  }

  const memberships = trips.flatMap(({ memberships: value }) => value);
  const membershipCounts = new Map<string, number>();
  for (const { mobilityLegId } of memberships) membershipCounts.set(mobilityLegId, (membershipCounts.get(mobilityLegId) ?? 0) + 1);
  const unassignedLegIds = sorted.filter(({ legId }) => !membershipCounts.has(legId)).map(({ legId }) => legId);
  const duplicateMembershipLegIds = [...membershipCounts].filter(([, count]) => count > 1).map(([legId]) => legId).sort();
  const hashPayload = trips.map((trip) => ({
    id: trip.mobilityTripId,
    legs: trip.memberships.map(({ mobilityLegId }) => mobilityLegId),
    shape: trip.tripShape,
    boundary: trip.boundaryStatus,
    knowledge: trip.knowledgeState,
    reasons: trip.reasonCodes,
  }));
  return {
    trips,
    memberships,
    buildHash: stableDigest(hashPayload),
    unassignedLegIds,
    duplicateMembershipLegIds,
  };
}
