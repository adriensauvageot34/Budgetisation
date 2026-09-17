import Big from "big.js";
import {
  buildActivityOccurrenceCostFacts,
  parseCanonicalComponentKey,
  type ActivityCausalFinancialLink,
  type ActivityOccurrenceFact,
  type CanonicalComponentKey,
  type EconomicComponentFact,
} from "../facts";
import { compareMoney, parseMoney, type Money } from "../../core/money";

export const TIMELINE_EVENT_COST_METHOD_VERSION = "timeline-event-cost@v1" as const;

export type LifeEventCostClosureStatus = "COMPLETE" | "EXPLICIT_EMPTY";

export type LifeEventCostClosureAssertion = Readonly<{
  assertionId: string;
  householdId: string;
  lifeEventId: string;
  closureStatus: LifeEventCostClosureStatus;
  expectedComponentKeys: readonly CanonicalComponentKey[];
  methodVersion: typeof TIMELINE_EVENT_COST_METHOD_VERSION;
  authority: string;
  evidenceRefs: readonly string[];
  provenance: string;
  sourceRevision: number;
  declaredAt: string;
  validatedAt: string;
}>;

export type TimelineLifeEventCostReason =
  | "NO_ACTIVE_ASSERTION"
  | "CROSS_HOUSEHOLD_ASSERTION"
  | "EXPECTED_COMPONENT_SET_MISMATCH"
  | "UNSUPPORTED_COMPONENT_KIND"
  | "MISSING_CANONICAL_COMPONENT"
  | "UNRESOLVED_COMPONENT_AMOUNT"
  | "CONTRADICTORY_COMPONENT_AMOUNT"
  | "OVERALLOCATED_COMPONENT"
  | "PARENT_CHILD_DOUBLE_COUNT"
  | "NEGATIVE_ECONOMIC_NET";

export type TimelineLifeEventCost = Readonly<{
  lifeEventId: string;
  methodVersion: typeof TIMELINE_EVENT_COST_METHOD_VERSION;
  authority: "NONE" | "CANONICAL_LINKED";
  status: "KNOWN" | "UNKNOWN" | "CONFLICT";
  value: Money | null;
  reasonCode: TimelineLifeEventCostReason | null;
  componentKeys: readonly CanonicalComponentKey[];
}>;

