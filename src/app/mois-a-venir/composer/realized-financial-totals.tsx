import type { RealizedBoard } from "@/server/phase2/planner/realized-month";
import { money } from "./display";
import styles from "./composer.module.css";

export function RealizedFinancialTotals({ board, pilot = false }: { board: RealizedBoard; pilot?: boolean }) {
  return <dl className={styles.realizedTotals} aria-label={pilot ? "Flux bancaires jusqu’au 15 juillet" : "Bilan financier du mois"}>
    <div><dt>Revenus encaissés</dt><dd>{money(board.totals.income.amount)}</dd></div>
    <div><dt>Dépenses débitées</dt><dd>{money(board.totals.expense.amount)}</dd></div>
    {board.totals.refund.count > 0 && <div><dt>Remboursements reçus</dt><dd>{money(board.totals.refund.amount)}</dd></div>}
    <div className={styles.realizedNet}><dt>Net hors transferts</dt><dd>{money(board.net)}</dd></div>
  </dl>;
}
