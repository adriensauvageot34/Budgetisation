import { Temporal } from "@js-temporal/polyfill";
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex, utf8ToBytes } from "@noble/hashes/utils.js";
import type { PlaceVisitFact } from "../facts";
import {
  canonicalSerializeGlobal,
  parseGlobalSupport,
  type GlobalKnowledgeValue,
  type GlobalSupport,
} from "../../core/global-v2";
import type { Money } from "../../core/money";
import type { LocalDate } from "../../core/time";

export const GLOBAL_M10_METHOD_VERSION = "global_shared_participation@v1" as const;

export const globalSharedPolicies = {
  evidence: "global-shared-participation-evidence@v1",
  copresence: "global-strong-copresence@v1",
  activityCatalog: "global-shared-inference-catalog@v1",
  multidayMoment: "global-shared-moment-multiday@v1",
  support: "global-shared-observable-support@v1",
  social: "global-social-context@v1",
} as const;

export type GlobalParticipationState = "PRESENT" | "ABSENT" | "UNKNOWN" | "CONFLICT";
export type GlobalSharedResolution = "SHARED" | "PERSON_A_ONLY" | "PERSON_B_ONLY" | "NEITHER" | "UNRESOLVED" | "CONFLICT";
export type GlobalSharedEvidenceLevel = "EXPLICIT_SHARED" | "CANONICAL_SHARED" | "STRONG_COPRESENCE" | "CONTEXTUAL_ONLY" | "INSUFFICIENT";
export type GlobalSharedInferenceMode = "COPRESENCE_ALLOWED" | "EXPLICIT_ONLY" | "SPECIAL_RULE";
export type GlobalSharedUnitGrain = "DAY" | "OCCURRENCE" | "VISIT" | "MOMENT" | "MOBILITY_LEG";

export const globalSharedInferenceCatalog = Object.freeze({
  COPRESENCE_ALLOWED: Object.freeze([
    "RESTAURANT", "CAFE", "BAR", "SOCIAL_OUTING", "FAMILY_VISIT", "FRIEND_VISIT",
    "CINEMA", "CONCERT", "FESTIVAL", "SHOW", "CULTURAL_EVENT", "LEISURE_ACTIVITY",
    "RECREATIONAL_ACTIVITY", "SOCIAL_EVENT",
  ]),
  EXPLICIT_ONLY: Object.freeze([
    "GROCERY", "SHOPPING", "ERRAND", "HOME", "WORK", "REMOTE_WORK", "HEALTHCARE",
    "APPOINTMENT", "PERSONAL_CARE", "ADMINISTRATIVE", "TRAINING", "SCHOOL",
  ]),
} as const);

const copresenceAllowed = new Set<string>(globalSharedInferenceCatalog.COPRESENCE_ALLOWED);
const explicitOnly = new Set<string>(globalSharedInferenceCatalog.EXPLICIT_ONLY);

export type GlobalParticipationAssertion = {
  readonly personId: string;
  readonly state: "PRESENT" | "ABSENT";
  readonly authority: "EXPLICIT" | "CANONICAL" | "INCOMPATIBLE_PRESENCE";
  readonly evidenceRefs: readonly string[];
};

export type GlobalParticipantRoster = {
  readonly participantPersonIds: readonly string[];
  readonly completeness: "POSITIVE_ONLY" | "EXHAUSTIVE" | "UNKNOWN";
  readonly externalParticipants: readonly {
    readonly kind: "CANONICAL_CONTACT" | "UNRESOLVED_EXTERNAL";
    readonly ref: string;
  }[];
  readonly evidenceRefs: readonly string[];
};

export type GlobalSharedPlaceNode = {
  readonly placeId: string;
  readonly parentPlaceId?: string;
  readonly resolutionLevel: "VENUE" | "ADDRESS" | "SITE" | "LOCALITY" | "MUNICIPALITY" | "REGION" | "UNKNOWN";
  readonly evidenceRefs: readonly string[];
};

export type GlobalSharedVisitEvidence = {
  readonly fact: PlaceVisitFact;
  readonly visitKind: "STOP" | "STAY" | "TRANSIT" | "PASS_THROUGH";
  readonly evidenceRefs: readonly string[];
};

export type GlobalSharedMomentDayEvidence = {
  readonly date: LocalDate;
  readonly observable: boolean;
  readonly shared: boolean;
  readonly evidenceRefs: readonly string[];
};

