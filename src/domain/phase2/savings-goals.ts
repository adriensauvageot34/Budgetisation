export const savingsProjects = {
  birthday: "Anniversaires", christmas: "Noël", travel: "Voyage", other: "Autres projets",
} as const;

export type SavingsProject = keyof typeof savingsProjects;
export const savingsStatuses = { planned: "Prévu", saved: "Sur le livret", purchased: "Acheté" } as const;
export type SavingsStatus = keyof typeof savingsStatuses;
export type SavingsGoalAllocation = { id: string; month: string; cents: number; status: SavingsStatus; accounted: boolean };
export type SavingsGoal = {
  goalId: string; label: string; project: SavingsProject; targetCents: number | null; deadline: string | null;
  templateKey: string | null; revision: number; allocations: SavingsGoalAllocation[];
};
export type SavingsMonthEntry = SavingsGoalAllocation & Pick<SavingsGoal, "goalId" | "label" | "project" | "deadline">;

export const savingsGoalRef = "cagnotte:";
export const maxSavingsCents = 99_999_999;
export const savingsEuros = (cents: number) => (cents / 100).toFixed(2);
export const savingsMoney = (cents: number) => new Intl.NumberFormat("fr-FR", {
  style: "currency", currency: "EUR", minimumFractionDigits: 2,
}).format(cents / 100);

export function savingsGoalProgress(goal: SavingsGoal) {
  const planned = goal.allocations.filter(row => row.status === "planned").reduce((sum, row) => sum + row.cents, 0);
  const saved = goal.allocations.filter(row => row.status === "saved").reduce((sum, row) => sum + row.cents, 0);
  const purchased = goal.allocations.filter(row => row.status === "purchased").reduce((sum, row) => sum + row.cents, 0);
  const funded = saved + purchased;
  return { planned, saved, purchased, funded,
    unassigned: goal.targetCents === null ? null : goal.targetCents - funded - planned,
    complete: goal.targetCents !== null && funded >= goal.targetCents };
}

export const savingsTemplates = [
  { key: "birthday-mathilde", project: "birthday", label: "Anniversaire de Mathilde", deadline: null },
  { key: "birthday-isabelle", project: "birthday", label: "Anniversaire d’Isabelle", deadline: null },
  { key: "christmas-adrien", project: "christmas", label: "Cadeau de Noël · Adrien", deadline: "2026-12-25" },
  { key: "christmas-manon", project: "christmas", label: "Cadeau de Noël · Manon", deadline: "2026-12-25" },
  { key: "flight-adrien", project: "travel", label: "Billet d’avion · Adrien", deadline: "2027-10-31" },
  { key: "flight-manon", project: "travel", label: "Billet d’avion · Manon", deadline: "2027-10-31" },
  { key: "bag-adrien", project: "travel", label: "Sac de voyage · Adrien", deadline: "2027-10-31" },
  { key: "bag-manon", project: "travel", label: "Sac de voyage · Manon", deadline: "2027-10-31" },
  { key: "travel-equipment", project: "travel", label: "Matériel de voyage", deadline: "2027-10-31" },
  { key: "passport-adrien", project: "travel", label: "Passeport · Adrien", deadline: "2027-10-31" },
] as const;
