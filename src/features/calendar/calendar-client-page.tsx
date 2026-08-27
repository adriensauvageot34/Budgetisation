"use client";

import { useMemo, useRef } from "react";
import type { AnalysisSubject } from "@/core/scope";
import type { LocalDate, YearMonth } from "@/core/time";
import { useProductRuntime, useProductSurface } from "@/components/runtime";
import { scopeForRoot, type CalendarWeekRef, type RootNavigationContext } from "@/navigation";
import type { HistoryCalendarMonthReadModel, HistoryDayDetailReadModel } from "@/query-api";
import type { UiTransportState } from "@/ui";
import { CalendarMonth, CalendarWeek } from "./calendar-view";
import { DayDetailDrawer } from "./day-drawer";
import type { CalendarPerson } from "./types";

export type CalendarClientPageProps =
  | {
      readonly kind: "month";
      readonly subject: AnalysisSubject;
      readonly persons: readonly CalendarPerson[];
      readonly adjacentMonths: { readonly previous?: YearMonth; readonly next?: YearMonth };
      readonly month: YearMonth;
      readonly day?: LocalDate;
      readonly state: UiTransportState<HistoryCalendarMonthReadModel>;
      readonly dayState?: UiTransportState<HistoryDayDetailReadModel>;
    }
  | {
      readonly kind: "week";
      readonly subject: AnalysisSubject;
      readonly persons: readonly CalendarPerson[];
      readonly month: YearMonth;
      readonly week: CalendarWeekRef;
      readonly state: UiTransportState<readonly HistoryCalendarMonthReadModel[]>;
    };

export function CalendarClientPage(props: CalendarClientPageProps) {
  const runtime = useProductRuntime();
  const controller = runtime.controller;
  const navigation = useMemo(() => controller === null ? undefined : {
    openCalendarMonth: (month: YearMonth) => runtime.run((value) => value.openCalendarMonth(month)) as ReturnType<typeof controller.openCalendarMonth>,
    openCalendarWeek: (month: YearMonth, week: CalendarWeekRef) => runtime.run((value) => value.openCalendarWeek(month, week)) as ReturnType<typeof controller.openCalendarWeek>,
    openDay: (date: LocalDate) => runtime.run((value) => value.openDay(date)) as ReturnType<typeof controller.openDay>,
    closeDay: () => runtime.run((value) => value.closeDay()) as ReturnType<typeof controller.closeDay>,
    previousDay: () => runtime.run((value) => value.previousDay()) as ReturnType<typeof controller.previousDay>,
    nextDay: () => runtime.run((value) => value.nextDay()) as ReturnType<typeof controller.nextDay>,
    openExploration: (node: Parameters<typeof controller.openExploration>[0]) => runtime.run((value) => value.openExploration(node)) as ReturnType<typeof controller.openExploration>,
    goToAnalysis: () => runtime.run((value) => value.goToAnalysis()) as Promise<Awaited<ReturnType<typeof controller.goToAnalysis>>>,
  }, [controller, runtime]);
  const rootRef = useRef<HTMLDivElement>(null);
  const route: RootNavigationContext = props.kind === "week"
    ? { area: "calendar", context: { kind: "calendar_week", month: props.month, week: props.week } }
    : { area: "calendar", context: { kind: "calendar_month", month: props.month, ...(props.day ? { day: props.day } : {}) } };
  const scope = scopeForRoot(route);
  const pageState = props.kind === "month" && props.dayState ? props.dayState : props.state;
  useProductSurface({
    route,
    scope,
    readiness: pageState.status === "idle" || pageState.status === "loading"
      ? "pending"
      : pageState.status === "error" && pageState.previousData === undefined
        ? "terminal_without_anchor"
        : "ready",
  });
  if (props.kind === "week") {
    return <CalendarWeek month={props.month} week={props.week} persons={props.persons} state={props.state} navigation={navigation} />;
  }
  return (
    <>
      <div ref={rootRef} data-focus-restoration-fallback="">
        <CalendarMonth
          month={props.month}
          persons={props.persons}
          adjacentMonths={props.adjacentMonths}
          state={props.state}
          navigation={navigation}
        />
      </div>
      {props.day && controller && props.dayState ? (
        <DayDetailDrawer
          date={props.day}
          persons={props.persons}
          state={props.dayState}
          navigation={navigation ?? controller}
          backgroundRootRef={rootRef}
          topmost={runtime.overlays.topmost === "day_drawer"}
          suspended={runtime.overlays.daySuspended}
        />
      ) : null}
    </>
  );
}
