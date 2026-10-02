import Big from "big.js";
import type { PlannedExpense } from "@/server/phase2/planned-expenses";
import { plannedLineGross, costItemCashTreatment } from "@/domain/phase2/planned-money";
import { needsRealityConfirmation } from "@/domain/phase2/planned-mutations";
import { calendarMetadata, type CalendarMetadata } from "./calendar-metadata";
import { getPlannedExpenseDateRange, getPlannedExpenseCalendarLabel } from "@/domain/phase2/planned-dates";

export type PlannedExpenseCard = Pick<PlannedExpense, "id" | "familyKey" | "subtypeKey" | "title" | "plannedDate" | "status" | "costItems" | "context" | "updatedAt" | "targetMonth"> & {
  grossCost: string; needsRealityConfirmation: boolean;
  detail?: { additionalImpact: string; includedBaseline: string; fuelUsage: string;
    funding: readonly { source: "BANK" | "SWILE" | "EDENRED"; amount: string }[];
    placeLabel?: string; childPlaceLabels: readonly string[]; participantLabels?: readonly string[] };
};
export type CalendarItem = Readonly<{ key: string; label: string; amount: string; date: string | null;
  nature: "CERTAIN_OUTFLOW" | "PLANNED_EXPENSE" | "DECLARED_REALIZED";
  dateCertainty: "DECLARED" | "HISTORICAL_ESTIMATE" | "UNKNOWN";
  expense?: PlannedExpenseCard }> & CalendarMetadata;
export type CalendarEntry = CalendarItem & { readonly date: string };
export type CalendarOutflow = Readonly<{ key: string; label: string; amount: string; date: string | null;
  dateCertainty: "DECLARED" | "HISTORICAL_ESTIMATE" | "UNKNOWN" }> & CalendarMetadata;

export const projectPlannedExpenseCards = (expenses: readonly PlannedExpense[], today = new Date().toISOString().slice(0, 10)): PlannedExpenseCard[] =>
  expenses.map((expense) => ({ id: expense.id, familyKey: expense.familyKey, subtypeKey: expense.subtypeKey,
    title: expense.title, plannedDate: expense.plannedDate, status: expense.status,
    costItems: expense.costItems, context: expense.context, updatedAt: expense.updatedAt, targetMonth: expense.targetMonth,
    needsRealityConfirmation: needsRealityConfirmation(expense, today),
    grossCost: expense.costItems.reduce((sum, item) => sum.plus(plannedLineGross(item)), new Big(0)).toFixed(2) }));

export function projectMonthCalendar(outflows: readonly CalendarOutflow[],
  expenses: readonly PlannedExpenseCard[]): { entries: CalendarEntry[]; undated: CalendarItem[];
    dailyTotals: Record<string, string> } {
  const entries: CalendarEntry[] = [
    ...outflows.filter((item) => item.date !== null).map((item) => ({ ...calendarMetadata(item.label, item), key: item.key, label: item.label,
      amount: item.amount, date: item.date!, nature: "CERTAIN_OUTFLOW" as const,
      dateCertainty: item.dateCertainty })),
    ...expenses.filter((item) => getPlannedExpenseDateRange(item).startDate !== null).map((item) => ({ fullLabel: item.title, calendarLabel: getPlannedExpenseCalendarLabel(item), brandKey: null, key: item.id, label: item.title,
      amount: item.grossCost, date: getPlannedExpenseDateRange(item).startDate!, nature: item.status === "PLANNED"
        ? "PLANNED_EXPENSE" as const : "DECLARED_REALIZED" as const, dateCertainty: "DECLARED" as const, expense: item })),
  ];
  const totals = new Map<string, Big>();
  for (const item of entries) totals.set(item.date, (totals.get(item.date) ?? new Big(0)).plus(item.amount));
  return { entries, undated: [
    ...outflows.filter((item) => item.date === null).map((item) => ({ ...calendarMetadata(item.label, item), ...item, nature: "CERTAIN_OUTFLOW" as const })),
    ...expenses.filter((item) => getPlannedExpenseDateRange(item).startDate === null).map((item) => ({ fullLabel: item.title, calendarLabel: getPlannedExpenseCalendarLabel(item), brandKey: null, key: item.id, label: item.title,
      amount: item.grossCost, date: null, dateCertainty: "UNKNOWN" as const,
      nature: item.status === "PLANNED" ? "PLANNED_EXPENSE" as const : "DECLARED_REALIZED" as const, expense: item })),
  ],
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
