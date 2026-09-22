import { Temporal } from "@js-temporal/polyfill";
import Big from "big.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex, utf8ToBytes } from "@noble/hashes/utils.js";
import type { MobilityLegFact, PersonDayFact, PlaceVisitFact } from "../facts";
import { canonicalSerializeGlobal } from "../../core/global-v2";

export const GLOBAL_M7_MOBILITY_CONTEXT_METHOD_VERSION = "global_m7_mobility_context@v1" as const;
export const GLOBAL_M7_MOBILITY_CONTEXT_POLICY = Object.freeze({
  policyRef: "global-m7-mobility-context-exact-place-observed-boundary@v1",
  observedBoundaryToleranceMinutes: 120,
  pairwisePresencePolicyRef: "global-m7-mobility-pairwise-positive-evidence@v1",
});

export type MobilityPurpose =
  | "WORK_COMMUTE"
  | "WORK_MIDDAY"
  | "FAMILY_VISIT"
  | "FRIEND_VISIT"
  | "HEALTH"
  | "SHOPPING"
  | "LEISURE"
  | "OTHER"
  | "UNKNOWN";

export type MobilityContextKind = "LIFE_EVENT" | "PERSON_PLACE_PRESENCE" | "UNKNOWN";
export type MobilityContextScope = "PERSONAL" | "SHARED" | "HOUSEHOLD" | "UNKNOWN";
export type MobilityContextLinkState = "LINKED" | "AMBIGUOUS" | "UNLINKED";
export type MobilityContextKnowledgeState = "CONFIRMED" | "DERIVED" | "AMBIGUOUS" | "UNKNOWN";
export type MobilityTemporalQuality = "EXACT" | "APPROXIMATE" | "DATE_ONLY" | "PROXY" | "UNKNOWN";
export type MobilityTemporalRelation =
  | "ARRIVAL_TO_CONTEXT"
  | "DEPARTURE_FROM_CONTEXT"
  | "WITHIN_CONTEXT"
  | "DATE_ONLY_CANDIDATE"
  | "UNKNOWN";

export type MobilityLifeEventParticipationAuthority = {
  readonly personId: string;
  readonly status: "CONFIRMED" | "DERIVED" | "UNKNOWN";
  readonly startAt: string | null;
  readonly endAt: string | null;
  readonly timePrecision: "EXACT" | "APPROXIMATE" | "TIME_RANGE" | "UNKNOWN";
  readonly evidenceRef: string;
};

export type MobilityLifeEventContextAuthority = {
  readonly lifeEventId: string;
  readonly typeKey: string;
  readonly startDate: string;
  readonly endDate: string;
  readonly validationStatus: "CONFIRMED" | "DERIVED";
  readonly placeIds: readonly string[];
  readonly participations: readonly MobilityLifeEventParticipationAuthority[];
  readonly evidenceRefs: readonly string[];
};

export type MobilityContextResolution = {
  readonly contextResolutionId: string;
  readonly mobilityLegId: string;
  readonly subjectPersonId: string | null;
  readonly contextKind: MobilityContextKind;
  readonly contextRef: string | null;
  readonly purpose: MobilityPurpose;
  readonly scope: MobilityContextScope;
  readonly linkState: MobilityContextLinkState;
  readonly knowledgeState: MobilityContextKnowledgeState;
  readonly temporalRelation: MobilityTemporalRelation;
  readonly temporalQuality: MobilityTemporalQuality;
  readonly evidenceRefs: readonly string[];
};

export type MobilityPresenceResolution = {
  readonly presenceResolutionId: string;
  readonly contextResolutionId: string;
  readonly mobilityLegId: string;
  readonly subjectPersonId: string;
  readonly otherPersonId: string;
  readonly state: "OTHER_ELSEWHERE_CONFIRMED" | "CO_PRESENT_CONFIRMED" | "UNKNOWN";
  readonly temporalQuality: MobilityTemporalQuality;
  readonly evidenceRefs: readonly string[];
};

export type GlobalM7MobilityContextAuthority = {
  readonly methodVersion: typeof GLOBAL_M7_MOBILITY_CONTEXT_METHOD_VERSION;
  readonly policy: typeof GLOBAL_M7_MOBILITY_CONTEXT_POLICY;
  readonly contextLinks: readonly MobilityContextResolution[];
  readonly presenceResolutions: readonly MobilityPresenceResolution[];
  readonly sourceLegCount: number;
  readonly physicalTotals: MobilityPhysicalTotals;
  readonly inputHash: string;
  readonly outputHash: string;
  readonly liveWrites: "NONE";
};

