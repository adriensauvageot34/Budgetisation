import Big from "big.js";
import type { PlannedExpense } from "@/server/phase2/planned-expenses";
import { plannedLineGross, costItemCashTreatment } from "@/domain/phase2/planned-money";
import { needsRealityConfirmation } from "@/domain/phase2/planned-mutations";
import { calendarMetadata, type CalendarMetadata } from "./calendar-metadata";
import { getPlannedExpenseDateRange, getPlannedExpenseCalendarLabel } from "@/domain/phase2/planned-dates";
import type { PlannedObservationMatch } from "@/server/phase2/planned-observation-reconciliation";

export type PlannedExpenseCard = Pick<PlannedExpense, "id" | "familyKey" | "subtypeKey" | "title" | "plannedDate" | "status" | "costItems" | "context" | "updatedAt" | "targetMonth"> & {
  grossCost: string; needsRealityConfirmation: boolean;
  observedMatch?: PlannedObservationMatch;
  detail?: { additionalImpact: string; includedBaseline: string; fuelUsage: string;
    funding: readonly { source: "BANK" | "SWILE" | "EDENRED"; amount: string }[];
    placeLabel?: string; childPlaceLabels: readonly string[]; participantLabels?: readonly string[] };
};
export type PlanCalendarMoment = Readonly<{ id: string; label: string; date: string | null }>;
export type CalendarItem = Readonly<{ key: string; label: string; amount: string | null; date: string | null;
  nature: "CERTAIN_OUTFLOW" | "PLANNED_EXPENSE" | "DECLARED_REALIZED" | "PLAN_MOMENT";
  fixedState?: CalendarOutflow["state"];
  planContextId?: string;
  endDate?: string;
  composerStatus?: "confirmed" | "pending" | "planned" | "observed";
  composerHref?: string;
  participants?: readonly string[];
  dateCertainty: "DECLARED" | "HISTORICAL_ESTIMATE" | "UNKNOWN";
  expense?: PlannedExpenseCard }> & CalendarMetadata;
export type CalendarEntry = CalendarItem & { readonly date: string };
export type CalendarOutflow = Readonly<{ key: string; label: string; amount: string; date: string | null;
  state?: import("@/server/phase2/planned-observation-reconciliation").FixedOccurrence["state"];
  dateCertainty: "DECLARED" | "HISTORICAL_ESTIMATE" | "UNKNOWN" }> & CalendarMetadata;

export const projectPlannedExpenseCards = (expenses: readonly PlannedExpense[], today = new Date().toISOString().slice(0, 10),
  matches: readonly PlannedObservationMatch[] = []): PlannedExpenseCard[] =>
  expenses.map((expense) => {
    const observedMatch = matches.find(match => match.plannedExpenseId === expense.id);
    return { id: expense.id, familyKey: expense.familyKey, subtypeKey: expense.subtypeKey,
    title: expense.title, plannedDate: expense.plannedDate, status: expense.status,
    costItems: expense.costItems, context: expense.context, updatedAt: expense.updatedAt, targetMonth: expense.targetMonth,
    needsRealityConfirmation: !observedMatch && needsRealityConfirmation(expense, today),
    ...(observedMatch ? { observedMatch } : {}),
    grossCost: observedMatch?.observedEconomic ?? expense.costItems.reduce((sum, item) => sum.plus(plannedLineGross(item)), new Big(0)).toFixed(2) };
  });

export function projectMonthCalendar(outflows: readonly CalendarOutflow[],
  expenses: readonly PlannedExpenseCard[], planMoments: readonly PlanCalendarMoment[] = []): { entries: CalendarEntry[]; undated: CalendarItem[];
    dailyTotals: Record<string, string> } {
  const items: CalendarItem[] = [
    ...outflows.map(item => ({ ...calendarMetadata(item.label, item), ...item, fixedState: item.state, nature: "CERTAIN_OUTFLOW" as const })),
    ...expenses.map(item => {
      const date = getPlannedExpenseDateRange(item).startDate;
      return { fullLabel: item.title, calendarLabel: getPlannedExpenseCalendarLabel(item), brandKey: null, key: item.id, label: item.title,
        amount: item.grossCost, date, nature: item.status === "PLANNED" ? "PLANNED_EXPENSE" as const : "DECLARED_REALIZED" as const,
        dateCertainty: date ? "DECLARED" as const : "UNKNOWN" as const, expense: item };
    }),
    ...planMoments.map(item => ({ key: `plan-context-${item.id}`, label: item.label, fullLabel: item.label, calendarLabel: item.label, brandKey: null,
      amount: null, date: item.date, dateCertainty: item.date ? "DECLARED" as const : "UNKNOWN" as const,
      nature: "PLAN_MOMENT" as const, planContextId: item.id })),
  ];
  const entries = items.filter((item): item is CalendarEntry => item.date !== null);
  const totals = new Map<string, Big>();
  for (const item of entries) if (item.amount !== null) totals.set(item.date, (totals.get(item.date) ?? new Big(0)).plus(item.amount));
  return { entries, undated: items.filter(item => item.date === null),
    dailyTotals: Object.fromEntries([...totals].map(([date, total]) => [date, total.toFixed(2)])) };
}

/** Display arithmetic only; financial eligibility is already validated by the server. */
export function projectExpenseFunding(expense: PlannedExpenseCard) {
  const amounts = new Map<"BANK" | "SWILE" | "EDENRED", Big>();
  for (const item of expense.costItems) if (costItemCashTreatment(item) !== "ECONOMIC_ONLY")
    for (const part of item.fundingAllocations ?? [{ source: "BANK" as const, amount: plannedLineGross(item) }])
      amounts.set(part.source, (amounts.get(part.source) ?? new Big(0)).plus(part.amount));
  return [...amounts].map(([source, amount]) => ({ source, amount: amount.toFixed(2) }));
}
