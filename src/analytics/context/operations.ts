import { parseMetricId } from "../../core/identity";
import { addMoney, parseMoney, type Money } from "../../core/money";
import {
  parseSupport,
  type Availability,
  type Support,
  type SupportLevel,
} from "../../core/metrics";
import {
  parseAnalysisSubject,
  parseLifeScopeContext,
  normalizeAnalysisScope,
  type AnalysisSubject,
  type AnalysisScope,
  type NormalizedAnalysisScope,
  type LifeScopeContext,
} from "../../core/scope";
import { resolveGlobalWindowMonths } from "../../core/time";
import {
  aggregateEconomicNetByCategory,
  dedupeEconomicComponents,
  sumEconomicNet,
  type CanonicalPlaceValue,
  type CategoryAggregation,
  type EconomicComponentFact,
} from "../facts";
import type {
  ContextCostAggregate,
  ContextCostSelection,
} from "./types";

export function selectEconomicComponentsForSubject(
  values: readonly unknown[],
  subject: AnalysisSubject,
): readonly EconomicComponentFact[] {
  const parsedSubject = parseAnalysisSubject(subject);
  const components = dedupeEconomicComponents(values);
  if (parsedSubject.kind === "household") return components;
  return components.filter(
    (component) =>
      component.person.kind === "resolved" &&
      component.person.id === parsedSubject.personId,
  );
}

export function sumEconomicNetForSubject(
  values: readonly unknown[],
  subject: AnalysisSubject,
): Money {
  return sumEconomicNet(selectEconomicComponentsForSubject(values, subject));
}

function matchesEconomicDimensions(
  component: EconomicComponentFact,
  scope: NormalizedAnalysisScope,
): boolean {
  const filters = scope.filters;
  if (
    filters.categoryIds.length > 0 &&
    (component.category.kind !== "resolved" ||
      !filters.categoryIds.includes(component.category.id))
  ) return false;
  if (
    filters.activityIds.length > 0 &&
    (component.activity.kind !== "resolved" ||
      !filters.activityIds.includes(component.activity.id))
  ) return false;
  if (
    filters.merchantIds.length > 0 &&
    (component.merchant.kind !== "resolved" ||
      !filters.merchantIds.includes(component.merchant.id))
  ) return false;
  if (
    filters.placeIds.length > 0 &&
    (component.canonicalPlace.kind !== "resolved" ||
      !filters.placeIds.includes(component.canonicalPlace.placeId))
  ) return false;
  if (
    filters.lifeScopeContext.length > 0 &&
    (component.lifeScope.kind !== "resolved" ||
      !filters.lifeScopeContext.includes(
        parseLifeScopeContext(component.lifeScope.value),
      ))
  ) return false;
  return true;
}

function economicMonths(scope: NormalizedAnalysisScope): ReadonlySet<string> {
  return new Set(
    scope.time.kind === "month"
      ? [scope.time.month]
      : resolveGlobalWindowMonths(
          scope.time.observationWindow,
          scope.time.asOf,
        ),
  );
}

export function selectEconomicComponentsForScope(
  values: readonly unknown[],
  scope: AnalysisScope,
): readonly EconomicComponentFact[] {
  const normalized = normalizeAnalysisScope(scope);
  return selectEconomicComponentsForSubject(values, normalized.subject).filter(
    (component) => matchesEconomicDimensions(component, normalized),
  );
}

export function sumEconomicNetForScope(
  values: readonly unknown[],
  scope: AnalysisScope,
): Money {
  const normalized = normalizeAnalysisScope(scope);
  const months = economicMonths(normalized);
  return selectEconomicComponentsForScope(values, normalized).reduce(
    (total, component) => {
      if (
        component.economicTiming.kind !== "known" &&
        component.economicTiming.kind !== "partial"
      ) return total;
      return component.economicTiming.segments.reduce(
        (componentTotal, segment) =>
          segment.economicMonth !== null && months.has(segment.economicMonth)
            ? addMoney(componentTotal, segment.amount)
            : componentTotal,
        total,
      );
    },
    parseMoney("0"),
  );
}

export function sumSharedContextEconomicNet(
  contextComponents: readonly (readonly unknown[])[],
): Money {
  return sumEconomicNet(contextComponents.flat());
}

export function aggregateContextCategories(
  values: readonly unknown[],
): CategoryAggregation {
  return aggregateEconomicNetByCategory(values);
}

export function localizedMetricAvailability(
  place: CanonicalPlaceValue,
): Availability {
  switch (place.kind) {
    case "resolved":
      return "known";
    case "unknown":
      return "unknown";
    case "not_applicable":
      return "not_applicable";
    case "conflict":
      return "conflict";
  }
}

export function selectEconomicComponentsByLifeScope(
  values: readonly unknown[],
  lifeScopes: readonly LifeScopeContext[],
): readonly EconomicComponentFact[] {
  const allowed = new Set(lifeScopes.map(parseLifeScopeContext));
  return dedupeEconomicComponents(values).filter((component) => {
    if (component.lifeScope.kind !== "resolved") return false;
    return allowed.has(parseLifeScopeContext(component.lifeScope.value));
  });
}

export function createDayContextSupport(input: {
  readonly n: number;
  readonly level: SupportLevel;
  readonly eligibleN?: number;
  readonly observableN?: number;
  readonly excludedN?: number;
}): Support {
  return parseSupport({
    n: input.n,
    unit: "person_day",
    level: input.level,
    ...(input.eligibleN === undefined ? {} : { eligibleN: input.eligibleN }),
    ...(input.observableN === undefined
      ? {}
      : { observableN: input.observableN }),
    ...(input.excludedN === undefined ? {} : { excludedN: input.excludedN }),
  });
}

export function aggregateContextCost(
  selection: ContextCostSelection,
): ContextCostAggregate {
  const metricId = parseMetricId(
    selection.kind === "causal"
      ? "context_causal_cost"
      : "context_during_cost",
  );
  return {
    kind: selection.kind,
    metricId,
    value: sumEconomicNet(selection.components),
    provenance: "observed",
    overlappingContextsAdditivity: "non_additive",
  };
}
