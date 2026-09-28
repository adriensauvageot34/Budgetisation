"use client";

import { useState } from "react";

type Outflow = Readonly<{ key: string; label: string; amount: string; date: string | null;
  dateCertainty: "DECLARED" | "HISTORICAL_ESTIMATE" | "UNKNOWN" }>;
type CalendarEvent = { key: string; label: string; amount: string; date: string; certainty: "DECLARED" | "HISTORICAL_ESTIMATE"; kind: "outflow" | "event" };
const money = (value: string, exact = false) => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR",
  minimumFractionDigits: exact ? 2 : 0, maximumFractionDigits: exact ? 2 : 0 }).format(Number(value));
const compactMoney = (value: string) => new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(Number(value));
const fullDate = (date: string) => new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", timeZone: "UTC" }).format(new Date(`${date}T12:00:00Z`));

export function MonthCalendar({ targetMonth, outflows, plannedEvents, dailyTotals }: { targetMonth: string; outflows: readonly Outflow[];
  plannedEvents: readonly { id: string; label: string; plannedDate: string; plannedCost: string }[];
  dailyTotals: Readonly<Record<string, string>> }) {
  const [selected, setSelected] = useState<string | null>(null);
  const [year, month] = targetMonth.split("-").map(Number);
  const firstWeekday = (new Date(Date.UTC(year!, month! - 1, 1)).getUTCDay() + 6) % 7;
  const days = new Date(Date.UTC(year!, month!, 0)).getUTCDate();
  const cells = Array.from({ length: firstWeekday + days }, (_, index) => index < firstWeekday ? null : index - firstWeekday + 1);
  const events: CalendarEvent[] = [
    ...outflows.filter((item) => item.date !== null).map((item) => ({ key: item.key, label: item.label, amount: item.amount,
      date: item.date!, certainty: item.dateCertainty as "DECLARED" | "HISTORICAL_ESTIMATE", kind: "outflow" as const })),
    ...plannedEvents.map((item) => ({ key: item.id, label: item.label, amount: item.plannedCost,
      date: item.plannedDate, certainty: "DECLARED" as const, kind: "event" as const })),
  ];
  const undated = outflows.filter((item) => item.date === null);
  const selectedEvents = events.filter((item) => item.date === selected);

  return <div className="mt-4">
    <div className="mb-2 grid grid-cols-7 gap-1 text-center text-[11px] font-bold text-slate-500 sm:text-xs" aria-hidden="true">
      {['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map((day) => <span key={day}>{day}</span>)}
    </div>
    <div className="grid grid-cols-7 gap-1" role="grid" aria-label={`Sorties de ${targetMonth}`}>
      {cells.map((day, index) => {
        if (day === null) return <span key={`empty-${index}`} aria-hidden="true" />;
        const date = `${targetMonth}-${String(day).padStart(2, "0")}`;
        const entries = events.filter((item) => item.date === date);
        const estimated = entries.some((item) => item.certainty === "HISTORICAL_ESTIMATE");
        const prefix = estimated ? "~" : "";
        const dayTotal = dailyTotals[date];
        return <button key={date} type="button" role="gridcell" aria-selected={selected === date} aria-label={`${fullDate(date)} : ${entries.length} sortie${entries.length > 1 ? "s" : ""}${dayTotal ? `, ${money(dayTotal, true)} au total` : ""}${entries.length ? `, ${entries.map((item) => item.label).join(", ")}` : ""}`}
          className={`flex min-h-13 min-w-0 flex-col items-start rounded-lg border p-1 text-left focus-visible:outline-2 focus-visible:outline-emerald-700 sm:min-h-16 sm:p-2 ${selected === date ? "border-emerald-700 bg-emerald-50" : entries.length ? "border-slate-200 bg-white hover:bg-slate-50" : "border-transparent bg-slate-50/60"}`}
          onClick={() => setSelected(selected === date ? null : date)}>
          <span className="text-xs font-bold tabular-nums sm:text-sm">{day}</span>
          {entries.length > 0 && <><span className={`mt-1 max-w-full truncate text-[10px] font-bold leading-tight sm:text-xs ${estimated ? "text-slate-700" : "text-emerald-900"}`}><span className="sm:hidden">{prefix}{compactMoney(dayTotal ?? entries[0]!.amount)}</span><span className="hidden sm:inline">{prefix}{money(dayTotal ?? entries[0]!.amount, entries.length > 1)}</span></span>{entries.length > 1 && <span className="text-[9px] leading-tight text-slate-600 sm:text-[10px]"><span className="sm:hidden">×{entries.length}</span><span className="hidden sm:inline">{entries.length} sorties</span></span>}</>}
        </button>;
      })}
    </div>
    <p className="mt-3 text-xs text-slate-600">Montants en €. ~ signale au moins une date habituelle estimée. Touchez un jour pour voir ses détails.</p>
    {selected && <div className="mt-3 rounded-xl bg-slate-50 p-3" role="region" aria-live="polite" aria-label={`Détail du ${fullDate(selected)}`}>
      <p className="font-bold capitalize">{fullDate(selected)}</p>
      {selectedEvents.length ? <ul className="mt-2 space-y-2">{selectedEvents.map((item) => <li key={item.key} className="flex flex-wrap items-start justify-between gap-x-3 text-sm"><span className="min-w-0 flex-1"><strong>{item.label}</strong><span className="block text-xs text-slate-600">{item.kind === "event" ? "Projet déclaré" : item.certainty === "DECLARED" ? "Date déclarée" : "Date habituelle estimée"}</span></span><strong className="tabular-nums">{money(item.amount, true)}</strong></li>)}</ul> : <p className="mt-1 text-sm text-slate-600">Aucune sortie prévue ce jour.</p>}
    </div>}
    {undated.length > 0 && <div className="mt-3 rounded-xl bg-amber-50/70 p-3 text-sm"><p className="font-bold">Date à confirmer</p><ul className="mt-1 space-y-1">{undated.map((item) => <li key={item.key} className="flex justify-between gap-3"><span>{item.label}</span><strong className="shrink-0 tabular-nums">{money(item.amount)}</strong></li>)}</ul></div>}
  </div>;
}
