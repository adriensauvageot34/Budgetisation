import Link from "next/link";
import { isImportedRealizedMonth, JULY_COMPOSER_HREF, JULY_COMPOSER_MONTH } from "@/domain/phase2/planner/realized-month-entry";
import type { RealizedBoard } from "@/server/phase2/planner/realized-month";
import { AppToolbarContent } from "@/components/layout/app-toolbar";
import { composerBalanceHref, composerCalendarHref, monthPlanningHref } from "../month-entry";
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
  const imported = isImportedRealizedMonth(board.month);
  return <div className={styles.workspace} data-composer data-reconstruction-mode="realized">
    <h1 className="sr-only">Cartes · {monthLabel(board.month)}</h1>
    <AppToolbarContent className={styles.compactToolbar}>
      <RealizedFinancialTotals board={board} />
      {imported && <small>Données bancaires partielles</small>}
      <nav className={styles.reconstructionModes} aria-label="Vues de Composer">
        {july && <Link href={JULY_COMPOSER_HREF} className={styles.reconstructionLink}>Au 15 juillet</Link>}
        <span className={styles.reconstructionLink} aria-current="page">Cartes</span>
        <Link className={styles.reconstructionLink} href={composerCalendarHref(board.month)}>Calendrier</Link>
        {imported
          ? <Link className={styles.reconstructionLink} href={monthPlanningHref(board.month, "previsions")}>Prévisions</Link>
          : !july && <Link className={styles.reconstructionLink} href={composerBalanceHref(board.month)}>Bilan du mois</Link>}
      </nav>
    </AppToolbarContent>
    <RealizedComposerMonth board={board} initialCardId={initialCardId} />
  </div>;
}
