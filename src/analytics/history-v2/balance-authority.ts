import {
  produceMetric,
  type ActiveMetricId,
  type MetricProductionSource,
  type ProducedMoneyMetric,
} from "../production";
import type { AnalysisScope } from "../../core/scope";
import { parseCategoryId } from "../../core/identity";
import type { YearMonth } from "../../core/time";
import type { MinimalMonthComponent } from "../baseline";
import type {
  MonthReferenceWindow,
  MonthlyEconomicObservation,
} from "../references";

export type HistoryV2MetricSourceResolver = {
  resolve(
    metricId: ActiveMetricId,
    scope: AnalysisScope,
  ): Promise<MetricProductionSource>;
};

export type OfficialTypicalMonthAuthority = {
  readonly metric: ProducedMoneyMetric;
  readonly window: MonthReferenceWindow;
  readonly monthlyObservations: readonly MonthlyEconomicObservation[];
};

export type OfficialMinimalMonthAuthority = {
  readonly metric: ProducedMoneyMetric;
  readonly components: readonly MinimalMonthComponent[];
};

export type OfficialCategoryTypicalAuthority = OfficialTypicalMonthAuthority & {
  readonly categoryId: string;
};

export type HistoryV2BalanceAnalyticsAuthority = {
  readonly typical: OfficialTypicalMonthAuthority;
  readonly minimal: OfficialMinimalMonthAuthority;
  readonly categoryTypicals: readonly OfficialCategoryTypicalAuthority[];
};

async function resolveProducedMoneyMetric(input: {
  readonly resolver: HistoryV2MetricSourceResolver;
  readonly metricId: "typical_month_cost" | "minimal_month_cost";
  readonly scope: AnalysisScope;
}): Promise<{
  readonly source: MetricProductionSource;
  readonly metric: ProducedMoneyMetric;
}> {
  const source = await input.resolver.resolve(input.metricId, input.scope);
  return {
    source,
    metric: produceMetric({
      metricId: input.metricId,
      scope: input.scope,
      source,
    }) as ProducedMoneyMetric,
  };
}

function requireTypicalSource(
  source: MetricProductionSource,
): Extract<MetricProductionSource, { readonly kind: "typical_month" }> {
  if (source.kind !== "typical_month") {
    throw new TypeError("L'autorité Typical History V2 doit être typical_month.");
  }
  return source;
}

function minimalComponents(
  source: MetricProductionSource,
): readonly MinimalMonthComponent[] {
  if (source.kind !== "minimal_month" || source.availability !== "known") {
    return [];
  }
  return [
    ...source.neutralVariableComponents,
    ...source.mandatoryMonthlyObligationsAndProvisions,
  ];
}

/**
 * Resolves the only Analytics inputs that History V2 Balance may use for
 * Typical, Minimal and category baselines. Certification expectations are
 * deliberately absent from this contract: an oracle can validate the result,
 * but cannot participate in its construction.
 */
export async function resolveHistoryV2BalanceAnalyticsAuthority(input: {
  readonly resolver: HistoryV2MetricSourceResolver;
  readonly month: YearMonth;
  readonly categoryIds: readonly string[];
}): Promise<HistoryV2BalanceAnalyticsAuthority> {
  const householdScope: AnalysisScope = {
    subject: { kind: "household" },
    time: { kind: "month", month: input.month },
  };
  const [typicalResult, minimalResult, categoryResults] = await Promise.all([
    resolveProducedMoneyMetric({
      resolver: input.resolver,
      metricId: "typical_month_cost",
      scope: householdScope,
    }),
    resolveProducedMoneyMetric({
      resolver: input.resolver,
      metricId: "minimal_month_cost",
      scope: householdScope,
    }),
    Promise.all([...new Set(input.categoryIds)].sort().map(async (categoryId) => {
      const result = await resolveProducedMoneyMetric({
        resolver: input.resolver,
        metricId: "typical_month_cost",
        scope: {
          ...householdScope,
          filters: { categoryIds: [parseCategoryId(categoryId)] },
        },
      });
      const source = requireTypicalSource(result.source);
      return {
        categoryId,
        metric: result.metric,
        window: source.window,
        monthlyObservations: source.monthlyObservations,
      };
    })),
  ]);

  const typicalSource = requireTypicalSource(typicalResult.source);
  return {
    typical: {
      metric: typicalResult.metric,
      window: typicalSource.window,
      monthlyObservations: typicalSource.monthlyObservations,
    },
    minimal: {
      metric: minimalResult.metric,
      components: minimalComponents(minimalResult.source),
    },
    categoryTypicals: categoryResults,
  };
}
