import { canonicalSerializeGlobal } from "../../core/global-v2";
import { parseMethodVersion } from "../../core/versions";
import { applyPersonaDeclarations } from "./persona-declarations";
import {
  PERSONA_SIGNAL_CONTRACT_VERSION,
  type DeclaredSignal,
  type NeedSignal,
  type PersonaAuthority,
  type PersonaClaimDimension,
  type PersonaKnowledgeStatus,
  type PersonaMetrics,
  type PersonaProfile,
  type PersonaProfileOutput,
  type PersonaSignal,
  type PersonaTemporalStatus,
  type PersonaTrait,
  type PersonaTraitCandidate,
  type PersonaTraitKind,
  type RoutineSignal,
} from "./persona-signals";
import type { GlobalPersonaFamily } from "./persona";

export const GLOBAL_PERSONA_PROFILE_METHOD_VERSION = parseMethodVersion("global_persona_profile@v1");

const authorityRank: Readonly<Record<PersonaAuthority, number>> = {
  USER_VALIDATED: 4,
  CANONICAL_DB: 3,
  OBSERVED: 2,
  DERIVED: 1,
};

const knowledgeRank: Readonly<Record<PersonaKnowledgeStatus, number>> = {
  USER_VALIDATED: 4,
  OBSERVED: 3,
  DERIVED: 2,
  TO_CONFIRM: 1,
};

const kindRank: Readonly<Record<PersonaTraitKind, number>> = {
  HOUSEHOLD_ORGANIZATION: 6,
  MOBILITY: 5,
  PROJECT: 4,
  UNIVERSE: 3,
  ROUTINE: 2,
  HABIT: 1,
};

function unique(values: readonly string[]): readonly string[] {
  return [...new Set(values)].sort();
}

function subjectKey(value: PersonaTraitCandidate["subject"] | PersonaSignal["subject"]): string {
  if (value.kind === "PERSON") return `PERSON:${value.personId}`;
  if (value.kind === "HOUSEHOLD") return `HOUSEHOLD:${value.householdId ?? "UNBOUND"}`;
  return `SHARED:${[...(value.personIds ?? [])].sort().join(":") || "UNBOUND"}`;
}

function defaultDimension(signal: PersonaSignal): PersonaClaimDimension {
  if (signal.dimension !== undefined) return signal.dimension;
  if (signal.signalType === "PERSONAL_COST") return "FINANCE";
  if (signal.signalType === "SHARED_ACTIVITY") return "PARTICIPATION";
  if (signal.signalType === "MOBILITY" || signal.signalType === "PRODUCT_CYCLE") return "USAGE";
  if (signal.signalType === "ROUTINE") return signal.kind === "HOUSEHOLD_ORGANIZATION" ? "ORGANIZATION" : "USAGE";
  return "GENERAL";
}

function defaultKind(signal: PersonaSignal): PersonaTraitKind | undefined {
  if (signal.kind !== undefined) return signal.kind;
  if (signal.signalType === "ROUTINE") return "ROUTINE";
  if (signal.signalType === "PRODUCT_CYCLE") return "HABIT";
  if (signal.signalType === "MOBILITY") return "MOBILITY";
  if (signal.signalType === "MOMENT" && signal.temporalStatus === "PROJECT") return "PROJECT";
  return undefined;
}

function defaultFamily(signal: PersonaSignal, kind: PersonaTraitKind | undefined): GlobalPersonaFamily | undefined {
  if (signal.family !== undefined) return signal.family;
  if (signal.signalType === "PRODUCT_CYCLE") return "PRODUCTS_AND_CONSUMPTION";
  if (signal.signalType === "MOBILITY" || kind === "MOBILITY") return "MOBILITY";
  if (signal.signalType === "ROUTINE") return "WORK_AND_DAY_CONTEXT";
  if (kind === "PROJECT") return "LEISURE_AND_ACTIVITIES";
  return undefined;
}

