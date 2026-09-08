import Big from "big.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex, utf8ToBytes } from "@noble/hashes/utils.js";
import type { MinimalMonthComponent } from "../baseline";
import type { EconomicComponentFact } from "../facts";
import { selectEconomicComponentsForPersonWithCoverage } from "../context";
import { buildBankEconomyBridge } from "../history-v2/month-balance/engine";
import type {
  BankEconomyBridge,
  BankEconomyBridgeLine,
} from "../history-v2/month-balance/types";
import type { ProducedMoneyMetric } from "../production";
import {
  calculateTypicalMonthCost,
  medianMoney,
  selectComparisonReferenceWindow,
  selectCurrentReferenceWindow,
  TYPICAL_MONTH_REQUESTED_PERIOD_COUNT,
  type ReferencePeriodCandidate,
} from "../references";
import {
  canonicalSerializeGlobal,
  parseGlobalDependencyDeclaration,
  parseGlobalKnowledgeValue,
  parseGlobalSupport,
  type GlobalKnowledgeValue,
  type GlobalDependencyDeclaration,
  type GlobalPersonScopePolicy,
  type GlobalSupport,
  type GlobalValueProvenance,
} from "../../core/global-v2";
import type { HouseholdId, PersonId } from "../../core/identity";
import { addMoney, parseMoney, type Money } from "../../core/money";
import type { HouseholdTimeZone, LocalDate, YearMonth } from "../../core/time";
import { parseMethodVersion, type MethodVersion } from "../../core/versions";

const ZERO = parseMoney("0");
const GLOBAL_M1_METHOD = parseMethodVersion("global_economic_function@v3");

export const globalM1Policies = {
  timeWindow: "global-economic-month-window@v1",
  typicalSupport: "global-typical-support@v1",
  classificationCoverage: "global-economic-classification-coverage@v1",
  recurrence: "global-structural-recurrence@v1",
} as const;

export type GlobalM1DeferredTemporalOutputs = {
  readonly trend: { readonly status: "DEFERRED"; readonly owner: "P04" };
  readonly stability: { readonly status: "DEFERRED"; readonly owner: "P04" };
  readonly recentChange: { readonly status: "DEFERRED"; readonly owner: "P04" };
};

export const globalM1DeferredTemporalOutputs: GlobalM1DeferredTemporalOutputs = {
  trend: { status: "DEFERRED", owner: "P04" },
  stability: { status: "DEFERRED", owner: "P04" },
  recentChange: { status: "DEFERRED", owner: "P04" },
};

export type OfficialMonthlyEconomicInput = {
  readonly month: YearMonth;
  readonly actual: ProducedMoneyMetric;
  readonly isComplete: boolean;
  readonly isComparable: boolean;
  readonly isMethodExcluded: boolean;
  readonly dependencyRefs: readonly string[];
};

export type GlobalTypicalPair = {
  readonly reference: GlobalKnowledgeValue<Money>;
  readonly state: GlobalKnowledgeValue<Money>;
  readonly referenceMonths: readonly YearMonth[];
  readonly stateMonths: readonly YearMonth[];
  readonly inputHash: string;
};

export type GlobalMinimalAuthority = {
  readonly metric: ProducedMoneyMetric;
  readonly neutralVariableComponents: readonly MinimalMonthComponent[];
  readonly mandatoryMonthlyObligationsAndProvisions: readonly MinimalMonthComponent[];
  readonly inputHash: string;
};

export type GlobalEconomicStructureAxis = {
  readonly amounts: Readonly<Record<string, Money>>;
  readonly unknownAmount: Money;
  readonly conflictAmount: Money;
  readonly classifiedComponentCount: number;
  readonly eligibleComponentCount: number;
  readonly coverage: number | null;
};

export type GlobalEconomicStructure = {
  readonly necessity: GlobalEconomicStructureAxis;
  readonly behavior: GlobalEconomicStructureAxis;
  readonly lifeScope: GlobalEconomicStructureAxis;
  readonly inputHash: string;
};

export type GlobalEconomicStructureComponent = {
  readonly canonicalComponentKey: string;
  readonly amount: Money;
  readonly necessity: EconomicComponentFact["necessity"];
  readonly behavior: EconomicComponentFact["behavior"];
  readonly lifeScope: EconomicComponentFact["lifeScope"];
};

