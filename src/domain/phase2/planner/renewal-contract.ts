import type { PlannerKnowledge } from "./diagnostics";
import type { PlannerDiagnostic } from "./diagnostics";

export type AcquisitionEpisode = Readonly<{ acquisitionEpisodeId: string; needId: string; personId: string | null;
  date: string; observationIds: readonly string[]; productKeys: readonly string[]; referenceAmount: string | null;
  coverage: PlannerKnowledge; evidenceRefs: readonly string[] }>;
export type ReplenishmentProfile = Readonly<{ needId: string;
  status: "UNKNOWN" | "DISCRETIONARY_OBSERVED" | "REPLENISHMENT_CANDIDATE" | "REPLENISHMENT_CERTIFIED";
  lastEpisodeId: string | null; distinctAcquisitionCount: number; intervalCount: number;
  medianGapDays: number | null; p25GapDays: number | null; p75GapDays: number | null; coverageThrough: string | null;
  productIdentityState: "STABLE" | "MIXED" | "UNKNOWN"; modelVersion: string;
  needKey: string; personId: string | null; eligibility: "AUTO_ELIGIBLE" | "EXPLICIT_ONLY";
  authority: "USER_VALIDATED" | "OBSERVED"; referenceUnitAmount: string | null;
  referencePriceBasis: "INDICATIVE_PRICE_NOT_PAYMENT" | "OBSERVED_PRODUCT_REFERENCE_PRICE";
  coverageDurationDays: number; coveredIntervalCount: number; dispersionRatio: number | null;
  comparableMonths: readonly string[];
  evidenceRefs: readonly string[]; limitations: readonly string[] }>;
export type NeedOccurrence = Readonly<{ needOccurrenceId: string; needId: string; sourceAcquisitionEpisodeId: string | null;
  dueWindow: Readonly<{ earliest: string | null; central: string | null; latest: string | null }>;
  dueState: "EARLY" | "POSSIBLE" | "PROBABLE" | "LATE" | "UNKNOWN";
  targetMonthRelation: "OUTSIDE" | "CONDITIONAL" | "CENTRAL"; knowledge: PlannerKnowledge;
  needKey: string; personId: string | null; autoEligible: boolean; evidenceRefs: readonly string[] }>;

export type RenewalSlotAuthority = Readonly<{ needId: string; needOccurrenceId: string;
  autoEligible: boolean; conditional: boolean; referenceKeys: readonly string[];
  priceBasis: ReplenishmentProfile["referencePriceBasis"] }>;
export type RenewalReadModel = Readonly<{ modelVersion: string; acquisitionEpisodes: readonly AcquisitionEpisode[];
  replenishmentProfiles: readonly ReplenishmentProfile[]; needOccurrences: readonly NeedOccurrence[];
  diagnostics: readonly PlannerDiagnostic[] }>;
