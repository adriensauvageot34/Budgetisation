"use server";

import { projectGoogleDestination } from "@/domain/phase2/planned-project";
import Big from "big.js";
import { revalidatePath } from "next/cache";
import { getAuthenticatedBootstrapClient } from "@/server/bootstrap/auth";
import { getCurrentHousehold } from "@/server/bootstrap/queries";
import { createCanonicalReadClient } from "@/server/canonical/client";
import { MONTH_FORECAST_RESOURCE, queryMonthForecast, resolvePlanningMonthForecast } from "@/server/phase2/month-forecast-snapshot";
import { readMonthInputs } from "@/server/phase2/month-inputs";
import { monthlyEffectiveSimulation } from "@/server/phase2/planner/monthly-simulation-runtime";
import {
  createPlannedExpense, deletePlannedExpense,
  declarePlannedExpense, readPlannedExpenses, reportPlannedExpense,
  restorePlannedExpense, preparePlannedExpenseSimulation, updatePlannedExpense,
  resolvePlannedExpenseDraft,assertPlannedExpenseCreationReplay,isPlannedExpenseDeclarationReplay,
} from "@/server/phase2/planned-expenses";
import { plannedMutationIssue, type PlannedResult, type PlannedWriteCommand } from "@/domain/phase2/planned-mutations";
import { readPlannedRouteHistory, readPlannedContextOptions } from "@/server/phase2/planned-context";
import { assertPrimaryRouteStop, routePlaceIdentity, stopForPlace } from "@/domain/phase2/planned-routes";
import type { PlannedExpenseDraft } from "@/domain/phase2/planned-contract";
import { resolvePlannedContext, plannedContextModifiers } from "@/domain/phase2/planned-rules";
import { estimatePlannedCar } from "@/server/phase2/planned-car-estimation";
import { plannedJourneyTiming, isTimedFamilyVisit } from "@/domain/phase2/planned-visits";

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
  const today=planningDate(household.timezone);
  let simulation:ReturnType<typeof monthlyEffectiveSimulation>|undefined;
  const effective=()=>simulation??=monthlyEffectiveSimulation(supabase,household.householdId,targetMonth,
    {forecast,monthInputs:stored.inputs,externalIntents:saved,asOfDate:today});
  return { supabase, user, household, forecast, inputs: stored.inputs, saved, today,effective };
}

