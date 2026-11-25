import "server-only";
import type { RealizedBoard, RealizedCard, RealizedCardGroup, RealizedPayment } from "@/server/phase2/planner/realized-month";
import type { RealizedPlace } from "@/server/phase2/planner/realized-places";
import type { RealizedWork, RealizedWorkItem } from "@/server/phase2/planner/realized-work";
import { realizedCardViews, type RealizedCardView } from "./realized-card-view";
import { cardCaption, paymentSearch, searchableDate, searchText } from "./realized-card-text";

type Category = Pick<RealizedCardGroup, "id" | "label" | "shortLabel">;
export type RealizedCardSummary = Pick<RealizedCard,
  "id" | "section" | "label" | "art" | "date" | "endDate" | "eventStatus" | "amount" | "pilotStatus" | "participant" | "mobilityNote"
> & {
  sourceId: string;
  pilotSourceId?: string;
  categoryId?: Category["id"];
  caption?: string;
  dialogCaption: string;
  sortDate?: string;
  paymentIds: readonly string[];
  badges: readonly NonNullable<RealizedPayment["badge"]>[];
  places?: readonly Pick<RealizedPlace, "label" | "certainty">[];
  relatedCount: number;
  hasTransfers: boolean;
  trip?: Pick<NonNullable<RealizedCard["carTrip"]>, "route" | "compactRoute" | "estimatedFuel">;
  travel?: string;
  work?: Pick<RealizedWork, "participant" | "mode" | "name"> & {
    items: readonly Pick<RealizedWorkItem, "id" | "label" | "count" | "badge">[];
  };
  search: readonly string[];
};

export type RealizedBoardOverview = Pick<RealizedBoard, "month" | "participantPortraits" | "julyPortraits"> & {
  cards: Readonly<Record<string, RealizedCardSummary>>;
  flatKeys: readonly string[];
  categoryKeys: readonly string[];
  groups: readonly Category[];
};
export type InitialRealizedDetail = Readonly<{ key: string; card: RealizedCard }>;

function summarize({ card, source, operation }: RealizedCardView, category?: Category): RealizedCardSummary {
  const { id, section, label, art, date, endDate, eventStatus, amount, pilotStatus, participant, mobilityNote } = card;
  const sortDate = date ?? [
    ...card.payments.map(payment => payment.date),
    ...(card.occurrences ?? []).map(item => item.date),
    ...(card.relatedPayments ?? []).map(payment => payment.date),
  ].sort()[0];
  const operationCaption = operation?.category ?? source.label;
  const dialogCaption = cardCaption(card);
  const search = [
    searchText(label, date, endDate, searchableDate(date), dialogCaption, participant),
    ...(card.places ?? []).map(place => searchText(label, place.label, place.address, searchableDate(date))),
    ...(card.work?.items ?? []).map(item => searchText(label, item.label, searchableDate(date))),
    searchText(source.label, category?.label, category?.shortLabel),
    ...(card.carTrip ? [searchText(label, "trajet voiture essence", card.carTrip.route, card.carTrip.compactRoute)] : []),
    ...(card.observedTravel ?? []).map(route => searchText(label, "trajet", route)),
    ...card.payments.map(payment => searchText(source.label, label, paymentSearch(payment))),
    ...(card.occurrences ?? []).map(occurrence => searchText(label, occurrence.label, occurrence.date, searchableDate(occurrence.date))),
    ...(card.relatedPayments ?? []).map(payment => searchText(label, payment.label, payment.cardLabel,
      payment.date, searchableDate(payment.date), payment.component?.amount)),
    ...(card.reviewReferences ?? []).map(ref => searchText(label, ref.label, ref.role, searchableDate(ref.date))),
  ];
  const trip = card.carTrip && {
    route: card.carTrip.route, compactRoute: card.carTrip.compactRoute, estimatedFuel: card.carTrip.estimatedFuel,
  };
  const work = card.work && {
    participant: card.work.participant, mode: card.work.mode, name: card.work.name,
    items: card.work.items.map(({ id, label, count, badge }) => ({ id, label, count, badge })),
  };
  return {
    id, section, label, art, date, endDate, eventStatus, amount, pilotStatus, participant, mobilityNote,
    sourceId: source.id, pilotSourceId: source.pilotSourceId, categoryId: category?.id, sortDate, dialogCaption,
    caption: operation ? operationCaption === label ? undefined : operationCaption : cardCaption(card, null),
    paymentIds: card.payments.map(payment => payment.id),
    badges: card.work ? [] : [...new Map(card.payments.flatMap(payment => payment.badge
      ? [[payment.badge.label, payment.badge] as const] : [])).values()],
    places: card.places?.map(({ label, certainty }) => ({ label, certainty })),
    relatedCount: (card.relatedPayments?.length ?? 0) + (card.reviewReferences?.length ?? 0),
    hasTransfers: !!card.transferAmounts,
    trip, travel: card.observedTravel?.[0], work,
    search: [...new Set(search.filter(Boolean).map(line => [...new Set(line.split(" "))].join(" ")))],
  };
}

export function realizedBoardOverview(board: RealizedBoard, initialCardId?: string) {
  const { month, participantPortraits, julyPortraits } = board;
  const categoryByCard = new Map<string, Category>();
  const groups = board.groups.map(({ id, label, shortLabel, cardIds }) => {
    const group = { id, label, shortLabel };
    for (const cardId of cardIds) categoryByCard.set(cardId, group);
    return group;
  });
  const cards: Record<string, RealizedCardSummary> = {};
  const flat = realizedCardViews(board, false);
  const flatById = new Map(flat.map(view => [view.card.id, view]));
  const flatKeys = flat.map(view => {
    const key = `flat:${view.card.id}`;
    cards[key] = summarize(view, categoryByCard.get(view.source.id));
    return key;
  });
  const categoryKeys = realizedCardViews(board, true).map(view => {
    const same = flatById.get(view.card.id);
    if (same?.card === view.card && same.source === view.source && !same.operation) return `flat:${view.card.id}`;
    const key = `category:${view.card.id}`;
    cards[key] = summarize(view, categoryByCard.get(view.source.id));
    return key;
  });
  const target = initialCardId && (flatById.get(initialCardId) ?? flat.find(view => view.source.id === initialCardId));
  const initialDetail = target ? { key: `flat:${target.card.id}`, card: target.card } : undefined;
  const overview = { month, participantPortraits, julyPortraits, cards, flatKeys, categoryKeys, groups } satisfies RealizedBoardOverview;
  return { overview, initialDetail };
}
