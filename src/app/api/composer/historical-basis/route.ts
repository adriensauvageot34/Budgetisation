import { authorizedPlanner } from "@/server/phase2/planner/runtime";
import { createHistoricalBasisStore, historicalBasisScope, admittedHistoricalBasis, prepareHistoricalBasis } from "@/server/phase2/planner/historical-basis";
import { historicalM7Scope, admittedHistoricalM7Basis, prepareHistoricalM7Basis } from "@/server/phase2/planner/historical-m7-basis";
import { activityHistoryPeriod } from "@/server/phase2/planner/activity-history-period";
import { plannerDigest, plannerMonth, plannerRecord } from "@/domain/phase2/planner/json";
import { BootstrapAuthenticationRequiredError } from "@/server/bootstrap/errors";
import { snapshotBenchmarkReadOnly } from "@/server/phase2/planner/snapshot-observation";
import { createHash } from "node:crypto";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
async function status(request: Request) {
  const url = new URL(request.url), month = plannerMonth(url.searchParams.get("month"));
  const owner = url.searchParams.get("owner") ?? "canonical";
  if (owner !== "canonical" && owner !== "m7") return Response.json({ code: "BASIS_OWNER_INVALID" }, { status: 400 });
  const { canonical, supabase } = await authorizedPlanner();
  const { range } = activityHistoryPeriod(canonical.context, month, canonical.context.asOf);
  const scope = owner === "m7" ? historicalM7Scope(canonical, range) : historicalBasisScope(canonical, range), at = performance.now();
  const current = await createHistoricalBasisStore(supabase).inspect(scope, plannerDigest(scope));
  const admissionMs = performance.now() - at, decodeAt = performance.now();
  const admitted = owner === "m7" ? admittedHistoricalM7Basis(scope, current) : admittedHistoricalBasis(scope, current);
  const decodeMs = performance.now() - decodeAt;
  const artifact = current.artifact ? plannerRecord(current.artifact) : null;
  let security: unknown;
  if (url.searchParams.get("checks") === "1" && snapshotBenchmarkReadOnly()) {
    const denied = async (altered: typeof scope) => (await supabase.rpc("inspect_composer_historical_basis_v1", {
      p_scope: altered, p_key: plannerDigest(altered) })).error?.code === "42501";
    const [wrongAuthorDenied, wrongHouseholdDenied, wrongPeopleDenied, publish] = await Promise.all([
      denied({ ...scope, userId: "00000000-0000-4000-8000-000000000001" }),
      denied({ ...scope, householdId: "00000000-0000-4000-8000-000000000001" }), denied({ ...scope, personIds: [] }),
      supabase.rpc("publish_composer_historical_basis_v1", { p_scope: scope, p_key: plannerDigest(scope), p_expected_generation: current.generation, p_artifact: {} }),
    ]);
    const { data } = await supabase.auth.getSession();
    security = { wrongAuthorDenied, wrongHouseholdDenied, wrongPeopleDenied, publishDenied: publish.error?.code === "42501",
      sessionFingerprint: data.session ? createHash("sha256").update(data.session.access_token).digest("hex").slice(0, 16) : null };
  }
  return Response.json({ status: admitted ? "READY" : "MISS", owner, generation: current.generation, digest: artifact?.digest ?? null,
    payloadDigest: artifact?.payloadDigest ?? null, payloadBytes: artifact?.payloadBytes ?? null,
    transferBytes: artifact ? Buffer.byteLength(JSON.stringify(artifact)) : 0,
    admissionMs, decodeMs, security }, { headers: { "Cache-Control": "private, no-store" } });
}
async function prepare(request: Request) {
  if (process.env.COMPOSER_P14_SNAP3_PREPARE_ENABLED !== "1") return Response.json({ code: "BASIS_PREPARATION_OFF" }, { status: 404 });
  if (request.headers.get("origin") !== new URL(request.url).origin) return Response.json({ code: "BASIS_ORIGIN_REFUSED" }, { status: 403 });
  if (Number(request.headers.get("content-length") ?? 0) > 1024) return Response.json({ code: "BASIS_REQUEST_TOO_LARGE" }, { status: 413 });
  const body = await request.text();
  if (Buffer.byteLength(body) > 1024) return Response.json({ code: "BASIS_REQUEST_TOO_LARGE" }, { status: 413 });
  const input = plannerRecord(JSON.parse(body)), month = plannerMonth(input.month), owner = input.owner ?? "canonical";
  if ((owner !== "canonical" && owner !== "m7") || Object.keys(input).some(key => key !== "month" && key !== "owner"))
    return Response.json({ code: "BASIS_REQUEST_INVALID" }, { status: 400 });
  const { canonical, canonicalClient, supabase } = await authorizedPlanner();
  const store = createHistoricalBasisStore(supabase, canonicalClient);
  const result = owner === "m7"
    ? await (async () => { const { range, through } = activityHistoryPeriod(canonical.context, month, canonical.context.asOf);
      return prepareHistoricalM7Basis(canonical, range, through.toString(), store); })()
    : await prepareHistoricalBasis(canonical, month, store);
  return Response.json(result, { headers: { "Cache-Control": "private, no-store" } });
}
async function boundary(run: () => Promise<Response>) {
  try { return await run(); }
  catch (error) {
    if (error instanceof BootstrapAuthenticationRequiredError) return Response.json({ code: "AUTHENTICATION_REQUIRED" }, { status: 401 });
    if (error instanceof Error && ["BASIS_SOURCE_INCOMPLETE", "BASIS_WRITERS_NOT_COVERED", "M7_BASIS_WRITERS_NOT_COVERED", "BASIS_PAYLOAD_TOO_LARGE"].includes(error.message))
      return Response.json({ code: error.message }, { status: 503 });
    return Response.json({ code: "BASIS_OPERATION_UNAVAILABLE" }, { status: 503 });
  }
}
export const GET = (request: Request) => boundary(() => status(request));
export const POST = (request: Request) => boundary(() => prepare(request));
