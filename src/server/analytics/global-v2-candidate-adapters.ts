import "server-only";

import {
  buildGlobalGroceryCandidateBundle,
  buildGlobalTimelineCandidateBundle,
  type GlobalActivityCostProfileAdapterInput,
  type GlobalM2MonthlyComponent,
  type GlobalTimelineAdapterPlace,
  type GlobalTimelineLifeEventAdapterInput,
  type GlobalTimelineMomentAdapterInput,
} from "@/analytics/global-v2";
import type { ActivityOccurrenceFact } from "@/analytics/facts";
import type { Money } from "@/core/money";
import { parseLocalDate, parseYearMonth, type LocalDate, type YearMonth } from "@/core/time";
import { canonicalString, optionalCanonicalString, type CanonicalRecord } from "@/server/canonical/record";
import type { CanonicalRepository } from "@/server/canonical/repository";

export type M6TimelineAuthority = {
  readonly summaries: readonly {
    readonly moment: {
      readonly momentId: string;
      readonly startDate?: LocalDate;
      readonly endDate?: LocalDate;
      readonly householdParticipantIds: readonly string[];
      readonly lifeEventIds: readonly string[];
      readonly seriesId?: string;
    };
    readonly resolvedType?: { readonly normalizedKey: string; readonly label: string; readonly family: string };
    readonly profile?: { readonly requiredFacets: readonly string[] };
    readonly subjectFacets?: Readonly<Record<string, Readonly<{
      readonly status: "KNOWN" | "UNKNOWN" | "CONFLICT";
      readonly value?: string;
    }>>>;
    readonly causalCost:
      | { readonly status: "KNOWN" | "PARTIAL"; readonly value: Money }
      | { readonly status: "UNKNOWN" | "NOT_APPLICABLE" | "CONFLICT" };
    readonly causalComponents: readonly unknown[];
    readonly sourceRefs: readonly string[];
  }[];
  readonly comparisons: readonly {
    readonly momentId: string;
    readonly status: "KNOWN" | "PARTIAL" | "UNKNOWN" | "NOT_APPLICABLE" | "CONFLICT";
    readonly comparisonTier?: "SAME_SERIES" | "SAME_TYPE" | "SAME_FAMILY";
    readonly peerCount?: number;
  }[];
  readonly momentIdentities: readonly {
    readonly momentId: string;
    readonly canonicalName:
      | { readonly status: "KNOWN"; readonly value: string; readonly evidenceRef: string }
      | { readonly status: "UNKNOWN"; readonly reasonCode: string };
  }[];
};

function uniqueRows<T>(values: readonly T[], key: (value: T) => string, label: string): readonly T[] {
  const result = new Map<string, T>();
  for (const value of values) {
    const identity = key(value);
    const previous = result.get(identity);
    if (previous !== undefined && JSON.stringify(previous) !== JSON.stringify(value)) throw new TypeError(`${label}_CONFLICT:${identity}`);
    result.set(identity, value);
  }
  return [...result.values()];
}

function booleanish(value: unknown, label: string): boolean {
  if (value === true || value === 1 || value === "1") return true;
  if (value === false || value === 0 || value === "0" || value === null || value === undefined) return false;
  throw new TypeError(`${label}_INVALID`);
}

function role(value: string): GlobalTimelineLifeEventAdapterInput["role"] {
  if (value === "Dominant" || value === "Secondaire" || value === "Contextuel") return value;
  throw new TypeError(`TIMELINE_LIFE_EVENT_ROLE_INVALID:${value}`);
}

function placeContext(
  placeId: string,
  labels: ReadonlyMap<string, CanonicalRecord>,
  authority: GlobalTimelineAdapterPlace["authority"],
  evidenceRefs: readonly string[],
): GlobalTimelineAdapterPlace {
  const row = labels.get(placeId);
  if (row === undefined) throw new TypeError(`TIMELINE_PLACE_AUTHORITY_MISSING:${placeId}`);
  const label = optionalCanonicalString(row, ["nom_canonique"]);
  const subtypeLabel = optionalCanonicalString(row, ["sous_type"]);
  return {
    placeRef: `place:${placeId}`,
    ...(label === undefined ? {} : { label }),
    ...(subtypeLabel === undefined ? {} : { subtypeLabel }),
    authority,
    evidenceRefs: [...new Set(evidenceRefs)].sort(),
  };
}

