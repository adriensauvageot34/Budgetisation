import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  globalV2AcceptedQueryMethodSignatures,
  globalV2QueryRegistry,
  parseGlobalBackgroundRhythmsReadModel,
  parseGlobalExpandedReadModel,
  type GlobalV2QueryResourceName,
} from "@/query-api/global-v2";
import { assembleMonthForecast, type ForecastAuthorities, type ForecastOperation, type ForecastRecurrence, type MonthForecast } from "./month-forecast";

const RESOURCES = [
  "analysis_global_background_rhythms", "analysis_global_economic_recurrence_detail",
  "analysis_global_category_need_detail", "analysis_global_routine_detail", "analysis_global_transformations",
] as const;

export async function loadMonthForecastAuthorities(client: SupabaseClient, householdId: string): Promise<ForecastAuthorities> {
  const { data: publication, error: publicationError } = await client.from("analytics_publications")
    .select("publication_id,household_id,source_revision,published_analytics_revision")
    .eq("household_id", householdId).eq("scope_kind", "global").eq("status", "published")
    .order("published_analytics_revision", { ascending: false }).limit(1).maybeSingle();
  if (publicationError) throw publicationError;
  if (!publication) throw new TypeError("FORECAST_ACTIVE_GLOBAL_PUBLICATION_MISSING");

  const { data: snapshots, error: snapshotError } = await client.from("analytics_query_snapshots")
    .select("resource,method_signature,contract_version,payload,publication_id,is_active,invalidated_at")
    .eq("publication_id", publication.publication_id).eq("is_active", true).is("invalidated_at", null)
    .in("resource", [...RESOURCES]).order("resource").range(0, 199);
  if (snapshotError) throw snapshotError;
  if (!snapshots || snapshots.length === 0) throw new TypeError("FORECAST_GLOBAL_SNAPSHOTS_MISSING");
  for (const snapshot of snapshots) {
    const resource = snapshot.resource as GlobalV2QueryResourceName;
    const registry = globalV2QueryRegistry[resource];
    if (!registry || snapshot.contract_version !== registry.contractVersion
      || !globalV2AcceptedQueryMethodSignatures(resource).includes(snapshot.method_signature)) {
      throw new TypeError(`FORECAST_QUERY_REGISTRY_MISMATCH:${resource}`);
    }
    if (snapshot.payload?.publicationMeta?.publicationId !== publication.publication_id) {
      throw new TypeError(`FORECAST_SNAPSHOT_PUBLICATION_MISMATCH:${resource}`);
    }
  }
  const one = (resource: string) => {
    const rows = snapshots.filter((row) => row.resource === resource);
    if (rows.length !== 1) throw new TypeError(`FORECAST_AUTHORITY_CARDINALITY:${resource}`);
    return rows[0]!.payload;
  };
  const background = parseGlobalBackgroundRhythmsReadModel(one("analysis_global_background_rhythms"));
  if (background.food.methodVersion !== "global_food_rhythm@v2-purchase-aware") throw new TypeError("FORECAST_FOOD_PURCHASE_AWARE_REQUIRED");
  const expanded = (resource: string) => snapshots.filter((row) => row.resource === resource).map((row) => parseGlobalExpandedReadModel(row.payload));
  const recurrenceDetails = expanded("analysis_global_economic_recurrence_detail");
  const categoryNeedDetails = expanded("analysis_global_category_need_detail");
  const routineDetails = expanded("analysis_global_routine_detail");
  const recurrenceIds = recurrenceDetails.flatMap((detail) => {
    const ref = detail.rows.find((row) => row.entityRef)?.entityRef;
    return ref?.startsWith("recurrence:") ? [ref.slice(11)] : [];
  });
  if (recurrenceIds.length === 0) throw new TypeError("FORECAST_M1_RECURRENCE_DETAILS_MISSING");
  const start = `${background.period.startMonth}-01`;
  const end = new Date(`${background.period.endMonth}-01T00:00:00Z`);
  end.setUTCMonth(end.getUTCMonth() + 1);
  const endExclusive = end.toISOString().slice(0, 10);
  const [seriesResult, recurrenceOperationsResult, incomeOperationsResult, categoriesResult, needsResult] = await Promise.all([
    client.from("recurrence_series").select("recurrence_series_id,name,cadence_estimee,mode_prevision,actif_prevision")
      .in("recurrence_series_id", recurrenceIds),
    client.from("operations").select("operation_id,recurrence_series_id,date_bancaire,montant,flux,statut,marchand")
      .in("recurrence_series_id", recurrenceIds).gte("date_bancaire", start).lt("date_bancaire", endExclusive).range(0, 999),
    client.from("operations").select("operation_id,recurrence_series_id,date_bancaire,montant,flux,statut,marchand")
      .eq("flux", "Revenu").eq("statut", "Habituel").gte("date_bancaire", start).lt("date_bancaire", endExclusive).range(0, 999),
    client.from("categories").select("category_id,nom_canonique"),
    client.from("needs").select("need_id,name"),
  ]);
  for (const result of [seriesResult, recurrenceOperationsResult, incomeOperationsResult, categoriesResult, needsResult]) {
    if (result.error) throw result.error;
  }
  if ((recurrenceOperationsResult.data?.length ?? 0) === 1000 || (incomeOperationsResult.data?.length ?? 0) === 1000) {
    throw new TypeError("FORECAST_OPERATION_PAGE_LIMIT_REACHED");
  }
  return {
    publication, background, recurrenceDetails, categoryNeedDetails, routineDetails,
    transformation: { visibility: (one("analysis_global_transformations") as { visibility: string }).visibility },
    recurrences: (seriesResult.data ?? []) as ForecastRecurrence[],
    recurrenceOperations: (recurrenceOperationsResult.data ?? []) as ForecastOperation[],
    incomeOperations: (incomeOperationsResult.data ?? []) as ForecastOperation[],
    categories: categoriesResult.data ?? [], needs: needsResult.data ?? [],
  };
}

/** Builds a prospective month in memory from the current Global publication. */
export async function loadMonthForecast(client: SupabaseClient, householdId: string, targetMonth: string): Promise<MonthForecast> {
  return assembleMonthForecast(await loadMonthForecastAuthorities(client, householdId), targetMonth);
}
