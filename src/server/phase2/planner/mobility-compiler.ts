import "server-only";
import type { MobilityIntent, JourneyPrice } from "@/domain/phase2/planner/mobility-contract";
import type { ComponentRequest, PlanningWorldFacts } from "@/domain/phase2/planner/compiler-contract";
import type { ConstraintResult } from "@/domain/phase2/planner/diagnostics";
import { componentId } from "@/domain/phase2/planner/identity";
import { resolveJourneyRequirements, JOURNEY_RESOLVER_VERSION } from "./journey-resolver";
import { externalJourneyPrice, journeyPricingDigest } from "./prospective-mobility-pricing";

export function compileMobility(intents: readonly MobilityIntent[], world: PlanningWorldFacts) {
  const resolved = resolveJourneyRequirements(intents, world), requests: ComponentRequest[] = [], prices: JourneyPrice[] = [];
  const constraints: ConstraintResult[] = [...resolved.constraints];
  const journeys = resolved.journeys.map(journey => {
    const intent = intents.find(i => i.mobilityIntentId === journey.ownerIntentId)!;
    const price = journey.externalExpenseId ? externalJourneyPrice(journey, intent, world) : world.journeyPrices?.[journey.physicalJourneyRequirementId];
    if (price && (price.journeyId !== journey.physicalJourneyRequirementId || price.requestDigest !== journeyPricingDigest(journey, intent, world))) throw new TypeError("JOURNEY_PRICE_AUTHORITY_STALE");
    if (price) prices.push(price);
    if (!price || price.status !== "RESOLVED") constraints.push({ code: "MOBILITY_PRICING_UNRESOLVED", scope: "MOBILITY", targetRef: journey.physicalJourneyRequirementId,
      severity: "WARN", candidate: null, reference: null, evidenceRefs: [intent.mobilityIntentId], confidence: "HIGH", remediation: null, policyVersion: JOURNEY_RESOLVER_VERSION });
    if (!journey.externalExpenseId) {
      const add = (role: string, amount: string | null, assetKey: string, funding: ComponentRequest["fundingAllocations"]) => {
        if (amount === "0.00") return;
        requests.push({ componentId: componentId(journey.ownerContextOccurrenceId, journey.physicalJourneyRequirementId, role), ownerRef: journey.physicalJourneyRequirementId,
          contextOccurrenceId: journey.ownerContextOccurrenceId, externalEntryId: null, externalLineId: null, role: `mobility:${role}`, label: `Transport ${role}`,
          quantity: "1", cost: amount === null ? { kind: "UNKNOWN" } : { kind: "MANUAL", unitAmount: amount }, fundingAllocations: funding,
          binding: { slotIdentityKey: null, relation: "NO_RELATED_SLOT", displacement: "KNOWN", amount: null, count: null },
          plannedDate: journey.outbound.kind === "DATED" ? journey.outbound.date : null, selectionProvenance: "EXPLICIT_USER_DECISION",
          assetKey, physicalJourneyRequirementId: journey.physicalJourneyRequirementId,
          bindingEvidenceRefs: [...journey.participatingIntentIds, `journey-pricing:${price?.requestDigest ?? "UNKNOWN"}`] });
      };
      if (journey.mode === "CAR") {
        add("fuel-usage", price?.economicFuel ?? null, "transport:fuel_usage", []);
        add("toll", price?.toll ?? null, "transport:toll", price?.toll == null ? [] : [{ source: "BANK", amount: price.toll }]);
        add("parking", price?.parking ?? null, "transport:parking", price?.parking == null ? [] : [{ source: "BANK", amount: price.parking }]);
      } else add("fare", price?.fare ?? null, `transport:${journey.mode === "TAXI" ? "uber" : journey.mode === "TRAIN" ? "train" : journey.mode === "BUS" ? "bus" : "other"}`,
        intent.pricing?.fundingAllocations ?? []);
    }
    return { ...journey, pricingState: price?.status ?? "UNKNOWN" };
  });
  return { journeys, dependencies: resolved.dependencies, constraints, requests, prices };
}
