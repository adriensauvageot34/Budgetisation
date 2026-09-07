import { Temporal } from "@js-temporal/polyfill";
import Big from "big.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex, utf8ToBytes } from "@noble/hashes/utils.js";
import type {
  ActivityOccurrenceCostFact,
  ActivityOccurrenceFact,
  PersonDayFact,
  PlaceVisitFact,
} from "../facts";
import {
  canonicalSerializeGlobal,
  parseGlobalDayPartKey,
  type GlobalSupport,
  type GlobalDayPartKey,
} from "../../core/global-v2";
import { addMoney, parseMoney, type Money } from "../../core/money";
import { parseLocalDate, parseYearMonth, type LocalDate, type YearMonth } from "../../core/time";
import { medianMoney } from "../references";
import { projectGlobalTemporalRate } from "./temporal-projection";
import { buildGlobalTransformations, type GlobalTransformationSeries } from "./transformations";
import type { GlobalMaterialityCandidate } from "../../core/global-v2";
import type { GlobalMaterialityPolicyId } from "./materiality";

export const GLOBAL_M4_METHOD_VERSION = "global_routine_pattern@v1" as const;

export const globalRoutinePatternPolicy = Object.freeze({
  version: "global-routine-pattern@v1",
  unit: "DAY_ROUTINE",
  corePrevalence: 0.8,
  optionalPrevalence: 0.4,
  minimumCoreTokens: 3,
  partialSupportMinimum: 3,
  sufficientSupportMinimum: 5,
  publishablePrevalence: 0.2,
  strongOccurrenceMinimum: 10,
  strongPrevalence: 0.35,
  timeSensitivePrevalence: 0.8,
  causalCostIndicativeMinimum: 4,
  causalCostSufficientMinimum: 7,
});

const digest = (value: unknown) => bytesToHex(sha256(utf8ToBytes(canonicalSerializeGlobal(value))));
const dateDistance = (left: LocalDate, right: LocalDate) => Temporal.PlainDate.from(left).until(Temporal.PlainDate.from(right), { largestUnit: "day" }).days;
const median = (values: readonly string[]) => medianMoney(values.map(parseMoney));

function assertNoUndefined(value: object, label: string): void {
  if (Object.values(value).some((entry) => entry === undefined)) {
    throw new TypeError(`${label}: une propriété absente ne doit pas porter undefined.`);
  }
}

function assertUniqueConsistent<T>(values: readonly T[], identity: (value: T) => string, label: string): readonly T[] {
  const unique = new Map<string, T>();
  for (const value of values) {
    const key = identity(value);
    const previous = unique.get(key);
    if (previous !== undefined && canonicalSerializeGlobal(previous) !== canonicalSerializeGlobal(value)) {
      throw new TypeError(`${label}: identité contradictoire ${key}.`);
    }
    unique.set(key, value);
  }
  return [...unique.values()];
}

