import Link from "next/link";
import { isImportedRealizedMonth, JULY_COMPOSER_HREF, JULY_COMPOSER_MONTH } from "@/domain/phase2/planner/realized-month-entry";
import type { RealizedBoard } from "@/server/phase2/planner/realized-month";
import { AppToolbarContent } from "@/components/layout/app-toolbar";
import { composerBalanceHref, composerCalendarHref, monthPlanningHref } from "../month-entry";
import { monthLabel } from "./display";
import { RealizedComposerMonth } from "./realized-month";
import { RealizedFinancialTotals } from "./realized-financial-totals";
import styles from "./composer.module.css";

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
