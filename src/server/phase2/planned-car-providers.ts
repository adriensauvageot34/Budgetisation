import "server-only";
import { createHash } from "node:crypto";
import Big from "big.js";
import { Temporal } from "@js-temporal/polyfill";
import { PEUGEOT_207_ROUTING_PROFILE, type CarRouteFacts, type FuelPriceProvider, type FuelPriceReference,
  type PlannedRouteProvider, type RouteCoordinates, type TollEstimate, type TollProvider } from "@/domain/phase2/planned-car";

export class PlannedProviderError extends Error {
  constructor(public readonly provider: string, public readonly code: "CONFIGURATION" | "TIMEOUT" | "HTTP" | "NO_ROUTE" | "INVALID_RESPONSE" | "GEOCODE_AMBIGUOUS", public readonly status?: number) {
    super(`PLANNED_TRANSPORT_${provider}_${code}`);
  }
}
type ProviderOptions = { fetcher?: typeof fetch; timeoutMs?: number; now?: () => Date; cache?: boolean;
  onError?: (issue: { provider: string; code: string; status?: number; stage?: string }) => void };
const cache = new Map<string, { until: number; value: unknown }>();
const pending = new Map<string, Promise<unknown>>();
export function clearPlannedProviderCache() { cache.clear(); pending.clear(); }
async function cached<T>(key: string, ttl: number, enabled: boolean, calculate: () => Promise<T>): Promise<T> {
  if (!enabled) return calculate();
  const hit = cache.get(key);
  if (hit && hit.until > Date.now()) return structuredClone(hit.value) as T;
  if (pending.has(key)) return structuredClone(await pending.get(key)) as T;
  const request = calculate().then((value) => {
    // Failures/null references are not sticky. Cache is bounded and only process-local.
    if (value !== null) { if (cache.size >= 256) cache.delete(cache.keys().next().value!); cache.set(key, { until: Date.now() + ttl, value }); }
    return value;
  }).finally(() => pending.delete(key));
  pending.set(key, request);
  return structuredClone(await request);
}
const hash = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
class ProviderHttp {
  private readonly fetcher: typeof fetch;
  private readonly timeoutMs: number;
  constructor(private readonly provider: string, options: ProviderOptions) { this.fetcher = options.fetcher ?? fetch; this.timeoutMs = options.timeoutMs ?? 4000; }
  async json(url: URL, init?: RequestInit): Promise<any> {
    for (let attempt = 0; attempt < 2; attempt++) {
      const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), this.timeoutMs);
      try {
        const response = await this.fetcher(url, { ...init, signal: controller.signal, cache: "no-store" });
        if (!response.ok) {
          if (attempt === 0 && [429, 502, 503, 504].includes(response.status)) continue;
          throw new PlannedProviderError(this.provider, "HTTP", response.status);
        }
        return await response.json();
      } catch (error) {
        if (error instanceof PlannedProviderError) throw error;
        // Do not forward fetch errors (they can contain the authenticated URL).
        throw new PlannedProviderError(this.provider, controller.signal.aborted ? "TIMEOUT" : "INVALID_RESPONSE");
      } finally { clearTimeout(timer); }
    }
    throw new PlannedProviderError(this.provider, "HTTP");
  }
}
function positive(value: unknown, provider: string): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) throw new PlannedProviderError(provider, "INVALID_RESPONSE");
  return value;
}
export function decodeTomTomPolyline(encoded: string, precision: number): { lat: number; lng: number }[] {
  const points: { lat: number; lng: number }[] = []; let offset = 0, lat = 0, lon = 0;
  const number = () => { let result = 0, shift = 0, byte: number;
    do { if (offset >= encoded.length || shift > 30) throw new PlannedProviderError("TOMTOM", "INVALID_RESPONSE");
      byte = encoded.charCodeAt(offset++) - 63; if (byte < 0 || byte > 63) throw new PlannedProviderError("TOMTOM", "INVALID_RESPONSE");
      result += (byte & 31) * 2 ** shift; shift += 5;
    } while (byte >= 32);
    return result % 2 ? -(Math.floor(result / 2) + 1) : result / 2;
  };
  while (offset < encoded.length) { lat += number(); lon += number(); const point = { lat: lat / 10 ** precision, lng: lon / 10 ** precision };
    if (Math.abs(point.lat) > 90 || Math.abs(point.lng) > 180 || points.length > 150000) throw new PlannedProviderError("TOMTOM", "INVALID_RESPONSE"); points.push(point); }
  return points;
}
/** Densify only for HERE map matching, along the exact decoded line. No waypoint or bend is removed. */
export function hereImportTrace(route: CarRouteFacts): { lat: number; lng: number }[] {
  const vertices = route.geometry.flatMap((g, index) => { const points = decodeTomTomPolyline(g.encodedPolyline, g.precision); return index ? points.slice(1) : points; });
  const trace: { lat: number; lng: number }[] = [];
  for (let i = 0; i < vertices.length; i++) {
    const point = vertices[i]!, previous = vertices[i - 1];
    if (previous) {
      // This geometric spacing is not a road-distance or fuel estimate.
      const meters = Math.hypot((point.lat - previous.lat) * 111320, (point.lng - previous.lng) * 111320 * Math.cos(point.lat * Math.PI / 180));
      const steps = Math.ceil(meters / 20);
      for (let step = 1; step < steps; step++) trace.push({ lat: previous.lat + (point.lat - previous.lat) * step / steps, lng: previous.lng + (point.lng - previous.lng) * step / steps });
    }
    trace.push(point);
    if (trace.length > 50000) throw new PlannedProviderError("HERE", "INVALID_RESPONSE");
  }
  return trace;
}
export class TomTomRouteProvider implements PlannedRouteProvider {
  private readonly http: ProviderHttp;
  constructor(private readonly key = process.env.TOMTOM_API_KEY, private readonly options: ProviderOptions = {}) { this.http = new ProviderHttp("TOMTOM", options); }
  async geocode(label: string, bias?: RouteCoordinates): Promise<RouteCoordinates> {
    if (!this.key) throw new PlannedProviderError("TOMTOM", "CONFIGURATION");
    return cached(`geocode:${hash([label, bias])}`, 86400000, this.options.cache !== false, async () => {
      const url = new URL(`https://api.tomtom.com/search/2/geocode/${encodeURIComponent(label)}.json`);
      url.search = new URLSearchParams({ key: this.key!, countrySet: "FR", limit: "3", language: "fr-FR", ...(bias ? { lat: String(bias.latitude), lon: String(bias.longitude) } : {}) }).toString();
      const response = await this.http.json(url);
      const results = response.results;
      // A prospectively entered address is never fuzzily coerced into a canonical Place.
      if (!Array.isArray(results) || !results.length) throw new PlannedProviderError("TOMTOM", "GEOCODE_AMBIGUOUS");
      const first = results[0];
      if ((first.matchConfidence?.score !== undefined && first.matchConfidence.score < 0.9)
        || results.length > 1 && results[1].score >= first.score * 0.95) throw new PlannedProviderError("TOMTOM", "GEOCODE_AMBIGUOUS");
      const latitude = first.position?.lat, longitude = first.position?.lon;
      if (typeof latitude !== "number" || typeof longitude !== "number" || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) throw new PlannedProviderError("TOMTOM", "INVALID_RESPONSE");
      return { latitude, longitude, source: "TOMTOM_GEOCODE" };
    });
  }
  async estimateCarRoute(input: Parameters<PlannedRouteProvider["estimateCarRoute"]>[0]): Promise<CarRouteFacts> {
    if (!this.key) throw new PlannedProviderError("TOMTOM", "CONFIGURATION");
    const profile = PEUGEOT_207_ROUTING_PROFILE;
    return cached(`tomtom:${hash([input, profile.modelKey, "routing-v1@planned-v2"])}`, 21600000, this.options.cache !== false, async () => {
      // A dateless project uses a fixed typical Tuesday, with current incidents disabled.
      const date = input.plannedDate ?? "2026-10-06";
      const times = input.plannedTime ? [input.plannedTime] : input.plannedDate ? ["08:00", "14:00", "18:00"] : ["14:00"];
      const samples = await Promise.all(times.map(async (time) => {
        const url = new URL(`https://api.tomtom.com/routing/1/calculateRoute/${input.coordinates.map((c) => `${c.latitude},${c.longitude}`).join(":")}/json`);
        const { modelKey: _model, fuelType: _fuel, ...parameters } = profile;
        const params = new URLSearchParams({ key: this.key!, travelMode: "car", vehicleEngineType: "combustion", routeType: "fastest", traffic: "false",
          computeTravelTimeFor: "all", routeRepresentation: "encodedPolyline", sectionType: "toll", ...Object.fromEntries(Object.entries(parameters).map(([key, value]) => [key, String(value)])) });
        if (input.preference === "AVOID_TOLLS") params.set("avoid", "tollRoads");
        // TomTom assumes the waypoint timezone when no offset is supplied. Explicit Paris offsets make DST reproducible.
        const instant = Temporal.PlainDateTime.from(`${date}T${time}`).toZonedDateTime("Europe/Paris").toString({ timeZoneName: "never" });
        params.set(input.plannedTime && input.timeKind === "ARRIVAL" ? "arriveAt" : "departAt", instant);
        url.search = params.toString();
        const response = await this.http.json(url);
        const route = response.routes?.[0]; if (!route) throw new PlannedProviderError("TOMTOM", "NO_ROUTE");
        const distance = positive(route.summary?.lengthInMeters, "TOMTOM") / 1000;
        const liters = positive(route.summary?.fuelConsumptionInLiters, "TOMTOM");
        const duration = positive(route.summary?.historicTrafficTravelTimeInSeconds ?? route.summary?.travelTimeInSeconds, "TOMTOM");
        if (!Array.isArray(route.legs) || route.legs.length !== input.coordinates.length - 1) throw new PlannedProviderError("TOMTOM", "INVALID_RESPONSE");
        const geometry = route.legs.map((leg: any) => {
          if (typeof leg.encodedPolyline !== "string" || ![5, 7].includes(leg.encodedPolylinePrecision)) throw new PlannedProviderError("TOMTOM", "INVALID_RESPONSE");
          return { encodedPolyline: leg.encodedPolyline, precision: leg.encodedPolylinePrecision as 5 | 7 };
        });
        return { distance, liters, duration, geometry, time,
          hasToll: (route.sections ?? []).some((section: any) => ["TOLL", "TOLL_ROAD", "TOLL_VIGNETTE"].includes(section.sectionType)),
          segments: route.legs.map((leg: any) => ({ distanceKm: new Big(positive(leg.summary?.lengthInMeters, "TOMTOM")).div(1000).toFixed(3),
            liters: new Big(positive(leg.summary?.fuelConsumptionInLiters, "TOMTOM")).toFixed(6) })) };
      }));
      const middle = Math.floor(samples.length / 2);
      const median = (key: "distance" | "liters" | "duration") => [...samples].sort((a, b) => a[key] - b[key])[middle]![key];
      // The median-duration sample supplies the physical geometry; scalar facts are median across the three requested times.
      const chosen = [...samples].sort((a, b) => a.duration - b.duration || a.time.localeCompare(b.time))[middle]!;
      return { provider: "TOMTOM", distanceKm: new Big(median("distance")).toFixed(3), liters: new Big(median("liters")).toFixed(6),
        durationSeconds: Math.round(median("duration")), geometry: chosen.geometry, geometryHash: hash(chosen.geometry), hasToll: chosen.hasToll,
        segments: chosen.segments, timeBasis: !input.plannedDate ? "TYPICAL_NO_DATE" : input.plannedTime ? input.timeKind === "ARRIVAL" ? "PLANNED_ARRIVAL" : "PLANNED_DEPARTURE" : "UNKNOWN_TIME_MEDIAN_08_14_18",
        sampleTimes: times.map((time) => `${date}T${time}`), routeMethodRef: `tomtom-planned-car-${input.preference === "AVOID_TOLLS" ? "avoid-tolls" : "fastest"}@v2`, consumptionModelRef: profile.modelKey };
    });
  }
}

