import Link from "next/link";
import { AppToolbarContent } from "@/components/layout/app-toolbar";
import type { JulyPilotStatus } from "@/domain/phase2/planner/july-pilot";
import type { RealizedBoard } from "@/server/phase2/planner/realized-month";
import { composerCalendarHref } from "../month-entry";
import { RealizedFinancialTotals } from "./realized-financial-totals";
import { JulyEditLink } from "./july-edit-link";
import { RealizedComposerMonth } from "./realized-month";
import styles from "./composer.module.css";

export function JulyPilotMonth({ board, initialStatus, initialCardId, editableSourceIds }: {
  board: RealizedBoard; initialStatus?: JulyPilotStatus; initialCardId?: string; editableSourceIds: readonly string[];
}) {
  return <div className={styles.workspace} data-composer data-reconstruction-mode="realized">
    <h1 className="sr-only">Cartes · juillet 2026</h1>
    <AppToolbarContent className={styles.compactToolbar}>
      <RealizedFinancialTotals board={board} pilot />
      <nav className={styles.reconstructionModes} aria-label="Mode de juillet">
        <Link href={composerCalendarHref(board.month)} className={styles.reconstructionLink}>Calendrier</Link>
        <span className={styles.reconstructionLink} aria-current="page">Au 15 juillet</span>
        <JulyEditLink className={styles.reconstructionLink}>Édition</JulyEditLink>
      </nav>
    </AppToolbarContent>
    <RealizedComposerMonth key={`${initialStatus ?? ""}:${initialCardId ?? ""}`} board={board} pilot
      initialStatus={initialStatus} initialCardId={initialCardId} editableSourceIds={editableSourceIds} />
  </div>;
}
