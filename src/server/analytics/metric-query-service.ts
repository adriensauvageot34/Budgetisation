import "server-only";

import {
  produceMetric,
  type ActiveMetricId,
  type ProducedMetric,
} from "@/analytics/production";
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
}
