import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { parseInstant } from "@/core/time";
import {
  type GlobalInitialReadModel,
  type GlobalReadModelPublicationMeta,
  type GlobalV2QueryRequest,
  type ImportedGlobalSummaryReadModel,
} from "@/query-api/global-v2";
import { getBootstrapContext } from "@/server/bootstrap/context";
import { createAuthorizedRuntimeContext, type AuthorizedRuntimeContext } from "@/server/canonical/context";
import { createCanonicalReadClient } from "@/server/canonical/client";
import { SupabaseGlobalManifestStore } from "@/server/analytics/materialization/global-manifest-store";
import { GlobalGenerationPin } from "./global-generation";
import { executeGlobalV2SnapshotQuery } from "./global-v2-runtime";
import { createGlobalV2ProductionQueryServices, type ActiveGlobalV2Generation } from "./global-v2-production-services";

export { createGlobalV2ProductionQueryServices } from "./global-v2-production-services";

async function activeGeneration(input: { readonly client: SupabaseClient; readonly context: AuthorizedRuntimeContext }): Promise<ActiveGlobalV2Generation> {
  const { data: active, error } = await input.client.from("analytics_query_snapshots")
    .select("publication_id,payload")
    .eq("household_id", input.context.householdId)
    .eq("period_kind", "global")
    .eq("resource", "analysis_global_manifest")
    .eq("is_active", true)
    .is("invalidated_at", null)
    .maybeSingle();
  if (error !== null) throw error;
  if (active === null || active.publication_id === null) throw new TypeError("GLOBAL_ACTIVE_GENERATION_MISSING");
  const manifestRead = await new SupabaseGlobalManifestStore(input.client).read(String(input.context.householdId), active.publication_id);
  if (manifestRead.status !== "KNOWN") throw new TypeError(`GLOBAL_ACTIVE_MANIFEST_${manifestRead.status}`);
  const manifest = manifestRead.manifest;
  const publicationMeta = (active.payload as { readonly publicationMeta?: GlobalReadModelPublicationMeta }).publicationMeta;
  if (publicationMeta === undefined
    || publicationMeta.publicationId !== active.publication_id
    || publicationMeta.revision !== Number(manifest.baseAnalyticsRevision) + 1
    || publicationMeta.factsHash !== manifest.publicationFactsHash
    || publicationMeta.manifestHash !== manifest.manifestHash) {
    throw new TypeError("GLOBAL_ACTIVE_GENERATION_METADATA_MISMATCH");
  }
  const { count, error: countError } = await input.client.from("analytics_query_snapshots")
    .select("query_snapshot_id", { count: "exact", head: true })
    .eq("publication_id", active.publication_id)
    .eq("is_active", true)
    .is("invalidated_at", null);
  if (countError !== null) throw countError;
  if (count !== manifest.requiredQueryKeys.length) throw new TypeError("GLOBAL_ACTIVE_MANIFEST_INCOMPLETE");
  if (String(input.context.dataRevision) !== manifest.sourceRevision || Number(input.context.analyticsRevision) !== publicationMeta.revision) {
    throw new TypeError("GLOBAL_ACTIVE_GENERATION_REVISION_MISMATCH");
  }
  return {
    publicationId: active.publication_id,
    analyticsRevision: publicationMeta.revision,
    scope: {
      subject: { kind: "household" },
      time: {
        kind: "global_v2",
        asOf: parseInstant(manifest.asOf),
        certifiedThrough: manifest.certifiedThrough as never,
        ...(manifest.liveThrough === undefined ? {} : { liveThrough: manifest.liveThrough as never }),
      },
    },
    publicationMeta,
    requiredQueryKeys: manifest.requiredQueryKeys,
  };
}

export async function createGlobalV2ProductionRuntime() {
  const bootstrap = await getBootstrapContext();
  if (bootstrap.household === null || bootstrap.revision === null) throw new TypeError("GLOBAL_AUTHORIZED_HOUSEHOLD_MISSING");
  const context = createAuthorizedRuntimeContext(bootstrap, parseInstant(new Date().toISOString()));
  const client = createCanonicalReadClient();
  const generation = await activeGeneration({ client, context });
  const services = createGlobalV2ProductionQueryServices({ client, context, generation });
  return { context, generation, services, pin: new GlobalGenerationPin() };
}

export async function readGlobalV2ProductionSnapshot(input: {
  readonly runtime: Awaited<ReturnType<typeof createGlobalV2ProductionRuntime>>;
  readonly resource: GlobalV2QueryRequest["resource"];
  readonly params: GlobalV2QueryRequest["params"];
}) {
  const result = await executeGlobalV2SnapshotQuery({
    resource: input.resource,
    scope: input.runtime.generation.scope,
    params: input.params,
    expectedGeneration: { publicationId: input.runtime.generation.publicationId, analyticsRevision: input.runtime.generation.analyticsRevision },
  }, input.runtime.services, input.runtime.pin);
  if (result.status !== "READY") throw new TypeError(`GLOBAL_SNAPSHOT_${result.errorCode}`);
  return { data: result.data, publicationMeta: input.runtime.generation.publicationMeta };
}

export async function loadGlobalV2ProductionBundle() {
  const runtime = await createGlobalV2ProductionRuntime();
  const [initial, summary] = await Promise.all([
    readGlobalV2ProductionSnapshot({ runtime, resource: "analysis_global_manifest", params: {} }),
    readGlobalV2ProductionSnapshot({ runtime, resource: "analysis_global_summary_ai", params: {} }),
  ]);
  return {
    bundle: { initial: initial.data as GlobalInitialReadModel, summary: summary.data as ImportedGlobalSummaryReadModel },
    certifiedThrough: runtime.generation.scope.time.certifiedThrough,
  };
}
