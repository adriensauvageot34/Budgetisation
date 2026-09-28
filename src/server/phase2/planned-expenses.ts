import "server-only";

import { randomUUID } from "node:crypto";
import Big from "big.js";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createCanonicalReadClient } from "@/server/canonical/client";
import type { MonthForecastSnapshot } from "./month-forecast-snapshot";
import { simulatePlannedExpenseScenario, type MonthInputs } from "./month-scenario";

export const PLANNED_EXPENSE_SUBTYPES = {
  outing: ["bar_club", "private_party", "other_outing"],
  food: ["groceries", "restaurant", "fast_food", "delivery", "work_meal"],
  visit_trip: ["family_visit", "friend_visit", "trip_stay", "other_trip"],
  activity: ["leisure", "concert_festival"],
  purchase: [],
  other: [],
} as const;
export type PlannedExpenseFamily = keyof typeof PLANNED_EXPENSE_SUBTYPES;
export type PlannedExpenseStatus = "PLANNED" | "DECLARED_REALIZED";
export type PlannedBaselineKey = "groceries" | "household-restaurants" | "adrien-work-meals" | "manon-work-meals";
export type CostItem = Readonly<{ id: string; label: string; amount: string; baselineKey: PlannedBaselineKey | null }>;
export type PlannedExpenseContext = Readonly<{ participantPersonIds?: readonly string[];
  place?: Readonly<{ kind: "KNOWN"; placeId: string } | { kind: "TEXT"; label: string }> }>;
export type PlannedExpenseDraft = Readonly<{ familyKey: PlannedExpenseFamily; subtypeKey: string | null;
  title: string; plannedDate: string | null; costItems: readonly CostItem[]; context: PlannedExpenseContext }>;
export type PlannedExpense = PlannedExpenseDraft & Readonly<{ id: string; householdId: string; targetMonth: string;
  status: PlannedExpenseStatus; createdBy: string; updatedBy: string; createdAt: string; updatedAt: string }>;
export type PlannedExpenseScenarioEntry = Pick<PlannedExpense, "id" | "targetMonth" | "status" | "costItems">;

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const moneyPattern = /^(?:0|[1-9]\d{0,8})(?:\.\d{1,2})?$/u;
const baselineKeys = new Set<PlannedBaselineKey>(["groceries", "household-restaurants", "adrien-work-meals", "manon-work-meals"]);
const object = (value: unknown, code: string): Record<string, unknown> => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new TypeError(code);
  return value as Record<string, unknown>;
};
const keysOnly = (value: Record<string, unknown>, keys: readonly string[], code: string) => {
  if (Object.keys(value).some((key) => !keys.includes(key))) throw new TypeError(code);
};
const uuid = (value: unknown, code: string): string => {
  if (typeof value !== "string" || !uuidPattern.test(value)) throw new TypeError(code);
  return value;
};
const date = (value: unknown, code: string): string => {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/u.test(value)
    || Number.isNaN(Date.parse(`${value}T12:00:00Z`))
    || new Date(`${value}T12:00:00Z`).toISOString().slice(0, 10) !== value) throw new TypeError(code);
  return value;
};
const title = (value: unknown, code: string): string => {
  if (typeof value !== "string" || value.trim().length < 1 || value.trim().length > 120) throw new TypeError(code);
  return value.trim();
};
export const parseTargetMonth = (value: unknown): string => {
  if (typeof value !== "string" || !/^\d{4}-(0[1-9]|1[0-2])$/u.test(value)) throw new TypeError("PLANNED_EXPENSE_MONTH_INVALID");
  date(`${value}-01`, "PLANNED_EXPENSE_MONTH_INVALID");
  return value;
};
export const grossPlannedExpenseCost = (expense: Pick<PlannedExpenseDraft, "costItems">): string =>
  expense.costItems.reduce((sum, item) => sum.plus(item.amount), new Big(0)).toFixed(2);

