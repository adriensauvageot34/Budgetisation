"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, ChevronLeft, ChevronRight, X } from "lucide-react";
import { addMonths, formatYearMonth, type YearMonth } from "@/core/time";
import type { MonthQuickOverviewReadModel } from "@/query-api";
import { queryResourceKeys } from "@/query-api";
import { useQueryRuntime } from "@/components/runtime/query-client";
import { CollectionState, DisplayState, MetricState, MoneyMetric, StateBoundary, formatMoney } from "./renderers";
import { formatFrenchDateRange, formatLifeMarkerCount } from "./presentation";
import { historyTransientDismissEvent, type HistoryV2View } from "./types";
import styles from "./history-v2.module.css";

export function HistoryShell({
  month,
  view,
  onMonth,
  onView,
}: {
  readonly month: YearMonth;
  readonly view: HistoryV2View;
  readonly onMonth: (month: YearMonth) => void;
  readonly onView: (view: HistoryV2View) => void;
}) {
  const [overviewOpen, setOverviewOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  return (
    <header className={styles.shell} data-focus-restoration-fallback="">
      <div className={styles.segmented} data-view={view} role="tablist" aria-label="Vue Historique">
        <button role="tab" aria-selected={view === "calendar"} onKeyDown={(event) => { if (event.key === "ArrowRight") { event.preventDefault(); onView("balance"); } }} onClick={() => onView("calendar")}>Calendrier</button>
        <button role="tab" aria-selected={view === "balance"} onKeyDown={(event) => { if (event.key === "ArrowLeft") { event.preventDefault(); onView("calendar"); } }} onClick={() => onView("balance")}>Bilan du mois</button>
      </div>
      <div className={styles.monthNavigation}>
        <button type="button" className={styles.iconButton} aria-label="Mois précédent" onClick={() => onMonth(addMonths(month, -1))}><ChevronLeft aria-hidden size={20} /></button>
        <button ref={triggerRef} type="button" className={styles.monthTitle} aria-expanded={overviewOpen} aria-haspopup="dialog" onClick={() => { if (!overviewOpen) window.dispatchEvent(new Event(historyTransientDismissEvent)); setOverviewOpen((open) => !open); }}>
          {formatYearMonth(month)} <ChevronDown aria-hidden size={18} />
        </button>
        <button type="button" className={styles.iconButton} aria-label="Mois suivant" onClick={() => onMonth(addMonths(month, 1))}><ChevronRight aria-hidden size={20} /></button>
      </div>
      <div aria-hidden className={styles.shellBalance} />
      <MonthOverviewPopover month={month} view={view} open={overviewOpen} onView={onView} onClose={() => { setOverviewOpen(false); requestAnimationFrame(() => triggerRef.current?.focus()); }} />
    </header>
  );
}

function MonthOverviewPopover({ month, view, open, onView, onClose }: { readonly month: YearMonth; readonly view: HistoryV2View; readonly open: boolean; readonly onView: (view: HistoryV2View) => void; readonly onClose: () => void }) {
  const [mounted, setMounted] = useState(false);
  const request = open ? {
    resource: queryResourceKeys.historyMonthOverview,
    scope: { subject: { kind: "household" as const }, time: { kind: "month" as const, month } },
    params: {},
  } : null;
  const state = useQueryRuntime(request);
  useEffect(() => setMounted(true), []);
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") { event.preventDefault(); onClose(); } };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  useEffect(() => {
    const dismiss = () => {
      if (open) onClose();
    };
    window.addEventListener(historyTransientDismissEvent, dismiss);
    return () => window.removeEventListener(historyTransientDismissEvent, dismiss);
  }, [open, onClose]);
  if (!open || !mounted) return null;
  return createPortal(
    <div className={styles.overviewBackdrop} role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className={styles.overviewPopover} role="dialog" aria-modal="true" aria-label={`Aperçu de ${formatYearMonth(month)}`}>
        <div className={styles.popoverHeader}><div><span className="eyebrow">Aperçu du mois</span><h2>{formatYearMonth(month)}</h2></div><button className={styles.iconButton} aria-label="Fermer l’aperçu" onClick={onClose}><X aria-hidden size={20} /></button></div>
        <StateBoundary state={state} skeleton={<div className={styles.overviewSkeleton} aria-label="Chargement de l’aperçu" />}>
          {(model) => <OverviewContent model={model} view={view} onView={onView} onClose={onClose} />}
        </StateBoundary>
      </section>
    </div>,
    document.body,
  );
}

