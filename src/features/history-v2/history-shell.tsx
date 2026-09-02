"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  calendarFilterPresetRegistry,
  type CalendarFilterPreset,
} from "@/core/history-v2";
import { addMonths, formatYearMonth, type YearMonth } from "@/core/time";
import type { MonthHighlightReadModel, MonthNarrativeCard, MonthQuickOverviewReadModel } from "@/query-api";
import type { UiTransportState } from "@/ui";
import { DisplayState, MoneyMetric, StateBoundary } from "./renderers";
import { compactNarrativeTitle, formatFrenchDateRange } from "./presentation";
import { overlayTargetFromQueryTarget } from "./route-state";
import { HistorySemanticIcon } from "./semantic-icon";
import { historyTransientDismissEvent, type HistoryCalendarFilterState, type HistoryOverlayTarget, type HistoryV2View } from "./types";
import styles from "./history-v2.module.css";

const presetLabels: Readonly<Record<CalendarFilterPreset, string>> = {
  all: "Tout",
  daily: "Quotidien",
  highlights: "Temps forts",
  "exclude-fixed": "Sans charges fixes",
  expenses: "Dépenses",
};

export function HistoryShell({
  month,
  view,
  overview,
  filters,
  onMonth,
  onView,
  onFilters,
  onOverlay,
}: {
  readonly month: YearMonth;
  readonly view: HistoryV2View;
  readonly overview: UiTransportState<MonthQuickOverviewReadModel>;
  readonly filters: HistoryCalendarFilterState;
  readonly onMonth: (month: YearMonth) => void;
  readonly onView: (view: HistoryV2View) => void;
  readonly onFilters: (filters: HistoryCalendarFilterState) => void;
  readonly onOverlay: (target: HistoryOverlayTarget) => void;
}) {
  const [filtersOpen, setFiltersOpen] = useState(false);
  const filterRegionRef = useRef<HTMLDivElement>(null);
  const filterTriggerRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!filtersOpen) return undefined;
    const dismiss = () => {
      setFiltersOpen(false);
      requestAnimationFrame(() => filterTriggerRef.current?.focus());
    };
    const onPointerDown = (event: PointerEvent) => {
      if (!(event.target instanceof Node) || !filterRegionRef.current?.contains(event.target)) dismiss();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      dismiss();
      filterTriggerRef.current?.focus();
    };
    window.addEventListener(historyTransientDismissEvent, dismiss);
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener(historyTransientDismissEvent, dismiss);
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [filtersOpen]);
  const choosePreset = (preset: CalendarFilterPreset) => {
    onFilters({
      preset,
      tags: calendarFilterPresetRegistry[preset].tags,
      amount: calendarFilterPresetRegistry[preset].amount,
    });
    setFiltersOpen(false);
    requestAnimationFrame(() => filterTriggerRef.current?.focus());
  };
  const configuredPreset = calendarFilterPresetRegistry[filters.preset];
  const selectedPreset = filters.customSelection === true
    || filters.amount !== configuredPreset.amount
    || filters.tags.join(",") !== configuredPreset.tags.join(",")
    ? undefined
    : filters.preset;
  const monthLabel = formatYearMonth(month);
  const accessibleMonthLabel = `${monthLabel[0]!.toLocaleLowerCase("fr-FR")}${monthLabel.slice(1)}`;
  return (
    <header className={styles.shell} data-focus-restoration-fallback="">
      <div className={styles.segmented} data-view={view} role="tablist" aria-label="Vue de l’historique">
        <button type="button" role="tab" aria-selected={view === "calendar"} onClick={() => { if (view !== "calendar") onView("calendar"); }}>Calendrier</button>
        <button type="button" role="tab" aria-selected={view === "balance"} onClick={() => { if (view !== "balance") onView("balance"); }}>Bilan</button>
      </div>
      <StateBoundary state={overview} skeleton={<div className={styles.headerSkeleton} />}>
        {(model) => <div className={styles.shellFlows}>
          <HeaderFlow label="Débits" node={model.flows.bankOutflows} />
          <HeaderFlow label="Dépenses" node={model.flows.economicActual} />
        </div>}
      </StateBoundary>
      <div ref={filterRegionRef} className={styles.monthNavigation}>
        <button type="button" className={styles.iconButton} aria-label="Mois précédent" onClick={() => onMonth(addMonths(month, -1))}><ChevronLeft aria-hidden size={20} /></button>
        {view === "calendar"
          ? <button ref={filterTriggerRef} type="button" className={styles.monthFilterTrigger} aria-label={`Ouvrir les filtres de ${accessibleMonthLabel}`} aria-expanded={filtersOpen} aria-haspopup="dialog" onClick={() => { if (!filtersOpen) window.dispatchEvent(new Event(historyTransientDismissEvent)); setFiltersOpen((open) => !open); }}>{monthLabel}</button>
          : <strong className={styles.monthTitle}>{monthLabel}</strong>}
        <button type="button" className={styles.iconButton} aria-label="Mois suivant" onClick={() => onMonth(addMonths(month, 1))}><ChevronRight aria-hidden size={20} /></button>
        {view === "calendar" && filtersOpen ? <div className={styles.filterPanel} role="dialog" aria-label={`Filtres de ${accessibleMonthLabel}`}>
          <div className={styles.filterPresets}>{(Object.keys(presetLabels) as CalendarFilterPreset[]).map((preset) => <button type="button" key={preset} aria-pressed={selectedPreset === preset} onClick={() => choosePreset(preset)}>{presetLabels[preset]}</button>)}</div>
        </div> : null}
      </div>
      <StateBoundary state={overview} skeleton={<div className={styles.headerSkeleton} />}>
        {(model) => <NarrativeCarousel model={model} onOverlay={onOverlay} />}
      </StateBoundary>
    </header>
  );
}

