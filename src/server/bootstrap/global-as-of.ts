import "server-only";

import { addMonths, yearMonthOf, type YearMonth } from "@/core/time";
import type { BootstrapAnalysisPeriod } from "./types";

/**
 * Core Global windows are half-open at `asOf`: the selected month is not part
 * of the observation window. The default barrier is therefore the month after
 * the latest closed, finance-complete analysis period.
 */
export function resolveDefaultGlobalAsOf(
  periods: readonly Pick<
    BootstrapAnalysisPeriod,
    "month" | "financeStatus" | "isClosed"
  >[],
): YearMonth | null {
  const latestComplete = periods
    .filter(({ financeStatus, isClosed }) => financeStatus === "complete" && isClosed)
    .map(({ month }) => yearMonthOf(month))
    .sort()
    .at(-1);
  return latestComplete === undefined ? null : addMonths(latestComplete, 1);
}

export function isAllowedGlobalAsOf(
  periods: readonly Pick<
    BootstrapAnalysisPeriod,
    "month" | "financeStatus" | "isClosed"
  >[],
  asOf: YearMonth,
): boolean {
  return periods.some(
    ({ month, financeStatus, isClosed }) =>
      financeStatus === "complete" &&
      isClosed &&
      addMonths(yearMonthOf(month), 1) === asOf,
  );
}