export type GlobalPersonalEconomicSelection = {
  readonly value: GlobalKnowledgeValue<Money>;
  readonly attributableAmount: Money;
  readonly unattributableAmount: Money;
  readonly eligibleComponentCount: number;
  readonly fullyAttributedComponentCount: number;
  readonly amountCoverage: number | null;
  readonly conflictComponentKeys: readonly string[];
  readonly inputHash: string;
};

export type GlobalStructuralRecurrenceCandidate = {
  readonly recurrenceId: string;
  readonly kind: "CONTRACTUAL" | "EMPIRICAL";
  readonly expectedOccurrenceAmount: Money;
  readonly expectedOccurrencesPerYear: number;
  readonly validFrom: LocalDate;
  readonly validTo?: LocalDate;
  readonly authority:
    | "ACTIVE_CONTRACT"
    | "EXPLICIT_FUTURE_AMOUNT"
    | "HISTORICAL_ROBUST_ESTIMATE"
    | "SINGLE_OCCURRENCE";
  readonly minimalEligible: boolean;
  readonly dependencyRefs: readonly string[];
  /** Eligible observed occurrence costs only; absence is not a zero sample. */
  readonly eligibleOccurrenceCosts?: readonly Money[];
};

export type GlobalTypicalOccurrenceCost = GlobalKnowledgeValue<Money> & {
  readonly unit: "EUR/occurrence";
};

export type GlobalStructuralRecurrence = Omit<GlobalStructuralRecurrenceCandidate, "eligibleOccurrenceCosts"> & {
  readonly monthlyEquivalent: Money;
  readonly typicalOccurrenceCost: GlobalTypicalOccurrenceCost;
  readonly knowledge: "KNOWN" | "PARTIAL";
};

export type GlobalStructuralChange = {
  readonly newRecurringEquivalent: Money;
  readonly endedRecurringEquivalent: Money;
  readonly priceChangeExistingRecurrences: Money;
  readonly active: readonly GlobalStructuralRecurrence[];
  readonly inputHash: string;
};

function digest(label: string, value: unknown): string {
  return bytesToHex(sha256(utf8ToBytes(`${label}\n${canonicalSerializeGlobal(value)}`)));
}

function moneyFromBig(value: Big): Money {
  return parseMoney(value.toFixed());
}

function sumMoney(values: readonly Money[]): Money {
  return values.reduce(addMoney, ZERO);
}

function globalSupport(included: number, observed: number, eligible: number): GlobalSupport {
  return parseGlobalSupport({
    naturalGrain: "MONTH",
    eligibleUnits: eligible,
    observedUnits: observed,
    includedUnits: included,
    excludedObservedUnits: observed - included,
    minimumRequired: 6,
    supportStatus: included < 6 ? "INSUFFICIENT" : included >= 12 ? "STRONG" : "SUFFICIENT",
    gapCount: eligible - observed,
    policyRef: globalM1Policies.typicalSupport,
  });
}

function knowledgeFromProduced(
  metric: ProducedMoneyMetric,
  provenance?: GlobalValueProvenance,
): GlobalKnowledgeValue<Money> {
  const qualification = provenance === undefined ? {} : { provenance };
  if (metric.availability === "known") {
    return parseGlobalKnowledgeValue(
      metric.coverage?.level === "partial"
        ? {
            status: "PARTIAL",
            value: metric.value,
            partialMeaning: "OBSERVED_ONLY",
            partialReasons: ["PARTIAL_SOURCE"],
            ...qualification,
          }
        : { status: "KNOWN", value: metric.value, ...qualification },
      parseMoney,
    );
  }
  const status = metric.availability === "not_applicable"
    ? "NOT_APPLICABLE"
    : metric.availability === "conflict" ? "CONFLICT" : "UNKNOWN";
  return parseGlobalKnowledgeValue({ status, ...qualification }, parseMoney);
}

