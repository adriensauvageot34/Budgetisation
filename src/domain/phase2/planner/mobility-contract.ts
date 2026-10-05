import type { ProspectivePlaceRef } from "../planned-contract";
import type { PlannerKnowledge, PlannerTemporalRef } from "./diagnostics";

export type MobilityIntent = Readonly<{ mobilityIntentId: string; contextOccurrenceId: string;
  role: "PRIMARY" | "ACCESS" | "LOCAL_STOP" | "RETURN"; origin: ProspectivePlaceRef | null;
  destination: ProspectivePlaceRef | null; returnRequired: boolean;
  mode: "CAR" | "TRAIN" | "BUS" | "TAXI" | "FREE" | "OTHER" | "UNKNOWN";
  timing: PlannerTemporalRef; knowledge: PlannerKnowledge }>;
export type JourneyDependency = Readonly<{ intentId: string;
  relation: "OWNS_JOURNEY" | "SHARES_JOURNEY" | "ADDS_STOP" | "USES_ACCESS_LEG" | "NO_ADDITIONAL_MOBILITY";
  targetJourneyId: string | null; certainty: "CERTAIN" | "POSSIBLE" | "SIMILAR_ONLY" }>;
export type PhysicalJourneyRequirement = Readonly<{ physicalJourneyRequirementId: string; ownerContextOccurrenceId: string;
  participatingIntentIds: readonly string[]; stops: readonly ProspectivePlaceRef[]; mode: string;
  outbound: PlannerTemporalRef; returnLeg: PlannerTemporalRef | null; pricingState: "RESOLVED" | "PARTIAL" | "UNKNOWN" }>;
