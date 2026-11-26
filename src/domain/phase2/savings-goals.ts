export const savingsProjects = {
  birthday: "Anniversaires", christmas: "Noël", travel: "Voyage", other: "Autres projets",
} as const;

export type SavingsProject = keyof typeof savingsProjects;
export const savingsTravelTopics = {
  flights: "Billets d’avion", bags: "Bagages", equipment: "Équipement", documents: "Formalités", other: "Autres frais de voyage",
} as const;
export type SavingsTravelTopic = keyof typeof savingsTravelTopics;
export const savingsPriorities = { essential: "Indispensable", normal: "Normale", flexible: "Souple" } as const;
export type SavingsPriority = keyof typeof savingsPriorities;
export const savingsStatuses = { planned: "Prévu", saved: "Sur le livret", purchased: "Acheté" } as const;
export type SavingsStatus = keyof typeof savingsStatuses;
export type SavingsGoalAllocation = { id: string; month: string; cents: number; status: SavingsStatus; accounted: boolean };
export type SavingsPurchaseItem = {
  id: string; goalId: string | null; article: string; recipient: string | null; grossCents: number; refundedCents: number;
};
export type SavingsPurchase = SavingsPurchaseItem & { operationId: string; goalId: string; date: string; label: string; cents: number };
export type SavingsGoal = {
  goalId: string; label: string; project: SavingsProject; targetCents: number | null; deadline: string | null;
  templateKey: string | null; travelTopic: SavingsTravelTopic | null; revision: number; allocations: SavingsGoalAllocation[];
  purchases?: readonly SavingsPurchase[];
  priority?: SavingsPriority;
  plannedPurchaseDate?: string | null;
};
export type SavingsMonthEntry = SavingsGoalAllocation & Pick<SavingsGoal, "goalId" | "label" | "project">;

export const savingsGoalRef = "cagnotte:";
export const maxSavingsCents = 99_999_999;
export const savingsEuros = (cents: number) => (cents / 100).toFixed(2);
export const savingsMoney = (cents: number) => new Intl.NumberFormat("fr-FR", {
  style: "currency", currency: "EUR", minimumFractionDigits: 2,
}).format(cents / 100);

export function parseSavingsCents(text: string) {
  if (!/^\d{1,6}(?:[,.]\d{1,2})?$/u.test(text)) return null;
  const [whole, decimal = ""] = text.replace(",", ".").split(".");
  const value = Number(whole) * 100 + Number(decimal.padEnd(2, "0"));
  return value > 0 && value <= maxSavingsCents ? value : null;
}

export function savingsPurchaseTotals(items: readonly Pick<SavingsPurchaseItem, "goalId" | "grossCents" | "refundedCents">[], paymentCents: number) {
  const described = items.reduce((sum, item) => sum + item.grossCents, 0);
  const linked = items.reduce((sum, item) => sum + (item.goalId ? item.grossCents : 0), 0);
  const refunded = items.reduce((sum, item) => sum + item.refundedCents, 0);
  return { described, linked, outside: described - linked, remaining: paymentCents - described, refunded };
}

export function savingsAllocationsAfterPurchases<T extends SavingsGoalAllocation>(
  allocations: readonly T[], purchases: readonly SavingsPurchase[], goalOf: (row: T) => string,
): T[] {
  if (!purchases.length) return [...allocations];
  const paidByMonth = new Map<string, number>();
  for (const purchase of purchases) {
    const key = `${purchase.goalId}:${purchase.date.slice(0, 7)}`;
    paidByMonth.set(key, (paidByMonth.get(key) ?? 0) + purchase.cents);
  }
  return allocations.flatMap(row => {
    if (row.status !== "planned") return [row];
    const key = `${goalOf(row)}:${row.month}`;
    const replaced = Math.min(row.cents, paidByMonth.get(key) ?? 0);
    paidByMonth.set(key, (paidByMonth.get(key) ?? 0) - replaced);
    return replaced === row.cents ? [] : [{ ...row, cents: row.cents - replaced }];
  });
}

