import { Temporal } from "@js-temporal/polyfill";
import { canonicalSerializeGlobal } from "../../core/global-v2";
import { parseLocalDate } from "../../core/time";

/** P06 human arbitration: these predicates never infer a resolved negative. */
export const relationshipComparatorPolicies = Object.freeze({
  ONSITE: Object.freeze({ version: "relationship-onsite-remote@v1", comparator: "REMOTE", calendar: "EXACT_WEEKDAY", maximumDays: 56 }),
  REMOTE: Object.freeze({ version: "relationship-remote-onsite@v1", comparator: "ONSITE", calendar: "EXACT_WEEKDAY", maximumDays: 56 }),
  LEAVE_REST: Object.freeze({ version: "relationship-leave-rest-comparator@v1", comparator: "NOT_LEAVE_AND_NOT_REST", calendar: "SAME_CLASS", maximumDays: 56 }),
  WEEKEND: Object.freeze({ version: "relationship-weekend-comparator@v1", comparator: "NON_WEEKEND", calendar: "CONTRAST_CLASS", maximumDays: 56 }),
} as const);

export type RelationshipDailyExposure = keyof typeof relationshipComparatorPolicies;
export type RelationshipCalendarClass = "WEEKDAY" | "WEEKEND" | "UNKNOWN";
export type RelationshipDayContext = "ONSITE" | "REMOTE" | "HOME" | "LEAVE" | "REST" | "PRO_TRIP" | "OTHER" | "UNKNOWN";
export type RelationshipDayUnit = {
  readonly id: string;
  readonly householdId: string;
  readonly personId: string;
  readonly regimeId: string;
  readonly date: string;
  readonly personDayObservable: boolean;
  readonly context: RelationshipDayContext;
  readonly contextEvidenceRefs: readonly string[];
  readonly calendarClass: RelationshipCalendarClass;
  readonly calendarEvidenceRefs: readonly string[];
  readonly evidenceRefs: readonly string[];
  readonly excludedReasons: readonly string[];
  readonly seasonalStratum?: { readonly key: string; readonly authorityRef: string };
};

const compare = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0;
const distance = (a: string, b: string) => Math.abs(Temporal.PlainDate.from(a).until(Temporal.PlainDate.from(b), { largestUnit: "day" }).days);

export function relationshipDayGroup(exposure: RelationshipDailyExposure, day: RelationshipDayUnit): "EXPOSED" | "CONTROL" | "INELIGIBLE" {
  if (!day.personDayObservable || day.excludedReasons.length > 0 || day.evidenceRefs.length === 0) return "INELIGIBLE";
  if (day.calendarClass === "UNKNOWN" || day.calendarEvidenceRefs.length === 0) return "INELIGIBLE";
  if (exposure === "WEEKEND") return day.calendarClass === "WEEKEND" ? "EXPOSED" : "CONTROL";
  if (day.context === "UNKNOWN" || day.contextEvidenceRefs.length === 0) return "INELIGIBLE";
  if (exposure === "LEAVE_REST") return day.context === "LEAVE" || day.context === "REST" ? "EXPOSED" : "CONTROL";
  if (day.context === exposure) return "EXPOSED";
  return day.context === relationshipComparatorPolicies[exposure].comparator ? "CONTROL" : "INELIGIBLE";
}

