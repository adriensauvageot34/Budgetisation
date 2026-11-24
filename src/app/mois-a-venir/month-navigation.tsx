import { AppToolbarContent } from "@/components/layout/app-toolbar";
import { monthLabel } from "./composer/display";
import { composerCalendarHref, forecastWindowMonths } from "./month-entry";
import styles from "./composer/composer.module.css";

export function MonthNavigation({ targetMonth }: { targetMonth: string }) {
  return <>
    <h1 className="sr-only">{monthLabel(targetMonth)}</h1>
    {forecastWindowMonths.includes(targetMonth) && <AppToolbarContent className={styles.compactToolbar}>
      <nav aria-label="Vues de Composer" className={styles.reconstructionModes}>
        <a className={styles.reconstructionLink} href={composerCalendarHref(targetMonth)}>Calendrier</a>
      </nav>
    </AppToolbarContent>}
  </>;
}