export function parsePlannedExpenseDraft(value: unknown, targetMonth: string): PlannedExpenseDraft {
  parseTargetMonth(targetMonth);
  const raw = object(value, "PLANNED_EXPENSE_DRAFT_INVALID");
  keysOnly(raw, ["familyKey", "subtypeKey", "title", "plannedDate", "costItems", "context"], "PLANNED_EXPENSE_DRAFT_FIELDS_INVALID");
  const family = raw.familyKey;
  if (typeof family !== "string" || !(family in PLANNED_EXPENSE_SUBTYPES)) throw new TypeError("PLANNED_EXPENSE_FAMILY_INVALID");
  const familyKey = family as PlannedExpenseFamily;
  const subtypes: readonly string[] = PLANNED_EXPENSE_SUBTYPES[familyKey];
  if (subtypes.length === 0 ? raw.subtypeKey !== null : !subtypes.includes(raw.subtypeKey as string))
    throw new TypeError("PLANNED_EXPENSE_SUBTYPE_INVALID");
  const plannedDate = raw.plannedDate === null ? null : date(raw.plannedDate, "PLANNED_EXPENSE_DATE_INVALID");
  if (plannedDate !== null && !plannedDate.startsWith(`${targetMonth}-`)) throw new TypeError("PLANNED_EXPENSE_DATE_MONTH_INVALID");
  if (!Array.isArray(raw.costItems) || raw.costItems.length < 1 || raw.costItems.length > 50)
    throw new TypeError("PLANNED_EXPENSE_COST_ITEMS_INVALID");
  const costItems: CostItem[] = raw.costItems.map((value: unknown) => {
    const item = object(value, "PLANNED_EXPENSE_COST_ITEM_INVALID");
    keysOnly(item, ["id", "label", "amount", "baselineKey"], "PLANNED_EXPENSE_COST_ITEM_FIELDS_INVALID");
    const id = uuid(item.id, "PLANNED_EXPENSE_COST_ITEM_ID_INVALID");
    const label = title(item.label, "PLANNED_EXPENSE_COST_ITEM_LABEL_INVALID");
    if (typeof item.amount !== "string" || !moneyPattern.test(item.amount) || new Big(item.amount).lte(0))
      throw new TypeError("PLANNED_EXPENSE_COST_ITEM_AMOUNT_INVALID");
    const baselineKey = item.baselineKey;
    if (baselineKey !== null && (typeof baselineKey !== "string" || !baselineKeys.has(baselineKey as PlannedBaselineKey)))
      throw new TypeError("PLANNED_EXPENSE_BASELINE_INVALID");
    if (familyKey === "food") {
      const allowed = family === "food" && raw.subtypeKey === "groceries" ? "groceries"
        : raw.subtypeKey === "work_meal" ? null : "household-restaurants";
      if (baselineKey !== null && (allowed === null ? !["adrien-work-meals", "manon-work-meals"].includes(baselineKey as string)
        : baselineKey !== allowed)) throw new TypeError("PLANNED_EXPENSE_BASELINE_SUBTYPE_INVALID");
    }
    return { id, label, amount: new Big(item.amount).toFixed(2), baselineKey: baselineKey as PlannedBaselineKey | null };
  });
  if (new Set(costItems.map((item) => item.id)).size !== costItems.length) throw new TypeError("PLANNED_EXPENSE_COST_ITEM_ID_DUPLICATE");
  const contextRaw = object(raw.context, "PLANNED_EXPENSE_CONTEXT_INVALID");
  keysOnly(contextRaw, ["participantPersonIds", "place"], "PLANNED_EXPENSE_CONTEXT_FIELDS_INVALID");
  const context: { participantPersonIds?: string[]; place?: PlannedExpenseContext["place"] } = {};
  if (contextRaw.participantPersonIds !== undefined) {
    if (!Array.isArray(contextRaw.participantPersonIds) || contextRaw.participantPersonIds.length > 20)
      throw new TypeError("PLANNED_EXPENSE_PARTICIPANTS_INVALID");
    const ids = contextRaw.participantPersonIds.map((id: unknown) => uuid(id, "PLANNED_EXPENSE_PERSON_ID_INVALID"));
    if (new Set(ids).size !== ids.length) throw new TypeError("PLANNED_EXPENSE_PERSON_DUPLICATE");
    context.participantPersonIds = ids;
  }
  if (contextRaw.place !== undefined) {
    const place = object(contextRaw.place, "PLANNED_EXPENSE_PLACE_INVALID");
    if (place.kind === "KNOWN") {
      keysOnly(place, ["kind", "placeId"], "PLANNED_EXPENSE_PLACE_FIELDS_INVALID");
      context.place = { kind: "KNOWN", placeId: uuid(place.placeId, "PLANNED_EXPENSE_PLACE_ID_INVALID") };
    } else if (place.kind === "TEXT") {
      keysOnly(place, ["kind", "label"], "PLANNED_EXPENSE_PLACE_FIELDS_INVALID");
      context.place = { kind: "TEXT", label: title(place.label, "PLANNED_EXPENSE_PLACE_LABEL_INVALID") };
    } else throw new TypeError("PLANNED_EXPENSE_PLACE_KIND_INVALID");
  }
  if (familyKey === "food" && raw.subtypeKey === "work_meal" && context.participantPersonIds?.length !== 1)
    throw new TypeError("PLANNED_EXPENSE_WORK_MEAL_PERSON_REQUIRED");
  return { familyKey, subtypeKey: raw.subtypeKey as string | null, title: title(raw.title, "PLANNED_EXPENSE_TITLE_INVALID"),
    plannedDate, costItems, context };
}