function OverviewContent({ model, view, onView, onClose }: { readonly model: MonthQuickOverviewReadModel; readonly view: HistoryV2View; readonly onView: (view: HistoryV2View) => void; readonly onClose: () => void }) {
  return (
    <div className={styles.overviewContent}>
      <div className={styles.overviewFlows}>
        <OverviewFlow label="Débits du compte" node={model.flows.bankOutflows} />
        <OverviewFlow label="Dépenses du mois" node={model.flows.economicActual} />
        <OverviewFlow label="Entrées sur le compte" node={model.flows.bankInflows} />
      </div>
      <DisplayState node={model.lifeMarkers}>
        {(collection) => <CollectionState collection={collection}>{(items) => <ul className={styles.lifeMarkers}>{items.map((item) => <li key={item.family}><span>{item.label}</span><DisplayState node={item.primaryValue}>{(metric) => <MetricState metric={metric} format={(value) => formatLifeMarkerCount(item.family, value)} />}</DisplayState></li>)}</ul>}</CollectionState>}
      </DisplayState>
      <DisplayState node={model.highlights}>
        {(collection) => <CollectionState collection={collection}>{(items) => <OverviewHighlights items={items} />}</CollectionState>}
      </DisplayState>
      {view === "calendar" ? <button type="button" className="button-primary" onClick={() => { onClose(); onView("balance"); }}>Ouvrir le Bilan du mois</button> : null}
    </div>
  );
}

function OverviewFlow({ label, node }: { readonly label: string; readonly node: MonthQuickOverviewReadModel["flows"][keyof MonthQuickOverviewReadModel["flows"]] }) {
  return <DisplayState node={node}>{(metric) => <div className={styles.overviewFlow}><span>{label}</span><MoneyMetric metric={metric} /></div>}</DisplayState>;
}

function OverviewHighlights({ items }: { readonly items: MonthQuickOverviewReadModel["highlights"] extends infer _ ? readonly import("@/query-api").MonthHighlightReadModel[] : never }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const safeIndex = items.length === 0 ? 0 : index % items.length;
  useEffect(() => {
    if (paused || items.length < 2) return;
    const timer = window.setInterval(() => setIndex((value) => (value + 1) % items.length), 7000);
    return () => window.clearInterval(timer);
  }, [items.length, paused]);
  if (items.length === 0) return null;
  const item = items[safeIndex]!;
  const select = (next: number) => { setPaused(true); setIndex((next + items.length) % items.length); };
  return (
    <section className={styles.highlightCarousel} aria-roledescription="carrousel" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
      <article key={item.highlightId} className={styles.highlightCard}>
        <div><span className="eyebrow">Temps fort</span><h3>{item.title}</h3><p>{formatFrenchDateRange(item.startDate, item.endDate)}{item.placeLabel ? ` · ${item.placeLabel}` : ""}</p></div>
        <div><span>Dépenses liées</span><DisplayState node={item.causalCost}>{(metric) => <MoneyMetric metric={metric} />}</DisplayState></div>
      </article>
      {items.length > 1 ? <div className={styles.carouselControls}><button className={styles.iconButton} aria-label="Temps fort précédent" onClick={() => select(safeIndex - 1)}><ChevronLeft aria-hidden size={18} /></button><div role="tablist" aria-label="Temps forts">{items.map((entry, itemIndex) => <button key={entry.highlightId} role="tab" aria-selected={itemIndex === safeIndex} aria-label={`Temps fort ${itemIndex + 1}`} onClick={() => select(itemIndex)} />)}</div><button className={styles.iconButton} aria-label="Temps fort suivant" onClick={() => select(safeIndex + 1)}><ChevronRight aria-hidden size={18} /></button></div> : null}
    </section>
  );
}
