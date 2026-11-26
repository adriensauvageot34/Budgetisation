import { effectiveSavingsAllocations, savingsGoalProgress, maxSavingsCents, type SavingsGoal, type SavingsGoalAllocation } from "./savings-goals";

export type SavingsMargin = { month: string; cents: number | null; limits: string[] };
export type SavingsDeposit = { month: string; cents: number };
export type SavingsMove = { goalId: string; allocationId: string; from: string; to: string; cents: number };
export type SavingsScheduleRequest =
  | { kind: "plan"; goalId: string; revision: number; mode: "single" | "spread" | "custom"; month: string; deposits: SavingsDeposit[] }
  | { kind: "move"; goalId: string; revision: number; allocationId: string; month: string; cents: number };
export type SavingsGoalChange = { goal: SavingsGoal; allocations: SavingsGoalAllocation[] };

export function savingsFundingDate(goal: SavingsGoal) {
  return goal.plannedPurchaseDate ?? goal.deadline;
}

export function savingsFundingMonths(goal: SavingsGoal, months: readonly string[]) {
  const cutoff = savingsFundingDate(goal)?.slice(0, 7);
  return months.filter(month => !cutoff || month <= cutoff);
}

export function spreadSavings(cents: number, months: readonly string[]): SavingsDeposit[] {
  if (!months.length || cents <= 0) return [];
  const share = Math.floor(cents / months.length), extra = cents % months.length;
  return months.map((month, index) => ({ month, cents: share + Number(index < extra) })).filter(row => row.cents > 0);
}

export function changeSavingsSchedule(
  goal: SavingsGoal, request: SavingsScheduleRequest, openMonths: readonly string[], makeId: () => string,
): SavingsGoalChange {
  if (goal.goalId !== request.goalId || goal.revision !== request.revision) throw new TypeError("stale");
  const allowed = savingsFundingMonths(goal, openMonths);
  const validAmount = (cents: number) => Number.isSafeInteger(cents) && cents > 0 && cents <= maxSavingsCents;
  const allocations = [...goal.allocations];
  if (request.kind === "plan") {
    const remaining = savingsGoalProgress(goal).unassigned ?? 0;
    if (!allowed.includes(request.month) && request.mode !== "custom") throw new TypeError("month");
    if (request.mode === "spread" && !savingsFundingDate(goal)) throw new TypeError("deadline");
    const days = request.mode === "single" ? [{ month: request.month, cents: remaining }]
      : request.mode === "spread" ? spreadSavings(remaining, allowed.filter(month => month >= request.month))
      : request.deposits;
    if (!days.length || days.length > allowed.length || new Set(days.map(row => row.month)).size !== days.length) throw new TypeError("amount");
    if (days.some(row => !allowed.includes(row.month))) throw new TypeError("month");
    if (days.some(row => !validAmount(row.cents)) || days.reduce((sum, row) => sum + row.cents, 0) > remaining) throw new TypeError("amount");
    allocations.push(...days.map(row => ({ ...row, id: makeId(), status: "planned" as const, accounted: false })));
  } else {
    const available = effectiveSavingsAllocations(goal).find(row => row.id === request.allocationId && row.status === "planned");
    if (!available) throw new TypeError("stale");
    if (!allowed.includes(request.month) || request.month <= available.month) throw new TypeError("month");
    if (!validAmount(request.cents) || request.cents > available.cents) throw new TypeError("amount");
    const original = allocations.find(row => row.id === available.id)!;
    allocations.splice(allocations.indexOf(original), 1);
    if (original.cents > request.cents) allocations.push({ ...original, cents: original.cents - request.cents });
    allocations.push({ ...original, id: original.cents === request.cents ? original.id : makeId(), month: request.month, cents: request.cents });
  }
  if (allocations.length > 100 || allocations.reduce((sum, row) => sum + row.cents, 0) > (goal.targetCents ?? 0)) throw new TypeError("amount");
  return { goal, allocations };
}

export function savingsScheduleDeltas(changes: readonly SavingsGoalChange[]) {
  const totals = new Map<string, number>();
  for (const { goal, allocations } of changes) {
    for (const [rows, direction] of [[effectiveSavingsAllocations(goal), 1], [effectiveSavingsAllocations({ ...goal, allocations }), -1]] as const) {
      for (const row of rows) if (row.status === "planned") {
        totals.set(row.month, (totals.get(row.month) ?? 0) + direction * row.cents);
      }
    }
  }
  return [...totals].filter(([, delta]) => delta !== 0).sort(([a], [b]) => a.localeCompare(b));
}

export function savingsDeadlineGap(goal: SavingsGoal) {
  const date = savingsFundingDate(goal);
  if (goal.targetCents === null || !date) return null;
  const { funded } = savingsGoalProgress(goal);
  const byDate = effectiveSavingsAllocations(goal).filter(row => row.status === "planned" && row.month <= date.slice(0, 7))
    .reduce((sum, row) => sum + row.cents, 0);
  return Math.max(0, goal.targetCents - funded - byDate);
}

export function suggestSavingsMoves(goals: readonly SavingsGoal[], from: string, deficit: number, margins: readonly SavingsMargin[]) {
  const priority = { flexible: 0, normal: 1, essential: 2 };
  const entries = goals.flatMap(goal => effectiveSavingsAllocations(goal).filter(row => row.month === from && row.status === "planned")
    .map(row => ({ goal, row })))
    .sort((a, b) => priority[a.goal.priority ?? "normal"] - priority[b.goal.priority ?? "normal"]
      || (savingsFundingDate(b.goal) ?? "9999").localeCompare(savingsFundingDate(a.goal) ?? "9999")
      || a.goal.goalId.localeCompare(b.goal.goalId) || a.row.id.localeCompare(b.row.id));
  const capacity = new Map(margins.filter(item => item.month > from && (item.cents ?? 0) > 0)
    .sort((a,b) => a.month.localeCompare(b.month)).map(item => [item.month, item.cents!]));
  const moves: SavingsMove[] = [], blocked = new Set<string>();
  let remaining = Math.max(0, deficit);
  for (const { goal, row } of entries) {
    if (!remaining) break;
    const eligible = savingsFundingMonths(goal, [...capacity.keys()]);
    let available = row.cents;
    for (const to of eligible) {
      const cents = Math.min(available, remaining, capacity.get(to)!);
      if (!cents) continue;
      moves.push({ goalId: goal.goalId, allocationId: row.id, from, to, cents });
      capacity.set(to, capacity.get(to)! - cents);
      available -= cents;
      remaining -= cents;
    }
    if (available > 0 && remaining > 0) blocked.add(goal.goalId);
  }
  return { moves, remaining, blocked: [...blocked] };
}
