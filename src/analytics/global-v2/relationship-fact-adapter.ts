import type { ActivityOccurrenceFact, PersonDayFact } from "../facts";
import { canonicalSerializeGlobal } from "../../core/global-v2";
import type { GlobalDayContextAssertion } from "./routines";
import type { RelationshipDayContext, RelationshipDayUnit } from "./relationship-comparators";
import { parseGlobalCoverageSet } from "../../core/global-v2";
import type { RelationshipDailyOutcome } from "./relationships";

/** P05's explicit assertions remain mandatory. Neither a Place nor a missing
 * context is converted into HOME/REMOTE/NOT_LEAVE. No new Fact grain is created.
 */
export function projectRelationshipPersonDays(input: {
  readonly householdId: string;
  readonly personId: string;
  readonly regimeId: string;
  readonly personDays: readonly PersonDayFact[];
  readonly contexts: readonly GlobalDayContextAssertion[];
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
      contextEvidenceRefs: resolved ? [context.authorityRef, ...context.evidenceRefs] : [],
      calendarClass: cal?.evidenceRef ? cal.calendarClass : "UNKNOWN",
      calendarEvidenceRefs: cal?.evidenceRef ? [cal.evidenceRef] : [],
      evidenceRefs: [`fct_person_day:${id}`], excludedReasons: [],
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
}) {
  const seen = new Map<string, ActivityOccurrenceFact>();
  for (const fact of input.occurrences) {
    if (String(fact.householdId) !== input.householdId) throw new TypeError("M5_CROSS_HOUSEHOLD_FACT");
    const id = String(fact.lifeEventId), previous = seen.get(id);
    if (previous && canonicalSerializeGlobal(previous) !== canonicalSerializeGlobal(fact)) throw new TypeError("M5_CONTRADICTORY_OCCURRENCE");
    seen.set(id, fact);
  }
  return [...seen.values()].filter((fact) => String(fact.activityId) === input.activityId && fact.participantIds.some((id) => String(id) === input.personId)).map((fact) => ({
    date: fact.startDate, lifeEventId: String(fact.lifeEventId), rawOccurrenceCount: 1 as const,
    evidenceRef: `fct_activity_occurrence:${fact.lifeEventId}`, personId: input.personId,
  })).sort((a, b) => a.date.localeCompare(b.date) || a.lifeEventId.localeCompare(b.lifeEventId));
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
  readonly completeLifeMonths: readonly string[];
}): readonly RelationshipDailyOutcome[] {
  const present = projectRelationshipActivityPresence({ ...input, activityId: "repas_restaurant" });
  const complete = new Set(input.completeLifeMonths);
  const dates = new Set(input.days.filter((day) => day.personId === input.personId).map((day) => day.date));
  const unmappedMonths = new Set(present.filter((event) => !dates.has(event.date)).map((event) => event.date.slice(0, 7)));
  const unresolvedParticipationMonths = new Set(input.occurrences.filter((fact) => fact.activityId === "repas_restaurant" && fact.participantIds.length === 0).map((fact) => fact.startDate.slice(0, 7)));
  return input.days.map((day) => {
    if (day.householdId !== input.householdId || day.personId !== input.personId) throw new TypeError("M5_OUTCOME_PERSON_HOUSEHOLD_MISMATCH");
    const month = day.date.slice(0, 7);
    const observed = present.filter((event) => event.date === day.date);
    const known = complete.has(month) && day.personDayObservable && !unmappedMonths.has(month) && !unresolvedParticipationMonths.has(month);
    const periodRef = `analysis-period:${month}`;
    const evidenceRefs = [...new Set([periodRef, ...day.evidenceRefs, ...observed.map((event) => event.evidenceRef)])].sort();
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