export type MobilityPhysicalTotals = {
  readonly physicalLegCount: number;
  readonly distanceKm: string;
  readonly estimatedFuelLiters: string;
  readonly estimatedFuelCost: string;
};

const purposeByTypeKey: Readonly<Record<string, MobilityPurpose>> = Object.freeze({
  travail_site: "WORK_COMMUTE",
  visite_famille: "FAMILY_VISIT",
  visite_ami: "FRIEND_VISIT",
  rdv_medical: "HEALTH",
  pharmacie: "HEALTH",
  courses_alimentaires: "SHOPPING",
  shopping_commerce: "SHOPPING",
  activite_loisir: "LEISURE",
  spectacle_culture: "LEISURE",
});

const compare = (left: string, right: string) => left.localeCompare(right);
const unique = (values: readonly string[]) => [...new Set(values)].sort(compare);
const digest = (value: unknown) => bytesToHex(sha256(utf8ToBytes(canonicalSerializeGlobal(value))));
const contextId = (legId: string, kind: MobilityContextKind, ref: string | null, subject: string | null) =>
  `mobility-context:${digest([legId, kind, ref, subject]).slice(0, 32)}`;
const presenceId = (contextResolutionId: string, subject: string, other: string) =>
  `mobility-presence:${digest([contextResolutionId, subject, other]).slice(0, 32)}`;

export function resolveMobilityPurposeFromTypeKey(typeKey: string): MobilityPurpose {
  return purposeByTypeKey[typeKey] ?? "UNKNOWN";
}

function instant(value: string): Temporal.Instant {
  return Temporal.Instant.from(value);
}

function legInstant(leg: MobilityLegFact, householdTimeZone: string): Temporal.Instant | null {
  if (leg.time.authority !== "OBSERVED" || leg.time.observedTime === null) return null;
  return Temporal.PlainDateTime.from(leg.time.observedTime).toZonedDateTime(householdTimeZone).toInstant();
}

function overlaps(startA: string, endA: string, startB: string, endB: string): boolean {
  return Temporal.Instant.compare(instant(startA), instant(endB)) < 0
    && Temporal.Instant.compare(instant(startB), instant(endA)) < 0;
}

function exactVisitInterval(visit: PlaceVisitFact): { readonly startAt: string; readonly endAt: string } | null {
  if (visit.timePrecision !== "exact" || visit.interval.kind !== "known") return null;
  return { startAt: String(visit.interval.startedAt), endAt: String(visit.interval.endedAt) };
}

function participationInterval(participation: MobilityLifeEventParticipationAuthority) {
  if (participation.startAt === null || participation.endAt === null) return null;
  return { startAt: participation.startAt, endAt: participation.endAt };
}

function positiveParticipation(status: MobilityLifeEventParticipationAuthority["status"]): boolean {
  return status === "CONFIRMED" || status === "DERIVED";
}

function participationPrecisionRank(value: MobilityLifeEventParticipationAuthority["timePrecision"]): number {
  if (value === "EXACT") return 3;
  if (value === "TIME_RANGE") return 2;
  if (value === "APPROXIMATE") return 1;
  return 0;
}

function strongestParticipations(rows: readonly MobilityLifeEventParticipationAuthority[]) {
  const maximum = Math.max(...rows.map((row) => participationPrecisionRank(row.timePrecision)));
  return rows.filter((row) => participationPrecisionRank(row.timePrecision) === maximum)
    .sort((left, right) => left.evidenceRef.localeCompare(right.evidenceRef));
}

function relationForEndpoint(leg: MobilityLegFact, placeIds: ReadonlySet<string>): MobilityTemporalRelation | null {
  const originMatches = leg.origin.placeId !== null && placeIds.has(String(leg.origin.placeId));
  const destinationMatches = leg.destination.placeId !== null && placeIds.has(String(leg.destination.placeId));
  if (leg.time.type === "ARRIVAL") return destinationMatches ? "ARRIVAL_TO_CONTEXT" : null;
  if (leg.time.type === "DEPARTURE") return originMatches ? "DEPARTURE_FROM_CONTEXT" : null;
  if (leg.time.type === "UNTYPED" && (originMatches || destinationMatches)) return "WITHIN_CONTEXT";
  return null;
}

