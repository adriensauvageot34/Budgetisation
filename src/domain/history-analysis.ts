import type { MonthKey, Operation } from "@/domain/budget";
import {
  isConsumptionExpense,
  mean,
  netExpenseAmount,
  totalExpenses,
} from "@/domain/calculations";
import {
  getSpendingContext,
  type EffectiveSpendingContext,
} from "@/domain/spending-context";

export type HistoryDimension =
  | "category"
  | "subcategory"
  | "importance"
  | "recurrence"
  | "status";

export function spendingContextBreakdown(
  operations: Operation[],
  allOperations: Operation[],
) {
  const contexts: EffectiveSpendingContext[] = [
    "Vie courante",
    "Événement",
    "À confirmer",
  ];
  return contexts.map((name) => ({
    name,
    value: totalExpenses(
      operations.filter((operation) => getSpendingContext(operation) === name),
      allOperations,
    ),
  }));
}

export function monthlySpendingContexts(
  operations: Operation[],
  months: MonthKey[],
  allOperations: Operation[],
) {
  return months.map((month) => {
    const breakdown = spendingContextBreakdown(
      operations.filter((operation) => operation.importMonth === month),
      allOperations,
    );
    return {
      month,
      current: breakdown.find((entry) => entry.name === "Vie courante")?.value ?? 0,
      events: breakdown.find((entry) => entry.name === "Événement")?.value ?? 0,
      unconfirmed: breakdown.find((entry) => entry.name === "À confirmer")?.value ?? 0,
    };
  });
}

function dimensionValue(operation: Operation, dimension: HistoryDimension) {
  if (dimension === "category") return operation.category;
  if (dimension === "subcategory") return operation.subcategory;
  if (dimension === "importance") return operation.importance ?? "Non renseigné";
  if (dimension === "recurrence") return operation.recurrence ?? "Non renseigné";
  return operation.status;
}

export function dimensionBreakdown(
  operations: Operation[],
  dimension: HistoryDimension,
  allOperations: Operation[],
) {
  const grouped = new Map<string, number>();
  for (const operation of operations.filter(isConsumptionExpense)) {
    const name = dimensionValue(operation, dimension);
    grouped.set(
      name,
      (grouped.get(name) ?? 0) + netExpenseAmount(operation, allOperations),
    );
  }
  return [...grouped.entries()]
    .map(([name, value]) => ({ name, value }))
    .filter((entry) => entry.value > 0)
    .sort((a, b) => b.value - a.value);
}

export function averageMonthlyByDimension(
  operations: Operation[],
  months: MonthKey[],
  dimension: HistoryDimension,
  allOperations: Operation[],
) {
  return dimensionBreakdown(operations, dimension, allOperations).map((entry) => ({
    ...entry,
    value: months.length ? entry.value / months.length : 0,
  }));
}

export function categoryReferenceDeltas(
  operations: Operation[],
  selectedMonth: MonthKey,
  referenceMonths: MonthKey[],
  allOperations: Operation[],
) {
  const categories = [
    ...new Set(
      operations.filter(isConsumptionExpense).map((operation) => operation.category),
    ),
  ];
  const comparisonMonths = referenceMonths.filter((month) => month !== selectedMonth);
  if (!comparisonMonths.length) return [];
  return categories
    .map((category) => {
      const selected = totalExpenses(
        operations.filter(
          (operation) =>
            operation.importMonth === selectedMonth &&
            operation.category === category,
        ),
        allOperations,
      );
      const reference = mean(
        comparisonMonths.map((month) =>
          totalExpenses(
            operations.filter(
              (operation) =>
                operation.importMonth === month &&
                operation.category === category,
            ),
            allOperations,
          ),
        ),
      );
      return { name: category, selected, reference, delta: selected - reference };
    })
    .filter((entry) => entry.selected > 0 || entry.reference > 0)
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
}

export function eventGroups(
  operations: Operation[],
  allOperations: Operation[],
) {
  const groups = new Map<string, Operation[]>();
  for (const operation of operations.filter(
    (entry) => isConsumptionExpense(entry) && Boolean(entry.event),
  )) {
    const key = `${operation.event}\u0000${operation.eventDetail ?? ""}`;
    groups.set(key, [...(groups.get(key) ?? []), operation]);
  }
  return [...groups.values()]
    .map((rows) => {
      const sorted = [...rows].sort((a, b) => a.date.localeCompare(b.date));
      return {
        event: rows[0].event!,
        eventDetail: rows[0].eventDetail ?? null,
        value: totalExpenses(rows, allOperations),
        firstDate: sorted[0].date,
        lastDate: sorted.at(-1)!.date,
        count: rows.length,
      };
    })
    .sort((a, b) => b.value - a.value);
}
