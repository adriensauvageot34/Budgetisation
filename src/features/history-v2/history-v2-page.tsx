"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { useRouter } from "next/navigation";
import type { MinimalPreviewReadModel } from "@/query-api";
import { queryResourceKeys } from "@/query-api";
import { useQueryRuntime } from "@/components/runtime/query-client";
import type { YearMonth } from "@/core/time";
import { BalanceMonthView } from "./balance-view";
import { CalendarMonthView, WeekView } from "./calendar-view";
import { HistoryShell } from "./history-shell";
import { HistoryOverlayHost } from "./overlay-host";
import { DisplayState, StateBoundary, formatMoney } from "./renderers";
import { historyV2Href, overlayTargetKey } from "./route-state";
import { historyTransientDismissEvent, type HistoryOverlayTarget, type HistoryV2InitialState, type HistoryV2View } from "./types";
import styles from "./history-v2.module.css";

export function HistoryV2Page({
  month,
  view,
  initialState,
  initialOverlay,
}: {
  readonly month: YearMonth;
  readonly view: HistoryV2View;
  readonly initialState: HistoryV2InitialState;
  readonly initialOverlay?: HistoryOverlayTarget;
}) {
  const router = useRouter();
  const weekStart = initialState.kind === "week" ? initialState.weekStart : undefined;
  const [stack, setStack] = useState<readonly HistoryOverlayTarget[]>(() => initialOverlay === undefined ? [] : [initialOverlay]);
  const [minimalOpen, setMinimalOpen] = useState(false);
  const minimalInvoker = useRef<HTMLElement | null>(null);
  const focusByTarget = useRef(new Map<string, HTMLElement>());
  const overlayScrollByTarget = useRef(new Map<string, number>());
  const referenceMonth = initialState.kind === "week" && initialState.state.status === "success"
    ? initialState.state.response.data.referenceMonth
    : month;

  useEffect(() => {
    setStack((current) => {
      if (initialOverlay === undefined) return [];
      const key = overlayTargetKey(initialOverlay);
      if (current.at(-1) !== undefined && overlayTargetKey(current.at(-1)!) === key) return current;
      const existing = current.findIndex((target) => overlayTargetKey(target) === key);
      return existing >= 0 ? current.slice(0, existing + 1) : [initialOverlay];
    });
  }, [initialOverlay]);

  const navigate = (nextMonth: YearMonth, nextView: HistoryV2View, nextWeek?: import("@/core/time").LocalDate, overlay?: HistoryOverlayTarget, replace = false) => {
    const href = historyV2Href({ month: nextMonth, view: nextView, ...(nextWeek === undefined ? {} : { weekStart: nextWeek }), ...(overlay === undefined ? {} : { overlay }) });
    if (replace) router.replace(href, { scroll: false });
    else router.push(href, { scroll: false });
  };

  const openOverlay = (target: HistoryOverlayTarget) => {
    window.dispatchEvent(new Event(historyTransientDismissEvent));
    const key = overlayTargetKey(target);
    if (document.activeElement instanceof HTMLElement) focusByTarget.current.set(key, document.activeElement);
    const currentKey = stack.at(-1);
    if (currentKey !== undefined) {
      const content = document.querySelector<HTMLElement>(".ui-overlay-content");
      if (content !== null) overlayScrollByTarget.current.set(overlayTargetKey(currentKey), content.scrollTop);
    }
    setStack((current) => {
      const existing = current.findIndex((entry) => overlayTargetKey(entry) === key);
      return existing >= 0 ? current.slice(0, existing + 1) : [...current, target].slice(-6);
    });
    navigate(month, view, weekStart, target);
  };

  const closeOverlay = () => {
    const rootTarget = stack.at(0);
    setStack([]);
    navigate(month, view, weekStart, undefined, true);
    requestAnimationFrame(() => {
      if (rootTarget !== undefined) focusByTarget.current.get(overlayTargetKey(rootTarget))?.focus();
    });
  };

  const backOverlay = () => {
    const removed = stack.at(-1);
    const previous = stack.at(-2);
    setStack((current) => current.slice(0, -1));
    router.back();
    requestAnimationFrame(() => {
      if (removed !== undefined) focusByTarget.current.get(overlayTargetKey(removed))?.focus();
      if (previous !== undefined) {
        const content = document.querySelector<HTMLElement>(".ui-overlay-content");
        if (content !== null) content.scrollTop = overlayScrollByTarget.current.get(overlayTargetKey(previous)) ?? 0;
      }
    });
  };

  return (
    <div className={styles.page} data-history-v2="">
      <HistoryShell
        month={referenceMonth}
        view={view}
        onMonth={(nextMonth) => { window.dispatchEvent(new Event(historyTransientDismissEvent)); setStack([]); setMinimalOpen(false); navigate(nextMonth, view); }}
        onView={(nextView) => { window.dispatchEvent(new Event(historyTransientDismissEvent)); setStack([]); setMinimalOpen(false); navigate(referenceMonth, nextView); }}
      />
      <div className={styles.viewTransition} key={`${view}-${weekStart ?? "month"}`}>
        {initialState.kind === "calendar" ? <StateBoundary state={initialState.state}>{(model) => <CalendarMonthView model={model} onOverlay={openOverlay} onWeek={(nextWeek) => navigate(month, "calendar", nextWeek)} />}</StateBoundary> : null}
        {initialState.kind === "week" ? <StateBoundary state={initialState.state}>{(model) => <WeekView model={model} onOverlay={openOverlay} onMonth={() => navigate(month, "calendar")} onWeek={(nextWeek, referenceMonth) => navigate(referenceMonth, "calendar", nextWeek)} />}</StateBoundary> : null}
        {initialState.kind === "balance" ? <BalanceMonthView {...initialState} onOverlay={openOverlay} onMinimal={() => { window.dispatchEvent(new Event(historyTransientDismissEvent)); minimalInvoker.current = document.activeElement instanceof HTMLElement ? document.activeElement : null; setMinimalOpen(true); }} /> : null}
      </div>
      <HistoryOverlayHost month={month} stack={stack} onClose={closeOverlay} onBack={backOverlay} onPush={openOverlay} onReplace={(target) => { setStack((current) => [...current.slice(0, -1), target]); navigate(month, view, weekStart, target, true); }} />
      <MinimalPreviewPopover month={month} open={minimalOpen} onClose={() => { setMinimalOpen(false); requestAnimationFrame(() => minimalInvoker.current?.focus()); }} />
    </div>
  );
}

