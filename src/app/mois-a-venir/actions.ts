"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAuthenticatedBootstrapClient } from "@/server/bootstrap/auth";
import { getCurrentHousehold } from "@/server/bootstrap/queries";
import { createCanonicalReadClient } from "@/server/canonical/client";
import { queryMonthForecast, resolvePlanningMonthForecast } from "@/server/phase2/month-forecast-snapshot";
import { readMonthInputs, saveMonthInputs } from "@/server/phase2/month-inputs";
import { deriveMonthScenario, type MonthInputs } from "@/server/phase2/month-scenario";
import { readPlannedExpenses } from "@/server/phase2/planned-expenses";

import { planningDate } from "@/server/phase2/planning-date";
import { parseMonthDecisionSettings, type MonthDecisionSettings } from "@/domain/phase2/month-decision-contract";
import { makeForecastCheckpoint, insertForecastCheckpoint } from "@/server/phase2/forecast-memory";
import { projectMonthDecision } from "@/server/phase2/month-decision-projection";
import Big from "big.js";

const field = (form: FormData, key: string): string => String(form.get(key) ?? "").trim();
const optionalMoney = (form: FormData, key: string): string | null => field(form, key) || null;

export async function updateMonthInputs(form: FormData): Promise<void> {
  const targetMonth = field(form, "targetMonth");
  if (!/^\d{4}-(0[1-9]|1[0-2])$/u.test(targetMonth)) throw new TypeError("MONTH_INPUT_TARGET_INVALID");
  const { supabase, user } = await getAuthenticatedBootstrapClient();
  const household = await getCurrentHousehold(supabase);
  if (!household) throw new TypeError("MONTH_INPUT_HOUSEHOLD_MISSING");
  let forecast;
  try { forecast = await queryMonthForecast(createCanonicalReadClient(), household.householdId, targetMonth); }
  catch (error) {
    if (!(error instanceof Error) || error.message !== "FORECAST_ACTIVE_MONTH_SNAPSHOT_MISSING") throw error;
    forecast = await resolvePlanningMonthForecast(createCanonicalReadClient(), household.householdId, targetMonth);
  }
  const stored = await readMonthInputs(supabase, household.householdId, targetMonth);
  const current: MonthInputs = stored.inputs;
  const intent = field(form, "intent");
  let next: MonthInputs;
  if (intent === "save-month-assumption" || intent === "clear-month-assumption" || intent === "save-month-goal" || intent === "clear-month-goal") {
    if (targetMonth < planningDate(household.timezone).slice(0, 7)) throw new TypeError("MONTH_DECISION_PAST_READ_ONLY");
    const decision = parseMonthDecisionSettings(current.decision);
    const assumptions = { ...decision.assumptions };
    const key = field(form, "categoryKey") as keyof typeof assumptions;
    if (intent === "clear-month-assumption") delete assumptions[key];
    if (intent === "save-month-assumption") assumptions[key] = field(form, "assumptionMode") === "CUSTOM"
      ? { mode: "CUSTOM", amount: field(form, "assumptionAmount") } : { mode: field(form, "assumptionMode") as "LOWER" | "HIGHER" };
    next = { ...current, decision: parseMonthDecisionSettings({ ...decision, assumptions,
      goal: intent === "clear-month-goal" ? null : intent === "save-month-goal" ? field(form, "monthGoal") : decision.goal }) };
  } else if (intent === "settings") {
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
  } else if (intent === "add-event" || intent === "remove-event") {
    throw new TypeError("LEGACY_PLANNED_EVENT_WRITE_DISABLED");
  } else if (intent === "confirm-obligation") {
    const key = field(form, "componentKey");
    next = { ...current, confirmedObligations: [...current.confirmedObligations.filter((part) => part.componentKey !== key),
      { componentKey: key, amount: field(form, "obligationAmount"), dueDate: field(form, "obligationDate") }],
      declinedConditionalObligations: current.declinedConditionalObligations.filter((item) => item !== key) };
  } else if (intent === "decline-conditional" || intent === "unknown-conditional") {
    const key = field(form, "componentKey");
    if (intent === "decline-conditional" && !forecast.components.some((part) => part.key === key
      && part.knowledgeState === "CONDITIONAL_UNKNOWN" && /Ornikar|Alma/iu.test(part.label)))
      throw new TypeError("CONDITIONAL_DECISION_TARGET_INVALID");
    next = { ...current, confirmedObligations: current.confirmedObligations.filter((part) => part.componentKey !== key),
      declinedConditionalObligations: intent === "decline-conditional"
        ? [...new Set([...current.declinedConditionalObligations, key])]
        : current.declinedConditionalObligations.filter((item) => item !== key) };
  } else if (intent === "exclude-fixed" || intent === "restore-fixed") {
    const key = field(form, "componentKey");
    if (intent === "exclude-fixed" && !forecast.components.some((part) => part.key === key
      && part.nature === "CONTRACTUAL_EXPECTED" && part.additiveGroup === "obligations" && part.central !== null))
      throw new TypeError("FIXED_EXCLUSION_TARGET_INVALID");
    next = { ...current, excludedFixedObligations: intent === "exclude-fixed"
      ? [...new Set([...current.excludedFixedObligations, key])]
      : current.excludedFixedObligations.filter((item) => item !== key) };
  } else if (intent === "declare-monthly-benefits") {
    next = { ...current, declaredResources: { ...current.declaredResources,
      "benefit:swile": field(form, "swileResource"), "benefit:edenred": field(form, "edenredResource") } };
  } else if (intent === "set-resource-override" || intent === "clear-resource-override") {
    const key = field(form, "resourceKey");
    const supported = forecast.income.components.some((part) => part.key === key && part.central !== null)
      || ((key === "benefit:swile" || key === "benefit:edenred") && current.declaredResources[key] !== undefined);
    if (!supported) throw new TypeError("RESOURCE_OVERRIDE_TARGET_INVALID");
    const resourceOverrides = { ...current.resourceOverrides };
    if (intent === "clear-resource-override") delete resourceOverrides[key];
    else resourceOverrides[key] = field(form, "resourceAmount");
    next = { ...current, resourceOverrides };
  } else if (intent === "declare-meal-resource") {
    const key = field(form, "resourceKey");
    if (key !== "benefit:swile" && key !== "benefit:edenred") throw new TypeError("DECLARED_RESOURCE_TARGET_INVALID");
    next = { ...current, declaredResources: { ...current.declaredResources, [key]: field(form, "resourceAmount") } };
  } else if (intent === "set-fixed-amount-override" || intent === "clear-fixed-amount-override") {
    const key = field(form, "componentKey");
    const fixedAmountOverrides = { ...current.fixedAmountOverrides };
    if (intent === "clear-fixed-amount-override") delete fixedAmountOverrides[key];
    else {
      if (!forecast.components.some((part) => part.key === key && part.nature === "CONTRACTUAL_EXPECTED"
        && part.additiveGroup === "obligations" && part.central !== null)) throw new TypeError("FIXED_OVERRIDE_TARGET_INVALID");
      fixedAmountOverrides[key] = { amount: field(form, "obligationAmount"),
        dueDate: field(form, "obligationDate") || null, reason: "MONTH_EXCEPTION" };
    }
    next = { ...current, fixedAmountOverrides };
  } else if (intent === "add-declared-savings") {
    next = { ...current, declaredOutflows: [...current.declaredOutflows, {
      id: randomUUID(), label: field(form, "outflowLabel"), amount: field(form, "outflowAmount"),
      dueDate: field(form, "outflowDate") || null, kind: "SAVINGS" as const,
    }] };
  } else if (intent === "remove-declared-outflow") {
    next = { ...current, declaredOutflows: current.declaredOutflows.filter((item) => item.id !== field(form, "outflowId")) };
  } else throw new TypeError("MONTH_INPUT_INTENT_INVALID");
  // Validate the derived scenario against the published authority before writing.
  try {
    const plannedExpenses = await readPlannedExpenses(supabase, household.householdId, targetMonth);
    deriveMonthScenario(forecast, next, null, planningDate(household.timezone), plannedExpenses);
  } catch (error) {
    if (error instanceof TypeError) redirect(`/mois-a-venir?month=${targetMonth}&inputError=1`);
    throw error;
  }
  await saveMonthInputs(supabase, household.householdId, targetMonth, user.id, next);
  revalidatePath("/mois-a-venir");
}

