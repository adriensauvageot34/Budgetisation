import Big from "big.js";
import type { CostItem, PlannedExpenseDraft, PlannedFuelEstimate, PlannedRouteStop } from "./planned-contract";
import { rootAssetModule } from "./planned-assets";

/** One versioned vehicle model. Historical average consumption remains a fallback only. */
export const PEUGEOT_207_ROUTING_PROFILE = Object.freeze({
  modelKey: "peugeot-207-1.4-vti95-bvm5-sp95@tomtom-v1", fuelType: "SP95",
  vehicleWeight: 1170, vehicleMaxSpeed: 185, fuelEnergyDensityInMJoulesPerLiter: 34.2,
  accelerationEfficiency: 0.33, decelerationEfficiency: 0.83, uphillEfficiency: 0.27, downhillEfficiency: 0.51,
  auxiliaryPowerInLitersPerHour: 0,
  constantSpeedConsumptionInLitersPerHundredkm: "10,10.0:20,7.9:30,6.7:40,5.9:50,5.6:60,5.5:70,5.3:80,5.3:90,5.3:100,5.6:110,6.1:120,6.6:130,7.3",
});
export type RouteCoordinates = Readonly<{ latitude: number; longitude: number; source: "CANONICAL" | "TOMTOM_GEOCODE" | "USER_DECLARED" }>;
export type RoutePreference = "FASTEST" | "AVOID_TOLLS";
export type CarRouteFacts = Readonly<{
  provider: "TOMTOM" | "HISTORICAL_ROUTE" | "MANUAL";
  distanceKm: string; durationSeconds: number | null; liters: string;
  geometry: readonly { encodedPolyline: string; precision: 5 | 7 }[];
  geometryHash: string | null; hasToll: boolean | null;
  segments: readonly { distanceKm: string; liters: string }[];
  timeBasis: "PLANNED_DEPARTURE" | "PLANNED_ARRIVAL" | "UNKNOWN_TIME_MEDIAN_08_14_18" | "TYPICAL_NO_DATE" | "FALLBACK";
  sampleTimes: readonly string[];
  routeMethodRef: string; consumptionModelRef: string;
}>;
export type FuelPriceReference = Readonly<{
  pricePerLiter: string; source: "FR_GOV_FUEL_INSTANT_V2" | "CANONICAL_OBSERVATION" | "MANUAL";
  methodRef: string; observedAt: string; calculatedAt: string;
  quality: "FRESH" | "STALE" | "FALLBACK"; sampleCount: number; radiusKm: number | null;
  minimum: string; maximum: string;
}>;
export type TollEstimate = Readonly<{
  status: "KNOWN" | "NONE" | "UNAVAILABLE" | "UNKNOWN";
  amount: string | null; currency: "EUR";
  provider: "HERE" | "NONE"; methodRef: string;
  routeImportedFrom: "TOMTOM" | null; geometryHash: string | null;
  components: readonly { name: string; amount: string }[];
}>;
export type PlannedCarSnapshot = Readonly<{
  estimateVersion: "planned-car-live@v2"; preference: RoutePreference; vehicleId: string; vehicleLabel: string;
  plannedDate: string | null; plannedTime: string | null; timeKind: "DEPARTURE" | "ARRIVAL";
  calculatedAt: string; route: CarRouteFacts; fuelPrice: FuelPriceReference | null;
  fuelEconomicCost: string | null; toll: TollEstimate; fallbacks: readonly string[];
}>;
export type PlannedCarRequest = Readonly<{ stops: readonly PlannedRouteStop[]; plannedDate: string | null;
  plannedTime?: string | null; timeKind?: "DEPARTURE" | "ARRIVAL"; preference?: RoutePreference; manualFuelPrice?: string }>;
export interface PlannedRouteProvider { estimateCarRoute(input: { coordinates: readonly RouteCoordinates[];
  plannedDate: string | null; plannedTime: string | null; timeKind: "DEPARTURE" | "ARRIVAL"; preference: RoutePreference }): Promise<CarRouteFacts> }