function parseRow(value: unknown): PlannedExpense {
  const row = object(value, "PLANNED_EXPENSE_ROW_INVALID");
  const targetMonth = date(row.target_month, "PLANNED_EXPENSE_ROW_MONTH_INVALID").slice(0, 7);
  const draft = parsePlannedExpenseDraft({ familyKey: row.family_key, subtypeKey: row.subtype_key, title: row.title,
    plannedDate: row.planned_date, costItems: row.cost_items, context: row.context }, targetMonth);
  if (row.status !== "PLANNED" && row.status !== "DECLARED_REALIZED") throw new TypeError("PLANNED_EXPENSE_STATUS_INVALID");
  return { ...draft, id: uuid(row.planned_expense_id, "PLANNED_EXPENSE_ID_INVALID"),
    householdId: uuid(row.household_id, "PLANNED_EXPENSE_HOUSEHOLD_INVALID"), targetMonth,
    status: row.status, createdBy: uuid(row.created_by, "PLANNED_EXPENSE_CREATOR_INVALID"),
    updatedBy: uuid(row.updated_by, "PLANNED_EXPENSE_UPDATER_INVALID"),
    createdAt: dateTime(row.created_at), updatedAt: dateTime(row.updated_at) };
}
const dateTime = (value: unknown): string => {
  if (typeof value !== "string" || Number.isNaN(Date.parse(value))) throw new TypeError("PLANNED_EXPENSE_TIMESTAMP_INVALID");
  return value;
};

