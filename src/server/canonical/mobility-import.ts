import "server-only";

import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import Big from "big.js";
import ExcelJS from "exceljs";
import JSZip from "jszip";
import { parseMobilityLegFact, type MobilityLegFact } from "../../analytics/facts/index";

export const CANONICAL_MOBILITY_IMPORT_METHOD_VERSION = "canonical_mobility_xlsx@v1" as const;
export const MOBILITY_LEG_FACT_METHOD_VERSION = "mobility_leg_projection@v1" as const;
export const MOBILITY_ROUTE_METHOD_REF = "tomtom-car-fastest-live-traffic-disabled@v1" as const;
export const MOBILITY_VEHICLE_MODEL_REF = "peugeot-207-1.4-vti95-bvm5-sp95@tomtom-v1" as const;

const DATASET_NAMESPACE = "610f0cce-dde4-5b6b-9a2d-92c5d23226f5";
const LEG_NAMESPACE = "2a2ab9bf-74c9-5bb7-8fe6-87b2eef13893";
const VEHICLE_NAMESPACE = "00f3cbaa-0ec2-56d7-b0fd-23959b1a72fb";
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const sourceIdPattern = /^(NAV|JOUR|AUT)-[0-9]{4}$/;
const localDatePattern = /^\d{4}-\d{2}-\d{2}$/;
const localDateTimePattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/;

const expectedHeaders = Object.freeze([
  "ID final", "Source dataset", "ID source", "Date", "Jour", "Famille trajet",
  "Sous-catégorie / contexte", "Boucle GPS", "Leg boucle", "Point A", "Adresse A",
  "Localisation A", "Entrée routeur A", "Latitude A", "Longitude A", "Résolution A",
  "Point B", "Adresse B", "Localisation B", "Entrée routeur B", "Latitude B",
  "Longitude B", "Résolution B", "time_type", "Heure / base temporelle",
  "Qualité horaire", "Statut véhicule", "Modèle véhicule", "model_key", "Distance (km)",
  "Durée estimée (min)", "Durée sans trafic (min)", "Essence estimée (L)",
  "Conso estimée (L/100 km)", "Scénarios TomTom", "Source coord. A", "Source coord. B",
  "Prix SP95 historique (€/L)", "Coût carburant estimé (€)", "Référence prix",
  "Qualité prix", "Source prix", "Statut TomTom", "Anti-double-compte",
  "IDs liés / origine", "Source jour travaillé", "Niveau confiance jour",
  "Base temporelle TomTom", "Proxy(s) TomTom", "Distance min (km)", "Distance max (km)",
  "Essence min (L)", "Essence max (L)", "Note",
]);

const sheets = Object.freeze([
  { name: "Navettes travail", group: "NAV", expectedCount: 390 },
  { name: "Sorties journée travail", group: "JOUR", expectedCount: 77 },
  { name: "Autres déplacements", group: "AUT", expectedCount: 217 },
] as const);

const certifiedControls = Object.freeze({
  total: 684,
  distanceKm: new Big("7370.132"),
  estimatedFuelLiters: new Big("647.270"),
  estimatedFuelCost: new Big("1188.48"),
  periodStart: "2025-08-01",
  periodEnd: "2026-07-31",
});

export type MobilityPlaceAuthority = {
  readonly sourceLabel: string;
  readonly latitude: string;
  readonly longitude: string;
  readonly placeId: string;
};

export type ExistingMobilityIdentity = {
  readonly datasetIds?: readonly string[];
  readonly legIds?: readonly string[];
};

export type CanonicalMobilityDatasetRow = {
  readonly dataset_id: string;
  readonly household_id: string;
  readonly source_name: string;
  readonly period_start: string;
  readonly period_end: string;
  readonly source_hash: string;
  readonly import_method_version: typeof CANONICAL_MOBILITY_IMPORT_METHOD_VERSION;
  readonly source_leg_count: number;
};

export type CanonicalMobilityLegRow = Readonly<Record<string, unknown>> & {
  readonly mobility_leg_id: string;
  readonly source_leg_id: string;
  readonly dataset_id: string;
  readonly household_id: string;
  readonly vehicle_id: string;
};

