import { JULY_COMPOSER_HREF, JULY_COMPOSER_MONTH } from "@/domain/phase2/planner/realized-month-entry";
import type { RealizedBoard } from "@/server/phase2/planner/realized-month";
import { composerBalanceHref, composerCalendarHref } from "../month-entry";
import { monthLabel, money } from "./display";
import { RealizedComposerMonth } from "./realized-month";
import styles from "./composer.module.css";

export function RealizedFinancialTotals({ board, pilot = false }: { board: RealizedBoard; pilot?: boolean }) {
  return <dl className={styles.realizedTotals} aria-label={pilot ? "Flux bancaires jusqu’au 15 juillet" : "Bilan financier du mois"}>
    <div><dt>Revenus encaissés</dt><dd>{money(board.totals.income.amount)}</dd></div>
    <div><dt>Dépenses débitées</dt><dd>{money(board.totals.expense.amount)}</dd></div>
    {board.totals.refund.count > 0 && <div><dt>Remboursements reçus</dt><dd>{money(board.totals.refund.amount)}</dd></div>}
    <div className={styles.realizedNet}><dt>Net hors transferts</dt><dd>{money(board.net)}</dd></div>
  </dl>;
}

export function ArchivedRealizedMonth({ board, initialCardId }: { board: RealizedBoard; initialCardId?: string }) {
  const july = board.month === JULY_COMPOSER_MONTH;
  return <div className={styles.workspace} data-composer data-reconstruction-mode="realized">
    <header className={styles.workspaceHeader}>
      <div className={styles.headerIdentity}>
        {july && <a href={JULY_COMPOSER_HREF} className={styles.backLink}>Simulation au 15 juillet</a>}
        <h1>Composer <span>· {monthLabel(board.month)}</span></h1>
        <p className={styles.headerMeta}>{july ? "Bilan complet" : "Mois réalisé"} · {board.operationCount} opérations bancaires</p>
      </div>
      <RealizedFinancialTotals board={board} />
      <nav className={styles.reconstructionModes} aria-label="Vues de Composer">
        <span className={styles.reconstructionLink} aria-current="page">Cartes</span>
        <a className={styles.reconstructionLink} href={composerCalendarHref(board.month)}>Calendrier</a>
        {!july && <a className={styles.reconstructionLink} href={composerBalanceHref(board.month)}>Bilan du mois</a>}
      </nav>
    </header>
    <RealizedComposerMonth board={board} initialCardId={initialCardId} />
  </div>;
}
