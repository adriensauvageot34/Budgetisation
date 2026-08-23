import {
  getMetricRegistryEntry,
  isActiveMetricId,
  type ActiveMetricId,
} from "../../analytics/production";
import { createApiError } from "../../core/api";
import type { MetricId } from "../../core/identity";
import type { NormalizedAnalysisScope } from "../../core/scope";
import type { NormalizedOperationsExecutionScope } from "../request/operations-scope";
import type { AnalyticFilterDimension } from "../../analytics/aggregation";
import { getContextCapability } from "../../analytics/context";
import type { AnyNormalizedQueryRequest } from "../request";
import { getQueryCapabilityMaximum } from "./registry";
import type {
  QueryCapabilities,
  QueryCapabilityEvaluationContext,
  QueryCapabilityResult,
  QueryFilterKey,
  QuerySectionKey,
  QueryUnavailableCapability,
  UnavailableReason,
} from "./types";

const filterDimensions = {
  categoryIds: "category",
  activityIds: "activity",
  merchantIds: "merchant",
  placeIds: "place",
  lifeScopeContext: "life_scope_context",
  dayContext: "day_context",
} as const satisfies Record<QueryFilterKey, AnalyticFilterDimension>;

export class QueryIncompatibleFilterError extends TypeError {
  readonly filter: QueryFilterKey;

  constructor(filter: QueryFilterKey) {
    super(`Le filtre ${filter} est incompatible avec la ressource Query API.`);
    this.name = "QueryIncompatibleFilterError";
    this.filter = filter;
  }
}

export class QueryScopeCompatibilityError extends TypeError {
  constructor() {
    super("Le scope temporel est incompatible avec la ressource Query API.");
    this.name = "QueryScopeCompatibilityError";
  }
}

function selectedSet<T extends string>(
  selection: readonly T[] | undefined,
): ReadonlySet<string> | null {
  return selection === undefined ? null : new Set(selection);
}

function selectionContains<T extends string>(
  selection: readonly T[] | undefined,
  value: T,
): boolean {
  const selected = selectedSet(selection);
  return selected === null || selected.has(value);
}

function activeScopeFilters(
  scope: NormalizedAnalysisScope | NormalizedOperationsExecutionScope,
): readonly QueryFilterKey[] {
  return (Object.keys(filterDimensions) as QueryFilterKey[]).filter(
    (filter) => scope.filters[filter].length > 0,
  );
}

function querySelectedMetricId(
  request: AnyNormalizedQueryRequest,
): ActiveMetricId | null {
  const params = request.params as Readonly<Record<string, unknown>>;
  if (isActiveMetricId(params.metricId)) return params.metricId;
  if (isActiveMetricId(params.measure)) return params.measure;
  return null;
}

function metricScopeReason(
  metricId: ActiveMetricId,
  request: AnyNormalizedQueryRequest,
  activeFilters: readonly QueryFilterKey[],
): UnavailableReason | null {
  if (request.scope.time.kind !== "month" && request.scope.time.kind !== "global") {
    return "scope_incompatible";
  }
  const metric = getMetricRegistryEntry(metricId);
  const breakdownDimension =
    request.resource === "analysis_month_breakdown" ||
    request.resource === "analysis_global_breakdown"
      ? (request.params as { readonly dimension: string }).dimension
      : null;
  const structureDimension = request.resource === "analysis_month_structure"
    ? (() => {
        const dimension = (request.params as { readonly dimension: string }).dimension;
        return dimension === "category" || dimension === "activity" || dimension === "merchant" || dimension === "place"
          ? dimension
          : dimension === "life_context"
            ? "life_scope"
            : null;
      })()
    : null;
  const targetDimension = request.resource === "analysis_target"
    ? (() => {
        const target = (request.params as { readonly target: { readonly kind: string } }).target;
        return target.kind === "category" || target.kind === "activity"
          ? target.kind
          : target.kind === "context"
            ? "life_scope"
            : null;
      })()
    : null;
  const fixedEvolutionDimension =
    request.resource === "analysis_month_evolution" && metricId === "life_scope_amount"
      ? "life_scope"
      : null;
  const contextDimension =
    (request.resource === "analysis_month_contexts" ||
      request.resource === "analysis_global_contexts" ||
      request.resource === "analysis_global_habits") &&
    metric.contextCapabilityId !== undefined
      ? getContextCapability(metric.contextCapabilityId).dimension
      : null;
  const entityOrGalleryDimension =
    request.resource === "entity_place" || request.resource === "gallery_places"
      ? "place"
      : request.resource === "entity_merchant" ||
          request.resource === "gallery_merchants"
        ? "merchant"
        : null;
  const groupedDimension =
    breakdownDimension ?? structureDimension ?? targetDimension ?? fixedEvolutionDimension ?? contextDimension ?? entityOrGalleryDimension;
  const metricTimeKind =
    request.resource === "analysis_global_evolution" ||
    ((request.resource === "analysis_global_typical" ||
      request.resource === "analysis_global_baseline" ||
      request.resource === "analysis_global_profiles" ||
      request.resource === "analysis_global_habits") &&
      (metricId === "typical_month_cost" ||
        metricId === "minimal_month_cost" ||
        metricId === "activity_frequency"))
      ? "month"
      : request.scope.time.kind;
  if (!metric.allowedTimeKinds.includes(metricTimeKind)) {
    return "scope_incompatible";
  }
  if (
    activeFilters.some(
    (filter) => !metric.allowedFilters.includes(filterDimensions[filter]),
    )
  ) {
    return "filter_incompatible";
  }
  if (
    (metric.availabilityRules.includes("required_place_filter") &&
      request.scope.filters.placeIds.length !== 1 &&
      groupedDimension !== "place") ||
    (metric.availabilityRules.includes("required_category_filter") &&
      request.scope.filters.categoryIds.length === 0 &&
      groupedDimension !== "category") ||
    (metric.availabilityRules.includes("required_merchant_filter") &&
      request.scope.filters.merchantIds.length === 0 &&
      groupedDimension !== "merchant") ||
    (metric.availabilityRules.includes("required_life_scope_filter") &&
      request.scope.filters.lifeScopeContext.length === 0 &&
      groupedDimension !== "life_scope")
  ) {
    return "not_applicable";
  }
  return null;
}

