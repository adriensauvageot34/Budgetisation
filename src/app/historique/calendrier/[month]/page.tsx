import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { parseLocalDate, parseYearMonth, yearMonthOf } from "@/core/time";
import { parsePersonId } from "@/core/identity";
import { getBootstrapContext } from "@/server/bootstrap/context";
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
  let personId;
  try {
    month = parseYearMonth(rawMonth);
    day = typeof rawDay === "string" ? parseLocalDate(rawDay) : undefined;
    personId = typeof rawPersonId === "string" && rawPersonId.length > 0
      ? parsePersonId(rawPersonId)
      : undefined;
    if (day !== undefined && yearMonthOf(day) !== month) notFound();
  } catch {
    notFound();
  }
  const context = await withProductAuthentication(() => getBootstrapContext());
  if (personId && !context.persons.some((person) => person.personId === personId)) notFound();
  const subject = personId
    ? { kind: "person" as const, personId }
    : { kind: "household" as const };
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
      month={month}
      state={monthState}
      {...(day && dayState ? { day, dayState } : {})}
    />
  );
}
