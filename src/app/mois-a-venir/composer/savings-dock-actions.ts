"use server";

import { refresh } from "next/cache";
import { plannerUuid } from "@/domain/phase2/planner/json";
import { maxSavingsCents, savingsGoalProgress, type SavingsPurchaseItem } from "@/domain/phase2/savings-goals";
import { getBootstrapSession } from "@/server/bootstrap/context";
import { createCanonicalReadClient } from "@/server/canonical/client";
import { readSavingsGoalSummaries, readSavingsPurchaseItems } from "@/server/phase2/savings-goals";

export async function loadSavingsChoices(operationId: string) {
  try {
    const { session, context } = await getBootstrapSession();
    if (!context.household) return null;
    const householdId = context.household.householdId;
    const [goals, items] = await Promise.all([
      readSavingsGoalSummaries(session.supabase, householdId),
      readSavingsPurchaseItems(session.supabase, householdId, plannerUuid(operationId)),
    ]);
    return {
      items,
      recipients: context.persons.map(person => person.displayName),
      choices: goals.map(goal => {
        const progress = savingsGoalProgress(goal);
        return { id: goal.goalId, label: goal.label, project: goal.project, topic: goal.travelTopic,
          deadline: goal.deadline, complete: progress.complete, abandoned: Boolean(goal.abandoned), season: goal.season,
          recipient: goal.recipient, livretAvailable: progress.saved };
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
  let purchase: { operationId: string; expected: SavingsPurchaseItem[]; items: SavingsPurchaseItem[] };
  try {
    purchase = { operationId: plannerUuid(input.operationId),
      expected: checkedPurchaseLines(input.previous, 100, false), items: checkedPurchaseLines(input.items, 50, true) };
  } catch {
    return "invalid";
  }
  try {
    const { context } = await getBootstrapSession();
    if (!context.household) return "unavailable";

    // The transaction locks the operation and its goals, verifies the canonical
    // debit and compares the expected revision before replacing all lines.
    const { error } = await createCanonicalReadClient().rpc("set_phase2_savings_purchase_items", {
      p_household: context.household.householdId, p_operation: purchase.operationId,
      p_expected: purchase.expected, p_items: purchase.items,
    });
    if (error) {
      if (error.message === "LIVRET_EXCEEDED") return "livret";
      if (error.code === "23514") return "amount";
      if (error.code === "40001") return "stale";
      if (error.code === "22023") return "invalid";
      return "unavailable";
    }
    refresh();
    return "saved";
  } catch {
    return "unavailable";
  }
}

function checkedPurchaseLines(lines: SavingsPurchaseItem[], limit: number, trim: boolean): SavingsPurchaseItem[] {
  if (!Array.isArray(lines) || lines.length > limit) throw new TypeError("INVALID_LINES");
  const seen = new Set<string>();
  return lines.map(item => {
    const id = plannerUuid(item.id);
    const goalId = item.goalId === null ? null : plannerUuid(item.goalId);
    const article = trim ? item.article.trim() : item.article;
    const recipient = trim ? item.recipient?.trim() || null : item.recipient;
    const { grossCents, refundedCents } = item;
    const livretCents = item.livretCents ?? 0;
    if (seen.has(id) || typeof article !== "string" || !article.trim() || article.length > 120
      || (recipient !== null && (typeof recipient !== "string" || recipient.length > 80))
      || !Number.isSafeInteger(grossCents) || grossCents <= 0 || grossCents > maxSavingsCents
      || !Number.isSafeInteger(refundedCents) || refundedCents < 0 || refundedCents > grossCents
      || !Number.isSafeInteger(livretCents) || livretCents < 0 || livretCents > grossCents
      || livretCents > 0 && goalId === null) throw new TypeError("INVALID_LINES");
    seen.add(id);
    return { id, goalId, article, recipient, grossCents, refundedCents, livretCents };
  });
}
