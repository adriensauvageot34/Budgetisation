"use server";

import Big from "big.js";
import { revalidatePath } from "next/cache";
import { getAuthenticatedBootstrapClient } from "@/server/bootstrap/auth";
import { getCurrentHousehold } from "@/server/bootstrap/queries";
import { createCanonicalReadClient } from "@/server/canonical/client";
import { MONTH_FORECAST_RESOURCE, queryMonthForecast, resolvePlanningMonthForecast } from "@/server/phase2/month-forecast-snapshot";
import { readMonthInputs } from "@/server/phase2/month-inputs";
import { deriveMonthScenario } from "@/server/phase2/month-scenario";
import {
  createPlannedExpense, deletePlannedExpense,
  declarePlannedExpense, readPlannedExpenses, reportPlannedExpense,
  restorePlannedExpense, preparePlannedExpenseSimulation, updatePlannedExpense,
} from "@/server/phase2/planned-expenses";
import { plannedMutationIssue, type PlannedResult, type PlannedWriteCommand } from "@/domain/phase2/planned-mutations";
import { readPlannedRouteHistory, readPlannedContextOptions } from "@/server/phase2/planned-context";
import { assertPrimaryRouteStop, routePlaceIdentity, stopForPlace } from "@/domain/phase2/planned-routes";
import type { PlannedExpenseDraft } from "@/domain/phase2/planned-contract";
import { resolvePlannedContext, plannedContextModifiers } from "@/domain/phase2/planned-rules";
import { estimatePlannedCar } from "@/server/phase2/planned-car-estimation";

import { projectPlannedExpenseImpact } from "@/server/phase2/planned-impact";

import { planningDate } from "@/server/phase2/planning-date";

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
  const activeMonth = String(latest?.period_month ?? "").slice(0, 7);
  if (!activeMonth) throw new TypeError("PLANNED_EXPENSE_FORECAST_UNAVAILABLE");
  const [forecast, stored, saved] = await Promise.all([
    targetMonth === activeMonth ? queryMonthForecast(reader, household.householdId, targetMonth)
      : resolvePlanningMonthForecast(reader, household.householdId, targetMonth),
    readMonthInputs(supabase, household.householdId, targetMonth),
    readPlannedExpenses(supabase, household.householdId, targetMonth),
  ]);
  return { supabase, user, household, forecast, inputs: stored.inputs, saved, today: planningDate(household.timezone) };
}

async function result<T>(work: () => Promise<T>): Promise<PlannedResult<T>> {
  try { return { ok: true, value: await work() }; }
  catch (error) { return { ok: false, issue: plannedMutationIssue(error) }; }
}
function requireMonthlyResources(context: Awaited<ReturnType<typeof monthContext>>) {
  if ((["benefit:swile", "benefit:edenred"] as const).some((key) => context.inputs.declaredResources[key] === undefined))
    throw new TypeError("PLANNED_EXPENSE_MONTH_RESOURCES_REQUIRED");
}
async function preview(targetMonth: string, rawDraft: unknown, editedId?: string) {
  const context = await monthContext(targetMonth);
  requireMonthlyResources(context);
  const today = context.today;
  const { draft, scenario } = await preparePlannedExpenseSimulation(context.supabase, context.household.householdId,
    context.forecast, context.inputs, context.saved, rawDraft, today, editedId, "PREVIEW");
  const before = deriveMonthScenario(context.forecast, context.inputs, null, today,
    context.saved.filter((expense) => expense.id !== editedId)).economicPlan;
  const after = scenario.economicPlan;
  if (!before || !after) throw new TypeError("PLANNED_EXPENSE_FORECAST_UNAVAILABLE");
  const projection = projectPlannedExpenseImpact(before, after, draft);
  const { netAdditionalImpact } = projection;
  const impacts = scenarios.map((key) => new Big(netAdditionalImpact[key]));
  const minimum = impacts.reduce((smallest, value) => value.lt(smallest) ? value : smallest);
  const maximum = impacts.reduce((largest, value) => value.gt(largest) ? value : largest);
  const restaurantHabitual = draft.familyKey === "food"
    && ["restaurant", "fast_food"].includes(draft.subtypeKey ?? "")
    && draft.costItems.every((item) => item.baselineKey === "household-restaurants");
  return {
    ...projection,
    targetMonth,
    resolvedDraft: draft,
    explanation: restaurantHabitual
      ? `Compté dans votre enveloppe restaurants habituelle. Impact supplémentaire : ${euro(minimum)} à ${euro(maximum)} € selon le scénario.`
      : "Les lignes habituelles utilisent d’abord leur enveloppe du mois ; seul le dépassement s’ajoute au coût prévu.",
  };
}
export async function previewPlannedExpense(targetMonth: string, rawDraft: unknown, editedId?: string) {
  return result(() => preview(targetMonth, rawDraft, editedId));
}