function signalIsEligible(signal: PersonaSignal, kind: PersonaTraitKind | undefined, family: GlobalPersonaFamily | undefined): boolean {
  if (signal.signalType === "DECLARED" || kind === undefined || family === undefined) return false;
  if (signal.signalType === "PERSONAL_COST") {
    return signal.subject.kind === "PERSON"
      && (signal.beneficiaryPersonId === signal.subject.personId || signal.authority === "USER_VALIDATED");
  }
  if (signal.signalType === "NEED") return signal.active !== false;
  if (signal.signalType === "ROUTINE") {
    if (kind === "HOUSEHOLD_ORGANIZATION" && signal.scope === "PERSONAL") return false;
    return signal.pattern !== undefined && signal.pattern.length > 0 || signal.context !== undefined;
  }
  if (signal.signalType === "PRODUCT_CYCLE") {
    const occurrences = signal.metrics?.occurrenceCount;
    return typeof occurrences === "number" && occurrences >= 2
      || signal.referenceChanged === true
      || signal.temporalStatus === "CHANGED";
  }
  if (signal.signalType === "MOMENT") return signal.momentRef !== undefined || kind === "PROJECT";
  if (signal.signalType === "MOBILITY") return signal.mode !== undefined || signal.context !== undefined || signal.vehicleRef !== undefined;
  return signal.kind !== undefined;
}

function signalMetrics(signal: PersonaSignal): PersonaMetrics | undefined {
  const values: Record<string, string | number> = { ...(signal.metrics ?? {}) };
  if (signal.signalType === "PERSONAL_COST") {
    if (signal.observedAmount !== undefined) values.observedAmount = signal.observedAmount;
    if (signal.typicalAmount !== undefined) values.typicalAmount = signal.typicalAmount;
  }
  return Object.keys(values).length === 0 ? undefined : values;
}

function signalLimitations(signal: PersonaSignal): readonly string[] {
  const limitations = [...(signal.limitations ?? [])];
  if (signal.signalType === "MOBILITY") {
    if (signal.metrics?.distance === undefined && signal.metrics?.distanceKm === undefined) limitations.push("DISTANCE_UNKNOWN");
    if (signal.metrics?.fuelCost === undefined && signal.metrics?.fuelCostAmount === undefined) limitations.push("FUEL_COST_UNKNOWN");
  }
  return unique(limitations);
}

function candidateFromSignal(signal: PersonaSignal): PersonaTraitCandidate | undefined {
  const kind = defaultKind(signal);
  const family = defaultFamily(signal, kind);
  if (!signalIsEligible(signal, kind, family) || kind === undefined || family === undefined) return undefined;
  const authority = signal.authority;
  const authorities = authority === undefined ? [] : [authority];
  const knowledgeStatus = signal.knowledgeStatus
    ?? (authority === "USER_VALIDATED" ? "USER_VALIDATED" : authority === "CANONICAL_DB" || authority === "OBSERVED" ? "OBSERVED" : "DERIVED");
  return {
    candidateId: `persona-candidate:${signal.scope}:${subjectKey(signal.subject)}:${signal.semanticKey}:${signal.signalId}`,
    subject: signal.subject,
    scope: signal.scope,
    kind,
    family,
    semanticKey: signal.semanticKey,
    ...(authority === undefined ? {} : { authority }),
    ...(authorities.length === 0 ? {} : { authorities }),
    knowledgeStatus,
    ...(signal.temporalStatus === undefined ? {} : { temporalStatus: signal.temporalStatus }),
    dimensions: [defaultDimension(signal)],
    ...(signal.context === undefined ? {} : { context: signal.context }),
    ...(signal.validFrom === undefined ? {} : { validFrom: signal.validFrom }),
    ...(signal.validTo === undefined ? {} : { validTo: signal.validTo }),
    signalRefs: [signal.signalId],
    evidenceRefs: unique(signal.evidenceRefs ?? []),
    sourceModules: [signal.sourceModule ?? signal.signalType],
    limitations: signalLimitations(signal),
    ...(signalMetrics(signal) === undefined ? {} : { metrics: signalMetrics(signal) }),
    ...(signal.groupKey === undefined ? {} : { groupKey: signal.groupKey }),
  } as PersonaTraitCandidate;
}

