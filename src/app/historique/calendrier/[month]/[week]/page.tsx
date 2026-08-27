import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { parseYearMonth } from "@/core/time";
import { parseCalendarWeekRef } from "@/navigation";
import { getBootstrapContext } from "@/server/bootstrap/context";
import {
  eligibleHistoryMonths,
  resolveEligibleHistoryMonth,
} from "@/server/bootstrap/history-calendar";
import { CalendarClientPage, calendarWeekRange } from "@/features/calendar";
import type { HistoryCalendarMonthReadModel } from "@/query-api";
import { queryResourceKeys } from "@/query-api";
import { executeAuthenticatedQueries } from "@/server/query/runtime";
import { combineQueryResults, withProductAuthentication } from "@/app/product-query";

export const metadata: Metadata = { title: "Semaine Calendar" };
export const dynamic = "force-dynamic";

export default async function CalendarWeekRoute({
  params,
  searchParams,
}: {
  readonly params: Promise<{ readonly month: string; readonly week: string }>;
  readonly searchParams: Promise<{ readonly personId?: string | string[] }>;
}) {
  const { month: rawMonth, week: rawWeek } = await params;
  const { personId: rawPersonId } = await searchParams;
  let month;
  let week;
  try {
    month = parseYearMonth(rawMonth);
    week = parseCalendarWeekRef(rawWeek);
  } catch {
    notFound();
  }
  if (rawPersonId !== undefined) {
    redirect(`/historique/calendrier/${month}/${week}`);
  }
  const context = await withProductAuthentication(() => getBootstrapContext());
  const eligibleMonths = eligibleHistoryMonths(context.periods);
  const resolvedMonth = resolveEligibleHistoryMonth(month, eligibleMonths);
  if (resolvedMonth === null) redirect("/diagnostic");
  if (resolvedMonth !== month) redirect(`/historique/calendrier/${resolvedMonth}`);
  const subject = { kind: "household" as const };
  const requestedRange = calendarWeekRange(month, week);
  const state = await withProductAuthentication(async () =>
    combineQueryResults<HistoryCalendarMonthReadModel>(
        await executeAuthenticatedQueries(
          requestedRange.months.map((candidate) => ({
            resource: queryResourceKeys.historyCalendarMonth,
            scope: {
              subject,
              time: { kind: "month" as const, month: candidate },
            },
            params: {},
          })),
        ),
    ),
  );
  return (
    <CalendarClientPage
      kind="week"
      subject={subject}
      persons={context.persons}
      month={month}
      week={week}
      state={state}
    />
  );
}