function reductionReason(
  value: string,
  permissionSelection: readonly string[] | undefined,
  applicabilitySelection: readonly string[] | undefined,
  contractSelection: readonly string[] | undefined,
): UnavailableReason | null {
  if (!selectionContains(contractSelection, value)) {
    return "contract_not_supported";
  }
  if (!selectionContains(permissionSelection, value)) {
    return "permission_limited";
  }
  if (!selectionContains(applicabilitySelection, value)) {
    return "not_applicable";
  }
  return null;
}

function sectionReason(
  section: QuerySectionKey,
  context: QueryCapabilityEvaluationContext & {
    readonly permission: Extract<
      QueryCapabilityEvaluationContext["permission"],
      { readonly granted: true }
    >;
  },
): UnavailableReason | null {
  if (context.applicability?.resourceApplicable === false) {
    return "not_applicable";
  }
  return reductionReason(
    section,
    context.permission.sections,
    context.applicability?.sections,
    context.contractSupport?.sections,
  );
}

function measureReason(
  metricId: ActiveMetricId,
  request: AnyNormalizedQueryRequest,
  activeFilters: readonly QueryFilterKey[],
  context: QueryCapabilityEvaluationContext & {
    readonly permission: Extract<
      QueryCapabilityEvaluationContext["permission"],
      { readonly granted: true }
    >;
  },
): UnavailableReason | null {
  if (context.applicability?.resourceApplicable === false) {
    return "not_applicable";
  }
  const selectedMetricId = querySelectedMetricId(request);
  if (selectedMetricId !== null && selectedMetricId !== metricId) {
    return "not_applicable";
  }
  if (!isActiveMetricId(metricId)) return "measure_incompatible";
  const reduction = reductionReason(
    metricId,
    context.permission.measures,
    context.applicability?.measures,
    context.contractSupport?.measures,
  );
  return reduction ?? metricScopeReason(metricId, request, activeFilters);
}

function filterReason(
  filter: QueryFilterKey,
  context: QueryCapabilityEvaluationContext & {
    readonly permission: Extract<
      QueryCapabilityEvaluationContext["permission"],
      { readonly granted: true }
    >;
  },
): UnavailableReason | null {
  if (context.applicability?.resourceApplicable === false) {
    return "not_applicable";
  }
  return reductionReason(
    filter,
    context.permission.filters,
    context.applicability?.filters,
    context.contractSupport?.filters,
  );
}

export function evaluateQueryCapabilities(
  request: AnyNormalizedQueryRequest,
  context: QueryCapabilityEvaluationContext,
): QueryCapabilityResult {
  if (!context.permission.granted) {
    return {
      ok: false,
      error: createApiError({
        code: context.permission.errorCode,
        message:
          context.permission.errorCode === "NOT_FOUND"
            ? "Ressource introuvable."
            : "Accès refusé.",
        retryable: false,
        requestId: context.requestId,
      }),
    };
  }

  const maximum = getQueryCapabilityMaximum(request.resource);
  const activeFilters = activeScopeFilters(request.scope);
  for (const filter of activeFilters) {
    const reason = filterReason(filter, { ...context, permission: context.permission });
    if (!maximum.filters.includes(filter) || reason !== null) {
      throw new QueryIncompatibleFilterError(filter);
    }
  }

  const selectedMetricId = querySelectedMetricId(request);
  if (selectedMetricId !== null) {
    const reason = metricScopeReason(selectedMetricId, request, activeFilters);
    if (reason === "scope_incompatible") {
      throw new QueryScopeCompatibilityError();
    }
    if (reason === "filter_incompatible") {
      const incompatibleFilter = activeFilters.find(
        (filter) =>
          !getMetricRegistryEntry(selectedMetricId).allowedFilters.includes(
            filterDimensions[filter],
          ),
      );
      if (incompatibleFilter === undefined) {
        throw new TypeError("Incompatibilité de filtre non déterministe.");
      }
      throw new QueryIncompatibleFilterError(incompatibleFilter);
    }
  }

  const permissionContext = { ...context, permission: context.permission };
  const availableSections: QuerySectionKey[] = [];
  const availableMeasures: ActiveMetricId[] = [];
  const compatibleFilters: QueryFilterKey[] = [];
  const unavailable: QueryUnavailableCapability[] = [];

  for (const section of maximum.sections) {
    const reason = sectionReason(section, permissionContext);
    if (reason === null) availableSections.push(section);
    else unavailable.push({ kind: "section", section, reason });
  }
  for (const metricId of maximum.measures) {
    const reason = measureReason(
      metricId,
      request,
      activeFilters,
      permissionContext,
    );
    if (reason === null) availableMeasures.push(metricId);
    else {
      unavailable.push({
        kind: "measure",
        metricId: getMetricRegistryEntry(metricId).metricId as MetricId,
        reason,
      });
    }
  }
  for (const filter of maximum.filters) {
    const reason = filterReason(filter, permissionContext);
    if (reason === null) compatibleFilters.push(filter);
    else unavailable.push({ kind: "filter", filter, reason });
  }

  const capabilities: QueryCapabilities = {
    resource: request.resource,
    availableSections,
    availableMeasures,
    compatibleFilters,
    unavailable,
  };
  return { ok: true, capabilities };
}
