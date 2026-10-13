import "server-only";
import type { ComposerDraftSnapshot } from "@/domain/phase2/planner/composer-draft-contract";
import type { PlannerDependencies } from "./apply";
import { readMonthComposer } from "./read-model";
import { composerUiModel } from "./composer-service";

/** The authenticated page already owns this scope. World has no Draft dependency;
 * start it while the saved Draft is read, then evaluate that exact saved state.
 * The Promise is confined to this opening and cannot be reused by another month,
 * request or Apply. Preserve Draft-first error precedence and observe early I/O
 * rejection without turning it into a successful or partial financial result. */
export async function readComposerOpening(deps: PlannerDependencies, householdId: string, month: string,
  readDrafts: () => Promise<ComposerDraftSnapshot | null>) {
  const world = Promise.resolve().then(() => deps.readWorld(householdId, month));
  void world.catch(() => undefined);
  const drafts = await readDrafts();
  const openingDeps: PlannerDependencies = { ...deps, readWorld: (household, targetMonth) => {
    if (household !== householdId || targetMonth !== month) throw new TypeError("COMPOSER_OPENING_SCOPE_MISMATCH");
    return world;
  } };
  return { model: await composerUiModel(openingDeps, householdId,
    await readMonthComposer(openingDeps, householdId, month, drafts?.active?.semanticState)), drafts };
}
