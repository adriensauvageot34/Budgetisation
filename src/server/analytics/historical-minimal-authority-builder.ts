import "server-only";

import Big from "big.js";

import {
  HISTORICAL_MINIMAL_AUTHORITY_MODEL,
  selectMinimalBaselineRule,
  type HistoricalMinimalAuthorityBundle,
  type HistoricalMinimalComponentPlan,
  type HistoricalMinimalObservation,
  type HistoricalMinimalRuleAuthority,
  type HistoricalMinimalRuleVersion,
  type HistoricalRecurrenceAuthority,
  type HistoricalRecurrenceStateVersion,
  type MinimalBaselineRule,
} from "@/analytics/baseline";
import { medianMoney } from "@/analytics/references";
import type { EconomicComponentFact } from "@/analytics/facts";
import { addMoney, parseMoney, type Money } from "@/core/money";
import { parseYearMonth, type Instant, type YearMonth } from "@/core/time";
import type {
  CanonicalHistoricalMinimalAuthority,
  CanonicalMinimalPlanningBundle,
} from "@/server/canonical/repository";
import type { CanonicalRecord } from "@/server/canonical/record";

type FactMatch = {
  readonly fact: EconomicComponentFact;
  readonly recurrenceSeriesId: string | null;
};

function optionalText(row: CanonicalRecord | undefined, key: string): string | null {
  const value = row?.[key];
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function rowsById(rows: readonly CanonicalRecord[], key: string): ReadonlyMap<string, CanonicalRecord> {
  return new Map(rows.flatMap((row) => {
    const value = optionalText(row, key);
    return value === null ? [] : [[value, row] as const];
  }));
}

function parseIdentityRules(rows: readonly CanonicalRecord[]): readonly MinimalBaselineRule[] {
  return rows.map((row) => {
    const baselineRuleId = optionalText(row, "baseline_rule_id");
    const categoryId = optionalText(row, "category_id");
    const methodVersion = optionalText(row, "method_version");
    const eligibility = optionalText(row, "eligibility");
    if (
      baselineRuleId === null || categoryId === null || methodVersion === null ||
      !(eligibility === "Eligible" || eligibility === "Excluded" || eligibility === "Conditional")
    ) {
      throw new TypeError("Une identité de règle Minimal canonique est incomplète.");
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

function sourceRows(bundle: CanonicalMinimalPlanningBundle): ReadonlyMap<string, CanonicalRecord> {
  const result = new Map<string, CanonicalRecord>();
  const mappings = [
    ["allocation", bundle.allocations, "allocation_id"],
    ["item", bundle.items, "item_id"],
    ["payment_component", bundle.paymentComponents, "payment_component_id"],
    ["cash_use", bundle.cashUses, "cash_use_id"],
    ["operation", bundle.operations, "operation_id"],
  ] as const;
  for (const [kind, rows, idKey] of mappings) {
    for (const row of rows) {
      const id = optionalText(row, idKey);
      if (id !== null) result.set(`${kind}:${id}`, row);
    }
  }
  return result;
}

function factMetadata(
  fact: EconomicComponentFact,
  sources: ReadonlyMap<string, CanonicalRecord>,
  operations: ReadonlyMap<string, CanonicalRecord>,
): { readonly preciseType: string | null; readonly recurrenceSeriesId: string | null } {
  const separator = fact.canonicalComponentKey.indexOf(":");
  const kind = separator < 0 ? "" : fact.canonicalComponentKey.slice(0, separator);
  const source = sources.get(fact.canonicalComponentKey);
  const operation = fact.sourceOperation.kind === "resolved"
    ? operations.get(fact.sourceOperation.id)
    : undefined;
  const preciseType = kind === "item"
    ? optionalText(source, "nom") ?? optionalText(operation, "type_precis")
    : kind === "payment_component"
      ? optionalText(source, "component_type") ?? optionalText(operation, "type_precis")
      : optionalText(source, "type_precis") ?? optionalText(operation, "type_precis");
  return {
    preciseType,
    recurrenceSeriesId: optionalText(source, "recurrence_series_id") ??
      optionalText(operation, "recurrence_series_id"),
  };
}

function ruleAuthority(version: HistoricalMinimalRuleVersion): HistoricalMinimalRuleAuthority {
  return {
    authorityId: version.ruleVersionId,
    family: version.masterRuleFamily,
    effectiveFrom: version.effectiveFrom,
    ...(version.effectiveTo === undefined ? {} : { effectiveTo: version.effectiveTo }),
    declaredAt: version.declaredAt,
    sourceRevision: version.sourceRevision,
    authorityType: version.authorityType,
    declaredByRef: version.declaredByRef,
    validationRef: version.validationRef,
    methodVersion: version.methodVersion,
    evidenceRefs: version.evidenceRefs,
  };
}

function knownObservations(matches: readonly FactMatch[]): readonly HistoricalMinimalObservation[] {
  const monthly = new Map<YearMonth, Money>();
  const evidence = new Map<YearMonth, Set<string>>();
  for (const { fact } of matches) {
    if (fact.economicTiming.kind !== "known" && fact.economicTiming.kind !== "partial") continue;
    for (const segment of fact.economicTiming.segments) {
      if (segment.timingState !== "known" || segment.economicMonth === null) continue;
      const month = parseYearMonth(segment.economicMonth);
      monthly.set(month, addMoney(monthly.get(month) ?? parseMoney("0"), segment.amount));
      const refs = evidence.get(month) ?? new Set<string>();
      refs.add(`fact:${fact.canonicalComponentKey}`);
      evidence.set(month, refs);
    }
  }
  return [...monthly.entries()].sort(([left], [right]) => left.localeCompare(right)).map(([month, amount]) => ({
    month,
    status: "KNOWN" as const,
    amount,
    eligible: true,
    evidenceRefs: [...(evidence.get(month) ?? [])].sort(),
  }));
}

function recurrenceMonthlyEquivalent(matches: readonly FactMatch[]): Money | undefined {
  const occurrences = new Map<string, Money>();
  for (const { fact } of matches) {
    if (fact.sourceOperation.kind !== "resolved") continue;
    if (fact.economicTiming.kind !== "known" && fact.economicTiming.kind !== "partial") continue;
    for (const segment of fact.economicTiming.segments) {
      if (segment.timingState !== "known" || segment.economicMonth === null) continue;
      const key = `${fact.sourceOperation.id}:${segment.periodStart ?? segment.economicMonth}`;
      occurrences.set(key, addMoney(occurrences.get(key) ?? parseMoney("0"), segment.amount));
    }
  }
  const amounts = [...occurrences.values()];
  return amounts.length === 0 ? undefined : medianMoney(amounts);
}

function recurrenceAuthority(
  version: HistoricalRecurrenceStateVersion,
  monthlyEquivalent: Money,
): HistoricalRecurrenceAuthority {
  return {
    authorityId: version.stateVersionId,
    state: version.historicalState,
    monthlyEquivalent,
    effectiveFrom: version.effectiveFrom,
    ...(version.effectiveTo === undefined ? {} : { effectiveTo: version.effectiveTo }),
    declaredAt: version.declaredAt,
    sourceRevision: version.sourceRevision,
    authorityType: version.authorityType,
    declaredByRef: version.declaredByRef,
    validationRef: version.validationRef,
    methodVersion: version.methodVersion,
    evidenceRefs: version.evidenceRefs,
  };
}

/**
 * Builds the executable Minimal authority from versioned declarations and
 * Canonical observations. Current-state forecast flags and History snapshots
 * are deliberately absent from this projection.
 */
export function buildHistoricalMinimalAuthorityBundle(input: {
  readonly bundle: CanonicalMinimalPlanningBundle;
  readonly authority: CanonicalHistoricalMinimalAuthority;
  readonly knowledgeAsOf: Instant;
}): HistoricalMinimalAuthorityBundle {
  const identityRules = parseIdentityRules(input.bundle.baselineRules);
  const identityById = new Map(identityRules.map((rule) => [rule.baselineRuleId, rule]));
  const sources = sourceRows(input.bundle);
  const operations = rowsById(input.bundle.operations, "operation_id");
  const recurrenceSeries = rowsById(input.bundle.recurrenceSeries, "recurrence_series_id");
  const matchesByRule = new Map<string, FactMatch[]>();
  for (const fact of input.bundle.economicFacts) {
    if (fact.category.kind !== "resolved") continue;
    const metadata = factMetadata(fact, sources, operations);
    const identity = selectMinimalBaselineRule(identityRules, {
      categoryId: fact.category.id,
      subcategoryId: fact.subcategory.kind === "resolved" ? fact.subcategory.id : null,
      preciseType: metadata.preciseType,
      asOf: "9999-12-31",
    });
    if (identity === null) continue;
    const current = matchesByRule.get(identity.baselineRuleId) ?? [];
    current.push({ fact, recurrenceSeriesId: metadata.recurrenceSeriesId });
    matchesByRule.set(identity.baselineRuleId, current);
  }

  const recurrenceById = new Map(input.authority.recurrenceStateVersions.map((version) => [
    version.recurrenceSeriesId,
    version,
  ]));
  const components = input.authority.ruleVersions.flatMap<HistoricalMinimalComponentPlan>((version) => {
    if (!identityById.has(version.baselineRuleId)) {
      throw new TypeError(`Identité de règle Minimal absente: ${version.baselineRuleId}.`);
    }
    const matches = matchesByRule.get(version.baselineRuleId) ?? [];
    const rule = ruleAuthority(version);
    if (version.masterRuleFamily === "VARIABLE_ESSENTIAL") {
      const observations = version.conditionCode === "WORK_COMMUTE_FUEL_ONLY"
        ? []
        : knownObservations(matches);
      return [{
        canonicalComponentKey: `minimal:variable-rule:${version.baselineRuleId}`,
        bucket: "NEUTRAL_VARIABLE" as const,
        rule,
        observations,
      }];
    }
    if (version.masterRuleFamily === "EXCLUDED_FROM_MINIMAL") {
      return [{
        canonicalComponentKey: `minimal:excluded-rule:${version.baselineRuleId}`,
        bucket: "NEUTRAL_VARIABLE" as const,
        rule,
        observations: [],
      }];
    }
    if (version.masterRuleFamily === "DECLARED_MINIMUM") {
      return [{
        canonicalComponentKey: `minimal:declared-rule:${version.baselineRuleId}`,
        bucket: "OBLIGATION_OR_PROVISION" as const,
        rule,
        observations: [],
      }];
    }
    const recurrenceIds = [...new Set(matches.flatMap(({ recurrenceSeriesId }) =>
      recurrenceSeriesId === null ? [] : [recurrenceSeriesId]))].sort();
    if (recurrenceIds.length === 0) {
      return [{
        canonicalComponentKey: `minimal:required-rule:${version.baselineRuleId}`,
        bucket: "OBLIGATION_OR_PROVISION" as const,
        rule,
        observations: knownObservations(matches),
      }];
    }
    return recurrenceIds.map((recurrenceSeriesId) => {
      const recurrenceMatches = matches.filter((match) => match.recurrenceSeriesId === recurrenceSeriesId);
      const state = recurrenceById.get(recurrenceSeriesId);
      const cadence = optionalText(recurrenceSeries.get(recurrenceSeriesId), "cadence_estimee");
      const equivalent = cadence === "Mensuelle"
        ? recurrenceMonthlyEquivalent(recurrenceMatches)
        : undefined;
      return {
        canonicalComponentKey: `minimal:recurrence:${recurrenceSeriesId}`,
        bucket: "OBLIGATION_OR_PROVISION" as const,
        rule,
        observations: knownObservations(recurrenceMatches),
        ...(state === undefined || equivalent === undefined
          ? {}
          : { recurrenceAuthority: recurrenceAuthority(state, equivalent) }),
      };
    });
  }).sort((left, right) => left.canonicalComponentKey.localeCompare(right.canonicalComponentKey));

  return {
    model: HISTORICAL_MINIMAL_AUTHORITY_MODEL,
    completeness: "COMPLETE_FOR_TARGET_MONTH",
    knowledgeAsOf: input.knowledgeAsOf,
    components,
  };
}
