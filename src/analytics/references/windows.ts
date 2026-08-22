import { parseHouseholdId } from "../../core/identity";
import {
  compareYearMonth,
  parseHouseholdTimeZone,
  parseLocalDate,
  parseYearMonth,
  yearMonthOf,
  type YearMonth,
} from "../../core/time";
import type {
  AnalysisPeriodFinanceStatus,
  ExcludedReferencePeriod,
  FinancialAnalysisPeriodProjection,
  MonthReferenceWindow,
  ReferenceExclusionReason,
  ReferencePeriodCandidate,
  ReferenceWindowRequest,
} from "./types";

const financeStatuses = new Set<AnalysisPeriodFinanceStatus>([
  "complete",
  "partial",
  "unknown",
  "not_applicable",
]);
const exclusionReasons = new Set<ReferenceExclusionReason>([
  "target",
  "future",
  "incomplete",
  "not_comparable",
  "method_exclusion",
]);

function parseBoolean(value: unknown, fieldName: string): boolean {
  if (typeof value !== "boolean") {
    throw new TypeError(`${fieldName} doit être un booléen.`);
  }
  return value;
}

export function financialReferenceCandidateFromAnalysisPeriod(input: {
  readonly analysisPeriod: FinancialAnalysisPeriodProjection;
  readonly isComparable: boolean;
  readonly isMethodExcluded: boolean;
}): ReferencePeriodCandidate {
  const householdId = parseHouseholdId(input.analysisPeriod.householdId);
  const month = parseLocalDate(input.analysisPeriod.month);
  if (!month.endsWith("-01")) {
    throw new TypeError(
      "analysis_periods.month doit être le premier jour du mois civil.",
    );
  }
  if (!financeStatuses.has(input.analysisPeriod.financeStatus)) {
    throw new TypeError("analysis_periods.finance_status est inconnu.");
  }
  const isClosed = parseBoolean(
    input.analysisPeriod.isClosed,
    "analysis_periods.is_closed",
  );
  return {
    householdId,
    period: yearMonthOf(month),
    isComplete:
      isClosed && input.analysisPeriod.financeStatus === "complete",
    isComparable: parseBoolean(
      input.isComparable,
      "ReferencePeriodCandidate.isComparable",
    ),
    isMethodExcluded: parseBoolean(
      input.isMethodExcluded,
      "ReferencePeriodCandidate.isMethodExcluded",
    ),
  };
}

function parseRequestedPeriodCount(value: number | undefined): number | undefined {
  if (value === undefined) return undefined;
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new TypeError(
      "requestedPeriodCount doit être un entier strictement positif.",
    );
  }
  return value;
}

function normalizeCandidates(
  request: ReferenceWindowRequest,
): readonly ReferencePeriodCandidate[] {
  const householdId = parseHouseholdId(request.householdId);
  const byPeriod = new Map<YearMonth, ReferencePeriodCandidate>();
  for (const candidate of request.candidates) {
    const parsed: ReferencePeriodCandidate = {
      householdId: parseHouseholdId(candidate.householdId),
      period: parseYearMonth(candidate.period),
      isComplete: parseBoolean(
        candidate.isComplete,
        "ReferencePeriodCandidate.isComplete",
      ),
      isComparable: parseBoolean(
        candidate.isComparable,
        "ReferencePeriodCandidate.isComparable",
      ),
      isMethodExcluded: parseBoolean(
        candidate.isMethodExcluded,
        "ReferencePeriodCandidate.isMethodExcluded",
      ),
    };
    if (parsed.householdId !== householdId) {
      throw new TypeError(
        "ReferencePeriodCandidate appartient à un autre Household.",
      );
    }
    const existing = byPeriod.get(parsed.period);
    if (existing === undefined) {
      byPeriod.set(parsed.period, parsed);
      continue;
    }
    if (
      existing.isComplete !== parsed.isComplete ||
      existing.isComparable !== parsed.isComparable ||
      existing.isMethodExcluded !== parsed.isMethodExcluded
    ) {
      throw new TypeError(
        "Deux états contradictoires existent pour le même mois de référence.",
      );
    }
  }
  return [...byPeriod.values()].sort((left, right) =>
    compareYearMonth(left.period, right.period),
  );
}

function exclusionReason(input: {
  readonly family: "comparison" | "current";
  readonly period: YearMonth;
  readonly barrier: YearMonth;
  readonly candidate: ReferencePeriodCandidate;
}): ReferenceExclusionReason | null {
  const comparison = compareYearMonth(input.period, input.barrier);
  if (input.family === "comparison" && comparison === 0) return "target";
  if (comparison > 0) return "future";
  if (!input.candidate.isComplete) return "incomplete";
  if (!input.candidate.isComparable) return "not_comparable";
  if (input.candidate.isMethodExcluded) return "method_exclusion";
  return null;
}

