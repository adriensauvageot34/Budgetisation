"use server";

import { revalidatePath } from "next/cache";
import { plannerUuid } from "@/domain/phase2/planner/json";
import { maxSavingsCents, savingsGoalProgress, type SavingsPurchaseItem } from "@/domain/phase2/savings-goals";
import { getBootstrapSession } from "@/server/bootstrap/context";
import { createCanonicalReadClient } from "@/server/canonical/client";
import { readSavingsGoals, readSavingsPurchaseItems } from "@/server/phase2/savings-goals";

export async function loadSavingsChoices(operationId: string) {
  try {
    const { session, context } = await getBootstrapSession();
    if (!context.household) return null;
    const householdId = context.household.householdId;
    const [goals, items] = await Promise.all([
      readSavingsGoals(session.supabase, householdId),
      readSavingsPurchaseItems(session.supabase, householdId, plannerUuid(operationId)),
    ]);
    return {
      items,
      recipients: context.persons.map(person => person.displayName),
      choices: goals.map(goal => {
        const progress = savingsGoalProgress(goal);
        return { id: goal.goalId, label: goal.label, project: goal.project, topic: goal.travelTopic,
          deadline: goal.deadline, complete: progress.complete };
      }),
    };
  } catch {
    return null;
  }
}

export async function readCardSavingsLinks(operationIds: string[]) {
  try {
    const { session, context } = await getBootstrapSession();
    if (!context.household || !operationIds.length || operationIds.length > 100) return [];
    const household = context.household.householdId;
    const { data, error } = await session.supabase.from("phase2_savings_purchase_lines").select("goal_id")
      .eq("household_id", household).in("operation_id", operationIds.map(plannerUuid)).not("goal_id", "is", null);
    if (error) return [];
    const ids = [...new Set(data.map(row => String(row.goal_id)))];
    if (!ids.length) return [];
    const goals = await session.supabase.from("phase2_savings_goals").select("goal_id,label")
      .eq("household_id", household).in("goal_id", ids).order("label");
    return (goals.data ?? []).map(row => ({ id: String(row.goal_id), label: String(row.label) }));
  } catch {
    return [];
  }
}

export async function saveSavingsPurchase(input: { operationId: string; previous: SavingsPurchaseItem[]; items: SavingsPurchaseItem[] }) {
  try {
    const { context } = await getBootstrapSession();
    if (!context.household) return "unavailable";
    if (!Array.isArray(input.items) || input.items.length > 50 || !Array.isArray(input.previous) || input.previous.length > 100) return "invalid";
    const items = input.items.map(item => ({
      id: plannerUuid(item.id),
      goalId: item.goalId === null ? null : plannerUuid(item.goalId),
      article: item.article.trim(),
      recipient: item.recipient?.trim() || null,
      grossCents: item.grossCents,
      refundedCents: item.refundedCents,
    }));
    if (new Set(items.map(item => item.id)).size !== items.length || items.some(item =>
      !item.article || item.article.length > 120 || (item.recipient?.length ?? 0) > 80
      || !Number.isSafeInteger(item.grossCents) || item.grossCents <= 0 || item.grossCents > maxSavingsCents
      || !Number.isSafeInteger(item.refundedCents) || item.refundedCents < 0 || item.refundedCents > item.grossCents)) return "invalid";

    const { error } = await createCanonicalReadClient().rpc("set_phase2_savings_purchase_items", {
      p_household: context.household.householdId, p_operation: plannerUuid(input.operationId),
      p_expected: input.previous, p_items: items,
    });
    if (error) {
      if (error.code === "23514") return "amount";
      if (error.code === "40001") return "stale";
      return "unavailable";
    }
    revalidatePath("/cagnottes");
    revalidatePath("/mois-a-venir");
    revalidatePath("/mois-a-venir/composer");
    return "saved";
  } catch {
    return "unavailable";
  }
}
