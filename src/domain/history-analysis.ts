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

export type HistoryStability = {
  label: "Très stable" | "Stable" | "Variable" | "Très variable";
  coefficient: number;
};

export type ObservedFrequency = {
  label: "Très récurrent" | "Régulier" | "Occasionnel";
  ratio: number;
  activeMonths: number;
};

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

export function classifyHistoryStability(
  values: number[],
): HistoryStability | null {
  if (values.length < 4) return null;
  const average = mean(values);
  if (average <= 1) return null;
  const variance = mean(values.map((value) => (value - average) ** 2));
  const coefficient = Math.sqrt(variance) / average;
  const label =
    coefficient <= 0.1
      ? "Très stable"
      : coefficient <= 0.25
        ? "Stable"
        : coefficient <= 0.5
          ? "Variable"
          : "Très variable";
  return { label, coefficient };
}

export function observedHistoryFrequency(
  values: number[],
): ObservedFrequency | null {
  if (!values.length) return null;
  const activeMonths = values.filter((value) => value > 0).length;
  const ratio = activeMonths / values.length;
  const label =
    ratio >= 0.85
      ? "Très récurrent"
      : ratio >= 0.5
        ? "Régulier"
        : "Occasionnel";
  return { label, ratio, activeMonths };
}

export function historySeriesProfile(
  operations: Operation[],
  months: MonthKey[],
  allOperations: Operation[],
) {
  const values = months.map((month) =>
    totalExpenses(
      operations.filter((operation) => operation.importMonth === month),
      allOperations,
    ),
  );
  return {
    values,
    total: values.reduce((sum, value) => sum + value, 0),
    average: mean(values),
    stability: classifyHistoryStability(values),
    frequency: observedHistoryFrequency(values),
  };
}

export function dimensionHistoryProfiles(
  operations: Operation[],
  months: MonthKey[],
  dimension: HistoryDimension,
  allOperations: Operation[],
) {
  const names = [
    ...new Set(
      operations.filter(isConsumptionExpense).map((operation) =>
        dimensionValue(operation, dimension),
      ),
    ),
  ];
  return names
    .map((name) => {
      const profile = historySeriesProfile(
        operations.filter(
          (operation) => dimensionValue(operation, dimension) === name,
        ),
        months,
        allOperations,
      );
      return { name, ...profile };
    })
    .filter((entry) => entry.total > 0)
    .sort((a, b) => b.total - a.total);
}

export function historyVariationGrid(
  operations: Operation[],
  months: MonthKey[],
  allOperations: Operation[],
) {
  return dimensionHistoryProfiles(
    operations,
    months,
    "category",
    allOperations,
  ).map((profile) => ({
    name: profile.name,
    reference: profile.average,
    cells: months.map((month, index) => {
      const value = profile.values[index];
      const delta = value - profile.average;
      return {
        month,
        value,
        delta,
        intensity: profile.average
          ? Math.max(-1, Math.min(1, delta / profile.average))
          : 0,
      };
    }),
  }));
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
