"use client";

import type { ReactNode } from "react";
import type { DisplayNode, MetricValue } from "@/core/history-v2";
import type { Money } from "@/core/money";
import type { UiTransportState } from "@/ui";
import { MoneyMetric, formatMoney } from "./renderers";
import styles from "./balance-dashboard.module.css";

export function metricValue<T>(metric: MetricValue<T> | undefined): T | undefined {
  return metric?.status === "KNOWN" || metric?.status === "PARTIAL" ? metric.value : undefined;
}

export function visibleValue<T>(node: DisplayNode<T> | undefined): T | undefined {
  return node?.visibility === "VISIBLE" ? node.data : undefined;
}

export function stateValue<T>(state: UiTransportState<T>): T | undefined {
  if (state.status === "success") return state.response.data;
  return state.status === "error" ? state.previousData?.data : undefined;
}

export type AmountRow = {
  readonly id: string;
  readonly label: string;
  readonly amount: MetricValue<Money>;
  readonly share?: number;
  readonly attribution?: string;
  readonly tone?: "accent" | "secondary" | "neutral";
};

export function moneyAmount(value: Money): MetricValue<Money> {
  return { status: "KNOWN", value };
}

export function formatDelta(amount: Money): string {
  const formatted = formatMoney(amount);
  return Number(amount) > 0 ? `+${formatted}` : formatted;
}

export function chartMaximum(rows: readonly AmountRow[]) {
  return Math.max(1, ...rows.map((row) => Math.abs(Number(metricValue(row.amount) ?? 0))));
}

export function AmountBar({ row, maximum }: { readonly row: AmountRow; readonly maximum: number }) {
  const amount = metricValue(row.amount);
  return <span className={styles.amountBar} data-tone={row.tone}>
    <span className={styles.amountText}>
      <span title={row.label}>{row.label}{row.attribution && <small className={styles.attribution}>{row.attribution}</small>}</span>
      <span><MoneyMetric metric={row.amount} />{row.share === undefined ? null : <small>{Math.round(row.share * 100)} %</small>}</span>
    </span>
    {amount !== undefined && <span className={styles.barTrack} aria-hidden="true">
      <span style={{ width: `${Math.min(100, Math.abs(Number(amount)) / maximum * 100)}%` }} />
    </span>}
  </span>;
}

export function AmountBars({ rows, maximum = chartMaximum(rows) }: { readonly rows: readonly AmountRow[]; readonly maximum?: number }) {
  return <ul className={styles.plot}>{rows.map((row) => <li key={row.id}><AmountBar row={row} maximum={maximum} /></li>)}</ul>;
}

export function DetailGroup({ title, note, children }: {
  readonly title: string;
  readonly note?: ReactNode;
  readonly children: ReactNode;
}) {
  return <section className={styles.detailGroup} aria-label={title}>
    <h3>{title}</h3>
    {note && <p className={styles.note}>{note}</p>}
    {children}
  </section>;
}

export function DetailRows<T>({ items, size = 3, label, children }: {
  readonly items: readonly T[];
  readonly size?: number;
  readonly label: string;
  readonly children: (items: readonly T[]) => ReactNode;
}) {
  if (!items.length) return <p className={styles.note}>Aucun élément pour ce mois.</p>;
  if (items.length <= size) return <>{children(items)}</>;
  return <div className={styles.detailRail} tabIndex={0} role="group" aria-label={label}>
    {Array.from({ length: Math.ceil(items.length / size) }, (_, index) =>
      <div key={index}>{children(items.slice(index * size, (index + 1) * size))}</div>)}
  </div>;
}
