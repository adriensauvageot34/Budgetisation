import { createHash, timingSafeEqual } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { gunzipSync } from "node:zlib";
import { NextResponse } from "next/server";
import { parseInstant } from "@/core/time";
import {
  historyV2SharedArtifactIdentity,
  querySnapshotIdentity,
} from "@/server/analytics/materialization/identity";
import { stageHistoryV2GenerationInMemory } from "@/server/analytics/materialization/history-v2";
import { createCanonicalReadClient } from "@/server/canonical/client";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const TOKEN_HASH = "692f58d6dee220be3da849ce909a289561af2946b53c35be3c37fe30addcace1";

type PreflightBundle = {
  readonly implementationSha: string;
  readonly deterministicDigest: string;
  readonly context: Parameters<typeof historyV2SharedArtifactIdentity>[0];
  readonly months: readonly {
    readonly month: string;
    readonly preflight: Parameters<typeof stageHistoryV2GenerationInMemory>[0]["preflight"];
  }[];
};

type PublicationRow = {
  readonly publication_id: string;
  readonly status: string;
  readonly base_analytics_revision: string;
  readonly required_artifact_keys: readonly string[];
  readonly required_query_keys: readonly string[];
};

type RequestBody = {
  readonly token?: unknown;
  readonly action?: unknown;
  readonly month?: unknown;
  readonly publicationId?: unknown;
  readonly expectedAnalyticsRevision?: unknown;
};

function authorized(token: unknown): boolean {
  if (typeof token !== "string") return false;
  const received = Buffer.from(createHash("sha256").update(token).digest("hex"));
  const expected = Buffer.from(TOKEN_HASH);
  return received.length === expected.length && timingSafeEqual(received, expected);
}

function loadBundle(): PreflightBundle {
  const bytes = readFileSync(path.join(process.cwd(), "private", "history-v2-contract-fixes-preflight.json.gz"));
  return JSON.parse(gunzipSync(bytes).toString("utf8")) as PreflightBundle;
}

function subjectColumns(subject: { readonly kind: "household" } | { readonly kind: "person"; readonly personId: string }) {
  return subject.kind === "household"
    ? { subject_kind: "household", subject_id: null }
    : { subject_kind: "person", subject_id: subject.personId };
}

function periodColumns(period: { readonly kind: "month"; readonly month: string } | { readonly kind: "global"; readonly asOf: string }) {
  return period.kind === "month"
    ? { period_kind: "month", period_month: `${period.month}-01`, as_of_month: null }
    : { period_kind: "global", period_month: null, as_of_month: `${period.asOf}-01` };
}

function bundleMonth(bundle: PreflightBundle, month: unknown) {
  if (typeof month !== "string") throw new TypeError("MONTH_REQUIRED");
  const result = bundle.months.find((candidate) => candidate.month === month);
  if (result === undefined) throw new TypeError("MONTH_NOT_PLANNED");
  return result;
}

async function readRevision(client: ReturnType<typeof createCanonicalReadClient>, householdId: string) {
  const { data, error } = await client
    .from("household_revisions")
    .select("household_id,data_revision::text,analytics_revision::text")
    .eq("household_id", householdId)
    .single();
  if (error !== null) throw error;
  return {
    dataRevision: String(data.data_revision),
    analyticsRevision: String(data.analytics_revision),
  };
}

async function readPublication(client: ReturnType<typeof createCanonicalReadClient>, publicationId: unknown): Promise<PublicationRow> {
  if (typeof publicationId !== "string") throw new TypeError("PUBLICATION_ID_REQUIRED");
  const { data, error } = await client
    .from("analytics_publications")
    .select("publication_id,status,base_analytics_revision::text,required_artifact_keys,required_query_keys")
    .eq("publication_id", publicationId)
    .single();
  if (error !== null) throw error;
  return data as PublicationRow;
}

