"use client";

import Link from "next/link";
import { ArrowLeft, ArrowRight, ExternalLink, MapPin, Pencil, PiggyBank, Search, Utensils, X } from "lucide-react";
import { memo, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { ARCHIVED_REALIZED_MONTHS, isArchivedRealizedMonth, isImportedRealizedMonth, realizedComposerHref } from "@/domain/phase2/planner/realized-month-entry";
import { julyPilotLabels, julyPilotStatuses, type JulyPilotStatus } from "@/domain/phase2/planner/july-pilot";
import type { RealizedCard, RealizedPayment } from "@/server/phase2/planner/realized-month";
import type { RealizedPlace } from "@/server/phase2/planner/realized-places";
import { ComposerAssetVisual } from "./compact-catalog-visual";
import { money, monthLabel, plannedDayLabel } from "./display";
import { RealizedBadge } from "./realized-badge";
import { JulyPilotChip } from "./reconstructed-cards";
import { JulyEditLink } from "./july-edit-link";
import { realizedOperationCardId, type PackedCardPosition } from "./realized-card-view";
import { days, matches, paymentPresentation, paymentSearch, realizedFlowLabels, searchableDate, searchText, usefulMobilityNote } from "./realized-card-text";
import type { InitialRealizedDetail, RealizedBoardOverview, RealizedCardSummary } from "./realized-overview";
import { unpackRealizedOverview, type PackedRealizedOverview } from "./realized-overview-wire";
import { useRealizedRailLayout } from "./realized-rail-layout";
import { SavingsDock, savingsGoalHref, savingsPayments } from "./savings-dock";
import { readCardSavingsLinks } from "./savings-dock-actions";
import styles from "./realized-month.module.css";

const sortOptions = [
  { id: "amount-desc", label: "Montant du plus grand au plus petit" },
  { id: "amount-asc", label: "Montant du plus petit au plus grand" },
  { id: "date", label: "Chronologique" },
  { id: "category", label: "Par catégorie" },
] as const;
type SortOrder = typeof sortOptions[number]["id"];
const flowFilters = [
  ["", "Tout"], ["expense", "Dépenses"], ["income", "Revenus"], ["refund", "Remboursements"], ["transfer", "Transferts"],
] as const;
type FlowFilter = typeof flowFilters[number][0];
const distance = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 });
const carArtwork = "option:activity:transport:car";

const placeStatus = { confirmed: "Confirmé", probable: "Lieu probable", town: "Commune" } as const;

function PlaceLink({ place, detail }: { place: RealizedPlace; detail?: boolean }) {
  return <span className={styles.placeLink}>
    {place.mapsUrl ? <a href={place.mapsUrl} target="_blank" rel="noopener noreferrer" title="Ouvrir dans Google Maps">
      {place.label}<ExternalLink size={12} aria-hidden="true" />
    </a> : <strong>{place.label}</strong>}
    {detail && <small>{[placeStatus[place.certainty], place.address].filter(Boolean).join(" · ")}</small>}
  </span>;
}

function RealizedElement({ payment, highlighted, estimated = false }: { payment: RealizedPayment; highlighted: boolean; estimated?: boolean }) {
  const { title, context } = paymentPresentation(payment);
  const beneficiary = payment.flow === "expense" ? payment.recipient
    ?? (payment.participant === "Couple" && searchText(payment.category) === "courses alimentaires" ? "le Couple" : undefined) : undefined;
  return <li className={styles.element} data-realized-operation={payment.id} data-highlighted={highlighted || undefined} tabIndex={-1}>
    <div className={styles.elementVisual}>
      {payment.badge
        ? <RealizedBadge {...payment.badge} />
        : payment.art && <ComposerAssetVisual assetKey={payment.art.assetKey ?? ""} templateKey={payment.art.templateKey}
          iconKey={payment.art.iconKey} size={30} />}
    </div>
    <div className={styles.elementIdentity}>
      <strong>{title}</strong>
      <span>{[days(estimated ? payment.activityDate ?? payment.date : payment.date), context].filter(Boolean).join(" · ")}</span>
      {!estimated && payment.bankLabel !== payment.label && <small>{payment.bankLabel}</small>}
      {payment.inferredEvent && <small>Rattachement estimé à cet événement</small>}
      {payment.place && <PlaceLink place={payment.place} detail />}
      {!estimated && payment.reviewActor ? <small>{payment.reviewActor}</small>
        : payment.shopper && <small>{payment.shopperInferred ? "Courses probablement faites par" : "Courses faites par"} {payment.shopper}</small>}
      {beneficiary && <small>Pour {beneficiary}</small>}
      {payment.flow === "expense" && payment.participant && !beneficiary && <small>Personne associée · {payment.participant}</small>}
      {payment.mobilityNote && <small>{payment.mobilityNote}</small>}
    </div>
    <b className={styles.amount}>{money(payment.amount)}</b>
    {!estimated && payment.components.length > 0 && <dl className={styles.components} aria-label="Détail économique de l’opération">
      {payment.components.map(component => <div key={component.id} data-realized-component={component.id} tabIndex={-1}>
        <dt>{component.label}</dt><dd>{money(component.amount)}</dd>
      </div>)}
    </dl>}
  </li>;
}

