import { createClient } from "@supabase/supabase-js";

import { globalV2MethodRef } from "@/query-api/global-v2";
import {
  createGlobalV2CandidateContext,
  GLOBAL_V2_LIVE_PROJECT,
  prepareGlobalV2LiveCandidate,
} from "@/server/analytics/global-v2-production-orchestrator";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const HOUSEHOLD_ID = "955f54ea-6d88-4d71-951f-22aebe8d3c72";
const IMPLEMENTATION_SHA = "954d14d09f6d5e599ce40fb34729551637c37db9";
const AS_OF = "2026-09-09T12:00:00.000Z";
const ONE_TIME_TOKEN = "e78239f6f0f54d03bcc56fdc2311aa65";
const EXPECTED_BREAKDOWN_LABELS = [
  "Nécessité · Contraint",
  "Nécessité · Indispensable",
  "Nécessité · Dépenses ajustables",
  "Nécessité · Optionnel",
  "Comportement · Fixe",
  "Comportement · Variable",
  "Périmètre de vie · Vie courante",
  "Périmètre de vie · Hors quotidien",
] as const;

type JsonRecord = Record<string, unknown>;

function record(value: unknown): JsonRecord {
  if (value === null || typeof value !== "object" || Array.isArray(value)) throw new TypeError("P6_EXPECTED_RECORD");
  return value as JsonRecord;
}

function records(value: unknown): JsonRecord[] {
  if (!Array.isArray(value)) throw new TypeError("P6_EXPECTED_ARRAY");
  return value.map(record);
}

function at(value: unknown, ...path: string[]): unknown {
  return path.reduce<unknown>((current, key) => record(current)[key], value);
}

function numeric(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new TypeError("P6_EXPECTED_NUMBER");
  return parsed;
}

function close(actual: unknown, expected: number, tolerance = 0.000001): boolean {
  return Math.abs(numeric(actual) - expected) <= tolerance;
}

function authorize(request: Request): Response | undefined {
  if (process.env.VERCEL_ENV !== "preview") return Response.json({ error: "not_found" }, { status: 404 });
  if (request.headers.get("authorization") !== `Bearer ${ONE_TIME_TOKEN}`) return Response.json({ error: "forbidden" }, { status: 403 });
  return undefined;
}

function serverClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new TypeError("P6_SERVER_CREDENTIALS_MISSING");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
}

async function buildCandidate() {
  const client = serverClient();
  const context = await createGlobalV2CandidateContext({ client, householdId: HOUSEHOLD_ID, asOf: AS_OF });
  const candidate = await prepareGlobalV2LiveCandidate({
    project: GLOBAL_V2_LIVE_PROJECT,
    client,
    context,
    implementationIdentity: IMPLEMENTATION_SHA,
  });
  return { client, candidate };
}