export interface FuelPriceProvider { getReference(origin: RouteCoordinates): Promise<FuelPriceReference | null> }
export interface TollProvider { estimateTolls(route: CarRouteFacts): Promise<TollEstimate> }
export type PlannedCarResult = Readonly<{ stops: readonly PlannedRouteStop[]; snapshot: PlannedCarSnapshot | null;
  variants: readonly PlannedCarSnapshot[]; fuelEstimate: PlannedFuelEstimate | null; status: "LIVE" | "FALLBACK" | "PARTIAL"; messages: readonly string[] }>;

export const fuelEconomicCost = (liters: string, price: string): string => new Big(liters).times(price).toFixed(2);
export function transportTotals(fuel: string | null, toll: string | null, parking = "0") {
  return { economic: fuel === null || toll === null ? null : new Big(fuel).plus(toll).plus(parking).toFixed(2),
    cash: toll === null ? null : new Big(toll).plus(parking).toFixed(2) };
}
export function carFuelEstimate(snapshot: PlannedCarSnapshot): PlannedFuelEstimate | null {
  if (!snapshot.fuelPrice || snapshot.fuelEconomicCost === null) return null;
  return { vehicleLabel: snapshot.vehicleLabel, consumptionL100Km: new Big(snapshot.route.liters).times(100).div(snapshot.route.distanceKm).toFixed(3),
    fuelPricePerLiter: snapshot.fuelPrice.pricePerLiter, fuelPriceSource: snapshot.fuelPrice.source,
    fuelPriceObservedAt: snapshot.fuelPrice.observedAt, fuelPriceQuality: snapshot.fuelPrice.quality,
    distanceKm: snapshot.route.distanceKm, liters: snapshot.route.liters, cost: snapshot.fuelEconomicCost };
}
/** Generated fuel and toll lines enter the existing financial engine. Explicit toll/parking lines survive recalculation. */
export function applyCarResult(draft: PlannedExpenseDraft, result: PlannedCarResult, makeId: () => string): PlannedExpenseDraft {
  const root = rootAssetModule(draft.familyKey, draft.subtypeKey);
  const costs = draft.costItems.filter((item) => item.assetKey !== "transport:fuel_usage"
    && !(item.assetKey === "transport:toll" && item.priceSource === "CALCULATED"));
  const previousFuel = draft.costItems.find((item) => item.assetKey === "transport:fuel_usage");
  if (result.fuelEstimate && new Big(result.fuelEstimate.cost).gt(0)) costs.push({
    id: previousFuel?.id ?? makeId(), assetKey: "transport:fuel_usage", label: "Essence utilisée", quantity: "1",
    unitAmount: result.fuelEstimate.cost, baselineKey: null, modulePath: [root], priceSource: "CALCULATED",
    priceSourceLabel: result.fuelEstimate.fuelPriceSource,
  });
  const toll = result.snapshot?.toll;
  if (toll?.amount && new Big(toll.amount).gt(0) && !costs.some((item) => item.assetKey === "transport:toll")) costs.push({
    id: draft.costItems.find((item) => item.assetKey === "transport:toll")?.id ?? makeId(), assetKey: "transport:toll",
    label: "Péage estimé", quantity: "1", unitAmount: toll.amount, baselineKey: null, modulePath: [root],
    priceSource: "CALCULATED", priceSourceLabel: "HERE · route TomTom importée", fundingAllocations: [{ source: "BANK", amount: toll.amount }],
  });
  return { ...draft, costItems: costs, context: { ...draft.context, route: { ...draft.context.route, mode: "CAR",
    stops: result.stops, ...(result.fuelEstimate ? { fuelEstimate: result.fuelEstimate } : { fuelEstimate: undefined }),
    ...(result.snapshot ? { liveEstimate: result.snapshot, preference: result.snapshot.preference } : { liveEstimate: undefined }) } } };
}
export const manualTollCost = (items: readonly CostItem[]) => items.find((item) => item.assetKey === "transport:toll" && item.priceSource !== "CALCULATED");
export const isDerivedCarCost = (item: CostItem) => item.assetKey === "transport:fuel_usage" || item.assetKey === "transport:toll" && item.priceSource === "CALCULATED";
export const routeVariantLabel = (snapshot: PlannedCarSnapshot) => snapshot.preference === "FASTEST" ? "Le plus rapide"
  : snapshot.toll.amount === "0.00" && snapshot.route.hasToll === false ? "Sans péage"
    : snapshot.route.hasToll || snapshot.toll.amount !== null && new Big(snapshot.toll.amount).gt(0) ? "Limiter les péages" : "Éviter les péages";