export const FUEL_PRICE_POLICY = Object.freeze({ radiiKm: [15, 25, 40], minimumSamples: 3, freshHours: 48, maxAgeDays: 7, cacheMinutes: 45 });
export function selectOfficialFuelPrice(rows: readonly any[], radiusKm: number, now = new Date()): FuelPriceReference | null {
  const byStation = new Map<string, { price: Big; at: string; age: number }>();
  for (const row of rows) {
    const at = row.sp95_maj, price = row.sp95_prix, age = now.getTime() - Date.parse(at);
    if (!row.id || row.sp95_rupture_debut || typeof at !== "string" || !Number.isFinite(age) || age < -3600000 || age > FUEL_PRICE_POLICY.maxAgeDays * 86400000
      || typeof price !== "number" || !Number.isFinite(price) || price <= 0 || price > 10) continue;
    const previous = byStation.get(String(row.id));
    if (!previous || at > previous.at) byStation.set(String(row.id), { price: new Big(price), at, age });
  }
  let stations = [...byStation.values()];
  const fresh = stations.filter((station) => station.age <= FUEL_PRICE_POLICY.freshHours * 3600000);
  if (fresh.length >= FUEL_PRICE_POLICY.minimumSamples) stations = fresh;
  if (!stations.length) return null;
  stations.sort((a, b) => a.price.cmp(b.price)); const middle = Math.floor(stations.length / 2);
  const median = stations.length % 2 ? stations[middle]!.price : stations[middle - 1]!.price.plus(stations[middle]!.price).div(2);
  return { pricePerLiter: median.toString(), source: "FR_GOV_FUEL_INSTANT_V2", methodRef: "fr-gov-sp95-local-median@v1",
    observedAt: stations.map((s) => s.at).sort().at(-1)!, calculatedAt: now.toISOString(), quality: stations.every((s) => s.age <= 48 * 3600000) ? "FRESH" : "STALE",
    sampleCount: stations.length, radiusKm, minimum: stations[0]!.price.toString(), maximum: stations.at(-1)!.price.toString() };
}
export class FrenchOfficialFuelPriceProvider implements FuelPriceProvider {
  private readonly http: ProviderHttp;
  constructor(private readonly options: ProviderOptions = {}) { this.http = new ProviderHttp("FUEL", options); }
  async getReference(origin: RouteCoordinates): Promise<FuelPriceReference | null> {
    return cached(`fuel:${hash([origin.latitude, origin.longitude, "SP95", FUEL_PRICE_POLICY])}`, 2700000, this.options.cache !== false, async () => {
      let best: FuelPriceReference | null = null;
      for (const radius of FUEL_PRICE_POLICY.radiiKm) {
        const url = new URL("https://www.data.economie.gouv.fr/api/explore/v2.1/catalog/datasets/prix-des-carburants-en-france-flux-instantane-v2/records");
        url.search = new URLSearchParams({ where: `within_distance(geom, geom'POINT(${origin.longitude} ${origin.latitude})', ${radius}km) and sp95_prix is not null`,
          select: "id,sp95_prix,sp95_maj,sp95_rupture_debut", order_by: "id", limit: "100" }).toString();
        const rows: any[] = [];
        for (let offset = 0; offset < 1000; offset += 100) {
          url.searchParams.set("offset", String(offset)); const response = await this.http.json(url);
          if (!Array.isArray(response.results)) throw new PlannedProviderError("FUEL", "INVALID_RESPONSE");
          rows.push(...response.results); if (rows.length >= response.total_count || response.results.length < 100) break;
        }
        const reference = selectOfficialFuelPrice(rows, radius, this.options.now?.() ?? new Date());
        if (reference && (!best || reference.sampleCount > best.sampleCount)) best = reference;
        if (reference && reference.sampleCount >= FUEL_PRICE_POLICY.minimumSamples) return reference;
      }
      return best;
    });
  }
}
export const HERE_CAR_TOLL_PROFILE = Object.freeze({ transportMode: "car", currency: "EUR", version: "standard-car@v1" });
export function hereTollDepartureTime(route: CarRouteFacts): string {
  if (!route.timeBasis.startsWith("PLANNED_")) return "any";
  let departure = Temporal.PlainDateTime.from(`${route.sampleTimes[0]}:00`).toZonedDateTime("Europe/Paris");
  // HERE route import/handle accepts departureTime only. Arrival intent stays authoritative in TomTom.
  if (route.timeBasis === "PLANNED_ARRIVAL") {
    if (route.durationSeconds === null) throw new PlannedProviderError("HERE", "INVALID_RESPONSE");
    departure = departure.subtract({ seconds: route.durationSeconds });
  }
  return departure.toString({ timeZoneName: "never" });
}
export function unknownToll(route: CarRouteFacts, status: "UNAVAILABLE" | "UNKNOWN" = "UNKNOWN"): TollEstimate {
  return { status, amount: null, currency: "EUR", provider: "NONE", methodRef: "here-route-import-tolls@v1", routeImportedFrom: null, geometryHash: route.geometryHash, components: [] };
}
export function parseHereTolls(response: any, route: CarRouteFacts): TollEstimate {
  if ((response.notices ?? []).some((n: any) => /toll|currency|import|match|violat/iu.test(n.code ?? ""))) return unknownToll(route);
  const sections = response.routes?.[0]?.sections;
  if (!Array.isArray(sections) || !sections.length) throw new PlannedProviderError("HERE", "INVALID_RESPONSE");
  const components: { name: string; amount: string }[] = [];
  for (const section of sections) {
    if ((section.notices ?? []).some((n: any) => /toll|currency|import|match|violat/iu.test(n.code ?? ""))) return unknownToll(route);
    for (const toll of section.tolls ?? []) {
      // Fares are alternatives (cash/card/transponder), never additive. Use a standard card fare, then cash. No vignette assumptions.
      const fares = (toll.fares ?? []).filter((fare: any) => !fare.pass && fare.price?.currency === "EUR" && fare.price?.type === "value"
        && typeof fare.price.value === "number" && fare.price.value >= 0 && Number.isFinite(fare.price.value));
      const fare = fares.find((f: any) => f.paymentMethods?.some((m: string) => ["bankCard", "creditCard"].includes(m)))
        ?? fares.find((f: any) => f.paymentMethods?.includes("cash"))
        ?? (fares.length === 1 && !fares[0].paymentMethods?.includes("transponder") ? fares[0] : null);
      if (!fare) return unknownToll(route);
      components.push({ name: String(toll.tollSystem ?? fare.name ?? "Péage").slice(0, 120), amount: new Big(fare.price.value).toFixed(2) });
    }
  }
  if (!components.length && route.hasToll) return unknownToll(route);
  return { status: components.length ? "KNOWN" : "NONE", amount: components.reduce((sum, c) => sum.plus(c.amount), new Big(0)).toFixed(2), currency: "EUR",
    provider: "HERE", methodRef: "here-route-import-tolls@v1", routeImportedFrom: "TOMTOM", geometryHash: route.geometryHash, components };
}
export class HereTollProvider implements TollProvider {
  private readonly http: ProviderHttp;
  constructor(private readonly key = process.env.HERE_API_KEY, private readonly options: ProviderOptions = {}) { this.http = new ProviderHttp("HERE", options); }
  async estimateTolls(route: CarRouteFacts): Promise<TollEstimate> {
    if (!this.key) return unknownToll(route, "UNAVAILABLE");
    if (!route.geometry.length || !route.geometryHash) return unknownToll(route);
    let stage = "import";
    try {
      return await cached(`here:${hash([route.geometryHash, HERE_CAR_TOLL_PROFILE, route.timeBasis, route.sampleTimes])}`, 86400000, this.options.cache !== false, async () => {
        const trace = hereImportTrace(route);
        if (trace.length < 2) throw new PlannedProviderError("HERE", "INVALID_RESPONSE");
        const url = new URL("https://router.hereapi.com/v8/import");
        url.search = new URLSearchParams({ apiKey: this.key!, transportMode: HERE_CAR_TOLL_PROFILE.transportMode, return: "routeHandle" }).toString();
        const routeTime = hereTollDepartureTime(route);
        url.searchParams.set("departureTime", routeTime);
        const imported = await this.http.json(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ trace }) });
        if ((imported.notices ?? []).some((n: any) => n.severity === "critical" || n.code === "importSplitRoute") || typeof imported.routes?.[0]?.routeHandle !== "string") throw new PlannedProviderError("HERE", "INVALID_RESPONSE");
        const handle = imported.routes[0].routeHandle; // Ephemeral; never returned or persisted.
        stage = "tolls";
        const tollUrl = new URL(`https://router.hereapi.com/v8/routes/${encodeURIComponent(handle)}`);
        tollUrl.search = new URLSearchParams({ apiKey: this.key!, return: "tolls", transportMode: "car", currency: "EUR" }).toString();
        tollUrl.searchParams.set("departureTime", routeTime);
        const result = parseHereTolls(await this.http.json(tollUrl), route);
        if (["UNAVAILABLE", "UNKNOWN"].includes(result.status)) throw new PlannedProviderError("HERE", "INVALID_RESPONSE");
        return result;
      });
    } catch (error) { this.options.onError?.({ provider: "HERE", code: error instanceof PlannedProviderError ? error.code : "INVALID_RESPONSE", status: error instanceof PlannedProviderError ? error.status : undefined, stage }); return unknownToll(route, "UNAVAILABLE"); }
  }
}
