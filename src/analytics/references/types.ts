import type { HouseholdId } from "../../core/identity";
import type { ReferenceFamily } from "../../core/metrics";
import type {
  HouseholdTimeZone,
  LocalDate,
  YearMonth,
} from "../../core/time";

export type ReferenceExclusionReason =
  | "target"
  | "future"
  | "incomplete"
  | "not_comparable"
  | "method_exclusion";

export type AnalysisPeriodFinanceStatus =
  | "complete"
  | "partial"
  | "unknown"
  | "not_applicable";

export type FinancialAnalysisPeriodProjection = {
  readonly householdId: HouseholdId;
  readonly month: LocalDate;
  readonly financeStatus: AnalysisPeriodFinanceStatus;
  readonly isClosed: boolean;
};

export type ReferencePeriodCandidate = {
  readonly householdId: HouseholdId;
  readonly period: YearMonth;
  readonly isComplete: boolean;
  readonly isComparable: boolean;
  readonly isMethodExcluded: boolean;
};

export type ExcludedReferencePeriod = {
  readonly period: YearMonth;
  readonly reason: ReferenceExclusionReason;
};

export type MonthReferenceWindow = {
  readonly family: ReferenceFamily;
  readonly householdId: HouseholdId;
  readonly householdTimeZone: HouseholdTimeZone;
  readonly asOf: YearMonth;
  readonly targetPeriod?: YearMonth;
  readonly requestedPeriodCount?: number;
  readonly includedPeriods: readonly YearMonth[];
  readonly excludedPeriods: readonly ExcludedReferencePeriod[];
  readonly effectivePeriodCount: number;
  readonly firstIncluded?: YearMonth;
  readonly lastIncluded?: YearMonth;
};

export type ReferenceWindowRequest = {
  readonly householdId: HouseholdId;
  readonly householdTimeZone: HouseholdTimeZone;
  readonly candidates: readonly ReferencePeriodCandidate[];
  readonly requestedPeriodCount?: number;
};
