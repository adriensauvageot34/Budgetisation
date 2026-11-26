import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { savingsEuros, savingsGoalRef, type SavingsGoal, type SavingsGoalAllocation, type SavingsMonthEntry } from "@/domain/phase2/savings-goals";
import type { DeclaredSavingsInput } from "@/domain/phase2/savings-allocations";

type GoalRow = {
  goal_id: string; label: string; project: SavingsGoal["project"]; target_cents: number | null;
  deadline: string | null; template_key: string | null; revision: number; allocations: SavingsGoalAllocation[];
};
type MonthRow = Pick<GoalRow, "goal_id" | "label" | "project" | "deadline"> &
  Omit<SavingsGoalAllocation, "month"> & { target_month: string };

const columns = "goal_id,label,project,target_cents,deadline,template_key,revision,allocations";
function fromRow(row: GoalRow): SavingsGoal {
  return { goalId: row.goal_id, label: row.label, project: row.project, targetCents: row.target_cents,
    deadline: row.deadline, templateKey: row.template_key, revision: row.revision, allocations: row.allocations };
}

export async function readSavingsGoals(client: SupabaseClient, householdId: string): Promise<SavingsGoal[]> {
  const { data, error } = await client.from("phase2_savings_goals").select(columns)
    .eq("household_id", householdId).order("deadline", { nullsFirst: false }).order("label");
  if (error) throw error;
  return (data as GoalRow[]).map(fromRow);
}

export async function readSavingsGoal(client: SupabaseClient, householdId: string, goalId: string) {
  const { data, error } = await client.from("phase2_savings_goals").select(columns)
    .eq("household_id", householdId).eq("goal_id", goalId).maybeSingle();
  if (error) throw error;
  return data ? fromRow(data as GoalRow) : null;
}

export async function readSavingsMonthEntries(client: SupabaseClient, householdId: string, month: string): Promise<SavingsMonthEntry[]> {
  const { data, error } = await client.from("phase2_savings_goal_month_entries").select("goal_id,label,project,deadline,id,target_month,cents,status,accounted")
    .eq("household_id", householdId).eq("target_month", month).order("label").order("id");
  if (error) throw error;
  return (data as MonthRow[]).map(({ goal_id, target_month, ...row }) => ({ ...row, goalId: goal_id, month: target_month }));
}

export function projectSavingsReservations(entries: readonly SavingsMonthEntry[]): DeclaredSavingsInput[] {
  return entries.filter(entry => !entry.accounted).map(entry => ({
    id: entry.id, kind: "SAVINGS", label: entry.label, amount: savingsEuros(entry.cents),
    dueDate: entry.deadline?.startsWith(entry.month) ? entry.deadline : null,
    adjustability: "PROTECTED", source: "ANNUAL_PLAN", annualGoalRef: savingsGoalRef + entry.goalId,
  }));
}
