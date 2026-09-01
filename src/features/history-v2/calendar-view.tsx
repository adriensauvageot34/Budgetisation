"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowLeft, CalendarDays } from "lucide-react";
import type {
  CalendarItemSummary,
  DayHoverReadModel,
  MonthCalendarDayReadModel,
  MonthCalendarReadModel,
  QueryTargetRef,
  RibbonOverflowReadModel,
  RibbonSegmentReadModel,
  WeekDayReadModel,
  WeekReadModel,
} from "@/query-api";
import { queryResourceKeys } from "@/query-api";
import type { LocalDate } from "@/core/time";
import { addDays, parseLocalDate, yearMonthOf, type YearMonth } from "@/core/time";
import { CollectionState, DisplayState, MetricState, MoneyMetric } from "./renderers";
import { HistorySemanticIcon } from "./semantic-icon";
import { historyTransientDismissEvent, type HistoryOverlayTarget } from "./types";
import styles from "./history-v2.module.css";

const weekdayLabels = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"] as const;

function dayLabel(date: LocalDate, long = false): string {
  return new Intl.DateTimeFormat("fr-FR", long
    ? { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }
    : { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${date}T00:00:00Z`));
}

export function CalendarMonthView({
  model,
  onOverlay,
  onWeek,
}: {
  readonly model: MonthCalendarReadModel;
  readonly onOverlay: (target: HistoryOverlayTarget) => void;
  readonly onWeek: (weekStart: LocalDate) => void;
}) {
  return (
    <section className={styles.calendarSurface} aria-label="Calendrier mensuel">
      <div className={styles.weekdayHeader}>{weekdayLabels.map((label) => <div key={label}>{label}</div>)}</div>
      {model.weeks.map((week) => {
        const segments = model.ribbonSegments.status === "KNOWN" || model.ribbonSegments.status === "PARTIAL"
          ? model.ribbonSegments.items.filter((segment) => segment.weekStart === week.weekStart)
          : [];
        const overflow = model.ribbonOverflow.status === "KNOWN" || model.ribbonOverflow.status === "PARTIAL"
          ? model.ribbonOverflow.items.find((item) => item.weekStart === week.weekStart)
          : undefined;
        return (
          <div key={week.weekStart} className={styles.calendarWeek}>
            <button type="button" className={styles.weekLink} onClick={() => onWeek(week.weekStart)} aria-label={`Ouvrir la semaine du ${dayLabel(week.weekStart)}`}><CalendarDays aria-hidden size={14} /></button>
            <RibbonRail segments={segments} overflow={overflow} onTarget={(target) => onOverlay(overlayTarget(target))} />
            <div className={styles.calendarGridRow}>{week.dayDates.map((date) => <CalendarDayCell key={date} day={model.daysByDate[date]!} onOpen={() => onOverlay({ kind: "journal", date })} />)}</div>
          </div>
        );
      })}
    </section>
  );
}

export function WeekView({
  model,
  onOverlay,
  onMonth,
  onWeek,
}: {
  readonly model: WeekReadModel;
  readonly onOverlay: (target: HistoryOverlayTarget) => void;
  readonly onMonth: () => void;
  readonly onWeek: (weekStart: LocalDate, referenceMonth: YearMonth) => void;
}) {
  return (
    <section className={styles.weekSurface} aria-label={`Semaine du ${dayLabel(model.weekStart)}`}>
      <div className={styles.weekToolbar}><button type="button" className="button-secondary" onClick={onMonth}><ArrowLeft aria-hidden size={16} /> Retour au mois</button><div><button type="button" className="button-secondary" onClick={() => { const next = addDays(model.weekStart, -7); onWeek(next, yearMonthOf(addDays(next, 3))); }}>Semaine précédente</button><strong>{dayLabel(model.weekStart, true)} – {dayLabel(model.weekEnd, true)}</strong><button type="button" className="button-secondary" onClick={() => { const next = addDays(model.weekStart, 7); onWeek(next, yearMonthOf(addDays(next, 3))); }}>Semaine suivante</button></div></div>
      <RibbonRail segments={model.ribbonSegments.status === "KNOWN" || model.ribbonSegments.status === "PARTIAL" ? model.ribbonSegments.items : []} overflow={model.ribbonOverflow.status === "KNOWN" || model.ribbonOverflow.status === "PARTIAL" ? model.ribbonOverflow.items[0] : undefined} onTarget={(target) => onOverlay(overlayTarget(target))} />
      <div className={styles.weekGrid}>{model.days.map((day, index) => <WeekDay key={day.date} day={day} weekday={weekdayLabels[index]!} onOpen={() => onOverlay({ kind: "journal", date: day.date })} />)}</div>
    </section>
  );
}

function overlayTarget(target: QueryTargetRef): HistoryOverlayTarget {
  if (target.resource !== queryResourceKeys.historyDayJournal || target.params.date === undefined) {
    throw new TypeError("La cible Ribbon publiée doit viser history_day_journal.");
  }
  return { kind: "journal", date: parseLocalDate(target.params.date) };
}

function RibbonRail({ segments, overflow, onTarget }: { readonly segments: readonly RibbonSegmentReadModel[]; readonly overflow?: RibbonOverflowReadModel; readonly onTarget: (target: QueryTargetRef) => void }) {
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const dismiss = () => setOpen(false);
    window.addEventListener(historyTransientDismissEvent, dismiss);
    return () => window.removeEventListener(historyTransientDismissEvent, dismiss);
  }, []);
  const closeAndRestoreFocus = () => {
    setOpen(false);
    triggerRef.current?.focus();
  };
  return (
    <div ref={containerRef} className={styles.ribbonRail} aria-label="Événements continus" onBlur={(event) => {
      if (!(event.relatedTarget instanceof Node) || !containerRef.current?.contains(event.relatedTarget)) setOpen(false);
    }} onKeyDown={(event) => {
      if (event.key === "Escape" && open) {
        event.preventDefault();
        closeAndRestoreFocus();
      }
    }}>
      {segments.map((segment) => <div key={`${segment.calendarItemId}-${segment.weekStart}`} className={styles.ribbon} style={{ gridColumn: `${segment.startColumn + 1} / ${segment.endColumn + 2}`, gridRow: segment.lane }} title={segment.title}><HistorySemanticIcon iconKey={segment.iconKey} /> <span>{segment.title}</span></div>)}
      {overflow !== undefined && overflow.count > 0 ? <div className={styles.ribbonOverflowAnchor} style={{ gridRow: 4 }}><button ref={triggerRef} type="button" className={styles.ribbonOverflow} aria-label={`${overflow.count} groupes continus supplémentaires`} aria-expanded={open} aria-controls={menuId} onClick={() => { if (open) setOpen(false); else { window.dispatchEvent(new Event(historyTransientDismissEvent)); setOpen(true); } }}>+{overflow.count}</button>{open ? <div id={menuId} className={styles.ribbonOverflowMenu} role="menu" aria-label="Événements continus supplémentaires">{overflow.items.map((item) => <button key={item.calendarItemId} type="button" role="menuitem" onClick={() => { setOpen(false); onTarget(item.targetRef); }}><HistorySemanticIcon iconKey={item.iconKey} /><span><strong>{item.title}</strong><small>{item.segmentStart} → {item.segmentEnd}</small></span></button>)}</div> : null}</div> : null}
    </div>
  );
}

function WeekDay({ day, weekday, onOpen }: { readonly day: WeekDayReadModel; readonly weekday: string; readonly onOpen: () => void }) {
  const [hoverOpen, setHoverOpen] = useState(false);
  const enterTimer = useRef<number | undefined>(undefined);
  const exitTimer = useRef<number | undefined>(undefined);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const pointerEnter = () => { window.clearTimeout(exitTimer.current); enterTimer.current = window.setTimeout(() => { window.dispatchEvent(new Event(historyTransientDismissEvent)); setHoverOpen(true); }, 300); };
  const pointerLeave = () => { window.clearTimeout(enterTimer.current); exitTimer.current = window.setTimeout(() => setHoverOpen(false), 125); };
  useEffect(() => () => { window.clearTimeout(enterTimer.current); window.clearTimeout(exitTimer.current); }, []);
  useEffect(() => { const dismiss = () => setHoverOpen(false); window.addEventListener(historyTransientDismissEvent, dismiss); return () => window.removeEventListener(historyTransientDismissEvent, dismiss); }, []);
  return (
    <article className={styles.weekDay} data-outside={!day.inReferenceMonth || undefined} data-hover-open={hoverOpen || undefined} onMouseEnter={pointerEnter} onMouseLeave={pointerLeave}>
      <button ref={buttonRef} type="button" className={styles.dayButton} onClick={onOpen} onFocus={() => { window.dispatchEvent(new Event(historyTransientDismissEvent)); setHoverOpen(true); }} onBlur={pointerLeave}>
        <span className={styles.weekDayName}>{weekday}</span><strong>{dayLabel(day.date)}</strong>
        <DisplayState node={day.economicAmount}>{(metric) => <MoneyMetric metric={metric} />}</DisplayState>
      </button>
      <ContextRow contexts={day.personContexts} />
      <MarkerList items={day.visibleMarkers} hidden={day.hiddenMarkerCount} />
      <DisplayState node={day.hover}>{(hover) => <DayHoverPopover anchor={buttonRef.current} open={hoverOpen} hover={hover} onEnter={() => window.clearTimeout(exitTimer.current)} onLeave={pointerLeave} onOpenJournal={onOpen} />}</DisplayState>
    </article>
  );
}

function CalendarDayCell({ day, onOpen }: { readonly day: MonthCalendarDayReadModel; readonly onOpen: () => void }) {
  const [hoverOpen, setHoverOpen] = useState(false);
  const enterTimer = useRef<number | undefined>(undefined);
  const exitTimer = useRef<number | undefined>(undefined);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const cancel = () => { window.clearTimeout(enterTimer.current); window.clearTimeout(exitTimer.current); };
  useEffect(() => cancel, []);
  useEffect(() => { const dismiss = () => setHoverOpen(false); window.addEventListener(historyTransientDismissEvent, dismiss); return () => window.removeEventListener(historyTransientDismissEvent, dismiss); }, []);
  const pointerEnter = () => { window.clearTimeout(exitTimer.current); enterTimer.current = window.setTimeout(() => { window.dispatchEvent(new Event(historyTransientDismissEvent)); setHoverOpen(true); }, 300); };
  const pointerLeave = () => { window.clearTimeout(enterTimer.current); exitTimer.current = window.setTimeout(() => setHoverOpen(false), 125); };
  return (
    <article className={styles.dayCell} data-outside={!day.inSelectedMonth || undefined} data-hover-open={hoverOpen || undefined} onMouseEnter={pointerEnter} onMouseLeave={pointerLeave}>
      <button ref={buttonRef} type="button" className={styles.dayButton} aria-label={`Journal du ${dayLabel(day.date, true)}`} onFocus={() => { window.dispatchEvent(new Event(historyTransientDismissEvent)); setHoverOpen(true); }} onBlur={(event) => { if (!(event.relatedTarget instanceof Node) || !event.currentTarget.parentElement?.contains(event.relatedTarget)) pointerLeave(); }} onClick={onOpen}>
        <span className={styles.dayHeading}><strong>{dayLabel(day.date)}</strong><DisplayState node={day.economicAmount}>{(metric) => <MoneyMetric metric={metric} />}</DisplayState></span>
      </button>
      <ContextRow contexts={day.personContexts} />
      <MarkerList items={day.visibleMarkers} hidden={day.hiddenMarkerCount} />
      <DisplayState node={day.hover}>{(hover) => <DayHoverPopover anchor={buttonRef.current} open={hoverOpen} hover={hover} onEnter={() => window.clearTimeout(exitTimer.current)} onLeave={pointerLeave} onOpenJournal={onOpen} />}</DisplayState>
    </article>
  );
}

function ContextRow({ contexts }: { readonly contexts: MonthCalendarDayReadModel["personContexts"] }) {
  const visible = Object.values(contexts).flatMap((node) => node.visibility === "VISIBLE" ? [node.data] : []);
  return visible.length === 0 ? null : <div className={styles.contextRow} aria-label="Contextes personnels">{visible.map((context) => <span key={`${context.personId}-${context.contextTypeKey}`} title={context.label}>{context.displayInitial}</span>)}</div>;
}

function MarkerList({ items, hidden }: { readonly items: readonly CalendarItemSummary[]; readonly hidden: MonthCalendarDayReadModel["hiddenMarkerCount"] }) {
  return <div className={styles.markerList}>{items.map((item) => <div key={item.calendarItemId} data-tier={item.markerTier}><HistorySemanticIcon iconKey={item.iconKey} /><span>{item.title}</span></div>)}{(hidden.status === "KNOWN" || hidden.status === "PARTIAL") && hidden.value > 0 ? <button type="button" aria-label={`${hidden.value} groupes supplémentaires`}>+{hidden.value}</button> : null}</div>;
}

function DayHoverPopover({ anchor, open, hover, onEnter, onLeave, onOpenJournal }: { readonly anchor: HTMLElement | null; readonly open: boolean; readonly hover: DayHoverReadModel; readonly onEnter: () => void; readonly onLeave: () => void; readonly onOpenJournal: () => void }) {
  if (!open || anchor === null || typeof document === "undefined") return null;
  const rect = anchor.getBoundingClientRect();
  const width = 360;
  const left = Math.max(16, Math.min(window.innerWidth - width - 16, rect.left + rect.width / 2 - width / 2));
  const below = rect.bottom + 12 + 320 < window.innerHeight;
  const style = below ? { left, top: rect.bottom + 10 } : { left, bottom: window.innerHeight - rect.top + 10 };
  return <>{createPortal(<div className={styles.hoverScrim} aria-hidden />, document.body)}{createPortal(
    <section className={styles.dayHover} style={style} role="dialog" aria-label={`Aperçu du ${dayLabel(hover.date, true)}`} onMouseEnter={onEnter} onMouseLeave={onLeave}>
      <div className={styles.dayHoverHeader}><strong>{dayLabel(hover.date, true)}</strong><DisplayState node={hover.economicAmount}>{(metric) => <MoneyMetric metric={metric} />}</DisplayState></div>
      <DisplayState node={hover.calendarEvents}>{(collection) => <CollectionState collection={collection}>{(items) => <ul>{items.slice(0, 3).map((item) => <li key={item.calendarItemId} className={styles.semanticListItem}><HistorySemanticIcon iconKey={item.iconKey} /><span>{item.title}</span></li>)}</ul>}</CollectionState>}</DisplayState>
      <DisplayState node={hover.activeRibbons}>{(collection) => <CollectionState collection={collection}>{(items) => <ul>{items.map((item) => <li key={item.calendarItemId} className={styles.semanticListItem}><HistorySemanticIcon iconKey={item.iconKey} /><span>{item.title}</span></li>)}</ul>}</CollectionState>}</DisplayState>
      <DisplayState node={hover.contexts}>{(collection) => <CollectionState collection={collection}>{(items) => <div className={styles.participants}>{items.map((context) => <span key={`${context.personId}-${context.contextTypeKey}`}>{context.label}</span>)}</div>}</CollectionState>}</DisplayState>
      <DisplayState node={hover.economicExpenses}>{(collection) => <CollectionState collection={collection}>{(items) => <ul>{items.slice(0, 3).map((expense) => <li key={expense.expenseEventId}><span>{expense.label}</span><strong>{formatMoneyValue(expense.amount)}</strong></li>)}</ul>}</CollectionState>}</DisplayState>
      {(hover.hiddenExpenseCount.status === "KNOWN" || hover.hiddenExpenseCount.status === "PARTIAL") && hover.hiddenExpenseCount.value > 0 ? <p>+{hover.hiddenExpenseCount.value} dépenses</p> : null}
      <button type="button" className="button-primary" onClick={onOpenJournal}>Ouvrir le journal</button>
    </section>,
    document.body,
  )}</>;
}

function formatMoneyValue(value: import("@/core/money").Money): string {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(Number(value));
}
