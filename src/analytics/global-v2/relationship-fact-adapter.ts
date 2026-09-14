import type { ActivityOccurrenceFact, PersonDayFact } from "../facts";
import { canonicalSerializeGlobal } from "../../core/global-v2";
import type { GlobalDayContextAssertion } from "./routines";
import type { RelationshipDayContext, RelationshipDayUnit } from "./relationship-comparators";
import { parseGlobalCoverageSet } from "../../core/global-v2";
import type { RelationshipDailyOutcome } from "./relationships";

export type RelationshipActivityParticipation = {
  readonly lifeEventId: string;
  readonly personDayId: string;
  readonly personId: string;
  readonly status: "Confirmée" | "Déduite" | "Inconnue";
  readonly evidenceRef: string;
};

export type RelationshipDayContextAssertion = GlobalDayContextAssertion & {
  readonly excludedReasons?: readonly ["WORK_CONTEXT_CONFLICT"];
};

const compare = (left: string, right: string) => left.localeCompare(right);
const affirmativeParticipation = (status: RelationshipActivityParticipation["status"]) =>
  status === "Confirmée" || status === "Déduite";

function uniqueBy<T>(values: readonly T[], key: (value: T) => string, label: string): readonly T[] {
  const result = new Map<string, T>();
  for (const value of values) {
    const id = key(value);
    const previous = result.get(id);
    if (previous !== undefined && canonicalSerializeGlobal(previous) !== canonicalSerializeGlobal(value)) {
      throw new TypeError(`${label}: M5_CONTRADICTORY_AUTHORITY`);
    }
    result.set(id, value);
  }
  return [...result.values()];
}

/** E1 V1: only exact same-person participation in the two canonical work
 * activities can assert a work context. Place, HOME and negative inference are
 * deliberately absent. Conflicting work assertions remain non-affirmative.
 */
export function projectRelationshipWorkContexts(input: {
  readonly householdId: string;
  readonly personId: string;
  readonly personDays: readonly PersonDayFact[];
  readonly occurrences: readonly ActivityOccurrenceFact[];
  readonly participations: readonly RelationshipActivityParticipation[];
}): readonly RelationshipDayContextAssertion[] {
  const days = new Map(uniqueBy(input.personDays, (day) => String(day.personDayId), "PersonDayFact")
    .filter((day) => String(day.personId) === input.personId)
    .map((day) => [String(day.personDayId), day]));
  const occurrences = new Map(uniqueBy(input.occurrences, (fact) => String(fact.lifeEventId), "ActivityOccurrenceFact")
    .map((fact) => [String(fact.lifeEventId), fact]));
  const participations = uniqueBy(input.participations,
    (value) => `${value.lifeEventId}:${value.personDayId}:${value.personId}`,
    "LifeEventParticipation")
    .filter((value) => value.personId === input.personId && affirmativeParticipation(value.status));
  const byDay = new Map<string, { types: Set<"ONSITE" | "REMOTE">; refs: Set<string> }>();
  for (const participation of participations) {
    const day = days.get(participation.personDayId);
    const occurrence = occurrences.get(participation.lifeEventId);
    if (day === undefined || occurrence === undefined) throw new TypeError("M5_WORK_PARTICIPATION_AUTHORITY_MISMATCH");
    if (String(day.householdId) !== input.householdId || String(occurrence.householdId) !== input.householdId
      || !occurrence.participantIds.some((personId) => String(personId) === input.personId)
      || day.localDate < occurrence.startDate || day.localDate > occurrence.endDate) {
      throw new TypeError("M5_WORK_PARTICIPATION_SCOPE_MISMATCH");
    }
    const dayType = String(occurrence.activityId) === "travail_site"
      ? "ONSITE" as const
      : String(occurrence.activityId) === "teletravail"
        ? "REMOTE" as const
        : undefined;
    if (dayType === undefined) continue;
    const authority = byDay.get(participation.personDayId) ?? { types: new Set(), refs: new Set() };
    authority.types.add(dayType);
    authority.refs.add(`fct_person_day:${participation.personDayId}`);
    authority.refs.add(`fct_activity_occurrence:${participation.lifeEventId}`);
    authority.refs.add(participation.evidenceRef);
    byDay.set(participation.personDayId, authority);
  }
  return [...byDay.entries()].map(([personDayId, authority]): RelationshipDayContextAssertion => {
    const evidenceRefs = [...authority.refs].sort(compare);
    if (authority.types.size > 1) return {
      personDayId,
      dayType: "UNKNOWN",
      authorityRef: `relationship-work-context-conflict:${personDayId}`,
      evidenceRefs,
      excludedReasons: ["WORK_CONTEXT_CONFLICT"],
    };
    const dayType = [...authority.types][0]!;
    return {
      personDayId,
      dayType,
      authorityRef: `relationship-work-context:${dayType.toLowerCase()}:${personDayId}`,
      evidenceRefs,
    };
  }).sort((left, right) => compare(left.personDayId, right.personDayId));
}

