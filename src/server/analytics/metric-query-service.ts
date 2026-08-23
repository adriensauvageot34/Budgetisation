import "server-only";

import {
  produceMetric,
  produceMoneyComparison,
  type ActiveMetricId,
  type ProducedMetric,
  type ProducedMoneyMetric,
} from "@/analytics/production";
import type { MoneyComparisonResult } from "@/analytics/comparisons";
import type { AnalysisScope } from "@/core/scope";
import type { ScopedMetricReadModel } from "@/query-api";
import { QueryTemporaryUnavailableError } from "@/query-api/server";
import {
  CanonicalReadError,
} from "@/server/canonical/errors";
import type { FactSourceResolver } from "./fact-source-resolver";

export function scopedMetricReadModel(
  metric: ProducedMetric,
): ScopedMetricReadModel {
  const {
    metricId,
    scopeHash,
    referenceWindow: _referenceWindow,
    estimationTrace: _estimationTrace,
    ...envelope
  } = metric;
  return { metricId, scopeHash, envelope } as ScopedMetricReadModel;
}

export class MetricQueryService {
  constructor(private readonly resolver: FactSourceResolver) {}

  async produce(
    metricId: ActiveMetricId,
    scope: AnalysisScope,
  ): Promise<ScopedMetricReadModel> {
    try {
      const source = await this.resolver.resolve(metricId, scope);
      return scopedMetricReadModel(produceMetric({ metricId, scope, source }));
    } catch (error) {
      if (error instanceof CanonicalReadError) {
        throw new QueryTemporaryUnavailableError(
          `La source canonique ${error.source} est indisponible.`,
        );
      }
      throw error;
    }
  }

  async produceActualWithTypical(scope: AnalysisScope): Promise<{
    readonly actual: ScopedMetricReadModel;
    readonly typical: ScopedMetricReadModel;
    readonly comparison: MoneyComparisonResult;
  }> {
    try {
      const [actualSource, typicalSource] = await Promise.all([
        this.resolver.resolve("economic_consumption_net_attributable", scope),
        this.resolver.resolve("typical_month_cost", scope),
      ]);
      const actualProduced = produceMetric({
        metricId: "economic_consumption_net_attributable",
        scope,
        source: actualSource,
      }) as ProducedMoneyMetric;
      const typicalProduced = produceMetric({
        metricId: "typical_month_cost",
        scope,
        source: typicalSource,
      }) as ProducedMoneyMetric;
      const window = typicalProduced.referenceWindow;
      const comparison = window === undefined
        ? produceMoneyComparison({
            capabilityId: "actual_vs_typical_month",
            targetSemantic: "actual",
            referenceSemantic: "typical_month",
            referenceAuthorization: { kind: "same_period" },
            target: actualProduced,
            reference: typicalProduced,
          })
        : produceMoneyComparison({
            capabilityId: "actual_vs_typical_month",
            targetSemantic: "actual",
            referenceSemantic: "typical_month",
            referenceAuthorization: { kind: "rolling_comparison", window },
            target: actualProduced,
            reference: typicalProduced,
          });
      return {
        actual: scopedMetricReadModel(actualProduced),
        typical: scopedMetricReadModel(typicalProduced),
        comparison,
      };
    } catch (error) {
      if (error instanceof CanonicalReadError) {
        throw new QueryTemporaryUnavailableError(
          `La source canonique ${error.source} est indisponible.`,
        );
      }
      throw error;
    }
  }
}
