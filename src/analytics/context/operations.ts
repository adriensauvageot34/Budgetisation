import { parseMetricId } from "../../core/identity";
import { parsePersonId } from "../../core/identity";
import { addMoney, parseDecimalString, parseMoney, type Money } from "../../core/money";
import Big from "big.js";
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
  PersonEconomicAttributionContribution,
  PersonEconomicAttributionCoverage,
  PersonEconomicSelection,
  UnattributedEconomicContribution,
} from "./types";

const asMoney = (value: Big): Money => parseMoney(value.toFixed());

export function resolveEconomicComponentPersonCoverage(
  values: readonly unknown[],
): PersonEconomicAttributionCoverage {
  const components = dedupeEconomicComponents(values);
  const attributedContributions: PersonEconomicAttributionContribution[] = [];
  const unattributedContributions: UnattributedEconomicContribution[] = [];
  const conflicts: string[] = [];
  let eligibleAbsoluteAmount = new Big(0);
  let attributedAbsoluteAmount = new Big(0);
  let attributableNet = new Big(0);
  let unattributableNet = new Big(0);
  let fullyAttributedComponentCount = 0;

  for (const component of components) {
    const amount = new Big(component.net);
    eligibleAbsoluteAmount = eligibleAbsoluteAmount.plus(amount.abs());
    const person = component.person;
    const shares = person.kind === "resolved"
      ? [{ personId: person.id, share: parseDecimalString("1") }]
      : person.kind === "shared" || person.kind === "partial"
        ? person.shares
        : [];
    const coveredShare = shares.reduce((sum, entry) => sum.plus(entry.share), new Big(0));
    for (const share of shares) {
      const contributionAmount = amount.times(share.share);
      attributedContributions.push({
        canonicalComponentKey: component.canonicalComponentKey,
        personId: share.personId,
        share: share.share,
        amount: asMoney(contributionAmount),
      });
      attributableNet = attributableNet.plus(contributionAmount);
      attributedAbsoluteAmount = attributedAbsoluteAmount.plus(amount.abs().times(share.share));
    }
    if (coveredShare.eq(1)) {
      fullyAttributedComponentCount += 1;
      continue;
    }
    const remainder = new Big(1).minus(coveredShare);
    const remainderAmount = amount.times(remainder);
    const reason = person.kind === "partial"
      ? "PARTIAL"
      : person.kind === "conflict"
        ? "CONFLICT"
        : person.kind === "not_applicable"
          ? "NOT_APPLICABLE"
          : "UNKNOWN";
    unattributedContributions.push({
      canonicalComponentKey: component.canonicalComponentKey,
      share: parseDecimalString(remainder.toFixed()),
      amount: asMoney(remainderAmount),
      reason,
    });
    unattributableNet = unattributableNet.plus(remainderAmount);
    if (reason === "CONFLICT") conflicts.push(component.canonicalComponentKey);
  }

  const componentCoverageRatio = components.length === 0
    ? undefined
    : parseDecimalString(new Big(fullyAttributedComponentCount).div(components.length).toFixed());
  const amountCoverageRatio = eligibleAbsoluteAmount.eq(0)
    ? undefined
    : parseDecimalString(attributedAbsoluteAmount.div(eligibleAbsoluteAmount).toFixed());
  return {
    attributedContributions,
    unattributedContributions,
    eligibleComponentCount: components.length,
    fullyAttributedComponentCount,
    eligibleAbsoluteAmount: asMoney(eligibleAbsoluteAmount),
    attributedAbsoluteAmount: asMoney(attributedAbsoluteAmount),
    attributableNet: asMoney(attributableNet),
    unattributableNet: asMoney(unattributableNet),
    ...(componentCoverageRatio === undefined ? {} : { componentCoverageRatio }),
    ...(amountCoverageRatio === undefined ? {} : { amountCoverageRatio }),
    conflictComponentKeys: [...new Set(conflicts)].sort(),
  };
}

export function selectEconomicComponentsForPersonWithCoverage(
  values: readonly unknown[],
  personIdValue: unknown,
): PersonEconomicSelection {
  const personId = parsePersonId(personIdValue);
  const coverage = resolveEconomicComponentPersonCoverage(values);
  const selectedContributions = coverage.attributedContributions.filter(
    (contribution) => contribution.personId === personId,
  );
  const selectedNet = selectedContributions.reduce(
    (sum, contribution) => addMoney(sum, contribution.amount),
    parseMoney("0"),
  );
  return { ...coverage, personId, selectedContributions, selectedNet };
}

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

function matchesEconomicTime(
  component: EconomicComponentFact,
  months: ReadonlySet<string>,
): boolean {
  if (
    component.economicTiming.kind === "known" ||
    component.economicTiming.kind === "partial"
  ) {
    return component.economicTiming.segments.some(
      ({ economicMonth }) => economicMonth !== null && months.has(economicMonth),
    );
  }
  return component.bankDate.kind === "known" &&
    months.has(component.bankDate.date.slice(0, 7));
}

export function selectEconomicComponentsForScope(
  values: readonly unknown[],
  scope: AnalysisScope,
): readonly EconomicComponentFact[] {
  const normalized = normalizeAnalysisScope(scope);
  const months = economicMonths(normalized);
  return selectEconomicComponentsForSubject(values, normalized.subject).filter(
    (component) =>
      matchesEconomicTime(component, months) &&
      matchesEconomicDimensions(component, normalized),
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
