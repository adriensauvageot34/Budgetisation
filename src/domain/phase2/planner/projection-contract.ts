import type { PlannerJsonObject } from "./json";
import type { PlannerDiagnostic, PlannerKnowledge } from "./diagnostics";

export type FundingProjectionView = PlannerJsonObject;
export type DecisionImpactView = PlannerJsonObject;
export type PlanProjectionV1 = Readonly<{ version: "plan-projection@v1"; targetMonth: string;
  baseline: Readonly<{ economicMonthEndRemainder: string | null; digest: string }>;
  plan: Readonly<{ economicMonthEndRemainder: string | null; impactOnMonthEnd: string | null }>;
  economic: Readonly<{ resources: string | null; certainCommitments: string | null; savingsReservations: string | null;
    needsAndHabits: string | null; discretionaryLife: string | null; explicitContexts: string | null;
    mobilityUsageEconomicCost: string | null; unresolvedEconomicAmount: string | null }>;
  funding: FundingProjectionView;
  cash: Readonly<{ knowledge: PlannerKnowledge; openingBalance: string | null; lowPointAmount: string | null; lowPointDate: string | null }>;
  mobility: Readonly<{ usageEconomicCost: string | null; cashTransportCosts: string | null;
    journeyCount: number; unresolvedJourneyCount: number }>;
  goal: Readonly<{ targetMonthEnd: string | null; gapToGoal: string | null }>;
  impacts: readonly DecisionImpactView[]; diagnostics: readonly PlannerDiagnostic[];
  projectionCompleteness: "COMPLETE" | "PARTIAL" | "UNKNOWN";
  applyReadiness: "READY" | "READY_WITH_WARNINGS" | "BLOCKED" }>;
