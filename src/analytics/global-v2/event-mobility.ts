import Big from "big.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex, utf8ToBytes } from "@noble/hashes/utils.js";
import { sumMobilityEstimatedFuelCost, type MobilityLegFact } from "../facts";
import { getMetricRegistryEntry } from "../production";
import { canonicalSerializeGlobal } from "../../core/global-v2";
import { MOBILITY_TRIP_CONTEXT_METHOD_VERSION, type MobilityTripContextLink, type MobilityTripContextResolutionAudit, type MobilityTripContextRelation } from "./mobility-trip-context";

export const GLOBAL_M7_EVENT_MOBILITY_METHOD_VERSION = "global_m7_event_mobility@v1" as const;
export const GLOBAL_M7_EVENT_MOBILITY_POLICY_VERSION = "global-m7-event-mobility-physical-attribution@v1" as const;
export const EVENT_MOBILITY_COST_METRIC_ID = "mobility_usage_estimated_fuel_cost" as const;
export const EVENT_MOBILITY_COST_METRIC_VERSION = "mobility_usage_estimated_fuel_cost@v1" as const;

export type EventMobilityTrip = {
  readonly mobilityTripId: string;
  readonly householdId: string;
  readonly boundaryStatus: "CLOSED_HOME" | "CLOSED_SAME_ANCHOR" | "OPEN_START" | "OPEN_END" | "OPEN_BOTH" | "WINDOW_TRUNCATED_START" | "WINDOW_TRUNCATED_END";
  readonly knowledgeState: "KNOWN" | "PARTIAL" | "CONFLICT";
};
export type EventMobilityMembership = { readonly mobilityTripId: string; readonly mobilityLegId: string };
export type EventMobilityContextLink = Pick<MobilityTripContextLink,
  "mobilityTripContextLinkId" | "mobilityTripId" | "lifeEventId" | "momentId" | "relationType" | "anchorLegId" | "validationStatus">;
export type EventMobilityContextResolution = Pick<MobilityTripContextResolutionAudit, "mobilityTripId" | "status">;
export type EventMobilityRelationType = MobilityTripContextRelation;

type EventMobilitySummaryBase = {
  readonly eventRef: `life-event:${string}` | `moment:${string}`;
  readonly targetKind: "LIFE_EVENT" | "MOMENT";
  readonly relationTypes: readonly EventMobilityRelationType[];
  readonly validationStatus: "CONFIRMED" | "DERIVED" | "MIXED";
  readonly mobilityCostMetric: {
    readonly metricId: typeof EVENT_MOBILITY_COST_METRIC_ID;
    readonly methodVersion: typeof EVENT_MOBILITY_COST_METRIC_VERSION;
    readonly provenance: "estimated";
    readonly monetaryBasis: "estimated_cost";
  };
  readonly monetaryNature: "ESTIMATED_MOBILITY_USAGE";
  readonly additivity: {
    readonly withinSummary: "UNION_UNIQUE_MOBILITY_LEGS";
    readonly acrossSummaries: "NON_ADDITIVE_RECOMPUTE_ON_TARGET_GROUP";
  };
  readonly methodVersion: typeof GLOBAL_M7_EVENT_MOBILITY_METHOD_VERSION;
  readonly policyVersion: typeof GLOBAL_M7_EVENT_MOBILITY_POLICY_VERSION;
  readonly evidenceRefs: readonly string[];
  readonly inputHash: string;
};

type ValuedEventMobilitySummary = EventMobilitySummaryBase & {
  readonly physicalLegCount: number;
  readonly tripCount: number;
  readonly distanceKm: string;
  readonly estimatedFuelLiters: string;
  readonly estimatedFuelCost: string;
};