async function decisionContext(targetMonth: string) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/u.test(targetMonth)) throw new TypeError("MONTH_INPUT_TARGET_INVALID");
  const { supabase, user } = await getAuthenticatedBootstrapClient();
  const household = await getCurrentHousehold(supabase);
  if (!household) throw new TypeError("MONTH_INPUT_HOUSEHOLD_MISSING");
  const asOf = planningDate(household.timezone);
  if (targetMonth < asOf.slice(0, 7)) throw new TypeError("MONTH_DECISION_PAST_READ_ONLY");
  const forecast = await resolvePlanningMonthForecast(createCanonicalReadClient(), household.householdId, targetMonth);
  const [stored, expenses] = await Promise.all([readMonthInputs(supabase, household.householdId, targetMonth), readPlannedExpenses(supabase, household.householdId, targetMonth)]);
  return { user, household, asOf, forecast, stored, expenses };
}

/** Explicit conservation only; consultation and simulation never write. */
export async function preserveMonthForecast(targetMonth: string): Promise<{ ok: boolean; message: string }> {
  const ctx = await decisionContext(targetMonth);
  const plan = deriveMonthScenario(ctx.forecast, ctx.stored.inputs, null, ctx.asOf, ctx.expenses).economicPlan;
  if (!plan) return { ok: false, message: "Complétez les ressources du mois avant de conserver une estimation." };
  await insertForecastCheckpoint(createCanonicalReadClient(), ctx.household.householdId, ctx.user.id, targetMonth, ctx.asOf,
    makeForecastCheckpoint(ctx.forecast, ctx.stored.inputs, plan, ctx.asOf));
  revalidatePath("/mois-a-venir");
  return { ok: true, message: "Estimation conservée. Elle pourra être comparée aux imports complets du mois." };
}

