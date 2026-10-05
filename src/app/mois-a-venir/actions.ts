"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAuthenticatedBootstrapClient } from "@/server/bootstrap/auth";
import { getCurrentHousehold } from "@/server/bootstrap/queries";
import { createCanonicalReadClient } from "@/server/canonical/client";
import { readPlanningMonthForecast } from "@/server/phase2/month-planning-read";
import { readMonthInputs, saveMonthInputs } from "@/server/phase2/month-inputs";
import { deriveMonthScenario, monthInputsSchema, type MonthInputs } from "@/server/phase2/month-scenario";
import { readPlannedExpenses } from "@/server/phase2/planned-expenses";

import { planningDate } from "@/server/phase2/planning-date";
import { parseMonthDecisionSettings } from "@/domain/phase2/month-decision-contract";
import { simulateMonthChoice, monthChoiceDigest } from "@/server/phase2/month-choices";
import { projectMonthControlWorkbench } from "@/server/phase2/month-control-center";
import type { MonthChoice } from "@/domain/phase2/month-choice-contract";
import { makeForecastCheckpoint, insertForecastCheckpoint } from "@/server/phase2/forecast-memory";
import { projectMonthDecision } from "@/server/phase2/month-decision-projection";
import { parseBenefitProvider, benefitResourceKey, type BenefitProvider, type MonthlyBenefitWalletInputs } from "@/domain/phase2/benefit-wallets";
import { parseSavingsMetadata } from "@/domain/phase2/savings-allocations";
import { makeMonthChoiceUndo, restoreMonthChoiceUndo } from "@/server/phase2/month-choice-undo";

const field = (form: FormData, key: string): string => String(form.get(key) ?? "").trim();
const optionalMoney = (form: FormData, key: string): string | null => field(form, key) || null;

