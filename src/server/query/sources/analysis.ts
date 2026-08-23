import "server-only";

import { getContextCapability, type ContextCapabilityId } from "@/analytics/context";
import {
  getMetricRegistryEntry,
  MetricProductionContractError,
} from "@/analytics/production";
import Big from "big.js";
import { compareMoney } from "@/core/money";
import { selectEconomicComponentsForScope } from "@/analytics/context";
import type {
  AnalysisScope,
  LifeScopeContext,
  NormalizedAnalysisScope,
} from "@/core/scope";
import { addMonths, parseLocalDate, resolveGlobalWindowMonths, yearMonthOf, type YearMonth } from "@/core/time";
import type {
  AnalysisBreakdownDimension,
  AnalysisBreakdownRow,
  AnalysisContextSection,
  AnalysisSeriesPoint,
  ScopedMetricReadModel,
  AnalysisMonthStructureReadModel,
  AnalysisStructureDimension,
  AnalysisStructureMeasure,
  AnalysisStructureView,
  AnalysisMonthEvolutionPoint,
} from "@/query-api";
import type { QueryReadModelSources } from "@/query-api/server";
import type { FactSourceResolver } from "@/server/analytics/fact-source-resolver";
import type { MetricQueryService } from "@/server/analytics/metric-query-service";
import type { AuthorizedRuntimeContext } from "@/server/canonical/context";
import type { CanonicalRepository } from "@/server/canonical/repository";
import { optionalCanonicalString, type CanonicalRecord } from "@/server/canonical/record";
import { countEnvelope, periodCompleteness } from "./shared";