export function buildGlobalActivityRhythm(input: {
  readonly activityId: string;
  readonly personId: string;
  readonly occurrences: readonly ActivityOccurrenceFact[];
  readonly personDays: readonly PersonDayFact[];
}) {
  if (!input.activityId || !input.personId) throw new TypeError("Activity/person identity required.");
  const occurrences = assertUniqueConsistent(input.occurrences, (fact) => String(fact.lifeEventId), "ActivityOccurrenceFact")
    .filter((fact) => String(fact.activityId) === input.activityId && fact.participantIds.some((id) => String(id) === input.personId))
    .sort((a, b) => a.startDate.localeCompare(b.startDate) || String(a.lifeEventId).localeCompare(String(b.lifeEventId)));
  const days = assertUniqueConsistent(input.personDays, (fact) => `${fact.personId}:${fact.localDate}`, "PersonDayFact")
    .filter((fact) => String(fact.personId) === input.personId)
    .sort((a, b) => a.localDate.localeCompare(b.localDate));
  if ([...occurrences, ...days].some((fact) => String(fact.householdId) !== String((occurrences[0] ?? days[0])?.householdId))) {
    throw new TypeError("M4 ne mélange pas plusieurs Households.");
  }
  // Existence of a scoped PersonDay is the activity exposure. Its
  // locationObservability qualifies geography only and must not erase an
  // otherwise proven activity opportunity.
  const observableDates = new Set(days.map((day) => day.localDate));
  const included = occurrences.filter((occurrence) => observableDates.has(occurrence.startDate));
  const gaps = days.slice(1).map((day, index) => Math.max(0, dateDistance(days[index].localDate, day.localDate) - 1)).filter((gap) => gap > 0);
  const gapCount = gaps.reduce((sum, gap) => sum + gap, 0);
  const occurrenceDates = occurrences.map((occurrence) => occurrence.startDate);
  const intervals = occurrenceDates.slice(1).map((date, index) => dateDistance(occurrenceDates[index], date));
  const cadence = intervals.length < 2
    ? { status: "UNKNOWN" as const, reasonCode: "INSUFFICIENT_OCCURRENCES_FOR_CADENCE" as const }
    : {
        status: "KNOWN" as const,
        intervalDays: intervals,
        medianIntervalDays: median(intervals.map(String)),
        medianAbsoluteDeviationDays: median(intervals.map((value) => String(Math.abs(value - Number(median(intervals.map(String))))))),
      };
  const months = [...new Set(days.map((day) => day.localDate.slice(0, 7) as YearMonth))].sort();
  const monthlyRates = months.map((month) => {
    const monthDays = days.filter((day) => day.localDate.startsWith(month));
    const observable = monthDays;
    const monthOccurrences = occurrences.filter((occurrence) => occurrence.startDate.startsWith(month));
    const includedMonthOccurrences = monthOccurrences.filter((occurrence) => observableDates.has(occurrence.startDate));
    return projectGlobalTemporalRate({
      month,
      numerator: String(includedMonthOccurrences.length),
      denominator: String(observable.length),
      sourceGrain: "ACTIVITY_OCCURRENCE",
      exposureUnit: "OBSERVABLE_DAY",
      sourceRefs: monthOccurrences.length === 0 ? [`activity:${input.activityId}:month:${month}:zero-observed-occurrence`] : monthOccurrences.map((fact) => `fct_activity_occurrence:${fact.lifeEventId}`),
      exposureRefs: observable.length === 0 ? [`person-day-exposure:${input.personId}:${month}:none`] : observable.map((fact) => `fct_person_day:${fact.personDayId}`),
      complete: monthDays.length > 0 && monthDays.slice(1).every((day, index) => dateDistance(monthDays[index].localDate, day.localDate) === 1) && includedMonthOccurrences.length === monthOccurrences.length,
      corpus: "CERTIFIED_HISTORY",
    });
  });
  const eligibleDays = observableDates.size;
  const rate = eligibleDays === 0
    ? { status: "UNKNOWN" as const, reasonCode: "PERSON_DAY_EXPOSURE_UNKNOWN" as const }
    : included.length === occurrences.length && gapCount === 0
      ? { status: "KNOWN" as const, value: new Big(included.length).div(eligibleDays).toFixed(), unit: "OCCURRENCE_PER_OBSERVABLE_DAY" as const }
      : { status: "PARTIAL" as const, value: new Big(included.length).div(eligibleDays).toFixed(), partialMeaning: "OBSERVED_ONLY" as const, reasonCode: "PERSON_DAY_EXPOSURE_PARTIAL" as const, unit: "OCCURRENCE_PER_OBSERVABLE_DAY" as const };
  const support: GlobalSupport = {
    naturalGrain: "PERSON_DAY",
    eligibleUnits: eligibleDays,
    observedUnits: days.length,
    includedUnits: included.length,
    excludedObservedUnits: 0,
    minimumRequired: 1,
    supportStatus: eligibleDays === 0 ? "INSUFFICIENT" : eligibleDays >= 30 ? "SUFFICIENT" : "PARTIAL_SUPPORT",
    occurrenceCount: occurrences.length,
    gapCount,
    ...(gaps.length === 0 ? {} : { largestGapUnits: Math.max(...gaps) }),
    policyRef: "global-activity-observable-exposure@v1",
  };
  const result = {
    activityId: input.activityId,
    personId: input.personId,
    rawOccurrenceCount: occurrences.length,
    includedOccurrenceCount: included.length,
    multiDayOccurrenceCount: occurrences.filter((fact) => fact.startDate !== fact.endDate).length,
    eligibleObservableDays: eligibleDays,
    rate,
    cadence,
    monthlyRates,
    support,
    dependencyRefs: [...new Set([
      ...occurrences.map((fact) => `fct_activity_occurrence:${fact.lifeEventId}`),
      ...days.map((fact) => `fct_person_day:${fact.personDayId}`),
      "policy:global-activity-observable-exposure@v1",
      `method:${GLOBAL_M4_METHOD_VERSION}`,
    ])].sort(),
    methodVersion: GLOBAL_M4_METHOD_VERSION,
  };
  return { ...result, inputHash: digest(result) };
}

export type GlobalRoutineTokenAuthority =
  | { readonly kind: "ACTIVITY_OCCURRENCE"; readonly factRef: string; readonly evidenceRefs: readonly string[] }
  | { readonly kind: "PERSON_DAY_CONTEXT"; readonly factRef: string; readonly evidenceRefs: readonly string[] }
  | { readonly kind: "MOMENT_MEMBERSHIP"; readonly factRef: string; readonly evidenceRefs: readonly string[] }
  | { readonly kind: "CANONICAL_PLACE_ROLE"; readonly factRef: string; readonly validFrom: LocalDate; readonly validTo?: LocalDate; readonly evidenceRefs: readonly string[] };

export type GlobalRoutineSemanticToken = {
  readonly semanticKey: string;
  readonly authority: GlobalRoutineTokenAuthority;
  readonly dayPart?: GlobalDayPartKey;
};

