import type { RealizedCard, RealizedPayment } from "@/server/phase2/planner/realized-month";
import { money, plannedDayLabel } from "./display";

const fullDate = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

export function days(date: string, end?: string) {
  const start = plannedDayLabel(date);
  return end && end !== date ? `${start} – ${plannedDayLabel(end)}` : start;
}

export function searchText(...values: readonly (string | undefined | null)[]) {
  return values.join(" ").normalize("NFD").replace(/\p{Diacritic}/gu, "")
    .toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

export function searchableDate(date: string | undefined) {
  return date ? fullDate.format(new Date(`${date}T12:00:00Z`)) : undefined;
}

export function paymentSearch(payment: RealizedPayment) {
  return searchText(payment.label, payment.bankLabel, payment.category, payment.date, searchableDate(payment.date), days(payment.date),
    payment.place?.label, payment.place?.address, payment.amount, money(payment.amount), ...payment.components.map(component => component.label));
}

export function matches(text: string, terms: readonly string[]) {
  return terms.every(term => text.includes(term));
}

export function cardCaption(card: RealizedCard, date: string | null | undefined = card.date) {
  const number = card.occurrences?.length;
  const count = card.payments.length;
  const estimated = card.pilotStatus && card.pilotStatus !== "confirmed";
  return [date ? days(date, card.endDate) : null,
    number ? `${number} ${number === 1 ? "occurrence" : "occurrences"}` : null,
    count ? `${count} ${estimated ? count === 1 ? "élément budgété" : "éléments budgétés" : count === 1 ? "opération" : "opérations"}` : null].filter(Boolean).join(" · ");
}