export async function estimatePlannedRoute(targetMonth: string,
  draft: PlannedExpenseDraft) {
  if (draft.context.visitTiming && (draft.familyKey !== "visit_trip" || draft.subtypeKey !== "family_visit"))
    throw new TypeError("PLANNED_VISIT_TIMING_INVALID");
  const context = await monthContext(targetMonth);
  const resolved = resolvePlannedContext({ familyKey: draft.familyKey, subtypeKey: draft.subtypeKey, modifiers: plannedContextModifiers(draft.context) });
  if (resolved.transport === "FORBIDDEN" || draft.context.transportMode !== "CAR" || draft.context.route?.mode !== "CAR")
    throw new TypeError("PLANNED_ROUTE_FORBIDDEN");
  if (draft.context.restaurant && (draft.familyKey !== "food" || draft.subtypeKey !== "restaurant"
    || (draft.context.route.plannedTime ?? null) !== (draft.context.restaurant.plannedTime ?? null)
    || draft.context.route.timeKind !== "DEPARTURE")) throw new TypeError("PLANNED_ROUTE_TIME_INVALID");
  assertPrimaryRouteStop(draft.context.route.stops, draft.context.place);
  for (const stop of draft.context.route.stops) if (stop.childModule) {
    const child = draft.context.childLocalPlaceRefs?.[stop.childModule];
    const edge = resolved.children.find((e) => e.childModule === stop.childModule);
    if (!child || !edge || edge.rootTransportStopAvailability === "NEVER"
      || routePlaceIdentity(stop) !== routePlaceIdentity(stopForPlace(child, "", "CHILD_LOCAL_PLACE", stop.childModule))) throw new TypeError("PLANNED_ROUTE_CHILD_PLACE_INVALID");
  }
  const { data: people, error } = await context.supabase.from("persons")
    .select("person_id,display_name,status").eq("household_id", context.household.householdId);
  if (error) throw error;
  const options = await readPlannedContextOptions(createCanonicalReadClient(), context.household.householdId,
    (people ?? []).filter((person) => person.status === "active")
      .map((person) => ({ personId: person.person_id, displayName: person.display_name })));
  return estimatePlannedCar({ stops: draft.context.route.stops, plannedDate: draft.plannedDate, plannedTime: draft.context.route.plannedTime,
    tripTiming: draft.context.visitTiming, timeKind: draft.context.route.timeKind, preference: draft.context.route.preference ?? draft.context.route.liveEstimate?.preference ?? "FASTEST", manualFuelPrice: draft.context.route.manualFuelPrice },
    { places: options.places, vehicle: options.vehicle, history: await readPlannedRouteHistory(createCanonicalReadClient(), context.household.householdId) });
}

