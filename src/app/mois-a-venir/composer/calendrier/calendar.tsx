"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, Circle, X } from "lucide-react";
import Link from "next/link";
import { DensityAtom, useAdaptiveColumn } from "@/components/layout/content-density";
import { useLayoutMotion } from "@/components/layout/use-layout-motion";
import { replaceViewSearch } from "@/components/layout/view-search";
import { startDetailTiming } from "@/components/layout/detail-timing";
import { CalendarEventIcon } from "../../month-calendar";
import { calendarBudgetLabel, calendarDate, calendarPopoverPosition, calendarStateLabel } from "../../calendar-presentation";
import type { CalendarItem } from "../../planned-expenses-projection";
import type { readComposerCalendar } from "./calendar-data";
import styles from "./calendar.module.css";

type Model = Awaited<ReturnType<typeof readComposerCalendar>>;
type Day = Model["weeks"][number]["days"][number];

const clayChargeIcons = "/planned-visuals/calendar/clay";
const chargeIconsByLabel: Readonly<Record<string, string>> = {
  "Électricité": `${clayChargeIcons}/electricity.webp`,
  Eau: `${clayChargeIcons}/water.webp`,
};
const chargeIconsByGroup: Readonly<Record<string, string>> = {
  Maison: `${clayChargeIcons}/housing.webp`,
  "Télécom": `${clayChargeIcons}/phone.webp`,
  Assurances: `${clayChargeIcons}/insurance.webp`,
  Banque: "/analyse-globale/clay/expenses.webp",
  Abonnements: "/analyse-globale/clay/events.webp",
};

function ClayEntryIcon({ item, size }: { item: CalendarItem; size: number }) {
  const badge = item.artwork;
  const generic = badge === undefined || badge.src.startsWith("/planned-visuals/commerce/categories/");
  const src = item.nature === "CERTAIN_OUTFLOW" && generic
    ? chargeIconsByLabel[item.calendarLabel ?? item.label] ?? chargeIconsByGroup[item.group ?? ""]
    : undefined;
  return <CalendarEventIcon item={src ? { ...item, artwork: { src, kind: "clay" } } : item} size={size} />;
}


type Selection = { day: Day | null; item?: CalendarItem };
const desktopCalendar = "(min-width: 768px)";
const weekdays = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"] as const;

function CalendarAtom({ name, priority, minimum = 0, className, children }: {
  name: string;
  priority: number;
  minimum?: 0 | 1;
  className?: string;
  children: ReactNode;
}) {
  const atomClass = className ? styles.atom + " " + className : styles.atom;
  return <DensityAtom name={name} priority={priority} minimum={minimum} className={atomClass} motionClassName={styles.atomBody}>
    {children}
  </DensityAtom>;
}

