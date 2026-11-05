"use client";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { semanticStateDigest, type PlanSemanticStateV1 } from "@/domain/phase2/planner/semantic-state";
import { plannerDigest } from "@/domain/phase2/planner/json";
import { beforeAdmissionMessage, BEFORE_ADMISSION_MAX_BYTES } from "@/domain/phase2/planner/before-draft-contract";
import type { BeforeDraftHistory } from "./before-draft-history";
import type { ComposerDraftLifecycleCommand, ComposerDraftResult, ComposerDraftSaveCommand,
  ComposerDraftSnapshot, StoredComposerDraft } from "@/domain/phase2/planner/composer-draft-contract";

export type DraftTransport = {
  read: (month: string) => Promise<ComposerDraftSnapshot>;
  save: (command: ComposerDraftSaveCommand) => Promise<ComposerDraftResult>;
  archive: (command: ComposerDraftLifecycleCommand) => Promise<ComposerDraftResult>;
  restore: (command: ComposerDraftLifecycleCommand) => Promise<ComposerDraftResult>;
};
export type SaveStatus = "CLEAN" | "DIRTY" | "SAVING" | "SAVED" | "ERROR" | "CONFLICT" | "OFFLINE";
const subscribeConnection = (notify: () => void) => {
  window.addEventListener("online", notify); window.addEventListener("offline", notify);
  return () => { window.removeEventListener("online", notify); window.removeEventListener("offline", notify); };
};
const connectionSnapshot = () => navigator.onLine;
const serverConnectionSnapshot = () => true;

