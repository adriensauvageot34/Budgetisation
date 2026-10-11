"use client";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { semanticStateDigest, type PlanSemanticStateV1 } from "@/domain/phase2/planner/semantic-state";
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
  targetMonth: string, state: PlanSemanticStateV1, suspended: boolean) {
  const [snapshot, setSnapshot] = useState(initial);
  const [status, setStatus] = useState<SaveStatus>(initial?.baseStale ? "CONFLICT" : initial?.active ? "SAVED" : "CLEAN");
  const [message, setMessage] = useState(initial?.baseStale ? "Le Plan actif a changé depuis ce brouillon." : "");
  const online = useSyncExternalStore(subscribeConnection, connectionSnapshot, serverConnectionSnapshot);
  const currentState = useRef(state);
  const currentSnapshot = useRef(initial);
  const confirmed = useRef(initial?.active?.digest ?? semanticStateDigest(state));
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const firstDirtyAt = useRef<number | null>(null);
  const inFlight = useRef(false);
  const pendingRequest = useRef<{ digest: string; command: ComposerDraftSaveCommand } | null>(null);
  const blocked = useRef(!!initial?.baseStale);
  const stateDigest = semanticStateDigest(state);

  const updateSnapshot = useCallback((next: ComposerDraftSnapshot) => {
    currentSnapshot.current = next; setSnapshot(next);
  }, []);
  const clearTimer = () => { if (timer.current) clearTimeout(timer.current); timer.current = null; };

  const flush = useCallback(async () => {
    if (!transport || inFlight.current || blocked.current || suspended) return;
    if (!navigator.onLine) { setStatus("OFFLINE"); setMessage("Hors ligne : modifications non enregistrées."); return; }
    const draft = currentState.current, digest = semanticStateDigest(draft);
    if (digest === confirmed.current) return;
    const base = currentSnapshot.current;
    if (!base || base.baseStale) { blocked.current = true; setStatus("CONFLICT"); setMessage("Le Plan actif a changé. Choisissez comment reprendre."); return; }
    const active = base.active;
    const reuse = pendingRequest.current?.digest === digest ? pendingRequest.current.command : null;
    const command: ComposerDraftSaveCommand = reuse ?? {
      targetMonth, semanticState: draft, digest, requestId: crypto.randomUUID(),
      expectedDraftId: active?.draftId ?? null, expectedDraftVersion: active?.version ?? 0,
      expectedBaseRevisionId: base.activePlanRevisionId,
      expectedBaseRevisionNumber: base.activePlanRevisionNumber,
    };
    pendingRequest.current = { digest, command };
    inFlight.current = true; setStatus("SAVING"); setMessage("Enregistrement du brouillon…");
    try {
      const result = await transport.save(command);
      if (result.ok) {
        const next = { ...base, active: result.draft, baseStale: false };
        updateSnapshot(next);
        confirmed.current = result.draft.digest;
        pendingRequest.current = null;
        if (semanticStateDigest(currentState.current) === result.draft.digest) {
          firstDirtyAt.current = null; setStatus("SAVED"); setMessage("Brouillon sauvegardé.");
        } else { setStatus("DIRTY"); setMessage("Nouvelles modifications à enregistrer."); }
      } else {
        if (result.latest) updateSnapshot(result.latest);
        if (result.code === "CONFLICT" || result.code === "BASE_STALE" || result.code === "ACCESS_DENIED") {
          blocked.current = true; setStatus("CONFLICT");
        } else setStatus(navigator.onLine ? "ERROR" : "OFFLINE");
        setMessage(result.message);
      }
    } catch {
      setStatus(navigator.onLine ? "ERROR" : "OFFLINE");
      setMessage("Sauvegarde non confirmée. Votre travail reste dans cette page ; réessayez.");
    } finally {
      inFlight.current = false;
      if (!blocked.current && semanticStateDigest(currentState.current) !== confirmed.current
        && semanticStateDigest(currentState.current) !== digest) {
        clearTimer(); timer.current = setTimeout(() => void flush(), 1000);
      }
    }
  }, [transport, suspended, targetMonth, updateSnapshot]);

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
    if (!transport) return;
    try {
      const latest = await transport.read(targetMonth);
      updateSnapshot(latest);
      if (latest.baseStale || latest.active?.digest !== confirmed.current) {
        blocked.current = true; setStatus("CONFLICT"); setMessage("Une autre version existe. Vos modifications locales sont préservées.");
      } else retry();
    } catch { setStatus("ERROR"); setMessage("Impossible de relire le brouillon."); }
  };
  const lifecycle = async (kind: "ARCHIVE" | "RESTORE", draft: StoredComposerDraft, discardLocal = false): Promise<boolean> => {
    if (!transport || !navigator.onLine || inFlight.current || !discardLocal && (status === "DIRTY" || status === "ERROR" || status === "OFFLINE")) return false;
    clearTimer(); blocked.current = true; inFlight.current = true;
    const command = { targetMonth, draftId: draft.draftId, expectedDraftVersion: draft.version, requestId: crypto.randomUUID() };
    try {
      const result = await (kind === "ARCHIVE" ? transport.archive(command) : transport.restore(command));
      if (!result.ok) { if (result.latest) updateSnapshot(result.latest); setStatus("CONFLICT"); setMessage(result.message); return false; }
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
  return { snapshot, status, message, online, retry, refresh, lifecycle,
    unsaved: !!transport && stateDigest !== confirmed.current, enabled: !!transport };
}
