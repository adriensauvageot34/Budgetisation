import "server-only";
import { authorizedPlanner } from "./runtime";
import { composerDraftAutosaveEnabledFor } from "./composer-draft-cutover";
import { runtimeRootRelationWriter } from "./root-relation-durable-writer";
import type { RootRelationDurableScope } from "./root-relation-durable-service";
/** A fresh instance is essential: no pre-transaction canonical read cache is reused. */
export async function rootRelationDurableRuntime(): Promise<RootRelationDurableScope> {
  const scope = await authorizedPlanner();
  return { ...scope, admission: { ...scope, editorEnabled: composerDraftAutosaveEnabledFor(scope.userId) },
    writer: runtimeRootRelationWriter(), refresh: rootRelationDurableRuntime };
}