export type EventMobilitySummary =
  | (ValuedEventMobilitySummary & { readonly status: "KNOWN"; readonly coverage: { readonly state: "COMPLETE"; readonly basis: "FULL_ENVELOPING_TRIP"; readonly policyRef: typeof GLOBAL_M7_EVENT_MOBILITY_POLICY_VERSION } })
  | (ValuedEventMobilitySummary & { readonly status: "PARTIAL"; readonly coverage: { readonly state: "PARTIAL"; readonly basis: "ANCHORED_STOP_LEGS" | "ACCESS_LEG" | "OPEN_ENVELOPING_TRIP"; readonly policyRef: typeof GLOBAL_M7_EVENT_MOBILITY_POLICY_VERSION } })
  | (EventMobilitySummaryBase & { readonly status: "AMBIGUOUS"; readonly coverage: { readonly state: "AMBIGUOUS"; readonly basis: "ASSOCIATED_CONTEXT" | "INCOMPATIBLE_ATTRIBUTIONS"; readonly policyRef: typeof GLOBAL_M7_EVENT_MOBILITY_POLICY_VERSION } })
  | (EventMobilitySummaryBase & { readonly status: "UNKNOWN"; readonly coverage: { readonly state: "UNKNOWN"; readonly basis: "NO_PROVEN_MOBILITY"; readonly policyRef: typeof GLOBAL_M7_EVENT_MOBILITY_POLICY_VERSION } })
  | (EventMobilitySummaryBase & { readonly status: "NOT_APPLICABLE"; readonly coverage: { readonly state: "NOT_APPLICABLE"; readonly basis: "EXPLICIT_NO_MOBILITY"; readonly policyRef: typeof GLOBAL_M7_EVENT_MOBILITY_POLICY_VERSION } });

export type EventMobilityPhysicalTotals = {
  readonly physicalLegCount: number;
  readonly distanceKm: string;
  readonly estimatedFuelLiters: string;
  readonly estimatedFuelCost: string;
};

export type GlobalM7EventMobilityAuthority = {
  readonly methodVersion: typeof GLOBAL_M7_EVENT_MOBILITY_METHOD_VERSION;
  readonly policyVersion: typeof GLOBAL_M7_EVENT_MOBILITY_POLICY_VERSION;
  readonly costMetricId: typeof EVENT_MOBILITY_COST_METRIC_VERSION;
  readonly summaries: readonly EventMobilitySummary[];
  readonly physicalUnionTotals: EventMobilityPhysicalTotals;
  readonly inputHash: string;
  readonly outputHash: string;
  readonly liveWrites: "NONE";
};

const compare = (left: string, right: string) => left.localeCompare(right);
const unique = <T extends string>(values: readonly T[]): T[] => [...new Set(values)].sort(compare);
const digest = (value: unknown) => bytesToHex(sha256(utf8ToBytes(canonicalSerializeGlobal(value))));
const sum = (legs: readonly MobilityLegFact[], pick: (leg: MobilityLegFact) => string) =>
  legs.reduce((total, leg) => total.plus(pick(leg)), new Big(0)).toString();

function totals(legs: readonly MobilityLegFact[]): EventMobilityPhysicalTotals {
  return {
    physicalLegCount: legs.length,
    distanceKm: sum(legs, (leg) => leg.distanceKm),
    estimatedFuelLiters: sum(legs, (leg) => leg.estimatedFuelLiters),
    estimatedFuelCost: sumMobilityEstimatedFuelCost(legs),
  };
}

function eventIdentity(link: EventMobilityContextLink): { eventRef: EventMobilitySummary["eventRef"]; targetKind: EventMobilitySummary["targetKind"] } {
  if ((link.lifeEventId === null) === (link.momentId === null)) throw new TypeError("EVENT_MOBILITY_CONTEXT_TARGET_INVALID");
  const targetId = link.lifeEventId ?? link.momentId!;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu.test(targetId)) throw new TypeError("EVENT_MOBILITY_CONTEXT_TARGET_ID_INVALID");
  return link.lifeEventId === null
    ? { eventRef: `moment:${link.momentId}`, targetKind: "MOMENT" }
    : { eventRef: `life-event:${link.lifeEventId}`, targetKind: "LIFE_EVENT" };
}

