import "server-only";

import { getContextCapability, type ContextCapabilityId } from "@/analytics/context";
import {
  getMetricRegistryEntry,
  MetricProductionContractError,
} from "@/analytics/production";
import {
  MARKED_FACTS_METHOD_VERSION,
  selectMarkedFacts,
  type MarkedFactCandidate,
} from "@/analytics/insights";
import { compareMoneyMetrics, type MoneyComparisonResult } from "@/analytics/comparisons";
import { partitionEconomicComponentsForStructure } from "@/analytics/facts";
import Big from "big.js";
import { compareMoney } from "@/core/money";
import { selectEconomicComponentsForScope, sumEconomicNetForScope } from "@/analytics/context";
import { parseSupport } from "@/core/metrics";
import { supportForPolicy } from "@/analytics/support";
import { computeScopeHash } from "@/core/scope";
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
  CountMetricEnvelope,
  PersonaTarget,
} from "@/query-api";
import {
  parseGalleryMerchantsParams,
  parseGalleryMomentsParams,
  parseGalleryPlacesParams,
  queryResourceKeys,
} from "@/query-api";
import type { QueryReadModelSources } from "@/query-api/server";
import type { FactSourceResolver } from "@/server/analytics/fact-source-resolver";
import { canonicalRangeForScope } from "@/server/analytics/fact-source-resolver";
import type { MetricQueryService } from "@/server/analytics/metric-query-service";
import type { AuthorizedRuntimeContext } from "@/server/canonical/context";
import type { CanonicalRepository } from "@/server/canonical/repository";
import { optionalCanonicalString, type CanonicalRecord } from "@/server/canonical/record";
import { countEnvelope, periodCompleteness } from "./shared";
import { createGalleryQuerySources } from "./galleries";
import { canonicalLabelMap, loadMomentParticipantsByMomentId } from "./canonical-relations";

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
  repository: CanonicalRepository,
): Promise<readonly Group[]> {
  switch (dimension) {
    case "category": {
      const values = selectEconomicComponentsForScope(
        await facts.loadEconomicFacts(scope),
        scope,
      );
      const categoryIds = values.flatMap(({ category }) => category.kind === "resolved" ? [category.id] : []);
      const labels = canonicalLabelMap(
        await repository.loadTaxonomyRows("categories", categoryIds),
        ["id", "category_id"],
      );
      return uniqueGroups(
        values.flatMap(({ category }) =>
          category.kind === "resolved"
            ? [{
                key: category.id,
                label: labels.get(category.id) ?? category.id,
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
      const merchantIds = values.flatMap(({ merchant }) => merchant.kind === "resolved" ? [merchant.id] : []);
      const labels = canonicalLabelMap(
        await repository.loadEntityRows("merchants", "merchant_id", merchantIds),
        ["merchant_id", "id"],
      );
      return uniqueGroups(
        values.flatMap(({ merchant }) =>
          merchant.kind === "resolved"
            ? [{
                key: merchant.id,
                label: labels.get(merchant.id) ?? merchant.id,
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
      const labels = canonicalLabelMap(
        await repository.loadEntityRows("places", "place_id", placeIds),
        ["place_id", "id"],
      );
      return uniqueGroups(
        placeIds.map((placeId) => ({
          key: placeId,
          label: labels.get(placeId) ?? placeId,
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
      const activityIds = values.map(({ activityId }) => activityId);
      const labels = canonicalLabelMap(
        await repository.loadLifeEventTypeRowsByTypeKeys(activityIds),
        ["type_key"],
      );
      return uniqueGroups(
        values.map(({ activityId }) => ({
          key: activityId,
          label: labels.get(activityId) ?? activityId,
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
        input.dependencies.repository,
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
  { view: "nature", dimension: "fixed_variable", measures: ["amount"] },
  { view: "life_context", dimension: "life_context", measures: ["amount"] },
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
  if (dimension === "fixed_variable" && measure === "amount") return "fixed_variable_amount";
  if (dimension === "life_context" && measure === "amount") return "life_scope_amount";
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
    case "fixed_variable":
    case "life_context":
    case "necessity": return id === "À déterminer" ? { kind: "undetermined" as const } : { kind: "canonical" as const, key: id };
  }
}

function structureDestination(dimension: AnalysisStructureDimension, id: string) {
  switch (dimension) {
    case "category": return { kind: "target" as const, target: { kind: "category" as const, categoryId: id as import("@/core/identity").CategoryId } };
    case "activity": return { kind: "target" as const, target: { kind: "activity" as const, activityId: id as import("@/core/identity").ActivityId } };
    case "merchant": return { kind: "merchant" as const, merchantId: id as import("@/core/identity").MerchantId };
    case "place": return { kind: "place" as const, placeId: id as import("@/core/identity").PlaceId };
    case "family": return undefined;
    case "fixed_variable":
    case "life_context":
    case "necessity": return undefined;
  }
}

function axisMetric(input: {
  readonly metricId: "category_amount" | "fixed_variable_amount" | "life_scope_amount";
  readonly scope: NormalizedAnalysisScope;
  readonly facts: readonly import("@/analytics/facts").EconomicComponentFact[];
}): ScopedMetricReadModel {
  const known = input.facts.filter(({ economicTiming }) => economicTiming.kind === "known" || economicTiming.kind === "partial");
  const uncertain = input.facts.length - known.length;
  const definition = getMetricRegistryEntry(input.metricId);
  const unavailable = input.facts.length > 0 && known.length === 0;
  return {
    metricId: definition.metricId,
    scopeHash: computeScopeHash(input.scope),
    envelope: {
      availability: unavailable ? "unknown" : "known",
      value: unavailable ? null : sumEconomicNetForScope(known, input.scope),
      unit: definition.unit,
      coverage: uncertain === 0 ? { level: "complete" } : { level: "partial" },
      support: parseSupport({
        n: known.length,
        eligibleN: input.facts.length,
        observableN: input.facts.length,
        excludedN: uncertain,
        unit: "transaction",
        level: known.length === 0 ? "insufficient" : "sufficient",
      }),
      provenance: definition.provenanceRule,
      methodVersion: definition.methodVersion,
    },
  } as ScopedMetricReadModel;
}

async function categoryStructure(input: {
  readonly scope: NormalizedAnalysisScope;
  readonly capabilities: import("@/query-api").QueryCapabilities;
  readonly dependencies: AnalysisDependencies;
}): Promise<AnalysisMonthStructureReadModel> {
  const facts = selectEconomicComponentsForScope(
    await input.dependencies.facts.loadEconomicFacts(input.scope),
    input.scope,
  );
  const ranked = partitionEconomicComponentsForStructure(facts, "category").map((partition) => ({
    key: partition.key,
    metric: axisMetric({ metricId: "category_amount", scope: input.scope, facts: partition.facts }),
  })).sort((left, right) => {
    const leftValue = metricMagnitude(left.metric);
    const rightValue = metricMagnitude(right.metric);
    if (leftValue === null) return rightValue === null ? left.key.localeCompare(right.key) : 1;
    if (rightValue === null) return -1;
    const comparison = rightValue.cmp(leftValue);
    return comparison !== 0 ? comparison : left.key.localeCompare(right.key);
  });
  const maximum = ranked.map(({ metric }) => metricMagnitude(metric)).filter((value): value is Big => value !== null)
    .reduce<Big | null>((current, value) => current === null || value.gt(current) ? value : current, null);
  const categoryKeys = ranked.map(({ key }) => key).filter((key) => key !== "À déterminer");
  const categoryLabels = canonicalLabelMap(
    await input.dependencies.repository.loadTaxonomyRows("categories", categoryKeys),
    ["id", "category_id"],
  );
  const rows = ranked.map(({ key, metric }, index) => {
    const magnitude = metricMagnitude(metric);
    const destination = key === "À déterminer" ? undefined : structureDestination("category", key);
    return {
      bucket: key === "À déterminer" ? { kind: "undetermined" as const } : { kind: "category" as const, categoryId: key as import("@/core/identity").CategoryId },
      label: key === "À déterminer" ? key : categoryLabels.get(key) ?? key,
      metric,
      rank: index + 1,
      ...(magnitude === null || maximum === null ? {} : { barPercent: maximum.eq(0) ? 0 : Number(magnitude.div(maximum).times(100).toFixed(2)) }),
      ...(destination === undefined ? {} : { destination }),
    };
  });
  const total = axisMetric({ metricId: "category_amount", scope: input.scope, facts });
  const exact = rows.every(({ metric }) => metric.envelope.availability === "known" && metric.envelope.coverage?.level === "complete") &&
    total.envelope.availability === "known" && total.envelope.coverage?.level === "complete";
  return {
    month: input.scope.time.kind === "month" ? input.scope.time.month : (() => { throw new TypeError("Structure exige Month."); })(),
    subject: input.scope.subject,
    activeView: "destination",
    activeDimension: "category",
    activeMeasure: "amount",
    availableViews: ["destination", "nature", "life_context"],
    availableDimensions: ["category", "activity", "merchant", "place"],
    availableMeasures: ["amount"],
    supportedCombinations: structureCombinations,
    unavailableDimensions: [{ dimension: "family", reason: "BLOCKED_CONTRACT" }, { dimension: "necessity", reason: "BLOCKED_CONTRACT" }],
    rows,
    total,
    reconciliation: exact ? "exact" : "partial",
    capabilities: input.capabilities,
  };
}

async function canonicalAxisStructure(input: {
  readonly axis: "fixed_variable" | "life_context";
  readonly scope: NormalizedAnalysisScope;
  readonly capabilities: import("@/query-api").QueryCapabilities;
  readonly dependencies: AnalysisDependencies;
}): Promise<AnalysisMonthStructureReadModel> {
  const facts = selectEconomicComponentsForScope(
    await input.dependencies.facts.loadEconomicFacts(input.scope),
    input.scope,
  );
  const metricId = input.axis === "fixed_variable" ? "fixed_variable_amount" : "life_scope_amount";
  const ranked = partitionEconomicComponentsForStructure(facts, input.axis).map((partition) => ({
    key: partition.key,
    metric: axisMetric({ metricId, scope: input.scope, facts: partition.facts }),
  })).sort((left, right) => {
    const leftValue = metricMagnitude(left.metric);
    const rightValue = metricMagnitude(right.metric);
    if (leftValue === null) return rightValue === null ? left.key.localeCompare(right.key) : 1;
    if (rightValue === null) return -1;
    const comparison = rightValue.cmp(leftValue);
    return comparison !== 0 ? comparison : left.key.localeCompare(right.key);
  });
  const maximum = ranked.map(({ metric }) => metricMagnitude(metric)).filter((value): value is Big => value !== null)
    .reduce<Big | null>((current, value) => current === null || value.gt(current) ? value : current, null);
  const rows = ranked.map(({ key, metric }, index) => {
    const magnitude = metricMagnitude(metric);
    return {
      bucket: key === "À déterminer" ? { kind: "undetermined" as const } : { kind: "canonical" as const, key },
      label: key,
      metric,
      rank: index + 1,
      ...(magnitude === null || maximum === null ? {} : { barPercent: maximum.eq(0) ? 0 : Number(magnitude.div(maximum).times(100).toFixed(2)) }),
    };
  });
  const total = axisMetric({ metricId, scope: input.scope, facts });
  const exact = rows.every(({ metric }) => metric.envelope.availability === "known" && metric.envelope.coverage?.level === "complete") &&
    total.envelope.availability === "known" && total.envelope.coverage?.level === "complete";
  const view = input.axis === "fixed_variable" ? "nature" as const : "life_context" as const;
  return {
    month: input.scope.time.kind === "month" ? input.scope.time.month : (() => { throw new TypeError("Structure exige Month."); })(),
    subject: input.scope.subject,
    activeView: view,
    activeDimension: input.axis,
    activeMeasure: "amount",
    availableViews: ["destination", "nature", "life_context"],
    availableDimensions: [input.axis],
    availableMeasures: ["amount"],
    supportedCombinations: structureCombinations,
    unavailableDimensions: [{ dimension: "family", reason: "BLOCKED_CONTRACT" }, { dimension: "necessity", reason: "BLOCKED_CONTRACT" }],
    rows,
    total,
    reconciliation: exact ? "exact" : "partial",
    capabilities: input.capabilities,
  };
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
  if (input.params.dimension === "fixed_variable" || input.params.dimension === "life_context") {
    return canonicalAxisStructure({
      axis: input.params.dimension,
      scope: input.scope,
      capabilities: input.capabilities,
      dependencies: input.dependencies,
    });
  }
  if (input.params.dimension === "category") {
    return categoryStructure({ scope: input.scope, capabilities: input.capabilities, dependencies: input.dependencies });
  }
  const metricId = structureMetricId(input.params.dimension, input.params.measure);
  if (metricId === null) throw new MetricProductionContractError("La mesure Structure n'est pas contractée.");
  const groups = await groupsForDimension(
    input.params.dimension as Exclude<AnalysisBreakdownDimension, "necessity" | "fixed_variable" | "life_scope" | "day_context">,
    input.scope,
    input.dependencies.facts,
    input.dependencies.repository,
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
    unavailableDimensions: [{ dimension: "family", reason: "BLOCKED_CONTRACT" }, { dimension: "necessity", reason: "BLOCKED_CONTRACT" }],
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

function recordLabel(record: CanonicalRecord, fallback: string): string {
  return optionalCanonicalString(record, ["title", "name", "label", "titre", "nom", "display_name"]) ?? fallback;
}

function unavailableCount(availability: "unknown" | "not_applicable" = "unknown"): CountMetricEnvelope {
  return { availability, value: null, unit: "count", provenance: "observed" };
}

function documentedGlobalMonths(
  scope: NormalizedAnalysisScope,
  context: AuthorizedRuntimeContext,
): number {
  if (scope.time.kind !== "global") return 0;
  const months = new Set(resolveGlobalWindowMonths(scope.time.observationWindow, scope.time.asOf));
  const documented = (status: string) => status === "complete" || status === "partial";
  return context.periods.filter((period) => {
    if (!period.isClosed || !months.has(yearMonthOf(period.month))) return false;
    if (!documented(period.financeStatus)) return false;
    if (scope.filters.activityIds.length > 0 && !documented(period.lifeStatus)) return false;
    if (scope.filters.placeIds.length > 0 && !documented(period.locationStatus)) return false;
    if (scope.filters.dayContext.length > 0 && !documented(period.calendarStatus)) return false;
    return true;
  }).length;
}

function selectedActivityOccurrences(
  facts: readonly import("@/analytics/facts").ActivityOccurrenceFact[],
  scope: NormalizedAnalysisScope,
) {
  return facts.filter((fact) =>
    (scope.subject.kind === "household" || fact.participantIds.includes(scope.subject.personId)) &&
    (scope.filters.activityIds.length === 0 || scope.filters.activityIds.includes(fact.activityId)),
  );
}

function selectedPlaceVisits(
  facts: readonly import("@/analytics/facts").PlaceVisitFact[],
  scope: NormalizedAnalysisScope,
) {
  return facts.filter((fact) =>
    (scope.subject.kind === "household" || fact.personId === scope.subject.personId) &&
    (scope.filters.placeIds.length === 0 || scope.filters.placeIds.includes(fact.placeId)),
  );
}

function momentRowsInScope(
  rows: readonly CanonicalRecord[],
  scope: NormalizedAnalysisScope,
  eligibleMomentIds: ReadonlySet<string> | null,
  participantsByMoment: ReadonlyMap<string, readonly { readonly personId: string }[]>,
): readonly CanonicalRecord[] {
  if (scope.time.kind !== "global") return [];
  const months = resolveGlobalWindowMonths(scope.time.observationWindow, scope.time.asOf);
  const start = `${months[0]}-01`;
  const endExclusive = `${addMonths(months[months.length - 1], 1)}-01`;
  return rows.filter((row) => {
    const momentId = optionalCanonicalString(row, ["moment_id"]);
    const rawStart = optionalCanonicalString(row, ["start_date", "starts_on"]);
    const rawEnd = optionalCanonicalString(row, ["end_date", "ends_on"]) ?? rawStart;
    if (momentId === undefined || rawStart === undefined || rawEnd === undefined) return false;
    if (rawStart >= endExclusive || rawEnd < start) return false;
    if (eligibleMomentIds !== null && !eligibleMomentIds.has(momentId)) return false;
    const participants = (participantsByMoment.get(momentId) ?? []).map(({ personId }) => personId);
    return scope.subject.kind === "household" || participants.includes(scope.subject.personId);
  });
}

async function scopedMomentRows(
  scope: NormalizedAnalysisScope,
  dependencies: AnalysisDependencies,
): Promise<readonly CanonicalRecord[]> {
  const rows = await dependencies.repository.loadEntityRows("moments", "moment_id");
  const momentIds = rows.flatMap((row) => {
    const id = optionalCanonicalString(row, ["moment_id"]);
    return id === undefined ? [] : [id];
  });
  const participantsByMoment = await loadMomentParticipantsByMomentId({
    repository: dependencies.repository,
    context: dependencies.context,
    momentIds,
  });
  const hasEconomicFilters = scope.filters.categoryIds.length > 0 ||
    scope.filters.activityIds.length > 0 || scope.filters.merchantIds.length > 0 ||
    scope.filters.placeIds.length > 0 || scope.filters.lifeScopeContext.length > 0;
  const eligibleMomentIds = hasEconomicFilters
    ? new Set(selectEconomicComponentsForScope(await dependencies.facts.loadEconomicFacts(scope), scope)
        .flatMap(({ moment }) => moment.kind === "resolved" ? [moment.id as string] : []))
    : null;
  return momentRowsInScope(rows, scope, eligibleMomentIds, participantsByMoment);
}

async function globalOperationsCount(
  scope: NormalizedAnalysisScope,
  dependencies: AnalysisDependencies,
): Promise<CountMetricEnvelope> {
  if (scope.subject.kind === "person" || scope.filters.activityIds.length > 0 || scope.filters.dayContext.length > 0) {
    return unavailableCount();
  }
  const bundle = await dependencies.repository.loadOperationBundle(canonicalRangeForScope(scope));
  const hasEconomicFilters = scope.filters.categoryIds.length > 0 || scope.filters.merchantIds.length > 0 ||
    scope.filters.placeIds.length > 0 || scope.filters.lifeScopeContext.length > 0;
  if (!hasEconomicFilters) return countEnvelope(bundle.operations.length);
  const selected = selectEconomicComponentsForScope(bundle.economicFacts, scope);
  return countEnvelope(new Set(selected.flatMap(({ sourceOperation }) =>
    sourceOperation.kind === "resolved" ? [sourceOperation.id] : [],
  )).size);
}

function median(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
}

async function globalTypicalBehaviorRows(
  scope: NormalizedAnalysisScope,
  dependencies: AnalysisDependencies,
) {
  if (scope.time.kind !== "global") return [];
  const allowedMonths = new Set(resolveGlobalWindowMonths(scope.time.observationWindow, scope.time.asOf));
  const observableMonths = dependencies.context.periods
    .filter(({ month, lifeStatus, isClosed }) => isClosed && lifeStatus === "complete" && allowedMonths.has(yearMonthOf(month)))
    .map(({ month }) => yearMonthOf(month))
    .sort();
  const occurrences = selectedActivityOccurrences(await dependencies.facts.loadActivityOccurrences(scope), scope);
  const activityIds = [...new Set(occurrences.map(({ activityId }) => activityId))].sort();
  const activityLabels = canonicalLabelMap(
    await dependencies.repository.loadLifeEventTypeRowsByTypeKeys(activityIds),
    ["type_key"],
  );
  return activityIds.map((activityId) => {
    const counts = observableMonths.map((month) => occurrences.filter((fact) => fact.activityId === activityId && yearMonthOf(fact.startDate) === month).length);
    const activePeriodCount = counts.filter((value) => value > 0).length;
    const support = supportForPolicy("typical_month", observableMonths.length, {
      eligibleN: observableMonths.length,
      observableN: observableMonths.length,
    });
    return {
      activityId,
      label: activityLabels.get(activityId) ?? activityId,
      activePeriodCount,
      observablePeriodCount: observableMonths.length,
      activityRate: observableMonths.length === 0 ? null : activePeriodCount / observableMonths.length,
      habitualFrequency: support.level === "sufficient" ? median(counts) : null,
      support,
      variability: { status: "unavailable" as const, reason: "missing_contract" as const },
      destination: { kind: "target" as const, target: { kind: "activity" as const, activityId } },
    };
  }).sort((left, right) => right.activePeriodCount - left.activePeriodCount || left.activityId.localeCompare(right.activityId));
}

function rankedRef<Id extends string>(
  values: readonly Id[],
  unit: import("@/core/metrics").SupportUnit,
  label?: (id: Id) => string,
) {
  const counts = new Map<Id, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  const winner = [...counts.entries()].sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))[0];
  if (winner === undefined) return undefined;
  return {
    id: winner[0],
    label: label?.(winner[0]) ?? winner[0],
    count: winner[1],
    support: parseSupport({ n: winner[1], unit, level: winner[1] >= 5 ? "sufficient" : winner[1] >= 2 ? "limited" : "insufficient" }),
  };
}

function profileScope(scope: NormalizedAnalysisScope, target: PersonaTarget): NormalizedAnalysisScope {
  return { ...scope, subject: target.kind === "person" ? { kind: "person", personId: target.personId } : { kind: "household" } };
}

function comparisonCandidate(input: {
  readonly id: string;
  readonly kind: "total" | "category";
  readonly phenomenonKey: string;
  readonly evidenceKeys: readonly string[];
  readonly comparison: MoneyComparisonResult;
}): MarkedFactCandidate | null {
  const absolute = input.comparison.absoluteDelta;
  const relative = input.comparison.relativeDelta;
  if (!absolute.publishable || !relative.publishable || absolute.value === null || relative.value === null) return null;
  const relativeValue = new Big(relative.value.numerator).div(relative.value.denominator).toFixed();
  return {
    id: input.id,
    kind: input.kind,
    absoluteDelta: absolute.value,
    relativeDelta: relativeValue,
    supportLevel: input.comparison.comparisonSupport?.level,
    phenomenonKey: input.phenomenonKey,
    evidenceKeys: input.evidenceKeys,
  };
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
  | "readAnalysisGlobalBaseline"
  | "readAnalysisGlobalTypical"
  | "readAnalysisGlobalBreakdown"
  | "readAnalysisGlobalEvolution"
  | "readAnalysisGlobalContexts"
  | "readAnalysisGlobalHabits"
  | "readAnalysisGlobalProfiles"
  | "readAnalysisGlobalUniverse"
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
      const minimal = await dependencies.metrics.produce("minimal_month_cost", request.scope);
      const typicalVsMinimal = typical?.envelope.availability === "known" && minimal.envelope.availability === "known"
        ? compareMoneyMetrics({
            capabilityId: "typical_vs_minimal",
            target: {
              metricId: typical.metricId,
              semantic: "typical_month",
              scopeHash: typical.scopeHash,
              envelope: typical.envelope as import("@/core/metrics").MetricEnvelope<import("@/core/money").Money, import("@/core/money").MonetaryMetricUnit>,
            },
            reference: {
              metricId: minimal.metricId,
              semantic: "minimal",
              scopeHash: minimal.scopeHash,
              envelope: minimal.envelope as import("@/core/metrics").MetricEnvelope<import("@/core/money").Money, import("@/core/money").MonetaryMetricUnit>,
            },
            referenceAuthorization: { kind: "same_period" },
          })
        : undefined;
      const categoryGroups = context.capabilities.availableMeasures.includes("category_amount")
        ? await groupsForDimension("category", request.scope, dependencies.facts, dependencies.repository)
        : [];
      const categoryBundles = await Promise.all(categoryGroups.map(async (group) => ({
        group,
        bundle: await dependencies.metrics.produceActualWithTypical(group.scope),
      })));
      const projected = new Map<string, {
        readonly title: string;
        readonly kind: "category" | "structure";
        readonly current: ScopedMetricReadModel;
        readonly reference: ScopedMetricReadModel;
        readonly comparison: MoneyComparisonResult;
        readonly destination?: import("@/query-api").AnalysisDestination;
      }>();
      projected.set("total", {
        title: "Le total du mois s’écarte de la référence",
        kind: "structure",
        current: bundle.actual,
        reference: bundle.typical,
        comparison: bundle.comparison,
      });
      for (const { group, bundle: categoryBundle } of categoryBundles) {
        projected.set(`category:${group.key}`, {
          title: `Catégorie ${group.label}`,
          kind: "category",
          current: categoryBundle.actual,
          reference: categoryBundle.typical,
          comparison: categoryBundle.comparison,
          destination: { kind: "target", target: { kind: "category", categoryId: group.key as import("@/core/identity").CategoryId } },
        });
      }
      const candidates = [
        comparisonCandidate({
          id: "total",
          kind: "total",
          phenomenonKey: "monthly-economic-total",
          evidenceKeys: ["economic-total"],
          comparison: bundle.comparison,
        }),
        ...categoryBundles.map(({ group, bundle: categoryBundle }) => comparisonCandidate({
          id: `category:${group.key}`,
          kind: "category",
          phenomenonKey: `category:${group.key}`,
          evidenceKeys: [`category:${group.key}`],
          comparison: categoryBundle.comparison,
        })),
      ].filter((candidate): candidate is MarkedFactCandidate => candidate !== null);
      const selected = selectMarkedFacts(candidates);
      const hasComparableEvidence = [
        bundle.comparison,
        ...categoryBundles.map(({ bundle: categoryBundle }) => categoryBundle.comparison),
      ].some(({ relation }) => relation !== "not_comparable");
      return {
        month: request.scope.time.month,
        subject: request.scope.subject,
        periodCompleteness: periodCompleteness(
          dependencies.context,
          request.scope.time.month,
        ),
        actual: bundle.actual as never,
        ...(typical === undefined ? {} : { typical: typical as never, actualVsTypical: bundle.comparison }),
        minimal: minimal as never,
        ...(typicalVsMinimal === undefined ? {} : { typicalVsMinimal }),
        markedFacts: selected.map((selection) => {
          const value = projected.get(selection.id)!;
          const delta = value.comparison.absoluteDelta;
          const deltaValue = delta.publishable ? delta.value : null;
          return {
            id: selection.id,
            kind: value.kind,
            title: value.title,
            description: deltaValue !== null
              ? `${value.comparison.relation === "above" ? "Au-dessus" : value.comparison.relation === "below" ? "En dessous" : "Au niveau"} de la référence de ${new Big(deltaValue).abs().toFixed(2)} €.`
              : undefined,
            primaryMetric: value.current,
            secondaryMetric: value.reference,
            comparison: value.comparison,
            qualification: selection.qualification,
            evidence: [{ kind: "comparison", targetMetricId: value.current.metricId, referenceMetricId: value.reference.metricId }],
            ...(value.destination === undefined ? {} : { destination: value.destination }),
          };
        }),
        markedFactsSelection: hasComparableEvidence
          ? {
              kind: "available" as const,
              methodVersion: MARKED_FACTS_METHOD_VERSION,
            }
          : {
              kind: "unavailable" as const,
              reason: "insufficient_data" as const,
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
        dependencies.repository,
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
        ? await groupsForDimension("activity", request.scope, dependencies.facts, dependencies.repository)
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
      const canReadFrequencyCost = context.capabilities.availableMeasures.includes("activity_causal_median_cost_per_occurrence") &&
        context.capabilities.availableMeasures.includes("activity_causal_cost");
      const frequencyCostPoints = canReadFrequencyCost
        ? await Promise.all(activityGroups.map(async (group) => {
            const [occurrences, medianCausalCostPerOccurrence, totalCausalCost] = await Promise.all([
              dependencies.metrics.produce("activity_frequency", group.scope),
              dependencies.metrics.produce("activity_causal_median_cost_per_occurrence", group.scope),
              dependencies.metrics.produce("activity_causal_cost", group.scope),
            ]);
            const activityId = group.key as import("@/core/identity").ActivityId;
            return {
              activityId,
              label: group.label,
              occurrences: occurrences as import("@/query-api").ScopedCountMetricReadModel,
              medianCausalCostPerOccurrence: medianCausalCostPerOccurrence as import("@/query-api").ScopedMoneyMetricReadModel,
              totalCausalCost: totalCausalCost as import("@/query-api").ScopedMoneyMetricReadModel,
              destination: { kind: "target" as const, target: { kind: "activity" as const, activityId } },
            };
          }))
        : [];
      const availableSubviews = [
        "summary" as const,
        ...(activities.length === 0 ? [] : ["rhythm" as const]),
        ...(sections.length === 0 ? [] : ["contexts" as const]),
        ...(frequencyCostPoints.length === 0 ? [] : ["frequency_cost" as const]),
      ];
      return {
        month: request.scope.time.month,
        subject: request.scope.subject,
        availableSubviews,
        activities,
        contexts: { sections, capabilities: context.capabilities },
        frequencyCost: canReadFrequencyCost
          ? { kind: "available" as const, points: frequencyCostPoints }
          : { kind: "unavailable" as const, reason: "causal_mapping_unavailable" as const },
        capabilities: context.capabilities,
      };
    },

    async readAnalysisMonthMoments({ request, context }) {
      if (request.scope.time.kind !== "month") throw new TypeError("Analysis Month Moments exige un scope month.");
      const rows = await dependencies.repository.loadEntityRows("moments", "moment_id");
      const momentIds = rows.flatMap((row) => {
        const id = optionalCanonicalString(row, ["moment_id"]);
        return id === undefined ? [] : [id];
      });
      const participantsByMoment = await loadMomentParticipantsByMomentId({
        repository: dependencies.repository,
        context: dependencies.context,
        momentIds,
      });
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
        const participantIds = (participantsByMoment.get(momentId) ?? []).map(({ personId }) => personId);
        if (request.scope.subject.kind === "person" && !participantIds.includes(request.scope.subject.personId)) return [];
        const participants = participantsByMoment.get(momentId) ?? [];
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
      const target = request.params.target;
      if (target.kind === "family") {
        return { time: request.scope.time, subject: request.scope.subject, target, status: "blocked_contract" as const, headlineMetrics: [], capabilities: context.capabilities };
      }
      const outsideScope = target.kind === "category"
        ? request.scope.filters.categoryIds.length > 0 && !request.scope.filters.categoryIds.includes(target.categoryId)
        : target.kind === "activity"
          ? request.scope.filters.activityIds.length > 0 && !request.scope.filters.activityIds.includes(target.activityId)
          : request.scope.filters.lifeScopeContext.length > 0 && !request.scope.filters.lifeScopeContext.includes(target.context);
      if (outsideScope) {
        return { time: request.scope.time, subject: request.scope.subject, target, status: "outside_scope" as const, headlineMetrics: [], capabilities: context.capabilities };
      }
      const targetScope = target.kind === "category"
        ? { ...request.scope, filters: { ...request.scope.filters, categoryIds: [target.categoryId] } }
        : target.kind === "activity"
          ? { ...request.scope, filters: { ...request.scope.filters, activityIds: [target.activityId] } }
          : { ...request.scope, filters: { ...request.scope.filters, lifeScopeContext: [target.context] } };
      const metricId = target.kind === "category"
        ? "category_amount"
        : target.kind === "activity"
          ? request.scope.time.kind === "global"
            ? "activity_causal_cost"
            : "activity_frequency"
          : "life_scope_amount";
      const metric = await dependencies.metrics.produce(metricId, targetScope);
      return {
        time: request.scope.time,
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
      const [activityFacts, placeFacts, moments, operationsCount, economic] = await Promise.all([
        dependencies.facts.loadActivityOccurrences(request.scope),
        dependencies.facts.loadPlaceVisits(request.scope),
        scopedMomentRows(request.scope, dependencies),
        globalOperationsCount(request.scope, dependencies),
        dependencies.metrics.produce("economic_consumption_net_attributable", request.scope),
      ]);
      const activityCountRepresentable = request.scope.filters.categoryIds.length === 0 &&
        request.scope.filters.merchantIds.length === 0 && request.scope.filters.placeIds.length === 0 &&
        request.scope.filters.lifeScopeContext.length === 0 && request.scope.filters.dayContext.length === 0;
      const placeCountRepresentable = request.scope.filters.categoryIds.length === 0 &&
        request.scope.filters.activityIds.length === 0 && request.scope.filters.merchantIds.length === 0 &&
        request.scope.filters.lifeScopeContext.length === 0 && request.scope.filters.dayContext.length === 0;
      return {
        observationWindow: request.scope.time.observationWindow,
        asOf: request.scope.time.asOf,
        subject: request.scope.subject,
        documentedMonths: countEnvelope(documentedGlobalMonths(request.scope, dependencies.context)),
        documentedActivities: activityCountRepresentable
          ? countEnvelope(new Set(selectedActivityOccurrences(activityFacts, request.scope).map(({ activityId }) => activityId)).size)
          : unavailableCount(),
        momentsCount: request.scope.filters.dayContext.length === 0 ? countEnvelope(moments.length) : unavailableCount(),
        observedPlacesCount: placeCountRepresentable
          ? countEnvelope(new Set(selectedPlaceVisits(placeFacts, request.scope).map(({ placeId }) => placeId)).size)
          : unavailableCount(),
        operationsCount,
        economicConsumptionNetAttributable: economic as import("@/query-api").ScopedMoneyMetricReadModel,
        capabilities: context.capabilities,
      };
    },

    async readAnalysisGlobalBaseline({ request, context }) {
      if (request.scope.time.kind !== "global") throw new TypeError("Analysis Global Baseline exige un scope global.");
      const minimal = await dependencies.metrics.produce("minimal_month_cost", {
        ...request.scope,
        time: { kind: "month", month: request.scope.time.asOf },
      });
      const missingSource = { status: "unavailable" as const, reason: "missing_source" as const };
      return {
        observationWindow: request.scope.time.observationWindow,
        asOf: request.scope.time.asOf,
        subject: request.scope.subject,
        defaultView: "month" as const,
        day: { neutral: missingSource, typical: missingSource },
        week: { neutral: missingSource, calendarAdjustedNeutral: missingSource },
        month: {
          minimal: minimal.envelope.availability === "known"
            ? { status: "available" as const, metric: minimal as import("@/query-api").ScopedMoneyMetricReadModel }
            : { status: "unavailable" as const, reason: "blocked_data" as const },
          calendarAdjustedNeutral: missingSource,
        },
        capabilities: context.capabilities,
      };
    },

    async readAnalysisGlobalTypical({ request, context }) {
      if (request.scope.time.kind !== "global") throw new TypeError("Analysis Global Typical exige un scope global.");
      const monthlyTypical = request.scope.subject.kind === "person"
        ? { status: "unavailable" as const, reason: "missing_source" as const }
        : {
            status: "available" as const,
            metric: await dependencies.metrics.produce("typical_month_cost", {
              ...request.scope,
              time: { kind: "month", month: request.scope.time.asOf },
            }) as import("@/query-api").ScopedMoneyMetricReadModel,
          };
      return {
        observationWindow: request.scope.time.observationWindow,
        asOf: request.scope.time.asOf,
        subject: request.scope.subject,
        monthlyTypical,
        behaviorRows: await globalTypicalBehaviorRows(request.scope, dependencies),
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
        dependencies.repository,
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
      const metricId = request.params.view === "money"
        ? "economic_consumption_net_attributable" as const
        : "activity_frequency" as const;
      const points = request.params.view === "money" && request.scope.subject.kind === "household"
        ? await Promise.all(periods.map(async (period) => {
            const point = await economicEvolutionPoint(period, request.scope, dependencies);
            return {
              period: point.period,
              metric: point.metric,
              ...(point.comparison === undefined ? {} : { comparison: point.comparison }),
              periodCompleteness: point.periodCompleteness,
            };
          }))
        : await evolutionPoints({ periods, scope: request.scope, metricId, dependencies });
      return {
        observationWindow: request.scope.time.observationWindow,
        asOf: request.scope.time.asOf,
        subject: request.scope.subject,
        view: request.params.view,
        series: [{
          seriesId: request.params.view === "money" ? "economic_total" : "activity_occurrences",
          label: request.params.view === "money" ? "Total économique net" : "Occurrences d’activité",
          metricId,
          unit: getMetricRegistryEntry(metricId).unit,
          points,
        }],
        smallMultiplesRecommended: false,
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

    async readAnalysisGlobalHabits({ request, context }) {
      if (request.scope.time.kind !== "global") throw new TypeError("Analysis Global Habits exige un scope global.");
      const availableViews = ["contexts", "heatmap"] as const;
      let content: import("@/query-api").AnalysisGlobalHabitsReadModel["content"];
      if (request.params.view === "contexts") {
        content = {
          kind: "contexts",
          contexts: {
            sections: await contextSections({
              scope: request.scope,
              availableMeasures: context.capabilities.availableMeasures.filter((metricId) => metricId !== "activity_frequency"),
              dependencies,
            }),
            capabilities: context.capabilities,
          },
        };
      } else if (request.params.view === "heatmap") {
        const columns = resolveGlobalWindowMonths(request.scope.time.observationWindow, request.scope.time.asOf);
        const occurrences = selectedActivityOccurrences(await dependencies.facts.loadActivityOccurrences(request.scope), request.scope);
        const activityIds = [...new Set(occurrences.map(({ activityId }) => activityId))]
          .sort()
          .slice(0, 12);
        const activityLabels = canonicalLabelMap(
          await dependencies.repository.loadLifeEventTypeRowsByTypeKeys(activityIds),
          ["type_key"],
        );
        const rows = activityIds.map((activityId) => ({
          id: activityId,
          label: activityLabels.get(activityId) ?? activityId,
        }));
        content = {
          kind: "heatmap",
          heatmap: {
            contract: "activity_month_frequency",
            unit: "count/month",
            palette: "sequential",
            rows,
            columns,
            cells: rows.flatMap(({ id }) => columns.map((columnId) => {
              const observable = dependencies.context.periods.some(({ month, lifeStatus, isClosed }) =>
                yearMonthOf(month) === columnId && isClosed && lifeStatus === "complete",
              );
              return observable
                ? { rowId: id, columnId, state: "known" as const, value: occurrences.filter((fact) => fact.activityId === id && yearMonthOf(fact.startDate) === columnId).length }
                : { rowId: id, columnId, state: "unknown" as const, value: null };
            })),
          },
        };
      } else {
        content = { kind: "unavailable", reason: "missing_method_or_source" };
      }
      return {
        observationWindow: request.scope.time.observationWindow,
        asOf: request.scope.time.asOf,
        subject: request.scope.subject,
        view: request.params.view,
        availableViews,
        content,
        capabilities: context.capabilities,
      };
    },

    async readAnalysisGlobalProfiles({ request, context }) {
      if (request.scope.time.kind !== "global") throw new TypeError("Analysis Global Profiles exige un scope global.");
      const target = request.params.target;
      const person = target.kind === "person" ? dependencies.repository.authorizedPerson(target.personId) : null;
      if (target.kind === "person" && person === null) throw new TypeError("La personne du profil est hors du Household autorisé.");
      const scoped = profileScope(request.scope, target);
      const [activityFacts, placeFacts, economicFacts] = await Promise.all([
        dependencies.facts.loadActivityOccurrences(scoped),
        dependencies.facts.loadPlaceVisits(scoped),
        dependencies.facts.loadEconomicFacts(scoped),
      ]);
      const activities = selectedActivityOccurrences(activityFacts, scoped);
      const places = selectedPlaceVisits(placeFacts, scoped);
      const economics = selectEconomicComponentsForScope(economicFacts, scoped);
      const dominantActivity = rankedRef(activities.map(({ activityId }) => activityId), "occurrence");
      const frequentPlace = rankedRef(places.map(({ placeId }) => placeId), "place_visit");
      const dominantContext = rankedRef(economics.flatMap(({ lifeScope }) => lifeScope.kind === "resolved" ? [lifeScope.value] : []), "transaction");
      return {
        observationWindow: request.scope.time.observationWindow,
        asOf: request.scope.time.asOf,
        subject: request.scope.subject,
        target,
        label: target.kind === "person" ? recordLabel(person!, target.personId) : "Ensemble du foyer",
        ...(dominantActivity === undefined ? {} : { dominantActivity }),
        ...(frequentPlace === undefined ? {} : { frequentPlace }),
        ...(dominantContext === undefined ? {} : { dominantContext }),
        destination: { kind: "persona" as const, target },
        capabilities: context.capabilities,
      };
    },

    async readAnalysisGlobalUniverse({ request, context }) {
      if (request.scope.time.kind !== "global") throw new TypeError("Analysis Global Universe exige un scope global.");
      const gallery = createGalleryQuerySources(dependencies);
      const [moments, places, merchants] = await Promise.all([
        gallery.readGalleryMoments({
          request: { resource: queryResourceKeys.galleryMoments, scope: request.scope, scopeHash: request.scopeHash, params: parseGalleryMomentsParams({ sort: { key: "recent", direction: "desc" }, limit: 4 }) },
          context,
        }),
        gallery.readGalleryPlaces({
          request: { resource: queryResourceKeys.galleryPlaces, scope: request.scope, scopeHash: request.scopeHash, params: parseGalleryPlacesParams({ sort: { key: "frequent", direction: "desc" }, limit: 6 }) },
          context,
        }),
        gallery.readGalleryMerchants({
          request: { resource: queryResourceKeys.galleryMerchants, scope: request.scope, scopeHash: request.scopeHash, params: parseGalleryMerchantsParams({ sort: { key: "spent", direction: "desc" }, limit: 6 }) },
          context,
        }),
      ]);
      return {
        observationWindow: request.scope.time.observationWindow,
        asOf: request.scope.time.asOf,
        subject: request.scope.subject,
        moments: { sort: "recent" as const, items: moments.page.items, hasMore: moments.page.pageInfo.hasMore },
        places: { sort: "frequent" as const, items: places.page.items, hasMore: places.page.pageInfo.hasMore },
        merchants: { sort: "spent" as const, items: merchants.page.items, hasMore: merchants.page.pageInfo.hasMore },
        capabilities: context.capabilities,
      };
    },
  };
}
