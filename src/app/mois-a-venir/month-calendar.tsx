"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { X, House, Smartphone, ShieldCheck, Landmark, Layers, BookOpen, PiggyBank } from "lucide-react";
import { HistorySemanticIcon } from "@/features/history-v2/semantic-icon";
import type { CalendarEntry, CalendarItem } from "./planned-expenses-projection";
import { calendarDate, calendarDateLabel, calendarDayDescription, calendarDaySummary, calendarEventLabel, calendarExpenseActions,
  calendarIcon, calendarInitialDay, calendarKeyboardDay, calendarMoney, calendarStateLabel,
  orderCalendarItems, visibleCalendarItems } from "./calendar-presentation";
import { usePlannedExpenseInteractions, type PlannedExpenseInteraction } from "./planned-expense-interactions";

const eventTone = (item: CalendarItem) => item.nature === "DECLARED_REALIZED"
  ? "bg-emerald-50 text-emerald-900" : item.expense?.needsRealityConfirmation
    ? "bg-amber-50 text-amber-900" : item.nature === "PLANNED_EXPENSE"
      ? "bg-sky-50 text-sky-900" : "text-slate-700";
const buttonClass = "rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-bold focus-visible:outline-2 focus-visible:outline-indigo-700 disabled:opacity-50";
const disclosureClass = "border-t border-slate-200 pt-3 text-sm [&>summary]:cursor-pointer [&>summary]:font-semibold";
const categoryIcons = { Maison: House, Télécom: Smartphone, Assurances: ShieldCheck, Banque: Landmark,
  Abonnements: Layers, Permis: BookOpen, Épargne: PiggyBank };

function EventIcon({ item, size = 18 }: { item: CalendarItem; size?: number }) {
  const icon = calendarIcon(item);
  const CategoryIcon = !item.expense ? categoryIcons[item.group as keyof typeof categoryIcons] : undefined;
  return <span data-brand-key={icon.brandKey ?? undefined} className="inline-flex shrink-0 items-center justify-center" aria-hidden="true">
    {icon.brandKey ? <Image src={`/brands/${icon.brandKey}.svg`} width={size} height={size} alt="" />
      : CategoryIcon ? <CategoryIcon size={size} /> : <HistorySemanticIcon iconKey={icon.semanticIconKey} size={size} />}
  </span>;
}

