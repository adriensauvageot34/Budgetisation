"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AppToolbarContent } from "@/components/layout/app-toolbar";
import {
  isArchivedRealizedMonth, isImportedRealizedMonth, JULY_COMPOSER_EDIT_HREF,
  JULY_COMPOSER_HREF, JULY_COMPOSER_MONTH, JULY_V2_HREF, realizedComposerHref,
} from "@/domain/phase2/planner/realized-month-entry";
import { composerBalanceHref, composerCalendarHref, isWorkspaceMonth, monthPlanningHref } from "./month-entry";
import styles from "./composer/composer.module.css";

export type MonthLoadingView = "cards" | "calendar" | "forecast" | "balance";
type Tab = { label: string; href: string };

export function MonthLoadingNavigation({ view, pilot = false }: { view: MonthLoadingView; pilot?: boolean }) {
  const search = useSearchParams();
  const requested = search.get("month") ?? "";
  const month = pilot ? JULY_COMPOSER_MONTH : isWorkspaceMonth(requested) ? requested : "";
  const calendar = { label: "Calendrier", href: month ? composerCalendarHref(month) : "/mois-a-venir/composer/calendrier" };
  const cards = month ? { label: "Cartes", href: realizedComposerHref(month) } : undefined;
  const imported = isImportedRealizedMonth(month);
  const archived = isArchivedRealizedMonth(month);
  const forecast = { label: "Prévisions", href: month ? monthPlanningHref(month, imported ? "previsions" : undefined) : "/mois-a-venir" };
  const balance = { label: "Bilan du mois", href: composerBalanceHref(month) };
  let active: Tab | undefined = { cards, calendar, forecast, balance }[view];
  let tabs = [view !== "forecast" || imported ? cards : undefined, calendar, archived ? balance : forecast];

  if (month === JULY_COMPOSER_MONTH) {
    const read = { label: "Au 15 juillet", href: JULY_COMPOSER_HREF };
    const edit = { label: "Édition", href: JULY_COMPOSER_EDIT_HREF };
    const julyForecast = { label: "Prévisions", href: JULY_V2_HREF };
    tabs = [calendar, read, edit, julyForecast];
    if (view === "cards") {
      active = search.get("view") === "edition" ? edit : read;
      if (search.get("view") === "bilan" && cards) {
        active = { ...cards, href: `${cards.href}&view=bilan` };
        tabs = [read, active, calendar];
      }
    }
    if (view === "forecast") active = julyForecast;
  }

  return <AppToolbarContent className={styles.compactToolbar}>
    <nav aria-label="Vues de Composer" className={styles.reconstructionModes}>
      {tabs.map(tab => tab && (tab.href === active?.href
        ? <span key={tab.href} className={styles.reconstructionLink} aria-current="page">{tab.label}</span>
        : <Link key={tab.href} className={styles.reconstructionLink} href={tab.href} prefetch={false}>{tab.label}</Link>))}
    </nav>
  </AppToolbarContent>;
}
