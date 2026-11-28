"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { ChevronDown, X } from "lucide-react";
import { ClayIcon } from "@/components/layout/clay-icon";
import { DensityAtom, useAdaptiveColumn } from "@/components/layout/content-density";
import { useLayoutMotion } from "@/components/layout/use-layout-motion";
import { usePlannedExpenseInteractions } from "./planned-expense-interactions";
import styles from "./forecast-dashboard.module.css";

export type ForecastRow = {
  id: string;
  label: string;
  value?: string;
  note?: string;
  amount?: string | number | null;
  detail?: ReactNode;
};

export type ForecastModule = {
  id: string;
  title: string;
  anchor?: string;
  icon: "expenses" | "events" | "overview" | "categories" | "groceries";
  value?: string;
  note?: string;
  rows: readonly ForecastRow[];
};

const motionType = "forecast-layout";
const desktop = "(min-width: 900px) and (min-height: 570px)";

export function ForecastDashboard({ columns, header, plannedRow }: {
  columns: readonly [readonly ForecastModule[], readonly ForecastModule[]];
  header?: ReactNode;
  plannedRow?: string;
}) {
  const [selection, setSelection] = useState<{ module: string; row: string }>();
  const { revision, changeLayout } = useLayoutMotion(motionType);
  const left = useAdaptiveColumn(revision, "[data-forecast-detail]", motionType, desktop);
  const right = useAdaptiveColumn(revision, "[data-forecast-detail]", motionType, desktop);
  const detailTitle = useRef<HTMLHeadingElement>(null);
  const returnTo = useRef<HTMLElement>(null);
  const detailId = useId();
  const pendingExpense = usePlannedExpenseInteractions()?.pending;

  useEffect(() => {
    if (!pendingExpense || !plannedRow) return;
    const frame = requestAnimationFrame(() => {
      if (selection?.module === "projects" && selection.row === plannedRow) return;
      returnTo.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      changeLayout(() => setSelection({ module: "projects", row: plannedRow }));
    });
    return () => cancelAnimationFrame(frame);
  }, [pendingExpense, plannedRow, selection, changeLayout]);

  useLayoutEffect(() => {
    if (selection) detailTitle.current?.focus({ preventScroll: true });
    else if (returnTo.current) {
      returnTo.current.focus({ preventScroll: true });
      returnTo.current = null;
    }
  }, [selection]);

  function close() {
    changeLayout(() => setSelection(undefined));
  }

  return <div className={styles.dashboard} data-forecast-workspace data-month-story onKeyDown={event => {
    if (event.key === "Escape" && !event.defaultPrevented && selection) {
      event.preventDefault();
      close();
    }
  }}>
    {header && <div className={styles.header}>{header}</div>}
    <div className={styles.grid} data-focus-side={selection && (columns[0].some(module => module.id === selection.module) ? "left" : "right")}>
      {columns.map((modules, index) => <div key={index} ref={index === 0 ? left : right} className={styles.column} data-forecast-column>
        {modules.map(module => {
          const active = selection?.module === module.id;
          const highest = Math.max(0, ...module.rows.map(row => Math.abs(Number(row.amount ?? 0))));
          return <section key={module.id} className={styles.module} style={{ "--forecast-transition": "forecast-" + module.id } as CSSProperties} data-forecast-module={module.id} data-adaptive-region
            id={module.anchor} data-adaptive-active={active || undefined} aria-labelledby={detailId + "-" + module.id}>
            <div className={styles.flow} data-adaptive-flow>
              <DensityAtom name="heading" minimum={1} priority={75} className={styles.atom} motionClassName={styles.atomBody}>
                <div className={styles.moduleHeading}>
                  <h2 className={styles.title} id={detailId + "-" + module.id}>
                    <ClayIcon name={module.icon} size={32} />
                    {module.title}
                  </h2>
                  {module.value && <strong className={styles.total}>{module.value}</strong>}
                </div>
                {module.note && <p className={styles.note}>{module.note}</p>}
              </DensityAtom>
              {module.rows.map((row, rowIndex) => {
                const open = active && selection.row === row.id;
                const percent = highest && row.amount != null ? Math.abs(Number(row.amount)) / highest : null;
                const trigger = <>
                  <span>{row.label}{row.note && <small>{row.note}</small>}</span>
                  {row.value && <strong>{row.value}</strong>}
                  {row.detail && <ChevronDown aria-hidden size={14} />}
                  {percent !== null && <i aria-hidden="true"><b style={{ width: (percent * 100) + "%" }} /></i>}
                </>;
                return <DensityAtom key={row.id} name={row.id} minimum={1}
                  priority={open ? 220 : 112 - Math.min(rowIndex, 28) * 3} className={styles.atom} motionClassName={styles.atomBody}>
                  <div className={styles.line} data-row-open={open || undefined}>
                    {row.detail ? <button type="button" className={styles.row} aria-expanded={open} aria-controls={open ? detailId : undefined}
                      onClick={event => {
                        if (open) close();
                        else {
                          returnTo.current = event.currentTarget;
                          changeLayout(() => setSelection({ module: module.id, row: row.id }));
                        }
                      }}>{trigger}</button> : <div className={styles.row}>{trigger}</div>}
                    {open && <section className={styles.detail} id={detailId} aria-labelledby={detailId + "-title"} data-budget-reveal>
                      <header>
                        <h3 tabIndex={-1} ref={detailTitle} id={detailId + "-title"}>{row.label}</h3>
                        <button type="button" aria-label="Fermer le détail" onClick={close}><X aria-hidden size={17} /></button>
                      </header>
                      <div className={styles.detailBody} data-forecast-detail>{row.detail}</div>
                    </section>}
                  </div>
                </DensityAtom>;
              })}
            </div>
          </section>;
        })}
      </div>)}
    </div>
  </div>;
}

export function ForecastFacts({ rows }: { rows: readonly (readonly [string, ReactNode])[] }) {
  return <dl className={styles.facts}>{rows.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>;
}

export function ForecastLines({ rows }: { rows: readonly { id: string; label: string; value: string; note?: string }[] }) {
  return <ul className={styles.detailLines}>{rows.map(row => <li key={row.id}>
    <span>{row.label}{row.note && <small>{row.note}</small>}</span><strong>{row.value}</strong>
  </li>)}</ul>;
}