/** Read-model details only. Mutations use the existing builder and server contract. */
export function CalendarEventDetails({ item, onAction }: { item: CalendarItem;
  onAction?: (interaction: PlannedExpenseInteraction) => void }) {
  const expense = item.expense, detail = expense?.detail;
  return <article data-expense-id={expense?.id} className="space-y-3 border-b border-slate-200 py-5 last:border-0">
    <div className="flex items-start gap-3"><EventIcon item={item} size={24} /><div className="min-w-0 flex-1">
      <h3 className="break-words text-lg font-bold">{item.calendarLabel ?? item.label}</h3>
      <p className={`mt-1 inline-block text-xs font-semibold ${eventTone(item)}`}>{calendarStateLabel(item)}</p>
      <p className="mt-1 text-sm text-slate-600">{item.date ? `${calendarDateLabel(item)} · ${calendarDate(item.date)}` : "Ce mois-ci · sans jour précis"}</p>
    </div><strong className="whitespace-nowrap text-lg tabular-nums">{calendarMoney(item.amount)}</strong></div>
    {!expense && item.dateCertainty === "HISTORICAL_ESTIMATE" && <p className="text-sm text-slate-600">Date habituelle estimée autour du {item.date ? calendarDate(item.date) : "jour non précisé"}
      {item.dateEvidenceCount ? `, à partir de ${item.dateEvidenceCount} prélèvement${item.dateEvidenceCount > 1 ? "s" : ""} observé${item.dateEvidenceCount > 1 ? "s" : ""}` : ""}. Le jour exact peut varier.</p>}
    {expense && <>
      {detail?.placeLabel && <p className="text-sm">Lieu : <strong>{detail.placeLabel}</strong></p>}
      {!!detail?.participantLabels?.length && <p className="text-sm">Avec : {detail.participantLabels.join(" · ")}</p>}
      {!!detail?.childPlaceLabels.length && <p className="text-sm">Lieux des compléments : {detail.childPlaceLabels.join(" · ")}</p>}
      {onAction && <div className="flex flex-wrap gap-2">{calendarExpenseActions(expense).map(({ action, label }) =>
        <button key={action} type="button" className={buttonClass} onClick={() => onAction({ id: expense.id, action })}>{label}</button>)}</div>}
      {detail && <>
        <details className={disclosureClass}><summary>Effet sur le mois</summary><dl className="mt-3 grid grid-cols-2 gap-2">
          <dt>S’ajoute au mois</dt><dd className="text-right font-bold">{calendarMoney(detail.additionalImpact)}</dd>
          <dt>Déjà compris dans le quotidien</dt><dd className="text-right">{calendarMoney(detail.includedBaseline)}</dd>
          {detail.fuelUsage !== "0.00" && <><dt>Usage carburant estimé</dt><dd className="text-right">{calendarMoney(detail.fuelUsage)}</dd></>}
        </dl></details>
        <details className={disclosureClass}><summary>Financement</summary><dl className="mt-3 space-y-2">{detail.funding.map((part) =>
          <div key={part.source} className="flex justify-between gap-3"><dt>{part.source === "BANK" ? "Banque" : part.source === "SWILE" ? "Swile" : "Edenred"} · {expense.status === "PLANNED" ? part.source === "BANK" ? "prévu" : "réservé" : "utilisé déclaré"}</dt><dd>{calendarMoney(part.amount)}</dd></div>)}
        </dl><p className="mt-2 text-xs text-slate-600">Ces montants décrivent votre projet ; aucun débit observé n’est créé.</p></details>
      </>}
      {expense.context.route && <details className={disclosureClass}><summary>Trajet {expense.context.route.mode === "CAR" ? "en voiture" : "prévu"}</summary>
        <p className="mt-3">{expense.context.route.stops.map((stop) => stop.label).join(" → ")}</p>
        <ul className="mt-2 space-y-1 text-xs text-slate-600">{expense.context.route.stops.slice(0, -1).map((stop, index) => <li key={index}>{stop.label} → {expense.context.route!.stops[index + 1]!.label} · {stop.distanceToNextKm ?? "distance non renseignée"}{stop.distanceToNextKm ? " km" : ""}
          {stop.evidence ? ` · estimé à partir de ${stop.evidence.observationCount} trajet(s), dernière référence du ${calendarDate(stop.evidence.lastDate)}` : stop.distanceSource === "MANUAL" ? " · distance renseignée par vous" : ""}</li>)}</ul>
        {expense.context.route.fuelEstimate && <p className="mt-2 text-xs text-slate-600">{expense.context.route.fuelEstimate.distanceKm} km · estimation au prix carburant du {expense.context.route.fuelEstimate.fuelPriceObservedAt ?? "jour non renseigné"}. Ce prix peut avoir évolué ; l’usage estimé n’est pas un plein payé.</p>}
      </details>}
      <details className={disclosureClass}><summary>Détails du coût</summary><ul className="mt-3 space-y-2" aria-label="Éléments du projet">
        {expense.costItems.map((cost) => <li key={cost.id} className="flex justify-between gap-3"><span>{cost.variantLabel || cost.label}</span>
          <span className="shrink-0 tabular-nums">{cost.quantity} × {calendarMoney(cost.unitAmount)}</span></li>)}
      </ul></details>
    </>}
    <details className={disclosureClass}><summary>Référence et sources</summary><p className="mt-2 break-words">{item.fullLabel ?? item.label}</p>
      {item.freshnessDate && <p className="mt-1 text-xs">Dernière référence disponible : {calendarDate(item.freshnessDate)}.</p>}
      {item.provenance && <p className="mt-1 text-xs">{item.provenance === "SNAPSHOT" ? "Issue de la prévision publiée" : "Renseignée pour ce mois"}.</p>}
      {expense && <p className="mt-1 text-xs">Déclaration prospective, sans transaction ni débit de wallet observé.</p>}
    </details>
  </article>;
}

