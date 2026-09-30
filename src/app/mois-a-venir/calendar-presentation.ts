import Big from "big.js";
import type { CalendarItem } from "./planned-expenses-projection";

export const calendarMoney = (value: string) => new Intl.NumberFormat("fr-FR", {
  style: "currency", currency: "EUR", minimumFractionDigits: 2, maximumFractionDigits: 2,
}).format(Number(value));
export const calendarDate = (date: string) => new Intl.DateTimeFormat("fr-FR", {
  day: "numeric", month: "long", timeZone: "UTC",
}).format(new Date(`${date}T12:00:00Z`));

export const calendarStateLabel = (item: CalendarItem) => item.nature === "DECLARED_REALIZED"
  ? "✓ Réalisée · déclarée par vous" : item.nature === "PLANNED_EXPENSE"
    ? item.expense?.needsRealityConfirmation ? "Prévue · à confirmer" : "Prévue" : "Charge certaine";
export const calendarDateLabel = (item: CalendarItem) => item.dateCertainty === "HISTORICAL_ESTIMATE"
  ? "~ Date habituelle estimée" : item.dateCertainty === "DECLARED" ? "Date déclarée" : "Date à confirmer";

/** Canonical MASTER presentation order: exact before estimated, then declared,
 * certain, planned. Amount descending at equal priority; stable identity tie-break. */
export function orderCalendarItems(items: readonly CalendarItem[]): CalendarItem[] {
  const state = { DECLARED_REALIZED: 0, CERTAIN_OUTFLOW: 1, PLANNED_EXPENSE: 2 };
  return [...items].sort((a, b) => Number(a.dateCertainty === "HISTORICAL_ESTIMATE")
    - Number(b.dateCertainty === "HISTORICAL_ESTIMATE") || state[a.nature] - state[b.nature]
    || new Big(b.amount).cmp(a.amount) || a.key.localeCompare(b.key));
}
export const visibleCalendarItems = (items: readonly CalendarItem[]) =>
  orderCalendarItems(items).slice(0, items.length >= 4 ? 2 : 3);

export function calendarDayDescription(date: string, items: readonly CalendarItem[], total?: string) {
  return `${calendarDate(date)} : ${items.length} élément${items.length > 1 ? "s" : ""}`
    + (total ? `, ${calendarMoney(total)} au total` : "")
    + (items.length ? `. ${orderCalendarItems(items).map((item) =>
      `${item.label}, ${calendarMoney(item.amount)}, ${calendarStateLabel(item)}, ${calendarDateLabel(item)}`).join(" ; ")}` : ". Rien de prévu");
}

/** Roving focus stays in this month; Home/End move within the current week. */
export function calendarKeyboardDay(day: number, key: string, days: number, firstWeekday: number) {
  const weekday = (firstWeekday + day - 1) % 7;
  const next = ({ ArrowLeft: day - 1, ArrowRight: day + 1, ArrowUp: day - 7,
    ArrowDown: day + 7, Home: day - weekday, End: day + 6 - weekday } as Record<string, number>)[key];
  return next === undefined ? null : Math.max(1, Math.min(days, next));
}

// Local brandmarks in public/brands; unrecognized charges keep the semantic icon.
const brands = [
  ["sfr", /\bSFR\b/iu, "remote_work"], ["edf", /\bEDF\b/iu, "home"],
  ["google", /Google/iu, "remote_work"], ["openai", /ChatGPT|OpenAI/iu, "remote_work"],
  ["max", /\bMax\b/iu, "culture"], ["pacifica", /Pacifica/iu, "administrative"],
  ["credit-agricole", /Crédit Agricole/iu, "bank_cash"], ["nexity", /Nexity|loyer/iu, "home"],
] as const;
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
  const brand = brands.find(([, pattern]) => pattern.test(item.label));
  return { brandKey: brand?.[0] ?? null, semanticIconKey: brand?.[2]
    ?? (/Épargne/iu.test(item.label) ? "bank_cash" : "administrative") };
}
