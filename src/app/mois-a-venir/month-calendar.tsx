"use client";

import { useState } from "react";
import type { CalendarEntry, CalendarOutflow } from "./planned-expenses-projection";

const money = (value: string, exact = false) => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR",
  minimumFractionDigits: exact ? 2 : 0, maximumFractionDigits: exact ? 2 : 0 }).format(Number(value));
const compactMoney = (value: string) => new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(Number(value));
const fullDate = (date: string) => new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", timeZone: "UTC" }).format(new Date(`${date}T12:00:00Z`));
const natureLabel = (item: CalendarEntry) => item.nature === "DECLARED_REALIZED" ? "Marquée comme réalisée · Montant prévu"
  : item.nature === "PLANNED_EXPENSE" ? "Dépense prévue" : item.dateCertainty === "DECLARED" ? "Charge certaine · date déclarée" : "Charge certaine · date habituelle estimée";

export function MonthCalendar({ targetMonth, entries, undated, dailyTotals }: { targetMonth: string;
  entries: readonly CalendarEntry[]; undated: readonly CalendarOutflow[]; dailyTotals: Readonly<Record<string, string>> }) {
  const [selected, setSelected] = useState<string | null>(null);
  const [year, month] = targetMonth.split("-").map(Number);
  const firstWeekday = (new Date(Date.UTC(year!, month! - 1, 1)).getUTCDay() + 6) % 7;
  const days = new Date(Date.UTC(year!, month!, 0)).getUTCDate();
  const cells = Array.from({ length: firstWeekday + days }, (_, index) => index < firstWeekday ? null : index - firstWeekday + 1);
  const selectedEntries = entries.filter((item) => item.date === selected);

  return <div className="mt-4 min-w-0">
    <div className="mb-2 grid grid-cols-7 gap-1 text-center text-[11px] font-bold text-slate-500 sm:text-xs" aria-hidden="true">
      {["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"].map((day) => <span key={day}>{day}</span>)}
    </div>
    <div className="grid min-w-0 grid-cols-7 gap-1" role="grid" aria-label={`Calendrier de ${targetMonth}`}>
      {cells.map((day, index) => {
        if (day === null) return <span key={`empty-${index}`} aria-hidden="true" />;
        const date = `${targetMonth}-${String(day).padStart(2, "0")}`;
        const dayEntries = entries.filter((item) => item.date === date);
        const estimated = dayEntries.some((item) => item.dateCertainty === "HISTORICAL_ESTIMATE");
        const realized = dayEntries.some((item) => item.nature === "DECLARED_REALIZED");
        const allRealized = dayEntries.length > 0 && dayEntries.every((item) => item.nature === "DECLARED_REALIZED");
        const dayTotal = dailyTotals[date];
        return <button key={date} type="button" role="gridcell" aria-selected={selected === date}
          aria-label={`${fullDate(date)} : ${dayEntries.length} élément${dayEntries.length > 1 ? "s" : ""}${dayTotal ? `, ${money(dayTotal, true)} prévus au total` : ""}${realized ? ", au moins une dépense marquée comme réalisée" : ""}`}
          className={`flex min-h-13 min-w-0 flex-col items-start rounded-lg border p-1 text-left focus-visible:outline-2 focus-visible:outline-emerald-700 sm:min-h-16 sm:p-2 ${selected === date ? "border-emerald-700 bg-emerald-50" : dayEntries.length ? "border-slate-200 bg-white hover:bg-slate-50" : "border-transparent bg-slate-50/60"}`}
          onClick={() => setSelected(selected === date ? null : date)}>
          <span className="text-xs font-bold tabular-nums sm:text-sm">{day}</span>
          {dayEntries.length > 0 && <><span className={`mt-1 max-w-full truncate text-[10px] font-bold leading-tight sm:text-xs ${allRealized ? "text-slate-600 line-through" : "text-emerald-900"}`}><span className="sm:hidden">{estimated ? "~" : ""}{compactMoney(dayTotal ?? dayEntries[0]!.amount)}</span><span className="hidden sm:inline">{estimated ? "~" : ""}{money(dayTotal ?? dayEntries[0]!.amount, dayEntries.length > 1)}</span></span>{dayEntries.length > 1 && <span className="text-[9px] leading-tight text-slate-600 sm:text-[10px]">{dayEntries.length} éléments</span>}{realized && <span className="text-[9px] font-bold text-slate-700">✓ Réalisée</span>}</>}
        </button>;
      })}
    </div>
    <p className="mt-3 text-xs text-slate-600">Montants bruts prévus en €. ~ signale une date habituelle estimée. Touchez un jour pour voir ses détails.</p>
    {selected && <div className="mt-3 rounded-xl bg-slate-50 p-3" role="region" aria-live="polite" aria-label={`Détail du ${fullDate(selected)}`}>
      <p className="font-bold capitalize">{fullDate(selected)}</p>
      {selectedEntries.length ? <ul className="mt-2 space-y-2">{selectedEntries.map((item) => <li key={item.key} className="flex flex-wrap items-start justify-between gap-x-3 text-sm"><span className="min-w-0 flex-1"><strong>{item.label}</strong><span className="block text-xs text-slate-600">{natureLabel(item)}</span></span><strong className="tabular-nums">{money(item.amount, true)}</strong></li>)}</ul> : <p className="mt-1 text-sm text-slate-600">Rien de prévu ce jour.</p>}
    </div>}
    {undated.length > 0 && <div className="mt-3 rounded-xl bg-amber-50/70 p-3 text-sm"><p className="font-bold">Charges sans date précise</p><ul className="mt-1 space-y-1">{undated.map((item) => <li key={item.key} className="flex justify-between gap-3"><span>{item.label}</span><strong className="shrink-0 tabular-nums">{money(item.amount)}</strong></li>)}</ul></div>}
  </div>;
}
