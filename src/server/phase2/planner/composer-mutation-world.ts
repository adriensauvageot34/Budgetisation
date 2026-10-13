import "server-only";
import type { PlannerDependencies } from "./apply";

/** One admitted source read during a single preview mutation. Do not memoize
 * prepareWorld: quotes/journeys depend on each before/after semantic state.
 * This object never leaves this request and must not be used by Apply/recovery.
 * Live reference checks and active Plan reads remain on their original owners. */
export function composerMutationDependencies(deps: PlannerDependencies, household: string, month: string): PlannerDependencies {
  let sources: ReturnType<PlannerDependencies["readWorld"]> | undefined;
  return { ...deps, readWorld: (requestedHousehold, requestedMonth) => {
    if (requestedHousehold !== household || requestedMonth !== month) throw new TypeError("COMPOSER_MUTATION_WORLD_SCOPE_MISMATCH");
    return sources ??= deps.readWorld(household, month);
  } };
}