export type CanonicalMobilityDryRunReport = {
  readonly status: "PASS";
  readonly sourceFileName: string;
  readonly sourceHash: string;
  readonly datasetId: string;
  readonly vehicleId: string;
  readonly sourceLegs: number;
  readonly sourceGroupCounts: Readonly<Record<"NAV" | "JOUR" | "AUT", number>>;
  readonly totalDistanceKm: string;
  readonly totalEstimatedFuelLiters: string;
  readonly totalEstimatedFuelCost: string;
  readonly periodStart: string;
  readonly periodEnd: string;
  readonly uniqueSourceLegIds: number;
  readonly uniqueCanonicalLegIds: number;
  readonly duplicatePhysicalRows: number;
  readonly resolvedPlaceIdentities: number;
  readonly unresolvedPlaceIdentities: number;
  readonly datasetRowsToInsert: number;
  readonly legRowsToInsert: number;
  readonly databaseWrites: 0;
  readonly financeRowsPlanned: 0;
};

export type CanonicalMobilityImportPlan = {
  readonly dataset: CanonicalMobilityDatasetRow;
  readonly vehicleCandidate: {
    readonly vehicle_id: string;
    readonly household_id: string;
    readonly owner_person_id: null;
    readonly label: "Peugeot 207 2010 — 1.4 VTi 95 — SP95 — BVM5";
    readonly fuel_type: "SP95";
    readonly consumption_l_100km: null;
    readonly status: "active";
  };
  readonly legs: readonly CanonicalMobilityLegRow[];
  readonly facts: readonly MobilityLegFact[];
  readonly report: CanonicalMobilityDryRunReport;
};

function sha256(value: string | Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

function deterministicUuid(namespace: string, name: string): string {
  const namespaceBytes = Buffer.from(namespace.replaceAll("-", ""), "hex");
  const bytes = Buffer.from(createHash("sha1").update(namespaceBytes).update(name).digest().subarray(0, 16));
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).sort(([left], [right]) => left.localeCompare(right)).map(([key, child]) => [key, canonical(child)]));
  }
  return value;
}

function digest(value: unknown): string {
  return sha256(JSON.stringify(canonical(value)));
}

async function excelJsCompatibleWorkbook(source: Buffer): Promise<Buffer> {
  const archive = await JSZip.loadAsync(source);
  const prefixedXmlEntries = Object.values(archive.files).filter(
    ({ dir, name }) => !dir && name.startsWith("xl/") && name.endsWith(".xml"),
  );
  for (const entry of prefixedXmlEntries) {
    const xml = await entry.async("string");
    if (!xml.includes("<x:") && !xml.includes("</x:")) continue;
    let normalized = xml
      .replace(/xmlns:x=/g, "xmlns=")
      .replace(/<(\/?)x:/g, "<$1");
    // The certified source contains overlapping presentation-only merges.
    // They are irrelevant to row values and ExcelJS rejects them, so strip
    // only that display metadata from the in-memory copy.
    if (entry.name.startsWith("xl/worksheets/")) {
      normalized = normalized
        .replace(/<mergeCells\b[^>]*>[\s\S]*?<\/mergeCells>/g, "")
        .replace(/<mergeCells\b[^>]*\/>/g, "")
        .replace(/<tableParts\b[^>]*>[\s\S]*?<\/tableParts>/g, "")
        .replace(/<tableParts\b[^>]*\/>/g, "");
    }
    archive.file(entry.name, normalized);
  }
  return archive.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
}

function assertUuid(value: string, field: string): string {
  if (!uuidPattern.test(value)) throw new TypeError(`${field} doit être un UUID.`);
  return value.toLowerCase();
}

function cellScalar(value: ExcelJS.CellValue): unknown {
  if (value !== null && typeof value === "object" && "formula" in value) return value.result;
  if (value !== null && typeof value === "object" && "text" in value) return value.text;
  return value;
}

function optionalText(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string" && typeof value !== "number") throw new TypeError("Valeur textuelle XLSX invalide.");
  const normalized = String(value).trim();
  return normalized.length === 0 ? null : normalized;
}

function requiredText(value: unknown, field: string): string {
  const parsed = optionalText(value);
  if (parsed === null) throw new TypeError(`${field} est requis.`);
  return parsed;
}

function decimal(value: unknown, field: string, scale?: number): string {
  if (typeof value !== "number" && typeof value !== "string") throw new TypeError(`${field} doit être numérique.`);
  // XLSX numeric cells are IEEE-754 values. Fifteen significant digits are
  // Excel's reliable precision boundary and remove binary tails without
  // changing the authored decimal value.
  const parsed = new Big(typeof value === "number" ? value.toPrecision(15) : value);
  return (scale === undefined ? parsed : parsed.round(scale)).toFixed();
}

