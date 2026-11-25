"use client";

import { useContext, useId, useOptimistic, useState, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { monthLabel } from "./composer/display";
import { isImportedRealizedMonth, JULY_COMPOSER_MONTH, JULY_V2_HREF, ARCHIVED_REALIZED_MONTHS, IMPORTED_REALIZED_MONTHS } from "@/domain/phase2/planner/realized-month-entry";
import { ComposerMonthNavigationContext } from "./composer/month-navigation-guard";
import { composerCalendarHref, forecastWindowMonths, globalAnalysisHref, isWorkspaceMonth, workspacePeriodHref } from "./month-entry";
import material from "./month-material.module.css";

const yearMonthPattern = /^\d{4}-(0[1-9]|1[0-2])$/u;

export function MonthPicker() {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const month = pathname === JULY_V2_HREF ? JULY_COMPOSER_MONTH : search.get("month") ?? "";
  const global = pathname === globalAnalysisHref;
  const period = global ? "global" : yearMonthPattern.test(month) ? month : "";
  const [selection, selectPeriod] = useOptimistic(period);
  const [pending, startTransition] = useTransition();
  const guard = useContext(ComposerMonthNavigationContext);
  const noticeId = useId();
  const [notice, setNotice] = useState<{ period: string; message: string } | null>(null);
  const noticeMessage = pathname === "/mois-a-venir/composer" && notice?.period === period ? notice.message : null;
  const outsideRange = yearMonthPattern.test(period) && !isWorkspaceMonth(period);
  const returnMonth = global && isWorkspaceMonth(month) ? month : null;
  const returnLabel = returnMonth ? `Revenir à ${monthLabel(returnMonth)}` : "Revenir au mois courant";
  return <>
    <select aria-label="Choisir une période" aria-describedby={noticeMessage ? noticeId : undefined}
      value={selection} aria-busy={pending}
      onChange={event => {
        const nextPeriod = event.currentTarget.value;
        const href = workspacePeriodHref(nextPeriod, pathname, month);
        setNotice(null);
        const navigate = () => startTransition(() => {
          selectPeriod(nextPeriod);
          router.push(href);
        });
        if (pathname === "/mois-a-venir/composer" && guard?.current) {
          const message = guard.current(navigate);
          if (message) setNotice({ period, message });
        } else {
          navigate();
        }
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
      <optgroup label="Imports bancaires partiels">
        {IMPORTED_REALIZED_MONTHS.map(month => <option key={month} value={month}>{monthLabel(month)}</option>)}
      </optgroup>
      <optgroup label="Prévisions">
        {forecastWindowMonths.filter(month => !isImportedRealizedMonth(month)).map(month => <option key={month} value={month}>{monthLabel(month)}</option>)}
      </optgroup>
      {outsideRange && <option value={period} disabled hidden>{monthLabel(period)}</option>}
    </select>
    {noticeMessage && <p id={noticeId} role="alert" className="max-w-64 text-xs font-medium text-amber-900">{noticeMessage}</p>}
    {global && <div className="flex min-w-0 flex-wrap items-center gap-2">
      <Link prefetch={false} className="button-secondary px-3 py-1.5 text-sm"
        href={returnMonth ? workspacePeriodHref(returnMonth, pathname) : "/mois-a-venir"}>
        {returnLabel}
      </Link>
      <Link prefetch={false} className="button-secondary px-3 py-1.5 text-sm"
        href={returnMonth ? composerCalendarHref(returnMonth) : "/mois-a-venir/composer/calendrier"}>
        Calendrier<span className="sr-only">{returnMonth ? ` de ${monthLabel(returnMonth)}` : " du mois courant"}</span>
      </Link>
    </div>}
  </>;
}
