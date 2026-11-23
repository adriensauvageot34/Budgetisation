import { ArrowLeft, ArrowRight } from "lucide-react";
import { ARCHIVED_REALIZED_MONTHS, JULY_COMPOSER_MONTH, realizedComposerHref } from "@/domain/phase2/planner/realized-month-entry";
import type { RealizedBoard } from "@/server/phase2/planner/realized-month";
import { MonthPicker } from "../month-picker";
import { monthLabel, money } from "./display";
import { RealizedComposerMonth } from "./realized-month";
import styles from "./composer.module.css";

export function RealizedFinancialTotals({ board }: { board: RealizedBoard }) {
  return <dl className={styles.realizedTotals} aria-label="Bilan financier du mois">
    <div><dt>Revenus encaissés</dt><dd>{money(board.totals.income.amount)}</dd></div>
    <div><dt>Dépenses débitées</dt><dd>{money(board.totals.expense.amount)}</dd></div>
    {board.totals.refund.count > 0 && <div><dt>Remboursements reçus</dt><dd>{money(board.totals.refund.amount)}</dd></div>}
    <div className={styles.realizedNet}><dt>Net hors transferts</dt><dd>{money(board.net)}</dd></div>
  </dl>;
}

export function ArchivedRealizedMonth({ board, initialCardId }: { board: RealizedBoard; initialCardId?: string }) {
  const index = ARCHIVED_REALIZED_MONTHS.findIndex(month => month === board.month);
  const previous = ARCHIVED_REALIZED_MONTHS[index - 1];
  const next = ARCHIVED_REALIZED_MONTHS[index + 1] ?? JULY_COMPOSER_MONTH;
  return <div className={styles.workspace} data-composer data-reconstruction-mode="realized">
    <header className={styles.workspaceHeader}>
      <div className={styles.headerIdentity}>
        <nav className="flex flex-wrap gap-x-3" aria-label="Accès au mois">
          <a href="/mois-a-venir" className={styles.backLink}><ArrowLeft size={14} /> Prévisions</a>
          <a href={`/historique/${board.month}`} className={styles.backLink}>Historique du mois</a>
        </nav>
        <h1>Composer <span>· {monthLabel(board.month)}</span></h1>
        <p className={styles.headerMeta}>Mois réalisé · {board.operationCount} opérations bancaires</p>
      </div>
      <RealizedFinancialTotals board={board} />
      <nav className={styles.reconstructionModes} aria-label="Mois réalisés">
        {previous && <a className="p-1.5" href={realizedComposerHref(previous)} aria-label="Mois précédent"><ArrowLeft size={16} /></a>}
        <MonthPicker targetMonth={board.month} />
        <a className="p-1.5" href={realizedComposerHref(next)} aria-label="Mois suivant"><ArrowRight size={16} /></a>
      </nav>
    </header>
    <RealizedComposerMonth board={board} initialCardId={initialCardId} />
  </div>;
}
