import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  buildGlobalCarMobilityRhythmProjection,
  buildGlobalFoodRhythmProjection,
  buildMonthlyMobilityNarrative,
  resolveMobilityNarrativePlaceRole,
  resolveMobilityNarrativeSemanticFamily,
  type GlobalFoodFinancialComponent,
  type GlobalGroceryCandidateBundle,
  type MobilitySemanticFamily,
  type MonthlyMobilityNarrativeContextInput,
  type MonthlyMobilityNarrativeTripInput,
} from "@/analytics/global-v2";
import type { ActivityOccurrenceCostFact, ActivityOccurrenceFact, EconomicComponentFact, MobilityLegFact } from "@/analytics/facts";
import { addMonths, parseLocalDate, type YearMonth } from "@/core/time";
import type { CanonicalMinimalPlanningBundle, CanonicalRepository } from "@/server/canonical/repository";
import { optionalCanonicalString, type CanonicalRecord } from "@/server/canonical/record";

type BackgroundRhythmProjectionInput = {
  readonly client: SupabaseClient;
  readonly repository: CanonicalRepository;
  readonly months: readonly YearMonth[];
  readonly grocery: GlobalGroceryCandidateBundle;
  readonly subcategoryRows: readonly CanonicalRecord[];
  readonly minimalBundle: CanonicalMinimalPlanningBundle;
  readonly occurrences: readonly ActivityOccurrenceFact[];
  readonly activityCosts: readonly ActivityOccurrenceCostFact[];
};

const PAGE_SIZE = 1_000;
const IN_BATCH_SIZE = 100;

function stringValue(row: CanonicalRecord, key: string, source: string): string {
  const value = row[key];
  if (typeof value !== "string" || value.trim().length === 0) throw new TypeError(`${source}.${key} is missing.`);
  return value;
}

