import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { defaultMonthInputs, monthInputsSchema, type MonthInputs } from "./month-scenario";
import { validateWalletMonth } from "@/domain/phase2/benefit-wallets";

export type StoredMonthInputs = Readonly<{ inputs: MonthInputs; updatedAt: string | null; updatedBy: string | null }>;

export async function readMonthInputs(client: SupabaseClient, householdId: string, targetMonth: string): Promise<StoredMonthInputs> {
  const { data, error } = await client.from("phase2_month_inputs").select("payload,updated_at,updated_by")
    .eq("household_id", householdId).eq("target_month", `${targetMonth}-01`).maybeSingle();
  if (error) throw error;
  return data === null ? { inputs: defaultMonthInputs(), updatedAt: null, updatedBy: null }
    : { inputs: monthInputsSchema.parse(data.payload), updatedAt: data.updated_at, updatedBy: data.updated_by };
}

export async function saveMonthInputs(client: SupabaseClient, householdId: string, targetMonth: string,
  userId: string, inputs: MonthInputs, expected?: {updatedAt:string|null}): Promise<StoredMonthInputs> {
  const payload = monthInputsSchema.parse(inputs);
  validateWalletMonth(payload.benefitWallets!, targetMonth);
  if (payload.plannedEvents.length !== 0) throw new TypeError("LEGACY_PLANNED_EVENTS_CUTOVER_REQUIRED");
  const { plannedEvents: _legacyPlannedEvents, benefit: _legacyBenefit, ...settingsPayload } = payload;
  const updatedAt = new Date(Math.max(Date.now(),expected?.updatedAt ? Date.parse(expected.updatedAt)+1 : 0)).toISOString();
  const row={
    household_id: householdId, target_month: `${targetMonth}-01`, payload: settingsPayload,
    updated_by: userId, updated_at: updatedAt,
  };
  if(expected){
    const query=expected.updatedAt===null ? client.from("phase2_month_inputs").insert(row)
      :client.from("phase2_month_inputs").update({payload:settingsPayload,updated_by:userId,updated_at:updatedAt})
        .eq("household_id",householdId).eq("target_month",`${targetMonth}-01`).eq("updated_at",expected.updatedAt);
    const {data,error}=await query.select("payload,updated_at,updated_by").maybeSingle();
    if(error?.code==="23505")throw new TypeError("MONTH_INPUT_STALE");
    if(error)throw error;
    if(!data)throw new TypeError("MONTH_INPUT_STALE");
    return {inputs:payload,updatedAt:data.updated_at,updatedBy:data.updated_by};
  }
  const { error } = await client.from("phase2_month_inputs").upsert(row, { onConflict: "household_id,target_month" });
  if (error) throw error;
  return { inputs: payload, updatedAt, updatedBy: userId };
}