function CardArtwork({ card, size }: { card: Pick<RealizedCard, "art">; size: number }) {
  if (card.art.src) return <img src={card.art.src} alt="" className={styles.cardVisual} width={size} height={size} loading="lazy" />;
  return <ComposerAssetVisual assetKey={card.art.assetKey ?? ""} templateKey={card.art.templateKey}
    iconKey={card.art.iconKey} className={styles.cardVisual} scale={size > 48 ? "CARD" : "LIBRARY"} size={size} />;
}

function CardDate({ date, end }: { date: string; end?: string }) {
  const hasRange = end && end !== date;
  const sameMonth = hasRange && date.slice(0, 7) === end.slice(0, 7);
  return <span className={styles.cardDate}>
    <time dateTime={date} title={searchableDate(date)}>{sameMonth ? Number(date.slice(-2)) : plannedDayLabel(date)}</time>
    {hasRange && <>–<time dateTime={end} title={searchableDate(end)}>{plannedDayLabel(end)}</time></>}
  </span>;
}

function ParticipantBadge({ name, portrait, role = "Participant" }: { name: string; portrait?: string; role?: string }) {
  return <span className={styles.workParticipant} data-realized-participant={name} title={`${role} · ${name}`}>
    {portrait ? <img src={portrait} alt={`${role} · ${name}`} width={29} height={29} />
      : <span aria-label={`${role} · ${name}`}>{name === "Manon et son père" ? "M+" : name.slice(0, 1)}</span>}
  </span>;
}

function WorkDayFooter({ work }: { work: NonNullable<RealizedCardSummary["work"]> }) {
  return <span className={styles.workFooter}>
    <span className={styles.workItems}>
      {work.items.map(item => <span key={item.id} className={styles.workItem} data-work-item={item.count}>
        {item.badge ? <RealizedBadge {...item.badge} /> : <Utensils size={14} aria-hidden="true" />}
        <span title={item.label}>{item.label}</span>
        {item.count > 1 && <strong aria-label={`${item.count} achats`}>×{item.count}</strong>}
      </span>)}
    </span>
  </span>;
}

