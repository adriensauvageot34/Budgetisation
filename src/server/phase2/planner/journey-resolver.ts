import "server-only";
import { prospectiveJourneyId } from "@/domain/phase2/planner/identity";
import { plannerDigest } from "@/domain/phase2/planner/json";
import type { MobilityIntent, PhysicalJourneyRequirement, JourneyDependency } from "@/domain/phase2/planner/mobility-contract";
import type { PlanningWorldFacts } from "@/domain/phase2/planner/compiler-contract";
import type { ConstraintResult } from "@/domain/phase2/planner/diagnostics";
import { plannedAsset } from "@/domain/phase2/planned-assets";
import { compare } from "./baseline-evidence";

export const JOURNEY_RESOLVER_VERSION = "planner-explicit-journeys@v1";
type Journey = { -readonly [K in keyof PhysicalJourneyRequirement]: PhysicalJourneyRequirement[K] };
export function resolveJourneyRequirements(intents: readonly MobilityIntent[], world: PlanningWorldFacts) {
  const sorted = [...intents].sort((a, b) => compare(a.mobilityIntentId, b.mobilityIntentId));
  if (new Set(sorted.map(i => i.mobilityIntentId)).size !== sorted.length) throw new TypeError("JOURNEY_INTENT_DUPLICATE");
  const byIntent = new Map(sorted.map(i => [i.mobilityIntentId, i])), assignments = new Map<string, Journey | null>();
  const journeys = new Map<string, Journey>(), dependencies: JourneyDependency[] = [], constraints: ConstraintResult[] = [], visiting = new Set<string>();
  const warning = (code: string, id: string, severity: "WARN" | "INFO" = "WARN") => constraints.push({ code, severity, scope: "MOBILITY",
    targetRef: id, candidate: null, reference: null, evidenceRefs: [], confidence: "HIGH", remediation: null, policyVersion: JOURNEY_RESOLVER_VERSION });
  const own = (intent: MobilityIntent, unresolved = false): Journey => {
    const id = prospectiveJourneyId(world.baseline.householdId, world.baseline.targetMonth, intent.mobilityIntentId);
    const stops = intent.origin && intent.destination ? [intent.origin, intent.destination, ...(intent.returnRequired ? [intent.origin] : [])] : [];
    const journey: Journey = { physicalJourneyRequirementId: id, ownerContextOccurrenceId: intent.contextOccurrenceId, ownerIntentId: intent.mobilityIntentId,
      participatingIntentIds: [intent.mobilityIntentId], stops, mode: intent.mode, outbound: intent.timing,
      returnLeg: intent.returnRequired ? intent.returnTiming ?? intent.timing : null, pricingState: "UNKNOWN", externalExpenseId: null,
      externalCostLineIds: [], relationUnresolved: unresolved, returnAnchorIndex: intent.returnRequired ? 1 : null };
    journeys.set(id, journey); return journey;
  };
  const external = (intent: MobilityIntent): Journey => {
    const declaration = intent.journey!, expense = world.externalIntents.find(e => e.id === declaration.externalExpenseId);
    if (!expense || expense.status !== "PLANNED" || expense.householdId !== world.baseline.householdId || expense.targetMonth !== world.baseline.targetMonth)
      throw new TypeError("JOURNEY_EXTERNAL_SCOPE_INVALID");
    const lines = expense.costItems.filter(l => l.assetKey && plannedAsset(l.assetKey)?.module === "transport");
    if (!lines.length || plannerDigest(lines.map(l => l.id).sort()) !== plannerDigest([...declaration.externalCostLineIds].sort()))
      throw new TypeError("JOURNEY_EXTERNAL_TRANSPORT_PROOF_REQUIRED");
    if (!expense.context.route || expense.context.route.mode !== intent.mode || declaration.relation === "ADDS_STOP")
      throw new TypeError("JOURNEY_EXTERNAL_ROUTE_INCOMPATIBLE");
    const id = prospectiveJourneyId(world.baseline.householdId, world.baseline.targetMonth, `external:${expense.id}:transport`);
    const existing = journeys.get(id); if (existing) return existing;
    const route = expense.context.route;
    const journey: Journey = { physicalJourneyRequirementId: id, ownerContextOccurrenceId: intent.contextOccurrenceId, ownerIntentId: intent.mobilityIntentId,
      participatingIntentIds: [], mode: route.mode, stops: route.stops.map(s => s.placeId ? { kind: "KNOWN", placeId: s.placeId } : { kind: "TEXT", label: s.label }),
      outbound: expense.plannedDate ? { kind: "DATED", date: expense.plannedDate, time: route.plannedTime ?? null } : intent.timing,
      returnLeg: expense.context.visitTiming ? { kind: "DATED", date: expense.context.visitTiming.return.date ?? expense.plannedDate!, time: expense.context.visitTiming.return.time } : null,
      pricingState: "UNKNOWN", externalExpenseId: expense.id, externalCostLineIds: lines.map(l => l.id).sort(), relationUnresolved: false,
      returnAnchorIndex: expense.context.visitTiming ? route.stops.findIndex(s => s.endpointSource === "ROOT_PLACE") : null };
    journeys.set(id, journey); return journey;
  };
  const bind = (intent: MobilityIntent): Journey | null => {
    if (assignments.has(intent.mobilityIntentId)) return assignments.get(intent.mobilityIntentId)!;
    if (visiting.has(intent.mobilityIntentId)) throw new TypeError("JOURNEY_DEPENDENCY_CYCLE");
    visiting.add(intent.mobilityIntentId);
    const declaration = intent.journey, relation = declaration?.relation ?? (intent.mode === "FREE" ? "NO_ADDITIONAL_MOBILITY" : "OWNS_JOURNEY");
    if (declaration?.targetIntentId && !byIntent.has(declaration.targetIntentId)) throw new TypeError("JOURNEY_TARGET_INTENT_MISSING");
    let journey: Journey | null = null, resolution: JourneyDependency["resolution"] = "INDEPENDENT";
    if (relation === "NO_ADDITIONAL_MOBILITY") {
      // An explicit absence of additional mobility carries no pricing obligation.
    } else if (!declaration || relation === "OWNS_JOURNEY") journey = own(intent);
    else if (declaration.certainty === "SIMILAR_ONLY" || declaration.choice === "SEPARATE") {
      journey = own(intent); warning("MOBILITY_SIMILARITY_NOT_IDENTITY", intent.mobilityIntentId, "INFO");
    } else if (declaration.certainty === "POSSIBLE" && declaration.choice !== "MERGE") {
      journey = own(intent, true); resolution = "NEEDS_CHOICE"; warning("MOBILITY_RELATION_NEEDS_CHOICE", intent.mobilityIntentId);
    } else {
      const target = declaration.targetIntentId ? byIntent.get(declaration.targetIntentId) : null;
      if (declaration.targetIntentId && !target) throw new TypeError("JOURNEY_TARGET_INTENT_MISSING");
      journey = target ? bind(target) : external(intent);
      if (!journey) throw new TypeError("JOURNEY_TARGET_HAS_NO_MOBILITY");
      if (journey.mode !== intent.mode) throw new TypeError("JOURNEY_SHARED_MODE_INCOMPATIBLE");
      const owner = byIntent.get(journey.ownerIntentId!);
      if (intent.pricing && (!owner || journey.externalExpenseId || plannerDigest(intent.pricing) !== plannerDigest(owner.pricing ?? null)))
        throw new TypeError("JOURNEY_SHARED_PRICING_CONFLICT");
      if (intent.returnRequired && !journey.returnLeg) throw new TypeError("JOURNEY_SHARED_RETURN_INCOMPATIBLE");
      resolution = "BOUND";
      journey.participatingIntentIds = [...journey.participatingIntentIds, intent.mobilityIntentId];
    }
    dependencies.push({ intentId: intent.mobilityIntentId, relation, targetJourneyId: journey?.physicalJourneyRequirementId ?? null,
      certainty: declaration?.certainty ?? "CERTAIN", resolution, accessLegIndex: declaration?.accessLegIndex ?? null });
    assignments.set(intent.mobilityIntentId, journey); visiting.delete(intent.mobilityIntentId); return journey;
  };
  for (const intent of sorted) bind(intent);
  // Stop indices refer to the owner's route before insertions. Duplicate positions are ambiguous.
  for (const journey of journeys.values()) {
    const additions = sorted.filter(i => assignments.get(i.mobilityIntentId) === journey && i.journey?.relation === "ADDS_STOP"
      && dependencies.find(d => d.intentId === i.mobilityIntentId)?.resolution === "BOUND");
    if (new Set(additions.map(i => i.journey!.stopIndex)).size !== additions.length) throw new TypeError("JOURNEY_STOP_ORDER_AMBIGUOUS");
    for (const intent of [...additions].sort((a, b) => b.journey!.stopIndex! - a.journey!.stopIndex!)) {
      const index = intent.journey!.stopIndex!;
      if (journey.mode !== "CAR" || !intent.destination || index >= journey.stops.length) throw new TypeError("JOURNEY_STOP_INVALID");
      journey.stops = [...journey.stops.slice(0, index), intent.destination, ...journey.stops.slice(index)];
      if (journey.returnAnchorIndex != null && index <= journey.returnAnchorIndex) journey.returnAnchorIndex++;
    }
    for (const intent of sorted.filter(i => assignments.get(i.mobilityIntentId) === journey && i.journey?.relation === "USES_ACCESS_LEG"
      && dependencies.find(d => d.intentId === i.mobilityIntentId)?.resolution === "BOUND")) {
      const index = intent.journey!.accessLegIndex!;
      if (index >= journey.stops.length - 1 || !intent.origin || !intent.destination
        || plannerDigest(intent.origin) !== plannerDigest(journey.stops[index]) || plannerDigest(intent.destination) !== plannerDigest(journey.stops[index + 1]))
        throw new TypeError("JOURNEY_ACCESS_LEG_INVALID");
    }
    journey.participatingIntentIds = [...new Set(journey.participatingIntentIds)].sort(compare);
    for (const intent of sorted.filter(i => assignments.get(i.mobilityIntentId) === journey
      && dependencies.find(d => d.intentId === i.mobilityIntentId)?.resolution === "BOUND")) {
      const declaration = intent.journey!;
      const returning = intent.role === "RETURN" || declaration.relation === "USES_ACCESS_LEG"
        && journey.returnAnchorIndex != null && journey.returnAnchorIndex >= 0 && declaration.accessLegIndex! >= journey.returnAnchorIndex
        || declaration.relation === "ADDS_STOP" && declaration.stopIndex! > 1;
      const timing = returning && journey.returnLeg ? journey.returnLeg : journey.outbound;
      if (intent.timing.kind === "DATED" && timing.kind === "DATED" && intent.timing.date !== timing.date)
        throw new TypeError("JOURNEY_SHARED_DATE_INCOMPATIBLE");
    }
    if (!journey.stops.length) warning("MOBILITY_DIRECTION_UNRESOLVED", journey.physicalJourneyRequirementId);
  }
  return { journeys: [...journeys.values()].sort((a, b) => compare(a.physicalJourneyRequirementId, b.physicalJourneyRequirementId)),
    dependencies: dependencies.sort((a, b) => compare(a.intentId, b.intentId)), constraints };
}
