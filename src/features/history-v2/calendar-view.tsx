"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowLeft, CalendarDays } from "lucide-react";
import { calendarFilterTags, type DisplayNode, type MetricValue } from "@/core/history-v2";
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
import type { LocalDate } from "@/core/time";
import { addDays, yearMonthOf, type YearMonth } from "@/core/time";
import type { Money } from "@/core/money";
import { CollectionState, DisplayState, MetricState, MoneyMetric, PartialDataNote } from "./renderers";
import { expenseDisplayTitle, formatCalendarDay, formatFrenchDate, formatFrenchDateRange } from "./presentation";
import { HistorySemanticIcon } from "./semantic-icon";
import { projectFilteredMarkers } from "./marker-projection";
import { overlayTargetFromQueryTarget } from "./route-state";
import { historyTransientDismissEvent, type HistoryCalendarFilterState, type HistoryOverlayTarget } from "./types";
import styles from "./history-v2.module.css";

const weekdayLabels = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"] as const;

function accessibleDayLabel(date: LocalDate): string {
  return new Intl.DateTimeFormat("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${date}T00:00:00Z`));
}

export function CalendarMonthView({
  model,
  filters,
  onOverlay,
  onWeek,
}: {
  readonly model: MonthCalendarReadModel;
  readonly filters: HistoryCalendarFilterState;
  readonly onOverlay: (target: HistoryOverlayTarget) => void;
  readonly onWeek: (weekStart: LocalDate) => void;
}) {
  return (
    <section className={styles.calendarSurface} aria-label="Calendrier mensuel">
      <UnassignedTiming model={model} filters={filters} />
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
            <button type="button" className={styles.weekLink} onClick={() => onWeek(week.weekStart)} aria-label={`Ouvrir la semaine du ${formatFrenchDate(week.weekStart)}`}><CalendarDays aria-hidden size={14} /></button>
            <RibbonRail segments={segments} overflow={overflow} onTarget={(target) => { const overlay = overlayTargetFromQueryTarget(target); if (overlay !== undefined) onOverlay(overlay); }} />
            <div className={styles.calendarGridRow}>{week.dayDates.map((date) => <CalendarDayCell key={date} day={model.daysByDate[date]!} filters={filters} onOpen={() => onOverlay({ kind: "journal", date })} onOverlay={onOverlay} />)}</div>
          </div>
        );
      })}
    </section>
  );
}

