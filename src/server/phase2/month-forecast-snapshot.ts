import "server-only";

import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { canonicalSerializeGlobal } from "@/core/global-v2";
import { globalV2ExpectedQueryMethodSignature, globalV2QueryRegistry, parseGlobalV2QueryParams } from "@/query-api/global-v2";
import { globalV2QueryInstanceKey } from "@/server/analytics/materialization/global-query-plan";
import { assembleMonthForecast, type MonthForecast } from "./month-forecast";
import { loadMonthForecastAuthorities } from "./live-month-forecast";
import { readMonthPredictionEvidence } from "./month-prediction-evidence";
import type { MonthPredictionEvidence } from "./remaining-month-forecast";
import { readForecastMemory, type ForecastCheckpoint } from "./forecast-memory";

export const MONTH_FORECAST_RESOURCE = "phase2_month_forecast" as const;
const sha256 = (value: unknown): string => createHash("sha256").update(canonicalSerializeGlobal(value), "utf8").digest("hex");
export type MonthForecastSnapshot = MonthForecast & {
  readonly forecastMemory?: readonly ForecastCheckpoint[];
  readonly calibration?: import("./remaining-month-forecast").ForecastCalibration;
  readonly predictionEvidence?: MonthPredictionEvidence;
  readonly publicationMeta: { readonly publicationId: string; readonly revision: number; readonly factsHash: string; readonly manifestHash: string };
  readonly resourceMeta: { readonly contractVersion: string; readonly methodSignature: string; readonly policyVersions: Readonly<Record<string, string>>; readonly resourceInputHash: string };
};

async function activeIdentity(client: SupabaseClient, householdId: string) {
  const { data: publication, error: publicationError } = await client.from("analytics_publications")
    .select("publication_id,source_revision,published_analytics_revision")
    .eq("household_id", householdId).eq("scope_kind", "global").eq("status", "published")
    .order("published_analytics_revision", { ascending: false }).limit(1).maybeSingle();
  if (publicationError) throw publicationError;
  if (!publication) throw new TypeError("FORECAST_ACTIVE_GLOBAL_PUBLICATION_MISSING");
  const { data: background, error: backgroundError } = await client.from("analytics_query_snapshots")
    .select("scope_hash,payload")
    .eq("household_id", householdId).eq("publication_id", publication.publication_id)
    .eq("resource", "analysis_global_background_rhythms").eq("is_active", true).is("invalidated_at", null).single();
  if (backgroundError) throw backgroundError;
  const publicationMeta = background.payload?.publicationMeta;
  if (publicationMeta?.publicationId !== publication.publication_id
    || publicationMeta?.revision !== publication.published_analytics_revision) throw new TypeError("FORECAST_ACTIVE_GENERATION_MISMATCH");
  return { publication, scopeHash: background.scope_hash as string, publicationMeta };
}

/** One active monthly snapshot; the existing Global manifest remains unchanged. */
export async function materializeMonthForecast(client: SupabaseClient, householdId: string, targetMonth: string): Promise<MonthForecastSnapshot> {
  const params = parseGlobalV2QueryParams(MONTH_FORECAST_RESOURCE, { targetMonth });
  const authorities = await loadMonthForecastAuthorities(client, householdId);
  const identity = await activeIdentity(client, householdId);
  if (identity.publication.publication_id !== authorities.publication.publication_id) throw new TypeError("FORECAST_GENERATION_CHANGED_DURING_BUILD");
  const forecast = assembleMonthForecast(authorities, targetMonth);
  const contract = globalV2QueryRegistry[MONTH_FORECAST_RESOURCE];
  const methodSignature = globalV2ExpectedQueryMethodSignature(MONTH_FORECAST_RESOURCE);
  const payload = contract.schema.parse({
    ...forecast,
    publicationMeta: identity.publicationMeta,
    resourceMeta: {
      contractVersion: contract.contractVersion, methodSignature, policyVersions: contract.policyVersions,
      resourceInputHash: sha256({ publicationId: forecast.meta.sourcePublicationId, sourceRevision: forecast.meta.sourceRevision,
        analyticsRevision: forecast.meta.analyticsRevision, targetMonth, methodSignature }),
    },
  }) as MonthForecastSnapshot;
  const queryKey = globalV2QueryInstanceKey(MONTH_FORECAST_RESOURCE, identity.scopeHash, params);
  const { error } = await client.from("analytics_query_snapshots").upsert({
    query_key: queryKey, generation_key: forecast.meta.sourcePublicationId, household_id: householdId,
    resource: MONTH_FORECAST_RESOURCE, scope_hash: identity.scopeHash,
    normalized_param_signature: sha256(params), subject_kind: "household", subject_id: null,
    period_kind: "month", period_month: `${targetMonth}-01`, as_of_month: null,
    source_revision: forecast.meta.sourceRevision, analytics_revision: forecast.meta.analyticsRevision,
    contract_version: contract.contractVersion, method_signature: methodSignature, payload,
    computed_at: forecast.meta.computedAt, expires_at: null,
    // Monthly forecast is tied to the active Global generation by generation_key and payload meta.
    // Keeping the FK empty preserves the sealed Global manifest's exact snapshot count.
    publication_id: null, is_active: true, invalidated_at: null, invalidation_revision: null,
  }, { onConflict: "query_key,source_revision,contract_version,method_signature,generation_key" });
  if (error) throw error;
  const { error: invalidationError } = await client.from("analytics_query_snapshots")
    .update({ is_active: false, invalidated_at: forecast.meta.computedAt, invalidation_revision: forecast.meta.sourceRevision })
    .eq("household_id", householdId).eq("resource", MONTH_FORECAST_RESOURCE)
    .eq("period_month", `${targetMonth}-01`).eq("is_active", true).neq("generation_key", forecast.meta.sourcePublicationId);
  if (invalidationError) throw invalidationError;
  return payload;
}

