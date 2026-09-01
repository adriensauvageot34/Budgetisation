import type { LocalDate } from "@/core/time";
import type { EconomicExpenseSummary, LifeMarkerFamily } from "@/query-api";

const frenchDate = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "long",
  timeZone: "UTC",
});

const frenchDateWithYear = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

function utcDate(date: LocalDate): Date {
  return new Date(`${date}T00:00:00Z`);
}

export function formatCalendarDay(date: LocalDate, includeMonth: boolean): string {
  return includeMonth ? frenchDate.format(utcDate(date)) : String(Number(date.slice(8, 10)));
}

export function formatFrenchDate(date: LocalDate, includeYear = true): string {
  return (includeYear ? frenchDateWithYear : frenchDate).format(utcDate(date));
}

export function formatFrenchDateRange(startDate: LocalDate, endDate?: LocalDate, includeYear = true): string {
  if (endDate === undefined || endDate === startDate) return formatFrenchDate(startDate, includeYear);
  const start = utcDate(startDate);
  const end = utcDate(endDate);
  const sameMonth = start.getUTCFullYear() === end.getUTCFullYear() && start.getUTCMonth() === end.getUTCMonth();
  if (sameMonth) {
    const suffix = new Intl.DateTimeFormat("fr-FR", {
      month: "long",
      ...(includeYear ? { year: "numeric" as const } : {}),
      timeZone: "UTC",
    }).format(end);
    return `${start.getUTCDate()}–${end.getUTCDate()} ${suffix}`;
  }
  const sameYear = start.getUTCFullYear() === end.getUTCFullYear();
  if (sameYear && includeYear) {
    return `${frenchDate.format(start)} – ${frenchDateWithYear.format(end)}`;
  }
  return `${formatFrenchDate(startDate, includeYear)} – ${formatFrenchDate(endDate, includeYear)}`;
}

export function formatCount(value: number, singular: string, plural = `${singular}s`): string {
  return `${value} ${value === 1 ? singular : plural}`;
}

const lifeMarkerNouns: Readonly<Record<LifeMarkerFamily, readonly [string, string]>> = Object.freeze({
  TRAVEL_STAY: ["jour", "jours"],
  IMPORTANT_VISITS: ["visite", "visites"],
  DRIVING: ["séance", "séances"],
  LEAVE_REST: ["jour", "jours"],
  WORK_RHYTHM: ["jour", "jours"],
});

export function formatLifeMarkerCount(family: LifeMarkerFamily, value: number): string {
  const [singular, plural] = lifeMarkerNouns[family];
  return formatCount(value, singular, plural);
}

export const spendingPresentationLabels: Readonly<Record<string, string>> = Object.freeze({
  CONSTRAINED: "Contraintes",
  INDISPENSABLE: "Essentiel",
  OPTIONAL: "Optionnel",
  FIXED: "Fixes",
  VARIABLE: "Variables",
  CURRENT_LIFE: "Vie actuelle",
  OUT_OF_DAILY: "Hors quotidien",
  CONSTRAINED__FIXED: "Contraintes fixes",
  CONSTRAINED__VARIABLE: "Contraintes variables",
  INDISPENSABLE__FIXED: "Essentiel fixe",
  INDISPENSABLE__VARIABLE: "Essentiel variable",
  OPTIONAL__FIXED: "Optionnel fixe",
  OPTIONAL__VARIABLE: "Optionnel variable",
});

export function spendingPresentationLabel(value: string): string {
  return spendingPresentationLabels[value] ?? "Autre";
}

export function expenseDisplayTitle(expense: Pick<EconomicExpenseSummary, "label" | "merchantLabel" | "placeLabel">): string {
  const merchant = expense.merchantLabel?.trim();
  if (merchant !== undefined && merchant.length > 0) return merchant;
  const place = expense.placeLabel?.trim();
  if (place !== undefined && place.length > 0) return place;
  return expense.label;
}

export function formatHistoricalRank(rank: number, universeCount: number): string {
  return `${rank === 1 ? "1er" : `${rank}e`} mois le plus dépensier sur ${universeCount}`;
}
