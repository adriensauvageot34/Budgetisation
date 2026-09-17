import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  buildTimelineSemanticProjection,
  resolveTimelineLifeEventCosts,
  type TimelineSemanticMomentOwner,
  type TimelineSemanticProjectionAssertion,
} from "@/analytics/global-v2";
import {
  parseActivityCausalFinancialLinks,
  type ActivityOccurrenceFact,
} from "@/analytics/facts";
import { projectCanonicalMomentRelations, resolveMomentFinancialCost } from "@/analytics/history-v2/shared-doctrines";
import { parseMoney } from "@/core/money";
import { parseLocalDate, type LocalDate } from "@/core/time";
import { LifeEventCostAssertionRepository } from "@/server/canonical/life-event-cost-assertions";
import { canonicalString, optionalCanonicalString } from "@/server/canonical/record";
import type { CanonicalRepository } from "@/server/canonical/repository";
import { TimelineSemanticAssertionRepository } from "@/server/canonical/timeline-semantic-assertions";
import { loadMomentParticipantsByMomentId } from "@/server/query/sources/canonical-relations";
import {
  resolveGlobalTimelineOwnerInputs,
  type M6TimelineAuthority,
} from "./global-v2-candidate-adapters";

async function loadSeriesLabels(
  client: SupabaseClient,
  momentSeriesIds: readonly string[],
  lifeEventSeriesIds: readonly string[],
): Promise<Readonly<Record<string, string>>> {
  const [momentResult, lifeEventResult] = await Promise.all([
    momentSeriesIds.length === 0
      ? Promise.resolve({ data: [], error: null })
      : client.from("moment_series").select("moment_series_id,name").in("moment_series_id", momentSeriesIds),
    lifeEventSeriesIds.length === 0
      ? Promise.resolve({ data: [], error: null })
      : client.from("life_event_series").select("series_id,name").in("series_id", lifeEventSeriesIds),
  ]);
  if (momentResult.error !== null || lifeEventResult.error !== null) {
    throw new Error("TIMELINE_SEMANTIC_SERIES_READ_FAILED");
  }
  const labels: Record<string, string> = {};
  for (const row of momentResult.data ?? []) {
    if (typeof row.moment_series_id !== "string" || typeof row.name !== "string" || row.name.trim() === "") continue;
    labels[`moment-series:${row.moment_series_id}`] = row.name;
  }
  for (const row of lifeEventResult.data ?? []) {
    if (typeof row.series_id !== "string" || typeof row.name !== "string" || row.name.trim() === "") continue;
    labels[`life-event-series:${row.series_id}`] = row.name;
  }
  return labels;
}