function HeaderFlow({ label, node }: { readonly label: string; readonly node: MonthQuickOverviewReadModel["flows"][keyof MonthQuickOverviewReadModel["flows"]] }) {
  return <DisplayState node={node}>{(metric) => <div className={styles.headerFlow}><span>{label}</span><MoneyMetric metric={metric} partialDisplay="value-only" /></div>}</DisplayState>;
}

function NarrativeCarousel({ model, onOverlay }: { readonly model: MonthQuickOverviewReadModel; readonly onOverlay: (target: HistoryOverlayTarget) => void }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const hasCurrentNarrative = "narrativeCarousel" in model && model.narrativeCarousel !== undefined;
  const current = hasCurrentNarrative && model.narrativeCarousel.visibility === "VISIBLE"
    && (model.narrativeCarousel.data.status === "KNOWN" || model.narrativeCarousel.data.status === "PARTIAL")
    ? model.narrativeCarousel.data.items
    : [];
  const legacy = !hasCurrentNarrative && model.highlights.visibility === "VISIBLE"
    && (model.highlights.data.status === "KNOWN" || model.highlights.data.status === "PARTIAL")
    ? model.highlights.data.items.map((highlight) => ({ ...highlight, cardId: `legacy-event:${highlight.highlightId}`, kind: "EVENT" as const }))
    : [];
  const published: readonly (MonthNarrativeCard | (MonthHighlightReadModel & { readonly cardId: string; readonly kind: "EVENT" }))[] = current.length > 0 ? current : legacy;
  useEffect(() => {
    if (paused || published.length < 2) return undefined;
    const timer = window.setInterval(() => setIndex((current) => (current + 1) % published.length), 7_000);
    return () => window.clearInterval(timer);
  }, [paused, published.length]);
  if (published.length === 0) return <div className={styles.narrativeEmpty}>Aucun temps fort publié</div>;
  const safeIndex = index % published.length;
  const card = published[safeIndex]!;
  const target = "targetRef" in card ? overlayTargetFromQueryTarget(card.targetRef) : undefined;
  return <section className={styles.headerNarrative} aria-roledescription="carrousel" aria-label="Temps forts et lieux du mois" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} onFocus={() => setPaused(true)} onBlur={(event) => { if (!(event.relatedTarget instanceof Node) || !event.currentTarget.contains(event.relatedTarget)) setPaused(false); }}>
    <button type="button" className={`${styles.iconButton} ${styles.carouselControl}`} aria-label="Carte précédente" disabled={published.length < 2} onClick={() => setIndex((safeIndex - 1 + published.length) % published.length)}><ChevronLeft aria-hidden size={18} /></button>
    <button type="button" className={styles.narrativeCard} disabled={target === undefined} onClick={() => { if (target !== undefined) onOverlay(target); }}>
      <span className={styles.narrativeVisual}><HistorySemanticIcon iconKey={card.iconKey} /></span>
      <span className={styles.narrativeCopy}><strong>{card.kind === "EVENT" ? compactNarrativeTitle(card.title, card.startDate, card.endDate) : card.title}</strong><small>{narrativeSubtitle(card)}</small></span>
      <NarrativeAmount card={card} />
    </button>
    <button type="button" className={`${styles.iconButton} ${styles.carouselControl}`} aria-label="Carte suivante" disabled={published.length < 2} onClick={() => setIndex((safeIndex + 1) % published.length)}><ChevronRight aria-hidden size={18} /></button>
  </section>;
}

function NarrativeAmount({ card }: { readonly card: MonthNarrativeCard | (MonthHighlightReadModel & { readonly kind: "EVENT" }) }) {
  const node = card.kind === "EVENT" ? card.causalCost : card.localizedAmount;
  if (node.visibility !== "VISIBLE") return null;
  const metric = node.data;
  if (metric.status !== "KNOWN" && metric.status !== "PARTIAL") return null;
  return <span className={styles.narrativeAmount}><MoneyMetric metric={metric} partialDisplay="value-only" /></span>;
}

function narrativeSubtitle(card: MonthNarrativeCard | (MonthHighlightReadModel & { readonly kind: "EVENT" })): string {
  if (card.kind === "EVENT") return `${formatFrenchDateRange(card.startDate, card.endDate)}${card.placeLabel === undefined ? "" : ` · ${card.placeLabel}`}`;
  if (card.presenceDays !== undefined) return `${card.presenceDays} jour${card.presenceDays > 1 ? "s" : ""} de présence`;
  if (card.visitCount !== undefined) return `${card.visitCount} visite${card.visitCount > 1 ? "s" : ""}`;
  return "Lieu du mois";
}
