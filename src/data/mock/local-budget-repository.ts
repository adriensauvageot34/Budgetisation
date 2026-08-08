import type { MonthKey } from "@/domain/budget";
import type { BudgetRepository } from "@/data/budget-repository";
import {
  mockAccounts,
  mockCategories,
  mockImportBatches,
  mockOperations,
} from "@/data/mock/mock-budget-data";

export class LocalBudgetRepository implements BudgetRepository {
  async getMonths() {
    return [...new Set(mockOperations.map((operation) => operation.importMonth))];
  }

  async getOperations() {
    return mockOperations;
  }

  async getOperationsByMonth(month: MonthKey) {
    return mockOperations.filter((operation) => operation.importMonth === month);
  }

  async getAccounts() {
    return mockAccounts;
  }

  async getCategories() {
    return mockCategories;
  }

  async getImportBatches() {
    return mockImportBatches;
  }
}