/** P05's explicit assertions remain mandatory. Neither a Place nor a missing
 * context is converted into HOME/REMOTE/NOT_LEAVE. No new Fact grain is created.
 */
export function projectRelationshipPersonDays(input: {
  readonly householdId: string;
  readonly personId: string;
  readonly regimeId: string;
  readonly personDays: readonly PersonDayFact[];
  readonly contexts: readonly RelationshipDayContextAssertion[];
  readonly calendar: readonly { readonly personDayId: string; readonly calendarClass: "WEEKDAY" | "WEEKEND"; readonly evidenceRef: string }[];
}): readonly RelationshipDayUnit[] {
  canonicalSerializeGlobal(input);
  const index = <T>(values: readonly T[], key: (value: T) => string) => {
    const result = new Map<string, T>();
    for (const value of values) {
      const id = key(value), prior = result.get(id);
      if (prior && canonicalSerializeGlobal(prior) !== canonicalSerializeGlobal(value)) throw new TypeError("M5_CONTRADICTORY_AUTHORITY");
      result.set(id, value);
    }
    return result;
  };
  const contexts = index(input.contexts, (value) => value.personDayId);
  const calendar = index(input.calendar, (value) => value.personDayId);
  const days = index(input.personDays, (value) => String(value.personDayId));
  for (const id of [...contexts.keys(), ...calendar.keys()]) if (!days.has(id)) throw new TypeError("M5_AUTHORITY_WITHOUT_PERSON_DAY");
  return [...days.values()].filter((fact) => String(fact.personId) === input.personId).map((fact): RelationshipDayUnit => {
    if (String(fact.householdId) !== input.householdId) throw new TypeError("M5_CROSS_HOUSEHOLD_FACT");
    const id = String(fact.personDayId), context = contexts.get(id), cal = calendar.get(id);
    if (context && (!context.authorityRef || !context.evidenceRefs.length)) throw new TypeError("M5_CONTEXT_EVIDENCE_REQUIRED");
    const knownContexts = ["ONSITE", "REMOTE", "HOME", "LEAVE", "REST", "PRO_TRIP", "OTHER"];
    const resolved = context && knownContexts.includes(context.dayType);
    return {
      id, householdId: input.householdId, personId: input.personId, regimeId: input.regimeId,
      date: fact.localDate, personDayObservable: true,
      context: resolved ? context.dayType as RelationshipDayContext : "UNKNOWN",
      contextEvidenceRefs: context ? [...new Set([context.authorityRef, ...context.evidenceRefs])].sort(compare) : [],
      calendarClass: cal?.evidenceRef ? cal.calendarClass : "UNKNOWN",
      calendarEvidenceRefs: cal?.evidenceRef ? [cal.evidenceRef] : [],
      evidenceRefs: [`fct_person_day:${id}`], excludedReasons: context?.excludedReasons ?? [],
    };
  }).sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
}

/** Positive presence only. A complete observation universe is separately
 * required before an absent occurrence can become a known binary zero.
 */