function typicalKnowledge(
  metric: ReturnType<typeof calculateTypicalMonthCost>,
  eligible: number,
  observed: number,
): GlobalKnowledgeValue<Money> {
  const support = globalSupport(metric.effectivePeriodCount, observed, eligible);
  if (metric.effectivePeriodCount < 6 || metric.availability !== "known") {
    return { status: "UNKNOWN", support };
  }
  return { status: "KNOWN", value: metric.value, support };
}

/**
 * Adapts the official Actual producer and official Typical calculator. The
 * target month is strictly excluded from TypicalReference and is admissible
 * in TypicalState; PARTIAL months never enter either median.
 */
export function buildGlobalTypicalPair(input: {
  readonly householdId: HouseholdId;
  readonly householdTimeZone: HouseholdTimeZone;
  readonly targetMonth: YearMonth;
  readonly months: readonly OfficialMonthlyEconomicInput[];
}): GlobalTypicalPair {
  const ordered = [...input.months].sort((a, b) => a.month.localeCompare(b.month));
  if (new Set(ordered.map(({ month }) => month)).size !== ordered.length) {
    throw new TypeError("M1 refuse deux autorités Actual pour le même mois.");
  }
  const candidates: ReferencePeriodCandidate[] = ordered.map((month) => ({
    householdId: input.householdId,
    period: month.month,
    isComplete: month.isComplete && month.actual.availability === "known" && month.actual.coverage?.level !== "partial",
    isComparable: month.isComparable,
    isMethodExcluded: month.isMethodExcluded,
  }));
  const observations = ordered
    .filter(({ actual }) => actual.availability === "known")
    .map(({ month, actual }) => ({ month, value: actual.value }));
  const byMonth = new Map(observations.map(({ month, value }) => [month, value]));
  const referenceWindow = selectComparisonReferenceWindow({
    householdId: input.householdId,
    householdTimeZone: input.householdTimeZone,
    targetPeriod: input.targetMonth,
    requestedPeriodCount: TYPICAL_MONTH_REQUESTED_PERIOD_COUNT,
    candidates,
  });
  const stateWindow = selectCurrentReferenceWindow({
    householdId: input.householdId,
    householdTimeZone: input.householdTimeZone,
    asOf: input.targetMonth,
    requestedPeriodCount: TYPICAL_MONTH_REQUESTED_PERIOD_COUNT,
    candidates,
  });
  const calculate = (window: typeof referenceWindow) => calculateTypicalMonthCost({
    window,
    monthlyObservations: window.includedPeriods.map((period) => ({
      period,
      value: byMonth.get(period) ?? (() => { throw new TypeError(`Actual officiel absent pour ${period}.`); })(),
    })),
  });
  const referenceMetric = calculate(referenceWindow);
  const stateMetric = calculate(stateWindow);
  const referenceEligible = candidates.filter(({ period, isComplete }) => period < input.targetMonth && isComplete);
  const stateEligible = candidates.filter(({ period, isComplete }) => period <= input.targetMonth && isComplete);
  const isObserved = ({ period }: ReferencePeriodCandidate) => byMonth.has(period);
  return {
    reference: typicalKnowledge(referenceMetric, referenceEligible.length, referenceEligible.filter(isObserved).length),
    state: typicalKnowledge(stateMetric, stateEligible.length, stateEligible.filter(isObserved).length),
    referenceMonths: referenceWindow.includedPeriods,
    stateMonths: stateWindow.includedPeriods,
    inputHash: digest("global-m1-typical-input@v1", {
      targetMonth: input.targetMonth,
      candidates,
      observations,
      policy: globalM1Policies.typicalSupport,
      methodVersion: referenceMetric.methodVersion,
    }),
  };
}

export function adaptGlobalActual(
  metric: ProducedMoneyMetric,
  provenance?: GlobalValueProvenance,
): { readonly value: GlobalKnowledgeValue<Money>; readonly inputHash: string } {
  if (String(metric.metricId) !== "economic_consumption_net_attributable") {
    throw new TypeError("M1 Actual exige le producteur économique net officiel.");
  }
  return {
    value: knowledgeFromProduced(metric, provenance),
    inputHash: digest("global-m1-actual-input@v1", metric),
  };
}

/**
 * P01 attribution adapter. Only beneficiary/share evidence contributes to a
 * Person amount; payer-only and unresolved remainders remain explicit gaps.
 */
