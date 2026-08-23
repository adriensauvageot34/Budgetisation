import Big from "big.js";
import { parseLifeEventId } from "../../core/identity";
import { addMoney, compareMoney, parseMoney, type Money } from "../../core/money";
import { parseSupport } from "../../core/metrics";
import { parseStrictRecord, requireProperty, withValidationPath } from "../../core/validation";
import { parseCanonicalComponentKey } from "./validation";
import type {
  ActivityCausalFinancialLink,
  ActivityOccurrenceCostFact,
  ActivityOccurrenceFact,
  CanonicalComponentKey,
  EconomicComponentFact,
} from "./types";

const causalRelationTypes = new Set([
  "Paiement_activite",
  "Cause_par_evenement",
  "Preparation",
]);

export function isCausalActivityRelation(value: string): value is ActivityCausalFinancialLink["relationType"] {
  return causalRelationTypes.has(value);
}

function requiredText(value: unknown, name: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new TypeError(`${name} doit être un texte non vide.`);
  }
  return value;
}

export function parseActivityCausalFinancialLinks(values: readonly unknown[]): readonly ActivityCausalFinancialLink[] {
  return values.flatMap((value, index) => withValidationPath(index, () => {
    const row = parseStrictRecord(value, [
      "financial_link_id",
      "life_event_id",
      "source_kind",
      "operation_id",
      "allocation_id",
      "item_id",
      "cash_use_id",
      "relation_type",
      "economic_amount_linked",
      "validation_status",
    ], "life_event_financial_links");
    if (row.validation_status !== "Confirmé") return [];
    const relationType = requiredText(requireProperty(row, "relation_type", "life_event_financial_links"), "relation_type");
    if (!isCausalActivityRelation(relationType)) return [];
    const sourceKind = requiredText(requireProperty(row, "source_kind", "life_event_financial_links"), "source_kind");
    const sourceId = sourceKind === "Operation"
      ? row.operation_id
      : sourceKind === "Allocation"
        ? row.allocation_id
        : sourceKind === "Item"
          ? row.item_id
          : sourceKind === "Cash_use"
            ? row.cash_use_id
            : null;
    if (sourceId === null) return [];
    const prefix = sourceKind === "Operation"
      ? "operation"
      : sourceKind === "Allocation"
        ? "allocation"
        : sourceKind === "Item"
          ? "item"
          : "cash_use";
    const amount = row.economic_amount_linked;
    return [{
      financialLinkId: requiredText(requireProperty(row, "financial_link_id", "life_event_financial_links"), "financial_link_id"),
      lifeEventId: parseLifeEventId(requireProperty(row, "life_event_id", "life_event_financial_links")),
      canonicalComponentKey: parseCanonicalComponentKey(`${prefix}:${requiredText(sourceId, `${sourceKind} source id`)}`),
      relationType,
      economicAmountLinked: amount === null ? null : parseMoney(amount),
    }];
  }));
}

function componentByKey(values: readonly EconomicComponentFact[]) {
  const result = new Map<CanonicalComponentKey, EconomicComponentFact>();
  for (const component of values) {
    const current = result.get(component.canonicalComponentKey);
    if (current !== undefined && JSON.stringify(current) !== JSON.stringify(component)) {
      throw new TypeError("Une canonical_component_key porte deux composantes économiques.");
    }
    result.set(component.canonicalComponentKey, component);
  }
  return result;
}

