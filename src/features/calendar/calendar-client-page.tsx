"use client";

import { useEffect, useRef, useState } from "react";
import type { LocalDate, YearMonth } from "@/core/time";
import type { CalendarWeekRef, NavigationController, ScrollAdapter, ScrollContainerRef } from "@/navigation";
import {
  BrowserAnchorRegistry,
  InMemoryNavigationSessionStore,
  RestorationCoordinator,
  WebBrowserHistoryAdapter,
  WebRootRouterAdapter,
  createNavigationController,
} from "@/navigation";
import { CalendarMonth, CalendarTwelveMonths, CalendarWeek } from "./calendar-view";
import { DayDetailDrawer } from "./day-drawer";

class CalendarBrowserScrollAdapter implements ScrollAdapter {
  private element(container: ScrollContainerRef): HTMLElement | null {
    return container.kind === "day_drawer"
      ? document.querySelector<HTMLElement>("[data-overlay-kind='day_drawer'] [data-overlay-content]")
      : document.scrollingElement as HTMLElement | null;
  }

  getScrollY(container: ScrollContainerRef): number {
    const element = this.element(container);
    return element?.scrollTop ?? window.scrollY;
  }

  scrollTo(container: ScrollContainerRef, y: number): void {
    const element = this.element(container);
    if (element) element.scrollTo({ top: y });
    else window.scrollTo({ top: y });
  }

  getAnchorTop(container: ScrollContainerRef, element: HTMLElement): number {
    const scroller = this.element(container);
    const scrollerTop = scroller?.getBoundingClientRect().top ?? 0;
    return element.getBoundingClientRect().top - scrollerTop + (scroller?.scrollTop ?? window.scrollY);
  }
}

function useCalendarController(): NavigationController | null {
  const [controller, setController] = useState<NavigationController | null>(null);
  useEffect(() => {
    const scroll = new CalendarBrowserScrollAdapter();
    const anchors = new BrowserAnchorRegistry();
    const next = createNavigationController({
      router: new WebRootRouterAdapter(window),
      history: new WebBrowserHistoryAdapter(window),
      session: new InMemoryNavigationSessionStore(),
      surface: {
        readScope: () => null,
        applyScope: () => undefined,
        readSubview: () => null,
        applySubview: () => undefined,
      },
      restoration: new RestorationCoordinator(anchors, scroll),
      readiness: { wait: async () => ({ kind: "ready" }) },
      scroll,
      anchors,
      compatibility: { categoryIds: true, activityIds: true },
    });
    next.start();
    setController(next);
    return () => next.dispose();
  }, []);
  return controller;
}

export type CalendarClientPageProps =
  | { readonly kind: "overview" }
  | { readonly kind: "month"; readonly month: YearMonth; readonly day?: LocalDate }
  | { readonly kind: "week"; readonly month: YearMonth; readonly week: CalendarWeekRef };

export function CalendarClientPage(props: CalendarClientPageProps) {
  const controller = useCalendarController();
  const rootRef = useRef<HTMLDivElement>(null);
  if (props.kind === "overview") {
    return <CalendarTwelveMonths state={{ status: "loading" }} navigation={controller ?? undefined} />;
  }
  if (props.kind === "week") {
    return <CalendarWeek month={props.month} week={props.week} state={{ status: "loading" }} navigation={controller ?? undefined} />;
  }
  return (
    <>
      <div ref={rootRef} data-focus-restoration-fallback="">
        <CalendarMonth state={{ status: "loading" }} navigation={controller ?? undefined} />
      </div>
      {props.day && controller ? (
        <DayDetailDrawer
          date={props.day}
          state={{ status: "loading" }}
          navigation={controller}
          backgroundRootRef={rootRef}
        />
      ) : null}
    </>
  );
}
