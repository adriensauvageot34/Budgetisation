import Big from "big.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex, utf8ToBytes } from "@noble/hashes/utils.js";
import { canonicalSerializeGlobal } from "../../core/global-v2";
import type { EconomicComponentFact, MobilityLegFact } from "../facts";
import type {
  MonthlyMobilityContextOnly,
  MonthlyMobilityNarrative,
  MonthlyMobilityNarrativeResult,
  MonthlyMobilityRoutineGroup,
  MonthlyMobilitySuppressedRemainder,
  MonthlyMobilityTripSummary,
} from "./monthly-mobility-narrative";

export const GLOBAL_CAR_MOBILITY_RHYTHM_METHOD_VERSION = "global_car_mobility_rhythm@v1" as const;

export const GLOBAL_CAR_MOBILITY_COMPARISON_REASONS = Object.freeze([
  "PURCHASE_VS_CONSUMPTION_TIMING_MISMATCH",
  "FUEL_INVENTORY_UNOBSERVED",
  "MOBILITY_COVERAGE_NOT_EQUIVALENT_TO_FINANCE_COVERAGE",
  "ESTIMATED_VS_OBSERVED_MONETARY_BASIS",
] as const);

export const GLOBAL_CAR_MOBILITY_RHYTHM_POLICIES = Object.freeze({
  policyRef: "global-car-mobility-rhythm@v1",
  estimateCoverageRule: "RESOLVED_ESTIMATES_DIVIDED_BY_ELIGIBLE_CANONICAL_LEGS",
  corpusCompletenessRule: "NEVER_INFER_REAL_WORLD_EXHAUSTIVENESS_FROM_CANONICAL_COVERAGE",
  detailAvailabilityRule: "NARRATIVE_MONTH_WITH_EXPLOITABLE_INITIAL_SURFACE",
  financeSelectionRule: "CANONICAL_FUEL_SUBCATEGORY_AND_ECONOMIC_TIMING",
});

export type GlobalCarMobilityModeledUsage = {
  readonly estimatedFuelCost: string;
  readonly distanceKm: string;
  readonly estimatedFuelLiters: string;
  readonly legCount: number;
  readonly dataNature: "ESTIMATED";
  readonly dateBasis: "MOBILITY_LEG_DATE";
};

export type GlobalCarObservedFuelPaid = {
  readonly amount: string;
  readonly operationCount: number;
  readonly financialComponentCount: number;
  readonly dataNature: "OBSERVED";
  readonly dateBasis: "ECONOMIC_TIMING";
};

export type GlobalCarMobilityQuality = {
  readonly estimateCoverage: string;
  readonly resolvedEstimateCount: number;
  readonly eligibleLegCount: number;
  readonly estimateKnowledge: "KNOWN" | "PARTIAL" | "UNKNOWN";
  readonly measurementNature: "ESTIMATED";
  readonly corpusCompleteness: "UNKNOWN";
  readonly corpusCompletenessReason: "REAL_WORLD_MOBILITY_EXHAUSTIVENESS_NOT_PROVEN";
};

export type GlobalCarMobilityUsageComposition = {
  readonly aroundWorkEstimatedFuelCost: string;
  readonly outsideWorkEstimatedFuelCost: string;
  readonly unresolvedEstimatedFuelCost: string;
  readonly classificationCoverage: string;
  readonly classificationStatus: "COMPLETE" | "PARTIAL" | "UNAVAILABLE";
};

export type GlobalCarMobilityNarrativeSummary = {
  readonly routineGroupCount: number;
  readonly tripSummaryCount: number;
  readonly contextOnlyCount: number;
  readonly suppressedTripCount: number;
  readonly visibleItemCount: number;
};

export type GlobalCarMobilityMonthDetail = {
  readonly routineGroups: readonly MonthlyMobilityRoutineGroup[];
  readonly tripSummaries: readonly MonthlyMobilityTripSummary[];
  readonly contextOnly: readonly MonthlyMobilityContextOnly[];
  readonly suppressedRemainder: MonthlyMobilitySuppressedRemainder;
};

