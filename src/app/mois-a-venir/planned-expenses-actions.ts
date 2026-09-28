"use server";

import Big from "big.js";
import { revalidatePath } from "next/cache";
import { getAuthenticatedBootstrapClient } from "@/server/bootstrap/auth";
import { getCurrentHousehold } from "@/server/bootstrap/queries";
import { createCanonicalReadClient } from "@/server/canonical/client";
import { MONTH_FORECAST_RESOURCE, queryMonthForecast } from "@/server/phase2/month-forecast-snapshot";
import { readMonthInputs } from "@/server/phase2/month-inputs";
import { deriveMonthScenario } from "@/server/phase2/month-scenario";
import {
  createPlannedExpense, deletePlannedExpense, grossPlannedExpenseCost,
  markPlannedExpenseRealized, parsePlannedExpenseDraft, readPlannedExpenses,
  restorePlannedExpense, simulatePlannedExpense, updatePlannedExpense,
} from "@/server/phase2/planned-expenses";

const euro = (value: Big) => value.toFixed(2);
const scenarios = ["low", "central", "high"] as const;

async function monthContext(targetMonth: string) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/u.test(targetMonth)) throw new TypeError("PLANNED_EXPENSE_MONTH_INVALID");
  const { supabase, user } = await getAuthenticatedBootstrapClient();
  const household = await getCurrentHousehold(supabase);
  if (!household) throw new TypeError("PLANNED_EXPENSE_HOUSEHOLD_MISSING");
  const reader = createCanonicalReadClient();
  const { data: latest, error } = await reader.from("analytics_query_snapshots")
    .select("period_month").eq("household_id", household.householdId)
    .eq("resource", MONTH_FORECAST_RESOURCE).eq("is_active", true).is("invalidated_at", null)
    .order("period_month", { ascending: false }).limit(1).maybeSingle();
  if (error) throw error;
  if (String(latest?.period_month ?? "").slice(0, 7) !== targetMonth)
    throw new TypeError("PLANNED_EXPENSE_ACTIVE_MONTH_MISMATCH");
  const [forecast, stored, saved] = await Promise.all([
    queryMonthForecast(reader, household.householdId, targetMonth),
    readMonthInputs(supabase, household.householdId, targetMonth),
    readPlannedExpenses(supabase, household.householdId, targetMonth),
  ]);
  return { supabase, user, household, forecast, inputs: stored.inputs, saved };
}

export async function previewPlannedExpense(targetMonth: string, rawDraft: unknown, editedId?: string) {
  const context = await monthContext(targetMonth);
  const today = new Date().toISOString().slice(0, 10);
  const draft = parsePlannedExpenseDraft(rawDraft, targetMonth);
  const before = deriveMonthScenario(context.forecast, context.inputs, null, today, context.saved).economicPlan;
  const after = (await simulatePlannedExpense(context.supabase, context.household.householdId,
    context.forecast, context.inputs, context.saved, draft, today, editedId)).economicPlan;
  if (!before || !after) throw new TypeError("PLANNED_EXPENSE_FORECAST_UNAVAILABLE");
  const difference = (field: "netImpact" | "absorbedByBaseline") => Object.fromEntries(scenarios.map((key) =>
    [key, euro(new Big(after.plannedExpenses[field][key]!).minus(before.plannedExpenses[field][key]!))])) as Record<typeof scenarios[number], string>;
  const netAdditionalImpact = difference("netImpact");
  const impacts = scenarios.map((key) => new Big(netAdditionalImpact[key]));
  const minimum = impacts.reduce((smallest, value) => value.lt(smallest) ? value : smallest);
  const maximum = impacts.reduce((largest, value) => value.gt(largest) ? value : largest);
  const restaurantHabitual = draft.familyKey === "food"
    && ["restaurant", "fast_food", "delivery"].includes(draft.subtypeKey ?? "")
    && draft.costItems.every((item) => item.baselineKey === "household-restaurants");
  return {
    grossCost: grossPlannedExpenseCost(draft),
    absorbedByBaseline: difference("absorbedByBaseline"),
    netAdditionalImpact,
    before: before.scenarios,
    after: after.scenarios,
    explanation: restaurantHabitual
      ? `Compté dans votre enveloppe restaurants habituelle. Impact supplémentaire : ${euro(minimum)} à ${euro(maximum)} € selon le scénario.`
      : "Les lignes habituelles utilisent d’abord leur enveloppe du mois ; seul le dépassement s’ajoute au coût prévu.",
  };
}

export async function savePlannedExpense(targetMonth: string, rawDraft: unknown, editedId?: string): Promise<void> {
  const context = await monthContext(targetMonth);
  // The preview path validates the same draft against the current saved month before any write.
  await simulatePlannedExpense(context.supabase, context.household.householdId,
    context.forecast, context.inputs, context.saved, rawDraft, new Date().toISOString().slice(0, 10), editedId);
  if (editedId) await updatePlannedExpense(context.supabase, context.household.householdId, editedId, context.user.id, rawDraft);
  else await createPlannedExpense(context.supabase, context.household.householdId, targetMonth, context.user.id, rawDraft);
  revalidatePath("/mois-a-venir");
}

export async function changePlannedExpenseStatus(targetMonth: string, id: string,
  next: "PLANNED" | "DECLARED_REALIZED"): Promise<void> {
  const context = await monthContext(targetMonth);
  const expense = context.saved.find((item) => item.id === id);
  if (!expense) throw new TypeError("PLANNED_EXPENSE_NOT_FOUND");
  if (next === "DECLARED_REALIZED")
    await markPlannedExpenseRealized(context.supabase, context.household.householdId, id, context.user.id);
  else await restorePlannedExpense(context.supabase, context.household.householdId, id, context.user.id);
  revalidatePath("/mois-a-venir");
}

export async function removePlannedExpense(targetMonth: string, id: string): Promise<void> {
  const context = await monthContext(targetMonth);
  const expense = context.saved.find((item) => item.id === id);
  if (!expense || expense.status !== "PLANNED") throw new TypeError("PLANNED_EXPENSE_DELETE_TARGET_INVALID");
  await deletePlannedExpense(context.supabase, context.household.householdId, id);
  revalidatePath("/mois-a-venir");
}
