import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  TIMELINE_SEMANTIC_HOUSEHOLD_FACET,
  buildTimelineSemanticComparator,
  type TimelineSemanticComparatorFacetContext,
  type TimelineSemanticComparatorFacetValue,
} from "@/analytics/global-v2";
import type { ActivityOccurrenceFact } from "@/analytics/facts";
import type { LocalDate } from "@/core/time";
import type { CanonicalRepository } from "@/server/canonical/repository";
import type { M6TimelineAuthority } from "./global-v2-candidate-adapters";
import { resolveGlobalTimelineSemanticProjection } from "./global-v2-timeline-semantic-projection";

function householdParticipation(
  participantRefs: readonly string[],
  householdRefs: readonly string[],
  authorityKnown: boolean,
): TimelineSemanticComparatorFacetValue {
  if (!authorityKnown) return { status: "UNKNOWN" };
  const participants = [...new Set(participantRefs)].sort();
  const household = [...new Set(householdRefs)].sort();
  if (participants.length === 0 || household.length === 0) return { status: "UNKNOWN" };
  if (participants.some((participant) => !household.includes(participant))) return { status: "CONFLICT" };
  if (participants.length === household.length && participants.every((participant, index) => participant === household[index])) {
    return { status: "KNOWN", value: "BOTH_HOUSEHOLD" };
  }
  if (participants.length === 1) return { status: "KNOWN", value: `PERSON_ONLY:${participants[0]}` };
  return { status: "KNOWN", value: `HOUSEHOLD_SUBSET:${participants.join("|")}` };
}

function momentFacetContext(
  eventRef: `moment:${string}`,
  summary: M6TimelineAuthority["summaries"][number],
  householdRefs: readonly string[],
): TimelineSemanticComparatorFacetContext {
  const facets: Record<string, TimelineSemanticComparatorFacetValue> = {};
  for (const [key, value] of Object.entries(summary.subjectFacets ?? {})) {
    if (value.status === "KNOWN") {
      facets[key] = value.value === undefined ? { status: "UNKNOWN" } : { status: "KNOWN", value: value.value };
    } else {
      facets[key] = { status: value.status };
    }
  }
  const existingParticipation = facets[TIMELINE_SEMANTIC_HOUSEHOLD_FACET];
  facets[TIMELINE_SEMANTIC_HOUSEHOLD_FACET] = householdParticipation(
    summary.moment.householdParticipantIds.map((personId) => `person:${personId}`),
    householdRefs,
    existingParticipation?.status === "KNOWN",
  );
  return { eventRef, facets, requiredFacetKeys: [] };
}

/** Read-only S5 owner. No source or publication mutation is performed here. */
export async function resolveGlobalTimelineSemanticComparator(input: Readonly<{
  client: SupabaseClient;
  repository: CanonicalRepository;
  certifiedThrough: LocalDate;
  occurrences: readonly ActivityOccurrenceFact[];
  m6: M6TimelineAuthority;
}>) {
  return (await resolveGlobalTimelineSemanticAnalysis(input)).comparator;
}

/** Resolves both S4 and S5 owners once so S6 can project one coherent generation. */
export async function resolveGlobalTimelineSemanticAnalysis(input: Readonly<{
  client: SupabaseClient;
  repository: CanonicalRepository;
  certifiedThrough: LocalDate;
  occurrences: readonly ActivityOccurrenceFact[];
  m6: M6TimelineAuthority;
}>) {
  const projection = await resolveGlobalTimelineSemanticProjection(input);
  const householdRefs = input.repository.context.personIds.map((personId) => `person:${personId}`).sort();
  const momentSummaries = new Map(input.m6.summaries.map((summary) => [`moment:${summary.moment.momentId}` as const, summary]));
  const facetContexts = projection.events.map((event): TimelineSemanticComparatorFacetContext => {
    const summary = event.sourceKind === "MOMENT" ? momentSummaries.get(event.eventRef as `moment:${string}`) : undefined;
    if (summary !== undefined) {
      return momentFacetContext(event.eventRef as `moment:${string}`, summary, householdRefs);
    }
    const householdFacet = householdParticipation(event.participants.participantRefs, householdRefs, event.participants.count > 0);
    return {
      eventRef: event.eventRef,
      facets: { [TIMELINE_SEMANTIC_HOUSEHOLD_FACET]: householdFacet },
      requiredFacetKeys: [],
    };
  });
  return { projection, comparator: buildTimelineSemanticComparator({ projection, facetContexts }) };
}