function nonNegativeDecimal(value: unknown, field: string, scale?: number): string {
  const parsed = decimal(value, field, scale);
  if (new Big(parsed).lt(0)) throw new TypeError(`${field} doit être positif ou nul.`);
  return parsed;
}

function nullableDecimal(value: unknown, field: string, scale?: number): string | null {
  return value === null || value === undefined || value === "" ? null : nonNegativeDecimal(value, field, scale);
}

function localDate(value: unknown): string {
  if (value instanceof Date && Number.isFinite(value.getTime())) return value.toISOString().slice(0, 10);
  const normalized = requiredText(value, "Date").slice(0, 10);
  if (!localDatePattern.test(normalized) || Number.isNaN(Date.parse(`${normalized}T00:00:00Z`))) {
    throw new TypeError("Date XLSX invalide.");
  }
  return normalized;
}

function localDateTime(value: unknown): string | null {
  const normalized = optionalText(value);
  if (normalized === null || normalized === "any") return null;
  if (!localDateTimePattern.test(normalized)) throw new TypeError("Heure XLSX invalide.");
  return normalized;
}

function headerMap(worksheet: ExcelJS.Worksheet): ReadonlyMap<string, number> {
  const headerRow = worksheet.getRow(1);
  const headers = Array.from(
    { length: headerRow.cellCount },
    (_, index) => optionalText(cellScalar(headerRow.getCell(index + 1).value)) ?? "",
  );
  if (JSON.stringify(headers) !== JSON.stringify(expectedHeaders)) {
    throw new TypeError(`Colonnes inattendues dans ${worksheet.name}.`);
  }
  return new Map(headers.map((header, index) => [header, index + 1]));
}

function rawRow(worksheet: ExcelJS.Worksheet, row: ExcelJS.Row, headers: ReadonlyMap<string, number>): Readonly<Record<string, unknown>> {
  return Object.fromEntries([...headers].map(([header, column]) => [header, cellScalar(row.getCell(column).value)]));
}

function sourceGroup(value: string): "NAV" | "JOUR" | "AUT" {
  const match = sourceIdPattern.exec(value);
  if (!match) throw new TypeError(`source_leg_id invalide: ${value}`);
  return match[1] as "NAV" | "JOUR" | "AUT";
}

function confidence(value: unknown): "HIGH" | "MEDIUM" | "LOW" | "UNKNOWN" {
  const normalized = optionalText(value);
  if (normalized?.startsWith("A")) return "HIGH";
  if (normalized?.startsWith("B")) return "MEDIUM";
  if (normalized?.startsWith("C")) return "LOW";
  return "UNKNOWN";
}

function timeType(value: unknown): "DEPARTURE" | "ARRIVAL" | "UNTYPED" | "UNKNOWN" {
  const normalized = optionalText(value);
  if (normalized === "departureTime") return "DEPARTURE";
  if (normalized === "arrivalTime") return "ARRIVAL";
  if (normalized === null) return "UNTYPED";
  throw new TypeError(`time_type inconnu: ${normalized}`);
}

function proxyTimes(value: unknown): readonly string[] {
  const normalized = optionalText(value);
  if (normalized === null) return [];
  const values = normalized.split("|");
  if (values.some((entry) => !localDateTimePattern.test(entry))) throw new TypeError("Proxy(s) TomTom invalide(s).");
  return [...new Set(values)].sort();
}

function fuelAuthority(row: Readonly<Record<string, unknown>>, travelDate: string) {
  const qualityLabel = requiredText(row["Qualité prix"], "Qualité prix");
  const isLocal = qualityLabel === "P3 local/département";
  const isNational = qualityLabel === "P4 national fallback";
  if (!isLocal && !isNational) throw new TypeError(`Qualité prix inconnue: ${qualityLabel}`);
  return {
    fuelType: "SP95" as const,
    pricePerLiter: nonNegativeDecimal(row["Prix SP95 historique (€/L)"], "Prix SP95 historique", 6),
    pricePeriod: travelDate.slice(0, 7),
    geoScope: isLocal ? "LOCAL_DEPARTMENT" as const : "NATIONAL" as const,
    source: requiredText(row["Source prix"], "Source prix"),
    quality: isLocal ? "P3_LOCAL_DEPARTMENT" as const : "P4_NATIONAL_FALLBACK" as const,
    observationId: null,
  };
}