export type GlobalSharedEconomicContext = {
  readonly causalEconomicCost: GlobalKnowledgeValue<Money>;
  readonly contextualEstimatedCost: GlobalKnowledgeValue<Money>;
  readonly personalAttribution: Readonly<Record<string, GlobalKnowledgeValue<Money>>>;
  readonly economicIdentityRefs: readonly string[];
};

export type GlobalSharedParticipationInput = {
  readonly unitId: string;
  readonly universeId: string;
  readonly grain: GlobalSharedUnitGrain;
  readonly personIds: readonly [string, string];
  readonly assertions: readonly GlobalParticipationAssertion[];
  readonly roster?: GlobalParticipantRoster;
  readonly activityType?: string;
  readonly activityInterval?: { readonly startAt: string; readonly endAt: string };
  readonly visits?: readonly GlobalSharedVisitEvidence[];
  readonly places?: readonly GlobalSharedPlaceNode[];
  readonly siteMatchAllowed?: boolean;
  readonly moment?: {
    readonly startDate: LocalDate;
    readonly endDate: LocalDate;
    readonly dayEvidence: readonly GlobalSharedMomentDayEvidence[];
    readonly structuralProofRefs: readonly string[];
    readonly inferenceAllowed: boolean;
  };
  readonly economicContext?: GlobalSharedEconomicContext;
  readonly evidenceRefs: readonly string[];
};

export type GlobalSharedParticipationResult = {
  readonly unitId: string;
  readonly universeId: string;
  readonly grain: GlobalSharedUnitGrain;
  readonly personStates: Readonly<Record<string, GlobalParticipationState>>;
  readonly resolution: GlobalSharedResolution;
  readonly evidenceLevel: GlobalSharedEvidenceLevel;
  readonly inferred: boolean;
  readonly inferencePolicyId?: string;
  readonly sharedPlaceId?: string;
  readonly overlapMinutes?: number;
  readonly exclusivity: "PAIR_ONLY" | "WITH_EXTERNALS" | "UNKNOWN";
  readonly knownExternalParticipantRefs: readonly string[];
  readonly unresolvedExternalParticipantCount: number;
  readonly evidenceRefs: readonly string[];
  readonly economicContext?: GlobalSharedEconomicContext;
  readonly inputHash: string;
};

const unique = (values: readonly string[]) => [...new Set(values)].sort();
const digest = (value: unknown) => bytesToHex(sha256(utf8ToBytes(`global-shared-participation@v1\n${canonicalSerializeGlobal(value)}`)));
const instant = (value: string) => Temporal.Instant.from(value);

function canonicalAssertions(values: readonly GlobalParticipationAssertion[]): readonly GlobalParticipationAssertion[] {
  const result = new Map<string, GlobalParticipationAssertion>();
  for (const value of values) {
    if (!value.personId || value.evidenceRefs.length === 0) throw new TypeError("M10_PARTICIPATION_ASSERTION_INCOMPLETE");
    const key = `${value.personId}:${value.state}:${value.authority}`;
    const normalized = { ...value, evidenceRefs: unique(value.evidenceRefs) };
    const previous = result.get(key);
    if (previous !== undefined && canonicalSerializeGlobal(previous) !== canonicalSerializeGlobal(normalized)) throw new TypeError("M10_CONTRADICTORY_ASSERTION_IDENTITY");
    result.set(key, normalized);
  }
  return [...result.values()].sort((a, b) => a.personId.localeCompare(b.personId) || a.state.localeCompare(b.state) || a.authority.localeCompare(b.authority));
}

function validateRoster(roster: GlobalParticipantRoster | undefined, householdPeople: ReadonlySet<string>): GlobalParticipantRoster | undefined {
  if (roster === undefined) return undefined;
  if (roster.evidenceRefs.length === 0 || new Set(roster.participantPersonIds).size !== roster.participantPersonIds.length) throw new TypeError("M10_ROSTER_INVALID");
  if (roster.participantPersonIds.some((id) => !householdPeople.has(id))) throw new TypeError("M10_ROSTER_PERSON_OUTSIDE_HOUSEHOLD");
  const external = new Map<string, GlobalParticipantRoster["externalParticipants"][number]>();
  for (const participant of roster.externalParticipants) {
    if (!participant.ref.trim()) throw new TypeError("M10_EXTERNAL_PARTICIPANT_REF_REQUIRED");
    const previous = external.get(participant.ref);
    if (previous !== undefined && previous.kind !== participant.kind) throw new TypeError("M10_EXTERNAL_PARTICIPANT_CONFLICT");
    external.set(participant.ref, participant);
  }
  return { ...roster, participantPersonIds: unique(roster.participantPersonIds), externalParticipants: [...external.values()].sort((a, b) => a.ref.localeCompare(b.ref)), evidenceRefs: unique(roster.evidenceRefs) };
}

