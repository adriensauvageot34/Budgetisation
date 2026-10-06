import "server-only";
import Big from "big.js";
import type { PlanningWorldFacts, ComponentRequest, KernelCost } from "@/domain/phase2/planner/compiler-contract";
import type { MobilityIntent, PhysicalJourneyRequirement, JourneyPrice, ClocklessMobilityEvidence } from "@/domain/phase2/planner/mobility-contract";
import type { PlanSemanticStateV1 } from "@/domain/phase2/planner/semantic-state";
import { plannerDigest } from "@/domain/phase2/planner/json";
import { stopForPlace } from "@/domain/phase2/planned-routes";
import { plannedLineGross, costItemCashTreatment } from "@/domain/phase2/planned-money";
import { transportTotals } from "@/domain/phase2/planned-car";
import { estimatePlannedCar } from "../planned-car-estimation";
import { TomTomRouteProvider, FrenchOfficialFuelPriceProvider, HereTollProvider } from "../planned-car-providers";
import { resolveComponentCost } from "./cost-resolver";
import { expandComposableContexts } from "./context-compiler";
import { materializePlanSlots } from "./plan-slot-resolver";
import { resolveJourneyRequirements } from "./journey-resolver";

export const PROSPECTIVE_MOBILITY_PRICING_VERSION = "planner-existing-mobility-pricing@v1";
export type MobilityProviders = Parameters<typeof estimatePlannedCar>[2];
/** Provider calculation clocks are operational metadata, not a new authority on every re-read. */
export function stableMobilityEvidence<T>(value: T): ClocklessMobilityEvidence<T> {
  if (Array.isArray(value)) return value.map(stableMobilityEvidence) as ClocklessMobilityEvidence<T>;
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).filter(([key]) => key !== "calculatedAt")
    .map(([key, item]) => [key, stableMobilityEvidence(item)])) as ClocklessMobilityEvidence<T>;
  return value as ClocklessMobilityEvidence<T>;
}
export function journeyPricingDigest(journey: PhysicalJourneyRequirement, intent: MobilityIntent, world: PlanningWorldFacts) {
  return plannerDigest(JSON.parse(JSON.stringify({ journey, pricing: intent.pricing ?? null,
    costQuotes: world.costQuotes, authority: world.mobilityFacts ? { vehicle: world.mobilityFacts.vehicle, places: world.mobilityFacts.places, history: world.mobilityFacts.history,
      personalAuthority: world.mobilityFacts.personalAuthority.outputHash, evidenceRefs: world.mobilityFacts.evidenceRefs } : null })));
}
function declaredCost(cost: KernelCost, world: PlanningWorldFacts) {
  return resolveComponentCost({ quantity: "1", cost } as ComponentRequest, world).economicAmount;
}
export function externalJourneyPrice(journey: PhysicalJourneyRequirement, intent: MobilityIntent, world: PlanningWorldFacts): JourneyPrice {
  const expense = world.externalIntents.find(e => e.id === journey.externalExpenseId)!;
  const lines = expense.costItems.filter(l => journey.externalCostLineIds!.includes(l.id));
  const fuel = lines.filter(l => costItemCashTreatment(l) === "ECONOMIC_ONLY");
  const sum = (items: typeof lines) => items.reduce((n, l) => n.plus(plannedLineGross(l)), new Big(0)).toFixed(2);
  const snapshot = expense.context.route?.liveEstimate ?? null;
  const economicFuel = journey.mode === "CAR" ? fuel.length ? sum(fuel) : null : "0.00";
  const payable = lines.filter(l => costItemCashTreatment(l) !== "ECONOMIC_ONLY");
  const knownToll = lines.some(l => l.assetKey === "transport:toll") || snapshot?.toll.amount != null || expense.context.route?.tollFreeConfirmed === true;
  const cashTransport = journey.mode === "CAR" && !knownToll ? null : sum(payable);
  return { journeyId: journey.physicalJourneyRequirementId, requestDigest: journeyPricingDigest(journey, intent, world), economicFuel, cashTransport,
    fare: journey.mode === "CAR" ? null : cashTransport, toll: journey.mode === "CAR" ? cashTransport : null, parking: "0.00",
    status: economicFuel === null || cashTransport === null || !journey.stops.length ? "PARTIAL" : "RESOLVED",
    evidence: stableMobilityEvidence({ owner: "external-planned-expense", expenseId: expense.id, lines, snapshot }),
    snapshot: snapshot ? stableMobilityEvidence(snapshot) : null };
}
/** No network inside the deterministic compiler. Read prices first, through existing owners once per physical requirement. */
export async function preparePlanningMobility(world: PlanningWorldFacts, state: PlanSemanticStateV1, providers?: MobilityProviders): Promise<PlanningWorldFacts> {
  const owners = providers ?? { route: new TomTomRouteProvider(), fuel: new FrenchOfficialFuelPriceProvider(), toll: new HereTollProvider() };
  const cutoff = Date.parse(world.baseline.knowledgeCutoff);
  const admittedProviders = { ...owners, fuel: { async getReference(origin: Parameters<NonNullable<MobilityProviders>["fuel"]["getReference"]>[0]) {
    const reference = await owners.fuel.getReference(origin);
    return reference && Number.isFinite(Date.parse(reference.observedAt)) && Date.parse(reference.observedAt) <= cutoff ? reference : null;
  } } };
  const expansion = expandComposableContexts(state, world, materializePlanSlots(world.baseline, state));
  const resolved = resolveJourneyRequirements(expansion.mobilityIntents, world), prices: Record<string, JourneyPrice> = {};
  for (const journey of resolved.journeys) {
    const intent = expansion.mobilityIntents.find(i => i.mobilityIntentId === journey.ownerIntentId)!;
    if (journey.externalExpenseId) { prices[journey.physicalJourneyRequirementId] = externalJourneyPrice(journey, intent, world); continue; }
    if (world.mobilityFacts && journey.stops.some(ref => ref.kind === "KNOWN" && !world.mobilityFacts!.places.some(p => p.placeId === ref.placeId)))
      throw new TypeError("PLANNED_ROUTE_PLACE_INVALID");
    let economicFuel: string | null = journey.mode === "CAR" ? null : "0.00", cashTransport: string | null = null;
    let fare: string | null = null, toll: string | null = null, parking: string | null = null;
    let snapshot: JourneyPrice["snapshot"] = null, evidence: unknown = { owner: "declared-prospective-fare" };
    if (!journey.relationUnresolved && journey.stops.length >= 2) {
      if (journey.mode === "CAR" && world.mobilityFacts?.vehicle) {
        const rawFacts = world.mobilityFacts, vehicle = rawFacts.vehicle!;
        const facts = { ...rawFacts, history: rawFacts.history.filter(leg => leg.date <= world.baseline.knowledgeCutoff.slice(0, 10)),
          vehicle: vehicle.fuelPriceObservedAt && Date.parse(vehicle.fuelPriceObservedAt) > cutoff ? { ...vehicle, fuelPricePerLiter: "0" } : vehicle };
        const anchor = journey.stops.findIndex((ref, index) => index > 0 && plannerDigest(ref) === plannerDigest(intent.destination));
        const stops = journey.stops.map((ref, index) => stopForPlace(ref, ref.kind === "KNOWN" ? facts.places.find(p => p.placeId === ref.placeId)?.name ?? ref.placeId : ref.label,
          index === anchor ? "ROOT_PLACE" : "DIRECT_PLACE"));
        const date = journey.outbound.kind === "DATED" ? journey.outbound.date : null;
        try {
          const result = await estimatePlannedCar({ stops, plannedDate: date,
            plannedTime: journey.outbound.kind === "DATED" ? journey.outbound.time : null, preference: intent.pricing?.preference ?? "FASTEST",
            ...(journey.returnLeg ? { tripTiming: { outbound: { date, time: journey.outbound.kind === "DATED" ? journey.outbound.time : null },
              return: { required: true as const, date: journey.returnLeg.kind === "DATED" ? journey.returnLeg.date : null,
                time: journey.returnLeg.kind === "DATED" ? journey.returnLeg.time : null } } } : {}) }, facts, admittedProviders);
          snapshot = result.snapshot ? stableMobilityEvidence(result.snapshot) : null;
          economicFuel = result.snapshot?.fuelEconomicCost ?? null; toll = result.snapshot?.toll.amount ?? null;
          // A missing canonical price observation date stays explicitly undated; it must not become a changing clock authority.
          if (snapshot?.fuelPrice?.source === "CANONICAL_OBSERVATION" && !facts.vehicle?.fuelPriceObservedAt)
            snapshot = { ...snapshot, fuelPrice: { ...snapshot.fuelPrice, observedAt: "CANONICAL_OBSERVATION_DATE_UNKNOWN" } };
          parking = declaredCost(intent.pricing?.parking ?? { kind: "MANUAL", unitAmount: "0" }, world);
          cashTransport = parking === null ? null : transportTotals(economicFuel, toll, parking).cash;
          evidence = { owner: "estimatePlannedCar@planned-car-live-v2", status: result.status, snapshot,
            canonicalEvidenceRefs: facts.evidenceRefs, personalMobilityMethod: facts.personalAuthority.methodVersion,
            personalMobilityOutputHash: facts.personalAuthority.outputHash };
        } catch (error) {
          // Availability errors retain UNKNOWN. Invalid authorized place references are semantic errors.
          if (error instanceof TypeError && error.message === "PLANNED_ROUTE_PLACE_INVALID") throw error;
          evidence = { owner: "estimatePlannedCar@planned-car-live-v2", status: "UNAVAILABLE", code: error instanceof TypeError ? error.message : "PROVIDER_UNAVAILABLE" };
        }
      } else if (!["CAR", "UNKNOWN"].includes(journey.mode)) {
        fare = journey.mode === "FREE" ? "0.00" : declaredCost(intent.pricing?.fare ?? { kind: "UNKNOWN" }, world); cashTransport = fare;
      }
    }
    const status = economicFuel !== null && cashTransport !== null ? "RESOLVED" : economicFuel !== null || snapshot ? "PARTIAL" : "UNKNOWN";
    prices[journey.physicalJourneyRequirementId] = { journeyId: journey.physicalJourneyRequirementId,
      requestDigest: journeyPricingDigest(journey, intent, world), economicFuel, cashTransport, fare, toll, parking, status, evidence, snapshot };
  }
  return { ...world, journeyPrices: prices };
}