function placeKey(label: string, latitude: string, longitude: string): string {
  return `${label}\u0000${latitude}\u0000${longitude}`;
}

function authorityMap(values: readonly MobilityPlaceAuthority[]): ReadonlyMap<string, string> {
  const result = new Map<string, string>();
  for (const value of values) {
    const key = placeKey(value.sourceLabel, decimal(value.latitude, "place.latitude", 8), decimal(value.longitude, "place.longitude", 8));
    const placeId = assertUuid(value.placeId, "place.placeId");
    const existing = result.get(key);
    if (existing !== undefined && existing !== placeId) throw new TypeError("Place authority contradictoire.");
    result.set(key, placeId);
  }
  return result;
}

function endpoint(
  row: Readonly<Record<string, unknown>>,
  side: "A" | "B",
  places: ReadonlyMap<string, string>,
) {
  const sourceLabel = requiredText(row[`Point ${side}`], `Point ${side}`);
  const latitude = decimal(row[`Latitude ${side}`], `Latitude ${side}`, 8);
  const longitude = decimal(row[`Longitude ${side}`], `Longitude ${side}`, 8);
  const placeId = places.get(placeKey(sourceLabel, latitude, longitude)) ?? null;
  return {
    sourceLabel,
    latitude,
    longitude,
    placeId,
    resolutionState: placeId === null ? "UNRESOLVED" as const : "EXPLICIT_MAPPING" as const,
  };
}

function mobilityTime(row: Readonly<Record<string, unknown>>) {
  const observedTime = localDateTime(row["Heure / base temporelle"]);
  const proxies = proxyTimes(row["Proxy(s) TomTom"]);
  const rawTime = optionalText(row["Heure / base temporelle"]);
  const authority = observedTime !== null ? "OBSERVED" as const : rawTime === "any" || proxies.length > 0 ? "PROXY" as const : "UNKNOWN" as const;
  return {
    observedTime: authority === "OBSERVED" ? observedTime : null,
    authority,
    type: timeType(row.time_type),
    routeTimeBasis: optionalText(row["Base temporelle TomTom"]),
    routeProxyTimes: proxies,
  };
}

function sourceQuality(row: Readonly<Record<string, unknown>>): string {
  return optionalText(row["Niveau confiance jour"])
    ?? optionalText(row["Qualité horaire"])
    ?? "SOURCE_ROW_CERTIFIED";
}

function assertSourceControls(report: Omit<CanonicalMobilityDryRunReport, "status" | "databaseWrites" | "financeRowsPlanned">): void {
  if (report.sourceLegs !== certifiedControls.total) throw new TypeError("MOBILITY_SOURCE_LEG_COUNT_MISMATCH");
  if (report.sourceGroupCounts.NAV !== 390 || report.sourceGroupCounts.JOUR !== 77 || report.sourceGroupCounts.AUT !== 217) {
    throw new TypeError("MOBILITY_SOURCE_GROUP_COUNT_MISMATCH");
  }
  if (new Big(report.totalDistanceKm).minus(certifiedControls.distanceKm).abs().gt("0.001")) throw new TypeError("MOBILITY_SOURCE_DISTANCE_MISMATCH");
  if (new Big(report.totalEstimatedFuelLiters).minus(certifiedControls.estimatedFuelLiters).abs().gt("0.001")) throw new TypeError("MOBILITY_SOURCE_LITERS_MISMATCH");
  if (new Big(report.totalEstimatedFuelCost).minus(certifiedControls.estimatedFuelCost).abs().gt("0.01")) throw new TypeError("MOBILITY_SOURCE_COST_MISMATCH");
  if (report.periodStart !== certifiedControls.periodStart || report.periodEnd !== certifiedControls.periodEnd) throw new TypeError("MOBILITY_SOURCE_PERIOD_MISMATCH");
  if (report.uniqueSourceLegIds !== certifiedControls.total || report.uniqueCanonicalLegIds !== certifiedControls.total) throw new TypeError("MOBILITY_SOURCE_IDENTITY_MISMATCH");
  if (report.duplicatePhysicalRows !== 0) throw new TypeError("MOBILITY_SOURCE_PHYSICAL_DUPLICATE");
}

