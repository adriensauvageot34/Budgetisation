"use client";
import type { ComposerDraftLifecycleCommand, ComposerDraftResult, ComposerDraftSaveCommand,
  ComposerDraftSnapshot } from "@/domain/phase2/planner/composer-draft-contract";
import type { DraftTransport } from "./durable-draft";

const path = "/api/composer/drafts";
const unavailable = (): ComposerDraftResult => ({ ok: false, code: "UNAVAILABLE",
  message: "Sauvegarde non confirmée. Votre travail reste dans cette page ; réessayez.", latest: null });

async function mutation(kind: "SAVE" | "ARCHIVE" | "RESTORE", command: ComposerDraftSaveCommand | ComposerDraftLifecycleCommand): Promise<ComposerDraftResult> {
  const response = await fetch(path, { method: "POST", credentials: "same-origin", cache: "no-store",
    headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind, command }) });
  if (response.status === 413) return { ok: false, code: "TOO_LARGE",
    message: "Ce brouillon dépasse la limite de 1 Mio. Aucune version enregistrée n'a été écrasée.", latest: null };
  if (!response.ok) return unavailable();
  return await response.json() as ComposerDraftResult;
}

export const composerDraftHttpTransport: DraftTransport = {
  async read(month: string): Promise<ComposerDraftSnapshot> {
    const response = await fetch(`${path}?month=${encodeURIComponent(month)}`, { credentials: "same-origin", cache: "no-store" });
    if (!response.ok) throw new Error("DRAFT_READ_UNAVAILABLE");
    return await response.json() as ComposerDraftSnapshot;
  },
  save: command => mutation("SAVE", command),
  archive: command => mutation("ARCHIVE", command),
  restore: command => mutation("RESTORE", command),
};