export function effectiveSavingsAllocations(goal: SavingsGoal) {
  return savingsAllocationsAfterPurchases([...goal.allocations].sort((a, b) => a.id.localeCompare(b.id)),
    goal.purchases ?? [], () => goal.goalId);
}

export function savingsGoalProgress(goal: SavingsGoal) {
  const planned = effectiveSavingsAllocations(goal).filter(row => row.status === "planned").reduce((sum, row) => sum + row.cents, 0);
  const saved = goal.allocations.filter(row => row.status === "saved").reduce((sum, row) => sum + row.cents, 0);
  const purchased = goal.allocations.filter(row => row.status === "purchased").reduce((sum, row) => sum + row.cents, 0)
    + (goal.purchases ?? []).reduce((sum, row) => sum + row.cents, 0);
  const funded = saved + purchased;
  return { planned, saved, purchased, funded,
    unassigned: goal.targetCents === null ? null : goal.targetCents - funded - planned,
    complete: goal.targetCents !== null && funded >= goal.targetCents };
}

export const savingsProgressPercent = (funded: number, budget: number) =>
  budget > 0 ? Math.min(100, Math.floor(100 * funded / budget)) : null;

export function summarizeSavingsGoals(goals: readonly SavingsGoal[]) {
  const totals = goals.reduce((total, goal) => {
    const { saved, purchased, planned, funded } = savingsGoalProgress(goal);
    const budget = goal.targetCents ?? 0;
    return {
      budget: total.budget + budget,
      unpriced: total.unpriced + (goal.targetCents === null ? 1 : 0),
      saved: total.saved + saved,
      purchased: total.purchased + purchased,
      planned: total.planned + planned,
      covered: total.covered + Math.min(budget, funded),
      plannedWithinTarget: total.plannedWithinTarget + Math.min(Math.max(0, budget - funded), planned),
    };
  }, { budget: 0, unpriced: 0, saved: 0, purchased: 0, planned: 0, covered: 0, plannedWithinTarget: 0 });
  const funded = totals.saved + totals.purchased;
  return { ...totals, funded, percent: savingsProgressPercent(totals.covered, totals.budget) };
}

type SavingsTemplate = { key: string; project: SavingsProject; label: string; deadline: string | null; travelTopic?: SavingsTravelTopic; priority?: SavingsPriority };
export const savingsTemplates: readonly SavingsTemplate[] = [
  { key: "birthday-mathilde", project: "birthday", label: "Anniversaire de Mathilde", deadline: null },
  { key: "birthday-isabelle", project: "birthday", label: "Anniversaire d’Isabelle", deadline: null },
  { key: "christmas-adrien", project: "christmas", label: "Cadeau de Noël · Adrien", deadline: "2026-12-25" },
  { key: "christmas-manon", project: "christmas", label: "Cadeau de Noël · Manon", deadline: "2026-12-25" },
  { key: "flight-adrien", project: "travel", travelTopic: "flights", label: "Billet d’avion · Adrien", deadline: "2027-10-31" },
  { key: "flight-manon", project: "travel", travelTopic: "flights", label: "Billet d’avion · Manon", deadline: "2027-10-31" },
  { key: "bag-adrien", project: "travel", travelTopic: "bags", label: "Sac de voyage · Adrien", deadline: "2027-10-31" },
  { key: "bag-manon", project: "travel", travelTopic: "bags", label: "Sac de voyage · Manon", deadline: "2027-10-31" },
  { key: "travel-equipment", project: "travel", travelTopic: "equipment", label: "Matériel de voyage", deadline: "2027-10-31" },
  { key: "passport-adrien", project: "travel", travelTopic: "documents", label: "Passeport · Adrien", deadline: "2027-10-31", priority: "essential" },
];
