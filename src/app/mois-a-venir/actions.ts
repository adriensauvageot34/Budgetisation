"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAuthenticatedBootstrapClient } from "@/server/bootstrap/auth";
import { getCurrentHousehold } from "@/server/bootstrap/queries";
import { createCanonicalReadClient } from "@/server/canonical/client";
import { queryMonthForecast } from "@/server/phase2/month-forecast-snapshot";
import { readMonthInputs, saveMonthInputs } from "@/server/phase2/month-inputs";
import { deriveMonthScenario, type MonthInputs } from "@/server/phase2/month-scenario";

const field = (form: FormData, key: string): string => String(form.get(key) ?? "").trim();
const optionalMoney = (form: FormData, key: string): string | null => field(form, key) || null;

export async function updateMonthInputs(form: FormData): Promise<void> {
  const targetMonth = field(form, "targetMonth");
  if (!/^\d{4}-(0[1-9]|1[0-2])$/u.test(targetMonth)) throw new TypeError("MONTH_INPUT_TARGET_INVALID");
  const { supabase, user } = await getAuthenticatedBootstrapClient();
  const household = await getCurrentHousehold(supabase);
  if (!household) throw new TypeError("MONTH_INPUT_HOUSEHOLD_MISSING");
  const forecast = await queryMonthForecast(createCanonicalReadClient(), household.householdId, targetMonth);
  const stored = await readMonthInputs(supabase, household.householdId, targetMonth);
  const current: MonthInputs = stored.inputs;
  const intent = field(form, "intent");
  let next: MonthInputs;
  if (intent === "settings") {
    const openingAmount = optionalMoney(form, "openingAmount");
    const benefitBalance = optionalMoney(form, "benefitBalance");
    const benefitLoading = optionalMoney(form, "benefitLoading");
    next = { ...current, safetyReserve: field(form, "safetyReserve"),
      openingBalance: openingAmount === null ? null : { amount: openingAmount, asOfDate: field(form, "openingDate") },
      benefit: {
        currentBalance: benefitBalance === null ? null : { amount: benefitBalance, asOfDate: field(form, "benefitDate") },
        expectedLoading: benefitLoading === null ? null : { amount: benefitLoading, expectedDate: field(form, "loadingDate") },
      },
    };
  } else if (intent === "save-reserve") {
    next = { ...current, safetyReserve: field(form, "safetyReserve") };
  } else if (intent === "save-bank-balance") {
    const amount = optionalMoney(form, "openingAmount");
    next = { ...current, openingBalance: amount === null ? null : { amount, asOfDate: field(form, "openingDate") } };
  } else if (intent === "save-benefit") {
    const balance = optionalMoney(form, "benefitBalance");
    const loading = optionalMoney(form, "benefitLoading");
    next = { ...current, benefit: {
      currentBalance: balance === null ? null : { amount: balance, asOfDate: field(form, "benefitDate") },
      expectedLoading: loading === null ? null : { amount: loading, expectedDate: field(form, "loadingDate") },
    } };
  } else if (intent === "add-event") {
    const kind = field(form, "eventKind");
    const label = field(form, "eventLabel") || (["Soirée", "Restaurant", "Famille", "Voyage / déplacement", "Achat", "Autre"].includes(kind) ? kind : "");
    next = { ...current, plannedEvents: [...current.plannedEvents, {
      id: randomUUID(), label, plannedCost: field(form, "eventCost"),
      baselineDisplaced: field(form, "baselineDisplaced") || "0", parentEnvelope: field(form, "eventParent") || null,
      plannedDate: field(form, "eventDate"),
    }] };
  } else if (intent === "remove-event") {
    next = { ...current, plannedEvents: current.plannedEvents.filter((event) => event.id !== field(form, "eventId")) };
  } else if (intent === "confirm-obligation") {
    const key = field(form, "componentKey");
    next = { ...current, confirmedObligations: [...current.confirmedObligations.filter((part) => part.componentKey !== key),
      { componentKey: key, amount: field(form, "obligationAmount"), dueDate: field(form, "obligationDate") }] };
  } else if (intent === "remove-obligation") {
    next = { ...current, confirmedObligations: current.confirmedObligations.filter((part) => part.componentKey !== field(form, "componentKey")) };
  } else throw new TypeError("MONTH_INPUT_INTENT_INVALID");
  // Validate the derived scenario against the published authority before writing.
  try {
    deriveMonthScenario(forecast, next, null, new Date().toISOString().slice(0, 10));
  } catch (error) {
    if (error instanceof TypeError) redirect("/mois-a-venir?inputError=1");
    throw error;
  }
  await saveMonthInputs(supabase, household.householdId, targetMonth, user.id, next);
  revalidatePath("/mois-a-venir");
}
