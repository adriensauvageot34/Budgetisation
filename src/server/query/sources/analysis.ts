import "server-only";

import { getContextCapability, type ContextCapabilityId } from "@/analytics/context";
import {
  getMetricRegistryEntry,
  MetricProductionContractError,
} from "@/analytics/production";
import { compareMoney } from "@/core/money";
import type {
  AnalysisScope,
  LifeScopeContext,
  NormalizedAnalysisScope,
} from "@/core/scope";
import { resolveGlobalWindowMonths, yearMonthOf, type YearMonth } from "@/core/time";
import type {
  AnalysisBreakdownDimension,
  AnalysisBreakdownRow,
  AnalysisContextSection,
  AnalysisSeriesPoint,
  ScopedMetricReadModel,
} from "@/query-api";
import type { QueryReadModelSources } from "@/query-api/server";
import type { FactSourceResolver } from "@/server/analytics/fact-source-resolver";
import type { MetricQueryService } from "@/server/analytics/metric-query-service";
import type { AuthorizedRuntimeContext } from "@/server/canonical/context";
import { countEnvelope, periodCompleteness } from "./shared";

type AnalysisDependencies = {
  readonly context: AuthorizedRuntimeContext;
  readonly facts: FactSourceResolver;
  readonly metrics: MetricQueryService;
};

type Group = {
  readonly key: string;
  readonly label: string;
  readonly scope: AnalysisScope;
};

function replaceFilters(
  scope: NormalizedAnalysisScope,
  filter: Partial<NormalizedAnalysisScope["filters"]>,
): AnalysisScope {
  return {
    subject: scope.subject,
    time: scope.time,
    filters: { ...scope.filters, ...filter },
  };
}

function uniqueGroups(groups: readonly Group[]): readonly Group[] {
  const byKey = new Map<string, Group>();
  for (const group of groups) byKey.set(group.key, group);
  return [...byKey.values()].sort((left, right) => left.key.localeCompare(right.key));
}

async function groupsForDimension(
  dimension: AnalysisBreakdownDimension,
  scope: NormalizedAnalysisScope,
  facts: FactSourceResolver,
): Promise<readonly Group[]> {
  switch (dimension) {
    case "category": {
      const values = await facts.loadEconomicFacts(scope);
      return uniqueGroups(
        values.flatMap(({ category }) =>
          category.kind === "resolved"
            ? [{
                key: category.id,
                label: category.id,
                scope: replaceFilters(scope, { categoryIds: [category.id] }),
              }]
            : [],
        ),
      );
    }
    case "merchant": {
      const values = await facts.loadEconomicFacts(scope);
      return uniqueGroups(
        values.flatMap(({ merchant }) =>
          merchant.kind === "resolved"
            ? [{
                key: merchant.id,
                label: merchant.id,
                scope: replaceFilters(scope, { merchantIds: [merchant.id] }),
              }]
            : [],
        ),
      );
    }
    case "place": {
      const [economic, visits] = await Promise.all([
        facts.loadEconomicFacts(scope),
        facts.loadPlaceVisits(scope),
      ]);
      const placeIds = [
        ...economic.flatMap(({ canonicalPlace }) =>
          canonicalPlace.kind === "resolved" ? [canonicalPlace.placeId] : [],
        ),
        ...visits.map(({ placeId }) => placeId),
      ];
      return uniqueGroups(
        placeIds.map((placeId) => ({
          key: placeId,
          label: placeId,
          scope: replaceFilters(scope, { placeIds: [placeId] }),
        })),
      );
    }
    case "activity": {
      const values = await facts.loadActivityOccurrences(scope);
      return uniqueGroups(
        values.map(({ activityId }) => ({
          key: activityId,
          label: activityId,
          scope: replaceFilters(scope, { activityIds: [activityId] }),
        })),
      );
    }
    case "life_scope": {
      const values = await facts.loadEconomicFacts(scope);
      return uniqueGroups(
        values.flatMap(({ lifeScope }) =>
          lifeScope.kind === "resolved"
            ? (() => {
                const value = lifeScope.value as LifeScopeContext;
                return [{
                  key: value,
                  label: value,
                  scope: replaceFilters(scope, { lifeScopeContext: [value] }),
                }];
              })()
            : [],
        ),
      );
    }
    case "necessity":
    case "fixed_variable":
    case "day_context":
      throw new MetricProductionContractError(
        `La dimension ${dimension} n'est pas projetable par les Facts canoniques actuels.`,
      );
  }
}

function compareMetrics(
  left: ScopedMetricReadModel,
  right: ScopedMetricReadModel,
): number {
  if (left.envelope.availability !== "known") {
    return right.envelope.availability === "known" ? 1 : 0;
  }
  if (right.envelope.availability !== "known") return -1;
  if (
    typeof left.envelope.value === "string" &&
    typeof right.envelope.value === "string"
  ) {
    return -compareMoney(left.envelope.value, right.envelope.value);
  }
  if (
    typeof left.envelope.value === "number" &&
    typeof right.envelope.value === "number"
  ) return right.envelope.value - left.envelope.value;
  throw new TypeError("Deux métriques de breakdown portent des valeurs incompatibles.");
}