async function validateReferences(client: SupabaseClient, householdId: string, draft: PlannedExpenseDraft): Promise<void> {
  const participantIds = draft.context.participantPersonIds ?? [];
  const workMealPeople = new Set(draft.costItems.flatMap((item) => item.baselineKey === "adrien-work-meals" ? ["Adrien"]
    : item.baselineKey === "manon-work-meals" ? ["Manon"] : []));
  if (workMealPeople.size > 0 && participantIds.length === 0)
    throw new TypeError("PLANNED_EXPENSE_WORK_MEAL_PERSON_REQUIRED");
  if (participantIds.length > 0) {
    const { data, error } = await client.from("persons").select("person_id,display_name,status")
      .eq("household_id", householdId).in("person_id", [...participantIds]);
    if (error) throw error;
    if ((data?.length ?? 0) !== participantIds.length || data?.some((person) => person.status !== "active"))
      throw new TypeError("PLANNED_EXPENSE_PERSON_NOT_IN_HOUSEHOLD");
    if ([...workMealPeople].some((name) => !data?.some((person) => person.display_name === name)))
      throw new TypeError("PLANNED_EXPENSE_WORK_MEAL_BASELINE_PERSON_MISMATCH");
    if (draft.familyKey === "food" && draft.subtypeKey === "work_meal") {
      const name = data![0]!.display_name;
      if (name !== "Adrien" && name !== "Manon") throw new TypeError("PLANNED_EXPENSE_WORK_MEAL_PERSON_UNSUPPORTED");
      const allowed = name === "Adrien" ? "adrien-work-meals" : "manon-work-meals";
      if (draft.costItems.some((item) => item.baselineKey !== null && item.baselineKey !== allowed))
        throw new TypeError("PLANNED_EXPENSE_WORK_MEAL_BASELINE_PERSON_MISMATCH");
    }
  }
  if (draft.context.place?.kind === "KNOWN") {
    const { data, error } = await createCanonicalReadClient().from("referentiel_lieu")
      .select("place_id").eq("place_id", draft.context.place.placeId).eq("private_place", false).maybeSingle();
    if (error) throw error;
    if (!data) throw new TypeError("PLANNED_EXPENSE_PLACE_UNKNOWN");
  }
}

const rowFields = "planned_expense_id,household_id,target_month,family_key,subtype_key,title,planned_date,status,cost_items,context,created_by,updated_by,created_at,updated_at";
const draftColumns = (draft: PlannedExpenseDraft) => ({ family_key: draft.familyKey, subtype_key: draft.subtypeKey,
  title: draft.title, planned_date: draft.plannedDate, cost_items: draft.costItems, context: draft.context });

export async function readPlannedExpenses(client: SupabaseClient, householdId: string, targetMonth: string): Promise<PlannedExpense[]> {
  parseTargetMonth(targetMonth);
  const { data, error } = await client.from("phase2_planned_expenses").select(rowFields)
    .eq("household_id", uuid(householdId, "PLANNED_EXPENSE_HOUSEHOLD_INVALID"))
    .eq("target_month", `${targetMonth}-01`).order("created_at").order("planned_expense_id");
  if (error) throw error;
  return (data ?? []).map(parseRow);
}

