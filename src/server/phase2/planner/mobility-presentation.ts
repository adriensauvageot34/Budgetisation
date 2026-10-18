import "server-only";
import type { ComposerMobilitySummary } from "@/domain/phase2/planner/composer-ui-contract";
import type { JourneyPrice, PhysicalJourneyRequirement } from "@/domain/phase2/planner/mobility-contract";
import type { PlannerJsonObject } from "@/domain/phase2/planner/json";

/** Caller already validated revision digests; no live provider/readWorld call for this section. */
export function appliedMobilitySummaries(manifest: PlannerJsonObject): ComposerMobilitySummary[] {
  return mobilitySummaries(Array.isArray(manifest.journeys) ? manifest.journeys as unknown as PhysicalJourneyRequirement[] : [],
    Array.isArray(manifest.journeyPrices) ? manifest.journeyPrices as unknown as JourneyPrice[] : []);
}

/** Lightweight display of the owner's price evidence, including immutable revision manifests. */
export function mobilitySummaries(journeys: readonly PhysicalJourneyRequirement[], prices: readonly JourneyPrice[]): ComposerMobilitySummary[] {
  return journeys.map(journey => {
    const price = prices.find(p => p.journeyId === journey.physicalJourneyRequirementId), snapshot = price?.snapshot;
    const evidence = price?.evidence && typeof price.evidence === "object" ? price.evidence as { tollDecision?: { kind: string } } : null;
    return { contextOccurrenceId: journey.ownerContextOccurrenceId, journeyId: journey.physicalJourneyRequirementId, ...(journey.ownerIntentId?{ownerIntentId:journey.ownerIntentId}:{}),
      requestDigest: price?.requestDigest ?? "", status: price?.status ?? "UNKNOWN", distanceKm: snapshot?.route.distanceKm ?? null,
      ...(snapshot?{durationSeconds:snapshot.route.durationSeconds,fuelLiters:snapshot.route.liters}:{}),
      economicFuel: price?.economicFuel ?? null, toll: price?.toll ?? null, parking: price?.parking ?? null, fare: price?.fare ?? null,
      cashTransport: price?.cashTransport ?? null, routeSource: snapshot?.route.provider ?? null, fuelSource: snapshot?.fuelPrice?.source ?? null,
      tollSource: evidence?.tollDecision?.kind === "MANUAL" ? "MANUAL" : evidence?.tollDecision?.kind === "QUOTE" ? "QUOTE"
        : evidence?.tollDecision?.kind === "UNKNOWN" ? null : snapshot?.toll.provider ?? null, vehicleLabel: snapshot?.vehicleLabel ?? null,
      methodRef: snapshot?.route.routeMethodRef ?? null, timeBasis: snapshot?.route.timeBasis ?? null, fallbacks: snapshot?.fallbacks ?? [] };
  });
}