export function buildGlobalPersonalEconomicSelection(input: {
  readonly facts: readonly EconomicComponentFact[];
  readonly personId: PersonId;
  readonly emptyPeriodQualified: boolean;
}): GlobalPersonalEconomicSelection {
  const selection = selectEconomicComponentsForPersonWithCoverage(input.facts, input.personId);
  const amountCoverage = selection.amountCoverageRatio === undefined
    ? null
    : Number(selection.amountCoverageRatio);
  const value: GlobalKnowledgeValue<Money> = selection.conflictComponentKeys.length > 0
    ? { status: "CONFLICT" }
    : selection.eligibleComponentCount === 0
      ? input.emptyPeriodQualified ? { status: "KNOWN", value: ZERO } : { status: "UNKNOWN" }
      : selection.selectedContributions.length === 0
        ? { status: "UNKNOWN" }
        : amountCoverage === 1
          ? { status: "KNOWN", value: selection.selectedNet }
          : {
              status: "PARTIAL",
              value: selection.selectedNet,
              partialMeaning: "OBSERVED_ONLY",
              partialReasons: ["MISSING_LINKAGE"],
            };
  return {
    value,
    attributableAmount: selection.selectedNet,
    unattributableAmount: selection.unattributableNet,
    eligibleComponentCount: selection.eligibleComponentCount,
    fullyAttributedComponentCount: selection.fullyAttributedComponentCount,
    amountCoverage,
    conflictComponentKeys: selection.conflictComponentKeys,
    inputHash: digest("global-m1-person-attribution-input@v1", {
      personId: input.personId,
      emptyPeriodQualified: input.emptyPeriodQualified,
      selectedContributions: selection.selectedContributions,
      unattributedContributions: selection.unattributedContributions,
      conflictComponentKeys: selection.conflictComponentKeys,
    }),
  };
}

export function adaptGlobalMinimal(input: {
  readonly metric: ProducedMoneyMetric;
  readonly neutralVariableComponents: readonly MinimalMonthComponent[];
  readonly mandatoryMonthlyObligationsAndProvisions: readonly MinimalMonthComponent[];
}): GlobalMinimalAuthority {
  if (String(input.metric.metricId) !== "minimal_month_cost") {
    throw new TypeError("M1 Minimal exige le producteur Minimal officiel.");
  }
  if (input.metric.availability === "known") {
    const expected = sumMoney([
      ...input.neutralVariableComponents,
      ...input.mandatoryMonthlyObligationsAndProvisions,
    ].map(({ amount }) => amount));
    if (!new Big(expected).eq(input.metric.value)) {
      throw new TypeError("Les composantes Minimal ne se réconcilient pas avec le total officiel.");
    }
  }
  return {
    ...input,
    inputHash: digest("global-m1-minimal-input@v1", {
      metric: input.metric,
      neutralVariableComponents: input.neutralVariableComponents,
      mandatoryMonthlyObligationsAndProvisions: input.mandatoryMonthlyObligationsAndProvisions,
    }),
  };
}

/** Reuses the History-authoritative pure bridge; Global adds no second formula. */
export function buildGlobalBankEconomyBridge(input: {
  readonly bankOutflows: Money;
  readonly actual: Money;
  readonly lines: readonly BankEconomyBridgeLine[];
  readonly linesComplete: boolean;
  readonly conflictingAuthorities?: boolean;
}): BankEconomyBridge {
  return buildBankEconomyBridge(input);
}

function resolvedText(value: EconomicComponentFact["necessity"]): string | undefined {
  return value.kind === "resolved" ? value.value : undefined;
}

