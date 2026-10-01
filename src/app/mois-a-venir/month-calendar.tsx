"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import Image from "next/image";
import { X, House, Smartphone, ShieldCheck, Landmark, Layers, BookOpen, PiggyBank, Droplets } from "lucide-react";
import { HistorySemanticIcon } from "@/features/history-v2/semantic-icon";
import type { CalendarEntry, CalendarItem } from "./planned-expenses-projection";
import { calendarDate, calendarDateLabel, calendarDayDescription, calendarDaySummary, calendarEventLabel, calendarExpenseActions,
  calendarIcon, calendarInitialDay, calendarKeyboardDay, calendarMoney, calendarPopoverPosition, calendarStateLabel,
  orderCalendarItems, visibleCalendarItems } from "./calendar-presentation";
import { usePlannedExpenseInteractions, type PlannedExpenseInteraction } from "./planned-expense-interactions";
import { transportPresentation } from "@/domain/phase2/planned-car";

const eventTone = (item: CalendarItem) => item.nature === "DECLARED_REALIZED"
  ? "text-emerald-800" : item.expense?.needsRealityConfirmation
    ? "text-amber-800" : item.nature === "PLANNED_EXPENSE"
      ? "text-sky-800" : "text-slate-700";
const buttonClass = "rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-bold focus-visible:outline-2 focus-visible:outline-indigo-700 disabled:opacity-50";
const disclosureClass = "border-t border-slate-200 pt-3 text-sm [&>summary]:cursor-pointer [&>summary]:font-semibold";
const categoryIcons = { Maison: House, Télécom: Smartphone, Assurances: ShieldCheck, Banque: Landmark,
  Abonnements: Layers, Permis: BookOpen, Épargne: PiggyBank };
const brandWidths: Record<string, number> = { sfr: 28, edf: 28, google: 22, "credit-agricole": 22,
  max: 30, pacifica: 44, nexity: 40, openai: 42 };

function EventIcon({ item, size = 24 }: { item: CalendarItem; size?: number }) {
  const icon = calendarIcon(item);
  const CategoryIcon = !item.expense ? item.calendarLabel === "Eau" ? Droplets : categoryIcons[item.group as keyof typeof categoryIcons] : undefined;
  return <span data-brand-key={icon.brandKey ?? undefined} className="inline-flex shrink-0 items-center justify-center" aria-hidden="true">
    {icon.brandKey ? <Image src={`/brands/${icon.brandKey}.svg`} width={Math.min(40, Math.round((brandWidths[icon.brandKey] ?? 22) * size / 22))} height={size} alt="" />
      : CategoryIcon ? <CategoryIcon size={size} /> : <HistorySemanticIcon iconKey={icon.semanticIconKey} size={size} />}
  </span>;
}

