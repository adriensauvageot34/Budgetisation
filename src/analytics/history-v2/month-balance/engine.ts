import Big from "big.js";
import {
  addMoney,
  averageMoney,
  compareMoney,
  parseMoney,
  subtractMoney,
  type Money,
} from "../../../core/money";
import type { MetricValue, QualityEnvelope } from "../../../core/history-v2";
import type {
  ActivityInterestInput,
  ActivityInterestScore,
  BankEconomyBridge,
  BankEconomyBridgeLine,
  CategoryPreviewCandidate,
  CategoryPreviewSelection,
  CategoryContribution,
  CategoryExplanation,
  FrequencyTicketExplanation,
  ActivityCostResolution,
  HistoricalRank,
  ImportedSummaryFreshness,
  MaterialityDecision,
  MinimalComponentInput,
  MinimalFamily,
  MinimalPreview,
  MerchantPurchaseDriverCandidate,
  MomentMediaCandidate,
  MomentMediaSelection,
  MomentSelectionInput,
  MonthReferenceComparison,
  PlaceSignificanceInput,
  PlaceSignificanceScore,
  PlaceCandidateProof,
  LocalizedAmountVisibility,
  SpendingAxis,
  SpendingBucket,
  SpendingComponentInput,
  SpendingContributorSelection,
  SpendingContributorSelectionInput,
  SpendingNatureMatrix,
  StableIdentityHistory,
  StableIdentityLifecycle,
  TypicalCompositionBaseline,
  TypicalCompositionMonth,
  UsualZone,
} from "./types";

const ZERO = parseMoney("0");

function money(value: Big | string | number): Money {
  return parseMoney(new Big(value).toFixed());
}

function abs(value: Money): Money {
  return money(new Big(value).abs());
}

function maxBig(...values: readonly Big[]): Big {
  return values.reduce((largest, value) => value.gt(largest) ? value : largest);
}

function sum(values: readonly Money[]): Money {
  return values.reduce(addMoney, ZERO);
}

function ratio(numerator: Money, denominator: Money): number | undefined {
  if (new Big(denominator).eq(0)) return undefined;
  return Number(new Big(numerator).div(new Big(denominator).abs()).toString());
}

function positiveRatio(numerator: Money, denominator: Money): number | undefined {
  if (new Big(denominator).eq(0)) return undefined;
  return Number(new Big(numerator).abs().div(new Big(denominator).abs()).toString());
}

export function evaluateMateriality(input: {
  readonly delta: Money;
  readonly reference: Money;
  readonly absoluteThreshold?: Money;
  readonly relativeThreshold?: number;
}): MaterialityDecision {
  const absoluteThreshold = input.absoluteThreshold ?? parseMoney("50");
  const relativeThreshold = input.relativeThreshold ?? 0.1;
  const absoluteSatisfied = compareMoney(abs(input.delta), absoluteThreshold) >= 0;
  const relative = positiveRatio(input.delta, input.reference);
  const relativeSatisfied = relative === undefined
    ? compareMoney(abs(input.delta), ZERO) > 0
    : relative >= relativeThreshold;
  return {
    absoluteThreshold,
    relativeThreshold,
    absoluteSatisfied,
    relativeSatisfied,
    material: absoluteSatisfied && relativeSatisfied,
  };
}

export function compareMonthReference(input: {
  readonly actual: Money;
  readonly reference: Money;
}): MonthReferenceComparison {
  const delta = subtractMoney(input.actual, input.reference);
  const relativeDelta = ratio(delta, input.reference);
  return {
    actual: input.actual,
    reference: input.reference,
    delta,
    ...(relativeDelta === undefined ? {} : { relativeDelta }),
    materiality: evaluateMateriality({ delta, reference: input.reference }),
  };
}

export function computeUsualZone(input: {
  readonly typical: Money;
  readonly supportMonths: number;
}): MetricValue<UsualZone> {
  if (input.supportMonths < 6) {
    return {
      status: "NOT_APPLICABLE",
      quality: {
        reasonCode: "REFERENCE_INSUFFICIENT_SUPPORT",
        support: { n: input.supportMonths, level: "insufficient", basis: "typical_months", requiredByPolicy: "month_balance_summary@v1" },
      },
    };
  }
  const tolerance = money(maxBig(new Big("50"), new Big(input.typical).abs().times("0.1")));
  const supportLevel = input.supportMonths <= 8 ? "limited" as const : "sufficient" as const;
  return {
    status: "KNOWN",
    value: {
      lowerBound: subtractMoney(input.typical, tolerance),
      upperBound: addMoney(input.typical, tolerance),
      tolerance,
      supportMonths: input.supportMonths,
      supportLevel,
    },
    quality: {
      support: { n: input.supportMonths, level: supportLevel, basis: "typical_months", requiredByPolicy: "month_balance_summary@v1" },
    },
  };
}

