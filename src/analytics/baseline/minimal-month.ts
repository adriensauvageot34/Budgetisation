import { addMoney, parseMoney, type Money } from "../../core/money";
import type { Coverage, Provenance, Support, SupportLevel } from "../../core/metrics";
import { parseMethodVersion, type MethodVersion } from "../../core/versions";

export const MINIMAL_MONTH_METHOD_VERSION: MethodVersion = parseMethodVersion("minimal_month_cost@v1");
export const MINIMAL_BASELINE_RULE_METHOD_VERSION = "minimal_baseline_v1" as const;

export type MinimalBaselineEligibility = "Eligible" | "Excluded" | "Conditional";
export type MinimalBaselineRule = {
  readonly baselineRuleId: string;
  readonly categoryId: string;
  readonly subcategoryId: string | null;
  readonly preciseType: string | null;
  readonly eligibility: MinimalBaselineEligibility;
  readonly conditionCode: string | null;
  readonly validFrom: string | null;
  readonly validTo: string | null;
  readonly methodVersion: string;
};

export type MinimalBaselineSubject = {
  readonly categoryId: string;
  readonly subcategoryId: string | null;
  readonly preciseType: string | null;
  readonly asOf: string;
};

export type MinimalBaselineEligibilityDecision =
  | { readonly kind: "eligible" }
  | { readonly kind: "excluded" }
  | { readonly kind: "condition_required"; readonly conditionCode: string };

export type MinimalMonthComponent = {
  readonly canonicalComponentKey: string;
  readonly amount: Money;
  readonly support: Support;
  readonly coverage: Coverage;
  readonly provenance: Provenance;
};

function activeOn(rule: MinimalBaselineRule, asOf: string): boolean {
  return (rule.validFrom === null || rule.validFrom <= asOf) &&
    (rule.validTo === null || rule.validTo >= asOf);
}

function specificity(rule: MinimalBaselineRule, subject: MinimalBaselineSubject): number {
  if (rule.categoryId !== subject.categoryId) return -1;
  if (rule.subcategoryId !== null && rule.subcategoryId !== subject.subcategoryId) return -1;
  if (rule.preciseType !== null && rule.preciseType !== subject.preciseType) return -1;
  if (rule.preciseType !== null) return 3;
  if (rule.subcategoryId !== null) return 2;
  return 1;
}

export function minimalBaselineEligibilityDecision(
  rule: MinimalBaselineRule,
): MinimalBaselineEligibilityDecision {
  if (rule.eligibility === "Eligible") return { kind: "eligible" };
  if (rule.eligibility === "Excluded") return { kind: "excluded" };
  if (rule.conditionCode === null || rule.conditionCode.trim().length === 0) {
    throw new TypeError("Une règle minimale conditionnelle doit nommer sa condition officielle.");
  }
  return { kind: "condition_required", conditionCode: rule.conditionCode };
}

export function selectMinimalBaselineRule(
  rules: readonly MinimalBaselineRule[],
  subject: MinimalBaselineSubject,
): MinimalBaselineRule | null {
  const candidates = rules
    .filter((rule) => rule.methodVersion === MINIMAL_BASELINE_RULE_METHOD_VERSION)
    .filter((rule) => activeOn(rule, subject.asOf))
    .map((rule) => ({ rule, specificity: specificity(rule, subject) }))
    .filter(({ specificity: value }) => value > 0)
    .sort((left, right) => right.specificity - left.specificity || left.rule.baselineRuleId.localeCompare(right.rule.baselineRuleId));
  const winner = candidates[0];
  if (winner === undefined) return null;
  const samePrecedence = candidates.filter(({ specificity: value }) => value === winner.specificity);
  if (samePrecedence.some(({ rule }) => rule.eligibility !== winner.rule.eligibility || rule.conditionCode !== winner.rule.conditionCode)) {
    throw new TypeError("Deux règles minimales actives se contredisent à la même précédence.");
  }
  return winner.rule;
}

const supportOrder: Record<SupportLevel, number> = {
  insufficient: 0,
  limited: 1,
  sufficient: 2,
};

export function weakestMaterialSupport(components: readonly MinimalMonthComponent[]): Support | undefined {
  if (components.length === 0) return undefined;
  return components
    .map(({ support }) => support)
    .sort((left, right) => supportOrder[left.level] - supportOrder[right.level] || left.n - right.n)[0];
}

export function calculateMinimalMonthCost(input: {
  readonly neutralVariableComponents: readonly MinimalMonthComponent[];
  readonly mandatoryMonthlyObligationsAndProvisions: readonly MinimalMonthComponent[];
}): {
  readonly value: Money;
  readonly support?: Support;
  readonly coverage: Coverage;
  readonly provenance: "derived";
  readonly methodVersion: MethodVersion;
} {
  const components = [
    ...input.neutralVariableComponents,
    ...input.mandatoryMonthlyObligationsAndProvisions,
  ];
  const keys = components.map(({ canonicalComponentKey }) => canonicalComponentKey);
  if (new Set(keys).size !== keys.length) {
    throw new TypeError("Une composante minimale ne peut pas être comptée dans le neutre et dans les obligations.");
  }
  const value = components.reduce((sum, component) => addMoney(sum, component.amount), parseMoney("0"));
  const support = weakestMaterialSupport(components);
  return {
    value,
    ...(support === undefined ? {} : { support }),
    coverage: components.every(({ coverage }) => coverage.level === "complete")
      ? { level: "complete" }
      : { level: "partial" },
    provenance: "derived",
    methodVersion: MINIMAL_MONTH_METHOD_VERSION,
  };
}
