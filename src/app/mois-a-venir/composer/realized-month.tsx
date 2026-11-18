"use client";

import { ArrowLeft, ArrowRight, ChevronRight, ExternalLink, MapPin, Pencil, Search, X } from "lucide-react";
import { memo, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { reconstructedId } from "@/domain/phase2/planner/realized-month-entry";
import type { RealizedBoard, RealizedCard, RealizedCardGroup, RealizedPayment } from "@/server/phase2/planner/realized-month";
import type { RealizedPlace } from "@/server/phase2/planner/realized-places";
import { ComposerAssetVisual } from "./compact-catalog-visual";
import { money, plannedDayLabel } from "./display";
import { RealizedBadge } from "./realized-badge";
import styles from "./realized-month.module.css";

const sortOptions = [
  { id: "amount-desc", label: "Montant du plus grand au plus petit" },
  { id: "amount-asc", label: "Montant du plus petit au plus grand" },
  { id: "date", label: "Chronologique" },
  { id: "category", label: "Par catégorie" },
] as const;
type SortOrder = typeof sortOptions[number]["id"];
const fullDate = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
const distance = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 });
const carArtwork = "option:activity:transport:car";

function days(date: string, end?: string) {
  const start = plannedDayLabel(date);
  return end && end !== date ? `${start} – ${plannedDayLabel(end)}` : start;
}