const RealizedMonthCard = memo(function RealizedMonthCard({ card, category, open, date, position, portrait }: {
  card: RealizedCardSummary; category?: RealizedBoardOverview["groups"][number]; open: (cardId: string) => void; date?: string;
  position?: PackedCardPosition; portrait?: string;
}) {
  const { badges, relatedCount, caption, trip, travel } = card;
  const visibleDate = card.date ?? date ?? (card.paymentIds.length === 1 ? card.sortDate : undefined);
  const displayTitle = card.displayTitle ?? card.label;
  const flow = card.flowKinds?.length === 1 ? card.flowKinds[0] : undefined;
  const isEstimated = !!card.pilotStatus && card.pilotStatus !== "confirmed";
  const paymentCount = card.paymentIds.length;
  const participant = card.work?.name ?? card.participant;
  const hasBeneficiary = caption?.startsWith("Bénéficiaire · ");
  const firstPlace = card.places?.[0];
  const additionalPlaces = (card.places?.length ?? 0) - 1;
  const location = firstPlace ? category?.id === "groceries" && firstPlace.label.startsWith(`${card.label} `)
    ? firstPlace.label.slice(card.label.length).replace(/^[\s–—·-]+/u, "") || firstPlace.label : firstPlace.label
    : card.label === "Restaurant" && card.section === "events" ? "Lieu à confirmer" : undefined;
  const context = category?.id === "groceries" && location && searchText(caption) === "courses alimentaires" ? undefined : caption;
  const entryCount = card.section === "events" && paymentCount > 0
    ? `${paymentCount} ${isEstimated ? paymentCount === 1 ? "élément budgété" : "éléments budgétés"
      : paymentCount === 1 ? "opération rattachée" : "opérations rattachées"}` : undefined;
  const subtitle = entryCount ?? (card.hasTransfers ? "Solde des transferts" : context);
  const unpriced = isEstimated || card.work || paymentCount > 0 ? "Montant à confirmer"
    : relatedCount ? "Paiements dans d’autres cartes" : "Aucun paiement rattaché";
  const mobilityNote = usefulMobilityNote(card.mobilityNote);
  const compactTravel = usefulMobilityNote(travel);
  return <button id={card.id} type="button" className={styles.card} data-realized-card={card.section}
    data-realized-category={category?.id} data-card-date={visibleDate} data-pilot-status={card.pilotStatus}
    data-operation-id={card.paymentIds.length === 1 ? card.paymentIds[0] : undefined}
    data-operation-count={card.paymentIds.length} data-card-amount={card.amount ?? undefined}
    data-realized-work={card.work?.mode}
    style={position ? { "--card-column": position.column, insetBlockStart: position.top, minHeight: position.height } as CSSProperties : undefined}
    aria-haspopup="dialog" onClick={() => open(card.id)}>
    <span className={styles.cardContent} data-realized-card-content>
      <span className={styles.cardVisuals}>
        <CardArtwork card={card} size={38} />
        {!card.work && badges.length > 0 && <span className={styles.badges} aria-label="Marchands">
          {badges.slice(0, 2).map(badge => <RealizedBadge key={badge.label} {...badge} named />)}
        </span>}
      </span>
      <span className={styles.cardIdentity}>
        <span className={styles.cardMeta}>
          <strong className={styles.cardTitle} title={displayTitle}>{displayTitle}</strong>
          {visibleDate ? <CardDate date={visibleDate} end={card.endDate} />
            : <span className={styles.cardDate}>{paymentCount > 1 ? "Plusieurs dates" : "Date à préciser"}</span>}
        </span>
        {card.amount !== null ? <span className={styles.cardTotal} data-positive={Number(card.amount) > 0 || undefined}>
          {money(card.amount)}{isEstimated && <small>Estimé</small>}
        </span> : <span className={styles.cardUnknown}>{unpriced}</span>}
        {subtitle && <span className={styles.cardSubtitle} title={subtitle}>{subtitle}</span>}
        {location && <span className={styles.cardLocation} data-place-certainty={firstPlace?.certainty}
          data-confirmed={firstPlace?.certainty === "confirmed"}
          title={card.places?.map(place => `${place.label} · ${placeStatus[place.certainty]}`).join("\n") || location}>
          <MapPin size={12} aria-hidden="true" />
          <span>{firstPlace?.certainty === "probable" && "Lieu probable · "}{location}</span>
          {additionalPlaces > 0 && <small aria-label={`${additionalPlaces} autres lieux`}>+{additionalPlaces}</small>}
        </span>}
      </span>
      {trip ? <span className={styles.cardTrip} data-realized-car-trip title={`${trip.route} · Essence estimée ${money(trip.estimatedFuel)}`}>
        <ComposerAssetVisual assetKey={carArtwork} iconKey="car" size={23} />
        <span className={styles.cardTripRoute}>{trip.compactRoute}</span>
        <span className={styles.cardTripCost}>Essence estimée <strong>{money(trip.estimatedFuel)}</strong></span>
      </span> : (compactTravel || mobilityNote) && <span className={styles.cardTrip} title={compactTravel ?? mobilityNote}>
        <span className={styles.cardTripRoute}>{compactTravel ?? mobilityNote}</span>
      </span>}
      {card.work && <WorkDayFooter work={card.work} />}
      {(category || flow || card.pilotStatus || participant) && <span className={styles.cardFooter}>
        {card.section === "flows" && flow ? <span className={styles.cardCategory} data-flow-kind={flow}>{realizedFlowLabels[flow]}</span>
          : category && <span className={styles.cardCategory}>{category.shortLabel}</span>}
        {card.pilotStatus && <JulyPilotChip status={card.pilotStatus} />}
        {participant && <span className={styles.cardParticipant}>
          <ParticipantBadge name={participant} portrait={portrait} role={hasBeneficiary ? "Bénéficiaire" : undefined} />
        </span>}
      </span>}
    </span>
  </button>;
});