export function ComposerCalendar({ calendar, month, today, initialDay }: { calendar: Model; month: string; today: string; initialDay?: string }) {
  const [preview, setPreview] = useState<{ day: Day; left: number; top: number } | null>(null);
  const [selected, setSelected] = useState<Selection | null>(() => {
    const day = calendar.weeks.flatMap(week => week.days).find(day => day.date === initialDay && day.date.startsWith(month) && day.items.length);
    return day ? { day } : null;
  });
  const { changeLayout, revision } = useLayoutMotion("calendar-layout");
  const grid = useAdaptiveColumn(revision, "[data-calendar-detail-body]", "calendar-layout", desktopCalendar);
  const detailId = useId();
  const opener = useRef<HTMLElement>(null);
  const returnFocus = useRef<{ source: HTMLElement | null; date?: string }>(null);
  const detailHeading = useRef<HTMLHeadingElement>(null);
  const focusDetail = useRef(Boolean(initialDay));
  const timing = useRef<ReturnType<typeof startDetailTiming>>(null);
  const date = selected?.day?.date;
  const undatedOpen = selected?.day === null;

  useLayoutEffect(() => { replaceViewSearch({ jour: date }); }, [date]);
  useLayoutEffect(() => {
    if (returnFocus.current && !selected) {
      const { source, date: day } = returnFocus.current;
      returnFocus.current = null;
      const cell = day ? grid.current?.querySelector(`[data-composer-day="${day}"]`) : null;
      const compactEntry = source?.dataset.calendarCompactEntry;
      const restoredEntry = compactEntry ? cell?.querySelector<HTMLButtonElement>(`[data-calendar-compact-entry="${CSS.escape(compactEntry)}"]`) : null;
      const fallback = restoredEntry?.getClientRects().length ? restoredEntry : cell?.querySelector("button");
      (source?.getClientRects().length ? source : fallback)?.focus({ preventScroll: true });
      setPreview(null);
    }
    if (focusDetail.current && selected) {
      focusDetail.current = false;
      const itemTrigger = selected.item && grid.current?.querySelector<HTMLButtonElement>("[data-calendar-entry-trigger][aria-expanded=true]");
      (itemTrigger || detailHeading.current)?.focus({ preventScroll: true });
      const list = itemTrigger?.closest<HTMLElement>("[data-detail-overflow]");
      if (list && itemTrigger) {
        const triggerBounds = itemTrigger.getBoundingClientRect();
        const listBounds = list.getBoundingClientRect();
        if (triggerBounds.bottom > listBounds.bottom || triggerBounds.top < listBounds.top) {
          list.scrollTop += triggerBounds.top - listBounds.top;
        }
      }
      timing.current?.visible("structure");
      timing.current?.visible("content");
    }
  }, [grid, selected]);
  useEffect(() => () => timing.current?.cancel(), []);
  useEffect(() => {
    if (!preview) return;
    const dismiss = () => setPreview(null);
    window.addEventListener("scroll", dismiss, true);
    window.addEventListener("resize", dismiss);
    window.addEventListener("keydown", dismiss);
    return () => {
      window.removeEventListener("scroll", dismiss, true);
      window.removeEventListener("resize", dismiss);
      window.removeEventListener("keydown", dismiss);
    };
  }, [preview]);

  function close() {
    timing.current?.cancel();
    changeLayout(() => {
      focusDetail.current = false;
      returnFocus.current = { source: opener.current, date };
      setSelected(null);
    });
  }

  function open(day: Day | null, source: HTMLElement, item?: CalendarItem) {
    setPreview(null);
    if (selected && date === day?.date && (!item || selected.item?.key === item.key)) {
      close();
      return;
    }
    timing.current?.cancel();
    timing.current = startDetailTiming("calendrier");
    changeLayout(() => {
      opener.current = source;
      focusDetail.current = true;
      setSelected({ day, item });
    });
  }

  function toggleItem(item: CalendarItem) {
    changeLayout(() => setSelected(current => current && {
      day: current.day, item: current.item?.key === item.key ? undefined : item,
    }));
  }

  function previewDay(day: Day, source: HTMLElement) {
    if (selected || !day.items.length) return;
    const anchor = source.getBoundingClientRect();
    const position = calendarPopoverPosition(anchor, { width: window.innerWidth, height: window.innerHeight },
      { width: 320, height: Math.min(252, 64 + day.items.length * 39) });
    setPreview({ day, ...position });
  }

  function dayDetail(day: Day) {
    const selectedItem = selected?.item;
    const items = selectedItem && !day.items.some(item => item.key === selectedItem.key) ? [selectedItem, ...day.items] : day.items;
    return <section className={styles.dayDetail} id={detailId} aria-labelledby={detailId + "-title"} data-budget-reveal>
      <h2 className="sr-only" tabIndex={-1} ref={detailHeading} id={detailId + "-title"}>{calendarDate(day.date)}</h2>
      <CalendarDetailList items={items} selected={selectedItem} onSelect={toggleItem} label="Éléments du jour" />
    </section>;
  }

  function calendarDay(day: Day, column: number) {
    const inMonth = day.date.startsWith(month);
    const currentDay = inMonth && day.date === today;
    const dailyItems = day.items.filter(item => !item.endDate || item.endDate <= (item.date ?? ""));
    const participants = [...new Set(day.items.flatMap(item => item.participants ?? []))];
    const label = calendarDate(day.date);
    const total = day.total ? calendarBudgetLabel({ amount: day.total }) : undefined;
    const active = date === day.date;
    const itemCount = day.items.length;
    const dayNumber = Number(day.date.slice(8));
    const weekday = weekdays[column].slice(0, 3);
    const heading = <span className={styles.dayHeading}>
      <span><small className={styles.dayWeekday} aria-hidden>{weekday}</small>{active ? label : dayNumber}</span>
      {total && <strong>{total}</strong>}
    </span>;
    return <article key={day.date} className={styles.day} data-outside={!inMonth || undefined}
      data-filled={itemCount > 0 || undefined} data-today={currentDay || undefined} data-composer-day={day.date}
      style={{ "--calendar-day-transition": `calendar-day-${day.date}` } as CSSProperties}
      data-active-day={active || undefined} data-ribbon-day={itemCount > 0 && dailyItems.length === 0 || undefined}
      onPointerEnter={event => {
        if (event.pointerType === "mouse" && inMonth) previewDay(day, event.currentTarget);
      }} onPointerLeave={() => setPreview(null)}>
      {inMonth && itemCount ? <>
        <button type="button" className={styles.dayButton} aria-expanded={active} aria-controls={active ? detailId : undefined}
          onFocus={event => previewDay(day, event.currentTarget)} onBlur={() => setPreview(null)}
          onClick={event => open(day, event.currentTarget)}
          aria-label={`${label} · ${itemCount} ${itemCount === 1 ? "élément" : "éléments"}${total ? ` · ${total}` : ""}`}
          aria-current={currentDay ? "date" : undefined}>
          {heading}
          {participants.length > 0 && <span className={styles.participants} aria-label={participants.join(", ")}>
            {participants.slice(0, 3).map(person => <span key={person} title={person}>{person === "Couple" ? "A+M" : person.split(" ").map(word => word[0]).join("").slice(0, 2)}</span>)}
          </span>}
        </button>
        {active ? <>
          <button type="button" className={styles.closeDay} aria-label="Fermer les détails du jour" onClick={close}><X size={17} aria-hidden /></button>
          {dayDetail(day)}
        </> : <>
          {dailyItems.length > 0 && <div className={styles.dayEntries}>{dailyItems.slice(0, 3).map(item =>
            <button key={item.key} type="button" data-calendar-compact-entry={item.key} aria-label={`${item.label} · ${label}`}
              aria-pressed={active && selected?.item?.key === item.key}
              onClick={event => open(day, event.currentTarget, item)}><EntryRow item={item} compact /></button>)}</div>}
          {[1, 2, 3].map(visible => dailyItems.length > visible && <span className={styles.more} data-count-level={visible} key={visible}>
            +{dailyItems.length - visible} {dailyItems.length - visible === 1 ? "autre" : "autres"}
          </span>)}
          <span className={styles.dayCount}>{itemCount} {itemCount === 1 ? "élément" : "éléments"}</span>
        </>}
      </> : <div aria-current={currentDay ? "date" : undefined}>{heading}</div>}
    </article>;
  }

  return <div className={styles.calendar} aria-label="Calendrier de Composer"
    onKeyDown={event => {
      if (event.key !== "Escape" || !selected) return;
      event.preventDefault();
      if (selected.item) {
        grid.current?.querySelector<HTMLButtonElement>("[data-calendar-entry-trigger][aria-expanded=true]")?.focus({ preventScroll: true });
        toggleItem(selected.item);
      } else close();
    }}>
    <div className={styles.weekdays} aria-hidden="true">
      {weekdays.map(name =>
        <span key={name}><span>{name}</span><abbr title={name}>{name.slice(0, 3)}</abbr></span>)}
    </div>
    <div ref={grid} className={styles.calendarGrid} data-adaptive-fill>
      {calendar.weeks.map(week => {
        const activeColumn = week.days.findIndex(day => day.date === date);
        const activeWeek = activeColumn >= 0;
        const activeColumns = activeWeek ? week.days.map((_, col) => col === activeColumn ? "minmax(0, 5fr)" : "minmax(0, 1fr)").join(" ") : undefined;
        return <section className={styles.calendarWeek} key={week.days[0]!.date} data-active-week={activeWeek || undefined}
          data-adaptive-region data-adaptive-active={activeWeek || undefined}
          style={{ "--calendar-week-columns": activeColumns, "--calendar-ribbons-transition": `calendar-ribbons-${week.days[0]!.date}` } as CSSProperties}>
          <div className={styles.weekFlow} data-adaptive-flow>
            {week.ribbons.length > 0 && <CalendarAtom name="ribbons" priority={105} className={styles.ribbonAtom}>
              <div className={styles.ribbons} aria-label="Événements sur plusieurs jours">
                {week.ribbons.map(({ item, lane, startColumn, endColumn }, index) => {
                  const day = week.days.slice(startColumn - 1, endColumn).find(day => day.date.startsWith(month));
                  return day && <button key={`${item.key}:${index}`} type="button"
                    aria-expanded={activeWeek && selected?.item?.key === item.key} data-calendar-status={item.composerStatus}
                    style={{ gridColumn: `${startColumn} / ${endColumn + 1}`, gridRow: lane }}
                    onClick={event => open(day, event.currentTarget, item)}>
                    <ClayEntryIcon item={item} size={20} /><span>{item.label}</span>
                  </button>;
                })}
              </div>
            </CalendarAtom>}
            <CalendarAtom name="days" priority={75} minimum={1} className={styles.weekAtom}>
              <div className={styles.week}>{week.days.map(calendarDay)}</div>
            </CalendarAtom>
          </div>
        </section>;
      })}
      {calendar.undated.length > 0 && <section className={styles.undated} data-adaptive-region data-adaptive-active={undatedOpen || undefined}>
        <div className={styles.undatedFlow} data-adaptive-flow>
          <CalendarAtom name="undated-heading" priority={105} minimum={1}>
            <button className={styles.undatedTrigger} type="button" aria-expanded={undatedOpen}
              aria-controls={undatedOpen ? detailId : undefined} onClick={event => open(null, event.currentTarget)}>
              <span>Sans date précise · {calendar.undated.length}</span><ChevronDown size={17} aria-hidden />
            </button>
          </CalendarAtom>
          {undatedOpen && <CalendarAtom name="detail" priority={230} minimum={1}>
            <section className={styles.undatedDetail} id={detailId} aria-labelledby={detailId + "-title"} data-budget-reveal>
              <h2 className="sr-only" id={detailId + "-title"} ref={detailHeading} tabIndex={-1}>Éléments sans date précise</h2>
              <CalendarDetailList items={calendar.undated} selected={selected?.item} onSelect={toggleItem} label="Éléments sans date précise" />
            </section>
          </CalendarAtom>}
        </div>
      </section>}
    </div>
    {preview && !selected && createPortal(<aside role="tooltip" className={styles.preview} data-budget-reveal
      style={{ left: preview.left, top: preview.top }}>
      <header><strong>{calendarDate(preview.day.date)}</strong>{preview.day.total && <strong>{calendarBudgetLabel({ amount: preview.day.total })}</strong>}</header>
      <ul>{preview.day.items.slice(0, 4).map(item => <li key={item.key}><EntryRow item={item} /></li>)}</ul>
      {preview.day.items.length > 4 && <small>+{preview.day.items.length - 4} · Clique sur le jour pour tout voir</small>}
    </aside>, document.body)}
  </div>;
}