export function buildActivityOccurrenceCostFacts(input: {
  readonly occurrences: readonly ActivityOccurrenceFact[];
  readonly components: readonly EconomicComponentFact[];
  readonly links: readonly ActivityCausalFinancialLink[];
}): readonly ActivityOccurrenceCostFact[] {
  const components = componentByKey(input.components);
  const occurrenceIds = new Set(input.occurrences.map(({ lifeEventId }) => lifeEventId));
  const links = input.links.filter((link) => occurrenceIds.has(link.lifeEventId));
  const allocatedByComponent = new Map<CanonicalComponentKey, Big>();
  const amountByOccurrenceComponent = new Map<string, Money | null>();
  for (const link of links) {
    const identity = `${link.lifeEventId}\n${link.canonicalComponentKey}`;
    const existing = amountByOccurrenceComponent.get(identity);
    if (existing !== undefined) {
      if (existing !== link.economicAmountLinked) {
        amountByOccurrenceComponent.set(identity, null);
      }
      continue;
    }
    amountByOccurrenceComponent.set(identity, link.economicAmountLinked);
    if (link.economicAmountLinked !== null) {
      allocatedByComponent.set(
        link.canonicalComponentKey,
        (allocatedByComponent.get(link.canonicalComponentKey) ?? new Big(0)).plus(new Big(link.economicAmountLinked).abs()),
      );
    }
  }
  const overAllocated = new Set<CanonicalComponentKey>();
  for (const [key, allocated] of allocatedByComponent) {
    const component = components.get(key);
    if (component === undefined || allocated.gt(new Big(component.net).abs())) overAllocated.add(key);
  }

  return input.occurrences.map((occurrence) => {
    const occurrenceLinks = links.filter(({ lifeEventId }) => lifeEventId === occurrence.lifeEventId);
    const uniqueByComponent = new Map<CanonicalComponentKey, ActivityCausalFinancialLink>();
    for (const link of occurrenceLinks) {
      if (!uniqueByComponent.has(link.canonicalComponentKey)) uniqueByComponent.set(link.canonicalComponentKey, link);
    }
    const unresolved = occurrenceLinks.length === 0 || [...uniqueByComponent].some(([key]) => {
      const amount = amountByOccurrenceComponent.get(`${occurrence.lifeEventId}\n${key}`);
      return amount === null || amount === undefined || !components.has(key) || overAllocated.has(key);
    });
    const knownAmounts = [...uniqueByComponent].flatMap(([key]) => {
      const amount = amountByOccurrenceComponent.get(`${occurrence.lifeEventId}\n${key}`);
      return amount === null || amount === undefined || !components.has(key) || overAllocated.has(key) ? [] : [amount];
    });
    const value = knownAmounts.reduce(addMoney, parseMoney("0"));
    const causalCost = unresolved
      ? { availability: "unknown" as const, value: null }
      : { availability: "known" as const, value };
    return {
      fact: "fct_activity_occurrence_cost" as const,
      householdId: occurrence.householdId,
      householdTimeZone: occurrence.householdTimeZone,
      occurrenceId: occurrence.lifeEventId,
      activityId: occurrence.activityId,
      causalCost,
      coverage: unresolved ? { level: "partial" as const } : { level: "complete" as const },
      support: parseSupport({
        n: causalCost.availability === "known" ? 1 : 0,
        eligibleN: 1,
        observableN: 1,
        excludedN: causalCost.availability === "known" ? 0 : 1,
        unit: "occurrence",
        level: "insufficient",
      }),
      evidence: [...uniqueByComponent.values()]
        .map((link) => ({
          financialLinkId: link.financialLinkId,
          canonicalComponentKey: link.canonicalComponentKey,
          relationType: link.relationType,
        }))
        .sort((left, right) => left.canonicalComponentKey.localeCompare(right.canonicalComponentKey) || left.financialLinkId.localeCompare(right.financialLinkId)),
      provenance: "derived" as const,
    };
  });
}

export function medianKnownActivityCausalCost(
  values: readonly ActivityOccurrenceCostFact[],
): Money | null {
  const known = values
    .flatMap(({ causalCost }) => causalCost.availability === "known" ? [causalCost.value] : [])
    .sort(compareMoney);
  if (known.length === 0) return null;
  const middle = Math.floor(known.length / 2);
  if (known.length % 2 === 1) return known[middle]!;
  return parseMoney(new Big(known[middle - 1]!).plus(known[middle]!).div(2).toFixed());
}
