import { authorizedPlanner } from "@/server/phase2/planner/runtime";
import { composerDraftAutosaveEnabledFor } from "@/server/phase2/planner/composer-draft-cutover";
import { rootRelationDurableHttp } from "@/server/phase2/planner/root-relation-durable-http";
export const dynamic = "force-dynamic";
const handle = (request: Request) => rootRelationDurableHttp(request, async () => {
  const scope = await authorizedPlanner();
  return { ...scope, admission: { ...scope, editorEnabled: composerDraftAutosaveEnabledFor(scope.userId) } };
});
export const GET = handle;
export const POST = handle;
