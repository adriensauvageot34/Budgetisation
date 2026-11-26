import type { CSSProperties } from "react";
import type { Money } from "@/core/money";
import type { YearMonth } from "@/core/time";
import type { MomentLifeMoneySummary } from "@/query-api";
import { formatFrenchDateRange } from "./presentation";
import { formatMoney } from "./renderers";
import styles from "./balance-dashboard.module.css";

export const categoryColors = ["#7851b0", "#be73a1", "#687db5", "#ab703e", "#687f80", "#a85870", "#7c789e", "#ab8854"];

export function SpendingComparison({ actual, typical, range }: {
  readonly actual?: Money;
  readonly typical?: Money;
  readonly range?: { readonly lowerBound: Money; readonly upperBound: Money };
}) {
  const values = [
    { id: "actual", label: "Ce mois", value: actual },
    { id: "typical", label: "Mois habituel", value: typical },
  ].filter((point): point is { id: string; label: string; value: Money } => point.value !== undefined);
  if (!values.length) return null;

  const maximum = Math.max(1, ...values.map(point => Number(point.value)), Number(range?.upperBound ?? 0));
  const minimum = Math.min(0, ...values.map(point => Number(point.value)), Number(range?.lowerBound ?? 0));
  const percent = (value: Money | number) => (Number(value) - minimum) / (maximum - minimum) * 100;
  const zero = percent(0);
  return <figure className={styles.comparisonChart} aria-label="Dépenses du mois comparées aux habitudes">
    <div className={styles.comparisonPlot} aria-hidden="true">
      {range && <span className={styles.usualBand} style={{ bottom: `${percent(range.lowerBound)}%`, height: `${percent(range.upperBound) - percent(range.lowerBound)}%` }} />}
      {minimum < 0 && <span className={styles.zeroLine} style={{ bottom: `${zero}%` }} />}
      {values.map(point => <div key={point.id} data-series={point.id}>
        <span style={{ bottom: `${Math.min(zero, percent(point.value))}%`, height: `${Math.abs(percent(point.value) - zero)}%` }} />
      </div>)}
    </div>
    <figcaption className={styles.comparisonLegend}>
      {values.map(point => <span key={point.id} data-series={point.id}>{point.label} <strong>{formatMoney(point.value)}</strong></span>)}
    </figcaption>
  </figure>;
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

export function MonthTimeline({ month, moments, activeId, onOpen }: {
  readonly month: YearMonth;
  readonly moments: readonly MomentLifeMoneySummary[];
  readonly activeId?: string;
  readonly onOpen: (moment: MomentLifeMoneySummary) => void;
}) {
  const first = new Date(`${month}-01T00:00:00Z`);
  const days = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
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
