import type { MonthKey } from "@/domain/budget";
import type { BudgetRepository } from "@/data/budget-repository";
import { monthKeys } from "@/domain/budget";
import {
  mockAccounts,
  mockCategories,
  mockImportBatches,
  mockOperations,
} from "@/data/mock/mock-budget-data";

export class LocalBudgetRepository implements BudgetRepository {
  getMonths() {
    return [...monthKeys];
  }

  getOperations() {
    return mockOperations;
  }

  getOperationsByMonth(month: MonthKey) {
    return mockOperations.filter((operation) => operation.importMonth === month);
  }

  getAccounts() {
    return mockAccounts;
  }

  getCategories() {
    return mockCategories;
  }

  getImportBatches() {
    return mockImportBatches;
  }
}
