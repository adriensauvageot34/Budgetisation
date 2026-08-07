export const monthKeys = [
  "2026-01",
  "2026-02",
  "2026-03",
  "2026-04",
  "2026-05",
  "2026-06",
  "2026-07",
  "2026-08",
] as const;

export type MonthKey = (typeof monthKeys)[number];
export type Person = "Adrien" | "Manon";
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
export type AnalyticalStatus =
  | "Habituel"
  | "Exceptionnel"
  | "Hors budget"
  | "À ventiler";

export interface Account {
  id: string;
  name: string;
  owner: Person | "Foyer";
  kind: "Compte courant" | "Carte repas" | "Épargne" | "Espèces";
  color: string;
}

export interface CategoryDefinition {
  name: string;
  slug: string;
  color: string;
  subcategories: string[];
  includedInConsumption: boolean;
}

export interface Operation {
  id: string;
  date: string;
  importMonth: MonthKey;
  label: string;
  normalizedMerchant: string;
  amount: number;
  person: Person;
  accountId: string;
  flow: FlowType;
  category: string;
  subcategory: string;
  preciseType: string;
  importance: Importance;
  recurrence: Recurrence;
  status: AnalyticalStatus;
  sourceLabel: string;
  importId: string;
  note?: string;
  uncertain?: boolean;
}

export interface ImportBatch {
  id: string;
  importedAt: string;
  month: MonthKey;
  status: "Terminé" | "À contrôler" | "Importé avec avertissements";
  rows: number;
  warnings: number;
  filename: string;
}

export interface MonthlySummary {
  month: MonthKey;
  expenses: number;
  income: number;
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
