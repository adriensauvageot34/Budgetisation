"use server";

import { revalidatePath } from "next/cache";
import { plannerUuid } from "@/domain/phase2/planner/json";
import { maxSavingsCents, parseSavingsCents, savingsGoalProgress } from "@/domain/phase2/savings-goals";
import { getBootstrapSession } from "@/server/bootstrap/context";
import { createCanonicalReadClient } from "@/server/canonical/client";
import { readSavingsGoals } from "@/server/phase2/savings-goals";

export async function loadSavingsChoices(operationId: string) {
  try {
    const { session, context } = await getBootstrapSession();
    if (!context.household) return null;
    const id = plannerUuid(operationId);
    const goals = await readSavingsGoals(session.supabase, context.household.householdId);
    return goals.flatMap(goal => {
      const currentCents = goal.purchases?.find(purchase => purchase.operationId === id)?.cents ?? 0;
      const progress = savingsGoalProgress(goal);
      if (progress.complete && !currentCents) return [];
      return [{ id: goal.goalId, label: goal.label, project: goal.project, topic: goal.travelTopic,
        deadline: goal.deadline, targetCents: goal.targetCents, fundedCents: progress.funded, currentCents }];
    });
  } catch {
    return null;
  }
}

export async function saveSavingsChoice(input: { operationId: string; goalId: string; amount: string; previous: number; remove?: boolean }) {
  try {
    const { context } = await getBootstrapSession();
    if (!context.household) return "unavailable";
    const amount = input.remove ? 0 : parseSavingsCents(input.amount);
    if (amount === null || !Number.isSafeInteger(input.previous) || input.previous < 0 || input.previous > maxSavingsCents) return "amount";
    const { error } = await createCanonicalReadClient().rpc("set_phase2_savings_purchase", {
      p_household: context.household.householdId, p_operation: plannerUuid(input.operationId),
      p_goal: plannerUuid(input.goalId), p_cents: amount, p_previous: input.previous,
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
