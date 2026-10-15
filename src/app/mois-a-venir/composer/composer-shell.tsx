"use client";
import { useState, useRef, useEffect, useLayoutEffect, useMemo, type DragEvent } from "react";
import { ArrowLeft, ArrowLeftRight, Undo2, Redo2, X, Sparkles, MoreHorizontal, LockKeyhole } from "lucide-react";
import type { ComposerUiModel, ComposerTransport, ComposerRequest, ComposerOperation, ComposerField, ComposerDragSource } from "@/domain/phase2/planner/composer-ui-contract";
import type { ComposerAssetView, ComposerCardView, ComposerContextCardView, DropTarget } from "@/domain/phase2/planner/composer-contract";
import type { ComponentSelectionV1 } from "@/domain/phase2/planner/component-contract";
import { semanticStateDigest, type PlanSemanticStateV1 } from "@/domain/phase2/planner/semantic-state";
import type { SemanticMutation, PlanBalanceSuggestions } from "@/domain/phase2/planner/adjustment-contract";
import { ComposerLibrary } from "./composer-library";
import { ComposerBoard } from "./composer-board";
import { ComposerCockpit, ComposerProjectionDetails } from "./composer-cockpit";
import { BalanceLayer } from "./balance-layer";
import { ComposerResponseGate } from "./draft-controller";
import { monthLabel } from "./display";
import styles from "./composer.module.css";
import { ComposerInteractionContext, preparedDrop, publishedDrop, sameTarget } from "./interactions";
import { PlannerIcon } from "./planner-icons/planner-icon";
import { money } from "./display";
import { finishComparison, type ComparisonSnapshot } from "./comparison";
import { AtomicPopover } from "./atomic-popover";
import { stageLocalDecision, visualDraftModel } from "./local-draft";
import { ComposerPreviewScheduler, composerInteractionReuseEnabled, type PreviewStatus } from "./preview-scheduler";
import { composerPreviewHttp } from "./preview-http";
import { editorChunks, type EditorChunkKind, type LoadedEditorChunks } from "./editor-chunks";
import { NightOutEditor } from "./night-out-editor";
import { CardKnowledgePanel } from "./card-knowledge-panel";
import { useDurableDraft, type DraftTransport } from "./durable-draft";
import { composerDraftHttpTransport } from "./draft-http-transport";
import type { ComposerDraftSnapshot, StoredComposerDraft } from "@/domain/phase2/planner/composer-draft-contract";
import type { PlannerApplyCommand } from "@/domain/phase2/planner/compiler-contract";
import type { ComposerApplyReceipt } from "@/domain/phase2/planner/composer-ui-contract";
import { useCommittedEvent } from "./use-committed-event";

type Editor = { title: string; compact?: boolean; side?: boolean; fields: readonly ComposerField[]; values: Record<string, string>;
  giftContextId?: string; nightContextId?: string; familyContextId?: string; stayContextId?: string; catalogContextId?: string; familyMode?: string;
  cardKey?: string;
  operation: (values: Record<string, string>) => ComposerOperation };
