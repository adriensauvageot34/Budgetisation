"use client";

import { useRouter } from "next/navigation";
import { monthLabel } from "./composer/display";
import { isRealized2025Month, JULY_COMPOSER_MONTH, REALIZED_2025_MONTHS, realizedComposerHref } from "@/domain/phase2/planner/realized-month-entry";
import { forecastWindowMonths, monthPlanningHref } from "./month-entry";
import material from "./month-material.module.css";

export function MonthPicker({ targetMonth }: { targetMonth: string }) {
  const router = useRouter();
  const isRealized = isRealized2025Month(targetMonth) || targetMonth === JULY_COMPOSER_MONTH;
  const months = isRealized || forecastWindowMonths.includes(targetMonth) ? forecastWindowMonths : [...forecastWindowMonths, targetMonth].sort();
  return <select aria-label="Choisir un mois" value={targetMonth}
    onChange={event => {
      const month = event.currentTarget.value;
      router.push(isRealized2025Month(month) || month === JULY_COMPOSER_MONTH ? realizedComposerHref(month) : monthPlanningHref(month));
    }}
    className={`${material.field} max-w-full px-3 py-2 text-sm font-semibold capitalize`}>
    <optgroup label="Mois réalisés">
      {REALIZED_2025_MONTHS.map(month => <option key={month} value={month}>{monthLabel(month)}</option>)}
    </optgroup>
    <option value={JULY_COMPOSER_MONTH}>Juillet 2026 · mois test</option>
    <optgroup label="Prévisions">
      {months.map(month => <option key={month} value={month}>{monthLabel(month)}</option>)}
    </optgroup>
  </select>;
}