/** Owns persistence only. Finance preview remains in ComposerPreviewScheduler. */
export function useDurableDraft(transport: DraftTransport | null, initial: ComposerDraftSnapshot | null,
  targetMonth: string, state: PlanSemanticStateV1, suspended: boolean, beforeHistory?: BeforeDraftHistory) {
  const stateDigest = useMemo(() => semanticStateDigest(state), [state]);
  const [snapshot, setSnapshot] = useState(initial);
  const [status, setStatus] = useState<SaveStatus>(initial?.baseStale ? "CONFLICT" : initial?.active ? "SAVED" : "CLEAN");
  const [message, setMessage] = useState(initial?.baseStale ? "Le Plan actif a changé depuis ce brouillon." : "");
  const online = useSyncExternalStore(subscribeConnection, connectionSnapshot, serverConnectionSnapshot);
  const currentState = useRef(state);
  const currentSnapshot = useRef(initial);
  const confirmed = useRef(initial?.active?.digest ?? stateDigest);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const firstDirtyAt = useRef<number | null>(null);
  const inFlight = useRef(false);
  const pendingRequest = useRef<{ digest: string; command: ComposerDraftSaveCommand } | null>(null);
  const blocked = useRef(!!initial?.baseStale);
  const suspension = useRef(suspended);
  suspension.current = suspended;

  const updateSnapshot = useCallback((next: ComposerDraftSnapshot) => {
    currentSnapshot.current = next; setSnapshot(next);
  }, []);
  const clearTimer = () => { if (timer.current) clearTimeout(timer.current); timer.current = null; };

  const flush = useCallback(async () => {
    if (!transport || inFlight.current || blocked.current || suspension.current) return;
    if (!navigator.onLine) { setStatus("OFFLINE"); setMessage("Hors ligne : modifications non enregistrées."); return; }
    const draft = currentState.current, digest = semanticStateDigest(draft);
    if (digest === confirmed.current) return;
    const base = currentSnapshot.current;
    if (!base || base.baseStale) { blocked.current = true; setStatus("CONFLICT"); setMessage("Le Plan actif a changé. Choisissez comment reprendre."); return; }
    const active = base.active;
    let command: ComposerDraftSaveCommand;
    try { const candidate: ComposerDraftSaveCommand = {
      targetMonth, semanticState: draft, digest, requestId: crypto.randomUUID(),
      expectedDraftId: active?.draftId ?? null, expectedDraftVersion: active?.version ?? 0,
      expectedBaseRevisionId: base.activePlanRevisionId,
      expectedBaseRevisionNumber: base.activePlanRevisionNumber,
      ...(beforeHistory ? { beforeAdmission: beforeHistory.envelope(draft) } : {}),
    };
      const pending = pendingRequest.current?.command;
      command = pending && plannerDigest({ ...pending, beforeAdmission: pending.beforeAdmission ?? null, requestId: null })
        === plannerDigest({ ...candidate, beforeAdmission: candidate.beforeAdmission ?? null, requestId: null }) ? pending : candidate;
      // Undefined optional fields are omitted on HTTP; never send an unbounded trace.
      if (new TextEncoder().encode(JSON.stringify(command)).byteLength > BEFORE_ADMISSION_MAX_BYTES) throw new TypeError("BEFORE_ADMISSION_SIZE");
    } catch (error) {
      blocked.current = true; clearTimer(); setStatus("ERROR");
      setMessage(beforeAdmissionMessage(error instanceof Error ? error.message : "BEFORE_ADMISSION_REFUSED")); return;
    }
    pendingRequest.current = { digest, command };
    inFlight.current = true; setStatus("SAVING"); setMessage("Enregistrement du brouillon…");
    try {
      const result = await transport.save(command);
      if (result.ok) {
        const live = currentSnapshot.current;
        if ((live?.active?.draftId ?? null) !== command.expectedDraftId || (live?.active?.version ?? 0) !== command.expectedDraftVersion
          || result.draft.digest !== command.digest || semanticStateDigest(result.draft.semanticState) !== command.digest) {
          blocked.current = true; setStatus("ERROR"); setMessage(beforeAdmissionMessage("ACK_SELECTED_FRAME_REQUIRES_RECONCILIATION")); return;
        }
        const next = { ...base, active: result.draft, baseStale: false };
        updateSnapshot(next);
        confirmed.current = result.draft.digest;
        pendingRequest.current = null;
        try { beforeHistory?.acknowledge(result.draft, command); }
        catch { blocked.current = true; setStatus("ERROR"); setMessage(beforeAdmissionMessage("ACK_SELECTED_FRAME_REQUIRES_RECONCILIATION")); return; }
        if (semanticStateDigest(currentState.current) === result.draft.digest) {
          firstDirtyAt.current = null; setStatus("SAVED"); setMessage("Brouillon sauvegardé.");
        } else { setStatus("DIRTY"); setMessage("Nouvelles modifications à enregistrer."); }
      } else {
        if (result.latest) updateSnapshot(result.latest);
        if (result.code === "ADMISSION_REFUSED") { blocked.current = true; setStatus("ERROR"); }
        else if (result.code === "CONFLICT" || result.code === "BASE_STALE" || result.code === "ACCESS_DENIED") {
          blocked.current = true; setStatus("CONFLICT");
        } else setStatus(navigator.onLine ? "ERROR" : "OFFLINE");
        setMessage(result.message);
      }
    } catch {
      setStatus(navigator.onLine ? "ERROR" : "OFFLINE");
      setMessage("Sauvegarde non confirmée. Votre travail reste dans cette page ; réessayez.");
    } finally {
      inFlight.current = false;
      if (!suspension.current && !blocked.current && semanticStateDigest(currentState.current) !== confirmed.current
        && semanticStateDigest(currentState.current) !== digest) {
        clearTimer(); timer.current = setTimeout(() => void flush(), 1000);
      }
    }
  }, [transport, suspended, targetMonth, updateSnapshot, beforeHistory]);

  useEffect(() => {
    currentState.current = state;
    if (!transport || suspended || blocked.current) return;
    if (stateDigest === confirmed.current) {
      clearTimer(); firstDirtyAt.current = null;
      if (!inFlight.current) setStatus(currentSnapshot.current?.active ? "SAVED" : "CLEAN");
      return;
    }
    if (firstDirtyAt.current === null) firstDirtyAt.current = Date.now();
    if (!inFlight.current) { setStatus(navigator.onLine ? "DIRTY" : "OFFLINE"); setMessage("Modifications non encore enregistrées."); }
    clearTimer();
    const wait = Math.min(1000, Math.max(0, firstDirtyAt.current + 5000 - Date.now()));
    timer.current = setTimeout(() => void flush(), wait);
    return clearTimer;
  }, [stateDigest, suspended, transport, flush]);

  useEffect(() => {
    const wentOnline = () => { if (!blocked.current && semanticStateDigest(currentState.current) !== confirmed.current) void flush(); };
    const wentOffline = () => { if (semanticStateDigest(currentState.current) !== confirmed.current) { setStatus("OFFLINE"); setMessage("Hors ligne : modifications non enregistrées."); } };
    window.addEventListener("online", wentOnline); window.addEventListener("offline", wentOffline);
    return () => { window.removeEventListener("online", wentOnline); window.removeEventListener("offline", wentOffline); clearTimer(); };
  }, [flush]);

  const retry = () => { blocked.current = false; void flush(); };
  const refresh = async () => {
    if (!transport || suspension.current) return;
    try {
      const latest = await transport.read(targetMonth);
      updateSnapshot(latest);
      if (latest.baseStale || latest.active?.digest !== confirmed.current) {
        blocked.current = true; setStatus("CONFLICT"); setMessage("Une autre version existe. Vos modifications locales sont préservées.");
      } else retry();
    } catch (error) { setStatus("ERROR"); setMessage(error instanceof Error && error.message === "DRAFT_CONTRACT_INCOMPATIBLE"
      ? "Version du brouillon incompatible. Vos modifications locales restent dans cette page."
      : "Impossible de relire le brouillon."); }
  };
  const lifecycle = async (kind: "ARCHIVE" | "RESTORE", draft: StoredComposerDraft, discardLocal = false): Promise<boolean> => {
    if (!transport || suspension.current || !navigator.onLine || inFlight.current || !discardLocal && (status === "DIRTY" || status === "ERROR" || status === "OFFLINE")) return false;
    clearTimer(); blocked.current = true; inFlight.current = true;
    const command = { targetMonth, draftId: draft.draftId, expectedDraftVersion: draft.version, requestId: crypto.randomUUID() };
    try {
      const result = await (kind === "ARCHIVE" ? transport.archive(command) : transport.restore(command));
      if (!result.ok) { if (result.latest) updateSnapshot(result.latest);
        setStatus(["CONFLICT", "BASE_STALE", "ACCESS_DENIED"].includes(result.code) ? "CONFLICT" : "ERROR");
        setMessage(result.message); return false; }
      // Relire after mutation, including a recovered lost response; never issue it twice blindly.
      const latest = await transport.read(targetMonth);
      updateSnapshot(latest); confirmed.current = latest.active?.digest ?? semanticStateDigest(currentState.current);
      setStatus(latest.active ? "SAVED" : "CLEAN"); setMessage(kind === "ARCHIVE" ? "Essais archivés, récupérables ici." : "Brouillon restauré.");
      blocked.current = latest.baseStale;
      pendingRequest.current = null; firstDirtyAt.current = null;
      return true;
    } catch {
      // The commit may have succeeded. Read the version before considering any retry.
      try {
        const latest = await transport.read(targetMonth);
        updateSnapshot(latest);
        const row = [latest.active, ...latest.archives].find(item => item?.draftId === draft.draftId);
        if (row?.lastMutationRequestId === command.requestId && row.lastMutationKind === kind
          && row.lastMutationExpectedVersion === draft.version) {
          confirmed.current = latest.active?.digest ?? semanticStateDigest(currentState.current);
          blocked.current = latest.baseStale; setStatus(latest.active ? "SAVED" : "CLEAN");
          setMessage("Opération confirmée après relecture."); return true;
        }
      } catch { /* Keep local work and the old CAS version. */ }
      setStatus("ERROR"); setMessage("Réponse incertaine. Relisez le brouillon avant de réessayer."); return false;
    } finally { inFlight.current = false; }
  };
  const suspendNow = () => { if (inFlight.current) return false; suspension.current = true; clearTimer(); return true; };
  return { snapshot, status, message, online, retry, refresh, lifecycle, suspendNow,
    unsaved: !!transport && stateDigest !== confirmed.current, enabled: !!transport };
}