async function result<T>(work: () => Promise<T>): Promise<PlannedResult<T>> {
  try { return { ok: true, value: await work() }; }
  catch (error) {
    const message=error instanceof Error ? error.message : "";
    const blockedReal=message==="PLANNER_EXTERNAL_REALIZED_RECONCILIATION_REQUIRED"||message.includes("OWNED_SLOT_OBSERVED_RECONCILIATION_REQUIRED");
    return { ok: false, issue: plannedMutationIssue(blockedReal?new TypeError("PLANNED_EFFECTIVE_REAL_RECONCILIATION_REQUIRED"):error) };
  }
}
function requireMonthlyResources(context: Awaited<ReturnType<typeof monthContext>>) {
  if ((["benefit:swile", "benefit:edenred"] as const).some((key) => context.inputs.declaredResources[key] === undefined))
    throw new TypeError("PLANNED_EXPENSE_MONTH_RESOURCES_REQUIRED");
}
type Context=Awaited<ReturnType<typeof monthContext>>;
async function prepare(context:Context,raw:unknown,editedId?:string,purpose:"PREVIEW"|"WRITE"="WRITE",status?:"PLANNED"|"DECLARED_REALIZED",id?:string) {
  const effective=await context.effective();
  const saved=editedId?effective.expenses:effective.expenses.filter(row=>row.id!==id);
  let evaluation:ReturnType<typeof effective.evaluate>|undefined;
  const prepared=await preparePlannedExpenseSimulation(context.supabase,context.household.householdId,
    effective.forecast,effective.inputs,saved,raw,effective.asOf,editedId,purpose,
    {id,actorId:context.user.id,status,simulate:expenses=>{
      evaluation=effective.evaluate(effective.inputs,expenses);return evaluation.scenario;
    }});
  if(!evaluation?.scenario.economicPlan)throw new TypeError("PLANNED_EXPENSE_FORECAST_UNAVAILABLE");
  return {...prepared,...evaluation,effective};
}
function expectCommand(effective:Awaited<ReturnType<Context["effective"]>>,command:PlannedWriteCommand,previewRequired=false) {
  effective.assertExpected(command.expectedPlanRevisionId,command.expectedEffectiveDigest);
  if(previewRequired&&effective.owner==="PLAN_V1"&&!command.expectedEffectiveDigest)throw new TypeError("PLANNED_EFFECTIVE_PLAN_STALE");
}
function scopedExpense(context:Context,id:string) {
  const expense=context.saved.find(row=>row.id===id);
  if(!expense)throw new TypeError("PLANNED_EXPENSE_EDIT_TARGET_INVALID");
  return expense;
}
async function preview(targetMonth: string, rawDraft: unknown, editedId?: string, reality=false,id?:string) {
  const context = await monthContext(targetMonth);
  requireMonthlyResources(context);
  const {draft,scenario,effective,economicKnown,preview:planPreview}=await prepare(context,rawDraft,editedId,"PREVIEW",reality?"DECLARED_REALIZED":undefined,id);
  let keepExisting=false;
  if(editedId)try{effective.assertIndependent(editedId);}catch(error){
    if(!(error instanceof TypeError)||error.message!=="PLANNED_EFFECTIVE_LINKED_INTENTION")throw error;
    keepExisting=true;
  }
  const beforeResult=effective.evaluate(effective.inputs,keepExisting?effective.expenses:effective.expenses.filter(expense=>expense.id!==editedId));
  const before=beforeResult.scenario.economicPlan;
  const after = scenario.economicPlan;
  if (!before || !after) throw new TypeError("PLANNED_EXPENSE_FORECAST_UNAVAILABLE");
  const known=economicKnown&&beforeResult.economicKnown;
  const projection = projectPlannedExpenseImpact(before, after, draft,known);
  const { netAdditionalImpact } = projection;
  const impacts = scenarios.map((key) => new Big(netAdditionalImpact[key]??"0"));
  const minimum = impacts.reduce((smallest, value) => value.lt(smallest) ? value : smallest);
  const maximum = impacts.reduce((largest, value) => value.gt(largest) ? value : largest);
  const restaurantHabitual = draft.familyKey === "food"
    && ["restaurant", "fast_food"].includes(draft.subtypeKey ?? "")
    && draft.costItems.every((item) => item.baselineKey === "household-restaurants");
  return {
    ...projection,
    impactBasis:keepExisting?"REPLACES_CURRENT" as const:"EXCLUDING_TARGET" as const,
    ...(keepExisting?{absorbedByBaseline:{low:null,central:null,high:null},
      effectNarrative:known?`Cette version remplace la dépense enregistrée, sous la même identité. Variation supplémentaire dans le mois : ${projection.netAdditionalImpact.central} €.`:projection.effectNarrative}:{}),
    targetMonth,
    planRevisionId:effective.revisionId,effectiveBaseDigest:effective.baseDigest,
    resolvedDraft: draft,
    availableNow: scenario.availableNow,
    bankCash: planPreview?.projection.cash.knowledge==="UNKNOWN" ? {...after.bankCash,
      plannedAvailable:{status:"UNKNOWN" as const,amount:null,reason:"PLAN_CASH_PROJECTION_UNCERTIFIED"},
      endOfMonth:{low:null,central:null,high:null}} : after.bankCash,
    plannedAvailable: known ? after.narrative.remainderAfterProjects : null,
    estimatedEndOfMonth: known ? after.narrative.final.central : null,
    unpricedComponents: draft.context.project?.unpricedComponents ?? [],
    explanation: keepExisting ? "Comparaison avec la version enregistrée de cette dépense, référencée par le Plan. Son ancien coût est remplacé ; aucun lien n’est supprimé." : !known ? "L’impact total reste inconnu ; les coûts chiffrés et leurs financements restent visibles." : restaurantHabitual
      ? `Compté dans votre enveloppe restaurants habituelle. Impact supplémentaire : ${euro(minimum)} à ${euro(maximum)} € selon le scénario.`
      : "Les lignes habituelles utilisent d’abord leur enveloppe du mois ; seul le dépassement s’ajoute au coût prévu.",
  };
}
export async function previewPlannedExpense(targetMonth: string, rawDraft: unknown, editedId?: string,reality=false,id?:string) {
  return result(() => preview(targetMonth, rawDraft, editedId,reality,id));
}

export async function estimatePlannedRoute(targetMonth: string,
  draft: PlannedExpenseDraft) {
  if (draft.context.visitTiming && !isTimedFamilyVisit(draft))
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
    tripTiming: plannedJourneyTiming(draft), timeKind: draft.context.route.timeKind, preference: draft.context.route.preference ?? draft.context.route.liveEstimate?.preference ?? "FASTEST", manualFuelPrice: draft.context.route.manualFuelPrice },
    { places: options.places, vehicle: options.vehicle, restaurantGooglePlaceId: draft.context.restaurant?.googlePlaceId, googleDestination: projectGoogleDestination(draft),
      history: await readPlannedRouteHistory(createCanonicalReadClient(), context.household.householdId) });
}