/** A draft never writes to Supabase. Editing replaces the saved ID in the same financial path. */
export async function simulatePlannedExpense(client: SupabaseClient, householdId: string,
  forecast: MonthForecastSnapshot, inputs: MonthInputs, saved: readonly PlannedExpense[],
  rawDraft: unknown, asOfDate: string, editedId?: string) {
  const draft = parsePlannedExpenseDraft(rawDraft, forecast.meta.targetMonth);
  await validateReferences(client, uuid(householdId, "PLANNED_EXPENSE_HOUSEHOLD_INVALID"), draft);
  const existing = editedId === undefined ? undefined : saved.find((item) => item.id === uuid(editedId, "PLANNED_EXPENSE_ID_INVALID"));
  if (editedId !== undefined && (!existing || existing.status !== "PLANNED"))
    throw new TypeError("PLANNED_EXPENSE_EDIT_TARGET_INVALID");
  if (saved.some((item) => item.householdId !== householdId || item.targetMonth !== forecast.meta.targetMonth))
    throw new TypeError("PLANNED_EXPENSE_SAVED_SCOPE_INVALID");
  return simulatePlannedExpenseScenario(forecast, inputs, saved,
    { id: existing?.id ?? randomUUID(), targetMonth: forecast.meta.targetMonth, status: "PLANNED", costItems: draft.costItems }, asOfDate);
}
export async function createPlannedExpense(client: SupabaseClient, householdId: string, targetMonth: string,
  userId: string, rawDraft: unknown): Promise<PlannedExpense> {
  const draft = parsePlannedExpenseDraft(rawDraft, targetMonth);
  await validateReferences(client, uuid(householdId, "PLANNED_EXPENSE_HOUSEHOLD_INVALID"), draft);
  const { data, error } = await client.from("phase2_planned_expenses").insert({
    planned_expense_id: randomUUID(), household_id: householdId, target_month: `${targetMonth}-01`,
    ...draftColumns(draft), status: "PLANNED", created_by: uuid(userId, "PLANNED_EXPENSE_USER_INVALID"), updated_by: userId,
  }).select(rowFields).single();
  if (error) throw error;
  return parseRow(data);
}
async function requireExpense(client: SupabaseClient, householdId: string, id: string): Promise<PlannedExpense> {
  const { data, error } = await client.from("phase2_planned_expenses").select(rowFields)
    .eq("household_id", uuid(householdId, "PLANNED_EXPENSE_HOUSEHOLD_INVALID"))
    .eq("planned_expense_id", uuid(id, "PLANNED_EXPENSE_ID_INVALID")).single();
  if (error) throw error;
  return parseRow(data);
}
export async function updatePlannedExpense(client: SupabaseClient, householdId: string, id: string,
  userId: string, rawDraft: unknown): Promise<PlannedExpense> {
  const previous = await requireExpense(client, householdId, id);
  if (previous.status !== "PLANNED") throw new TypeError("PLANNED_EXPENSE_REALIZED_EDIT_FORBIDDEN");
  const draft = parsePlannedExpenseDraft(rawDraft, previous.targetMonth);
  await validateReferences(client, householdId, draft);
  const { data, error } = await client.from("phase2_planned_expenses").update({ ...draftColumns(draft),
    updated_by: uuid(userId, "PLANNED_EXPENSE_USER_INVALID"), updated_at: new Date().toISOString() })
    .eq("household_id", householdId).eq("planned_expense_id", id).eq("status", "PLANNED")
    .select(rowFields).single();
  if (error) throw error;
  const updated = parseRow(data);
  if (updated.createdBy !== previous.createdBy || updated.id !== previous.id || updated.householdId !== previous.householdId)
    throw new TypeError("PLANNED_EXPENSE_IDENTITY_CHANGED");
  return updated;
}
export async function deletePlannedExpense(client: SupabaseClient, householdId: string, id: string): Promise<void> {
  await requireExpense(client, householdId, id);
  const { data, error } = await client.from("phase2_planned_expenses").delete()
    .eq("household_id", householdId).eq("planned_expense_id", id).select("planned_expense_id").single();
  if (error) throw error;
  if (data?.planned_expense_id !== id) throw new TypeError("PLANNED_EXPENSE_DELETE_MISSING");
}
async function setStatus(client: SupabaseClient, householdId: string, id: string, userId: string,
  from: PlannedExpenseStatus, to: PlannedExpenseStatus): Promise<PlannedExpense> {
  const previous = await requireExpense(client, householdId, id);
  if (previous.status !== from) throw new TypeError("PLANNED_EXPENSE_STATUS_TRANSITION_INVALID");
  const { data, error } = await client.from("phase2_planned_expenses").update({ status: to,
    updated_by: uuid(userId, "PLANNED_EXPENSE_USER_INVALID"), updated_at: new Date().toISOString() })
    .eq("household_id", householdId).eq("planned_expense_id", id).eq("status", from).select(rowFields).single();
  if (error) throw error;
  const updated = parseRow(data);
  if (updated.createdBy !== previous.createdBy || updated.id !== previous.id) throw new TypeError("PLANNED_EXPENSE_IDENTITY_CHANGED");
  return updated;
}
export const markPlannedExpenseRealized = (client: SupabaseClient, householdId: string, id: string, userId: string) =>
  setStatus(client, householdId, id, userId, "PLANNED", "DECLARED_REALIZED");
export const restorePlannedExpense = (client: SupabaseClient, householdId: string, id: string, userId: string) =>
  setStatus(client, householdId, id, userId, "DECLARED_REALIZED", "PLANNED");