function reconciliationForMetric(
  metricId: Parameters<MetricQueryService["produce"]>[0],
) {
  return getMetricRegistryEntry(metricId).additivity.kind === "non_additive"
    ? ("not_applicable" as const)
    : ("partial" as const);
}

async function breakdownRows(input: {
  readonly groups: readonly Group[];
  readonly metricId: Parameters<MetricQueryService["produce"]>[0];
  readonly limit: number;
  readonly metrics: MetricQueryService;
}): Promise<readonly AnalysisBreakdownRow[]> {
  const produced = await Promise.all(
    input.groups.map(async (group) => ({
      group,
      metric: await input.metrics.produce(input.metricId, group.scope),
    })),
  );
  return produced
    .sort((left, right) => compareMetrics(left.metric, right.metric))
    .slice(0, input.limit)
    .map(({ group, metric }, index) => ({
      bucket: { kind: "entity", entityId: group.key },
      label: group.label,
      metric,
      rank: index + 1,
      flags: [
        ...(metric.envelope.coverage?.level === "partial"
          ? (["partial_coverage"] as const)
          : []),
        ...(metric.envelope.availability === "conflict"
          ? (["conflict"] as const)
          : []),
      ],
    }));
}

async function evolutionPoints(input: {
  readonly periods: readonly YearMonth[];
  readonly scope: NormalizedAnalysisScope;
  readonly metricId: Parameters<MetricQueryService["produce"]>[0];
  readonly dependencies: AnalysisDependencies;
}): Promise<readonly AnalysisSeriesPoint[]> {
  return Promise.all(
    input.periods.map(async (period) => ({
      period,
      metric: await input.dependencies.metrics.produce(input.metricId, {
        ...input.scope,
        time: { kind: "month", month: period },
      }),
      periodCompleteness: periodCompleteness(input.dependencies.context, period),
    })),
  );
}

const contextDefinitions = [
  ["category_amount", "category"],
  ["activity_frequency", "activity"],
  ["merchant_net_amount", "merchant"],
  ["place_localized_spend", "place"],
  ["place_visit_count", "place"],
  ["life_scope_amount", "life_scope"],
] as const satisfies readonly (readonly [ContextCapabilityId, AnalysisBreakdownDimension])[];

async function contextSections(input: {
  readonly scope: NormalizedAnalysisScope;
  readonly availableMeasures: readonly string[];
  readonly dependencies: AnalysisDependencies;
}): Promise<readonly AnalysisContextSection[]> {
  const sections = await Promise.all(
    contextDefinitions.map(async ([capabilityId, dimension]) => {
      const capability = getContextCapability(capabilityId);
      if (
        capability.status.kind !== "available" ||
        !input.availableMeasures.includes(capability.metricId)
      ) return null;
      const groups = await groupsForDimension(
        dimension,
        input.scope,
        input.dependencies.facts,
      );
      const rows = await Promise.all(
        groups.map(async (group) => ({
          key: group.key,
          label: group.label,
          metric: await input.dependencies.metrics.produce(
            capability.metricId as Parameters<MetricQueryService["produce"]>[0],
            group.scope,
          ),
        })),
      );
      return {
        kind: "available" as const,
        capabilityId,
        dimension: capability.dimension,
        sourceGrains: capability.sourceGrains,
        supportUnit: capability.supportUnit,
        overlappingContextsAdditivity: "non_additive" as const,
        rows,
      };
    }),
  );
  return sections
    .filter((section): section is NonNullable<typeof section> => section !== null)
    .sort((left, right) => left.capabilityId.localeCompare(right.capabilityId));
}

export function createAnalysisQuerySources(
  dependencies: AnalysisDependencies,
): Pick<
  QueryReadModelSources,
  | "readAnalysisMonthInitial"
  | "readAnalysisMonthBreakdown"
  | "readAnalysisMonthEvolution"
  | "readAnalysisMonthContexts"
  | "readAnalysisGlobalInitial"
  | "readAnalysisGlobalBreakdown"
  | "readAnalysisGlobalEvolution"
  | "readAnalysisGlobalContexts"
