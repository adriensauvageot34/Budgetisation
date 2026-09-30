import Big from "big.js";
import type { CalendarItem } from "./planned-expenses-projection";
import { calendarMetadata } from "./calendar-metadata";

export const calendarMoney = (value: string) => new Intl.NumberFormat("fr-FR", {
  style: "currency", currency: "EUR", minimumFractionDigits: 2, maximumFractionDigits: 2,
}).format(Number(value));
export const calendarDate = (date: string) => new Intl.DateTimeFormat("fr-FR", {
  day: "numeric", month: "long", timeZone: "UTC",
}).format(new Date(`${date}T12:00:00Z`));

export const calendarStateLabel = (item: CalendarItem) => item.nature === "DECLARED_REALIZED"
  ? "✓ Réalisée · déclarée par vous" : item.nature === "PLANNED_EXPENSE"
    ? item.expense?.needsRealityConfirmation ? "Prévue · à confirmer" : "Prévue" : "Échéance";
export const calendarDateLabel = (item: CalendarItem) => item.dateCertainty === "HISTORICAL_ESTIMATE"
  ? "≈ Date habituelle estimée" : item.dateCertainty === "DECLARED" ? "Date précise" : "Sans jour précis";

/** In a compact row the adjacent logo already identifies the brand. Keep the
 * distinguishing contract visible rather than repeating the brand in the text. */
export const calendarEventLabel = (item: CalendarItem) => item.brandKey
  ? (item.calendarLabel ?? item.label).replace(/^[^·]+ · /u, "") : item.calendarLabel ?? item.label;

/** Visual salience only; this never changes financial ordering or totals. */
export function orderCalendarItems(items: readonly CalendarItem[]): CalendarItem[] {
  const priority = (item: CalendarItem) => item.expense?.needsRealityConfirmation ? 0
    : item.nature !== "CERTAIN_OUTFLOW" ? 1 : item.dateCertainty === "DECLARED" ? 2
      : item.dateCertainty === "HISTORICAL_ESTIMATE" ? 4 : 3;
  return [...items].sort((a, b) => priority(a) - priority(b)
    || new Big(b.amount).cmp(a.amount) || a.key.localeCompare(b.key));
}
export const visibleCalendarItems = (items: readonly CalendarItem[]) =>
  orderCalendarItems(items).slice(0, 2);

/** Date certainty breakdown of positioned amounts, not a cash-flow forecast. */
export function calendarDaySummary(items: readonly CalendarItem[]) {
  const exact = items.filter((item) => item.dateCertainty === "DECLARED");
  const estimated = items.filter((item) => item.dateCertainty === "HISTORICAL_ESTIMATE");
  const sum = (rows: readonly CalendarItem[]) => rows.reduce((total, item) => total.plus(item.amount), new Big(0)).toFixed(2);
  return { grossTotal: sum(items), exactDateTotal: sum(exact), estimatedDateTotal: sum(estimated),
    exactCount: exact.length, estimatedCount: estimated.length,
    marker: estimated.length ? exact.length ? "◌" : "≈" : "" };
}

export function calendarInitialDay(targetMonth: string, today: string, items: readonly CalendarItem[]) {
  return today.startsWith(`${targetMonth}-`) ? Number(today.slice(8, 10))
    : Number(items.filter((item) => item.date?.startsWith(`${targetMonth}-`)).map((item) => item.date!).sort()[0]?.slice(8, 10) ?? 1);
}

export function calendarExpenseActions(expense: NonNullable<CalendarItem["expense"]>) {
  return expense.status === "DECLARED_REALIZED"
    ? [{ action: "CORRECT", label: "Corriger" }, { action: "RESTORE", label: "Remettre en prévu" }, { action: "DELETE", label: "Supprimer" }] as const
    : expense.needsRealityConfirmation
      ? [{ action: "DECLARE", label: "Oui, ça a eu lieu" }, { action: "REPORT", label: "Reporter" }, { action: "EDIT", label: "Modifier" }, { action: "DELETE", label: "Ça n’a pas eu lieu" }] as const
      : [{ action: "EDIT", label: "Modifier" }, { action: "REPORT", label: "Reporter" }, { action: "DELETE", label: "Supprimer" }] as const;
}

export function calendarDayDescription(date: string, items: readonly CalendarItem[], total?: string) {
  const summary = calendarDaySummary(items);
  return `${calendarDate(date)} : ${items.length} élément${items.length > 1 ? "s" : ""}`
    + (total ? `, ${calendarMoney(total)} au total` : "")
    + (items.length ? `. ${summary.exactCount} à date précise, ${summary.estimatedCount} à date habituelle estimée. Ouvrir les détails`
      : ". Rien de prévu. Prévoir quelque chose ce jour");
}

/** Roving focus stays in this month; Home/End move within the current week. */
export function calendarKeyboardDay(day: number, key: string, days: number, firstWeekday: number) {
  const weekday = (firstWeekday + day - 1) % 7;
  const next = ({ ArrowLeft: day - 1, ArrowRight: day + 1, ArrowUp: day - 7,
    ArrowDown: day + 7, Home: day - weekday, End: day + 6 - weekday } as Record<string, number>)[key];
  return next === undefined ? null : Math.max(1, Math.min(days, next));
}

export function calendarIcon(item: CalendarItem): { brandKey: string | null; semanticIconKey: string } {
  if (item.expense) {
    const { familyKey, subtypeKey } = item.expense;
    const subtypeIcons: Record<string, string> = { house_party: "celebration", family_visit: "family",
      friend_visit: "friends", trip_stay: "travel", groceries: "groceries", restaurant: "restaurant",
      fast_food: "food_delivery", work_meal: "restaurant", club_festival: "nightlife", bar: "nightlife",
      beauty: "personal_care", clothing: "shopping", tech: "remote_work", automotive: "vehicle_service" };
    return { brandKey: null, semanticIconKey: subtypeIcons[subtypeKey ?? ""]
      ?? ({ activity: "leisure", purchase: "shopping", visit_trip: "travel", food: "restaurant", outing: "celebration", other: "moment" })[familyKey] };
  }
  const metadata = item.calendarLabel === undefined ? calendarMetadata(item.label, item) : item;
  const brandIcons: Record<string, string> = { sfr: "remote_work", edf: "home", google: "remote_work", openai: "remote_work",
    max: "culture", pacifica: "administrative", "credit-agricole": "bank_cash", nexity: "home" };
  const groupIcons: Record<string, string> = { Maison: "home", Télécom: "remote_work", Assurances: "administrative",
    Banque: "bank_cash", Abonnements: "culture", Permis: "driving_lesson", Épargne: "bank_cash" };
  return { brandKey: metadata.brandKey ?? null, semanticIconKey: groupIcons[item.group ?? ""]
    ?? brandIcons[metadata.brandKey ?? ""] ?? "administrative" };
}