export function computeHistoricalRank(input: {
  readonly current: Money;
  readonly comparableActualsIncludingCurrent: readonly Money[];
}): MetricValue<HistoricalRank> {
  if (input.comparableActualsIncludingCurrent.length === 0) {
    return { status: "UNKNOWN", quality: { reasonCode: "DATA_NO_SOURCE" } };
  }
  const currentCents = new Big(input.current).round(2);
  const rank = 1 + input.comparableActualsIncludingCurrent.filter((value) =>
    new Big(value).round(2).gt(currentCents)).length;
  return {
    status: "KNOWN",
    value: {
      rank,
      universeCount: input.comparableActualsIncludingCurrent.length,
      presentation: input.comparableActualsIncludingCurrent.length < 4 ? "NEUTRAL" : "RANKED",
    },
  };
}

export function buildBankEconomyBridge(input: {
  readonly bankOutflows: Money;
  readonly actual: Money;
  readonly lines: readonly BankEconomyBridgeLine[];
  readonly linesComplete: boolean;
  readonly conflictingAuthorities?: boolean;
}): BankEconomyBridge {
  const lineIds = input.lines.map(({ lineId }) => lineId);
  if (new Set(lineIds).size !== lineIds.length) {
    throw new TypeError("Le bridge refuse le double comptage d'une ligne.");
  }
  const gap = subtractMoney(input.bankOutflows, input.actual);
  const bridgeCalculatedActual = addMoney(
    input.bankOutflows,
    sum(input.lines.map(({ signedAmount }) => signedAmount)),
  );
  const residual = subtractMoney(input.actual, bridgeCalculatedActual);
  const visibleThreshold = money(maxBig(
    new Big("25"),
    maxBig(new Big(input.bankOutflows).abs(), new Big(input.actual).abs()).times("0.01"),
  ));
  const visible = compareMoney(abs(gap), visibleThreshold) >= 0 || compareMoney(abs(residual), ZERO) > 0;
  const quality: QualityEnvelope = { provenance: { kind: "DERIVED", methodId: "bank_economy_bridge", methodVersion: "v1" } };
  const result: MetricValue<Money> = input.conflictingAuthorities === true
    ? { status: "CONFLICT", quality: { ...quality, reasonCode: "DATA_CONFLICTING_AUTHORITIES" } }
    : input.linesComplete && compareMoney(abs(residual), parseMoney("0.01")) <= 0
      ? { status: "KNOWN", value: input.actual, quality }
      : { status: "PARTIAL", value: bridgeCalculatedActual, partialMeaning: "OBSERVED_ONLY", quality: { ...quality, reasonCode: "COVERAGE_PARTIAL" } };
  return { bankOutflows: input.bankOutflows, actual: input.actual, gap, lines: input.lines, bridgeCalculatedActual, residual, visible, result };
}

export function resolveImportedSummaryFreshness(input: {
  readonly source?: {
    readonly publicationId: string;
    readonly revision: string;
    readonly contractVersion: string;
    readonly factsHash: string;
    readonly policySignature: string;
  };
  readonly current: {
    readonly publicationId: string;
    readonly revision: string;
    readonly contractVersion: string;
    readonly factsHash: string;
    readonly policySignature: string;
  };
}): ImportedSummaryFreshness {
  if (input.source === undefined) return "MISSING";
  return (Object.keys(input.current) as (keyof typeof input.current)[]).every(
    (key) => input.source![key] === input.current[key],
  ) ? "CURRENT" : "STALE";
}