function CalendarDetailList({ items, selected, onSelect, label }: {
  items: readonly CalendarItem[];
  selected?: CalendarItem;
  onSelect: (item: CalendarItem) => void;
  label: string;
}) {
  const id = useId();
  return <ul className={styles.detailList} aria-label={label} data-calendar-detail-body>
    {items.map((item, index) => {
      const expanded = selected?.key === item.key;
      const canExpand = Boolean(item.date || item.group || item.composerHref);
      const itemId = `${id}-${index}`;
      return <li key={item.key} className={styles.detailItem} data-selected-entry={expanded || undefined}>
        {canExpand ? <button type="button" className={styles.detailTrigger} data-calendar-entry-trigger aria-expanded={expanded}
          aria-controls={expanded ? itemId : undefined} onClick={() => onSelect(item)}>
          <EntryRow item={item} /><ChevronDown size={15} aria-hidden />
        </button> : <EntryRow item={item} />}
        {expanded && canExpand && <div id={itemId} className={styles.entryDetail} data-budget-reveal>
          {item.date && <span>{calendarDate(item.date)}{item.endDate && item.endDate !== item.date ? " → " + calendarDate(item.endDate) : ""}{item.dateCertainty === "HISTORICAL_ESTIMATE" ? " · Jour de prélèvement estimé" : ""}</span>}
          {item.group && <span>{item.group}</span>}
          {item.composerHref && <Link prefetch={false} href={item.composerHref}>Ouvrir la carte</Link>}
        </div>}
      </li>;
    })}
  </ul>;
}

function EntryRow({ item, compact = false }: { item: CalendarItem; compact?: boolean }) {
  return <span className={styles.entry} data-compact={compact || undefined} data-calendar-status={item.composerStatus}
    title={compact ? `${item.label} · ${calendarStateLabel(item)}` : undefined}>
    <span className={styles.icon}>
      <ClayEntryIcon item={item} size={compact ? 24 : 32} />
      {item.composerStatus && <span aria-hidden="true" className={styles.marker}>
        {item.composerStatus === "confirmed" || item.composerStatus === "observed" ? <Check size={9} strokeWidth={3} /> : item.composerStatus === "pending" ? "!" : <Circle size={5} fill="currentColor" />}
      </span>}
    </span>
    <span className={styles.entryText}><b>{compact ? item.calendarLabel ?? item.label : item.label}</b>
      {!compact && <small>{[calendarStateLabel(item), ...(item.participants ?? [])].join(" · ")}</small>}
    </span>
    {item.amount !== null && <strong className={styles.amount}>{calendarBudgetLabel(item)}</strong>}
  </span>;
}
