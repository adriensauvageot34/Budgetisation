import "server-only";

import Big from "big.js";
import {
  minimalBaselineEligibilityDecision,
  selectMinimalBaselineRule,
  type MinimalBaselineRule,
  type MinimalMonthComponent,
} from "@/analytics/baseline";
import { medianMoney } from "@/analytics/references";
import type { EconomicComponentFact } from "@/analytics/facts";
import { addMoney, parseMoney, type Money } from "@/core/money";
import { parseSupport } from "@/core/metrics";
import { yearMonthOf, type YearMonth } from "@/core/time";
import type { CanonicalMinimalPlanningBundle } from "@/server/canonical/repository";
import type { CanonicalRecord } from "@/server/canonical/record";

export type MinimalSourceHealthStatus = "AVAILABLE" | "PARTIAL" | "MISSING_SOURCE";

export type MinimalSourceHealth = {
  readonly neutralVariable: MinimalSourceHealthStatus;
  readonly obligationsAndProvisions: MinimalSourceHealthStatus;
  readonly unresolvedNeutralSourceCount: number;
  readonly unresolvedObligationSourceCount: number;
};

export type MinimalPlanningResolution = {
  readonly availability: "known" | "unknown";
  readonly neutralVariableComponents: readonly MinimalMonthComponent[];
  readonly mandatoryMonthlyObligationsAndProvisions: readonly MinimalMonthComponent[];
  readonly health: MinimalSourceHealth;
};

type ComponentMetadata = {
  readonly preciseType: string | null;
  readonly role: string | null;
  readonly forecastMode: string | null;
  readonly recurrenceSeriesId: string | null;
  readonly needId: string | null;
  readonly annualEventId: string | null;
  readonly provisionPoolId: string | null;
};

type Observation = {
  readonly month: YearMonth;
  readonly amount: Money;
  readonly coveragePartial: boolean;
};

type SourceGroup = {
  readonly key: string;
  readonly mode: string;
  readonly bucket: "neutral" | "obligation";
  readonly observations: Observation[];
};

