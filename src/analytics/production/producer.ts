import {
  computeScopeHash,
  normalizeAnalysisScope,
  type NormalizedAnalysisScope,
  type ScopeHash,
} from "../../core/scope";
import {
  createAggregationPlan,
  type AnalyticFilterDimension,
} from "../aggregation";
import {
  countActivityOccurrences,
  countDistinctVisitDays,
  countPlaceVisits,
  countPersonDays,
  countPurchaseEvents,
  medianKnownActivityCausalCost,
} from "../facts";
import type { ActivityOccurrenceCostFact } from "../facts";
import {
  createContextAnalysisPlan,
  sumEconomicNetForScope,
} from "../context";
import {
  calculateFuelTripEstimate,
  type EstimationTrace,
} from "../provenance";
import { calculateTypicalMonthCost } from "../references";
import { calculateMinimalMonthCost } from "../baseline";
import { supportForPolicy } from "../support";
import { addMoney, parseMoney } from "../../core/money";
import {
  MetricComputationError,
  MetricProductionContractError,
  metricProductionErrorToApiError,
} from "./errors";
import { getMetricRegistryEntry } from "./registry";
import type {
  MetricProductionOutcome,
  MetricProductionRequest,
  MetricProductionSource,
  MetricRegistryEntry,
  ProducedMetric,
} from "./types";
import { validateProducedMetric } from "./validation";

const scopeFilterDimensions = [
  ["categoryIds", "category"],
  ["activityIds", "activity"],
  ["merchantIds", "merchant"],
  ["placeIds", "place"],
  ["lifeScopeContext", "life_scope_context"],
  ["dayContext", "day_context"],
] as const satisfies readonly (readonly [
  keyof NormalizedAnalysisScope["filters"],
  AnalyticFilterDimension,
])[];

function isApplicable(
  definition: MetricRegistryEntry,
  scope: NormalizedAnalysisScope,
): boolean {
  if (!definition.allowedTimeKinds.includes(scope.time.kind)) return false;
  for (const [property, dimension] of scopeFilterDimensions) {
    if (
      scope.filters[property].length > 0 &&
      !definition.allowedFilters.includes(dimension)
    ) {
      return false;
    }
  }
  if (
    definition.availabilityRules.includes("required_place_filter") &&
    scope.filters.placeIds.length !== 1
  ) {
    return false;
  }
  if (
    definition.availabilityRules.includes("required_category_filter") &&
    scope.filters.categoryIds.length === 0
  ) {
    return false;
  }
  if (
    definition.availabilityRules.includes("required_merchant_filter") &&
    scope.filters.merchantIds.length === 0
  ) {
    return false;
  }
  if (
    definition.availabilityRules.includes("required_life_scope_filter") &&
    scope.filters.lifeScopeContext.length === 0
  ) {
    return false;
  }
  return true;
}

function expectedSourceKind(
  definition: MetricRegistryEntry,
): MetricProductionSource["kind"] {
  switch (definition.productionStrategy) {
    case "sum_economic_net":
    case "localized_spend":
      return "economic_components";
    case "typical_month":
      return "typical_month";
    case "minimal_month":
      return "minimal_month";
    case "count_purchase_events":
      return "purchase_events";
    case "count_person_days":
      return "person_days";
    case "count_place_visits":
    case "count_distinct_visit_days":
      return "place_visits";
    case "count_activity_occurrences":
      return "activity_occurrences";
    case "sum_activity_causal_cost":
    case "median_activity_causal_cost":
      return "activity_occurrence_costs";
    case "fuel_trip_estimate":
      return "fuel_trip_estimate";
  }
}

function assertSource(
  definition: MetricRegistryEntry,
  source: MetricProductionSource,
  scopeHash: ScopeHash,
): void {
  if (source.kind !== expectedSourceKind(definition)) {
    throw new MetricProductionContractError(
      "La source ne correspond pas à la stratégie du Metric Registry.",
    );
  }
  if (source.scopeHash !== scopeHash) {
    throw new MetricProductionContractError(
      "La sélection de faits ne correspond pas au normalized scope.",
    );
  }
}

