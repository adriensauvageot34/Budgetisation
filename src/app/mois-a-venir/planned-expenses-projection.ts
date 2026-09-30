import Big from "big.js";
import type { PlannedExpense } from "@/server/phase2/planned-expenses";
import { plannedLineGross } from "@/domain/phase2/planned-money";
import { needsRealityConfirmation } from "@/domain/phase2/planned-mutations";

export type PlannedExpenseCard = Pick<PlannedExpense, "id" | "familyKey" | "subtypeKey" | "title" | "plannedDate" | "status" | "costItems" | "context" | "updatedAt" | "targetMonth"> & {
  grossCost: string; needsRealityConfirmation: boolean;
};
export type CalendarEntry = Readonly<{ key: string; label: string; amount: string; date: string;
  nature: "CERTAIN_OUTFLOW" | "PLANNED_EXPENSE" | "DECLARED_REALIZED";
  dateCertainty: "DECLARED" | "HISTORICAL_ESTIMATE" | "UNKNOWN" }>;
export type CalendarOutflow = Readonly<{ key: string; label: string; amount: string; date: string | null;
  dateCertainty: "DECLARED" | "HISTORICAL_ESTIMATE" | "UNKNOWN" }>;

export const projectPlannedExpenseCards = (expenses: readonly PlannedExpense[], today = new Date().toISOString().slice(0, 10)): PlannedExpenseCard[] =>
  expenses.map((expense) => ({ id: expense.id, familyKey: expense.familyKey, subtypeKey: expense.subtypeKey,
    title: expense.title, plannedDate: expense.plannedDate, status: expense.status,
    costItems: expense.costItems, context: expense.context, updatedAt: expense.updatedAt, targetMonth: expense.targetMonth,
    needsRealityConfirmation: needsRealityConfirmation(expense, today),
    grossCost: expense.costItems.reduce((sum, item) => sum.plus(plannedLineGross(item)), new Big(0)).toFixed(2) }));

export function projectMonthCalendar(outflows: readonly CalendarOutflow[],
  expenses: readonly PlannedExpenseCard[]): { entries: CalendarEntry[]; undated: CalendarOutflow[];
    dailyTotals: Record<string, string> } {
  const entries: CalendarEntry[] = [
    ...outflows.filter((item) => item.date !== null).map((item) => ({ key: item.key, label: item.label,
      amount: item.amount, date: item.date!, nature: "CERTAIN_OUTFLOW" as const,
      dateCertainty: item.dateCertainty })),
    ...expenses.filter((item) => item.plannedDate !== null).map((item) => ({ key: item.id, label: item.title,
      amount: item.grossCost, date: item.plannedDate!, nature: item.status === "PLANNED"
        ? "PLANNED_EXPENSE" as const : "DECLARED_REALIZED" as const, dateCertainty: "DECLARED" as const })),
  ];
  const totals = new Map<string, Big>();
  for (const item of entries) totals.set(item.date, (totals.get(item.date) ?? new Big(0)).plus(item.amount));
  return { entries, undated: outflows.filter((item) => item.date === null),
    dailyTotals: Object.fromEntries([...totals].map(([date, total]) => [date, total.toFixed(2)])) };
}
