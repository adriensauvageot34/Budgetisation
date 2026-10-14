import "server-only";
import { snapshotWork } from "./planner/snapshot-observation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { queryMonthForecast, resolvePlanningMonthForecast, type MonthForecastSnapshot } from "./month-forecast-snapshot";
import type { MonthPredictionEvidence } from "./remaining-month-forecast";

/** Shared read boundary for the page and its monthly actions. Published forecasts
 * remain authoritative; an unpublished report month is resolved without writing. */
export async function readPlanningMonthForecast(client: SupabaseClient, householdId: string, targetMonth: string,
  predictionEvidencePromise?: Promise<MonthPredictionEvidence>): Promise<MonthForecastSnapshot> {
  try { return await snapshotWork("Forecast_Published", () => queryMonthForecast(client, householdId, targetMonth, predictionEvidencePromise)); }
  catch (error) {
    if (!(error instanceof Error) || error.message !== "FORECAST_ACTIVE_MONTH_SNAPSHOT_MISSING") throw error;
    return snapshotWork("Forecast_Unpublished_Resolve", () => resolvePlanningMonthForecast(client, householdId, targetMonth, predictionEvidencePromise));
  }
}