export function normalizeRelationshipDays(days: readonly RelationshipDayUnit[]): readonly RelationshipDayUnit[] {
  const unique = new Map<string, RelationshipDayUnit>();
  const naturalKeys = new Map<string, string>();
  for (const day of days) {
    canonicalSerializeGlobal(day);
    parseLocalDate(day.date);
    if (![day.id, day.householdId, day.personId, day.regimeId].every((id) => typeof id === "string" && id.length > 0)) throw new TypeError("M5_IDENTITY_REQUIRED");
    if (typeof day.personDayObservable !== "boolean" || !["WEEKDAY", "WEEKEND", "UNKNOWN"].includes(day.calendarClass) || !["ONSITE", "REMOTE", "HOME", "LEAVE", "REST", "PRO_TRIP", "OTHER", "UNKNOWN"].includes(day.context)) throw new TypeError("M5_INVALID_DAY_AUTHORITY");
    const sortedRefs = (refs: readonly string[]) => {
      if (!Array.isArray(refs) || refs.some((ref) => typeof ref !== "string" || !ref)) throw new TypeError("M5_INVALID_EVIDENCE");
      return [...new Set(refs)].sort(compare);
    };
    const normalized = { ...day, contextEvidenceRefs: sortedRefs(day.contextEvidenceRefs), calendarEvidenceRefs: sortedRefs(day.calendarEvidenceRefs), evidenceRefs: sortedRefs(day.evidenceRefs), excludedReasons: sortedRefs(day.excludedReasons) };
    if (day.seasonalStratum && (!day.seasonalStratum.key || !day.seasonalStratum.authorityRef)) throw new TypeError("M5_SEASONAL_AUTHORITY_REQUIRED");
    const previous = unique.get(day.id);
    if (previous && canonicalSerializeGlobal(previous) !== canonicalSerializeGlobal(normalized)) throw new TypeError("M5_CONTRADICTORY_DAY");
    const naturalKey = `${day.householdId}:${day.personId}:${day.date}`;
    if (naturalKeys.has(naturalKey) && naturalKeys.get(naturalKey) !== day.id) throw new TypeError("M5_DUPLICATE_PERSON_DAY");
    naturalKeys.set(naturalKey, day.id);
    unique.set(day.id, normalized);
  }
  return [...unique.values()].sort((a, b) => compare(a.date, b.date) || compare(a.id, b.id));
}

/** Outcome-blind, chronological exposed order; nearest control, then date/id.
 * This fixed greedy policy deliberately does not maximize significance or support.
 */
export function matchRelationshipDays(input: {
  readonly exposure: RelationshipDailyExposure;
  readonly householdId: string;
  readonly personId: string;
  readonly regimeId: string;
  readonly through: string;
  readonly days: readonly RelationshipDayUnit[];
}) {
  parseLocalDate(input.through);
  if (!Object.hasOwn(relationshipComparatorPolicies, input.exposure)) throw new TypeError("M5_UNKNOWN_COMPARATOR_POLICY");
  const days = normalizeRelationshipDays(input.days).filter((day) => day.date <= input.through);
  const selected = days.filter((day) => day.householdId === input.householdId && day.personId === input.personId && day.regimeId === input.regimeId);
  const excluded = days.filter((day) => !selected.includes(day)).map((day) => ({ id: day.id, reason: "OUTSIDE_PERSON_HOUSEHOLD_REGIME" }));
  const controls = selected.filter((day) => relationshipDayGroup(input.exposure, day) === "CONTROL");
  const exposed = selected.filter((day) => relationshipDayGroup(input.exposure, day) === "EXPOSED");
  excluded.push(...selected.filter((day) => relationshipDayGroup(input.exposure, day) === "INELIGIBLE").map((day) => ({ id: day.id, reason: "UNRESOLVED_AUTHORITY_OR_EXCLUSION" })));
  const policy = relationshipComparatorPolicies[input.exposure];
  const used = new Set<string>();
  const pairs: { exposed: RelationshipDayUnit; control: RelationshipDayUnit; distanceDays: number }[] = [];
  for (const day of exposed) {
    const candidates = controls.filter((control) => !used.has(control.id) && distance(day.date, control.date) <= policy.maximumDays && (
      day.seasonalStratum === undefined && control.seasonalStratum === undefined || day.seasonalStratum !== undefined && control.seasonalStratum !== undefined && day.seasonalStratum.key === control.seasonalStratum.key && day.seasonalStratum.authorityRef === control.seasonalStratum.authorityRef
    ) && (
      policy.calendar === "CONTRAST_CLASS" || (policy.calendar === "SAME_CLASS" ? day.calendarClass === control.calendarClass : Temporal.PlainDate.from(day.date).dayOfWeek === Temporal.PlainDate.from(control.date).dayOfWeek)
    )).sort((a, b) => distance(day.date, a.date) - distance(day.date, b.date) || compare(a.date, b.date) || compare(a.id, b.id));
    const control = candidates[0];
    if (!control) { excluded.push({ id: day.id, reason: "NO_COMPARABLE_CONTROL_WITHIN_56_DAYS" }); continue; }
    used.add(control.id);
    pairs.push({ exposed: day, control, distanceDays: distance(day.date, control.date) });
  }
  return { policy, matchingVersion: "relationship-nearest-chronological-no-replacement@v1", pairs, exposedCount: exposed.length, controlCount: controls.length, unmatchedControlIds: controls.filter((day) => !used.has(day.id)).map((day) => day.id), excluded: excluded.sort((a, b) => compare(a.id, b.id)) };
}
