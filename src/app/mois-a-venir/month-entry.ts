import { isArchivedRealizedMonth, JULY_COMPOSER_MONTH, realizedComposerHref } from "@/domain/phase2/planner/realized-month-entry";
import { addMonths, parseYearMonth } from "@/core/time";
import type { BootstrapAnalysisPeriod } from "@/server/bootstrap/types";

const forecastStart = parseYearMonth("2026-08");
const forecastEnd = parseYearMonth("2027-09");
export const forecastWindowMonths: readonly string[] = (() => {
  const months: string[] = [];
  for (let month = forecastStart; month <= forecastEnd; month = addMonths(month, 1)) months.push(month);
  return months;
})();

export function monthPlanningHref(month: string, view?: "bilan") {
  return `/mois-a-venir?month=${month}${view ? `&vue=${view}` : ""}`;
}

export function composerCalendarHref(month: string) {
  return `/mois-a-venir/composer/calendrier?month=${month}`;
}

export function showsArchivedForecast(targetMonth: string, currentMonth: string, view: unknown): boolean {
  return targetMonth < currentMonth && forecastWindowMonths.includes(targetMonth) && view !== "bilan";
}

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
    realizedHref: realizedMonth === JULY_COMPOSER_MONTH || realizedMonth && isArchivedRealizedMonth(realizedMonth)
      ? realizedComposerHref(realizedMonth) : realizedMonth ? `/historique/${realizedMonth}` : null,
  };
}

export type MonthEntry = ReturnType<typeof monthEntry>;
