"use client";

import { useRouter } from "next/navigation";
import { monthLabel } from "./composer/display";
import { forecastWindowMonths, monthPlanningHref } from "./month-entry";
import material from "./month-material.module.css";

export function MonthPicker({ targetMonth }: { targetMonth: string }) {
  const router = useRouter();
  const months = forecastWindowMonths.includes(targetMonth) ? forecastWindowMonths : [...forecastWindowMonths, targetMonth].sort();
  return <select aria-label="Choisir un mois de prévision" value={targetMonth}
    onChange={event => router.push(monthPlanningHref(event.currentTarget.value))}
    className={`${material.field} max-w-full px-3 py-2 text-sm font-semibold capitalize`}>
    {months.map(month => <option key={month} value={month}>{monthLabel(month)}</option>)}
  </select>;
}
