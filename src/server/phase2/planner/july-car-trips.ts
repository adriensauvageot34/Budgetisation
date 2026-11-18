import "server-only";
import Big from "big.js";
import type { MobilityLegFact } from "@/analytics/facts";
import { parseLocalDate } from "@/core/time";
import { fuelEconomicCost, type PlannedCarSnapshot } from "@/domain/phase2/planned-car";
import type { PlannedRouteStop, PlannedVehicleEstimate } from "@/domain/phase2/planned-contract";
import type { PlannedPlaceOption } from "@/domain/phase2/planned-places";
import type { MobilityIntent, PhysicalJourneyRequirement } from "@/domain/phase2/planner/mobility-contract";
import { JULY_COMPOSER_MONTH, reconstructedId } from "@/domain/phase2/planner/realized-month-entry";
import { parsePlanSemanticState } from "@/domain/phase2/planner/semantic-state";
import type { CanonicalRepository } from "@/server/canonical/repository";
import { validateContextGraph } from "./context-selections";

const range = { start: parseLocalDate("2026-07-01"), endExclusive: parseLocalDate("2026-08-01") };
const activityTypes = new Set(["visite_famille", "activite_loisir"]);
export const readJulyCarLegs = async (canonical: CanonicalRepository) =>
  (await canonical.loadMobilityLegFacts(range)).filter(leg => leg.source.status === "CERTIFIED_SOURCE");

export async function addJulyCarTrips(canonical: CanonicalRepository, places: readonly PlannedPlaceOption[],
  vehicle: PlannedVehicleEstimate | null, draft: unknown) {
  const state = parsePlanSemanticState(draft);
  if (state.targetMonth !== JULY_COMPOSER_MONTH) throw new TypeError("JULY_MOBILITY_MONTH_INVALID");
  if (!vehicle?.vehicleId) return { state, count: 0 };
  const [occurrences, legs] = await Promise.all([canonical.loadActivityOccurrences(range), readJulyCarLegs(canonical)]);
  const confirmed = occurrences.filter(event => event.validationStatus === "Confirmé" && event.startDate === event.endDate
    && activityTypes.has(String(event.activityId)));
  const events = new Map(confirmed.map(event => [reconstructedId(state.targetMonth, `event-${event.lifeEventId}`), event]));
  const details = new Map((await canonical.loadLifeEventRecords(confirmed.map(event => String(event.lifeEventId))))
    .map(row => [row.life_event_id, row.primary_place_id]));
  const placeNames = new Map(places.map(place => [place.placeId, place.name]));
  const routeFor = (date: string, venue: string) => {
    const day = legs.filter(leg => leg.date === date && leg.vehicleId === vehicle.vehicleId
      && leg.origin.placeId && leg.destination.placeId
      && placeNames.has(leg.origin.placeId) && placeNames.has(leg.destination.placeId));
    const inbound = day.filter(leg => leg.destination.placeId === venue && leg.origin.placeId !== venue);
    const outbound = day.filter(leg => leg.origin.placeId === venue && leg.destination.placeId !== venue);
    if (inbound.length !== 1 || outbound.length !== 1) return null;
    const [first] = inbound, [second] = outbound;
    return [first!, second!] as const;
  };
  const candidates = state.contexts.flatMap(context => {
    const event = events.get(context.contextOccurrenceId), venue = event && details.get(event.lifeEventId);
    if (!event || typeof venue !== "string" || context.fields.plannedDate !== event.startDate) return [];
    const pair = routeFor(event.startDate, venue);
    return pair ? [{ context, pair, venue }] : [];
  });
  const claimed = new Map<string, number>();
  for (const { pair } of candidates) for (const leg of pair) claimed.set(leg.legId, (claimed.get(leg.legId) ?? 0) + 1);
  const byContext = new Map(candidates.map(candidate => [candidate.context.contextOccurrenceId, candidate]));
  let count = 0;
  const contexts = state.contexts.map(context => {
    const id = context.contextOccurrenceId, candidate = byContext.get(id);
    if (!candidate || candidate.pair.some(leg => claimed.get(leg.legId) !== 1)
      || context.status !== "ACTIVE" || context.parentContextOccurrenceId
      || !["family-visit", "activity"].includes(context.templateKey) || context.slotSelections.transport
      || context.fields.placeRef != null || state.preferences.anchors.includes(id) || state.preferences.flexibility[id] === "PRESERVE") return context;
    const { pair: [inbound, outbound], venue } = candidate;
    const start = String(inbound.origin.placeId), end = String(outbound.destination.placeId);
    const returnRequired = start === end;
    if (returnRequired && (context.templateKey !== "family-visit"
      || context.fields.endDate != null && context.fields.endDate !== context.fields.plannedDate)) return context;
    const place = (placeId: string) => ({ kind: "KNOWN" as const, placeId });
    const stops = [start, venue, end].map((placeId, index): PlannedRouteStop => ({
      placeId, label: placeNames.get(placeId)!,
      endpointSource: index === (returnRequired ? 1 : 2) ? "ROOT_PLACE" : "DIRECT_PLACE",
      ...(index < 2 ? { distanceSource: "HISTORICAL_ROUTE",
        distanceToNextKm: new Big(candidate.pair[index]!.distanceKm).toFixed(3) } : {}),
    }));
    count++;
    return { ...context,
      fields: returnRequired ? { ...context.fields, endDate: context.fields.plannedDate,
        fieldSchemaVersion: "context-fields@v4" } : context.fields,
      slotSelections: { ...context.slotSelections, transport: { items: [{
        selectionId: reconstructedId(state.targetMonth, `mobility:${id}`), optionKey: "car", kind: "MOBILITY_INTENT",
        provenance: "EXPLICIT_USER_DECISION", origin: place(start), destination: place(returnRequired ? venue : end),
        returnRequired, pricing: { fare: { kind: "UNKNOWN" }, parking: { kind: "UNKNOWN" },
          fundingAllocations: [], preference: "FASTEST" },
        route: { version: "composer-mobility-route@v1", stops,
          vehicleRef: { vehicleId: vehicle.vehicleId, labelAtSelection: vehicle.label, provenance: "EXPLICIT_USER_DECISION" } },
      }] } },
    };
  });
  const next = parsePlanSemanticState({ ...state, contexts });
  validateContextGraph(next);
  return { state: next, count };
}

