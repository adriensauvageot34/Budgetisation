"use server";
import { revalidatePath } from "next/cache";
import type { ComposerRequest } from "@/domain/phase2/planner/composer-ui-contract";
import { authorizedPlanner } from "@/server/phase2/planner/runtime";
import { handleComposerRequest } from "@/server/phase2/planner/composer-service";
import { observeSnapshot, snapshotBenchmarkReadOnly } from "@/server/phase2/planner/snapshot-observation";
export async function composerInteraction(request: ComposerRequest) {
  if (snapshotBenchmarkReadOnly() && (request.kind === "APPLY" || request.kind === "CHECK_APPLY")) throw new TypeError("SNAP_BENCHMARK_APPLY_REFUSED");
  const observed = await observeSnapshot(async () => {
  const { deps, householdId } = await authorizedPlanner();
  const response = await handleComposerRequest(deps, householdId, request);
  if (response.applied) revalidatePath("/mois-a-venir", "layout");
  return response;
  });
  return observed.metrics ? { ...observed.value, snapMetrics: observed.metrics } : observed.value;
}
