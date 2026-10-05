/** Presentation status, derived from existing monthly facts. No persisted UX state. */
export const MONTH_UPDATE_STATUSES = ["NEEDS_UPDATE", "MODIFIED", "DISABLED", "CONFIRMED"] as const;
export type MonthUpdateStatus = typeof MONTH_UPDATE_STATUSES[number];
export type MonthUpdateItem = Readonly<{
  id: string; label: string; status: MonthUpdateStatus | null; summary: string;
  amount: string | null; beforeAmount?: string | null; date: string | null; priority: number; focus: string;
  sourceKind: "BANK" | "WALLET" | "INCOME" | "FIXED" | "CONDITIONAL"; provenance: string;
}>;
/** A plain forecast is reference-only, never proof of explicit confirmation. */
export function classifyMonthUpdateItem(facts: {
  needsUpdate?: boolean; disabled?: boolean; modified?: boolean; explicitlyConfirmed?: boolean;
}): MonthUpdateStatus | null {
  return facts.needsUpdate ? "NEEDS_UPDATE" : facts.disabled ? "DISABLED" : facts.modified ? "MODIFIED"
    : facts.explicitlyConfirmed ? "CONFIRMED" : null;
}
export function groupMonthUpdateItems(items: readonly MonthUpdateItem[]) {
  if (new Set(items.map(row => row.id)).size !== items.length) throw new TypeError("MONTH_UPDATE_DUPLICATE_ITEM");
  const ordered = [...items].sort((a, b) => b.priority - a.priority || a.id.localeCompare(b.id));
  return {
    groups: Object.fromEntries(MONTH_UPDATE_STATUSES.map(status => [status, ordered.filter(row => row.status === status)])) as Record<MonthUpdateStatus, MonthUpdateItem[]>,
    references: ordered.filter(row => row.status === null),
    needsUpdateCount: ordered.filter(row => row.status === "NEEDS_UPDATE").length,
  };
}
/** After a successful save, the refreshed read-model decides the next repair. */
export function nextMonthUpdateItem(items: readonly MonthUpdateItem[], previousId: string) {
  const remaining = items.filter(row => row.status === "NEEDS_UPDATE");
  return { remaining: remaining.length, next: remaining.find(row => row.id !== previousId) ?? remaining[0] ?? null };
}
