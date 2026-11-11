import { authorizedPlanner } from "@/server/phase2/planner/runtime";
import { composerDraftAutosaveEnabledFor } from "@/server/phase2/planner/composer-draft-cutover";
import { readRootRelationDurableDrafts } from "@/server/phase2/planner/root-relation-durable-service";
import { rootRelationFinancialReadSnapshot } from "@/domain/phase2/planner/root-relation-durable-contract";
import { rootRelationPost } from "@/server/phase2/planner/root-relation-http";
export const dynamic = "force-dynamic";
export const POST = (request: Request) => rootRelationPost(request, async () => {
  const scope = await authorizedPlanner();
  const admission = { userId: scope.userId, householdId: scope.householdId, deps: scope.deps,
    editorEnabled: composerDraftAutosaveEnabledFor(scope.userId) };
  return { ...admission, readDrafts: async (month: string) => rootRelationFinancialReadSnapshot(
    await readRootRelationDurableDrafts({ ...scope, admission }, month)) };
});