function proof(candidate: Awaited<ReturnType<typeof prepareGlobalV2LiveCandidate>>) {
  const economicOwner = candidate.ownerOutputs.find(({ moduleKey }) => moduleKey === "ECONOMIC");
  if (economicOwner?.owner !== "GlobalM1HouseholdAuthority") throw new TypeError("P6_M1_OWNER_MISMATCH");
  const output = record(economicOwner.output);
  const minimal = at(output, "state", "minimalState");
  const typical = at(output, "state", "typicalState");
  const margin = at(output, "state", "comparisons", "typicalStateVsMinimalState");
  if (!close(at(minimal, "value"), 1634.0783333333334) || !["KNOWN", "PARTIAL"].includes(String(at(minimal, "status")))) throw new TypeError("P6_MINIMAL_INVALID");
  if (!close(at(typical, "value"), 3124.235) || !close(at(margin, "value"), 1490.1566666666668)) throw new TypeError("P6_ECONOMIC_STATE_INVALID");

  const compact = candidate.snapshots.find(({ resource }) => resource === "analysis_global_economic");
  const overview = candidate.snapshots.find(({ resource, params }) => resource === "analysis_global_economic_expanded" && record(params).sectionKey === "OVERVIEW");
  const breakdown = candidate.snapshots.find(({ resource, params }) => resource === "analysis_global_economic_expanded" && record(params).sectionKey === "BREAKDOWN");
  const patterns = candidate.snapshots.find(({ resource, params }) => resource === "analysis_global_economic_expanded" && record(params).sectionKey === "PATTERNS");
  const method = candidate.snapshots.find(({ resource, params }) => resource === "analysis_global_methodology" && record(params).moduleKey === "ECONOMIC");
  if (!compact || !overview || !breakdown || !patterns || !method) throw new TypeError("P6_M1_SURFACE_MISSING");

  const compactKpis = records(at(compact.payload, "kpis"));
  const compactMinimal = compactKpis.find((item) => item.kpiId === "kpi:economic:minimal-state");
  if (!compactMinimal || !close(at(compactMinimal, "typedMeasure", "value"), 1634.0783333333334)) throw new TypeError("P6_COMPACT_MINIMAL_INVALID");
  const overviewMetrics = records(at(overview.payload, "metrics"));
  const overviewMargin = overviewMetrics.find((item) => item.metricId === "typical-minimal-gap");
  if (!overviewMargin || !close(at(overviewMargin, "typedMeasure", "value"), 1490.1566666666668)) throw new TypeError("P6_OVERVIEW_MARGIN_INVALID");

  const breakdownRows = records(at(breakdown.payload, "rows"));
  const breakdownLabels = breakdownRows.map((item) => String(item.labelKey));
  if (EXPECTED_BREAKDOWN_LABELS.some((label) => !breakdownLabels.includes(label)) || breakdownLabels.some((label) => label.includes("Non classé"))) throw new TypeError("P6_BREAKDOWN_LABELS_INVALID");
  if (breakdownRows.some((item) => !String(item.displayValue).includes(" %"))) throw new TypeError("P6_BREAKDOWN_SHARE_MISSING");

  const patternRows = records(at(patterns.payload, "rows"));
  const edf = patternRows.find((item) => String(item.labelKey).includes("EDF") && String(item.labelKey).includes("Électricité"));
  if (!edf || !String(edf.displayValue).includes("12 paiements observés") || !String(edf.displayValue).includes("août 2025 → juillet 2026") || !close(at(edf, "typedMeasure", "value"), 78.2)) throw new TypeError("P6_EDF_RECURRENCE_INVALID");
  if (patternRows.some((item) => /^Récurrence \d+$/u.test(String(item.labelKey)))) throw new TypeError("P6_RECURRENCE_LABEL_INVALID");

  const expectedMethodRef = globalV2MethodRef("ECONOMIC");
  if (record(method.params).methodRef !== expectedMethodRef || records(at(method.payload, "rows")).length === 0) throw new TypeError("P6_METHOD_INVALID");

  return {
    project: candidate.project,
    candidateId: candidate.candidateId,
    dataRevision: candidate.dataRevision,
    baseAnalyticsRevision: candidate.analyticsRevision,
    candidateAnalyticsRevision: Number(candidate.analyticsRevision) + 1,
    implementationSha: candidate.implementationIdentity,
    factsHash: candidate.factsHash,
    manifestHash: candidate.manifestHash,
    requiredArtifactCount: candidate.requiredArtifactCount,
    requiredSnapshotCount: candidate.requiredSnapshotCount,
    owner: economicOwner.owner,
    methodRef: expectedMethodRef,
    minimal: { value: at(minimal, "value"), status: at(minimal, "status") },
    typical: { value: at(typical, "value"), status: at(typical, "status") },
    margin: { value: at(margin, "value"), status: at(margin, "status") },
    breakdown: breakdownRows.map((item) => ({ label: item.labelKey, value: item.displayValue })),
    edf: { label: edf.labelKey, value: edf.displayValue, entityRef: edf.entityRef },
    methodRows: records(at(method.payload, "rows")).length,
  };
}