/** Validate the published forecast, then attach request-local canonical evidence.
 * No prediction or enriched snapshot is written back. */
export async function queryMonthForecast(client: SupabaseClient, householdId: string, targetMonth: string): Promise<MonthForecastSnapshot> {
  const params = parseGlobalV2QueryParams(MONTH_FORECAST_RESOURCE, { targetMonth });
  const identity = await activeIdentity(client, householdId);
  const contract = globalV2QueryRegistry[MONTH_FORECAST_RESOURCE];
  const methodSignature = globalV2ExpectedQueryMethodSignature(MONTH_FORECAST_RESOURCE);
  const queryKey = globalV2QueryInstanceKey(MONTH_FORECAST_RESOURCE, identity.scopeHash, params);
  const { data: row, error } = await client.from("analytics_query_snapshots")
    .select("payload,contract_version,method_signature,source_revision,analytics_revision,scope_hash,normalized_param_signature")
    .eq("household_id", householdId).eq("resource", MONTH_FORECAST_RESOURCE)
    .eq("query_key", queryKey).eq("generation_key", identity.publication.publication_id)
    .eq("period_kind", "month").eq("period_month", `${targetMonth}-01`)
    .eq("is_active", true).is("invalidated_at", null).maybeSingle();
  if (error) throw error;
  if (!row) throw new TypeError("FORECAST_ACTIVE_MONTH_SNAPSHOT_MISSING");
  if (row.contract_version !== contract.contractVersion || row.method_signature !== methodSignature
    || row.scope_hash !== identity.scopeHash || row.normalized_param_signature !== sha256(params)
    || row.source_revision !== identity.publication.source_revision
    || row.analytics_revision !== identity.publication.published_analytics_revision) throw new TypeError("FORECAST_SNAPSHOT_IDENTITY_MISMATCH");
  const payload = contract.schema.parse(row.payload) as MonthForecastSnapshot;
  if (payload.meta.targetMonth !== targetMonth || payload.publicationMeta.publicationId !== identity.publication.publication_id
    || payload.resourceMeta.methodSignature !== methodSignature
    || payload.publicationMeta.factsHash !== identity.publicationMeta.factsHash
    || payload.publicationMeta.manifestHash !== identity.publicationMeta.manifestHash) throw new TypeError("FORECAST_SNAPSHOT_PAYLOAD_MISMATCH");
  const [predictionEvidence, forecastMemory] = await Promise.all([
    readMonthPredictionEvidence(client, householdId, targetMonth), readForecastMemory(client, householdId, targetMonth),
  ]);
  return { ...payload, predictionEvidence, forecastMemory };
}

/** A report target may not have a published monthly cache yet. Resolve its own
 * month from the current canonical authorities, without writing a snapshot. */
export async function resolvePlanningMonthForecast(client: SupabaseClient, householdId: string,
  targetMonth: string): Promise<MonthForecastSnapshot> {
  parseGlobalV2QueryParams(MONTH_FORECAST_RESOURCE, { targetMonth });
  const [authorities, identity] = await Promise.all([
    loadMonthForecastAuthorities(client, householdId), activeIdentity(client, householdId),
  ]);
  if (authorities.publication.publication_id !== identity.publication.publication_id)
    throw new TypeError("FORECAST_GENERATION_CHANGED_DURING_BUILD");
  const forecast = assembleMonthForecast(authorities, targetMonth);
  const contract = globalV2QueryRegistry[MONTH_FORECAST_RESOURCE];
  const methodSignature = globalV2ExpectedQueryMethodSignature(MONTH_FORECAST_RESOURCE);
  const payload = contract.schema.parse({ ...forecast, publicationMeta: identity.publicationMeta,
    resourceMeta: { contractVersion: contract.contractVersion, methodSignature, policyVersions: contract.policyVersions,
      resourceInputHash: sha256({ publicationId: forecast.meta.sourcePublicationId, sourceRevision: forecast.meta.sourceRevision,
        analyticsRevision: forecast.meta.analyticsRevision, targetMonth, methodSignature }) } }) as MonthForecastSnapshot;
  const [predictionEvidence, forecastMemory] = await Promise.all([
    readMonthPredictionEvidence(client, householdId, targetMonth), readForecastMemory(client, householdId, targetMonth),
  ]);
  return { ...payload, predictionEvidence, forecastMemory };
}
