import type {
  ActivityId,
  Brand,
  CategoryId,
  HouseholdId,
  LifeEventId,
  MerchantId,
  MomentId,
  OperationId,
  PersonId,
  PlaceId,
  SubcategoryId,
} from "../../core/identity";
import type { Money } from "../../core/money";
import type {
  HouseholdTimeZone,
  Instant,
  LocalDate,
  YearMonth,
} from "../../core/time";

export type CanonicalComponentKey = Brand<
  string,
  "CanonicalComponentKey"
>;
export type EconomicTimingSegmentKey = Brand<
  string,
  "EconomicTimingSegmentKey"
>;
export type PurchaseEventId = Brand<string, "PurchaseEventId">;
export type PurchaseEventKey = PurchaseEventId;
export type CashUseId = Brand<string, "CashUseId">;
export type PlaceVisitKey = Brand<string, "PlaceVisitKey">;
export type PersonDayId = Brand<string, "PersonDayId">;
export type LifeEventSeriesId = Brand<string, "LifeEventSeriesId">;

export type ActivityOccurrenceValidationStatus = "Confirmé" | "Déduit";

export type AnalyticDimensionValue<Id extends string> =
  | { readonly kind: "resolved"; readonly id: Id }
  | { readonly kind: "unknown" }
  | { readonly kind: "not_applicable" }
  | { readonly kind: "conflict" };

export type AnalyticCategoryValue =
  | AnalyticDimensionValue<CategoryId>
  | { readonly kind: "undetermined" };

export type AnalyticTextDimensionValue =
  | { readonly kind: "resolved"; readonly value: string }
  | { readonly kind: "unknown" }
  | { readonly kind: "not_applicable" }
  | { readonly kind: "conflict" };

export type AnalyticDateValue =
  | { readonly kind: "known"; readonly date: LocalDate }
  | { readonly kind: "unknown" }
  | { readonly kind: "conflict" };

export type EconomicTimingSegment = {
  readonly segmentKey: EconomicTimingSegmentKey;
  readonly timingState: "known" | "partial" | "unknown";
  readonly periodStart: LocalDate | null;
  readonly periodEnd: LocalDate | null;
  readonly economicMonth: YearMonth | null;
  readonly amount: Money;
};

export type EconomicTiming =
  | {
      readonly kind: "known";
      readonly segments: readonly EconomicTimingSegment[];
    }
  | {
      readonly kind: "partial";
      readonly segments: readonly EconomicTimingSegment[];
    }
  | { readonly kind: "unknown" }
  | { readonly kind: "conflict" };

export type CanonicalPlaceValue =
  | {
      readonly kind: "resolved";
      readonly placeId: PlaceId;
      readonly resolution: "operation_place_canonical";
    }
  | { readonly kind: "unknown" }
  | { readonly kind: "not_applicable" }
  | { readonly kind: "conflict" };

export type EconomicComponentFact = {
  readonly fact: "fct_economic_component";
  readonly householdId: HouseholdId;
  readonly householdTimeZone: HouseholdTimeZone;
  readonly canonicalComponentKey: CanonicalComponentKey;
  readonly sourceOperation: AnalyticDimensionValue<OperationId>;
  readonly gross: Money;
  readonly refundApplied: Money;
  readonly net: Money;
  readonly bankDate: AnalyticDateValue;
  readonly economicTiming: EconomicTiming;
  readonly person: AnalyticDimensionValue<PersonId>;
  readonly category: AnalyticCategoryValue;
  readonly subcategory: AnalyticDimensionValue<SubcategoryId>;
  readonly activity: AnalyticDimensionValue<ActivityId>;
  readonly merchant: AnalyticDimensionValue<MerchantId>;
  readonly moment: AnalyticDimensionValue<MomentId>;
  readonly canonicalPlace: CanonicalPlaceValue;
  readonly necessity: AnalyticTextDimensionValue;
  readonly behavior: AnalyticTextDimensionValue;
  readonly lifeScope: AnalyticTextDimensionValue;
};