function metricFromBusinessAvailability(input: {
  readonly definition: MetricRegistryEntry;
  readonly scopeHash: ScopeHash;
  readonly source: Extract<
    MetricProductionSource,
    { readonly availability: Exclude<import("../../core/metrics").Availability, "known"> }
  >;
}): ProducedMetric {
  return validateProducedMetric({
    metricId: input.definition.metricId,
    scopeHash: input.scopeHash,
    availability: input.source.availability,
    value: null,
    unit: input.definition.unit,
    provenance: input.definition.provenanceRule,
    methodVersion: input.definition.methodVersion,
    ...(input.source.coverage === undefined
      ? {}
      : { coverage: input.source.coverage }),
    ...(input.source.support === undefined
      ? {}
      : { support: input.source.support }),
  } as ProducedMetric);
}

function notApplicableMetric(
  definition: MetricRegistryEntry,
  scopeHash: ScopeHash,
): ProducedMetric {
  return validateProducedMetric({
    metricId: definition.metricId,
    scopeHash,
    availability: "not_applicable",
    value: null,
    unit: definition.unit,
    provenance: definition.provenanceRule,
    methodVersion: definition.methodVersion,
  } as ProducedMetric);
}

function observedMetric(input: {
  readonly definition: MetricRegistryEntry;
  readonly scopeHash: ScopeHash;
  readonly value: import("../../core/money").Money | number;
  readonly source: Extract<MetricProductionSource, { readonly availability: "known"; readonly facts: readonly unknown[] }>;
}): ProducedMetric {
  return validateProducedMetric({
    metricId: input.definition.metricId,
    scopeHash: input.scopeHash,
    availability: "known",
    value: input.value,
    unit: input.definition.unit,
    provenance: input.definition.provenanceRule,
    methodVersion: input.definition.methodVersion,
    ...(input.source.coverage === undefined
      ? {}
      : { coverage: input.source.coverage }),
    ...(input.source.support === undefined
      ? {}
      : { support: input.source.support }),
  } as ProducedMetric);
}

function assertRegisteredPlans(
  definition: MetricRegistryEntry,
  scope: MetricProductionRequest["scope"],
): void {
  if (definition.aggregationCapabilityId !== undefined) {
    createAggregationPlan(scope, definition.aggregationCapabilityId);
  }
  if (definition.contextCapabilityId !== undefined) {
    const plan = createContextAnalysisPlan(
      scope,
      definition.contextCapabilityId,
    );
    if (plan.status.kind !== "available") {
      throw new MetricProductionContractError(
        "Une métrique active ne peut pas utiliser une capability deferred.",
      );
    }
  }
}

function produceKnownFactMetric(input: {
  readonly definition: MetricRegistryEntry;
  readonly request: MetricProductionRequest;
  readonly normalizedScope: NormalizedAnalysisScope;
  readonly scopeHash: ScopeHash;
  readonly source: Extract<MetricProductionSource, { readonly availability: "known"; readonly facts: readonly unknown[] }>;
}): ProducedMetric {
  assertRegisteredPlans(input.definition, input.request.scope);
  switch (input.definition.productionStrategy) {
    case "sum_economic_net":
      return observedMetric({
        ...input,
        value: sumEconomicNetForScope(
          input.source.facts,
          input.normalizedScope,
        ),
      });
    case "localized_spend": {
      return observedMetric({
        ...input,
        value: sumEconomicNetForScope(
          input.source.facts,
          input.normalizedScope,
        ),
      });
    }
    case "count_purchase_events":
      return observedMetric({
        ...input,
        value: countPurchaseEvents(input.source.facts),
      });
    case "count_person_days":
      return observedMetric({
        ...input,
        value: countPersonDays(input.source.facts),
      });
    case "count_place_visits":
      return observedMetric({
        ...input,
        value: countPlaceVisits(input.source.facts),
      });
    case "count_distinct_visit_days":
      return observedMetric({
        ...input,
        value: countDistinctVisitDays(input.source.facts),
      });
    case "count_activity_occurrences":
      return observedMetric({
        ...input,
        value: countActivityOccurrences(input.source.facts),
      });
    case "typical_month":
    case "minimal_month":
    case "sum_activity_causal_cost":
    case "median_activity_causal_cost":
    case "fuel_trip_estimate":
      throw new MetricProductionContractError(
        "La stratégie enregistrée n’utilise pas une source de faits.",
      );
  }
}

