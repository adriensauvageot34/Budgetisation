import { monthLabel } from "./composer/display";
import { composerCalendarHref, forecastWindowMonths } from "./month-entry";
import material from "./month-material.module.css";

export function MonthNavigation({ targetMonth }: { targetMonth: string }) {
  return <header className="flex flex-wrap items-center justify-between gap-2">
    <h1 className="text-2xl font-black capitalize tracking-tight sm:text-3xl">{monthLabel(targetMonth)}</h1>
    {forecastWindowMonths.includes(targetMonth) && <a className={`${material.clayButton} px-3 py-1.5 text-sm font-bold`} href={composerCalendarHref(targetMonth)}>Calendrier</a>}
  </header>;
}
