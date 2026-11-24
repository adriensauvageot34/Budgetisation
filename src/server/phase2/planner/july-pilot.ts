import "server-only";
import Big from "big.js";
import { JULY_COMPOSER_MONTH, JULY_PILOT_DATE } from "@/domain/phase2/planner/realized-month-entry";
import { julyPilotStatuses, type JulyPilotStatus } from "@/domain/phase2/planner/july-pilot";
import type { RealizedBoard, RealizedCard, RealizedPayment } from "./realized-month";
import { distinctRealizedPlaces } from "./realized-places";
import { workDayItems } from "./realized-work";

const flows = ["expense", "income", "refund", "transfer", "other"] as const;
const firstDay = `${JULY_COMPOSER_MONTH}-01`;

function sum(payments: readonly RealizedPayment[]) {
  return payments.reduce((total, payment) => total.plus(payment.amount), new Big(0)).toFixed(2);
}

function dateStatus(date?: string): JulyPilotStatus {
  if (!date) return "undated";
  return date > JULY_PILOT_DATE ? "planned" : "pending";
}

function paymentStatus(payment: RealizedPayment, card: RealizedCard): JulyPilotStatus {
  // The bank date decides what was cleared; the activity date decides when it happened.
  if (payment.date <= JULY_PILOT_DATE) return "confirmed";
  const date = payment.activityDate ?? (card.section === "events" || card.work ? card.date : undefined) ?? payment.date;
  return dateStatus(date);
}

function projectCard(card: RealizedCard, paymentsById: ReadonlyMap<string, RealizedPayment>): RealizedCard[] {
  const event = card.section === "events" || card.work !== undefined;
  const references = (card.relatedPayments ?? []).filter(reference => paymentsById.has(reference.id));
  const eventDate = card.date ?? references.map(reference => reference.date).sort()[0];
  const eventStatus = dateStatus(eventDate);
  const hasClearedLinkedExpense = references.some(reference => reference.component?.amount != null
    && paymentsById.get(reference.id)?.flow === "expense" && reference.date <= JULY_PILOT_DATE);
  const occurrenceStatus = (item: NonNullable<RealizedCard["occurrences"]>[number]): JulyPilotStatus => {
    if (item.date > JULY_PILOT_DATE) return "planned";
    return card.payments.some(payment => payment.date <= JULY_PILOT_DATE
      && item.date <= (payment.activityDate ?? payment.date) && (payment.activityDate ?? payment.date) <= item.endDate)
      ? "confirmed" : "pending";
  };
  return julyPilotStatuses.flatMap(status => {
    const payments = card.payments.filter(payment => paymentStatus(payment, card) === status)
      .map(payment => status === "pending" && !payment.activityDate && event && card.date
        ? { ...payment, activityDate: card.date } : payment);
    const occurrences = card.occurrences?.filter(item => occurrenceStatus(item) === status);
    const ownEvent = status === (eventStatus === "pending" && hasClearedLinkedExpense ? "confirmed" : eventStatus);
    const showEvent = ownEvent && (event || !card.payments.length && !card.occurrences?.length)
      && !(status === "pending" && card.payments.some(payment => paymentStatus(payment, card) === "confirmed"));
    if (!payments.length && !occurrences?.length && !showEvent) return [];
    const dates = [...payments.map(payment => status === "confirmed" && (payment.activityDate ?? "") > JULY_PILOT_DATE
      ? payment.date : payment.activityDate ?? payment.date), ...(occurrences ?? []).map(item => item.date)].sort();
    const date = showEvent ? eventDate : dates[0] ?? eventDate;
    const endDate = showEvent ? card.endDate : dates.at(-1);
    const displayBankDetails = status === "confirmed";
    const legs = card.carTrip?.legs?.filter(leg => (leg.date > JULY_PILOT_DATE) === (status === "planned"));
    const tripInPhase = card.carTrip && (showEvent || dateStatus(card.date) === status
      || status === "confirmed" && card.date !== undefined && card.date <= JULY_PILOT_DATE);
    const wholeTrip = tripInPhase && (!card.carTrip?.legs || legs?.length === card.carTrip.legs.length);
    const carTrip = wholeTrip ? card.carTrip : tripInPhase && legs?.length ? {
      route: legs.map(leg => leg.route).join(" · "), compactRoute: legs.map(leg => leg.route).join(" · "),
      distanceKm: legs.reduce((total, leg) => total.plus(leg.distanceKm), new Big(0)).toFixed(1),
      estimatedFuel: legs.reduce((total, leg) => total.plus(leg.estimatedFuel), new Big(0)).toFixed(2), legs,
    } : undefined;
    return [{
      ...card, id: `${card.id}-pilot-${status}`, pilotSourceId: card.id, pilotStatus: status,
      date, endDate, eventStatus: undefined, payments, occurrences,
      keepPaymentsTogether: card.keepPaymentsTogether || event && !!card.date,
      work: card.work && (payments.length === card.payments.length ? card.work : { ...card.work, items: workDayItems(payments, []) }),
      places: event ? card.places : distinctRealizedPlaces([
        ...payments.flatMap(payment => payment.place ?? []), ...(occurrences ?? []).flatMap(item => item.places),
      ]),
      carTrip, amount: payments.length ? sum(payments) : null,
      transferAmounts: displayBankDetails && payments[0]?.flow === "transfer" ? {
        incoming: sum(payments.filter(payment => new Big(payment.amount).gt(0))),
        outgoing: sum(payments.filter(payment => new Big(payment.amount).lt(0))),
      } : undefined,
      relatedPayments: displayBankDetails ? references.filter(reference => reference.date <= JULY_PILOT_DATE) : undefined,
      reviewReferences: displayBankDetails ? card.reviewReferences?.filter(reference => reference.date >= firstDay && reference.date <= JULY_PILOT_DATE) : undefined,
      reviewNotes: showEvent ? card.reviewNotes : undefined,
    }];
  });
}