function axis(
  components: readonly GlobalEconomicStructureComponent[],
  selector: (component: GlobalEconomicStructureComponent) => EconomicComponentFact["necessity"],
): GlobalEconomicStructureAxis {
  const amounts = new Map<string, Money>();
  let unknownAmount = ZERO;
  let conflictAmount = ZERO;
  let classified = 0;
  for (const component of components) {
    const dimension = selector(component);
    const key = resolvedText(dimension);
    if (key !== undefined) {
      amounts.set(key, addMoney(amounts.get(key) ?? ZERO, component.amount));
      classified += 1;
    } else if (dimension.kind === "conflict") {
      conflictAmount = addMoney(conflictAmount, component.amount);
    } else {
      unknownAmount = addMoney(unknownAmount, component.amount);
    }
  }
  return {
    amounts: Object.fromEntries([...amounts].sort(([a], [b]) => a.localeCompare(b))),
    unknownAmount,
    conflictAmount,
    classifiedComponentCount: classified,
    eligibleComponentCount: components.length,
    coverage: components.length === 0 ? null : classified / components.length,
  };
}

/** Necessity, behaviour and LifeScope remain independent projections. */
export function buildGlobalEconomicStructure(
  components: readonly GlobalEconomicStructureComponent[],
): GlobalEconomicStructure {
  const keys = components.map(({ canonicalComponentKey }) => canonicalComponentKey);
  if (new Set(keys).size !== keys.length) {
    throw new TypeError("M1 refuse une composante économique dupliquée.");
  }
  const canonical = [...components].sort((a, b) => String(a.canonicalComponentKey).localeCompare(String(b.canonicalComponentKey)));
  return {
    necessity: axis(canonical, ({ necessity }) => necessity),
    behavior: axis(canonical, ({ behavior }) => behavior),
    lifeScope: axis(canonical, ({ lifeScope }) => lifeScope),
    inputHash: digest("global-m1-structure-input@v1", canonical),
  };
}

/** Projects only authoritative economic timing; bank date is never a fallback. */
export function projectGlobalEconomicStructureMonth(input: {
  readonly month: YearMonth;
  readonly facts: readonly EconomicComponentFact[];
}): readonly GlobalEconomicStructureComponent[] {
  return input.facts.flatMap((fact) => {
    if (fact.economicTiming.kind !== "known" && fact.economicTiming.kind !== "partial") return [];
    const amount = sumMoney(fact.economicTiming.segments
      .filter(({ economicMonth }) => economicMonth === input.month)
      .map(({ amount: value }) => value));
    if (new Big(amount).eq(0)) return [];
    return [{
      canonicalComponentKey: String(fact.canonicalComponentKey),
      amount,
      necessity: fact.necessity,
      behavior: fact.behavior,
      lifeScope: fact.lifeScope,
    }];
  });
}

function normalizeRecurrences(
  values: readonly GlobalStructuralRecurrenceCandidate[],
  date: LocalDate,
): readonly GlobalStructuralRecurrenceCandidate[] {
  const byId = new Map<string, GlobalStructuralRecurrenceCandidate[]>();
  for (const value of values) {
    if (!Number.isFinite(value.expectedOccurrencesPerYear) || value.expectedOccurrencesPerYear <= 0) {
      throw new TypeError("La cadence structurelle doit être strictement positive.");
    }
    const candidate = {
      ...value,
      expectedOccurrenceAmount: parseMoney(value.expectedOccurrenceAmount),
      ...(value.eligibleOccurrenceCosts === undefined
        ? {}
        : { eligibleOccurrenceCosts: value.eligibleOccurrenceCosts.map(parseMoney).sort((left, right) => new Big(left).cmp(right)) }),
      dependencyRefs: [...new Set(value.dependencyRefs)].sort(),
    };
    if (!activeOn(candidate, date)) continue;
    byId.set(candidate.recurrenceId, [...(byId.get(candidate.recurrenceId) ?? []), candidate]);
  }
  const priority: Readonly<Record<GlobalStructuralRecurrenceCandidate["authority"], number>> = {
    ACTIVE_CONTRACT: 4,
    EXPLICIT_FUTURE_AMOUNT: 3,
    HISTORICAL_ROBUST_ESTIMATE: 2,
    SINGLE_OCCURRENCE: 1,
  };
  return [...byId.entries()].map(([recurrenceId, candidates]) => {
    const ordered = [...candidates].sort((a, b) => priority[b.authority] - priority[a.authority]);
    const winner = ordered[0]!;
    const samePriority = ordered.filter(({ authority }) => priority[authority] === priority[winner.authority]);
    if (samePriority.some((candidate) => canonicalSerializeGlobal(candidate) !== canonicalSerializeGlobal(winner))) {
      throw new TypeError(`Deux autorités de même priorité se contredisent pour ${recurrenceId}.`);
    }
    return winner;
  }).sort((a, b) => a.recurrenceId.localeCompare(b.recurrenceId));
}

