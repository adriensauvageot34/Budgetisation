import type { MonetaryMetricUnit, Money } from "../../core/money";
import {
  parseMoneyMetricEnvelope,
  parseProvenance,
  type Coverage,
  type MetricEnvelope,
  type Provenance,
  type Support,
} from "../../core/metrics";
import { parseMethodVersion } from "../../core/versions";
import type {
  CompositeProvenanceResolution,
  CompositeProvenanceRule,
} from "./types";

export function observedExactMoneyAggregation(input: {
  readonly value: Money;
  readonly unit: MonetaryMetricUnit;
  readonly coverage?: Coverage;
  readonly support?: Support;
}): MetricEnvelope<Money, MonetaryMetricUnit> {
  return parseMoneyMetricEnvelope({
    availability: "known",
    value: input.value,
    unit: input.unit,
    provenance: "observed",
    ...(input.coverage === undefined ? {} : { coverage: input.coverage }),
    ...(input.support === undefined ? {} : { support: input.support }),
  });
}

export function resolveCompositeProvenance(
  inputs: readonly Provenance[],
  rule?: CompositeProvenanceRule,
): CompositeProvenanceResolution {
  const provenances = inputs.map(parseProvenance);
  if (provenances.length === 0) {
    return { publishable: false, reason: "method_blocked" };
  }
  const homogeneous = provenances.every(
    (provenance) => provenance === provenances[0],
  );
  if (homogeneous && provenances[0] !== "estimated") {
    return { publishable: true, provenance: provenances[0] };
  }
  if (rule === undefined) {
    return { publishable: false, reason: "method_blocked" };
  }
  return {
    publishable: true,
    provenance: parseProvenance(rule.resolve(provenances)),
    methodVersion: parseMethodVersion(rule.methodVersion),
  };
}
