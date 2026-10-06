"use client";
import { useState, useRef, useEffect } from "react";
import { ArrowLeft, Undo2, Redo2, X, Sparkles } from "lucide-react";
import type { ComposerUiModel, ComposerTransport, ComposerRequest, ComposerOperation, ComposerField } from "@/domain/phase2/planner/composer-ui-contract";
import type { ComposerAssetView, ComposerCardView, ComposerContextCardView, DropTarget } from "@/domain/phase2/planner/composer-contract";
import type { ComponentSelectionV1 } from "@/domain/phase2/planner/component-contract";
import type { PlanSemanticStateV1 } from "@/domain/phase2/planner/semantic-state";
import type { SemanticMutation, PlanBalanceSuggestions } from "@/domain/phase2/planner/adjustment-contract";
import { ComposerLibrary } from "./composer-library";
import { ComposerBoard } from "./composer-board";
import { ComposerCockpit } from "./composer-cockpit";
import { BalanceLayer } from "./balance-layer";
import { ComposerResponseGate } from "./draft-controller";
import { monthLabel } from "./display";
import styles from "./composer.module.css";

type Editor = { title: string; fields: readonly ComposerField[]; values: Record<string, string>; operation: (values: Record<string, string>) => ComposerOperation };
export function ComposerShell({ initialModel, transport }: { initialModel: ComposerUiModel; transport: ComposerTransport }) {
  const [model, setModel] = useState(initialModel), current = useRef(initialModel);
  const [busy, setBusy] = useState(false), busyRef = useRef(false);
  const [selected, setSelected] = useState<string | null>(null), [message, setMessage] = useState("Votre brouillon est prêt à composer.");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [past, setPast] = useState<PlanSemanticStateV1[]>([]), [future, setFuture] = useState<PlanSemanticStateV1[]>([]);
  const [editor, setEditor] = useState<Editor | null>(null), [balanceOpen, setBalanceOpen] = useState(false), [suggestions, setSuggestions] = useState<PlanBalanceSuggestions | null>(null);
  const [hoverModel, setHoverModel] = useState<ComposerUiModel | null>(null), gate = useRef(new ComposerResponseGate()), timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dialog = useRef<HTMLDialogElement>(null), invoker = useRef<HTMLElement | null>(null);
  const applyAttempt = useRef<{ key: string; applyRequestId: string } | null>(null);
  const install = (next: ComposerUiModel) => { current.current = next; setModel(next); };
  const clearHover = () => { if (timer.current) clearTimeout(timer.current); if (!busyRef.current) gate.current.invalidate(); setHoverModel(null); };
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); gate.current.invalidate(); }, []);
  useEffect(() => {
    if (!model.board.draft.dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); };
    window.addEventListener("beforeunload", warn); return () => window.removeEventListener("beforeunload", warn);
  }, [model.board.draft.dirty]);
  useEffect(() => {
    if (editor || balanceOpen) { invoker.current = document.activeElement as HTMLElement; dialog.current?.showModal(); }
    else { dialog.current?.close(); invoker.current?.focus(); }
  }, [!!editor, balanceOpen]);
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
    } catch { const message = "Connexion interrompue. Votre brouillon est conservé ; rechargez la prévisualisation avant de réessayer."; setMessage(message); setErrorMessage(message); }
    finally { busyRef.current = false; setBusy(false); }
  }
  function hover(mutation: SemanticMutation | null) {
    clearHover();
    if (!mutation || busyRef.current || editor || balanceOpen) return;
    const before = current.current, ticket = gate.current.next(before.board.draft.semanticStateDigest);
    timer.current = setTimeout(async () => {
      try {
        const response = await transport({ kind: "MUTATE", mutation, sequence: ticket.sequence, targetMonth: before.semanticState.targetMonth, draft: before.semanticState });
        if (response.ok && gate.current.accepts(ticket, response.sequence, current.current.board.draft.semanticStateDigest)) setHoverModel(response.model);
      } catch { /* Transient hover failures do not replace the accepted draft. */ }
    }, 200);
  }
  function choose(asset: ComposerAssetView, target: DropTarget = { kind: "BOARD_ZONE" }, selection?: ComponentSelectionV1) {
    clearHover();
    if (["PLAN_CONTROL", "RESERVATION_CONTROL"].includes(asset.kind)) {
      const card = [...model.board.baselineControls, ...model.board.discretionaryControls, ...model.board.savings].find(c => c.targetRef === asset.capabilityRef);
      if (card) document.querySelector<HTMLElement>(`[data-control="${CSS.escape(card.targetRef)}"]`)?.scrollIntoView({ block: "center", behavior: "smooth" });
      if (card?.capability?.actions.length && card.capability.flexibility !== "LOCKED") edit(card);
      return;
    }
    const capability = model.dropCapabilities.find(d => d.sourceAssetKey === asset.assetKey && d.target.kind === target.kind && d.target.contextOccurrenceId === target.contextOccurrenceId && d.target.slotKey === target.slotKey);
    if (!capability || capability.resolution === "BLOCKED") { setSelected(asset.assetKey); setMessage(`Carte ${asset.label} sélectionnée. Choisissez un emplacement compatible sur le mois.`); return; }
    const values: Record<string, string> = {};
    if (selection?.kind === "COMPONENT") Object.assign(values, { label: selection.label, quantity: selection.quantity, amount: selection.cost.kind === "MANUAL" ? selection.cost.unitAmount : "", funding: selection.fundingAllocations?.[0]?.source ?? "", fundingAmount: selection.fundingAllocations?.[0]?.amount ?? "", binding: selection.binding?.mode ?? "AUTO", needOccurrenceId: selection.needOccurrenceId ?? "" });
    if (selection?.kind === "MOBILITY_INTENT") Object.assign(values, { origin: selection.origin?.kind === "TEXT" ? selection.origin.label : "", destination: selection.destination?.kind === "TEXT" ? selection.destination.label : "", amount: selection.pricing?.fare.kind === "MANUAL" ? selection.pricing.fare.unitAmount : "", funding: selection.pricing?.fundingAllocations[0]?.source ?? "", fundingAmount: selection.pricing?.fundingAllocations[0]?.amount ?? "", returnRequired: String(selection.returnRequired === true), targetIntentId: selection.journey?.targetIntentId ?? "", plannedTime: selection.plannedTime ?? "", returnTime: selection.returnTime ?? "", preference: selection.pricing?.preference ?? "FASTEST", parkingMode: selection.pricing?.parking.kind === "MANUAL" ? selection.pricing.parking.unitAmount === "0" || selection.pricing.parking.unitAmount === "0.00" ? "NO" : "YES" : "UNKNOWN", parkingAmount: selection.pricing?.parking.kind === "MANUAL" ? selection.pricing.parking.unitAmount : "" });
    const identity = crypto.randomUUID(), selectionId = selection?.selectionId ?? crypto.randomUUID();
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
    setEditor({ title: `Ajuster ${card.label}`, fields: model.controlEditors.find(e => e.targetRef === card.targetRef)?.fields ?? [],
      values: Object.fromEntries(["amount", "count", "unitAmount"].map(key => [key, typeof card.value[key] === "string" ? card.value[key] as string : ""])),
      operation: values => ({ kind: "MUTATE", mutation: { kind: "SET_STATE", targetRef: card.targetRef, value: Object.fromEntries(model.controlEditors.find(e => e.targetRef === card.targetRef)!.fields.map(f => [f.key, values[f.key]])) } }) });
  }
  const closeDialog = () => { if (!busyRef.current) { setEditor(null); setBalanceOpen(false); setErrorMessage(null); } };
  function editContext(card: ComposerContextCardView) {
    clearHover();
    setEditor({ title: `Modifier ${card.label}`, fields: model.editors.find(e => e.assetKey === `template:${card.templateKey}`)?.fields ?? [],
      values: Object.fromEntries(Object.entries(card.fields).filter((entry): entry is [string, string] => typeof entry[1] === "string")),
      operation: values => ({ kind: "EDIT_CONTEXT", contextOccurrenceId: card.contextOccurrenceId, values }) });
  }
  function apply() {
    const key = `${model.board.draft.semanticStateDigest}:${model.proof.expectedPreviewDigest}:${model.proof.expectedActiveRevisionId}`;
    if (applyAttempt.current?.key !== key) applyAttempt.current = { key, applyRequestId: crypto.randomUUID() };
    void run({ kind: "APPLY", command: { ...model.proof, applyRequestId: applyAttempt.current.applyRequestId } }, "none");
  }
  return <div className={styles.workspace} data-composer data-digest={model.board.draft.semanticStateDigest} data-revision={model.activeRevisionNumber} aria-busy={busy}>
    <header className={styles.workspaceHeader}><div><a href={`/mois-a-venir?month=${model.semanticState.targetMonth}`} className={styles.backLink}><ArrowLeft size={14} /> Vue du mois</a><h1>Composer <span>{monthLabel(model.semanticState.targetMonth)}</span></h1></div>
      <div className={styles.toolbar}><span className={styles.draftStatus}>{model.board.draft.dirty ? "Brouillon non appliqué" : model.activeRevisionNumber ? `Revision ${model.activeRevisionNumber}` : "Votre point de départ"}</span>
        <button className={styles.secondary} aria-label="Annuler la dernière modification du brouillon" disabled={busy || !past.length} onClick={() => void run({ kind: "READ" }, "undo", past.at(-1))}><Undo2 size={16} /> Annuler</button>
        <button className={styles.secondary} aria-label="Rétablir la modification du brouillon" disabled={busy || !future.length} onClick={() => void run({ kind: "READ" }, "redo", future.at(-1))}><Redo2 size={16} /> Rétablir</button></div></header>
    <div className={styles.columns}><ComposerLibrary model={model} busy={busy} selected={selected} choose={asset => choose(asset)} drag={key => { clearHover(); setSelected(key); }} />
      <ComposerBoard model={model} busy={busy} selected={selected} edit={edit} editContext={editContext} choose={choose} drag={setSelected} drop={drop} request={operation => void run(operation)} hover={hover} />
      <ComposerCockpit projection={(hoverModel ?? model).board.cockpit} temporary={!!hoverModel} busy={busy} dirty={model.board.draft.dirty} revision={model.activeRevisionNumber}
        preview={() => void run({ kind: "READ" }, "none")} apply={apply}
        balance={() => { clearHover(); setBalanceOpen(true); void run({ kind: "SUGGESTIONS" }, "none"); }} /></div>
    <div className={styles.statusBar} role="status" aria-live="polite"><Sparkles size={13} /> {message}</div>
    <dialog ref={dialog} className={styles.dialog} aria-labelledby="composer-dialog-title" onCancel={e => { e.preventDefault(); closeDialog(); }}>
      <header><h2 id="composer-dialog-title">{editor?.title ?? "Des pistes pour votre mois"}</h2><button className={styles.iconButton} disabled={busy} aria-label="Fermer" onClick={closeDialog}><X size={19} /></button></header>
      {errorMessage && <p role="alert" className={styles.formError}>{errorMessage}</p>}
      {editor ? <form onSubmit={e => { e.preventDefault(); const values = Object.fromEntries(new FormData(e.currentTarget).entries()) as Record<string, string>; void run(editor.operation(values)); }}>
        <p className={styles.helper}>Une valeur vide reste inconnue. Une date absente reste à préciser.</p>
        <div className={styles.formFields}>{editor.fields.map(f => <label key={f.key}>{f.label}{f.kind === "CHOICE" ? <select name={f.key} defaultValue={editor.values[f.key] ?? f.choices?.[0]?.value ?? ""} required={f.required}>{f.choices?.map(c => <option value={c.value} key={c.value}>{c.label}</option>)}</select>
          : <input name={f.key} defaultValue={editor.values[f.key] ?? f.initial ?? ""} type={f.kind === "DATE" ? "date" : "text"} inputMode={f.kind === "AMOUNT" ? "decimal" : undefined} required={f.required} autoComplete="off" />}</label>)}</div>
        <footer><button type="button" className={styles.secondary} disabled={busy} onClick={closeDialog}>Retour au mois</button><button data-submit className={styles.primary} disabled={busy}>Prévisualiser ce choix</button></footer>
      </form> : suggestions ? <BalanceLayer suggestions={suggestions} busy={busy} accept={candidateId => void run({ kind: "ACCEPT", candidateSetDigest: suggestions.candidateSetDigest, candidateId })} /> : <p role="status">{busy ? "Le serveur explore les ajustements…" : message}</p>}
    </dialog>
  </div>;
}