function selectReferenceWindow(input: {
  readonly family: "comparison" | "current";
  readonly barrier: YearMonth;
  readonly request: ReferenceWindowRequest;
}): MonthReferenceWindow {
  const householdId = parseHouseholdId(input.request.householdId);
  const householdTimeZone = parseHouseholdTimeZone(
    input.request.householdTimeZone,
  );
  const requestedPeriodCount = parseRequestedPeriodCount(
    input.request.requestedPeriodCount,
  );
  const candidates = normalizeCandidates(input.request);
  const included: YearMonth[] = [];
  const excluded: ExcludedReferencePeriod[] = [];

  for (const candidate of candidates) {
    const reason = exclusionReason({
      family: input.family,
      period: candidate.period,
      barrier: input.barrier,
      candidate,
    });
    if (reason === null) included.push(candidate.period);
    else excluded.push({ period: candidate.period, reason });
  }

  const overflow =
    requestedPeriodCount === undefined
      ? 0
      : Math.max(0, included.length - requestedPeriodCount);
  for (const period of included.splice(0, overflow)) {
    excluded.push({ period, reason: "method_exclusion" });
  }
  excluded.sort((left, right) => compareYearMonth(left.period, right.period));

  const window: MonthReferenceWindow = {
    family: input.family,
    householdId,
    householdTimeZone,
    asOf: input.barrier,
    ...(input.family === "comparison"
      ? { targetPeriod: input.barrier }
      : {}),
    ...(requestedPeriodCount === undefined ? {} : { requestedPeriodCount }),
    includedPeriods: included,
    excludedPeriods: excluded,
    effectivePeriodCount: included.length,
    ...(included.length === 0
      ? {}
      : {
          firstIncluded: included[0],
          lastIncluded: included[included.length - 1],
        }),
  };
  assertMonthReferenceWindow(window);
  return window;
}

export function selectComparisonReferenceWindow(
  request: ReferenceWindowRequest & { readonly targetPeriod: YearMonth },
): MonthReferenceWindow {
  return selectReferenceWindow({
    family: "comparison",
    barrier: parseYearMonth(request.targetPeriod),
    request,
  });
}

export function selectCurrentReferenceWindow(
  request: ReferenceWindowRequest & { readonly asOf: YearMonth },
): MonthReferenceWindow {
  return selectReferenceWindow({
    family: "current",
    barrier: parseYearMonth(request.asOf),
    request,
  });
}

export function assertMonthReferenceWindow(
  window: MonthReferenceWindow,
): void {
  parseHouseholdId(window.householdId);
  parseHouseholdTimeZone(window.householdTimeZone);
  const asOf = parseYearMonth(window.asOf);
  const requestedPeriodCount = parseRequestedPeriodCount(
    window.requestedPeriodCount,
  );
  const included = window.includedPeriods.map(parseYearMonth);
  const sorted = [...included].sort(compareYearMonth);
  if (
    new Set(included).size !== included.length ||
    sorted.some((period, index) => period !== included[index])
  ) {
    throw new TypeError("includedPeriods doit être triée et sans doublon.");
  }
  if (window.effectivePeriodCount !== included.length) {
    throw new TypeError(
      "effectivePeriodCount doit égaler includedPeriods.length.",
    );
  }
  if (
    requestedPeriodCount !== undefined &&
    included.length > requestedPeriodCount
  ) {
    throw new TypeError(
      "La fenêtre effective dépasse la fenêtre demandée.",
    );
  }
  if (
    window.firstIncluded !== (included.length === 0 ? undefined : included[0]) ||
    window.lastIncluded !==
      (included.length === 0 ? undefined : included[included.length - 1])
  ) {
    throw new TypeError("firstIncluded/lastIncluded sont incohérents.");
  }

  const target =
    window.targetPeriod === undefined
      ? undefined
      : parseYearMonth(window.targetPeriod);
  if (window.family === "comparison" && target === undefined) {
    throw new TypeError("Une comparison_reference exige targetPeriod.");
  }
  if (window.family === "current" && target !== undefined) {
    throw new TypeError("Une current_reference ne porte pas targetPeriod.");
  }
  for (const period of included) {
    if (compareYearMonth(period, asOf) > 0) {
      throw new TypeError("includedPeriods contient une période future.");
    }
    if (
      window.family === "comparison" &&
      target !== undefined &&
      compareYearMonth(period, target) >= 0
    ) {
      throw new TypeError(
        "comparison_reference doit exclure la cible et son futur.",
      );
    }
  }
  const includedSet = new Set(included);
  const excludedSet = new Set<YearMonth>();
  for (const exclusion of window.excludedPeriods) {
    const period = parseYearMonth(exclusion.period);
    if (!exclusionReasons.has(exclusion.reason)) {
      throw new TypeError("ReferenceExclusionReason est inconnu.");
    }
    if (includedSet.has(period) || excludedSet.has(period)) {
      throw new TypeError(
        "Une période ne peut être incluse/exclue ou exclue deux fois.",
      );
    }
    excludedSet.add(period);
  }
}
