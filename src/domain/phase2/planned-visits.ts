import type { PlannedExpenseDraft, PlannedRouteStop, PlannedTripTiming } from "./planned-contract";
import type { PlannedPlaceOption } from "./planned-places";
import { SOCIAL_CONTACTS_V1, type ProspectiveContact } from "./planned-rules";

const invalid = (): never => { throw new TypeError("PLANNED_VISIT_TIMING_INVALID"); };
const dateValue = (value: unknown): string | null => {
  if (value === null) return null;
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/u.test(value)
    || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0, 10) !== value) return invalid();
  return value;
};
/** Shared structural boundary; incomplete local drafts are valid shapes, not ready values. */
export function parseVisitTiming(raw: unknown): PlannedTripTiming {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return invalid();
  const value = raw as Record<string, unknown>;
  if (Object.keys(value).some((key) => !["outbound", "return"].includes(key))) return invalid();
  const moment = (raw: unknown, returning: boolean) => {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return invalid();
    const v = raw as Record<string, unknown>;
    if (Object.keys(v).some((key) => !["date", "time", ...(returning ? ["required"] : [])].includes(key))
      || returning && v.required !== true) return invalid();
    const date = dateValue(v.date);
    if (v.time !== null && (typeof v.time !== "string" || !/^(?:[01]\d|2[0-3]):[0-5]\d$/u.test(v.time) || !date)) return invalid();
    return { date, time: v.time as string | null };
  };
  return { outbound: moment(value.outbound, false), return: { ...moment(value.return, true), required: true } };
}
export function visitTimingIssues(timing: PlannedTripTiming) {
  const issues: { code: string; message: string; repairTarget: string }[] = [];
  if (!timing.outbound.date) issues.push({ code: "VISIT_DEPARTURE_REQUIRED", message: "Indiquez quand vous partez pour calculer le trajet aller.", repairTarget: "visit-outbound" });
  if (!timing.return.date) issues.push({ code: "VISIT_RETURN_REQUIRED", message: "Indiquez quand vous rentrez pour calculer le trajet retour.", repairTarget: "visit-return" });
  if (timing.outbound.date && timing.return.date && (timing.return.date < timing.outbound.date
    || timing.return.date === timing.outbound.date && timing.outbound.time && timing.return.time && timing.return.time < timing.outbound.time))
    issues.push({ code: "VISIT_RETURN_BEFORE_DEPARTURE", message: "Le retour doit être après le départ.", repairTarget: "visit-return" });
  return issues;
}
export function assertVisitTiming(timing: PlannedTripTiming, plannedDate?: string | null): void {
  const issue = visitTimingIssues(timing)[0];
  if (issue) throw new TypeError(issue.code);
  if (plannedDate !== undefined && timing.outbound.date !== plannedDate) throw new TypeError("PLANNED_VISIT_DATE_MISMATCH");
}
export function shiftVisitTiming(timing: PlannedTripTiming, departureDate: string): PlannedTripTiming {
  assertVisitTiming(timing);
  const shiftedReturn = new Date(Date.parse(timing.return.date!) + Date.parse(departureDate) - Date.parse(timing.outbound.date!)).toISOString().slice(0, 10);
  return { outbound: { ...timing.outbound, date: departureDate }, return: { ...timing.return, date: shiftedReturn } };
}
export const isTimedFamilyVisit = (draft: Pick<PlannedExpenseDraft, "familyKey" | "subtypeKey" | "context">) =>
  draft.familyKey === "visit_trip" && draft.subtypeKey === "family_visit" && !!draft.context.visitTiming;

/** History describes visits to a place, never proof that a named contact attended. */
export function rankFamilyVisitContacts(places: readonly PlannedPlaceOption[], contacts: readonly ProspectiveContact[] = SOCIAL_CONTACTS_V1) {
  return contacts.filter((contact) => contact.kind === "FAMILY").map((contact) => {
    const link = contact.places.find((link) => link.relation === "HOME");
    const primaryPlace = places.find((place) => place.placeId === link?.placeId);
    return { contact, primaryPlace, visitDays: primaryPlace?.visits12Months ?? 0,
      lastVisit: primaryPlace?.lastVisitDate ?? null, habitual: (primaryPlace?.visits12Months ?? 0) >= 3 };
  }).sort((a, b) => Number(b.contact.familyRelation === "PARENT") - Number(a.contact.familyRelation === "PARENT")
    || b.visitDays - a.visitDays || (b.lastVisit ?? "").localeCompare(a.lastVisit ?? "")
    || Number(!!b.primaryPlace) - Number(!!a.primaryPlace) || a.contact.label.localeCompare(b.contact.label, "fr"));
}
export function rankVisitTransportModes(destination: PlannedPlaceOption | undefined) {
  const dates = destination?.carVisitDates12Months ?? [];
  return { mode: "CAR" as const, label: "Voiture", habitual: new Set(dates).size >= 3,
    evidence: { directedCarVisitDays: new Set(dates).size, lastDate: [...dates].sort().at(-1) ?? null } };
}
/** The physical root route owns the only split point. Child places cannot become the family anchor. */
export function splitVisitRoute(stops: readonly PlannedRouteStop[], homePlaceId: string) {
  const anchors = stops.flatMap((stop, i) => stop.endpointSource === "ROOT_PLACE" ? [i] : []);
  const index = anchors[0] ?? -1;
  if (anchors.length !== 1 || index <= 0 || index >= stops.length - 1
    || stops[0]?.placeId !== homePlaceId || stops.at(-1)?.placeId !== homePlaceId
    || stops[0]?.endpointSource !== "DIRECT_PLACE" || stops.at(-1)?.endpointSource !== "DIRECT_PLACE")
    throw new TypeError("PLANNED_VISIT_RETURN_HOME_REQUIRED");
  return { anchorIndex: index, outbound: stops.slice(0, index + 1), return: stops.slice(index) };
}