export type ActivityOccurrenceFact = {
  readonly fact: "fct_activity_occurrence";
  readonly householdId: HouseholdId;
  readonly householdTimeZone: HouseholdTimeZone;
  readonly lifeEventId: LifeEventId;
  readonly activityId: ActivityId;
  readonly lifeEventSeriesId: LifeEventSeriesId | null;
  readonly parentLifeEventId: LifeEventId | null;
  readonly startDate: LocalDate;
  readonly endDate: LocalDate;
  readonly validationStatus: ActivityOccurrenceValidationStatus;
  readonly participantIds: readonly PersonId[];
};

export type ActivityCausalRelationType =
  | "Paiement_activite"
  | "Cause_par_evenement"
  | "Preparation";

export type ActivityCausalFinancialLink = {
  readonly financialLinkId: string;
  readonly lifeEventId: LifeEventId;
  readonly canonicalComponentKey: CanonicalComponentKey;
  readonly relationType: ActivityCausalRelationType;
  readonly economicAmountLinked: Money | null;
};

export type ActivityOccurrenceCostFact = {
  readonly fact: "fct_activity_occurrence_cost";
  readonly householdId: HouseholdId;
  readonly householdTimeZone: HouseholdTimeZone;
  readonly occurrenceId: LifeEventId;
  readonly activityId: ActivityId;
  readonly causalCost:
    | { readonly availability: "known"; readonly value: Money }
    | { readonly availability: "unknown"; readonly value: null };
  readonly coverage: import("../../core/metrics").Coverage;
  readonly support: import("../../core/metrics").Support;
  readonly evidence: readonly {
    readonly financialLinkId: string;
    readonly canonicalComponentKey: CanonicalComponentKey;
    readonly relationType: ActivityCausalRelationType;
  }[];
  readonly provenance: "derived";
};

export type PersonDayObservability =
  | "observable"
  | "partial"
  | "unknown"
  | "conflict";

export type PersonDayFact = {
  readonly fact: "fct_person_day";
  readonly householdId: HouseholdId;
  readonly householdTimeZone: HouseholdTimeZone;
  readonly personDayId: PersonDayId;
  readonly personId: PersonId;
  readonly localDate: LocalDate;
  readonly locationObservability: PersonDayObservability;
};

export type PlaceVisitInterval =
  | {
      readonly kind: "known";
      readonly startedAt: Instant;
      readonly endedAt: Instant;
    }
  | {
      readonly kind: "partial";
      readonly startedAt: Instant | null;
      readonly endedAt: Instant | null;
    }
  | { readonly kind: "unknown" };

export type PlaceVisitTimePrecision =
  | "exact"
  | "approximate"
  | "time_range"
  | "unknown";

export type PurchaseEventSource =
  | {
      readonly kind: "operation";
      readonly operationId: OperationId;
    }
  | {
      readonly kind: "cash_use";
      readonly cashUseId: CashUseId;
    };

export type PurchaseEventFact = {
  readonly fact: "fct_purchase_event";
  readonly householdId: HouseholdId;
  readonly householdTimeZone: HouseholdTimeZone;
  readonly purchaseEventId: PurchaseEventId;
  readonly sources: readonly PurchaseEventSource[];
};

export type PlaceVisitFact = {
  readonly fact: "fct_place_visit";
  readonly householdId: HouseholdId;
  readonly householdTimeZone: HouseholdTimeZone;
  readonly visitKey: PlaceVisitKey;
  readonly personDayId: PersonDayId;
  readonly personId: PersonId;
  readonly placeId: PlaceId;
  readonly localDate: LocalDate;
  readonly interval: PlaceVisitInterval;
  readonly timePrecision: PlaceVisitTimePrecision;
  readonly sequenceIndex: number;
};

export type AnalyticFact =
  | EconomicComponentFact
  | ActivityOccurrenceFact
  | ActivityOccurrenceCostFact
  | PersonDayFact
  | PurchaseEventFact
  | PlaceVisitFact;

export type AnalyticFactSource = AnalyticFact["fact"];

export type AnalyticGrain =
  | "canonical_economic_component"
  | "activity_occurrence"
  | "activity_occurrence_cost"
  | "person_local_date"
  | "purchase_event"
  | "person_place_visit_interval";
