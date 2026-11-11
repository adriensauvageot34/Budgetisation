"use client";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { semanticStateDigest, type PlanSemanticStateV1 } from "@/domain/phase2/planner/semantic-state";
import type { ComposerDraftLifecycleCommand, ComposerDraftResult, ComposerDraftSaveCommand,
  ComposerDraftSnapshot, StoredComposerDraft } from "@/domain/phase2/planner/composer-draft-contract";
import type { RootRelationPlanState } from "@/domain/phase2/planner/root-relation-contract";
import type { CompatibleStoredRootRelationDraft, RootRelationDraftSavePacket } from "@/domain/phase2/planner/root-relation-draft-contract";
import type { RootRelationDurableSnapshot, RootRelationDurableTransport } from "@/domain/phase2/planner/root-relation-durable-contract";
import { rootRelationStateDigest } from "@/domain/phase2/planner/root-relation-state";
import { canonicalPlannerJson } from "@/domain/phase2/planner/json";
import { validateRootRelationDraftReload, validateRootRelationDraftSaveReceipt } from "@/domain/phase2/planner/root-relation-draft-boundary";

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
      if (!suspension.current && !blocked.current && semanticStateDigest(currentState.current) !== confirmed.current
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

const durableIdentity = (record: CompatibleStoredRootRelationDraft) => {
  const { lastSavedAt: _saved, archivedAt: _archived, ...identity } = record;
  return canonicalPlannerJson(identity);
};

/** N1 owns the COMPLETE document while its session is active. It has one explicit Save,
 * never a second timer competing with the suspended V1 autosave. A receipt advances CAS,
 * not the local decision/history; a late receipt therefore cannot overwrite newer work. */
export function useRootRelationDurableDraft(transport: RootRelationDurableTransport | null,
  initial: RootRelationDurableSnapshot | null, document: RootRelationPlanState, active: boolean) {
  const [snapshot, setSnapshot] = useState(initial), known = useRef(initial?.active ?? null);
  const [saving, setSaving] = useState(false), inFlight = useRef(false);
  const [failure, setFailure] = useState<string | null>(null);
  const current = useRef(document); current.current = document;
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => { if (!active && !inFlight.current) { known.current = initial?.active ?? null; setSnapshot(initial); } }, [initial, active]);
  const pending = useRef<{ packet: RootRelationDraftSavePacket; source: CompatibleStoredRootRelationDraft } | null>(null);
  const digest = rootRelationStateDigest(document);
  const unsaved = active && digest !== known.current?.digest;
  const acceptRecord = (record: CompatibleStoredRootRelationDraft) => {
    known.current = record;
    setSnapshot(previous => previous ? { ...previous, active: record, baseStale: false } : previous);
  };
  const save = async () => {
    if (!transport || !active || inFlight.current || !navigator.onLine) return false;
    inFlight.current = true; setSaving(true); setFailure(null);
    try {
      // After an uncertain response, a DIFFERENT local proposal first reconciles the
      // exact prior command. Never replace it blindly with a new requestId/version.
      if (pending.current && pending.current.packet.command.digest !== rootRelationStateDigest(current.current)) {
        const previous = pending.current, latest = await transport.read(document.targetMonth);
        if (!mounted.current) return false;
        if (!latest.active || latest.baseStale) throw new TypeError("N1_DRAFT_CONFLICT");
        if (latest.active.lastMutationRequestId === previous.packet.command.requestId) {
          validateRootRelationDraftSaveReceipt(previous.packet, { contract: previous.packet.contract, kind: "SAVE_RECEIPT",
            draft: latest.active, replayed: true }, previous.source, previous.packet.command.semanticState);
          acceptRecord(latest.active);
        } else if (durableIdentity(latest.active) !== durableIdentity(previous.source)) throw new TypeError("N1_DRAFT_CONFLICT");
        pending.current = null;
      }
      const source = known.current;
      if (!source || snapshot?.baseStale) throw new TypeError("N1_DRAFT_BINDING_INVALID");
      if (!pending.current) {
        const semanticState = current.current;
        pending.current = { source, packet: { contract: "composer-draft-http@2-root-relations", kind: "SAVE", command: {
          targetMonth: semanticState.targetMonth, expectedDraftId: source.draftId, expectedDraftVersion: source.version,
          expectedDocumentVersion: source.semanticState.version, expectedDraftDigest: source.digest,
          expectedBaseRevisionId: source.baseRevisionId, expectedBaseRevisionNumber: source.baseRevisionNumber,
          requestId: crypto.randomUUID(), semanticState, digest: rootRelationStateDigest(semanticState),
        } } };
      }
      const request = pending.current, receipt = await transport.save(request.packet);
      if (!mounted.current) return false;
      // Validate the committed command first, then leave any newer local document DIRTY.
      validateRootRelationDraftSaveReceipt(request.packet, receipt, known.current, request.packet.command.semanticState);
      acceptRecord(receipt.draft); pending.current = null;
      return rootRelationStateDigest(current.current) === receipt.draft.digest;
    } catch (error) {
      if (mounted.current) setFailure(error instanceof Error && /^(N1_|AUTHENTICATION_)[A-Z0-9_]+$/u.test(error.message)
        ? error.message : "N1_DURABLE_UNAVAILABLE");
      return false;
    } finally {
      inFlight.current = false; if (mounted.current) setSaving(false);
    }
  };
  const readForReload = async () => {
    if (!transport || !active || inFlight.current || !known.current || rootRelationStateDigest(current.current) !== known.current.digest)
      return null;
    inFlight.current = true; setSaving(true); setFailure(null);
    const start = rootRelationStateDigest(current.current), source = known.current;
    try {
      const latest = await transport.read(document.targetMonth);
      if (!mounted.current) return null;
      if (!latest.active || latest.baseStale || rootRelationStateDigest(current.current) !== start) throw new TypeError("N1_DRAFT_DIRTY_RELOAD");
      validateRootRelationDraftReload(current.current, source, latest.active);
      if (source.version === latest.active.version && durableIdentity(source) !== durableIdentity(latest.active))
        throw new TypeError("N1_DRAFT_CONFLICT");
      return latest;
    } catch (error) {
      if (mounted.current) setFailure(error instanceof Error ? error.message : "N1_DURABLE_UNAVAILABLE");
      return null;
    } finally { inFlight.current = false; if (mounted.current) setSaving(false); }
  };
  const status = saving ? "SAVING" : failure ? /CONFLICT|STALE|REUSED/.test(failure) ? "CONFLICT" : "ERROR"
    : unsaved ? "DIRTY" : known.current?.semanticState.version === "month-plan-state@v2-root-relations" ? "SAVED" : "MEMORY";
  return { snapshot, save, readForReload, status, failure, unsaved, saving, isInFlight: () => inFlight.current, enabled: !!transport };
}