async function barrier(client: ReturnType<typeof createCanonicalReadClient>, publication: PublicationRow) {
  const [{ data: artifacts, error: artifactError }, { data: queries, error: queryError }] = await Promise.all([
    client.from("analytics_artifacts").select("artifact_key,is_active,publication_id").eq("publication_id", publication.publication_id),
    client.from("analytics_query_snapshots").select("query_key,is_active,publication_id").eq("publication_id", publication.publication_id),
  ]);
  if (artifactError !== null) throw artifactError;
  if (queryError !== null) throw queryError;
  const artifactKeys = new Set((artifacts ?? []).map(({ artifact_key }) => String(artifact_key)));
  const queryKeys = new Set((queries ?? []).map(({ query_key }) => String(query_key)));
  const complete = artifactKeys.size === publication.required_artifact_keys.length
    && queryKeys.size === publication.required_query_keys.length
    && publication.required_artifact_keys.every((key) => artifactKeys.has(key))
    && publication.required_query_keys.every((key) => queryKeys.has(key));
  const inactive = [...(artifacts ?? []), ...(queries ?? [])].every(({ is_active }) => is_active === false);
  return {
    complete,
    inactive,
    artifactCount: artifactKeys.size,
    queryCount: queryKeys.size,
  };
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as RequestBody | null;
  if (body === null || !authorized(body.token)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  try {
    const bundle = loadBundle();
    const client = createCanonicalReadClient();
    const context = bundle.context;
    const action = body.action;

    if (action === "inspect") {
      const revision = await readRevision(client, context.householdId);
      const { data: drafts, error } = await client
        .from("analytics_publications")
        .select("publication_id,period_month,status")
        .eq("household_id", context.householdId)
        .eq("status", "draft");
      if (error !== null) throw error;
      return NextResponse.json({
        ok: true,
        projectRef: new URL(process.env.SUPABASE_URL!).hostname.split(".")[0],
        implementationSha: bundle.implementationSha,
        deterministicDigest: bundle.deterministicDigest,
        revision,
        draftCount: drafts?.length ?? 0,
      });
    }

    const selected = bundleMonth(bundle, body.month);
    if (action === "begin") {
      const revision = await readRevision(client, context.householdId);
      if (revision.dataRevision !== context.dataRevision) throw new TypeError("DATA_REVISION_CHANGED");
      const { data: existingDrafts, error: existingError } = await client
        .from("analytics_publications")
        .select("publication_id")
        .eq("household_id", context.householdId)
        .eq("period_month", `${selected.month}-01`)
        .eq("status", "draft");
      if (existingError !== null) throw existingError;
      if ((existingDrafts?.length ?? 0) !== 0) throw new TypeError("DRAFT_ALREADY_EXISTS");
      const { data, error } = await client
        .from("analytics_publications")
        .insert({
          household_id: context.householdId,
          scope_kind: "month",
          period_month: `${selected.month}-01`,
          as_of_month: null,
          source_revision: revision.dataRevision,
          base_analytics_revision: revision.analyticsRevision,
          required_artifact_keys: selected.preflight.manifest.requiredArtifactKeys,
          required_query_keys: selected.preflight.manifest.requiredQueryKeys,
          status: "draft",
        })
        .select("publication_id,status,base_analytics_revision::text,required_artifact_keys,required_query_keys")
        .single();
      if (error !== null) throw error;
      return NextResponse.json({ ok: true, month: selected.month, publication: data });
    }

    const publication = await readPublication(client, body.publicationId);
    if (publication.status !== "draft") throw new TypeError("PUBLICATION_NOT_DRAFT");
    if (
      JSON.stringify(publication.required_artifact_keys) !== JSON.stringify(selected.preflight.manifest.requiredArtifactKeys)
      || JSON.stringify(publication.required_query_keys) !== JSON.stringify(selected.preflight.manifest.requiredQueryKeys)
    ) {
      throw new TypeError("DRAFT_MANIFEST_MISMATCH");
    }

    if (action === "stage") {
      const revision = Number(publication.base_analytics_revision) + 1;
      const stage = stageHistoryV2GenerationInMemory({
        preflight: selected.preflight,
        publicationId: publication.publication_id,
        revision,
        generatedAt: parseInstant(context.asOf),
      });
      const artifactRows = stage.artifacts.map((envelope) => {
        const item = historyV2SharedArtifactIdentity(context, selected.month as never, envelope.artifactFamily, "current");
        return {
          artifact_key: item.artifactKey,
          generation_key: publication.publication_id,
          household_id: item.householdId,
          ...subjectColumns(item.subject),
          ...periodColumns(item.period),
          artifact_family: item.artifactFamily,
          metric_id: item.metricId,
          dimension_key: null,
          bucket_key: null,
          scope_hash: item.scopeHash,
          filter_signature: item.filterSignature,
          method_version: item.methodVersion,
          contract_version: item.contractVersion,
          source_revision: item.period.sourceRevision,
          analytics_revision: publication.base_analytics_revision,
          payload: envelope,
          computed_at: context.asOf,
          publication_id: publication.publication_id,
          is_active: false,
          invalidated_at: null,
          invalidation_revision: null,
        };
      });
      const queryRows = stage.queries.map(({ request: queryRequest, data }) => {
        const item = querySnapshotIdentity(context, queryRequest, "current");
        return {
          query_key: item.queryKey,
          generation_key: publication.publication_id,
          household_id: item.householdId,
          resource: item.resource,
          scope_hash: item.scopeHash,
          normalized_param_signature: item.normalizedParamSignature,
          ...subjectColumns(item.subject),
          ...periodColumns(item.period),
          source_revision: item.period.sourceRevision,
          analytics_revision: publication.base_analytics_revision,
          contract_version: item.contractVersion,
          method_signature: item.methodSignature,
          payload: data,
          computed_at: context.asOf,
          expires_at: null,
          publication_id: publication.publication_id,
          is_active: false,
          invalidated_at: null,
          invalidation_revision: null,
        };
      });
      const { error: artifactError } = await client.from("analytics_artifacts").upsert(artifactRows, {
        onConflict: "artifact_key,source_revision,method_version,contract_version,generation_key",
      });
      if (artifactError !== null) throw artifactError;
      for (let offset = 0; offset < queryRows.length; offset += 10) {
        const { error } = await client.from("analytics_query_snapshots").upsert(queryRows.slice(offset, offset + 10), {
          onConflict: "query_key,source_revision,contract_version,method_signature,generation_key",
        });
        if (error !== null) throw error;
      }
      const completeness = await barrier(client, publication);
      if (!completeness.complete || !completeness.inactive) throw new TypeError("STAGE_BARRIER_FAILED");
      return NextResponse.json({
        ok: true,
        month: selected.month,
        publicationId: publication.publication_id,
        revision,
        factsHash: stage.factsHash,
        completeness,
      });
    }

    if (action === "barrier") {
      const completeness = await barrier(client, publication);
      return NextResponse.json({ ok: completeness.complete && completeness.inactive, month: selected.month, completeness });
    }

    if (action === "finalize") {
      if (typeof body.expectedAnalyticsRevision !== "string") throw new TypeError("EXPECTED_REVISION_REQUIRED");
      if (body.expectedAnalyticsRevision !== publication.base_analytics_revision) throw new TypeError("EXPECTED_REVISION_MISMATCH");
      const completeness = await barrier(client, publication);
      if (!completeness.complete || !completeness.inactive) throw new TypeError("FINALIZE_BARRIER_FAILED");
      const { data, error } = await client.rpc("publish_analytics_materialization", {
        p_publication_id: publication.publication_id,
        p_expected_analytics_revision: body.expectedAnalyticsRevision,
      });
      if (error !== null) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      const { data: activeArtifacts, error: activeArtifactError } = await client
        .from("analytics_artifacts")
        .select("artifact_key", { count: "exact", head: true })
        .eq("publication_id", publication.publication_id)
        .eq("is_active", true);
      void activeArtifacts;
      if (activeArtifactError !== null) throw activeArtifactError;
      const { count: activeQueryCount, error: activeQueryError } = await client
        .from("analytics_query_snapshots")
        .select("query_key", { count: "exact", head: true })
        .eq("publication_id", publication.publication_id)
        .eq("is_active", true);
      if (activeQueryError !== null) throw activeQueryError;
      const { count: activeArtifactCount } = await client
        .from("analytics_artifacts")
        .select("artifact_key", { count: "exact", head: true })
        .eq("publication_id", publication.publication_id)
        .eq("is_active", true);
      return NextResponse.json({
        ok: activeArtifactCount === publication.required_artifact_keys.length
          && activeQueryCount === publication.required_query_keys.length,
        month: selected.month,
        publicationId: publication.publication_id,
        result: row,
        activeArtifactCount,
        activeQueryCount,
      });
    }

    throw new TypeError("ACTION_INVALID");
  } catch (error) {
    return NextResponse.json({
      ok: false,
      error: error instanceof Error ? error.message : "PUBLICATION_FAILED",
    }, { status: 500 });
  }
}
