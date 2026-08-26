import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { parseLocalDate, parseYearMonth, yearMonthOf } from "@/core/time";
import { getBootstrapContext } from "@/server/bootstrap/context";
import {
  adjacentEligibleHistoryMonths,
  eligibleHistoryMonths,
  resolveEligibleHistoryMonth,
} from "@/server/bootstrap/history-calendar";
import { CalendarClientPage } from "@/features/calendar";
import { queryResourceKeys } from "@/query-api";
import type {
  HistoryCalendarMonthReadModel,
  HistoryDayDetailReadModel,
} from "@/query-api";
import { executeAuthenticatedQueries } from "@/server/query/runtime";
import { queryResultToState, withProductAuthentication } from "@/app/product-query";

export const metadata: Metadata = { title: "Mois Calendar" };
export const dynamic = "force-dynamic";

export default async function CalendarMonthRoute({
  params,
  searchParams,
}: {
  readonly params: Promise<{ readonly month: string }>;
  readonly searchParams: Promise<{
    readonly day?: string | string[];
    readonly personId?: string | string[];
  }>;
}) {
  const { month: rawMonth } = await params;
  const { day: rawDay, personId: rawPersonId } = await searchParams;
  let month;
  let day;
  try {
    month = parseYearMonth(rawMonth);
    day = typeof rawDay === "string" ? parseLocalDate(rawDay) : undefined;
  } catch {
    notFound();
  }
  if (day !== undefined && yearMonthOf(day) !== month) notFound();
  if (rawPersonId !== undefined) {
    redirect(`/historique/calendrier/${month}${day === undefined ? "" : `?day=${day}`}`);
  }
  const context = await withProductAuthentication(() => getBootstrapContext());
  const eligibleMonths = eligibleHistoryMonths(context.periods);
  const resolvedMonth = resolveEligibleHistoryMonth(month, eligibleMonths);
  if (resolvedMonth === null) redirect("/diagnostic");
  if (resolvedMonth !== month) redirect(`/historique/calendrier/${resolvedMonth}`);
  const subject = { kind: "household" as const };
  const adjacentMonths = adjacentEligibleHistoryMonths(month, eligibleMonths);
  const results = await withProductAuthentication(() =>
    executeAuthenticatedQueries([
        {
          resource: queryResourceKeys.historyCalendarMonth,
          scope: {
            subject,
            time: { kind: "month", month },
          },
          params: {},
        },
        ...(day === undefined
          ? []
          : [
              {
                resource: queryResourceKeys.historyDayDetail,
                scope: {
                  subject,
                  time: { kind: "month", month },
                },
                params: { date: day },
              },
            ]),
    ]),
  );
  const monthState = queryResultToState<HistoryCalendarMonthReadModel>(results[0]!);
  const dayState = day === undefined
    ? undefined
    : queryResultToState<HistoryDayDetailReadModel>(results[1]!);
  return (
    <CalendarClientPage
      kind="month"
      subject={subject}
      month={month}
      persons={context.persons}
      adjacentMonths={adjacentMonths}
      state={monthState}
      {...(day && dayState ? { day, dayState } : {})}
    />
  );
}
