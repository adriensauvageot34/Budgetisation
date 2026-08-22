import Big from "big.js";
import {
  compareMoney,
  parseDecimalString,
  subtractMoney,
  type DecimalString,
  type MetricUnit,
  type Money,
} from "../../core/money";
import type { Availability, Provenance } from "../../core/metrics";
import { parseMethodVersion, type MethodVersion } from "../../core/versions";
import { resolveCompositeProvenance } from "../provenance";
import { assertMonthReferenceWindow } from "../references";
import { getComparisonCapability } from "./capabilities";
import { exactRatioFromDivision } from "./exact-ratio";
import type {
  ComparableMetric,
  ComparisonCapability,
  ComparisonDelta,
  ComparisonQualification,
  ComparisonReason,
  ComparisonRequest,
  ComparisonResult,
  MoneyComparisonRequest,
  MoneyComparisonResult,
  RatioComparisonRequest,
  RatioComparisonResult,
} from "./types";

export const COMPARISON_METHOD_VERSION: MethodVersion = parseMethodVersion(
  "metric_comparison@v1",
);

type ExactOperations<Value, AbsoluteValue> = {
  readonly subtract: (target: Value, reference: Value) => AbsoluteValue;
  readonly compare: (target: Value, reference: Value) => -1 | 0 | 1;
  readonly relativeNumerator: (value: AbsoluteValue) => DecimalString;
  readonly relativeDenominator: (value: Value) => DecimalString;
};

function nonComputable<Value, Unit extends MetricUnit>(
  unit: Unit,
  availability: Exclude<Availability, "known">,
  reason: ComparisonReason,
): ComparisonDelta<Value, Unit> {
  return { publishable: false, availability, value: null, unit, reason };
}

function qualificationFromReference(
  reference: ComparableMetric<unknown, MetricUnit>,
): ComparisonQualification {
  const level = reference.envelope.support?.level;
  if (level === undefined) return "not_assessed";
  return level === "sufficient"
    ? "statistically_qualified"
    : "descriptive_only";
}

function capabilityMatches(
  capability: ComparisonCapability,
  target: ComparableMetric<unknown, MetricUnit>,
  reference: ComparableMetric<unknown, MetricUnit>,
): boolean {
  if (capability.id === "same_metric") {
    return target.metricId === reference.metricId;
  }
  return (
    target.semantic === capability.targetSemantic &&
    reference.semantic === capability.referenceSemantic
  );
}

function authorizationMatches(
  capability: ComparisonCapability,
  request: ComparisonRequest<unknown, MetricUnit>,
): boolean {
  const authorization = request.referenceAuthorization;
  if (!capability.allowedReferenceKinds.includes(authorization.kind)) {
    return false;
  }
  if (authorization.kind === "rolling_comparison") {
    assertMonthReferenceWindow(authorization.window);
    return authorization.window.family === "comparison";
  }
  return true;
}

function hasIncompatiblePartialCoverage(
  request: ComparisonRequest<unknown, MetricUnit>,
): boolean {
  const hasPartial =
    request.target.envelope.coverage?.level === "partial" ||
    request.reference.envelope.coverage?.level === "partial";
  return (
    hasPartial &&
    request.coverageCompatibility !== "same_perimeter" &&
    request.coverageCompatibility !== "method_guaranteed"
  );
}

function unavailableOperand<Value, Unit extends MetricUnit>(
  request: ComparisonRequest<Value, Unit>,
): {
  readonly availability: Exclude<Availability, "known">;
  readonly reason: ComparisonReason;
} | null {
  if (request.target.envelope.availability !== "known") {
    return {
      availability: request.target.envelope.availability,
      reason: "target_unavailable",
    };
  }
  if (request.reference.envelope.availability !== "known") {
    return {
      availability: request.reference.envelope.availability,
      reason: "reference_unavailable",
    };
  }
  return null;
}

function deltaProvenance(
  capability: ComparisonCapability,
  request: ComparisonRequest<unknown, MetricUnit>,
): { readonly provenance: Provenance; readonly methodVersion?: MethodVersion } | null {
  const target = request.target.envelope.provenance;
  const reference = request.reference.envelope.provenance;
  const explicitlyAllowed = capability.allowedProvenancePairs.some(
    ([allowedTarget, allowedReference]) =>
      allowedTarget === target && allowedReference === reference,
  );
  if (explicitlyAllowed) return { provenance: "derived" };
  if (request.compositeProvenanceRule === undefined) return null;
  const resolution = resolveCompositeProvenance(
    [target, reference],
    request.compositeProvenanceRule,
  );
  if (!resolution.publishable || resolution.provenance === "observed") {
    return null;
  }
  return {
    provenance: resolution.provenance,
    ...(resolution.methodVersion === undefined
      ? {}
      : { methodVersion: resolution.methodVersion }),
  };
}