export function computeTypicalCompositionBaseline(input: {
  readonly pivotMonthIds: readonly [import("../../../core/time").YearMonth] | readonly [import("../../../core/time").YearMonth, import("../../../core/time").YearMonth];
  readonly months: readonly TypicalCompositionMonth[];
  readonly typicalCategoryAmount: Money;
}): TypicalCompositionBaseline {
  const byMonth = new Map(input.months.map((month) => [month.month, month]));
  const pivots = input.pivotMonthIds.map((month) => byMonth.get(month));
  if (pivots.some((pivot) => pivot === undefined)) {
    throw new TypeError("TypicalCompositionBaseline exige exactement les mois pivots de Typical.");
  }
  const keys = [...new Set(pivots.flatMap((pivot) => Object.keys(pivot!.amountsByStableId)))].sort();
  const amountsByStableId: TypicalCompositionBaseline["amountsByStableId"] = Object.fromEntries(keys.map((key) => {
    const values = pivots.map((pivot) => pivot!.complete ? (pivot!.amountsByStableId[key] ?? ZERO) : pivot!.amountsByStableId[key]);
    if (values.some((value) => value === undefined)) {
      return [key, { status: "UNKNOWN" as const, quality: { reasonCode: "COVERAGE_PARTIAL" as const } }];
    }
    const value = values.length === 1 ? values[0]! : averageMoney(values[0]!, values[1]!);
    return [key, { status: "KNOWN" as const, value }];
  }));
  const complete = Object.values(amountsByStableId).every(({ status }) => status === "KNOWN");
  if (complete) {
    const baselineSum = sum(Object.values(amountsByStableId).map((entry) => entry.status === "KNOWN" ? entry.value : ZERO));
    if (compareMoney(abs(subtractMoney(baselineSum, input.typicalCategoryAmount)), parseMoney("0.01")) > 0) {
      throw new TypeError("La composition Typical complète doit se réconcilier avec Typical catégorie.");
    }
  }
  return {
    pivotMonthIds: input.pivotMonthIds,
    amountsByStableId,
    total: complete
      ? { status: "KNOWN", value: input.typicalCategoryAmount }
      : { status: "UNKNOWN", quality: { reasonCode: "COVERAGE_PARTIAL" } },
  };
}

export function explainCategory(input: {
  readonly categoryDelta: Money;
  readonly categoryMaterial: boolean;
  readonly contributions: readonly CategoryContribution[];
}): CategoryExplanation {
  const sign = new Big(input.categoryDelta).cmp(0);
  const known = input.contributions.filter((entry) => entry.contribution.status === "KNOWN");
  const driverThreshold = maxBig(new Big("15"), new Big(input.categoryDelta).abs().times("0.15"));
  const compensatorThreshold = maxBig(new Big("15"), new Big(input.categoryDelta).abs().times("0.2"));
  const drivers = known.filter((entry) => {
    const contribution = new Big(entry.contribution.status === "KNOWN" ? entry.contribution.value : ZERO);
    return contribution.cmp(0) === sign && contribution.abs().gte(driverThreshold);
  }).sort((a, b) => new Big((b.contribution as { value: Money }).value).abs().cmp(new Big((a.contribution as { value: Money }).value).abs())).slice(0, 3);
  const compensator = known.filter((entry) => {
    const contribution = new Big(entry.contribution.status === "KNOWN" ? entry.contribution.value : ZERO);
    return contribution.cmp(0) === -sign && contribution.abs().gte(compensatorThreshold);
  }).sort((a, b) => new Big((b.contribution as { value: Money }).value).abs().cmp(new Big((a.contribution as { value: Money }).value).abs()))[0];
  const explained = sum([...drivers, ...(compensator === undefined ? [] : [compensator])].map((entry) => (entry.contribution as { value: Money }).value));
  const allKnown = input.contributions.every(({ contribution }) => contribution.status === "KNOWN");
  return {
    categoryDelta: input.categoryDelta,
    drivers,
    ...(compensator === undefined ? {} : { compensator }),
    residual: allKnown
      ? { status: "KNOWN", value: subtractMoney(input.categoryDelta, explained) }
      : { status: "PARTIAL", value: subtractMoney(input.categoryDelta, explained), partialMeaning: "OBSERVED_ONLY", quality: { reasonCode: "COVERAGE_PARTIAL" } },
    visible: input.categoryMaterial && drivers.length > 0,
  };
}

export function classifyStableIdentityLifecycle(input: StableIdentityHistory): StableIdentityLifecycle {
  if (compareMoney(input.currentAmount, parseMoney("25")) < 0) return "NONE";
  const share = positiveRatio(input.currentAmount, input.currentCategoryAmount) ?? 0;
  if (share < 0.1 && compareMoney(input.currentAmount, parseMoney("50")) < 0) return "NONE";
  const prior = input.immediatelyPrior.slice(0, 3);
  if (prior.length < 3 || prior.some(({ complete }) => !complete)) return "UNKNOWN";
  const absent = prior.every(({ amount }) => compareMoney(amount, ZERO) === 0);
  if (!absent) return "NONE";
  if (input.expectedAnnualSeries === true) return "NONE";
  return input.olderKnownPositive ? "REAPPEARED" : "NEW";
}

