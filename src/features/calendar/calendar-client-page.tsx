"use client";

import { useMemo, useRef } from "react";
import type { LocalDate, YearMonth } from "@/core/time";
import type { CalendarWeekRef } from "@/navigation";
import type {
  HistoryCalendarMonthReadModel,
  HistoryCalendarMonthSummaryReadModel,
  HistoryDayDetailReadModel,
} from "@/query-api";
import type { UiTransportState } from "@/ui";
import { useProductRuntime } from "@/components/runtime";
import { CalendarMonth, CalendarTwelveMonths, CalendarWeek } from "./calendar-view";
import { DayDetailDrawer } from "./day-drawer";

export type CalendarClientPageProps =
  | {
      readonly kind: "overview";
      readonly state: UiTransportState<readonly HistoryCalendarMonthSummaryReadModel[]>;
    }
  | {
      readonly kind: "month";
      readonly month: YearMonth;
      readonly day?: LocalDate;
      readonly state: UiTransportState<HistoryCalendarMonthReadModel>;
      readonly dayState?: UiTransportState<HistoryDayDetailReadModel>;
    }
  | {
      readonly kind: "week";
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
  if (props.kind === "overview") {
    return <CalendarTwelveMonths state={props.state} navigation={navigation} />;
  }
  if (props.kind === "week") {
    return <CalendarWeek month={props.month} week={props.week} state={props.state} navigation={navigation} />;
  }
  return (
    <>
      <div ref={rootRef} data-focus-restoration-fallback="">
        <CalendarMonth state={props.state} navigation={navigation} />
      </div>
      {props.day && controller && props.dayState ? (
        <DayDetailDrawer
          date={props.day}
          state={props.dayState}
          navigation={navigation ?? controller}
          backgroundRootRef={rootRef}
        />
      ) : null}
    </>
  );
}