function nullableString(row: CanonicalRecord | undefined, key: string): string | null {
  const value = row?.[key];
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function stringArray(value: unknown): readonly string[] {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string").sort() : [];
}

function indexRows(rows: readonly CanonicalRecord[], key: string): ReadonlyMap<string, CanonicalRecord> {
  return new Map(rows.flatMap((row) => {
    const value = optionalCanonicalString(row, [key]);
    return value === undefined ? [] : [[value, row] as const];
  }));
}

function groupRows(rows: readonly CanonicalRecord[], key: string): ReadonlyMap<string, readonly CanonicalRecord[]> {
  const grouped = new Map<string, CanonicalRecord[]>();
  for (const row of rows) {
    const value = optionalCanonicalString(row, [key]);
    if (value === undefined) continue;
    grouped.set(value, [...(grouped.get(value) ?? []), row]);
  }
  return grouped;
}

async function readPages(
  source: string,
  query: (from: number, to: number) => PromiseLike<{ data: unknown; error: { message?: string } | null }>,
): Promise<readonly CanonicalRecord[]> {
  const rows: CanonicalRecord[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await query(from, from + PAGE_SIZE - 1);
    if (error !== null) throw new TypeError(`${source}:${error.message ?? "query failed"}`);
    if (!Array.isArray(data)) throw new TypeError(`${source}:invalid rows`);
    rows.push(...data as CanonicalRecord[]);
    if (data.length < PAGE_SIZE) return rows;
  }
}

async function readInBatches(
  source: string,
  ids: readonly string[],
  query: (ids: readonly string[]) => PromiseLike<{ data: unknown; error: { message?: string } | null }>,
): Promise<readonly CanonicalRecord[]> {
  const unique = [...new Set(ids)].sort();
  const rows: CanonicalRecord[] = [];
  for (let index = 0; index < unique.length; index += IN_BATCH_SIZE) {
    const { data, error } = await query(unique.slice(index, index + IN_BATCH_SIZE));
    if (error !== null) throw new TypeError(`${source}:${error.message ?? "query failed"}`);
    if (!Array.isArray(data)) throw new TypeError(`${source}:invalid rows`);
    rows.push(...data as CanonicalRecord[]);
  }
  return rows;
}

function sourceRows(bundle: CanonicalMinimalPlanningBundle): ReadonlyMap<string, CanonicalRecord> {
  const result = new Map<string, CanonicalRecord>();
  for (const [kind, rows, key] of [
    ["operation", bundle.operations, "operation_id"],
    ["allocation", bundle.allocations, "allocation_id"],
    ["item", bundle.items, "item_id"],
    ["payment_component", bundle.paymentComponents, "payment_component_id"],
    ["cash_use", bundle.cashUses, "cash_use_id"],
  ] as const) {
    for (const row of rows) {
      const id = optionalCanonicalString(row, [key]);
      if (id !== undefined) result.set(`${kind}:${id}`, row);
    }
  }
  return result;
}

function financialSourceType(sourceKind: EconomicComponentFact["sourceKind"]): GlobalFoodFinancialComponent["sourceType"] {
  if (sourceKind === "Allocation") return "ALLOCATION";
  if (sourceKind === "Item") return "ITEM";
  if (sourceKind === "Payment_component") return "PAYMENT_COMPONENT";
  if (sourceKind === "Cash_economic_use") return "CASH_USE";
  return "OPERATION";
}

function financialComponents(input: {
  readonly facts: readonly EconomicComponentFact[];
  readonly bundle: CanonicalMinimalPlanningBundle;
  readonly subcategoryRows: readonly CanonicalRecord[];
}): readonly GlobalFoodFinancialComponent[] {
  const subcategoryKeyById = new Map(input.subcategoryRows.flatMap((row) => {
    const id = optionalCanonicalString(row, ["subcategory_id"]);
    const key = optionalCanonicalString(row, ["subcategory_key"]);
    return id === undefined || key === undefined ? [] : [[id, key] as const];
  }));
  const rows = sourceRows(input.bundle);
  const operations = indexRows(input.bundle.operations, "operation_id");
  return input.facts.flatMap((fact) => {
    if (fact.sourceOperation.kind !== "resolved" || fact.subcategory.kind !== "resolved") return [];
    if (fact.economicTiming.kind !== "known" && fact.economicTiming.kind !== "partial") return [];
    const canonicalComponentKey = String(fact.canonicalComponentKey);
    const source = rows.get(canonicalComponentKey);
    const operationId = String(fact.sourceOperation.id);
    const operation = operations.get(operationId);
    const subcategoryKey = subcategoryKeyById.get(String(fact.subcategory.id));
    if (subcategoryKey === undefined) return [];
    const sourceKind = fact.sourceKind;
    const operationTypePrecis = sourceKind === "Item"
      ? nullableString(source, "nom") ?? nullableString(operation, "type_precis")
      : sourceKind === "Payment_component"
        ? nullableString(source, "component_type") ?? nullableString(operation, "type_precis")
        : nullableString(source, "type_precis") ?? nullableString(operation, "type_precis");
    const merchantLabel = nullableString(source, "marchand")
      ?? nullableString(operation, "marchand");
    return fact.economicTiming.segments.flatMap((segment): readonly GlobalFoodFinancialComponent[] => {
      if (segment.economicMonth === null) return [];
      return [{
        canonicalComponentKey,
        economicSegmentKey: String(segment.segmentKey),
        operationId,
        economicMonth: String(segment.economicMonth),
        economicDate: segment.periodStart === null ? null : String(segment.periodStart),
        amount: String(segment.amount),
        subcategoryKey,
        operationTypePrecis,
        merchantLabel,
        articleCount: null,
        sourceType: financialSourceType(sourceKind),
      }];
    });
  });
}

function semanticTier(context: CanonicalRecord): 1 | 2 | 3 | 4 {
  const relation = stringValue(context, "relation_type", "mobility_trip_context_links");
  const validation = stringValue(context, "validation_status", "mobility_trip_context_links");
  if (relation === "ENVELOPING_CONTEXT" || relation === "PRIMARY_CONTEXT") return validation === "CONFIRMED" ? 1 : 2;
  if (relation === "ACCESS_CONTEXT") return 2;
  if (validation === "CONFIRMED") return 2;
  return relation === "STOP_CONTEXT" ? 3 : 4;
}

function momentSemanticFamily(typeKey: string): MobilitySemanticFamily {
  const key = typeKey.normalize("NFD").replace(/[\u0300-\u036f]/gu, "").toLowerCase();
  if (/voyage|week-end|escapade|plage|excursion/u.test(key)) return "TRAVEL";
  if (/boite|soiree|sortie|fete|celebration|anniversaire/u.test(key)) return "LEISURE";
  if (/famille|funera/u.test(key)) return "FAMILY";
  if (/travail|profession/u.test(key)) return "WORK";
  if (/sante|medical/u.test(key)) return "HEALTH";
  if (/achat|maison|entretien|vehicule/u.test(key)) return "PERSONAL";
  return "OTHER";
}

async function mobilityNarrative(input: {
  readonly client: SupabaseClient;
  readonly repository: CanonicalRepository;
  readonly firstMonth: YearMonth;
  readonly lastMonth: YearMonth;
  readonly mobilityLegs: readonly MobilityLegFact[];
}) {
  const start = `${input.firstMonth}-01`;
  const endExclusive = `${addMonths(input.lastMonth, 1)}-01`;
  const tripRows = await readPages("mobility_trips", (from, to) => input.client.from("mobility_trips")
    .select("mobility_trip_id,household_id,start_date,end_date,trip_shape,boundary_status,knowledge_state,start_place_id,end_place_id")
    .eq("household_id", input.repository.context.householdId).eq("is_active", true)
    .lt("start_date", endExclusive).gte("end_date", start)
    .order("start_date").order("mobility_trip_id").range(from, to));
  const tripIds = tripRows.map((row) => stringValue(row, "mobility_trip_id", "mobility_trips"));
  const memberships = await readInBatches("mobility_trip_legs", tripIds, (batch) => input.client.from("mobility_trip_legs")
    .select("mobility_trip_id,mobility_leg_id,sequence_index").in("mobility_trip_id", batch).eq("is_active", true)
    .order("mobility_trip_id").order("sequence_index"));
  const legById = new Map(input.mobilityLegs.map((leg) => [leg.legId, leg]));
  const membershipsByTrip = groupRows(memberships, "mobility_trip_id");
  const trips: readonly MonthlyMobilityNarrativeTripInput[] = tripRows.map((row) => {
    const mobilityTripId = stringValue(row, "mobility_trip_id", "mobility_trips");
    const legs = (membershipsByTrip.get(mobilityTripId) ?? []).map((membership) => {
      const legId = stringValue(membership, "mobility_leg_id", "mobility_trip_legs");
      const leg = legById.get(legId);
      if (leg === undefined) throw new TypeError(`MOBILITY_TRIP_LEG_OUTSIDE_CERTIFIED_CORPUS:${legId}`);
      const sequenceIndex = membership.sequence_index;
      if (typeof sequenceIndex !== "number" || !Number.isInteger(sequenceIndex)) throw new TypeError("MOBILITY_TRIP_SEQUENCE_INVALID");
      return {
        mobilityLegId: leg.legId,
        sequenceIndex,
        travelDate: String(leg.date),
        originPlaceId: leg.origin.placeId === null ? null : String(leg.origin.placeId),
        destinationPlaceId: leg.destination.placeId === null ? null : String(leg.destination.placeId),
        distanceKm: String(leg.distanceKm),
        estimatedFuelLiters: String(leg.estimatedFuelLiters),
        estimatedFuelCost: String(leg.estimatedFuelCost),
      };
    });
    return {
      mobilityTripId,
      householdId: stringValue(row, "household_id", "mobility_trips"),
      startDate: stringValue(row, "start_date", "mobility_trips"),
      endDate: stringValue(row, "end_date", "mobility_trips"),
      tripShape: stringValue(row, "trip_shape", "mobility_trips") as MonthlyMobilityNarrativeTripInput["tripShape"],
      boundaryStatus: stringValue(row, "boundary_status", "mobility_trips"),
      knowledgeState: stringValue(row, "knowledge_state", "mobility_trips") as MonthlyMobilityNarrativeTripInput["knowledgeState"],
      legs,
    };
  });
  const contextRows = await readPages("mobility_trip_context_links", (from, to) => input.client.from("mobility_trip_context_links")
    .select("mobility_trip_context_link_id,mobility_trip_id,life_event_id,moment_id,relation_type,anchor_place_id,validation_status,evidence_refs")
    .eq("household_id", input.repository.context.householdId).eq("is_active", true)
    .in("mobility_trip_id", tripIds).order("mobility_trip_context_link_id").range(from, to));
  const lifeEventIds = contextRows.flatMap((row) => optionalCanonicalString(row, ["life_event_id"]) ?? []);
  const momentIds = contextRows.flatMap((row) => optionalCanonicalString(row, ["moment_id"]) ?? []);
  const [lifeEvents, moments] = await Promise.all([
    readInBatches("life_events", lifeEventIds, (batch) => input.client.from("life_events")
      .select("life_event_id,life_event_type_id,title,primary_place_id").in("life_event_id", batch).order("life_event_id")),
    readInBatches("moments", momentIds, (batch) => input.client.from("moments")
      .select("moment_id,moment_type_id,name,type").eq("household_id", input.repository.context.householdId)
      .in("moment_id", batch).order("moment_id")),
  ]);
  const lifeEventTypes = await readInBatches("life_event_types", lifeEvents.flatMap((row) => optionalCanonicalString(row, ["life_event_type_id"]) ?? []),
    (batch) => input.client.from("life_event_types").select("life_event_type_id,type_key,label").in("life_event_type_id", batch).order("life_event_type_id"));
  const momentTypes = await readInBatches("moment_types", moments.flatMap((row) => optionalCanonicalString(row, ["moment_type_id"]) ?? []),
    (batch) => input.client.from("moment_types").select("moment_type_id,type_key,name").in("moment_type_id", batch).order("moment_type_id"));
  const lifeEventById = indexRows(lifeEvents, "life_event_id");
  const lifeEventTypeById = indexRows(lifeEventTypes, "life_event_type_id");
  const momentById = indexRows(moments, "moment_id");
  const momentTypeById = indexRows(momentTypes, "moment_type_id");
  const contexts: readonly MonthlyMobilityNarrativeContextInput[] = contextRows.map((row) => {
    const lifeEventId = optionalCanonicalString(row, ["life_event_id"]);
    const momentId = optionalCanonicalString(row, ["moment_id"]);
    if ((lifeEventId === undefined) === (momentId === undefined)) throw new TypeError("MOBILITY_CONTEXT_TARGET_INVALID");
    const targetKind = momentId === undefined ? "LIFE_EVENT" : "MOMENT";
    const targetId = momentId ?? lifeEventId!;
    const target = targetKind === "LIFE_EVENT" ? lifeEventById.get(targetId) : momentById.get(targetId);
    if (target === undefined) throw new TypeError(`MOBILITY_CONTEXT_TARGET_MISSING:${targetId}`);
    const typeId = optionalCanonicalString(target, [targetKind === "LIFE_EVENT" ? "life_event_type_id" : "moment_type_id"]);
    const type = typeId === undefined ? undefined : (targetKind === "LIFE_EVENT" ? lifeEventTypeById.get(typeId) : momentTypeById.get(typeId));
    const typeKey = nullableString(type, "type_key") ?? nullableString(target, "type") ?? "unknown";
    return {
      mobilityTripContextLinkId: stringValue(row, "mobility_trip_context_link_id", "mobility_trip_context_links"),
      mobilityTripId: stringValue(row, "mobility_trip_id", "mobility_trip_context_links"),
      targetKind,
      targetRef: `${targetKind === "MOMENT" ? "moment" : "life-event"}:${targetId}`,
      relationType: stringValue(row, "relation_type", "mobility_trip_context_links") as MonthlyMobilityNarrativeContextInput["relationType"],
      semanticFamily: targetKind === "LIFE_EVENT" ? resolveMobilityNarrativeSemanticFamily(typeKey) : momentSemanticFamily(typeKey),
      semanticTier: semanticTier(row),
      validationStatus: stringValue(row, "validation_status", "mobility_trip_context_links") as MonthlyMobilityNarrativeContextInput["validationStatus"],
      displayLabel: nullableString(target, targetKind === "LIFE_EVENT" ? "title" : "name")
        ?? nullableString(type, targetKind === "LIFE_EVENT" ? "label" : "name"),
      anchorPlaceId: nullableString(row, "anchor_place_id"),
      evidenceRefs: stringArray(row.evidence_refs),
    };
  });
  const placeIds = [...new Set([
    ...input.mobilityLegs.flatMap((leg) => [leg.origin.placeId, leg.destination.placeId].flatMap((id) => id === null ? [] : [String(id)])),
    ...contexts.flatMap(({ anchorPlaceId }) => anchorPlaceId === null ? [] : [anchorPlaceId]),
  ])].sort();
  const [placeRows, roleRows] = await Promise.all([
    input.repository.loadEntityRows("places", "place_id", placeIds),
    readInBatches("person_place_roles", placeIds, (batch) => input.client.from("person_place_roles")
      .select("place_id,role").in("person_id", input.repository.context.personIds).in("place_id", batch).order("place_id").order("role")),
  ]);
  const rolesByPlace = groupRows(roleRows, "place_id");
  const places = placeRows.map((row) => {
    const placeId = stringValue(row, "place_id", "referentiel_lieu");
    const explicitRoles = (rolesByPlace.get(placeId) ?? []).flatMap((role) => optionalCanonicalString(role, ["role"]) ?? []);
    return {
      placeId,
      role: resolveMobilityNarrativePlaceRole({ usagePrincipal: nullableString(row, "usage_principal"), explicitRoles }),
      displayLabel: nullableString(row, "nom_canonique"),
      authority: explicitRoles.length > 0 ? "EXPLICIT" as const : "CONFIRMED" as const,
    };
  });
  return buildMonthlyMobilityNarrative({ trips, contexts, places });
}

export async function resolveGlobalBackgroundRhythmsProduction(input: BackgroundRhythmProjectionInput) {
  if (input.months.length !== 12) throw new TypeError(`BACKGROUND_RHYTHMS_PERIOD_MONTH_COUNT:${input.months.length}`);
  const firstMonth = input.months[0]!;
  const lastMonth = input.months.at(-1)!;
  const mobilityRange = { start: parseLocalDate(`${firstMonth}-01`), endExclusive: parseLocalDate(`${addMonths(lastMonth, 1)}-01`) };
  const mobilityLegs = await input.repository.loadMobilityLegFacts(mobilityRange);
  const narrative = await mobilityNarrative({ client: input.client, repository: input.repository, firstMonth, lastMonth, mobilityLegs });
  const fuelRows = input.subcategoryRows.filter((row) => optionalCanonicalString(row, ["subcategory_key"]) === "transport_voiture__carburant");
  if (fuelRows.length !== 1) throw new TypeError(`CAR_FUEL_SUBCATEGORY_AUTHORITY_COUNT:${fuelRows.length}`);
  const food = buildGlobalFoodRhythmProjection({
    startMonth: String(firstMonth),
    endMonth: String(lastMonth),
    financialComponents: financialComponents({ facts: input.minimalBundle.economicFacts, bundle: input.minimalBundle, subcategoryRows: input.subcategoryRows }),
    grocery: input.grocery,
    activityOccurrences: input.occurrences,
    activityCosts: input.activityCosts,
    activityLabels: [...new Set(input.occurrences.map(({ activityId }) => String(activityId)))].sort().map((activityId) => ({ activityId, label: activityId.replaceAll("_", " ") })),
  });
  const carMobility = buildGlobalCarMobilityRhythmProjection({
    startMonth: String(firstMonth),
    endMonth: String(lastMonth),
    mobilityLegs,
    monthlyNarrative: narrative,
    economicFacts: input.minimalBundle.economicFacts,
    fuelSubcategoryId: stringValue(fuelRows[0]!, "subcategory_id", "subcategories"),
  });
  return { food, carMobility };
}