export type GlobalCarMobilityRhythmMonth = {
  readonly month: string;
  readonly modeledUsage: GlobalCarMobilityModeledUsage;
  readonly observedFuelPaid: GlobalCarObservedFuelPaid;
  readonly usageComposition: GlobalCarMobilityUsageComposition;
  readonly narrativeSummary: GlobalCarMobilityNarrativeSummary;
  readonly detailAvailable: boolean;
  readonly detail: GlobalCarMobilityMonthDetail | null;
  readonly quality: GlobalCarMobilityQuality;
};

export type GlobalCarMobilityRhythmProjection = {
  readonly period: { readonly startMonth: string; readonly endMonth: string };
  readonly annual: {
    readonly modeledUsage: GlobalCarMobilityModeledUsage;
    readonly observedFuelPaid: GlobalCarObservedFuelPaid;
    readonly quality: GlobalCarMobilityQuality;
  };
  readonly months: readonly GlobalCarMobilityRhythmMonth[];
  readonly comparisonContract: {
    readonly status: "NOT_RECONCILABLE";
    readonly reasonCodes: typeof GLOBAL_CAR_MOBILITY_COMPARISON_REASONS;
  };
  readonly reconciliation: {
    readonly status: "PASS" | "FAIL";
    readonly uniqueLegCount: number;
    readonly duplicateLegCount: number;
    readonly monthlyModeledCostMatchesAnnual: boolean;
    readonly monthlyDistanceMatchesAnnual: boolean;
    readonly monthlyLitersMatchesAnnual: boolean;
    readonly monthlyLegCountMatchesAnnual: boolean;
    readonly monthlyUsageCompositionMatchesModeled: boolean;
  };
  readonly policies: {
    readonly projection: typeof GLOBAL_CAR_MOBILITY_RHYTHM_POLICIES;
    readonly narrativeMethodVersion: MonthlyMobilityNarrativeResult["methodVersion"];
    readonly narrativeRoutinePolicyRef: string;
    readonly narrativeUsageBandPolicyRef: string;
  };
  readonly methodVersion: typeof GLOBAL_CAR_MOBILITY_RHYTHM_METHOD_VERSION;
  readonly inputHash: string;
};

type ResolvedLeg = {
  readonly leg: MobilityLegFact;
  readonly distanceKm: Big;
  readonly estimatedFuelLiters: Big;
  readonly estimatedFuelCost: Big;
};

type FuelTimingEntry = {
  readonly month: string;
  readonly amount: Big;
  readonly componentKey: string;
  readonly operationId: string;
};

const zeroModeledUsage = (): GlobalCarMobilityModeledUsage => ({
  estimatedFuelCost: "0",
  distanceKm: "0",
  estimatedFuelLiters: "0",
  legCount: 0,
  dataNature: "ESTIMATED",
  dateBasis: "MOBILITY_LEG_DATE",
});

const zeroObservedFuelPaid = (): GlobalCarObservedFuelPaid => ({
  amount: "0",
  operationCount: 0,
  financialComponentCount: 0,
  dataNature: "OBSERVED",
  dateBasis: "ECONOMIC_TIMING",
});

const zeroNarrativeSummary = (): GlobalCarMobilityNarrativeSummary => ({
  routineGroupCount: 0,
  tripSummaryCount: 0,
  contextOnlyCount: 0,
  suppressedTripCount: 0,
  visibleItemCount: 0,
});

function digest(value: unknown): string {
  return bytesToHex(sha256(utf8ToBytes(canonicalSerializeGlobal(value))));
}

function assertMonth(value: string, field: string): void {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/u.test(value)) throw new TypeError(`${field} must be YYYY-MM.`);
}