/** Read-model details only. Mutations use the existing builder and server contract. */
export function CalendarEventDetails({ item, onAction, expanded = false }: { item: CalendarItem;
  onAction?: (interaction: PlannedExpenseInteraction) => void; expanded?: boolean }) {
  const expense = item.expense, detail = expense?.detail;
  const [revealed, setRevealed] = useState(expanded);
  const detailId = useId();
  useEffect(() => setRevealed(expanded), [expanded]);
  return <article data-expense-id={expense?.id} className="space-y-2 border-b border-slate-100 py-3 last:border-0">
    <button type="button" aria-expanded={revealed} aria-controls={detailId} onClick={() => setRevealed(!revealed)}
      className="grid w-full cursor-pointer grid-cols-[40px_minmax(0,1fr)_auto] items-center gap-x-2 rounded text-left hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-indigo-700">
      <span className="flex justify-center"><EventIcon item={item} /></span><span className="break-words text-sm font-bold">{calendarEventLabel(item)}</span>
      <strong className="whitespace-nowrap text-sm tabular-nums">{calendarMoney(item.amount)}</strong></button>
    {expense && <p className={`text-xs font-semibold ${eventTone(item)}`}>{calendarStateLabel(item)}</p>}
    <p className="text-xs text-slate-600">{item.dateCertainty === "HISTORICAL_ESTIMATE"
      ? `Date estimée autour du ${item.date ? calendarDate(item.date) : "jour non précisé"}`
      : item.date ? `${calendarDateLabel(item)} · ${calendarDate(item.date)}` : "Ce mois-ci · sans jour précis"}</p>
    {revealed && <div id={detailId} className="space-y-2">
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
        {expense.context.route.liveEstimate && <div className="mt-2 grid gap-1 text-sm">
          {expense.context.route.liveEstimate.journey && (["outbound", "return"] as const).map((direction) => { const leg = expense.context.route!.liveEstimate!.journey![direction]; return <p key={direction}>{direction === "outbound" ? "Aller" : "Retour au domicile"} · {leg.plannedDate && new Date(`${leg.plannedDate}T12:00:00`).toLocaleDateString("fr-FR")}{leg.plannedTime ? ` à ${leg.plannedTime}` : " · heure non précisée"} · {Number(leg.route.distanceKm).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} km · ≈ {Number(leg.route.liters).toLocaleString("fr-FR", { maximumFractionDigits: 2 })} L.</p>; })}
          <p>Essence utilisée : {expense.context.route.liveEstimate.fuelEconomicCost === null ? "prix indisponible" : `≈ ${calendarMoney(expense.context.route.liveEstimate.fuelEconomicCost)}`} · {expense.context.route.liveEstimate.route.provider === "TOMTOM" ? "route TomTom" : "trajet de repli"}.</p><p>Péage : {transportPresentation(expense).toll === null ? "non disponible" : calendarMoney(transportPresentation(expense).toll!)}.</p><p className="text-xs text-slate-500">Estimation conservée au moment de l’enregistrement ; aucun trajet observé ni paiement n’a été créé.</p></div>}
      </details>}
      <details className={disclosureClass}><summary>Détails du coût</summary><ul className="mt-3 space-y-2" aria-label="Éléments du projet">
        {expense.costItems.map((cost) => <li key={cost.id} className="flex justify-between gap-3"><span>{cost.variantLabel || cost.label}</span>
          <span className="shrink-0 tabular-nums">{cost.quantity} × {calendarMoney(cost.unitAmount)}</span></li>)}
      </ul></details>
    </>}
    <div className="border-t border-slate-100 pt-2"><p className="break-words text-xs">{item.fullLabel ?? item.label}</p>
      {item.dateEvidenceCount && item.dateCertainty === "HISTORICAL_ESTIMATE" ? <p className="mt-1 text-xs">Basée sur {item.dateEvidenceCount} prélèvement{item.dateEvidenceCount > 1 ? "s" : ""} observé{item.dateEvidenceCount > 1 ? "s" : ""}. Le jour exact peut varier.</p> : null}
      {item.freshnessDate && <p className="mt-1 text-xs">Dernière référence disponible : {calendarDate(item.freshnessDate)}.</p>}
      {item.provenance && <p className="mt-1 text-xs">{item.provenance === "SNAPSHOT" ? "Issue de la prévision publiée" : "Renseignée pour ce mois"}.</p>}
      {expense && <p className="mt-1 text-xs">Déclaration prospective, sans transaction ni débit de wallet observé.</p>}
    </div></div>}
  </article>;
}

