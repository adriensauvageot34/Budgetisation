"use client";
import { useState, useRef, useEffect, type DragEvent } from "react";
import { ArrowLeft, ArrowLeftRight, Undo2, Redo2, X, Sparkles, MoreHorizontal, LockKeyhole } from "lucide-react";
import type { ComposerUiModel, ComposerTransport, ComposerRequest, ComposerOperation, ComposerField, ComposerDragSource } from "@/domain/phase2/planner/composer-ui-contract";
import type { ComposerAssetView, ComposerCardView, ComposerContextCardView, DropTarget } from "@/domain/phase2/planner/composer-contract";
import type { ComponentSelectionV1 } from "@/domain/phase2/planner/component-contract";
import type { PlanSemanticStateV1 } from "@/domain/phase2/planner/semantic-state";
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

type Editor = { title: string; compact?: boolean; fields: readonly ComposerField[]; values: Record<string, string>; operation: (values: Record<string, string>) => ComposerOperation };
export function ComposerShell({ initialModel, transport }: { initialModel: ComposerUiModel; transport: ComposerTransport }) {
  const [model, setModel] = useState(initialModel), current = useRef(initialModel);
  const [busy, setBusy] = useState(false), busyRef = useRef(false);
  const [selected, setSelected] = useState<string | null>(null), [message, setMessage] = useState("");
  const [focusedContext, setFocusedContext] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [past, setPast] = useState<PlanSemanticStateV1[]>([]), [future, setFuture] = useState<PlanSemanticStateV1[]>([]);
  const [editor, setEditor] = useState<Editor | null>(null), [balanceOpen, setBalanceOpen] = useState(false), [suggestions, setSuggestions] = useState<PlanBalanceSuggestions | null>(null);
  const [projectionOpen, setProjectionOpen] = useState(false), [libraryOpenToken, setLibraryOpenToken] = useState(0);
  const [hoverModel, setHoverModel] = useState<ComposerUiModel | null>(null), gate = useRef(new ComposerResponseGate()), timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dialog = useRef<HTMLDialogElement>(null), invoker = useRef<HTMLElement | null>(null);
  const applyAttempt = useRef<{ key: string; applyRequestId: string } | null>(null);
  const [comparison, setComparison] = useState<ComparisonSnapshot | null>(null);
  const [completenessFocus, setCompletenessFocus] = useState(false);
  const [grabbed, setGrabbed] = useState<ComposerDragSource | null>(null), grab = useRef<ComposerDragSource | null>(null);
  const [overTarget, setOverTarget] = useState<DropTarget | null>(null), overRef = useRef<DropTarget | null>(null);
  const dragIdentity = useRef({ identity: "", selectionId: "" }), dragImage = useRef<HTMLDivElement>(null);
  const assistantGrab = useRef<{ targetRef: string; operation: ComposerOperation } | null>(null);
  const assistantOver = useRef<string | null>(null);
  const [hoverPending, setHoverPending] = useState(false), [interactionImpact, setInteractionImpact] = useState<string | null>(null);
  const [motion, setMotion] = useState<"snap" | "undo" | "redo" | "recoil" | null>(null), [motionTarget, setMotionTarget] = useState<string | null>(null);
  const motionTimer = useRef<ReturnType<typeof setTimeout> | null>(null), nextMotionTarget = useRef<string | null>(null);
  const install = (next: ComposerUiModel) => { current.current = next; setModel(next); };
  const clearHover = () => { if (timer.current) clearTimeout(timer.current); if (!busyRef.current) gate.current.invalidate(); setHoverModel(null); setHoverPending(false); setInteractionImpact(null); };
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); if (motionTimer.current) clearTimeout(motionTimer.current); gate.current.invalidate(); }, []);
  useEffect(() => {
    const historyKey = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== "z" || event.altKey || busyRef.current || event.target instanceof Element && event.target.closest("input,textarea,select,[contenteditable=true],dialog[open]")) return;
      event.preventDefault();
      if (event.shiftKey && future.length) void run({ kind: "READ" }, "redo", future.at(-1));
      else if (!event.shiftKey && past.length) void run({ kind: "READ" }, "undo", past.at(-1));
    };
    window.addEventListener("keydown", historyKey); return () => window.removeEventListener("keydown", historyKey);
  }, [past, future]);
  useEffect(() => {
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") { setCompletenessFocus(false);
      if (!document.querySelector("[popover]:popover-open,dialog[open]")) setFocusedContext(null); endDrag(); } };
    window.addEventListener("keydown", escape); return () => window.removeEventListener("keydown", escape);
  }, []);
  useEffect(() => {
    if (!model.board.draft.dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); };
    window.addEventListener("beforeunload", warn); return () => window.removeEventListener("beforeunload", warn);
  }, [model.board.draft.dirty]);
  useEffect(() => {
    if (editor || projectionOpen) { invoker.current = document.activeElement as HTMLElement; dialog.current?.showModal(); }
    else { dialog.current?.close(); invoker.current?.focus(); }
  }, [!!editor, projectionOpen]);
  async function run(operation: ComposerOperation, history: "push" | "undo" | "redo" | "none" = "push", draft?: PlanSemanticStateV1) {
    if (busyRef.current) return;
    clearHover(); busyRef.current = true; setBusy(true); setSuggestions(null); setErrorMessage(null);
    const before = current.current, ticket = gate.current.next(before.board.draft.semanticStateDigest);
    try {
      const response = await transport({ ...operation, sequence: ticket.sequence, targetMonth: before.semanticState.targetMonth, draft: draft ?? before.semanticState } as ComposerRequest);
      if (!gate.current.accepts(ticket, response.sequence, current.current.board.draft.semanticStateDigest)) return;
      if (!response.ok) { setMessage(response.message); setErrorMessage(response.message); return; }
      const changed = before.board.draft.semanticStateDigest !== response.model.board.draft.semanticStateDigest;
      if (response.applied) { applyAttempt.current = null; setPast([]); setFuture([]); setMessage(`Revision ${response.model.activeRevisionNumber} appliquée. Le mois a été relu avec le même scénario.`); }
      else {
        if (changed && history === "push") { setPast(p => [...p, before.semanticState]); setFuture([]); }
        else if (history === "undo") { setPast(p => p.slice(0, -1)); setFuture(f => [...f, before.semanticState]); }
        else if (history === "redo") { setFuture(f => f.slice(0, -1)); setPast(p => [...p, before.semanticState]); }
        setMessage(response.mutationKind === "CANCEL_CONTEXT" ? "Context retiré du brouillon. Son annulation sera conservée à l’application." : changed ? "Brouillon mis à jour et prévisualisé." : "Prévisualisation à jour.");
      }
      install(response.model); setSuggestions(response.suggestions ?? null); setEditor(null); setSelected(null);
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
    } catch { const message = "Connexion interrompue. Votre brouillon est conservé ; rechargez la prévisualisation avant de réessayer."; setMessage(message); setErrorMessage(message); }
    finally { busyRef.current = false; setBusy(false); }
  }
  function hover(mutation: SemanticMutation | null) {
    previewGesture(mutation ? { kind: "MUTATE", mutation } : null);
  }
  function previewGesture(operation: ComposerOperation | null) {
    clearHover();
    if (!operation || operation.kind === "APPLY" || busyRef.current || editor || projectionOpen) return;
    const before = current.current, ticket = gate.current.next(before.board.draft.semanticStateDigest);
    setHoverPending(true);
    timer.current = setTimeout(async () => {
      try {
        const response = await transport({ ...operation, sequence: ticket.sequence, targetMonth: before.semanticState.targetMonth, draft: before.semanticState } as ComposerRequest);
        if (gate.current.accepts(ticket, response.sequence, current.current.board.draft.semanticStateDigest)) {
          setHoverPending(false); if (response.ok) { setHoverModel(response.model); setInteractionImpact(response.interactionImpact ?? null); }
        }
      } catch { if (gate.current.accepts(ticket, ticket.sequence, current.current.board.draft.semanticStateDigest)) setHoverPending(false); }
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
    const source = candidate ? { sourceKey: key, assetKey: key, label: candidate.label, iconKey: model.presentation.objects[candidate.targetRef]?.iconKey ?? "activity", economicAmount: candidate.impactOnMonthEnd, protected: false }
      : model.presentation.dragSources[key];
    if (!source) { event.preventDefault(); return; }
    assistantGrab.current = candidate && suggestions ? { targetRef: candidate.targetRef, operation: { kind: "ACCEPT", candidateId: candidate.candidateId, candidateSetDigest: suggestions.candidateSetDigest } } : null;
    grab.current = source; setGrabbed(source); setSelected(source.assetKey);
    dragIdentity.current = { identity: crypto.randomUUID(), selectionId: crypto.randomUUID() };
    event.dataTransfer.setData("application/x-planner-asset", key); event.dataTransfer.effectAllowed = "move";
    // Populate the native cursor-following image synchronously, before dragstart ends.
    if (dragImage.current) {
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
    if (!publishedDrop(current.current, source.assetKey, target)) return null;
    return preparedDrop(source, target, dragIdentity.current.identity, dragIdentity.current.selectionId);
  }
  function over(target: DropTarget | null) {
    if (target && sameTarget(overRef.current, target)) return;
    overRef.current = target; setOverTarget(target);
    previewGesture(target ? dragOperation(target) : null);
  }
  function place(target: DropTarget) {
    const source = grab.current;
    if (source?.editorTargetRef && source.editorDropTarget && sameTarget(source.editorDropTarget, target)) {
      const asset = model.library.searchableAssets.find(a => a.assetKey === source.assetKey); endDrag(); if (asset) choose(asset); return;
    }
    const operation = dragOperation(target);
    if (!operation) { if (grab.current?.protected) animate("recoil", grab.current.sourceKey); endDrag(); return; }
    nextMotionTarget.current = target.contextOccurrenceId ?? (operation.kind === "DROP" ? operation.identity : null);
    endDrag(); void run(operation);
  }
  function equip(assetKey: string, target: DropTarget) {
    const source = model.presentation.dragSources[assetKey];
    if (!source || !publishedDrop(model, source.assetKey, target)) return;
    nextMotionTarget.current = target.contextOccurrenceId ?? null;
    void run(preparedDrop(source, target, crypto.randomUUID(), crypto.randomUUID()));
  }
  function compare(keep?: boolean) {
    if (busyRef.current) return;
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
  function choose(asset: ComposerAssetView, target: DropTarget = { kind: "BOARD_ZONE" }, selection?: ComponentSelectionV1) {
    clearHover();
    if (["PLAN_CONTROL", "RESERVATION_CONTROL"].includes(asset.kind)) {
      const card = [...model.board.baselineControls, ...model.board.discretionaryControls, ...model.board.savings].find(c => c.targetRef === asset.capabilityRef);
      if (card) setFocusedContext(card.targetRef);
      if (card?.capability?.actions.length && card.capability.flexibility !== "LOCKED") edit(card);
      return;
    }
    const capability = model.dropCapabilities.find(d => d.sourceAssetKey === asset.assetKey && d.target.kind === target.kind && d.target.contextOccurrenceId === target.contextOccurrenceId && d.target.slotKey === target.slotKey);
    if (!capability || capability.resolution === "BLOCKED") { setSelected(asset.assetKey); setMessage(`Carte ${asset.label} sélectionnée. Choisissez un emplacement compatible sur le mois.`); return; }
    const values: Record<string, string> = {};
    if (selection?.kind === "COMPONENT") Object.assign(values, { label: selection.label, quantity: selection.quantity, amount: selection.cost.kind === "MANUAL" ? selection.cost.unitAmount : "", funding: selection.fundingAllocations?.[0]?.source ?? "", fundingAmount: selection.fundingAllocations?.[0]?.amount ?? "", binding: selection.binding?.mode ?? "AUTO", needOccurrenceId: selection.needOccurrenceId ?? "" });
    if (selection?.kind === "MOBILITY_INTENT") Object.assign(values, { origin: selection.origin?.kind === "TEXT" ? selection.origin.label : "", destination: selection.destination?.kind === "TEXT" ? selection.destination.label : "", amount: selection.pricing?.fare.kind === "MANUAL" ? selection.pricing.fare.unitAmount : "", funding: selection.pricing?.fundingAllocations[0]?.source ?? "", fundingAmount: selection.pricing?.fundingAllocations[0]?.amount ?? "", returnRequired: String(selection.returnRequired === true), targetIntentId: selection.journey?.targetIntentId ?? "", plannedTime: selection.plannedTime ?? "", returnTime: selection.returnTime ?? "", preference: selection.pricing?.preference ?? "FASTEST", parkingMode: selection.pricing?.parking.kind === "MANUAL" ? selection.pricing.parking.unitAmount === "0" || selection.pricing.parking.unitAmount === "0.00" ? "NO" : "YES" : "UNKNOWN", parkingAmount: selection.pricing?.parking.kind === "MANUAL" ? selection.pricing.parking.unitAmount : "" });
    const identity = crypto.randomUUID(), selectionId = selection?.selectionId ?? crypto.randomUUID();
    prepareDialogFocus();
    setEditor({ title: selection ? `Modifier ${asset.label}` : `Composer ${asset.label}`, fields: model.editors.find(e => e.assetKey === asset.assetKey)?.fields ?? [], values,
      operation: values => ({ kind: "DROP", assetKey: asset.assetKey, target, values, identity, selectionId }) });
  }
  function drop(target: DropTarget, key = selected ?? "") {
    clearHover();
    if (!key || busyRef.current) return;
    const asset = model.library.searchableAssets.find(a => a.assetKey === key);
    if (asset && target.kind !== "TRASH") { choose(asset, target); return; }
    void run({ kind: "DROP", assetKey: key, target, values: {}, identity: crypto.randomUUID(), selectionId: crypto.randomUUID() });
  }
  function edit(card: ComposerCardView) {
    clearHover();
    if (!card.capability?.actions.length || card.capability.flexibility === "LOCKED") return;
    prepareDialogFocus();
    setEditor({ title: `Ajuster ${card.label}`, compact: card.kind === "SAVINGS", fields: model.controlEditors.find(e => e.targetRef === card.targetRef)?.fields ?? [],
      values: Object.fromEntries(["amount", "count", "unitAmount"].map(key => [key, typeof card.value[key] === "string" ? card.value[key] as string : ""])),
      operation: values => ({ kind: "MUTATE", mutation: { kind: "SET_STATE", targetRef: card.targetRef, value: Object.fromEntries(model.controlEditors.find(e => e.targetRef === card.targetRef)!.fields.map(f => [f.key, values[f.key]])) } }) });
  }
  const closeDialog = () => { if (!busyRef.current) { setEditor(null); setProjectionOpen(false); setErrorMessage(null); } };
  function editContext(card: ComposerContextCardView) {
    clearHover();
    prepareDialogFocus();
    setEditor({ title: `Modifier ${card.label}`, fields: model.editors.find(e => e.assetKey === `template:${card.templateKey}`)?.fields ?? [],
      values: Object.fromEntries(Object.entries(card.fields).filter((entry): entry is [string, string] => typeof entry[1] === "string")),
      operation: values => ({ kind: "EDIT_CONTEXT", contextOccurrenceId: card.contextOccurrenceId, values }) });
  }
  function apply() {
    if (comparison || grab.current) return;
    const key = `${model.board.draft.semanticStateDigest}:${model.proof.expectedPreviewDigest}:${model.proof.expectedActiveRevisionId}`;
    if (applyAttempt.current?.key !== key) applyAttempt.current = { key, applyRequestId: crypto.randomUUID() };
    void run({ kind: "APPLY", command: { ...model.proof, applyRequestId: applyAttempt.current.applyRequestId } }, "none");
  }
  const applyDisabled = busy || !!hoverModel || !!grabbed || !model.board.draft.dirty || model.board.cockpit.applyReadiness === "BLOCKED";
  const applyReason = busy ? "La prévisualisation serveur est en cours." : hoverModel || grabbed ? "Terminez le geste pour appliquer le mois."
    : !model.board.draft.dirty ? model.activeRevisionNumber ? "Le mois est déjà appliqué. Modifiez un élément pour créer une nouvelle révision." : `Composez un premier choix pour appliquer votre mois.${model.presentation.unresolvedCount ? ` ${model.presentation.unresolvedCount} éléments à préciser.` : ""}`
    : model.presentation.unresolvedCount ? `${model.presentation.unresolvedCount} éléments restent à préciser avant l’application.`
    : "Les contraintes signalées doivent être précisées avant l’application.";
  return <ComposerInteractionContext.Provider value={{ grabbed, overTarget, motion, motionTarget, completenessFocus, unresolvedRefs: model.presentation.unresolvedRefs,
    start: startDrag, end: endDrag, over, place, equip,
    canTarget: ref => assistantGrab.current?.targetRef === ref, reject: () => animate("recoil", grab.current?.sourceKey ?? null),
    overAssistant: ref => { if (ref === assistantOver.current) return; assistantOver.current = ref; previewGesture(ref && assistantGrab.current?.targetRef === ref ? assistantGrab.current.operation : null); },
    placeAssistant: ref => { if (assistantGrab.current?.targetRef !== ref) return; const operation = assistantGrab.current.operation; nextMotionTarget.current = ref; endDrag(); void run(operation); } }}>
  <div className={styles.workspace} data-composer data-digest={model.board.draft.semanticStateDigest} data-dragging={!!grabbed} data-comparing={!!comparison} data-motion={motion} data-revision={model.activeRevisionNumber} aria-busy={busy}
    onDragOverCapture={e => { if (grab.current && e.target instanceof Element && !e.target.closest("[data-board-drop],[data-trash]")) { over(null); if (assistantOver.current) { assistantOver.current = null; clearHover(); } } }}>
    <header className={styles.workspaceHeader}><div className={styles.headerIdentity}><a href={`/mois-a-venir?month=${model.semanticState.targetMonth}&control=center`} className={styles.backLink}><ArrowLeft size={14} /> Centre de contrôle</a>
      <h1>Composer <span>{monthLabel(model.semanticState.targetMonth)}</span></h1><div className={styles.headerMeta}>{comparison && <span className={styles.variantMarker} data-variant-marker>VARIANTE</span>}<span className={styles.draftStatus} data-draft-status>{!model.activeRevisionNumber ? "Brouillon" : model.board.draft.dirty ? "Nouvelle modification" : `Appliqué · révision ${model.activeRevisionNumber}`}</span>
        <span data-object-count>{model.presentation.elementCount} éléments · <button className={styles.completenessToggle} data-completeness-toggle aria-pressed={completenessFocus} disabled={!model.presentation.unresolvedCount} onClick={() => setCompletenessFocus(v => !v)}>{model.presentation.unresolvedCount} à préciser</button></span>
        {model.board.cockpit.projectionCompleteness === "COMPLETE" && model.board.cockpit.applyReadiness === "READY" && <span data-plan-ready>Plan prêt ✓</span>}</div></div>
      <div className={styles.hudContainer} data-compare-header>{comparison && <div className={styles.compareCurrent}><span>Plan actuel</span><strong>{money(comparison.model.board.cockpit.plan.economicMonthEndRemainder)}</strong></div>}
      <ComposerCockpit projection={(hoverModel ?? model).board.cockpit} goalMargin={(hoverModel ?? model).presentation.goalMargin} temporary={!!hoverModel} pending={hoverPending}
        canonicalRemainder={model.board.cockpit.plan.economicMonthEndRemainder} interactionImpact={interactionImpact} variant={!!comparison} details={() => { clearHover(); setProjectionOpen(true); }} /></div>
      <div className={styles.toolbar}><div className={styles.historyTools}>
        <button className={styles.historyButton} title="Annuler (Ctrl/Cmd+Z)" aria-label="Annuler la dernière modification du brouillon" disabled={busy || !past.length} onClick={() => void run({ kind: "READ" }, "undo", past.at(-1))}><Undo2 size={17} /></button>
        <button className={styles.historyButton} title="Rétablir (Ctrl/Cmd+Shift+Z)" aria-label="Rétablir la modification du brouillon" disabled={busy || !future.length} onClick={() => void run({ kind: "READ" }, "redo", future.at(-1))}><Redo2 size={17} /></button></div>
        {comparison ? <div className={styles.compareActions}><button data-compare-keep className={styles.secondary} disabled={busy} onClick={() => compare(true)}>Garder cette variante</button><button data-compare-exit className={styles.textButton} disabled={busy} onClick={() => compare(false)}>Quitter la comparaison</button></div>
          : <><button data-compare className={styles.compareButton} disabled={busy} onClick={() => compare()}><ArrowLeftRight size={14} /> Comparer</button>
            <div className={styles.applyControl} tabIndex={applyDisabled ? 0 : undefined} aria-label={applyDisabled ? applyReason : undefined} data-apply-control>
              <button className={styles.primary} data-apply disabled={applyDisabled} aria-describedby={applyDisabled ? "apply-disabled-reason" : undefined} onClick={apply}>{busy ? "Validation…" : "Appliquer mon mois"}</button>
              {applyDisabled && <div className={styles.applyReason} role="group" aria-label="Application indisponible" data-apply-reason><p id="apply-disabled-reason">{applyReason}</p>
                {!!model.presentation.unresolvedCount && <button data-show-unresolved onClick={() => setCompletenessFocus(true)}>Afficher les éléments</button>}</div>}
            </div></>}
        <AtomicPopover utility label="Autres actions du mois" state="ACTIONS" focus={() => {}} icon={<MoreHorizontal size={17} />}>{close => <div className={styles.popoverActions}>
          <button data-preview disabled={busy} onClick={() => { close(); void run({ kind: "READ" }, "none"); }}>Actualiser la prévisualisation</button>
          <button data-balance disabled={busy} onClick={() => { close(); clearHover(); setBalanceOpen(v => !v); if (!balanceOpen) void run({ kind: "SUGGESTIONS" }, "none"); }}>Suggestions pour mon mois</button>
          <button data-financial-menu onClick={() => { close(); clearHover(); setProjectionOpen(true); }}>Détail financier</button></div>}</AtomicPopover>
      </div></header>
    <div className={styles.columns}><ComposerLibrary model={model} openToken={libraryOpenToken} busy={busy} selected={selected} choose={asset => choose(asset)} drag={key => { clearHover(); setSelected(key); }} />
      <ComposerBoard model={model} busy={busy} selected={selected} focused={focusedContext} focus={setFocusedContext} edit={edit} editContext={editContext} choose={choose} drag={setSelected} drop={drop} request={operation => void run(operation)} hover={hover}
        add={() => { clearHover(); setLibraryOpenToken(n => n + 1); }} preview={() => void run({ kind: "READ" }, "none")}
        balance={() => { clearHover(); setBalanceOpen(v => !v); if (!balanceOpen) void run({ kind: "SUGGESTIONS" }, "none"); }} details={() => { clearHover(); setProjectionOpen(true); }} /></div>
    {balanceOpen && (!suggestions || suggestions.candidates.length > 0) && <section className={styles.suggestionHand} data-suggestion-hand aria-label="Pistes pour votre mois"><header><span><Sparkles size={14} /> Quelques façons de retrouver de la marge</span><button className={styles.iconButton} aria-label="Fermer les suggestions" onClick={() => setBalanceOpen(false)}><X size={16} /></button></header>
      {suggestions ? <BalanceLayer suggestions={suggestions} busy={busy} accept={candidateId => void run({ kind: "ACCEPT", candidateSetDigest: suggestions.candidateSetDigest, candidateId })} /> : <p role="status">Le serveur resimule les pistes…</p>}</section>}
    <div ref={dragImage} className={styles.dragPreview} data-drag-preview data-protected={grabbed?.protected} aria-hidden="true">{[...new Set(Object.values(model.presentation.dragSources).map(s => s.iconKey))].map(key => <span key={key} data-drag-icon={key} style={{ display: grabbed?.iconKey === key ? "inline-flex" : "none" }}><PlannerIcon iconKey={key} scale="SATELLITE" /></span>)}<span><b data-drag-label>{grabbed?.label}</b><small data-drag-amount>{grabbed?.protected ? <><LockKeyhole size={11} /> Protégée</> : money(grabbed?.economicAmount ?? null)}</small></span></div>
    <div className={styles.statusBar} role="status" aria-live="polite">{message}</div>
    {errorMessage && !editor && <div className={styles.errorNotice} role="alert">{errorMessage}<button className={styles.iconButton} aria-label="Fermer le message" onClick={() => setErrorMessage(null)}><X size={14} /></button></div>}
    <dialog ref={dialog} className={styles.dialog} data-compact-editor={editor?.compact || undefined} aria-labelledby="composer-dialog-title" onCancel={e => { e.preventDefault(); closeDialog(); }}>
      <header><h2 id="composer-dialog-title">{editor?.title ?? (projectionOpen ? "Le détail de votre mois" : "Des pistes pour votre mois")}</h2><button className={styles.iconButton} disabled={busy} aria-label="Fermer" onClick={closeDialog}><X size={19} /></button></header>
      {errorMessage && <p role="alert" className={styles.formError}>{errorMessage}</p>}
      {editor ? <form onSubmit={e => { e.preventDefault(); const values = Object.fromEntries(new FormData(e.currentTarget).entries()) as Record<string, string>; void run(editor.operation(values)); }}>
        <p className={styles.helper}>Une valeur vide reste inconnue. Une date absente reste à préciser.</p>
        <div className={styles.formFields}>{editor.fields.map(f => <label key={f.key}>{f.label}{f.kind === "CHOICE" ? <select name={f.key} defaultValue={editor.values[f.key] ?? f.choices?.[0]?.value ?? ""} required={f.required}>{f.choices?.map(c => <option value={c.value} key={c.value}>{c.label}</option>)}</select>
          : <input name={f.key} defaultValue={editor.values[f.key] ?? f.initial ?? ""} type={f.kind === "DATE" ? "date" : "text"} inputMode={f.kind === "AMOUNT" ? "decimal" : undefined} required={f.required} autoComplete="off" />}</label>)}</div>
        <footer><button type="button" className={styles.secondary} disabled={busy} onClick={closeDialog}>Retour au mois</button><button data-submit className={styles.primary} disabled={busy}>Prévisualiser ce choix</button></footer>
      </form> : projectionOpen ? <ComposerProjectionDetails projection={model.board.cockpit} /> : null}
    </dialog>
  </div></ComposerInteractionContext.Provider>;
}
