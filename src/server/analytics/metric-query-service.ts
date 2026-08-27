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
import { computeScopeHash, normalizeAnalysisScope } from "@/core/scope";
import type { ScopedMetricReadModel } from "@/query-api";
import { QueryTemporaryUnavailableError } from "@/query-api/server";
import {
  CanonicalReadError,
} from "@/server/canonical/errors";
import type { FactSourceResolver } from "./fact-source-resolver";
import type { SupabaseAnalyticsMaterializationStore } from "./materialization";

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
  private readonly requestCache = new Map<string, Promise<ProducedMetric>>();

  constructor(
    private readonly resolver: FactSourceResolver,
    private readonly materialization?: SupabaseAnalyticsMaterializationStore,
  ) {}

  private cacheKey(metricId: ActiveMetricId, scope: AnalysisScope): string {
    return `${metricId}:${computeScopeHash(normalizeAnalysisScope(scope))}`;
  }

  private async computeCold(
    metricId: ActiveMetricId,
    scope: AnalysisScope,
  ): Promise<ProducedMetric> {
    const source = await this.resolver.resolve(metricId, scope);
    const metric = produceMetric({ metricId, scope, source });
    if (this.materialization !== undefined) {
      try {
        await this.materialization.writeMetric(metricId, scope, metric);
      } catch {
        // Une écriture de cache ne change jamais la métrique produite.
      }
    }
    return metric;
  }

  private producedMetric(
    metricId: ActiveMetricId,
    scope: AnalysisScope,
  ): Promise<ProducedMetric> {
    const key = this.cacheKey(metricId, scope);
    const existing = this.requestCache.get(key);
    if (existing !== undefined) return existing;
    const computed = (async () => {
      if (this.materialization !== undefined) {
        try {
          const materialized = await this.materialization.readMetric(metricId, scope);
          if (materialized !== null) return materialized;
          const aggregated = await this.materialization.readGlobalAdditiveMetric(
            metricId,
            scope,
          );
          if (aggregated !== null) {
            await this.materialization.writeMetric(metricId, scope, aggregated);
            return aggregated;
          }
        } catch {
          // Le cold path reste autoritaire si la matérialisation est indisponible.
        }
      }
      return this.computeCold(metricId, scope);
    })();
    this.requestCache.set(key, computed);
    return computed;
  }

  async produceMany(
    metricId: ActiveMetricId,
    scopes: readonly AnalysisScope[],
  ): Promise<readonly ScopedMetricReadModel[]> {
    const missing = scopes.filter((scope) =>
      !this.requestCache.has(this.cacheKey(metricId, scope)));
    if (missing.length > 0) {
      const batch = (async () => {
        let materialized: ReadonlyMap<string, ProducedMetric> = new Map();
        if (this.materialization !== undefined) {
          try {
            materialized = await this.materialization.readMonthlyMetrics(
              metricId,
              missing,
            );
          } catch {
            // Le cold path reste autoritaire.
          }
        }
        return Promise.all(missing.map((scope) => {
          const scopeHash = computeScopeHash(normalizeAnalysisScope(scope));
          return materialized.get(scopeHash) ?? this.computeCold(metricId, scope);
        }));
      })();
      missing.forEach((scope, index) => {
        this.requestCache.set(
          this.cacheKey(metricId, scope),
          batch.then((metrics) => metrics[index]),
        );
      });
    }
    return Promise.all(scopes.map(async (scope) =>
      scopedMetricReadModel(await this.producedMetric(metricId, scope))));
  }

  async produce(
    metricId: ActiveMetricId,
    scope: AnalysisScope,
  ): Promise<ScopedMetricReadModel> {
    try {
      return scopedMetricReadModel(await this.producedMetric(metricId, scope));
    } catch (error) {
      if (error instanceof CanonicalReadError) {
        throw new QueryTemporaryUnavailableError(
          `La source canonique ${error.source} est indisponible.`,
        );
      }
      throw error;
    }
  }

  async materializeBucket(
    metricId: ActiveMetricId,
    scope: AnalysisScope,
    dimensionKey: string,
    bucketKey: string,
    metric: ScopedMetricReadModel,
  ): Promise<void> {
    if (this.materialization === undefined) return;
    if (metric.metricId !== metricId) {
      throw new TypeError("La métrique atomique ne correspond pas à son identité.");
    }
    try {
      await this.materialization.writeMetricBucket(
        metricId,
        scope,
        dimensionKey,
        bucketKey,
        {
          metricId: metric.metricId,
          scopeHash: metric.scopeHash,
          ...metric.envelope,
        } as ProducedMetric,
      );
    } catch {
      // Une écriture d'artefact atomique ne change jamais le read model produit.
    }
  }

  async produceActualWithTypical(scope: AnalysisScope): Promise<{
    readonly actual: ScopedMetricReadModel;
    readonly typical: ScopedMetricReadModel;
    readonly comparison: MoneyComparisonResult;
  }> {
    try {
      const [actualProduced, typicalProduced] = await Promise.all([
        this.producedMetric("economic_consumption_net_attributable", scope),
        this.producedMetric("typical_month_cost", scope),
      ]);
      const actualMoney = actualProduced as ProducedMoneyMetric;
      const typicalMoney = typicalProduced as ProducedMoneyMetric;
      const window = typicalMoney.referenceWindow;
      const comparison = window === undefined
        ? produceMoneyComparison({
            capabilityId: "actual_vs_typical_month",
            targetSemantic: "actual",
            referenceSemantic: "typical_month",
            referenceAuthorization: { kind: "same_period" },
            target: actualMoney,
            reference: typicalMoney,
          })
        : produceMoneyComparison({
            capabilityId: "actual_vs_typical_month",
            targetSemantic: "actual",
            referenceSemantic: "typical_month",
            referenceAuthorization: { kind: "rolling_comparison", window },
            target: actualMoney,
            reference: typicalMoney,
          });
      return {
        actual: scopedMetricReadModel(actualMoney),
        typical: scopedMetricReadModel(typicalMoney),
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