type AnalysisDependencies = {
  readonly context: AuthorizedRuntimeContext;
  readonly facts: FactSourceResolver;
  readonly metrics: MetricQueryService;
  readonly repository: CanonicalRepository;
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
      const values = selectEconomicComponentsForScope(
        await facts.loadEconomicFacts(scope),
        scope,
      );
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
      const values = selectEconomicComponentsForScope(
        await facts.loadEconomicFacts(scope),
        scope,
      );
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
      const selectedEconomic = selectEconomicComponentsForScope(economic, scope);
      const selectedVisits = visits.filter(
        (visit) =>
          (scope.subject.kind === "household" || visit.personId === scope.subject.personId) &&
          (scope.filters.placeIds.length === 0 || scope.filters.placeIds.includes(visit.placeId)),
      );
      const placeIds = [
        ...selectedEconomic.flatMap(({ canonicalPlace }) =>
          canonicalPlace.kind === "resolved" ? [canonicalPlace.placeId] : [],
        ),
        ...selectedVisits.map(({ placeId }) => placeId),
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
      const values = (await facts.loadActivityOccurrences(scope)).filter(
        (activity) =>
          (scope.subject.kind === "household" || activity.participantIds.includes(scope.subject.personId)) &&
          (scope.filters.activityIds.length === 0 || scope.filters.activityIds.includes(activity.activityId)),
      );
      return uniqueGroups(
        values.map(({ activityId }) => ({
          key: activityId,
          label: activityId,
          scope: replaceFilters(scope, { activityIds: [activityId] }),
        })),
      );
    }
    case "life_scope": {
      const values = selectEconomicComponentsForScope(
        await facts.loadEconomicFacts(scope),
        scope,
      );
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

const structureCombinations = Object.freeze([
  { view: "destination", dimension: "category", measures: ["amount"] },
  { view: "destination", dimension: "activity", measures: ["occurrences"] },
  { view: "destination", dimension: "merchant", measures: ["amount"] },
  { view: "destination", dimension: "place", measures: ["amount", "occurrences"] },
] as const satisfies readonly {
  readonly view: AnalysisStructureView;
  readonly dimension: AnalysisStructureDimension;
  readonly measures: readonly AnalysisStructureMeasure[];
}[]);

function structureMetricId(
  dimension: AnalysisStructureDimension,
  measure: AnalysisStructureMeasure,
): Parameters<MetricQueryService["produce"]>[0] | null {
  if (dimension === "category" && measure === "amount") return "category_amount";
  if (dimension === "activity" && measure === "occurrences") return "activity_frequency";
  if (dimension === "merchant" && measure === "amount") return "merchant_net_amount";
  if (dimension === "place" && measure === "amount") return "localized_spend";
  if (dimension === "place" && measure === "occurrences") return "place_visit_count";
  return null;
}

function metricMagnitude(metric: ScopedMetricReadModel): Big | null {
  if (metric.envelope.availability !== "known") return null;
  const value = metric.envelope.value;
  return typeof value === "number" || typeof value === "string" ? new Big(value) : null;
}

function structureBucket(dimension: AnalysisStructureDimension, id: string) {
  switch (dimension) {
    case "category": return { kind: "category" as const, categoryId: id as import("@/core/identity").CategoryId };
    case "activity": return { kind: "activity" as const, activityId: id as import("@/core/identity").ActivityId };
    case "merchant": return { kind: "merchant" as const, merchantId: id as import("@/core/identity").MerchantId };
    case "place": return { kind: "place" as const, placeId: id as import("@/core/identity").PlaceId };
    case "family": return { kind: "family" as const, familyId: id };
  }
}

function structureDestination(dimension: AnalysisStructureDimension, id: string) {
  switch (dimension) {
    case "category": return { kind: "target" as const, target: { kind: "category" as const, categoryId: id as import("@/core/identity").CategoryId } };
    case "activity": return { kind: "target" as const, target: { kind: "activity" as const, activityId: id as import("@/core/identity").ActivityId } };
    case "merchant": return { kind: "merchant" as const, merchantId: id as import("@/core/identity").MerchantId };
    case "place": return { kind: "place" as const, placeId: id as import("@/core/identity").PlaceId };
    case "family": return undefined;
  }
}

async function monthStructure(input: {
  readonly scope: NormalizedAnalysisScope;
  readonly params: { readonly view: AnalysisStructureView; readonly dimension: AnalysisStructureDimension; readonly measure: AnalysisStructureMeasure };
  readonly capabilities: import("@/query-api").QueryCapabilities;
  readonly dependencies: AnalysisDependencies;
}): Promise<AnalysisMonthStructureReadModel> {
  const available = structureCombinations.flatMap((combination) => {
    const measures = combination.measures.filter((measure) => {
      const metricId = structureMetricId(combination.dimension, measure);
      return metricId !== null && input.capabilities.availableMeasures.includes(metricId);
    });
    return measures.length === 0 ? [] : [{ ...combination, measures }];
  });
  const active = available.find(
    (combination) => combination.view === input.params.view && combination.dimension === input.params.dimension && combination.measures.includes(input.params.measure as never),
  );
  if (active === undefined) {
    throw new MetricProductionContractError("La combinaison Structure demandée n'est pas disponible pour ce scope.");
  }
  const metricId = structureMetricId(input.params.dimension, input.params.measure);
  if (metricId === null) throw new MetricProductionContractError("La mesure Structure n'est pas contractée.");
  const groups = await groupsForDimension(
    input.params.dimension as Exclude<AnalysisBreakdownDimension, "necessity" | "fixed_variable" | "life_scope" | "day_context">,
    input.scope,
    input.dependencies.facts,
  );
  const ranked = await breakdownRows({
    groups,
    metricId,
    limit: Math.max(1, groups.length),
    metrics: input.dependencies.metrics,
  });
  const magnitudes = ranked.map(({ metric }) => metricMagnitude(metric)).filter((value): value is Big => value !== null);
  const maximum = magnitudes.reduce<Big | null>((current, value) => current === null || value.gt(current) ? value : current, null);
  const rows = ranked.map((row) => {
    const id = row.bucket.kind === "entity" ? row.bucket.entityId : row.label;
    const magnitude = metricMagnitude(row.metric);
    const destination = structureDestination(input.params.dimension, id);
    return {
      bucket: structureBucket(input.params.dimension, id),
      label: row.label,
      metric: row.metric,
      rank: row.rank!,
      ...(magnitude === null || maximum === null
        ? {}
        : { barPercent: maximum.eq(0) ? 0 : Number(magnitude.div(maximum).times(100).toFixed(2)) }),
      ...(destination === undefined ? {} : { destination }),
    };
  });
  const availableViews = [...new Set(available.map(({ view }) => view))];
  const availableDimensions = [...new Set(available.filter(({ view }) => view === input.params.view).map(({ dimension }) => dimension))];
  const availableMeasures = active.measures;
  return {
    month: input.scope.time.kind === "month" ? input.scope.time.month : (() => { throw new TypeError("Structure exige Month."); })(),
    subject: input.scope.subject,
    activeView: input.params.view,
    activeDimension: input.params.dimension,
    activeMeasure: input.params.measure,
    availableViews,
    availableDimensions,
    availableMeasures,
    supportedCombinations: available,
    rows,
    reconciliation: reconciliationForMetric(metricId),
    capabilities: input.capabilities,
  };
}

async function economicEvolutionPoint(
  period: YearMonth,
  scope: NormalizedAnalysisScope,
  dependencies: AnalysisDependencies,
): Promise<AnalysisMonthEvolutionPoint> {
  const pointScope = { ...scope, time: { kind: "month" as const, month: period } };
  const bundle = await dependencies.metrics.produceActualWithTypical(pointScope);
  const rollingTypical = bundle.typical.envelope.reference === undefined
    ? undefined
    : bundle.typical as import("@/query-api").ScopedMoneyMetricReadModel;
  return {
    period,
    metric: bundle.actual as import("@/query-api").ScopedMoneyMetricReadModel,
    ...(rollingTypical === undefined ? {} : { rollingTypical, comparison: bundle.comparison }),
    periodCompleteness: periodCompleteness(dependencies.context, period),
  };
}

async function lifeScopeEvolutionPoint(
  period: YearMonth,
  lifeScope: LifeScopeContext,
  scope: NormalizedAnalysisScope,
  dependencies: AnalysisDependencies,
): Promise<AnalysisMonthEvolutionPoint> {
  const metric = await dependencies.metrics.produce("life_scope_amount", {
    ...scope,
    time: { kind: "month", month: period },
    filters: { ...scope.filters, lifeScopeContext: [lifeScope] },
  });
  return {
    period,
    metric: metric as import("@/query-api").ScopedMoneyMetricReadModel,
    periodCompleteness: periodCompleteness(dependencies.context, period),
  };
}

function recordStringArray(record: CanonicalRecord, keys: readonly string[]): readonly string[] {
  for (const key of keys) {
    const value = record[key];
    if (Array.isArray(value) && value.every((item) => typeof item === "string")) return [...new Set(value)].sort();
  }
  return [];
}

function recordLabel(record: CanonicalRecord, fallback: string): string {
  return optionalCanonicalString(record, ["title", "name", "label", "titre", "nom", "display_name"]) ?? fallback;
}

export function createAnalysisQuerySources(
  dependencies: AnalysisDependencies,
): Pick<
  QueryReadModelSources,
  | "readAnalysisMonthInitial"
  | "readAnalysisMonthBreakdown"
  | "readAnalysisMonthEvolution"
  | "readAnalysisMonthStructure"
  | "readAnalysisMonthLived"
  | "readAnalysisMonthMoments"
  | "readAnalysisTarget"
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
      const bundle = await dependencies.metrics.produceActualWithTypical(request.scope);
      const typical = bundle.typical.envelope.reference === undefined
        ? undefined
        : bundle.typical;
      return {
        month: request.scope.time.month,
        subject: request.scope.subject,
        periodCompleteness: periodCompleteness(
          dependencies.context,
          request.scope.time.month,
        ),
        actual: bundle.actual as never,
        ...(typical === undefined ? {} : { typical: typical as never, actualVsTypical: bundle.comparison }),
        markedFacts: [],
        markedFactsSelection: {
          kind: "unavailable" as const,
          reason: "materiality_rules_missing" as const,
        },
        manualSummary: null,
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
      const totalPoints = await Promise.all(
        periods.map((period) => economicEvolutionPoint(period, request.scope, dependencies)),
      );
      const lifeScopeAvailable = context.capabilities.availableMeasures.includes("life_scope_amount");
      const lifeSeries = lifeScopeAvailable
        ? await Promise.all([
            Promise.all(periods.map((period) => lifeScopeEvolutionPoint(period, "Vie courante", request.scope, dependencies))),
            Promise.all(periods.map((period) => lifeScopeEvolutionPoint(period, "Hors quotidien", request.scope, dependencies))),
          ])
        : null;
      return {
        month: targetMonth,
        subject: request.scope.subject,
        series: [
          { id: "economic_total" as const, label: "Total économique net", metricId: "economic_consumption_net_attributable" as const, points: totalPoints },
          ...(lifeSeries === null ? [] : [
            { id: "daily_life" as const, label: "Vie courante", metricId: "life_scope_amount" as const, points: lifeSeries[0] },
            { id: "outside_daily_life" as const, label: "Hors quotidien", metricId: "life_scope_amount" as const, points: lifeSeries[1] },
          ]),
        ],
        capabilities: context.capabilities,
      };
    },

    async readAnalysisMonthStructure({ request, context }) {
      if (request.scope.time.kind !== "month") throw new TypeError("Analysis Month Structure exige un scope month.");
      return monthStructure({
        scope: request.scope,
        params: request.params,
        capabilities: context.capabilities,
        dependencies,
      });
    },

    async readAnalysisMonthLived({ request, context }) {
      if (request.scope.time.kind !== "month") throw new TypeError("Analysis Month Lived exige un scope month.");
      const canReadActivities = context.capabilities.availableMeasures.includes("activity_frequency");
      const activityGroups = canReadActivities
        ? await groupsForDimension("activity", request.scope, dependencies.facts)
        : [];
      const ranked = activityGroups.length === 0
        ? []
        : await breakdownRows({ groups: activityGroups, metricId: "activity_frequency", limit: Math.min(6, activityGroups.length), metrics: dependencies.metrics });
      const sections = await contextSections({
        scope: request.scope,
        availableMeasures: context.capabilities.availableMeasures,
        dependencies,
      });
      const activities = ranked.map((row) => {
        const activityId = (row.bucket.kind === "entity" ? row.bucket.entityId : row.label) as import("@/core/identity").ActivityId;
        return {
          activityId,
          label: row.label,
          frequency: row.metric as import("@/query-api").ScopedCountMetricReadModel,
          qualification: "not_assessed" as const,
          destination: { kind: "target" as const, target: { kind: "activity" as const, activityId } },
        };
      });
      const availableSubviews = [
        "summary" as const,
        ...(activities.length === 0 ? [] : ["rhythm" as const]),
        ...(sections.length === 0 ? [] : ["contexts" as const]),
      ];
      return {
        month: request.scope.time.month,
        subject: request.scope.subject,
        availableSubviews,
        activities,
        contexts: { sections, capabilities: context.capabilities },
        frequencyCost: { kind: "unavailable" as const, reason: "median_causal_cost_metric_missing" as const },
        capabilities: context.capabilities,
      };
    },

    async readAnalysisMonthMoments({ request, context }) {
      if (request.scope.time.kind !== "month") throw new TypeError("Analysis Month Moments exige un scope month.");
      const rows = await dependencies.repository.loadEntityRows("moments", "moment_id");
      const monthStart = parseLocalDate(`${request.scope.time.month}-01`);
      const monthEnd = parseLocalDate(`${addMonths(request.scope.time.month, 1)}-01`);
      const hasEconomicFilters = request.scope.filters.categoryIds.length > 0 ||
        request.scope.filters.activityIds.length > 0 ||
        request.scope.filters.merchantIds.length > 0 ||
        request.scope.filters.placeIds.length > 0 ||
        request.scope.filters.lifeScopeContext.length > 0;
      const eligibleMomentIds = hasEconomicFilters
        ? new Set(
            selectEconomicComponentsForScope(
              await dependencies.facts.loadEconomicFacts(request.scope),
              request.scope,
            ).flatMap(({ moment }) => moment.kind === "resolved" ? [moment.id] : []),
          )
        : null;
      const moments = rows.flatMap((row) => {
        const momentId = optionalCanonicalString(row, ["moment_id"]);
        if (momentId === undefined || (eligibleMomentIds !== null && !eligibleMomentIds.has(momentId as never))) return [];
        const rawStart = optionalCanonicalString(row, ["start_date", "starts_on"]);
        const rawEnd = optionalCanonicalString(row, ["end_date", "ends_on"]);
        if (rawStart === undefined) return [];
        const startDate = parseLocalDate(rawStart);
        const endDate = rawEnd === undefined ? startDate : parseLocalDate(rawEnd);
        if (startDate >= monthEnd || endDate < monthStart) return [];
        const participantIds = recordStringArray(row, ["participant_ids", "person_ids"])
          .filter((id) => dependencies.context.personIds.includes(id as import("@/core/identity").PersonId));
        if (request.scope.subject.kind === "person" && !participantIds.includes(request.scope.subject.personId)) return [];
        const participants = participantIds.map((personId) => ({
          personId: personId as import("@/core/identity").PersonId,
          ...(dependencies.context.persons.find((person) => person.personId === personId)?.displayName === undefined
            ? {}
            : { label: dependencies.context.persons.find((person) => person.personId === personId)!.displayName }),
        }));
        return [{
          momentId: momentId as import("@/core/identity").MomentId,
          title: recordLabel(row, momentId),
          startDate,
          endDate,
          participants,
          destination: { kind: "moment" as const, momentId: momentId as import("@/core/identity").MomentId },
        }];
      }).sort((left, right) => left.startDate.localeCompare(right.startDate) || left.momentId.localeCompare(right.momentId));
      return {
        month: request.scope.time.month,
        subject: request.scope.subject,
        moments,
        capabilities: context.capabilities,
      };
    },

    async readAnalysisTarget({ request, context }) {
      if (request.scope.time.kind !== "month") throw new TypeError("Analysis Target exige un scope month.");
      const target = request.params.target;
      if (target.kind === "family") {
        return { month: request.scope.time.month, subject: request.scope.subject, target, status: "unsupported" as const, headlineMetrics: [], capabilities: context.capabilities };
      }
      const outsideScope = target.kind === "category"
        ? request.scope.filters.categoryIds.length > 0 && !request.scope.filters.categoryIds.includes(target.categoryId)
        : target.kind === "activity"
          ? request.scope.filters.activityIds.length > 0 && !request.scope.filters.activityIds.includes(target.activityId)
          : request.scope.filters.lifeScopeContext.length > 0 && !request.scope.filters.lifeScopeContext.includes(target.context);
      if (outsideScope) {
        return { month: request.scope.time.month, subject: request.scope.subject, target, status: "outside_scope" as const, headlineMetrics: [], capabilities: context.capabilities };
      }
      const targetScope = target.kind === "category"
        ? { ...request.scope, filters: { ...request.scope.filters, categoryIds: [target.categoryId] } }
        : target.kind === "activity"
          ? { ...request.scope, filters: { ...request.scope.filters, activityIds: [target.activityId] } }
          : { ...request.scope, filters: { ...request.scope.filters, lifeScopeContext: [target.context] } };
      const metricId = target.kind === "category" ? "category_amount" : target.kind === "activity" ? "activity_frequency" : "life_scope_amount";
      const metric = await dependencies.metrics.produce(metricId, targetScope);
      return {
        month: request.scope.time.month,
        subject: request.scope.subject,
        target,
        status: "available" as const,
        headlineMetrics: [metric],
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
