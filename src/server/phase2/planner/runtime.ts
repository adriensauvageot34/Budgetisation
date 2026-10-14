import "server-only";
import { parseInstant } from "@/core/time";
import { getAuthenticatedBootstrapClient } from "@/server/bootstrap/auth";
import { getBootstrapContext } from "@/server/bootstrap/context";
import { createAuthorizedRuntimeContext } from "@/server/canonical/context";
import { createCanonicalReadClient } from "@/server/canonical/client";
import { CanonicalRepository } from "@/server/canonical/repository";
import { createPlannerDependencies } from "@/server/phase2/planner/world-reader";
import { createActivityHistoryStore } from "./activity-history-store";
import { snapshotHistoryTrace } from "./snapshot-observation";

/** Never accepts a household, user, client or authority from the browser. */
export async function authorizedPlanner() {
  const { supabase, user } = await getAuthenticatedBootstrapClient();
  const bootstrap = await getBootstrapContext();
  if (bootstrap.user.id !== user.id) throw new TypeError("PLANNER_SESSION_CHANGED");
  const now = new Date().toISOString();
  const context = createAuthorizedRuntimeContext(bootstrap, parseInstant(now));
  const canonicalClient = createCanonicalReadClient();
  const canonical = new CanonicalRepository(canonicalClient, context,
      { shareEconomicReads: process.env.COMPOSER_P14_P1_READ_REUSE !== "0",
        // Keep P3 opt-in until the real opening latency is validated. The
        // Preview experiment reduced reads but showed slower, variable World.
        ...(!["1", "2"].includes(process.env.COMPOSER_P14_P3_HISTORICAL_REUSE ?? "") ? {} : {
          historicalReads: process.env.COMPOSER_P14_P3_HISTORICAL_REUSE === "1" ? "keys" as const : "projected" as const,
        }) });
  // OFF never constructs a store or executes a snapshot RPC. The publisher is
  // supplied only by the explicit preparation path, never by ordinary READ.
  const history = process.env.COMPOSER_P14_SNAP1_ACTIVITY_HISTORY === "1"
    ? createActivityHistoryStore(supabase) : undefined;
  if (history) history.trace = snapshotHistoryTrace;
  return { householdId: String(context.householdId), userId: user.id, supabase, canonical, canonicalClient,
    deps: createPlannerDependencies(canonical, supabase, () => now, history) };
}