function pointCompatible(
  point: Temporal.Instant,
  interval: { readonly startAt: string; readonly endAt: string },
  relation: MobilityTemporalRelation,
): boolean {
  const start = instant(interval.startAt), end = instant(interval.endAt);
  if (Temporal.Instant.compare(end, start) < 0) throw new TypeError("MOBILITY_CONTEXT_INVALID_INTERVAL");
  const tolerance = { minutes: GLOBAL_M7_MOBILITY_CONTEXT_POLICY.observedBoundaryToleranceMinutes };
  if (relation === "ARRIVAL_TO_CONTEXT") {
    return Temporal.Instant.compare(point, start.subtract(tolerance)) >= 0
      && Temporal.Instant.compare(point, end) <= 0;
  }
  if (relation === "DEPARTURE_FROM_CONTEXT") {
    return Temporal.Instant.compare(point, start) >= 0
      && Temporal.Instant.compare(point, end.add(tolerance)) <= 0;
  }
  return Temporal.Instant.compare(point, start) >= 0 && Temporal.Instant.compare(point, end) <= 0;
}

function linkTemporalAssessment(input: {
  readonly leg: MobilityLegFact;
  readonly householdTimeZone: string;
  readonly interval: { readonly startAt: string; readonly endAt: string } | null;
  readonly precision: MobilityLifeEventParticipationAuthority["timePrecision"] | PlaceVisitFact["timePrecision"];
  readonly relation: MobilityTemporalRelation;
}) {
  if (input.leg.time.authority === "PROXY") {
    return { compatible: true, linkState: "AMBIGUOUS" as const, quality: "PROXY" as const };
  }
  const point = legInstant(input.leg, input.householdTimeZone);
  if (point === null || input.interval === null) {
    return { compatible: true, linkState: "AMBIGUOUS" as const, quality: "DATE_ONLY" as const };
  }
  if (!pointCompatible(point, input.interval, input.relation)) {
    return { compatible: false, linkState: "UNLINKED" as const, quality: "EXACT" as const };
  }
  const exact = input.precision === "EXACT" || input.precision === "exact";
  return exact
    ? { compatible: true, linkState: "LINKED" as const, quality: "EXACT" as const }
    : { compatible: true, linkState: "AMBIGUOUS" as const, quality: "APPROXIMATE" as const };
}

function fallbackLink(leg: MobilityLegFact): MobilityContextResolution {
  return {
    contextResolutionId: contextId(leg.legId, "UNKNOWN", null, null),
    mobilityLegId: leg.legId,
    subjectPersonId: null,
    contextKind: "UNKNOWN",
    contextRef: null,
    purpose: "UNKNOWN",
    scope: "HOUSEHOLD",
    linkState: "UNLINKED",
    knowledgeState: "UNKNOWN",
    temporalRelation: "UNKNOWN",
    temporalQuality: leg.time.authority === "PROXY" ? "PROXY" : "UNKNOWN",
    evidenceRefs: unique([`fct_mobility_leg:${leg.legId}`, ...leg.evidenceRefs]),
  };
}

function contextIntervalForPresence(
  link: MobilityContextResolution,
  events: ReadonlyMap<string, MobilityLifeEventContextAuthority>,
  visits: ReadonlyMap<string, PlaceVisitFact>,
) {
  if (link.contextRef === null) return null;
  if (link.contextKind === "LIFE_EVENT" && link.subjectPersonId !== null) {
    const event = events.get(link.contextRef);
    const candidates = event?.participations.filter((row) => row.personId === link.subjectPersonId && positiveParticipation(row.status)) ?? [];
    const participation = candidates.length === 0 ? undefined : strongestParticipations(candidates)[0];
    return participation === undefined ? null : participationInterval(participation);
  }
  if (link.contextKind === "PERSON_PLACE_PRESENCE") {
    const visit = visits.get(link.contextRef);
    return visit === undefined ? null : exactVisitInterval(visit);
  }
  return null;
}

