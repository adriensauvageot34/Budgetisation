import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { parseInstant, parseYearMonth, type YearMonth } from "@/core/time";
import { parseDataRevision } from "@/core/versions";
import { canonicalSerializeQueryParams } from "@/query-api/request";
import type { AuthorizedRuntimeContext } from "@/server/canonical/context";
import { SupabaseAnalyticsMaterializationStore } from "./store";
import { SupabaseHistoryManifestStore } from "./history-manifest-store";
import { SupabaseAnalyticsPublicationStore } from "./publication-store";
import {
  historyV2DependencyManifestSchema, stageHistoryV2GenerationInMemory,
  type HistoryV2PreflightResult, type HistoryV2InMemoryStage,
} from "./history-v2";

/** Receipt from the existing invariant runner, not an oracle used to build data. */
export type HistoryMonthCertification = {
  readonly mode: "READ_ONLY";
  readonly gate: "PASS";
  readonly householdId: string;
  readonly sourceRevision: string;
  readonly month: YearMonth;
  readonly manifestHash: string;
  readonly checks: readonly { readonly id: string; readonly status: "PASS" | "FAIL" }[];
};

export type CertifiedHistoryMonth = {
  readonly preflight: HistoryV2PreflightResult;
  readonly certification: HistoryMonthCertification;
};

export function validateHistoryMonthBuild(context: AuthorizedRuntimeContext, month: YearMonth, result: CertifiedHistoryMonth): void {
  const manifest = historyV2DependencyManifestSchema.parse(result.preflight.manifest);
  const proof = result.certification;
  if (manifest.implementation.status !== "KNOWN" || manifest.householdId !== context.householdId || manifest.month !== month
    || proof.mode !== "READ_ONLY" || proof.gate !== "PASS" || proof.householdId !== context.householdId
    || proof.month !== month || proof.sourceRevision !== context.dataRevision || proof.manifestHash !== manifest.manifestHash
    || proof.checks.length === 0 || proof.checks.some(({ status }) => status !== "PASS")
    || new Set(proof.checks.map(({ id }) => id)).size !== proof.checks.length) {
    throw new TypeError("History build is not certified for this household/month/revision/manifest.");
  }
  // These are existing certification IDs, not new business rules.
  for (const id of ["F01_ACTUAL_COMMON", "F02_DAILY_RECONCILIATION", "F03_DAYS_PLUS_UNASSIGNED",
    "X_MANIFEST_15_RESOURCES", "X_RUNTIME_SCHEMAS", "X_HASHES", "D01_DETERMINISM", "X_PUBLICATION_META"]) {
    if (!proof.checks.some((check) => check.id === id)) throw new TypeError(`Missing History certification ${id}.`);
  }
}

export type HistoryMonthGeneration = CertifiedHistoryMonth & {
  readonly stage: HistoryV2InMemoryStage;
  readonly sourceRevision: string;
  readonly baseAnalyticsRevision: string;
  readonly status: "STAGED_INACTIVE";
};

async function assertCapturedRevisions(client: SupabaseClient, context: AuthorizedRuntimeContext): Promise<void> {
  const state = await new SupabaseAnalyticsPublicationStore(client, "").readRevisionState(context.householdId);
  if (state.dataRevision !== context.dataRevision || state.analyticsRevision !== context.analyticsRevision) {
    throw new TypeError("History rebuild revisions changed; capture a new context and generation.");
  }
}

async function assertFrozenBoundary(client: SupabaseClient): Promise<void> {
  const { data, error } = await client.rpc("history_v2_frozen_publication_contract");
  if (error !== null) throw error;
  if (!Array.isArray(data) || data[0]?.boundary_version !== "history-frozen-month@v1") {
    throw new TypeError("History HC3/HC4 database cutover is required before rebuild/finalize.");
  }
}

async function rows(client: SupabaseClient, table: string, householdId: string, publicationId: string) {
  const result: Record<string, unknown>[] = [];
  for (let offset = 0; ; offset += 200) {
    const { data, error } = await client.from(table).select("*")
      .eq("household_id", householdId).eq("publication_id", publicationId)
      .order(table === "analytics_artifacts" ? "artifact_row_id" : "query_snapshot_id")
      .range(offset, offset + 199);
    if (error !== null) throw error;
    if (data === null) throw new TypeError("History generation read-back missing.");
    result.push(...data);
    if (data.length < 200) return result;
  }
}