function activeOn(value: GlobalStructuralRecurrenceCandidate, date: LocalDate): boolean {
  return value.validFrom <= date && (value.validTo === undefined || value.validTo >= date);
}

function monthlyEquivalent(value: GlobalStructuralRecurrenceCandidate): Money {
  return moneyFromBig(new Big(value.expectedOccurrenceAmount).times(value.expectedOccurrencesPerYear).div(12));
}

export function calculateTypicalOccurrenceCost(
  eligibleOccurrenceCosts: readonly Money[] | undefined,
): GlobalTypicalOccurrenceCost {
  if (eligibleOccurrenceCosts === undefined || eligibleOccurrenceCosts.length === 0) {
    return { status: "UNKNOWN", unit: "EUR/occurrence" };
  }
  const costs = eligibleOccurrenceCosts.map(parseMoney).sort((left, right) => new Big(left).cmp(right));
  return {
    status: "KNOWN",
    value: medianMoney(costs),
    unit: "EUR/occurrence",
    support: parseGlobalSupport({
      naturalGrain: "OCCURRENCE",
      eligibleUnits: costs.length,
      observedUnits: costs.length,
      includedUnits: costs.length,
      excludedObservedUnits: 0,
      minimumRequired: 1,
      supportStatus: costs.length === 1 ? "SUFFICIENT" : "STRONG",
      occurrenceCount: costs.length,
      policyRef: "global-typical-occurrence-cost@v1",
    }),
  };
}

/**
 * Converts only declared/qualified cadence to a monthly equivalent. Empirical
 * recurrence is descriptive and never becomes Minimal eligibility by itself.
 */
export function buildGlobalStructuralChange(input: {
  readonly asOf: LocalDate;
  readonly previousAsOf: LocalDate;
  readonly current: readonly GlobalStructuralRecurrenceCandidate[];
  readonly previous: readonly GlobalStructuralRecurrenceCandidate[];
}): GlobalStructuralChange {
  const current = normalizeRecurrences(input.current, input.asOf);
  const previous = normalizeRecurrences(input.previous, input.previousAsOf);
  const resolve = (value: GlobalStructuralRecurrenceCandidate): GlobalStructuralRecurrence => {
    const { eligibleOccurrenceCosts, ...identity } = value;
    return {
      ...identity,
      monthlyEquivalent: monthlyEquivalent(value),
      typicalOccurrenceCost: calculateTypicalOccurrenceCost(eligibleOccurrenceCosts),
      knowledge: value.authority === "SINGLE_OCCURRENCE" ? "PARTIAL" : "KNOWN",
      minimalEligible: value.kind === "EMPIRICAL" ? false : value.minimalEligible,
    };
  };
  const active = current.map(resolve);
  const former = previous.map(resolve);
  const activeById = new Map(active.map((value) => [value.recurrenceId, value]));
  const formerById = new Map(former.map((value) => [value.recurrenceId, value]));
  const added = active.filter(({ recurrenceId }) => !formerById.has(recurrenceId));
  const ended = former.filter(({ recurrenceId }) => !activeById.has(recurrenceId));
  const priceChanges = active.flatMap((value) => {
    const before = formerById.get(value.recurrenceId);
    return before === undefined ? [] : [moneyFromBig(new Big(value.monthlyEquivalent).minus(before.monthlyEquivalent))];
  });
  return {
    newRecurringEquivalent: sumMoney(added.map(({ monthlyEquivalent: value }) => value)),
    endedRecurringEquivalent: sumMoney(ended.map(({ monthlyEquivalent: value }) => value)),
    priceChangeExistingRecurrences: sumMoney(priceChanges),
    active,
    inputHash: digest("global-m1-structural-recurrence-input@v1", {
      asOf: input.asOf,
      previousAsOf: input.previousAsOf,
      current,
      previous,
      policy: globalM1Policies.recurrence,
      methodVersion: GLOBAL_M1_METHOD,
    }),
  };
}