export function julyCarSnapshot(journey: PhysicalJourneyRequirement, intent: MobilityIntent,
  legs: readonly MobilityLegFact[], vehicle: PlannedVehicleEstimate): PlannedCarSnapshot | null {
  if (journey.outbound.kind !== "DATED" || (journey.returnLeg
    && (journey.returnLeg.kind !== "DATED" || journey.returnLeg.date !== journey.outbound.date))) return null;
  const date = journey.outbound.date, stops = intent.route?.stops;
  if (!stops || stops.length !== journey.stops.length || stops.length < 2
    || journey.stops.some((place, index) => place.kind !== "KNOWN" || place.placeId !== stops[index]?.placeId)) return null;
  const matched: MobilityLegFact[] = [];
  for (const [index, stop] of stops.slice(0, -1).entries()) {
    if (stop.distanceSource !== "HISTORICAL_ROUTE" || stop.distanceToNextKm == null) return null;
    const next = stops[index + 1]!;
    const options = legs.filter(leg => leg.date === date && leg.vehicleId === vehicle.vehicleId
      && leg.origin.placeId === stop.placeId && leg.destination.placeId === next.placeId
      && new Big(leg.distanceKm).toFixed(3) === new Big(stop.distanceToNextKm!).toFixed(3));
    if (options.length !== 1 || matched.some(leg => leg.legId === options[0]!.legId)) return null;
    matched.push(options[0]!);
  }
  const first = matched[0]!, price = first.fuel.pricePerLiter;
  if (matched.some(leg => leg.fuel.pricePeriod !== first.fuel.pricePeriod || !new Big(leg.fuel.pricePerLiter).eq(price))) return null;
  const segments = matched.map(leg => ({ distanceKm: leg.distanceKm, liters: leg.estimatedFuelLiters }));
  const { distance, liters } = segments.reduce((sum, leg) => ({
    distance: sum.distance.plus(leg.distanceKm), liters: sum.liters.plus(leg.liters),
  }), { distance: new Big(0), liters: new Big(0) });
  const calculatedAt = `${date}T00:00:00.000Z`;
  const manualPrice = intent.route?.manualFuelPrice;
  const pricePerLiter = manualPrice ?? new Big(price).toString();
  return {
    estimateVersion: "planned-car-live@v2", preference: intent.pricing?.preference ?? "FASTEST",
    vehicleId: first.vehicleId, vehicleLabel: vehicle.label, plannedDate: date, plannedTime: journey.outbound.time,
    timeKind: "DEPARTURE", calculatedAt,
    route: { provider: "HISTORICAL_ROUTE", distanceKm: distance.toString(), liters: liters.toString(), durationSeconds: null,
      geometry: [], geometryHash: null, hasToll: null, segments, timeBasis: "FALLBACK", sampleTimes: [],
      routeMethodRef: first.routeMethodRef, consumptionModelRef: first.consumptionModelRef },
    fuelPrice: { pricePerLiter, source: manualPrice ? "MANUAL" : "CANONICAL_OBSERVATION", methodRef: manualPrice ? "manual" : first.fuel.source,
      observedAt: manualPrice ? calculatedAt : `${first.fuel.pricePeriod}-01`, calculatedAt,
      quality: "FALLBACK", sampleCount: 1, radiusKm: null, minimum: pricePerLiter, maximum: pricePerLiter },
    fuelEconomicCost: fuelEconomicCost(liters.toString(), pricePerLiter),
    toll: { amount: null, status: "UNKNOWN", currency: "EUR", provider: "NONE", methodRef: "historical-trip-unknown",
      routeImportedFrom: null, geometryHash: null, components: [] }, fallbacks: [],
  };
}
