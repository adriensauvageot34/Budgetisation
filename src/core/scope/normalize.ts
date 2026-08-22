import { parseAnalysisScope } from "./validation";
import type {
  AnalysisScope,
  NormalizedAnalysisScope,
} from "./types";

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
    filters: {
      categoryIds: normalizeCollection(filters?.categoryIds),
      activityIds: normalizeCollection(filters?.activityIds),
      merchantIds: normalizeCollection(filters?.merchantIds),
      placeIds: normalizeCollection(filters?.placeIds),
      lifeScopeContext: normalizeCollection(filters?.lifeScopeContext),
      dayContext: normalizeCollection(filters?.dayContext),
    },
  };
}
