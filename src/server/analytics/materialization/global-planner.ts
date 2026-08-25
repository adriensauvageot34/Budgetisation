import "server-only";

import {
  getMetricRegistryEntry,
  validateProducedMetric,
  type ActiveMetricId,
  type ProducedMetric,
} from "@/analytics/production";
import type { Coverage, Support } from "@/core/metrics";
import { addMoney, parseMoney, type Money } from "@/core/money";
import {
  computeScopeHash,
  normalizeAnalysisScope,
  type AnalysisScope,
} from "@/core/scope";

function aggregateCoverage(
  metrics: readonly ProducedMetric[],
): Coverage | undefined | null {
  const coverages = metrics.map(({ coverage }) => coverage);
  if (coverages.every((coverage) => coverage === undefined)) return undefined;
  if (coverages.some((coverage) => coverage === undefined)) return null;
  if (coverages.some((coverage) =>
    coverage?.level === "partial" && coverage.coveredShare !== undefined)) {
    return null;
  }
  return coverages.some((coverage) => coverage?.level === "partial")
    ? { level: "partial" }
    : { level: "complete" };
}

function aggregateSupport(
  metrics: readonly ProducedMetric[],
): Support | undefined | null {
  const supports = metrics.map(({ support }) => support);
  if (supports.every((support) => support === undefined)) return undefined;
  if (supports.some((support) => support === undefined)) return null;
  const first = supports[0];
  if (
    first === undefined
    || supports.some((support) =>
      support?.unit !== first.unit
      || support.eligibleN !== undefined
      || support.observableN !== undefined
      || support.excludedN !== undefined)
  ) {
    return null;
  }
  const n = supports.reduce((sum, support) => sum + (support?.n ?? 0), 0);
  return {
    n,
    unit: first.unit,
    level: n === 0 ? "insufficient" : "sufficient",
  };
}

/**
 * Rebuilds a global metric only when the Metric Registry declares strict
 * additivity and every monthly envelope can be combined without losing
 * availability, coverage, support or provenance semantics.
 */
export function aggregateAdditiveMonthlyMetrics(input: {
  readonly metricId: ActiveMetricId;
  readonly globalScope: AnalysisScope;
  readonly monthlyMetrics: readonly ProducedMetric[];
}): ProducedMetric | null {
  const scope = normalizeAnalysisScope(input.globalScope);
  const definition = getMetricRegistryEntry(input.metricId);
  if (
    scope.time.kind !== "global"
    || definition.additivity.kind !== "additive"
    || !definition.allowedTimeKinds.includes("global")
    || input.monthlyMetrics.length === 0
  ) {
    return null;
  }
  if (input.monthlyMetrics.some((metric) =>
    metric.metricId !== definition.metricId
    || metric.methodVersion !== definition.methodVersion
    || metric.unit !== definition.unit
    || metric.provenance !== definition.provenanceRule
    || metric.availability !== "known"
    || metric.reference !== undefined
    || metric.referenceWindow !== undefined
    || metric.estimationTrace !== undefined)) {
    return null;
  }
  const coverage = aggregateCoverage(input.monthlyMetrics);
  const support = aggregateSupport(input.monthlyMetrics);
  if (coverage === null || support === null) return null;

  const value = definition.outputKind === "money"
    ? input.monthlyMetrics.reduce(
        (sum, metric) => addMoney(sum, metric.value as Money),
        parseMoney("0"),
      )
    : input.monthlyMetrics.reduce((sum, metric) => sum + (metric.value as number), 0);

  return validateProducedMetric({
    metricId: definition.metricId,
    scopeHash: computeScopeHash(scope),
    availability: "known",
    value,
    unit: definition.unit,
    provenance: definition.provenanceRule,
    methodVersion: definition.methodVersion,
    ...(coverage === undefined ? {} : { coverage }),
    ...(support === undefined ? {} : { support }),
  } as ProducedMetric);
}
