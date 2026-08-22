import type { MonetaryMetricUnit, Money } from "../../core/money";
import {
  compareMoneyMetrics,
  type ComparisonCapabilityId,
  type ComparisonReferenceAuthorization,
  type ComparisonSemantic,
  type CoverageCompatibility,
  type MoneyComparisonResult,
} from "../comparisons";
import type { CompositeProvenanceRule } from "../provenance";
import type { ProducedMoneyMetric } from "./types";
import { validateProducedMetric } from "./validation";

type PublishedComparisonRequest = {
  readonly capabilityId: ComparisonCapabilityId;
  readonly targetSemantic: ComparisonSemantic;
  readonly referenceSemantic: ComparisonSemantic;
  readonly referenceAuthorization: ComparisonReferenceAuthorization;
  readonly coverageCompatibility?: CoverageCompatibility;
  readonly compositeProvenanceRule?: CompositeProvenanceRule;
};

export function produceMoneyComparison(
  input: PublishedComparisonRequest & {
    readonly target: ProducedMoneyMetric;
    readonly reference: ProducedMoneyMetric;
  },
): MoneyComparisonResult {
  const target = validateProducedMetric(input.target) as ProducedMoneyMetric;
  const reference = validateProducedMetric(
    input.reference,
  ) as ProducedMoneyMetric;
  return compareMoneyMetrics({
    capabilityId: input.capabilityId,
    target: {
      metricId: target.metricId,
      semantic: input.targetSemantic,
      scopeHash: target.scopeHash,
      envelope: target as import("../../core/metrics").MetricEnvelope<
        Money,
        MonetaryMetricUnit
      >,
    },
    reference: {
      metricId: reference.metricId,
      semantic: input.referenceSemantic,
      scopeHash: reference.scopeHash,
      envelope: reference as import("../../core/metrics").MetricEnvelope<
        Money,
        MonetaryMetricUnit
      >,
    },
    referenceAuthorization: input.referenceAuthorization,
    ...(input.coverageCompatibility === undefined
      ? {}
      : { coverageCompatibility: input.coverageCompatibility }),
    ...(input.compositeProvenanceRule === undefined
      ? {}
      : { compositeProvenanceRule: input.compositeProvenanceRule }),
  });
}