function stateFor(personId: string, assertions: readonly GlobalParticipationAssertion[], roster?: GlobalParticipantRoster): GlobalParticipationState {
  const positives = assertions.filter((value) => value.personId === personId && value.state === "PRESENT");
  const negatives = assertions.filter((value) => value.personId === personId && value.state === "ABSENT");
  const rosterPresent = roster?.participantPersonIds.includes(personId) === true;
  const rosterAbsent = roster?.completeness === "EXHAUSTIVE" && !rosterPresent;
  const present = positives.length > 0 || rosterPresent;
  const absent = negatives.length > 0 || rosterAbsent;
  return present && absent ? "CONFLICT" : present ? "PRESENT" : absent ? "ABSENT" : "UNKNOWN";
}

function intervalOverlapMinutes(aStart: string, aEnd: string, bStart: string, bEnd: string): number {
  const start = Temporal.Instant.compare(instant(aStart), instant(bStart)) >= 0 ? instant(aStart) : instant(bStart);
  const end = Temporal.Instant.compare(instant(aEnd), instant(bEnd)) <= 0 ? instant(aEnd) : instant(bEnd);
  return Temporal.Instant.compare(start, end) < 0 ? start.until(end).total({ unit: "minutes" }) : 0;
}

function durationMinutes(start: string, end: string): number {
  const duration = instant(start).until(instant(end)).total({ unit: "minutes" });
  if (duration <= 0) throw new TypeError("M10_INVALID_INTERVAL");
  return duration;
}

export function requiredSharedOverlapMinutes(shorterDurationMinutes: number): number {
  if (!Number.isFinite(shorterDurationMinutes) || shorterDurationMinutes <= 0) throw new TypeError("M10_INVALID_VISIT_DURATION");
  return Math.max(15, Math.min(60, shorterDurationMinutes * 0.5));
}

function placesById(values: readonly GlobalSharedPlaceNode[]): ReadonlyMap<string, GlobalSharedPlaceNode> {
  const result = new Map<string, GlobalSharedPlaceNode>();
  for (const value of values) {
    if (!value.placeId || value.evidenceRefs.length === 0) throw new TypeError("M10_PLACE_AUTHORITY_REQUIRED");
    const normalized = { ...value, evidenceRefs: unique(value.evidenceRefs) };
    const previous = result.get(value.placeId);
    if (previous !== undefined && canonicalSerializeGlobal(previous) !== canonicalSerializeGlobal(normalized)) throw new TypeError("M10_CONTRADICTORY_PLACE");
    result.set(value.placeId, normalized);
  }
  for (const place of result.values()) {
    const seen = new Set([place.placeId]); let current = place;
    while (current.parentPlaceId !== undefined) {
      if (seen.has(current.parentPlaceId)) throw new TypeError("M10_PLACE_HIERARCHY_CYCLE");
      seen.add(current.parentPlaceId);
      const parent = result.get(current.parentPlaceId);
      if (parent === undefined) throw new TypeError("M10_PLACE_PARENT_MISSING");
      current = parent;
    }
  }
  return result;
}

function lineage(placeId: string, places: ReadonlyMap<string, GlobalSharedPlaceNode>): readonly string[] {
  const result = [placeId]; let current = places.get(placeId);
  while (current?.parentPlaceId !== undefined) { result.push(current.parentPlaceId); current = places.get(current.parentPlaceId); }
  return result;
}

function commonPlace(a: string, b: string, places: ReadonlyMap<string, GlobalSharedPlaceNode>): GlobalSharedPlaceNode | undefined {
  const bLineage = new Set(lineage(b, places));
  const id = lineage(a, places).find((candidate) => bLineage.has(candidate));
  return id === undefined ? undefined : places.get(id);
}

type CopresenceProof = { readonly level: "STRONG_COPRESENCE" | "CONTEXTUAL_ONLY" | "INSUFFICIENT"; readonly placeId?: string; readonly overlapMinutes?: number; readonly evidenceRefs: readonly string[] };

