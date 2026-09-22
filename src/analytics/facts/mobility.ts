import Big from "big.js";
import { parseHouseholdId, parsePlaceId } from "../../core/identity";
import { addMoney, parseDecimalString, parseMoney, type Money } from "../../core/money";
import { parseLocalDate, parseYearMonth } from "../../core/time";
import { parseMethodVersion } from "../../core/versions";
import { createRuntimeSchema, parseStrictRecord, requireProperty } from "../../core/validation";
import type {
  MobilityLegEndpoint,
  MobilityLegFact,
  MobilityLegFuelAuthority,
  MobilityLegSource,
  MobilityLegTime,
} from "./types";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const hashPattern = /^[0-9a-f]{64}$/;
const localDateTimePattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/;

function nonEmptyString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new TypeError(`${field} doit être une chaîne non vide.`);
  }
  return value;
}

function nullableString(value: unknown, field: string): string | null {
  return value === null ? null : nonEmptyString(value, field);
}

function uuid(value: unknown, field: string): string {
  const parsed = nonEmptyString(value, field);
  if (!uuidPattern.test(parsed)) throw new TypeError(`${field} doit être un UUID.`);
  return parsed.toLowerCase();
}

function nullableUuid(value: unknown, field: string): string | null {
  return value === null ? null : uuid(value, field);
}

function literal<Value extends string>(value: unknown, values: readonly Value[], field: string): Value {
  if (typeof value !== "string" || !values.includes(value as Value)) {
    throw new TypeError(`${field} porte une valeur invalide.`);
  }
  return value as Value;
}

function parseEvidenceRefs(value: unknown): readonly string[] {
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== "string" || entry.trim().length === 0)) {
    throw new TypeError("MobilityLegFact.evidenceRefs doit être un tableau de références non vides.");
  }
  const normalized = [...new Set(value)].sort();
  if (normalized.length !== value.length) throw new TypeError("MobilityLegFact.evidenceRefs contient un doublon.");
  return normalized;
}

function parseEndpoint(value: unknown, field: string): MobilityLegEndpoint {
  const record = parseStrictRecord(value, ["placeId", "sourceLabel", "resolutionState"], field);
  const placeId = nullableUuid(requireProperty(record, "placeId", field), `${field}.placeId`);
  const sourceLabel = nullableString(requireProperty(record, "sourceLabel", field), `${field}.sourceLabel`);
  const resolutionState = literal(
    requireProperty(record, "resolutionState", field),
    ["EXPLICIT_MAPPING", "UNRESOLVED"] as const,
    `${field}.resolutionState`,
  );
  if ((resolutionState === "EXPLICIT_MAPPING") !== (placeId !== null)) {
    throw new TypeError(`${field} doit conserver la cohérence place/résolution.`);
  }
  return {
    placeId: placeId === null ? null : parsePlaceId(placeId),
    sourceLabel,
    resolutionState,
  };
}

function parseFuelAuthority(value: unknown): MobilityLegFuelAuthority {
  const record = parseStrictRecord(
    value,
    ["fuelType", "pricePerLiter", "pricePeriod", "geoScope", "source", "quality", "observationId"],
    "MobilityLegFuelAuthority",
  );
  const pricePerLiter = parseDecimalString(requireProperty(record, "pricePerLiter", "MobilityLegFuelAuthority"));
  if (new Big(pricePerLiter).lte(0)) throw new TypeError("Fuel price doit être strictement positif.");
  const geoScope = literal(requireProperty(record, "geoScope", "MobilityLegFuelAuthority"), ["LOCAL_DEPARTMENT", "NATIONAL"] as const, "geoScope");
  const quality = literal(requireProperty(record, "quality", "MobilityLegFuelAuthority"), ["P3_LOCAL_DEPARTMENT", "P4_NATIONAL_FALLBACK"] as const, "quality");
  if (
    (quality === "P3_LOCAL_DEPARTMENT" && geoScope !== "LOCAL_DEPARTMENT")
    || (quality === "P4_NATIONAL_FALLBACK" && geoScope !== "NATIONAL")
  ) {
    throw new TypeError("La qualité FuelPrice doit conserver son périmètre géographique.");
  }
  return {
    fuelType: literal(requireProperty(record, "fuelType", "MobilityLegFuelAuthority"), ["SP95"] as const, "fuelType"),
    pricePerLiter,
    pricePeriod: parseYearMonth(requireProperty(record, "pricePeriod", "MobilityLegFuelAuthority")),
    geoScope,
    source: nonEmptyString(requireProperty(record, "source", "MobilityLegFuelAuthority"), "fuel.source"),
    quality,
    observationId: nullableUuid(requireProperty(record, "observationId", "MobilityLegFuelAuthority"), "fuel.observationId"),
  };
}