export type GlobalRoutineDay = {
  readonly personDayId: string;
  readonly personId: string;
  readonly localDate: LocalDate;
  readonly eligibilityContext: string;
  readonly observable: boolean;
  readonly tokens: readonly GlobalRoutineSemanticToken[];
  readonly sharedParticipantIds?: readonly string[];
  readonly sharedEvidenceRefs?: readonly string[];
};

export type GlobalRoutineElementAssertion = {
  readonly sequenceIndex: number;
  readonly evidenceRefs: readonly string[];
} & (
  | { readonly kind: "ACTIVITY"; readonly occurrenceId: string }
  | { readonly kind: "DAY_CONTEXT"; readonly semanticKey: string; readonly authorityRef: string }
  | { readonly kind: "MOMENT"; readonly momentId: string; readonly authorityRef: string }
  | { readonly kind: "PLACE_ROLE"; readonly visitKey: string; readonly semanticRole: string; readonly roleAssertionRef: string; readonly validFrom: LocalDate; readonly validTo?: LocalDate }
);

/** Fact-backed semantic projection. Date/place coincidence never creates an
 * Activity participation, a Place role, or any financial causality.
 */
export function projectGlobalRoutineDay(input: {
  readonly personDay: PersonDayFact;
  readonly occurrences: readonly ActivityOccurrenceFact[];
  readonly visits: readonly PlaceVisitFact[];
  readonly eligibilityContext: string;
  readonly elements: readonly GlobalRoutineElementAssertion[];
  readonly sharedParticipantIds?: readonly string[];
  readonly sharedEvidenceRefs?: readonly string[];
}): GlobalRoutineDay {
  if (!input.eligibilityContext || Object.values(input).some((value) => value === undefined)) throw new TypeError("Routine day projection requires absent optional properties to be omitted.");
  const occurrences = new Map(assertUniqueConsistent(input.occurrences, (fact) => String(fact.lifeEventId), "ActivityOccurrenceFact").map((fact) => [String(fact.lifeEventId), fact]));
  const visits = new Map(assertUniqueConsistent(input.visits, (fact) => String(fact.visitKey), "PlaceVisitFact").map((fact) => [String(fact.visitKey), fact]));
  const indexes = new Set<number>();
  const tokens = [...input.elements].sort((a, b) => a.sequenceIndex - b.sequenceIndex).map((element) => {
    assertNoUndefined(element, "GlobalRoutineElementAssertion");
    if (!Number.isSafeInteger(element.sequenceIndex) || element.sequenceIndex < 0 || indexes.has(element.sequenceIndex) || element.evidenceRefs.length === 0) throw new TypeError("Routine element requires a unique non-negative order and evidence.");
    indexes.add(element.sequenceIndex);
    if (element.kind === "ACTIVITY") {
      const fact = occurrences.get(element.occurrenceId);
      if (fact === undefined || String(fact.householdId) !== String(input.personDay.householdId) || fact.startDate !== input.personDay.localDate || !fact.participantIds.some((id) => String(id) === String(input.personDay.personId))) {
        throw new TypeError("Activity routine element requires explicit same-day participation; a multiday span is not repeated per day.");
      }
      if (input.sharedParticipantIds !== undefined && !input.sharedParticipantIds.every((personId) => fact.participantIds.some((id) => String(id) === personId))) {
        throw new TypeError("A shared Activity token requires explicit participation for every scoped person.");
      }
      return { semanticKey: `ACTIVITY:${fact.activityId}`, authority: { kind: "ACTIVITY_OCCURRENCE" as const, factRef: `fct_activity_occurrence:${fact.lifeEventId}`, evidenceRefs: element.evidenceRefs } };
    }
    if (element.kind === "PLACE_ROLE") {
      const fact = visits.get(element.visitKey);
      if (fact === undefined || String(fact.householdId) !== String(input.personDay.householdId) || String(fact.personId) !== String(input.personDay.personId) || fact.localDate !== input.personDay.localDate || String(fact.personDayId) !== String(input.personDay.personDayId) || !element.semanticRole || !element.roleAssertionRef) {
        throw new TypeError("Place routine element requires the scoped visit and a dated canonical role assertion.");
      }
      return { semanticKey: `PLACE_ROLE:${element.semanticRole}`, authority: { kind: "CANONICAL_PLACE_ROLE" as const, factRef: element.roleAssertionRef, validFrom: element.validFrom, ...(element.validTo === undefined ? {} : { validTo: element.validTo }), evidenceRefs: element.evidenceRefs } };
    }
    if (element.kind === "MOMENT") {
      if (!element.momentId || !element.authorityRef) throw new TypeError("Moment routine element requires explicit membership authority.");
      return { semanticKey: `MOMENT:${element.momentId}`, authority: { kind: "MOMENT_MEMBERSHIP" as const, factRef: element.authorityRef, evidenceRefs: element.evidenceRefs } };
    }
    if (!element.semanticKey || !element.authorityRef) throw new TypeError("Day context requires explicit semantic authority.");
    return { semanticKey: `DAY_CONTEXT:${element.semanticKey}`, authority: { kind: "PERSON_DAY_CONTEXT" as const, factRef: element.authorityRef, evidenceRefs: element.evidenceRefs } };
  });
  return normalizeRoutineDay({
    personDayId: String(input.personDay.personDayId),
    personId: String(input.personDay.personId),
    localDate: input.personDay.localDate,
    eligibilityContext: input.eligibilityContext,
    observable: true,
    tokens,
    ...(input.sharedParticipantIds === undefined ? {} : { sharedParticipantIds: [...new Set(input.sharedParticipantIds)].sort() }),
    ...(input.sharedEvidenceRefs === undefined ? {} : { sharedEvidenceRefs: [...new Set(input.sharedEvidenceRefs)].sort() }),
  });
}

