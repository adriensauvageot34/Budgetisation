import Link from "next/link";
import { ArrowLeft, ArrowRight, ChevronDown } from "lucide-react";
import { addMonths } from "@/core/time";
import type { RealizedBoard, RealizedCard, RealizedPayment } from "@/server/phase2/planner/realized-month";
import { ComposerAssetVisual } from "./compact-catalog-visual";
import { money, monthLabel, plannedDayLabel } from "./display";
import { RealizedBadge } from "./realized-badge";
import styles from "./realized-month.module.css";

const sections = [
  { id: "fixed", label: "Charges fixes" },
  { id: "daily", label: "Vie courante" },
  { id: "events", label: "Sorties et événements" },
  { id: "flows", label: "Revenus et autres mouvements" },
] as const;

function days(date: string, end?: string) {
  const start = plannedDayLabel(date);
  return end && end !== date ? `${start} – ${plannedDayLabel(end)}` : start;
}

function RealizedElement({ payment }: { payment: RealizedPayment }) {
  return <li className={styles.element} data-realized-operation={payment.id}>
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
    {payment.components.length > 0 && <dl className={styles.components} aria-label="Composants économiques">
      {payment.components.map(component => <div key={component.id}>
        <dt>{component.label}</dt><dd>{money(component.amount)}</dd>
      </div>)}
    </dl>}
  </li>;
}

function RealizedMonthCard({ card }: { card: RealizedCard }) {
  const badges = [...new Map(card.payments.flatMap(payment => payment.badge
    ? [[payment.badge.label, payment.badge] as const] : [])).values()];
  const count = card.payments.length;
  const occurrenceCount = card.occurrences?.length ?? 0;
  const isTransfer = card.payments[0]?.flow === "transfer";
  const subtitle = [
    card.date ? days(card.date, card.endDate) : null,
    occurrenceCount ? `${occurrenceCount} ${occurrenceCount === 1 ? "occurrence" : "occurrences"}` : null,
    count ? `${count} ${count === 1 ? "opération" : "opérations"}` : null,
  ].filter(Boolean).join(" · ");
  return <details id={card.id} className={styles.card} data-realized-card={card.section}>
    <summary className={styles.cardSummary}>
      <span className={styles.cardIdentity}>
        <strong>{card.label}</strong>
        <span className={styles.cardSubtitle}>{subtitle}</span>
        {badges.length > 0 && <span className={styles.badges}>
          {badges.slice(0, 4).map(badge => <RealizedBadge key={badge.label} {...badge} named />)}
          {badges.length > 4 && <span title={badges.slice(4).map(badge => badge.label).join(", ")}>+${badges.length - 4}</span>}
        </span>}
      </span>
      <ComposerAssetVisual assetKey={card.art.assetKey ?? ""} templateKey={card.art.templateKey} iconKey={card.art.iconKey}
        className={styles.cardVisual} scale="CARD" size={76} />
      <span className={styles.cardTotal}>
        {card.amount !== null ? <><strong className={styles.amount}>{money(card.amount)}</strong>{isTransfer && <small>Solde des transferts</small>}</>
          : <small>{card.relatedPayments ? "Opérations liées dans les autres cartes" : "Coût non renseigné"}</small>}
      </span>
      <ChevronDown className={styles.chevron} size={16} aria-hidden="true" />
    </summary>
    <div className={styles.cardBody}>
      {card.occurrences && <ul className={styles.occurrences} aria-label="Occurrences">
        {card.occurrences.map(occurrence => <li key={occurrence.id}><time dateTime={occurrence.date}>{days(occurrence.date, occurrence.endDate)}</time>
          <span>{occurrence.label}</span></li>)}
      </ul>}
      {count > 0 && <ul className={styles.elements} aria-label="Opérations">
        {card.payments.map(payment => <RealizedElement key={payment.id} payment={payment} />)}
      </ul>}
      {card.relatedPayments ? <p>{card.relatedPayments} {card.relatedPayments === 1 ? "opération liée figure" : "opérations liées figurent"} dans les autres cartes.</p> : null}
      {!count && !card.occurrences && !card.relatedPayments && <p>Aucune opération rattachée à cet événement.</p>}
    </div>
  </details>;
}

export function RealizedComposerMonth({ board }: { board: RealizedBoard }) {
  const previous = addMonths(board.month, -1), next = addMonths(board.month, 1);
  return <div className={styles.board} data-realized-month={board.month}>
    <nav className={styles.monthNav} aria-label="Mois consulté">
      <Link href={`/mois-a-venir?month=${previous}`} prefetch={false}><ArrowLeft size={15} aria-hidden="true" /> Mois précédent</Link>
      <Link href={`/mois-a-venir?month=${next}`} prefetch={false}>Mois suivant <ArrowRight size={15} aria-hidden="true" /></Link>
    </nav>
    <header className={styles.hero}>
      <div>
        <p>Composer · Mois réalisé</p>
        <h1>{monthLabel(board.month)}</h1>
        <span>{board.operationCount} opérations bancaires · {board.eventCount} événements documentés</span>
      </div>
      <dl className={styles.totals}>
        <div><dt>Dépenses débitées</dt><dd>{money(board.totals.expense.amount)}</dd></div>
        <div><dt>Revenus encaissés</dt><dd>{money(board.totals.income.amount)}</dd></div>
        {board.totals.refund.count > 0 && <div><dt>Remboursements reçus</dt><dd>{money(board.totals.refund.amount)}</dd></div>}
      </dl>
    </header>
    <nav className={styles.sections} aria-label="Cartes du mois">
      {sections.filter(section => board.cards.some(card => card.section === section.id)).map(section =>
        <a key={section.id} href={`#${section.id}`}>{section.label}</a>)}
    </nav>
    {!board.cards.length && <p>Aucune opération ni événement importé pour ce mois.</p>}
    {sections.map(section => {
      const cards = board.cards.filter(card => card.section === section.id);
      if (!cards.length) return null;
      return <section key={section.id} id={section.id} aria-labelledby={`title-${section.id}`} className={styles.section}>
        <h2 id={`title-${section.id}`}>{section.label}</h2>
        <div className={styles.grid}>
          {cards.map(card => <RealizedMonthCard key={card.id} card={card} />)}
        </div>
      </section>;
    })}
  </div>;
}