function resolveCopresence(input: GlobalSharedParticipationInput): CopresenceProof {
  const visits = input.visits ?? [], places = placesById(input.places ?? []);
  const [personA, personB] = input.personIds;
  let contextual: CopresenceProof | undefined;
  for (const a of visits.filter(({ fact }) => String(fact.personId) === personA)) for (const b of visits.filter(({ fact }) => String(fact.personId) === personB)) {
    if (![a.visitKind, b.visitKind].every((kind) => kind === "STOP" || kind === "STAY")) continue;
    if (a.fact.interval.kind !== "known" || b.fact.interval.kind !== "known" || a.fact.timePrecision === "unknown" || b.fact.timePrecision === "unknown") continue;
    const place = commonPlace(String(a.fact.placeId), String(b.fact.placeId), places);
    if (place === undefined) continue;
    const overlap = intervalOverlapMinutes(a.fact.interval.startedAt, a.fact.interval.endedAt, b.fact.interval.startedAt, b.fact.interval.endedAt);
    const threshold = requiredSharedOverlapMinutes(Math.min(durationMinutes(a.fact.interval.startedAt, a.fact.interval.endedAt), durationMinutes(b.fact.interval.startedAt, b.fact.interval.endedAt)));
    const refs = unique([...a.evidenceRefs, ...b.evidenceRefs, ...place.evidenceRefs]);
    const spatiallyStrong = place.resolutionLevel === "VENUE" || place.resolutionLevel === "ADDRESS" || place.resolutionLevel === "SITE" && input.siteMatchAllowed === true;
    if (!spatiallyStrong) {
      if (overlap > 0) contextual = { level: "CONTEXTUAL_ONLY", placeId: place.placeId, overlapMinutes: overlap, evidenceRefs: refs };
      continue;
    }
    if (overlap < threshold) continue;
    if (input.activityInterval !== undefined) {
      const activityDuration = durationMinutes(input.activityInterval.startAt, input.activityInterval.endAt);
      const activityThreshold = requiredSharedOverlapMinutes(activityDuration);
      const aActivity = intervalOverlapMinutes(a.fact.interval.startedAt, a.fact.interval.endedAt, input.activityInterval.startAt, input.activityInterval.endAt);
      const bActivity = intervalOverlapMinutes(b.fact.interval.startedAt, b.fact.interval.endedAt, input.activityInterval.startAt, input.activityInterval.endAt);
      if (aActivity < activityThreshold || bActivity < activityThreshold) continue;
    }
    return { level: "STRONG_COPRESENCE", placeId: place.placeId, overlapMinutes: overlap, evidenceRefs: refs };
  }
  return contextual ?? { level: "INSUFFICIENT", evidenceRefs: [] };
}

function activityMode(type: string | undefined): GlobalSharedInferenceMode | undefined {
  if (type === undefined) return undefined;
  if (copresenceAllowed.has(type)) return "COPRESENCE_ALLOWED";
  if (explicitOnly.has(type)) return "EXPLICIT_ONLY";
  return undefined;
}

function inferMultidayMoment(input: GlobalSharedParticipationInput): { readonly shared: boolean; readonly refs: readonly string[] } {
  const moment = input.moment;
  if (moment === undefined || !moment.inferenceAllowed) return { shared: false, refs: [] };
  const totalDays = Temporal.PlainDate.from(moment.startDate).until(Temporal.PlainDate.from(moment.endDate), { largestUnit: "day" }).days + 1;
  if (totalDays < 2) return { shared: false, refs: [] };
  const evidenceByDate = new Map<string, GlobalSharedMomentDayEvidence>();
  for (const row of moment.dayEvidence) {
    const previous = evidenceByDate.get(row.date);
    if (previous !== undefined && canonicalSerializeGlobal(previous) !== canonicalSerializeGlobal(row)) throw new TypeError("M10_CONTRADICTORY_MOMENT_DAY");
    evidenceByDate.set(row.date, row);
  }
  const observable = [...evidenceByDate.values()].filter(({ observable }) => observable);
  const shared = observable.filter((row) => row.shared);
  const coverage = observable.length / totalDays;
  const required = Math.max(2, Math.ceil(observable.length * 0.6));
  return {
    shared: coverage >= 0.85 && shared.length >= required && moment.structuralProofRefs.length > 0,
    refs: unique([...shared.flatMap(({ evidenceRefs }) => evidenceRefs), ...moment.structuralProofRefs]),
  };
}