function normalizeRoutineDay(day: GlobalRoutineDay): GlobalRoutineDay {
  assertNoUndefined(day, "GlobalRoutineDay");
  parseLocalDate(day.localDate);
  if (!day.personDayId || !day.personId || !day.eligibilityContext || !Array.isArray(day.tokens)) throw new TypeError("Routine day incomplete.");
  const tokens: GlobalRoutineSemanticToken[] = [];
  for (const token of day.tokens) {
    assertNoUndefined(token, "GlobalRoutineSemanticToken");
    assertNoUndefined(token.authority, "GlobalRoutineTokenAuthority");
    if (!token.semanticKey || token.semanticKey.includes("PLACE_LABEL:") || token.semanticKey.includes("MERCHANT:")) {
      throw new TypeError("Routine identity must use semantic tokens, never a place label or merchant.");
    }
    if (!token.authority.factRef || token.authority.evidenceRefs.length === 0 || token.authority.evidenceRefs.some((ref: string) => !ref)) {
      throw new TypeError("Routine token requires an explicit Fact authority and evidence.");
    }
    if (token.dayPart !== undefined) parseGlobalDayPartKey(token.dayPart);
    if (token.authority.kind === "CANONICAL_PLACE_ROLE") {
      parseLocalDate(token.authority.validFrom);
      if (token.authority.validTo !== undefined && (parseLocalDate(token.authority.validTo) < token.authority.validFrom || day.localDate > token.authority.validTo)) throw new TypeError("Place role validity is inconsistent.");
      if (day.localDate < token.authority.validFrom) throw new TypeError("Place role is not effective on the routine day.");
    }
    if (tokens.at(-1)?.semanticKey !== token.semanticKey) tokens.push(token);
  }
  return { ...day, tokens };
}

function lcs(left: readonly string[], right: readonly string[]): readonly string[] {
  const table = Array.from({ length: left.length + 1 }, () => Array<number>(right.length + 1).fill(0));
  for (let i = 1; i <= left.length; i += 1) for (let j = 1; j <= right.length; j += 1) {
    table[i][j] = left[i - 1] === right[j - 1] ? table[i - 1][j - 1] + 1 : Math.max(table[i - 1][j], table[i][j - 1]);
  }
  const result: string[] = [];
  for (let i = left.length, j = right.length; i > 0 && j > 0;) {
    if (left[i - 1] === right[j - 1]) { result.unshift(left[i - 1]); i -= 1; j -= 1; }
    else if (table[i - 1][j] >= table[i][j - 1]) i -= 1;
    else j -= 1;
  }
  return result;
}

function orderedSubsequence(sequence: readonly string[], candidate: readonly string[]): boolean {
  let index = 0;
  for (const token of sequence) if (token === candidate[index]) index += 1;
  return index === candidate.length;
}

