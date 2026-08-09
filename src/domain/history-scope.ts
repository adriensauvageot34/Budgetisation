import type { HistoryFilters } from "@/domain/history-filters";
import type { MonthKey } from "@/domain/budget";

export type HistoryScope = {
  start?: MonthKey;
  end?: MonthKey;
  filters: HistoryFilters;
  family?: string;
  category?: string;
  preciseType?: string;
  lifeContext?: string;
  lifeLayer?: string;
  momentId?: string;
  returnTo?: string;
};

function setList(params: URLSearchParams, key: string, values: string[]) {
  if (values.length) params.set(key, values.join(","));
}

export function historyScopeToUrl(scope: HistoryScope) {
  const params = historyScopeParams(scope);
  return `/historique${params.size ? `?${params}` : ""}`;
}

export function historyScopeToOperationsUrl(scope: HistoryScope, operationIds: string[] = []) {
  const params = historyScopeParams(scope);
  if (operationIds.length) params.set("operationIds", [...new Set(operationIds)].join(","));
  params.set("returnTo", scope.returnTo ?? historyScopeToUrl(scope));
  return `/operations?${params}`;
}

function historyScopeParams(scope: HistoryScope) {
  const params = new URLSearchParams();
  if (scope.start) params.set("start", scope.start);
  if (scope.end) params.set("end", scope.end);
  setList(params, "flux", scope.filters.flows);
  setList(params, "families", scope.filters.families);
  setList(params, "categories", scope.filters.categories);
  setList(params, "merchants", scope.filters.merchants);
  setList(params, "statuses", scope.filters.statuses);
  setList(params, "importances", scope.filters.importances);
  setList(params, "recurrences", scope.filters.recurrences);
  setList(params, "contexts", scope.filters.contexts);
  setList(params, "events", scope.filters.events);
  setList(params, "eventDetails", scope.filters.eventDetails);
  setList(params, "resourceTypes", scope.filters.resourceTypes);
  setList(params, "moments", scope.filters.moments);
  setList(params, "momentTypes", scope.filters.momentTypes);
  setList(params, "lifeLayers", scope.filters.lifeLayers);
  if (scope.family) params.set("family", scope.family);
  if (scope.category) params.set("category", scope.category);
  if (scope.preciseType) params.set("preciseType", scope.preciseType);
  if (scope.lifeContext) params.set("lifeContext", scope.lifeContext);
  if (scope.lifeLayer) params.set("lifeLayer", scope.lifeLayer);
  if (scope.momentId) params.set("momentId", scope.momentId);
  return params;
}