async function mutateMonthInputs(form: FormData, controlCenter = false): Promise<void> {
  const targetMonth = field(form, "targetMonth");
  if (!/^\d{4}-(0[1-9]|1[0-2])$/u.test(targetMonth)) throw new TypeError("MONTH_INPUT_TARGET_INVALID");
  const { supabase, user } = await getAuthenticatedBootstrapClient();
  const household = await getCurrentHousehold(supabase);
  if (!household) throw new TypeError("MONTH_INPUT_HOUSEHOLD_MISSING");
  if (controlCenter && targetMonth < planningDate(household.timezone).slice(0, 7)) throw new TypeError("MONTH_DECISION_PAST_READ_ONLY");
  const forecast = await readPlanningMonthForecast(createCanonicalReadClient(), household.householdId, targetMonth);
  const stored = await readMonthInputs(supabase, household.householdId, targetMonth);
  const current: MonthInputs = monthInputsSchema.parse(stored.inputs);
  const intent = field(form, "intent");
  if (["update-declared-savings", "remove-declared-outflow"].includes(intent)) {
    const saving = current.declaredOutflows.find(item => item.id === field(form, "outflowId"));
    if (!saving || saving.adjustability === "PROTECTED") throw new TypeError("MONTH_CHOICE_SAVINGS_PROTECTED_OR_UNKNOWN");
  }
  const walletInputs = current.benefitWallets!;
  const withLoading = (provider: BenefitProvider, amount: string | null, date: string | null): MonthInputs => {
    const key = benefitResourceKey(provider), declaredResources = { ...current.declaredResources }, resourceOverrides = { ...current.resourceOverrides };
    if (amount === null) delete declaredResources[key]; else declaredResources[key] = amount;
    delete resourceOverrides[key];
    return { ...current, declaredResources, resourceOverrides, benefitWallets: { ...walletInputs, [provider]: {
      ...walletInputs[provider], expectedLoading: amount === null ? null : { amount, expectedDate: date } } } };
  };
  const legacySwile = (): MonthlyBenefitWalletInputs => {
    const amount = optionalMoney(form, "benefitBalance"), date = field(form, "benefitDate");
    const observations = walletInputs.SWILE.balanceObservations;
    const row = amount === null ? null : { id: observations.find(row => row.asOfDate === date)?.id ?? randomUUID(), amount, asOfDate: date,
      provenance: "USER_DECLARED" as const, ...(date < `${targetMonth}-01` ? { isOpeningObservation: true } : {}) };
    const loading = optionalMoney(form, "benefitLoading");
    return { ...walletInputs, SWILE: { ...walletInputs.SWILE,
      balanceObservations: row ? [...observations.filter(old => old.asOfDate !== date), row] : observations,
      expectedLoading: loading === null ? walletInputs.SWILE.expectedLoading : { amount: loading, expectedDate: field(form, "loadingDate") || null } } };
  };
  let next: MonthInputs;
  if (["save-month-assumption", "clear-month-assumption", "save-month-goal", "clear-month-goal", "save-category-target", "clear-category-target"].includes(intent)) {
    if (targetMonth < planningDate(household.timezone).slice(0, 7)) throw new TypeError("MONTH_DECISION_PAST_READ_ONLY");
    const decision = parseMonthDecisionSettings(current.decision);
    const assumptions = { ...decision.assumptions };
    const categoryTargets = { ...decision.categoryTargets };
    const key = field(form, "categoryKey") as keyof typeof assumptions;
    if (intent === "clear-month-assumption") delete assumptions[key];
    if (intent === "clear-category-target") delete categoryTargets[key];
    if (intent === "save-category-target") categoryTargets[key] = field(form, "categoryTarget");
    if (intent === "save-month-assumption") assumptions[key] = field(form, "assumptionMode") === "CUSTOM"
      ? { mode: "CUSTOM", amount: field(form, "assumptionAmount") } : { mode: field(form, "assumptionMode") as "LOWER" | "HIGHER" };
    next = { ...current, decision: parseMonthDecisionSettings({ ...decision, assumptions, categoryTargets,
      goal: intent === "clear-month-goal" ? null : intent === "save-month-goal" ? field(form, "monthGoal") : decision.goal }) };
  } else if (intent === "settings") {
    const openingAmount = optionalMoney(form, "openingAmount");
    next = { ...current, safetyReserve: field(form, "safetyReserve"),
      openingBalance: openingAmount === null ? null : { amount: openingAmount, asOfDate: field(form, "openingDate") },
      benefitWallets: legacySwile(),
    };
  } else if (intent === "save-reserve") {
    // Compatibility for an already-open old form: an explicit reserve is now a
    // personal goal, never a deduction from projected spending or cash.
    next = { ...current, decision: parseMonthDecisionSettings({ ...parseMonthDecisionSettings(current.decision), goal: field(form, "safetyReserve") }) };
  } else if (intent === "save-bank-balance") {
    const amount = optionalMoney(form, "openingAmount");
    next = { ...current, openingBalance: amount === null ? null : { amount, asOfDate: field(form, "openingDate") } };
  } else if (intent === "save-benefit") {
    next = { ...current, benefitWallets: legacySwile() };
  } else if (intent === "add-wallet-balance-observation" || intent === "remove-wallet-balance-observation") {
    const provider = parseBenefitProvider(field(form, "provider")), wallet = walletInputs[provider];
    let observations = wallet.balanceObservations;
    if (intent === "remove-wallet-balance-observation") observations = observations.filter(row => row.id !== field(form, "observationId"));
    else {
      const date = field(form, "walletBalanceDate");
      if (date > planningDate(household.timezone)) throw new TypeError("BENEFIT_OBSERVATION_IN_FUTURE");
      const id = observations.find(row => row.asOfDate === date)?.id ?? randomUUID();
      observations = [...observations.filter(row => row.asOfDate !== date), { id, amount: field(form, "walletBalanceAmount"), asOfDate: date,
        provenance: "USER_DECLARED" as const, ...(field(form, "walletOpeningObservation") === "on" ? { isOpeningObservation: true } : {}) }];
    }
    next = { ...current, benefitWallets: { ...walletInputs, [provider]: { ...wallet, balanceObservations: observations } } };
  } else if (intent === "save-wallet-expected-loading" || intent === "clear-wallet-expected-loading") {
    const provider = parseBenefitProvider(field(form, "provider"));
    next = withLoading(provider, intent === "clear-wallet-expected-loading" ? null : field(form, "walletLoadingAmount"), field(form, "walletLoadingDate") || null);
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
    next = { ...current, benefitWallets: {
      SWILE: { ...walletInputs.SWILE, expectedLoading: { amount: field(form, "swileResource"), expectedDate: walletInputs.SWILE.expectedLoading?.expectedDate ?? null } },
      EDENRED: { ...walletInputs.EDENRED, expectedLoading: { amount: field(form, "edenredResource"), expectedDate: walletInputs.EDENRED.expectedLoading?.expectedDate ?? null } },
    } };
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
    next = withLoading(key === "benefit:swile" ? "SWILE" : "EDENRED", field(form, "resourceAmount"), walletInputs[key === "benefit:swile" ? "SWILE" : "EDENRED"].expectedLoading?.expectedDate ?? null);
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
  } else if (intent === "set-month-fixed-state") {
    const key = field(form, "componentKey"), state = field(form, "fixedState");
    if (!["EXPECTED", "ABSENT", "DIFFERENT"].includes(state) || !forecast.components.some(part => part.key === key && part.nature === "CONTRACTUAL_EXPECTED" && part.additiveGroup === "obligations" && part.central !== null)) throw new TypeError("FIXED_OVERRIDE_TARGET_INVALID");
    const fixedAmountOverrides = { ...current.fixedAmountOverrides };
    if (state === "DIFFERENT") fixedAmountOverrides[key] = { amount: field(form, "obligationAmount"), dueDate: field(form, "obligationDate") || null, reason: "MONTH_EXCEPTION" };
    else delete fixedAmountOverrides[key];
    next = { ...current, fixedAmountOverrides, excludedFixedObligations: state === "ABSENT" ? [...new Set([...current.excludedFixedObligations, key])] : current.excludedFixedObligations.filter(item => item !== key) };
  } else if (intent === "update-declared-savings") {
    const id = field(form, "outflowId");
    if (!current.declaredOutflows.some(item => item.id === id && item.kind === "SAVINGS")) throw new TypeError("SAVINGS_TARGET_INVALID");
    const metadata = parseSavingsMetadata({ adjustability: field(form, "outflowAdjustability") });
    next = { ...current, declaredOutflows: current.declaredOutflows.map(item => item.id === id ? { ...item, label: field(form, "outflowLabel"), amount: field(form, "outflowAmount"), dueDate: field(form, "outflowDate") || null, adjustability: metadata.adjustability } : item) };
  } else if (intent === "add-declared-savings") {
    next = { ...current, declaredOutflows: [...current.declaredOutflows, {
      id: randomUUID(), label: field(form, "outflowLabel"), amount: field(form, "outflowAmount"),
      dueDate: field(form, "outflowDate") || null, kind: "SAVINGS" as const,
      ...parseSavingsMetadata({ adjustability: field(form, "outflowAdjustability") || undefined }),
    }] };
  } else if (intent === "remove-declared-outflow") {
    next = { ...current, declaredOutflows: current.declaredOutflows.filter((item) => item.id !== field(form, "outflowId")) };
  } else throw new TypeError("MONTH_INPUT_INTENT_INVALID");
  // Validate the derived scenario against the published authority before writing.
  try {
    const plannedExpenses = await readPlannedExpenses(supabase, household.householdId, targetMonth);
    const expectedDigest = field(form, "expectedDigest");
    if (expectedDigest && expectedDigest !== monthChoiceDigest({ forecast, inputs: current, expenses: plannedExpenses, asOf: planningDate(household.timezone) })) throw new TypeError("STALE_PREVIEW");
    deriveMonthScenario(forecast, next, null, planningDate(household.timezone), plannedExpenses);
  } catch (error) {
    if (error instanceof TypeError) {
      if (controlCenter) throw error;
      redirect(`/mois-a-venir?month=${targetMonth}&inputError=1`);
    }
    throw error;
  }
  await saveMonthInputs(supabase, household.householdId, targetMonth, user.id, next);
  revalidatePath("/mois-a-venir");
}

