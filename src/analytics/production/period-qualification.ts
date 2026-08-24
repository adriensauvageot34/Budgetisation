import type { NormalizedAnalysisScope } from "../../core/scope";
import {
  resolveGlobalWindowMonths,
  yearMonthOf,
  type LocalDate,
} from "../../core/time";

export function isFinanceScopeCompleteAndClosed(
  periods: readonly {
    readonly month: LocalDate;
    readonly financeStatus: string;
    readonly isClosed: boolean;
  }[],
  scope: NormalizedAnalysisScope,
): boolean {
  const required = scope.time.kind === "month"
    ? [scope.time.month]
    : resolveGlobalWindowMonths(scope.time.observationWindow, scope.time.asOf);
  return required.every((month) => periods.some(
    (period) =>
      yearMonthOf(period.month) === month &&
      period.financeStatus === "complete" &&
      period.isClosed,
  ));
}