function RealizedDetail({ card, month, terms, open }: {
  card: RealizedCard;
  month: string;
  terms: readonly string[];
  open: (cardId: string, paymentId?: string, componentId?: string) => void;
}) {
  const startMonth = card.date?.slice(0, 7), endMonth = card.endDate?.slice(0, 7);
  const paymentGroups = card.payments.some(payment => payment.reviewGroup)
    ? Object.entries(Object.groupBy(card.payments, payment => payment.reviewGroup ?? "Autres opérations")) : [];
  const otherMonths = startMonth && endMonth && card.id.startsWith("event-") && isArchivedRealizedMonth(month)
    ? ARCHIVED_REALIZED_MONTHS.filter(value => value !== month && value >= startMonth && value <= endMonth) : [];
  return <>
    {otherMonths.length > 0 && <nav aria-label="Autres mois de l’événement">
      <p>Paiements et trajets de {monthLabel(month)}.</p>
      <ul className={styles.places}>{otherMonths.map(otherMonth => <li key={otherMonth}>
        <a className="underline" href={realizedComposerHref(otherMonth, card.id)}>Voir en {monthLabel(otherMonth)}</a>
      </li>)}</ul>
    </nav>}
    {!card.work && card.participant && <section aria-label="Participants">
      <p>{card.section === "events" ? "Participation" : "Personne associée"} · {card.participant}</p>
    </section>}
    {card.work && <section aria-labelledby="realized-work-title">
      <h3 id="realized-work-title">{card.work.mode === "unspecified" ? "Achats de café" : `Journée de travail · ${card.work.name}`}</h3>
      <ul className={styles.places}>
        {card.work.items.map(item => <li key={item.id}>
          {item.place ? <><PlaceLink place={item.place} detail />Montant non renseigné</>
            : <>{item.label}{item.count > 1 ? ` ×${item.count}` : ""} · {item.amount === null ? "Montant non renseigné" : money(item.amount)}</>}
        </li>)}
      </ul>
    </section>}
    {!!card.places?.length && <section aria-labelledby="realized-places-title">
      <h3 id="realized-places-title">{card.places.length === 1 ? "Lieu" : "Lieux"}</h3>
      <ul className={styles.places}>
        {card.places.map(place => <li key={place.key}><PlaceLink place={place} detail /></li>)}
      </ul>
    </section>}
    {card.carTrip && <section className={styles.tripDetail} aria-label="Trajet en voiture">
      <ComposerAssetVisual assetKey={carArtwork} iconKey="car" size={42} />
      <div>
        <h3>Trajet en voiture</h3>
        {!card.carTrip.legs?.length && <p>{card.carTrip.route}</p>}
        <p>{distance.format(Number(card.carTrip.distanceKm))} km · {money(card.carTrip.estimatedFuel)} d’essence estimée</p>
        {card.carTrip.legs?.length ? <ul className={styles.places}>
          {card.carTrip.legs.map(leg => <li key={leg.id}>
            <strong>{leg.route}</strong><br />
            <small>{[days(leg.date), leg.driver && `${leg.driver} · conductrice habituelle`, leg.participant === "Couple" ? "Couple" : undefined,
              `${distance.format(Number(leg.distanceKm))} km`, `≈ ${money(leg.estimatedFuel)}`].filter(Boolean).join(" · ")}</small>
          </li>)}
        </ul> : null}
      </div>
    </section>}
    {card.mobilityNote && !card.payments.some(payment => payment.mobilityNote === card.mobilityNote) && <p>{card.mobilityNote}</p>}
    {!!card.observedTravel?.length && <section className={styles.tripDetail} aria-label="Trajets détectés">
      <h3>Trajets détectés</h3>
      <ul className={styles.places}>{card.observedTravel.map(route => <li key={route}>{route}</li>)}</ul>
    </section>}
    {!!card.reviewNotes?.length && <ul className={styles.places} aria-label="Détails de la carte">
      {card.reviewNotes.map(note => <li key={note}>{note}</li>)}
    </ul>}
    {!!card.reviewReferences?.length && <section aria-labelledby="realized-review-references">
      <h3 id="realized-review-references">Préparation, financement et opérations associées</h3>
      <ul className={styles.places}>
        {card.reviewReferences.map(ref => <li key={ref.id}>
          <strong>{ref.label} · {money(ref.amount)}</strong><br />
          <small>{ref.role} · {searchableDate(ref.date)}</small>
          {ref.date.slice(0, 7) !== month && <small> · <a
            href={realizedComposerHref(ref.date.slice(0, 7), isImportedRealizedMonth(month) ? realizedOperationCardId(ref.id) : card.id)}>
            {isImportedRealizedMonth(month) ? "Voir l’opération" : "Voir le mois bancaire"}
          </a></small>}
        </li>)}
      </ul>
    </section>}
    {card.transferAmounts && <dl className={styles.transferTotals}>
      <div><dt>Transferts entrants</dt><dd>{money(card.transferAmounts.incoming)}</dd></div>
      <div><dt>Transferts sortants</dt><dd>{money(card.transferAmounts.outgoing)}</dd></div>
    </dl>}
    {card.payments.length > 0 && <section aria-labelledby="realized-operations-title">
      <h3 id="realized-operations-title">{card.pilotStatus && card.pilotStatus !== "confirmed" ? "Éléments budgétés" : "Opérations bancaires"} <span>{card.payments.length}</span></h3>
      {(paymentGroups.length ? paymentGroups : [["", card.payments]] as const).map(([label, payments]) => <div key={label}>
        {label && <h4>{label}</h4>}
        <ul className={styles.elements}>
          {payments?.map(payment => <RealizedElement key={payment.id} payment={payment} estimated={!!card.pilotStatus && card.pilotStatus !== "confirmed"}
            highlighted={terms.length > 0 && matches(paymentSearch(payment), terms)} />)}
        </ul>
      </div>)}
    </section>}
    {card.occurrences?.length ? <section aria-labelledby="realized-occurrences-title">
      <h3 id="realized-occurrences-title">{card.keepPaymentsTogether ? "Activités regroupées" : "Occurrences"} <span>{card.occurrences.length}</span></h3>
      <ul className={styles.occurrences}>
        {card.occurrences.map(occurrence => <li key={occurrence.id}>
          <time dateTime={occurrence.date}>{days(occurrence.date, occurrence.endDate)}</time>
          <span>{occurrence.label}</span>{!card.pilotStatus && <small>{occurrence.status}</small>}
          {occurrence.places.length > 0 && <small>{occurrence.places.map(place => place.label).join(" · ")}</small>}
        </li>)}
      </ul>
    </section> : null}
    {card.relatedPayments?.length ? <section aria-labelledby="realized-related-title">
      <h3 id="realized-related-title">Opérations associées dans d’autres cartes</h3>
      <ul className={styles.related}>
        {card.relatedPayments.map(payment => <li key={payment.component?.key ?? payment.id}>
          <button type="button" onClick={() => open(payment.cardId, payment.id, payment.component?.key)}>
            <span><strong>{payment.label}</strong><small>{days(payment.date)} · {payment.cardLabel}</small></span>
            {payment.component?.amount != null && <strong className={styles.amount}>{money(payment.component.amount)}</strong>}
            <ArrowRight size={16} aria-hidden="true" />
          </button>
        </li>)}
      </ul>
    </section> : null}
    {!card.work && !card.payments.length && !card.occurrences?.length && !card.relatedPayments?.length
      && !card.carTrip && !card.reviewReferences?.length && <p>Aucun paiement rattaché à cet événement.</p>}
  </>;
}

