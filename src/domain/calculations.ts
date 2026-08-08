import type {
  AnalyticalStatus,
  CategoryBreakdown,
  CategoryDefinition,
  Importance,
  MonthKey,
  MonthlySummary,
  Operation,
} from "@/domain/budget";
import {
  effectiveResourceType,
  operationAnalysisMonth,
} from "@/domain/inflow-analysis";

export function isConsumptionExpense(operation: Operation) {
  const resourceType = effectiveResourceType(operation);
  return (
    operation.flow === "Dépense" &&
    operation.amount < 0 &&
    resourceType !== "Transfert interne" &&
    resourceType !== "Flux technique"
  );
}

export function netExpenseAmount(
  operation: Operation,
  allOperations: Operation[],
) {
  if (!isConsumptionExpense(operation)) return 0;
  const refunds = allOperations
    .filter(
      (candidate) =>
        candidate.amount > 0 &&
        effectiveResourceType(candidate) === "Remboursement" &&
        candidate.reimbursesOperationId === operation.id,
    )
    .reduce((total, refund) => total + refund.amount, 0);
  return Math.max(Math.abs(operation.amount) - refunds, 0);
}

export function totalExpenses(
  operations: Operation[],
  allOperations: Operation[] = operations,
) {
  return operations
    .filter(isConsumptionExpense)
    .reduce(
      (total, operation) => total + netExpenseAmount(operation, allOperations),
      0,
    );
}

export function totalIncome(operations: Operation[]) {
  return operations
    .filter(
      (operation) =>
        effectiveResourceType(operation) === "Revenu" && operation.amount > 0,
    )
    .reduce((total, operation) => total + operation.amount, 0);
}

export function totalOtherInflows(operations: Operation[]) {
  return operations
    .filter(
      (operation) =>
        effectiveResourceType(operation) === "Entrée d'argent" &&
        operation.amount > 0,
    )
    .reduce((total, operation) => total + operation.amount, 0);
}

export function totalRefunds(operations: Operation[]) {
  return operations
    .filter(
      (operation) =>
        effectiveResourceType(operation) === "Remboursement" &&
        operation.amount > 0 &&
        operation.reimbursesOperationId,
    )
    .reduce((total, operation) => total + operation.amount, 0);
}

export function netResult(
  operations: Operation[],
  allOperations: Operation[] = operations,
) {
  return (
    totalIncome(operations) +
    totalOtherInflows(operations) -
    totalExpenses(operations, allOperations)
  );
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
  allOperations: Operation[] = operations,
): MonthlySummary[] {
  const expenses = months.map((month) =>
    totalExpenses(
      operations.filter((operation) => operation.importMonth === month),
      allOperations,
    ),
  );
  const average = mean(expenses);

  return months.map((month, index) => {
    const monthExpenseIds = new Set(
      operations
        .filter(
          (operation) =>
            operation.importMonth === month && isConsumptionExpense(operation),
        )
        .map((operation) => operation.id),
    );
    const monthOperations = operations.filter(
      (operation) => operationAnalysisMonth(operation) === month,
    );
    const monthExpenses = expenses[index];
    const income = totalIncome(monthOperations);
    const otherInflows = totalOtherInflows(monthOperations);
    return {
      month,
      expenses: monthExpenses,
      income,
      otherInflows,
      refunds: totalRefunds(
        allOperations.filter(
          (operation) =>
            Boolean(operation.reimbursesOperationId) &&
            monthExpenseIds.has(operation.reimbursesOperationId!),
        ),
      ),
      net: income + otherInflows - monthExpenses,
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
  const netExpenses = totalExpenses(monthOperations, operations);

  return categories
    .filter((category) => category.includedInConsumption)
    .map((category) => {
      const amount = totalExpenses(
        monthOperations.filter(
          (operation) => operation.category === category.name,
        ),
        operations,
      );
      const monthlyValues = months.map((month) =>
        totalExpenses(
          operations.filter(
            (operation) =>
              operation.importMonth === month &&
              operation.category === category.name,
          ),
          operations,
        ),
      );
      const average = mean(monthlyValues);
      return {
        category: category.name,
        slug: category.slug,
        color: category.color,
        amount,
        average,
        share: netExpenses ? amount / netExpenses : 0,
        delta: average ? (amount - average) / average : 0,
      };
    })
    .filter((category) => category.amount > 0)
    .sort((a, b) => b.amount - a.amount);
}

export function importanceBreakdown(
  operations: Operation[],
  allOperations: Operation[] = operations,
) {
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
      allOperations,
    ),
  }));
}

export function statusBreakdown(
  operations: Operation[],
  allOperations: Operation[] = operations,
) {
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
      allOperations,
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
      operations,
    ),
  }));
  const average = mean(values.map((entry) => entry.amount));
  return values.map((entry) => ({ ...entry, average }));
}

export function eventNetCost(
  operations: Operation[],
  event: string,
  eventDetail?: string | null,
  allOperations: Operation[] = operations,
) {
  return totalExpenses(
    operations.filter(
      (operation) =>
        (operation.event === event ||
          (event === "Vie courante" && !operation.event)) &&
        (!eventDetail || operation.eventDetail === eventDetail),
    ),
    allOperations,
  );
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
