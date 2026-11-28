import Link from "next/link";
import { redirect } from "next/navigation";
import { readBalanceDailySeries, readHistoryBalance } from "@/app/history-balance-data";
import { AppToolbarContent } from "@/components/layout/app-toolbar";
import { parseYearMonth } from "@/core/time";
import { ARCHIVED_REALIZED_MONTHS, JULY_COMPOSER_HREF, realizedComposerHref } from "@/domain/phase2/planner/realized-month-entry";
import { parseHistoryOverlaySearch } from "@/features/history-v2";
import { ComposerBalanceDashboard } from "@/features/history-v2/balance-dashboard";
import { readAuthenticatedSubcategoryPresentation } from "@/server/query/runtime";
import { withProductAuthentication } from "@/app/product-query";
import { composerCalendarHref, forecastWindowMonths } from "../../month-entry";
import styles from "../composer.module.css";
import balanceStyles from "@/features/history-v2/balance-dashboard.module.css";

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
  const dailySeries = readBalanceDailySeries(month);
  const [initialState, subcategories] = await Promise.all([
    readHistoryBalance(month),
    withProductAuthentication(readAuthenticatedSubcategoryPresentation),
  ]);
  const button = styles.reconstructionLink;

  return <>
    <AppToolbarContent className={styles.compactToolbar}>
      <nav aria-label="Vues de Composer" className={styles.reconstructionModes}>
        <Link className={button} href={realizedComposerHref(month)}>Cartes</Link>
        <Link className={button} href={composerCalendarHref(month)}>Calendrier</Link>
        <h1 className={button + " " + balanceStyles.balanceTitle} aria-current="page">Bilan du mois</h1>
      </nav>
    </AppToolbarContent>
    <ComposerBalanceDashboard key={month} month={month} initialState={initialState}
      subcategoryLabels={subcategories.labels} categoryBySubcategory={subcategories.categories}
      initialDetail={parseHistoryOverlaySearch(search)} dailySeries={dailySeries} includeFixed={search.charges === "toutes"} />
  </>;
}
