"use server";
import { revalidatePath } from "next/cache";
import type { ComposerRequest } from "@/domain/phase2/planner/composer-ui-contract";
import { authorizedPlanner } from "@/server/phase2/planner/runtime";
import { handleComposerRequest } from "@/server/phase2/planner/composer-service";
export async function composerInteraction(request: ComposerRequest) {
  const { deps, householdId } = await authorizedPlanner();
  const response = await handleComposerRequest(deps, householdId, request);
  if (response.ok && response.applied) revalidatePath("/mois-a-venir", "layout");
  return response;
}