function optionalText(row: CanonicalRecord | undefined, key: string): string | null {
  const value = row?.[key];
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function optionalBoolean(row: CanonicalRecord | undefined, key: string): boolean | null {
  const value = row?.[key];
  return typeof value === "boolean" ? value : null;
}

function rowsById(rows: readonly CanonicalRecord[], key: string): ReadonlyMap<string, CanonicalRecord> {
  return new Map(rows.flatMap((row) => {
    const value = optionalText(row, key);
    return value === null ? [] : [[value, row] as const];
  }));
}

function parseRules(rows: readonly CanonicalRecord[]): readonly MinimalBaselineRule[] {
  return rows.map((row) => {
    const eligibility = optionalText(row, "eligibility");
    if (!(eligibility === "Eligible" || eligibility === "Excluded" || eligibility === "Conditional")) {
      throw new TypeError("minimal_baseline_rules.eligibility est invalide.");
    }
    const baselineRuleId = optionalText(row, "baseline_rule_id");
    const categoryId = optionalText(row, "category_id");
    const methodVersion = optionalText(row, "method_version");
    if (baselineRuleId === null || categoryId === null || methodVersion === null) {
      throw new TypeError("Une règle Minimal canonique est incomplète.");
    }
    return {
      baselineRuleId,
      categoryId,
      subcategoryId: optionalText(row, "subcategory_id"),
      preciseType: optionalText(row, "type_precis"),
      eligibility,
      conditionCode: optionalText(row, "condition_code"),
      validFrom: optionalText(row, "valid_from"),
      validTo: optionalText(row, "valid_to"),
      methodVersion,
    };
  });
}

function operationIdOf(fact: EconomicComponentFact): string | null {
  return fact.sourceOperation.kind === "resolved" ? fact.sourceOperation.id : null;
}

function componentMetadata(
  fact: EconomicComponentFact,
  sourceRows: ReadonlyMap<string, CanonicalRecord>,
  operations: ReadonlyMap<string, CanonicalRecord>,
): ComponentMetadata {
  const [kind, id] = fact.canonicalComponentKey.split(":", 2);
  const source = sourceRows.get(`${kind}:${id}`);
  const operation = operations.get(operationIdOf(fact) ?? "");
  const fromSourceOrOperation = (key: string) => optionalText(source, key) ?? optionalText(operation, key);
  const preciseType = kind === "item"
    ? optionalText(source, "nom") ?? optionalText(operation, "type_precis")
    : kind === "payment_component"
      ? optionalText(source, "component_type") ?? optionalText(operation, "type_precis")
      : optionalText(source, "type_precis") ?? optionalText(operation, "type_precis");
  return {
    preciseType,
    role: fromSourceOrOperation("role_budgetaire"),
    forecastMode: fromSourceOrOperation("mode_prevision"),
    recurrenceSeriesId: fromSourceOrOperation("recurrence_series_id"),
    needId: fromSourceOrOperation("need_id"),
    annualEventId: fromSourceOrOperation("annual_event_id"),
    provisionPoolId: fromSourceOrOperation("provision_pool_id"),
  };
}

function monthlyAmount(observations: readonly Observation[], months: readonly YearMonth[], mode: string): Money {
  const totals = new Map<YearMonth, Money>(months.map((month) => [month, parseMoney("0")]));
  for (const observation of observations) {
    totals.set(observation.month, addMoney(totals.get(observation.month) ?? parseMoney("0"), observation.amount));
  }
  const values = months.map((month) => totals.get(month) ?? parseMoney("0"));
  if (mode === "Référence mensuelle") return medianMoney(values);
  const total = values.reduce(addMoney, parseMoney("0"));
  return parseMoney(new Big(total).div(months.length).toFixed());
}

function supportForMonths(months: readonly YearMonth[]) {
  return parseSupport({
    n: months.length,
    unit: "month",
    level: months.length >= 6 ? "sufficient" : months.length >= 3 ? "limited" : "insufficient",
  });
}

function healthStatus(componentCount: number, unresolvedCount: number): MinimalSourceHealthStatus {
  if (componentCount === 0) return "MISSING_SOURCE";
  return unresolvedCount === 0 ? "AVAILABLE" : "PARTIAL";
}

function isStructural(metadata: ComponentMetadata): boolean {
  return metadata.provisionPoolId !== null ||
    metadata.annualEventId !== null ||
    metadata.forecastMode === "Échéance fixe" ||
    metadata.forecastMode === "Échéance connue" ||
    metadata.forecastMode === "Source de provision" ||
    metadata.forecastMode === "Provision annualisée";
}

function sourceKey(
  metadata: ComponentMetadata,
  rule: MinimalBaselineRule,
  activeRecurrences: ReadonlySet<string>,
  activeNeeds: ReadonlySet<string>,
  activeAnnualEvents: ReadonlySet<string>,
  structuralRecurrenceIds: ReadonlySet<string>,
): string | null {
  if (
    metadata.recurrenceSeriesId !== null &&
    structuralRecurrenceIds.has(metadata.recurrenceSeriesId)
  ) {
    return `structural-rule:${rule.baselineRuleId}:${rule.preciseType ?? "category"}`;
  }
  if (metadata.recurrenceSeriesId !== null) {
    return activeRecurrences.has(metadata.recurrenceSeriesId)
      ? `recurrence:${metadata.recurrenceSeriesId}`
      : null;
  }
  if (metadata.annualEventId !== null) {
    return activeAnnualEvents.has(metadata.annualEventId)
      ? `annual:${metadata.annualEventId}`
      : null;
  }
  if (metadata.needId !== null) {
    return activeNeeds.has(metadata.needId) ? `need:${metadata.needId}` : null;
  }
  if (metadata.forecastMode === "Référence mensuelle") return `monthly-rule:${rule.baselineRuleId}`;
  if (metadata.forecastMode === "Cadence de rachat") {
    return `cadence:${rule.baselineRuleId}:${metadata.preciseType ?? "category"}`;
  }
  if (
    metadata.forecastMode === "Échéance fixe" ||
    metadata.forecastMode === "Échéance connue" ||
    metadata.forecastMode === "Source de provision" ||
    metadata.forecastMode === "Provision annualisée"
  ) {
    return `structural-rule:${rule.baselineRuleId}:${metadata.preciseType ?? "category"}`;
  }
  return null;
}

function sourceRows(bundle: CanonicalMinimalPlanningBundle): ReadonlyMap<string, CanonicalRecord> {
  const mappings = [
    ["allocation", bundle.allocations, "allocation_id"],
    ["item", bundle.items, "item_id"],
    ["payment_component", bundle.paymentComponents, "payment_component_id"],
    ["cash_use", bundle.cashUses, "cash_use_id"],
  ] as const;
  const result = new Map<string, CanonicalRecord>();
  for (const [kind, rows, idKey] of mappings) {
    for (const row of rows) {
      const id = optionalText(row, idKey);
      if (id !== null) result.set(`${kind}:${id}`, row);
    }
  }
  for (const row of bundle.operations) {
    const id = optionalText(row, "operation_id");
    if (id !== null) result.set(`operation:${id}`, row);
  }
  return result;
}

export function resolveMinimalPlanningSource(input: {
  readonly bundle: CanonicalMinimalPlanningBundle;
  readonly targetMonth: YearMonth;
  readonly referenceMonths: readonly YearMonth[];
}): MinimalPlanningResolution {
  const { bundle, targetMonth } = input;
  const referenceMonths = [...new Set(input.referenceMonths)].sort();
  if (referenceMonths.length === 0) {
    return {
      availability: "unknown",
      neutralVariableComponents: [],
      mandatoryMonthlyObligationsAndProvisions: [],
      health: {
        neutralVariable: "MISSING_SOURCE",
        obligationsAndProvisions: "MISSING_SOURCE",
        unresolvedNeutralSourceCount: 0,
        unresolvedObligationSourceCount: 0,
      },
    };
  }

  const referenceSet = new Set(referenceMonths);
  const rules = parseRules(bundle.baselineRules);
  const operations = rowsById(bundle.operations, "operation_id");
  const components = sourceRows(bundle);
  const declaredActiveRecurrences = new Set(bundle.recurrenceSeries.flatMap((row) =>
    optionalBoolean(row, "actif_prevision") === true
      ? [optionalText(row, "recurrence_series_id")].filter((id): id is string => id !== null)
      : []));
  const activeNeeds = new Set(bundle.needs.flatMap((row) =>
    optionalBoolean(row, "actif") === true && optionalText(row, "person_id") === null
      ? [optionalText(row, "need_id")].filter((id): id is string => id !== null)
      : []));
  // Une Annual_event n'est activable qu'après preuve que sa règle
  // anti-doublon n'entre pas en concurrence avec un Moment futur concret.
  // Ce bundle ne contient pas ce producteur futur : l'absence de preuve ne
  // devient donc jamais une provision inventée.
  const activeAnnualEvents = new Set<string>();
  const activePools = rowsById(
    bundle.provisionPools.filter((row) => optionalBoolean(row, "application_auto") === true),
    "provision_pool_id",
  );
  const groups = new Map<string, SourceGroup>();
  const poolGroups = new Map<string, Observation[]>();
  const resolvedNeutralSources = new Set<string>();
  const unresolvedNeutralSources = new Set<string>();
  const resolvedObligationSources = new Set<string>();
  const unresolvedObligationSources = new Set<string>();
  const commuteRuleIds = new Set<string>();
  const recurrenceMonths = new Map<string, Set<YearMonth>>();
  const recurrenceRule = new Map<string, string>();

  for (const fact of bundle.economicFacts) {
    if (fact.category.kind !== "resolved") continue;
    const metadata = componentMetadata(fact, components, operations);
    if (
      metadata.recurrenceSeriesId === null ||
      !isStructural(metadata)
    ) continue;
    const rule = selectMinimalBaselineRule(rules, {
      categoryId: fact.category.id,
      subcategoryId: fact.subcategory.kind === "resolved" ? fact.subcategory.id : null,
      preciseType: metadata.preciseType,
      asOf: `${targetMonth}-01`,
    });
    if (rule === null || minimalBaselineEligibilityDecision(rule).kind !== "eligible") continue;
    const months = recurrenceMonths.get(metadata.recurrenceSeriesId) ?? new Set<YearMonth>();
    if (fact.economicTiming.kind === "known" || fact.economicTiming.kind === "partial") {
      for (const segment of fact.economicTiming.segments) {
        if (segment.timingState === "known" && segment.economicMonth !== null && referenceSet.has(segment.economicMonth)) {
          months.add(segment.economicMonth);
        }
      }
    }
    recurrenceMonths.set(metadata.recurrenceSeriesId, months);
    recurrenceRule.set(metadata.recurrenceSeriesId, rule.baselineRuleId);
  }
  const establishedInactiveByRule = new Map<string, Set<string>>();
  for (const [seriesId, observedMonths] of recurrenceMonths) {
    if (declaredActiveRecurrences.has(seriesId) || observedMonths.size < 3) continue;
    const ruleId = recurrenceRule.get(seriesId);
    if (ruleId === undefined) continue;
    const ids = establishedInactiveByRule.get(ruleId) ?? new Set<string>();
    ids.add(seriesId);
    establishedInactiveByRule.set(ruleId, ids);
  }
  const structuralRecurrenceIds = new Set<string>();
  for (const [ruleId, inactiveIds] of establishedInactiveByRule) {
    const historicalMonths = new Set([...inactiveIds].flatMap((id) => [...(recurrenceMonths.get(id) ?? [])]));
    for (const id of inactiveIds) structuralRecurrenceIds.add(id);
    for (const [seriesId, observedMonths] of recurrenceMonths) {
      if (
        recurrenceRule.get(seriesId) === ruleId &&
        declaredActiveRecurrences.has(seriesId) &&
        [...observedMonths].every((month) => !historicalMonths.has(month))
      ) structuralRecurrenceIds.add(seriesId);
    }
  }
  const activeRecurrences = declaredActiveRecurrences;

  for (const fact of bundle.economicFacts) {
    if (fact.category.kind !== "resolved") continue;
    const metadata = componentMetadata(fact, components, operations);
    const observations = fact.economicTiming.kind === "known" || fact.economicTiming.kind === "partial"
      ? fact.economicTiming.segments.flatMap((segment) =>
          segment.timingState === "known" && segment.economicMonth !== null && referenceSet.has(segment.economicMonth)
            ? [{ month: segment.economicMonth, amount: segment.amount, coveragePartial: fact.economicTiming.kind === "partial" }]
            : [])
      : [];
    if (observations.length === 0) continue;

    if (metadata.provisionPoolId !== null) {
      if (activePools.has(metadata.provisionPoolId)) {
        const current = poolGroups.get(metadata.provisionPoolId) ?? [];
        current.push(...observations);
        poolGroups.set(metadata.provisionPoolId, current);
      } else {
        unresolvedObligationSources.add(`provision:${metadata.provisionPoolId}`);
      }
      continue;
    }

    const rule = selectMinimalBaselineRule(rules, {
      categoryId: fact.category.id,
      subcategoryId: fact.subcategory.kind === "resolved" ? fact.subcategory.id : null,
      preciseType: metadata.preciseType,
      asOf: `${targetMonth}-01`,
    });
    if (rule === null) continue;
    const decision = minimalBaselineEligibilityDecision(rule);
    if (decision.kind === "excluded") continue;
    if (decision.kind === "condition_required") {
      if (decision.conditionCode === "RESOLVE_COMPONENTS") continue;
      if (decision.conditionCode === "WORK_COMMUTE_FUEL_ONLY") {
        commuteRuleIds.add(rule.baselineRuleId);
        continue;
      }
      (isStructural(metadata) ? unresolvedObligationSources : unresolvedNeutralSources)
        .add(`rule:${rule.baselineRuleId}`);
      continue;
    }
    const bucket = isStructural(metadata) ? "obligation" : "neutral";
    const key = sourceKey(
      metadata,
      rule,
      activeRecurrences,
      activeNeeds,
      activeAnnualEvents,
      structuralRecurrenceIds,
    );
    if (key === null || metadata.forecastMode === null) {
      (bucket === "obligation" ? unresolvedObligationSources : unresolvedNeutralSources)
        .add(`rule:${rule.baselineRuleId}`);
      continue;
    }
    const group = groups.get(key) ?? {
      key,
      mode: metadata.forecastMode,
      bucket,
      observations: [],
    };
    group.observations.push(...observations);
    groups.set(key, group);
    (bucket === "obligation" ? resolvedObligationSources : resolvedNeutralSources)
      .add(`rule:${rule.baselineRuleId}`);
  }

  const neutral: MinimalMonthComponent[] = [];
  const obligations: MinimalMonthComponent[] = [];
  for (const group of groups.values()) {
    const component: MinimalMonthComponent = {
      canonicalComponentKey: `minimal:${group.key}`,
      amount: monthlyAmount(group.observations, referenceMonths, group.mode),
      support: supportForMonths(referenceMonths),
      coverage: group.observations.some(({ coveragePartial }) => coveragePartial)
        ? { level: "partial" }
        : { level: "complete" },
      provenance: "derived",
    };
    (group.bucket === "obligation" ? obligations : neutral).push(component);
  }
  for (const [poolId, observations] of poolGroups) {
    obligations.push({
      canonicalComponentKey: `minimal:provision:${poolId}`,
      amount: monthlyAmount(observations, referenceMonths, "Provision annualisée"),
      support: supportForMonths(referenceMonths),
      coverage: observations.some(({ coveragePartial }) => coveragePartial)
        ? { level: "partial" }
        : { level: "complete" },
      provenance: "derived",
    });
    resolvedObligationSources.add(`provision:${poolId}`);
  }

  if (commuteRuleIds.size > 0) {
    const activityTypeIds = new Set(bundle.worksiteActivityTypeIds);
    const counts = new Map<YearMonth, number>(referenceMonths.map((month) => [month, 0]));
    for (const occurrence of bundle.activityOccurrences) {
      const month = yearMonthOf(occurrence.startDate);
      if (activityTypeIds.has(occurrence.activityId) && referenceSet.has(month)) {
        counts.set(month, (counts.get(month) ?? 0) + 1);
      }
    }
    const monthlyCounts = referenceMonths.map((month) => counts.get(month) ?? 0).sort((a, b) => a - b);
    if (activityTypeIds.size > 0 && monthlyCounts.some((count) => count > 0)) {
      const middle = Math.floor(monthlyCounts.length / 2);
      const medianDays = monthlyCounts.length % 2 === 0
        ? (monthlyCounts[middle - 1]! + monthlyCounts[middle]!) / 2
        : monthlyCounts[middle]!;
      neutral.push({
        canonicalComponentKey: "minimal:conditional:work-commute-fuel",
        amount: parseMoney(new Big(medianDays).times(2).times("0.85").toFixed()),
        support: supportForMonths(referenceMonths),
        coverage: { level: "complete" },
        provenance: "estimated",
      });
      for (const ruleId of commuteRuleIds) resolvedNeutralSources.add(`rule:${ruleId}`);
    } else {
      for (const ruleId of commuteRuleIds) unresolvedNeutralSources.add(`rule:${ruleId}`);
    }
  }

  neutral.sort((left, right) => left.canonicalComponentKey.localeCompare(right.canonicalComponentKey));
  obligations.sort((left, right) => left.canonicalComponentKey.localeCompare(right.canonicalComponentKey));
  const unresolvedNeutral = [...unresolvedNeutralSources]
    .filter((source) => !resolvedNeutralSources.has(source)).length;
  const unresolvedObligation = [...unresolvedObligationSources]
    .filter((source) => !resolvedObligationSources.has(source)).length;
  const health: MinimalSourceHealth = {
    neutralVariable: healthStatus(neutral.length, unresolvedNeutral),
    obligationsAndProvisions: healthStatus(obligations.length, unresolvedObligation),
    unresolvedNeutralSourceCount: unresolvedNeutral,
    unresolvedObligationSourceCount: unresolvedObligation,
  };
  return {
    availability:
      health.neutralVariable === "MISSING_SOURCE" || health.obligationsAndProvisions === "MISSING_SOURCE"
        ? "unknown"
        : "known",
    neutralVariableComponents: neutral,
    mandatoryMonthlyObligationsAndProvisions: obligations,
    health,
  };
}
