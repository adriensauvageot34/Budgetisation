import type {
  Account,
  CategoryDefinition,
  ImportBatch,
  MonthKey,
  Moment,
  Operation,
  OperationAllocation,
} from "@/domain/budget";

export interface BudgetRepository {
  getMonths(): Promise<MonthKey[]>;
  getOperations(): Promise<Operation[]>;
  getOperationsByMonth(month: MonthKey): Promise<Operation[]>;
  getAccounts(): Promise<Account[]>;
  getCategories(): Promise<CategoryDefinition[]>;
  getImportBatches(): Promise<ImportBatch[]>;
  getMoments(): Promise<Moment[]>;
  getOperationAllocations(): Promise<OperationAllocation[]>;
}
