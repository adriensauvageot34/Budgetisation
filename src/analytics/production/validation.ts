import {
  parseMetricId,
  type MetricId,
} from "../../core/identity";
import {
  createMetricEnvelopeParser,
  parseMoneyMetricEnvelope,
  type MetricEnvelope,
} from "../../core/metrics";
import { parseMethodVersion } from "../../core/versions";
import { assertMonthReferenceWindow } from "../references";
import {
  FUEL_TRIP_ESTIMATE_METRIC_ID,
} from "../provenance";
import { MetricProductionContractError } from "./errors";
import { getMetricRegistryEntry } from "./registry";
import type {
  ProducedCountMetric,
  ProducedMetric,
  ProducedMoneyMetric,
} from "./types";

const scopeHashPattern = /^[0-9a-f]{64}$/;
const parseCountEnvelope = createMetricEnvelopeParser<number, "count" | "count/month">({
  parseValue(value: unknown): number {
    if (
      typeof value !== "number" ||
      !Number.isSafeInteger(value) ||
      value < 0
    ) {
      throw new TypeError("Une métrique count exige un entier positif ou nul.");
    }
    return value;
  },
  allowedUnits: ["count", "count/month"],
});

function envelopeInput(metric: ProducedMetric): Record<string, unknown> {
  return {
    availability: metric.availability,
    value: metric.value,
    unit: metric.unit,
    provenance: metric.provenance,
    ...(metric.coverage === undefined ? {} : { coverage: metric.coverage }),
    ...(metric.support === undefined ? {} : { support: metric.support }),
    ...(metric.reference === undefined ? {} : { reference: metric.reference }),
    ...(metric.methodVersion === undefined
      ? {}
      : { methodVersion: metric.methodVersion }),
  };
}

function assertMetricIdentity(metricId: MetricId, expected: MetricId): void {
  if (parseMetricId(metricId) !== expected) {
    throw new TypeError("MetricId incohérent avec le Metric Registry.");
  }
}

export function validateProducedMetric(metric: ProducedMetric): ProducedMetric {
  try {
    const definition = getMetricRegistryEntry(metric.metricId);
    assertMetricIdentity(metric.metricId, definition.metricId);
    if (!scopeHashPattern.test(metric.scopeHash)) {
      throw new TypeError("ScopeHash analytique invalide.");
    }
    if (
      metric.methodVersion === undefined ||
      parseMethodVersion(metric.methodVersion) !== definition.methodVersion
    ) {
      throw new TypeError("MethodVersion incohérente avec le Metric Registry.");
    }
    if (metric.unit !== definition.unit) {
      throw new TypeError("Unité incohérente avec le Metric Registry.");
    }
    if (metric.provenance !== definition.provenanceRule) {
      throw new TypeError("Provenance incohérente avec le Metric Registry.");
    }
    if (
      metric.support !== undefined &&
      metric.support.unit !== definition.supportPolicy.unit
    ) {
      throw new TypeError("SupportUnit incohérente avec le Metric Registry.");
    }
    if (
      metric.availability === "known" &&
      definition.supportPolicy.kind !== "optional" &&
      metric.support === undefined
    ) {
      throw new TypeError("La métrique connue exige son Support qualifié.");
    }

    const parsedEnvelope: MetricEnvelope<unknown> =
      definition.outputKind === "money"
        ? parseMoneyMetricEnvelope(envelopeInput(metric))
        : parseCountEnvelope(envelopeInput(metric));
    if (definition.referenceMethod === "comparison_reference") {
      if (metric.reference === undefined || metric.referenceWindow === undefined) {
        throw new TypeError("La métrique de référence exige ses métadonnées.");
      }
      assertMonthReferenceWindow(metric.referenceWindow);
    } else if (
      metric.reference !== undefined ||
      metric.referenceWindow !== undefined
    ) {
      throw new TypeError("Une métrique sans référence ne porte pas ReferenceMeta.");
    }
    if (
      definition.productionStrategy === "fuel_trip_estimate" &&
      (metric.estimationTrace === undefined ||
        metric.estimationTrace.metricId !== FUEL_TRIP_ESTIMATE_METRIC_ID ||
        metric.estimationTrace.methodVersion !== definition.methodVersion)
    ) {
      throw new TypeError("L’estimation exige une trace versionnée cohérente.");
    }

    const identity = {
      metricId: definition.metricId,
      scopeHash: metric.scopeHash,
      ...(metric.referenceWindow === undefined
        ? {}
        : { referenceWindow: metric.referenceWindow }),
      ...(metric.estimationTrace === undefined
        ? {}
        : { estimationTrace: metric.estimationTrace }),
    };
    return definition.outputKind === "money"
      ? ({ ...identity, ...parsedEnvelope } as ProducedMoneyMetric)
      : ({ ...identity, ...parsedEnvelope } as ProducedCountMetric);
  } catch (error) {
    if (error instanceof MetricProductionContractError) throw error;
    throw new MetricProductionContractError(
      "Le résultat métrique ne respecte pas le contrat runtime.",
      { cause: error },
    );
  }
}
