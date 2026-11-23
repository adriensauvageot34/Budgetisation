import { addMonths, parseYearMonth } from "@/core/time";
import { monthLabel } from "./composer/display";
import { monthPlanningHref } from "./month-entry";
import { MonthPicker } from "./month-picker";
import material from "./month-material.module.css";

export function MonthNavigation({ targetMonth }: { targetMonth: string }) {
  const month = parseYearMonth(targetMonth);
  return <nav aria-label="Naviguer entre les mois" className={`${material.monthHeader} items-center text-sm font-bold`}>
    <a className={`${material.monthLink} text-slate-600`} href={monthPlanningHref(addMonths(month, -1))}>‹ Mois précédent</a>
    <div className="flex min-w-0 flex-col items-center gap-2">
      <h1 className="text-center text-4xl font-black uppercase tracking-tight">{monthLabel(month)}</h1>
      <MonthPicker key={month} targetMonth={month} />
    </div>
    <a className={`${material.monthLink} text-slate-600`} href={monthPlanningHref(addMonths(month, 1))}>Mois suivant ›</a>
  </nav>;
}