/** Read-back verifies every persisted payload byte-semantically, not just row counts. */
async function verifyStoredGeneration(client: SupabaseClient, context: AuthorizedRuntimeContext, generation: HistoryMonthGeneration) {
  const { stage } = generation;
  const manifest = await new SupabaseHistoryManifestStore(client).read(context.householdId, stage.publicationId);
  if (manifest.status !== "KNOWN" || manifest.manifest.manifestHash !== stage.manifest.manifestHash) {
    throw new TypeError("History persisted manifest mismatch.");
  }
  const { data: publication, error } = await client.from("analytics_publications")
    .select("*").eq("household_id", context.householdId).eq("publication_id", stage.publicationId).single();
  if (error !== null) throw error;
  if (publication === null || !["draft", "published"].includes(publication.status)
    || String(publication.source_revision) !== generation.sourceRevision
    || String(publication.base_analytics_revision) !== generation.baseAnalyticsRevision) {
    throw new TypeError("History persisted publication state mismatch.");
  }
  const pairs = [
    { table: "analytics_artifacts", key: "artifact_key", expected: stage.artifacts.map((payload) => ({
      key: stage.manifest.artifactVersions.find((v) => v.artifactInputHash === payload.artifactInputHash)!.artifactKey, payload,
    })) },
    { table: "analytics_query_snapshots", key: "query_key", expected: stage.queries.map((q) => ({ key: q.queryKey, payload: q.data })) },
  ];
  for (const pair of pairs) {
    const stored = await rows(client, pair.table, context.householdId, stage.publicationId);
    if (stored.length !== pair.expected.length || new Set(stored.map((r) => r[pair.key])).size !== stored.length) {
      throw new TypeError("History generation incomplete or duplicated.");
    }
    for (const expected of pair.expected) {
      const row = stored.find((r) => r[pair.key] === expected.key);
      if (row === undefined || row.generation_key !== stage.publicationId || row.invalidated_at !== null
        || (publication.status === "draft" && row.is_active !== false)
        || canonicalSerializeQueryParams(row.payload as Record<string, unknown>)
          !== canonicalSerializeQueryParams(expected.payload as Record<string, unknown>)) {
        throw new TypeError("History persisted content/state mismatch.");
      }
    }
  }
  return publication.status as "draft" | "published";
}

/**
 * One month only. `produce` is the official Canonical→Facts→Analytics→History
 * producer (the existing certification script has a single-month adapter).
 * No planner and no activation. No caller-supplied publication identity.
 */
export async function buildHistoryMonth(input: {
  readonly client: SupabaseClient;
  readonly context: AuthorizedRuntimeContext;
  readonly month: YearMonth;
  readonly sourceRevision: string;
  readonly produce: (scope: { context: AuthorizedRuntimeContext; month: YearMonth; sourceRevision: string }) => Promise<CertifiedHistoryMonth>;
}): Promise<HistoryMonthGeneration> {
  const month = parseYearMonth(input.month);
  if (parseDataRevision(input.sourceRevision) !== input.context.dataRevision) throw new TypeError("History source revision mismatch.");
  await assertFrozenBoundary(input.client);
  await assertCapturedRevisions(input.client, input.context);
  const result = await input.produce({ context: input.context, month, sourceRevision: input.sourceRevision });
  validateHistoryMonthBuild(input.context, month, result);
  // Validate schemas/content before any persistent draft is created.
  const revision = Number(BigInt(input.context.analyticsRevision) + BigInt(1));
  if (!Number.isSafeInteger(revision)) throw new TypeError("History PublicationMeta revision is not safely representable.");
  const preview = stageHistoryV2GenerationInMemory({ preflight: result.preflight,
    publicationId: "read-only-validation", revision, generatedAt: parseInstant(input.context.asOf) });
  await assertCapturedRevisions(input.client, input.context);
  const store = new SupabaseAnalyticsMaterializationStore(input.client, input.context, { readMode: "bypass" });
  const publicationId = await store.beginMonthPublicationProfile({ month,
    requiredArtifactKeys: preview.manifest.requiredArtifactKeys,
    requiredRequests: preview.queries.map(({ request }) => request) });
  const stage = stageHistoryV2GenerationInMemory({ preflight: result.preflight, publicationId,
    revision, generatedAt: parseInstant(input.context.asOf) });
  const generation: HistoryMonthGeneration = { ...result, stage, sourceRevision: input.sourceRevision,
    baseAnalyticsRevision: input.context.analyticsRevision, status: "STAGED_INACTIVE" };
  // Small requests; failure leaves this draft inactive and the old publication intact.
  for (const artifact of stage.artifacts) await store.writeHistoryV2Artifact(artifact, publicationId);
  for (const query of stage.queries) await store.writeQuery(query.request, query.data, publicationId);
  await new SupabaseHistoryManifestStore(input.client).attach(publicationId, stage.manifest);
  await verifyStoredGeneration(input.client, input.context, generation);
  return generation;
}

/** Separate, explicit activation. Published retry is a no-op, never a reactivation. */
export async function finalizeHistoryPublication(input: {
  readonly client: SupabaseClient;
  readonly context: AuthorizedRuntimeContext;
  readonly generation: HistoryMonthGeneration;
}) {
  const { generation, context, client } = input;
  await assertFrozenBoundary(client);
  validateHistoryMonthBuild(context, generation.preflight.manifest.month, generation);
  const reconstructed = stageHistoryV2GenerationInMemory({ preflight: generation.preflight,
    publicationId: generation.stage.publicationId, revision: generation.stage.revision, generatedAt: parseInstant(context.asOf) });
  if (canonicalSerializeQueryParams(reconstructed as unknown as Record<string, unknown>)
    !== canonicalSerializeQueryParams(generation.stage as unknown as Record<string, unknown>)) {
    throw new TypeError("History generation changed after certification.");
  }
  const status = await verifyStoredGeneration(client, context, generation);
  if (status === "draft") await assertCapturedRevisions(client, context);
  return new SupabaseAnalyticsMaterializationStore(client, context)
    .publishPrepared(generation.stage.publicationId, context.analyticsRevision);
}
