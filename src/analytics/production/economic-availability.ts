import { selectEconomicComponentsForScope } from "../context";
import type { EconomicComponentFact } from "../facts";
import type { Availability, Coverage } from "../../core/metrics";
import type { NormalizedAnalysisScope } from "../../core/scope";

export function economicSourceAvailability(input: {
  readonly facts: readonly EconomicComponentFact[];
  readonly scope: NormalizedAnalysisScope;
  readonly emptyPeriodQualified: boolean;
}): { readonly availability: Availability; readonly coverage?: Coverage } {
  if (input.scope.subject.kind === "person") {
    return { availability: "unknown" };
  }
  if (input.scope.filters.activityIds.length > 0) {
    return { availability: "unknown" };
  }
  const selected = selectEconomicComponentsForScope(input.facts, input.scope);
  if (selected.length === 0) {
    return input.emptyPeriodQualified
      ? { availability: "known", coverage: { level: "complete" } }
      : { availability: "unknown" };
  }
  if (selected.some(({ economicTiming }) => economicTiming.kind === "conflict")) {
    return { availability: "conflict" };
  }
  const uncertain = selected.filter(
    ({ economicTiming }) =>
      economicTiming.kind === "unknown" || economicTiming.kind === "partial",
  );
  const hasKnown = selected.some(
    ({ economicTiming }) =>
      economicTiming.kind === "known" || economicTiming.kind === "partial",
  );
  if (!hasKnown && uncertain.length > 0) return { availability: "unknown" };
  return {
    availability: "known",
    coverage:
      uncertain.length === 0
        ? { level: "complete" }
        : { level: "partial" },
  };
}