export async function savePlannedExpense(targetMonth: string, rawDraft: unknown, command: PlannedWriteCommand) {
  return result(async () => {
    const context = await monthContext(targetMonth);
    requireMonthlyResources(context);
    const editedId = command.expectedUpdatedAt ? command.id : undefined;
    const receipt=!editedId&&context.saved.find(row=>row.id===command.id);
    if(receipt){
      const resolved=await resolvePlannedExpenseDraft(context.supabase,context.household.householdId,targetMonth,rawDraft);
      assertPlannedExpenseCreationReplay(receipt,resolved,context.user.id,targetMonth);
      return {...await freshReadModel(targetMonth,receipt.id),notice:"Déjà enregistré : la version actuelle a été relue, sans nouvelle écriture."};
    }
    const {draft,effective}=await prepare(context,rawDraft,editedId,"WRITE",undefined,command.id);
    expectCommand(effective,command,true);
    const expense = editedId
      ? await updatePlannedExpense(context.supabase, context.household.householdId, editedId, context.user.id, draft, command.expectedUpdatedAt!,effective.assertCurrent)
      : await createPlannedExpense(context.supabase, context.household.householdId, targetMonth, context.user.id, draft, command.id,effective.assertCurrent);
    revalidatePath("/mois-a-venir");
    return { ...(await freshReadModel(targetMonth, expense.id)),
      notice: "Enregistré avec les ressources du mois, les lieux et les estimations de trajet actuellement disponibles." };
  });
}

async function freshReadModel(targetMonth: string, id: string) {
  try {
  const current = await monthContext(targetMonth);
  const effective=await current.effective(),evaluation=effective.evaluate();
  const expense = effective.expenses.find((row) => row.id === id);
  return { expense: expense ?? null, ...evaluation,preview:undefined,owner:effective.owner,planRevisionId:effective.revisionId };
  } catch { throw new TypeError("PLANNED_EXPENSE_COMMITTED_RELOAD_FAILED"); }
}

export async function confirmPlannedExpenseReality(targetMonth: string, rawDraft: unknown,
  command: PlannedWriteCommand, correction = false) {
  return result(async () => {
    const context = await monthContext(targetMonth);
    requireMonthlyResources(context);
    const previous=scopedExpense(context,command.id);
    if(!correction&&previous.status==="DECLARED_REALIZED"){
      const resolved=await resolvePlannedExpenseDraft(context.supabase,context.household.householdId,targetMonth,rawDraft);
      if(isPlannedExpenseDeclarationReplay(previous,resolved,context.user.id))return freshReadModel(targetMonth,previous.id);
    }
    const effective=await context.effective();expectCommand(effective,command,true);
    const expense = await declarePlannedExpense(context.supabase, context.household.householdId, command.id,
      context.user.id, rawDraft, command.expectedUpdatedAt!, async (draft, previous) => {
        if (previous.targetMonth !== targetMonth) throw new TypeError("REALITY_DRAFT_STALE");
        await prepare(context,draft,previous.id,"WRITE","DECLARED_REALIZED");
        await effective.assertCurrent();
      }, correction);
    revalidatePath("/mois-a-venir");
    return freshReadModel(expense.targetMonth, expense.id);
  });
}

export async function restorePlannedExpenseAction(targetMonth: string, command: PlannedWriteCommand) {
  return result(async () => {
    const context = await monthContext(targetMonth);
    const previous=scopedExpense(context,command.id),effective=await context.effective();expectCommand(effective,command);
    const {familyKey,subtypeKey,title,plannedDate,costItems,context:fields}=previous;
    await prepare(context,{familyKey,subtypeKey,title,plannedDate,costItems,context:fields},previous.id,"WRITE","PLANNED");
    const expense = await restorePlannedExpense(context.supabase, context.household.householdId, command.id,
      context.user.id, command.expectedUpdatedAt!,effective.assertCurrent);
    revalidatePath("/mois-a-venir");
    return freshReadModel(expense.targetMonth, expense.id);
  });
}

export async function reportPlannedExpenseAction(targetMonth: string, command: PlannedWriteCommand, plannedDate: string) {
  return result(async () => {
    const context = await monthContext(targetMonth);
    scopedExpense(context,command.id);
    const effective=await context.effective();expectCommand(effective,command);effective.assertIndependent(command.id);
    const expense = await reportPlannedExpense(context.supabase, context.household.householdId, command.id,
      context.user.id, plannedDate, command.expectedUpdatedAt!, async (draft, destinationMonth) => {
        const destination = destinationMonth === targetMonth ? context : await monthContext(destinationMonth);
        requireMonthlyResources(destination);
        const resolved=await prepare(destination,draft,destinationMonth===targetMonth?command.id:undefined,"WRITE",undefined,command.id);
        if(destinationMonth!==targetMonth)effective.evaluate(effective.inputs,effective.expenses.filter(row=>row.id!==command.id));
        await effective.assertCurrent();await resolved.effective.assertCurrent();
      });
    revalidatePath("/mois-a-venir");
    return { targetMonth: expense.targetMonth, ...(await freshReadModel(expense.targetMonth, expense.id)) };
  });
}

export async function removePlannedExpense(targetMonth: string, command: PlannedWriteCommand) {
  return result(async () => {
    const context = await monthContext(targetMonth);
    scopedExpense(context,command.id);
    const effective=await context.effective();expectCommand(effective,command);effective.assertIndependent(command.id);
    effective.evaluate(effective.inputs,effective.expenses.filter(row=>row.id!==command.id));
    await deletePlannedExpense(context.supabase, context.household.householdId, command.id, command.expectedUpdatedAt!,effective.assertCurrent);
    revalidatePath("/mois-a-venir");
    return freshReadModel(targetMonth, command.id);
  });
}