export function WeekView({
  model,
  filters,
  onOverlay,
  onMonth,
  onWeek,
}: {
  readonly model: WeekReadModel;
  readonly filters: HistoryCalendarFilterState;
  readonly onOverlay: (target: HistoryOverlayTarget) => void;
  readonly onMonth: () => void;
  readonly onWeek: (weekStart: LocalDate, referenceMonth: YearMonth) => void;
}) {
  return (
    <section className={styles.weekSurface} aria-label={`Semaine du ${formatFrenchDate(model.weekStart)}`}>
      <div className={styles.weekToolbar}><button type="button" className="button-secondary" onClick={onMonth}><ArrowLeft aria-hidden size={16} /> Retour au mois</button><div><button type="button" className="button-secondary" onClick={() => { const next = addDays(model.weekStart, -7); onWeek(next, yearMonthOf(addDays(next, 3))); }}>Semaine précédente</button><strong>{formatFrenchDateRange(model.weekStart, model.weekEnd)}</strong><button type="button" className="button-secondary" onClick={() => { const next = addDays(model.weekStart, 7); onWeek(next, yearMonthOf(addDays(next, 3))); }}>Semaine suivante</button></div></div>
      <RibbonRail segments={model.ribbonSegments.status === "KNOWN" || model.ribbonSegments.status === "PARTIAL" ? model.ribbonSegments.items : []} overflow={model.ribbonOverflow.status === "KNOWN" || model.ribbonOverflow.status === "PARTIAL" ? model.ribbonOverflow.items[0] : undefined} onTarget={(target) => { const overlay = overlayTargetFromQueryTarget(target); if (overlay !== undefined) onOverlay(overlay); }} />
      <div className={styles.weekGrid}>{model.days.map((day, index) => <WeekDay key={day.date} day={day} weekday={weekdayLabels[index]!} filters={filters} onOpen={() => onOverlay({ kind: "journal", date: day.date })} onOverlay={onOverlay} />)}</div>
    </section>
  );
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
      {segments.map((segment) => "targetRef" in segment && segment.targetRef !== undefined
        ? <button type="button" key={`${segment.calendarItemId}-${segment.weekStart}`} className={styles.ribbon} style={{ gridColumn: `${segment.startColumn + 1} / ${segment.endColumn + 2}`, gridRow: segment.lane }} title={`${segment.title} · ${formatFrenchDateRange(segment.eventStartDate, segment.eventEndDate)}`} aria-label={`Ouvrir ${segment.title}`} onClick={() => onTarget(segment.targetRef)}><HistorySemanticIcon iconKey={segment.iconKey} /> <span>{segment.title}</span></button>
        : <div key={`${segment.calendarItemId}-${segment.weekStart}`} className={styles.ribbon} style={{ gridColumn: `${segment.startColumn + 1} / ${segment.endColumn + 2}`, gridRow: segment.lane }} title={segment.title} aria-label={segment.title}><HistorySemanticIcon iconKey={segment.iconKey} /> <span>{segment.title}</span></div>)}
      {overflow !== undefined && overflow.count > 0 ? <div className={styles.ribbonOverflowAnchor} style={{ gridRow: 4 }}><button ref={triggerRef} type="button" className={styles.ribbonOverflow} aria-label={`${overflow.count} groupes continus supplémentaires`} aria-expanded={open} aria-controls={menuId} onClick={() => { if (open) setOpen(false); else { window.dispatchEvent(new Event(historyTransientDismissEvent)); setOpen(true); } }}>+{overflow.count}</button>{open ? <div id={menuId} className={styles.ribbonOverflowMenu} role="menu" aria-label="Événements continus supplémentaires">{overflow.items.map((item) => <button key={item.calendarItemId} type="button" role="menuitem" onClick={() => { setOpen(false); onTarget(item.targetRef); }} title={item.title}><HistorySemanticIcon iconKey={item.iconKey} /><span><strong>{item.title}</strong><small>{formatFrenchDateRange(item.segmentStart, item.segmentEnd)}</small></span></button>)}</div> : null}</div> : null}
    </div>
  );
}

function WeekDay({ day, weekday, filters, onOpen, onOverlay }: { readonly day: WeekDayReadModel; readonly weekday: string; readonly filters: HistoryCalendarFilterState; readonly onOpen: () => void; readonly onOverlay: (target: HistoryOverlayTarget) => void }) {
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
        <span className={styles.weekDayName}>{weekday}</span><strong>{formatCalendarDay(day.date, true)}</strong>
        <DisplayState node={amountNode(day, filters)}>{(metric) => <MoneyMetric metric={metric} />}</DisplayState>
      </button>
      <ContextRow contexts={day.personContexts} />
      <FilteredMarkerList day={day} limit={6} filters={filters} onOverlay={onOverlay} />
      <DisplayState node={day.hover}>{(hover) => <DayHoverPopover anchor={buttonRef.current} open={hoverOpen} hover={hover} filters={filters} onEnter={() => window.clearTimeout(exitTimer.current)} onLeave={pointerLeave} onOpenJournal={onOpen} />}</DisplayState>
    </article>
  );
}

function CalendarDayCell({ day, filters, onOpen, onOverlay }: { readonly day: MonthCalendarDayReadModel; readonly filters: HistoryCalendarFilterState; readonly onOpen: () => void; readonly onOverlay: (target: HistoryOverlayTarget) => void }) {
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
      <button ref={buttonRef} type="button" className={styles.dayButton} aria-label={`Journal du ${accessibleDayLabel(day.date)}`} onFocus={() => { window.dispatchEvent(new Event(historyTransientDismissEvent)); setHoverOpen(true); }} onBlur={(event) => { if (!(event.relatedTarget instanceof Node) || !event.currentTarget.parentElement?.contains(event.relatedTarget)) pointerLeave(); }} onClick={onOpen}>
        <span className={styles.dayHeading}><strong>{formatCalendarDay(day.date, !day.inSelectedMonth)}</strong><DisplayState node={amountNode(day, filters)}>{(metric) => <MoneyMetric metric={metric} partialDisplay="value-only" />}</DisplayState></span>
      </button>
      <ContextRow contexts={day.personContexts} />
      <FilteredMarkerList day={day} limit={6} filters={filters} onOverlay={onOverlay} />
      <DisplayState node={day.hover}>{(hover) => <DayHoverPopover anchor={buttonRef.current} open={hoverOpen} hover={hover} filters={filters} onEnter={() => window.clearTimeout(exitTimer.current)} onLeave={pointerLeave} onOpenJournal={onOpen} />}</DisplayState>
    </article>
  );
}