function mergePlaceContexts(values: readonly GlobalTimelineAdapterPlace[]): readonly GlobalTimelineAdapterPlace[] {
  const result = new Map<string, GlobalTimelineAdapterPlace>();
  for (const value of values) {
    const previous = result.get(value.placeRef);
    if (previous === undefined) {
      result.set(value.placeRef, value);
      continue;
    }
    result.set(value.placeRef, {
      ...previous,
      authority: previous.authority === "LIFE_EVENT_PRIMARY_PLACE" || value.authority === "LIFE_EVENT_PRIMARY_PLACE"
        ? "LIFE_EVENT_PRIMARY_PLACE"
        : "LIFE_EVENT_LOCALIZATION",
      evidenceRefs: [...new Set([...previous.evidenceRefs, ...value.evidenceRefs])].sort(),
    });
  }
  return [...result.values()].sort((left, right) => left.placeRef.localeCompare(right.placeRef));
}

/** Shared read-only Canonical + M6 owner normalization for Timeline projections. */
export async function resolveGlobalTimelineOwnerInputs(input: {
  readonly repository: CanonicalRepository;
  readonly certifiedThrough: LocalDate;
  readonly occurrences: readonly ActivityOccurrenceFact[];
  readonly m6: M6TimelineAuthority;
}): Promise<Readonly<{
  moments: readonly GlobalTimelineMomentAdapterInput[];
  lifeEvents: readonly GlobalTimelineLifeEventAdapterInput[];
}>> {
  const momentIds = input.m6.summaries.map(({ moment }) => moment.momentId);
  const occurrences = uniqueRows(input.occurrences, (occurrence) => String(occurrence.lifeEventId), "TIMELINE_LIFE_EVENT");
  const lifeEventIds = occurrences.map(({ lifeEventId }) => String(lifeEventId));
  const [momentRows, momentLinks, allLifeEventLinks] = await Promise.all([
    input.repository.loadEntityRows("moments", "moment_id", momentIds),
    input.repository.loadMomentLifeEventRowsByMomentIds(momentIds),
    input.repository.loadMomentLifeEventRowsByLifeEventIds(lifeEventIds),
  ]);
  const relatedLifeEventIds = [...new Set([
    ...lifeEventIds,
    ...momentLinks.map((row) => canonicalString(row, ["life_event_id"], "life_events")),
  ])].sort();
  const [lifeEventRows, localizationRows] = await Promise.all([
    input.repository.loadLifeEventRecords(relatedLifeEventIds),
    input.repository.loadLifeEventLocalizationRows(relatedLifeEventIds),
  ]);
  const lifeEventById = new Map(lifeEventRows.map((row) => [canonicalString(row, ["life_event_id"], "life_events"), row]));
  const localizationsByLifeEvent = new Map<string, CanonicalRecord[]>();
  for (const row of localizationRows) {
    const lifeEventId = canonicalString(row, ["life_event_id"], "life_events");
    const values = localizationsByLifeEvent.get(lifeEventId) ?? [];
    values.push(row);
    localizationsByLifeEvent.set(lifeEventId, values);
  }
  const typeIds = [...new Set(lifeEventRows.map((row) => canonicalString(row, ["life_event_type_id"], "life_events")))].sort();
  const typeRows = await input.repository.loadLifeEventTypeRowsByIds(typeIds);
  const typeById = new Map(typeRows.map((row) => [canonicalString(row, ["life_event_type_id"], "life_events"), row]));
  const placeIds = [...new Set([
    ...lifeEventRows.flatMap((row) => {
      const value = optionalCanonicalString(row, ["primary_place_id"]);
      return value === undefined ? [] : [value];
    }),
    ...localizationRows.map((row) => canonicalString(row, ["place_id"], "life_events")),
  ])].sort();
  const placeRows = await input.repository.loadEntityRows("places", "place_id", placeIds);
  const placeById = new Map(placeRows.map((row) => [canonicalString(row, ["place_id"], "entities"), row]));
  const momentRowById = new Map(momentRows.map((row) => [canonicalString(row, ["moment_id"], "entities"), row]));
  const identityById = new Map(input.m6.momentIdentities.map((identity) => [identity.momentId, identity]));
  const comparisonById = new Map(input.m6.comparisons.map((comparison) => [comparison.momentId, comparison]));
  const linksByMoment = new Map<string, string[]>();
  const ownedLifeEventIds = new Set(allLifeEventLinks.map((row) => canonicalString(row, ["life_event_id"], "life_events")));
  for (const row of momentLinks) {
    const momentId = canonicalString(row, ["moment_id"], "life_events");
    const lifeEventId = canonicalString(row, ["life_event_id"], "life_events");
    const values = linksByMoment.get(momentId) ?? [];
    values.push(lifeEventId);
    linksByMoment.set(momentId, values);
  }

  const moments: GlobalTimelineMomentAdapterInput[] = input.m6.summaries.map((summary) => {
    const { moment } = summary;
    if (moment.startDate === undefined || moment.endDate === undefined) throw new TypeError(`TIMELINE_MOMENT_INTERVAL_MISSING:${moment.momentId}`);
    const identity = identityById.get(moment.momentId);
    if (identity?.canonicalName.status !== "KNOWN") throw new TypeError(`TIMELINE_MOMENT_NAME_MISSING:${moment.momentId}`);
    if (summary.resolvedType === undefined) throw new TypeError(`TIMELINE_MOMENT_TYPE_MISSING:${moment.momentId}`);
    const row = momentRowById.get(moment.momentId);
    if (row === undefined) throw new TypeError(`TIMELINE_MOMENT_ROW_MISSING:${moment.momentId}`);
    const linkedIds = [...new Set(linksByMoment.get(moment.momentId) ?? [])].sort();
    const linkedPrimaryPlaceIds = [...new Set(linkedIds.flatMap((lifeEventId) => {
      const lifeEvent = lifeEventById.get(lifeEventId);
      const placeId = lifeEvent === undefined ? undefined : optionalCanonicalString(lifeEvent, ["primary_place_id"]);
      return placeId === undefined ? [] : [placeId];
    }))].sort();
    const places = mergePlaceContexts([
      ...linkedPrimaryPlaceIds.map((placeId) => placeContext(
        placeId,
        placeById,
        "LIFE_EVENT_PRIMARY_PLACE",
        linkedIds.flatMap((lifeEventId) => {
          const lifeEvent = lifeEventById.get(lifeEventId);
          return lifeEvent !== undefined && optionalCanonicalString(lifeEvent, ["primary_place_id"]) === placeId
            ? [`life-event:${lifeEventId}:primary-place:${placeId}`]
            : [];
        }),
      )),
      ...linkedIds.flatMap((lifeEventId) => (localizationsByLifeEvent.get(lifeEventId) ?? []).map((localization) => {
        const placeId = canonicalString(localization, ["place_id"], "life_events");
        return placeContext(placeId, placeById, "LIFE_EVENT_LOCALIZATION", [`life-event:${lifeEventId}:localization:${placeId}`]);
      })),
    ]);
    const comparison = comparisonById.get(moment.momentId);
    const limitationCodes = [
      ...(places.length === 0 ? ["NO_PLACE_AUTHORITY"] : []),
      ...(linkedPrimaryPlaceIds.length > 1 ? ["MULTIPLE_PRIMARY_PLACE_AUTHORITIES"] : []),
    ];
    const structure = optionalCanonicalString(row, ["moment_structure"]);
    return {
      momentId: moment.momentId,
      canonicalName: identity.canonicalName.value,
      startDate: moment.startDate,
      endDate: moment.endDate,
      typeKey: summary.resolvedType.normalizedKey,
      typeLabel: summary.resolvedType.label,
      familyKey: summary.resolvedType.family,
      ...(structure === undefined ? {} : { momentStructure: structure }),
      participantRefs: moment.householdParticipantIds.map((personId) => `person:${personId}`).sort(),
      places,
      ...(linkedPrimaryPlaceIds.length === 1 ? { primaryPlaceRef: `place:${linkedPrimaryPlaceIds[0]}` } : {}),
      causalCost: summary.causalCost,
      ...(moment.seriesId === undefined ? {} : { seriesRef: `moment-series:${moment.seriesId}` }),
      ...(comparison === undefined ? {} : { comparisonSummary: {
        status: comparison.status,
        ...(comparison.comparisonTier === undefined ? {} : { comparisonTier: comparison.comparisonTier }),
        peerCount: comparison.peerCount ?? 0,
      } }),
      componentCount: summary.causalComponents.length,
      linkedLifeEventRefs: linkedIds.map((lifeEventId) => `life-event:${lifeEventId}`),
      quality: {
        knowledgeState: limitationCodes.length === 0 ? "KNOWN" : "PARTIAL",
        limitationCodes,
        evidenceRefs: [...new Set([...summary.sourceRefs, identity.canonicalName.evidenceRef, ...places.flatMap(({ evidenceRefs }) => evidenceRefs)])].sort(),
      },
    };
  });

  const lifeEvents: GlobalTimelineLifeEventAdapterInput[] = occurrences.map((occurrence) => {
    const lifeEventId = String(occurrence.lifeEventId);
    const row = lifeEventById.get(lifeEventId);
    if (row === undefined) throw new TypeError(`TIMELINE_LIFE_EVENT_ROW_MISSING:${lifeEventId}`);
    const typeId = canonicalString(row, ["life_event_type_id"], "life_events");
    const type = typeById.get(typeId);
    if (type === undefined) throw new TypeError(`TIMELINE_LIFE_EVENT_TYPE_MISSING:${typeId}`);
    const primaryPlaceId = optionalCanonicalString(row, ["primary_place_id"]);
    const places = mergePlaceContexts([
      ...(primaryPlaceId === undefined ? [] : [placeContext(
        primaryPlaceId,
        placeById,
        "LIFE_EVENT_PRIMARY_PLACE",
        [`life-event:${lifeEventId}:primary-place:${primaryPlaceId}`],
      )]),
      ...(localizationsByLifeEvent.get(lifeEventId) ?? []).map((localization) => {
        const placeId = canonicalString(localization, ["place_id"], "life_events");
        return placeContext(placeId, placeById, "LIFE_EVENT_LOCALIZATION", [`life-event:${lifeEventId}:localization:${placeId}`]);
      }),
    ]);
    const defaultRole = canonicalString(type, ["calendar_default_role"], "life_events");
    const roleOverride = optionalCanonicalString(row, ["calendar_role_override"]);
    const title = optionalCanonicalString(row, ["title"]);
    const parentId = occurrence.parentLifeEventId === null ? undefined : String(occurrence.parentLifeEventId);
    const seriesId = occurrence.lifeEventSeriesId === null ? undefined : String(occurrence.lifeEventSeriesId);
    const limitationCodes = places.length === 0 ? ["NO_PLACE_AUTHORITY"] : [];
    return {
      lifeEventId,
      ...(title === undefined ? {} : { canonicalTitle: title }),
      startDate: occurrence.startDate,
      endDate: occurrence.endDate,
      typeKey: canonicalString(type, ["type_key"], "life_events"),
      typeLabel: canonicalString(type, ["label"], "life_events"),
      familyKey: canonicalString(type, ["family"], "life_events"),
      participantRefs: occurrence.participantIds.map((personId) => `person:${personId}`).sort(),
      places,
      ...(primaryPlaceId === undefined ? {} : { primaryPlaceRef: `place:${primaryPlaceId}` }),
      ...(parentId === undefined ? {} : { parentLifeEventRef: `life-event:${parentId}` }),
      ...(seriesId === undefined ? {} : { seriesRef: `life-event-series:${seriesId}` }),
      role: role(roleOverride ?? defaultRole),
      closed: occurrence.endDate <= input.certifiedThrough,
      template: booleanish(type.calendar_is_fallback, "TIMELINE_LIFE_EVENT_TEMPLATE"),
      ownedByCertifiedMoment: ownedLifeEventIds.has(lifeEventId),
      quality: {
        knowledgeState: limitationCodes.length === 0 ? "KNOWN" : "PARTIAL",
        limitationCodes,
        evidenceRefs: [`life-event:${lifeEventId}`, `life-event-type:${typeId}`, ...places.flatMap(({ evidenceRefs }) => evidenceRefs)].sort(),
      },
    };
  });
  return { moments, lifeEvents };
}