type Filter = "ALL" | "PROJECTS" | "CHARGES";
export function MonthCalendar({ targetMonth, entries, undated, dailyTotals, today = "" }: { targetMonth: string;
  entries: readonly CalendarEntry[]; undated: readonly CalendarItem[]; dailyTotals: Readonly<Record<string, string>>; today?: string }) {
  const [selected, setSelected] = useState<string | null>(null);
  const [focusedKey, setFocusedKey] = useState<string | null>(null);
  const [activeDay, setActiveDay] = useState(() => calendarInitialDay(targetMonth, today, entries));
  const [filter, setFilter] = useState<Filter>("ALL");
  const dayButtons = useRef(new Map<number, HTMLButtonElement>());
  const eventDetails = useRef(new Map<string, HTMLDivElement>());
  const opener = useRef<HTMLButtonElement | null>(null);
  const panel = useRef<HTMLDivElement | null>(null);
  const [panelPosition, setPanelPosition] = useState({ left: 12, top: 12 });
  const interactions = usePlannedExpenseInteractions();
  const [year, month] = targetMonth.split("-").map(Number);
  const firstWeekday = (new Date(Date.UTC(year!, month! - 1, 1)).getUTCDay() + 6) % 7;
  const days = new Date(Date.UTC(year!, month!, 0)).getUTCDate();
  const cellCount = Math.ceil((firstWeekday + days) / 7) * 7;
  const cells = Array.from({ length: cellCount }, (_, index) => index < firstWeekday || index >= firstWeekday + days ? null : index - firstWeekday + 1);
  const weeks = Array.from({ length: cellCount / 7 }, (_, index) => cells.slice(index * 7, index * 7 + 7));
  const monthEntries = entries.filter((item) => item.date.startsWith(`${targetMonth}-`));
  const accepts = (item: CalendarItem) => filter === "ALL" || (filter === "CHARGES" ? !item.expense : !!item.expense);
  const projects = undated.filter((item) => item.expense);
  const monthly = undated.filter((item) => !item.expense);
  const selectedUndated = selected?.startsWith("undated:") ? undated.find((item) => `undated:${item.key}` === selected) : undefined;
  // The local panel shows the whole day, even when the grid is filtered.
  const selectedEntries = selectedUndated ? [selectedUndated] : monthEntries.filter((item) => item.date === selected);
  const selectedTotal = calendarDaySummary(selectedEntries);
  const title = selectedUndated ? "Sans jour précis" : selected ? calendarDate(selected) : "";
  const monthTitle = new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${targetMonth}-01T12:00:00Z`));

  useLayoutEffect(() => {
    if (!selected || !panel.current || !opener.current) return;
    const node = panel.current;
    const reposition = () => {
      const anchor = (focusedKey ? opener.current : opener.current?.closest('[role="gridcell"]') ?? opener.current)?.getBoundingClientRect();
      if (anchor) setPanelPosition(calendarPopoverPosition(anchor,
        { width: window.innerWidth, height: window.innerHeight },
        { width: node.offsetWidth, height: node.offsetHeight }));
    };
    node.showPopover();
    reposition();
    const target = focusedKey ? eventDetails.current.get(focusedKey) : null;
    if (target) { target.focus({ preventScroll: true }); target.scrollIntoView({ block: "nearest" }); }
    else node.querySelector<HTMLButtonElement>("button")?.focus();
    const observer = new ResizeObserver(reposition);
    observer.observe(node);
    window.addEventListener("resize", reposition);
    window.addEventListener("scroll", reposition, true);
    return () => { observer.disconnect(); window.removeEventListener("resize", reposition);
      window.removeEventListener("scroll", reposition, true); node.hidePopover(); };
  }, [selected, focusedKey]);

  const open = (key: string, source: HTMLButtonElement, eventKey: string | null = null) => { opener.current = source; setFocusedKey(eventKey); setSelected(key); };
  const close = () => { setSelected(null); opener.current?.focus({ preventScroll: true }); };
  const onAction = interactions ? (interaction: PlannedExpenseInteraction) => { setSelected(null); interactions.request(interaction); } : undefined;
  const create = (date: string) => onAction?.({ action: "CREATE", plannedDate: date });

  return <div className="min-w-0">
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white [&_button]:text-xs!">
    <header className="flex items-center justify-between gap-3 border-b border-slate-100 px-3 py-1.5"><h3 className="text-sm font-bold capitalize">{monthTitle}</h3>
      <div className="flex gap-0.5" aria-label="Éléments affichés">{([ ["ALL", "Tout"], ["PROJECTS", "Projets"], ["CHARGES", "Charges"] ] as const).map(([value, label]) =>
        <button key={value} type="button" aria-pressed={filter === value} onClick={() => setFilter(value)} className={`rounded-sm px-2 py-0.5 text-xs font-medium focus-visible:outline-2 focus-visible:outline-indigo-700 ${filter === value ? "bg-slate-100 text-slate-800" : "text-slate-500 hover:text-slate-800"}`}>{label}</button>)}</div>
    </header>
    <div role="grid" aria-label={`Calendrier de ${monthTitle}`} aria-colcount={7} aria-rowcount={weeks.length + 1}>
      <div role="row" className="grid grid-cols-7 border-b border-slate-200 text-center text-xs font-semibold text-slate-500">
        {["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"].map((day) => <span role="columnheader" key={day} className="py-2">{day}</span>)}
      </div>
      {weeks.map((week, rowIndex) => {
        const maxEvents = Math.max(...week.map((day) => monthEntries.filter((item) => item.date === `${targetMonth}-${String(day).padStart(2, "0")}` && accepts(item)).length));
        const height = maxEvents > 2 ? "h-[98px]" : maxEvents > 1 ? "h-[82px]" : maxEvents ? "h-[74px]" : "h-[66px]";
        return <div role="row" key={rowIndex} className={`grid grid-cols-7 border-b border-slate-100 last:border-b-0 ${height}`}>
          {week.map((day, columnIndex) => {
            if (day === null) return <div role="gridcell" data-outside-month="true" key={`empty-${columnIndex}`} className="border-r border-slate-100 bg-slate-100/70 opacity-60 last:border-r-0" />;
            const date = `${targetMonth}-${String(day).padStart(2, "0")}`;
            const allDay = monthEntries.filter((item) => item.date === date);
            const dayEntries = allDay.filter(accepts), visible = visibleCalendarItems(dayEntries);
            const summary = calendarDaySummary(dayEntries);
            const isToday = date === today;
            return <div role="gridcell" aria-selected={selected === date} key={date} className={`group relative min-w-0 border-r border-slate-100 px-1.5 last:border-r-0 ${selected === date ? "bg-sky-50 ring-1 ring-inset ring-sky-200" : columnIndex > 4 ? "bg-slate-50/60" : ""}`}
              onClick={(event) => { if (event.target === event.currentTarget && allDay.length) { const source = dayButtons.current.get(day); if (source) open(date, source); } }}
              onKeyDown={(event) => { const next = calendarKeyboardDay(day, event.key, days, firstWeekday);
                if (next !== null) { event.preventDefault(); setActiveDay(next); dayButtons.current.get(next)?.focus(); } }}>
              <button type="button" data-calendar-day={day} ref={(node) => { if (node) dayButtons.current.set(day, node); else dayButtons.current.delete(day); }}
                tabIndex={activeDay === day ? 0 : -1} aria-current={isToday ? "date" : undefined} aria-label={`${isToday ? "Aujourd’hui, " : ""}${calendarDayDescription(date, allDay, dailyTotals[date])}`}
                aria-haspopup={allDay.length ? "dialog" : undefined} aria-expanded={allDay.length ? selected === date : undefined}
                onFocus={() => setActiveDay(day)} onClick={(event) => allDay.length ? open(date, event.currentTarget) : create(date)}
                className={`flex w-full items-start justify-between pt-1 text-left text-xs tabular-nums focus-visible:outline-2 focus-visible:outline-indigo-700 ${allDay.length ? "h-7" : "absolute inset-0 px-1.5"}`}>
                <span className={`flex size-5 items-center justify-center ${isToday ? "rounded-full bg-indigo-700 font-bold text-white" : "text-slate-500"}`}>{day}</span>
                {dayEntries.length > 1 && <span data-calendar-day-total={date} className="pt-0.5 font-medium text-slate-500">{calendarMoney(summary.grossTotal)}</span>}
                {!allDay.length && <span className="absolute inset-x-0 top-9 text-center text-xs font-medium text-sky-700 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100">+ Prévoir</span>}
              </button>
              <div className="grid grid-cols-[40px_minmax(0,1fr)_max-content] gap-x-1.5">
              {visible.map((item) => <button key={item.key} type="button" tabIndex={-1} data-calendar-event={item.key}
                title={`${calendarEventLabel(item)} · ${calendarMoney(item.amount)}`}
                aria-label={`${calendarEventLabel(item)}, ${calendarMoney(item.amount)}, ${calendarStateLabel(item)}`}
                aria-haspopup="dialog" aria-expanded={selected === date && focusedKey === item.key}
                onClick={(event) => open(date, event.currentTarget, item.key)} className={`col-span-3 mb-0.5 grid h-6 w-full min-w-0 grid-cols-subgrid cursor-pointer items-center gap-x-1.5 rounded text-left text-xs hover:bg-slate-100 focus-visible:bg-slate-100 focus-visible:outline-2 focus-visible:outline-indigo-700 ${eventTone(item)}`}>
                <span className="relative flex w-10 items-center justify-center"><span aria-hidden="true" data-calendar-state={item.nature} className="absolute -left-1.5 w-2 text-center text-xs">
                  {item.expense?.needsRealityConfirmation ? "!" : item.nature === "DECLARED_REALIZED" ? "✓" : item.nature === "PLANNED_EXPENSE" ? "●" : ""}</span><EventIcon item={item} /></span>
                <span className="min-w-0 truncate">{calendarEventLabel(item)}</span>
                <strong className="shrink-0 whitespace-nowrap font-semibold tabular-nums">{calendarMoney(item.amount)}</strong>
              </button>)}</div>
              {dayEntries.length > visible.length && <button type="button" tabIndex={-1} aria-haspopup="dialog" onClick={(event) => open(date, event.currentTarget)} className="cursor-pointer rounded px-1 text-xs font-medium text-slate-500 hover:bg-slate-100 hover:text-indigo-700 focus-visible:bg-slate-100 focus-visible:outline-2 focus-visible:outline-indigo-700">+{dayEntries.length - visible.length} {dayEntries.length - visible.length > 1 ? "autres" : "autre"} <span aria-hidden="true">→</span></button>}
            </div>;
          })}
        </div>;
      })}
    </div></div>
    {projects.length > 0 && <section className="mt-3" aria-label="À placer dans le calendrier"><h3 className="text-xs font-semibold text-slate-600">À placer dans le calendrier</h3>
      <ul className="mt-1 divide-y divide-slate-100">{orderCalendarItems(projects).map((item) => <li key={item.key}><button type="button" className="flex w-full items-center gap-2 py-2 text-left text-sm focus-visible:outline-2 focus-visible:outline-indigo-700" aria-haspopup="dialog" onClick={(event) => open(`undated:${item.key}`, event.currentTarget, item.key)}>
        <EventIcon item={item} /><span className="min-w-0 flex-1">{item.calendarLabel ?? item.label} <span className="text-xs text-slate-500">· {calendarStateLabel(item)}</span></span><strong className="tabular-nums">{calendarMoney(item.amount)}</strong></button></li>)}</ul>
    </section>}
    {monthly.length > 0 && <UndatedMonthlyItems items={monthly} />}
    {selected && <div ref={panel} popover="auto" role="dialog" aria-modal="false" aria-labelledby="calendar-panel-title" aria-describedby="calendar-panel-summary"
      style={{ left: panelPosition.left, top: panelPosition.top }}
      className="fixed m-0 w-[380px] max-w-[calc(100vw-24px)] max-h-[min(440px,calc(100dvh-24px))] overflow-y-auto rounded-xl border border-slate-200 bg-white p-3 text-slate-900 shadow-xl"
      onToggle={(event) => { if (event.newState === "closed" && panel.current === event.currentTarget && !event.currentTarget.matches(":popover-open")) close(); }}
      onKeyDown={(event) => { if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); close(); } }}>
      <header className="flex items-start justify-between gap-3"><div>
        <h2 id="calendar-panel-title" className="text-base font-bold capitalize">{title}</h2>
        <p id="calendar-panel-summary" className="mt-0.5 text-xs text-slate-600">{selectedEntries.length} élément{selectedEntries.length > 1 ? "s" : ""} · <strong>{calendarMoney(selectedTotal.grossTotal)}</strong></p>
      </div><button type="button" className="rounded p-1 text-slate-500 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-indigo-700" aria-label="Fermer les détails du jour" onClick={close}><X size={16} aria-hidden="true" /></button></header>
      <div className="mt-1">{orderCalendarItems(selectedEntries).map((item) => <div key={item.key} tabIndex={-1} ref={(node) => { if (node) eventDetails.current.set(item.key, node); else eventDetails.current.delete(item.key); }}
        className={`scroll-mt-2 focus-visible:outline-2 focus-visible:outline-indigo-700 ${focusedKey === item.key ? "rounded bg-slate-50 px-2" : ""}`}>
        <CalendarEventDetails item={item} onAction={onAction} expanded={focusedKey === item.key} /></div>)}</div>
      {!selectedUndated && selectedTotal.estimatedCount > 0 && selectedTotal.exactCount > 0 && <details className="mt-2 text-xs text-slate-500"><summary className="cursor-pointer focus-visible:outline-2 focus-visible:outline-indigo-700">Détail du total</summary>
        <p className="mt-1">À date précise : {calendarMoney(selectedTotal.exactDateTotal)} · À date estimée : {calendarMoney(selectedTotal.estimatedDateTotal)}</p></details>}
      {!selectedUndated && interactions && <button type="button" className="mt-2 w-full border-t border-slate-100 pt-2 text-left text-xs font-semibold text-sky-800 focus-visible:outline-2 focus-visible:outline-indigo-700" onClick={() => create(selected)}>+ Prévoir ce jour</button>}
    </div>}
  </div>;
}

function UndatedMonthlyItems({ items }: { items: readonly CalendarItem[] }) {
  const title = `Sans jour précis (${items.length})`;
  const rows = <ul className="mt-1 divide-y divide-slate-100">{items.map((item) => <li key={item.key} className="grid grid-cols-[40px_minmax(0,1fr)_auto] items-center gap-2 py-1 text-xs text-slate-600" title={item.fullLabel ?? item.label}>
    <span className="flex justify-center"><EventIcon item={item} /></span><span>{item.calendarLabel ?? item.label}{item.kind === "SAVINGS" && <span className="block text-slate-500">Objectif du mois</span>}</span>
    <strong className="whitespace-nowrap tabular-nums">{calendarMoney(item.amount)}</strong></li>)}</ul>;
  return <section className="mt-2" aria-label="Sans jour précis">{items.length > 1 ? <details><summary className="cursor-pointer text-xs font-semibold text-slate-600 focus-visible:outline-2 focus-visible:outline-indigo-700">{title}</summary>{rows}</details>
    : <><h3 className="text-xs font-semibold text-slate-600">{title}</h3>{rows}</>}</section>;
}
