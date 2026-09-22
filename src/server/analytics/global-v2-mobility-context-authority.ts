import "server-only";

import { Temporal } from "@js-temporal/polyfill";
import {
  buildGlobalM7MobilityContextAuthority,
  type MobilityLifeEventContextAuthority,
  type MobilityLifeEventParticipationAuthority,
} from "@/analytics/global-v2";
import { addDays, parseLocalDate } from "@/core/time";
import { canonicalString, optionalCanonicalString } from "@/server/canonical/record";
import type { CanonicalRepository } from "@/server/canonical/repository";

const participationStatus = (value: string): MobilityLifeEventParticipationAuthority["status"] => {
  if (value === "Confirmée") return "CONFIRMED";
  if (value === "Déduite") return "DERIVED";
  return "UNKNOWN";
};

const participationPrecision = (value: string): MobilityLifeEventParticipationAuthority["timePrecision"] => {
  if (value === "Exact") return "EXACT";
  if (value === "Approximatif") return "APPROXIMATE";
  if (value === "Plage horaire") return "TIME_RANGE";
  return "UNKNOWN";
};

/**
 * Read-only M7 owner wiring for P4.5-C. Canonical mobility remains physical;
 * LifeEvent, participation and positive place-presence facts are projected as
 * typed derived relations and are never persisted as new canonical truth.
 */
export async function resolveGlobalM7MobilityContextAuthority(input: {
  readonly repository: CanonicalRepository;
  readonly certifiedThrough?: string;
}) {
  const { repository } = input;
  const context = repository.context;
  const certifiedThrough = input.certifiedThrough
    ?? Temporal.Instant.from(context.asOf).toZonedDateTimeISO(context.timezone).toPlainDate().toString();
  const earliestMonth = context.periods.map((period) => period.month.slice(0, 7)).sort()[0]
    ?? Temporal.PlainDate.from(certifiedThrough).subtract({ months: 12 }).toString().slice(0, 7);
  const range = {
    start: parseLocalDate(`${earliestMonth}-01`),
    endExclusive: addDays(parseLocalDate(certifiedThrough), 1),
  };
  const [mobilityLegs, placeVisits, personDays, occurrences] = await Promise.all([
    repository.loadMobilityLegFacts(range),
    repository.loadPlaceVisits(range),
    repository.loadPersonDays(range),
    repository.loadActivityOccurrences(range),
  ]);
  const eventIds = occurrences.map((event) => String(event.lifeEventId));
  const [eventRows, participationRows, localizationRows] = await Promise.all([
    repository.loadLifeEventRecords(eventIds),
    repository.loadLifeEventParticipationRows(eventIds),
    repository.loadLifeEventLocalizationRows(eventIds),
  ]);
  const authorizedPersonIds = new Set(context.personIds.map(String));
  const eventRowById = new Map(eventRows.map((row) => [canonicalString(row, ["life_event_id"], "life_events"), row]));
  const participationsByEvent = new Map<string, MobilityLifeEventParticipationAuthority[]>();
  for (const row of participationRows) {
    const personId = canonicalString(row, ["person_id"], "life_events");
    if (!authorizedPersonIds.has(personId)) continue;
    const lifeEventId = canonicalString(row, ["life_event_id"], "life_events");
    const values = participationsByEvent.get(lifeEventId) ?? [];
    values.push({
      personId,
      status: participationStatus(canonicalString(row, ["participation_status"], "life_events")),
      startAt: optionalCanonicalString(row, ["start_at"]) ?? null,
      endAt: optionalCanonicalString(row, ["end_at"]) ?? null,
      timePrecision: participationPrecision(canonicalString(row, ["time_precision"], "life_events")),
      evidenceRef: `life-event-participation:${canonicalString(row, ["life_event_id"], "life_events")}:${canonicalString(row, ["person_day_id"], "life_events")}:${canonicalString(row, ["person_id"], "life_events")}`,
    });
    participationsByEvent.set(lifeEventId, values);
  }
  const localizedPlaces = new Map<string, string[]>();
  for (const row of localizationRows) {
    const lifeEventId = canonicalString(row, ["life_event_id"], "life_events");
    const values = localizedPlaces.get(lifeEventId) ?? [];
    values.push(canonicalString(row, ["place_id"], "life_events"));
    localizedPlaces.set(lifeEventId, values);
  }
  const lifeEventContexts: MobilityLifeEventContextAuthority[] = occurrences.flatMap((event): readonly MobilityLifeEventContextAuthority[] => {
    const lifeEventId = String(event.lifeEventId);
    const participations = participationsByEvent.get(lifeEventId) ?? [];
    if (!participations.some((row) => row.status === "CONFIRMED" || row.status === "DERIVED")) return [];
    const raw = eventRowById.get(lifeEventId);
    if (raw === undefined) throw new TypeError(`MOBILITY_CONTEXT_MISSING_EVENT:${lifeEventId}`);
    const primaryPlaceId = optionalCanonicalString(raw, ["primary_place_id"]);
    const placeIds = [...new Set([
      ...(primaryPlaceId === undefined ? [] : [primaryPlaceId]),
      ...(localizedPlaces.get(lifeEventId) ?? []),
    ])].sort();
    return [{
      lifeEventId,
      typeKey: String(event.activityId),
      startDate: event.startDate,
      endDate: event.endDate,
      validationStatus: event.validationStatus === "Confirmé" ? "CONFIRMED" : "DERIVED",
      placeIds,
      participations: [...participations].sort((left, right) => left.personId.localeCompare(right.personId) || left.evidenceRef.localeCompare(right.evidenceRef)),
      evidenceRefs: [`fct_activity_occurrence:${lifeEventId}`, `life-event-type:${event.activityId}`, ...placeIds.map((placeId) => `life-event-place:${lifeEventId}:${placeId}`)],
    }];
  });
  return buildGlobalM7MobilityContextAuthority({
    householdId: String(context.householdId),
    householdTimeZone: context.timezone,
    householdPersonIds: context.personIds.map(String),
    mobilityLegs,
    lifeEventContexts,
    placeVisits,
    personDays,
  });
}