function blockedResult<Value, Unit extends MetricUnit, AbsoluteValue>(input: {
  readonly request: ComparisonRequest<Value, Unit>;
  readonly reason: ComparisonReason;
  readonly availability?: Exclude<Availability, "known">;
}): ComparisonResult<Value, Unit, AbsoluteValue> {
  const availability = input.availability ?? "not_applicable";
  return {
    target: input.request.target,
    reference: input.request.reference,
    relation: "not_comparable",
    absoluteDelta: nonComputable(
      input.request.target.envelope.unit,
      availability,
      input.reason,
    ),
    relativeDelta: nonComputable("ratio", availability, input.reason),
    reason: input.reason,
    methodVersion: COMPARISON_METHOD_VERSION,
    ...(input.request.reference.envelope.support === undefined
      ? {}
      : { comparisonSupport: input.request.reference.envelope.support }),
    qualification: qualificationFromReference(input.request.reference),
  };
}

function compareExact<Value, Unit extends MetricUnit, AbsoluteValue>(
  request: ComparisonRequest<Value, Unit>,
  operations: ExactOperations<Value, AbsoluteValue>,
): ComparisonResult<Value, Unit, AbsoluteValue> {
  const capability = getComparisonCapability(request.capabilityId);
  if (!capabilityMatches(capability, request.target, request.reference)) {
    return blockedResult({ request, reason: "method_blocked" });
  }
  if (request.target.envelope.unit !== request.reference.envelope.unit) {
    return blockedResult({ request, reason: "unit_mismatch" });
  }
  if (request.target.scopeHash !== request.reference.scopeHash) {
    return blockedResult({ request, reason: "scope_mismatch" });
  }
  if (!authorizationMatches(capability, request)) {
    return blockedResult({ request, reason: "incompatible_reference" });
  }
  if (hasIncompatiblePartialCoverage(request)) {
    return blockedResult({ request, reason: "method_blocked" });
  }
  const unavailable = unavailableOperand(request);
  if (unavailable !== null) {
    return blockedResult({ request, ...unavailable });
  }

  const targetValue = request.target.envelope.value as Value;
  const referenceValue = request.reference.envelope.value as Value;
  const provenance = deltaProvenance(capability, request);
  if (provenance === null) {
    return blockedResult({ request, reason: "method_blocked" });
  }
  const absoluteValue = operations.subtract(targetValue, referenceValue);
  const comparison = operations.compare(targetValue, referenceValue);
  const relation = comparison > 0 ? "above" : comparison < 0 ? "below" : "equal";
  const metricMethodVersion =
    provenance.methodVersion ?? COMPARISON_METHOD_VERSION;
  const envelopeMetadata = {
    provenance: provenance.provenance,
    methodVersion: metricMethodVersion,
    ...(request.reference.envelope.support === undefined
      ? {}
      : { support: request.reference.envelope.support }),
    ...(request.reference.envelope.reference === undefined
      ? {}
      : { reference: request.reference.envelope.reference }),
  };
  const absoluteDelta: ComparisonDelta<AbsoluteValue, Unit> = {
    publishable: true,
    availability: "known",
    value: absoluteValue,
    unit: request.target.envelope.unit,
    ...envelopeMetadata,
  };

  const referenceDecimal = operations.relativeDenominator(referenceValue);
  let relativeDelta: ComparisonDelta<import("./exact-ratio").ExactRatio, "ratio">;
  if (!capability.relativeAllowed) {
    relativeDelta = nonComputable(
      "ratio",
      "not_applicable",
      "relative_not_supported",
    );
  } else {
    const denominatorComparison = new Big(referenceDecimal).cmp(0);
    if (denominatorComparison === 0) {
      relativeDelta = nonComputable(
        "ratio",
        "not_applicable",
        "relative_denominator_zero",
      );
    } else if (denominatorComparison < 0) {
      relativeDelta = nonComputable(
        "ratio",
        "not_applicable",
        "relative_not_supported",
      );
    } else {
      relativeDelta = {
        publishable: true,
        availability: "known",
        value: exactRatioFromDivision(
          operations.relativeNumerator(absoluteValue),
          referenceDecimal,
        ),
        unit: "ratio",
        ...envelopeMetadata,
      };
    }
  }

  return {
    target: request.target,
    reference: request.reference,
    relation,
    absoluteDelta,
    relativeDelta,
    methodVersion: COMPARISON_METHOD_VERSION,
    ...(provenance.methodVersion === undefined
      ? {}
      : { compositeMethodVersion: provenance.methodVersion }),
    ...(request.reference.envelope.support === undefined
      ? {}
      : { comparisonSupport: request.reference.envelope.support }),
    qualification: qualificationFromReference(request.reference),
  };
}

export function compareMoneyMetrics(
  request: MoneyComparisonRequest,
): MoneyComparisonResult {
  return compareExact(request, {
    subtract: subtractMoney,
    compare: compareMoney,
    relativeNumerator: (value: Money) => parseDecimalString(value),
    relativeDenominator: (value: Money) => parseDecimalString(value),
  });
}

export function compareRatioMetrics(
  request: RatioComparisonRequest,
): RatioComparisonResult {
  return compareExact(request, {
    subtract: (target, reference) =>
      parseDecimalString(new Big(target).minus(reference).toFixed()),
    compare: (target, reference) => {
      const comparison = new Big(target).cmp(reference);
      return comparison < 0 ? -1 : comparison > 0 ? 1 : 0;
    },
    relativeNumerator: parseDecimalString,
    relativeDenominator: parseDecimalString,
  });
}
