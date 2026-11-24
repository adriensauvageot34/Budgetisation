import "server-only";
import { distinctRealizedPlaces } from "./realized-places";
import type { CardGroup, RealizedPayment } from "./realized-month";
import type { JulyParticipant } from "./july-realized-decisions";

export type ReviewReference = Readonly<{ id: string; role: string; label: string; date: string; amount: string }>;
type ReviewCard = Readonly<{
  id: string; label: string; date: string; endDate?: string; activity: string; participant?: JulyParticipant;
  eventId?: string; operationIds: readonly string[]; references?: readonly { id: string; role: string }[];
  legIds?: readonly string[]; notes?: readonly string[]; groups?: Readonly<Record<string, string>>;
}>;
export type RealizedReview = Readonly<{
  version: 1; cards: readonly ReviewCard[];
  participants: Readonly<Record<string, JulyParticipant>>;
  purchaseActors?: Readonly<Record<string, string>>;
}>;

export function parseRealizedReview(value: unknown): RealizedReview | undefined {
  if (!value || typeof value !== "object") return undefined;
  const review = value as Partial<RealizedReview>;
  if (review.version !== 1 || !Array.isArray(review.cards) || !review.participants
    || typeof review.participants !== "object" || Array.isArray(review.participants)) return undefined;
  return review as RealizedReview;
}

export function applyRealizedReview(input: {
  review: RealizedReview;
  cards: Map<string, CardGroup>;
  event: (id: string) => Pick<CardGroup, "places" | "eventStatus"> | undefined;
  art: (activity: string) => CardGroup["art"];
  trip: (ids: readonly string[], participant?: JulyParticipant) => CardGroup["carTrip"];
  references: ReadonlyMap<string, Omit<ReviewReference, "role">>;
}) {
  const { review, cards, event, art, trip, references } = input;
  const owners = new Map<string, string>();
  const legOwners = new Map<string, string>();
  const payments = new Map<string, RealizedPayment>();
  const changedSources = new Set<string>();
  const reviewedEventIds = new Set(review.cards.flatMap(spec => spec.eventId ?? []));
  for (const spec of review.cards) {
    for (const id of spec.operationIds) {
      if (owners.has(id) && owners.get(id) !== spec.id) throw new Error("REALIZED_REVIEW_DUPLICATE_OPERATION");
      owners.set(id, spec.id);
    }
    for (const id of spec.legIds ?? []) {
      if (legOwners.has(id) && legOwners.get(id) !== spec.id) throw new Error("REALIZED_REVIEW_DUPLICATE_LEG");
      legOwners.set(id, spec.id);
    }
  }
  for (const card of cards.values()) {
    card.payments = card.payments.flatMap(payment => {
      const participant = review.participants[payment.id];
      const reviewActor = review.purchaseActors?.[payment.id];
      const presented = participant || reviewActor ? { ...payment, participant: participant ?? payment.participant, reviewActor } : payment;
      payments.set(payment.id, presented);
      const owner = payment.flow === "expense" ? owners.get(payment.id) : undefined;
      if (owner && owner !== card.id) changedSources.add(card.id);
      return !owner || owner === card.id ? [presented] : [];
    });
    card.occurrences = card.occurrences?.filter(item => !reviewedEventIds.has(item.id) || card.id === `event-${item.id}`);
    const oldLegs = card.carTrip?.legIds;
    if (oldLegs?.some(id => legOwners.has(id) && legOwners.get(id) !== card.id)) {
      changedSources.add(card.id);
      card.carTrip = trip(oldLegs.filter(id => !legOwners.has(id) || legOwners.get(id) === card.id), card.participant);
    }
  }
  for (const spec of review.cards) {
    const previous = cards.get(spec.id);
    const selected = [...new Map([...(previous?.payments ?? []),
      ...spec.operationIds.flatMap(id => payments.get(id)?.flow === "expense" ? [payments.get(id)!] : [])]
      .map(payment => [payment.id, payment])).values()].sort((a, b) => a.date.localeCompare(b.date));
    const direct = spec.eventId ? event(spec.eventId) : undefined;
    const linked = (spec.references ?? []).flatMap(({ id, role }) => {
      const row = references.get(id);
      return row ? [{ ...row, role }] : [];
    });
    cards.set(spec.id, {
      ...previous,
      id: spec.id, section: "events", label: spec.label, date: spec.date, endDate: spec.endDate,
      art: previous?.art ?? art(spec.activity),
      eventStatus: direct?.eventStatus ?? previous?.eventStatus,
      participant: spec.participant ?? previous?.participant,
      places: distinctRealizedPlaces([...(direct?.places ?? []), ...(previous?.places ?? []), ...selected.flatMap(payment => payment.place ?? [])]),
      payments: selected.map(payment => spec.groups?.[payment.id] ? { ...payment, reviewGroup: spec.groups[payment.id] } : payment),
      keepPaymentsTogether: true,
      carTrip: spec.legIds ? trip(spec.legIds, spec.participant) : previous?.carTrip,
      reviewNotes: spec.notes,
      reviewReferences: linked,
    });
  }
  const currentOwners = new Map([...cards.values()].flatMap(card => card.payments.map(payment => [payment.id, card] as const)));
  for (const [id, card] of cards) {
    card.relatedPayments = card.relatedPayments?.flatMap(payment => {
      const owner = currentOwners.get(payment.id);
      return !owner || owner.id === id || card.reviewReferences?.some(reference => reference.id === payment.id)
        ? [] : [{ ...payment, cardId: owner.id, cardLabel: owner.label }];
    });
    if (changedSources.has(id) && !id.startsWith("event-") && !card.payments.length && !card.occurrences?.length && !card.carTrip
      && !card.reviewNotes?.length && !card.reviewReferences?.length && !card.relatedPayments?.length
      && !review.cards.some(spec => spec.id === id)) cards.delete(id);
  }
}
