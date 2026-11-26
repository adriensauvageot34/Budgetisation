import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { savingsAllocationsAfterPurchases, savingsEuros, savingsGoalRef, type SavingsGoal, type SavingsGoalAllocation, type SavingsMonthEntry, type SavingsPurchase } from "@/domain/phase2/savings-goals";
import type { DeclaredSavingsInput } from "@/domain/phase2/savings-allocations";

type GoalRow = {
  goal_id: string; label: string; project: SavingsGoal["project"]; target_cents: number | null;
  deadline: string | null; template_key: string | null; travel_topic: SavingsGoal["travelTopic"]; revision: number; allocations: SavingsGoalAllocation[];
};
type MonthRow = Pick<GoalRow, "goal_id" | "label" | "project" | "deadline"> &
  Omit<SavingsGoalAllocation, "month"> & { target_month: string };

const columns = "goal_id,label,project,target_cents,deadline,template_key,travel_topic,revision,allocations";
export async function readSavingsPurchases(client: SupabaseClient, householdId: string, filter?: { operationId: string } | { goalId: string } | { month: string }): Promise<SavingsPurchase[]> {
  let query = client.from("phase2_savings_purchases").select("operation_id,goal_id,payment_date,payment_label,cents").eq("household_id", householdId);
  if (filter && "operationId" in filter) query = query.eq("operation_id", filter.operationId);
  if (filter && "goalId" in filter) query = query.eq("goal_id", filter.goalId);
  if (filter && "month" in filter) {
    const start = new Date(`${filter.month}-01T00:00:00Z`);
    start.setUTCMonth(start.getUTCMonth() + 1);
    query = query.gte("payment_date", `${filter.month}-01`).lt("payment_date", start.toISOString().slice(0, 10));
  }
  const { data, error } = await query.order("payment_date", { ascending: false }).order("operation_id").order("goal_id");
  if (error) throw error;
  return data.map(row => ({ operationId: row.operation_id, goalId: row.goal_id, date: row.payment_date, label: row.payment_label, cents: row.cents }));
}
function fromRow(row: GoalRow): SavingsGoal {
  return { goalId: row.goal_id, label: row.label, project: row.project, targetCents: row.target_cents,
    deadline: row.deadline, templateKey: row.template_key, travelTopic: row.travel_topic, revision: row.revision, allocations: row.allocations };
}

export async function readSavingsGoals(client: SupabaseClient, householdId: string): Promise<SavingsGoal[]> {
  const [{ data, error }, purchases] = await Promise.all([
    client.from("phase2_savings_goals").select(columns)
      .eq("household_id", householdId).order("deadline", { nullsFirst: false }).order("label"),
    readSavingsPurchases(client, householdId),
  ]);
  if (error) throw error;
  const byGoal = Object.groupBy(purchases, purchase => purchase.goalId);
  return (data as GoalRow[]).map(row => ({ ...fromRow(row), purchases: byGoal[row.goal_id] ?? [] }));
}

export async function readSavingsGoal(client: SupabaseClient, householdId: string, goalId: string) {
  const [{ data, error }, purchases] = await Promise.all([
    client.from("phase2_savings_goals").select(columns).eq("household_id", householdId).eq("goal_id", goalId).maybeSingle(),
    readSavingsPurchases(client, householdId, { goalId }),
  ]);
  if (error) throw error;
  return data ? { ...fromRow(data as GoalRow), purchases } : null;
}

export async function readSavingsMonthEntries(client: SupabaseClient, householdId: string, month: string): Promise<SavingsMonthEntry[]> {
  const [{ data, error }, purchases] = await Promise.all([
    client.from("phase2_savings_goal_month_entries").select("goal_id,label,project,deadline,id,target_month,cents,status,accounted")
      .eq("household_id", householdId).eq("target_month", month).order("label").order("id"),
    readSavingsPurchases(client, householdId, { month }),
  ]);
  if (error) throw error;
  const rows = (data as MonthRow[]).map(({ goal_id, target_month, ...row }) => ({ ...row, goalId: goal_id, month: target_month }));
  return savingsAllocationsAfterPurchases(rows, purchases, row => row.goalId);
}

export function projectSavingsReservations(entries: readonly SavingsMonthEntry[]): DeclaredSavingsInput[] {
  return entries.filter(entry => !entry.accounted).map(entry => ({
    id: entry.id, kind: "SAVINGS", label: entry.label, amount: savingsEuros(entry.cents),
    dueDate: entry.deadline?.startsWith(entry.month) ? entry.deadline : null,
    adjustability: "PROTECTED", source: "ANNUAL_PLAN", annualGoalRef: savingsGoalRef + entry.goalId,
  }));
}