export function discoverGlobalRoutinePatterns(input: {
  readonly scope: "PERSON" | "SHARED" | "HOUSEHOLD";
  readonly eligibilityContext: string;
  readonly days: readonly GlobalRoutineDay[];
}) {
  if (!input.eligibilityContext) throw new TypeError("Routine eligibility context required.");
  const days = assertUniqueConsistent(input.days.map(normalizeRoutineDay), (day) => day.personDayId, "Routine day")
    .filter((day) => day.eligibilityContext === input.eligibilityContext)
    .sort((a, b) => a.localDate.localeCompare(b.localDate) || a.personDayId.localeCompare(b.personDayId));
  if (input.scope === "SHARED" && days.some((day) => (day.sharedParticipantIds?.length ?? 0) < 2 || (day.sharedEvidenceRefs?.length ?? 0) === 0)) {
    throw new TypeError("A shared routine requires explicit participation evidence; common payment is insufficient.");
  }
  const eligibleDays = days.filter((day) => day.observable);
  const sequences = eligibleDays.map((day) => day.tokens.map((token) => token.semanticKey));
  const candidates = new Map<string, readonly string[]>();
  for (const sequence of sequences) if (sequence.length >= 3) candidates.set(sequence.join("\u001f"), sequence);
  for (let i = 0; i < sequences.length; i += 1) for (let j = i + 1; j < sequences.length; j += 1) {
    const common = lcs(sequences[i], sequences[j]);
    if (common.length >= globalRoutinePatternPolicy.minimumCoreTokens) candidates.set(common.join("\u001f"), common);
  }
  const qualified = [...candidates.values()].flatMap((seedCoreTokens) => {
    const seedMatching = eligibleDays.filter((_, index) => orderedSubsequence(sequences[index], seedCoreTokens));
    const seedTokenCounts = new Map<string, number>();
    for (const day of seedMatching) for (const token of new Set(day.tokens.map(({ semanticKey }) => semanticKey))) seedTokenCounts.set(token, (seedTokenCounts.get(token) ?? 0) + 1);
    const promoted = new Set([...seedTokenCounts].filter(([, count]) => count / seedMatching.length >= globalRoutinePatternPolicy.corePrevalence).map(([token]) => token));
    const representative = seedMatching.map((day) => day.tokens.map(({ semanticKey }) => semanticKey)).sort((a, b) => b.length - a.length || a.join("\u001f").localeCompare(b.join("\u001f")))[0] ?? seedCoreTokens;
    const coreTokens = representative.filter((token) => promoted.has(token));
    const matching = eligibleDays.filter((day) => orderedSubsequence(day.tokens.map(({ semanticKey }) => semanticKey), coreTokens));
    const occurrenceCount = matching.length;
    if (occurrenceCount < globalRoutinePatternPolicy.partialSupportMinimum) return [];
    const prevalence = eligibleDays.length === 0 ? 0 : occurrenceCount / eligibleDays.length;
    const tokenCounts = new Map<string, number>();
    for (const day of matching) for (const token of new Set(day.tokens.map(({ semanticKey }) => semanticKey))) tokenCounts.set(token, (tokenCounts.get(token) ?? 0) + 1);
    const optionalTokens = [...tokenCounts].filter(([token, count]) => !coreTokens.includes(token) && count / occurrenceCount >= globalRoutinePatternPolicy.optionalPrevalence && count / occurrenceCount < globalRoutinePatternPolicy.corePrevalence).map(([token]) => token).sort();
    const dayPartSignatures = matching.map((day) => day.tokens.flatMap((token) => token.dayPart === undefined ? [] : [token.dayPart]).join(","));
    const dayPartCounts = new Map<string, number>();
    for (const signature of dayPartSignatures.filter(Boolean)) dayPartCounts.set(signature, (dayPartCounts.get(signature) ?? 0) + 1);
    const typical = [...dayPartCounts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0];
    const timeSensitive = typical !== undefined && typical[1] / occurrenceCount >= globalRoutinePatternPolicy.timeSensitivePrevalence;
    const publishable = occurrenceCount >= 5 && prevalence >= 0.2;
    const strong = occurrenceCount >= 10 && prevalence >= 0.35;
    const supportStatus = strong ? "STRONG" as const : occurrenceCount >= 5 ? "SUFFICIENT" as const : "PARTIAL_SUPPORT" as const;
    const evidenceRefs = [...new Set(matching.flatMap((day) => day.tokens.flatMap((token) => token.authority.evidenceRefs)))].sort();
    const identity = { scope: input.scope, eligibilityContext: input.eligibilityContext, coreTokens, policy: globalRoutinePatternPolicy.version };
    const routineId = `routine:${digest(identity)}`;
    const evolution = [...new Set(eligibleDays.map((day) => day.localDate.slice(0, 7) as YearMonth))].sort().map((month) => {
      const monthEligible = eligibleDays.filter((day) => day.localDate.startsWith(month));
      const monthMatching = matching.filter((day) => day.localDate.startsWith(month));
      return projectGlobalTemporalRate({
        month,
        numerator: String(monthMatching.length),
        denominator: String(monthEligible.length),
        sourceGrain: "PERSON_DAY",
        exposureUnit: "OBSERVABLE_DAY",
        sourceRefs: monthMatching.length === 0 ? [`${routineId}:${month}:no-match`] : monthMatching.map((day) => `fct_person_day:${day.personDayId}:routine-match`),
        exposureRefs: monthEligible.map((day) => `fct_person_day:${day.personDayId}`),
        complete: monthEligible.length > 0 && monthEligible.slice(1).every((day, index) => dateDistance(monthEligible[index].localDate, day.localDate) === 1),
        corpus: "CERTIFIED_HISTORY",
      });
    });
    return [{
      routineId,
      scope: input.scope,
      eligibilityContext: input.eligibilityContext,
      coreTokens,
      optionalTokens,
      occurrenceCount,
      eligibleOpportunities: eligibleDays.length,
      prevalence,
      timeSensitive,
      ...(timeSensitive ? { typicalDayParts: typical[0].split(",") } : {}),
      support: {
        naturalGrain: "PERSON_DAY" as const,
        eligibleUnits: eligibleDays.length,
        observedUnits: days.length,
        includedUnits: occurrenceCount,
        excludedObservedUnits: days.length - eligibleDays.length,
        minimumRequired: 5,
        supportStatus,
        occurrenceCount,
        policyRef: globalRoutinePatternPolicy.version,
      },
      coverage: {
        dimensions: [{
          dimension: "PERSON_DAY" as const,
          status: days.length === 0 ? "UNKNOWN" as const : eligibleDays.length === days.length ? "KNOWN" as const : "PARTIAL" as const,
          ...(days.length === 0 ? {} : { numerator: eligibleDays.length, denominator: days.length, ratio: eligibleDays.length / days.length }),
          unit: "person-day",
          basis: "eligible-opportunities-over-observed-person-days",
          evidenceRefs,
          policyRef: "global-routine-observable-exposure@v1",
        }],
        requiredDimensions: ["PERSON_DAY" as const],
        ...(days.length === 0 ? {} : { effective: eligibleDays.length / days.length }),
        aggregation: "MIN_REQUIRED_DIMENSIONS" as const,
      },
      certificationStatus: publishable ? "CERTIFIED" as const : "HYPOTHESIS_ONLY" as const,
      strength: strong ? "STRONG" as const : publishable ? "ESTABLISHED" as const : "INDICATIVE" as const,
      matchingPersonDayIds: matching.map((day) => day.personDayId).sort(),
      evolution: { monthlyPrevalence: evolution },
      evidenceRefs,
      methodVersion: GLOBAL_M4_METHOD_VERSION,
    }];
  });
  const deduped = qualified.filter((candidate, index, all) => !all.some((other, otherIndex) => otherIndex !== index
    && canonicalSerializeGlobal(other.matchingPersonDayIds) === canonicalSerializeGlobal(candidate.matchingPersonDayIds)
    && other.coreTokens.length > candidate.coreTokens.length));
  const patterns = deduped.sort((a, b) => (b.certificationStatus === "CERTIFIED" ? 1 : 0) - (a.certificationStatus === "CERTIFIED" ? 1 : 0)
    || b.prevalence - a.prevalence || b.coreTokens.length - a.coreTokens.length || a.routineId.localeCompare(b.routineId));
  const result = { patterns, eligibleOpportunities: eligibleDays.length, methodVersion: GLOBAL_M4_METHOD_VERSION, policyVersion: globalRoutinePatternPolicy.version };
  return { ...result, inputHash: digest({ days, result }) };
}

