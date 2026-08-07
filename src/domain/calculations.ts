import type {
  AnalyticalStatus,
  CategoryBreakdown,
  CategoryDefinition,
  Importance,
  MonthKey,
  MonthlySummary,
  Operation,
} from "@/domain/budget";

export function isConsumptionExpense(operation: Operation) {
  return operation.flow === "Dépense" && operation.amount < 0;
}

export function totalExpenses(operations: Operation[]) {
  return operations
    .filter(isConsumptionExpense)
    .reduce((total, operation) => total + Math.abs(operation.amount), 0);
}

export function totalIncome(operations: Operation[]) {
  return operations
    .filter((operation) => operation.flow === "Revenu" && operation.amount > 0)
    .reduce((total, operation) => total + operation.amount, 0);
}

export function totalRefunds(operations: Operation[]) {
  return operations
    .filter((operation) => operation.flow === "Remboursement" && operation.amount > 0)
    .reduce((total, operation) => total + operation.amount, 0);
}

export function netResult(operations: Operation[]) {
  return totalIncome(operations) + totalRefunds(operations) - totalExpenses(operations);
}

export function mean(values: number[]) {
  return values.length
    ? values.reduce((total, value) => total + value, 0) / values.length
    : 0;
}

export function median(values: number[]) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
}

export function monthlySummaries(
  operations: Operation[],
  months: MonthKey[],
): MonthlySummary[] {
  const expenses = months.map((month) =>
    totalExpenses(operations.filter((operation) => operation.importMonth === month)),
  );
  const average = mean(expenses);

  return months.map((month, index) => {
    const monthOperations = operations.filter(
      (operation) => operation.importMonth === month,
    );
    const monthExpenses = expenses[index];
    return {
      month,
      expenses: monthExpenses,
      income: totalIncome(monthOperations),
      refunds: totalRefunds(monthOperations),
      net: netResult(monthOperations),
      averageDelta: average ? (monthExpenses - average) / average : 0,
    };
  });
}

export function categoryBreakdown(
  operations: Operation[],
  selectedMonth: MonthKey,
  months: MonthKey[],
  categories: CategoryDefinition[],
): CategoryBreakdown[] {
  const monthOperations = operations.filter(
    (operation) => operation.importMonth === selectedMonth,
  );
  const expenses = totalExpenses(monthOperations);

  return categories
    .filter((category) => category.includedInConsumption)
    .map((category) => {
      const amount = totalExpenses(
        monthOperations.filter(
          (operation) => operation.category === category.name,
        ),
      );
      const monthlyValues = months.map((month) =>
        totalExpenses(
          operations.filter(
            (operation) =>
              operation.importMonth === month &&
              operation.category === category.name,
          ),
        ),
      );
      const average = mean(monthlyValues);
      return {
        category: category.name,
        slug: category.slug,
        color: category.color,
        amount,
        average,
        share: expenses ? amount / expenses : 0,
        delta: average ? (amount - average) / average : 0,
      };
    })
    .filter((category) => category.amount > 0)
    .sort((a, b) => b.amount - a.amount);
}

export function importanceBreakdown(operations: Operation[]) {
  const importance: Importance[] = [
    "Indispensable",
    "Contrainte",
    "Ajustable",
    "Optionnelle",
  ];
  return importance.map((name) => ({
    name,
    value: totalExpenses(
      operations.filter((operation) => operation.importance === name),
    ),
  }));
}

export function statusBreakdown(operations: Operation[]) {
  const statuses: AnalyticalStatus[] = [
    "Habituel",
    "Exceptionnel",
    "Hors budget",
    "À ventiler",
  ];
  return statuses.map((name) => ({
    name,
    value: totalExpenses(
      operations.filter((operation) => operation.status === name),
    ),
  }));
}

export function categoryTrend(
  operations: Operation[],
  months: MonthKey[],
  category: string,
) {
  const values = months.map((month) => ({
    month,
    amount: totalExpenses(
      operations.filter(
        (operation) =>
          operation.importMonth === month && operation.category === category,
      ),
    ),
  }));
  const average = mean(values.map((entry) => entry.amount));
  return values.map((entry) => ({ ...entry, average }));
}

export function descriptiveStats(summaries: MonthlySummary[]) {
  const values = summaries.map((summary) => summary.expenses);
  const best = [...summaries].sort((a, b) => a.expenses - b.expenses)[0];
  const worst = [...summaries].sort((a, b) => b.expenses - a.expenses)[0];
  return {
    average: mean(values),
    median: median(values),
    minimum: values.length ? Math.min(...values) : 0,
    maximum: values.length ? Math.max(...values) : 0,
    best,
    worst,
  };
}

export function slugToCategory(
  slug: string,
  categories: CategoryDefinition[],
) {
  return categories.find((category) => category.slug === slug);
}
