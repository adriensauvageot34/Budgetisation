import { authorizedPlanner } from "@/server/phase2/planner/runtime";
import { composerDraftAutosaveEnabledFor } from "@/server/phase2/planner/composer-draft-cutover";
import { readComposerDrafts } from "@/server/phase2/planner/composer-draft-service";
import { rootRelationPost } from "@/server/phase2/planner/root-relation-http";
export const dynamic = "force-dynamic";
export const POST = (request: Request) => rootRelationPost(request, async () => {
  const scope = await authorizedPlanner();
  return { userId: scope.userId, householdId: scope.householdId, deps: scope.deps,
    editorEnabled: composerDraftAutosaveEnabledFor(scope.userId),
    readDrafts: (month: string) => readComposerDrafts(scope, month) };
});
