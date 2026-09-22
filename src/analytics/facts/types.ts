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
import type { DecimalString, Money } from "../../core/money";
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

export type MobilityLegEndpoint = {
  readonly placeId: PlaceId | null;
  readonly sourceLabel: string | null;
  readonly resolutionState: "EXPLICIT_MAPPING" | "UNRESOLVED";
};

export type MobilityLegFuelAuthority = {
  readonly fuelType: "SP95";
  readonly pricePerLiter: DecimalString;
  readonly pricePeriod: YearMonth;
  readonly geoScope: "LOCAL_DEPARTMENT" | "NATIONAL";
  readonly source: string;
  readonly quality: "P3_LOCAL_DEPARTMENT" | "P4_NATIONAL_FALLBACK";
  readonly observationId: string | null;
};

export type MobilityLegTime = {
  readonly observedTime: string | null;
  readonly authority: "OBSERVED" | "PROXY" | "UNKNOWN";
  readonly type: "DEPARTURE" | "ARRIVAL" | "UNTYPED" | "UNKNOWN";
  readonly routeTimeBasis: string | null;
  readonly routeProxyTimes: readonly string[];
};

export type MobilityLegSource = {
  readonly datasetId: string;
  readonly sourceLegId: string;
  readonly group: "NAV" | "JOUR" | "AUT";
  readonly sheet: string;
  readonly reconstruction: string;
  readonly quality: string;
  readonly status: "CERTIFIED_SOURCE" | "SOURCE_PARTIAL";
  readonly confidence: "HIGH" | "MEDIUM" | "LOW" | "UNKNOWN";
  readonly sourceRowHash: string;
};

export type MobilityLegFact = {
  readonly fact: "fct_mobility_leg";
  readonly legId: string;
  readonly householdId: HouseholdId;
  readonly vehicleId: string;
  readonly date: LocalDate;
  readonly origin: MobilityLegEndpoint;
  readonly destination: MobilityLegEndpoint;
  readonly distanceKm: DecimalString;
  readonly durationSeconds: DecimalString | null;
  readonly durationNoTrafficSeconds: DecimalString | null;
  readonly estimatedFuelLiters: DecimalString;
  readonly estimatedFuelCost: Money;
  readonly fuel: MobilityLegFuelAuthority;
  readonly time: MobilityLegTime;
  readonly consumptionModelRef: string;
  readonly routeMethodRef: string;
  readonly source: MobilityLegSource;
  readonly methodVersion: import("../../core/versions").MethodVersion;
  readonly evidenceRefs: readonly string[];
  readonly provenance: "estimated";
};

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

export type EconomicPersonAttributionReason =
  | "NO_EXPLICIT_BENEFICIARY"
  | "UNSUPPORTED_SOURCE_KIND"
  | "MULTIPLE_UNALLOCATED_BENEFICIARIES"
  | "MIXED_BENEFICIARY_RELATIONS"
  | "OUT_OF_HOUSEHOLD_PERSON"
  | "INVALID_SHARE_TOTAL";

export type EconomicPersonShare = {
  readonly personId: PersonId;
  readonly share: DecimalString;
  readonly evidenceRefs: readonly string[];
};

export type EconomicPersonAttribution =
  | {
      readonly kind: "resolved";
      readonly id: PersonId;
      readonly attribution?: "explicit_beneficiary";
      readonly evidenceRefs?: readonly string[];
      readonly payerEvidenceRefs?: readonly string[];
    }
  | {
      readonly kind: "shared";
      readonly shares: readonly EconomicPersonShare[];
      readonly evidenceRefs: readonly string[];
      readonly payerEvidenceRefs: readonly string[];
    }
  | {
      readonly kind: "partial";
      readonly shares: readonly EconomicPersonShare[];
      readonly unattributedShare: DecimalString;
      readonly evidenceRefs: readonly string[];
      readonly payerEvidenceRefs: readonly string[];
    }
  | {
      readonly kind: "unknown";
      readonly reasonCode?: Extract<
        EconomicPersonAttributionReason,
        "NO_EXPLICIT_BENEFICIARY" | "UNSUPPORTED_SOURCE_KIND"
      >;
      readonly evidenceRefs?: readonly string[];
      readonly payerEvidenceRefs?: readonly string[];
    }
  | { readonly kind: "not_applicable" }
  | {
      readonly kind: "conflict";
      readonly reasonCode?: Exclude<
        EconomicPersonAttributionReason,
        "NO_EXPLICIT_BENEFICIARY" | "UNSUPPORTED_SOURCE_KIND"
      >;
      readonly evidenceRefs?: readonly string[];
      readonly payerEvidenceRefs?: readonly string[];
    };

