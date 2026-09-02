import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { addDays, parseLocalDate, parseYearMonth, yearMonthOf, type YearMonth } from "@/core/time";
import type {
  MonthBalanceSummaryReadModel,
  MonthCalendarReadModel,
  MonthCategoriesReadModel,
  MonthLifeMoneyReadModel,
  MonthQuickOverviewReadModel,
  MonthSpendingNatureReadModel,
  WeekReadModel,
} from "@/query-api";
import { queryResourceKeys } from "@/query-api";
import { executeAuthenticatedQueries } from "@/server/query/runtime";
import { queryResultToState, withProductAuthentication } from "@/app/product-query";
import { HistoryV2Page, parseHistoryCalendarFilters, parseHistoryOverlaySearch, type HistoryV2InitialState } from "@/features/history-v2";

export const metadata: Metadata = { title: "Historique" };
export const dynamic = "force-dynamic";

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function HistoryMonthRoute({
  params,
  searchParams,
}: {
  readonly params: Promise<{ readonly month: string }>;
  readonly searchParams: Promise<Readonly<Record<string, string | string[] | undefined>>>;
}) {
  const { month: rawMonth } = await params;
  const rawSearch = await searchParams;
  let month: YearMonth;
  try {
    month = parseYearMonth(rawMonth);
  } catch {
    notFound();
  }
  const rawView = first(rawSearch.view);
  if (rawView !== undefined && rawView !== "balance") {
    const canonical = new URLSearchParams();
    for (const [key, rawValue] of Object.entries(rawSearch)) {
      if (key === "view" || rawValue === undefined) continue;
      for (const value of Array.isArray(rawValue) ? rawValue : [rawValue]) canonical.append(key, value);
    }
    const suffix = canonical.toString();
    redirect(`/historique/${month}${suffix.length === 0 ? "" : `?${suffix}`}`);
  }
  const view = rawView === "balance" ? "balance" : "calendar";
  let weekStart;
  try {
    const week = view === "calendar" ? first(rawSearch.week) : undefined;
    weekStart = week === undefined ? undefined : parseLocalDate(week);
  } catch {
    notFound();
  }
  const referenceMonth = weekStart === undefined ? month : yearMonthOf(addDays(weekStart, 3));
  const scopeMonth = view === "calendar" ? referenceMonth : month;
  const scope = { subject: { kind: "household" as const }, time: { kind: "month" as const, month: scopeMonth } };
  let initialState: HistoryV2InitialState;
  if (view === "calendar") {
    const resource = weekStart === undefined
      ? queryResourceKeys.historyMonthCalendar
      : queryResourceKeys.historyWeek;
    const results = await withProductAuthentication(() => executeAuthenticatedQueries([
      { resource, scope, params: weekStart === undefined ? {} : { weekStart } },
      { resource: queryResourceKeys.historyMonthOverview, scope, params: {} },
    ]));
    const overview = queryResultToState<MonthQuickOverviewReadModel>(results[1]!);
    initialState = weekStart === undefined
      ? { kind: "calendar", state: queryResultToState<MonthCalendarReadModel>(results[0]!), overview }
      : { kind: "week", weekStart, state: queryResultToState<WeekReadModel>(results[0]!), overview };
  } else {
    const results = await withProductAuthentication(() => executeAuthenticatedQueries([
      { resource: queryResourceKeys.historyMonthOverview, scope, params: {} },
      { resource: queryResourceKeys.historyMonthBalanceSummary, scope, params: {} },
      { resource: queryResourceKeys.historyMonthCategories, scope, params: {} },
      { resource: queryResourceKeys.historyMonthSpendingNature, scope, params: {} },
      { resource: queryResourceKeys.historyMonthLifeMoney, scope, params: {} },
    ]));
    initialState = {
      kind: "balance",
      overview: queryResultToState<MonthQuickOverviewReadModel>(results[0]!),
      summary: queryResultToState<MonthBalanceSummaryReadModel>(results[1]!),
      categories: queryResultToState<MonthCategoriesReadModel>(results[2]!),
      spendingNature: queryResultToState<MonthSpendingNatureReadModel>(results[3]!),
      lifeMoney: queryResultToState<MonthLifeMoneyReadModel>(results[4]!),
    };
  }

  return <HistoryV2Page month={scopeMonth} view={view} filters={parseHistoryCalendarFilters(rawSearch)} initialState={initialState} initialOverlay={parseHistoryOverlaySearch(rawSearch)} />;
}
