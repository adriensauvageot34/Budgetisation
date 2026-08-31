import type { HouseholdId } from "../../../core/identity";
import type { MetricValue, Provenance } from "../../../core/history-v2";
import type { Money } from "../../../core/money";
import type { LocalDate, YearMonth } from "../../../core/time";
import type { PurchaseEventFact } from "../../facts";
import type { ArtifactInputHash } from "../facts-hash";

export type EconomicTimingPrecision = "DAY" | "MONTH" | "NONE";
export type DailyTimingAuthority =
  | "PURCHASE_EVENT"
  | "EXPLICIT_CONSUMPTION_SOURCE"
  | "CASH_USE_DATE"
  | "TRUSTED_PURCHASE_SOURCE";
export type DailyTimingEvidenceKind = DailyTimingAuthority | "ECONOMIC_MONTH" | "BANK_DATE_FALLBACK";

export type DailyTimingEvidence = {
  readonly kind: DailyTimingEvidenceKind;
  readonly date?: LocalDate;
  readonly month?: YearMonth;
  readonly evidenceRef: string;
};

export type DailyEconomicComponentSource = {
  readonly canonicalComponentKey: string;
  readonly amount: Money;
  readonly economicMonth: YearMonth;
  readonly sourceRefs: readonly string[];
  readonly timingEvidence: readonly DailyTimingEvidence[];
  readonly sourceKind: "operation" | "allocation" | "item" | "payment_component" | "cash_use";
  readonly linkedRefundSourceComponentKey?: string;
  readonly isRefund?: boolean;
  readonly provenance: Provenance;
};

export type EconomicAllocationEntry = {
  readonly componentKey: string;
  readonly amount: Money;
  readonly economicMonth: YearMonth;
  readonly purchaseEventId?: string;
  readonly effectiveEconomicDate: MetricValue<LocalDate>;
  readonly timingPrecision: EconomicTimingPrecision;
  readonly timingAuthority?: DailyTimingAuthority;
  readonly sourceRefs: readonly string[];
  readonly provenance: Provenance;
};

export type DailyEconomicAmount = {
  readonly date: LocalDate;
  readonly economicAmount: MetricValue<Money>;
  readonly assignedComponentCount: number;
  readonly assignedPurchaseEventCount?: number;
  readonly timingCoverage?: {
    readonly ratio: number;
    readonly numerator: number;
    readonly denominator: number;
    readonly unit: "amount_abs";
    readonly basis: "absolute_economic_component_amount";
  };
};

export type EconomicExpenseEvent = {
  readonly expenseEventId: string;
  readonly kind: "PURCHASE_EVENT" | "CASH_USE" | "CANONICAL_CHARGE";
  readonly componentKeys: readonly string[];
  readonly economicAmount: Money;
  readonly effectiveEconomicDate: MetricValue<LocalDate>;
};

export type DailyEconomicLedgerInput = {
  readonly householdId: HouseholdId;
  readonly month: YearMonth;
  readonly currency: string;
  readonly actualMonthAmount: Money;
  readonly components: readonly DailyEconomicComponentSource[];
  readonly purchaseEvents: readonly PurchaseEventFact[];
};

export type DailyEconomicLedgerMonthArtifact = {
  readonly artifactFamily: "daily_economic_ledger_month";
  readonly householdId: HouseholdId;
  readonly month: YearMonth;
  readonly currency: string;
  readonly actualMonthAmount: Money;
  readonly days: readonly DailyEconomicAmount[];
  readonly allocationEntries: readonly EconomicAllocationEntry[];
  readonly expenseEvents: readonly EconomicExpenseEvent[];
  readonly unassignedEconomicAmount: MetricValue<Money>;
  readonly assignedEconomicAmount: Money;
  readonly reconciliationResidual: Money;
  readonly timingCoverage: {
    readonly ratio: number;
    readonly numerator: number;
    readonly denominator: number;
    readonly unit: "amount_abs";
    readonly basis: "absolute_economic_component_amount";
  } | null;
  readonly issues: readonly string[];
  readonly dependencyPolicies: {
    readonly canonical_purchase_event_timing: "v1";
    readonly daily_economic_allocation: "v1";
    readonly quality_visibility: "v1";
    readonly facts_hash: "v1";
  };
  /** Internal cache/invalidation digest; never PublicationMeta.factsHash. */
  readonly artifactInputHash: ArtifactInputHash;
};
