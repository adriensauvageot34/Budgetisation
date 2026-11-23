import { JULY_COMPOSER_HREF, JULY_COMPOSER_MONTH } from "@/domain/phase2/planner/realized-month-entry";
import type { BootstrapAnalysisPeriod } from "@/server/bootstrap/types";

export function monthEntry(today: string, requestedMonth: unknown, periods: readonly BootstrapAnalysisPeriod[]) {
  const currentMonth = today.slice(0, 7);
  const targetMonth = typeof requestedMonth === "string" && /^\d{4}-(0[1-9]|1[0-2])$/u.test(requestedMonth)
    ? requestedMonth
    : currentMonth;
  const lastComplete = periods.reduce<string | null>((latest, period) => {
    if (!period.isClosed || period.financeStatus !== "complete") return latest;
    const month = period.month.slice(0, 7);
    return latest === null || month > latest ? month : latest;
  }, null);
  const financeStatus = periods.find(period => period.month.slice(0, 7) === targetMonth)?.financeStatus;
  const realizedMonth = financeStatus === "complete" || financeStatus === "partial" ? targetMonth : lastComplete;

  return {
    currentMonth, targetMonth, lastComplete, financeStatus, realizedMonth,
    realizedHref: realizedMonth === JULY_COMPOSER_MONTH ? JULY_COMPOSER_HREF : realizedMonth ? `/historique/${realizedMonth}` : null,
  };
}

export type MonthEntry = ReturnType<typeof monthEntry>;
