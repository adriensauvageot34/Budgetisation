import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { parseLocalDate, parseYearMonth, type YearMonth } from "@/core/time";
import type {
  MonthCalendarReadModel,
  WeekReadModel,
  MonthBalanceSummaryReadModel,
  MonthCategoriesReadModel,
  MonthSpendingNatureReadModel,
  MonthLifeMoneyReadModel,
} from "@/query-api";
import { queryResourceKeys } from "@/query-api";
import { executeAuthenticatedQueries } from "@/server/query/runtime";
import { queryResultToState, withProductAuthentication } from "@/app/product-query";
import { HistoryV2Page, parseHistoryOverlaySearch, type HistoryV2InitialState, type HistoryV2View } from "@/features/history-v2";

export const metadata: Metadata = { title: "Historique V2" };
export const dynamic = "force-dynamic";

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function HistoryV2MonthRoute({
  params,
  searchParams,
}: {
  readonly params: Promise<{ readonly month: string }>;
  readonly searchParams: Promise<Readonly<Record<string, string | string[] | undefined>>>;
}) {
  const { month: rawMonth } = await params;
  const rawSearch = await searchParams;
  let month: YearMonth;
  let weekStart;
  try {
    month = parseYearMonth(rawMonth);
    const week = first(rawSearch.week);
    weekStart = week === undefined ? undefined : parseLocalDate(week);
  } catch {
    notFound();
  }
  const view: HistoryV2View = first(rawSearch.view) === "balance" ? "balance" : "calendar";
  const scope = { subject: { kind: "household" as const }, time: { kind: "month" as const, month } };
  let initialState: HistoryV2InitialState;

  if (view === "calendar") {
    const resource = weekStart === undefined
      ? queryResourceKeys.historyMonthCalendar
      : queryResourceKeys.historyWeek;
    const [result] = await withProductAuthentication(() => executeAuthenticatedQueries([{
      resource,
      scope,
      params: weekStart === undefined ? {} : { weekStart },
    }]));
    initialState = weekStart === undefined
      ? { kind: "calendar", state: queryResultToState<MonthCalendarReadModel>(result!) }
      : { kind: "week", weekStart, state: queryResultToState<WeekReadModel>(result!) };
  } else {
    const results = await withProductAuthentication(() => executeAuthenticatedQueries([
      { resource: queryResourceKeys.historyMonthBalanceSummary, scope, params: {} },
      { resource: queryResourceKeys.historyMonthCategories, scope, params: {} },
      { resource: queryResourceKeys.historyMonthSpendingNature, scope, params: {} },
      { resource: queryResourceKeys.historyMonthLifeMoney, scope, params: {} },
    ]));
    initialState = {
      kind: "balance",
      summary: queryResultToState<MonthBalanceSummaryReadModel>(results[0]!),
      categories: queryResultToState<MonthCategoriesReadModel>(results[1]!),
      spendingNature: queryResultToState<MonthSpendingNatureReadModel>(results[2]!),
      lifeMoney: queryResultToState<MonthLifeMoneyReadModel>(results[3]!),
    };
  }

  return <HistoryV2Page month={month} view={view} initialState={initialState} initialOverlay={parseHistoryOverlaySearch(rawSearch)} />;
}
