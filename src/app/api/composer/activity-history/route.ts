import { authorizedPlanner } from "@/server/phase2/planner/runtime";
import { createActivityHistoryStore } from "@/server/phase2/planner/activity-history-store";
import { prepareRegisteredActivityHistory } from "@/server/phase2/planner/activity-history-maintenance";
import { activityHistoryPeriod } from "@/server/phase2/planner/activity-history-period";
import { activityHistoryScope, admittedActivityHistory } from "@/server/phase2/planner/activity-history-artifact";
import { plannerDigest, plannerMonth, plannerRecord } from "@/domain/phase2/planner/json";
import { BootstrapAuthenticationRequiredError } from "@/server/bootstrap/errors";
import { createHash } from "node:crypto";
import { snapshotBenchmarkReadOnly } from "@/server/phase2/planner/snapshot-observation";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function status(request: Request) {
  const month = plannerMonth(new URL(request.url).searchParams.get("month"));
  const { canonical, supabase } = await authorizedPlanner();
  const period = activityHistoryPeriod(canonical.context,month,canonical.context.asOf);
  const scope = activityHistoryScope(canonical,period.range,period.cutoffDate);
  const state = await createActivityHistoryStore(supabase).inspect(scope,plannerDigest(scope));
  const artifact = state.artifact ? plannerRecord(state.artifact) : null;
  const fresh = admittedActivityHistory(scope, state) !== null;
  let security: unknown;
  if (new URL(request.url).searchParams.get("checks") === "1" && snapshotBenchmarkReadOnly()) {
    const denied = async (altered: typeof scope) => {
      const result = await supabase.rpc("inspect_planner_activity_history_v1", {p_scope:altered,p_key:plannerDigest(altered)});
      return result.error?.code === "42501";
    };
    const [wrongAuthorDenied,wrongHouseholdDenied,wrongPeopleDenied,trusted] = await Promise.all([
      denied({...scope,userId:"00000000-0000-4000-8000-000000000001"}),
      denied({...scope,householdId:"00000000-0000-4000-8000-000000000001"}),
      denied({...scope,personIds:[]}),
      supabase.rpc("inspect_planner_activity_history_trusted_v1", {p_scope:scope,p_key:plannerDigest(scope)}),
    ]);
    const {data} = await supabase.auth.getSession(); // getUser already verified in authorizedPlanner.
    security = {wrongAuthorDenied,wrongHouseholdDenied,wrongPeopleDenied,trustedDenied:trusted.error?.code==="42501",
      sessionFingerprint:data.session ? createHash("sha256").update(data.session.access_token).digest("hex").slice(0,16):null};
  }
  return Response.json({status:fresh?"READY":"MISS",generation:state.generation,digest:artifact?.digest??null,security},{headers:{"Cache-Control":"private, no-store"}});
}
async function prepare(request: Request) {
  if (process.env.COMPOSER_P14_SNAP_PREPARE_ENABLED !== "1") return Response.json({code:"SNAP_PREPARATION_OFF"},{status:404});
  if (request.headers.get("origin") !== new URL(request.url).origin) return Response.json({code:"SNAP_ORIGIN_REFUSED"},{status:403});
  if (Number(request.headers.get("content-length") ?? 0) > 1024) return Response.json({code:"SNAP_REQUEST_TOO_LARGE"},{status:413});
  const body = await request.text();
  if (new TextEncoder().encode(body).byteLength > 1024) return Response.json({code:"SNAP_REQUEST_TOO_LARGE"},{status:413});
  const input = plannerRecord(JSON.parse(body)),month=plannerMonth(input.month);
  if (Object.keys(input).some(key => key !== "month")) return Response.json({code:"SNAP_REQUEST_INVALID"},{status:400});
  const {canonical,canonicalClient,supabase} = await authorizedPlanner();
  const result = await prepareRegisteredActivityHistory(canonical,month,createActivityHistoryStore(supabase,canonicalClient));
  return Response.json(result,{headers:{"Cache-Control":"private, no-store"}});
}
async function boundary(run: () => Promise<Response>) {
  try { return await run(); }
  catch (error) {
    if (error instanceof BootstrapAuthenticationRequiredError) return Response.json({code:"AUTHENTICATION_REQUIRED"},{status:401});
    // Never return SQL diagnostics, source rows, user IDs or upstream bodies.
    return Response.json({code:"SNAP_OPERATION_UNAVAILABLE"},{status:503});
  }
}
export const GET = (request: Request) => boundary(() => status(request));
export const POST = (request: Request) => boundary(() => prepare(request));
