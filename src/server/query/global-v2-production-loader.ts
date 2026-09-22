import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { parseInstant } from "@/core/time";
import {
  type GlobalExpandedReadModel,
  type GlobalInitialReadModel,
  type GlobalReadModelPublicationMeta,
  type GlobalV2QueryRequest,
} from "@/query-api/global-v2";
import { buildPersonaDirectModel, personaDirectDetailKey, selectPersonaDirectOwnerRefs, type PersonaDirectLabels } from "@/query-api/global-v2/persona-direct-presentation";
import { PERSONA_EDITORIAL_SCHEMA_VERSION, type resolveGlobalPersonaEditorial } from "@/server/analytics/global-v2-persona-editorial";
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
  return { client, context, generation, services, pin: new GlobalGenerationPin() };
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
  const started = performance.now();
  const runtime = await createGlobalV2ProductionRuntime();
  const initial = await readGlobalV2ProductionSnapshot({ runtime, resource: "analysis_global_manifest", params: {} });
  const overview = (await readGlobalV2ProductionSnapshot({ runtime, resource: "analysis_global_personas_expanded", params: { sectionKey: "OVERVIEW" } })).data as GlobalExpandedReadModel;
  const personIds = (overview.profile?.profiles ?? []).filter((profile) => profile.scope === "PERSONAL" && profile.subject.kind === "PERSON").slice(0, 2).map((profile) => String(profile.subject.personId));
  const indexRequests = personIds.map((personId) => ({ resource: "analysis_global_persona_detail" as const, params: { entityRef: `person:${personId}` } }));
  await runtime.services.primeSnapshotRows(indexRequests);
  const indexResults = await Promise.all(indexRequests.map((request) => readGlobalV2ProductionSnapshot({ runtime, ...request })));
  const indices = indexResults.map((result) => (result.data as GlobalExpandedReadModel).personaDetailIndex).filter((index) => index !== undefined);
  if (indices.length !== personIds.length) throw new TypeError("GLOBAL_PERSONA_DETAIL_INDEX_MISSING");
  const { data: labelArtifacts, error: labelsError } = await runtime.client.from("analytics_artifacts")
    .select("payload")
    .eq("household_id", runtime.context.householdId)
    .eq("publication_id", runtime.generation.publicationId)
    .eq("artifact_family", "global_presentation_labels")
    .eq("is_active", true)
    .is("invalidated_at", null);
  if (labelsError !== null) throw labelsError;
  if (labelArtifacts?.length !== 1) throw new TypeError("GLOBAL_PERSONA_PRESENTATION_LABELS_MISSING");
  const labelsPayload = labelArtifacts[0]!.payload as { readonly publicationMeta?: GlobalReadModelPublicationMeta; readonly presentationLabels?: PersonaDirectLabels };
  if (labelsPayload.publicationMeta?.publicationId !== runtime.generation.publicationId
    || labelsPayload.publicationMeta.revision !== runtime.generation.analyticsRevision
    || labelsPayload.publicationMeta.factsHash !== runtime.generation.publicationMeta.factsHash
    || labelsPayload.publicationMeta.manifestHash !== runtime.generation.publicationMeta.manifestHash
    || labelsPayload.presentationLabels?.needs === undefined) throw new TypeError("GLOBAL_PERSONA_PRESENTATION_LABELS_GENERATION_MISMATCH");
  const refs = selectPersonaDirectOwnerRefs({ overview, indices, labels: labelsPayload.presentationLabels });
  const ownerRequests = refs.map((ref) => ({ resource: ref.resource, params: { entityRef: ref.entityRef } }));
  await runtime.services.primeSnapshotRows(ownerRequests);
  const ownerResults = await Promise.all(ownerRequests.map((request) => readGlobalV2ProductionSnapshot({ runtime, ...request })));
  const details = new Map(refs.map((ref, index) => [personaDirectDetailKey(ref), ownerResults[index]!.data as GlobalExpandedReadModel]));
  const persona = buildPersonaDirectModel({ overview, indices, details, labels: labelsPayload.presentationLabels, ownerDetailResolutionsInitial: refs.length, serverBuildMs: Math.round(performance.now() - started) });
  return {
    bundle: { initial: initial.data as GlobalInitialReadModel, persona },
    certifiedThrough: runtime.generation.scope.time.certifiedThrough,
  };
}

/** Compact, generation-pinned P4.8-A read model for the next Persona UI lot. */
export async function loadGlobalV2PersonaEditorialReadModel(): Promise<Awaited<ReturnType<typeof resolveGlobalPersonaEditorial>>> {
  const runtime = await createGlobalV2ProductionRuntime();
  const { data, error } = await runtime.client.from("analytics_artifacts")
    .select("payload")
    .eq("household_id", runtime.context.householdId)
    .eq("publication_id", runtime.generation.publicationId)
    .eq("artifact_family", "global_persona_editorial")
    .eq("is_active", true)
    .is("invalidated_at", null);
  if (error !== null) throw error;
  if (data?.length !== 1) throw new TypeError("GLOBAL_PERSONA_EDITORIAL_ARTIFACT_MISSING");
  const payload = data[0]!.payload as { readonly publicationMeta?: GlobalReadModelPublicationMeta; readonly editorial?: Awaited<ReturnType<typeof resolveGlobalPersonaEditorial>> };
  if (payload.publicationMeta?.publicationId !== runtime.generation.publicationId
    || payload.publicationMeta.revision !== runtime.generation.analyticsRevision
    || payload.publicationMeta.factsHash !== runtime.generation.publicationMeta.factsHash
    || payload.publicationMeta.manifestHash !== runtime.generation.publicationMeta.manifestHash
    || payload.editorial?.schemaVersion !== PERSONA_EDITORIAL_SCHEMA_VERSION) throw new TypeError("GLOBAL_PERSONA_EDITORIAL_GENERATION_MISMATCH");
  return payload.editorial;
}
