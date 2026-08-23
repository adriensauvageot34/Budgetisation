import { parseAnalysisScope } from "./validation";
import type {
  AnalysisFilters,
  AnalysisScope,
  NormalizedAnalysisFilters,
  NormalizedAnalysisScope,
} from "./types";
import { parseAnalysisFilters } from "./validation";

function normalizeCollection<T extends string>(
  values: readonly T[] | undefined,
): readonly T[] {
  return [...new Set(values ?? [])].sort((a, b) =>
    a === b ? 0 : a < b ? -1 : 1,
  );
}

export function normalizeAnalysisScope(
  scope: AnalysisScope,
): NormalizedAnalysisScope {
  const parsed = parseAnalysisScope(scope);
  const filters = parsed.filters;

  return {
    subject: parsed.subject,
    time: parsed.time,
    filters: normalizeAnalysisFilters(filters),
  };
}

export function normalizeAnalysisFilters(filters?: AnalysisFilters): NormalizedAnalysisFilters {
  const parsed = filters === undefined ? undefined : parseAnalysisFilters(filters);
  return {
    categoryIds: normalizeCollection(parsed?.categoryIds),
    activityIds: normalizeCollection(parsed?.activityIds),
    merchantIds: normalizeCollection(parsed?.merchantIds),
    placeIds: normalizeCollection(parsed?.placeIds),
    lifeScopeContext: normalizeCollection(parsed?.lifeScopeContext),
    dayContext: normalizeCollection(parsed?.dayContext),
  };
}