export async function resolveGlobalTimelineCandidateAdapter(input: {
  readonly repository: CanonicalRepository;
  readonly certifiedThrough: LocalDate;
  readonly occurrences: readonly ActivityOccurrenceFact[];
  readonly m6: M6TimelineAuthority;
}) {
  return buildGlobalTimelineCandidateBundle(await resolveGlobalTimelineOwnerInputs(input));
}

/** Candidate-only descriptive M4 + M2 join. It emits no behavioral claim. */
export function resolveGlobalGroceryCandidateAdapter(input: {
  readonly months: readonly YearMonth[];
  readonly occurrences: readonly ActivityOccurrenceFact[];
  readonly activityCostProfiles: readonly GlobalActivityCostProfileAdapterInput[];
  readonly m2MonthlyComponents: readonly GlobalM2MonthlyComponent[];
  readonly subcategoryRows: readonly CanonicalRecord[];
  readonly foodEconomicComponents?: readonly import("@/analytics/global-v2/food-rhythm").GlobalFoodEconomicComponent[];
}) {
  const grocerySubcategories = input.subcategoryRows.filter((row) => optionalCanonicalString(row, ["subcategory_key"]) === "alimentation__courses_alimentaires");
  if (grocerySubcategories.length !== 1) throw new TypeError(`GROCERY_SUBCATEGORY_AUTHORITY_COUNT:${grocerySubcategories.length}`);
  const grocerySubcategoryId = canonicalString(grocerySubcategories[0]!, ["subcategory_id"], "taxonomy");
  const groceryActivityId = "courses_alimentaires";
  const profiles = input.activityCostProfiles.filter(({ activityId }) => activityId === groceryActivityId);
  if (profiles.length !== 1) throw new TypeError(`GROCERY_ACTIVITY_PROFILE_COUNT:${profiles.length}`);
  return buildGlobalGroceryCandidateBundle({
    groceryActivityId,
    grocerySubcategoryId,
    months: input.months.map(parseYearMonth),
    occurrences: input.occurrences,
    activityCostProfile: profiles[0]!,
    m2MonthlyComponents: input.m2MonthlyComponents,
    ...(input.foodEconomicComponents === undefined ? {} : { economicComponents: input.foodEconomicComponents }),
  });
}