export type GlobalRoutineInstance = {
  readonly routineId: string;
  readonly instanceId: string;
  readonly personDayId: string;
  readonly occurrenceIds: readonly string[];
};

export type GlobalDayEconomicCost = {
  readonly personDayId: string;
  readonly status: "KNOWN" | "PARTIAL" | "UNKNOWN" | "CONFLICT";
  readonly amount?: Money;
  readonly componentKeys: readonly string[];
  readonly evidenceRefs: readonly string[];
};

export function buildGlobalRoutineCosts(input: {
  readonly routineId: string;
  readonly instances: readonly GlobalRoutineInstance[];
  readonly activityCosts: readonly ActivityOccurrenceCostFact[];
  readonly dayCosts: readonly GlobalDayEconomicCost[];
  readonly monthlyFrequency?: string;
}) {
  if (Object.hasOwn(input, "monthlyFrequency") && input.monthlyFrequency === undefined) throw new TypeError("monthlyFrequency absent must be omitted.");
  const instances = assertUniqueConsistent(input.instances, (value) => value.instanceId, "Routine instance").filter((value) => value.routineId === input.routineId);
  const costs = new Map(assertUniqueConsistent(input.activityCosts, (fact) => String(fact.occurrenceId), "Activity occurrence cost").map((fact) => [String(fact.occurrenceId), fact]));
  const validatedDayCosts = assertUniqueConsistent(input.dayCosts, (value) => value.personDayId, "Day economic cost");
  for (const value of validatedDayCosts) assertNoUndefined(value, "GlobalDayEconomicCost");
  const dayCosts = new Map(validatedDayCosts.map((value) => [value.personDayId, value]));
  const perInstance = instances.map((instance) => {
    const occurrenceCosts = instance.occurrenceIds.map((id) => costs.get(id));
    const resolved = occurrenceCosts.every((fact) => fact?.causalCost.availability === "known" && fact.evidence.length > 0);
    const componentKeys = occurrenceCosts.flatMap((fact) => fact?.evidence.map((entry) => String(entry.canonicalComponentKey)) ?? []);
    const duplicateComponent = new Set(componentKeys).size !== componentKeys.length;
    const causalCost = duplicateComponent
      ? { status: "CONFLICT" as const, reasonCode: "DUPLICATE_CAUSAL_COMPONENT_ACROSS_ROUTINE_ELEMENTS" as const }
      : resolved
        ? { status: "KNOWN" as const, value: occurrenceCosts.reduce<Money>((sum, fact) => addMoney(sum, fact!.causalCost.availability === "known" ? fact!.causalCost.value : parseMoney("0")), parseMoney("0")) }
        : { status: "UNKNOWN" as const, reasonCode: "ROUTINE_CAUSAL_COST_UNRESOLVED" as const };
    const day = dayCosts.get(instance.personDayId);
    if (day !== undefined) assertNoUndefined(day, "GlobalDayEconomicCost");
    const associatedDayCost = day?.status === "KNOWN" && day.amount !== undefined
      ? { status: "KNOWN" as const, value: parseMoney(day.amount) }
      : day?.status === "PARTIAL" && day.amount !== undefined
        ? { status: "PARTIAL" as const, value: parseMoney(day.amount), partialMeaning: "OBSERVED_ONLY" as const }
        : { status: day?.status ?? "UNKNOWN" as "UNKNOWN" | "CONFLICT", reasonCode: "DAY_ECONOMIC_COST_UNRESOLVED" as const };
    return { instanceId: instance.instanceId, personDayId: instance.personDayId, causalCost, associatedDayCost, causalComponentKeys: [...new Set(componentKeys)].sort(), associatedComponentKeys: [...new Set(day?.componentKeys ?? [])].sort() };
  });
  const knownCausal: Money[] = [];
  const knownAssociated: Money[] = [];
  for (const value of perInstance) {
    if (value.causalCost.status === "KNOWN") knownCausal.push(value.causalCost.value);
    if (value.associatedDayCost.status === "KNOWN" && value.associatedDayCost.value !== undefined) knownAssociated.push(value.associatedDayCost.value);
  }
  const typicalCausalCost = knownCausal.length < 4
    ? { status: "UNKNOWN" as const, reasonCode: "INSUFFICIENT_ROUTINE_COST_SUPPORT" as const }
    : knownCausal.length >= 7
      ? { status: "KNOWN" as const, value: median(knownCausal) }
      : { status: "PARTIAL" as const, value: median(knownCausal), partialMeaning: "OBSERVED_ONLY" as const, reasonCode: "INDICATIVE_ROUTINE_COST_SUPPORT" as const };
  const typicalAssociatedDayCost = knownAssociated.length === 0
    ? { status: "UNKNOWN" as const, reasonCode: "NO_ASSOCIATED_DAY_COST" as const }
    : knownAssociated.length === instances.length
      ? { status: "KNOWN" as const, value: median(knownAssociated) }
      : { status: "PARTIAL" as const, value: median(knownAssociated), partialMeaning: "OBSERVED_ONLY" as const, reasonCode: "PARTIAL_ASSOCIATED_DAY_COST" as const };
  const coverage = { numerator: knownCausal.length, denominator: instances.length, ratio: instances.length === 0 ? 0 : knownCausal.length / instances.length, basis: "resolved-causal-routine-instances" as const };
  const monthlyEquivalent = input.monthlyFrequency === undefined || (typicalCausalCost.status !== "KNOWN" && typicalCausalCost.status !== "PARTIAL")
    ? { status: "UNKNOWN" as const, reasonCode: "ROUTINE_FREQUENCY_OR_COST_UNAVAILABLE" as const }
    : { status: typicalCausalCost.status, value: parseMoney(new Big(typicalCausalCost.value).times(input.monthlyFrequency).toFixed()), provenance: "DERIVED_FROM_OBSERVED" as const, nonAdditiveAcrossRoutines: true as const };
  const result = {
    routineId: input.routineId,
    perInstance,
    causalRoutineCost: typicalCausalCost,
    associatedDayCost: typicalAssociatedDayCost,
    routineCostCoverage: coverage,
    monthlyEquivalent,
    nonAdditiveAcrossRoutines: true as const,
    methodVersion: "global_routine_cost@v1" as const,
  };
  return { ...result, inputHash: digest({ result, activityCosts: input.activityCosts, dayCosts: input.dayCosts }) };
}

