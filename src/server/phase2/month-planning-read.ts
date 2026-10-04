import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { queryMonthForecast, resolvePlanningMonthForecast, type MonthForecastSnapshot } from "./month-forecast-snapshot";

/** Shared read boundary for the page and its monthly actions. Published forecasts
 * remain authoritative; an unpublished report month is resolved without writing. */
export async function readPlanningMonthForecast(client: SupabaseClient, householdId: string, targetMonth: string): Promise<MonthForecastSnapshot> {
  try { return await queryMonthForecast(client, householdId, targetMonth); }
  catch (error) {
    if (!(error instanceof Error) || error.message !== "FORECAST_ACTIVE_MONTH_SNAPSHOT_MISSING") throw error;
    return resolvePlanningMonthForecast(client, householdId, targetMonth);
  }
}
