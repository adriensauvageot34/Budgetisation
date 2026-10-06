import "server-only";
import type { PlanningBaselineSources } from "./baseline-sources";
import type { PlanningWorldFacts } from "@/domain/phase2/planner/compiler-contract";
import type { HistoricalRouteLeg } from "@/domain/phase2/planned-routes";
import { compare } from "./baseline-evidence";

/** Directed history admitted by Canonical/C1, not bank payment guesses or nonadditive Personal rollups. */
export function buildProspectiveMobilityFacts(sources: PlanningBaselineSources): NonNullable<PlanningWorldFacts["mobilityFacts"]> {
  const vehicleHistory: Record<string, HistoricalRouteLeg[]> = {}, evidenceRefs: string[] = [];
  for (const leg of [...sources.mobilityLegs].sort((a, b) => compare(a.legId, b.legId))) {
    if (leg.source.status !== "CERTIFIED_SOURCE" || !leg.origin.placeId || !leg.destination.placeId) continue;
    if (leg.householdId !== sources.householdId) throw new TypeError("MOBILITY_AUTHORITY_HOUSEHOLD_INVALID");
    if (leg.date > sources.knowledgeCutoff.slice(0, 10)) continue;
    (vehicleHistory[leg.vehicleId] ??= []).push({ originPlaceId: leg.origin.placeId, destinationPlaceId: leg.destination.placeId,
      distanceKm: leg.distanceKm, fuelLiters: leg.estimatedFuelLiters, method: leg.routeMethodRef, date: leg.date });
    evidenceRefs.push(`mobility-leg:${leg.legId}`);
  }
  return { places: [], vehicle: null, history: [], vehicleHistory, personalAuthority: sources.personalMobility, evidenceRefs };
}