export type GlobalDayContextAssertion = {
  readonly personDayId: string;
  readonly dayType: "ONSITE" | "REMOTE" | "HOME" | "LEAVE" | "PRO_TRIP" | string;
  readonly authorityRef: string;
  readonly evidenceRefs: readonly string[];
};

export function buildGlobalDayTypeAnalysis(input: {
  readonly personId: string;
  readonly personDays: readonly PersonDayFact[];
  readonly contexts: readonly GlobalDayContextAssertion[];
  readonly dayCosts: readonly GlobalDayEconomicCost[];
}) {
  const days = assertUniqueConsistent(input.personDays, (day) => String(day.personDayId), "Person day").filter((day) => String(day.personId) === input.personId);
  const contexts = assertUniqueConsistent(input.contexts, (context) => context.personDayId, "Day context");
  const costs = new Map(assertUniqueConsistent(input.dayCosts, (cost) => cost.personDayId, "Day cost").map((cost) => [cost.personDayId, cost]));
  const dayById = new Map(days.map((day) => [String(day.personDayId), day]));
  for (const context of contexts) {
    if (!dayById.has(context.personDayId) || !context.dayType || !context.authorityRef || context.evidenceRefs.length === 0) throw new TypeError("Day type requires a scoped PersonDay and explicit authority.");
  }
  const observable = days;
  const byType = [...new Set(contexts.map((context) => context.dayType))].sort().map((dayType) => {
    const selected = contexts.filter((context) => context.dayType === dayType);
    const eligible = selected;
    const knownCosts = eligible.flatMap((context) => {
      const cost = costs.get(context.personDayId);
      return cost?.status === "KNOWN" && cost.amount !== undefined ? [cost.amount] : [];
    });
    return {
      dayType,
      dayCount: selected.length,
      observableDayCount: eligible.length,
      rate: observable.length === 0 ? { status: "UNKNOWN" as const } : { status: "KNOWN" as const, value: new Big(eligible.length).div(observable.length).toFixed(), denominator: observable.length },
      medianEconomicCost: knownCosts.length === 0 ? { status: "UNKNOWN" as const } : knownCosts.length === eligible.length ? { status: "KNOWN" as const, value: median(knownCosts) } : { status: "PARTIAL" as const, value: median(knownCosts), partialMeaning: "OBSERVED_ONLY" as const },
      evidenceRefs: [...new Set(selected.flatMap((context) => [context.authorityRef, ...context.evidenceRefs]))].sort(),
    };
  });
  const unclassifiedObservableDays = observable.filter((day) => !contexts.some((context) => context.personDayId === String(day.personDayId))).map((day) => String(day.personDayId));
  const result = { personId: input.personId, dayTypes: byType, unclassifiedObservableDays, status: unclassifiedObservableDays.length === 0 ? "KNOWN" as const : "PARTIAL" as const, methodVersion: "global_day_type@v1" as const };
  return { ...result, inputHash: digest(result) };
}

