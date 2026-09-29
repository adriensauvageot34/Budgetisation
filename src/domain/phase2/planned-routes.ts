import Big from "big.js";
import type { PlannedRouteStop, PlannedVehicleEstimate, PlannedFuelEstimate, ProspectivePlaceRef } from "./planned-contract";

export type HistoricalRouteLeg = Readonly<{ originPlaceId: string; destinationPlaceId: string; distanceKm: string;
  fuelLiters: string; method: string; date: string }>;
export const routePlaceIdentity = (stop: Pick<PlannedRouteStop, "placeId" | "label">): string =>
  stop.placeId ? `KNOWN:${stop.placeId}` : `TEXT:${stop.label}`;
export function stopForPlace(ref: ProspectivePlaceRef, label: string,
  source: PlannedRouteStop["endpointSource"], childModule?: PlannedRouteStop["childModule"]): PlannedRouteStop {
  return { label: ref.kind === "TEXT" ? ref.label : label, ...(ref.kind === "KNOWN" ? { placeId: ref.placeId } : {}),
    endpointSource: source, ...(childModule ? { childModule } : {}), distanceToNextKm: null };
}
/** Only exact consecutive identities collapse. No fuzzy place matching. */
export function deduplicateRouteStops(stops: readonly PlannedRouteStop[]): PlannedRouteStop[] {
  const result: PlannedRouteStop[] = [];
  for (const stop of stops) {
    const previous = result.at(-1);
    if (previous && routePlaceIdentity(previous) === routePlaceIdentity(stop)) {
      result[result.length - 1] = { ...previous, distanceToNextKm: stop.distanceToNextKm,
        distanceSource: stop.distanceSource, estimatedFuelLiters: stop.estimatedFuelLiters, evidence: stop.evidence };
    } else result.push(stop);
  }
  return result;
}
/** Ordered stops are the persisted segment chain: each destination is the next origin by construction.
 * There is no second independently ordered segment collection. */
export function routeSegments(stops: readonly PlannedRouteStop[]) {
  return stops.slice(0, -1).map((origin, index) => ({ origin, destination: stops[index + 1]!,
    distanceKm: origin.distanceToNextKm ?? null, distanceSource: origin.distanceSource ?? "MANUAL" }));
}
export function assertRouteContinuity(segments: readonly { origin: PlannedRouteStop; destination: PlannedRouteStop }[]): void {
  for (let index = 1; index < segments.length; index++)
    if (routePlaceIdentity(segments[index - 1]!.destination) !== routePlaceIdentity(segments[index]!.origin))
      throw new TypeError("PLANNED_ROUTE_DISCONTINUOUS");
}
const median = (values: readonly string[]): Big => {
  const sorted = values.map((value) => new Big(value)).sort((a, b) => a.cmp(b));
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle]! : sorted[middle - 1]!.plus(sorted[middle]!).div(2);
};
export function calculateRouteFuel(stops: readonly PlannedRouteStop[], vehicle: PlannedVehicleEstimate): PlannedFuelEstimate {
  if (stops.length < 2 || stops.length > 12 || stops.at(-1)?.distanceToNextKm)
    throw new TypeError("PLANNED_ROUTE_STOPS_INVALID");
  let distance = new Big(0), liters = new Big(0);
  for (const segment of routeSegments(stops)) {
    if (routePlaceIdentity(segment.origin) === routePlaceIdentity(segment.destination))
      throw new TypeError("PLANNED_ROUTE_DUPLICATE_CONSECUTIVE_PLACE");
    if (!segment.distanceKm || !/^(?:0|[1-9]\d{0,4})(?:\.\d{1,3})?$/u.test(segment.distanceKm)
      || new Big(segment.distanceKm).lte(0)) throw new TypeError("PLANNED_ROUTE_DISTANCE_INVALID");
    distance = distance.plus(segment.distanceKm);
    liters = liters.plus(segment.distanceSource === "HISTORICAL_ROUTE" && segment.origin.estimatedFuelLiters
      ? segment.origin.estimatedFuelLiters : new Big(segment.distanceKm).times(vehicle.consumptionL100Km).div(100));
  }
  return { vehicleLabel: vehicle.label, consumptionL100Km: vehicle.consumptionL100Km,
    fuelPricePerLiter: vehicle.fuelPricePerLiter, fuelPriceSource: vehicle.fuelPriceSource,
    ...(vehicle.fuelPriceObservedAt ? { fuelPriceObservedAt: vehicle.fuelPriceObservedAt } : {}),
    ...(vehicle.fuelPriceQuality ? { fuelPriceQuality: vehicle.fuelPriceQuality } : {}),
    distanceKm: distance.toFixed(2), liters: liters.round(3).toFixed(3), cost: liters.times(vehicle.fuelPricePerLiter).round(2).toFixed(2) };
}
export function resolvePlannedRoute(rawStops: readonly PlannedRouteStop[], history: readonly HistoricalRouteLeg[],
  vehicle: PlannedVehicleEstimate) {
  const stops = deduplicateRouteStops(rawStops).map((stop, index, all): PlannedRouteStop => {
    if (index === all.length - 1) return { ...stop, distanceToNextKm: null, distanceSource: undefined, estimatedFuelLiters: undefined, evidence: undefined };
    if (stop.distanceSource === "MANUAL" || !stop.distanceSource && stop.distanceToNextKm)
      return { ...stop, distanceSource: "MANUAL", evidence: undefined, estimatedFuelLiters: undefined };
    const destination = all[index + 1]!;
    const directed = stop.placeId && destination.placeId ? history.filter((leg) => leg.originPlaceId === stop.placeId
      && leg.destinationPlaceId === destination.placeId) : [];
    const latest = [...directed].sort((a, b) => b.date.localeCompare(a.date) || a.method.localeCompare(b.method))[0];
    const legs = latest ? directed.filter((leg) => leg.method === latest.method) : [];
    if (!legs.length) return { ...stop, distanceToNextKm: null, evidence: undefined, estimatedFuelLiters: undefined, distanceSource: undefined };
    const distances = legs.map((leg) => leg.distanceKm).sort((a, b) => new Big(a).cmp(b));
    const dates = legs.map((leg) => leg.date).sort();
    return { ...stop, distanceToNextKm: median(distances).toFixed(3), distanceSource: "HISTORICAL_ROUTE",
      estimatedFuelLiters: median(legs.map((leg) => leg.fuelLiters)).toFixed(6), evidence: {
        method: latest!.method, observationCount: legs.length, minimumKm: distances[0]!, maximumKm: distances.at(-1)!,
        firstDate: dates[0]!, lastDate: dates.at(-1)! } };
  });
  const complete = stops.length >= 2 && stops.slice(0, -1).every((stop) => !!stop.distanceToNextKm);
  const status = !complete ? "PARTIAL" : stops.slice(0, -1).every((stop) => stop.distanceSource === "HISTORICAL_ROUTE")
    ? "KNOWN" : "MANUAL";
  return { stops, segments: routeSegments(stops), status,
    fuelEstimate: complete ? calculateRouteFuel(stops, vehicle) : null };
}