type DraftConfirmation = { kind: "ABANDON" | "RESTART" | "RESTORE" | "LOAD_SERVER"; draftId?: string; version?: number };
type PendingApply = { draft: PlanSemanticStateV1; command: PlannerApplyCommand; checkedAbsent?: boolean };
export function ComposerShell({ initialModel, transport: suppliedTransport, initialDrafts = null, draftTransport: suppliedDraftTransport = null, durableDraftHttp = false, snapshotMetrics = false, previewHttp = false }: {
  initialModel: ComposerUiModel; transport: ComposerTransport;
  initialDrafts?: ComposerDraftSnapshot | null; draftTransport?: DraftTransport | null; durableDraftHttp?: boolean;
  snapshotMetrics?: boolean; previewHttp?: boolean;
}) {
  const draftTransport = durableDraftHttp ? composerDraftHttpTransport : suppliedDraftTransport;
  const transport: ComposerTransport = useCommittedEvent(async (request: ComposerRequest) => {
    const started = performance.now();
    const response = await (previewHttp && (request.kind === "READ" || request.kind === "SUGGESTIONS") ? composerPreviewHttp(request) : suppliedTransport(request));
    if (snapshotMetrics) {
      const settled = performance.now();
      // All stamps use the browser's monotonic clock. A resource is attributable
      // only when exactly one matching fetch occurred inside this action window.
      const requestPath = previewHttp && (request.kind === "READ" || request.kind === "SUGGESTIONS") ? "/api/composer/preview" : window.location.pathname;
      const resources = (performance.getEntriesByType("resource") as PerformanceResourceTiming[])
        .filter(entry => entry.initiatorType === "fetch" && entry.startTime >= started && entry.responseEnd <= settled
          && new URL(entry.name).origin === window.location.origin
          && new URL(entry.name).pathname === requestPath)
        .slice(-8).map(entry => ({ startMs: entry.startTime, requestStartMs: entry.requestStart,
          responseStartMs: entry.responseStart, responseEndMs: entry.responseEnd,
          durationMs: entry.duration, decodedBytes: entry.decodedBodySize, transferBytes: entry.transferSize }));
      const metrics = (response as typeof response & { snapMetrics?: unknown }).snapMetrics;
      document.querySelector("[data-composer]")?.setAttribute("data-snap-action", JSON.stringify({
        kind: request.kind, sequence: request.sequence, startedMs: started, settledMs: settled, responseMs: settled - started,
        resources, afterResponseMs: resources.length === 1 ? settled - resources[0].responseEndMs : null,
        attribution: resources.length === 1 ? "SINGLE_MATCHING_FETCH" : "UNATTRIBUTED", ok: response.ok, metrics,
      }));
    }
    return response;
  });
  const [model, setModel] = useState(initialModel), current = useRef(initialModel);
  const [draftState, setDraftState] = useState(initialModel.semanticState), localDraft = useRef(initialModel.semanticState);
  const [previewStatus, setPreviewStatus] = useState<PreviewStatus>(initialModel.board.cockpit.applyReadiness === "BLOCKED" ? "BLOCKED" : "FRESH");
  const snapshotIntent = useRef<number | null>(null);
  const snapshotCommit = useRef<{ initialMs: number; statusMs: number } | null>(null);
  useLayoutEffect(() => {
    if (snapshotMetrics) { const now = performance.now();
      snapshotCommit.current = { initialMs: snapshotCommit.current?.initialMs ?? now, statusMs: now }; }
  }, [snapshotMetrics, previewStatus]);
  useEffect(() => {
    if (!snapshotMetrics) return;
    let frame = requestAnimationFrame(() => { frame = requestAnimationFrame(() => {
      const navigation=performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
      if (!performance.getEntriesByName("snap-board-usable").length) performance.mark("snap-board-usable");
      if (previewStatus === "FRESH" && !performance.getEntriesByName("snap-preview-fresh").length) performance.mark("snap-preview-fresh");
      const fresh = performance.getEntriesByName("snap-preview-fresh")[0];
      document.querySelector("[data-composer]")?.setAttribute("data-snap-browser", JSON.stringify({
        boardMs:performance.getEntriesByName("snap-board-usable")[0]?.startTime,
        freshMs:performance.getEntriesByName("snap-preview-fresh")[0]?.startTime,previewStatus,
        initialCommitMs:snapshotCommit.current?.initialMs,statusCommitMs:snapshotCommit.current?.statusMs,
        responseEndToFreshMs:fresh && navigation ? fresh.startTime-navigation.responseEnd : null,
        navigation:navigation?{type:navigation.type,ttfbMs:navigation.responseStart-navigation.requestStart,
          requestStartMs:navigation.requestStart,responseStartMs:navigation.responseStart,responseEndMs:navigation.responseEnd,
          responseMs:navigation.responseEnd-navigation.requestStart,transferBytes:navigation.transferSize,
          decodedBytes:navigation.decodedBodySize}:null}));
      if (previewStatus === "FRESH" && snapshotIntent.current !== null) {
        document.querySelector("[data-composer]")?.setAttribute("data-snap-intent", JSON.stringify({
          intentMs:snapshotIntent.current,commitMs:snapshotCommit.current?.statusMs,paintObservedMs:performance.now(),
          visualFreshMs:performance.now()-snapshotIntent.current}));
        snapshotIntent.current=null;
      }
    }); });
    return () => cancelAnimationFrame(frame);
  }, [snapshotMetrics, previewStatus]);
  const scheduler = useRef(new ComposerPreviewScheduler());
  const [busy, setBusy] = useState(false), busyRef = useRef(false);
  const [selected, setSelected] = useState<string | null>(null), [message, setMessage] = useState("");
  const [focusedContext, setFocusedContext] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [past, setPast] = useState<PlanSemanticStateV1[]>([]), [future, setFuture] = useState<PlanSemanticStateV1[]>([]);
  const [editor, setEditor] = useState<Editor | null>(null), [balanceOpen, setBalanceOpen] = useState(false), [suggestions, setSuggestions] = useState<PlanBalanceSuggestions | null>(null);
  const [loadedEditors, setLoadedEditors] = useState<LoadedEditorChunks>({});
  const [editorLoadError, setEditorLoadError] = useState<EditorChunkKind | null>(null);
  const [editorLoadRetry, setEditorLoadRetry] = useState(0);
  const editorKind: EditorChunkKind | null = editor?.stayContextId ? "stay" : editor?.familyContextId ? "family"
    : editor?.giftContextId ? "gift" : editor?.catalogContextId ? "catalog" : null;
  useEffect(() => {
    if (!editorKind || loadedEditors[editorKind]) return;
    let current = true;
    setEditorLoadError(null);
    void editorChunks[editorKind]().then(component => {
      if (current) setLoadedEditors(previous => ({ ...previous, [editorKind]: component }) as LoadedEditorChunks);
    }).catch(() => { if (current) setEditorLoadError(editorKind); });
    return () => { current = false; };
  }, [editorKind, editorLoadRetry, loadedEditors]);
  const FamilyVisitEditor = loadedEditors.family;
  const ShortStayEditor = loadedEditors.stay, GiftEditor = loadedEditors.gift, CatalogContextEditor = loadedEditors.catalog;
  const [projectionOpen, setProjectionOpen] = useState(false), [libraryOpenToken, setLibraryOpenToken] = useState(0);
  const [hoverModel, setHoverModel] = useState<ComposerUiModel | null>(null), gate = useRef(new ComposerResponseGate()), timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingHover = useRef<{ key: string; draftDigest: string; worldVersion: string; sequence: number } | null>(null);
  const dialog = useRef<HTMLDialogElement>(null), invoker = useRef<HTMLElement | null>(null);
  const applyAttempt = useRef<{ key: string; applyRequestId: string } | null>(null);
  const [pendingApply, setPendingApply] = useState<PendingApply | null>(null);
  const [applyReceipt, setApplyReceipt] = useState<ComposerApplyReceipt | null>(null);
  const [comparison, setComparison] = useState<ComparisonSnapshot | null>(null);
  const durable = useDurableDraft(draftTransport, initialDrafts, initialModel.semanticState.targetMonth, draftState, !!comparison);
  const skipUnloadWarning = useRef(false);
  const savedReloadSafe = !!draftTransport && !comparison && durable.online && durable.status === "SAVED" && !durable.unsaved
    && durable.snapshot?.active?.digest === semanticStateDigest(draftState);
  const editorReloadSafe = editorLoadError !== null && savedReloadSafe;
  function reloadSavedComposer() {
    // A browser can remember a failed module import for this document. Reload
    // only a server-confirmed Draft, never an unconfirmed in-memory decision.
    if (!savedReloadSafe || durable.snapshot?.active?.digest !== semanticStateDigest(localDraft.current)) return;
    skipUnloadWarning.current = true;
    window.location.reload();
  }
  const confirmationDialog = useRef<HTMLDialogElement>(null);
  const [draftConfirmation, setDraftConfirmation] = useState<DraftConfirmation | null>(null);
  const [draftConfirmationBusy, setDraftConfirmationBusy] = useState(false);
  const [completenessFocus, setCompletenessFocus] = useState(false);
  const [grabbed, setGrabbed] = useState<ComposerDragSource | null>(null), grab = useRef<ComposerDragSource | null>(null);
  const [overTarget, setOverTarget] = useState<DropTarget | null>(null), overRef = useRef<DropTarget | null>(null);
  const dragIdentity = useRef({ identity: "", selectionId: "" }), dragImage = useRef<HTMLDivElement>(null);
  const assistantGrab = useRef<{ targetRef: string; operation: ComposerOperation } | null>(null);
  const assistantOver = useRef<string | null>(null);
  const [hoverPending, setHoverPending] = useState(false), [interactionImpact, setInteractionImpact] = useState<string | null>(null);
  const [motion, setMotion] = useState<"snap" | "undo" | "redo" | "recoil" | null>(null), [motionTarget, setMotionTarget] = useState<string | null>(null);
  const motionTimer = useRef<ReturnType<typeof setTimeout> | null>(null), nextMotionTarget = useRef<string | null>(null);
  const install = (next: ComposerUiModel) => { current.current = next; localDraft.current = next.semanticState; setDraftState(next.semanticState); setModel(next); };
  const shown = useMemo(() => visualDraftModel(model, draftState), [model, draftState]);
  const worldVersion = `${model.proof.expectedBaselineDigest}:${model.proof.expectedActiveRevisionId}:${model.proof.expectedActiveRevisionNumber}`;
  const currentAuthority = () => ({ draftDigest: semanticStateDigest(localDraft.current), targetMonth: localDraft.current.targetMonth,
    worldVersion: `${current.current.proof.expectedBaselineDigest}:${current.current.proof.expectedActiveRevisionId}:${current.current.proof.expectedActiveRevisionNumber}` });
  function schedulePreview(draft: PlanSemanticStateV1) {
    scheduler.current.schedule(draft, currentAuthority().worldVersion, transport, currentAuthority, status => {
      setPreviewStatus(status);
      if (status === "FAILED") { const failure = "Simulation indisponible. Votre brouillon est conservé ; réessayez une modification pour relancer la prévisualisation."; setMessage(failure); setErrorMessage(failure); }
      if (status === "STALE") setMessage("Projection obsolète. Votre brouillon est conservé ; relancez la prévisualisation avant d’appliquer le mois.");
    }, response => {
      if (!response.ok) { setMessage(response.message); setErrorMessage(response.message); return; }
      install(response.model); setErrorMessage(null); setMessage("Brouillon simulé par le Compiler/V2.");
    });
  }
  function stage(operation: ComposerOperation, history: "push" | "undo" | "redo" = "push", restored?: PlanSemanticStateV1) {
    if (snapshotMetrics) snapshotIntent.current=performance.now();
    const before = localDraft.current;
    const next = restored ?? stageLocalDecision(current.current, before, operation);
    if (!next) { void run(operation, history, restored); return false; }
    const beforeDigest = semanticStateDigest(before), nextDigest = semanticStateDigest(next);
    if (composerInteractionReuseEnabled && beforeDigest === nextDigest && ["FRESH", "BLOCKED", "PENDING"].includes(previewStatus)) return true;
    clearHover(); gate.current.invalidate(); scheduler.current.cancel();
    if (beforeDigest !== nextDigest) {
      if (history === "push") { setPast(p => [...p, before]); setFuture([]); }
      else if (history === "undo") { setPast(p => p.slice(0, -1)); setFuture(f => [...f, before]); }
      else { setFuture(f => f.slice(0, -1)); setPast(p => [...p, before]); }
    }
    localDraft.current = next; setDraftState(next); setSuggestions(null); setBalanceOpen(false); setHoverModel(null); setInteractionImpact(null); setErrorMessage(null);
    setPreviewStatus("STALE"); setMessage("Choix conservé dans le brouillon ; simulation en attente.");
    schedulePreview(next);
    return true;
  }
  const clearHover = () => { if (timer.current) clearTimeout(timer.current); pendingHover.current = null; if (!busyRef.current) gate.current.invalidate(); setHoverModel(null); setHoverPending(false); setInteractionImpact(null); };
  useEffect(() => { scheduler.current.revive(); return () => { if (timer.current) clearTimeout(timer.current); if (motionTimer.current) clearTimeout(motionTimer.current); gate.current.invalidate(); scheduler.current.dispose(); }; }, []);
  useEffect(() => {
    const historyKey = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== "z" || event.altKey || busyRef.current || event.target instanceof Element && event.target.closest("input,textarea,select,[contenteditable=true],dialog[open]")) return;
      event.preventDefault();
      if (event.shiftKey && future.length) stage({ kind: "READ" }, "redo", future.at(-1));
      else if (!event.shiftKey && past.length) stage({ kind: "READ" }, "undo", past.at(-1));
    };
    window.addEventListener("keydown", historyKey); return () => window.removeEventListener("keydown", historyKey);
  }, [past, future]);
  useEffect(() => {
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") { setCompletenessFocus(false);
      if (!document.querySelector("[popover]:popover-open,dialog[open]")) setFocusedContext(null); endDrag(); } };
    window.addEventListener("keydown", escape); return () => window.removeEventListener("keydown", escape);
  }, []);
  useEffect(() => {
    if (!(draftTransport ? durable.unsaved : shown.board.draft.dirty) || skipUnloadWarning.current) return;
    const warn = (event: BeforeUnloadEvent) => { if (!skipUnloadWarning.current) event.preventDefault(); };
    window.addEventListener("beforeunload", warn); return () => window.removeEventListener("beforeunload", warn);
  }, [durable.unsaved, shown.board.draft.dirty, draftTransport]);
  function archiveDraft(returnToCenter: boolean) {
    const active = durable.snapshot?.active;
    if (active) setDraftConfirmation({ kind: returnToCenter ? "ABANDON" : "RESTART", draftId: active.draftId, version: active.version });
  }
  function restoreDraft(draft: StoredComposerDraft) {
    if (durable.snapshot?.active) { setMessage("Archivez d’abord le brouillon actif avant d’en restaurer un autre."); return; }
    setDraftConfirmation({ kind: "RESTORE", draftId: draft.draftId, version: draft.version });
  }
  async function confirmDraftAction() {
    const action = draftConfirmation;
    if (!action || draftConfirmationBusy) return;
    if (action.kind === "LOAD_SERVER") { skipUnloadWarning.current = true; window.location.reload(); return; }
    const draft = action.kind === "RESTORE"
      ? durable.snapshot?.archives.find(item => item.draftId === action.draftId)
      : durable.snapshot?.active;
    if (!draft || draft.draftId !== action.draftId || draft.version !== action.version) {
      setDraftConfirmation(null); setMessage("Le brouillon a changé. Relisez sa version avant de continuer."); return;
    }
    setDraftConfirmationBusy(true);
    try {
      const done = await durable.lifecycle(action.kind === "RESTORE" ? "RESTORE" : "ARCHIVE", draft,
        action.kind !== "RESTORE" && durable.unsaved);
      if (!done) { setDraftConfirmation(null); return; }
      skipUnloadWarning.current = true;
      if (action.kind === "ABANDON") window.location.assign(`/mois-a-venir?month=${initialModel.semanticState.targetMonth}&control=center`);
      else if (action.kind === "RESTART") window.location.assign(`/mois-a-venir/composer?month=${initialModel.semanticState.targetMonth}`);
      else window.location.reload();
    } finally { setDraftConfirmationBusy(false); }
  }
  useEffect(() => {
    if (draftConfirmation && !confirmationDialog.current?.open) confirmationDialog.current?.showModal();
    else if (!draftConfirmation && confirmationDialog.current?.open) confirmationDialog.current.close();
  }, [draftConfirmation]);
  useEffect(() => {
    if (editor || projectionOpen) { invoker.current = document.activeElement as HTMLElement;
      if (dialog.current?.open) dialog.current.close();
      if (editor?.side && !projectionOpen) dialog.current?.show(); else dialog.current?.showModal(); }
    else { dialog.current?.close(); invoker.current?.focus(); }
  }, [!!editor, editor?.side, projectionOpen]);
  async function checkApply(pending: PendingApply) {
    const ticket = gate.current.next(semanticStateDigest(localDraft.current));
    try {
      const response = await transport({ kind: "CHECK_APPLY", sequence: ticket.sequence, targetMonth: pending.draft.targetMonth,
        draft: pending.draft, command: pending.command });
      if (!gate.current.accepts(ticket, response.sequence, semanticStateDigest(localDraft.current))) return;
      if (response.applied && response.applyReceipt) {
        setApplyReceipt(response.applyReceipt);
        if (response.ok && response.applyReceipt.headStatus === "ACTIVE") {
          install(response.model); setPendingApply(null); applyAttempt.current = null; setPast([]); setFuture([]);
          setPreviewStatus(response.model.board.cockpit.applyReadiness === "BLOCKED" ? "BLOCKED" : "FRESH");
          setMessage(`Révision ${response.applyReceipt.revisionNumber} confirmée et relue. Aucune seconde application créée.`);
          setErrorMessage(null);
        } else {
          setPreviewStatus("STALE");
          setMessage(response.applyReceipt.headStatus === "SUPERSEDED"
            ? `La demande avait enregistré la révision ${response.applyReceipt.revisionNumber}, mais une révision plus récente est active. Votre brouillon est conservé.`
            : `Révision ${response.applyReceipt.revisionNumber} enregistrée. La relecture du Plan actif reste indisponible ; votre brouillon est conservé.`);
          setPendingApply(response.applyReceipt.headStatus === "UNAVAILABLE" ? pending : null);
          if (response.applyReceipt.headStatus === "SUPERSEDED") applyAttempt.current = null;
          setErrorMessage(null);
        }
      } else {
        setPreviewStatus("STALE");
        if (!response.ok && response.code === "COMPOSER_APPLY_UNCONFIRMED") setPendingApply({ ...pending, checkedAbsent: true });
        setMessage(response.ok ? "La vérification n’a pas confirmé cette application. Votre brouillon est conservé." : response.message);
        setErrorMessage(null);
      }
    } catch {
      setPreviewStatus("STALE");
      setMessage("Issue de l’application encore inconnue. Votre brouillon est conservé ; vérifiez de nouveau. Aucune seconde écriture n’a été lancée.");
    }
  }
  async function run(operation: ComposerOperation, history: "push" | "undo" | "redo" | "none" = "push", draft?: PlanSemanticStateV1) {
    if (busyRef.current) return;
    if (snapshotMetrics) snapshotIntent.current=performance.now();
    scheduler.current.cancel();
    clearHover(); busyRef.current = true; setBusy(true); setSuggestions(null); setErrorMessage(null);
    const beforeDraft = localDraft.current, sourceDigest = semanticStateDigest(beforeDraft), ticket = gate.current.next(sourceDigest);
    setPreviewStatus("PENDING");
    try {
      const response = await transport({ ...operation, sequence: ticket.sequence, targetMonth: beforeDraft.targetMonth, draft: draft ?? beforeDraft } as ComposerRequest);
      if (!gate.current.accepts(ticket, response.sequence, semanticStateDigest(localDraft.current))) return;
      if (!response.ok) {
        if (operation.kind === "APPLY" && response.code === "COMPOSER_APPLY_UNCONFIRMED") {
          const pending = { draft: draft ?? beforeDraft, command: operation.command };
          setPendingApply(pending); setPreviewStatus("STALE"); setMessage(response.message);
          await checkApply(pending); return;
        }
        if (response.applied) {
          applyAttempt.current = null; setApplyReceipt(response.applyReceipt ?? null);
          if (operation.kind === "APPLY") setPendingApply({ draft: draft ?? beforeDraft, command: operation.command });
        } else if (operation.kind === "APPLY") setPendingApply(null);
        setPreviewStatus(response.applied || /STALE|CHANGED/u.test(response.code) ? "STALE" : "FAILED");
        setMessage(response.message); setErrorMessage(response.message); return;
      }
      if (response.applied && response.applyReceipt?.headStatus === "SUPERSEDED") {
        setApplyReceipt(response.applyReceipt); setPendingApply(null); applyAttempt.current = null; setPreviewStatus("STALE");
        setMessage(`La demande avait enregistré la révision ${response.applyReceipt.revisionNumber}, mais la révision active a changé. Votre brouillon est conservé.`);
        return;
      }
      const changed = sourceDigest !== response.model.board.draft.semanticStateDigest;
      if (response.applied) { applyAttempt.current = null; setPendingApply(null); setApplyReceipt(response.applyReceipt ?? null);
        setPast([]); setFuture([]); setMessage(response.applyReceipt?.outcome === "REPLAYED"
          ? `Révision ${response.model.activeRevisionNumber} déjà appliquée. Aucune nouvelle révision créée.`
          : `Révision ${response.model.activeRevisionNumber} appliquée et relue.`); }
      else {
        if (changed && history === "push") { setPast(p => [...p, beforeDraft]); setFuture([]); }
        else if (history === "undo") { setPast(p => p.slice(0, -1)); setFuture(f => [...f, beforeDraft]); }
        else if (history === "redo") { setFuture(f => f.slice(0, -1)); setPast(p => [...p, beforeDraft]); }
        setMessage(response.mutationKind === "CANCEL_CONTEXT" ? "Context retiré du brouillon. Son annulation sera conservée à l’application." : changed ? "Brouillon mis à jour et prévisualisé." : "Prévisualisation à jour.");
      }
      install(response.model); setPreviewStatus(response.model.board.cockpit.applyReadiness === "BLOCKED" ? "BLOCKED" : "FRESH"); setSuggestions(response.suggestions ?? null); setEditor(null); setSelected(null);
      if (changed) animate(history === "undo" ? "undo" : history === "redo" ? "redo" : "snap", nextMotionTarget.current);
      nextMotionTarget.current = null;
      if (balanceOpen && changed && !response.suggestions && !response.applied) {
        const refresh = gate.current.next(response.model.board.draft.semanticStateDigest);
        try {
          const regenerated = await transport({ kind: "SUGGESTIONS", sequence: refresh.sequence, targetMonth: response.model.semanticState.targetMonth, draft: response.model.semanticState });
          if (regenerated.ok && gate.current.accepts(refresh, regenerated.sequence, current.current.board.draft.semanticStateDigest)) {
            install(regenerated.model); setSuggestions(regenerated.suggestions ?? null);
          }
        } catch { setMessage("Brouillon conservé. Rouvrez les pistes pour actualiser les suggestions."); }
      }
    } catch {
      if (operation.kind === "APPLY") {
        const pending = { draft: draft ?? beforeDraft, command: operation.command };
        setPendingApply(pending); setPreviewStatus("STALE");
        setMessage("Réponse d’application perdue. Vérification de la révision sans nouvelle écriture…");
        await checkApply(pending);
      } else { const message = "Connexion interrompue. Votre brouillon est conservé ; rechargez la prévisualisation avant de réessayer.";
        setPreviewStatus("FAILED"); setMessage(message); setErrorMessage(message); }
    }
    finally { busyRef.current = false; setBusy(false); }
  }
  function hover(mutation: SemanticMutation | null) {
    previewGesture(mutation ? { kind: "MUTATE", mutation } : null);
  }
  function previewGesture(operation: ComposerOperation | null) {
    const same = pendingHover.current;
    if (composerInteractionReuseEnabled && operation && same?.key === JSON.stringify(operation)
      && same.draftDigest === current.current.board.draft.semanticStateDigest && same.worldVersion === currentAuthority().worldVersion
      && gate.current.accepts({ sequence: same.sequence, sourceDigest: same.draftDigest }, same.sequence, same.draftDigest)) return;
    clearHover();
    if (!operation || operation.kind === "APPLY" || busyRef.current || previewStatus !== "FRESH" || editor || projectionOpen
      || composerInteractionReuseEnabled && scheduler.current.pending()) return;
    const before = current.current, ticket = gate.current.next(before.board.draft.semanticStateDigest);
    const hovering = { key: JSON.stringify(operation), draftDigest: before.board.draft.semanticStateDigest,
      worldVersion: currentAuthority().worldVersion, sequence: ticket.sequence };
    pendingHover.current = hovering;
    setHoverPending(true);
    timer.current = setTimeout(async () => {
      try {
        const response = await transport({ ...operation, sequence: ticket.sequence, targetMonth: before.semanticState.targetMonth, draft: before.semanticState } as ComposerRequest);
        if (gate.current.accepts(ticket, response.sequence, current.current.board.draft.semanticStateDigest)) {
          setHoverPending(false); if (response.ok) { setHoverModel(response.model); setInteractionImpact(response.interactionImpact ?? null); }
        }
      } catch { if (gate.current.accepts(ticket, ticket.sequence, current.current.board.draft.semanticStateDigest)) setHoverPending(false); }
      finally { if (pendingHover.current === hovering) pendingHover.current = null; }
    }, 200);
  }
  function animate(kind: "snap" | "undo" | "redo" | "recoil", target: string | null) {
    if (motionTimer.current) clearTimeout(motionTimer.current);
    setMotion(kind); setMotionTarget(target);
    motionTimer.current = setTimeout(() => { setMotion(null); setMotionTarget(null); }, 240);
  }
  function endDrag() { clearHover(); grab.current = null; assistantGrab.current = null; assistantOver.current = null; setGrabbed(null); setSelected(null); setOverTarget(null); overRef.current = null; }
  function startDrag(key: string, event: DragEvent<HTMLElement>) {
    if (busyRef.current) { event.preventDefault(); return; }
    clearHover();
    const candidate = key.startsWith("assistant:") ? suggestions?.candidates.find(c => `assistant:${c.candidateId}` === key) : null;
    const source = candidate ? { sourceKey: key, assetKey: key, label: candidate.label, iconKey: shown.presentation.objects[candidate.targetRef]?.iconKey ?? "activity", economicAmount: candidate.impactOnMonthEnd, protected: false }
      : shown.presentation.dragSources[key];
    if (!source) { event.preventDefault(); return; }
    assistantGrab.current = candidate && suggestions ? { targetRef: candidate.targetRef, operation: { kind: "ACCEPT", candidateId: candidate.candidateId, candidateSetDigest: suggestions.candidateSetDigest } } : null;
    grab.current = source; setGrabbed(source); setSelected(source.assetKey);
    dragIdentity.current = { identity: crypto.randomUUID(), selectionId: crypto.randomUUID() };
    event.dataTransfer.setData("application/x-planner-asset", key); event.dataTransfer.effectAllowed = "move";
    // Populate the native cursor-following image synchronously, before dragstart ends.
    // A modal dialog makes elements outside its top layer inert. Chromium can
    // stall a native drag if its custom image lives outside that dialog.
    if (dragImage.current && !event.currentTarget.closest("dialog[open]")) {
      dragImage.current.querySelector<HTMLElement>("[data-drag-label]")!.textContent = source.label;
      dragImage.current.querySelector<HTMLElement>("[data-drag-amount]")!.textContent = source.protected ? "Protégée" : money(source.economicAmount);
      dragImage.current.dataset.protected = String(source.protected);
      dragImage.current.querySelectorAll<HTMLElement>("[data-drag-icon]").forEach(node => { node.style.display = node.dataset.dragIcon === source.iconKey ? "inline-flex" : "none"; });
      event.dataTransfer.setDragImage(dragImage.current, 24, 28);
    }
  }
  function dragOperation(target: DropTarget): ComposerOperation | null {
    const source = grab.current;
    if (!source || source.protected) return null;
    if (target.kind === "TRASH") return source.removeOperation ?? null;
    if (!publishedDrop(shown, source.assetKey, target)) return null;
    return preparedDrop(source, target, dragIdentity.current.identity, dragIdentity.current.selectionId);
  }
  function over(target: DropTarget | null) {
    if (target && sameTarget(overRef.current, target)) return;
    overRef.current = target; setOverTarget(target);
    // A target highlight is presentation only. Finance starts on a semantic choice.
    clearHover();
  }
  function place(target: DropTarget) {
    const source = grab.current;
    if (source?.editorTargetRef && source.editorDropTarget && sameTarget(source.editorDropTarget, target)) {
      const asset = model.library.searchableAssets.find(a => a.assetKey === source.assetKey); endDrag(); if (asset) choose(asset); return;
    }
    const operation = dragOperation(target);
    if (!operation) { if (grab.current?.protected) animate("recoil", grab.current.sourceKey); endDrag(); return; }
    nextMotionTarget.current = target.contextOccurrenceId ?? (operation.kind === "DROP" ? operation.identity : null);
    endDrag();
    if (operation.kind === "DROP" && operation.assetKey.startsWith("template:") && target.kind === "BOARD_ZONE") {
      const asset = shown.library.searchableAssets.find(a => a.assetKey === operation.assetKey);
      if (asset) { choose(asset, target, undefined, operation.identity); return; }
    }
    stage(operation);
  }
  function equip(assetKey: string, target: DropTarget) {
    const source = shown.presentation.dragSources[assetKey];
    if (!source || !publishedDrop(shown, source.assetKey, target)) return;
    nextMotionTarget.current = target.contextOccurrenceId ?? null;
    stage(preparedDrop(source, target, crypto.randomUUID(), crypto.randomUUID()));
  }
  function compare(keep?: boolean) {
    if (busyRef.current || previewStatus !== "FRESH") return;
    clearHover(); endDrag();
    if (!comparison) { setComparison({ model: current.current, past, future, suggestions }); setPast([]); setFuture([]); setSuggestions(null); setBalanceOpen(false); setMessage("Comparaison : Annuler/Rétablir agit uniquement sur la variante. Rien n’est enregistré."); }
    else {
      const result = finishComparison(comparison, current.current, !!keep);
      install(result.model); setPast(result.past); setFuture(result.future); setSuggestions(result.suggestions);
      setComparison(null); setMessage(keep ? "Variante gardée dans le brouillon. Vous pourrez l’appliquer ensuite." : "Brouillon avant comparaison restauré exactement.");
    }
  }
  function prepareDialogFocus() {
    // A nested popover disappears when a modal opens. Restore to its visible root invoker.
    let origin = document.activeElement as HTMLElement | null;
    let container = origin?.closest<HTMLElement>("[popover]");
    while (container) {
      origin = document.querySelector<HTMLElement>(`button[aria-controls="${CSS.escape(container.id)}"]`);
      container = origin?.closest<HTMLElement>("[popover]");
    }
    document.querySelectorAll<HTMLElement>("[popover]:popover-open").forEach(node => { if (node.matches(":popover-open")) node.hidePopover(); });
    origin?.focus();
  }
  function choose(asset: ComposerAssetView, target: DropTarget = { kind: "BOARD_ZONE" }, selection?: ComponentSelectionV1, stableId?: string) {
    clearHover();
    if (asset.kind === "SLOT_OPTION_ASSET" && asset.optionKind === "MOBILITY_INTENT") {
      const owner = shown.board.contexts.find(card => card.contextOccurrenceId === target.contextOccurrenceId && ["family-visit", "short-stay"].includes(card.templateKey));
      if (owner?.capabilityRefs.includes("PATCH_CONTEXT")) {
        editContext(owner); setEditor(current => current ? { ...current, familyMode: asset.optionKey } : current); return;
      }
    }
    if (selection?.kind === "COMPONENT") {
      const owner = shown.board.contexts.find(card => card.contextOccurrenceId === target.contextOccurrenceId);
      const stay = owner?.templateKey === "short-stay" ? owner : shown.board.contexts.find(card => card.contextOccurrenceId === owner?.parentContextOccurrenceId && card.templateKey === "short-stay");
      if (stay) { editContext(stay); return; }
    }
    if (selection?.kind === "COMPONENT" && selection.quantityPerPerson) {
      const owner = shown.board.contexts.find(card => card.contextOccurrenceId === target.contextOccurrenceId);
      const parent = owner?.templateKey === "night-out" ? owner : shown.board.contexts.find(card => card.contextOccurrenceId === owner?.parentContextOccurrenceId && card.templateKey === "night-out"
        && card.sockets.find(socket => socket.slotKey === "before")?.currentItems.some(item => item.kind === "CHILD_CONTEXT" && item.childContextOccurrenceId === owner?.contextOccurrenceId));
      if (parent) { editContext(parent); return; }
    }
    if (["PLAN_CONTROL", "RESERVATION_CONTROL"].includes(asset.kind)) {
      const card = [...shown.board.baselineControls, ...shown.board.discretionaryControls, ...shown.board.savings].find(c => c.targetRef === asset.capabilityRef);
      if (card) setFocusedContext(card.targetRef);
      if (card?.capability?.actions.length && card.capability.flexibility !== "LOCKED") edit(card);
      return;
    }
    const capability = shown.dropCapabilities.find(d => d.sourceAssetKey === asset.assetKey && d.target.kind === target.kind && d.target.contextOccurrenceId === target.contextOccurrenceId && d.target.slotKey === target.slotKey);
    if (!capability || capability.resolution === "BLOCKED") { setSelected(asset.assetKey); setMessage(`Carte ${asset.label} sélectionnée. Choisissez un emplacement compatible sur le mois.`); return; }
    const values: Record<string, string> = {};
    if (selection?.kind === "COMPONENT" && selection.optionKey === asset.optionKey) Object.assign(values, { label: selection.label, quantity: selection.quantityPerPerson ?? selection.quantity,
      personCount: selection.pricedParticipantCount?.toString() ?? "", amount: selection.cost.kind === "MANUAL" ? selection.cost.unitAmount : "",
      unitBasis: selection.unitBasis ?? "", funding: selection.fundingAllocations?.some(part => part.source !== "BANK") ? "EXISTING"
        : selection.fundingAllocations?.length ? "BANK" : "", fundingAmount: selection.fundingAllocations?.[0]?.amount ?? "",
      binding: selection.binding?.mode ?? "AUTO", needOccurrenceId: selection.needOccurrenceId ?? "" });
    if (selection?.kind === "MOBILITY_INTENT") Object.assign(values, { origin: selection.origin?.kind === "TEXT" ? selection.origin.label : "", destination: selection.destination?.kind === "TEXT" ? selection.destination.label : "",
      amount: selection.optionKey === asset.optionKey && selection.pricing?.fare.kind === "MANUAL" ? selection.pricing.fare.unitAmount : "",
      funding: selection.optionKey === asset.optionKey && selection.pricing?.fundingAllocations.some(part => part.source !== "BANK") ? "EXISTING"
        : selection.optionKey === asset.optionKey && selection.pricing?.fundingAllocations.length ? "BANK" : "",
      fundingAmount: selection.optionKey === asset.optionKey ? selection.pricing?.fundingAllocations[0]?.amount ?? "" : "",
      returnRequired: String(selection.returnRequired === true), targetIntentId: selection.optionKey === asset.optionKey ? selection.journey?.targetIntentId ?? "" : "",
      plannedTime: selection.plannedTime ?? "", returnTime: selection.returnTime ?? "", preference: selection.optionKey === asset.optionKey ? selection.pricing?.preference ?? "FASTEST" : "FASTEST",
      parkingMode: selection.optionKey === asset.optionKey && selection.pricing?.parking.kind === "MANUAL" ? selection.pricing.parking.unitAmount === "0" || selection.pricing.parking.unitAmount === "0.00" ? "NO" : "YES" : "UNKNOWN",
      parkingAmount: selection.optionKey === asset.optionKey && selection.pricing?.parking.kind === "MANUAL" ? selection.pricing.parking.unitAmount : "" });
    const identity = stableId ?? crypto.randomUUID(), selectionId = selection?.selectionId ?? crypto.randomUUID();
    if (asset.kind === "CONTEXT_ASSET" && target.kind === "BOARD_ZONE" && !selection) {
      const admitted = stage({ kind: "DROP", assetKey: asset.assetKey, target, values: {}, identity, selectionId });
      if (admitted) {
        setFocusedContext(identity); setSelected(null); prepareDialogFocus();
        setEditor({ title: `Configurer ${asset.label}`, side: !["night-out", "short-stay", "family-visit"].includes(asset.templateKey ?? ""),
          cardKey: asset.assetKey,
          ...(asset.templateKey === "gift" ? { giftContextId: identity } : {}),
          ...(asset.templateKey === "night-out" ? { nightContextId: identity } : {}),
          ...(asset.templateKey === "short-stay" ? { stayContextId: identity } : {}),
          ...(asset.templateKey === "family-visit" ? { familyContextId: identity } : {}),
          ...(!["gift", "night-out", "short-stay", "family-visit"].includes(asset.templateKey ?? "") ? { catalogContextId: identity } : {}),
          fields: model.editors.find(e => e.assetKey === asset.assetKey)?.fields ?? [], values: {},
          operation: values => ({ kind: "EDIT_CONTEXT", contextOccurrenceId: identity, values }) });
        return;
      }
    }
    prepareDialogFocus();
    const knowledgeTemplate = ["restaurant", "fast-food", "delivery"].includes(asset.optionKey ?? "")
      ? asset.optionKey : asset.templateKey;
    setEditor({ title: selection ? `Modifier ${asset.label}` : `Composer ${asset.label}`,
      cardKey: asset.kind === "SLOT_OPTION_ASSET" && knowledgeTemplate ? `template:${knowledgeTemplate}` : asset.assetKey,
      fields: model.editors.find(e => e.assetKey === asset.assetKey)?.fields ?? [], values,
      operation: values => ({ kind: "DROP", assetKey: asset.assetKey, target, values, identity, selectionId }) });
  }
  function drop(target: DropTarget, key = selected ?? "") {
    clearHover();
    if (!key || busyRef.current) return;
    const asset = shown.library.searchableAssets.find(a => a.assetKey === key);
    if (asset && target.kind !== "TRASH") { choose(asset, target); return; }
    stage({ kind: "DROP", assetKey: key, target, values: {}, identity: crypto.randomUUID(), selectionId: crypto.randomUUID() });
  }
  function edit(card: ComposerCardView) {
    clearHover();
    if (!card.capability?.actions.length || card.capability.flexibility === "LOCKED") return;
    prepareDialogFocus();
    setEditor({ title: `Ajuster ${card.label}`, side: card.kind !== "SAVINGS", compact: card.kind === "SAVINGS", cardKey: `control:${card.targetRef}`,
      fields: model.controlEditors.find(e => e.targetRef === card.targetRef)?.fields ?? [],
      values: Object.fromEntries(["amount", "count", "unitAmount"].map(key => [key, typeof card.value[key] === "string" ? card.value[key] as string : ""])),
      operation: values => ({ kind: "MUTATE", mutation: { kind: "SET_STATE", targetRef: card.targetRef, value: Object.fromEntries(model.controlEditors.find(e => e.targetRef === card.targetRef)!.fields.map(f => [f.key, values[f.key]])) } }) });
  }
  const closeDialog = () => { if (!busyRef.current) { setEditor(null); setProjectionOpen(false); setErrorMessage(null); } };
  function editContext(card: ComposerContextCardView) {
    clearHover();
    prepareDialogFocus();
    setEditor({ title: `Modifier ${card.label}`, side: !["night-out", "short-stay", "family-visit"].includes(card.templateKey),
      cardKey: `template:${card.templateKey}`,
      ...(card.templateKey === "gift" ? { giftContextId: card.contextOccurrenceId } : {}),
      ...(card.templateKey === "night-out" ? { nightContextId: card.contextOccurrenceId } : {}),
      ...(card.templateKey === "short-stay" ? { stayContextId: card.contextOccurrenceId } : {}),
      ...(card.templateKey === "family-visit" ? { familyContextId: card.contextOccurrenceId } : {}),
      ...(!["gift", "night-out", "short-stay", "family-visit"].includes(card.templateKey) ? { catalogContextId: card.contextOccurrenceId } : {}),
      fields: model.editors.find(e => e.assetKey === `template:${card.templateKey}`)?.fields ?? [],
      values: Object.fromEntries(Object.entries(card.fields).filter((entry): entry is [string, string] => typeof entry[1] === "string")),
      operation: values => ({ kind: "EDIT_CONTEXT", contextOccurrenceId: card.contextOccurrenceId, values }) });
  }
  function apply() {
    if (pendingApply || comparison || grab.current || editor || previewStatus !== "FRESH" || model.board.cockpit.applyReadiness === "BLOCKED"
      || semanticStateDigest(localDraft.current) !== model.board.draft.semanticStateDigest
      || draftTransport && (durable.status !== "SAVED" || !navigator.onLine || durable.snapshot?.baseStale)) return;
    if (model.board.cockpit.applyReadiness === "READY_WITH_WARNINGS") {
      const warnings = model.board.cockpit.diagnostics.filter(item => item.severity === "WARN").map(item => item.message ?? item.code);
      if (!window.confirm(`Appliquer ce mois malgré les avertissements ?\n\n${warnings.join("\n")}`)) return;
    }
    const key = `${model.board.draft.semanticStateDigest}:${model.proof.expectedPreviewDigest}:${model.proof.expectedActiveRevisionId}`;
    if (applyAttempt.current?.key !== key) applyAttempt.current = { key, applyRequestId: crypto.randomUUID() };
    void run({ kind: "APPLY", command: { ...model.proof, applyRequestId: applyAttempt.current.applyRequestId } }, "none");
  }
  const applyDisabled = busy || !!pendingApply || !!editor || previewStatus !== "FRESH" || !!hoverModel || !!grabbed || !shown.board.draft.dirty || model.board.cockpit.applyReadiness === "BLOCKED"
    || !!draftTransport && (durable.status !== "SAVED" || !durable.online || !!durable.snapshot?.baseStale);
  const openProjectionDetails = () => {
    clearHover();
    if (previewStatus !== "FRESH" && previewStatus !== "BLOCKED") { setMessage("Projection en attente d’une simulation à jour."); return; }
    setEditor(null); setProjectionOpen(true);
  };
  const applyReason = busy ? "La prévisualisation serveur est en cours." : pendingApply ? "L’issue de la demande précédente doit être vérifiée avant toute nouvelle application."
    : draftTransport && (durable.status !== "SAVED" || !durable.online || durable.snapshot?.baseStale)
    ? "Attendez la sauvegarde confirmée du brouillon et une connexion active avant d’appliquer."
    : hoverModel || grabbed ? "Terminez le geste pour appliquer le mois."
    : editor ? "Terminez ou fermez le panneau de configuration avant d’appliquer le mois."
    : previewStatus === "FAILED" ? "La simulation a échoué. Le brouillon est conservé ; relancez la prévisualisation avant d’appliquer."
    : previewStatus === "STALE" ? "La projection est obsolète. Relancez la prévisualisation avant d’appliquer."
    : previewStatus === "BLOCKED" ? model.board.cockpit.diagnostics.some(diagnostic => diagnostic.code === "COMPONENT_FUNDING_SUM_INVALID")
      ? "Le financement déclaré ne correspond pas au coût du composant. Ajustez-le avant d’appliquer."
      : "La projection est calculée, mais des contraintes empêchent l’application. Consultez le détail financier."
    : previewStatus !== "FRESH" ? "La projection du brouillon attend une simulation serveur fraîche."
    : !model.board.draft.dirty ? model.activeRevisionNumber ? "Le mois est déjà appliqué. Modifiez un élément pour créer une nouvelle révision." : `Composez un premier choix pour appliquer votre mois.${model.presentation.unresolvedCount ? ` ${model.presentation.unresolvedCount} éléments à préciser.` : ""}`
    : model.presentation.unresolvedCount ? `${model.presentation.unresolvedCount} éléments restent à préciser avant l’application.`
    : "Les contraintes signalées doivent être précisées avant l’application.";
  const stableStart=useCommittedEvent(startDrag),stableEnd=useCommittedEvent(endDrag),stableOver=useCommittedEvent(over),stablePlace=useCommittedEvent(place),stableEquip=useCommittedEvent(equip);
  const stableCanTarget=useCommittedEvent((ref:string)=>assistantGrab.current?.targetRef===ref);
  const stableReject=useCommittedEvent(()=>animate("recoil",grab.current?.sourceKey??null));
  const stableOverAssistant=useCommittedEvent((ref:string|null)=>{if(ref===assistantOver.current)return;assistantOver.current=ref;clearHover();});
  const stablePlaceAssistant=useCommittedEvent((ref:string)=>{if(assistantGrab.current?.targetRef!==ref)return;const operation=assistantGrab.current.operation;nextMotionTarget.current=ref;endDrag();void run(operation);});
  const interactionView=useMemo(()=>({grabbed,overTarget,motion,motionTarget,completenessFocus,unresolvedRefs:model.presentation.unresolvedRefs,
    start:stableStart,end:stableEnd,over:stableOver,place:stablePlace,equip:stableEquip,canTarget:stableCanTarget,reject:stableReject,overAssistant:stableOverAssistant,placeAssistant:stablePlaceAssistant}),
    [grabbed,overTarget,motion,motionTarget,completenessFocus,model.presentation.unresolvedRefs,stableStart,stableEnd,stableOver,stablePlace,stableEquip,stableCanTarget,stableReject,stableOverAssistant,stablePlaceAssistant]);
  const stableChoose=useCommittedEvent(choose),stableEdit=useCommittedEvent(edit),stableEditContext=useCommittedEvent(editContext),stableDrop=useCommittedEvent(drop),stableHover=useCommittedEvent(hover);
  const stableRequest=useCommittedEvent((operation:ComposerOperation)=>stage(operation));
  const stableLibraryChoose=useCommittedEvent((asset:ComposerAssetView)=>choose(asset));
  const stableLibraryDrag=useCommittedEvent((key:string|null)=>{clearHover();setSelected(key);});
  const stableAdd=useCommittedEvent(()=>{clearHover();setLibraryOpenToken(n=>n+1);});
  const stablePreview=useCommittedEvent(()=>void run({kind:"READ"},"none"));
  const stableBalance=useCommittedEvent(()=>{clearHover();setBalanceOpen(v=>!v);if(!balanceOpen)void run({kind:"SUGGESTIONS"},"none");});
  const stableDetails=useCommittedEvent(openProjectionDetails);
  return <ComposerInteractionContext.Provider value={interactionView}>
  <div className={styles.workspace} data-composer data-digest={shown.board.draft.semanticStateDigest} data-snap-preview-digest={snapshotMetrics?model.proof.expectedPreviewDigest:undefined} data-preview-state={previewStatus} data-save-state={durable.status} data-world-version={worldVersion} data-exploratory-digest={hoverModel?.board.draft.semanticStateDigest} data-dragging={!!grabbed} data-comparing={!!comparison} data-motion={motion} data-revision={model.activeRevisionNumber} aria-busy={busy}
    onDragOverCapture={e => { if (grab.current && e.target instanceof Element && !e.target.closest("[data-board-drop],[data-trash]")) { over(null); if (assistantOver.current) { assistantOver.current = null; clearHover(); } } }}>
    <header className={styles.workspaceHeader}><div className={styles.headerIdentity}><a href={`/mois-a-venir?month=${model.semanticState.targetMonth}&control=center`} className={styles.backLink}><ArrowLeft size={14} /> Centre de contrôle</a>
      <h1>Composer <span>{monthLabel(model.semanticState.targetMonth)}</span></h1><div className={styles.headerMeta}>{comparison && <span className={styles.variantMarker} data-variant-marker>VARIANTE</span>}<span className={styles.draftStatus} data-draft-status>{draftTransport ? ({ CLEAN: "Aucun brouillon sauvegardé", DIRTY: "Modifications non enregistrées", SAVING: "Sauvegarde en cours…", SAVED: "Brouillon sauvegardé", ERROR: "Erreur de sauvegarde", CONFLICT: "Conflit de brouillon", OFFLINE: "Hors ligne · non enregistré" }[durable.status]) : !model.activeRevisionNumber ? "Brouillon" : shown.board.draft.dirty ? "Nouvelle modification" : `Appliqué · révision ${model.activeRevisionNumber}`}</span>
        <span data-object-count>{shown.presentation.elementCount} éléments · <button className={styles.completenessToggle} data-completeness-toggle aria-pressed={completenessFocus} disabled={!model.presentation.unresolvedCount} onClick={() => setCompletenessFocus(v => !v)}>{model.presentation.unresolvedCount} à préciser</button></span>
        {previewStatus === "FRESH" && model.board.cockpit.projectionCompleteness === "COMPLETE" && model.board.cockpit.applyReadiness === "READY" && <span data-plan-ready>Plan prêt ✓</span>}</div></div>
      <div className={styles.hudContainer} data-compare-header>{comparison && <div className={styles.compareCurrent}><span>Actuel</span><strong>{money(comparison.model.board.cockpit.plan.economicMonthEndRemainder)}</strong></div>}
      <ComposerCockpit projection={(hoverModel ?? model).board.cockpit} goalMargin={(hoverModel ?? model).presentation.goalMargin} temporary={!!hoverModel} pending={hoverPending || previewStatus === "PENDING"} stale={previewStatus !== "FRESH" && previewStatus !== "BLOCKED"} staleLabel={previewStatus === "FAILED" ? "Projection indisponible après un échec de simulation" : previewStatus === "STALE" ? "Projection obsolète" : undefined}
        canonicalRemainder={model.board.cockpit.plan.economicMonthEndRemainder} interactionImpact={interactionImpact} variant={!!comparison} details={openProjectionDetails} /></div>
      <div className={styles.toolbar}><div className={styles.historyTools}>
        <button className={styles.historyButton} title="Annuler (Ctrl/Cmd+Z)" aria-label="Annuler la dernière modification du brouillon" disabled={busy || !past.length} onClick={() => stage({ kind: "READ" }, "undo", past.at(-1))}><Undo2 size={17} /></button>
        <button className={styles.historyButton} title="Rétablir (Ctrl/Cmd+Shift+Z)" aria-label="Rétablir la modification du brouillon" disabled={busy || !future.length} onClick={() => stage({ kind: "READ" }, "redo", future.at(-1))}><Redo2 size={17} /></button></div>
        {comparison ? <div className={styles.compareActions}><button data-compare-keep className={styles.secondary} disabled={busy} onClick={() => compare(true)}>Garder cette variante</button><button data-compare-exit className={styles.textButton} disabled={busy} onClick={() => compare(false)}>Quitter la comparaison</button></div>
          : <><button data-compare className={styles.compareButton} disabled={busy || previewStatus !== "FRESH"} onClick={() => compare()}><ArrowLeftRight size={14} /> Comparer</button>
            <div className={styles.applyControl} tabIndex={applyDisabled ? 0 : undefined} aria-label={applyDisabled ? applyReason : undefined} data-apply-control data-unavailable={applyDisabled}>
              <button className={styles.primary} data-apply disabled={applyDisabled} aria-describedby={applyDisabled ? "apply-disabled-reason" : undefined} onClick={apply}>{busy ? "Validation…" : "Appliquer mon mois"}</button>
              {applyDisabled && <div className={styles.applyReason} role="group" aria-label="Application indisponible" data-apply-reason><p id="apply-disabled-reason">{applyReason}</p>
                {!!model.presentation.unresolvedCount && <button data-show-unresolved onClick={() => setCompletenessFocus(true)}>Afficher les éléments</button>}</div>}
            </div></>}
        <AtomicPopover utility label="Autres actions du mois" state="ACTIONS" focus={() => {}} icon={<MoreHorizontal size={17} />}>{close => <div className={styles.popoverActions}>
          <button data-preview disabled={busy} onClick={() => { close(); void run({ kind: "READ" }, "none"); }}>Actualiser la prévisualisation</button>
          <button data-balance disabled={busy} onClick={() => { close(); clearHover(); setBalanceOpen(v => !v); if (!balanceOpen) void run({ kind: "SUGGESTIONS" }, "none"); }}>Suggestions pour mon mois</button>
          <button data-financial-menu onClick={() => { close(); openProjectionDetails(); }}>Détail financier</button></div>}</AtomicPopover>
        {draftTransport && <div className={styles.durableActions}>
          {(durable.status === "ERROR" || durable.status === "OFFLINE") && <button data-save-retry onClick={durable.retry}>Réessayer la sauvegarde</button>}
          {durable.status === "CONFLICT" && <><button data-save-refresh onClick={() => void durable.refresh()}>Relire le brouillon</button>
            <button data-save-load-server onClick={() => setDraftConfirmation({ kind: "LOAD_SERVER" })}>Charger la version sauvegardée</button></>}
          {durable.snapshot?.active && <><button data-draft-abandon onClick={() => archiveDraft(true)}>Abandonner mes essais</button>
            <button data-draft-restart onClick={() => archiveDraft(false)}>Repartir du Plan actif</button></>}
          {!!durable.snapshot?.archives.length && <details data-draft-archives><summary>Brouillons archivés ({durable.snapshot.archives.length})</summary>
            {durable.snapshot.archives.map(draft => <div key={draft.draftId}><span>{new Date(draft.lastSavedAt).toLocaleString("fr-FR", { timeZone: "Europe/Paris" })}</span>
              <button disabled={!!durable.snapshot?.active} onClick={() => restoreDraft(draft)}>Restaurer</button></div>)}</details>}
        </div>}
        {draftTransport && ["ERROR", "CONFLICT", "OFFLINE"].includes(durable.status) && <span className={styles.saveMessage} data-save-message role="status">{durable.message}</span>}
        {previewStatus === "FAILED" && savedReloadSafe && <button data-reload-saved-preview onClick={reloadSavedComposer}>
          Recharger avec mon brouillon sauvegardé</button>}
      </div></header>
    <div className={styles.columns}><ComposerLibrary model={shown} openToken={libraryOpenToken} busy={busy} selected={selected} choose={stableLibraryChoose} drag={stableLibraryDrag} />
      <ComposerBoard model={shown} busy={busy} selected={selected} focused={focusedContext} focus={setFocusedContext} edit={stableEdit} editContext={stableEditContext} choose={stableChoose} drag={setSelected} drop={stableDrop} request={stableRequest} hover={stableHover}
        add={stableAdd} preview={stablePreview} balance={stableBalance} details={stableDetails} /></div>
    {balanceOpen && (!suggestions || suggestions.candidates.length > 0) && <section className={styles.suggestionHand} data-suggestion-hand aria-label="Pistes pour votre mois"><header><span><Sparkles size={14} /> Quelques façons de retrouver de la marge</span><button className={styles.iconButton} aria-label="Fermer les suggestions" onClick={() => setBalanceOpen(false)}><X size={16} /></button></header>
      {suggestions ? <BalanceLayer suggestions={suggestions} busy={busy} accept={candidateId => void run({ kind: "ACCEPT", candidateSetDigest: suggestions.candidateSetDigest, candidateId })} /> : <p role="status">Le serveur resimule les pistes…</p>}</section>}
    <div ref={dragImage} className={styles.dragPreview} data-drag-preview data-protected={grabbed?.protected} aria-hidden="true">{[...new Set(Object.values(shown.presentation.dragSources).map(s => s.iconKey))].map(key => <span key={key} data-drag-icon={key} style={{ display: grabbed?.iconKey === key ? "inline-flex" : "none" }}><PlannerIcon iconKey={key} scale="SATELLITE" /></span>)}<span><b data-drag-label>{grabbed?.label}</b><small data-drag-amount>{grabbed?.protected ? <><LockKeyhole size={11} /> Protégée</> : money(grabbed?.economicAmount ?? null)}</small></span></div>
    <div className={styles.statusBar} role="status" aria-live="polite">{message}
      {applyReceipt && <span data-apply-receipt data-revision-id={applyReceipt.planRevisionId}> · Preuve de révision {applyReceipt.revisionNumber} ({applyReceipt.headStatus === "ACTIVE" ? "active" : applyReceipt.headStatus === "SUPERSEDED" ? "remplacée" : "état actif à relire"})</span>}
      {pendingApply && <button data-check-apply disabled={busy} onClick={() => void checkApply(pendingApply)}>Vérifier l’application</button>}
      {pendingApply?.checkedAbsent && semanticStateDigest(draftState) === semanticStateDigest(pendingApply.draft)
        && <button data-retry-same-apply disabled={busy || !!draftTransport && (durable.status !== "SAVED" || !durable.online || !!durable.snapshot?.baseStale)}
          onClick={() => void run({ kind: "APPLY", command: pendingApply.command }, "none", pendingApply.draft)}>
          Relancer la même demande sécurisée</button>}
    </div>
    {errorMessage && !editor && <div className={styles.errorNotice} role="alert">{errorMessage}<button className={styles.iconButton} aria-label="Fermer le message" onClick={() => setErrorMessage(null)}><X size={14} /></button></div>}
    <dialog ref={dialog} className={styles.dialog} data-night-editor={!!editor?.nightContextId || !!editor?.familyContextId || !!editor?.stayContextId || undefined} data-side-panel={editor?.side || undefined} data-compact-editor={editor?.compact || undefined} aria-labelledby="composer-dialog-title" onCancel={e => { e.preventDefault(); closeDialog(); }} onKeyDown={e => { if (e.key === "Escape" && editor?.side) { e.preventDefault(); closeDialog(); } }}>
      <header><h2 id="composer-dialog-title">{editor?.title ?? (projectionOpen ? "Le détail de votre mois" : "Des pistes pour votre mois")}</h2><button className={styles.iconButton} disabled={busy} aria-label="Fermer" onClick={closeDialog}><X size={19} /></button></header>
      {errorMessage && <p role="alert" className={styles.formError}>{errorMessage}</p>}
      {editorKind && !loadedEditors[editorKind]
        ? <section className={styles.editorLoading} role={editorLoadError === editorKind ? "alert" : "status"} aria-live="polite" data-editor-loading={editorKind}>
          <p>{editorLoadError === editorKind ? "Le formulaire n’a pas pu être chargé. Votre brouillon et votre carte sont conservés." : "Chargement du formulaire…"}</p>
          {editorLoadError === editorKind && <button type="button" className={styles.secondary} onClick={() => setEditorLoadRetry(value => value + 1)}>Réessayer le chargement</button>}
          {editorLoadError === editorKind && <>
            <p>{editorReloadSafe ? "Votre brouillon est sauvegardé. Vous pouvez recharger Composer, puis rouvrir cette carte."
              : "Gardez cette page ouverte : un rechargement attend la sauvegarde confirmée de votre brouillon."}</p>
            {editorReloadSafe && <button type="button" className={styles.secondary} onClick={reloadSavedComposer}>Recharger Composer avec mon brouillon sauvegardé</button>}
          </>}
        </section>
        : editor?.stayContextId && ShortStayEditor && draftState.contexts.find(context => context.contextOccurrenceId === editor.stayContextId)
        ? <ShortStayEditor key={`${editor.stayContextId}:${editor.familyMode ?? "edit"}`} context={draftState.contexts.find(context => context.contextOccurrenceId === editor.stayContextId)!}
          semanticState={draftState} targetMonth={draftState.targetMonth} householdPersons={model.householdPersons} options={model.mobilityOptions} initialMode={editor.familyMode}
          summary={model.mobilitySummaries?.find(item => item.contextOccurrenceId === editor.stayContextId)} fresh={previewStatus === "FRESH"}
          knowledge={model.cardKnowledge[editor.cardKey ?? ""]} busy={busy} onCancel={closeDialog} onSave={operation => { stage(operation); setEditor(null); }} />
        : editor?.familyContextId && FamilyVisitEditor && draftState.contexts.find(context => context.contextOccurrenceId === editor.familyContextId)
        ? <FamilyVisitEditor key={`${editor.familyContextId}:${editor.familyMode ?? "edit"}`} context={draftState.contexts.find(context => context.contextOccurrenceId === editor.familyContextId)!}
          targetMonth={draftState.targetMonth} householdPersons={model.householdPersons} options={model.mobilityOptions} initialMode={editor.familyMode}
          summary={model.mobilitySummaries?.find(item => item.contextOccurrenceId === editor.familyContextId)} fresh={previewStatus === "FRESH"}
          knowledge={model.cardKnowledge[editor.cardKey ?? ""]} busy={busy} onCancel={closeDialog} onSave={operation => { stage(operation); setEditor(null); }} />
        : editor?.nightContextId && draftState.contexts.find(context => context.contextOccurrenceId === editor.nightContextId)
        ? <NightOutEditor key={editor.nightContextId} context={draftState.contexts.find(context => context.contextOccurrenceId === editor.nightContextId)!}
          semanticState={draftState} householdPersons={model.householdPersons} knowledge={model.cardKnowledge[editor.cardKey ?? ""]}
          busy={busy} onCancel={closeDialog} onSave={operation => { stage(operation); setEditor(null); }} />
        : editor?.giftContextId && GiftEditor && draftState.contexts.find(context => context.contextOccurrenceId === editor.giftContextId)
        ? <GiftEditor key={editor.giftContextId} context={draftState.contexts.find(context => context.contextOccurrenceId === editor.giftContextId)!}
          householdPersons={model.householdPersons} knowledge={model.cardKnowledge[editor.cardKey ?? ""]}
          busy={busy} onCancel={closeDialog} onSave={operation => { stage(operation); setEditor(null); }} />
        : editor?.catalogContextId && CatalogContextEditor && draftState.contexts.find(context => context.contextOccurrenceId === editor.catalogContextId)
        ? <CatalogContextEditor key={editor.catalogContextId} context={draftState.contexts.find(context => context.contextOccurrenceId === editor.catalogContextId)!}
          editor={{ assetKey: editor.cardKey ?? "", fields: editor.fields }} targetMonth={draftState.targetMonth} householdPersons={model.householdPersons}
          options={model.mobilityOptions} knowledge={model.cardKnowledge[editor.cardKey ?? ""]} busy={busy} onCancel={closeDialog}
          onSave={operation => { stage(operation); setEditor(null); }} />
        : editor ? <form onSubmit={e => { e.preventDefault(); const values = Object.fromEntries(new FormData(e.currentTarget).entries()) as Record<string, string>; stage(editor.operation(values)); setEditor(null); }}>
        {editor.cardKey &&
          <CardKnowledgePanel knowledge={model.cardKnowledge[editor.cardKey]} onPrefill={(field, value) => {
            const input = dialog.current?.querySelector<HTMLInputElement>(`input[name="${field}"]`);
            if (input) { input.value = value; input.focus(); }
          }} />}
        {editor.cardKey?.startsWith("control:savings:") ? <p className={styles.helper} data-savings-editor-origin>
          Réservation {model.board.savings.find(card => `control:${card.targetRef}` === editor.cardKey)?.value.reservationSource === "ANNUAL_PLAN" ? "issue d’un objectif annuel" : "déclarée pour le mois"}.
          Le montant choisi modifie seulement ce scénario ; aucun mouvement bancaire n’est créé. La projection sera recalculée par Finance V2.
        </p> : <p className={styles.helper}>Une valeur vide reste inconnue. Une date absente reste à préciser.</p>}
        <div className={styles.formFields}>{editor.fields.map(f => <label key={f.key}>{f.label}{f.kind === "CHOICE" ? <select name={f.key} defaultValue={editor.values[f.key] ?? f.choices?.[0]?.value ?? ""} required={f.required}>{[...(f.choices ?? []), ...(f.key === "funding" && editor.values.funding === "EXISTING" ? [{ value: "EXISTING", label: "Conserver le financement antérieur (lecture seule)" }] : [])].map(c => <option value={c.value} key={c.value}>{c.label}</option>)}</select>
          : <input name={f.key} defaultValue={editor.values[f.key] ?? f.initial ?? ""} type={f.kind === "DATE" ? "date" : "text"} inputMode={f.kind === "AMOUNT" ? "decimal" : undefined} required={f.required} autoComplete="off" />}</label>)}</div>
        <footer><button type="button" className={styles.secondary} disabled={busy} onClick={closeDialog}>Retour au mois</button><button data-submit className={styles.primary} disabled={busy}>Prévisualiser ce choix</button></footer>
      </form> : projectionOpen ? <ComposerProjectionDetails projection={model.board.cockpit} /> : null}
    </dialog>
    <dialog ref={confirmationDialog} className={styles.dialog} data-compact-editor aria-labelledby="draft-confirmation-title"
      onCancel={e => { e.preventDefault(); if (!draftConfirmationBusy) setDraftConfirmation(null); }}>
      <header><h2 id="draft-confirmation-title">{draftConfirmation?.kind === "ABANDON" ? "Abandonner mes essais" : draftConfirmation?.kind === "RESTART" ? "Repartir du Plan actif" : draftConfirmation?.kind === "RESTORE" ? "Restaurer ce brouillon" : "Charger la version sauvegardée"}</h2></header>
      <p className={styles.helper}>{draftConfirmation?.kind === "LOAD_SERVER"
        ? "Les modifications locales non enregistrées seront perdues. La version sauvegardée sera relue."
        : draftConfirmation?.kind === "RESTORE"
          ? "Cette archive redeviendra le brouillon actif. Aucun autre brouillon actif ne sera écrasé."
          : "Le brouillon actif sera archivé et restera récupérable. Aucun Plan officiel ne sera appliqué."}</p>
      {draftConfirmation?.kind !== "LOAD_SERVER" && draftConfirmation?.kind !== "RESTORE" && durable.unsaved &&
        <p className={styles.formError}>Les modifications locales non enregistrées seront perdues.</p>}
      <footer><button type="button" className={styles.secondary} disabled={draftConfirmationBusy} onClick={() => setDraftConfirmation(null)}>Annuler</button>
        <button type="button" className={styles.primary} data-confirm-draft-action disabled={draftConfirmationBusy || !durable.online || durable.status === "SAVING"}
          onClick={() => void confirmDraftAction()}>{draftConfirmationBusy ? "Vérification…" : "Confirmer"}</button></footer>
    </dialog>
  </div></ComposerInteractionContext.Provider>;
}
