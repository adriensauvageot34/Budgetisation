import Link from "next/link";
import Image from "next/image";
import { notFound, redirect } from "next/navigation";
import { withProductAuthentication } from "@/app/product-query";
import { AppToolbarContent } from "@/components/layout/app-toolbar";
import { getBootstrapContext } from "@/server/bootstrap/context";
import { planningDate } from "@/server/phase2/planning-date";
import { ARCHIVED_REALIZED_MONTHS, isImportedRealizedMonth, JULY_COMPOSER_EDIT_HREF, JULY_COMPOSER_MONTH, JULY_PILOT_DATE, JULY_V2_HREF, realizedComposerHref } from "@/domain/phase2/planner/realized-month-entry";
import { composerBalanceHref, composerCalendarHref, forecastWindowMonths, monthPlanningHref } from "../../month-entry";
import { monthLabel } from "../display";
import { ComposerCalendar } from "./calendar";
import { readComposerCalendar } from "./calendar-data";
import styles from "../composer.module.css";
import clay from "./calendar.module.css";

const months = [...ARCHIVED_REALIZED_MONTHS, JULY_COMPOSER_MONTH, ...forecastWindowMonths];
export const dynamic = "force-dynamic";
export const metadata = { title: "Calendrier de Composer" };

export default async function ComposerCalendarPage({ searchParams }: { searchParams: Promise<{ month?: string | string[] }> }) {
  const [context, params] = await Promise.all([withProductAuthentication(getBootstrapContext), searchParams]);
  if (!context.household) notFound();
  const now = planningDate(context.household.timezone);
  const month = typeof params.month === "string" ? params.month : months.includes(now.slice(0, 7)) ? now.slice(0, 7) : JULY_COMPOSER_MONTH;
  if (!months.includes(month)) redirect(composerCalendarHref(JULY_COMPOSER_MONTH));
  if (params.month !== month) redirect(composerCalendarHref(month));
  const imported = isImportedRealizedMonth(month);
  const mode = month === JULY_COMPOSER_MONTH ? "pilot" : !imported && forecastWindowMonths.includes(month) ? "forecast" : "realized";
  const calendar = await withProductAuthentication(() => readComposerCalendar(context, month, mode));
  const button = styles.reconstructionLink;
  return <div className={clay.workspace}>
    <h1 className="sr-only">Calendrier · {monthLabel(month)}</h1>
    <AppToolbarContent className={styles.compactToolbar}>
      {imported && <small>Données bancaires partielles</small>}
      <nav aria-label="Vues de Composer" className={styles.reconstructionModes}>
        {mode !== "pilot" && <Link className={button} href={realizedComposerHref(month)} prefetch={false}>Cartes</Link>}
        <span className={`${button} ${clay.activeView}`} aria-current="page">
          <Image src="/analyse-globale/clay/events.webp" alt="" width={22} height={22} unoptimized />Calendrier
        </span>
        {mode === "pilot" && <>
          <Link className={button} href={realizedComposerHref(month)} prefetch={false}>Au 15 juillet</Link>
          <Link className={button} href={JULY_COMPOSER_EDIT_HREF} prefetch={false}>Édition</Link>
        </>}
        {mode === "realized" && !imported && <Link className={button} href={composerBalanceHref(month)} prefetch={false}>Bilan du mois</Link>}
        {(mode !== "realized" || imported) && <Link className={button} prefetch={false} href={mode === "pilot" ? JULY_V2_HREF : monthPlanningHref(month, imported ? "previsions" : undefined)}>Prévisions</Link>}
      </nav>
    </AppToolbarContent>
    <ComposerCalendar key={month} calendar={calendar} month={month} today={mode === "pilot" ? JULY_PILOT_DATE : now} />
  </div>;
}
