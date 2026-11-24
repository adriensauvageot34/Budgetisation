import Link from "next/link";
import { redirect } from "next/navigation";
import { readHistoryBalance } from "@/app/history-balance-data";
import { parseYearMonth } from "@/core/time";
import { ARCHIVED_REALIZED_MONTHS, JULY_COMPOSER_HREF, realizedComposerHref } from "@/domain/phase2/planner/realized-month-entry";
import { HistoryV2Page, parseHistoryCalendarFilters, parseHistoryOverlaySearch } from "@/features/history-v2";
import { composerCalendarHref, forecastWindowMonths } from "../../month-entry";
import material from "../../month-material.module.css";
import { monthLabel } from "../display";
import styles from "../month-view.module.css";

export const dynamic = "force-dynamic";
export const metadata = { title: "Bilan du mois · Composer" };

export default async function ComposerBalancePage({
  searchParams,
}: {
  searchParams: Promise<Readonly<Record<string, string | string[] | undefined>>>;
}) {
  const search = await searchParams;
  const archivedMonth = ARCHIVED_REALIZED_MONTHS.find(month => month === search.month);
  if (archivedMonth === undefined) {
    redirect(typeof search.month === "string" && forecastWindowMonths.includes(search.month)
      ? composerCalendarHref(search.month)
      : JULY_COMPOSER_HREF);
  }
  const month = parseYearMonth(archivedMonth);
  const initialState = await readHistoryBalance(month);
  const button = `${material.clayButton} ${styles.button}`;

  return <div className={`${material.page} ${styles.page}`}>
    <header className={`${material.glassPremium} ${styles.header}`}>
      <div>
        <p className="eyebrow">Composer · Mois réalisé</p>
        <h1>{monthLabel(month)}</h1>
      </div>
      <nav aria-label="Vues de Composer">
        <Link className={button} href={realizedComposerHref(month)} prefetch={false}>Cartes</Link>
        <Link className={button} href={composerCalendarHref(month)} prefetch={false}>Calendrier</Link>
        <span className={button} aria-current="page">Bilan du mois</span>
      </nav>
    </header>
    <HistoryV2Page key={month} month={month} view="balance" surface="composer" initialState={initialState}
      filters={parseHistoryCalendarFilters({})} initialOverlay={parseHistoryOverlaySearch(search)} />
  </div>;
}