export async function updateMonthInputs(form: FormData): Promise<void> {
  await mutateMonthInputs(form);
}

/** Same monthly mutation owner; structured errors keep the modal's local context. */
export async function updateMonthControlInputs(form: FormData) {
  try { await mutateMonthInputs(form, true); return { ok: true as const, message: "Modification enregistrée pour ce mois." }; }
  catch (error) { return { ok: false as const, message: error instanceof TypeError
    ? "Vérifiez le montant, la date et le contrôle concerné. Les mois passés restent en lecture seule."
    : "Enregistrement impossible pour le moment. Réessayez ; votre saisie est conservée." }; }
}

async function decisionContext(targetMonth: string) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/u.test(targetMonth)) throw new TypeError("MONTH_INPUT_TARGET_INVALID");
  const { supabase, user } = await getAuthenticatedBootstrapClient();
  const household = await getCurrentHousehold(supabase);
  if (!household) throw new TypeError("MONTH_INPUT_HOUSEHOLD_MISSING");
  const asOf = planningDate(household.timezone);
  if (targetMonth < asOf.slice(0, 7)) throw new TypeError("MONTH_DECISION_PAST_READ_ONLY");
  const forecast = await readPlanningMonthForecast(createCanonicalReadClient(), household.householdId, targetMonth);
  const [stored, expenses] = await Promise.all([readMonthInputs(supabase, household.householdId, targetMonth), readPlannedExpenses(supabase, household.householdId, targetMonth)]);
  return { supabase, user, household, asOf, forecast, stored, expenses };
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
  const categoryKey = preset === "restaurant-zero" ? "household-restaurants" : preset === "groceries-minus-100" ? "groceries" : preset === "tobacco-minus-20" ? "tobacco-vape" : null;
  if (!categoryKey) throw new TypeError("MONTH_BEHAVIOR_PRESET_INVALID");
  // Compatibility for an old open UI. The shared engine owns all arithmetic.
  const choice: MonthChoice = { operations: [preset === "groceries-minus-100"
    ? { kind: "CATEGORY", categoryKey, strategy: "REDUCE_AMOUNT", amount: "100.00" }
    : { kind: "CATEGORY", categoryKey, strategy: "REDUCE_PERCENT", percent: preset === "restaurant-zero" ? "100" : "20" }] };
  const result = simulateMonthChoice({ forecast: ctx.forecast, inputs: ctx.stored.inputs, expenses: ctx.expenses, asOf: ctx.asOf }, choice);
  return { ok: true as const, categoryKey, amount: result.nextInputs.decision!.assumptions[categoryKey]!.amount!,
    projection: result.view.after, delta: result.view.delta,
    decision: projectMonthDecision(result.plan, result.nextInputs.decision!, targetMonth, ctx.asOf, ctx.expenses, ctx.forecast.forecastMemory) };
}

