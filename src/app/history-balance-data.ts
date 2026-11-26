import type { YearMonth } from "@/core/time";
import type {
  MonthBalanceSummaryReadModel,
  MonthCalendarReadModel,
  MonthCategoriesReadModel,
  MonthLifeMoneyReadModel,
  MonthQuickOverviewReadModel,
  MonthSpendingNatureReadModel,
} from "@/query-api";
import { queryResourceKeys } from "@/query-api";
import type { BalanceDailySeries } from "@/features/history-v2/types";
import { executeAuthenticatedQueries } from "@/server/query/runtime";
import { queryResultToState, withProductAuthentication } from "./product-query";

export async function readHistoryBalance(month: YearMonth) {
  const scope = { subject: { kind: "household" as const }, time: { kind: "month" as const, month } };
  const [overview, summary, categories, spendingNature, lifeMoney] = await withProductAuthentication(() => executeAuthenticatedQueries([
    { resource: queryResourceKeys.historyMonthOverview, scope, params: {} },
    { resource: queryResourceKeys.historyMonthBalanceSummary, scope, params: {} },
    { resource: queryResourceKeys.historyMonthCategories, scope, params: {} },
    { resource: queryResourceKeys.historyMonthSpendingNature, scope, params: {} },
    { resource: queryResourceKeys.historyMonthLifeMoney, scope, params: {} },
  ]));
  return {
    kind: "balance" as const,
    overview: queryResultToState<MonthQuickOverviewReadModel>(overview!),
    summary: queryResultToState<MonthBalanceSummaryReadModel>(summary!),
    categories: queryResultToState<MonthCategoriesReadModel>(categories!),
    spendingNature: queryResultToState<MonthSpendingNatureReadModel>(spendingNature!),
    lifeMoney: queryResultToState<MonthLifeMoneyReadModel>(lifeMoney!),
  };
}

export async function readBalanceDailySeries(month: YearMonth): Promise<BalanceDailySeries | null> {
  const scope = { subject: { kind: "household" as const }, time: { kind: "month" as const, month } };
  const [result] = await withProductAuthentication(() => executeAuthenticatedQueries([
    { resource: queryResourceKeys.historyMonthCalendar, scope, params: {} },
  ]));
  if (!result?.ok) return null;
  const model = result.response.data as MonthCalendarReadModel;
  return {
    publicationMeta: model.publicationMeta,
    days: model.weeks.flatMap(week => week.dayDates).flatMap(date => {
      const day = model.daysByDate[date];
      if (!day?.inSelectedMonth) return [];
      return [{
        date: day.date,
        total: day.economicAmount.visibility === "VISIBLE" ? day.economicAmount.data : undefined,
        withoutFixed: day.economicAmountExcludingFixed?.visibility === "VISIBLE" ? day.economicAmountExcludingFixed.data : undefined,
      }];
    }),
  };
}