export function projectRelationshipActivityPresence(input: {
  readonly householdId: string;
  readonly personId: string;
  readonly activityId: string;
  readonly occurrences: readonly ActivityOccurrenceFact[];
  readonly participations: readonly RelationshipActivityParticipation[];
}) {
  const seen = new Map<string, ActivityOccurrenceFact>();
  for (const fact of input.occurrences) {
    if (String(fact.householdId) !== input.householdId) throw new TypeError("M5_CROSS_HOUSEHOLD_FACT");
    const id = String(fact.lifeEventId), previous = seen.get(id);
    if (previous && canonicalSerializeGlobal(previous) !== canonicalSerializeGlobal(fact)) throw new TypeError("M5_CONTRADICTORY_OCCURRENCE");
    seen.set(id, fact);
  }
  const participations = uniqueBy(input.participations,
    (value) => `${value.lifeEventId}:${value.personDayId}:${value.personId}`,
    "LifeEventParticipation");
  return participations.filter((participation) => participation.personId === input.personId
    && affirmativeParticipation(participation.status)).flatMap((participation) => {
    const fact = seen.get(participation.lifeEventId);
    if (fact === undefined || String(fact.activityId) !== input.activityId) return [];
    if (!fact.participantIds.some((id) => String(id) === input.personId)) throw new TypeError("M5_PARTICIPATION_FACT_MISMATCH");
    return [{
      date: fact.startDate, personDayId: participation.personDayId,
      lifeEventId: String(fact.lifeEventId), rawOccurrenceCount: 1 as const,
      evidenceRef: `fct_activity_occurrence:${fact.lifeEventId}`,
      participationEvidenceRef: participation.evidenceRef,
      personId: input.personId,
    }];
  }).sort((a, b) => a.date.localeCompare(b.date) || a.lifeEventId.localeCompare(b.lifeEventId));
}

/** Exact existing Canonical activity identity, not a textual/merchant classifier.
 * A positive occurrence alone never proves a complete negative comparator.
 * Closed complete life periods + observable PersonDay supply that denominator.
 */
export function projectRelationshipRestaurantOutcomes(input: {
  readonly householdId: string;
  readonly personId: string;
  readonly days: readonly RelationshipDayUnit[];
  readonly occurrences: readonly ActivityOccurrenceFact[];
  readonly participations: readonly RelationshipActivityParticipation[];
  readonly completeLifeMonths: readonly string[];
}): readonly RelationshipDailyOutcome[] {
  const present = projectRelationshipActivityPresence({ ...input, activityId: "repas_restaurant" });
  const complete = new Set(input.completeLifeMonths);
  const dates = new Set(input.days.filter((day) => day.personId === input.personId).map((day) => day.date));
  const unmappedMonths = new Set(present.filter((event) => !dates.has(event.date)).map((event) => event.date.slice(0, 7)));
  const unresolvedParticipationMonths = new Set([
    ...input.occurrences.filter((fact) => String(fact.activityId) === "repas_restaurant" && fact.participantIds.length === 0)
      .map((fact) => fact.startDate.slice(0, 7)),
    ...input.participations.filter((participation) =>
      participation.personId === input.personId && participation.status === "Inconnue"
      && input.occurrences.some((fact) => String(fact.lifeEventId) === participation.lifeEventId
        && String(fact.activityId) === "repas_restaurant"))
      .flatMap((participation) => input.occurrences
        .filter((fact) => String(fact.lifeEventId) === participation.lifeEventId)
        .map((fact) => fact.startDate.slice(0, 7))),
  ]);
  return input.days.map((day) => {
    if (day.householdId !== input.householdId || day.personId !== input.personId) throw new TypeError("M5_OUTCOME_PERSON_HOUSEHOLD_MISMATCH");
    const month = day.date.slice(0, 7);
    const observed = present.filter((event) => event.personDayId === day.id && event.date === day.date);
    const known = complete.has(month) && day.personDayObservable && !unmappedMonths.has(month) && !unresolvedParticipationMonths.has(month);
    const periodRef = `analysis-period:${month}`;
    const evidenceRefs = [...new Set([periodRef, ...day.evidenceRefs, ...observed.flatMap((event) => [event.evidenceRef, event.participationEvidenceRef])])].sort();
    const status = known ? "KNOWN" as const : "PARTIAL" as const;
    return {
      dayId: day.id, outcome: "RESTAURANT", value: Number(observed.length > 0),
      status: known ? "KNOWN" : observed.length ? "PARTIAL" : "UNKNOWN",
      authority: "ACTIVITY_OCCURRENCE",
      coverage: parseGlobalCoverageSet({ dimensions: [{ dimension: "PERSON_DAY", status, numerator: known ? 1 : 0, denominator: 1, ratio: known ? 1 : 0, unit: "PERSON_DAY", basis: "CLOSED_COMPLETE_LIFE_PERIOD_AND_OBSERVABLE_PERSON_DAY", evidenceRefs, policyRef: "relationship-activity-observation@v1" }], requiredDimensions: ["PERSON_DAY"], effective: known ? 1 : 0, aggregation: "MIN_REQUIRED_DIMENSIONS" }),
      evidenceRefs,
      dependencyRefs: evidenceRefs,
    };
  });
}