export function selectCategoryPreview(
  candidates: readonly CategoryPreviewCandidate[],
  limit = 8,
): CategoryPreviewSelection {
  if (!Number.isSafeInteger(limit) || limit < 1) throw new TypeError("Category preview limit invalide.");
  const unclassified = candidates.filter(({ classified }) => !classified);
  const classified = candidates.filter(({ classified }) => classified);
  const reserved = classified.filter(({ material, lifecycle }) => material || lifecycle === "NEW" || lifecycle === "REAPPEARED")
    .sort((a, b) => compareMoney(abs(b.amount), abs(a.amount)) || a.categoryId.localeCompare(b.categoryId));
  const reservedIds = new Set(reserved.map(({ categoryId }) => categoryId));
  const selected = [...reserved, ...classified.filter(({ categoryId }) => !reservedIds.has(categoryId)).sort((a, b) => compareMoney(abs(b.amount), abs(a.amount)) || a.categoryId.localeCompare(b.categoryId))].slice(0, limit);
  const selectedIds = new Set(selected.map(({ categoryId }) => categoryId));
  return {
    selected,
    otherAmount: sum(classified.filter(({ categoryId }) => !selectedIds.has(categoryId)).map(({ amount }) => amount)),
    unclassifiedAmount: sum(unclassified.map(({ amount }) => amount)),
  };
}

export function selectMerchantPurchaseDrivers(input: {
  readonly candidates: readonly MerchantPurchaseDriverCandidate[];
  readonly causallyRepresentedExpenseEventIds: readonly string[];
  readonly lifecycleRepresentedPurchaseEventIds: readonly string[];
}): readonly MerchantPurchaseDriverCandidate[] {
  const causal = new Set(input.causallyRepresentedExpenseEventIds);
  const lifecycle = new Set(input.lifecycleRepresentedPurchaseEventIds);
  return input.candidates.filter((candidate) => {
    if (!candidate.stableIdentity || !candidate.sameDirection) return false;
    if (candidate.kind === "MERCHANT") {
      return candidate.currentCoverage >= 0.9
        && candidate.pivotCoverage >= 0.9
        && new Big(candidate.contribution).abs().gte(maxBig(new Big("15"), new Big(candidate.subcategoryContribution).abs().times("0.2")));
    }
    return candidate.purchaseEventId !== undefined
      && !lifecycle.has(candidate.purchaseEventId)
      && !candidate.expenseEventIds.some((id) => causal.has(id))
      && new Big(candidate.amount).abs().gte(maxBig(new Big("25"), new Big(candidate.subcategoryContribution).abs().times("0.25")));
  }).sort((a, b) => new Big(b.contribution).abs().cmp(new Big(a.contribution).abs()) || a.explanationId.localeCompare(b.explanationId)).slice(0, 3).map((candidate) => candidate.kind === "MERCHANT" && candidate.merchantRank !== undefined && candidate.merchantRank <= 5 ? candidate : ({ ...candidate, merchantRank: undefined }));
}

export function explainFrequencyTicket(input: {
  readonly currentFrequency: number;
  readonly referenceFrequency: number;
  readonly currentMedianTicket: Money;
  readonly referenceMedianTicket: Money;
  readonly referenceMonths: number;
  readonly ticketSupport: number;
  readonly currentCoverage: number;
}): FrequencyTicketExplanation {
  if (input.referenceMonths < 6 || input.ticketSupport < 5 || input.currentCoverage < 0.8) {
    return { availability: "UNKNOWN", quality: { reasonCode: input.currentCoverage < 0.8 ? "COVERAGE_INSUFFICIENT" : "REFERENCE_INSUFFICIENT_SUPPORT" } };
  }
  const frequencyAbs = Math.abs(input.currentFrequency - input.referenceFrequency);
  const frequencyRel = input.referenceFrequency === 0 ? (frequencyAbs > 0 ? Infinity : 0) : frequencyAbs / input.referenceFrequency;
  const ticketDelta = abs(subtractMoney(input.currentMedianTicket, input.referenceMedianTicket));
  const ticketRel = positiveRatio(ticketDelta, input.referenceMedianTicket) ?? (compareMoney(ticketDelta, ZERO) > 0 ? Infinity : 0);
  const frequencyMaterial = frequencyAbs >= 1 && frequencyRel >= 0.25;
  const ticketMaterial = compareMoney(ticketDelta, parseMoney("5")) >= 0 && ticketRel >= 0.15;
  const frequencySeverity = Math.min(frequencyAbs / 1, frequencyRel / 0.25);
  const ticketSeverity = Math.min(Number(ticketDelta) / 5, ticketRel / 0.15);
  const dominantFactor = !frequencyMaterial && !ticketMaterial ? "NONE"
    : frequencyMaterial && !ticketMaterial ? "FREQUENCY"
      : ticketMaterial && !frequencyMaterial ? "TICKET"
        : frequencySeverity >= ticketSeverity * 1.5 ? "FREQUENCY"
          : ticketSeverity >= frequencySeverity * 1.5 ? "TICKET" : "BOTH";
  return {
    availability: "KNOWN",
    dominantFactor,
    frequencyMaterial,
    ticketMaterial,
    frequencySeverity,
    ticketSeverity,
    quality: { support: { n: input.ticketSupport, level: input.ticketSupport < 8 ? "limited" : "sufficient", basis: "activity_causal_tickets", requiredByPolicy: "category_explanation@v1" }, coverage: { ratio: input.currentCoverage, basis: "current_activity_occurrences" } },
  };
}

