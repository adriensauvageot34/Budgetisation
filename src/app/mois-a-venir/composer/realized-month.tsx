"use client";

import { ArrowLeft, ArrowRight, ChevronRight, Pencil, Search, X } from "lucide-react";
import { memo, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { reconstructedId } from "@/domain/phase2/planner/realized-month-entry";
import type { RealizedBoard, RealizedCard, RealizedPayment } from "@/server/phase2/planner/realized-month";
import { ComposerAssetVisual } from "./compact-catalog-visual";
import { money, plannedDayLabel } from "./display";
import { RealizedBadge } from "./realized-badge";
import styles from "./realized-month.module.css";

const sections = [
  { id: "fixed", label: "Charges fixes" },
  { id: "daily", label: "Vie courante" },
  { id: "events", label: "Sorties et événements" },
  { id: "flows", label: "Revenus et mouvements" },
] as const;
const fullDate = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

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

function CardArtwork({ card, size }: { card: RealizedCard; size: number }) {
  return <ComposerAssetVisual assetKey={card.art.assetKey ?? ""} templateKey={card.art.templateKey}
    iconKey={card.art.iconKey} className={styles.cardVisual} scale={size > 48 ? "CARD" : "LIBRARY"} size={size} />;
}

function cardCaption(card: RealizedCard) {
  const number = card.occurrences?.length;
  const count = card.payments.length;
  return [card.date ? days(card.date, card.endDate) : null,
    number ? `${number} ${number === 1 ? "occurrence" : "occurrences"}` : null,
    count ? `${count} ${count === 1 ? "opération" : "opérations"}` : null].filter(Boolean).join(" · ");
}

const RealizedMonthCard = memo(function RealizedMonthCard({ card, open }: { card: RealizedCard; open: (cardId: string) => void }) {
  const badges = [...new Map(card.payments.flatMap(payment => payment.badge
    ? [[payment.badge.label, payment.badge] as const] : [])).values()];
  const linked = card.relatedPayments?.length;
  return <button id={card.id} type="button" className={styles.card} data-realized-card={card.section}
    data-operation-count={card.payments.length} data-card-amount={card.amount ?? undefined}
    aria-haspopup="dialog" onClick={() => open(card.id)}>
    <span className={styles.cardIdentity}>
      <strong>{card.label}</strong>
      <span className={styles.cardSubtitle}>{cardCaption(card)}</span>
      {badges.length > 0 && <span className={styles.badges}>
        {badges.slice(0, 4).map(badge => <RealizedBadge key={badge.label} {...badge} named />)}
        {badges.length > 4 && <span title={badges.slice(4).map(badge => badge.label).join(", ")}>+${badges.length - 4}</span>}
      </span>}
    </span>
    <CardArtwork card={card} size={72} />
    <span className={styles.cardTotal}>
      {card.amount !== null ? <><strong>{money(card.amount)}</strong>
        {card.transferAmounts && <small>Solde des transferts</small>}
        {card.section === "events" && <small>Débits rattachés</small>}</>
        : <small>{linked ? `${linked} ${linked === 1 ? "opération associée" : "opérations associées"}` : "Aucun paiement rattaché"}</small>}
    </span>
    <ChevronRight className={styles.chevron} size={16} aria-hidden="true" />
  </button>;
});

function RealizedDetail({ card, terms, open }: {
  card: RealizedCard;
  terms: readonly string[];
  open: (cardId: string, paymentId?: string, componentId?: string) => void;
}) {
  return <>
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
  const [sectionFilter, setSectionFilter] = useState<RealizedCard["section"] | "all">("all");
  const [query, setQuery] = useState("");
  const [selection, setSelection] = useState<{ cardId: string; paymentId?: string; componentId?: string } | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const body = useRef<HTMLDivElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const search = useRef<HTMLInputElement>(null);
  const rail = useRef<HTMLDivElement>(null);
  const [rows, setRows] = useState(1);
  const terms = searchText(query).split(" ").filter(Boolean);
  const indexed = useMemo(() => board.cards.map(card => ({
    card,
    lines: [
      searchText(card.label, card.date, card.endDate, searchableDate(card.date), cardCaption(card)),
      ...card.payments.map(payment => searchText(card.label, paymentSearch(payment))),
      ...(card.occurrences ?? []).map(occurrence => searchText(card.label, occurrence.label, occurrence.date, searchableDate(occurrence.date))),
      ...(card.relatedPayments ?? []).map(payment => searchText(card.label, payment.label, payment.cardLabel,
        payment.date, searchableDate(payment.date), payment.component?.amount)),
    ],
  })), [board.cards]);
  const visible = indexed.filter(({ card, lines }) => (sectionFilter === "all" || card.section === sectionFilter)
    && (!terms.length || lines.some(line => matches(line, terms)))).map(({ card }) => card);
  const selected = board.cards.find(card => card.id === selection?.cardId);

  useEffect(() => {
    if (!rail.current) return;
    const observer = new ResizeObserver(entries => setRows(Math.max(1, Math.floor((entries[0]!.contentRect.height - 34) / 116))));
    observer.observe(rail.current);
    return () => observer.disconnect();
  }, []);

  function scrollRail(direction: number) {
    const node = rail.current;
    if (!node) return;
    node.scrollBy({ left: Math.max(220, node.clientWidth * .7) * direction,
      behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
  }
  function startRail() {
    if (rail.current) rail.current.scrollLeft = 0;
  }
  function filterSection(value: typeof sectionFilter) {
    setSectionFilter(value);
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
      <nav className={styles.sections} aria-label="Filtrer les cartes du mois">
        <button type="button" aria-pressed={sectionFilter === "all"} onClick={() => filterSection("all")}>Tout</button>
        {sections.filter(section => board.cards.some(card => card.section === section.id)).map(section =>
          <button type="button" key={section.id} aria-pressed={sectionFilter === section.id} onClick={() => filterSection(section.id)}>{section.label}</button>)}
      </nav>
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
      <p className={styles.resultCount} role="status">{visible.length} {visible.length === 1 ? "carte" : "cartes"}</p>
      <div className={styles.railArrows}>
        <button type="button" aria-label="Défiler à gauche" onClick={() => scrollRail(-1)}><ArrowLeft size={16} aria-hidden="true" /></button>
        <button type="button" aria-label="Défiler à droite" onClick={() => scrollRail(1)}><ArrowRight size={16} aria-hidden="true" /></button>
      </div>
    </div>
    <div ref={rail} className={styles.rail} style={{ "--rail-rows": rows } as CSSProperties}
      tabIndex={0} aria-label="Cartes réalisées, défilement horizontal" data-realized-rail
      onKeyDown={event => {
        if (event.target !== event.currentTarget || !["ArrowLeft", "ArrowRight"].includes(event.key)) return;
        event.preventDefault(); scrollRail(event.key === "ArrowRight" ? 1 : -1);
      }}>
    {!visible.length && <p className={styles.empty}>{board.cards.length
      ? "Aucune carte ne correspond à cette recherche dans la section sélectionnée."
      : "Aucune opération ni événement importé pour ce mois."}</p>}
    {sections.map(section => {
      const cards = visible.filter(card => card.section === section.id);
      if (!cards.length) return null;
      if (section.id === "events") cards.sort((a, b) =>
        Number(!!(b.payments.length || b.relatedPayments?.length)) - Number(!!(a.payments.length || a.relatedPayments?.length))
        || Number(!!a.occurrences?.length) - Number(!!b.occurrences?.length)
        || (a.date ?? "").localeCompare(b.date ?? ""));
      if (section.id === "fixed" || section.id === "daily") cards.sort((a, b) =>
        Number(a.amount ?? 0) - Number(b.amount ?? 0) || a.label.localeCompare(b.label, "fr"));
      return <section key={section.id} id={section.id} aria-labelledby={`title-${section.id}`} className={styles.section}>
        <header className={styles.sectionHeading}>
          <h2 id={`title-${section.id}`}>{section.label}</h2>
          {section.id !== "flows" && terms.length === 0 && <span>{money(board.sectionAmounts[section.id])} débité</span>}
        </header>
        <div className={styles.grid}>
          {cards.map(card => <RealizedMonthCard key={card.id} card={card} open={open} />)}
        </div>
      </section>;
    })}
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
