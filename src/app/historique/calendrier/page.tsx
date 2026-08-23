import type { Metadata } from "next";
import { CalendarClientPage } from "@/features/calendar";
import { yearMonthOf } from "@/core/time";
import { parsePersonId } from "@/core/identity";
import { notFound } from "next/navigation";
import type { HistoryCalendarMonthSummaryReadModel } from "@/query-api";
import { queryResourceKeys } from "@/query-api";
import { getBootstrapContext } from "@/server/bootstrap/context";
import { executeAuthenticatedQueries } from "@/server/query/runtime";
import { combineQueryResults, withProductAuthentication } from "@/app/product-query";

export const metadata: Metadata = { title: "Calendar" };

export const dynamic = "force-dynamic";

export default async function CalendarOverviewPage({
  searchParams,
}: {
  readonly searchParams: Promise<{ readonly personId?: string | string[] }>;
}) {
  const state = await withProductAuthentication(async () => {
    const context = await getBootstrapContext();
    const rawPersonId = (await searchParams).personId;
    let personId;
    try {
      personId = typeof rawPersonId === "string" && rawPersonId.length > 0
        ? parsePersonId(rawPersonId)
        : undefined;
    } catch {
      notFound();
    }
    if (personId && !context.persons.some((person) => person.personId === personId)) notFound();
    const periods = context.periods.slice(-12);
    const results = await executeAuthenticatedQueries(
      periods.map((period) => ({
        resource: queryResourceKeys.historyCalendarMonthSummary,
        scope: {
          subject: personId
            ? { kind: "person" as const, personId }
            : { kind: "household" as const },
          time: { kind: "month" as const, month: yearMonthOf(period.month) },
        },
        params: {},
      })),
    );
    return combineQueryResults<HistoryCalendarMonthSummaryReadModel>(results);
  });
  return <CalendarClientPage kind="overview" state={state} />;
}
