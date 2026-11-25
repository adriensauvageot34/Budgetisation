import "server-only";
import { parseInstant } from "@/core/time";
import { getAuthenticatedBootstrapClient } from "@/server/bootstrap/auth";
import { getBootstrapContextForSession } from "@/server/bootstrap/context";
import { createAuthorizedRuntimeContext } from "@/server/canonical/context";
import { createCanonicalReadClient } from "@/server/canonical/client";
import { CanonicalRepository } from "@/server/canonical/repository";
import { createPlannerDependencies } from "@/server/phase2/planner/world-reader";
import { createActivityHistoryStore } from "./activity-history-store";
import { snapshotHistoryTrace, snapshotWork } from "./snapshot-observation";
import { createHistoricalBasisStore } from "./historical-basis";
import { JULY_COMPOSER_MONTH } from "@/domain/phase2/planner/realized-month-entry";
import { reconstructionWorld } from "./reconstruction-world";
import { readJulyCarLegs } from "./july-car-trips";
import { createMonthSourceCache } from "../month-source-cache";

/** Never accepts a household, user, client or authority from the browser. */
export async function authorizedPlanner(options: { readCacheMonth?: string } = {}) {
  const session = await snapshotWork("Authentication", getAuthenticatedBootstrapClient);
  const { supabase, user } = session;
  const bootstrap = await snapshotWork("Bootstrap_CanonicalContext", () => getBootstrapContextForSession(session));
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
  const opening = options.readCacheMonth ? { month: options.readCacheMonth,
    cache: createMonthSourceCache(supabase, bootstrap, options.readCacheMonth) } : undefined;
  const deps = createPlannerDependencies(canonical, supabase, () => now, history,
    process.env.COMPOSER_P14_SNAP3_HISTORICAL_BASIS === "1" ? createHistoricalBasisStore(supabase) : undefined, opening);
  const householdId = String(context.householdId), readComposerWorld = deps.readComposerWorld ?? deps.readWorld;
  const prepareWorld: NonNullable<typeof deps.prepareWorld> = async (world, state, historical) => {
    const useJulyLegs = world.reconstruction && state.contexts.some(context => {
      const items = context.slotSelections.transport?.items;
      return Array.isArray(items) && items.some(item => item?.kind === "MOBILITY_INTENT" && item?.route);
    });
    return deps.prepareWorld!(useJulyLegs ? { ...world, reconstructionLegs: await readJulyCarLegs(canonical) } : world, state, historical);
  };
  return { householdId, userId: user.id, supabase, canonical, canonicalClient,
    deps: { ...deps, readComposerWorld: (owner: string, month: string) => owner === householdId && month === JULY_COMPOSER_MONTH
      ? Promise.resolve(reconstructionWorld(owner, month)) : readComposerWorld(owner, month), prepareWorld } };
}