function sameSet(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function sortedUniqueKeys(values: readonly string[]): readonly CanonicalComponentKey[] {
  return [...new Set(values.map((value) => parseCanonicalComponentKey(value)))].sort();
}

function unresolved(
  lifeEventId: string,
  authority: TimelineLifeEventCost["authority"],
  status: Extract<TimelineLifeEventCost["status"], "UNKNOWN" | "CONFLICT">,
  reasonCode: TimelineLifeEventCostReason,
  componentKeys: readonly CanonicalComponentKey[] = [],
): TimelineLifeEventCost {
  return {
    lifeEventId,
    methodVersion: TIMELINE_EVENT_COST_METHOD_VERSION,
    authority,
    status,
    value: null,
    reasonCode,
    componentKeys,
  };
}

function resolved(
  lifeEventId: string,
  value: Money,
  componentKeys: readonly CanonicalComponentKey[],
): TimelineLifeEventCost {
  return {
    lifeEventId,
    methodVersion: TIMELINE_EVENT_COST_METHOD_VERSION,
    authority: "CANONICAL_LINKED",
    status: "KNOWN",
    value,
    reasonCode: null,
    componentKeys,
  };
}

function contradictoryAmountKeys(links: readonly ActivityCausalFinancialLink[]): ReadonlySet<CanonicalComponentKey> {
  const amounts = new Map<string, string | null>();
  const conflicts = new Set<CanonicalComponentKey>();
  for (const link of links) {
    const amount = link.economicAmountLinked;
    const identity = `${link.lifeEventId}\n${link.canonicalComponentKey}`;
    if (!amounts.has(identity)) {
      amounts.set(identity, amount);
    } else if (amounts.get(identity) !== amount) {
      conflicts.add(link.canonicalComponentKey);
    }
  }
  return conflicts;
}

function overAllocatedKeys(
  components: ReadonlyMap<CanonicalComponentKey, EconomicComponentFact>,
  links: readonly ActivityCausalFinancialLink[],
): ReadonlySet<CanonicalComponentKey> {
  const totals = new Map<CanonicalComponentKey, Big>();
  const seenEventComponents = new Set<string>();
  for (const link of links) {
    if (link.economicAmountLinked === null) continue;
    const identity = `${link.lifeEventId}\n${link.canonicalComponentKey}`;
    if (seenEventComponents.has(identity)) continue;
    seenEventComponents.add(identity);
    totals.set(
      link.canonicalComponentKey,
      (totals.get(link.canonicalComponentKey) ?? new Big(0)).plus(new Big(link.economicAmountLinked).abs()),
    );
  }
  return new Set([...totals].flatMap(([key, amount]) => {
    const component = components.get(key);
    return component !== undefined && amount.gt(new Big(component.net).abs()) ? [key] : [];
  }));
}

function containsParentChildDoubleCount(
  keys: readonly CanonicalComponentKey[],
  components: ReadonlyMap<CanonicalComponentKey, EconomicComponentFact>,
): boolean {
  const parentOperations = new Set<string>();
  const leafOperations = new Set<string>();
  for (const key of keys) {
    const component = components.get(key);
    if (component?.sourceOperation.kind !== "resolved") continue;
    if (component.sourceKind === "Operation_parent") parentOperations.add(component.sourceOperation.id);
    if (component.sourceKind === "Allocation" || component.sourceKind === "Item") {
      leafOperations.add(component.sourceOperation.id);
    }
  }
  return [...parentOperations].some((operationId) => leafOperations.has(operationId));
}

export function resolveTimelineLifeEventCosts(input: Readonly<{
  occurrences: readonly ActivityOccurrenceFact[];
  assertions: readonly LifeEventCostClosureAssertion[];
  components: readonly EconomicComponentFact[];
  links: readonly ActivityCausalFinancialLink[];
}>): readonly TimelineLifeEventCost[] {
  const assertionByEvent = new Map(input.assertions.map((assertion) => [assertion.lifeEventId, assertion]));
  if (assertionByEvent.size !== input.assertions.length) {
    throw new TypeError("TIMELINE_EVENT_COST_MULTIPLE_ACTIVE_ASSERTIONS");
  }
  const componentByKey = new Map(input.components.map((component) => [component.canonicalComponentKey, component]));
  if (componentByKey.size !== input.components.length) {
    throw new TypeError("TIMELINE_EVENT_COST_DUPLICATE_CANONICAL_COMPONENT");
  }
  const engineFacts = buildActivityOccurrenceCostFacts({
    occurrences: input.occurrences,
    components: input.components,
    links: input.links,
  });
  const engineByEvent = new Map(engineFacts.map((fact) => [fact.occurrenceId, fact]));
  const conflictingAmounts = contradictoryAmountKeys(input.links);
  const overAllocated = overAllocatedKeys(componentByKey, input.links);

  return input.occurrences.map((occurrence) => {
    const assertion = assertionByEvent.get(occurrence.lifeEventId);
    if (assertion === undefined) return unresolved(occurrence.lifeEventId, "NONE", "UNKNOWN", "NO_ACTIVE_ASSERTION");
    if (assertion.householdId !== occurrence.householdId || assertion.lifeEventId !== occurrence.lifeEventId) {
      return unresolved(occurrence.lifeEventId, "CANONICAL_LINKED", "CONFLICT", "CROSS_HOUSEHOLD_ASSERTION");
    }
    const expectedKeys = sortedUniqueKeys(assertion.expectedComponentKeys);
    const eventLinks = input.links.filter(({ lifeEventId }) => lifeEventId === occurrence.lifeEventId);
    const actualKeys = sortedUniqueKeys(eventLinks.map(({ canonicalComponentKey }) => canonicalComponentKey));
    if (!sameSet(expectedKeys, actualKeys)) {
      return unresolved(occurrence.lifeEventId, "CANONICAL_LINKED", "CONFLICT", "EXPECTED_COMPONENT_SET_MISMATCH", actualKeys);
    }
    if (expectedKeys.some((key) => key.startsWith("payment_component:"))) {
      return unresolved(occurrence.lifeEventId, "CANONICAL_LINKED", "CONFLICT", "UNSUPPORTED_COMPONENT_KIND", expectedKeys);
    }
    if (assertion.closureStatus === "EXPLICIT_EMPTY") {
      return resolved(occurrence.lifeEventId, parseMoney("0"), expectedKeys);
    }
    if (expectedKeys.some((key) => !componentByKey.has(key))) {
      return unresolved(occurrence.lifeEventId, "CANONICAL_LINKED", "UNKNOWN", "MISSING_CANONICAL_COMPONENT", expectedKeys);
    }
    if (expectedKeys.some((key) => componentByKey.get(key)?.sourceKind === "Payment_component")) {
      return unresolved(occurrence.lifeEventId, "CANONICAL_LINKED", "CONFLICT", "UNSUPPORTED_COMPONENT_KIND", expectedKeys);
    }
    if (containsParentChildDoubleCount(expectedKeys, componentByKey)) {
      return unresolved(occurrence.lifeEventId, "CANONICAL_LINKED", "CONFLICT", "PARENT_CHILD_DOUBLE_COUNT", expectedKeys);
    }
    if (expectedKeys.some((key) => conflictingAmounts.has(key))) {
      return unresolved(occurrence.lifeEventId, "CANONICAL_LINKED", "CONFLICT", "CONTRADICTORY_COMPONENT_AMOUNT", expectedKeys);
    }
    if (expectedKeys.some((key) => overAllocated.has(key))) {
      return unresolved(occurrence.lifeEventId, "CANONICAL_LINKED", "CONFLICT", "OVERALLOCATED_COMPONENT", expectedKeys);
    }
    if (expectedKeys.some((key) => {
      const component = componentByKey.get(key);
      return component !== undefined && compareMoney(component.net, parseMoney("0")) < 0;
    })) {
      return unresolved(occurrence.lifeEventId, "CANONICAL_LINKED", "CONFLICT", "NEGATIVE_ECONOMIC_NET", expectedKeys);
    }
    if (eventLinks.some(({ economicAmountLinked }) => economicAmountLinked === null)) {
      return unresolved(occurrence.lifeEventId, "CANONICAL_LINKED", "UNKNOWN", "UNRESOLVED_COMPONENT_AMOUNT", expectedKeys);
    }
    const engineFact = engineByEvent.get(occurrence.lifeEventId);
    if (engineFact?.causalCost.availability !== "known") {
      return unresolved(occurrence.lifeEventId, "CANONICAL_LINKED", "UNKNOWN", "UNRESOLVED_COMPONENT_AMOUNT", expectedKeys);
    }
    if (compareMoney(engineFact.causalCost.value, parseMoney("0")) < 0) {
      return unresolved(occurrence.lifeEventId, "CANONICAL_LINKED", "CONFLICT", "NEGATIVE_ECONOMIC_NET", expectedKeys);
    }
    return resolved(occurrence.lifeEventId, engineFact.causalCost.value, expectedKeys);
  });
}
