import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { defaultMonthInputs, monthInputsSchema, type MonthInputs } from "./month-scenario";

export type StoredMonthInputs = Readonly<{ inputs: MonthInputs; updatedAt: string | null; updatedBy: string | null }>;

export async function readMonthInputs(client: SupabaseClient, householdId: string, targetMonth: string): Promise<StoredMonthInputs> {
  const { data, error } = await client.from("phase2_month_inputs").select("payload,updated_at,updated_by")
    .eq("household_id", householdId).eq("target_month", `${targetMonth}-01`).maybeSingle();
  if (error) throw error;
  return data === null ? { inputs: defaultMonthInputs(), updatedAt: null, updatedBy: null }
    : { inputs: monthInputsSchema.parse(data.payload), updatedAt: data.updated_at, updatedBy: data.updated_by };
}

export async function saveMonthInputs(client: SupabaseClient, householdId: string, targetMonth: string,
  userId: string, inputs: MonthInputs): Promise<StoredMonthInputs> {
  const payload = monthInputsSchema.parse(inputs);
  if (payload.plannedEvents.length !== 0) throw new TypeError("LEGACY_PLANNED_EVENTS_CUTOVER_REQUIRED");
  const { plannedEvents: _legacyPlannedEvents, ...settingsPayload } = payload;
  const updatedAt = new Date().toISOString();
  const { error } = await client.from("phase2_month_inputs").upsert({
    household_id: householdId, target_month: `${targetMonth}-01`, payload: settingsPayload,
    updated_by: userId, updated_at: updatedAt,
  }, { onConflict: "household_id,target_month" });
  if (error) throw error;
  return { inputs: payload, updatedAt, updatedBy: userId };
}
