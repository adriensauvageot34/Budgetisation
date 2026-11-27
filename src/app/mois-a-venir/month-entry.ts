import { isArchivedRealizedMonth, isImportedRealizedMonth, JULY_COMPOSER_MONTH, JULY_V2_HREF, realizedComposerHref } from "@/domain/phase2/planner/realized-month-entry";
import { addMonths, parseYearMonth } from "@/core/time";
import type { BootstrapAnalysisPeriod } from "@/server/bootstrap/types";

const forecastStart = parseYearMonth("2026-08");
const forecastEnd = parseYearMonth("2027-09");
export const forecastWindowMonths: readonly string[] = (() => {
  const months: string[] = [];
  for (let month = forecastStart; month <= forecastEnd; month = addMonths(month, 1)) months.push(month);
  return months;
})();

export function monthPlanningHref(month: string, view?: "bilan" | "previsions") {
  return `/mois-a-venir?month=${month}${view ? `&vue=${view}` : ""}`;
}

export function composerCalendarHref(month: string) {
  return `/mois-a-venir/composer/calendrier?month=${month}`;
}

export function composerBalanceHref(month: string) {
  return `/mois-a-venir/composer/bilan?month=${month}`;
}

export const globalAnalysisHref = "/analyse-globale";

export function isWorkspaceMonth(month: string) {
  return isArchivedRealizedMonth(month) || month === JULY_COMPOSER_MONTH || forecastWindowMonths.includes(month);
}

export function globalAnalysisEntryHref(month = "") {
  return isWorkspaceMonth(month) ? `${globalAnalysisHref}?month=${month}` : globalAnalysisHref;
}

export function workspacePeriodHref(period: string, pathname: string) {
  const realized = isArchivedRealizedMonth(period);
  const pilot = period === JULY_COMPOSER_MONTH;
  if (pathname === "/mois-a-venir/composer/bilan" && realized) return composerBalanceHref(period);
  if (pathname === "/mois-a-venir/composer/calendrier" && isWorkspaceMonth(period)) {
    return composerCalendarHref(period);
  }
  if (realized || isImportedRealizedMonth(period)) return realizedComposerHref(period);
  return pilot ? JULY_V2_HREF : monthPlanningHref(period);
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
    realizedHref: realizedMonth === JULY_COMPOSER_MONTH || realizedMonth && (isArchivedRealizedMonth(realizedMonth) || isImportedRealizedMonth(realizedMonth))
      ? realizedComposerHref(realizedMonth) : realizedMonth ? `/historique/${realizedMonth}` : null,
  };
}

export type MonthEntry = ReturnType<typeof monthEntry>;
