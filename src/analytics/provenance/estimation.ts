import Big from "big.js";
import { parseMetricId, type MetricId } from "../../core/identity";
import {
  parseDecimalString,
  parseMoney,
  type DecimalString,
} from "../../core/money";
import {
  createMetricEnvelopeParser,
  parseCoverage,
  parseSupport,
} from "../../core/metrics";
import { parseYearMonth } from "../../core/time";
import { parseMethodVersion, type MethodVersion } from "../../core/versions";
import type {
  EstimationEvidenceRef,
  EstimationTrace,
  FuelTripEstimate,
  FuelTripEstimateInput,
} from "./types";

export const FUEL_TRIP_ESTIMATE_METRIC_ID: MetricId = parseMetricId(
  "fuel_trip_estimate",
);
export const FUEL_TRIP_ESTIMATE_METHOD_VERSION: MethodVersion =
  parseMethodVersion("fuel_trip_estimate@v1");

const evidenceKinds = new Set([
  "distance",
  "vehicle_consumption",
  "fuel_price",
] as const);
const parseFuelEstimateEnvelope = createMetricEnvelopeParser({
  parseValue: parseMoney,
  allowedUnits: ["EUR"] as const,
});

function parseEvidenceRefs(
  values: readonly EstimationEvidenceRef[],
): readonly EstimationEvidenceRef[] {
  return values.map((evidence) => {
    if (
      !evidenceKinds.has(evidence.kind) ||
      typeof evidence.ref !== "string" ||
      evidence.ref.trim().length === 0
    ) {
      throw new TypeError(
        "Une preuve d'estimation exige un kind fermé et une ref non vide.",
      );
    }
    return { kind: evidence.kind, ref: evidence.ref };
  });
}

function traceFromInput(input: FuelTripEstimateInput): EstimationTrace {
  return {
    metricId: FUEL_TRIP_ESTIMATE_METRIC_ID,
    methodVersion: FUEL_TRIP_ESTIMATE_METHOD_VERSION,
    ...(input.period === undefined
      ? {}
      : { period: parseYearMonth(input.period) }),
    asOf: parseYearMonth(input.asOf),
    evidenceRefs: parseEvidenceRefs(input.evidenceRefs),
  };
}

function optionalDecimal(value: unknown): DecimalString | null {
  return value === undefined || value === null
    ? null
    : parseDecimalString(value);
}

export function calculateFuelTripEstimate(
  input: FuelTripEstimateInput,
): FuelTripEstimate {
  const trace = traceFromInput(input);
  const distance = optionalDecimal(input.distanceKm);
  const consumption = optionalDecimal(
    input.vehicleConsumptionLitersPer100Km,
  );
  const price = optionalDecimal(input.fuelPricePerLiter);
  const hasAllInputs =
    distance !== null && consumption !== null && price !== null;
  const value = hasAllInputs
    ? new Big(distance).times(consumption).div(100).times(price).toFixed()
    : null;
  const envelope = parseFuelEstimateEnvelope({
    availability: hasAllInputs ? "known" : "unknown",
    value,
    unit: "EUR",
    provenance: "estimated",
    methodVersion: FUEL_TRIP_ESTIMATE_METHOD_VERSION,
    ...(input.coverage === undefined
      ? {}
      : { coverage: parseCoverage(input.coverage) }),
    ...(input.support === undefined
      ? {}
      : { support: parseSupport(input.support) }),
  });
  return { ...trace, ...envelope };
}