function resolvePairwisePresence(input: {
  readonly link: MobilityContextResolution;
  readonly householdPersonIds: readonly string[];
  readonly events: ReadonlyMap<string, MobilityLifeEventContextAuthority>;
  readonly visits: ReadonlyMap<string, PlaceVisitFact>;
  readonly visitsByPerson: ReadonlyMap<string, readonly PlaceVisitFact[]>;
}): readonly MobilityPresenceResolution[] {
  const subject = input.link.subjectPersonId;
  if (subject === null) return [];
  const contextInterval = contextIntervalForPresence(input.link, input.events, input.visits);
  return input.householdPersonIds.filter((other) => other !== subject).map((other) => {
    let state: MobilityPresenceResolution["state"] = "UNKNOWN";
    let quality: MobilityTemporalQuality = input.link.temporalQuality;
    const evidence = [...input.link.evidenceRefs];
    if (input.link.linkState === "LINKED") {
      const event = input.link.contextKind === "LIFE_EVENT" && input.link.contextRef !== null
        ? input.events.get(input.link.contextRef)
        : undefined;
      const otherParticipationCandidates = event?.participations.filter((row) => row.personId === other && positiveParticipation(row.status)) ?? [];
      const otherParticipation = otherParticipationCandidates.length === 0 ? undefined : strongestParticipations(otherParticipationCandidates)[0];
      const otherParticipationInterval = otherParticipation === undefined ? null : participationInterval(otherParticipation);
      if (otherParticipation !== undefined && contextInterval !== null && otherParticipationInterval !== null
        && otherParticipation.timePrecision === "EXACT"
        && overlaps(contextInterval.startAt, contextInterval.endAt, otherParticipationInterval.startAt, otherParticipationInterval.endAt)) {
        state = "CO_PRESENT_CONFIRMED";
        quality = "EXACT";
        evidence.push(otherParticipation.evidenceRef);
      } else if (contextInterval !== null) {
        const subjectPlaceIds = input.link.contextKind === "LIFE_EVENT"
          ? new Set(event?.placeIds ?? [])
          : new Set(input.link.contextRef === null ? [] : [String(input.visits.get(input.link.contextRef)?.placeId ?? "")]);
        const overlapping = (input.visitsByPerson.get(other) ?? []).flatMap((visit) => {
          const interval = exactVisitInterval(visit);
          return interval !== null && overlaps(contextInterval.startAt, contextInterval.endAt, interval.startAt, interval.endAt)
            ? [{ visit, interval }]
            : [];
        });
        const atContext = overlapping.filter(({ visit }) => subjectPlaceIds.has(String(visit.placeId)));
        const elsewhere = overlapping.filter(({ visit }) => !subjectPlaceIds.has(String(visit.placeId)));
        if (atContext.length > 0 && elsewhere.length === 0) state = "CO_PRESENT_CONFIRMED";
        else if (elsewhere.length > 0 && atContext.length === 0) state = "OTHER_ELSEWHERE_CONFIRMED";
        if (state !== "UNKNOWN") {
          quality = "EXACT";
          evidence.push(...overlapping.map(({ visit }) => `fct_place_visit:${visit.visitKey}`));
        }
      }
    }
    return {
      presenceResolutionId: presenceId(input.link.contextResolutionId, subject, other),
      contextResolutionId: input.link.contextResolutionId,
      mobilityLegId: input.link.mobilityLegId,
      subjectPersonId: subject,
      otherPersonId: other,
      state,
      temporalQuality: quality,
      evidenceRefs: unique(evidence),
    };
  });
}

export function aggregateMobilityPhysicalTotals(
  legs: readonly MobilityLegFact[],
  contextLinks: readonly MobilityContextResolution[],
): MobilityPhysicalTotals {
  const legById = new Map<string, MobilityLegFact>();
  for (const leg of legs) {
    if (legById.has(leg.legId)) throw new TypeError(`MOBILITY_CONTEXT_DUPLICATE_LEG:${leg.legId}`);
    legById.set(leg.legId, leg);
  }
  for (const link of contextLinks) {
    if (!legById.has(link.mobilityLegId)) throw new TypeError(`MOBILITY_CONTEXT_ORPHAN_LINK:${link.contextResolutionId}`);
  }
  const sum = (pick: (leg: MobilityLegFact) => string) =>
    [...legById.values()].reduce((total, leg) => total.plus(pick(leg)), new Big(0)).toString();
  return {
    physicalLegCount: legById.size,
    distanceKm: sum((leg) => leg.distanceKm),
    estimatedFuelLiters: sum((leg) => leg.estimatedFuelLiters),
    estimatedFuelCost: sum((leg) => leg.estimatedFuelCost),
  };
}

