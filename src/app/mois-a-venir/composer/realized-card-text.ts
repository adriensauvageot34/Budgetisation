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

export const realizedFlowLabels = {
  expense: "Dépense", income: "Revenu", refund: "Remboursement", transfer: "Transfert", other: "Autre mouvement",
} satisfies Record<RealizedPayment["flow"], string>;

const genericPurchaseUse = /^(a classer|achats? personnels?|depenses? diverses?|contenu connu.*|composant de depense|non classe|inconnu)$/u;

export function paymentPresentation(payment: RealizedPayment, context?: string) {
  const { label, flow, category } = payment;
  const type = searchText(category, payment.preciseType);
  const direction = Number(payment.amount) < 0 ? "Vers" : "De";
  if (flow === "income" && /\bsalaire\b|revenu professionnel/u.test(type)) {
    return { title: /^salaire\b/u.test(searchText(label)) ? label : `Salaire · ${label}`,
      context: payment.participant ? `Bénéficiaire · ${payment.participant}` : undefined };
  }
  if (flow === "transfer" || (flow === "other" && /\bvirement\b/u.test(type))) {
    return { title: direction === "Vers" ? "Virement envoyé" : "Virement reçu",
      context: /^virement\b/u.test(searchText(label)) ? category ?? label : `${direction} ${label}` };
  }
  if (flow === "refund") {
    return { title: "Remboursement", context: /^remboursement\b/u.test(searchText(label)) ? category ?? label : `De ${label}` };
  }
  const knownUses = [...new Set(payment.components.map(item => item.label).filter(use =>
    !genericPurchaseUse.test(searchText(use)) && searchText(use) !== searchText(label)))];
  const usage = flow === "expense" && (knownUses.length === 1 ? knownUses[0] : payment.purchaseUse);
  const caption = [usage || undefined, category, context].find(value =>
    value && !genericPurchaseUse.test(searchText(value)) && searchText(value) !== searchText(label));
  return { title: label, context: caption };
}

export function usefulMobilityNote(note?: string) {
  return note && !/(?<![\d,.])0(?:[,.]0{1,2})?\s*€\s*estimés?(?=\s|[.,;·)]|$)/iu.test(note) ? note : undefined;
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