function resolutionFromStates(a: GlobalParticipationState, b: GlobalParticipationState): GlobalSharedResolution {
  if (a === "CONFLICT" || b === "CONFLICT") return "CONFLICT";
  if (a === "PRESENT" && b === "PRESENT") return "SHARED";
  if (a === "PRESENT" && b === "ABSENT") return "PERSON_A_ONLY";
  if (a === "ABSENT" && b === "PRESENT") return "PERSON_B_ONLY";
  if (a === "ABSENT" && b === "ABSENT") return "NEITHER";
  return "UNRESOLVED";
}

export class SharedParticipationResolver {
  resolve(input: GlobalSharedParticipationInput): GlobalSharedParticipationResult {
    if (!input.unitId || !input.universeId || input.personIds[0] === input.personIds[1] || input.personIds.some((id) => !id)) throw new TypeError("M10_SHARED_SCOPE_INVALID");
    const householdPeople = new Set(input.personIds), assertions = canonicalAssertions(input.assertions);
    if (assertions.some(({ personId }) => !householdPeople.has(personId))) throw new TypeError("M10_ASSERTION_OUTSIDE_SHARED_SCOPE");
    const roster = validateRoster(input.roster, householdPeople);
    let stateA = stateFor(input.personIds[0], assertions, roster), stateB = stateFor(input.personIds[1], assertions, roster);
    let level: GlobalSharedEvidenceLevel = "INSUFFICIENT", inferred = false, sharedPlaceId: string | undefined, overlap: number | undefined;
    let inferenceRefs: readonly string[] = [];
    let resolution = resolutionFromStates(stateA, stateB);
    if (resolution === "SHARED") {
      const rosterExplicit = roster !== undefined && input.personIds.every((personId) => roster.participantPersonIds.includes(personId));
      level = rosterExplicit || input.personIds.every((personId) => assertions.some((row) => row.personId === personId && row.state === "PRESENT" && row.authority === "EXPLICIT")) ? "EXPLICIT_SHARED" : "CANONICAL_SHARED";
    } else if (resolution !== "CONFLICT") {
      const moment = inferMultidayMoment(input);
      const mode = activityMode(input.activityType);
      const copresence = resolveCopresence(input);
      const canInferActivity = input.grain === "VISIT"
        || input.grain === "OCCURRENCE" && mode === "COPRESENCE_ALLOWED"
        || input.grain === "MOMENT" && input.moment?.inferenceAllowed === true;
      const strongPositive = moment.shared || canInferActivity && copresence.level === "STRONG_COPRESENCE";
      if (strongPositive && (stateA === "ABSENT" || stateB === "ABSENT")) {
        resolution = "CONFLICT";
        level = "STRONG_COPRESENCE";
        inferenceRefs = moment.shared ? moment.refs : copresence.evidenceRefs;
        sharedPlaceId = copresence.placeId;
        overlap = copresence.overlapMinutes;
      } else if (strongPositive) {
        stateA = "PRESENT"; stateB = "PRESENT"; resolution = "SHARED"; level = "STRONG_COPRESENCE"; inferred = true;
        inferenceRefs = moment.shared ? moment.refs : copresence.evidenceRefs;
        sharedPlaceId = copresence.placeId; overlap = copresence.overlapMinutes;
      } else if (copresence.level === "CONTEXTUAL_ONLY" || mode === "EXPLICIT_ONLY" && copresence.level === "STRONG_COPRESENCE") {
        level = "CONTEXTUAL_ONLY"; sharedPlaceId = copresence.placeId; overlap = copresence.overlapMinutes; inferenceRefs = copresence.evidenceRefs;
      }
    }
    const knownExternal = roster?.externalParticipants.filter(({ kind }) => kind === "CANONICAL_CONTACT").map(({ ref }) => ref) ?? [];
    const unresolvedExternal = roster?.externalParticipants.filter(({ kind }) => kind === "UNRESOLVED_EXTERNAL").length ?? 0;
    const externalCount = knownExternal.length + unresolvedExternal;
    const exclusivity: GlobalSharedParticipationResult["exclusivity"] = roster?.completeness !== "EXHAUSTIVE" ? "UNKNOWN" : externalCount === 0 ? "PAIR_ONLY" : "WITH_EXTERNALS";
    const evidenceRefs = unique([...input.evidenceRefs, ...assertions.flatMap(({ evidenceRefs }) => evidenceRefs), ...(roster?.evidenceRefs ?? []), ...inferenceRefs]);
    if (input.economicContext !== undefined && Object.keys(input.economicContext.personalAttribution).some((personId) => !householdPeople.has(personId))) {
      throw new TypeError("M10_ECONOMIC_ATTRIBUTION_OUTSIDE_SHARED_SCOPE");
    }
    const normalizedEconomic = input.economicContext === undefined ? undefined : {
      ...input.economicContext,
      economicIdentityRefs: unique(input.economicContext.economicIdentityRefs),
    };
    const result = {
      unitId: input.unitId, universeId: input.universeId, grain: input.grain,
      personStates: { [input.personIds[0]]: stateA, [input.personIds[1]]: stateB },
      resolution, evidenceLevel: level, inferred,
      ...(inferred ? { inferencePolicyId: momentPolicy(input) } : {}),
      ...(sharedPlaceId === undefined ? {} : { sharedPlaceId }),
      ...(overlap === undefined ? {} : { overlapMinutes: overlap }),
      exclusivity, knownExternalParticipantRefs: unique(knownExternal), unresolvedExternalParticipantCount: unresolvedExternal,
      evidenceRefs,
      ...(normalizedEconomic === undefined ? {} : { economicContext: normalizedEconomic }),
    };
    return { ...result, inputHash: digest({ input: result, policies: globalSharedPolicies }) };
  }
}

