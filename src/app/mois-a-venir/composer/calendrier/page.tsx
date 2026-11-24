import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { withProductAuthentication } from "@/app/product-query";
import { getBootstrapContext } from "@/server/bootstrap/context";
import { planningDate } from "@/server/phase2/planning-date";
import { ARCHIVED_REALIZED_MONTHS, JULY_COMPOSER_MONTH, JULY_PILOT_DATE, JULY_V2_HREF, realizedComposerHref } from "@/domain/phase2/planner/realized-month-entry";
import { composerCalendarHref, forecastWindowMonths, monthPlanningHref } from "../../month-entry";
import { MonthPicker } from "../../month-picker";
import { monthLabel } from "../display";
import { ComposerCalendar } from "./calendar";
import { readComposerCalendar } from "./calendar-data";
import material from "../../month-material.module.css";
import styles from "./calendar.module.css";

const months = [...ARCHIVED_REALIZED_MONTHS, JULY_COMPOSER_MONTH, ...forecastWindowMonths];
export const dynamic = "force-dynamic";
export const metadata = { title: "Calendrier de Composer" };

export default async function ComposerCalendarPage({ searchParams }: { searchParams: Promise<{ month?: string | string[] }> }) {
  const [context, params] = await Promise.all([withProductAuthentication(getBootstrapContext), searchParams]);
  if (!context.household) notFound();
  const now = planningDate(context.household.timezone);
  const month = typeof params.month === "string" ? params.month : months.includes(now.slice(0, 7)) ? now.slice(0, 7) : JULY_COMPOSER_MONTH;
  const index = months.indexOf(month);
  if (index === -1) redirect(composerCalendarHref(JULY_COMPOSER_MONTH));
  const before = months[index - 1], after = months[index + 1];
  const mode = month === JULY_COMPOSER_MONTH ? "pilot" : forecastWindowMonths.includes(month) ? "forecast" : "realized";
  const calendar = await withProductAuthentication(() => readComposerCalendar(context, month, mode));
  const button = `${material.clayButton} ${styles.button}`;
  return <div className={`${material.page} ${styles.page}`}>
    <header className={`${material.glassPremium} ${styles.header}`}>
      <div>
        <p className="eyebrow">Composer · {mode === "pilot" ? "Simulation au 15 juillet" : mode === "realized" ? "Mois réalisé" : "Charges fixes prévues"}</p>
        <h1>{monthLabel(month)}</h1>
      </div>
      <nav aria-label="Naviguer entre les mois">
        {before && <Link className={button} prefetch={false} href={composerCalendarHref(before)} aria-label="Mois précédent"><ChevronLeft size={18} /></Link>}
        <MonthPicker key={month} targetMonth={month} calendar />
        {after && <Link className={button} prefetch={false} href={composerCalendarHref(after)} aria-label="Mois suivant"><ChevronRight size={18} /></Link>}
      </nav>
      <nav aria-label="Vues de Composer">
        <Link className={button} href={realizedComposerHref(month)} prefetch={false}>Cartes</Link>
        <span className={`${material.clayButton} ${styles.button}`} aria-current="page">Calendrier</span>
        {mode !== "realized" && <Link className={button} prefetch={false} href={mode === "pilot" ? JULY_V2_HREF : monthPlanningHref(month)}>Prévisions</Link>}
      </nav>
    </header>
    <ComposerCalendar key={month} calendar={calendar} month={month} today={mode === "pilot" ? JULY_PILOT_DATE : ""} />
  </div>;
}