async function publish(
  client: ReturnType<typeof serverClient>,
  candidate: Awaited<ReturnType<typeof prepareGlobalV2LiveCandidate>>,
) {
  const asOfMonth = `${candidate.asOf.slice(0, 7)}-01`;
  const { data: existing, error: existingError } = await client
    .from("analytics_publications")
    .select("publication_id,status,published_analytics_revision")
    .eq("publication_id", candidate.candidateId)
    .maybeSingle();
  if (existingError) throw existingError;
  if (existing?.status === "published") return existing;
  if (existing === null) {
    const { error } = await client.from("analytics_publications").insert({
      publication_id: candidate.candidateId,
      household_id: candidate.householdScope,
      scope_kind: "global",
      as_of_month: asOfMonth,
      source_revision: Number(candidate.dataRevision),
      base_analytics_revision: Number(candidate.analyticsRevision),
      required_artifact_keys: candidate.requiredKeys.artifacts,
      required_query_keys: candidate.requiredKeys.queries,
      status: "draft",
    });
    if (error) throw error;
  }

  const artifact = candidate.artifacts[0]!;
  const { error: artifactError } = await client.from("analytics_artifacts").upsert({
    artifact_key: artifact.key,
    generation_key: candidate.candidateId,
    household_id: candidate.householdScope,
    subject_kind: "household",
    period_kind: "global",
    as_of_month: asOfMonth,
    artifact_family: artifact.version.family,
    metric_id: artifact.key,
    scope_hash: candidate.scopeHash,
    filter_signature: "8".repeat(64),
    method_version: artifact.version.methodSignature,
    contract_version: artifact.version.contractVersion,
    source_revision: Number(candidate.dataRevision),
    analytics_revision: Number(candidate.analyticsRevision),
    payload: artifact.payload,
    computed_at: candidate.asOf,
    publication_id: candidate.candidateId,
    is_active: false,
  }, { onConflict: "artifact_key,source_revision,method_version,contract_version,generation_key" });
  if (artifactError) throw artifactError;

  const contractByKey = new Map(candidate.versions.queries.map((item) => [item.key, item.contractVersion]));
  const snapshotRows = candidate.snapshots.map((snapshot) => ({
    query_key: snapshot.key,
    generation_key: candidate.candidateId,
    household_id: candidate.householdScope,
    resource: snapshot.resource,
    scope_hash: snapshot.scopeHash,
    normalized_param_signature: snapshot.resourceInputHash,
    subject_kind: "household",
    period_kind: "global",
    as_of_month: asOfMonth,
    source_revision: Number(candidate.dataRevision),
    analytics_revision: Number(candidate.analyticsRevision),
    contract_version: contractByKey.get(snapshot.key)!,
    method_signature: snapshot.methodSignature,
    payload: snapshot.payload,
    computed_at: candidate.asOf,
    publication_id: candidate.candidateId,
    is_active: false,
  }));
  const { error: snapshotsError } = await client.from("analytics_query_snapshots").upsert(snapshotRows, {
    onConflict: "query_key,source_revision,contract_version,method_signature,generation_key",
  });
  if (snapshotsError) throw snapshotsError;

  const { error: manifestError } = await client.rpc("attach_global_v2_manifest", {
    p_publication_id: candidate.candidateId,
    p_household_id: candidate.householdScope,
    p_manifest: candidate.manifest,
  });
  if (manifestError) throw manifestError;
  const { data: result, error: publishError } = await client.rpc("publish_global_v2_materialization", {
    p_publication_id: candidate.candidateId,
    p_expected_analytics_revision: Number(candidate.analyticsRevision),
  });
  if (publishError) throw publishError;
  return Array.isArray(result) ? result[0] : result;
}

function failure(error: unknown): Response {
  const message = error instanceof Error ? error.message : "P6_UNKNOWN_ERROR";
  const cause = error instanceof Error && "cause" in error ? record(error.cause) : undefined;
  return Response.json({
    error: message,
    ...(cause === undefined ? {} : {
      cause: {
        code: cause.code,
        message: cause.message,
        details: cause.details,
        hint: cause.hint,
      },
    }),
  }, { status: 500 });
}

export async function GET(request: Request) {
  const rejected = authorize(request);
  if (rejected) return rejected;
  try {
    const { candidate } = await buildCandidate();
    return Response.json({ mode: "DRY_RUN", proof: proof(candidate) });
  } catch (error) {
    return failure(error);
  }
}

export async function POST(request: Request) {
  const rejected = authorize(request);
  if (rejected) return rejected;
  try {
    const body = record(await request.json());
    const { client, candidate } = await buildCandidate();
    const checked = proof(candidate);
    if (body.candidateId !== candidate.candidateId || body.confirm !== "PUBLISH_GLOBAL_V2_ONLY") {
      return Response.json({ error: "candidate_confirmation_mismatch", candidateId: candidate.candidateId }, { status: 409 });
    }
    const result = await publish(client, candidate);
    return Response.json({ mode: "PUBLISHED", proof: checked, result });
  } catch (error) {
    return failure(error);
  }
}
