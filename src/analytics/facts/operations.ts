import type { CategoryId, PlaceId } from "../../core/identity";
import {
  addMoney,
  compareMoney,
  parseMoney,
  type Money,
} from "../../core/money";
import type {
  ActivityOccurrenceFact,
  AnalyticCategoryValue,
  EconomicComponentFact,
  PersonDayFact,
  PlaceVisitFact,
  PurchaseEventFact,
} from "./types";
import {
  parseActivityOccurrenceFact,
  parseEconomicComponentFact,
  parsePersonDayFact,
  parsePlaceVisitFact,
  parsePurchaseEventFact,
} from "./validation";

function canonicalJson(value: unknown): string {
  return JSON.stringify(value);
}

function dedupeParsedFacts<Fact>(
  values: readonly unknown[],
  parse: (value: unknown) => Fact,
  identify: (fact: Fact) => string,
  factName: string,
): readonly Fact[] {
  const facts = new Map<string, Fact>();

  for (const value of values) {
    const fact = parse(value);
    const key = identify(fact);
    const existing = facts.get(key);
    if (existing === undefined) {
      facts.set(key, fact);
      continue;
    }
    if (canonicalJson(existing) !== canonicalJson(fact)) {
      throw new TypeError(`${factName} contient deux versions de ${key}.`);
    }
  }

  return [...facts.values()];
}

export function dedupeEconomicComponents(
  values: readonly unknown[],
): readonly EconomicComponentFact[] {
  return dedupeParsedFacts(
    values,
    parseEconomicComponentFact,
    (fact) => `${fact.householdId}:${fact.canonicalComponentKey}`,
    "fct_economic_component",
  );
}

export function dedupeActivityOccurrences(
  values: readonly unknown[],
): readonly ActivityOccurrenceFact[] {
  return dedupeParsedFacts(
    values,
    parseActivityOccurrenceFact,
    (fact) => `${fact.householdId}:${fact.lifeEventId}`,
    "fct_activity_occurrence",
  );
}

export function dedupePersonDays(
  values: readonly unknown[],
): readonly PersonDayFact[] {
  return dedupeParsedFacts(
    values,
    parsePersonDayFact,
    (fact) => `${fact.householdId}:${fact.personId}:${fact.localDate}`,
    "fct_person_day",
  );
}

export function dedupePurchaseEvents(
  values: readonly unknown[],
): readonly PurchaseEventFact[] {
  return dedupeParsedFacts(
    values,
    parsePurchaseEventFact,
    (fact) => `${fact.householdId}:${fact.purchaseEventId}`,
    "fct_purchase_event",
  );
}

export function dedupePlaceVisits(
  values: readonly unknown[],
): readonly PlaceVisitFact[] {
  return dedupeParsedFacts(
    values,
    parsePlaceVisitFact,
    (fact) => `${fact.householdId}:${fact.visitKey}`,
    "fct_place_visit",
  );
}

export function sumEconomicNet(values: readonly unknown[]): Money {
  return dedupeEconomicComponents(values).reduce(
    (total, component) => addMoney(total, component.net),
    parseMoney("0"),
  );
}

export function countActivityOccurrences(values: readonly unknown[]): number {
  return dedupeActivityOccurrences(values).length;
}

export function countPersonDays(values: readonly unknown[]): number {
  return dedupePersonDays(values).length;
}

export function countPurchaseEvents(values: readonly unknown[]): number {
  return dedupePurchaseEvents(values).length;
}

export function countPlaceVisits(values: readonly unknown[]): number {
  return dedupePlaceVisits(values).length;
}

export function countDistinctVisitDays(values: readonly unknown[]): number {
  const visits = dedupePlaceVisits(values);
  return new Set(
    visits.map(
      (visit) =>
        `${visit.householdId}:${visit.personId}:${visit.localDate}`,
    ),
  ).size;
}

export type CategoryAggregationKey =
  | `category:${CategoryId}`
  | "undetermined";

export type CategoryAggregation = {
  readonly groups: ReadonlyMap<CategoryAggregationKey, Money>;
  readonly unresolved: {
    readonly unknown: Money;
    readonly notApplicable: Money;
    readonly conflict: Money;
  };
  readonly economicTotal: Money;
  readonly groupedTotal: Money;
  readonly reconciles: boolean;
};

function categoryAggregationKey(
  category: AnalyticCategoryValue,
): CategoryAggregationKey | undefined {
  if (category.kind === "resolved") return `category:${category.id}`;
  return category.kind === "undetermined" ? category.kind : undefined;
}

export function aggregateEconomicNetByCategory(
  values: readonly unknown[],
): CategoryAggregation {
  const totals = new Map<CategoryAggregationKey, Money>();
  let unknown = parseMoney("0");
  let notApplicable = parseMoney("0");
  let conflict = parseMoney("0");
  const components = dedupeEconomicComponents(values);
  for (const component of components) {
    const key = categoryAggregationKey(component.category);
    if (key === undefined) {
      switch (component.category.kind) {
        case "unknown":
          unknown = addMoney(unknown, component.net);
          break;
        case "not_applicable":
          notApplicable = addMoney(notApplicable, component.net);
          break;
        case "conflict":
          conflict = addMoney(conflict, component.net);
          break;
      }
      continue;
    }
    totals.set(
      key,
      addMoney(totals.get(key) ?? parseMoney("0"), component.net),
    );
  }
  const economicTotal = components.reduce(
    (total, component) => addMoney(total, component.net),
    parseMoney("0"),
  );
  const groupedTotal = [...totals.values()].reduce(
    (total, amount) => addMoney(total, amount),
    parseMoney("0"),
  );
  return {
    groups: totals,
    unresolved: { unknown, notApplicable, conflict },
    economicTotal,
    groupedTotal,
    reconciles: compareMoney(economicTotal, groupedTotal) === 0,
  };
}

export function reconcileCategoryAggregation(values: readonly unknown[]): {
  readonly economicTotal: Money;
  readonly categoryTotal: Money;
  readonly reconciles: boolean;
} {
  const aggregation = aggregateEconomicNetByCategory(values);
  return {
    economicTotal: aggregation.economicTotal,
    categoryTotal: aggregation.groupedTotal,
    reconciles: aggregation.reconciles,
  };
}

export function aggregateLocalizedSpend(
  values: readonly unknown[],
): ReadonlyMap<PlaceId, Money> {
  const totals = new Map<PlaceId, Money>();
  for (const component of dedupeEconomicComponents(values)) {
    if (component.canonicalPlace.kind !== "resolved") {
      continue;
    }
    const placeId = component.canonicalPlace.placeId;
    totals.set(
      placeId,
      addMoney(totals.get(placeId) ?? parseMoney("0"), component.net),
    );
  }
  return totals;
}