function MinimalPreviewPopover({ month, open, onClose }: { readonly month: YearMonth; readonly open: boolean; readonly onClose: () => void }) {
  const state = useQueryRuntime(open ? { resource: queryResourceKeys.historyMinimalPreview, scope: { subject: { kind: "household" as const }, time: { kind: "month" as const, month } }, params: {} } : null);
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
  if (!open || typeof document === "undefined") return null;
  return createPortal(<div className={styles.minimalBackdrop} onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className={styles.minimalPopover} role="dialog" aria-modal="true" aria-label="Composition Minimal"><header className={styles.popoverHeader}><h2>Composition Minimal</h2><button type="button" className={styles.iconButton} aria-label="Fermer" onClick={onClose}><X aria-hidden size={20} /></button></header><StateBoundary state={state}>{(model: MinimalPreviewReadModel) => <div><DisplayState node={model.minimalValue}>{(metric) => <div className={styles.actualCard}><span>Minimal</span><span className={styles.actualValue}>{metric.status === "KNOWN" || metric.status === "PARTIAL" ? formatMoney(metric.value) : "Indisponible"}</span></div>}</DisplayState><DisplayState node={model.preview}>{(preview) => <div className={styles.minimalFamilies}>{preview.families.map((family) => <article key={family.family}><strong>{family.family}</strong><span>{formatMoney(family.amount)}</span><p>{family.examples.slice(0, 3).map((item) => item.label).join(" · ")}</p></article>)}</div>}</DisplayState></div>}</StateBoundary></section></div>, document.body);
}
