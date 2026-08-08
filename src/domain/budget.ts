export type MonthKey = string;
export type Person = string;
export type FlowType =
  | "Dépense"
  | "Revenu"
  | "Remboursement"
  | "Transfert interne"
  | "Prêt et avance"
  | "Flux technique";
export type Importance =
  | "Indispensable"
  | "Contrainte"
  | "Ajustable"
  | "Optionnelle";
export type Recurrence = "Fixe" | "Variable";
export type ResourceType =
  | "Revenu"
  | "Entrée d'argent"
  | "Remboursement"
  | "Transfert interne"
  | "Flux technique"
  | "À qualifier";
export type AnalyticalStatus =
  | "Habituel"
  | "Exceptionnel"
  | "Hors budget"
  | "À ventiler";

export interface Account {
  id: string;
  name: string;
  owner: Person | null;
  kind: string | null;
  color: string | null;
}

export interface CategoryDefinition {
  name: string;
  slug: string;
  color: string;
  subcategories: string[];
  preciseTypesBySubcategory?: Record<string, string[]>;
  includedInConsumption: boolean;
}

export interface Operation {
  id: string;
  date: string;
  importMonth: MonthKey;
  label: string;
  normalizedMerchant: string;
  amount: number;
  person: Person | null;
  accountId: string | null;
  flow: FlowType;
  category: string;
  subcategory: string;
  preciseType: string | null;
  importance: Importance | null;
  recurrence: Recurrence | null;
  status: AnalyticalStatus;
  sourceLabel: string;
  importId: string;
  note: string | null;
  event: string | null;
  eventDetail?: string | null;
  resourceType?: ResourceType | null;
  resourceContext?: string | null;
  analysisMonthOverride?: MonthKey | null;
  analysisMonth?: MonthKey;
  analysisUncertain?: boolean;
  reimbursesOperationId?: string | null;
  uncertain: boolean;
  fingerprint: string;
  sourceMetadata: Record<string, unknown>;
}

export interface ImportBatch {
  id: string;
  importedAt: string;
  month: MonthKey | null;
  firstMonth: MonthKey | null;
  lastMonth: MonthKey | null;
  status: "Terminé" | "À contrôler" | "Importé avec avertissements";
  rows: number;
  warnings: number;
  filename: string;
}

export interface MonthlySummary {
  month: MonthKey;
  expenses: number;
  income: number;
  otherInflows: number;
  refunds: number;
  net: number;
  averageDelta: number;
}

export interface CategoryBreakdown {
  category: string;
  slug: string;
  color: string;
  amount: number;
  average: number;
  share: number;
  delta: number;
}