function ContextRow({ contexts }: { readonly contexts: MonthCalendarDayReadModel["personContexts"] }) {
  const visible = Object.values(contexts).flatMap((node) => node.visibility === "VISIBLE" ? [node.data] : []);
  return visible.length === 0 ? null : <div className={styles.contextRow} aria-label="Contextes personnels">{visible.map((context) => <span key={`${context.personId}-${context.contextTypeKey}`} title={context.label}>{context.displayInitial}</span>)}</div>;
}

function FilteredMarkerList({ day, limit, filters, onOverlay }: { readonly day: MonthCalendarDayReadModel | WeekDayReadModel; readonly limit: 6; readonly filters: HistoryCalendarFilterState; readonly onOverlay: (target: HistoryOverlayTarget) => void }) {
  const projection = projectFilteredMarkers(day.orderedMarkerGroups, filters, limit);
  return <MarkerList items={projection.items} hidden={projection.hidden} onOverlay={onOverlay} />;
}

function MarkerList({ items, hidden, onOverlay }: { readonly items: readonly CalendarItemSummary[]; readonly hidden: MetricValue<number>; readonly onOverlay: (target: HistoryOverlayTarget) => void }) {
  return <div className={styles.markerList}>{items.map((item) => {
    const target = "targetRef" in item && item.targetRef !== undefined ? overlayTargetFromQueryTarget(item.targetRef) : undefined;
    const content = <><HistorySemanticIcon iconKey={item.iconKey} /><span>{item.title}</span></>;
    return target === undefined
      ? <div key={item.calendarItemId} data-tier={item.markerTier} title={item.title}>{content}</div>
      : <button type="button" key={item.calendarItemId} data-tier={item.markerTier} title={item.title} onClick={() => onOverlay(target)}>{content}</button>;
  })}{(hidden.status === "KNOWN" || hidden.status === "PARTIAL") && hidden.value > 0 ? <span className={styles.markerOverflow} aria-label={`${hidden.value} groupes supplémentaires${hidden.status === "PARTIAL" ? " observés, données partielles" : ""}`}>+{hidden.value}{hidden.status === "PARTIAL" ? " observés" : ""}</span> : null}</div>;
}

function amountNode(day: Pick<MonthCalendarDayReadModel, "economicAmount" | "economicAmountExcludingFixed">, filters: HistoryCalendarFilterState): DisplayNode<MetricValue<Money>> {
  if (filters.amount === "ALL") return day.economicAmount;
  return "economicAmountExcludingFixed" in day && day.economicAmountExcludingFixed !== undefined
    ? day.economicAmountExcludingFixed
    : { visibility: "PLACEHOLDER", reasonCode: "PUBLICATION_CONTRACT_MISMATCH" };
}

function hoverAmountNode(hover: DayHoverReadModel, filters: HistoryCalendarFilterState): DisplayNode<MetricValue<Money>> {
  if (filters.amount === "ALL") return hover.economicAmount;
  return "economicAmountExcludingFixed" in hover && hover.economicAmountExcludingFixed !== undefined
    ? hover.economicAmountExcludingFixed
    : { visibility: "PLACEHOLDER", reasonCode: "PUBLICATION_CONTRACT_MISMATCH" };
}

