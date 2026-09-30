"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { HistorySemanticIcon } from "@/features/history-v2/semantic-icon";
import type { CalendarEntry, CalendarItem } from "./planned-expenses-projection";
import { calendarDate, calendarDateLabel, calendarDayDescription, calendarIcon, calendarKeyboardDay,
  calendarMoney, calendarStateLabel, orderCalendarItems, visibleCalendarItems } from "./calendar-presentation";
import { usePlannedExpenseInteractions, type PlannedExpenseInteraction } from "./planned-expense-interactions";

const eventTone = (item: CalendarItem) => item.nature === "DECLARED_REALIZED"
  ? "border-emerald-200 bg-emerald-50 text-emerald-950" : item.nature === "PLANNED_EXPENSE"
    ? "border-sky-200 bg-sky-50 text-sky-950" : "border-slate-200 bg-slate-50 text-slate-800";
const buttonClass = "rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-bold focus-visible:outline-2 focus-visible:outline-indigo-700 disabled:opacity-50";

function EventIcon({ item, size = 16 }: { item: CalendarItem; size?: number }) {
  const icon = calendarIcon(item);
  return <span data-brand-key={icon.brandKey ?? undefined} className="inline-flex shrink-0 items-center justify-center" aria-hidden="true">
    <HistorySemanticIcon iconKey={icon.semanticIconKey} size={size} />
  </span>;
}

/** Read-model details only. All mutations are handed to the existing builder. */
export function CalendarEventDetails({ item, onAction }: { item: CalendarItem;
  onAction?: (interaction: PlannedExpenseInteraction) => void }) {
  const expense = item.expense;
  const detail = expense?.detail;
  const action = (name: PlannedExpenseInteraction["action"], label: string) =>
    <button type="button" className={buttonClass} onClick={() => onAction?.({ id: item.key, action: name })}>{label}</button>;
  return <article data-expense-id={expense?.id} className={`rounded-xl border p-4 ${eventTone(item)}`}>
    <div className="flex items-start gap-3"><EventIcon item={item} size={26} /><div className="min-w-0 flex-1">
      <h3 className="break-words font-black">{item.label}</h3><p className="mt-1 text-sm font-semibold">{calendarStateLabel(item)}</p>
      <p className="text-xs">{calendarDateLabel(item)}</p></div><strong className="whitespace-nowrap tabular-nums">{calendarMoney(item.amount)}</strong></div>
    {expense && <>
      <ul className="mt-3 space-y-1 border-t border-current/10 pt-3 text-sm" aria-label="Éléments du projet">
        {expense.costItems.map((cost) => <li key={cost.id} className="flex justify-between gap-3"><span>{cost.variantLabel || cost.label}</span>
          <span className="shrink-0 tabular-nums">{cost.quantity} × {calendarMoney(cost.unitAmount)}</span></li>)}
      </ul>
      {detail && <dl className="mt-3 grid grid-cols-2 gap-2 text-sm"><dt>S’ajoute au mois</dt><dd className="text-right font-bold">{calendarMoney(detail.additionalImpact)}</dd>
        <dt>Déjà compris dans le quotidien</dt><dd className="text-right">{calendarMoney(detail.includedBaseline)}</dd>
        {detail.funding.map((part) => <div key={part.source} className="col-span-2 flex justify-between gap-3"><dt>{part.source === "BANK" ? "Banque" : part.source === "SWILE" ? "Swile" : "Edenred"} · {expense.status === "PLANNED" ? "réservé" : "utilisé déclaré"}</dt><dd>{calendarMoney(part.amount)}</dd></div>)}
        {detail.fuelUsage !== "0.00" && <><dt>Usage carburant estimé</dt><dd className="text-right">{calendarMoney(detail.fuelUsage)}</dd></>}
      </dl>}
      {detail?.placeLabel && <p className="mt-3 text-sm">Lieu : {detail.placeLabel}</p>}
      {!!detail?.childPlaceLabels.length && <p className="mt-1 text-sm">Lieux des compléments : {detail.childPlaceLabels.join(" · ")}</p>}
      {expense.context.route && <div className="mt-3 text-sm"><p className="font-semibold">Trajet {expense.context.route.mode === "CAR" ? "en voiture" : "prévu"}</p>
        <p>{expense.context.route.stops.map((stop) => stop.label).join(" → ")}</p>
        {expense.context.route.fuelEstimate && <p className="mt-1 text-xs">{expense.context.route.fuelEstimate.distanceKm} km · prix carburant du {expense.context.route.fuelEstimate.fuelPriceObservedAt ?? "jour non renseigné"} · estimation, aucun trajet observé créé.</p>}
      </div>}
      {onAction && <div className="mt-4 flex flex-wrap gap-2">
        {expense.status === "PLANNED" ? <>{action("EDIT", "Modifier")}{action("DECLARE", expense.needsRealityConfirmation ? "Oui, ça a eu lieu" : "Déclarer la réalisation")}
          {action("REPORT", "Reporter")}{action("DELETE", expense.needsRealityConfirmation ? "Ça n’a pas eu lieu" : "Supprimer la prévision")}</>
          : <>{action("CORRECT", "Corriger la déclaration")}{action("RESTORE", "Remettre en prévu")}{action("DELETE", "Supprimer la déclaration")}</>}
      </div>}
      <p className="mt-3 text-xs">Déclaration prospective, sans transaction ni débit de wallet observé.</p>
    </>}
  </article>;
}

