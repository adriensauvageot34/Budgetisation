import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { addMonths, parseYearMonth } from "@/core/time";
import { parseCalendarWeekRef } from "@/navigation";
import { parsePersonId } from "@/core/identity";
import { getBootstrapContext } from "@/server/bootstrap/context";
import { CalendarClientPage } from "@/features/calendar";
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
  let personId;
  try {
    month = parseYearMonth(rawMonth);
    week = parseCalendarWeekRef(rawWeek);
    personId = typeof rawPersonId === "string" && rawPersonId.length > 0
      ? parsePersonId(rawPersonId)
      : undefined;
  } catch {
    notFound();
  }
  const context = await withProductAuthentication(() => getBootstrapContext());
  if (personId && !context.persons.some((person) => person.personId === personId)) notFound();
  const state = await withProductAuthentication(async () =>
    combineQueryResults<HistoryCalendarMonthReadModel>(
        await executeAuthenticatedQueries(
          [addMonths(month, -1), month, addMonths(month, 1)].map((candidate) => ({
            resource: queryResourceKeys.historyCalendarMonth,
            scope: {
              subject: personId
                ? { kind: "person" as const, personId }
                : { kind: "household" as const },
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
      month={month}
      week={week}
      state={state}
    />
  );
}
