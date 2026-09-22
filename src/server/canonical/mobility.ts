import "server-only";

import { parseMobilityLegFact, type MobilityLegFact } from "@/analytics/facts";
import {
  canonicalString,
  optionalCanonicalString,
  type CanonicalRecord,
} from "./record";

export const MOBILITY_LEG_SELECTION = [
  "mobility_leg_id", "source_leg_id", "dataset_id", "household_id", "vehicle_id", "travel_date",
  "origin_place_id", "destination_place_id", "origin_source_label", "destination_source_label",
  "origin_resolution_state", "destination_resolution_state",
  "distance_km_text:distance_km::text", "duration_seconds_text:duration_seconds::text",
  "duration_no_traffic_seconds_text:duration_no_traffic_seconds::text",
  "estimated_fuel_liters_text:estimated_fuel_liters::text",
  "estimated_fuel_cost_text:estimated_fuel_cost::text", "fuel_type",
  "fuel_price_per_liter_text:fuel_price_per_liter::text", "fuel_price_period", "fuel_price_geo_scope",
  "fuel_price_source", "fuel_price_quality", "fuel_price_observation_id", "consumption_model_ref",
  "route_method_ref", "observed_time", "time_authority", "time_type", "route_time_basis",
  "route_proxy_times", "source_group", "source_reconstruction", "source_sheet", "source_quality",
  "status", "confidence", "method_version", "source_row_hash", "evidence_refs",
].join(",");

function nullableTimestamp(value: string | undefined): string | null {
  if (value === undefined) return null;
  const normalized = value.replace(" ", "T").slice(0, 19);
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(normalized)) {
    throw new TypeError("mobility_legs.observed_time est invalide.");
  }
  return normalized;
}

function stringArray(value: unknown, field: string): readonly string[] {
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== "string")) {
    throw new TypeError(`${field} doit être un tableau de chaînes.`);
  }
  return value;
}

export function projectMobilityLegFactFromCanonicalRow(row: CanonicalRecord): MobilityLegFact {
  const originPlaceId = optionalCanonicalString(row, ["origin_place_id"]);
  const destinationPlaceId = optionalCanonicalString(row, ["destination_place_id"]);
  const fuelPriceObservationId = optionalCanonicalString(row, ["fuel_price_observation_id"]);
  const observedTime = optionalCanonicalString(row, ["observed_time"]);
  const routeTimeBasis = optionalCanonicalString(row, ["route_time_basis"]);
  return parseMobilityLegFact({
    fact: "fct_mobility_leg",
    legId: canonicalString(row, ["mobility_leg_id"], "mobility"),
    householdId: canonicalString(row, ["household_id"], "mobility"),
    vehicleId: canonicalString(row, ["vehicle_id"], "mobility"),
    date: canonicalString(row, ["travel_date"], "mobility"),
    origin: {
      placeId: originPlaceId ?? null,
      sourceLabel: optionalCanonicalString(row, ["origin_source_label"]) ?? null,
      resolutionState: canonicalString(row, ["origin_resolution_state"], "mobility"),
    },
    destination: {
      placeId: destinationPlaceId ?? null,
      sourceLabel: optionalCanonicalString(row, ["destination_source_label"]) ?? null,
      resolutionState: canonicalString(row, ["destination_resolution_state"], "mobility"),
    },
    distanceKm: canonicalString(row, ["distance_km_text"], "mobility"),
    durationSeconds: optionalCanonicalString(row, ["duration_seconds_text"]) ?? null,
    durationNoTrafficSeconds: optionalCanonicalString(row, ["duration_no_traffic_seconds_text"]) ?? null,
    estimatedFuelLiters: canonicalString(row, ["estimated_fuel_liters_text"], "mobility"),
    estimatedFuelCost: canonicalString(row, ["estimated_fuel_cost_text"], "mobility"),
    fuel: {
      fuelType: canonicalString(row, ["fuel_type"], "mobility"),
      pricePerLiter: canonicalString(row, ["fuel_price_per_liter_text"], "mobility"),
      pricePeriod: canonicalString(row, ["fuel_price_period"], "mobility").slice(0, 7),
      geoScope: canonicalString(row, ["fuel_price_geo_scope"], "mobility"),
      source: canonicalString(row, ["fuel_price_source"], "mobility"),
      quality: canonicalString(row, ["fuel_price_quality"], "mobility"),
      observationId: fuelPriceObservationId ?? null,
    },
    time: {
      observedTime: nullableTimestamp(observedTime),
      authority: canonicalString(row, ["time_authority"], "mobility"),
      type: canonicalString(row, ["time_type"], "mobility"),
      routeTimeBasis: routeTimeBasis ?? null,
      routeProxyTimes: stringArray(row.route_proxy_times, "mobility_legs.route_proxy_times"),
    },
    consumptionModelRef: canonicalString(row, ["consumption_model_ref"], "mobility"),
    routeMethodRef: canonicalString(row, ["route_method_ref"], "mobility"),
    source: {
      datasetId: canonicalString(row, ["dataset_id"], "mobility"),
      sourceLegId: canonicalString(row, ["source_leg_id"], "mobility"),
      group: canonicalString(row, ["source_group"], "mobility"),
      sheet: canonicalString(row, ["source_sheet"], "mobility"),
      reconstruction: canonicalString(row, ["source_reconstruction"], "mobility"),
      quality: canonicalString(row, ["source_quality"], "mobility"),
      status: canonicalString(row, ["status"], "mobility"),
      confidence: canonicalString(row, ["confidence"], "mobility"),
      sourceRowHash: canonicalString(row, ["source_row_hash"], "mobility"),
    },
    methodVersion: canonicalString(row, ["method_version"], "mobility"),
    evidenceRefs: stringArray(row.evidence_refs, "mobility_legs.evidence_refs"),
    provenance: "estimated",
  });
}
