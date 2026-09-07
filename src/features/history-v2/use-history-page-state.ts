"use client";

import { useQueryRuntime } from "@/components/runtime/query-client";
import { queryResourceKeys } from "@/query-api";
import type { YearMonth } from "@/core/time";
import type { HistoryV2InitialState } from "./types";

/** Transport only. No ReadModel calculation or cross-generation fallback. */
export function useHistoryPageState(month: YearMonth, initial: HistoryV2InitialState): HistoryV2InitialState {
  const scope = { subject: { kind: "household" as const }, time: { kind: "month" as const, month } };
  const overview = useQueryRuntime({ resource: queryResourceKeys.historyMonthOverview, scope, params: {} }, initial.overview);
  const calendar = useQueryRuntime(initial.kind === "calendar" ? { resource: queryResourceKeys.historyMonthCalendar, scope, params: {} } : null, initial.kind === "calendar" ? initial.state : undefined);
  const week = useQueryRuntime(initial.kind === "week" ? { resource: queryResourceKeys.historyWeek, scope, params: { weekStart: initial.weekStart } } : null, initial.kind === "week" ? initial.state : undefined);
  const summary = useQueryRuntime(initial.kind === "balance" ? { resource: queryResourceKeys.historyMonthBalanceSummary, scope, params: {} } : null, initial.kind === "balance" ? initial.summary : undefined);
  const categories = useQueryRuntime(initial.kind === "balance" ? { resource: queryResourceKeys.historyMonthCategories, scope, params: {} } : null, initial.kind === "balance" ? initial.categories : undefined);
  const spendingNature = useQueryRuntime(initial.kind === "balance" ? { resource: queryResourceKeys.historyMonthSpendingNature, scope, params: {} } : null, initial.kind === "balance" ? initial.spendingNature : undefined);
  const lifeMoney = useQueryRuntime(initial.kind === "balance" ? { resource: queryResourceKeys.historyMonthLifeMoney, scope, params: {} } : null, initial.kind === "balance" ? initial.lifeMoney : undefined);
  if (initial.kind === "calendar") return { kind: "calendar", state: calendar, overview };
  if (initial.kind === "week") return { kind: "week", weekStart: initial.weekStart, state: week, overview };
  return { kind: "balance", overview, summary, categories, spendingNature, lifeMoney };
}
