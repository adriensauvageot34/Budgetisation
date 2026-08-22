import type { MetricId } from "../../core/identity";
import type { Money } from "../../core/money";
import type {
  Coverage,
  MetricEnvelope,
  Provenance,
  Support,
} from "../../core/metrics";
import type { YearMonth } from "../../core/time";
import type { MethodVersion } from "../../core/versions";

export type EstimationEvidenceKind =
  | "distance"
  | "vehicle_consumption"
  | "fuel_price";

export type EstimationEvidenceRef = {
  readonly kind: EstimationEvidenceKind;
  readonly ref: string;
};

export type EstimationTrace = {
  readonly metricId: MetricId;
  readonly methodVersion: MethodVersion;
  readonly period?: YearMonth;
  readonly asOf: YearMonth;
  readonly evidenceRefs: readonly EstimationEvidenceRef[];
};

export type FuelTripEstimate = EstimationTrace &
  MetricEnvelope<Money, "EUR">;

export type FuelTripEstimateInput = {
  readonly distanceKm?: unknown;
  readonly vehicleConsumptionLitersPer100Km?: unknown;
  readonly fuelPricePerLiter?: unknown;
  readonly period?: unknown;
  readonly asOf: unknown;
  readonly evidenceRefs: readonly EstimationEvidenceRef[];
  readonly coverage?: Coverage;
  readonly support?: Support;
};

export type CompositeProvenanceRule = {
  readonly methodVersion: MethodVersion;
  readonly resolve: (inputs: readonly Provenance[]) => Provenance;
};

export type CompositeProvenanceResolution =
  | {
      readonly publishable: true;
      readonly provenance: Provenance;
      readonly methodVersion?: MethodVersion;
    }
  | {
      readonly publishable: false;
      readonly reason: "method_blocked";
    };