function householdOrganizationCandidates(signals: readonly PersonaSignal[]): readonly PersonaTraitCandidate[] {
  const needs = signals.filter((signal): signal is NeedSignal => signal.signalType === "NEED" && signal.scope === "HOUSEHOLD" && signal.kind === "HOUSEHOLD_ORGANIZATION");
  const routines = signals.filter((signal): signal is RoutineSignal => signal.signalType === "ROUTINE" && signal.scope === "PERSONAL" && signal.kind === "HOUSEHOLD_ORGANIZATION");
  return needs.flatMap((need) => {
    const matching = routines.filter((routine) => routine.semanticKey === need.semanticKey || need.groupKey !== undefined && routine.groupKey === need.groupKey);
    const people = new Set(matching.flatMap((routine) => routine.subject.kind === "PERSON" ? [routine.subject.personId] : []));
    if (people.size < 2 || need.family === undefined) return [];
    const allSignals: readonly PersonaSignal[] = [need, ...matching];
    return [{
      candidateId: `persona-candidate:${need.scope}:${subjectKey(need.subject)}:${need.semanticKey}:household-composition`,
      subject: need.subject,
      scope: need.scope,
      kind: "HOUSEHOLD_ORGANIZATION",
      family: need.family,
      semanticKey: need.semanticKey,
      authority: need.authority,
      authorities: unique(allSignals.flatMap((signal) => signal.authority === undefined ? [] : [signal.authority])) as readonly PersonaAuthority[],
      knowledgeStatus: "DERIVED",
      dimensions: ["ORGANIZATION"],
      signalRefs: unique(allSignals.map(({ signalId }) => signalId)),
      evidenceRefs: unique(allSignals.flatMap(({ evidenceRefs }) => evidenceRefs ?? [])),
      sourceModules: unique(allSignals.map((signal) => signal.sourceModule ?? signal.signalType)),
      limitations: unique(allSignals.flatMap(({ limitations }) => limitations ?? [])),
      qualifications: unique(matching.flatMap((routine) => routine.pattern === undefined ? routine.context === undefined ? [] : [routine.context] : [routine.pattern.join(" → ")])),
      ...(need.groupKey === undefined ? {} : { groupKey: need.groupKey }),
    } as PersonaTraitCandidate];
  });
}

export function generatePersonaCandidates(signals: readonly PersonaSignal[]): readonly PersonaTraitCandidate[] {
  return [
    ...signals.map(candidateFromSignal).filter((candidate): candidate is PersonaTraitCandidate => candidate !== undefined),
    ...householdOrganizationCandidates(signals),
  ].sort((a, b) => a.candidateId.localeCompare(b.candidateId));
}

function contextsCompatible(left: PersonaTraitCandidate, right: PersonaTraitCandidate): boolean {
  return left.context === undefined || right.context === undefined || left.context === right.context;
}

function periodsCompatible(left: PersonaTraitCandidate, right: PersonaTraitCandidate): boolean {
  if (left.validFrom !== undefined && right.validTo !== undefined && left.validFrom > right.validTo) return false;
  if (right.validFrom !== undefined && left.validTo !== undefined && right.validFrom > left.validTo) return false;
  return true;
}

function temporalStatusesCompatible(left: PersonaTemporalStatus | undefined, right: PersonaTemporalStatus | undefined): boolean {
  if (left === undefined || right === undefined || left === right || left === "UNKNOWN" || right === "UNKNOWN") return true;
  return left === "CHANGED" && (right === "STABLE" || right === "HISTORICAL")
    || right === "CHANGED" && (left === "STABLE" || left === "HISTORICAL");
}

function canMerge(left: PersonaTraitCandidate, right: PersonaTraitCandidate): boolean {
  return left.scope === right.scope
    && subjectKey(left.subject) === subjectKey(right.subject)
    && left.semanticKey === right.semanticKey
    && left.family === right.family
    && contextsCompatible(left, right)
    && periodsCompatible(left, right)
    && temporalStatusesCompatible(left.temporalStatus, right.temporalStatus);
}