function spendingAxis(
  actual: Money,
  components: readonly SpendingComponentInput[],
  selector: (component: SpendingComponentInput) => string | undefined,
): SpendingAxis {
  const grouped = new Map<string, Money>();
  let classifiedAmount = ZERO;
  let unclassifiedAmount = ZERO;
  let classifiedAbs = new Big(0);
  let totalAbs = new Big(0);
  for (const component of components) {
    totalAbs = totalAbs.plus(new Big(component.amount).abs());
    const key = selector(component);
    if (key === undefined) {
      unclassifiedAmount = addMoney(unclassifiedAmount, component.amount);
      continue;
    }
    classifiedAbs = classifiedAbs.plus(new Big(component.amount).abs());
    classifiedAmount = addMoney(classifiedAmount, component.amount);
    grouped.set(key, addMoney(grouped.get(key) ?? ZERO, component.amount));
  }
  const coverageRatio = totalAbs.eq(0) ? undefined : Number(classifiedAbs.div(totalAbs).toString());
  const buckets: SpendingBucket[] = [...grouped].sort(([a], [b]) => a.localeCompare(b)).map(([key, amount]) => ({ key, amount, ...(new Big(actual).eq(0) ? {} : { shareOfActual: Number(new Big(amount).div(actual).toString()) }) }));
  const complete = compareMoney(unclassifiedAmount, ZERO) === 0;
  const gapThreshold = money(maxBig(new Big("25"), new Big(actual).abs().times("0.02")));
  return {
    result: complete ? { status: "KNOWN", value: buckets } : { status: "PARTIAL", value: buckets, partialMeaning: "OBSERVED_ONLY", quality: { reasonCode: "COVERAGE_PARTIAL", ...(coverageRatio === undefined ? {} : { coverage: { ratio: coverageRatio, basis: "classified_absolute_amount" } }) } },
    classifiedAmount,
    unclassifiedAmount,
    ...(coverageRatio === undefined ? {} : { coverageRatio }),
    gapMaterial: compareMoney(abs(unclassifiedAmount), gapThreshold) > 0,
  };
}

export function buildSpendingAxes(input: {
  readonly actual: Money;
  readonly components: readonly SpendingComponentInput[];
}): { readonly necessity: SpendingAxis; readonly behavior: SpendingAxis; readonly lifeScope: SpendingAxis; readonly matrix: SpendingNatureMatrix } {
  const necessity = spendingAxis(input.actual, input.components, ({ necessity: key }) => key);
  const behavior = spendingAxis(input.actual, input.components, ({ behavior: key }) => key);
  const lifeScope = spendingAxis(input.actual, input.components, ({ lifeScope: key }) => key);
  const matrixAxis = spendingAxis(input.actual, input.components, (component) => component.necessity === undefined || component.behavior === undefined ? undefined : `${component.necessity}__${component.behavior}`);
  const cells = matrixAxis.result.status === "KNOWN" || matrixAxis.result.status === "PARTIAL" ? matrixAxis.result.value : [];
  const immediate = cells.find(({ key }) => key === "OPTIONAL__VARIABLE")?.amount ?? ZERO;
  const medium = cells.find(({ key }) => key === "OPTIONAL__FIXED")?.amount ?? ZERO;
  const allNonNegative = input.components.every(({ nonNegative }) => nonNegative);
  const margin = (value: Money): MetricValue<Money> => matrixAxis.result.status === "KNOWN"
    ? { status: "KNOWN", value }
    : { status: "PARTIAL", value, partialMeaning: allNonNegative ? "LOWER_BOUND" : "OBSERVED_ONLY", quality: { reasonCode: "COVERAGE_PARTIAL" } };
  return { necessity, behavior, lifeScope, matrix: { cells, classifiedAmount: matrixAxis.classifiedAmount, unclassifiedAmount: matrixAxis.unclassifiedAmount, ...(matrixAxis.coverageRatio === undefined ? {} : { coverageRatio: matrixAxis.coverageRatio }), immediateMargin: margin(immediate), mediumMargin: margin(medium) } };
}

