import type { MetricUnit, Money } from "../../core/money";
import type {
  Availability,
  Coverage,
  MetricEnvelope,
  Provenance,
  ReferenceMeta,
  Support,
} from "../../core/metrics";

export type MetricDisplayValue = Money | number;

export type MetricDisplayVariant =
  | "hero"
  | "reference"
  | "standard"
  | "compact";

export type MetricDisplayQualifier =
  | "partial"
  | "limited_support"
  | "insufficient_support"
  | "derived"
  | "estimated";

export type MetricQualifierMode = "essential" | "full";

export type MetricPrecisionPolicy =
  | { readonly kind: "exact" }
  | { readonly kind: "fixed"; readonly fractionDigits: number }
  | {
      readonly kind: "human";
      readonly maximumFractionDigits?: number;
    };

export type UnknownMetricPresentation = "unavailable" | "not_estimated";

export type ResolvedMetricDisplayState =
  | "value"
  | "unknown"
  | "not_applicable"
  | "conflict";

export type ResolveMetricDisplayOptions = {
  readonly variant?: MetricDisplayVariant;
  readonly precision?: MetricPrecisionPolicy;
  readonly qualifierMode?: MetricQualifierMode;
  readonly unknownPresentation?: UnknownMetricPresentation;
  readonly signed?: boolean;
};

export type ResolvedMetricDisplay<U extends MetricUnit = MetricUnit> = {
  readonly state: ResolvedMetricDisplayState;
  readonly variant: MetricDisplayVariant;
  readonly primaryText: string | null;
  readonly unitText: string;
  readonly qualifiers: readonly MetricDisplayQualifier[];
  readonly coverageDetailText: string | null;
  readonly accessibleText: string | null;
  readonly availability: Availability;
  readonly unit: U;
  readonly coverage?: Coverage;
  readonly support?: Support;
  readonly provenance: Provenance;
  readonly reference?: ReferenceMeta;
};

export type DisplayableMetricEnvelope<
  T extends MetricDisplayValue = MetricDisplayValue,
  U extends MetricUnit = MetricUnit,
> = MetricEnvelope<T, U>;
