"use client";
import { COMPOSER_DRAFT_HTTP_CONTRACT, type ComposerDraftLifecycleCommand, type ComposerDraftResult,
  type ComposerDraftSaveCommand, type ComposerDraftSnapshot, type StoredComposerDraft } from "@/domain/phase2/planner/composer-draft-contract";
import { plannerDigestString, plannerInteger, plannerMonth, plannerRecord, plannerUuid } from "@/domain/phase2/planner/json";
import { parsePlanSemanticState, semanticStateDigest } from "@/domain/phase2/planner/semantic-state";
import type { DraftTransport } from "./durable-draft";

const path = "/api/composer/drafts";
const contractHeader = "X-Composer-Draft-Contract";
const requestHeaders = { [contractHeader]: COMPOSER_DRAFT_HTTP_CONTRACT };
const incompatibleMessage = "Version du brouillon incompatible. Vos modifications restent dans cette page ; rechargez après avoir vérifié leur sauvegarde.";
const incompatible = (): ComposerDraftResult => ({ ok: false, code: "UNAVAILABLE", message: incompatibleMessage, latest: null });
const unavailable = (): ComposerDraftResult => ({ ok: false, code: "UNAVAILABLE",
  message: "Sauvegarde non confirmée. Votre travail reste dans cette page ; réessayez.", latest: null });
const contractError = () => new TypeError("DRAFT_CONTRACT_INCOMPATIBLE");

function draft(raw: unknown, month: string): StoredComposerDraft {
  const value = plannerRecord(raw);
  const state = parsePlanSemanticState(value.semanticState);
  const digest = plannerDigestString(value.digest);
  if (state.targetMonth !== month || digest !== semanticStateDigest(state)
    || (value.lifecycle !== "ACTIVE" && value.lifecycle !== "ABANDONED")
    || (value.lastMutationKind !== "SAVE" && value.lastMutationKind !== "ARCHIVE" && value.lastMutationKind !== "RESTORE")
    || typeof value.lastSavedAt !== "string" || !value.lastSavedAt
    || value.archivedAt !== null && typeof value.archivedAt !== "string") throw contractError();
  return { draftId: plannerUuid(value.draftId), version: plannerInteger(value.version, 1),
    lifecycle: value.lifecycle, semanticState: state, digest,
    baseRevisionId: value.baseRevisionId === null ? null : plannerUuid(value.baseRevisionId),
    baseRevisionNumber: plannerInteger(value.baseRevisionNumber), lastSavedAt: value.lastSavedAt,
    archivedAt: value.archivedAt, lastMutationRequestId: plannerUuid(value.lastMutationRequestId),
    lastMutationExpectedVersion: plannerInteger(value.lastMutationExpectedVersion), lastMutationKind: value.lastMutationKind };
}

function snapshot(raw: unknown, month: string): ComposerDraftSnapshot {
  const value = plannerRecord(raw);
  if (!Array.isArray(value.archives) || typeof value.baseStale !== "boolean") throw contractError();
  const active = value.active === null ? null : draft(value.active, month);
  const archives = value.archives.map(item => draft(item, month));
  if (active?.lifecycle === "ABANDONED" || archives.some(item => item.lifecycle !== "ABANDONED")) throw contractError();
  return { active, archives, activePlanRevisionId: value.activePlanRevisionId === null
    ? null : plannerUuid(value.activePlanRevisionId), activePlanRevisionNumber: plannerInteger(value.activePlanRevisionNumber),
    baseStale: value.baseStale };
}

function result(raw: unknown, kind: "SAVE" | "ARCHIVE" | "RESTORE",
  command: ComposerDraftSaveCommand | ComposerDraftLifecycleCommand): ComposerDraftResult {
  const value = plannerRecord(raw);
  if (value.ok === true) {
    const saved = draft(value.draft, plannerMonth(command.targetMonth));
    if (typeof value.replayed !== "boolean" || saved.lastMutationKind !== kind
      || saved.lastMutationRequestId !== command.requestId
      || saved.lastMutationExpectedVersion !== command.expectedDraftVersion
      || (kind === "SAVE" && (saved.lifecycle !== "ACTIVE" || saved.digest !== (command as ComposerDraftSaveCommand).digest))
      || (kind !== "SAVE" && (saved.draftId !== (command as ComposerDraftLifecycleCommand).draftId
        || saved.lifecycle !== (kind === "ARCHIVE" ? "ABANDONED" : "ACTIVE")))) throw contractError();
    return { ok: true, draft: saved, replayed: value.replayed };
  }
  const codes = ["CONFLICT", "BASE_STALE", "TOO_LARGE", "INVALID", "ACCESS_DENIED", "UNAVAILABLE"];
  if (value.ok !== false || !codes.includes(String(value.code)) || typeof value.message !== "string") throw contractError();
  return { ok: false, code: value.code as Exclude<ComposerDraftResult, { ok: true }>["code"],
    message: value.message, latest: value.latest === null ? null : snapshot(value.latest, plannerMonth(command.targetMonth)) };
}

async function mutation(kind: "SAVE" | "ARCHIVE" | "RESTORE", command: ComposerDraftSaveCommand | ComposerDraftLifecycleCommand): Promise<ComposerDraftResult> {
  const response = await fetch(path, { method: "POST", credentials: "same-origin", cache: "no-store",
    headers: { ...requestHeaders, "Content-Type": "application/json" }, body: JSON.stringify({ kind, command }) });
  if (response.headers.get(contractHeader) !== COMPOSER_DRAFT_HTTP_CONTRACT || response.status === 409) return incompatible();
  if (response.status === 413) return { ok: false, code: "TOO_LARGE",
    message: "Ce brouillon dépasse la limite de 1 Mio. Aucune version enregistrée n'a été écrasée.", latest: null };
  if (response.status === 401 || response.status === 403) return { ok: false, code: "ACCESS_DENIED",
    message: "Session ou accès au brouillon indisponible. Vos modifications locales sont conservées.", latest: null };
  if (!response.ok) return unavailable();
  try { return result(await response.json(), kind, command); }
  catch { return incompatible(); }
}

export const composerDraftHttpTransport: DraftTransport = {
  async read(month: string): Promise<ComposerDraftSnapshot> {
    const response = await fetch(`${path}?month=${encodeURIComponent(month)}`, {
      credentials: "same-origin", cache: "no-store", headers: requestHeaders });
    if (response.headers.get(contractHeader) !== COMPOSER_DRAFT_HTTP_CONTRACT || response.status === 409) throw contractError();
    if (!response.ok) throw new Error("DRAFT_READ_UNAVAILABLE");
    try { return snapshot(await response.json(), plannerMonth(month)); }
    catch { throw contractError(); }
  },
  save: command => mutation("SAVE", command),
  archive: command => mutation("ARCHIVE", command),
  restore: command => mutation("RESTORE", command),
};
