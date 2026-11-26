"use server";

import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { withProductAuthentication } from "@/app/product-query";
import { forecastWindowMonths } from "@/app/mois-a-venir/month-entry";
import { parseLocalDate } from "@/core/time";
import { plannerUuid } from "@/domain/phase2/planner/json";
import { effectiveSavingsAllocations, parseSavingsCents, savingsGoalProgress, savingsProjects, savingsStatuses, savingsTemplates, savingsTravelTopics,
  type SavingsGoalAllocation, type SavingsProject, type SavingsStatus } from "@/domain/phase2/savings-goals";
import { getBootstrapSession } from "@/server/bootstrap/context";
import { planningDate } from "@/server/phase2/planning-date";
import { readSavingsGoal } from "@/server/phase2/savings-goals";

const field = (form: FormData, name: string) => String(form.get(name) ?? "").trim();
function cents(text: string): number {
  const value = parseSavingsCents(text);
  if (value === null) throw new TypeError("amount");
  return value;
}

async function scope() {
  const { context, session } = await withProductAuthentication(getBootstrapSession);
  if (!context.household) redirect("/acces-refuse");
  return { client: session.supabase, householdId: context.household.householdId,
    currentMonth: planningDate(context.household.timezone).slice(0, 7) };
}

async function updateGoal(owner: Awaited<ReturnType<typeof scope>>, id: string, revision: number, values: Record<string, unknown>) {
  const { data, error } = await owner.client.from("phase2_savings_goals").update({ ...values, revision: revision + 1 })
    .eq("household_id", owner.householdId).eq("goal_id", id).eq("revision", revision).select("goal_id").maybeSingle();
  if (error?.code === "23514") throw new TypeError("allocation");
  if (error) throw error;
  if (!data) throw new TypeError("stale");
}

async function mutate(form: FormData, operation: (owner: Awaited<ReturnType<typeof scope>>) => Promise<string | void>) {
  const owner = await scope();
  const month = field(form, "returnMonth");
  const goal = field(form, "goalId");
  const query = new URLSearchParams();
  if (forecastWindowMonths.includes(month)) query.set("month", month);
  try {
    const changedGoal = await operation(owner);
    if (changedGoal) query.set("goal", changedGoal);
    query.set("notice", "saved");
    revalidatePath("/cagnottes");
    revalidatePath("/mois-a-venir");
    revalidatePath("/mois-a-venir/composer");
  } catch (error) {
    const code = error instanceof TypeError ? error.message : "";
    if (/^[a-f0-9-]{36}$/u.test(goal)) query.set("goal", goal);
    query.set("notice", ["amount", "allocation", "month", "stale", "fields"].includes(code) ? code : "unavailable");
  }
  redirect(`/cagnottes?${query}`);
}

export async function addSavingsTemplates(form: FormData) {
  await mutate(form, async ({ client, householdId }) => {
    const { error } = await client.from("phase2_savings_goals").upsert(savingsTemplates.map(template => ({
      household_id: householdId, label: template.label, project: template.project, deadline: template.deadline, template_key: template.key,
      travel_topic: template.travelTopic ?? null,
    })), { onConflict: "household_id,template_key", ignoreDuplicates: true });
    if (error) throw error;
  });
}

export async function saveSavingsGoal(form: FormData) {
  await mutate(form, async owner => {
    const label = field(form, "label"), project = field(form, "project") as SavingsProject, date = field(form, "deadline");
    if (!label || label.length > 100 || !Object.hasOwn(savingsProjects, project)) throw new TypeError("fields");
    let deadline: string | null = null;
    if (date) {
      try { deadline = parseLocalDate(date); } catch { throw new TypeError("fields"); }
    }
    const amount = field(form, "target");
    const travelTopic = project === "travel" ? field(form, "travelTopic") || "other" : null;
    if (travelTopic !== null && !Object.hasOwn(savingsTravelTopics, travelTopic)) throw new TypeError("fields");
    const values = { label, project, deadline, target_cents: amount ? cents(amount) : null, travel_topic: travelTopic };
    const id = field(form, "goalId");
    if (id) {
      await updateGoal(owner, plannerUuid(id), Number(field(form, "revision")), values);
      return id;
    }
    const { data, error } = await owner.client.from("phase2_savings_goals")
      .insert({ ...values, household_id: owner.householdId }).select("goal_id").single();
    if (error) throw error;
    return String(data.goal_id);
  });
}

export async function changeSavingsAllocation(form: FormData) {
  await mutate(form, async owner => {
    const id = plannerUuid(field(form, "goalId"));
    const goal = await readSavingsGoal(owner.client, owner.householdId, id);
    if (!goal || goal.revision !== Number(field(form, "revision"))) throw new TypeError("stale");
    const action = field(form, "operation");
    const allocationId = field(form, "allocationId");
    const row = goal.allocations.find(allocation => allocation.id === allocationId);
    const available = effectiveSavingsAllocations(goal).find(allocation => allocation.id === allocationId);
    const remaining = goal.allocations.filter(allocation => allocation.id !== allocationId);
    const validateMonth = (month: string) => {
      if (month < owner.currentMonth || !forecastWindowMonths.includes(month)
        || goal.deadline && month > goal.deadline.slice(0, 7)) throw new TypeError("month");
      return month;
    };
    let allocations: SavingsGoalAllocation[];
    if (action === "add" || action === "all") {
      const amount = action === "all" ? savingsGoalProgress(goal).unassigned : cents(field(form, "amount"));
      if (!amount || amount <= 0) throw new TypeError("amount");
      allocations = [...goal.allocations, { id: randomUUID(), month: validateMonth(field(form, "month")), cents: amount, status: "planned", accounted: false }];
    } else {
      if (!row || !available) throw new TypeError("stale");
      if (action === "status") {
        const status = field(form, "status") as SavingsStatus;
        if (!Object.hasOwn(savingsStatuses, status)) throw new TypeError("fields");
        const accounted = status !== "planned" && form.get("accounted") === "on";
        const amount = cents(field(form, "amount"));
        if (amount > available.cents) throw new TypeError("allocation");
        allocations = amount === row.cents ? [...remaining, { ...row, status, accounted }]
          : [...remaining, { ...row, cents: row.cents - amount }, { ...row, id: randomUUID(), cents: amount, status, accounted }];
      } else if (action === "move" && row.status === "planned") {
        const month = validateMonth(field(form, "month"));
        const amount = cents(field(form, "amount"));
        if (amount > available.cents) throw new TypeError("allocation");
        allocations = amount === row.cents ? [...remaining, { ...row, month }]
          : [...remaining, { ...row, cents: row.cents - amount }, { ...row, id: randomUUID(), month, cents: amount }];
      } else if (action === "release" && row.status === "planned") {
        allocations = available.cents === row.cents ? remaining : [...remaining, { ...row, cents: row.cents - available.cents }];
      }
      else throw new TypeError("fields");
    }
    if (goal.targetCents === null || allocations.reduce((sum, allocation) => sum + allocation.cents, 0) > goal.targetCents) throw new TypeError("allocation");
    await updateGoal(owner, id, goal.revision, { allocations });
    return id;
  });
}