export function buildGlobalM7MobilityContextAuthority(input: {
  readonly householdId: string;
  readonly householdTimeZone: string;
  readonly householdPersonIds: readonly string[];
  readonly mobilityLegs: readonly MobilityLegFact[];
  readonly lifeEventContexts: readonly MobilityLifeEventContextAuthority[];
  readonly placeVisits: readonly PlaceVisitFact[];
  readonly personDays: readonly PersonDayFact[];
}): GlobalM7MobilityContextAuthority {
  const personIds = unique(input.householdPersonIds);
  const personSet = new Set(personIds);
  const events = new Map<string, MobilityLifeEventContextAuthority>();
  for (const event of input.lifeEventContexts) {
    if (events.has(event.lifeEventId)) throw new TypeError(`MOBILITY_CONTEXT_DUPLICATE_EVENT:${event.lifeEventId}`);
    if (event.placeIds.length !== unique(event.placeIds).length) throw new TypeError(`MOBILITY_CONTEXT_DUPLICATE_EVENT_PLACE:${event.lifeEventId}`);
    if (event.participations.some((row) => !personSet.has(row.personId))) throw new TypeError(`MOBILITY_CONTEXT_OUT_OF_HOUSEHOLD_PARTICIPANT:${event.lifeEventId}`);
    events.set(event.lifeEventId, event);
  }
  for (const leg of input.mobilityLegs) if (String(leg.householdId) !== input.householdId) throw new TypeError("MOBILITY_CONTEXT_CROSS_HOUSEHOLD_LEG");
  for (const visit of input.placeVisits) if (String(visit.householdId) !== input.householdId || !personSet.has(String(visit.personId))) throw new TypeError("MOBILITY_CONTEXT_CROSS_HOUSEHOLD_VISIT");
  for (const day of input.personDays) if (String(day.householdId) !== input.householdId || !personSet.has(String(day.personId))) throw new TypeError("MOBILITY_CONTEXT_CROSS_HOUSEHOLD_DAY");

  const links: MobilityContextResolution[] = [];
  const visitById = new Map(input.placeVisits.map((visit) => [String(visit.visitKey), visit]));
  const visitsByPerson = new Map<string, PlaceVisitFact[]>();
  for (const visit of input.placeVisits) {
    const values = visitsByPerson.get(String(visit.personId)) ?? [];
    values.push(visit);
    visitsByPerson.set(String(visit.personId), values);
  }
  for (const leg of input.mobilityLegs) {
    const before = links.length;
    for (const event of input.lifeEventContexts) {
      if (leg.date < event.startDate || leg.date > event.endDate || event.placeIds.length === 0) continue;
      const relation = relationForEndpoint(leg, new Set(event.placeIds));
      if (relation === null) continue;
      const positive = event.participations.filter((row) => positiveParticipation(row.status));
      const scope: MobilityContextScope = unique(positive.map((row) => row.personId)).length > 1 ? "SHARED" : "PERSONAL";
      for (const subjectPersonId of unique(positive.map((row) => row.personId))) {
        const participations = strongestParticipations(positive.filter((row) => row.personId === subjectPersonId));
        const assessments = participations.map((participation) => ({
          participation,
          temporal: linkTemporalAssessment({
            leg,
            householdTimeZone: input.householdTimeZone,
            interval: participationInterval(participation),
            precision: participation.timePrecision,
            relation,
          }),
        })).filter(({ temporal }) => temporal.compatible);
        if (assessments.length === 0) continue;
        const chosen = assessments.find(({ temporal }) => temporal.linkState === "LINKED") ?? assessments[0];
        const { participation, temporal } = chosen;
        const knowledgeState: MobilityContextKnowledgeState = temporal.linkState === "AMBIGUOUS"
          ? "AMBIGUOUS"
          : event.validationStatus === "CONFIRMED" && participation.status === "CONFIRMED" ? "CONFIRMED" : "DERIVED";
        links.push({
          contextResolutionId: contextId(leg.legId, "LIFE_EVENT", event.lifeEventId, subjectPersonId),
          mobilityLegId: leg.legId,
          subjectPersonId,
          contextKind: "LIFE_EVENT",
          contextRef: event.lifeEventId,
          purpose: resolveMobilityPurposeFromTypeKey(event.typeKey),
          scope,
          linkState: temporal.linkState,
          knowledgeState,
          temporalRelation: temporal.linkState === "AMBIGUOUS" && temporal.quality === "DATE_ONLY" ? "DATE_ONLY_CANDIDATE" : relation,
          temporalQuality: temporal.quality,
          evidenceRefs: unique([`fct_mobility_leg:${leg.legId}`, `life-event:${event.lifeEventId}`, ...assessments.map(({ participation: row }) => row.evidenceRef), ...event.evidenceRefs, ...leg.evidenceRefs]),
        });
      }
    }
    for (const visit of input.placeVisits) {
      if (visit.localDate !== leg.date) continue;
      const relation = relationForEndpoint(leg, new Set([String(visit.placeId)]));
      if (relation === null) continue;
      const interval = visit.interval.kind === "known"
        ? { startAt: String(visit.interval.startedAt), endAt: String(visit.interval.endedAt) }
        : null;
      const temporal = linkTemporalAssessment({ leg, householdTimeZone: input.householdTimeZone, interval, precision: visit.timePrecision, relation });
      if (!temporal.compatible) continue;
      links.push({
        contextResolutionId: contextId(leg.legId, "PERSON_PLACE_PRESENCE", String(visit.visitKey), String(visit.personId)),
        mobilityLegId: leg.legId,
        subjectPersonId: String(visit.personId),
        contextKind: "PERSON_PLACE_PRESENCE",
        contextRef: String(visit.visitKey),
        purpose: "UNKNOWN",
        scope: "PERSONAL",
        linkState: temporal.linkState,
        knowledgeState: temporal.linkState === "LINKED" ? "CONFIRMED" : "AMBIGUOUS",
        temporalRelation: temporal.linkState === "AMBIGUOUS" && temporal.quality === "DATE_ONLY" ? "DATE_ONLY_CANDIDATE" : relation,
        temporalQuality: temporal.quality,
        evidenceRefs: unique([`fct_mobility_leg:${leg.legId}`, `fct_place_visit:${visit.visitKey}`, `fct_person_day:${visit.personDayId}`, ...leg.evidenceRefs]),
      });
    }
    if (links.length === before) links.push(fallbackLink(leg));
  }
  const linkById = new Map<string, MobilityContextResolution>();
  for (const link of links) {
    const previous = linkById.get(link.contextResolutionId);
    if (previous === undefined) linkById.set(link.contextResolutionId, link);
    else linkById.set(link.contextResolutionId, {
      ...previous,
      evidenceRefs: unique([...previous.evidenceRefs, ...link.evidenceRefs]),
    });
  }
  const contextLinks = [...linkById.values()]
    .sort((left, right) => left.mobilityLegId.localeCompare(right.mobilityLegId)
      || (left.contextRef ?? "").localeCompare(right.contextRef ?? "")
      || (left.subjectPersonId ?? "").localeCompare(right.subjectPersonId ?? ""));
  const readonlyVisitsByPerson = new Map<string, readonly PlaceVisitFact[]>(visitsByPerson);
  const presenceResolutions = contextLinks.flatMap((link) => resolvePairwisePresence({
    link,
    householdPersonIds: personIds,
    events,
    visits: visitById,
    visitsByPerson: readonlyVisitsByPerson,
  })).sort((left, right) => left.mobilityLegId.localeCompare(right.mobilityLegId)
    || left.subjectPersonId.localeCompare(right.subjectPersonId)
    || left.otherPersonId.localeCompare(right.otherPersonId)
    || left.contextResolutionId.localeCompare(right.contextResolutionId));
  const physicalTotals = aggregateMobilityPhysicalTotals(input.mobilityLegs, contextLinks);
  const semanticInput = {
    householdId: input.householdId,
    householdTimeZone: input.householdTimeZone,
    householdPersonIds: personIds,
    mobilityLegs: [...input.mobilityLegs].sort((left, right) => left.legId.localeCompare(right.legId)),
    lifeEventContexts: [...input.lifeEventContexts].map((event) => ({
      ...event,
      placeIds: unique(event.placeIds),
      participations: [...event.participations].sort((left, right) => left.personId.localeCompare(right.personId) || left.evidenceRef.localeCompare(right.evidenceRef)),
      evidenceRefs: unique(event.evidenceRefs),
    })).sort((left, right) => left.lifeEventId.localeCompare(right.lifeEventId)),
    placeVisits: [...input.placeVisits].sort((left, right) => String(left.visitKey).localeCompare(String(right.visitKey))),
    personDays: [...input.personDays].sort((left, right) => String(left.personDayId).localeCompare(String(right.personDayId))),
  };
  const output = {
    methodVersion: GLOBAL_M7_MOBILITY_CONTEXT_METHOD_VERSION,
    policy: GLOBAL_M7_MOBILITY_CONTEXT_POLICY,
    contextLinks,
    presenceResolutions,
    sourceLegCount: input.mobilityLegs.length,
    physicalTotals,
    liveWrites: "NONE" as const,
  };
  return { ...output, inputHash: digest(semanticInput), outputHash: digest(output) };
}