function nextMonth(value: string): string {
  const [year, month] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function monthsBetween(startMonth: string, endMonth: string): readonly string[] {
  assertMonth(startMonth, "startMonth");
  assertMonth(endMonth, "endMonth");
  if (startMonth > endMonth) throw new TypeError("startMonth must not be after endMonth.");
  const months: string[] = [];
  for (let month = startMonth; month <= endMonth; month = nextMonth(month)) months.push(month);
  return months;
}

function sum<T>(values: readonly T[], pick: (value: T) => Big): Big {
  return values.reduce((total, value) => total.plus(pick(value)), new Big(0));
}

function uniqueCount(values: readonly string[]): number {
  return new Set(values).size;
}

function resolveLeg(leg: MobilityLegFact): ResolvedLeg | null {
  try {
    const resolved = {
      leg,
      distanceKm: new Big(leg.distanceKm),
      estimatedFuelLiters: new Big(leg.estimatedFuelLiters),
      estimatedFuelCost: new Big(leg.estimatedFuelCost),
    };
    if (resolved.distanceKm.lt(0) || resolved.estimatedFuelLiters.lt(0) || resolved.estimatedFuelCost.lt(0)) return null;
    return resolved;
  } catch {
    return null;
  }
}

function modeledUsage(eligibleLegs: readonly MobilityLegFact[]): GlobalCarMobilityModeledUsage {
  const resolved = eligibleLegs.flatMap((leg) => {
    const value = resolveLeg(leg);
    return value === null ? [] : [value];
  });
  return {
    estimatedFuelCost: sum(resolved, ({ estimatedFuelCost }) => estimatedFuelCost).toString(),
    distanceKm: sum(resolved, ({ distanceKm }) => distanceKm).toString(),
    estimatedFuelLiters: sum(resolved, ({ estimatedFuelLiters }) => estimatedFuelLiters).toString(),
    legCount: eligibleLegs.length,
    dataNature: "ESTIMATED",
    dateBasis: "MOBILITY_LEG_DATE",
  };
}

function quality(eligibleLegs: readonly MobilityLegFact[]): GlobalCarMobilityQuality {
  const resolvedEstimateCount = eligibleLegs.filter((leg) => resolveLeg(leg) !== null).length;
  const eligibleLegCount = eligibleLegs.length;
  const estimateCoverage = eligibleLegCount === 0 ? "0" : new Big(resolvedEstimateCount).div(eligibleLegCount).toString();
  return {
    estimateCoverage,
    resolvedEstimateCount,
    eligibleLegCount,
    estimateKnowledge: resolvedEstimateCount === 0 ? "UNKNOWN" : resolvedEstimateCount === eligibleLegCount ? "KNOWN" : "PARTIAL",
    measurementNature: "ESTIMATED",
    corpusCompleteness: "UNKNOWN",
    corpusCompletenessReason: "REAL_WORLD_MOBILITY_EXHAUSTIVENESS_NOT_PROVEN",
  };
}

function fuelTimingEntries(
  facts: readonly EconomicComponentFact[],
  fuelSubcategoryId: string,
  periodMonths: ReadonlySet<string>,
): readonly FuelTimingEntry[] {
  return facts.flatMap((fact) => {
    if (fact.subcategory.kind !== "resolved" || String(fact.subcategory.id) !== fuelSubcategoryId) return [];
    if (fact.sourceOperation.kind !== "resolved") return [];
    if (fact.economicTiming.kind !== "known" && fact.economicTiming.kind !== "partial") return [];
    const operationId = String(fact.sourceOperation.id);
    return fact.economicTiming.segments.flatMap((segment) => {
      const month = segment.economicMonth === null ? null : String(segment.economicMonth);
      if (month === null || !periodMonths.has(month)) return [];
      return [{
        month,
        amount: new Big(segment.amount),
        componentKey: String(fact.canonicalComponentKey),
        operationId,
      }];
    });
  });
}

function observedFuelPaid(entries: readonly FuelTimingEntry[]): GlobalCarObservedFuelPaid {
  return {
    amount: sum(entries, ({ amount }) => amount).toString(),
    operationCount: uniqueCount(entries.map(({ operationId }) => operationId)),
    financialComponentCount: uniqueCount(entries.map(({ componentKey }) => componentKey)),
    dataNature: "OBSERVED",
    dateBasis: "ECONOMIC_TIMING",
  };
}

function classificationStatus(coverage: string, modeledCost: string): GlobalCarMobilityUsageComposition["classificationStatus"] {
  if (new Big(modeledCost).eq(0)) return "UNAVAILABLE";
  return new Big(coverage).eq(1) ? "COMPLETE" : "PARTIAL";
}

function usageComposition(narrative: MonthlyMobilityNarrative | undefined, modeledCost: string): GlobalCarMobilityUsageComposition {
  if (narrative === undefined) {
    return {
      aroundWorkEstimatedFuelCost: "0",
      outsideWorkEstimatedFuelCost: "0",
      unresolvedEstimatedFuelCost: "0",
      classificationCoverage: "0",
      classificationStatus: "UNAVAILABLE",
    };
  }
  const { usageBands } = narrative;
  return {
    aroundWorkEstimatedFuelCost: usageBands.aroundWork.estimatedFuelCost,
    outsideWorkEstimatedFuelCost: usageBands.outsideWork.estimatedFuelCost,
    unresolvedEstimatedFuelCost: usageBands.unresolved.estimatedFuelCost,
    classificationCoverage: usageBands.classificationCoverage,
    classificationStatus: classificationStatus(usageBands.classificationCoverage, modeledCost),
  };
}

function narrativeSummary(narrative: MonthlyMobilityNarrative | undefined): GlobalCarMobilityNarrativeSummary {
  if (narrative === undefined) return zeroNarrativeSummary();
  return {
    routineGroupCount: narrative.routineGroups.length,
    tripSummaryCount: narrative.tripSummaries.length,
    contextOnlyCount: narrative.contextOnly.length,
    suppressedTripCount: narrative.suppressedRemainder.tripCount,
    visibleItemCount: narrative.initialSurface.length,
  };
}

function narrativeDetail(narrative: MonthlyMobilityNarrative | undefined): GlobalCarMobilityMonthDetail | null {
  if (narrative === undefined || narrative.initialSurface.length === 0 || narrative.partition.length === 0) return null;
  const refs = new Set([
    ...narrative.routineGroups.map(({ routineGroupId }) => routineGroupId),
    ...narrative.tripSummaries.map(({ tripSummaryId }) => tripSummaryId),
    ...narrative.contextOnly.map(({ contextOnlyId }) => contextOnlyId),
  ]);
  if (narrative.initialSurface.some(({ ref }) => !refs.has(ref))) return null;
  return {
    routineGroups: narrative.routineGroups,
    tripSummaries: narrative.tripSummaries,
    contextOnly: narrative.contextOnly,
    suppressedRemainder: narrative.suppressedRemainder,
  };
}

function compositionMatches(month: GlobalCarMobilityRhythmMonth): boolean {
  const composition = month.usageComposition;
  return new Big(composition.aroundWorkEstimatedFuelCost)
    .plus(composition.outsideWorkEstimatedFuelCost)
    .plus(composition.unresolvedEstimatedFuelCost)
    .eq(month.modeledUsage.estimatedFuelCost);
}

export function buildGlobalCarMobilityRhythmProjection(input: {
  readonly startMonth: string;
  readonly endMonth: string;
  readonly mobilityLegs: readonly MobilityLegFact[];
  readonly monthlyNarrative: MonthlyMobilityNarrativeResult;
  readonly economicFacts: readonly EconomicComponentFact[];
  readonly fuelSubcategoryId: string;
}): GlobalCarMobilityRhythmProjection {
  const period = monthsBetween(input.startMonth, input.endMonth);
  const periodSet = new Set(period);
  const selectedLegs = input.mobilityLegs
    .filter(({ date }) => periodSet.has(String(date).slice(0, 7)))
    .sort((left, right) => left.legId.localeCompare(right.legId));
  const uniqueLegs = [...new Map(selectedLegs.map((leg) => [leg.legId, leg])).values()];
  const duplicateLegCount = selectedLegs.length - uniqueLegs.length;
  const timingEntries = fuelTimingEntries(input.economicFacts, input.fuelSubcategoryId, periodSet);
  const narrativeByMonth = new Map(input.monthlyNarrative.months.map((month) => [month.month, month]));

  const months = period.map((month): GlobalCarMobilityRhythmMonth => {
    const legs = uniqueLegs.filter(({ date }) => String(date).startsWith(month));
    const modeled = legs.length === 0 ? zeroModeledUsage() : modeledUsage(legs);
    const finance = timingEntries.filter((entry) => entry.month === month);
    const narrative = narrativeByMonth.get(month);
    const detail = narrativeDetail(narrative);
    return {
      month,
      modeledUsage: modeled,
      observedFuelPaid: finance.length === 0 ? zeroObservedFuelPaid() : observedFuelPaid(finance),
      usageComposition: usageComposition(narrative, modeled.estimatedFuelCost),
      narrativeSummary: narrativeSummary(narrative),
      detailAvailable: detail !== null,
      detail,
      quality: quality(legs),
    };
  });

  const annualModeled = modeledUsage(uniqueLegs);
  const monthlyModeledCostMatchesAnnual = sum(months, ({ modeledUsage: value }) => new Big(value.estimatedFuelCost)).eq(annualModeled.estimatedFuelCost);
  const monthlyDistanceMatchesAnnual = sum(months, ({ modeledUsage: value }) => new Big(value.distanceKm)).eq(annualModeled.distanceKm);
  const monthlyLitersMatchesAnnual = sum(months, ({ modeledUsage: value }) => new Big(value.estimatedFuelLiters)).eq(annualModeled.estimatedFuelLiters);
  const monthlyLegCountMatchesAnnual = months.reduce((count, month) => count + month.modeledUsage.legCount, 0) === annualModeled.legCount;
  const monthlyUsageCompositionMatchesModeled = months.every(compositionMatches);
  const status = duplicateLegCount === 0
    && monthlyModeledCostMatchesAnnual
    && monthlyDistanceMatchesAnnual
    && monthlyLitersMatchesAnnual
    && monthlyLegCountMatchesAnnual
    && monthlyUsageCompositionMatchesModeled ? "PASS" : "FAIL";

  return {
    period: { startMonth: input.startMonth, endMonth: input.endMonth },
    annual: {
      modeledUsage: annualModeled,
      observedFuelPaid: observedFuelPaid(timingEntries),
      quality: quality(uniqueLegs),
    },
    months,
    comparisonContract: {
      status: "NOT_RECONCILABLE",
      reasonCodes: GLOBAL_CAR_MOBILITY_COMPARISON_REASONS,
    },
    reconciliation: {
      status,
      uniqueLegCount: uniqueLegs.length,
      duplicateLegCount,
      monthlyModeledCostMatchesAnnual,
      monthlyDistanceMatchesAnnual,
      monthlyLitersMatchesAnnual,
      monthlyLegCountMatchesAnnual,
      monthlyUsageCompositionMatchesModeled,
    },
    policies: {
      projection: GLOBAL_CAR_MOBILITY_RHYTHM_POLICIES,
      narrativeMethodVersion: input.monthlyNarrative.methodVersion,
      narrativeRoutinePolicyRef: input.monthlyNarrative.routineGroupPolicy.policyRef,
      narrativeUsageBandPolicyRef: input.monthlyNarrative.usageBandPolicy.policyRef,
    },
    methodVersion: GLOBAL_CAR_MOBILITY_RHYTHM_METHOD_VERSION,
    inputHash: digest({
      startMonth: input.startMonth,
      endMonth: input.endMonth,
      fuelSubcategoryId: input.fuelSubcategoryId,
      mobilityLegs: selectedLegs,
      monthlyNarrative: input.monthlyNarrative,
      economicFacts: [...input.economicFacts].sort((left, right) => String(left.canonicalComponentKey).localeCompare(String(right.canonicalComponentKey))),
    }),
  };
}