export function selectSpendingContributors(
  components: readonly SpendingContributorSelectionInput[],
): SpendingContributorSelection {
  const grouped = new Map<string, {
    contributorId: string;
    grain: "SUBCATEGORY" | "CATEGORY";
    amount: Money;
    componentKeys: string[];
  }>();
  for (const component of components) {
    const grain = component.subcategoryId === undefined ? "CATEGORY" : "SUBCATEGORY";
    const contributorId = component.subcategoryId ?? component.categoryId;
    if (contributorId === undefined) continue;
    const groupKey = `${grain}\u0000${contributorId}`;
    const current = grouped.get(groupKey);
    grouped.set(groupKey, {
      contributorId,
      grain,
      amount: addMoney(current?.amount ?? ZERO, component.amount),
      componentKeys: [...(current?.componentKeys ?? []), component.componentKey],
    });
  }
  const ranked = [...grouped.values()].sort((left, right) =>
    compareMoney(abs(right.amount), abs(left.amount))
    || (left.grain === right.grain ? 0 : left.grain === "SUBCATEGORY" ? -1 : 1)
    || left.contributorId.localeCompare(right.contributorId));
  const contributors = ranked.slice(0, 3).map((value) => ({
    ...value,
    componentKeys: [...new Set(value.componentKeys)].sort(),
  }));
  return {
    contributors,
    otherAmount: subtractMoney(
      sum(components.map(({ amount }) => amount)),
      sum(contributors.map(({ amount }) => amount)),
    ),
  };
}

const minimalFamilies: readonly MinimalFamily[] = ["OBLIGATIONS", "VARIABLES_INDISPENSABLES", "PROVISIONS", "BESOINS_CONDITIONNELS"];

export function buildMinimalPreview(input: {
  readonly minimal: Money;
  readonly components: readonly MinimalComponentInput[];
}): MinimalPreview {
  const families = minimalFamilies.map((family) => {
    const components = input.components.filter((component) => component.family === family);
    return { family, amount: sum(components.map(({ amount }) => amount)), examples: [...components].sort((a, b) => compareMoney(abs(b.amount), abs(a.amount))).slice(0, 2) };
  });
  if (compareMoney(abs(subtractMoney(sum(families.map(({ amount }) => amount)), input.minimal)), parseMoney("0.01")) > 0) {
    throw new TypeError("MinimalPreview doit être l'exacte projection additive du moteur Minimal.");
  }
  return { total: input.minimal, families };
}

function activityFrequencyPoints(input: ActivityInterestInput): { points: number; absoluteDelta: number } {
  if (input.referenceOccurrences === undefined) return { points: 0, absoluteDelta: 0 };
  const delta = Math.abs(input.occurrences - input.referenceOccurrences);
  if (input.referenceOccurrences === 0) return { points: input.occurrences > 0 && input.establishedReferenceAbsence === true ? 35 : 0, absoluteDelta: delta };
  const relative = delta / input.referenceOccurrences;
  return { points: relative === 0 ? 0 : relative < 0.25 ? 5 : relative < 0.5 ? 15 : relative < 1 ? 25 : 35, absoluteDelta: delta };
}

export function computeActivityInterestScore(input: ActivityInterestInput): ActivityInterestScore {
  if (input.priorityBand === 5) throw new TypeError("priorityBand 5 sans score sémantique est une erreur de contrat.");
  const frequency = activityFrequencyPoints(input);
  const narrativePoints = input.bestHighlightRank !== undefined ? ({ 1: 25, 2: 22, 3: 19, 4: 16, 5: 13 } as const)[input.bestHighlightRank] : input.hasOtherNarrativeMoment ? 10 : 0;
  const semanticPoints = ({ 1: 5, 2: 10, 3: 15, 4: 20 } as const)[input.priorityBand];
  const financialPoints = input.qualifiedCostShare === undefined || input.qualifiedCostPartialMeaning === "OBSERVED_ONLY" ? 0 : input.qualifiedCostShare >= 0.05 ? 15 : input.qualifiedCostShare >= 0.02 ? 10 : input.qualifiedCostShare >= 0.01 ? 5 : input.qualifiedCostShare > 0 ? 2 : 0;
  const intensityPoints = input.occurrences <= 1 ? input.occurrences : input.occurrences <= 3 ? 2 : input.occurrences <= 5 ? 3 : input.occurrences <= 9 ? 4 : 5;
  return { activityTypeKey: input.activityTypeKey, score: frequency.points + narrativePoints + semanticPoints + financialPoints + intensityPoints, frequencyPoints: frequency.points, narrativePoints, semanticPoints, financialPoints, intensityPoints, occurrences: input.occurrences, priorityBand: input.priorityBand, ...(input.bestHighlightRank === undefined ? {} : { bestHighlightRank: input.bestHighlightRank }), absoluteFrequencyDelta: frequency.absoluteDelta, ...(input.qualifiedCost === undefined ? {} : { qualifiedCost: input.qualifiedCost }) };
}

