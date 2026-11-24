import type { YearMonth } from "@/core/time";
import type {
  MonthBalanceSummaryReadModel,
  MonthCategoriesReadModel,
  MonthLifeMoneyReadModel,
  MonthQuickOverviewReadModel,
  MonthSpendingNatureReadModel,
} from "@/query-api";
import { queryResourceKeys } from "@/query-api";
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