/** A PlaceVisit proves presence only. Routine role remains unavailable until a
 * dated canonical role assertion is supplied to the semantic token projector.
 */
export function projectPlaceVisitRoutineRole(_visit: PlaceVisitFact) {
  return { status: "UNKNOWN" as const, reasonCode: "CANONICAL_DATED_PLACE_ROLE_ABSENT" as const };
}

export function projectRoutineTemporalSeries(input: {
  readonly rhythm: ReturnType<typeof buildGlobalActivityRhythm>;
  readonly certifiedThroughMonth: YearMonth;
}) {
  parseYearMonth(input.certifiedThroughMonth);
  return input.rhythm.monthlyRates.filter((point) => point.month <= input.certifiedThroughMonth);
}

/** Explicit one-way M4 -> M3 adapter. M4 never consumes the transformation
 * result, so this cannot create a dependency cycle.
 */
export function buildGlobalM4ActivityTransformations(input: {
  readonly rhythm: ReturnType<typeof buildGlobalActivityRhythm>;
  readonly certifiedThroughMonth: YearMonth;
  readonly subjectRef: string;
  readonly evidence: Omit<GlobalMaterialityCandidate, "candidateId" | "effect">;
  readonly policyId: GlobalMaterialityPolicyId;
  readonly semanticRefs: readonly string[];
  readonly structuralAuthorityRefs: readonly string[];
}) {
  const points = projectRoutineTemporalSeries({ rhythm: input.rhythm, certifiedThroughMonth: input.certifiedThroughMonth });
  const series: GlobalTransformationSeries = {
    signalId: `activity:${input.rhythm.activityId}:frequency`,
    subjectRef: input.subjectRef,
    catalogKey: "ACTIVITY_FREQUENCY",
    certifiedThroughMonth: input.certifiedThroughMonth,
    points,
    evidence: input.evidence,
    policyId: input.policyId,
    semanticRefs: [...new Set(input.semanticRefs)].sort(),
    structuralAuthorityRefs: [...new Set(input.structuralAuthorityRefs)].sort(),
  };
  return buildGlobalTransformations({ series: [series], relations: [] });
}

export function buildGlobalM4RoutineTransformations(input: {
  readonly pattern: ReturnType<typeof discoverGlobalRoutinePatterns>["patterns"][number];
  readonly certifiedThroughMonth: YearMonth;
  readonly subjectRef: string;
  readonly evidence: Omit<GlobalMaterialityCandidate, "candidateId" | "effect">;
  readonly policyId: GlobalMaterialityPolicyId;
  readonly semanticRefs: readonly string[];
  readonly structuralAuthorityRefs: readonly string[];
}) {
  const series: GlobalTransformationSeries = {
    signalId: `${input.pattern.routineId}:prevalence`,
    subjectRef: input.subjectRef,
    catalogKey: input.pattern.scope === "SHARED" ? "SHARED_HABIT" : "ACTIVITY_LIFECYCLE",
    certifiedThroughMonth: parseYearMonth(input.certifiedThroughMonth),
    points: input.pattern.evolution.monthlyPrevalence.filter((point) => point.month <= input.certifiedThroughMonth),
    evidence: input.evidence,
    policyId: input.policyId,
    semanticRefs: [...new Set(input.semanticRefs)].sort(),
    structuralAuthorityRefs: [...new Set(input.structuralAuthorityRefs)].sort(),
  };
  return buildGlobalTransformations({ series: [series], relations: [] });
}
