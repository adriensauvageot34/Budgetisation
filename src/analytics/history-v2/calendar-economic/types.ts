import type { EconomicComponentFact } from "../../facts";
import type { CalendarSemanticItem } from "../calendar";
import type { ArtifactInputHash } from "../facts-hash";
import type { CollectionValue, MetricValue } from "../../../core/history-v2";
import type { HouseholdId } from "../../../core/identity";
import type { Money } from "../../../core/money";
import type { LocalDate, YearMonth } from "../../../core/time";
import type { DailyEconomicLedgerMonthArtifact } from "../daily-finance";

export type CalendarEconomicMarkerKind =
  | "GROCERY"
  | "BAKERY_MEAL"
  | "DINING"
  | "HEALTH"
  | "TRANSPORT_SPEND"
  | "SUBSCRIPTION"
  | "FIXED_CHARGE";

export type CalendarEconomicBehavior = "FIXED" | "NON_FIXED" | "UNKNOWN" | "CONFLICT";
export type RecurrenceQualification = "CONFIRMED" | "NONE" | "UNKNOWN" | "CONFLICT";

export type CalendarEconomicComponentQualification = {
  readonly componentKey: string;
  readonly categoryKey?: string;
  readonly subcategoryKey?: string;
  readonly subcategoryLabel?: string;
  readonly behavior: CalendarEconomicBehavior;
  readonly recurrence: RecurrenceQualification;
  readonly sourceRefs: readonly string[];
};

export type CalendarEconomicDayProjection = {
  readonly date: LocalDate;
  readonly economicAmountExcludingFixed: MetricValue<Money>;
};

export type CalendarEconomicProjection = {
  readonly householdId: HouseholdId;
  readonly month: YearMonth;
  readonly markers: CollectionValue<CalendarSemanticItem>;
  readonly days: readonly CalendarEconomicDayProjection[];
  readonly unassignedComponentKeys: readonly string[];
  readonly issues: readonly string[];
  readonly dependencyPolicies: {
    readonly calendar_amount_views: "v1";
    readonly canonical_component_classification: "v1";
    readonly daily_economic_allocation: "v1";
    readonly quality_visibility: "v1";
    readonly facts_hash: "v1";
  };
  readonly projectionInputHash: ArtifactInputHash;
};

export type CalendarEconomicProjectionInput = {
  readonly householdId: HouseholdId;
  readonly month: YearMonth;
  readonly facts: readonly EconomicComponentFact[];
  readonly ledger: DailyEconomicLedgerMonthArtifact;
  readonly qualifications: readonly CalendarEconomicComponentQualification[];
};