function produceActivityCausalMetric(input: {
  readonly definition: MetricRegistryEntry;
  readonly source: Extract<MetricProductionSource, { readonly kind: "activity_occurrence_costs"; readonly availability: "known" }>;
  readonly scopeHash: ScopeHash;
}): ProducedMetric {
  const facts = input.source.facts as readonly ActivityOccurrenceCostFact[];
  const known = facts.filter(({ causalCost }) => causalCost.availability === "known");
  const support = supportForPolicy("activity_causal_cost", known.length, {
    eligibleN: facts.length,
    observableN: facts.length,
    excludedN: facts.length - known.length,
  });
  const coverage = known.length === facts.length
    ? { level: "complete" as const }
    : { level: "partial" as const };
  if (input.definition.productionStrategy === "sum_activity_causal_cost") {
    const value = known.reduce(
      (sum, fact) => addMoney(sum, fact.causalCost.availability === "known" ? fact.causalCost.value : parseMoney("0")),
      parseMoney("0"),
    );
    return validateProducedMetric({
      metricId: input.definition.metricId,
      scopeHash: input.scopeHash,
      availability: known.length === 0 && facts.length > 0 ? "unknown" : "known",
      value: known.length === 0 && facts.length > 0 ? null : value,
      unit: input.definition.unit,
      provenance: input.definition.provenanceRule,
      methodVersion: input.definition.methodVersion,
      support,
      coverage,
    } as ProducedMetric);
  }
  const median = medianKnownActivityCausalCost(facts);
  const available = median !== null && known.length >= 5;
  return validateProducedMetric({
    metricId: input.definition.metricId,
    scopeHash: input.scopeHash,
    availability: available ? "known" : "unknown",
    value: available ? median : null,
    unit: input.definition.unit,
    provenance: input.definition.provenanceRule,
    methodVersion: input.definition.methodVersion,
    support,
    coverage,
  } as ProducedMetric);
}

function produceMinimalMonth(input: {
  readonly definition: MetricRegistryEntry;
  readonly source: Extract<MetricProductionSource, { readonly kind: "minimal_month"; readonly availability: "known" }>;
  readonly scopeHash: ScopeHash;
}): ProducedMetric {
  const metric = calculateMinimalMonthCost({
    neutralVariableComponents: input.source.neutralVariableComponents,
    mandatoryMonthlyObligationsAndProvisions: input.source.mandatoryMonthlyObligationsAndProvisions,
  });
  return validateProducedMetric({
    metricId: input.definition.metricId,
    scopeHash: input.scopeHash,
    availability: "known",
    value: metric.value,
    unit: input.definition.unit,
    coverage: metric.coverage,
    ...(metric.support === undefined ? {} : { support: metric.support }),
    provenance: input.definition.provenanceRule,
    methodVersion: input.definition.methodVersion,
  } as ProducedMetric);
}

function produceTypicalMonth(input: {
  readonly definition: MetricRegistryEntry;
  readonly source: Extract<MetricProductionSource, { readonly kind: "typical_month" }>;
  readonly normalizedScope: NormalizedAnalysisScope;
  readonly scopeHash: ScopeHash;
}): ProducedMetric {
  if (
    input.normalizedScope.time.kind !== "month" ||
    input.source.window.targetPeriod !== input.normalizedScope.time.month
  ) {
    throw new MetricProductionContractError(
      "Typical Month exige une comparison_reference de la période du scope.",
    );
  }
  const metric = calculateTypicalMonthCost({
    window: input.source.window,
    monthlyObservations: input.source.monthlyObservations,
    ...(input.source.coverage === undefined
      ? {}
      : { coverage: input.source.coverage }),
  });
  return validateProducedMetric({
    metricId: input.definition.metricId,
    scopeHash: input.scopeHash,
    referenceWindow: input.source.window,
    availability: metric.availability,
    value: metric.value,
    unit: metric.unit,
    coverage: metric.coverage,
    support: metric.support,
    provenance: metric.provenance,
    reference: metric.reference,
    methodVersion: metric.methodVersion,
  } as ProducedMetric);
}