export function rankActivities(inputs: readonly ActivityInterestInput[]): readonly ActivityInterestScore[] {
  return inputs
    .filter(({ occurrences }) => occurrences >= 1)
    .map(computeActivityInterestScore)
    .sort((a, b) => b.score - a.score || b.narrativePoints - a.narrativePoints || b.priorityBand - a.priorityBand || b.absoluteFrequencyDelta - a.absoluteFrequencyDelta || b.occurrences - a.occurrences || (a.qualifiedCost !== undefined && b.qualifiedCost !== undefined ? compareMoney(b.qualifiedCost, a.qualifiedCost) : 0) || a.activityTypeKey.localeCompare(b.activityTypeKey));
}

export function resolveActivityCost(input: {
  readonly causalExpenses: readonly { readonly expenseEventId: string; readonly amount: Money }[];
  readonly associatedExpenses: readonly { readonly expenseEventId: string; readonly amount: Money }[];
}): ActivityCostResolution {
  const unique = (values: readonly { readonly expenseEventId: string; readonly amount: Money }[]) => {
    const byId = new Map<string, Money>();
    for (const value of values) {
      if (byId.has(value.expenseEventId)) throw new TypeError("Une dépense Activity ne peut pas être comptée deux fois.");
      byId.set(value.expenseEventId, value.amount);
    }
    return byId;
  };
  const causal = unique(input.causalExpenses);
  const associated = unique(input.associatedExpenses.filter(({ expenseEventId }) => !causal.has(expenseEventId)));
  const selected = causal.size > 0 ? causal : associated;
  return { costKind: causal.size > 0 ? "CAUSAL" : associated.size > 0 ? "ASSOCIATED" : "NONE", expenseEventIds: [...selected.keys()].sort(), amount: sum([...selected.values()]) };
}

export function rankMoments(inputs: readonly MomentSelectionInput[]): readonly MomentSelectionInput[] {
  return [...inputs].sort((a, b) => {
    if (a.highlightRank !== undefined || b.highlightRank !== undefined) return (a.highlightRank ?? 99) - (b.highlightRank ?? 99);
    return b.priorityBand - a.priorityBand || b.priorityWeight - a.priorityWeight || Number(b.continuous) - Number(a.continuous) || b.livedDaysInMonth - a.livedDaysInMonth || (a.causalCostComparable && b.causalCostComparable && a.causalCost !== undefined && b.causalCost !== undefined ? compareMoney(b.causalCost, a.causalCost) : 0) || a.startDate.localeCompare(b.startDate) || a.momentId.localeCompare(b.momentId);
  });
}

export function selectMomentMedia(input: {
  readonly momentId: string;
  readonly candidates: readonly MomentMediaCandidate[];
  readonly periodStart: string;
  readonly periodEnd: string;
}): MomentMediaSelection {
  const direct = input.candidates.filter((candidate) => candidate.direct && candidate.momentId === input.momentId && candidate.capturedAt >= input.periodStart && candidate.capturedAt <= input.periodEnd);
  const roleRank = (role: MomentMediaCandidate["role"]) => role === "COVER" ? 0 : role === "FAVORITE" || role === "PRINCIPAL" ? 1 : 2;
  const selected = [...direct].sort((a, b) => roleRank(a.role) - roleRank(b.role) || a.capturedAt.localeCompare(b.capturedAt) || a.mediaId.localeCompare(b.mediaId))[0];
  return selected === undefined ? { kind: "GRAPHIC_FALLBACK" } : { kind: "MEDIA", mediaId: selected.mediaId };
}

export function computePlaceSignificanceScore(input: PlaceSignificanceInput): PlaceSignificanceScore {
  const narrativePoints = input.bestHighlightRank === undefined
    ? input.momentCount === 0 ? 0 : input.momentCount === 1 ? 18 : input.momentCount === 2 ? 21 : 24
    : ({ 1: 40, 2: 36, 3: 32, 4: 28, 5: 24 } as const)[input.bestHighlightRank];
  const presencePoints = input.presenceDays === 0 ? 0 : input.presenceDays === 1 ? 5 : input.presenceDays === 2 ? 9 : input.presenceDays <= 4 ? 13 : input.presenceDays <= 7 ? 17 : input.presenceDays <= 14 ? 21 : 25;
  const activityPoints = input.activityTypeCount === 0 ? 0 : input.activityTypeCount === 1 ? 5 : input.activityTypeCount === 2 ? 10 : 15;
  const localizedComparable = input.localizedCoverage !== undefined && input.localizedCoverage >= 0.8 && input.localizedShare !== undefined;
  const financePoints = !localizedComparable ? 0 : input.localizedShare! >= 0.05 ? 10 : input.localizedShare! >= 0.02 ? 7 : input.localizedShare! >= 0.01 ? 4 : input.localizedShare! > 0 ? 2 : 0;
  const semanticBonus = input.semanticKind === "TRAVEL_STAY" || input.semanticKind === "FAMILY_FRIEND" ? 10 : input.semanticKind === "LEISURE_EVENT" || input.semanticKind === "HEALTH" ? 6 : 0;
  const routinePenalty = input.routineKind === "HOME" ? 35 : input.routineKind === "REGULAR_WORK" ? 30 : input.routineKind === "OTHER_ROUTINE" ? 15 : 0;
  const score = narrativePoints + presencePoints + activityPoints + financePoints + semanticBonus - routinePenalty;
  return { placeId: input.placeId, score, narrativePoints, presencePoints, activityPoints, financePoints, semanticBonus, routinePenalty, candidate: score >= 20, ...(input.bestHighlightRank === undefined ? {} : { bestHighlightRank: input.bestHighlightRank }), momentCount: input.momentCount, presenceDays: input.presenceDays, ...(input.localizedAmount === undefined ? {} : { localizedAmount: input.localizedAmount }), localizedComparable };
}

