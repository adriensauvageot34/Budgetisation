import "server-only";
import { unstable_cache } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { plannerDigest } from "@/domain/phase2/planner/json";
import type { BootstrapHouseholdRevision } from "@/server/bootstrap/types";
import { readCanonicalInBatches } from "@/server/canonical/in-batches";
import { savingsAllocationsAfterPurchases, savingsEuros, savingsGoalRef, type SavingsGoal, type SavingsGoalAllocation, type SavingsMonthEntry, type SavingsPurchase, type SavingsPurchaseAmount, type SavingsPurchaseItem } from "@/domain/phase2/savings-goals";
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

type PurchaseFilter = { goalIds: readonly string[] } | { month: string };
type PurchaseAmountRow = { goal_id: string; payment_date: string; cents: number; livret_cents: number };
type PurchaseRow = PurchaseAmountRow & ItemRow & { operation_id: string; payment_label: string };

async function readPurchaseRows<Row>(client: SupabaseClient, householdId: string, selection: string, filter?: PurchaseFilter) {
  let query = client.from("phase2_savings_purchase_lines").select(selection)
    .eq("household_id", householdId).not("goal_id", "is", null)
    .order("payment_date", { ascending: false }).order("operation_id").order("position");
  if (filter && "goalIds" in filter) query = query.in("goal_id", filter.goalIds);
  if (filter && "month" in filter) {
    const start = new Date(`${filter.month}-01T00:00:00Z`);
    start.setUTCMonth(start.getUTCMonth() + 1);
    query = query.gte("payment_date", `${filter.month}-01`).lt("payment_date", start.toISOString().slice(0, 10));
  }
  const rows: Row[] = [];
  const size = 500;
  for (let offset = 0; ; offset += size) {
    const { data, error } = await query.range(offset, offset + size - 1);
    if (error) throw error;
    rows.push(...data as unknown as Row[]);
    if (data.length < size) return rows;
  }
}

async function readSavingsPurchaseAmounts(client: SupabaseClient, householdId: string, filter?: PurchaseFilter): Promise<SavingsPurchaseAmount[]> {
  const rows = await readPurchaseRows<PurchaseAmountRow>(client, householdId, "goal_id,payment_date,cents,livret_cents", filter);
  return rows.map(row => ({ goalId: row.goal_id, date: row.payment_date, cents: row.cents, livretCents: row.livret_cents }));
}

async function readSavingsPurchaseDetails(client: SupabaseClient, householdId: string, goalIds: readonly string[]) {
  return readCanonicalInBatches<SavingsPurchase>({
    values: goalIds,
    async executeBatch(batch) {
      const rows = await readPurchaseRows<PurchaseRow>(client, householdId, `operation_id,payment_date,payment_label,cents,${itemColumns}`, { goalIds: batch });
      return rows.map(row => ({ ...purchaseItem(row), operationId: row.operation_id, goalId: row.goal_id!,
        date: row.payment_date, label: row.payment_label, cents: row.cents }));
    },
    rowIdentity: row => `${row.operationId}:${row.id}`,
    compareRows: (a, b) => b.date.localeCompare(a.date) || a.operationId.localeCompare(b.operationId),
  });
}

class UncachedPurchases extends Error {
  constructor(readonly purchases: readonly SavingsPurchase[]) { super("SAVINGS_PURCHASE_REVISION_CHANGED"); }
}

/** Call only with goal summaries just read under the authenticated household's RLS. */
export async function readSavingsProjectPurchases(client: SupabaseClient, householdId: string, userId: string,
  goals: readonly SavingsGoal[], revision: BootstrapHouseholdRevision | null) {
  const linked = goals.filter(goal => goal.purchaseAmounts?.length).sort((a, b) => a.goalId.localeCompare(b.goalId));
  if (!linked.length) return [];
  const ids = linked.map(goal => goal.goalId);
  const live = () => readSavingsPurchaseDetails(client, householdId, ids);
  if (!revision || revision.householdId !== householdId || ids.length > 100) return live();
  const key = plannerDigest({ userId, householdId, sourceRevision: revision.dataRevision,
    project: linked[0].project,
    goals: linked.map(goal => [goal.goalId, goal.revision, goal.purchaseAmounts ?? []]) });
  try {
    return await unstable_cache(async () => {
      const purchases = await live();
      const current = await client.from("phase2_savings_goals").select("goal_id,revision")
        .eq("household_id", householdId).in("goal_id", ids).order("goal_id");
      if (current.error || current.data.length !== linked.length || current.data.some((row, i) =>
        row.goal_id !== linked[i].goalId || row.revision !== linked[i].revision)
        || Buffer.byteLength(JSON.stringify(purchases)) > 1_500_000) throw new UncachedPurchases(purchases);
      return purchases;
    }, ["savings-project-purchases-v1", key], { revalidate: 1800 })();
  } catch (error) {
    if (error instanceof UncachedPurchases) return error.purchases;
    throw error;
  }
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

export async function readSavingsGoalSummaries(client: SupabaseClient, householdId: string): Promise<SavingsGoal[]> {
  const [{ data, error }, purchases, transfers] = await Promise.all([
    client.from("phase2_savings_goals").select(columns)
      .eq("household_id", householdId).order("deadline", { nullsFirst: false }).order("label"),
    readSavingsPurchaseAmounts(client, householdId), readLivretMovements(client, householdId),
  ]);
  if (error) throw error;
  const byGoal = Object.groupBy(purchases, purchase => purchase.goalId);
  return (data as GoalRow[]).map(row => ({ ...fromRow(row), purchaseAmounts: byGoal[row.goal_id], livretTransfers: transfers.get(row.goal_id) ?? 0 }));
}

export async function readSavingsGoal(client: SupabaseClient, householdId: string, goalId: string) {
  const [{ data, error }, purchases, transfers] = await Promise.all([
    client.from("phase2_savings_goals").select(columns).eq("household_id", householdId).eq("goal_id", goalId).maybeSingle(),
    readSavingsPurchaseAmounts(client, householdId, { goalIds: [goalId] }), readLivretMovements(client, householdId, goalId),
  ]);
  if (error) throw error;
  return data ? { ...fromRow(data as GoalRow), purchaseAmounts: purchases, livretTransfers: transfers.get(goalId) ?? 0 } : null;
}

export async function readSavingsMonthEntries(client: SupabaseClient, householdId: string, month: string): Promise<SavingsMonthEntry[]> {
  const [{ data, error }, purchases] = await Promise.all([
    client.from("phase2_savings_goal_month_entries").select("goal_id,label,project,id,target_month,cents,status,accounted")
      .eq("household_id", householdId).eq("target_month", month).order("label").order("id"),
    readSavingsPurchaseAmounts(client, householdId, { month }),
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