export function projectJulyPilot(source: RealizedBoard) {
  const paymentsById = new Map(source.cards.flatMap(card => card.payments.map(payment => [payment.id, payment] as const)));
  const projected = source.cards.flatMap(card => projectCard(card, paymentsById));
  const ownerByPayment = new Map(projected.flatMap(card => card.payments.map(payment => [payment.id, card.id] as const)));
  const projectReferences = (card: RealizedCard): RealizedCard => ({
    ...card,
    relatedPayments: card.relatedPayments?.flatMap(reference => {
      const cardId = ownerByPayment.get(reference.id);
      return cardId && cardId !== card.id ? [{ ...reference, cardId }] : [];
    }),
  });
  const cards = projected.map(projectReferences);
  const categoryCards = source.categoryCards?.flatMap(card => projectCard(card, paymentsById).map(projectReferences));
  const bySource = new Map<string, string[]>();
  for (const card of categoryCards ?? cards) {
    const id = card.pilotSourceId!;
    bySource.set(id, [...(bySource.get(id) ?? []), card.id]);
  }
  const confirmed = [...paymentsById.values()].filter(payment => payment.date >= firstDay && payment.date <= JULY_PILOT_DATE);
  const totals = Object.fromEntries(flows.map(flow => {
    const items = confirmed.filter(payment => payment.flow === flow);
    return [flow, { amount: sum(items), count: items.length }];
  })) as RealizedBoard["totals"];
  const board: RealizedBoard = {
    ...source, cards, categoryCards, totals, operationCount: confirmed.length,
    net: sum(confirmed.filter(payment => payment.flow !== "transfer")),
    groups: source.groups.map(group => ({ ...group, cardIds: group.cardIds.flatMap(id => bySource.get(id) ?? []) })),
  };
  return board;
}

export function julyPilotForecast(board: RealizedBoard, cashAtCutoff: string | null) {
  const planned = board.cards.filter(card => card.pilotStatus === "planned");
  const pending = board.cards.filter(card => card.pilotStatus === "pending");
  const expense = (card: RealizedCard) => card.payments.filter(payment => payment.flow === "expense");
  const futureMovements = planned.flatMap(card => card.payments).filter(payment => payment.flow !== "transfer");
  const plannedIncome = sum(futureMovements.filter(payment => payment.flow === "income" || payment.flow === "refund"));
  const plannedFixed = sum(planned.filter(card => card.section === "fixed").flatMap(expense));
  const plannedVariable = sum(planned.filter(card => card.section !== "fixed").flatMap(expense));
  const pendingExpenses = sum(pending.flatMap(expense));
  const confirmedFixed = sum(board.cards.filter(card => card.section === "fixed" && card.pilotStatus === "confirmed").flatMap(expense));
  const confirmedVariable = new Big(board.totals.expense.amount).minus(confirmedFixed).toFixed(2);
  const projectedNet = new Big(board.net).plus(sum(futureMovements)).toFixed(2);
  const fixedCalendar = board.cards.filter(card => card.section === "fixed" && (card.pilotStatus === "confirmed" || card.pilotStatus === "planned"))
    .flatMap(card => expense(card).map(payment => ({
      id: payment.id, label: payment.label, family: card.label,
      date: card.pilotStatus === "confirmed" ? payment.date : payment.activityDate ?? payment.date,
      amount: payment.amount, status: card.pilotStatus!,
    }))).sort((a, b) => a.date.localeCompare(b.date) || a.label.localeCompare(b.label, "fr"));
  return {
    plannedIncome, plannedFixed, plannedVariable, pendingExpenses, confirmedFixed, confirmedVariable, projectedNet, fixedCalendar, cashAtCutoff,
    plannedCount: planned.length, pendingCount: pending.length,
    unpricedCount: planned.filter(card => card.amount === null).length,
    projectedCash: cashAtCutoff === null ? null : new Big(cashAtCutoff).plus(sum(futureMovements)).toFixed(2),
  };
}
