import Big from "big.js";
import type { CalendarItem } from "./planned-expenses-projection";
import { calendarMetadata } from "./calendar-metadata";
import { getPlannedExpenseDateRange } from "@/domain/phase2/planned-dates";
import { layoutCalendarRibbons } from "@/core/calendar-ribbons";
import { parseLocalDate } from "@/core/time";

export const calendarMoney = (value: string) => new Intl.NumberFormat("fr-FR", {
  style: "currency", currency: "EUR", minimumFractionDigits: 2, maximumFractionDigits: 2,
}).format(Number(value));
export const calendarBudgetLabel = (item: Pick<CalendarItem, "expense" | "amount">) => item.expense?.context.project?.unpricedComponents?.length
  ? Number(item.amount) === 0 ? "À préciser" : `≥ ${calendarMoney(item.amount)}` : calendarMoney(item.amount);
export const calendarDate = (date: string) => new Intl.DateTimeFormat("fr-FR", {
  day: "numeric", month: "long", timeZone: "UTC",
}).format(new Date(`${date}T12:00:00Z`));

export const calendarStateLabel = (item: Pick<CalendarItem, "expense" | "nature">) => item.nature === "DECLARED_REALIZED"
  ? "✓ Réalisée · déclarée par vous" : item.nature === "PLANNED_EXPENSE"
    ? item.expense?.needsRealityConfirmation ? "Prévue · à confirmer" : "Prévue" : "Échéance";
export const calendarDateLabel = (item: CalendarItem) => item.dateCertainty === "HISTORICAL_ESTIMATE"
  ? "Date habituelle estimée" : item.dateCertainty === "DECLARED" ? "Date précise" : "Sans jour précis";

/** In a compact row the adjacent logo already identifies the brand. Keep the
 * distinguishing contract visible rather than repeating the brand in the text. */
export const calendarEventLabel = (item: CalendarItem) => item.calendarLabel ?? item.label;

/** Visual salience only; this never changes financial ordering or totals. */
export function orderCalendarItems(items: readonly CalendarItem[]): CalendarItem[] {
  const priority = (item: CalendarItem) => item.expense?.needsRealityConfirmation ? 0
    : item.nature === "PLANNED_EXPENSE" ? 1 : item.nature === "DECLARED_REALIZED" ? 2
      : item.dateCertainty === "DECLARED" ? 3 : item.dateCertainty === "HISTORICAL_ESTIMATE" ? 5 : 4;
  return [...items].sort((a, b) => priority(a) - priority(b)
    || new Big(b.amount).cmp(a.amount) || a.key.localeCompare(b.key));
}
export const visibleCalendarItems = (items: readonly CalendarItem[]) =>
  orderCalendarItems(items).slice(0, 2);

/** Date certainty breakdown of positioned amounts, not a cash-flow forecast. */
export function calendarDaySummary(items: readonly CalendarItem[], date?: string) {
  // A continuation is visible that day, but its amount is anchored only once.
  items = date ? items.filter(item => item.date === date) : items;
  const exact = items.filter((item) => item.dateCertainty === "DECLARED");
  const estimated = items.filter((item) => item.dateCertainty === "HISTORICAL_ESTIMATE");
  const sum = (rows: readonly CalendarItem[]) => rows.reduce((total, item) => total.plus(item.amount), new Big(0)).toFixed(2);
  return { grossTotal: sum(items), exactDateTotal: sum(exact), estimatedDateTotal: sum(estimated),
    exactCount: exact.length, estimatedCount: estimated.length };
}

export const calendarItemRange = (item: CalendarItem) => item.expense ? getPlannedExpenseDateRange(item.expense)
  : { startDate: item.date, endDate: item.date, isRange: false, hasReturn: false };
export function calendarItemsOnDate(items: readonly CalendarItem[], date: string) {
  return items.filter(item => { const r = calendarItemRange(item); return !!r.startDate && !!r.endDate && date >= r.startDate && date <= r.endDate; });
}
export function calendarRibbonWeeks(items: readonly CalendarItem[], month: string) {
  const end = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0)).toISOString().slice(0, 10);
  return layoutCalendarRibbons(items.flatMap(item => { const r = calendarItemRange(item); return r.isRange ? [{ calendarItemId: item.key,
    startDate: parseLocalDate(r.startDate!), endDate: parseLocalDate(r.endDate!), priorityBand: item.expense?.needsRealityConfirmation ? 2 : 1, priorityWeight: 0 }] : []; }),
    parseLocalDate(`${month}-01`), parseLocalDate(end));
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
  return `${calendarDate(date)}. ${items.length} élément${items.length > 1 ? "s" : ""}`
    + (total ? `. Total ${calendarMoney(total)}` : "")
    + (items.length ? ". Ouvrir les détails"
      : ". Rien de prévu. Prévoir quelque chose ce jour");
}

/** Local panel positioning only; no calendar/financial state is derived here. */
export function calendarPopoverPosition(anchor: { left: number; right: number; top: number; bottom: number },
  viewport: { width: number; height: number }, panel: { width: number; height: number }) {
  const gap = 8, margin = 12;
  const left = Math.max(margin, Math.min(anchor.left, viewport.width - panel.width - margin));
  const below = anchor.bottom + gap;
  const top = below + panel.height <= viewport.height - margin ? below
    : Math.max(margin, Math.min(anchor.top - panel.height - gap, viewport.height - panel.height - margin));
  return { left, top };
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