function searchText(...values: readonly (string | undefined | null)[]) {
  return values.join(" ").normalize("NFD").replace(/\p{Diacritic}/gu, "")
    .toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

function searchableDate(date: string | undefined) {
  return date ? fullDate.format(new Date(`${date}T12:00:00Z`)) : undefined;
}

function paymentSearch(payment: RealizedPayment) {
  return searchText(payment.label, payment.bankLabel, payment.category, payment.date, searchableDate(payment.date), days(payment.date),
    payment.place?.label, payment.place?.address, payment.amount, money(payment.amount), ...payment.components.map(component => component.label));
}

function matches(text: string, terms: readonly string[]) {
  return terms.every(term => text.includes(term));
}

const placeStatus = { confirmed: "Confirmé", probable: "Lieu probable", town: "Commune" } as const;

function PlaceLink({ place, detail }: { place: RealizedPlace; detail?: boolean }) {
  return <span className={styles.placeLink}>
    <a href={place.mapsUrl} target="_blank" rel="noopener noreferrer" title="Ouvrir dans Google Maps">
      {place.label}<ExternalLink size={12} aria-hidden="true" />
    </a>
    {detail && <small>{[placeStatus[place.certainty], place.address].filter(Boolean).join(" · ")}</small>}
  </span>;
}

function RealizedElement({ payment, highlighted }: { payment: RealizedPayment; highlighted: boolean }) {
  return <li className={styles.element} data-realized-operation={payment.id} data-highlighted={highlighted || undefined} tabIndex={-1}>
    <div className={styles.elementVisual}>
      {payment.badge
        ? <RealizedBadge {...payment.badge} />
        : payment.art && <ComposerAssetVisual assetKey={payment.art.assetKey ?? ""} templateKey={payment.art.templateKey}
          iconKey={payment.art.iconKey} size={30} />}
    </div>
    <div className={styles.elementIdentity}>
      <strong>{payment.label}</strong>
      <span>{[days(payment.date), payment.category].filter(Boolean).join(" · ")}</span>
      {payment.bankLabel !== payment.label && <small>{payment.bankLabel}</small>}
      {payment.place && <PlaceLink place={payment.place} detail />}
    </div>
    <b className={styles.amount}>{money(payment.amount)}</b>
    {payment.components.length > 0 && <dl className={styles.components} aria-label="Détail économique de l’opération">
      {payment.components.map(component => <div key={component.id} data-realized-component={component.id} tabIndex={-1}>
        <dt>{component.label}</dt><dd>{money(component.amount)}</dd>
      </div>)}
    </dl>}
  </li>;
}

function CardArtwork({ card, size }: { card: Pick<RealizedCard, "art">; size: number }) {
  return <ComposerAssetVisual assetKey={card.art.assetKey ?? ""} templateKey={card.art.templateKey}
    iconKey={card.art.iconKey} className={styles.cardVisual} scale={size > 48 ? "CARD" : "LIBRARY"} size={size} />;
}

function cardCaption(card: RealizedCard, date: string | null | undefined = card.date) {
  const number = card.occurrences?.length;
  const count = card.payments.length;
  return [date ? days(date, card.endDate) : null,
    number ? `${number} ${number === 1 ? "occurrence" : "occurrences"}` : null,
    count ? `${count} ${count === 1 ? "opération" : "opérations"}` : null].filter(Boolean).join(" · ");
}

function CardDate({ date, end }: { date: string; end?: string }) {
  const hasRange = end && end !== date;
  const sameMonth = hasRange && date.slice(0, 7) === end.slice(0, 7);
  return <span className={styles.cardDate}>
    <time dateTime={date} title={searchableDate(date)}>{sameMonth ? Number(date.slice(-2)) : plannedDayLabel(date)}</time>
    {hasRange && <>–<time dateTime={end} title={searchableDate(end)}>{plannedDayLabel(end)}</time></>}
  </span>;
}

const RealizedMonthCard = memo(function RealizedMonthCard({ card, category, open, date }: {
  card: RealizedCard; category?: RealizedCardGroup; open: (cardId: string) => void; date?: string;
}) {
  const badges = [...new Map(card.payments.flatMap(payment => payment.badge
    ? [[payment.badge.label, payment.badge] as const] : [])).values()];
  const linked = card.relatedPayments?.length;
  const visibleDate = card.date ?? date;
  const caption = cardCaption(card, null);
  const firstPlace = card.places?.[0];
  const additionalPlaces = (card.places?.length ?? 0) - 1;
  const location = firstPlace ? firstPlace.label : card.label === "Restaurant" && card.eventStatus ? "Lieu à confirmer" : undefined;
  return <button id={card.id} type="button" className={styles.card} data-realized-card={card.section}
    data-realized-category={category?.id} data-card-date={visibleDate}
    data-operation-count={card.payments.length} data-card-amount={card.amount ?? undefined}
    aria-haspopup="dialog" onClick={() => open(card.id)}>
    <span className={styles.cardMeta}>
      {category && <span className={styles.cardCategory}>{category.shortLabel}</span>}
      {visibleDate && <CardDate date={visibleDate} end={card.endDate} />}
    </span>
    <span className={styles.cardIdentity}>
      <strong className={styles.cardTitle} title={card.label}>{card.label}</strong>
      {location && <span className={styles.cardLocation} data-place-certainty={firstPlace?.certainty}
        data-confirmed={firstPlace?.certainty === "confirmed"}
        title={card.places?.map(place => `${place.label} · ${placeStatus[place.certainty]}`).join("\n") || location}>
        <MapPin size={12} aria-hidden="true" />
        <span>{firstPlace?.certainty === "probable" && "≈ "}{location}</span>
        {additionalPlaces > 0 && <small aria-label={`${additionalPlaces} autres lieux`}>+{additionalPlaces}</small>}
      </span>}
    </span>
    {caption && <span className={styles.cardSubtitle}>{caption}</span>}
    {badges.length > 0 && <span className={styles.badges}>
      {badges.slice(0, 4).map(badge => <RealizedBadge key={badge.label} {...badge} named />)}
      {badges.length > 4 && <span title={badges.slice(4).map(badge => badge.label).join(", ")}>+{badges.length - 4}</span>}
    </span>}
    <CardArtwork card={card} size={60} />
    {(card.amount !== null || linked || !card.carTrip) && <span className={styles.cardTotal}>
      {card.amount !== null ? <><strong>{money(card.amount)}</strong>
        {card.transferAmounts && <small>Solde des transferts</small>}
        {card.section === "events" && <small>Débits rattachés</small>}</>
        : <small>{linked ? `${linked} ${linked === 1 ? "opération associée" : "opérations associées"}` : "Aucun paiement rattaché"}</small>}
    </span>}
    {card.carTrip && <span className={styles.cardTrip} data-realized-car-trip title={card.carTrip.route}>
      <ComposerAssetVisual assetKey={carArtwork} iconKey="car" size={23} />
      <span className={styles.cardTripRoute}>{card.carTrip.compactRoute}</span>
      <strong className={styles.cardTripCost} aria-label={`${money(card.carTrip.estimatedFuel)} d’essence estimée`} title="Essence estimée">
        ≈ {money(card.carTrip.estimatedFuel)}
      </strong>
    </span>}
    <ChevronRight className={styles.chevron} size={16} aria-hidden="true" />
  </button>;
});

function earliestDate(card: RealizedCard): string | undefined {
  return card.date ?? [
    ...card.payments.map(payment => payment.date),
    ...(card.occurrences ?? []).map(item => item.date),
    ...(card.relatedPayments ?? []).map(payment => payment.date),
  ].sort()[0];
}

function RealizedDetail({ card, terms, open }: {
  card: RealizedCard;
  terms: readonly string[];
  open: (cardId: string, paymentId?: string, componentId?: string) => void;
}) {
  return <>
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
        <p>{card.carTrip.route}</p>
        <p>{distance.format(Number(card.carTrip.distanceKm))} km · {money(card.carTrip.estimatedFuel)} d’essence estimée</p>
      </div>
    </section>}
    {card.transferAmounts && <dl className={styles.transferTotals}>
      <div><dt>Transferts entrants</dt><dd>{money(card.transferAmounts.incoming)}</dd></div>
      <div><dt>Transferts sortants</dt><dd>{money(card.transferAmounts.outgoing)}</dd></div>
    </dl>}
    {card.payments.length > 0 && <section aria-labelledby="realized-operations-title">
      <h3 id="realized-operations-title">Opérations bancaires <span>{card.payments.length}</span></h3>
      <ul className={styles.elements}>
        {card.payments.map(payment => <RealizedElement key={payment.id} payment={payment}
          highlighted={terms.length > 0 && matches(paymentSearch(payment), terms)} />)}
      </ul>
    </section>}
    {card.occurrences?.length ? <section aria-labelledby="realized-occurrences-title">
      <h3 id="realized-occurrences-title">Occurrences <span>{card.occurrences.length}</span></h3>
      <ul className={styles.occurrences}>
        {card.occurrences.map(occurrence => <li key={occurrence.id}>
          <time dateTime={occurrence.date}>{days(occurrence.date, occurrence.endDate)}</time>
          <span>{occurrence.label}</span><small>{occurrence.status}</small>
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
    {!card.payments.length && !card.occurrences?.length && !card.relatedPayments?.length
      && <p>Aucun paiement rattaché à cet événement en juillet.</p>}
  </>;
}

export function RealizedComposerMonth({ board, onEdit, editableIds }: {
  board: RealizedBoard; onEdit: (cardId: string) => void; editableIds: ReadonlySet<string>;
}) {
  const [sortOrder, setSortOrder] = useState<SortOrder>("amount-desc");
  const [query, setQuery] = useState("");
  const [selection, setSelection] = useState<{ cardId: string; paymentId?: string; componentId?: string } | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const body = useRef<HTMLDivElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const search = useRef<HTMLInputElement>(null);
  const rail = useRef<HTMLDivElement>(null);
  const [rows, setRows] = useState(1);
  const terms = searchText(query).split(" ").filter(Boolean);
  const byCategory = sortOrder === "category";
  const categoryByCard = useMemo(() => new Map(board.groups.flatMap(item =>
    item.cardIds.map(id => [id, item] as const))), [board.groups]);
  const indexed = useMemo(() => board.cards.map(card => {
    const category = categoryByCard.get(card.id);
    return {
      card, category,
      date: earliestDate(card),
      lines: [
        searchText(card.label, card.date, card.endDate, searchableDate(card.date), cardCaption(card)),
        ...(card.places ?? []).map(place => searchText(card.label, place.label, place.address, searchableDate(card.date))),
        searchText(category?.label, category?.shortLabel),
        ...(card.carTrip ? [searchText(card.label, "trajet voiture essence", card.carTrip.route, card.carTrip.compactRoute)] : []),
        ...card.payments.map(payment => searchText(card.label, paymentSearch(payment))),
        ...(card.occurrences ?? []).map(occurrence => searchText(card.label, occurrence.label, occurrence.date, searchableDate(occurrence.date))),
        ...(card.relatedPayments ?? []).map(payment => searchText(card.label, payment.label, payment.cardLabel,
          payment.date, searchableDate(payment.date), payment.component?.amount)),
      ],
    };
  }), [board.cards, categoryByCard]);
  const visible = indexed.filter(({ lines }) => !terms.length || lines.some(line => matches(line, terms))).sort((a, b) => {
      const byDate = () => (a.date ?? "9999").localeCompare(b.date ?? "9999") || a.card.label.localeCompare(b.card.label, "fr")
        || a.card.id.localeCompare(b.card.id);
      if (sortOrder === "date") return byDate();
      const left = a.card.amount, right = b.card.amount;
      if (left === null || right === null) return left === right ? byDate() : left === null ? 1 : -1;
      const difference = Math.abs(Number(left)) - Math.abs(Number(right));
      return (sortOrder === "amount-asc" ? difference : -difference) || byDate();
    });
  const visibleCategories = byCategory ? board.groups.flatMap(category => {
    const entries = visible.filter(entry => entry.category?.id === category.id);
    return entries.length ? [{ category, entries }] : [];
  }) : [];
  const visibleCount = visible.length;
  const selected = indexed.find(({ card }) => card.id === selection?.cardId)?.card;
  const visibleKeys = visible.map(({ card }) => card.id).join("|");

  useEffect(() => {
    const node = rail.current;
    if (!node) return;
    const grids = [...node.querySelectorAll<HTMLElement>(`.${styles.grid}`)];
    if (!grids.length) return;
    const cards = grids.flatMap(grid => [...grid.children]);
    const observer = new ResizeObserver(() => {
      const railStyle = getComputedStyle(node);
      const available = node.clientHeight - parseFloat(railStyle.paddingTop) - parseFloat(railStyle.paddingBottom);
      const tallestCard = Math.max(...cards.map(card => card.getBoundingClientRect().height));
      const categoryInset = byCategory ? Math.max(...grids.map(grid =>
        (grid.parentElement?.offsetHeight ?? grid.offsetHeight) - grid.offsetHeight)) : 0;
      const gap = parseFloat(getComputedStyle(grids[0]!).rowGap);
      setRows(Math.max(1, Math.floor((available - categoryInset + gap - 1) / (tallestCard + gap))));
    });
    for (const element of [node, ...cards]) observer.observe(element, { box: "border-box" });
    return () => observer.disconnect();
  }, [visibleKeys, byCategory]);

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
    if (!selection || !panel) return;
    if (!panel.open) panel.showModal();
    if (body.current) body.current.scrollTop = 0;
    const row = [...panel.querySelectorAll<HTMLElement>("[data-realized-operation]")]
      .find(row => row.dataset.realizedOperation === selection.paymentId);
    const target = row && ([...row.querySelectorAll<HTMLElement>("[data-realized-component]")]
      .find(component => component.dataset.realizedComponent === selection.componentId) ?? row);
    if (target) {
      target.focus({ preventScroll: true });
      target.scrollIntoView({ block: "nearest" });
    } else {
      closeButton.current?.focus();
    }
  }, [selection]);

  const open = useCallback((cardId: string, paymentId?: string, componentId?: string) => {
    setSelection({ cardId, paymentId, componentId });
  }, []);
  const renderGrid = (entries: typeof visible) =>
    <div className={styles.grid} style={{ "--rail-rows": Math.min(rows, entries.length) } as CSSProperties}>
      {entries.map(({ card, category, date }) => <RealizedMonthCard key={card.id} card={card} category={category}
        date={sortOrder === "date" ? date : undefined} open={open} />)}
    </div>;

  return <div className={styles.board} data-realized-month={board.month}>
    <header className={styles.hero}>
      <dl className={styles.totals}>
        <div><dt>Revenus encaissés</dt><dd>{money(board.totals.income.amount)}</dd></div>
        <div><dt>Dépenses débitées</dt><dd>{money(board.totals.expense.amount)}</dd></div>
        {board.totals.refund.count > 0 && <div><dt>Remboursements reçus</dt><dd>{money(board.totals.refund.amount)}</dd></div>}
        <div className={styles.net}><dt>Net hors transferts</dt><dd>{money(board.net)}</dd></div>
      </dl>
      <span>{board.eventCount} événements documentés</span>
    </header>
    <div className={styles.toolbar}>
      <select className={styles.sort} aria-label="Trier les cartes" value={sortOrder}
        onChange={event => { setSortOrder(event.target.value as SortOrder); startRail(); }}>
        {sortOptions.map(option => <option key={option.id} value={option.id}>{option.label}</option>)}
      </select>
      <div className={styles.search} role="search" aria-label="Recherche dans juillet">
        <Search size={16} aria-hidden="true" />
        <input ref={search} type="search" aria-label="Rechercher une carte ou une opération" placeholder="Marchand, événement, date…" value={query}
          onChange={event => filterQuery(event.target.value)} onKeyDown={event => {
            if (event.key === "Escape" && query) { event.preventDefault(); filterQuery(""); }
          }} />
        {query && <button type="button" aria-label="Effacer la recherche" onClick={() => { filterQuery(""); search.current?.focus(); }}>
          <X size={16} aria-hidden="true" />
        </button>}
      </div>
      <p className={styles.resultCount} role="status">{visibleCount} {visibleCount === 1 ? "carte" : "cartes"}</p>
      <div className={styles.railArrows}>
        <button type="button" aria-label="Défiler à gauche" onClick={() => scrollRail(-1)}><ArrowLeft size={16} aria-hidden="true" /></button>
        <button type="button" aria-label="Défiler à droite" onClick={() => scrollRail(1)}><ArrowRight size={16} aria-hidden="true" /></button>
      </div>
    </div>
    <div ref={rail} className={styles.rail}
      tabIndex={0} aria-label="Cartes réalisées, défilement horizontal" data-realized-rail
      onKeyDown={event => {
        if (event.target !== event.currentTarget || !["ArrowLeft", "ArrowRight"].includes(event.key)) return;
        event.preventDefault(); scrollRail(event.key === "ArrowRight" ? 1 : -1);
      }}>
      {visibleCount === 0 && <p className={styles.empty}>{board.cards.length ? "Aucune carte ne correspond à cette recherche."
        : "Aucune opération ni événement importé pour ce mois."}</p>}
      {visibleCount > 0 && !byCategory && renderGrid(visible)}
      {visibleCategories.map(({ category, entries }) => <section key={category.id} className={styles.category}
        data-realized-category={category.id} aria-labelledby={`realized-category-${category.id}`}>
        <h2 id={`realized-category-${category.id}`}>{category.label}</h2>
        {renderGrid(entries)}
      </section>)}
    </div>
    <dialog ref={dialog} className={styles.dialog} aria-labelledby="realized-dialog-title"
      onClose={() => setSelection(null)} onClick={event => { if (event.target === event.currentTarget) dialog.current?.close(); }}>
      {selected && <div className={styles.panel}>
        <header className={styles.panelHeader}>
          <CardArtwork card={selected} size={56} />
          <div>
            <h2 id="realized-dialog-title">{selected.label}</h2>
            <p>{[cardCaption(selected), selected.eventStatus].filter(Boolean).join(" · ")}</p>
            {selected.amount !== null && <strong>{money(selected.amount)}</strong>}
          </div>
          <button ref={closeButton} type="button" className={styles.close} aria-label="Fermer la carte" onClick={() => dialog.current?.close()}>
            <X size={20} aria-hidden="true" />
          </button>
        </header>
        <div ref={body} className={styles.panelBody}>
          {editableIds.has(reconstructedId(board.month, selected.id)) && <button type="button" className={styles.editCard}
            onClick={() => { dialog.current?.close(); onEdit(selected.id); }}><Pencil size={15} aria-hidden="true" /> Modifier dans le brouillon</button>}
          <RealizedDetail card={selected} terms={terms} open={open} />
        </div>
      </div>}
    </dialog>
  </div>;
}
