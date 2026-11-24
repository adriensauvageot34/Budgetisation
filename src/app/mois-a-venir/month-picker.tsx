"use client";

import { useOptimistic, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { monthLabel } from "./composer/display";
import { isArchivedRealizedMonth, JULY_COMPOSER_MONTH, JULY_V2_HREF, ARCHIVED_REALIZED_MONTHS } from "@/domain/phase2/planner/realized-month-entry";
import { forecastWindowMonths, globalAnalysisHref, workspacePeriodHref } from "./month-entry";
import material from "./month-material.module.css";

const yearMonthPattern = /^\d{4}-(0[1-9]|1[0-2])$/u;

export function MonthPicker() {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const month = pathname === JULY_V2_HREF ? JULY_COMPOSER_MONTH : search.get("month") ?? "";
  const period = pathname === globalAnalysisHref ? "global" : yearMonthPattern.test(month) ? month : "";
  const [selection, selectPeriod] = useOptimistic(period);
  const [pending, startTransition] = useTransition();
  const outsideRange = yearMonthPattern.test(period) && !isArchivedRealizedMonth(period)
    && period !== JULY_COMPOSER_MONTH && !forecastWindowMonths.includes(period);
  return <select aria-label="Choisir une période" value={selection} aria-busy={pending}
    onChange={event => {
      const nextPeriod = event.currentTarget.value;
      const href = workspacePeriodHref(nextPeriod, pathname);
      // The editor uses the browser's unload guard for unsaved drafts and card edits.
      if (pathname === "/mois-a-venir/composer" && !isArchivedRealizedMonth(month)) {
        window.location.assign(href);
        return;
      }
      startTransition(() => {
        selectPeriod(nextPeriod);
        router.push(href);
      });
    }}
    className={`${material.field} w-full min-w-0 px-3 py-1.5 text-sm font-semibold capitalize sm:w-56`}>
    <option value="global">Global</option>
    <option value="" disabled hidden>Période</option>
    <optgroup label="Mois réalisés">
      {ARCHIVED_REALIZED_MONTHS.map(month => <option key={month} value={month}>{monthLabel(month)}</option>)}
    </optgroup>
    <optgroup label="Simulation">
      <option value={JULY_COMPOSER_MONTH}>Juillet 2026</option>
    </optgroup>
    <optgroup label="Prévisions">
      {forecastWindowMonths.map(month => <option key={month} value={month}>{monthLabel(month)}</option>)}
    </optgroup>
    {outsideRange && <option value={period} disabled hidden>{monthLabel(period)}</option>}
  </select>;
}
