import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizeAnalysisScope } from "@/core/scope";
import type { YearMonth } from "@/core/time";
import { parseDataRevision } from "@/core/versions";
import type { AuthorizedRuntimeContext } from "@/server/canonical/context";
import { isScopedMaterializationFresh } from "@/server/analytics/materialization/freshness";
import { materializationPeriod } from "@/server/analytics/materialization/identity";
import { historyV2QueryResources } from "@/server/analytics/materialization/history-v2";
import { historyGenerationSignalSchema, type HistoryGenerationSignal } from "@/query-api/history-v2/generation-signal";

/** Metadata only. No payload read, no builder, no writer, no persistent server cache.
 * Conservative month-wide eligibility: an invalidated required row closes the
 * generation signal. Actual Query still enforces its signature and RuntimeSchema.
 */
export async function readHistoryGenerationSignal(
  client: SupabaseClient, context: AuthorizedRuntimeContext, month: YearMonth,
): Promise<HistoryGenerationSignal> {
  const unavailable = () => historyGenerationSignalSchema.parse({
    householdId: context.householdId, month, publicationId: null,
  });
  const rows: Record<string, unknown>[] = [];
  for (let offset = 0; ; offset += 200) {
    const { data, error } = await client.from("analytics_query_snapshots")
      .select("query_key,publication_id,generation_key,source_revision::text,invalidated_at")
      .eq("household_id", context.householdId).eq("period_month", `${month}-01`)
      .eq("subject_kind", "household").eq("contract_version", "v2")
      .in("resource", historyV2QueryResources).eq("is_active", true)
      .order("query_snapshot_id").range(offset, offset + 199);
    if (error !== null) throw error;
    if (data === null) throw new TypeError("History generation metadata unavailable.");
    rows.push(...data);
    if (data.length < 200) break;
  }
  if (rows.length === 0 || rows.some((row) => row.invalidated_at !== null)) return unavailable();
  const ids = new Set(rows.map((row) => row.publication_id));
  if (ids.size !== 1 || typeof rows[0].publication_id !== "string"
    || rows.some((row) => row.generation_key !== row.publication_id)) return unavailable();
  const publicationId = rows[0].publication_id;
  const { data: publication, error } = await client.from("analytics_publications")
    .select("status,source_revision::text,required_query_keys,required_artifact_keys")
    .eq("household_id", context.householdId).eq("period_month", `${month}-01`)
    .eq("publication_id", publicationId).maybeSingle();
  if (error !== null) throw error;
  if (publication?.status !== "published") return unavailable();
  const keys = new Set(rows.map((row) => row.query_key));
  if (!Array.isArray(publication.required_query_keys) || keys.size !== rows.length
    || keys.size !== publication.required_query_keys.length
    || publication.required_query_keys.some((key: string) => !keys.has(key))) return unavailable();
  const artifacts = await client.from("analytics_artifacts")
    .select("artifact_key,source_revision::text,is_active,invalidated_at")
    .eq("household_id", context.householdId).eq("publication_id", publicationId);
  if (artifacts.error !== null) throw artifacts.error;
  if (artifacts.data === null || !Array.isArray(publication.required_artifact_keys)
    || artifacts.data.length !== publication.required_artifact_keys.length
    || artifacts.data.some((row) => !row.is_active || row.invalidated_at !== null
      || !publication.required_artifact_keys.includes(row.artifact_key))) return unavailable();
  const impact = await client.from("analytics_change_log").select("data_revision::text")
    .eq("household_id", context.householdId).eq("affected_month", `${month}-01`)
    .order("data_revision", { ascending: false }).limit(1);
  if (impact.error !== null) throw impact.error;
  const period = materializationPeriod(context, normalizeAnalysisScope({
    subject: { kind: "household" }, time: { kind: "month", month },
  }));
  if (![...rows, ...artifacts.data, publication].every((row) => isScopedMaterializationFresh({
    rowSourceRevision: BigInt(parseDataRevision(row.source_revision)), currentDataRevision: BigInt(context.dataRevision),
    period, latestImpactRevision: BigInt(impact.data?.[0]?.data_revision ?? 0),
  }))) return unavailable();
  // A concurrent switch/correction must not validate a result from an old capture.
  const revision = await client.from("household_revisions").select("data_revision::text,analytics_revision::text")
    .eq("household_id", context.householdId).single();
  if (revision.error !== null) throw revision.error;
  if (String(revision.data?.data_revision) !== context.dataRevision
    || String(revision.data?.analytics_revision) !== context.analyticsRevision) return unavailable();
  return historyGenerationSignalSchema.parse({ householdId: context.householdId, month, publicationId });
}
