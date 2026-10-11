"use server";
import type { ComposerDraftLifecycleCommand, ComposerDraftSaveCommand } from "@/domain/phase2/planner/composer-draft-contract";
import { authorizedPlanner } from "@/server/phase2/planner/runtime";
import { composerDraftAutosaveEnabledFor } from "@/server/phase2/planner/composer-draft-cutover";
import { changeComposerDraftLifecycle, readComposerDrafts, saveComposerDraft } from "@/server/phase2/planner/composer-draft-service";

async function scope() {
  const { supabase, userId, householdId } = await authorizedPlanner();
  if (!composerDraftAutosaveEnabledFor(userId)) throw new TypeError("COMPOSER_DRAFT_DISABLED");
  return { supabase, userId, householdId };
}

export async function composerDraftRead(month: string) {
  return readComposerDrafts(await scope(), month);
}
export async function composerDraftSave(command: ComposerDraftSaveCommand) {
  return saveComposerDraft(await scope(), command);
}
export async function composerDraftArchive(command: ComposerDraftLifecycleCommand) {
  return changeComposerDraftLifecycle(await scope(), "ARCHIVE", command);
}
export async function composerDraftRestore(command: ComposerDraftLifecycleCommand) {
  return changeComposerDraftLifecycle(await scope(), "RESTORE", command);
}
