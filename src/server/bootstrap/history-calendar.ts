import "server-only";

import { compareYearMonth, yearMonthOf, type YearMonth } from "@/core/time";
import type {
  BootstrapAnalysisPeriod,
  BootstrapAnalysisStatus,
} from "./types";

function isDocumented(status: BootstrapAnalysisStatus): boolean {
  return status === "complete" || status === "partial";
}

/**
 * A Calendar month is navigable only when its four source domains are closed
 * and documented. Its persistent Query snapshot is populated read-through.
 */
export function eligibleHistoryMonths(
  periods: readonly BootstrapAnalysisPeriod[],
): readonly YearMonth[] {
  const months = new Set<YearMonth>();
  for (const period of periods) {
    if (
      period.isClosed &&
      isDocumented(period.financeStatus) &&
      isDocumented(period.lifeStatus) &&
      isDocumented(period.locationStatus) &&
      isDocumented(period.calendarStatus)
    ) {
      months.add(yearMonthOf(period.month));
    }
  }
  return [...months].sort(compareYearMonth);
}

export function resolveEligibleHistoryMonth(
  requested: YearMonth,
  eligibleMonths: readonly YearMonth[],
): YearMonth | null {
  if (eligibleMonths.includes(requested)) return requested;
  let previous: YearMonth | null = null;
  for (const month of eligibleMonths) {
    if (compareYearMonth(month, requested) <= 0) previous = month;
  }
  return previous ?? eligibleMonths[eligibleMonths.length - 1] ?? null;
}

export function adjacentEligibleHistoryMonths(
  month: YearMonth,
  eligibleMonths: readonly YearMonth[],
): { readonly previous?: YearMonth; readonly next?: YearMonth } {
  const index = eligibleMonths.indexOf(month);
  if (index < 0) return {};
  const previous = eligibleMonths[index - 1];
  const next = eligibleMonths[index + 1];
  return {
    ...(previous === undefined ? {} : { previous }),
    ...(next === undefined ? {} : { next }),
  };
}

