import "server-only";
import Big from "big.js";
import type { PlannedPlaceOption } from "@/domain/phase2/planned-places";
import type { PlannedVehicleEstimate, PlannedRouteStop } from "@/domain/phase2/planned-contract";
import { carFuelEstimate, combineCarJourney, fuelEconomicCost, parseRouteCoordinates, type CarRouteFacts, type FuelPriceReference,
  type PlannedCarRequest, type PlannedCarResult, type PlannedCarSnapshot } from "@/domain/phase2/planned-car";
import { assertVisitTiming, parseVisitTiming, splitVisitRoute } from "@/domain/phase2/planned-visits";
import { resolvePlannedRoute, type HistoricalRouteLeg } from "@/domain/phase2/planned-routes";
import { derivePlannedPlaceRoles } from "@/domain/phase2/planned-place-rules";
import { ASSET_MODULES } from "@/domain/phase2/planned-assets";
import { FrenchOfficialFuelPriceProvider, HereTollProvider, TomTomRouteProvider, unknownToll } from "./planned-car-providers";

export function parsePlannedCarRequest(raw: unknown): PlannedCarRequest {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new TypeError("PLANNED_ROUTE_REQUEST_INVALID");
  const value = raw as Record<string, unknown>;
  if (Object.keys(value).some((key) => !["stops", "plannedDate", "plannedTime", "timeKind", "preference", "manualFuelPrice", "tripTiming"].includes(key))
    || !Array.isArray(value.stops) || value.stops.length < 2 || value.stops.length > 12) throw new TypeError("PLANNED_ROUTE_REQUEST_INVALID");
  if (value.plannedDate !== null && (typeof value.plannedDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/u.test(value.plannedDate)
    || !Number.isFinite(Date.parse(value.plannedDate)))) throw new TypeError("PLANNED_ROUTE_DATE_INVALID");
  if (value.plannedTime != null && (typeof value.plannedTime !== "string" || !/^(?:[01]\d|2[0-3]):[0-5]\d$/u.test(value.plannedTime)
    || !value.plannedDate)) throw new TypeError("PLANNED_ROUTE_TIME_INVALID");
  if (value.timeKind !== undefined && !["DEPARTURE", "ARRIVAL"].includes(String(value.timeKind))) throw new TypeError("PLANNED_ROUTE_TIME_INVALID");
  if (value.preference !== undefined && !["FASTEST", "AVOID_TOLLS"].includes(String(value.preference))) throw new TypeError("PLANNED_ROUTE_PREFERENCE_INVALID");
  if (value.manualFuelPrice !== undefined && (typeof value.manualFuelPrice !== "string" || !/^\d(?:\.\d{1,3})?$/u.test(value.manualFuelPrice)
    || new Big(value.manualFuelPrice).lte(0))) throw new TypeError("PLANNED_ROUTE_PRICE_INVALID");
  const stops: PlannedRouteStop[] = value.stops.map((rawStop: unknown) => {
    if (!rawStop || typeof rawStop !== "object" || Array.isArray(rawStop)) throw new TypeError("PLANNED_ROUTE_STOP_INVALID");
    const stop = rawStop as PlannedRouteStop;
    if (Object.keys(stop).some((key) => !["label", "placeId", "distanceToNextKm", "endpointSource", "childModule", "distanceSource", "estimatedFuelLiters", "evidence", "coordinates"].includes(key))
      || typeof stop.label !== "string" || !stop.label.trim() || stop.label.length > 120
      || stop.placeId !== undefined && !/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/iu.test(stop.placeId)
      || stop.distanceToNextKm != null && stop.distanceToNextKm !== "" && !/^(?:0|[1-9]\d{0,4})(?:\.\d{1,3})?$/u.test(stop.distanceToNextKm)
      || stop.endpointSource !== undefined && !["ROOT_PLACE", "CHILD_LOCAL_PLACE", "DIRECT_PLACE"].includes(stop.endpointSource)
      || (stop.endpointSource === "CHILD_LOCAL_PLACE") !== (stop.childModule !== undefined)
      || stop.childModule !== undefined && (stop.childModule === "transport" || !ASSET_MODULES.includes(stop.childModule))
      || stop.distanceSource !== undefined && !["TOMTOM", "HISTORICAL_ROUTE", "MANUAL"].includes(stop.distanceSource)) throw new TypeError("PLANNED_ROUTE_STOP_INVALID");
    return { label: stop.label.trim(), ...(stop.placeId ? { placeId: stop.placeId } : {}), endpointSource: stop.endpointSource, childModule: stop.childModule,
      distanceToNextKm: stop.distanceToNextKm || null, distanceSource: stop.distanceSource,
      ...(stop.coordinates ? { coordinates: parseRouteCoordinates(stop.coordinates) } : {}) };
  });
  const tripTiming = value.tripTiming === undefined ? undefined : parseVisitTiming(value.tripTiming);
  if (tripTiming) {
    assertVisitTiming(tripTiming, value.plannedDate as string | null);
    if (value.plannedTime !== undefined && value.plannedTime !== tripTiming.outbound.time
      || value.timeKind !== undefined && value.timeKind !== "DEPARTURE") throw new TypeError("PLANNED_VISIT_TIMING_INVALID");
  }
  return { stops, ...(tripTiming ? { tripTiming } : {}), plannedDate: value.plannedDate as string | null, plannedTime: value.plannedTime as string | null | undefined,
    timeKind: value.timeKind as PlannedCarRequest["timeKind"], preference: value.preference as PlannedCarRequest["preference"], manualFuelPrice: value.manualFuelPrice as string | undefined };
}
type Facts = { places: readonly PlannedPlaceOption[]; vehicle: PlannedVehicleEstimate | null; history: readonly HistoricalRouteLeg[] };
type Providers = { route: Pick<TomTomRouteProvider, "estimateCarRoute" | "geocode">; fuel: Pick<FrenchOfficialFuelPriceProvider, "getReference">; toll: Pick<HereTollProvider, "estimateTolls"> };
/** Same server service for the builder action, Preview and Save. It writes no canonical fact. */
export async function estimatePlannedCar(raw: PlannedCarRequest, facts: Facts, providers: Providers = {
  route: new TomTomRouteProvider(), fuel: new FrenchOfficialFuelPriceProvider(), toll: new HereTollProvider(),
}): Promise<PlannedCarResult> {
  const input = parsePlannedCarRequest(raw);
  if (!input.tripTiming) return estimateCarDirection(input, facts, providers);
  const home = facts.places.find((p) => derivePlannedPlaceRoles(p).includes("OWN_HOME"));
  if (!home) throw new TypeError("PLANNED_VISIT_RETURN_HOME_REQUIRED");
  const split = splitVisitRoute(input.stops, home.placeId), timing = input.tripTiming;
  // Both directions use the same current SP95 reference. The route/toll computations remain independent.
  const prices = new Map<string, Promise<FuelPriceReference | null>>();
  const shared = { ...providers, fuel: { getReference(origin: Parameters<Providers["fuel"]["getReference"]>[0]) {
    const key = JSON.stringify(origin);
    if (!prices.has(key)) prices.set(key, providers.fuel.getReference(origin));
    return prices.get(key)!;
  } } };
  const directions = async (preference: NonNullable<PlannedCarRequest["preference"]>) => {
    const [outbound, returning] = await Promise.all([
      estimateCarDirection({ ...input, tripTiming: undefined, stops: split.outbound, plannedDate: timing.outbound.date, plannedTime: timing.outbound.time, timeKind: "DEPARTURE", preference }, facts, shared, false),
      estimateCarDirection({ ...input, tripTiming: undefined, stops: split.return, plannedDate: timing.return.date, plannedTime: timing.return.time, timeKind: "DEPARTURE", preference }, facts, shared, false),
    ]);
    const snapshot = outbound.snapshot && returning.snapshot ? combineCarJourney(outbound.snapshot, returning.snapshot, timing) : null;
    return { snapshot, stops: [...outbound.stops.slice(0, -1), ...returning.stops],
      status: outbound.status === "LIVE" && returning.status === "LIVE" ? "LIVE" as const : snapshot ? "FALLBACK" as const : "PARTIAL" as const,
      messages: [...outbound.messages.map((m) => `Aller : ${m}`), ...returning.messages.map((m) => `Retour : ${m}`)] };
  };
  const primary = await directions(input.preference ?? "FASTEST"), variants: PlannedCarSnapshot[] = primary.snapshot ? [primary.snapshot] : [];
  if (primary.snapshot?.preference === "FASTEST" && (primary.snapshot.route.hasToll || primary.snapshot.toll.amount && new Big(primary.snapshot.toll.amount).gt(0))) {
    const alternate = await directions("AVOID_TOLLS");
    if (alternate.snapshot?.journey?.outbound.route.provider === "TOMTOM" && alternate.snapshot.journey.return.route.provider === "TOMTOM") variants.push(alternate.snapshot);
    else primary.messages.push("La variante complète sans péage n’est pas disponible pour le moment.");
  }
  return { ...primary, variants, fuelEstimate: primary.snapshot ? carFuelEstimate(primary.snapshot) : null };
}
async function estimateCarDirection(raw: PlannedCarRequest, facts: Facts, providers: Providers, includeVariants = true): Promise<PlannedCarResult> {
  const input = parsePlannedCarRequest(raw), vehicle = facts.vehicle;
  if (!vehicle?.vehicleId) throw new TypeError("PLANNED_EXPENSE_VEHICLE_UNAVAILABLE");
  // Do not attach the Peugeot model to an unrelated household vehicle.
  if (vehicle.fuelType !== "SP95" || !/Peugeot\s*207/iu.test(vehicle.label)) throw new TypeError("PLANNED_EXPENSE_VEHICLE_MODEL_UNAVAILABLE");
  for (const stop of input.stops) if (stop.placeId && !facts.places.some((place) => place.placeId === stop.placeId)) throw new TypeError("PLANNED_ROUTE_PLACE_INVALID");
  const messages: string[] = [], fallbacks: string[] = [];
  let stops = [...input.stops];
  const home = facts.places.find((p) => derivePlannedPlaceRoles(p).includes("OWN_HOME"));
  const reference = home?.coordinates ?? facts.places.find((p) => p.placeId === input.stops[0]?.placeId)?.coordinates;
  try {
    stops = await Promise.all(input.stops.map(async (stop) => {
      const place = facts.places.find((p) => p.placeId === stop.placeId);
      const coordinates = place?.coordinates ?? (stop.coordinates?.source === "USER_DECLARED" ? stop.coordinates : undefined)
        ?? await providers.route.geocode(place ? [place.address, place.commune, "France"].filter(Boolean).join(", ") || place.name : stop.label, reference);
      return { ...stop, label: place?.name ?? stop.label, coordinates };
    }));
  } catch { fallbacks.push("GEOCODING_UNAVAILABLE"); messages.push("Précisez une adresse exacte ou les coordonnées des lieux non résolus."); }
  let price: FuelPriceReference | null = null;
  const pricePromise = (async () => {
    try { if (reference ?? stops[0]?.coordinates) price = await providers.fuel.getReference((reference ?? stops[0]!.coordinates)!); } catch { fallbacks.push("OFFICIAL_PRICE_UNAVAILABLE"); }
    if (!price && vehicle.fuelPricePerLiter && new Big(vehicle.fuelPricePerLiter).gt(0)) price = {
      pricePerLiter: vehicle.fuelPricePerLiter, source: "CANONICAL_OBSERVATION", methodRef: "existing-compatible-fuel-price@v1", observedAt: vehicle.fuelPriceObservedAt ?? new Date().toISOString(),
      calculatedAt: new Date().toISOString(), quality: "FALLBACK", sampleCount: 1, radiusKm: null, minimum: vehicle.fuelPricePerLiter, maximum: vehicle.fuelPricePerLiter,
    };
    if (!price && input.manualFuelPrice) price = { pricePerLiter: input.manualFuelPrice, source: "MANUAL", methodRef: "user-declared-fuel-price@v1",
      observedAt: new Date().toISOString(), calculatedAt: new Date().toISOString(), quality: "FALLBACK", sampleCount: 0, radiusKm: null, minimum: input.manualFuelPrice, maximum: input.manualFuelPrice };
    if (price?.source !== "FR_GOV_FUEL_INSTANT_V2") fallbacks.push(price ? "FUEL_PRICE_FALLBACK" : "FUEL_PRICE_UNAVAILABLE");
  })();
  const routeInput = { coordinates: stops.flatMap((s) => s.coordinates ? [s.coordinates] : []), plannedDate: input.plannedDate,
    plannedTime: input.plannedTime ?? null, timeKind: input.timeKind ?? "DEPARTURE" as const, preference: input.preference ?? "FASTEST" as const };
  let route: CarRouteFacts | null = null;
  try { if (routeInput.coordinates.length === stops.length) route = await providers.route.estimateCarRoute(routeInput); } catch { fallbacks.push("TOMTOM_UNAVAILABLE"); }
  let status: PlannedCarResult["status"] = "LIVE";
  if (!route) {
    const fallback = resolvePlannedRoute(stops.map((s, i) => {
      const directed = facts.history.some((leg) => leg.originPlaceId === s.placeId && leg.destinationPlaceId === stops[i + 1]?.placeId);
      return { ...s, distanceSource: directed || s.distanceSource === "TOMTOM" ? undefined : s.distanceSource,
        distanceToNextKm: directed || s.distanceSource === "TOMTOM" ? null : s.distanceToNextKm };
    }), facts.history, vehicle);
    stops = fallback.stops;
    if (fallback.fuelEstimate) route = { provider: fallback.status === "KNOWN" ? "HISTORICAL_ROUTE" : "MANUAL", distanceKm: fallback.fuelEstimate.distanceKm,
      liters: fallback.fuelEstimate.liters, durationSeconds: null, geometry: [], geometryHash: null, hasToll: null,
      segments: stops.slice(0, -1).map((s) => ({ distanceKm: s.distanceToNextKm!, liters: s.estimatedFuelLiters ?? new Big(s.distanceToNextKm!).times(vehicle.consumptionL100Km).div(100).toFixed(6) })),
      timeBasis: "FALLBACK", sampleTimes: [], routeMethodRef: "exact-directed-history-or-manual@v1", consumptionModelRef: "historical-consumption-fallback@v1" };
    status = route ? "FALLBACK" : "PARTIAL";
    messages.push(route ? `Impossible de recalculer l’itinéraire pour le moment. Utilisation ${fallback.status === "KNOWN" ? "du trajet historique" : "des distances disponibles"}.`
      : "Le trajet reste non calculé. Précisez les lieux ou les distances.");
  }
  await pricePromise;
  if (!route) return { stops, status: "PARTIAL", variants: [], snapshot: null, fuelEstimate: null, messages };
  const snapshotFor = async (r: CarRouteFacts, preference: NonNullable<PlannedCarRequest["preference"]>): Promise<PlannedCarSnapshot> => {
    const toll = r.provider === "TOMTOM" ? await providers.toll.estimateTolls(r) : unknownToll(r);
    return {
    estimateVersion: "planned-car-live@v2", vehicleId: vehicle.vehicleId!, vehicleLabel: vehicle.label, preference,
    plannedDate: input.plannedDate, plannedTime: input.plannedTime ?? null, timeKind: input.timeKind ?? "DEPARTURE", calculatedAt: new Date().toISOString(),
    route: r, fuelPrice: price, fuelEconomicCost: price ? fuelEconomicCost(r.liters, (price as FuelPriceReference).pricePerLiter) : null,
    toll, fallbacks: [...fallbacks, ...(toll.amount === null ? ["TOLL_UNAVAILABLE"] : [])],
  }; };
  // Work on the likely useful alternate while HERE imports the primary geometry.
  const pendingAlternate = includeVariants && input.preference !== "AVOID_TOLLS" && route.provider === "TOMTOM" && route.hasToll
    ? providers.route.estimateCarRoute({ ...routeInput, preference: "AVOID_TOLLS" }).then((r) => snapshotFor(r, "AVOID_TOLLS")).catch(() => null) : null;
  const snapshot = await snapshotFor(route, input.preference ?? "FASTEST");
  const variants = [snapshot];
  if (includeVariants && snapshot.preference === "FASTEST" && route.provider === "TOMTOM" && (route.hasToll || snapshot.toll.amount && new Big(snapshot.toll.amount).gt(0))) {
    try { const alternate = pendingAlternate ? await pendingAlternate : await snapshotFor(await providers.route.estimateCarRoute({ ...routeInput, preference: "AVOID_TOLLS" }), "AVOID_TOLLS");
      if (alternate) variants.push(alternate); else messages.push("La variante sans péage n’est pas disponible pour le moment."); }
    catch { messages.push("La variante sans péage n’est pas disponible pour le moment."); }
  }
  if (snapshot.toll.amount === null) messages.push("Péage non disponible pour le moment. Vous pouvez saisir un montant.");
  if (!price) messages.push("Consommation estimée ; prix carburant indisponible.");
  return { stops: stops.map((stop, index) => route!.provider === "TOMTOM" ? { ...stop, distanceToNextKm: route!.segments[index]?.distanceKm ?? null,
    distanceSource: index < stops.length - 1 ? "TOMTOM" : undefined, estimatedFuelLiters: undefined, evidence: undefined } : stop),
    snapshot, variants, fuelEstimate: carFuelEstimate(snapshot), status, messages };
}