export async function simulateMonthBehavior(targetMonth: string, preset: string) {
  const ctx = await decisionContext(targetMonth);
  const normal = deriveMonthScenario(ctx.forecast, ctx.stored.inputs, null, ctx.asOf, ctx.expenses).economicPlan;
  if (!normal?.narrative.prediction) return { ok: false as const, message: "Complétez les ressources du mois avant de simuler." };
  const categoryKey = preset === "restaurant-zero" ? "household-restaurants" : preset === "groceries-minus-100" ? "groceries" : preset === "tobacco-minus-20" ? "tobacco-vape" : null;
  if (!categoryKey) throw new TypeError("MONTH_BEHAVIOR_PRESET_INVALID");
  const category = [...normal.narrative.prediction.essential, ...normal.narrative.prediction.optional].find(c => c.key === categoryKey)!;
  const observed = new Big(category.alreadyRealized), total = new Big(category.projectedMonth.central);
  // Existing observations and explicit projects cannot be undone by a behavioral scenario.
  const floor = observed.plus(category.habitualProjectGross);
  const target = preset === "restaurant-zero" ? floor : preset === "groceries-minus-100" ? total.minus(100) : total.minus(observed).times(.8).plus(observed);
  const amount = (target.lt(floor) ? floor : target).toFixed(2);
  const settings: MonthDecisionSettings = parseMonthDecisionSettings({ ...parseMonthDecisionSettings(ctx.stored.inputs.decision),
    assumptions: { ...ctx.stored.inputs.decision?.assumptions, [categoryKey]: { mode: "CUSTOM", amount } } });
  const plan = deriveMonthScenario(ctx.forecast, { ...ctx.stored.inputs, decision: settings }, null, ctx.asOf, ctx.expenses).economicPlan!;
  return { ok: true as const, categoryKey, amount, projection: plan.narrative.final,
    delta: new Big(plan.narrative.final.central).minus(normal.narrative.final.central).toFixed(2),
    decision: projectMonthDecision(plan, settings, targetMonth, ctx.asOf, ctx.expenses, ctx.forecast.forecastMemory) };
}
