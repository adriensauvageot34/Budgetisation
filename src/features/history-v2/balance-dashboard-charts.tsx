import { use, useState, type CSSProperties } from "react";
import type { Money } from "@/core/money";
import type { YearMonth } from "@/core/time";
import type { MomentLifeMoneySummary } from "@/query-api";
import { formatFrenchDate, formatFrenchDateRange } from "./presentation";
import { MoneyMetric, formatMoney } from "./renderers";
import { metricValue } from "./balance-dashboard-widgets";
import { publicationMetasAreCoherent } from "./publication-coherence";
import type { BalanceDailySeries } from "./types";
import styles from "./balance-dashboard.module.css";

export const categoryColors = ["#7851b0", "#be73a1", "#687db5", "#ab703e", "#687f80", "#a85870", "#7c789e", "#ab8854"];

export function SpendingComparison({ actual, typical, range }: {
  readonly actual?: Money;
  readonly typical?: Money;
  readonly range?: { readonly lowerBound: Money; readonly upperBound: Money };
}) {
  if (actual === undefined && typical === undefined) return null;
  const values = [actual, typical, range?.lowerBound, range?.upperBound].flatMap(value => value === undefined ? [] : [Number(value)]);
  const low = Math.min(...values);
  const high = Math.max(...values);
  const padding = Math.max(1, (high - low) * .12);
  const position = (value: Money) => (Number(value) - low + padding) / (high - low + padding * 2) * 100;
  return <figure className={styles.comparisonChart} aria-label="Dépenses du mois comparées aux habitudes">
    <div className={styles.rangePlot} aria-hidden="true">
      {range && <span className={styles.rangeBand} style={{
        left: `${position(range.lowerBound)}%`, width: `${position(range.upperBound) - position(range.lowerBound)}%`,
      }} />}
      {typical !== undefined && <span className={styles.typicalMarker} style={{ left: `${position(typical)}%` }} />}
      {actual !== undefined && <span className={styles.actualMarker} style={{ left: `${position(actual)}%` }} />}
    </div>
    <figcaption className={styles.comparisonLegend}>
      {actual !== undefined && <span><i data-kind="actual" aria-hidden /> Ce mois <strong>{formatMoney(actual)}</strong></span>}
      {typical !== undefined && <span><i data-kind="typical" aria-hidden /> Habituel <strong>{formatMoney(typical)}</strong></span>}
      {range && <span><i data-kind="range" aria-hidden /> Fourchette <strong>{formatMoney(range.lowerBound)} – {formatMoney(range.upperBound)}</strong></span>}
    </figcaption>
  </figure>;
}

export function DailySpendingTrend({ series, reference }: {
  readonly series: Promise<BalanceDailySeries | null>;
  readonly reference: BalanceDailySeries["publicationMeta"];
}) {
  const data = use(series);
  if (!data || !publicationMetasAreCoherent([reference, data.publicationMeta])) return null;
  return <DailyAmounts days={data.days} />;
}