export function rankPlaces(inputs: readonly PlaceSignificanceInput[]): readonly PlaceSignificanceScore[] {
  return inputs.map(computePlaceSignificanceScore).filter(({ candidate }) => candidate).sort((a, b) => b.score - a.score || (a.bestHighlightRank ?? 99) - (b.bestHighlightRank ?? 99) || b.momentCount - a.momentCount || b.presenceDays - a.presenceDays || (a.localizedComparable && b.localizedComparable && a.localizedAmount !== undefined && b.localizedAmount !== undefined ? compareMoney(b.localizedAmount, a.localizedAmount) : 0) || a.placeId.localeCompare(b.placeId)).slice(0, 6);
}

export function selectDisplayPlaceCandidate(proofs: readonly PlaceCandidateProof[]): string | undefined {
  if (proofs.length === 0) return undefined;
  const byId = new Map(proofs.map((proof) => [proof.placeId, proof]));
  const depth = (proof: PlaceCandidateProof): number => {
    let current: PlaceCandidateProof | undefined = proof;
    let result = 0;
    const visited = new Set<string>();
    while (current?.parentPlaceId !== undefined) {
      if (visited.has(current.placeId)) throw new TypeError("Hiérarchie Place cyclique.");
      visited.add(current.placeId);
      current = byId.get(current.parentPlaceId);
      result += 1;
    }
    return result;
  };
  return [...proofs].sort((a, b) => Number(b.authority === "DIRECT_NARRATIVE") - Number(a.authority === "DIRECT_NARRATIVE") || depth(b) - depth(a) || a.placeId.localeCompare(b.placeId))[0]!.placeId;
}

export function resolveLocalizedAmountVisibility(input: {
  readonly localizedAmount: Money;
  readonly authoritativeLocalizableAbsoluteAmount: Money;
  readonly allLocalizableAbsoluteAmount: Money;
  readonly monotoneNonNegative: boolean;
}): LocalizedAmountVisibility {
  if (compareMoney(input.allLocalizableAbsoluteAmount, ZERO) === 0) {
    return { cardAmount: { status: "NOT_APPLICABLE", quality: { reasonCode: "POLICY_NOT_APPLICABLE" } }, detailAmount: { status: "NOT_APPLICABLE", quality: { reasonCode: "POLICY_NOT_APPLICABLE" } } };
  }
  const coverage = Number(new Big(input.authoritativeLocalizableAbsoluteAmount).div(input.allLocalizableAbsoluteAmount).toString());
  const quality = { coverage: { ratio: coverage, basis: "authoritative_localized_absolute_amount" } } as const;
  if (coverage >= 0.8) return { localizedCoverage: coverage, cardAmount: { status: "KNOWN", value: input.localizedAmount, quality }, detailAmount: { status: "KNOWN", value: input.localizedAmount, quality } };
  if (coverage >= 0.6) return { localizedCoverage: coverage, cardAmount: { status: "UNKNOWN", quality: { ...quality, reasonCode: "COVERAGE_INSUFFICIENT" } }, detailAmount: { status: "PARTIAL", value: input.localizedAmount, partialMeaning: input.monotoneNonNegative ? "LOWER_BOUND" : "OBSERVED_ONLY", quality: { ...quality, reasonCode: "COVERAGE_PARTIAL" } } };
  return { localizedCoverage: coverage, cardAmount: { status: "UNKNOWN", quality: { ...quality, reasonCode: "COVERAGE_INSUFFICIENT" } }, detailAmount: { status: "UNKNOWN", quality: { ...quality, reasonCode: "COVERAGE_INSUFFICIENT" } } };
}