function mergeTemporalStatus(values: readonly (PersonaTemporalStatus | undefined)[]): PersonaTemporalStatus | undefined {
  const known = [...new Set(values.filter((value): value is PersonaTemporalStatus => value !== undefined && value !== "UNKNOWN"))];
  if (known.includes("CHANGED")) return "CHANGED";
  if (known.includes("PROJECT")) return "PROJECT";
  if (known.length === 1) return known[0];
  return known.length === 0 && values.includes("UNKNOWN") ? "UNKNOWN" : undefined;
}

function mergeMetrics(left: PersonaMetrics | undefined, right: PersonaMetrics | undefined): {
  readonly metrics?: PersonaMetrics;
  readonly conflicts: readonly string[];
} {
  const keys = unique([...Object.keys(left ?? {}), ...Object.keys(right ?? {})]);
  const result: Record<string, string | number> = {};
  const conflicts: string[] = [];
  for (const key of keys) {
    const a = left?.[key], b = right?.[key];
    if (a === undefined) result[key] = b!;
    else if (b === undefined || a === b) result[key] = a;
    else conflicts.push(key);
  }
  return { ...(Object.keys(result).length === 0 ? {} : { metrics: result }), conflicts };
}

function strongestAuthority(values: readonly PersonaAuthority[]): PersonaAuthority | undefined {
  return [...values].sort((a, b) => authorityRank[b] - authorityRank[a] || a.localeCompare(b))[0];
}

function strongestKnowledge(values: readonly PersonaKnowledgeStatus[]): PersonaKnowledgeStatus | undefined {
  return [...values].sort((a, b) => knowledgeRank[b] - knowledgeRank[a] || a.localeCompare(b))[0];
}

function mergeTwo(left: PersonaTraitCandidate, right: PersonaTraitCandidate): PersonaTraitCandidate {
  const authorities = unique([
    ...(left.authorities ?? (left.authority === undefined ? [] : [left.authority])),
    ...(right.authorities ?? (right.authority === undefined ? [] : [right.authority])),
  ]) as readonly PersonaAuthority[];
  const dimensions = unique([...(left.dimensions ?? []), ...(right.dimensions ?? [])]) as readonly PersonaClaimDimension[];
  const mergedMetrics = mergeMetrics(left.metrics, right.metrics);
  const sameDimension = dimensions.some((dimension) => left.dimensions?.includes(dimension) === true && right.dimensions?.includes(dimension) === true);
  const groupKey = left.groupKey === right.groupKey ? left.groupKey : left.groupKey ?? right.groupKey;
  const groupConflict = left.groupKey !== undefined && right.groupKey !== undefined && left.groupKey !== right.groupKey;
  const temporalStatus = mergeTemporalStatus([left.temporalStatus, right.temporalStatus]);
  const context = left.context ?? right.context;
  const validFrom = left.validFrom === undefined || right.validFrom === undefined
    ? undefined
    : [left.validFrom, right.validFrom].sort()[0];
  const validTo = left.validTo === undefined || right.validTo === undefined
    ? undefined
    : [left.validTo, right.validTo].sort().at(-1);
  const limitations = unique([
    ...(left.limitations ?? []),
    ...(right.limitations ?? []),
    ...mergedMetrics.conflicts.map((key) => `METRIC_CONFLICT:${key}`),
    ...(groupConflict ? ["GROUP_KEY_CONFLICT"] : []),
  ]);
  const knowledge = sameDimension && mergedMetrics.conflicts.length > 0
    ? "TO_CONFIRM"
    : strongestKnowledge([left.knowledgeStatus, right.knowledgeStatus].filter((value): value is PersonaKnowledgeStatus => value !== undefined));
  const kind = [left.kind, right.kind].sort((a, b) => kindRank[b] - kindRank[a] || a.localeCompare(b))[0]!;
  const identity = `${left.scope}:${subjectKey(left.subject)}:${left.semanticKey}:${context ?? "ANY"}:${validFrom ?? "OPEN"}:${validTo ?? "OPEN"}:${temporalStatus ?? "ANY"}`;
  return {
    candidateId: `persona-candidate:${identity}`,
    subject: left.subject,
    scope: left.scope,
    kind,
    family: left.family,
    semanticKey: left.semanticKey,
    authority: strongestAuthority(authorities),
    authorities,
    ...(knowledge === undefined ? {} : { knowledgeStatus: knowledge }),
    ...(temporalStatus === undefined ? {} : { temporalStatus }),
    dimensions,
    ...(context === undefined ? {} : { context }),
    ...(validFrom === undefined ? {} : { validFrom }),
    ...(validTo === undefined ? {} : { validTo }),
    signalRefs: unique([...(left.signalRefs ?? []), ...(right.signalRefs ?? [])]),
    evidenceRefs: unique([...(left.evidenceRefs ?? []), ...(right.evidenceRefs ?? [])]),
    sourceModules: unique([...(left.sourceModules ?? []), ...(right.sourceModules ?? [])]),
    limitations,
    qualifications: unique([...(left.qualifications ?? []), ...(right.qualifications ?? [])]),
    ...(mergedMetrics.metrics === undefined ? {} : { metrics: mergedMetrics.metrics }),
    ...(groupKey === undefined || groupConflict ? {} : { groupKey }),
  } as PersonaTraitCandidate;
}