export async function buildCanonicalMobilityImportPlan(input: {
  readonly filePath: string;
  readonly householdId: string;
  readonly vehicleId?: string;
  readonly placeAuthorities?: readonly MobilityPlaceAuthority[];
  readonly existing?: ExistingMobilityIdentity;
}): Promise<CanonicalMobilityImportPlan> {
  const householdId = assertUuid(input.householdId, "householdId");
  const fileBytes = await readFile(input.filePath);
  const sourceHash = sha256(fileBytes);
  const datasetId = deterministicUuid(DATASET_NAMESPACE, `${householdId}|${sourceHash}|${CANONICAL_MOBILITY_IMPORT_METHOD_VERSION}`);
  const vehicleId = input.vehicleId === undefined
    ? deterministicUuid(VEHICLE_NAMESPACE, `${householdId}|${MOBILITY_VEHICLE_MODEL_REF}`)
    : assertUuid(input.vehicleId, "vehicleId");
  const places = authorityMap(input.placeAuthorities ?? []);
  const workbook = new ExcelJS.Workbook();
  const readableWorkbook = await excelJsCompatibleWorkbook(fileBytes);
  await workbook.xlsx.load(readableWorkbook as never);
  if (JSON.stringify(workbook.worksheets.map(({ name }) => name)) !== JSON.stringify(sheets.map(({ name }) => name))) {
    throw new TypeError("Le XLSX doit contenir exactement les trois onglets certifiés dans leur ordre source.");
  }

  const legs: CanonicalMobilityLegRow[] = [];
  const facts: MobilityLegFact[] = [];
  const sourceIds = new Set<string>();
  const canonicalIds = new Set<string>();
  const physicalIdentities = new Set<string>();
  const duplicatePhysicalIdentities = new Set<string>();
  const endpointIdentities = new Set<string>();
  const resolvedEndpointIdentities = new Set<string>();
  const groupCounts = { NAV: 0, JOUR: 0, AUT: 0 };
  let totalDistance = new Big(0);
  let totalLiters = new Big(0);
  let totalCost = new Big(0);
  let periodStart = "9999-12-31";
  let periodEnd = "0000-01-01";

  for (const sheet of sheets) {
    const worksheet = workbook.getWorksheet(sheet.name);
    if (!worksheet) throw new TypeError(`Onglet absent: ${sheet.name}`);
    const headers = headerMap(worksheet);
    let sheetCount = 0;
    worksheet.eachRow({ includeEmpty: false }, (excelRow, rowNumber) => {
      if (rowNumber === 1) return;
      const row = rawRow(worksheet, excelRow, headers);
      const candidateId = optionalText(row["ID final"]);
      if (candidateId === null || candidateId.startsWith("RÉSUMÉ")) return;
      if (!sourceIdPattern.test(candidateId)) {
        if (rowNumber > sheet.expectedCount + 1) return;
        throw new TypeError(`${sheet.name} ligne ${rowNumber}: ID final invalide.`);
      }
      const group = sourceGroup(candidateId);
      if (group !== sheet.group) throw new TypeError(`${candidateId} ne correspond pas à son onglet.`);
      if (sourceIds.has(candidateId)) throw new TypeError(`source_leg_id dupliqué: ${candidateId}`);
      sourceIds.add(candidateId);
      groupCounts[group] += 1;
      sheetCount += 1;

      const date = localDate(row.Date);
      const origin = endpoint(row, "A", places);
      const destination = endpoint(row, "B", places);
      const distanceKm = nonNegativeDecimal(row["Distance (km)"], "Distance (km)", 9);
      const estimatedFuelLiters = nonNegativeDecimal(row["Essence estimée (L)"], "Essence estimée (L)", 9);
      const estimatedFuelCost = nonNegativeDecimal(row["Coût carburant estimé (€)"], "Coût carburant estimé (€)", 9);
      const fuel = fuelAuthority(row, date);
      const independentlyCalculatedCost = new Big(estimatedFuelLiters).times(fuel.pricePerLiter);
      if (independentlyCalculatedCost.minus(estimatedFuelCost).abs().gt("0.000001")) {
        throw new TypeError(`${candidateId}: coût carburant incohérent avec litres × prix.`);
      }
      const modelRef = requiredText(row.model_key, "model_key");
      if (modelRef !== MOBILITY_VEHICLE_MODEL_REF) throw new TypeError(`${candidateId}: modèle véhicule inattendu.`);
      if (requiredText(row["Statut TomTom"], "Statut TomTom") !== "OK") throw new TypeError(`${candidateId}: résultat routeur non certifié.`);
      const time = mobilityTime(row);
      const physicalIdentity = digest({
        date,
        modelRef,
        origin: [origin.latitude, origin.longitude],
        destination: [destination.latitude, destination.longitude],
        distanceKm,
        observedTime: time.observedTime,
        routeProxyTimes: time.routeProxyTimes,
      });
      if (physicalIdentities.has(physicalIdentity)) duplicatePhysicalIdentities.add(physicalIdentity);
      physicalIdentities.add(physicalIdentity);
      for (const value of [origin, destination]) {
        const key = placeKey(value.sourceLabel, value.latitude, value.longitude);
        endpointIdentities.add(key);
        if (value.placeId !== null) resolvedEndpointIdentities.add(key);
      }
      const legId = deterministicUuid(LEG_NAMESPACE, `${householdId}|${datasetId}|${candidateId}`);
      if (canonicalIds.has(legId)) throw new TypeError(`mobility_leg_id dupliqué: ${legId}`);
      canonicalIds.add(legId);
      const rowHash = digest(Object.fromEntries(Object.entries(row).map(([key, value]) => [key, value instanceof Date ? value.toISOString() : value])));
      const durationMinutes = nullableDecimal(row["Durée estimée (min)"], "Durée estimée (min)");
      const durationNoTrafficMinutes = nullableDecimal(row["Durée sans trafic (min)"], "Durée sans trafic (min)");
      const durationSeconds = durationMinutes === null ? null : new Big(durationMinutes).times(60).round(6).toFixed();
      const durationNoTrafficSeconds = durationNoTrafficMinutes === null ? null : new Big(durationNoTrafficMinutes).times(60).round(6).toFixed();
      const provenance = {
        authority: "CERTIFIED_XLSX_RECONSTRUCTION",
        sourceDataset: requiredText(row["Source dataset"], "Source dataset"),
        originalSourceId: optionalText(row["ID source"]),
        sourceContextLabel: optionalText(row["Sous-catégorie / contexte"]),
        antiDoubleCount: optionalText(row["Anti-double-compte"]),
        linkedSourceIds: optionalText(row["IDs liés / origine"]),
        distanceAuthority: "SOURCE_TOMTOM_RECONSTRUCTION",
        fuelUsageAuthority: "ESTIMATED_DERIVED",
      };
      const evidenceRefs = [`mobility-dataset:${datasetId}`, `mobility-source-leg:${candidateId}`, `mobility-source-row-sha256:${rowHash}`].sort();
      const canonicalRow: CanonicalMobilityLegRow = {
        mobility_leg_id: legId,
        source_leg_id: candidateId,
        dataset_id: datasetId,
        household_id: householdId,
        vehicle_id: vehicleId,
        travel_date: date,
        origin_place_id: origin.placeId,
        destination_place_id: destination.placeId,
        origin_source_label: origin.sourceLabel,
        destination_source_label: destination.sourceLabel,
        origin_source_latitude: origin.latitude,
        origin_source_longitude: origin.longitude,
        destination_source_latitude: destination.latitude,
        destination_source_longitude: destination.longitude,
        origin_resolution_state: origin.resolutionState,
        destination_resolution_state: destination.resolutionState,
        distance_km: distanceKm,
        duration_seconds: durationSeconds,
        duration_no_traffic_seconds: durationNoTrafficSeconds,
        estimated_fuel_liters: estimatedFuelLiters,
        estimated_fuel_cost: estimatedFuelCost,
        fuel_type: fuel.fuelType,
        fuel_price_per_liter: fuel.pricePerLiter,
        fuel_price_period: `${fuel.pricePeriod}-01`,
        fuel_price_geo_scope: fuel.geoScope,
        fuel_price_source: fuel.source,
        fuel_price_quality: fuel.quality,
        fuel_price_observation_id: fuel.observationId,
        consumption_model_ref: modelRef,
        route_method_ref: MOBILITY_ROUTE_METHOD_REF,
        observed_time: time.observedTime,
        time_authority: time.authority,
        time_type: time.type,
        route_time_basis: time.routeTimeBasis,
        route_proxy_times: time.routeProxyTimes,
        source_group: group,
        source_reconstruction: requiredText(row["Source dataset"], "Source dataset"),
        source_sheet: sheet.name,
        source_quality: sourceQuality(row),
        status: "CERTIFIED_SOURCE",
        confidence: confidence(row["Niveau confiance jour"]),
        method_version: MOBILITY_LEG_FACT_METHOD_VERSION,
        source_row_hash: rowHash,
        provenance,
        evidence_refs: evidenceRefs,
      };
      legs.push(canonicalRow);
      facts.push(parseMobilityLegFact({
        fact: "fct_mobility_leg",
        legId,
        householdId,
        vehicleId,
        date,
        origin: { placeId: origin.placeId, sourceLabel: origin.sourceLabel, resolutionState: origin.resolutionState },
        destination: { placeId: destination.placeId, sourceLabel: destination.sourceLabel, resolutionState: destination.resolutionState },
        distanceKm,
        durationSeconds,
        durationNoTrafficSeconds,
        estimatedFuelLiters,
        estimatedFuelCost,
        fuel,
        time,
        consumptionModelRef: modelRef,
        routeMethodRef: MOBILITY_ROUTE_METHOD_REF,
        source: {
          datasetId, sourceLegId: candidateId, group, sheet: sheet.name,
          reconstruction: requiredText(row["Source dataset"], "Source dataset"),
          quality: sourceQuality(row), status: "CERTIFIED_SOURCE", confidence: confidence(row["Niveau confiance jour"]),
          sourceRowHash: rowHash,
        },
        methodVersion: MOBILITY_LEG_FACT_METHOD_VERSION,
        evidenceRefs,
        provenance: "estimated",
      }));
      totalDistance = totalDistance.plus(distanceKm);
      totalLiters = totalLiters.plus(estimatedFuelLiters);
      totalCost = totalCost.plus(estimatedFuelCost);
      if (date < periodStart) periodStart = date;
      if (date > periodEnd) periodEnd = date;
    });
    if (sheetCount !== sheet.expectedCount) throw new TypeError(`${sheet.name}: ${sheetCount} legs au lieu de ${sheet.expectedCount}.`);
  }

  const existingDatasetIds = new Set(input.existing?.datasetIds ?? []);
  const existingLegIds = new Set(input.existing?.legIds ?? []);
  const reportBase = {
    sourceFileName: path.basename(input.filePath), sourceHash, datasetId, vehicleId,
    sourceLegs: legs.length, sourceGroupCounts: groupCounts,
    totalDistanceKm: totalDistance.toFixed(), totalEstimatedFuelLiters: totalLiters.toFixed(), totalEstimatedFuelCost: totalCost.toFixed(),
    periodStart, periodEnd, uniqueSourceLegIds: sourceIds.size, uniqueCanonicalLegIds: canonicalIds.size,
    duplicatePhysicalRows: duplicatePhysicalIdentities.size,
    resolvedPlaceIdentities: resolvedEndpointIdentities.size,
    unresolvedPlaceIdentities: endpointIdentities.size - resolvedEndpointIdentities.size,
    datasetRowsToInsert: existingDatasetIds.has(datasetId) ? 0 : 1,
    legRowsToInsert: legs.filter(({ mobility_leg_id }) => !existingLegIds.has(mobility_leg_id)).length,
  } as const;
  assertSourceControls(reportBase);
  return {
    dataset: {
      dataset_id: datasetId, household_id: householdId, source_name: path.basename(input.filePath),
      period_start: periodStart, period_end: periodEnd, source_hash: sourceHash,
      import_method_version: CANONICAL_MOBILITY_IMPORT_METHOD_VERSION, source_leg_count: legs.length,
    },
    vehicleCandidate: {
      vehicle_id: vehicleId, household_id: householdId, owner_person_id: null,
      label: "Peugeot 207 2010 — 1.4 VTi 95 — SP95 — BVM5", fuel_type: "SP95", consumption_l_100km: null, status: "active",
    },
    legs: legs.sort((left, right) => left.source_leg_id.localeCompare(right.source_leg_id)),
    facts: facts.sort((left, right) => left.source.sourceLegId.localeCompare(right.source.sourceLegId)),
    report: { status: "PASS", ...reportBase, databaseWrites: 0, financeRowsPlanned: 0 },
  };
}
