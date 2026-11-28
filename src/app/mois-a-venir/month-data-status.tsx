import Link from "next/link";
import { monthLabel } from "./composer/display";
import type { MonthEntry } from "./month-entry";
import styles from "./forecast-dashboard.module.css";
import material from "./month-material.module.css";

export function MonthDataStatus({ entry, compact = false }: { entry: MonthEntry; compact?: boolean }) {
  const { lastComplete, targetMonth, currentMonth, financeStatus, realizedMonth, realizedHref } = entry;
  const hasCompleteData = financeStatus === "complete";
  const planning = targetMonth >= currentMonth;
  return <section aria-label="Couverture des données financières" className={compact ? styles.coverage : `${material.glassSecondary} flex flex-wrap items-center justify-between gap-x-6 gap-y-3 p-4`}>
    <div>
      <p className="text-sm font-bold">
        {lastComplete
          ? <>Dernier mois financier complet <time className="ml-1" dateTime={lastComplete}>{monthLabel(lastComplete)}</time></>
          : "Dernier mois financier complet à confirmer"}
      </p>
      {!hasCompleteData && <p className="mt-1 text-sm text-slate-600">
        {financeStatus === "partial" ? "Les imports du mois consulté sont partiels."
          : targetMonth > currentMonth ? "Ce mois peut être préparé à partir des références disponibles."
          : "La couverture financière du mois consulté reste à confirmer."}
        {planning && " Les montants manquants restent à compléter."}
      </p>}
    </div>
    {realizedHref && realizedMonth && <Link href={realizedHref} prefetch={false} className={compact ? styles.headerLink : `${material.clayButton} inline-flex items-center px-4 py-2 text-sm font-bold`}>
      {realizedMonth === targetMonth ? "Réalisé" : `Réalisé · ${monthLabel(realizedMonth)}`}
    </Link>}
  </section>;
}
