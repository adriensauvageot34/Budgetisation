"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, Circle, X } from "lucide-react";
import { CalendarEventIcon } from "../../month-calendar";
import { calendarBudgetLabel, calendarDate, calendarPopoverPosition, calendarStateLabel } from "../../calendar-presentation";
import type { CalendarItem } from "../../planned-expenses-projection";
import type { readComposerCalendar } from "./calendar-data";
import material from "../../month-material.module.css";
import styles from "./calendar.module.css";

type Model = Awaited<ReturnType<typeof readComposerCalendar>>;
type Day = Model["weeks"][number]["days"][number];

export function ComposerCalendar({ calendar, month, today }: { calendar: Model; month: string; today: string }) {
  const [preview, setPreview] = useState<{ day: Day; left: number; top: number } | null>(null);
  const [selected, setSelected] = useState<{ title: string; items: readonly CalendarItem[] } | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (!selected || dialog.current?.open) return;
    dialog.current?.showModal();
  }, [selected]);
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

  function openDay(day: Day) {
    setPreview(null);
    setSelected({ title: calendarDate(day.date), items: day.items });
  }

  return <>
    <div className={`${material.calendar} ${styles.calendar}`} aria-label="Calendrier de Composer">
      <div className={styles.weekdays} aria-hidden="true">
        {["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"].map(name =>
          <span key={name}><span>{name}</span><abbr title={name}>{name.slice(0, 3)}</abbr></span>)}
      </div>
      {calendar.weeks.map(week => <div className={styles.calendarWeek} key={week.days[0]!.date}>
        {week.ribbons.length > 0 && <div className={styles.ribbons} aria-label="Événements sur plusieurs jours">
          {week.ribbons.map(({ item, lane, startColumn, endColumn }, index) => <button key={`${item.key}:${index}`} type="button"
            aria-haspopup="dialog" style={{ gridColumn: `${startColumn} / ${endColumn + 1}`, gridRow: lane }}
            onClick={() => { setPreview(null); setSelected({ title: item.label, items: [item] }); }}>
            <CalendarEventIcon item={item} size={20} /><span>{item.label}</span>
          </button>)}
        </div>}
        <div className={styles.week}>
          {week.days.map(day => {
            const inMonth = day.date.startsWith(month);
            const dailyItems = day.items.filter(item => !item.endDate || item.endDate <= (item.date ?? ""));
            const visible = dailyItems.slice(0, 3);
            const hidden = dailyItems.length - visible.length;
            const participants = [...new Set(day.items.flatMap(item => item.participants ?? []))];
            const label = calendarDate(day.date);
            return <article key={day.date} className={styles.day} data-outside={!inMonth || undefined}
              data-filled={day.items.length > 0 || undefined} data-composer-day={day.date}
              onPointerEnter={event => {
                if (event.pointerType !== "mouse" || selected || !day.items.length) return;
                const anchor = event.currentTarget.getBoundingClientRect();
                const position = calendarPopoverPosition(anchor, { width: window.innerWidth, height: window.innerHeight },
                  { width: 320, height: Math.min(252, 64 + day.items.length * 39) });
                setPreview({ day, ...position });
              }} onPointerLeave={() => setPreview(null)}>
              {inMonth && day.items.length ? <button type="button" className={styles.dayButton} aria-haspopup="dialog" onClick={() => openDay(day)}
                aria-label={`${label} · ${day.items.length} ${day.items.length === 1 ? "élément" : "éléments"}`} aria-current={day.date === today ? "date" : undefined}>
                <span className={styles.dayHeading}><span>{Number(day.date.slice(8))}</span>{day.total && <strong>{calendarBudgetLabel({ amount: day.total })}</strong>}</span>
                {participants.length > 0 && <span className={styles.participants} aria-label={participants.join(", ")}>
                  {participants.slice(0, 3).map(person => <span key={person} title={person}>{person === "Couple" ? "A+M" : person.split(" ").map(word => word[0]).join("").slice(0, 2)}</span>)}
                </span>}
                {visible.map(item => <EntryRow key={item.key} item={item} compact />)}
                {hidden > 0 && <span className={styles.more}>+{hidden} {hidden === 1 ? "autre" : "autres"}</span>}
              </button> : <div className={styles.dayHeading} aria-current={day.date === today ? "date" : undefined}><span>{Number(day.date.slice(8))}</span></div>}
            </article>;
          })}
        </div>
      </div>)}
    </div>
    {calendar.undated.length > 0 && <details className={`${material.glassSecondary} ${styles.undated}`}>
      <summary>Sans date précise · {calendar.undated.length}</summary>
      <ul>{calendar.undated.map(item => <li key={item.key}><EntryDetail item={item} /></li>)}</ul>
    </details>}
    {preview && !selected && createPortal(<aside role="tooltip" className={`${material.popover} ${styles.preview}`}
      style={{ left: preview.left, top: preview.top }}>
      <header><strong>{calendarDate(preview.day.date)}</strong>{preview.day.total && <strong>{calendarBudgetLabel({ amount: preview.day.total })}</strong>}</header>
      <ul>{preview.day.items.slice(0, 4).map(item => <li key={item.key}><EntryRow item={item} /></li>)}</ul>
      {preview.day.items.length > 4 && <small>+{preview.day.items.length - 4} · Clique sur le jour pour tout voir</small>}
    </aside>, document.body)}
    <dialog ref={dialog} className={`${material.glassPremium} ${styles.dialog}`} onClose={() => setSelected(null)} aria-labelledby="composer-calendar-day"
      onClick={event => { if (event.target === event.currentTarget) dialog.current?.close(); }}>
      {selected && <section>
        <header><h2 id="composer-calendar-day">{selected.title}</h2><button type="button" aria-label="Fermer les détails du jour"
          onClick={() => dialog.current?.close()}><X size={20} /></button></header>
        <ul>{selected.items.map(item => <li key={item.key}><EntryDetail item={item} /></li>)}</ul>
      </section>}
    </dialog>
  </>;
}

function EntryDetail({ item }: { item: CalendarItem }) {
  return <div className={styles.detail}>
    <EntryRow item={item} />
    {item.dateCertainty === "HISTORICAL_ESTIMATE" && <small>Jour de prélèvement estimé</small>}
    {item.composerHref && <a href={item.composerHref}>Ouvrir la carte</a>}
  </div>;
}

function EntryRow({ item, compact = false }: { item: CalendarItem; compact?: boolean }) {
  return <span className={styles.entry} data-compact={compact || undefined} data-calendar-status={item.composerStatus}
    title={compact ? `${item.label} · ${calendarStateLabel(item)}` : undefined}>
    <span className={styles.icon}>
      <CalendarEventIcon item={item} size={compact ? 25 : 33} />
      {item.composerStatus && item.composerStatus !== "observed" && <span aria-hidden="true" className={styles.marker}>
        {item.composerStatus === "confirmed" ? <Check size={9} strokeWidth={3} /> : item.composerStatus === "pending" ? "!" : <Circle size={5} fill="currentColor" />}
      </span>}
    </span>
    <span className={styles.entryText}><b>{compact ? item.calendarLabel ?? item.label : item.label}</b>
      {!compact && <small>{[calendarStateLabel(item), ...(item.participants ?? [])].join(" · ")}</small>}
    </span>
    {item.amount !== null && <strong className={styles.amount}>{calendarBudgetLabel(item)}</strong>}
  </span>;
}