function momentPolicy(input: GlobalSharedParticipationInput): string {
  return input.moment !== undefined ? globalSharedPolicies.multidayMoment : globalSharedPolicies.copresence;
}

export type GlobalSharedObservableSupport = {
  readonly universeId: string;
  readonly grain: GlobalSharedUnitGrain;
  readonly eligibleUnits: number;
  readonly resolvedUnits: number;
  readonly unresolvedUnits: number;
  readonly conflictUnits: number;
  readonly sharedUnits: number;
  readonly personAOnlyUnits: number;
  readonly personBOnlyUnits: number;
  readonly neitherUnits: number;
  readonly sharedObservableCoverage: number | null;
  readonly sharedRate: number | null;
  readonly support: GlobalSupport;
  readonly knowledgeState: "KNOWN" | "PARTIAL" | "UNKNOWN" | "CONFLICT";
  readonly evidencePolicyVersion: string;
};

function supportThreshold(grain: GlobalSharedUnitGrain, resolved: number): GlobalSupport["supportStatus"] {
  if (grain === "OCCURRENCE") return resolved >= 20 ? "STRONG" : resolved >= 10 ? "SUFFICIENT" : resolved >= 6 ? "PARTIAL_SUPPORT" : "INSUFFICIENT";
  if (grain === "MOMENT") return resolved >= 8 ? "STRONG" : resolved >= 5 ? "SUFFICIENT" : resolved >= 3 ? "PARTIAL_SUPPORT" : "INSUFFICIENT";
  if (grain === "VISIT" || grain === "MOBILITY_LEG") return resolved >= 8 ? "SUFFICIENT" : resolved >= 5 ? "PARTIAL_SUPPORT" : "INSUFFICIENT";
  return resolved >= 15 ? "SUFFICIENT" : "INSUFFICIENT";
}

function minimumFor(grain: GlobalSharedUnitGrain): number {
  return grain === "OCCURRENCE" ? 10 : grain === "MOMENT" ? 5 : grain === "VISIT" || grain === "MOBILITY_LEG" ? 8 : 15;
}

