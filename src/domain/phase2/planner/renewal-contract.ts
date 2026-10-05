import type { PlannerKnowledge } from "./diagnostics";

export type AcquisitionEpisode = Readonly<{ acquisitionEpisodeId: string; needId: string; personId: string | null;
  date: string; observationIds: readonly string[]; productKeys: readonly string[]; referenceAmount: string | null;
  coverage: PlannerKnowledge }>;
export type ReplenishmentProfile = Readonly<{ needId: string;
  status: "UNKNOWN" | "DISCRETIONARY_OBSERVED" | "REPLENISHMENT_CANDIDATE" | "REPLENISHMENT_CERTIFIED";
  lastEpisodeId: string | null; distinctAcquisitionCount: number; intervalCount: number;
  medianGapDays: number | null; p25GapDays: number | null; p75GapDays: number | null; coverageThrough: string | null;
  productIdentityState: "STABLE" | "MIXED" | "UNKNOWN"; modelVersion: string }>;
export type NeedOccurrence = Readonly<{ needOccurrenceId: string; needId: string; sourceAcquisitionEpisodeId: string | null;
  dueWindow: Readonly<{ earliest: string | null; central: string | null; latest: string | null }>;
  dueState: "EARLY" | "POSSIBLE" | "PROBABLE" | "LATE" | "UNKNOWN";
  targetMonthRelation: "OUTSIDE" | "CONDITIONAL" | "CENTRAL"; knowledge: PlannerKnowledge }>;
