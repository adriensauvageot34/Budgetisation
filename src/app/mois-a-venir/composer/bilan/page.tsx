import Link from "next/link";
import { redirect } from "next/navigation";
import { readHistoryBalance } from "@/app/history-balance-data";
import { AppToolbarContent } from "@/components/layout/app-toolbar";
import { parseYearMonth } from "@/core/time";
import { ARCHIVED_REALIZED_MONTHS, JULY_COMPOSER_HREF, realizedComposerHref } from "@/domain/phase2/planner/realized-month-entry";
import { parseHistoryOverlaySearch } from "@/features/history-v2";
import { ComposerBalanceDashboard } from "@/features/history-v2/balance-dashboard";
import { readAuthenticatedSubcategoryLabels } from "@/server/query/runtime";
import { withProductAuthentication } from "@/app/product-query";
import { composerCalendarHref, forecastWindowMonths } from "../../month-entry";
import material from "../../month-material.module.css";
import { monthLabel } from "../display";
import styles from "../composer.module.css";

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
  const [initialState, subcategoryLabels] = await Promise.all([
    readHistoryBalance(month),
    withProductAuthentication(readAuthenticatedSubcategoryLabels),
  ]);
  const button = styles.reconstructionLink;

  return <div className={`${material.page} h-full`}>
    <AppToolbarContent className={styles.compactToolbar}>
      <nav aria-label="Vues de Composer" className={styles.reconstructionModes}>
        <Link className={button} href={realizedComposerHref(month)}>Cartes</Link>
        <Link className={button} href={composerCalendarHref(month)}>Calendrier</Link>
        <span className={button} aria-current="page">Bilan du mois</span>
      </nav>
    </AppToolbarContent>
    <ComposerBalanceDashboard key={month} month={month} monthName={monthLabel(month)} initialState={initialState}
      subcategoryLabels={subcategoryLabels} initialDetail={parseHistoryOverlaySearch(search)} />
  </div>;
}