export async function previewMonthChoice(targetMonth: string, choice: unknown) {
  const ctx = await decisionContext(targetMonth);
  return simulateMonthChoice({ forecast: ctx.forecast, inputs: ctx.stored.inputs, expenses: ctx.expenses, asOf: ctx.asOf }, choice).view;
}

export async function previewMonthControlCenter(targetMonth: string, purpose: unknown, operations: unknown) {
  const ctx = await decisionContext(targetMonth);
  return projectMonthControlWorkbench({ forecast: ctx.forecast, inputs: ctx.stored.inputs, expenses: ctx.expenses, asOf: ctx.asOf }, purpose, operations);
}

/** Explicit adoption re-reads all authorities and rejects a stale preview. */
export async function applyMonthChoice(targetMonth: string, choice: unknown, expectedDigest: string) {
  const ctx = await decisionContext(targetMonth);
  const context = { forecast: ctx.forecast, inputs: ctx.stored.inputs, expenses: ctx.expenses, asOf: ctx.asOf };
  if (expectedDigest !== monthChoiceDigest(context)) return { ok: false as const, code: "STALE_PREVIEW" as const, message: "Le mois a changé. Relancez la simulation avant d’adopter ce choix." };
  const result = simulateMonthChoice(context, choice);
  if (!result.view.applicable) return { ok: false as const, message: "Ce choix dépend d’un plan annuel : simulation disponible, adoption non disponible." };
  const undoToken = makeMonthChoiceUndo(context, result.nextInputs, choice, ctx.household.householdId, ctx.user.id);
  await saveMonthInputs(ctx.supabase, ctx.household.householdId, targetMonth, ctx.user.id, result.nextInputs);
  revalidatePath("/mois-a-venir");
  return { ok: true as const, preview: result.view, undoToken, message: "Choix adopté pour ce mois." };
}

export async function undoMonthChoice(targetMonth: string, token: string) {
  const ctx = await decisionContext(targetMonth);
  try {
    const next = restoreMonthChoiceUndo({ forecast: ctx.forecast, inputs: ctx.stored.inputs, expenses: ctx.expenses, asOf: ctx.asOf }, token, ctx.household.householdId, ctx.user.id);
    deriveMonthScenario(ctx.forecast, next, null, ctx.asOf, ctx.expenses);
    await saveMonthInputs(ctx.supabase, ctx.household.householdId, targetMonth, ctx.user.id, next);
    revalidatePath("/mois-a-venir");
    return { ok: true as const };
  } catch { return { ok: false as const, message: "Le mois a changé ou le délai d’annulation est dépassé. L’état enregistré est conservé." }; }
}
