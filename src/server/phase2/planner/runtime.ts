import "server-only";
import { parseInstant } from "@/core/time";
import { getAuthenticatedBootstrapClient } from "@/server/bootstrap/auth";
import { getBootstrapContext } from "@/server/bootstrap/context";
import { createAuthorizedRuntimeContext } from "@/server/canonical/context";
import { createCanonicalReadClient } from "@/server/canonical/client";
import { CanonicalRepository } from "@/server/canonical/repository";
import { createPlannerDependencies } from "@/server/phase2/planner/world-reader";

/** Never accepts a household, user, client or authority from the browser. */
export async function authorizedPlanner() {
  const { supabase, user } = await getAuthenticatedBootstrapClient();
  const bootstrap = await getBootstrapContext();
  if (bootstrap.user.id !== user.id) throw new TypeError("PLANNER_SESSION_CHANGED");
  const now = new Date().toISOString();
  const context = createAuthorizedRuntimeContext(bootstrap, parseInstant(now));
  return { householdId: String(context.householdId),
    deps: createPlannerDependencies(new CanonicalRepository(createCanonicalReadClient(), context), supabase, () => now) };
}
