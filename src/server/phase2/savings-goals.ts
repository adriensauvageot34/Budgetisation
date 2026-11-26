import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { savingsAllocationsAfterPurchases, savingsEuros, savingsGoalRef, type SavingsGoal, type SavingsGoalAllocation, type SavingsMonthEntry, type SavingsPurchase, type SavingsPurchaseItem } from "@/domain/phase2/savings-goals";
import type { DeclaredSavingsInput } from "@/domain/phase2/savings-allocations";

type GoalRow = {
  goal_id: string; label: string; project: SavingsGoal["project"]; target_cents: number | null;
  deadline: string | null; template_key: string | null; travel_topic: SavingsGoal["travelTopic"]; revision: number; allocations: SavingsGoalAllocation[];
  priority: SavingsGoal["priority"]; planned_purchase_date: string | null;
  budget_kind: SavingsGoal["budgetKind"]; optional: boolean; purchased_complete: boolean; abandoned: boolean;
  recipient: string | null; season_year: number | null; series_key: string;
};
type MonthRow = Pick<GoalRow, "goal_id" | "label" | "project"> &
  Omit<SavingsGoalAllocation, "month"> & { target_month: string };

const columns = "goal_id,label,project,target_cents,deadline,template_key,travel_topic,revision,allocations,priority,planned_purchase_date,budget_kind,optional,purchased_complete,abandoned,recipient,season_year,series_key";
const itemColumns = "line_id,goal_id,article,recipient,gross_cents,refunded_cents,livret_cents";
type ItemRow = { line_id: string; goal_id: string | null; article: string; recipient: string | null; gross_cents: number; refunded_cents: number; livret_cents: number };
function purchaseItem(row: ItemRow): SavingsPurchaseItem {
  return { id: row.line_id, goalId: row.goal_id, article: row.article, recipient: row.recipient,
    grossCents: row.gross_cents, refundedCents: row.refunded_cents, livretCents: row.livret_cents };
}

export async function readSavingsPurchaseItems(client: SupabaseClient, householdId: string, operationId: string) {
  const { data, error } = await client.from("phase2_savings_purchase_lines").select(itemColumns)
    .eq("household_id", householdId).eq("operation_id", operationId).order("position");
  if (error) throw error;
  return (data as ItemRow[]).map(purchaseItem);
}

export async function readSavingsPurchases(client: SupabaseClient, householdId: string, filter?: { goalId: string } | { month: string }): Promise<SavingsPurchase[]> {
  let query = client.from("phase2_savings_purchase_lines").select(`operation_id,payment_date,payment_label,cents,${itemColumns}`)
    .eq("household_id", householdId).not("goal_id", "is", null);
  if (filter && "goalId" in filter) query = query.eq("goal_id", filter.goalId);
  if (filter && "month" in filter) {
    const start = new Date(`${filter.month}-01T00:00:00Z`);
    start.setUTCMonth(start.getUTCMonth() + 1);
    query = query.gte("payment_date", `${filter.month}-01`).lt("payment_date", start.toISOString().slice(0, 10));
  }
  const { data, error } = await query.order("payment_date", { ascending: false }).order("operation_id").order("position");
  if (error) throw error;
  return data.map(row => ({ ...purchaseItem(row as ItemRow), operationId: row.operation_id, goalId: row.goal_id,
    date: row.payment_date, label: row.payment_label, cents: row.cents }));
}
function fromRow(row: GoalRow): SavingsGoal {
  return { goalId: row.goal_id, label: row.label, project: row.project, targetCents: row.target_cents,
    deadline: row.deadline, templateKey: row.template_key, travelTopic: row.travel_topic, revision: row.revision, allocations: row.allocations,
    priority: row.priority, plannedPurchaseDate: row.planned_purchase_date, budgetKind: row.budget_kind, optional: row.optional,
    purchasedComplete: row.purchased_complete, abandoned: row.abandoned, recipient: row.recipient, season: row.season_year, seriesKey: row.series_key };
}

async function readLivretMovements(client: SupabaseClient, householdId: string, goalId?: string) {
  let query = client.from("phase2_savings_livret_movements").select("goal_id,delta").eq("household_id", householdId);
  if (goalId) query = query.eq("goal_id", goalId);
  const { data, error } = await query;
  if (error) throw error;
  return new Map(data.map(row => [String(row.goal_id), Number(row.delta)]));
}

export async function readSavingsGoals(client: SupabaseClient, householdId: string): Promise<SavingsGoal[]> {
  const [{ data, error }, purchases, transfers] = await Promise.all([
    client.from("phase2_savings_goals").select(columns)
      .eq("household_id", householdId).order("deadline", { nullsFirst: false }).order("label"),
    readSavingsPurchases(client, householdId), readLivretMovements(client, householdId),
  ]);
  if (error) throw error;
  const byGoal = Object.groupBy(purchases, purchase => purchase.goalId);
  return (data as GoalRow[]).map(row => ({ ...fromRow(row), purchases: byGoal[row.goal_id] ?? [], livretTransfers: transfers.get(row.goal_id) ?? 0 }));
}

export async function readSavingsGoal(client: SupabaseClient, householdId: string, goalId: string) {
  const [{ data, error }, purchases, transfers] = await Promise.all([
    client.from("phase2_savings_goals").select(columns).eq("household_id", householdId).eq("goal_id", goalId).maybeSingle(),
    readSavingsPurchases(client, householdId, { goalId }), readLivretMovements(client, householdId, goalId),
  ]);
  if (error) throw error;
  return data ? { ...fromRow(data as GoalRow), purchases, livretTransfers: transfers.get(goalId) ?? 0 } : null;
}

export async function readSavingsMonthEntries(client: SupabaseClient, householdId: string, month: string): Promise<SavingsMonthEntry[]> {
  const [{ data, error }, purchases] = await Promise.all([
    client.from("phase2_savings_goal_month_entries").select("goal_id,label,project,id,target_month,cents,status,accounted")
      .eq("household_id", householdId).eq("target_month", month).order("label").order("id"),
    readSavingsPurchases(client, householdId, { month }),
  ]);
  if (error) throw error;
  const rows = (data as MonthRow[]).map(({ goal_id, target_month, ...row }) => ({ ...row, goalId: goal_id, month: target_month }));
  return savingsAllocationsAfterPurchases(rows, purchases, row => row.goalId);
}

export function projectSavingsReservations(entries: readonly SavingsMonthEntry[]): DeclaredSavingsInput[] {
  return entries.filter(entry => !entry.accounted).map(entry => ({
    id: entry.id, kind: "SAVINGS", label: entry.project === "travel" ? `Voyage · ${entry.label}` : entry.label,
    amount: savingsEuros(entry.cents), dueDate: null,
    adjustability: "PROTECTED", source: "ANNUAL_PLAN", annualGoalRef: savingsGoalRef + entry.goalId,
  }));
}
