import "server-only";

import { Temporal } from "@js-temporal/polyfill";
import {
  buildGlobalM7EventMobilityAuthority,
  type EventMobilityContextLink,
  type EventMobilityContextResolution,
  type EventMobilityMembership,
  type EventMobilityTrip,
} from "@/analytics/global-v2";
import { addDays, parseLocalDate } from "@/core/time";
import { optionalCanonicalString, type CanonicalRecord } from "@/server/canonical/record";
import type { CanonicalRepository } from "@/server/canonical/repository";

const PAGE_SIZE = 1_000;
const BATCH_SIZE = 100;

function requiredString(row: CanonicalRecord, key: string, source: string): string {
  const value = row[key];
  if (typeof value !== "string" || value.trim().length === 0) throw new TypeError(`${source}.${key} is missing.`);
  return value;
}

async function pages(source: string, query: (from: number, to: number) => PromiseLike<{ data: unknown; error: { message?: string } | null }>): Promise<readonly CanonicalRecord[]> {
  const rows: CanonicalRecord[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await query(from, from + PAGE_SIZE - 1);
    if (error !== null) throw new TypeError(`${source}:${error.message ?? "query failed"}`);
    if (!Array.isArray(data)) throw new TypeError(`${source}:invalid rows`);
    rows.push(...data as CanonicalRecord[]);
    if (data.length < PAGE_SIZE) return rows;
  }
}

async function batches(source: string, ids: readonly string[], query: (ids: readonly string[], from: number, to: number) => PromiseLike<{ data: unknown; error: { message?: string } | null }>): Promise<readonly CanonicalRecord[]> {
  const unique = [...new Set(ids)].sort();
  const rows: CanonicalRecord[] = [];
  for (let index = 0; index < unique.length; index += BATCH_SIZE) {
    const batch = unique.slice(index, index + BATCH_SIZE);
    for (let from = 0; ; from += PAGE_SIZE) {
      const { data, error } = await query(batch, from, from + PAGE_SIZE - 1);
      if (error !== null) throw new TypeError(`${source}:${error.message ?? "query failed"}`);
      if (!Array.isArray(data)) throw new TypeError(`${source}:invalid rows`);
      rows.push(...data as CanonicalRecord[]);
      if (data.length < PAGE_SIZE) break;
    }
  }
  return rows;
}

function oneOf<T extends string>(value: string, allowed: readonly T[], label: string): T {
  if (!allowed.includes(value as T)) throw new TypeError(`EVENT_MOBILITY_INVALID_${label}:${value}`);
  return value as T;
}

/** Reads the existing canonical MobilityTrip context authority without resolving new links or writing live data. */
export async function resolveGlobalM7EventMobilityAuthority(input: {
  readonly repository: CanonicalRepository;
  readonly certifiedThrough?: string;
}) {
  const { repository } = input;
  const { client, context } = repository;
  const certifiedThrough = input.certifiedThrough
    ?? Temporal.Instant.from(context.asOf).toZonedDateTimeISO(context.timezone).toPlainDate().toString();
  const earliestMonth = context.periods.map((period) => period.month.slice(0, 7)).sort()[0]
    ?? Temporal.PlainDate.from(certifiedThrough).subtract({ months: 12 }).toString().slice(0, 7);
  const range = { start: parseLocalDate(`${earliestMonth}-01`), endExclusive: addDays(parseLocalDate(certifiedThrough), 1) };
  const [mobilityLegs, tripRows, resolutionRows] = await Promise.all([
    repository.loadMobilityLegFacts(range),
    pages("mobility_trips", (from, to) => client.from("mobility_trips")
      .select("mobility_trip_id,household_id,boundary_status,knowledge_state")
      .eq("household_id", context.householdId).eq("is_active", true)
      .order("mobility_trip_id").range(from, to)),
    pages("mobility_trip_context_resolutions", (from, to) => client.from("mobility_trip_context_resolutions")
      .select("mobility_trip_id,resolution_status")
      .eq("household_id", context.householdId).eq("is_active", true)
      .order("mobility_trip_id").range(from, to)),
  ]);
  const trips: EventMobilityTrip[] = tripRows.map((row) => ({
    mobilityTripId: requiredString(row, "mobility_trip_id", "mobility_trips"),
    householdId: requiredString(row, "household_id", "mobility_trips"),
    boundaryStatus: oneOf(requiredString(row, "boundary_status", "mobility_trips"), ["CLOSED_HOME", "CLOSED_SAME_ANCHOR", "OPEN_START", "OPEN_END", "OPEN_BOTH", "WINDOW_TRUNCATED_START", "WINDOW_TRUNCATED_END"] as const, "BOUNDARY"),
    knowledgeState: oneOf(requiredString(row, "knowledge_state", "mobility_trips"), ["KNOWN", "PARTIAL", "CONFLICT"] as const, "KNOWLEDGE"),
  }));
  const tripIds = trips.map((trip) => trip.mobilityTripId);
  const [membershipRows, linkRows] = await Promise.all([
    batches("mobility_trip_legs", tripIds, (ids, from, to) => client.from("mobility_trip_legs")
      .select("mobility_trip_id,mobility_leg_id").in("mobility_trip_id", ids).eq("is_active", true)
      .order("mobility_trip_id").order("mobility_leg_id").range(from, to)),
    pages("mobility_trip_context_links", (from, to) => client.from("mobility_trip_context_links")
      .select("mobility_trip_context_link_id,mobility_trip_id,life_event_id,moment_id,relation_type,anchor_leg_id,validation_status")
      .eq("household_id", context.householdId).eq("is_active", true)
      .order("mobility_trip_context_link_id").range(from, to)),
  ]);
  const memberships: EventMobilityMembership[] = membershipRows.map((row) => ({
    mobilityTripId: requiredString(row, "mobility_trip_id", "mobility_trip_legs"),
    mobilityLegId: requiredString(row, "mobility_leg_id", "mobility_trip_legs"),
  }));
  const contextLinks: EventMobilityContextLink[] = linkRows.map((row) => ({
    mobilityTripContextLinkId: requiredString(row, "mobility_trip_context_link_id", "mobility_trip_context_links"),
    mobilityTripId: requiredString(row, "mobility_trip_id", "mobility_trip_context_links"),
    lifeEventId: optionalCanonicalString(row, ["life_event_id"]) ?? null,
    momentId: optionalCanonicalString(row, ["moment_id"]) ?? null,
    relationType: oneOf(requiredString(row, "relation_type", "mobility_trip_context_links"), ["PRIMARY_CONTEXT", "ENVELOPING_CONTEXT", "DESTINATION_CONTEXT", "ORIGIN_CONTEXT", "STOP_CONTEXT", "ACCESS_CONTEXT", "ASSOCIATED_CONTEXT"] as const, "RELATION"),
    anchorLegId: optionalCanonicalString(row, ["anchor_leg_id"]) ?? null,
    validationStatus: oneOf(requiredString(row, "validation_status", "mobility_trip_context_links"), ["CONFIRMED", "DERIVED"] as const, "VALIDATION"),
  }));
  const contextResolutions: EventMobilityContextResolution[] = resolutionRows.map((row) => ({
    mobilityTripId: requiredString(row, "mobility_trip_id", "mobility_trip_context_resolutions"),
    status: oneOf(requiredString(row, "resolution_status", "mobility_trip_context_resolutions"), ["RESOLVED", "UNRESOLVED", "CONFLICT"] as const, "RESOLUTION"),
  }));
  return buildGlobalM7EventMobilityAuthority({ mobilityLegs, trips, memberships, contextLinks, contextResolutions });
}