function produceFuelEstimate(input: {
  readonly definition: MetricRegistryEntry;
  readonly source: Extract<
    MetricProductionSource,
    { readonly kind: "fuel_trip_estimate" }
  >;
  readonly normalizedScope: NormalizedAnalysisScope;
  readonly scopeHash: ScopeHash;
}): ProducedMetric {
  if (
    input.normalizedScope.time.kind !== "month" ||
    (input.source.input.period !== undefined &&
      input.source.input.period !== input.normalizedScope.time.month)
  ) {
    throw new MetricProductionContractError(
      "Fuel Trip Estimate exige la période mensuelle de son scope.",
    );
  }
  const metric = calculateFuelTripEstimate(input.source.input);
  const estimationTrace: EstimationTrace = {
    metricId: metric.metricId,
    methodVersion: metric.methodVersion,
    ...(metric.period === undefined ? {} : { period: metric.period }),
    asOf: metric.asOf,
    evidenceRefs: metric.evidenceRefs,
  };
  return validateProducedMetric({
    metricId: input.definition.metricId,
    scopeHash: input.scopeHash,
    estimationTrace,
    availability: metric.availability,
    value: metric.value,
    unit: metric.unit,
    coverage: metric.coverage,
    support: metric.support,
    provenance: metric.provenance,
    methodVersion: metric.methodVersion,
  } as ProducedMetric);
}

export function produceMetric(
  request: MetricProductionRequest,
): ProducedMetric {
  let definition: MetricRegistryEntry;
  let normalizedScope: NormalizedAnalysisScope;
  try {
    definition = getMetricRegistryEntry(request.metricId);
    normalizedScope = normalizeAnalysisScope(request.scope);
  } catch (error) {
    throw new MetricProductionContractError(
      "MetricId ou AnalysisScope invalide pour le producteur.",
      { cause: error },
    );
  }
  const scopeHash = computeScopeHash(normalizedScope);
  if (!isApplicable(definition, normalizedScope)) {
    return notApplicableMetric(definition, scopeHash);
  }
  assertSource(definition, request.source, scopeHash);

  try {
    if (request.source.kind === "typical_month") {
      return produceTypicalMonth({
        definition,
        source: request.source,
        normalizedScope,
        scopeHash,
      });
    }
    if (request.source.kind === "fuel_trip_estimate") {
      return produceFuelEstimate({
        definition,
        source: request.source,
        normalizedScope,
        scopeHash,
      });
    }
    if (request.source.kind === "minimal_month" && request.source.availability === "known") {
      return produceMinimalMonth({ definition, source: request.source, scopeHash });
    }
    if (request.source.kind === "activity_occurrence_costs" && request.source.availability === "known") {
      return produceActivityCausalMetric({ definition, source: request.source, scopeHash });
    }
    if (request.source.availability !== "known") {
      return metricFromBusinessAvailability({
        definition,
        scopeHash,
        source: request.source,
      });
    }
    if (!("facts" in request.source)) {
      throw new MetricProductionContractError("La source connue ne fournit pas les faits attendus.");
    }
    return produceKnownFactMetric({
      definition,
      request,
      normalizedScope,
      scopeHash,
      source: request.source,
    });
  } catch (error) {
    if (error instanceof MetricProductionContractError) throw error;
    if (error instanceof TypeError) {
      throw new MetricProductionContractError(
        "Les entrées du producteur ne respectent pas le contrat analytique.",
        { cause: error },
      );
    }
    throw new MetricComputationError("Le calcul analytique a échoué.", {
      cause: error,
    });
  }
}

export function produceMetricResult(
  request: MetricProductionRequest,
  requestId: string,
): MetricProductionOutcome {
  try {
    return { ok: true, metric: produceMetric(request) };
  } catch (error) {
    return {
      ok: false,
      error: metricProductionErrorToApiError(error, requestId),
    };
  }
}
