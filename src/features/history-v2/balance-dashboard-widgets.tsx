"use client";

import { createContext, useContext, useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp } from "lucide-react";
import { BalanceLayout } from "./balance-density";
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

export const BalanceCollections = createContext<{
  readonly open?: string;
  readonly setOpen: (key: string | undefined) => void;
}>({ setOpen: () => {} });

export function DetailRows<T>({ items, size = 4, label, listKey, cards = false, children }: {
  readonly items: readonly T[];
  readonly size?: number;
  readonly label: string;
  readonly listKey?: string;
  readonly cards?: boolean;
  readonly children: (items: readonly T[]) => ReactNode;
}) {
  const id = useId();
  const key = listKey ?? id;
  const { open, setOpen } = useContext(BalanceCollections);
  const changeLayout = useContext(BalanceLayout);
  const [offset, setOffset] = useState(0);
  const toggle = useRef<HTMLButtonElement>(null);
  const restore = useRef(false);
  const expanded = open === key;
  const limit = cards ? 8 : 12;
  const start = Math.min(offset, Math.max(0, Math.ceil(items.length / limit) - 1) * limit);
  const visible = expanded ? items.slice(start, start + limit) : items.slice(0, size);

  useLayoutEffect(() => {
    if (!restore.current) return;
    restore.current = false;
    toggle.current?.focus({ preventScroll: true });
  }, [expanded]);

  function toggleList() {
    restore.current = true;
    changeLayout(() => {
      setOffset(0);
      setOpen(expanded ? undefined : key);
    });
  }

  if (!items.length) return <p className={styles.note}>Aucun élément pour ce mois.</p>;
  if (items.length <= size && !expanded) return <>{children(items)}</>;
  return <div className={styles.collection} data-collection-open={expanded || undefined} onKeyDown={event => {
    if (event.key !== "Escape" || !expanded) return;
    event.stopPropagation();
    event.preventDefault();
    toggleList();
  }}>
    <div className={expanded && !cards ? styles.collectionGrid : undefined} id={id}>
      {expanded && !cards
        ? Array.from({ length: Math.ceil(visible.length / 4) }, (_, index) => <div key={index}>{children(visible.slice(index * 4, (index + 1) * 4))}</div>)
        : children(visible)}
    </div>
    <div className={styles.collectionActions}>
      <button type="button" className={styles.collectionToggle} ref={toggle} aria-expanded={expanded} aria-controls={id} onClick={toggleList}>
        {expanded ? <ChevronUp size={13} aria-hidden /> : <ChevronDown size={13} aria-hidden />}
        {expanded ? "Réduire la liste" : items.length <= limit ? "Tout afficher" : "Afficher la liste"}
        {!expanded && <small>{items.length}</small>}
        <span className="sr-only"> · {label}</span>
      </button>
      {expanded && items.length > limit && <div className={styles.collectionNavigation} role="group" aria-label={label}>
        <button type="button" disabled={start === 0} onClick={() => changeLayout(() => setOffset(start - limit))}>
          <ChevronLeft size={13} aria-hidden /> Précédents
        </button>
        <span aria-live="polite">{start + 1}–{start + visible.length} sur {items.length}</span>
        <button type="button" disabled={start + limit >= items.length} onClick={() => changeLayout(() => setOffset(start + limit))}>
          Suivants <ChevronRight size={13} aria-hidden />
        </button>
      </div>}
    </div>
  </div>;
}
