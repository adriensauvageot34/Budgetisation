import { use, useContext, useId, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { subtractMoney, type Money } from "@/core/money";
import { replaceViewSearch } from "@/components/layout/view-search";
import type { LocalDate, YearMonth } from "@/core/time";
import type { MomentLifeMoneySummary } from "@/query-api";
import { formatFrenchDate, formatFrenchDateRange } from "./presentation";
import { MoneyMetric, formatMoney } from "./renderers";
import { formatDelta, metricValue } from "./balance-dashboard-widgets";
import { publicationMetasAreCoherent } from "./publication-coherence";
import { BalanceLayout } from "./balance-density";
import type { BalanceDailySeries } from "./types";
import styles from "./balance-dashboard.module.css";

export const categoryColors = ["#7851b0", "#be73a1", "#687db5", "#ab703e", "#687f80", "#a85870", "#7c789e", "#ab8854"];
type ComparisonMarker = "actual" | "typical" | "range";

export function SpendingComparison({ actual, typical, range }: {
  readonly actual?: Money;
  readonly typical?: Money;
  readonly range?: { readonly lowerBound: Money; readonly upperBound: Money };
}) {
  const [hovered, setHovered] = useState<ComparisonMarker>();
  const [focused, setFocused] = useState<ComparisonMarker>();
  const [pinned, setPinned] = useState<ComparisonMarker>();
  if (actual === undefined && typical === undefined) return null;
  const values = [actual, typical, range?.lowerBound, range?.upperBound].flatMap(value => value === undefined ? [] : [Number(value)]);
  const low = Math.min(...values);
  const high = Math.max(...values);
  const padding = Math.max(1, (high - low) * .12);
  const position = (value: Money) => (Number(value) - low + padding) / (high - low + padding * 2) * 100;
  const emphasis = hovered ?? focused ?? pinned;
  const preview = (marker: ComparisonMarker) => ({ onPointerEnter: () => setHovered(marker), onPointerLeave: () => setHovered(undefined) });
  const control = (marker: ComparisonMarker) => ({ ...preview(marker), "aria-pressed": pinned === marker,
    onFocus: () => setFocused(marker), onBlur: () => setFocused(undefined), onClick: () => setPinned(value => value === marker ? undefined : marker) });
  return <figure className={styles.comparisonChart} data-emphasis={emphasis} aria-label="Dépenses du mois comparées aux habitudes">
    <div className={styles.rangePlot} aria-hidden="true">
      {range && <span className={styles.rangeBand} style={{
        left: `${position(range.lowerBound)}%`, width: `${position(range.upperBound) - position(range.lowerBound)}%`,
      }} {...preview("range")} />}
      {range && [range.lowerBound, range.upperBound].map((bound, index) => <span className={styles.rangeBound} key={index}
        style={{ left: `${position(bound)}%` }} />)}
      {typical !== undefined && <span className={styles.typicalMarker} style={{ left: `${position(typical)}%` }} {...preview("typical")} />}
      {actual !== undefined && <span className={styles.actualMarker} style={{ left: `${position(actual)}%` }} {...preview("actual")} />}
    </div>
    <figcaption className={styles.comparisonLegend}>
      {actual !== undefined && <button type="button" {...control("actual")}><i data-kind="actual" aria-hidden /> Ce mois <strong>{formatMoney(actual)}</strong></button>}
      {typical !== undefined && <button type="button" {...control("typical")}><i data-kind="typical" aria-hidden /> Habituel <strong>{formatMoney(typical)}</strong></button>}
      {range && <button type="button" {...control("range")}><i data-kind="range" aria-hidden /> Fourchette <strong>{formatMoney(range.lowerBound)} – {formatMoney(range.upperBound)}</strong></button>}
    </figcaption>
  </figure>;
}

export function DailySpendingTrend({ series, reference, activeDate, linked, includeFixed, onInspect, onPreview }: {
  readonly series: Promise<BalanceDailySeries | null>;
  readonly reference: BalanceDailySeries["publicationMeta"];
  readonly activeDate?: LocalDate;
  readonly linked: boolean;
  readonly includeFixed?: boolean;
  readonly onInspect: (date: LocalDate, label: string) => void;
  readonly onPreview: (date?: LocalDate) => void;
}) {
  const data = use(series);
  if (!data || !publicationMetasAreCoherent([reference, data.publicationMeta])) return null;
  return <DailyAmounts days={data.days} activeDate={activeDate} linked={linked} includeFixed={includeFixed} onInspect={onInspect} onPreview={onPreview} />;
}

function DailyAmounts({ days, activeDate, linked, includeFixed, onInspect, onPreview }: {
  readonly days: BalanceDailySeries["days"];
  readonly activeDate?: LocalDate;
  readonly linked: boolean;
  readonly includeFixed?: boolean;
  readonly onInspect: (date: LocalDate, label: string) => void;
  readonly onPreview: (date?: LocalDate) => void;
}) {
  const [view, setView] = useState<"total" | "withoutFixed">(includeFixed ? "total" : "withoutFixed");
  const [focusedIndex, setFocusedIndex] = useState<number>();
  const [hoveredIndex, setHoveredIndex] = useState<number>();
  const [keyboardIndex, setKeyboardIndex] = useState<number>();
  useLayoutEffect(() => {
    setView(new URLSearchParams(window.location.search).get("charges") === "toutes" ? "total" : "withoutFixed");
  }, []);
  const hasFixedBreakdown = days.some(day => metricValue(day.withoutFixed) !== undefined);
  const hasTotals = days.some(day => metricValue(day.total) !== undefined);
  if (!hasTotals && !hasFixedBreakdown) return null;
  const mode = !hasFixedBreakdown ? "total" : !hasTotals ? "withoutFixed" : view;
  const values = days.map(day => metricValue(day[mode]));
  // Keep an identical chart domain for both views so a changed height means a changed amount.
  const knownValues = days.flatMap(day => [metricValue(day.total), metricValue(day.withoutFixed)]).flatMap(value => value === undefined ? [] : [Number(value)]);
  const max = Math.max(0, ...knownValues);
  const min = Math.min(0, ...knownValues);
  const scale = Math.max(1, max - min);
  const zero = -min / scale * 100;
  const peak = values.reduce((highest, value, index) => value !== undefined && Number(value) > Number(values[highest] ?? 0) ? index : highest, -1);
  const selected = focusedIndex ?? Math.max(0, peak);
  const activeIndex = days.findIndex(day => day.date === activeDate);
  const previewIndex = hoveredIndex ?? keyboardIndex;
  const displayIndex = previewIndex ?? activeIndex;
  const display = days[displayIndex < 0 ? selected : displayIndex];
  const displayAmount = metricValue(display?.[mode]);
  const excluded = metricValue(display?.withoutFixed);
  const difference = mode === "total" && displayAmount !== undefined && excluded !== undefined && display?.total?.status === "KNOWN" && display.withoutFixed?.status === "KNOWN"
    ? subtractMoney(displayAmount, excluded) : undefined;
  function selectMode(next: typeof mode) {
    setView(next);
    replaceViewSearch({ charges: next === "total" ? "toutes" : undefined });
  }
  return <section className={styles.dailyTrend} aria-label="Dépenses par jour">
    <header className={styles.dailyHeader}>
      <h3>Dépenses par jour</h3>
      {hasFixedBreakdown && hasTotals && <div className={styles.dailyOptions} data-mode={mode} role="group" aria-label="Type de dépenses">
        <button type="button" aria-pressed={mode === "withoutFixed"} onClick={() => selectMode("withoutFixed")}>Hors charges fixes</button>
        <button type="button" aria-pressed={mode === "total"} onClick={() => selectMode("total")}>Toutes</button>
      </div>}
    </header>
    <div className={styles.dailyPlot} style={{ "--daily-zero": `${zero}%`, "--day-width": `${100 / days.length}%` } as CSSProperties} role="group"
      aria-label="Sélectionner un jour · montants sur une échelle commune"
      onPointerLeave={() => { setHoveredIndex(undefined); onPreview(); }} onBlur={event => {
        if (!event.currentTarget.contains(event.relatedTarget)) { setKeyboardIndex(undefined); onPreview(); }
      }}>
      {activeIndex >= 0 && <span className={styles.dayCursor} data-pinned data-linked={linked || undefined} aria-hidden style={{ left: `${activeIndex / days.length * 100}%` }} />}
      <span className={styles.dayCursor} data-preview data-visible={previewIndex !== undefined && previewIndex !== activeIndex} aria-hidden
        style={{ left: `${(previewIndex ?? selected) / days.length * 100}%` }} />
      {days.map((day, index) => {
        const value = values[index];
        const amount = Number(value ?? 0);
        return <button type="button" key={day.date} aria-expanded={day.date === activeDate} data-highlighted={day === display} data-linked={day.date === activeDate && linked || undefined} tabIndex={index === (focusedIndex ?? (activeIndex < 0 ? selected : activeIndex)) ? 0 : -1} data-index={index}
          data-missing={value === undefined} data-negative={amount < 0}
          aria-label={`${formatFrenchDate(day.date, false)} · ${value === undefined ? "montant indisponible" : formatMoney(value)}`}
          onPointerEnter={event => { if (event.pointerType === "mouse") { setHoveredIndex(index); onPreview(day.date); } }}
          onFocus={event => { setFocusedIndex(index); if (event.currentTarget.matches(":focus-visible")) setKeyboardIndex(index); onPreview(day.date); }} onClick={() => {
            setFocusedIndex(index);
            onInspect(day.date, formatFrenchDate(day.date, false));
          }}
          onKeyDown={event => {
            if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
            event.preventDefault();
            const next = Math.max(0, Math.min(days.length - 1, index + (event.key === "ArrowLeft" ? -1 : 1)));
            event.currentTarget.parentElement?.querySelector<HTMLButtonElement>(`[data-index="${next}"]`)?.focus();
          }}>
          <i aria-hidden style={{ "--daily-height": `${Math.abs(amount) / scale * 100}%`, bottom: `${Math.min(zero, zero + amount / scale * 100)}%` } as CSSProperties} />
        </button>;
      })}
    </div>
    <div className={styles.dailyScale} aria-hidden>{[1, 7, 14, 21, days.length].map(day => <span key={day}
      style={{ left: `${(day - .5) / days.length * 100}%` }}>{day}</span>)}</div>
    {display && <p className={styles.dailySelection} aria-live="polite">
      <span>{formatFrenchDate(display.date, false)}</span>
      <span className={styles.dayValue} key={mode}>
      {display[mode] && displayAmount !== undefined
        ? <MoneyMetric metric={display[mode]!} />
        : <strong>Montant indisponible</strong>}
      {difference !== undefined && Number(difference) !== 0 && <small>{formatDelta(difference)} de charges fixes</small>}
      </span>
      {display === days[peak] && <small>Jour le plus dépensier · {mode === "total" ? "toutes dépenses" : "hors charges fixes"}</small>}
    </p>}
  </section>;
}
function daysInBalanceMonth(month: YearMonth) {
  const first = new Date(`${month}-01T00:00:00Z`);
  return new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
}

export function MonthTimeline({ month, moments, activeId, previewId, linkedIds, onPreview, onOpen }: {
  readonly month: YearMonth;
  readonly moments: readonly MomentLifeMoneySummary[];
  readonly activeId?: string;
  readonly previewId?: string;
  readonly linkedIds: ReadonlySet<string>;
  readonly onPreview: (id?: string) => void;
  readonly onOpen: (moment: MomentLifeMoneySummary) => void;
}) {
  const days = daysInBalanceMonth(month);
  const changeLayout = useContext(BalanceLayout);
  const [group, setGroup] = useState<number>();
  const choicesId = useId();
  const groupOptions = useRef<HTMLDivElement>(null);
  const groupTrigger = useRef<HTMLButtonElement>(null);
  useLayoutEffect(() => { if (group !== undefined) groupOptions.current?.querySelector("button")?.focus({ preventScroll: true }); }, [group]);
  const positions = new Map<number, MomentLifeMoneySummary[]>();
  const spans: { id: string; start: number; end: number }[] = [];
  const percent = (day: number) => (day - 1) / (days - 1) * 100;
  for (const moment of moments) {
    const day = moment.startDate.startsWith(month) ? Number(moment.startDate.slice(-2)) : 1;
    const entries = positions.get(day);
    if (entries) entries.push(moment);
    else positions.set(day, [moment]);
    if (moment.endDate) {
      const endDay = moment.endDate.startsWith(month) ? Number(moment.endDate.slice(-2)) : days;
      if (endDay > day) spans.push({ id: moment.momentId, start: day, end: endDay });
    }
  }
  if (!positions.size) return null;
  return <div className={styles.monthTimeline} aria-label="Moments dans le mois" onKeyDown={event => {
    if (event.key !== "Escape" || group === undefined || activeId !== undefined) return;
    event.stopPropagation();
    event.preventDefault();
    changeLayout(() => setGroup(undefined));
    groupTrigger.current?.focus({ preventScroll: true });
  }}>
    <div className={styles.timelineTrack}>
      {spans.map(span => <i key={span.id} className={styles.timelineSpan} data-current={activeId === span.id} data-previewed={previewId === span.id}
        style={{ left: `${percent(span.start)}%`, width: `${percent(span.end) - percent(span.start)}%` }} aria-hidden />)}
      {[...positions].map(([day, entries]) => {
        const [first] = entries;
        const multiple = entries.length > 1;
        const label = multiple ? `${day} · ${entries.length} moments` : `${first!.title} · ${formatFrenchDateRange(first!.startDate, first!.endDate, false)}`;
        return <button key={day} type="button" title={label} aria-label={label}
          aria-expanded={multiple ? group === day : undefined} aria-controls={multiple && group === day ? choicesId : undefined}
          aria-pressed={multiple ? undefined : activeId === first!.momentId}
          data-multiple={multiple || undefined} data-current={entries.some(moment => activeId === moment.momentId)}
          data-previewed={entries.some(moment => previewId === moment.momentId)} data-linked={entries.some(moment => linkedIds.has(moment.momentId)) || undefined}
          style={{ "--position": `${percent(day)}%` } as CSSProperties}
          onPointerEnter={() => onPreview(multiple ? undefined : first!.momentId)} onPointerLeave={() => onPreview()}
          onFocus={() => onPreview(multiple ? undefined : first!.momentId)} onBlur={() => onPreview()}
          onClick={event => {
            if (multiple) {
              groupTrigger.current = event.currentTarget;
              changeLayout(() => setGroup(group === day ? undefined : day));
            } else {
              setGroup(undefined);
              onOpen(first!);
            }
          }}><span>{multiple ? entries.length : null}</span></button>;
      })}
    </div>
    <div className={styles.timelineScale} aria-hidden="true"><span>1</span><span>15</span><span>{days}</span></div>
    {group !== undefined && <div ref={groupOptions} id={choicesId} className={styles.timelineChoices} role="group" aria-label={`Moments du ${group}`}>
      {positions.get(group)?.map(moment => <button key={moment.momentId} type="button" aria-pressed={activeId === moment.momentId}
        onPointerEnter={() => onPreview(moment.momentId)} onPointerLeave={() => onPreview()} onFocus={() => onPreview(moment.momentId)} onBlur={() => onPreview()}
        onClick={() => onOpen(moment)}>{moment.title}</button>)}
    </div>}
  </div>;
}
