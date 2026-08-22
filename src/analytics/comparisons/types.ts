import type { MetricId } from "../../core/identity";
import type {
  DecimalString,
  MetricUnit,
  MonetaryMetricUnit,
  Money,
} from "../../core/money";
import type {
  Availability,
  MetricEnvelope,
  Provenance,
  Support,
} from "../../core/metrics";
import type { ScopeHash } from "../../core/scope";
import type { MethodVersion } from "../../core/versions";
import type { MonthReferenceWindow } from "../references";
import type { CompositeProvenanceRule } from "../provenance";
import type { ExactRatio } from "./exact-ratio";

export type ComparisonRelation =
  | "above"
  | "equal"
  | "below"
  | "not_comparable";

export type ComparisonReason =
  | "target_unavailable"
  | "reference_unavailable"
  | "unit_mismatch"
  | "scope_mismatch"
  | "incompatible_reference"
  | "relative_denominator_zero"
  | "relative_not_supported"
  | "method_blocked";

export type ComparisonSemantic =
  | "actual"
  | "typical_month"
  | "minimal"
  | "adjusted_minimal"
  | "context"
  | "context_reference"
  | "activity_frequency"
  | "habitual_activity_frequency"
  | "ticket"
  | "habitual_ticket";

export type ComparisonCapabilityId =
  | "same_metric"
  | "actual_vs_typical_month"
  | "typical_vs_minimal"
  | "actual_vs_adjusted_minimal"
  | "context_vs_context_reference"
  | "activity_frequency_vs_habitual"
  | "ticket_vs_habitual";

export type ComparisonReferenceKind =
  | "same_period"
  | "rolling_comparison";

export type ComparisonReferenceAuthorization =
  | { readonly kind: "same_period" }
  | {
      readonly kind: "rolling_comparison";
      readonly window: MonthReferenceWindow;
    };

export type CoverageCompatibility =
  | "not_required"
  | "same_perimeter"
  | "method_guaranteed";

export type ComparisonQualification =
  | "statistically_qualified"
  | "descriptive_only"
  | "not_assessed";

export type ComparisonCapability = {
  readonly id: ComparisonCapabilityId;
  readonly targetSemantic?: ComparisonSemantic;
  readonly referenceSemantic?: ComparisonSemantic;
  readonly allowedReferenceKinds: readonly ComparisonReferenceKind[];
  readonly relativeAllowed: boolean;
  readonly allowedProvenancePairs: readonly (readonly [
    Provenance,
    Provenance,
  ])[];
};

export type ComparableMetric<T, U extends MetricUnit> = {
  readonly metricId: MetricId;
  readonly semantic: ComparisonSemantic;
  readonly scopeHash: ScopeHash;
  readonly envelope: MetricEnvelope<T, U>;
};

export type ComparisonDelta<T, U extends MetricUnit> =
  | ({ readonly publishable: true } & MetricEnvelope<T, U>)
  | {
      readonly publishable: false;
      readonly availability: Exclude<Availability, "known">;
      readonly value: null;
      readonly unit: U;
      readonly reason: ComparisonReason;
    };

export type ComparisonResult<
  Value,
  Unit extends MetricUnit,
  AbsoluteValue,
> = {
  readonly target: ComparableMetric<Value, Unit>;
  readonly reference: ComparableMetric<Value, Unit>;
  readonly relation: ComparisonRelation;
  readonly absoluteDelta: ComparisonDelta<AbsoluteValue, Unit>;
  readonly relativeDelta: ComparisonDelta<ExactRatio, "ratio">;
  readonly reason?: ComparisonReason;
  readonly methodVersion: MethodVersion;
  readonly compositeMethodVersion?: MethodVersion;
  readonly comparisonSupport?: Support;
  readonly qualification: ComparisonQualification;
};

export type ComparisonRequest<Value, Unit extends MetricUnit> = {
  readonly capabilityId: ComparisonCapabilityId;
  readonly target: ComparableMetric<Value, Unit>;
  readonly reference: ComparableMetric<Value, Unit>;
  readonly referenceAuthorization: ComparisonReferenceAuthorization;
  readonly coverageCompatibility?: CoverageCompatibility;
  readonly compositeProvenanceRule?: CompositeProvenanceRule;
};

export type MoneyComparisonRequest = ComparisonRequest<
  Money,
  MonetaryMetricUnit
>;
export type MoneyComparisonResult = ComparisonResult<
  Money,
  MonetaryMetricUnit,
  Money
>;
export type RatioComparisonRequest = ComparisonRequest<DecimalString, "ratio">;
export type RatioComparisonResult = ComparisonResult<
  DecimalString,
  "ratio",
  DecimalString
>;