export function RealizedComposerMonth({ overview: packed, initialDetail, editableSourceIds, initialCardId, pilot = false, initialStatus, savingsTarget }: {
  overview: PackedRealizedOverview; initialDetail?: InitialRealizedDetail; editableSourceIds?: readonly string[]; initialCardId?: string; pilot?: boolean;
  initialStatus?: JulyPilotStatus;
  savingsTarget?: { id: string; label: string };
}) {
  const overview = useMemo(() => unpackRealizedOverview(packed), [packed]);
  const [sortOrder, setSortOrder] = useState<SortOrder>(pilot ? "date" : "amount-desc");
  const [flowFilter, setFlowFilter] = useState<FlowFilter>("");
  const [statusFilter, setStatusFilter] = useState<JulyPilotStatus | "">(initialStatus ?? "");
  const [query, setQuery] = useState("");
  const [selection, setSelection] = useState<{ cardId: string; paymentId?: string; componentId?: string } | null>(
    () => initialCardId ? { cardId: initialCardId,
      paymentId: initialCardId.startsWith("payment-") ? initialCardId.slice("payment-".length) : undefined } : null,
  );
  const [loaded, setLoaded] = useState<ReadonlyMap<string, RealizedCard>>(() => new Map());
  const [failedKey, setFailedKey] = useState<string>();
  const [retry, setRetry] = useState(0);
  const dialog = useRef<HTMLDialogElement>(null);
  const body = useRef<HTMLDivElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const search = useRef<HTMLInputElement>(null);
  const rail = useRef<HTMLDivElement>(null);
  const terms = useMemo(() => searchText(query).split(" ").filter(Boolean), [query]);
  const byCategory = sortOrder === "category";
  const categoryById = useMemo(() => new Map(overview.groups.map(group => [group.id, group])), [overview.groups]);
  const indexed = useMemo(() => (byCategory ? overview.categoryKeys : overview.flatKeys).map(key => {
    const card = overview.cards[key]!;
    return { key, card, category: card.categoryId ? categoryById.get(card.categoryId) : undefined };
  }), [byCategory, overview, categoryById]);
  const visible = useMemo(() => indexed.filter(({ card }) => (!statusFilter || card.pilotStatus === statusFilter)
    && (!flowFilter || card.flowKinds?.includes(flowFilter))
    && (!terms.length || card.search.some(line => matches(line, terms)))).sort((a, b) => {
      const byDate = () => (a.card.sortDate ?? "9999").localeCompare(b.card.sortDate ?? "9999") || a.card.label.localeCompare(b.card.label, "fr")
        || a.card.id.localeCompare(b.card.id);
      if (sortOrder === "date") return byDate();
      const left = a.card.amount, right = b.card.amount;
      if (left === null || right === null) return left === right ? byDate() : left === null ? 1 : -1;
      const difference = Math.abs(Number(left)) - Math.abs(Number(right));
      return (sortOrder === "amount-asc" ? difference : -difference) || byDate();
    }), [indexed, sortOrder, statusFilter, flowFilter, terms]);
  const visibleCategories = useMemo(() => byCategory ? overview.groups.flatMap(category => {
    const entries = visible.filter(entry => entry.category?.id === category.id);
    return entries.length ? [{ category, entries }] : [];
  }) : [], [byCategory, overview.groups, visible]);
  const visibleCount = visible.length;
  const selectedPaymentId = selection?.paymentId;
  const paymentCardId = !byCategory && selectedPaymentId ? realizedOperationCardId(selectedPaymentId) : undefined;
  const selectedView = selection && (indexed.find(({ card }) => card.id === paymentCardId)
    ?? indexed.find(({ card }) => card.id === selection.cardId)
    ?? indexed.find(({ card }) => card.sourceId === selection.cardId)
    ?? (selectedPaymentId ? indexed.find(({ card }) => card.paymentIds.includes(selectedPaymentId)) : undefined));
  const selected = selectedView?.card;
  const detailKey = selectedView?.key;
  const detailId = selected?.id;
  const detail = detailKey ? loaded.get(detailKey) ?? (initialDetail?.key === detailKey ? initialDetail.card : undefined) : undefined;
  const groups = useMemo(() => byCategory ? visibleCategories.map(({ category, entries }) => ({ id: category.id, entries }))
    : visible.length ? [{ id: "all", entries: visible }] : [], [byCategory, visibleCategories, visible]);
  const visibleKeys = useMemo(() => `${sortOrder}:${visible.map(({ card }) => card.id).join("|")}`, [sortOrder, visible]);
  const { probe, packing, containsColumn, isMounted, setFocusedId, updateWindow } =
    useRealizedRailLayout(rail, groups, visibleKeys, byCategory);
  const groupedPacking = byCategory ? packing : undefined;

  useEffect(() => {
    if (!detailKey || !detailId || detail) return;
    const controller = new AbortController();
    const view = detailKey.startsWith("category:") ? "category" : "flat";
    const params = new URLSearchParams({ month: overview.month, card: detailId, mode: pilot ? "pilot" : "realized", view });
    fetch(`/api/composer/realized-card?${params}`, { signal: controller.signal, cache: "no-store" })
      .then(async response => {
        if (!response.ok) throw new Error("CARD_DETAIL_UNAVAILABLE");
        const card = await response.json() as RealizedCard;
        if (card.id !== detailId) throw new Error("CARD_DETAIL_MISMATCH");
        if (!controller.signal.aborted) setLoaded(previous => new Map(previous).set(detailKey, card));
      })
      .catch(() => {
        if (!controller.signal.aborted) setFailedKey(detailKey);
      });
    return () => controller.abort();
  }, [detail, detailId, detailKey, overview.month, pilot, retry]);

  function scrollRail(direction: number) {
    const node = rail.current;
    if (!node) return;
    node.scrollBy({ left: Math.max(220, node.clientWidth * .7) * direction,
      behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
  }
  function startRail() {
    if (rail.current) rail.current.scrollLeft = 0;
  }
  function filterQuery(value: string) {
    setQuery(value);
    startRail();
  }

  useEffect(() => {
    const panel = dialog.current;
    if (!selection || !selected || !panel) return;
    if (!panel.open) panel.showModal();
    if (body.current) body.current.scrollTop = 0;
    closeButton.current?.focus();
  }, [selection, selected]);

  useEffect(() => {
    const panel = dialog.current;
    if (!detail || !selection?.paymentId || !panel?.open) return;
    const row = [...panel.querySelectorAll<HTMLElement>("[data-realized-operation]")]
      .find(row => row.dataset.realizedOperation === selection.paymentId);
    const target = row && ([...row.querySelectorAll<HTMLElement>("[data-realized-component]")]
      .find(component => component.dataset.realizedComponent === selection.componentId) ?? row);
    if (target) {
      target.focus({ preventScroll: true });
      target.scrollIntoView({ block: "nearest" });
    }
  }, [selection, detail]);

  const open = useCallback((cardId: string, paymentId?: string, componentId?: string) => {
    setFailedKey(undefined);
    setSelection({ cardId, paymentId, componentId });
  }, []);
  function renderGrid(key: string, entries: typeof visible) {
    const flatPacking = !byCategory && packing;
    return <div className={styles.grid} data-realized-grid={key} data-packed={Boolean(flatPacking)}
      style={flatPacking ? { "--packed-columns": flatPacking.columns, height: flatPacking.height } as CSSProperties : undefined}>
      {entries.map(({ card, category }) => {
        const position = packing?.positions[card.id];
        if (!isMounted(card.id, position)) return null;
        return <RealizedMonthCard key={card.id} card={card} category={category} position={position}
          date={sortOrder === "date" ? card.sortDate : undefined}
          portrait={card.work ? overview.participantPortraits[card.work.participant.personId]
            : card.participant && overview.julyPortraits[card.participant]} open={open} />;
      })}
    </div>;
  }

  return <div className={styles.board} data-realized-month={overview.month}>
    <div className={styles.toolbar}>
      <div className={styles.flowFilters} role="group" aria-label="Filtrer par type d’opération">
        {flowFilters.map(([value, label]) => <button key={value || "all"} type="button" aria-pressed={flowFilter === value}
          onClick={() => { setFlowFilter(value); startRail(); }}>{label}</button>)}
      </div>
      <select className={styles.sort} aria-label="Trier les cartes" value={sortOrder}
        onChange={event => { setSortOrder(event.target.value as SortOrder); startRail(); }}>
        {sortOptions.map(option => <option key={option.id} value={option.id}>{option.label}</option>)}
      </select>
      {pilot && <select className={styles.sort} aria-label="Filtrer par état" value={statusFilter}
        onChange={event => { setStatusFilter(event.target.value as JulyPilotStatus | ""); startRail(); }}>
        <option value="">Tous les états</option>
        {julyPilotStatuses.map(status => <option key={status} value={status}>{julyPilotLabels[status]}</option>)}
      </select>}
      <div className={styles.search} role="search" aria-label="Recherche dans le mois">
        <Search size={16} aria-hidden="true" />
        <input ref={search} type="search" aria-label="Rechercher une carte ou une opération" placeholder="Marchand, événement, date…" value={query}
          onChange={event => filterQuery(event.target.value)} onKeyDown={event => {
            if (event.key === "Escape" && query) { event.preventDefault(); filterQuery(""); }
          }} />
        {query && <button type="button" aria-label="Effacer la recherche" onClick={() => { filterQuery(""); search.current?.focus(); }}>
          <X size={16} aria-hidden="true" />
        </button>}
      </div>
      {savingsTarget && <Link className={styles.editCard} href={savingsGoalHref(savingsTarget.id)} prefetch={false}>
        <PiggyBank size={15} aria-hidden /> Lier une dépense à {savingsTarget.label}
      </Link>}
      <p className={styles.resultCount} role="status">{visibleCount} {visibleCount === 1 ? "carte" : "cartes"}</p>
      <div className={styles.railArrows}>
        <button type="button" aria-label="Défiler à gauche" onClick={() => scrollRail(-1)}><ArrowLeft size={16} aria-hidden="true" /></button>
        <button type="button" aria-label="Défiler à droite" onClick={() => scrollRail(1)}><ArrowRight size={16} aria-hidden="true" /></button>
      </div>
    </div>
    <div ref={rail} className={styles.rail} onScroll={updateWindow}
      tabIndex={0} aria-label="Cartes réalisées, défilement horizontal" data-realized-rail
      onFocusCapture={event => {
        const card = (event.target as HTMLElement).closest<HTMLElement>("[data-realized-card]");
        if (card) setFocusedId(card.id);
      }}
      onKeyDown={event => {
        if (event.target !== event.currentTarget || !["ArrowLeft", "ArrowRight"].includes(event.key)) return;
        event.preventDefault(); scrollRail(event.key === "ArrowRight" ? 1 : -1);
      }}>
      <span ref={probe} className={styles.railWidthProbe} aria-hidden="true" />
      {visibleCount === 0 && <p className={styles.empty}>{overview.flatKeys.length ? "Aucune carte pour ces filtres."
        : "Aucune opération ni événement importé pour ce mois."}</p>}
      {visibleCount > 0 && !byCategory && renderGrid("all", visible)}
      {visibleCategories.length > 0 && <div className={styles.groupedBoard} data-realized-grouped-grid data-packed={Boolean(groupedPacking)}
        style={groupedPacking ? { "--packed-columns": groupedPacking.columns, height: groupedPacking.height } as CSSProperties : undefined}>
        {visibleCategories.map(({ category, entries }) => <section key={category.id} className={styles.category}
          data-realized-category={category.id} aria-labelledby={`realized-category-${category.id}`}>
          <h2 id={`realized-category-${category.id}`}>{category.label}</h2>
          {groupedPacking?.frames?.[category.id]?.filter(frame => containsColumn(frame.column)).map(frame => <div key={frame.column} className={styles.groupFrame}
            data-category-frame={category.id} aria-hidden="true"
            style={{ "--card-column": frame.column, insetBlockStart: frame.top, height: frame.height } as CSSProperties}>
            <span className={styles.groupFrameTitle}>{category.label}</span>
          </div>)}
          {renderGrid(category.id, entries)}
        </section>)}
      </div>}
    </div>
    <dialog ref={dialog} className={styles.dialog} aria-labelledby="realized-dialog-title"
      onClose={() => setSelection(null)} onClick={event => { if (event.target === event.currentTarget) dialog.current?.close(); }}>
      {selected && selectedView && <div className={styles.panel}>
        <header className={styles.panelHeader}>
          <CardArtwork card={selected} size={56} />
          <div>
            <h2 id="realized-dialog-title">{selected.displayTitle ?? selected.label}</h2>
            <p>{[selected.displayTitle && selected.caption, selected.dialogCaption, selected.eventStatus].filter(Boolean).join(" · ")}</p>
            {selected.pilotStatus && <JulyPilotChip status={selected.pilotStatus} />}
            {selected.amount !== null && <strong>{money(selected.amount)}{selected.pilotStatus && selected.pilotStatus !== "confirmed" ? " estimés" : ""}</strong>}
          </div>
          <button ref={closeButton} type="button" className={styles.close} aria-label="Fermer la carte" onClick={() => dialog.current?.close()}>
            <X size={20} aria-hidden="true" />
          </button>
        </header>
        <div ref={body} className={styles.panelBody} aria-busy={!detail && failedKey !== detailKey}>
          {editableSourceIds?.includes(selected.pilotSourceId ?? selected.sourceId) && <JulyEditLink
            cardId={selected.pilotSourceId ?? selected.sourceId} className={styles.editCard}>
            <Pencil size={15} aria-hidden="true" /> Modifier dans le brouillon
          </JulyEditLink>}
          {detail ? <RealizedDetail card={detail} month={overview.month} terms={terms} open={open} />
            : failedKey && failedKey === detailKey ? <div>
              <p role="alert">Les détails de cette carte sont indisponibles.</p>
              <button type="button" className={styles.editCard} onClick={() => { setFailedKey(undefined); setRetry(value => value + 1); }}>Réessayer</button>
            </div> : <p role="status">Chargement des détails…</p>}
        </div>
        {detail && <SavingsFooter key={detail.id} card={detail} goalId={savingsTarget?.id} />}
      </div>}
    </dialog>
  </div>;
}

function SavingsFooter({ card, goalId }: { card: RealizedCard; goalId?: string }) {
  const [expanded, setExpanded] = useState(Boolean(goalId));
  const [links, setLinks] = useState<Awaited<ReturnType<typeof readCardSavingsLinks>>>([]);
  const [revision, setRevision] = useState(0);
  const trigger = useRef<HTMLButtonElement>(null);
  const payments = useMemo(() => savingsPayments(card), [card]);
  useEffect(() => {
    if (!payments.length || payments.length > 100) return;
    let mounted = true;
    void readCardSavingsLinks(payments.map(payment => payment.id)).then(result => {
      if (mounted) setLinks(result);
    }, () => { if (mounted) setLinks([]); });
    return () => { mounted = false; };
  }, [payments, revision]);
  if (!payments.length) return null;
  return <footer className={styles.savingsFooter}>
    {!expanded && <div className={styles.savingsActions}>
      <button ref={trigger} className={styles.editCard} type="button" aria-expanded={expanded}
        onClick={() => setExpanded(true)}><PiggyBank size={16} aria-hidden /> Ventiler l’achat</button>
      {!!links.length && <div className={styles.savingsLinks} aria-label="Cagnottes liées">
        {links.map(goal => <Link key={goal.id} href={savingsGoalHref(goal.id)} prefetch={false}>{goal.label} <ExternalLink size={12} aria-hidden /></Link>)}
      </div>}
    </div>}
    {expanded && <SavingsDock cardLabel={card.label} payments={payments} goalId={goalId} onSaved={() => setRevision(value => value + 1)} close={() => {
      setExpanded(false);
      requestAnimationFrame(() => trigger.current?.focus());
    }} />}
  </footer>;
}
