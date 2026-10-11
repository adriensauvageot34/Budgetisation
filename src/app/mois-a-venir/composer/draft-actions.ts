"use server";
import type { ComposerDraftLifecycleCommand, ComposerDraftSaveCommand } from "@/domain/phase2/planner/composer-draft-contract";
import { authorizedPlanner } from "@/server/phase2/planner/runtime";
import { changeComposerDraftLifecycle, readComposerDrafts, saveComposerDraft } from "@/server/phase2/planner/composer-draft-service";

async function scope() {
  if (process.env.COMPOSER_DRAFT_AUTOSAVE_ENABLED !== "true") throw new TypeError("COMPOSER_DRAFT_DISABLED");
  const { supabase, userId, householdId } = await authorizedPlanner();
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
