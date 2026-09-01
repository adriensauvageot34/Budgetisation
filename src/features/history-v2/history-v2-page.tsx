"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { YearMonth } from "@/core/time";
import { CalendarMonthView, WeekView } from "./calendar-view";
import { HistoryShell } from "./history-shell";
import { HistoryOverlayHost } from "./overlay-host";
import { StateBoundary } from "./renderers";
import { historyV2Href, overlayTargetKey } from "./route-state";
import { historyTransientDismissEvent, type HistoryCalendarFilterState, type HistoryOverlayTarget, type HistoryV2InitialState, type HistoryV2View } from "./types";
import styles from "./history-v2.module.css";

export function HistoryV2Page({
  month,
  view,
  filters,
  initialState,
  initialOverlay,
}: {
  readonly month: YearMonth;
  readonly view: HistoryV2View;
  readonly filters: HistoryCalendarFilterState;
  readonly initialState: HistoryV2InitialState;
  readonly initialOverlay?: HistoryOverlayTarget;
}) {
  const router = useRouter();
  const weekStart = initialState.kind === "week" ? initialState.weekStart : undefined;
  const [stack, setStack] = useState<readonly HistoryOverlayTarget[]>(() => initialOverlay === undefined ? [] : [initialOverlay]);
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

  const navigate = (nextMonth: YearMonth, nextView: HistoryV2View, nextWeek?: import("@/core/time").LocalDate, overlay?: HistoryOverlayTarget, replace = false, nextFilters = filters) => {
    const href = historyV2Href({ month: nextMonth, view: nextView, filters: nextFilters, ...(nextWeek === undefined ? {} : { weekStart: nextWeek }), ...(overlay === undefined ? {} : { overlay }) });
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
        overview={initialState.overview}
        filters={filters}
        onFilters={(nextFilters) => navigate(referenceMonth, view, weekStart, stack.at(-1), true, nextFilters)}
        onOverlay={openOverlay}
        onMonth={(nextMonth) => { window.dispatchEvent(new Event(historyTransientDismissEvent)); setStack([]); navigate(nextMonth, view); }}
      />
      <div className={styles.viewTransition} key={`${view}-${weekStart ?? "month"}`}>
        {initialState.kind === "calendar" ? <StateBoundary state={initialState.state}>{(model) => <CalendarMonthView model={model} filters={filters} onOverlay={openOverlay} onWeek={(nextWeek) => navigate(month, "calendar", nextWeek)} />}</StateBoundary> : null}
        {initialState.kind === "week" ? <StateBoundary state={initialState.state}>{(model) => <WeekView model={model} filters={filters} onOverlay={openOverlay} onMonth={() => navigate(month, "calendar")} onWeek={(nextWeek, nextReferenceMonth) => navigate(nextReferenceMonth, "calendar", nextWeek)} />}</StateBoundary> : null}
      </div>
      <HistoryOverlayHost month={month} stack={stack} onClose={closeOverlay} onBack={backOverlay} onPush={openOverlay} onReplace={(target) => { setStack((current) => [...current.slice(0, -1), target]); navigate(month, view, weekStart, target, true); }} />
    </div>
  );
}
