import type { ProspectivePlaceRef } from "../planned-contract";
import type { PlannerKnowledge, PlannerTemporalRef } from "./diagnostics";
import type { KernelCost } from "./compiler-contract";
import type { FundingAllocation } from "../planned-contract";
import type { PlannedCarSnapshot } from "../planned-car";

/** Manifest evidence omits calculation clocks recursively; it is not a reusable live-estimate input. */
export type ClocklessMobilityEvidence<T> = T extends readonly (infer Item)[] ? readonly ClocklessMobilityEvidence<Item>[]
  : T extends object ? { readonly [Key in keyof T as Key extends "calculatedAt" ? never : Key]: ClocklessMobilityEvidence<T[Key]> } : T;

export type JourneyRelation = "OWNS_JOURNEY" | "SHARES_JOURNEY" | "ADDS_STOP" | "USES_ACCESS_LEG" | "NO_ADDITIONAL_MOBILITY";
/** User intent only: targets are semantic identities, never a route hash or price. */
export type JourneyDeclaration = Readonly<{ relation: JourneyRelation; certainty: "CERTAIN" | "POSSIBLE" | "SIMILAR_ONLY";
  targetIntentId: string | null; externalExpenseId: string | null; externalCostLineIds: readonly string[];
  choice: "MERGE" | "SEPARATE" | null; stopIndex: number | null; accessLegIndex: number | null }>;
export type MobilityPricingDecision = Readonly<{ fare: KernelCost; parking: KernelCost;
  fundingAllocations: readonly FundingAllocation[]; preference: "FASTEST" | "AVOID_TOLLS" }>;

export type MobilityIntent = Readonly<{ mobilityIntentId: string; contextOccurrenceId: string;
  role: "PRIMARY" | "ACCESS" | "LOCAL_STOP" | "RETURN"; origin: ProspectivePlaceRef | null;
  destination: ProspectivePlaceRef | null; returnRequired: boolean;
  mode: "CAR" | "TRAIN" | "BUS" | "TAXI" | "FREE" | "OTHER" | "UNKNOWN";
  timing: PlannerTemporalRef; knowledge: PlannerKnowledge; slotKey?: string; returnTiming?: PlannerTemporalRef | null;
  journey?: JourneyDeclaration; pricing?: MobilityPricingDecision }>;
export type JourneyDependency = Readonly<{ intentId: string;
  relation: "OWNS_JOURNEY" | "SHARES_JOURNEY" | "ADDS_STOP" | "USES_ACCESS_LEG" | "NO_ADDITIONAL_MOBILITY";
  targetJourneyId: string | null; certainty: "CERTAIN" | "POSSIBLE" | "SIMILAR_ONLY";
  resolution?: "BOUND" | "INDEPENDENT" | "NEEDS_CHOICE"; accessLegIndex?: number | null }>;
export type PhysicalJourneyRequirement = Readonly<{ physicalJourneyRequirementId: string; ownerContextOccurrenceId: string;
  participatingIntentIds: readonly string[]; stops: readonly ProspectivePlaceRef[]; mode: string;
  outbound: PlannerTemporalRef; returnLeg: PlannerTemporalRef | null; pricingState: "RESOLVED" | "PARTIAL" | "UNKNOWN";
  ownerIntentId?: string; externalExpenseId?: string | null; externalCostLineIds?: readonly string[];
  relationUnresolved?: boolean; returnAnchorIndex?: number | null }>;
export type JourneyPrice = Readonly<{ journeyId: string; requestDigest: string; economicFuel: string | null;
  cashTransport: string | null; fare: string | null; toll: string | null; parking: string | null;
  status: "RESOLVED" | "PARTIAL" | "UNKNOWN"; evidence: unknown; snapshot: ClocklessMobilityEvidence<PlannedCarSnapshot> | null }>;