export const GLOBAL_M1_METHOD_VERSION: MethodVersion = GLOBAL_M1_METHOD;

export function createGlobalM1DependencyDeclaration(input: {
  readonly personScope: GlobalPersonScopePolicy;
  readonly authorizedPersonIds: readonly PersonId[];
}): GlobalDependencyDeclaration {
  return parseGlobalDependencyDeclaration({
    declarationVersion: "global-dependency-declaration@v1",
    resourceId: "global-v2:m1-economic-function",
    factDependencies: [
      { kind: "FACT", id: "fct_economic_component", requirement: "REQUIRED", scopeRelation: "same-household-and-natural-month", corpusAuthority: "CERTIFIED_HISTORY" },
      { kind: "FACT", id: "fct_economic_component_classification", requirement: "REQUIRED", scopeRelation: "same-canonical-component", corpusAuthority: "CERTIFIED_HISTORY" },
    ],
    entityDependencies: [
      { kind: "ENTITY", id: "analysis_periods", requirement: "REQUIRED", scopeRelation: "same-household" },
      { kind: "ENTITY", id: "historical_minimal_rule_authority", requirement: "OPTIONAL", scopeRelation: "effective-on-target-date" },
      { kind: "ENTITY", id: "historical_recurrence_authority", requirement: "OPTIONAL", scopeRelation: "effective-on-natural-month" },
      { kind: "ENTITY", id: "historical_declared_minimum_authority", requirement: "OPTIONAL", scopeRelation: "effective-on-target-date" },
      { kind: "ENTITY", id: "recurrence_series", requirement: "OPTIONAL", scopeRelation: "effective-on-natural-month" },
      { kind: "ENTITY", id: "financial_source_person_links", requirement: "OPTIONAL", scopeRelation: "exact-source-grain" },
    ],
    upstreamAnalytics: [
      { kind: "ANALYTICS", id: "economic_consumption_net_attributable", requirement: "REQUIRED", scopeRelation: "same-scope-and-month", corpusAuthority: "CERTIFIED_HISTORY" },
      { kind: "ANALYTICS", id: "typical_month_cost", requirement: "REQUIRED", scopeRelation: "strictly-prior-certified-months", corpusAuthority: "CERTIFIED_HISTORY" },
      { kind: "ANALYTICS", id: "minimal_month_cost", requirement: "OPTIONAL", scopeRelation: "canonical-source-aware-target-month", corpusAuthority: "CERTIFIED_HISTORY" },
    ],
    otherModuleDependencies: [
      { kind: "MODULE", id: "global-temporal-analysis@v2", requirement: "REQUIRED", scopeRelation: "official-certified-monthly-actual" },
      { kind: "MODULE", id: "GlobalTemporalBoundaryResolver", requirement: "REQUIRED", scopeRelation: "resolved-before-engine" },
      { kind: "MODULE", id: "history-v2:bank-economy-bridge", requirement: "REQUIRED", scopeRelation: "pure-authority-reuse" },
    ],
    naturalGrain: "MONTH",
    timeWindowPolicy: { id: "global-economic-month-window", version: "v1" },
    historicalLookback: { kind: "LAST_ELIGIBLE_UNITS", count: 12 },
    personScope: input.personScope,
    entityScope: { kind: "NONE" },
    supportPolicy: { id: "global-typical-support", version: "v1" },
    coveragePolicy: { id: "global-economic-coverage", version: "v1" },
    methodVersion: GLOBAL_M1_METHOD,
    policyVersions: {
      temporalAnalysis: "v2",
      temporalFinancialCoverage: "v1",
      temporalMateriality: "v1",
      timeWindow: "v1",
      typicalSupport: "v1",
      classificationCoverage: "v1",
      recurrence: "v1",
    },
    publicationOutputs: [],
    invalidationScope: { kind: "MODULE", moduleId: "global-v2:m1-economic-function" },
    capabilityRequirements: [
      { capabilityId: "global-v2:certified-economic-history", requirement: "REQUIRED" },
      { capabilityId: "global-v2:person-economic-attribution", requirement: "OPTIONAL" },
    ],
  }, { authorizedPersonIds: input.authorizedPersonIds });
}
