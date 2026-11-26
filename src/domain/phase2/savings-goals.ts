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
export const savingsBudgetKinds = { estimate: "Estimé", exact: "Exact" } as const;
export type SavingsBudgetKind = keyof typeof savingsBudgetKinds;
export const seasonalSavingsProject = (project: SavingsProject) => project === "christmas" || project === "birthday";
export const savingsStatuses = { planned: "Prévu", saved: "Sur le livret", purchased: "Acheté" } as const;
export type SavingsStatus = keyof typeof savingsStatuses;
export type SavingsGoalAllocation = { id: string; month: string; cents: number; status: SavingsStatus; accounted: boolean };
export type SavingsPurchaseItem = {
  id: string; goalId: string | null; article: string; recipient: string | null; grossCents: number; refundedCents: number; livretCents?: number;
};
export type SavingsPurchase = SavingsPurchaseItem & { operationId: string; goalId: string; date: string; label: string; cents: number };
export type SavingsPurchaseAmount = Pick<SavingsPurchase, "goalId" | "date" | "cents" | "livretCents">;
export type SavingsGoal = {
  goalId: string; label: string; project: SavingsProject; targetCents: number | null; deadline: string | null;
  templateKey: string | null; travelTopic: SavingsTravelTopic | null; revision: number; allocations: SavingsGoalAllocation[];
  purchases?: readonly SavingsPurchase[];
  purchaseAmounts?: readonly SavingsPurchaseAmount[];
  priority?: SavingsPriority;
  plannedPurchaseDate?: string | null;
  budgetKind?: SavingsBudgetKind;
  optional?: boolean;
  purchasedComplete?: boolean;
  abandoned?: boolean;
  recipient?: string | null;
  season?: number | null;
  seriesKey?: string;
  livretTransfers?: number;
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
  allocations: readonly T[], purchases: readonly SavingsPurchaseAmount[], goalOf: (row: T) => string,
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
  const active = goal.purchasedComplete || goal.abandoned ? goal.allocations.filter(row => row.status !== "planned") : goal.allocations;
  return savingsAllocationsAfterPurchases([...active].sort((a, b) => a.id.localeCompare(b.id)),
    goal.purchases ?? goal.purchaseAmounts ?? [], () => goal.goalId);
}

export function savingsReconciledReservations(goal: SavingsGoal) {
  if (goal.abandoned || goal.purchasedComplete) return [];
  const remaining = new Map(effectiveSavingsAllocations(goal).map(row => [row.id, row.cents]));
  const reconciled = new Map<string, number>();
  for (const row of goal.allocations) {
    if (row.status !== "planned") continue;
    const consumed = row.cents - (remaining.get(row.id) ?? 0);
    if (consumed > 0) reconciled.set(row.month, (reconciled.get(row.month) ?? 0) + consumed);
  }
  return [...reconciled].sort(([a], [b]) => a.localeCompare(b));
}

export const savingsLivretUsed = (item: Pick<SavingsPurchaseItem, "livretCents" | "grossCents" | "refundedCents">) =>
  Math.min(item.livretCents ?? 0, Math.max(0, item.grossCents - item.refundedCents));

export function savingsGoalProgress(goal: SavingsGoal) {
  const planned = effectiveSavingsAllocations(goal).filter(row => row.status === "planned").reduce((sum, row) => sum + row.cents, 0);
  const deposited = goal.allocations.filter(row => row.status === "saved").reduce((sum, row) => sum + row.cents, 0);
  const purchases = goal.purchases ?? goal.purchaseAmounts ?? [];
  const used = purchases.reduce((sum, row) => sum + Math.min(row.livretCents ?? 0, row.cents), 0);
  const saved = deposited + (goal.livretTransfers ?? 0) - used;
  const purchased = goal.allocations.filter(row => row.status === "purchased").reduce((sum, row) => sum + row.cents, 0)
    + purchases.reduce((sum, row) => sum + row.cents, 0);
  const funded = saved + purchased;
  const closed = Boolean(goal.purchasedComplete || goal.abandoned);
  const remaining = closed ? 0 : goal.targetCents === null ? null : Math.max(0, goal.targetCents - funded);
  return { planned, saved, used, purchased, funded, remaining,
    exceeded: goal.targetCents === null ? 0 : Math.max(0, purchased - goal.targetCents),
    unassigned: remaining === null ? null : Math.max(0, remaining - planned),
    complete: Boolean(goal.purchasedComplete), fundedComplete: goal.targetCents !== null && funded >= goal.targetCents };
}

export const savingsProgressPercent = (funded: number, budget: number) =>
  budget > 0 ? Math.min(100, Math.floor(100 * funded / budget)) : null;

export function summarizeSavingsGoals(goals: readonly SavingsGoal[]) {
  const totals = goals.reduce((total, goal) => {
    const { saved, purchased, planned, funded, remaining, exceeded } = savingsGoalProgress(goal);
    const budget = goal.abandoned ? 0 : goal.targetCents ?? 0;
    return {
      budget: total.budget + budget,
      unpriced: total.unpriced + Number(!goal.abandoned && goal.targetCents === null),
      saved: total.saved + saved,
      purchased: total.purchased + purchased,
      planned: total.planned + planned,
      remaining: total.remaining + (remaining ?? 0),
      exceeded: total.exceeded + exceeded,
      optional: total.optional + Number(!goal.abandoned && Boolean(goal.optional)),
      estimated: total.estimated + Number(budget > 0 && goal.budgetKind !== "exact"),
      count: total.count + Number(!goal.abandoned),
      completed: total.completed + Number(!goal.abandoned && Boolean(goal.purchasedComplete)),
      covered: total.covered + Math.min(budget, funded),
      plannedWithinTarget: total.plannedWithinTarget + Math.min(Math.max(0, budget - funded), planned),
    };
  }, { budget: 0, unpriced: 0, saved: 0, purchased: 0, planned: 0, remaining: 0, exceeded: 0,
    optional: 0, estimated: 0, count: 0, completed: 0, covered: 0, plannedWithinTarget: 0 });
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