function metricContract(): EventMobilitySummaryBase["mobilityCostMetric"] {
  const metric = getMetricRegistryEntry(EVENT_MOBILITY_COST_METRIC_ID);
  if (String(metric.methodVersion) !== EVENT_MOBILITY_COST_METRIC_VERSION
    || metric.productionStrategy !== "sum_mobility_usage_estimated_fuel_cost"
    || metric.additivity.kind !== "additive"
    || metric.provenanceRule !== "estimated"
    || metric.monetaryBasis !== "estimated_cost"
    || !metric.sourceFact.includes("fct_mobility_leg")) {
    throw new TypeError("EVENT_MOBILITY_METRIC_CONTRACT_MISMATCH");
  }
  return { metricId: EVENT_MOBILITY_COST_METRIC_ID, methodVersion: EVENT_MOBILITY_COST_METRIC_VERSION, provenance: "estimated", monetaryBasis: "estimated_cost" };
}

export function buildGlobalM7EventMobilityAuthority(input: {
  readonly mobilityLegs: readonly MobilityLegFact[];
  readonly trips: readonly EventMobilityTrip[];
  readonly memberships: readonly EventMobilityMembership[];
  readonly contextLinks: readonly EventMobilityContextLink[];
  readonly contextResolutions: readonly EventMobilityContextResolution[];
}): GlobalM7EventMobilityAuthority {
  const metric = metricContract();
  const legs = new Map<string, MobilityLegFact>();
  for (const leg of input.mobilityLegs) {
    if (legs.has(leg.legId)) throw new TypeError(`EVENT_MOBILITY_DUPLICATE_LEG:${leg.legId}`);
    legs.set(leg.legId, leg);
  }
  const trips = new Map<string, EventMobilityTrip>();
  for (const trip of input.trips) {
    if (trips.has(trip.mobilityTripId)) throw new TypeError(`EVENT_MOBILITY_DUPLICATE_TRIP:${trip.mobilityTripId}`);
    trips.set(trip.mobilityTripId, trip);
  }
  const tripLegIds = new Map<string, Set<string>>();
  const legTripIds = new Map<string, string>();
  for (const membership of input.memberships) {
    const trip = trips.get(membership.mobilityTripId);
    if (trip === undefined) throw new TypeError(`EVENT_MOBILITY_ORPHAN_MEMBERSHIP:${membership.mobilityTripId}`);
    const leg = legs.get(membership.mobilityLegId);
    if (leg === undefined) throw new TypeError(`EVENT_MOBILITY_MISSING_LEG:${membership.mobilityLegId}`);
    if (leg.householdId !== trip.householdId) throw new TypeError(`EVENT_MOBILITY_HOUSEHOLD_MISMATCH:${membership.mobilityLegId}`);
    const prior = legTripIds.get(membership.mobilityLegId);
    if (prior !== undefined && prior !== membership.mobilityTripId) throw new TypeError(`EVENT_MOBILITY_LEG_IN_MULTIPLE_TRIPS:${membership.mobilityLegId}`);
    legTripIds.set(membership.mobilityLegId, membership.mobilityTripId);
    const ids = tripLegIds.get(membership.mobilityTripId) ?? new Set<string>();
    ids.add(membership.mobilityLegId);
    tripLegIds.set(membership.mobilityTripId, ids);
  }
  const resolutions = new Map<string, EventMobilityContextResolution["status"]>();
  for (const resolution of input.contextResolutions) {
    if (resolutions.has(resolution.mobilityTripId)) throw new TypeError(`EVENT_MOBILITY_DUPLICATE_RESOLUTION:${resolution.mobilityTripId}`);
    resolutions.set(resolution.mobilityTripId, resolution.status);
  }
  const linksByEvent = new Map<string, EventMobilityContextLink[]>();
  const linkIds = new Set<string>();
  for (const link of input.contextLinks) {
    if (linkIds.has(link.mobilityTripContextLinkId)) throw new TypeError(`EVENT_MOBILITY_DUPLICATE_LINK:${link.mobilityTripContextLinkId}`);
    linkIds.add(link.mobilityTripContextLinkId);
    if (!trips.has(link.mobilityTripId)) throw new TypeError(`EVENT_MOBILITY_ORPHAN_LINK:${link.mobilityTripId}`);
    if (resolutions.get(link.mobilityTripId) !== "RESOLVED") throw new TypeError(`EVENT_MOBILITY_LINK_NOT_RESOLVED:${link.mobilityTripId}`);
    const { eventRef } = eventIdentity(link);
    const values = linksByEvent.get(eventRef) ?? [];
    values.push(link);
    linksByEvent.set(eventRef, values);
  }
  const projectedGlobally = new Set<string>();
  const summaries: EventMobilitySummary[] = [];
  for (const [eventRef, eventLinks] of [...linksByEvent].sort(([left], [right]) => compare(left, right))) {
    const sortedLinks = [...eventLinks].sort((left, right) => compare(left.mobilityTripContextLinkId, right.mobilityTripContextLinkId));
    const targetKind = eventIdentity(sortedLinks[0]!).targetKind;
    const relationTypes = unique(sortedLinks.map((link) => link.relationType));
    const validationStatus = sortedLinks.every((link) => link.validationStatus === "CONFIRMED") ? "CONFIRMED"
      : sortedLinks.every((link) => link.validationStatus === "DERIVED") ? "DERIVED" : "MIXED";
    const projected = new Set<string>();
    const coverageInputs: unknown[] = [];
    const bases = new Set<string>();
    for (const link of sortedLinks) {
      const trip = trips.get(link.mobilityTripId)!;
      const members = tripLegIds.get(link.mobilityTripId);
      if (members === undefined || members.size === 0) throw new TypeError(`EVENT_MOBILITY_EMPTY_TRIP:${link.mobilityTripId}`);
      if (link.relationType === "ASSOCIATED_CONTEXT") {
        bases.add("ASSOCIATED_CONTEXT");
      } else if (link.relationType === "ENVELOPING_CONTEXT") {
        const complete = trip.knowledgeState === "KNOWN" && (trip.boundaryStatus === "CLOSED_HOME" || trip.boundaryStatus === "CLOSED_SAME_ANCHOR");
        bases.add(complete ? "FULL_ENVELOPING_TRIP" : "OPEN_ENVELOPING_TRIP");
        for (const legId of members) projected.add(legId);
      } else {
        if (link.anchorLegId === null || !members.has(link.anchorLegId)) throw new TypeError(`EVENT_MOBILITY_INVALID_ANCHOR:${link.mobilityTripContextLinkId}`);
        projected.add(link.anchorLegId);
        bases.add(link.relationType === "ACCESS_CONTEXT" ? "ACCESS_LEG" : "ANCHORED_STOP_LEGS");
      }
      coverageInputs.push({ tripId: trip.mobilityTripId, knowledgeState: trip.knowledgeState, boundaryStatus: trip.boundaryStatus, relationType: link.relationType, anchorLegId: link.anchorLegId });
    }
    const projectedLegIds = unique([...projected]);
    const inputHash = digest({
      eventRef,
      projectedLegIds,
      linkIds: sortedLinks.map((link) => link.mobilityTripContextLinkId),
      relationTypes,
      validationStatuses: sortedLinks.map((link) => link.validationStatus),
      coverageInputs,
      metricVersion: EVENT_MOBILITY_COST_METRIC_VERSION,
      policyVersion: GLOBAL_M7_EVENT_MOBILITY_POLICY_VERSION,
      legValues: projectedLegIds.map((id) => {
        const leg = legs.get(id)!;
        return [id, leg.distanceKm, leg.estimatedFuelLiters, leg.estimatedFuelCost];
      }),
    });
    const base: EventMobilitySummaryBase = {
      eventRef: eventRef as EventMobilitySummary["eventRef"], targetKind, relationTypes, validationStatus,
      mobilityCostMetric: metric, monetaryNature: "ESTIMATED_MOBILITY_USAGE",
      additivity: { withinSummary: "UNION_UNIQUE_MOBILITY_LEGS", acrossSummaries: "NON_ADDITIVE_RECOMPUTE_ON_TARGET_GROUP" },
      methodVersion: GLOBAL_M7_EVENT_MOBILITY_METHOD_VERSION, policyVersion: GLOBAL_M7_EVENT_MOBILITY_POLICY_VERSION,
      evidenceRefs: [`metric:${EVENT_MOBILITY_COST_METRIC_VERSION}`, `mobility-summary-input:${inputHash}`, `mobility-trip-context:${MOBILITY_TRIP_CONTEXT_METHOD_VERSION}`, `physical-attribution-policy:${GLOBAL_M7_EVENT_MOBILITY_POLICY_VERSION}`].sort(compare),
      inputHash,
    };
    const compatibleEnvelopeBases = relationTypes.length === 1 && relationTypes[0] === "ENVELOPING_CONTEXT"
      && [...bases].every((basis) => basis === "FULL_ENVELOPING_TRIP" || basis === "OPEN_ENVELOPING_TRIP");
    if (bases.has("ASSOCIATED_CONTEXT") || (bases.size !== 1 && !compatibleEnvelopeBases)) {
      summaries.push({ ...base, status: "AMBIGUOUS", coverage: { state: "AMBIGUOUS", basis: bases.has("ASSOCIATED_CONTEXT") ? "ASSOCIATED_CONTEXT" : "INCOMPATIBLE_ATTRIBUTIONS", policyRef: GLOBAL_M7_EVENT_MOBILITY_POLICY_VERSION } });
      continue;
    }
    if (projectedLegIds.length === 0) throw new TypeError(`EVENT_MOBILITY_EMPTY_PROJECTION:${eventRef}`);
    const physicalLegs = projectedLegIds.map((id) => legs.get(id)!);
    for (const id of projectedLegIds) projectedGlobally.add(id);
    const measures = { ...totals(physicalLegs), tripCount: unique(sortedLinks.map((link) => link.mobilityTripId)).length };
    const basis = bases.has("OPEN_ENVELOPING_TRIP") ? "OPEN_ENVELOPING_TRIP" : [...bases][0]!;
    if (basis === "FULL_ENVELOPING_TRIP") {
      summaries.push({ ...base, ...measures, status: "KNOWN", coverage: { state: "COMPLETE", basis, policyRef: GLOBAL_M7_EVENT_MOBILITY_POLICY_VERSION } });
    } else {
      summaries.push({ ...base, ...measures, status: "PARTIAL", coverage: { state: "PARTIAL", basis: basis as "ANCHORED_STOP_LEGS" | "ACCESS_LEG" | "OPEN_ENVELOPING_TRIP", policyRef: GLOBAL_M7_EVENT_MOBILITY_POLICY_VERSION } });
    }
  }
  const physicalUnionTotals = totals(unique([...projectedGlobally]).map((id) => legs.get(id)!));
  const inputHash = digest({ methodVersion: GLOBAL_M7_EVENT_MOBILITY_METHOD_VERSION, policyVersion: GLOBAL_M7_EVENT_MOBILITY_POLICY_VERSION, metricVersion: EVENT_MOBILITY_COST_METRIC_VERSION, summaryInputHashes: summaries.map((summary) => summary.inputHash) });
  const output = { methodVersion: GLOBAL_M7_EVENT_MOBILITY_METHOD_VERSION, policyVersion: GLOBAL_M7_EVENT_MOBILITY_POLICY_VERSION, costMetricId: EVENT_MOBILITY_COST_METRIC_VERSION, summaries, physicalUnionTotals, inputHash, liveWrites: "NONE" as const };
  return { ...output, outputHash: digest(output) };
}