function UnassignedTiming({ model, filters }: { readonly model: MonthCalendarReadModel; readonly filters: HistoryCalendarFilterState }) {
  if (!filters.tags.includes("UNASSIGNED_TIMING") || !("unassignedTiming" in model) || model.unassignedTiming === undefined) return null;
  return <DisplayState node={model.unassignedTiming}>{(summary) => {
    if ((summary.count.status !== "KNOWN" && summary.count.status !== "PARTIAL") || summary.count.value === 0) return null;
    return <aside className={styles.unassignedTiming} aria-label="Dépenses sans date précise"><strong>Date précise inconnue</strong><span>{summary.count.value} dépense{summary.count.value > 1 ? "s" : ""}</span><DisplayState node={summary.amount}>{(metric) => <MoneyMetric metric={metric} partialDisplay="value-only" />}</DisplayState></aside>;
  }}</DisplayState>;
}

function DayHoverPopover({ anchor, open, hover, filters, onEnter, onLeave, onOpenJournal }: { readonly anchor: HTMLElement | null; readonly open: boolean; readonly hover: DayHoverReadModel; readonly filters: HistoryCalendarFilterState; readonly onEnter: () => void; readonly onLeave: () => void; readonly onOpenJournal: () => void }) {
  if (!open || anchor === null || typeof document === "undefined") return null;
  const rect = anchor.getBoundingClientRect();
  const width = 360;
  const left = Math.max(16, Math.min(window.innerWidth - width - 16, rect.left + rect.width / 2 - width / 2));
  const below = rect.bottom + 12 + 320 < window.innerHeight;
  const style = below ? { left, top: rect.bottom + 10 } : { left, bottom: window.innerHeight - rect.top + 10 };
  return <>{createPortal(<div className={styles.hoverScrim} aria-hidden />, document.body)}{createPortal(
    <section className={styles.dayHover} style={style} role="dialog" aria-label={`Aperçu du ${accessibleDayLabel(hover.date)}`} onMouseEnter={onEnter} onMouseLeave={onLeave}>
      <div className={styles.dayHoverHeader}><strong>{formatFrenchDate(hover.date)}</strong><DisplayState node={hoverAmountNode(hover, filters)}>{(metric) => <MoneyMetric metric={metric} partialDisplay="value-only" />}</DisplayState></div>
      <DisplayState node={hoverAmountNode(hover, filters)}>{(metric) => <PartialDataNote metric={metric} />}</DisplayState>
      <DisplayState node={hover.calendarEvents}>{(collection) => <CollectionState collection={collection}>{(items) => <ul>{items.filter((item) => !("filterTags" in item) ? filters.tags.length === calendarFilterTags.length : item.filterTags.some((tag) => filters.tags.includes(tag))).slice(0, 3).map((item) => <li key={item.calendarItemId} className={styles.semanticListItem}><HistorySemanticIcon iconKey={item.iconKey} /><span>{item.title}</span></li>)}</ul>}</CollectionState>}</DisplayState>
      <DisplayState node={hover.activeRibbons}>{(collection) => <CollectionState collection={collection}>{(items) => <ul>{items.map((item) => <li key={item.calendarItemId} className={styles.semanticListItem}><HistorySemanticIcon iconKey={item.iconKey} /><span>{item.title}</span></li>)}</ul>}</CollectionState>}</DisplayState>
      <DisplayState node={hover.contexts}>{(collection) => <CollectionState collection={collection}>{(items) => <div className={styles.participants}>{items.map((context) => <span key={`${context.personId}-${context.contextTypeKey}`}>{context.label}</span>)}</div>}</CollectionState>}</DisplayState>
      <DisplayState node={hover.economicExpenses}>{(collection) => <CollectionState collection={collection}>{(items) => <ul>{items.slice(0, 3).map((expense) => <li key={expense.expenseEventId}><span>{expenseDisplayTitle(expense)}</span><strong>{formatMoneyValue(expense.amount)}</strong></li>)}</ul>}</CollectionState>}</DisplayState>
      {(hover.hiddenExpenseCount.status === "KNOWN" || hover.hiddenExpenseCount.status === "PARTIAL") && hover.hiddenExpenseCount.value > 0 ? <p>+{hover.hiddenExpenseCount.value} dépenses</p> : null}
      <button type="button" className="button-primary" onClick={onOpenJournal}>Ouvrir le journal</button>
    </section>,
    document.body,
  )}</>;
}

function formatMoneyValue(value: import("@/core/money").Money): string {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(Number(value));
}