> {
  return {
    async readAnalysisMonthInitial({ request, context }) {
      if (request.scope.time.kind !== "month") {
        throw new TypeError("Analysis Month exige un scope month.");
      }
      const [actual, typical] = await Promise.all([
        dependencies.metrics.produce(
          "economic_consumption_net_attributable",
          request.scope,
        ),
        dependencies.metrics.produce("typical_month_cost", request.scope),
      ]);
      return {
        month: request.scope.time.month,
        subject: request.scope.subject,
        periodCompleteness: periodCompleteness(
          dependencies.context,
          request.scope.time.month,
        ),
        actual: actual as never,
        typical: typical as never,
        structure: { axes: [] },
        capabilities: context.capabilities,
      };
    },

    async readAnalysisMonthBreakdown({ request, context }) {
      if (request.scope.time.kind !== "month") {
        throw new TypeError("Analysis Month Breakdown exige un scope month.");
      }
      const groups = await groupsForDimension(
        request.params.dimension,
        request.scope,
        dependencies.facts,
      );
      const rows = await breakdownRows({
        groups,
        metricId: request.params.measure,
        limit: request.params.limit,
        metrics: dependencies.metrics,
      });
      return {
        month: request.scope.time.month,
        subject: request.scope.subject,
        breakdown: {
          dimension: request.params.dimension,
          measure: request.params.measure,
          rows,
          reconciliation: reconciliationForMetric(request.params.measure),
          capabilities: context.capabilities,
        },
      };
    },

    async readAnalysisMonthEvolution({ request, context }) {
      if (request.scope.time.kind !== "month") {
        throw new TypeError("Analysis Month Evolution exige un scope month.");
      }
      const targetMonth = request.scope.time.month;
      const periods = dependencies.context.periods
        .map(({ month }) => yearMonthOf(month))
        .filter((month) => month <= targetMonth)
        .slice(-12);
      return {
        month: targetMonth,
        subject: request.scope.subject,
        metricId: request.params.metricId,
        points: await evolutionPoints({
          periods,
          scope: request.scope,
          metricId: request.params.metricId,
          dependencies,
        }),
        capabilities: context.capabilities,
      };
    },

    async readAnalysisMonthContexts({ request, context }) {
      if (request.scope.time.kind !== "month") {
        throw new TypeError("Analysis Month Contexts exige un scope month.");
      }
      return {
        month: request.scope.time.month,
        subject: request.scope.subject,
        contexts: {
          sections: await contextSections({
            scope: request.scope,
            availableMeasures: context.capabilities.availableMeasures,
            dependencies,
          }),
          capabilities: context.capabilities,
        },
      };
    },

    async readAnalysisGlobalInitial({ request, context }) {
      if (request.scope.time.kind !== "global") {
        throw new TypeError("Analysis Global exige un scope global.");
      }
      const months = new Set(
        resolveGlobalWindowMonths(
          request.scope.time.observationWindow,
          request.scope.time.asOf,
        ),
      );
      const observedPeriodCount = dependencies.context.periods.filter(
        (period) =>
          months.has(yearMonthOf(period.month)) &&
          period.financeStatus !== "unknown" &&
          period.financeStatus !== "not_applicable",
      ).length;
      const monthlyTypical = await dependencies.metrics.produce(
        "typical_month_cost",
        {
          ...request.scope,
          time: { kind: "month", month: request.scope.time.asOf },
        },
      );
      return {
        observationWindow: request.scope.time.observationWindow,
        asOf: request.scope.time.asOf,
        subject: request.scope.subject,
        observedPeriodCount: countEnvelope(observedPeriodCount),
        monthlyTypical: monthlyTypical as never,
        structure: { axes: [] },
        capabilities: context.capabilities,
      };
    },

    async readAnalysisGlobalBreakdown({ request, context }) {
      if (request.scope.time.kind !== "global") {
        throw new TypeError("Analysis Global Breakdown exige un scope global.");
      }
      const groups = await groupsForDimension(
        request.params.dimension,
        request.scope,
        dependencies.facts,
      );
      const rows = await breakdownRows({
        groups,
        metricId: request.params.measure,
        limit: request.params.limit,
        metrics: dependencies.metrics,
      });
      return {
        observationWindow: request.scope.time.observationWindow,
        asOf: request.scope.time.asOf,
        subject: request.scope.subject,
        breakdown: {
          dimension: request.params.dimension,
          measure: request.params.measure,
          rows,
          reconciliation: reconciliationForMetric(request.params.measure),
          capabilities: context.capabilities,
        },
      };
    },

    async readAnalysisGlobalEvolution({ request, context }) {
      if (request.scope.time.kind !== "global") {
        throw new TypeError("Analysis Global Evolution exige un scope global.");
      }
      const periods = resolveGlobalWindowMonths(
        request.scope.time.observationWindow,
        request.scope.time.asOf,
      );
      return {
        observationWindow: request.scope.time.observationWindow,
        asOf: request.scope.time.asOf,
        subject: request.scope.subject,
        metricId: request.params.metricId,
        points: await evolutionPoints({
          periods,
          scope: request.scope,
          metricId: request.params.metricId,
          dependencies,
        }),
        capabilities: context.capabilities,
      };
    },

    async readAnalysisGlobalContexts({ request, context }) {
      if (request.scope.time.kind !== "global") {
        throw new TypeError("Analysis Global Contexts exige un scope global.");
      }
      return {
        observationWindow: request.scope.time.observationWindow,
        asOf: request.scope.time.asOf,
        subject: request.scope.subject,
        contexts: {
          sections: await contextSections({
            scope: request.scope,
            availableMeasures: context.capabilities.availableMeasures,
            dependencies,
          }),
          capabilities: context.capabilities,
        },
      };
    },
  };
}