function parseTime(value: unknown): MobilityLegTime {
  const record = parseStrictRecord(value, ["observedTime", "authority", "type", "routeTimeBasis", "routeProxyTimes"], "MobilityLegTime");
  const observedTime = nullableString(requireProperty(record, "observedTime", "MobilityLegTime"), "time.observedTime");
  if (observedTime !== null && !localDateTimePattern.test(observedTime)) {
    throw new TypeError("MobilityLegTime.observedTime doit être un timestamp local ISO sans timezone.");
  }
  const authority = literal(requireProperty(record, "authority", "MobilityLegTime"), ["OBSERVED", "PROXY", "UNKNOWN"] as const, "time.authority");
  if (authority === "OBSERVED" && observedTime === null) throw new TypeError("Une heure observée exige sa valeur.");
  if (authority !== "OBSERVED" && observedTime !== null) throw new TypeError("Une heure non observée ne peut pas porter observedTime.");
  const rawProxyTimes = requireProperty(record, "routeProxyTimes", "MobilityLegTime");
  if (!Array.isArray(rawProxyTimes) || rawProxyTimes.some((entry) => typeof entry !== "string" || !localDateTimePattern.test(entry))) {
    throw new TypeError("MobilityLegTime.routeProxyTimes doit contenir des timestamps locaux ISO.");
  }
  return {
    observedTime,
    authority,
    type: literal(requireProperty(record, "type", "MobilityLegTime"), ["DEPARTURE", "ARRIVAL", "UNTYPED", "UNKNOWN"] as const, "time.type"),
    routeTimeBasis: nullableString(requireProperty(record, "routeTimeBasis", "MobilityLegTime"), "time.routeTimeBasis"),
    routeProxyTimes: [...new Set(rawProxyTimes)].sort(),
  };
}

function parseSource(value: unknown): MobilityLegSource {
  const record = parseStrictRecord(
    value,
    ["datasetId", "sourceLegId", "group", "sheet", "reconstruction", "quality", "status", "confidence", "sourceRowHash"],
    "MobilityLegSource",
  );
  const sourceLegId = nonEmptyString(requireProperty(record, "sourceLegId", "MobilityLegSource"), "source.sourceLegId");
  const group = literal(requireProperty(record, "group", "MobilityLegSource"), ["NAV", "JOUR", "AUT"] as const, "source.group");
  if (!new RegExp(`^${group}-[0-9]{4}$`).test(sourceLegId)) {
    throw new TypeError("sourceLegId doit correspondre au lineage source.");
  }
  const sourceRowHash = nonEmptyString(requireProperty(record, "sourceRowHash", "MobilityLegSource"), "source.sourceRowHash");
  if (!hashPattern.test(sourceRowHash)) throw new TypeError("sourceRowHash doit être un SHA-256 lowercase.");
  return {
    datasetId: uuid(requireProperty(record, "datasetId", "MobilityLegSource"), "source.datasetId"),
    sourceLegId,
    group,
    sheet: nonEmptyString(requireProperty(record, "sheet", "MobilityLegSource"), "source.sheet"),
    reconstruction: nonEmptyString(requireProperty(record, "reconstruction", "MobilityLegSource"), "source.reconstruction"),
    quality: nonEmptyString(requireProperty(record, "quality", "MobilityLegSource"), "source.quality"),
    status: literal(requireProperty(record, "status", "MobilityLegSource"), ["CERTIFIED_SOURCE", "SOURCE_PARTIAL"] as const, "source.status"),
    confidence: literal(requireProperty(record, "confidence", "MobilityLegSource"), ["HIGH", "MEDIUM", "LOW", "UNKNOWN"] as const, "source.confidence"),
    sourceRowHash,
  };
}

