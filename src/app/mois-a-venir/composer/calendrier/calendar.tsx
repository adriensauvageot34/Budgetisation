"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, Circle, X } from "lucide-react";
import Link from "next/link";
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

export function ComposerCalendar({ calendar, month, today, initialDay }: { calendar: Model; month: string; today: string; initialDay?: string }) {
  const [preview, setPreview] = useState<{ day: Day; left: number; top: number } | null>(null);
  const [selected, setSelected] = useState<{ day: Day; item?: CalendarItem } | null>(() => {
    const day = calendar.weeks.flatMap(week => week.days).find(day => day.date === initialDay && day.date.startsWith(month) && day.items.length);
    return day ? { day } : null;
  });
  const opener = useRef<HTMLElement>(null);
  const detailHeading = useRef<HTMLHeadingElement>(null);
  const timing = useRef<ReturnType<typeof startDetailTiming>>(null);
  const { changeLayout } = useLayoutMotion("calendar-layout");
  const date = selected?.day.date;
  useLayoutEffect(() => {
    replaceViewSearch({ jour: date });
    if (!date) return;
    detailHeading.current?.focus({ preventScroll: true });
    timing.current?.visible("structure");
    timing.current?.visible("content");
  }, [date, selected]);
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

  function closeDay() {
    timing.current?.cancel();
    changeLayout(() => {
      setSelected(null);
      opener.current?.focus({ preventScroll: true });
    });
  }

  function openDay(day: Day, source: HTMLElement, item?: CalendarItem) {
    setPreview(null);
    if (date === day.date && selected?.item?.key === item?.key) return closeDay();
    opener.current = source;
    timing.current?.cancel();
    timing.current = startDetailTiming("calendrier");
    changeLayout(() => setSelected({ day, item }));
  }

  function previewDay(day: Day, source: HTMLElement) {
    if (selected || !day.items.length) return;
    const anchor = source.getBoundingClientRect();
    const position = calendarPopoverPosition(anchor, { width: window.innerWidth, height: window.innerHeight },
      { width: 320, height: Math.min(252, 64 + day.items.length * 39) });
    setPreview({ day, ...position });
  }

  return <>
    <div className={styles.calendar} aria-label="Calendrier de Composer" data-day-open={Boolean(date) || undefined}
      onKeyDown={event => { if (event.key === "Escape" && selected) { event.preventDefault(); closeDay(); } }}>
      <div className={styles.weekdays} aria-hidden="true">
        {["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"].map(name =>
          <span key={name}><span>{name}</span><abbr title={name}>{name.slice(0, 3)}</abbr></span>)}
      </div>
      {calendar.weeks.map(week => {
        const activeWeek = selected && week.days.some(day => day.date === date);
        return <div className={styles.calendarWeek} key={week.days[0]!.date} data-active-week={activeWeek || undefined}
          style={{ "--calendar-week-transition": `calendar-week-${week.days[0]!.date}` } as React.CSSProperties}>
        {week.ribbons.length > 0 && <div className={styles.ribbons} aria-label="Événements sur plusieurs jours">
          {week.ribbons.map(({ item, lane, startColumn, endColumn }, index) => <button key={`${item.key}:${index}`} type="button"
            aria-expanded={activeWeek ? Boolean(selected?.item?.key === item.key) : false} data-calendar-status={item.composerStatus}
            style={{ gridColumn: `${startColumn} / ${endColumn + 1}`, gridRow: lane }}
            onClick={event => {
              const day = week.days.slice(startColumn - 1, endColumn).find(day => day.date.startsWith(month)) ?? week.days[startColumn - 1];
              if (day) openDay(day, event.currentTarget, item);
            }}>
            <ClayEntryIcon item={item} size={20} /><span>{item.label}</span>
          </button>)}
        </div>}
        <div className={styles.week}>
          {week.days.map(day => {
            const inMonth = day.date.startsWith(month);
            const currentDay = inMonth && day.date === today;
            const dailyItems = day.items.filter(item => !item.endDate || item.endDate <= (item.date ?? ""));
            const visible = dailyItems.slice(0, 3);
            const hidden = dailyItems.length - visible.length;
            const participants = [...new Set(day.items.flatMap(item => item.participants ?? []))];
            const label = calendarDate(day.date);
            const total = day.total ? calendarBudgetLabel({ amount: day.total }) : undefined;
            return <article key={day.date} className={styles.day} data-outside={!inMonth || undefined}
              data-filled={day.items.length > 0 || undefined} data-today={currentDay || undefined} data-composer-day={day.date}
              onPointerEnter={event => {
                if (event.pointerType === "mouse" && inMonth) previewDay(day, event.currentTarget);
              }} onPointerLeave={() => setPreview(null)}>
              {inMonth && day.items.length ? <button type="button" className={styles.dayButton} aria-expanded={date === day.date && !selected?.item}
                onFocus={event => previewDay(day, event.currentTarget)} onBlur={() => setPreview(null)}
                onClick={event => openDay(day, event.currentTarget)}
                aria-label={`${label} · ${day.items.length} ${day.items.length === 1 ? "élément" : "éléments"}${total ? ` · ${total}` : ""}`}
                aria-current={currentDay ? "date" : undefined}>
                <span className={styles.dayHeading}><span>{Number(day.date.slice(8))}</span>{total && <strong>{total}</strong>}</span>
                {participants.length > 0 && <span className={styles.participants} aria-label={participants.join(", ")}>
                  {participants.slice(0, 3).map(person => <span key={person} title={person}>{person === "Couple" ? "A+M" : person.split(" ").map(word => word[0]).join("").slice(0, 2)}</span>)}
                </span>}
                {visible.length > 0 && <span className={styles.dayEntries}>{visible.map(item => <EntryRow key={item.key} item={item} compact />)}</span>}
                {hidden > 0 && <span className={styles.more}>+{hidden} {hidden === 1 ? "autre" : "autres"}</span>}
                <span className={styles.dayCount}>{day.items.length} {day.items.length === 1 ? "élément" : "éléments"}</span>
              </button> : <div className={styles.dayHeading} aria-current={currentDay ? "date" : undefined}><span>{Number(day.date.slice(8))}</span></div>}
            </article>;
          })}
        </div>
        {activeWeek && selected && <section className={styles.dayDetail} aria-labelledby="composer-calendar-day" data-budget-reveal>
          <header>
            <div><h2 tabIndex={-1} ref={detailHeading} id="composer-calendar-day">{selected.item?.label ?? calendarDate(selected.day.date)}</h2>
              {!selected.item && selected.day.total && <strong data-budget-amount="comparison">{calendarBudgetLabel({ amount: selected.day.total })}</strong>}
            </div>
            <button type="button" aria-label="Fermer les détails du jour" onClick={closeDay}><X size={18} aria-hidden /></button>
          </header>
          <ul aria-label="Éléments du jour">{(selected.item ? [selected.item] : selected.day.items).map(item =>
            <li key={item.key}><EntryDetail item={item} /></li>)}</ul>
        </section>}
      </div>;
      })}
    </div>
    {calendar.undated.length > 0 && <details className={styles.undated}>
      <summary>Sans date précise · {calendar.undated.length}</summary>
      <ul>{calendar.undated.map(item => <li key={item.key}><EntryDetail item={item} /></li>)}</ul>
    </details>}
    {preview && !selected && createPortal(<aside role="tooltip" className={styles.preview}
      style={{ left: preview.left, top: preview.top }}>
      <header><strong>{calendarDate(preview.day.date)}</strong>{preview.day.total && <strong>{calendarBudgetLabel({ amount: preview.day.total })}</strong>}</header>
      <ul>{preview.day.items.slice(0, 4).map(item => <li key={item.key}><EntryRow item={item} /></li>)}</ul>
      {preview.day.items.length > 4 && <small>+{preview.day.items.length - 4} · Clique sur le jour pour tout voir</small>}
    </aside>, document.body)}
  </>;
}

function EntryDetail({ item }: { item: CalendarItem }) {
  return <div className={styles.detail}>
    <EntryRow item={item} />
    {item.dateCertainty === "HISTORICAL_ESTIMATE" && <small>Jour de prélèvement estimé</small>}
    {item.composerHref && <Link prefetch={false} href={item.composerHref}>Ouvrir la carte</Link>}
  </div>;
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