export type FinancialSourcePersonLink = {
  readonly sourceKind: "Operation" | "Allocation" | "Item" | "Cash_use";
  readonly sourceId: string;
  readonly personId: PersonId;
  readonly relationType: "payer" | "beneficiary" | "beneficiary_share";
  readonly share: DecimalString | null;
  readonly evidenceRef: string;
};

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

export type EconomicComponentSourceKind =
  | "Operation_parent"
  | "Operation_residual"
  | "Allocation"
  | "Item"
  | "Payment_component"
  | "Cash_economic_use";

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
  /** Optional only so facts serialized before this transport field existed remain parsable. */
  readonly sourceKind?: EconomicComponentSourceKind;
  readonly sourceOperation: AnalyticDimensionValue<OperationId>;
  readonly gross: Money;
  readonly refundApplied: Money;
  readonly net: Money;
  readonly bankDate: AnalyticDateValue;
  readonly economicTiming: EconomicTiming;
  readonly person: EconomicPersonAttribution;
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

export type PurchaseEventSourceKind =
  | "operation"
  | "allocation"
  | "item"
  | "payment_component"
  | "cash_use";

export type PurchaseEventSource = {
  readonly membershipKind: "CONSUMPTION_COMPONENT" | "EVIDENCE_SOURCE";
  readonly kind: PurchaseEventSourceKind;
  readonly sourceId: string;
  readonly canonicalComponentKey: CanonicalComponentKey;
  readonly evidenceRefs: readonly string[];
  readonly provenance:
    | "EXPLICIT_USER_ASSERTION"
    | "STRUCTURED_CANONICAL_SOURCE"
    | "CONTROLLED_BACKFILL";
};

export type PurchaseEventTiming = {
  readonly status: "KNOWN" | "PARTIAL" | "UNKNOWN" | "CONFLICT";
  readonly precision: "DAY" | "MONTH" | "NONE";
  readonly economicDate: LocalDate | null;
  readonly economicMonth: YearMonth | null;
  readonly authority:
    | "EXPLICIT_EVENT"
    | "EXPLICIT_CONSUMPTION_SOURCE"
    | "TRUSTED_PURCHASE_SOURCE"
    | "ECONOMIC_MONTH"
    | null;
  readonly evidenceRefs: readonly string[];
};

export type PurchaseEventFact = {
  readonly fact: "fct_purchase_event";
  readonly householdId: HouseholdId;
  readonly householdTimeZone: HouseholdTimeZone;
  readonly purchaseEventId: PurchaseEventId;
  readonly sources: readonly PurchaseEventSource[];
  readonly economicAmount: Money;
  readonly timing: PurchaseEventTiming;
  readonly provenance:
    | "EXPLICIT_USER_ASSERTION"
    | "STRUCTURED_CANONICAL_SOURCE"
    | "CONTROLLED_BACKFILL";
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
  | PlaceVisitFact
  | MobilityLegFact;

export type AnalyticFactSource = AnalyticFact["fact"];

export type AnalyticGrain =
  | "canonical_economic_component"
  | "activity_occurrence"
  | "activity_occurrence_cost"
  | "person_local_date"
  | "purchase_event"
  | "person_place_visit_interval"
  | "mobility_leg";