/** Read-only live owner for the internal S4 semantic Timeline projection. */
export async function resolveGlobalTimelineSemanticProjection(input: Readonly<{
  client: SupabaseClient;
  repository: CanonicalRepository;
  certifiedThrough: LocalDate;
  occurrences: readonly ActivityOccurrenceFact[];
  m6: M6TimelineAuthority;
}>) {
  const semanticAssertions = new TimelineSemanticAssertionRepository(input.client, input.repository.context);
  const costAssertions = new LifeEventCostAssertionRepository(input.client, input.repository.context);
  const [owners, activeSemanticAssertions, activeCostAssertions] = await Promise.all([
    resolveGlobalTimelineOwnerInputs(input),
    semanticAssertions.readAllActive(),
    costAssertions.readAllActive(),
  ]);
  const presentMomentIds = new Set(owners.moments.map(({ momentId }) => momentId));
  const missingMomentIds = activeSemanticAssertions.flatMap(({ eventRef }) =>
    eventRef.sourceKind === "MOMENT" && !presentMomentIds.has(eventRef.momentId) ? [eventRef.momentId] : []);
  const missingMomentRows = await input.repository.loadEntityRows("moments", "moment_id", missingMomentIds);
  if (missingMomentRows.length !== missingMomentIds.length) {
    throw new TypeError("TIMELINE_SEMANTIC_ASSERTED_MOMENT_OWNER_MISSING");
  }
  const [missingMomentParticipants, missingMomentFacts] = await Promise.all([
    loadMomentParticipantsByMomentId({
      repository: input.repository,
      context: input.repository.context,
      momentIds: missingMomentIds,
    }),
    input.repository.loadEconomicFactsByMomentIds(missingMomentIds),
  ]);
  const missingMomentRelations = projectCanonicalMomentRelations(missingMomentFacts);
  const supplementalMoments: TimelineSemanticMomentOwner[] = missingMomentRows.map((row) => {
    const momentId = canonicalString(row, ["moment_id"], "entities");
    const canonicalName = optionalCanonicalString(row, ["name"]);
    const start = optionalCanonicalString(row, ["start_date", "starts_on"]);
    const end = optionalCanonicalString(row, ["end_date", "ends_on"]);
    const rawType = optionalCanonicalString(row, ["type"]) ?? "UNSPECIFIED";
    if (canonicalName === undefined) throw new TypeError(`TIMELINE_SEMANTIC_MOMENT_NAME_MISSING:${momentId}`);
    if (start === undefined) throw new TypeError(`TIMELINE_SEMANTIC_MOMENT_START_MISSING:${momentId}`);
    const expectedFacts = missingMomentFacts.filter((fact) => fact.moment.kind === "resolved" && String(fact.moment.id) === momentId);
    const resolved = resolveMomentFinancialCost({
      householdId: String(input.repository.context.householdId),
      momentId,
      relations: missingMomentRelations,
    });
    const causalCost: TimelineSemanticMomentOwner["causalCost"] = resolved.causalCost.status === "KNOWN"
      ? { status: "KNOWN", value: resolved.causalCost.value }
      : resolved.causalCost.status === "PARTIAL"
        ? { status: "PARTIAL", value: resolved.causalCost.value }
        : resolved.causalCost.status === "CONFLICT"
          ? { status: "CONFLICT" }
          : expectedFacts.length === 0
            ? { status: "KNOWN", value: parseMoney("0") }
            : { status: "UNKNOWN" };
    const participants = missingMomentParticipants.get(momentId) ?? [];
    return {
      momentId,
      canonicalName,
      startDate: parseLocalDate(start),
      endDate: end === undefined ? null : parseLocalDate(end),
      typeKey: rawType,
      typeLabel: rawType,
      familyKey: rawType,
      participantRefs: participants.map(({ personId }) => `person:${personId}`).sort(),
      places: [],
      causalCost,
      ...(optionalCanonicalString(row, ["moment_series_id", "series_id"]) === undefined
        ? {}
        : { seriesRef: `moment-series:${optionalCanonicalString(row, ["moment_series_id", "series_id"])}` }),
      detailAvailable: false,
    };
  });
  const momentOwners = [...owners.moments, ...supplementalMoments];
  const lifeEventIds = owners.lifeEvents.map(({ lifeEventId }) => lifeEventId);
  const occurrenceById = new Map<string, ActivityOccurrenceFact>();
  for (const occurrence of input.occurrences) {
    const lifeEventId = String(occurrence.lifeEventId);
    const previous = occurrenceById.get(lifeEventId);
    if (previous !== undefined && JSON.stringify(previous) !== JSON.stringify(occurrence)) {
      throw new TypeError(`TIMELINE_SEMANTIC_CONFLICTING_LIFE_EVENT_OWNER:${lifeEventId}`);
    }
    occurrenceById.set(lifeEventId, occurrence);
  }
  const occurrences = [...occurrenceById.values()];
  const financialLinks = parseActivityCausalFinancialLinks(
    await input.repository.loadActivityCausalFinancialLinkRows(lifeEventIds),
  );
  const componentKeys = [...new Set(financialLinks.map(({ canonicalComponentKey }) => canonicalComponentKey))].sort();
  const components = await input.repository.loadEconomicFactsByComponentKeys(componentKeys);
  const lifeEventCosts = resolveTimelineLifeEventCosts({
    occurrences,
    assertions: activeCostAssertions,
    components,
    links: financialLinks,
  });
  const momentSeriesIds = [...new Set(momentOwners.flatMap(({ seriesRef }) =>
    seriesRef?.startsWith("moment-series:") ? [seriesRef.slice("moment-series:".length)] : []))].sort();
  const lifeEventSeriesIds = [...new Set(owners.lifeEvents.flatMap(({ seriesRef }) =>
    seriesRef?.startsWith("life-event-series:") ? [seriesRef.slice("life-event-series:".length)] : []))].sort();
  const seriesLabelsByRef = await loadSeriesLabels(input.client, momentSeriesIds, lifeEventSeriesIds);
  const assertions: TimelineSemanticProjectionAssertion[] = activeSemanticAssertions.map((assertion) => ({
    eventRef: assertion.eventRef,
    visibilityTier: assertion.visibilityTier,
    closeFamilyKey: assertion.closeFamilyKey,
    taxonomyVersion: assertion.taxonomyVersion,
  }));
  return buildTimelineSemanticProjection({
    sourceRevision: Number(input.repository.context.dataRevision),
    moments: momentOwners,
    lifeEvents: owners.lifeEvents,
    assertions,
    lifeEventCosts,
    seriesLabelsByRef,
  });
}