export function MonthCalendar({ targetMonth, entries, undated, dailyTotals }: { targetMonth: string;
  entries: readonly CalendarEntry[]; undated: readonly CalendarItem[]; dailyTotals: Readonly<Record<string, string>> }) {
  const [selected, setSelected] = useState<string | null>(null);
  const [activeDay, setActiveDay] = useState(1);
  const dayButtons = useRef(new Map<number, HTMLButtonElement>());
  const opener = useRef<HTMLButtonElement | null>(null);
  const dialog = useRef<HTMLDialogElement | null>(null);
  const interactions = usePlannedExpenseInteractions();
  const [year, month] = targetMonth.split("-").map(Number);
  const firstWeekday = (new Date(Date.UTC(year!, month! - 1, 1)).getUTCDay() + 6) % 7;
  const days = new Date(Date.UTC(year!, month!, 0)).getUTCDate();
  const cellCount = Math.ceil((firstWeekday + days) / 7) * 7;
  const cells = Array.from({ length: cellCount }, (_, index) => index < firstWeekday || index >= firstWeekday + days ? null : index - firstWeekday + 1);
  const weeks = Array.from({ length: cellCount / 7 }, (_, index) => cells.slice(index * 7, index * 7 + 7));
  const isUndatedSelection = selected?.startsWith("undated:");
  const selectedUndated = isUndatedSelection ? undated.find((item) => `undated:${item.key}` === selected) : undefined;
  const selectedEntries = selectedUndated ? [selectedUndated] : entries.filter((item) => item.date === selected);
  const title = isUndatedSelection ? "Projet à dater" : selected ? calendarDate(selected) : "";

  useEffect(() => {
    if (!selected || !dialog.current) return;
    const node = dialog.current;
    node.showModal();
    node.querySelector<HTMLButtonElement>("button")?.focus();
    return () => { node.close(); opener.current?.focus(); };
  }, [selected]);

  const open = (key: string, source: HTMLButtonElement) => { opener.current = source; setSelected(key); };
  const onAction = interactions ? (interaction: PlannedExpenseInteraction) => {
    setSelected(null); interactions.request(interaction);
  } : undefined;

  return <div className="mt-4 min-w-0">
    <div role="grid" aria-label={`Calendrier de ${targetMonth}`} aria-colcount={7} aria-rowcount={weeks.length + 1}>
      <div role="row" className="mb-2 grid grid-cols-7 gap-1 text-center text-xs font-bold text-slate-500">
        {["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"].map((day) => <span role="columnheader" key={day}>{day}</span>)}
      </div>
      {weeks.map((week, rowIndex) => <div role="row" key={rowIndex} className="mb-1 grid grid-cols-7 gap-1">
        {week.map((day, columnIndex) => {
          if (day === null) return <div role="gridcell" key={`empty-${columnIndex}`} />;
          const date = `${targetMonth}-${String(day).padStart(2, "0")}`;
          const dayEntries = entries.filter((item) => item.date === date);
          const visible = visibleCalendarItems(dayEntries);
          return <div role="gridcell" aria-selected={selected === date} key={date}>
            <button type="button" data-calendar-day={day} ref={(node) => { if (node) dayButtons.current.set(day, node); else dayButtons.current.delete(day); }}
              tabIndex={activeDay === day ? 0 : -1} aria-label={calendarDayDescription(date, dayEntries, dailyTotals[date])}
              aria-haspopup="dialog" aria-expanded={selected === date} onFocus={() => setActiveDay(day)}
              onKeyDown={(event) => {
                const next = calendarKeyboardDay(day, event.key, days, firstWeekday);
                if (next !== null) { event.preventDefault(); setActiveDay(next); dayButtons.current.get(next)?.focus(); }
              }} onClick={(event) => open(date, event.currentTarget)}
              className={`flex h-40 w-full min-w-0 flex-col rounded-xl border p-2 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-700 ${selected === date ? "outline-2 outline-offset-1 outline-indigo-700" : ""} ${dayEntries.length ? "border-slate-200 bg-white" : "border-transparent bg-slate-50"}`}>
              <span className="flex w-full justify-between gap-1 text-xs font-bold tabular-nums"><span>{day}</span>
                {dayEntries.length > 1 && <span>{calendarMoney(dailyTotals[date]!)}</span>}</span>
              <span className="mt-2 grid w-full gap-1">{visible.map((item) => <span key={item.key} data-calendar-event={item.key}
                className={`block rounded-md border px-1 ${dayEntries.length === 3 ? "py-0.5 text-[9px]" : "py-1 text-[10px]"} ${eventTone(item)}`}>
                <span className="flex min-w-0 items-center gap-1"><EventIcon item={item} /><span className="min-w-0 flex-1 truncate">
                  {item.dateCertainty === "HISTORICAL_ESTIMATE" && <span aria-hidden="true">~ </span>}{item.label}</span></span>
                <span className="flex justify-between gap-1"><span className="truncate">{item.nature === "DECLARED_REALIZED" ? "✓ Réalisée" : item.nature === "PLANNED_EXPENSE" ? "Prévue" : "Certaine"}</span><strong className="whitespace-nowrap">{calendarMoney(item.amount)}</strong></span>
              </span>)}</span>
              {dayEntries.length > visible.length && <span className="mt-1 text-xs font-semibold">+{dayEntries.length - visible.length} autres</span>}
            </button>
          </div>;
        })}
      </div>)}
    </div>
    <p className="mt-3 text-xs text-slate-600">Charge certaine · Prévue · ✓ Réalisée déclarée · ~ Date estimée. Montants bruts exacts. Flèches pour changer de jour ; Entrée ou Espace pour ouvrir les détails.</p>
    {undated.length > 0 && <section className="mt-4 rounded-xl bg-amber-50 p-4" aria-label="À dater"><h3 className="font-bold">À dater</h3>
      <ul className="mt-2 space-y-2">{orderCalendarItems(undated).map((item) => <li key={item.key}>
        {item.expense ? <button type="button" className={`${buttonClass} flex w-full items-center justify-between gap-3 text-left`}
          aria-haspopup="dialog" onClick={(event) => open(`undated:${item.key}`, event.currentTarget)}>
          <span><EventIcon item={item} /> {item.label}<span className="block text-xs font-normal">{calendarStateLabel(item)} · Date à confirmer</span></span><strong>{calendarMoney(item.amount)}</strong></button>
          : <div className="flex justify-between gap-3 text-sm"><span>{item.label}<span className="block text-xs">Charge certaine · Date à confirmer</span></span><strong>{calendarMoney(item.amount)}</strong></div>}
      </li>)}</ul>
    </section>}
    {selected && <dialog ref={dialog} aria-labelledby="calendar-drawer-title" aria-describedby="calendar-drawer-summary"
      className="fixed inset-y-0 left-auto right-0 m-0 h-dvh max-h-none w-[38.75rem] max-w-full border-0 bg-white p-0 text-slate-900 shadow-2xl backdrop:bg-slate-950/30"
      onCancel={(event) => { event.preventDefault(); setSelected(null); }} onClose={() => setSelected(null)}
      onKeyDown={(event) => {
        if (event.key !== "Tab") return;
        const controls = [...event.currentTarget.querySelectorAll<HTMLElement>(
          'button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]',
        )].filter((node) => node.getClientRects().length > 0);
        const first = controls[0], last = controls.at(-1);
        if (event.shiftKey && document.activeElement === first || !event.shiftKey && document.activeElement === last) {
          event.preventDefault(); (event.shiftKey ? last : first)?.focus();
        }
      }}
      onClick={(event) => { if (event.target === event.currentTarget) { const rect = event.currentTarget.getBoundingClientRect();
        if (event.clientX < rect.left || event.clientX > rect.right) setSelected(null); } }}>
      <div className="h-full overflow-y-auto p-6"><header className="flex items-start justify-between gap-3"><div>
        <h2 id="calendar-drawer-title" className="text-2xl font-black capitalize">{title}</h2>
        <p id="calendar-drawer-summary" className="mt-1 text-sm">{selectedEntries.length} élément{selectedEntries.length > 1 ? "s" : ""}
          {selectedUndated ? ` · ${calendarMoney(selectedUndated.amount)}` : dailyTotals[selected] ? ` · ${calendarMoney(dailyTotals[selected]!)}` : ""}</p>
      </div><button type="button" className={buttonClass} aria-label="Fermer les détails du jour" onClick={() => setSelected(null)}><X size={20} aria-hidden="true" /></button></header>
        <div className="mt-5 grid gap-4">{selectedEntries.length ? orderCalendarItems(selectedEntries).map((item) =>
          <CalendarEventDetails key={item.key} item={item} onAction={onAction} />) : <p>Rien de prévu ce jour.</p>}</div>
        {!selectedUndated && dailyTotals[selected] && <p className="mt-5 border-t border-slate-200 pt-4 text-right font-black">{calendarMoney(dailyTotals[selected]!)} au total</p>}
      </div>
    </dialog>}
  </div>;
}
