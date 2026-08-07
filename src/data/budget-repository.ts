import type {
  Account,
  CategoryDefinition,
  ImportBatch,
  MonthKey,
  Operation,
} from "@/domain/budget";

export interface BudgetRepository {
  getMonths(): MonthKey[];
  getOperations(): Operation[];
  getOperationsByMonth(month: MonthKey): Operation[];
  getAccounts(): Account[];
  getCategories(): CategoryDefinition[];
  getImportBatches(): ImportBatch[];
}