export function selectCarVariant(result: PlannedCarResult, snapshot: PlannedCarSnapshot): PlannedCarResult {
  return { ...result, snapshot, fuelEstimate: carFuelEstimate(snapshot), stops: result.stops.map((stop, index) => snapshot.route.provider === "TOMTOM"
    ? { ...stop, distanceToNextKm: snapshot.route.segments[index]?.distanceKm ?? null, distanceSource: index < result.stops.length - 1 ? "TOMTOM" : undefined } : stop) };
}
export function transportPresentation(draft: PlannedExpenseDraft, variants: readonly PlannedCarSnapshot[] = []) {
  const live = draft.context.route?.liveEstimate;
  const manual = manualTollCost(draft.costItems);
  const toll = manual ? new Big(manual.quantity).times(manual.unitAmount).toFixed(2)
    : draft.context.route?.tollFreeConfirmed && live?.toll.amount === null ? "0.00" : live?.toll.amount ?? null;
  const parking = draft.costItems.filter((i) => i.assetKey === "transport:parking").reduce((sum, i) => sum.plus(new Big(i.quantity).times(i.unitAmount)), new Big(0)).toFixed(2);
  const fastest = variants.find((v) => v.preference === "FASTEST"), alternate = variants.find((v) => v.preference === "AVOID_TOLLS");
  const base = fastest ? transportTotals(fastest.fuelEconomicCost, fastest.toll.amount).economic : null;
  const alt = alternate ? transportTotals(alternate.fuelEconomicCost, alternate.toll.amount).economic : null;
  return { manualToll: !!manual, toll, parking, totals: transportTotals(live?.fuelEconomicCost ?? null, toll, parking),
    delta: fastest && alternate ? { durationMinutes: fastest.route.durationSeconds !== null && alternate.route.durationSeconds !== null ? Math.round((alternate.route.durationSeconds - fastest.route.durationSeconds) / 60) : null,
      distanceKm: new Big(alternate.route.distanceKm).minus(fastest.route.distanceKm).toString(),
      fuelCost: fastest.fuelEconomicCost !== null && alternate.fuelEconomicCost !== null ? new Big(alternate.fuelEconomicCost).minus(fastest.fuelEconomicCost).toFixed(2) : null,
      tollCost: fastest.toll.amount !== null && alternate.toll.amount !== null ? new Big(alternate.toll.amount).minus(fastest.toll.amount).toFixed(2) : null,
      economicCost: base !== null && alt !== null ? new Big(alt).minus(base).abs().toFixed(2) : null,
      cheaper: base !== null && alt !== null ? new Big(alt).lt(base) : null } : null };
}
export function carEstimateProblems(draft: PlannedExpenseDraft): readonly string[] {
  const live = draft.context.route?.liveEstimate;
  if (!live) return [];
  return [...live.fuelEconomicCost === null ? ["Prix carburant indisponible : précisez le prix au litre."] : [],
    ...live.toll.amount === null && !manualTollCost(draft.costItems) && !draft.context.route?.tollFreeConfirmed ? ["Péage non disponible : saisissez le montant ou confirmez 0 € si le trajet est gratuit."] : []];
}