export async function savePlannedExpense(targetMonth: string, rawDraft: unknown, command: PlannedWriteCommand) {
  return result(async () => {
    const context = await monthContext(targetMonth);
    requireMonthlyResources(context);
    const editedId = command.expectedUpdatedAt ? command.id : undefined;
    const { draft, scenario } = await preparePlannedExpenseSimulation(context.supabase, context.household.householdId,
      context.forecast, context.inputs, editedId ? context.saved : context.saved.filter((row) => row.id !== command.id),
      rawDraft, context.today, editedId);
    if (!scenario.economicPlan) throw new TypeError("PLANNED_EXPENSE_FORECAST_UNAVAILABLE");
    const expense = editedId
      ? await updatePlannedExpense(context.supabase, context.household.householdId, editedId, context.user.id, draft, command.expectedUpdatedAt!)
      : await createPlannedExpense(context.supabase, context.household.householdId, targetMonth, context.user.id, draft, command.id);
    revalidatePath("/mois-a-venir");
    return { ...(await freshReadModel(targetMonth, expense.id)),
      notice: "Enregistré avec les ressources du mois, les lieux et les estimations de trajet actuellement disponibles." };
  });
}

async function freshReadModel(targetMonth: string, id: string) {
  const current = await monthContext(targetMonth);
  const expense = current.saved.find((row) => row.id === id);
  const scenario = deriveMonthScenario(current.forecast, current.inputs, null,
    current.today, current.saved);
  return { expense: expense ?? null, scenario };
}

export async function confirmPlannedExpenseReality(targetMonth: string, rawDraft: unknown,
  command: PlannedWriteCommand, correction = false) {
  return result(async () => {
    const context = await monthContext(targetMonth);
    requireMonthlyResources(context);
    const expense = await declarePlannedExpense(context.supabase, context.household.householdId, command.id,
      context.user.id, rawDraft, command.expectedUpdatedAt!, async (draft, previous) => {
        if (previous.targetMonth !== targetMonth) throw new TypeError("REALITY_DRAFT_STALE");
        const resolved = await preparePlannedExpenseSimulation(context.supabase, context.household.householdId,
          context.forecast, context.inputs, context.saved, draft, context.today, previous.id);
        if (!resolved.scenario.economicPlan) throw new TypeError("PLANNED_EXPENSE_FORECAST_UNAVAILABLE");
      }, correction);
    revalidatePath("/mois-a-venir");
    return freshReadModel(expense.targetMonth, expense.id);
  });
}

export async function restorePlannedExpenseAction(targetMonth: string, command: PlannedWriteCommand) {
  return result(async () => {
    const context = await monthContext(targetMonth);
    const expense = await restorePlannedExpense(context.supabase, context.household.householdId, command.id,
      context.user.id, command.expectedUpdatedAt!);
    revalidatePath("/mois-a-venir");
    return freshReadModel(expense.targetMonth, expense.id);
  });
}

export async function reportPlannedExpenseAction(targetMonth: string, command: PlannedWriteCommand, plannedDate: string) {
  return result(async () => {
    const context = await monthContext(targetMonth);
    const expense = await reportPlannedExpense(context.supabase, context.household.householdId, command.id,
      context.user.id, plannedDate, command.expectedUpdatedAt!, async (draft, destinationMonth) => {
        const destination = destinationMonth === targetMonth ? context : await monthContext(destinationMonth);
        requireMonthlyResources(destination);
        const resolved = await preparePlannedExpenseSimulation(destination.supabase, destination.household.householdId,
          destination.forecast, destination.inputs, destination.saved, draft, destination.today,
          destinationMonth === targetMonth ? command.id : undefined);
        if (!resolved.scenario.economicPlan) throw new TypeError("PLANNED_EXPENSE_FORECAST_UNAVAILABLE");
      });
    revalidatePath("/mois-a-venir");
    return { targetMonth: expense.targetMonth, ...(await freshReadModel(expense.targetMonth, expense.id)) };
  });
}

export async function removePlannedExpense(targetMonth: string, command: PlannedWriteCommand) {
  return result(async () => {
    const context = await monthContext(targetMonth);
    await deletePlannedExpense(context.supabase, context.household.householdId, command.id, command.expectedUpdatedAt!);
    revalidatePath("/mois-a-venir");
    return freshReadModel(targetMonth, command.id);
  });
}