export function mergePersonaCandidates(candidates: readonly PersonaTraitCandidate[]): readonly PersonaTraitCandidate[] {
  const uniqueCandidates = new Map<string, PersonaTraitCandidate>();
  for (const candidate of candidates) {
    const previous = uniqueCandidates.get(candidate.candidateId);
    if (previous !== undefined && canonicalSerializeGlobal(previous) !== canonicalSerializeGlobal(candidate)) {
      throw new TypeError(`PERSONA_CONTRADICTORY_CANDIDATE:${candidate.candidateId}`);
    }
    uniqueCandidates.set(candidate.candidateId, candidate);
  }
  const merged: PersonaTraitCandidate[] = [];
  for (const candidate of [...uniqueCandidates.values()].sort((a, b) => a.candidateId.localeCompare(b.candidateId))) {
    const index = merged.findIndex((current) => canMerge(current, candidate));
    if (index === -1) merged.push(candidate);
    else merged[index] = mergeTwo(merged[index]!, candidate);
  }
  return merged.sort((a, b) => a.candidateId.localeCompare(b.candidateId));
}

export function buildPersonaTraits(candidates: readonly PersonaTraitCandidate[]): readonly PersonaTrait[] {
  return candidates.map((candidate) => {
    const { candidateId: _candidateId, ...fields } = candidate;
    return {
      ...fields,
      traitId: `persona-trait:${candidate.scope}:${subjectKey(candidate.subject)}:${candidate.semanticKey}:${candidate.context ?? "ANY"}`,
    } as PersonaTrait;
  }).sort((a, b) => a.traitId.localeCompare(b.traitId));
}

function profileKey(trait: PersonaTrait): string {
  return `${trait.scope}:${subjectKey(trait.subject)}`;
}

export function buildPersonaProfile(input: {
  readonly signals: readonly PersonaSignal[];
}): PersonaProfileOutput {
  const declarations = input.signals.filter((signal): signal is DeclaredSignal => signal.signalType === "DECLARED");
  const generated = generatePersonaCandidates(input.signals);
  const merged = mergePersonaCandidates(generated);
  const declared = applyPersonaDeclarations({ candidates: merged, declarations });
  const allTraits = buildPersonaTraits(mergePersonaCandidates(declared));
  const groups = new Map<string, PersonaTrait[]>();
  for (const trait of allTraits) groups.set(profileKey(trait), [...(groups.get(profileKey(trait)) ?? []), trait]);
  const profiles: PersonaProfile[] = [...groups.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, traits]) => ({
    subject: traits[0]!.subject,
    scope: traits[0]!.scope,
    allTraits: traits,
    featuredTraits: [],
    limitations: unique(traits.flatMap(({ limitations }) => limitations ?? [])),
  } as PersonaProfile));
  return {
    contractVersion: PERSONA_SIGNAL_CONTRACT_VERSION,
    methodVersion: GLOBAL_PERSONA_PROFILE_METHOD_VERSION,
    profiles,
    limitations: unique(profiles.flatMap(({ limitations }) => limitations ?? [])),
  };
}