function nonNegativeDecimal(value: unknown, field: string) {
  const parsed = parseDecimalString(value);
  if (new Big(parsed).lt(0)) throw new TypeError(`${field} doit être positif ou nul.`);
  return parsed;
}

function nullableNonNegativeDecimal(value: unknown, field: string) {
  return value === null ? null : nonNegativeDecimal(value, field);
}

export function parseMobilityLegFact(value: unknown): MobilityLegFact {
  const record = parseStrictRecord(
    value,
    [
      "fact", "legId", "householdId", "vehicleId", "date", "origin", "destination",
      "distanceKm", "durationSeconds", "durationNoTrafficSeconds", "estimatedFuelLiters",
      "estimatedFuelCost", "fuel", "time", "consumptionModelRef", "routeMethodRef",
      "source", "methodVersion", "evidenceRefs", "provenance",
    ],
    "MobilityLegFact",
  );
  if (record.fact !== "fct_mobility_leg") throw new TypeError("MobilityLegFact.fact est invalide.");
  if (record.provenance !== "estimated") throw new TypeError("MobilityLegFact.provenance doit rester estimated.");
  const estimatedFuelCost = parseMoney(requireProperty(record, "estimatedFuelCost", "MobilityLegFact"));
  if (new Big(estimatedFuelCost).lt(0)) throw new TypeError("estimatedFuelCost doit être positif ou nul.");
  return {
    fact: "fct_mobility_leg",
    legId: uuid(requireProperty(record, "legId", "MobilityLegFact"), "legId"),
    householdId: parseHouseholdId(requireProperty(record, "householdId", "MobilityLegFact")),
    vehicleId: uuid(requireProperty(record, "vehicleId", "MobilityLegFact"), "vehicleId"),
    date: parseLocalDate(requireProperty(record, "date", "MobilityLegFact")),
    origin: parseEndpoint(requireProperty(record, "origin", "MobilityLegFact"), "MobilityLegFact.origin"),
    destination: parseEndpoint(requireProperty(record, "destination", "MobilityLegFact"), "MobilityLegFact.destination"),
    distanceKm: nonNegativeDecimal(requireProperty(record, "distanceKm", "MobilityLegFact"), "distanceKm"),
    durationSeconds: nullableNonNegativeDecimal(requireProperty(record, "durationSeconds", "MobilityLegFact"), "durationSeconds"),
    durationNoTrafficSeconds: nullableNonNegativeDecimal(requireProperty(record, "durationNoTrafficSeconds", "MobilityLegFact"), "durationNoTrafficSeconds"),
    estimatedFuelLiters: nonNegativeDecimal(requireProperty(record, "estimatedFuelLiters", "MobilityLegFact"), "estimatedFuelLiters"),
    estimatedFuelCost,
    fuel: parseFuelAuthority(requireProperty(record, "fuel", "MobilityLegFact")),
    time: parseTime(requireProperty(record, "time", "MobilityLegFact")),
    consumptionModelRef: nonEmptyString(requireProperty(record, "consumptionModelRef", "MobilityLegFact"), "consumptionModelRef"),
    routeMethodRef: nonEmptyString(requireProperty(record, "routeMethodRef", "MobilityLegFact"), "routeMethodRef"),
    source: parseSource(requireProperty(record, "source", "MobilityLegFact")),
    methodVersion: parseMethodVersion(requireProperty(record, "methodVersion", "MobilityLegFact")),
    evidenceRefs: parseEvidenceRefs(requireProperty(record, "evidenceRefs", "MobilityLegFact")),
    provenance: "estimated",
  };
}

export function sumMobilityEstimatedFuelCost(facts: readonly unknown[]): Money {
  const byLeg = new Map<string, MobilityLegFact>();
  for (const fact of facts.map(parseMobilityLegFact)) {
    const existing = byLeg.get(fact.legId);
    if (existing !== undefined && JSON.stringify(existing) !== JSON.stringify(fact)) {
      throw new TypeError("Un MobilityLeg possède deux versions contradictoires.");
    }
    byLeg.set(fact.legId, fact);
  }
  return [...byLeg.values()].reduce(
    (sum, fact) => addMoney(sum, fact.estimatedFuelCost),
    parseMoney("0"),
  );
}

export const mobilityLegFactSchema = createRuntimeSchema(parseMobilityLegFact);