type Filter = "ALL" | "PROJECTS" | "CHARGES" | "CONFIRM";
export function MonthCalendar({ targetMonth, entries, undated, dailyTotals, today = "" }: { targetMonth: string;
  entries: readonly CalendarEntry[]; undated: readonly CalendarItem[]; dailyTotals: Readonly<Record<string, string>>; today?: string }) {
  const [selected, setSelected] = useState<string | null>(null);
  const [focusedKey, setFocusedKey] = useState<string | null>(null);
  const [activeDay, setActiveDay] = useState(() => calendarInitialDay(targetMonth, today, entries));
  const [filter, setFilter] = useState<Filter>("ALL");
  const dayButtons = useRef(new Map<number, HTMLButtonElement>());
  const eventDetails = useRef(new Map<string, HTMLDivElement>());
  const opener = useRef<HTMLButtonElement | null>(null);
  const dialog = useRef<HTMLDialogElement | null>(null);
  const undatedProjects = useRef<HTMLElement | null>(null);
  const interactions = usePlannedExpenseInteractions();
  const [year, month] = targetMonth.split("-").map(Number);
  const firstWeekday = (new Date(Date.UTC(year!, month! - 1, 1)).getUTCDay() + 6) % 7;
  const days = new Date(Date.UTC(year!, month!, 0)).getUTCDate();
  const cellCount = Math.ceil((firstWeekday + days) / 7) * 7;
  const cells = Array.from({ length: cellCount }, (_, index) => index < firstWeekday || index >= firstWeekday + days ? null : index - firstWeekday + 1);
  const weeks = Array.from({ length: cellCount / 7 }, (_, index) => cells.slice(index * 7, index * 7 + 7));
  const monthEntries = entries.filter((item) => item.date.startsWith(`${targetMonth}-`));
  const accepts = (item: CalendarItem) => filter === "ALL" || (filter === "CHARGES" ? !item.expense : filter === "CONFIRM" ? item.expense?.needsRealityConfirmation : !!item.expense);
  const positioned = calendarDaySummary(monthEntries);
  const confirmations = monthEntries.filter((item) => item.expense?.needsRealityConfirmation).length;
  const projects = undated.filter((item) => item.expense);
  const monthly = undated.filter((item) => !item.expense);
  const selectedUndated = selected?.startsWith("undated:") ? undated.find((item) => `undated:${item.key}` === selected) : undefined;
  // The drawer always shows the whole day, even when the grid is filtered.
  const selectedEntries = selectedUndated ? [selectedUndated] : monthEntries.filter((item) => item.date === selected);
  const selectedTotal = calendarDaySummary(selectedEntries);
  const title = selectedUndated ? "Sans jour précis" : selected ? calendarDate(selected) : "";
  const monthTitle = new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${targetMonth}-01T12:00:00Z`));

  useEffect(() => {
    if (!selected || !dialog.current) return;
    const node = dialog.current;
    node.showModal();
    const target = focusedKey ? eventDetails.current.get(focusedKey) : null;
    if (target) { target.focus(); target.scrollIntoView({ block: "nearest" }); }
    else node.querySelector<HTMLButtonElement>("button")?.focus();
    return () => { node.close(); opener.current?.focus(); };
  }, [selected, focusedKey]);

  const open = (key: string, source: HTMLButtonElement, eventKey: string | null = null) => { opener.current = source; setFocusedKey(eventKey); setSelected(key); };
  const onAction = interactions ? (interaction: PlannedExpenseInteraction) => { setSelected(null); interactions.request(interaction); } : undefined;
  const create = (date: string) => onAction?.({ action: "CREATE", plannedDate: date });

  return <div className="min-w-0">
    <header className="mb-3 flex items-start justify-between gap-4"><div><h3 className="text-lg font-bold capitalize">{monthTitle}</h3>
      <p className="mt-1 text-sm text-slate-600">Nos échéances et projets placés dans le mois</p>
      <p className="mt-1 text-xs text-slate-500">{positioned.exactCount} à date précise · {positioned.estimatedCount} à date estimée</p>
    </div><div className="flex items-center gap-2">
      {confirmations > 0 && <button type="button" onClick={() => setFilter(filter === "CONFIRM" ? "ALL" : "CONFIRM")} aria-pressed={filter === "CONFIRM"} className="rounded-full bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-900 focus-visible:outline-2 focus-visible:outline-indigo-700">{confirmations} à confirmer</button>}
      {projects.length > 0 && <button type="button" onClick={() => { undatedProjects.current?.scrollIntoView({ block: "nearest", behavior: "smooth" }); undatedProjects.current?.focus(); }} className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold focus-visible:outline-2 focus-visible:outline-indigo-700">{projects.length} à placer</button>}
    </div></header>
    <div className="mb-3 flex items-center justify-between gap-3"><div className="flex gap-1" aria-label="Éléments affichés">{([ ["ALL", "Tout"], ["PROJECTS", "Projets"], ["CHARGES", "Charges"] ] as const).map(([value, label]) =>
      <button key={value} type="button" aria-pressed={filter === value} onClick={() => setFilter(value)} className={`rounded-full px-3 py-1 text-xs font-semibold focus-visible:outline-2 focus-visible:outline-indigo-700 ${filter === value ? "bg-slate-800 text-white" : "text-slate-600 hover:bg-slate-100"}`}>{label}</button>)}</div>
      <details className="relative text-xs text-slate-600"><summary className="cursor-pointer focus-visible:outline-2 focus-visible:outline-indigo-700">Comment lire ce calendrier ?</summary>
        <div className="absolute right-0 z-20 mt-2 w-80 rounded-xl border border-slate-200 bg-white p-4 text-sm shadow-lg"><p>Gris : échéance · Bleu : projet · ✓ Vert : réalisé déclaré · Ambre : projet passé à confirmer.</p><p className="mt-2">≈ Date estimée · ◌ Total mêlant dates précises et estimées. Les montants sont les coûts bruts, au centime.</p><p className="mt-2">Flèches : changer de jour. Début / Fin : début / fin de semaine. Entrée ou Espace : ouvrir. Échap : fermer.</p></div>
      </details>
    </div>
    <div role="grid" aria-label={`Calendrier de ${monthTitle}`} aria-colcount={7} aria-rowcount={weeks.length + 1} className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div role="row" className="grid grid-cols-7 border-b border-slate-200 text-center text-xs font-semibold text-slate-500">
        {["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"].map((day) => <span role="columnheader" key={day} className="py-2">{day}</span>)}
      </div>
      {weeks.map((week, rowIndex) => {
        const maxEvents = Math.max(...week.map((day) => monthEntries.filter((item) => item.date === `${targetMonth}-${String(day).padStart(2, "0")}` && accepts(item)).length));
        const height = maxEvents > 2 ? "h-[98px]" : maxEvents ? "h-[86px]" : "h-[76px]";
        return <div role="row" key={rowIndex} className={`grid grid-cols-7 border-b border-slate-100 last:border-b-0 ${height}`}>
          {week.map((day, columnIndex) => {
            if (day === null) return <div role="gridcell" key={`empty-${columnIndex}`} className="border-r border-slate-100 bg-slate-50/40 last:border-r-0" />;
            const date = `${targetMonth}-${String(day).padStart(2, "0")}`;
            const allDay = monthEntries.filter((item) => item.date === date);
            const dayEntries = allDay.filter(accepts), visible = visibleCalendarItems(dayEntries);
            const summary = calendarDaySummary(dayEntries);
            const isToday = date === today;
            return <div role="gridcell" aria-selected={selected === date} key={date} className={`group relative min-w-0 border-r border-slate-100 px-1.5 last:border-r-0 ${columnIndex > 4 ? "bg-slate-50/60" : ""}`}
              onKeyDown={(event) => { const next = calendarKeyboardDay(day, event.key, days, firstWeekday);
                if (next !== null) { event.preventDefault(); setActiveDay(next); dayButtons.current.get(next)?.focus(); } }}>
              <button type="button" data-calendar-day={day} ref={(node) => { if (node) dayButtons.current.set(day, node); else dayButtons.current.delete(day); }}
                tabIndex={activeDay === day ? 0 : -1} aria-current={isToday ? "date" : undefined} aria-label={`${isToday ? "Aujourd’hui, " : ""}${calendarDayDescription(date, allDay, dailyTotals[date])}`}
                aria-haspopup={allDay.length ? "dialog" : undefined} aria-expanded={allDay.length ? selected === date : undefined}
                onFocus={() => setActiveDay(day)} onClick={(event) => allDay.length ? open(date, event.currentTarget) : create(date)}
                className={`flex w-full items-start justify-between pt-1 text-left text-xs tabular-nums focus-visible:outline-2 focus-visible:outline-indigo-700 ${allDay.length ? "h-7" : "absolute inset-0 px-1.5"}`}>
                <span className={`flex size-5 items-center justify-center ${isToday ? "rounded-full bg-indigo-700 font-bold text-white" : "text-slate-500"}`}>{day}</span>
                {dayEntries.length > 0 && <span className="pt-0.5 font-semibold text-slate-500" title={summary.marker ? "Total positionné : comporte des dates estimées" : "Total à date précise"}>{summary.marker} {calendarMoney(summary.grossTotal)}</span>}
                {!allDay.length && <span className="absolute inset-x-0 top-9 text-center text-xs font-medium text-sky-700 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100">+ Prévoir</span>}
              </button>
              {visible.map((item) => <button key={item.key} type="button" tabIndex={-1} data-calendar-event={item.key}
                title={`${item.fullLabel ?? item.label} · ${calendarMoney(item.amount)} · ${calendarStateLabel(item)} · ${calendarDateLabel(item)}`}
                aria-label={`${item.fullLabel ?? item.label}, ${calendarMoney(item.amount)}, ${calendarStateLabel(item)}, ${calendarDateLabel(item)}`}
                onClick={(event) => open(date, event.currentTarget, item.key)} className={`flex h-5 w-full min-w-0 items-center gap-1 px-0.5 text-left text-xs hover:brightness-95 focus-visible:outline-2 focus-visible:outline-indigo-700 ${eventTone(item)}`}>
                <EventIcon item={item} /><span className="min-w-0 flex-1 truncate">{calendarEventLabel(item)}</span>
                {item.nature === "DECLARED_REALIZED" && <span aria-hidden="true">✓</span>}
                {item.expense?.needsRealityConfirmation && <span aria-hidden="true">?</span>}
                {item.dateCertainty === "HISTORICAL_ESTIMATE" && <span aria-hidden="true">≈</span>}
                <strong className="shrink-0 whitespace-nowrap font-semibold tabular-nums">{calendarMoney(item.amount)}</strong>
              </button>)}
              {dayEntries.length > visible.length && <button type="button" tabIndex={-1} onClick={(event) => open(date, event.currentTarget)} className="mt-0.5 text-xs font-medium text-slate-500 hover:text-indigo-700 focus-visible:outline-2 focus-visible:outline-indigo-700">+{dayEntries.length - visible.length} {dayEntries.length - visible.length > 1 ? "autres" : "autre"}</button>}
            </div>;
          })}
        </div>;
      })}
    </div>
    {projects.length > 0 && <section ref={undatedProjects} tabIndex={-1} className="mt-4 focus-visible:outline-2 focus-visible:outline-indigo-700" aria-label="À placer dans le calendrier"><h3 className="text-sm font-bold">À placer dans le calendrier</h3>
      <ul className="mt-1 divide-y divide-slate-100">{orderCalendarItems(projects).map((item) => <li key={item.key}><button type="button" className="flex w-full items-center gap-2 py-2 text-left text-sm focus-visible:outline-2 focus-visible:outline-indigo-700" aria-haspopup="dialog" onClick={(event) => open(`undated:${item.key}`, event.currentTarget, item.key)}>
        <EventIcon item={item} /><span className="min-w-0 flex-1">{item.calendarLabel ?? item.label} <span className="text-xs text-slate-500">· {calendarStateLabel(item)}</span></span><strong className="tabular-nums">{calendarMoney(item.amount)}</strong></button></li>)}</ul>
    </section>}
    {monthly.length > 0 && <section className="mt-3 border-t border-slate-100 pt-3" aria-label="Sans jour précis"><h3 className="text-sm font-semibold text-slate-600">Sans jour précis</h3>
      <ul className="mt-1 flex flex-wrap gap-x-6 gap-y-1">{monthly.map((item) => <li key={item.key} className="flex items-center gap-2 text-xs text-slate-600" title={item.fullLabel ?? item.label}><EventIcon item={item} /><span>{item.calendarLabel ?? item.label}</span><strong className="tabular-nums">{calendarMoney(item.amount)}</strong></li>)}</ul>
    </section>}
    {selected && <dialog ref={dialog} aria-labelledby="calendar-drawer-title" aria-describedby="calendar-drawer-summary"
      className="fixed inset-y-0 left-auto right-0 m-0 h-dvh max-h-none w-[38.75rem] max-w-full border-0 bg-white p-0 text-slate-900 shadow-2xl backdrop:bg-slate-950/30"
      onCancel={(event) => { event.preventDefault(); setSelected(null); }} onClose={() => setSelected(null)}
      onKeyDown={(event) => {
        if (event.key !== "Tab") return;
        const controls = [...event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), summary, a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]')].filter((node) => node.getClientRects().length > 0);
        const first = controls[0], last = controls.at(-1);
        if (event.shiftKey && document.activeElement === first || !event.shiftKey && document.activeElement === last) {
          event.preventDefault(); (event.shiftKey ? last : first)?.focus();
        }
      }}
      onClick={(event) => { if (event.target === event.currentTarget) { const rect = event.currentTarget.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right) setSelected(null); } }}>
      <div className="h-full overflow-y-auto p-6"><header className="flex items-start justify-between gap-3"><div>
        <h2 id="calendar-drawer-title" className="text-2xl font-black capitalize">{title}</h2>
        <p id="calendar-drawer-summary" className="mt-1 text-sm">{selectedEntries.length} élément{selectedEntries.length > 1 ? "s" : ""} · {selectedUndated ? "Coût" : "Total positionné"} : <strong>{calendarMoney(selectedTotal.grossTotal)}</strong></p>
        {!selectedUndated && selectedTotal.estimatedCount > 0 && <p className="mt-1 text-xs text-slate-600">À date précise : {calendarMoney(selectedTotal.exactDateTotal)} · À date estimée : {calendarMoney(selectedTotal.estimatedDateTotal)}</p>}
      </div><button type="button" className={buttonClass} aria-label="Fermer les détails du jour" onClick={() => setSelected(null)}><X size={20} aria-hidden="true" /></button></header>
        {!selectedUndated && interactions && <button type="button" className={`${buttonClass} mt-4`} onClick={() => create(selected)}>+ Prévoir quelque chose ce jour</button>}
        <div className="mt-2">{orderCalendarItems(selectedEntries).map((item) => <div key={item.key} tabIndex={-1} ref={(node) => { if (node) eventDetails.current.set(item.key, node); else eventDetails.current.delete(item.key); }} className="scroll-mt-4 focus-visible:outline-2 focus-visible:outline-indigo-700">
          <CalendarEventDetails item={item} onAction={onAction} /></div>)}</div>
      </div>
    </dialog>}
  </div>;
}