export function buildGlobalSharedObservableSupport(input: {
  readonly universeId: string;
  readonly grain: GlobalSharedUnitGrain;
  readonly units: readonly GlobalSharedParticipationResult[];
}): GlobalSharedObservableSupport {
  const units = input.units.filter((unit) => unit.universeId === input.universeId && unit.grain === input.grain);
  const ids = new Set<string>();
  for (const unit of units) {
    if (ids.has(unit.unitId)) throw new TypeError("M10_DUPLICATE_SUPPORT_UNIT");
    ids.add(unit.unitId);
  }
  const conflict = units.filter(({ resolution }) => resolution === "CONFLICT").length;
  const resolved = units.filter(({ resolution }) => ["SHARED", "PERSON_A_ONLY", "PERSON_B_ONLY", "NEITHER"].includes(resolution));
  const shared = resolved.filter(({ resolution }) => resolution === "SHARED").length;
  const eligible = units.length, coverage = eligible === 0 ? null : resolved.length / eligible, rate = resolved.length === 0 ? null : shared / resolved.length;
  const supportStatus = supportThreshold(input.grain, resolved.length);
  const support = parseGlobalSupport({
    naturalGrain: input.grain === "MOBILITY_LEG" ? "OCCURRENCE" : input.grain,
    eligibleUnits: eligible, observedUnits: eligible, includedUnits: resolved.length,
    excludedObservedUnits: eligible - resolved.length, minimumRequired: minimumFor(input.grain), supportStatus,
    policyRef: globalSharedPolicies.support,
  });
  const knowledgeState = conflict > 0 ? "CONFLICT" : coverage === null || coverage < 0.6 || supportStatus === "INSUFFICIENT" ? "UNKNOWN" : coverage < 0.85 || supportStatus === "PARTIAL_SUPPORT" ? "PARTIAL" : "KNOWN";
  return {
    universeId: input.universeId, grain: input.grain, eligibleUnits: eligible, resolvedUnits: resolved.length,
    unresolvedUnits: units.filter(({ resolution }) => resolution === "UNRESOLVED").length,
    conflictUnits: conflict, sharedUnits: shared,
    personAOnlyUnits: resolved.filter(({ resolution }) => resolution === "PERSON_A_ONLY").length,
    personBOnlyUnits: resolved.filter(({ resolution }) => resolution === "PERSON_B_ONLY").length,
    neitherUnits: resolved.filter(({ resolution }) => resolution === "NEITHER").length,
    sharedObservableCoverage: coverage, sharedRate: rate, support, knowledgeState,
    evidencePolicyVersion: globalSharedPolicies.evidence,
  };
}

export type GlobalSharedUniverseResult = {
  readonly universeId: string;
  readonly grain: GlobalSharedUnitGrain;
  readonly support: GlobalSharedObservableSupport;
  readonly sharedUnits: readonly GlobalSharedParticipationResult[];
  readonly sharedOccurrenceRate?: number;
};

export function buildGlobalSharedAnalysis(units: readonly GlobalSharedParticipationResult[]): readonly GlobalSharedUniverseResult[] {
  const groups = new Map<string, GlobalSharedParticipationResult[]>();
  for (const unit of units) groups.set(`${unit.universeId}\u0000${unit.grain}`, [...(groups.get(`${unit.universeId}\u0000${unit.grain}`) ?? []), unit]);
  return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, values]) => {
    const first = values[0]!, support = buildGlobalSharedObservableSupport({ universeId: first.universeId, grain: first.grain, units: values });
    return {
      universeId: first.universeId, grain: first.grain, support,
      sharedUnits: values.filter(({ resolution }) => resolution === "SHARED").sort((a, b) => a.unitId.localeCompare(b.unitId)),
      ...(support.sharedRate === null ? {} : { sharedOccurrenceRate: support.sharedRate }),
    };
  });
}

export function projectSharedPlaceVisits(input: {
  readonly personIds: readonly [string, string];
  readonly visits: readonly GlobalSharedVisitEvidence[];
  readonly places: readonly GlobalSharedPlaceNode[];
  readonly universeId: string;
}): readonly GlobalSharedParticipationResult[] {
  const resolver = new SharedParticipationResolver(), pairs: GlobalSharedParticipationResult[] = [];
  const [personA, personB] = input.personIds;
  for (const a of input.visits.filter(({ fact }) => String(fact.personId) === personA)) for (const b of input.visits.filter(({ fact }) => String(fact.personId) === personB)) {
    const unitId = `shared-visit:${[String(a.fact.visitKey), String(b.fact.visitKey)].sort().join(":")}`;
    const result = resolver.resolve({ unitId, universeId: input.universeId, grain: "VISIT", personIds: input.personIds, assertions: [], visits: [a, b], places: input.places, evidenceRefs: [] });
    if (result.evidenceLevel === "STRONG_COPRESENCE" || result.evidenceLevel === "CONTEXTUAL_ONLY") pairs.push(result);
  }
  return pairs.sort((a, b) => a.unitId.localeCompare(b.unitId));
}

export function computeGlobalSharedInputHash(value: unknown): string {
  return digest(value);
}
