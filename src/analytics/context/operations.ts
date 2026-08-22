import { parseMetricId } from "../../core/identity";
import type { Money } from "../../core/money";
import {
  parseSupport,
  type Availability,
  type Support,
  type SupportLevel,
} from "../../core/metrics";
import {
  parseAnalysisSubject,
  parseLifeScopeContext,
  type AnalysisSubject,
  type LifeScopeContext,
} from "../../core/scope";
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