function DailyAmounts({ days }: { readonly days: BalanceDailySeries["days"] }) {
  const [view, setView] = useState<"total" | "withoutFixed">("withoutFixed");
  const [focusedIndex, setFocusedIndex] = useState<number>();
  const hasFixedBreakdown = days.some(day => metricValue(day.withoutFixed) !== undefined);
  const hasTotals = days.some(day => metricValue(day.total) !== undefined);
  if (!hasTotals && !hasFixedBreakdown) return null;
  const mode = !hasFixedBreakdown ? "total" : !hasTotals ? "withoutFixed" : view;
  const values = days.map(day => metricValue(day[mode]));
  const knownValues = values.flatMap(value => value === undefined ? [] : [Number(value)]);
  const max = Math.max(0, ...knownValues);
  const min = Math.min(0, ...knownValues);
  const scale = Math.max(1, max - min);
  const zero = -min / scale * 100;
  const peak = values.findIndex(value => value !== undefined && Number(value) === max);
  const selected = focusedIndex ?? Math.max(0, peak);
  const display = days[selected];
  return <section className={styles.dailyTrend} aria-label="Dépenses par jour">
    <header className={styles.dailyHeader}>
      <h3>Dépenses par jour</h3>
      {hasFixedBreakdown && hasTotals && <div className={styles.dailyOptions} role="group" aria-label="Type de dépenses">
        <button type="button" aria-pressed={mode === "withoutFixed"} onClick={() => setView("withoutFixed")}>Hors charges fixes</button>
        <button type="button" aria-pressed={mode === "total"} onClick={() => setView("total")}>Toutes</button>
      </div>}
    </header>
    <div className={styles.dailyPlot} style={{ "--daily-zero": `${zero}%` } as CSSProperties} role="group" aria-label="Sélectionner un jour">
      {days.map((day, index) => {
        const value = values[index];
        const amount = Number(value ?? 0);
        return <button type="button" key={day.date} aria-pressed={index === selected} tabIndex={index === selected ? 0 : -1} data-index={index}
          data-missing={value === undefined} data-negative={amount < 0}
          aria-label={`${formatFrenchDate(day.date, false)} · ${value === undefined ? "montant indisponible" : formatMoney(value)}`}
          onFocus={() => setFocusedIndex(index)} onClick={() => setFocusedIndex(index)}
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
      {display[mode] && metricValue(display[mode]) !== undefined
        ? <MoneyMetric metric={display[mode]!} />
        : <strong>Montant indisponible</strong>}
    </p>}
  </section>;
}
export function CategoryRing({ shares }: { readonly shares: readonly (number | undefined)[] }) {
  if (shares.some(share => share === undefined || share < 0 || share > 1)) return null;
  let from = 0;
  const segments = shares.map((share, index) => {
    const end = Math.min(100, from + (share ?? 0) * 100);
    const segment = `${categoryColors[index % categoryColors.length]} ${from}% ${end}%`;
    from = end;
    return segment;
  });
  return <div className={styles.categoryRing} aria-hidden="true" style={{
    background: `conic-gradient(${[...segments, `#e1d6ed ${from}% 100%`].join(", ")})`,
  }}><span>Part<br />du total</span></div>;
}

export function daysInBalanceMonth(month: YearMonth) {
  const first = new Date(`${month}-01T00:00:00Z`);
  return new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
}

export function MonthTimeline({ month, moments, activeId, onOpen }: {
  readonly month: YearMonth;
  readonly moments: readonly MomentLifeMoneySummary[];
  readonly activeId?: string;
  readonly onOpen: (moment: MomentLifeMoneySummary) => void;
}) {
  const days = daysInBalanceMonth(month);
  const positions = new Map<number, MomentLifeMoneySummary>();
  const spans: { id: string; start: number; end: number }[] = [];
  const percent = (day: number) => (day - 1) / (days - 1) * 100;
  for (const moment of moments) {
    const day = moment.startDate.startsWith(month) ? Number(moment.startDate.slice(-2)) : 1;
    if (!positions.has(day)) positions.set(day, moment);
    if (moment.endDate) {
      const endDay = moment.endDate.startsWith(month) ? Number(moment.endDate.slice(-2)) : days;
      if (endDay > day) spans.push({ id: moment.momentId, start: day, end: endDay });
    }
  }
  if (!positions.size) return null;
  return <div className={styles.monthTimeline} aria-label="Moments dans le mois">
    <div className={styles.timelineTrack}>
      {spans.map(span => <i key={span.id} className={styles.timelineSpan} data-current={activeId === span.id}
        style={{ left: `${percent(span.start)}%`, width: `${percent(span.end) - percent(span.start)}%` }} aria-hidden />)}
      {[...positions].map(([day, moment]) => <button key={moment.momentId} type="button"
        title={`${moment.title} · ${formatFrenchDateRange(moment.startDate, moment.endDate, false)}`}
        aria-label={`Moment du ${day} · ${moment.title}`} aria-pressed={activeId === moment.momentId}
        style={{ "--position": `${percent(day)}%` } as CSSProperties}
        onClick={() => onOpen(moment)}><span /></button>)}
    </div>
    <div className={styles.timelineScale} aria-hidden="true"><span>1</span><span>15</span><span>{days}</span></div>
  </div>;
}
