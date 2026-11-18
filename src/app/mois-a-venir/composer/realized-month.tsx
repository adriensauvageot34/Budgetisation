"use client";

import { ArrowLeft, ArrowRight, ChevronRight, MapPin, Pencil, Search, X } from "lucide-react";
import { memo, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { reconstructedId } from "@/domain/phase2/planner/realized-month-entry";
import type { RealizedBoard, RealizedCard, RealizedCardGroup, RealizedPayment } from "@/server/phase2/planner/realized-month";
import { ComposerAssetVisual } from "./compact-catalog-visual";
import { money, plannedDayLabel } from "./display";
import { RealizedBadge } from "./realized-badge";
import styles from "./realized-month.module.css";

const sortOptions = [
  { id: "amount-desc", label: "Montant du plus grand au plus petit" },
  { id: "amount-asc", label: "Montant du plus petit au plus grand" },
  { id: "date", label: "Chronologique" },
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
    payment.amount, money(payment.amount), ...payment.components.map(component => component.label));
}

function matches(text: string, terms: readonly string[]) {
  return terms.every(term => text.includes(term));
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

const RealizedMonthCard = memo(function RealizedMonthCard({ card, category, open, date, groceryPurchase }: {
  card: RealizedCard; category?: RealizedCardGroup; open: (cardId: string) => void; date?: string; groceryPurchase?: boolean;
}) {
  const badges = [...new Map(card.payments.flatMap(payment => payment.badge
    ? [[payment.badge.label, payment.badge] as const] : [])).values()];
  const linked = card.relatedPayments?.length;
  const visibleDate = card.date ?? date;
  const caption = groceryPurchase ? null : cardCaption(card, null);
  const location = card.eventPlace || (card.label === "Restaurant" && card.eventStatus ? "Lieu à confirmer" : undefined);
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
      {location && searchText(location) !== searchText(card.label) && <span className={styles.cardLocation}
        data-confirmed={Boolean(card.eventPlace)} title={location}>
        <MapPin size={12} aria-hidden="true" /><span>{location}</span>
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

function RealizedGroupTile({ group, count, open }: {
  group: RealizedCardGroup; count: number; open: () => void;
}) {
  const unit = group.id === "groceries" ? count === 1 ? "achat" : "achats" : count === 1 ? "carte" : "cartes";
  return <button type="button" className={`${styles.card} ${styles.groupCard}`} data-realized-group={group.id}
    data-realized-category={group.id} onClick={open}>
    <strong className={styles.cardTitle}>{group.label}</strong>
    <span className={styles.cardSubtitle}>{count} {unit}</span>
    <CardArtwork card={group} size={60} />
    {group.amount !== null && <span className={styles.cardTotal}><strong>{money(group.amount)}</strong></span>}
    <ChevronRight className={styles.chevron} size={16} aria-hidden="true" />
  </button>;
}

function earliestDate(card: RealizedCard): string | undefined {
  return card.date ?? [
    ...card.payments.map(payment => payment.date),
    ...(card.occurrences ?? []).map(item => item.date),
    ...(card.relatedPayments ?? []).map(payment => payment.date),
  ].sort()[0];
}

function operationCard(parent: RealizedCard, payment: RealizedPayment): RealizedCard {
  return { id: `purchase-${payment.id}`, section: parent.section, label: payment.label,
    art: payment.art ?? parent.art, date: payment.date, payments: [payment], amount: payment.amount };
}

function RealizedDetail({ card, terms, open }: {
  card: RealizedCard;
  terms: readonly string[];
  open: (cardId: string, paymentId?: string, componentId?: string) => void;
}) {
  return <>
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
  const [mode, setMode] = useState<"all" | "grouped">("all");
  const [sortOrder, setSortOrder] = useState<SortOrder>("amount-desc");
  const [groupId, setGroupId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [selection, setSelection] = useState<{ cardId: string; paymentId?: string; componentId?: string } | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const body = useRef<HTMLDivElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const search = useRef<HTMLInputElement>(null);
  const rail = useRef<HTMLDivElement>(null);
  const grid = useRef<HTMLDivElement>(null);
  const groupHeading = useRef<HTMLHeadingElement>(null);
  const overviewQuery = useRef("");
  const returnToGroup = useRef<string | null>(null);
  const [rows, setRows] = useState(1);
  const terms = searchText(query).split(" ").filter(Boolean);
  const group = mode === "grouped" ? board.groups.find(item => item.id === groupId) : undefined;
  const groupedOverview = mode === "grouped" && !group;
  const categoryByCard = useMemo(() => new Map(board.groups.flatMap(item =>
    item.cardIds.map(id => [id, item] as const))), [board.groups]);
  const groceryCards = useMemo(() => {
    const groceryParents = new Set(board.groups.find(item => item.id === "groceries")?.cardIds);
    return board.cards.filter(card => groceryParents.has(card.id))
      .flatMap(card => card.payments.map(payment => operationCard(card, payment)));
  }, [board.cards, board.groups]);
  const indexed = useMemo(() => [...board.cards, ...groceryCards].map(card => ({
    card,
    date: earliestDate(card),
    lines: [
      searchText(card.label, card.eventPlace, card.date, card.endDate, searchableDate(card.date), cardCaption(card)),
      ...(card.carTrip ? [searchText(card.label, "trajet voiture essence", card.carTrip.route, card.carTrip.compactRoute)] : []),
      ...card.payments.map(payment => searchText(card.label, paymentSearch(payment))),
      ...(card.occurrences ?? []).map(occurrence => searchText(card.label, occurrence.label, occurrence.date, searchableDate(occurrence.date))),
      ...(card.relatedPayments ?? []).map(payment => searchText(card.label, payment.label, payment.cardLabel,
        payment.date, searchableDate(payment.date), payment.component?.amount)),
    ],
  })), [board.cards, groceryCards]);
  const groceryIds = new Set(groceryCards.map(card => card.id));
  const matched = indexed.filter(({ lines }) => !terms.length || lines.some(line => matches(line, terms)));
  const matchingIds = new Set(matched.map(({ card }) => card.id));
  const groupMembers = new Set(group?.cardIds);
  const visible = matched.filter(({ card }) => group?.id === "groceries" ? groceryIds.has(card.id)
    : !groceryIds.has(card.id) && (!group || groupMembers.has(card.id))).sort((a, b) => {
      const byDate = () => (a.date ?? "9999").localeCompare(b.date ?? "9999") || a.card.label.localeCompare(b.card.label, "fr")
        || a.card.id.localeCompare(b.card.id);
      if (sortOrder === "date") return byDate();
      const left = a.card.amount, right = b.card.amount;
      if (left === null || right === null) return left === right ? byDate() : left === null ? 1 : -1;
      const difference = Math.abs(Number(left)) - Math.abs(Number(right));
      return (sortOrder === "amount-asc" ? difference : -difference) || byDate();
    });
  const visibleGroups = groupedOverview ? board.groups.filter(item => !terms.length || matches(searchText(item.label), terms)
    || (item.id === "groceries" ? groceryCards.some(card => matchingIds.has(card.id)) : item.cardIds.some(id => matchingIds.has(id)))) : [];
  const visibleCount = groupedOverview ? visibleGroups.length : visible.length;
  const selected = indexed.find(({ card }) => card.id === selection?.cardId)?.card;
  const visibleKeys = (groupedOverview ? visibleGroups.map(item => item.id) : visible.map(({ card }) => card.id)).join("|");

  useEffect(() => {
    const node = rail.current, gridNode = grid.current;
    if (!node || !gridNode?.children.length) return;
    const cards = [...gridNode.children];
    const observer = new ResizeObserver(() => {
      const railStyle = getComputedStyle(node);
      const available = node.clientHeight - parseFloat(railStyle.paddingTop) - parseFloat(railStyle.paddingBottom);
      const card = Math.max(...cards.map(card => card.getBoundingClientRect().height));
      const gap = parseFloat(getComputedStyle(gridNode).rowGap);
      setRows(Math.max(1, Math.floor((available + gap - 1) / (card + gap))));
    });
    for (const element of [node, ...cards]) observer.observe(element, { box: "border-box" });
    return () => observer.disconnect();
  }, [visibleKeys, groupedOverview]);

  useEffect(() => {
    if (groupId) groupHeading.current?.focus({ preventScroll: true });
    else if (returnToGroup.current) {
      grid.current?.querySelector<HTMLElement>(`[data-realized-group="${CSS.escape(returnToGroup.current)}"]`)?.focus();
      returnToGroup.current = null;
    }
  }, [groupId]);

  function scrollRail(direction: number) {
    const node = rail.current;
    if (!node) return;
    node.scrollBy({ left: Math.max(220, node.clientWidth * .7) * direction,
      behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
  }
  function startRail() {
    if (rail.current) rail.current.scrollLeft = 0;
  }
  function changeMode(value: typeof mode) {
    if (value === mode) return;
    if (groupId) setQuery(overviewQuery.current);
    setGroupId(null);
    setMode(value);
    startRail();
  }
  function showGroup(item: RealizedCardGroup) {
    overviewQuery.current = query;
    if (matches(searchText(item.label), terms)) setQuery("");
    setGroupId(item.id);
    startRail();
  }
  function leaveGroup() {
    returnToGroup.current = groupId;
    setGroupId(null);
    setQuery(overviewQuery.current);
    startRail();
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
      <nav className={styles.views} aria-label="Présentation des cartes réalisées">
        <button type="button" aria-pressed={mode === "all"} onClick={() => changeMode("all")}>Toutes les cartes</button>
        <button type="button" aria-pressed={mode === "grouped"} onClick={() => changeMode("grouped")}>Regroupé</button>
      </nav>
      {!groupedOverview && <select className={styles.sort} aria-label="Trier les cartes" value={sortOrder}
        onChange={event => { setSortOrder(event.target.value as SortOrder); startRail(); }}>
        {sortOptions.map(option => <option key={option.id} value={option.id}>{option.label}</option>)}
      </select>}
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
      <p className={styles.resultCount} role="status">{visibleCount} {groupedOverview
        ? visibleCount === 1 ? "catégorie" : "catégories" : visibleCount === 1 ? "carte" : "cartes"}</p>
      <div className={styles.railArrows}>
        <button type="button" aria-label="Défiler à gauche" onClick={() => scrollRail(-1)}><ArrowLeft size={16} aria-hidden="true" /></button>
        <button type="button" aria-label="Défiler à droite" onClick={() => scrollRail(1)}><ArrowRight size={16} aria-hidden="true" /></button>
      </div>
    </div>
    {group && <div className={styles.groupHeading}>
      <button type="button" onClick={leaveGroup}><ArrowLeft size={15} aria-hidden="true" /> Catégories</button>
      <h2 ref={groupHeading} tabIndex={-1}>{group.label}</h2>
      {group.amount !== null && <span>{money(group.amount)}</span>}
    </div>}
    <div ref={rail} className={styles.rail}
      tabIndex={0} aria-label="Cartes réalisées, défilement horizontal" data-realized-rail
      onKeyDown={event => {
        if (event.target !== event.currentTarget || !["ArrowLeft", "ArrowRight"].includes(event.key)) return;
        event.preventDefault(); scrollRail(event.key === "ArrowRight" ? 1 : -1);
      }}>
      {visibleCount ? <div ref={grid} className={styles.grid} style={{ "--rail-rows": Math.min(rows, visibleCount) } as CSSProperties}>
        {groupedOverview ? visibleGroups.map(item => <RealizedGroupTile key={item.id} group={item}
          count={item.id === "groceries" ? groceryCards.length : item.cardIds.length} open={() => showGroup(item)} />)
          : visible.map(({ card, date }) => <RealizedMonthCard key={card.id} card={card} date={sortOrder === "date" ? date : undefined}
            category={group ?? categoryByCard.get(card.id)} groceryPurchase={group?.id === "groceries"} open={open} />)}
      </div> : <p className={styles.empty}>{board.cards.length ? "Aucune carte ne correspond à cette recherche."
        : "Aucune opération ni événement importé pour ce mois."}</p>}
    </div>
    <dialog ref={dialog} className={styles.dialog} aria-labelledby="realized-dialog-title"
      onClose={() => setSelection(null)} onClick={event => { if (event.target === event.currentTarget) dialog.current?.close(); }}>
      {selected && <div className={styles.panel}>
        <header className={styles.panelHeader}>
          <CardArtwork card={selected} size={56} />
          <div>
            <h2 id="realized-dialog-title">{selected.label}</h2>
            <p>{[cardCaption(selected), selected.eventStatus].filter(Boolean).join(" · ")}</p>
            {selected.eventPlace && <p>{selected.eventPlace}</p>}
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