const fail = (): never => { throw new TypeError("PLANNED_EXPENSE_LIVE_ROUTE_INVALID"); };
function obj(value: unknown, keys: readonly string[]): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return fail();
  const result = value as Record<string, unknown>;
  if (Object.keys(result).some((key) => !keys.includes(key))) return fail();
  return result;
}
function text(value: unknown, max = 120): string {
  if (typeof value !== "string" || !value.length || value.length > max || /https?:|apiKey=|key=/iu.test(value)) return fail();
  return value;
}
function dec(value: unknown): string {
  if (typeof value !== "string" || !/^(?:0|[1-9]\d{0,5})(?:\.\d{1,9})?$/u.test(value)) return fail();
  return value;
}
function enumeration<T extends string>(value: unknown, values: readonly T[]): T { if (!values.includes(value as T)) return fail(); return value as T; }
function integer(value: unknown, max = 1e8): number { if (!Number.isInteger(value) || Number(value) < 0 || Number(value) > max) return fail(); return Number(value); }
function timestamp(value: unknown): string { const result = text(value); if (!Number.isFinite(Date.parse(result))) return fail(); return result; }
export function parseRouteCoordinates(raw: unknown): RouteCoordinates {
  const value = obj(raw, ["latitude", "longitude", "source"]);
  if (typeof value.latitude !== "number" || !Number.isFinite(value.latitude) || Math.abs(value.latitude) > 90
    || typeof value.longitude !== "number" || !Number.isFinite(value.longitude) || Math.abs(value.longitude) > 180) return fail();
  return { latitude: value.latitude, longitude: value.longitude, source: enumeration(value.source, ["CANONICAL", "TOMTOM_GEOCODE", "USER_DECLARED"]) };
}
/** Structural read boundary: backward compatible routes continue through the old parser; live snapshots never cause API calls on read. */
export function parseCarSnapshot(raw: unknown): PlannedCarSnapshot {
  const value = obj(raw, ["estimateVersion", "preference", "vehicleId", "vehicleLabel", "plannedDate", "plannedTime", "timeKind", "calculatedAt", "route", "fuelPrice", "fuelEconomicCost", "toll", "fallbacks"]);
  if (value.estimateVersion !== "planned-car-live@v2" || typeof value.vehicleId !== "string" || !/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/iu.test(value.vehicleId)) return fail();
  const route = obj(value.route, ["provider", "distanceKm", "durationSeconds", "liters", "geometry", "geometryHash", "hasToll", "segments", "timeBasis", "sampleTimes", "routeMethodRef", "consumptionModelRef"]);
  if (!Array.isArray(route.geometry) || route.geometry.length > 11 || !Array.isArray(route.segments) || route.segments.length < 1 || route.segments.length > 11
    || !Array.isArray(route.sampleTimes) || route.sampleTimes.length > 3 || !Array.isArray(value.fallbacks) || value.fallbacks.length > 12) return fail();
  const parsedRoute: CarRouteFacts = {
    provider: enumeration(route.provider, ["TOMTOM", "HISTORICAL_ROUTE", "MANUAL"]), distanceKm: dec(route.distanceKm), liters: dec(route.liters),
    durationSeconds: route.durationSeconds === null ? null : integer(route.durationSeconds),
    geometry: route.geometry.map((rawGeometry) => { const g = obj(rawGeometry, ["encodedPolyline", "precision"]); if (g.precision !== 5 && g.precision !== 7) return fail();
      return { encodedPolyline: text(g.encodedPolyline, 160000), precision: g.precision }; }),
    geometryHash: route.geometryHash === null ? null : text(route.geometryHash, 64),
    hasToll: route.hasToll === null ? null : typeof route.hasToll === "boolean" ? route.hasToll : fail(),
    segments: route.segments.map((s) => { const segment = obj(s, ["distanceKm", "liters"]); return { distanceKm: dec(segment.distanceKm), liters: dec(segment.liters) }; }),
    timeBasis: enumeration(route.timeBasis, ["PLANNED_DEPARTURE", "PLANNED_ARRIVAL", "UNKNOWN_TIME_MEDIAN_08_14_18", "TYPICAL_NO_DATE", "FALLBACK"]),
    sampleTimes: route.sampleTimes.map((time) => text(time)), routeMethodRef: text(route.routeMethodRef), consumptionModelRef: text(route.consumptionModelRef),
  };
  if (new Big(parsedRoute.distanceKm).lte(0) || new Big(parsedRoute.liters).lte(0)) return fail();
  if (parsedRoute.geometry.reduce((size, g) => size + g.encodedPolyline.length, 0) > 500000
    || parsedRoute.geometryHash !== null && !/^[a-f0-9]{64}$/u.test(parsedRoute.geometryHash)) return fail();
  if (parsedRoute.provider === "TOMTOM" && (!parsedRoute.geometry.length || !parsedRoute.geometryHash
    || parsedRoute.consumptionModelRef !== PEUGEOT_207_ROUTING_PROFILE.modelKey)) return fail();
  let fuelPrice: FuelPriceReference | null = null;
  if (value.fuelPrice !== null) {
    const p = obj(value.fuelPrice, ["pricePerLiter", "source", "methodRef", "observedAt", "calculatedAt", "quality", "sampleCount", "radiusKm", "minimum", "maximum"]);
    fuelPrice = { pricePerLiter: dec(p.pricePerLiter), source: enumeration(p.source, ["FR_GOV_FUEL_INSTANT_V2", "CANONICAL_OBSERVATION", "MANUAL"]),
      methodRef: text(p.methodRef), observedAt: timestamp(p.observedAt), calculatedAt: timestamp(p.calculatedAt), quality: enumeration(p.quality, ["FRESH", "STALE", "FALLBACK"]),
      sampleCount: integer(p.sampleCount, 10000), radiusKm: p.radiusKm === null ? null : integer(p.radiusKm, 40), minimum: dec(p.minimum), maximum: dec(p.maximum) };
    if (new Big(fuelPrice.pricePerLiter).lte(0) || new Big(fuelPrice.pricePerLiter).gt(10)) return fail();
  }
  const t = obj(value.toll, ["status", "amount", "currency", "provider", "methodRef", "routeImportedFrom", "geometryHash", "components"]);
  if (t.currency !== "EUR" || !Array.isArray(t.components) || t.components.length > 100) return fail();
  const toll: TollEstimate = { status: enumeration(t.status, ["KNOWN", "NONE", "UNAVAILABLE", "UNKNOWN"]), amount: t.amount === null ? null : dec(t.amount), currency: "EUR",
    provider: enumeration(t.provider, ["HERE", "NONE"]), methodRef: text(t.methodRef), routeImportedFrom: t.routeImportedFrom === null ? null : enumeration(t.routeImportedFrom, ["TOMTOM"] as const),
    geometryHash: t.geometryHash === null ? null : text(t.geometryHash, 64), components: t.components.map((c) => { const component = obj(c, ["name", "amount"]); return { name: text(component.name), amount: dec(component.amount) }; }) };
  if ((toll.status === "NONE" && toll.amount !== "0.00") || (["UNAVAILABLE", "UNKNOWN"].includes(toll.status) !== (toll.amount === null))
    || toll.provider === "HERE" && (toll.routeImportedFrom !== "TOMTOM" || toll.geometryHash !== parsedRoute.geometryHash)) return fail();
  if (value.fuelEconomicCost !== (fuelPrice ? fuelEconomicCost(parsedRoute.liters, fuelPrice.pricePerLiter) : null)) return fail();
  if (value.plannedDate !== null && (typeof value.plannedDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/u.test(value.plannedDate))) return fail();
  if (value.plannedTime !== null && (typeof value.plannedTime !== "string" || !/^(?:[01]\d|2[0-3]):[0-5]\d$/u.test(value.plannedTime))) return fail();
  return { estimateVersion: "planned-car-live@v2", preference: enumeration(value.preference, ["FASTEST", "AVOID_TOLLS"]), vehicleId: value.vehicleId,
    vehicleLabel: text(value.vehicleLabel), plannedDate: value.plannedDate as string | null, plannedTime: value.plannedTime as string | null,
    timeKind: enumeration(value.timeKind, ["DEPARTURE", "ARRIVAL"]), calculatedAt: timestamp(value.calculatedAt), route: parsedRoute, fuelPrice,
    fuelEconomicCost: value.fuelEconomicCost as string | null, toll, fallbacks: value.fallbacks.map((f) => text(f)) };
}
