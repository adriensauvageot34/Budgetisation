"use client";
import { useEffect, useRef, useState } from "react";
import type { ComposerUiModel } from "@/domain/phase2/planner/composer-ui-contract";
import type { RootContextRelationV1, RootRelationCapabilities, RootRelationMutation } from "@/domain/phase2/planner/root-relation-contract";
import { useWorkshopRaw } from "./inline-edit-registry";
import styles from "./root-relation-commands.module.css";
export const ROOT_COMMAND_BUFFER = "root-relation-command";
export function RootRelationCommands({ model, relations, capabilities, busy, error, command, close, abandon, undo, redo, canUndo, canRedo }: {
  model: ComposerUiModel; relations: readonly RootContextRelationV1[]; capabilities: RootRelationCapabilities | null;
  busy: boolean; error: string | null; command(mutation: RootRelationMutation, focusId?: string): Promise<boolean>;
  close(): void; abandon(): void; undo(): void; redo(): void; canUndo: boolean; canRedo: boolean;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [first, setFirst] = useState(""), [second, setSecond] = useState(""), [additional, setAdditional] = useState<Record<string, string>>({});
  const clear = () => { setFirst(""); setSecond(""); setAdditional({}); };
  const guard = useWorkshopRaw(ROOT_COMMAND_BUFFER, !!first || !!second || Object.values(additional).some(Boolean), clear, "root-command");
  useEffect(() => { const origin = document.activeElement as HTMLElement | null;
    dialog.current?.showModal(); return () => { dialog.current?.close(); if (origin?.isConnected) origin.focus(); }; }, []);
  const eligible = capabilities?.capabilities.find(cap => cap.action === "CREATE_ROOT_RELATION")?.eligibleContextIds ?? [];
  const label = (id: string) => model.board.contexts.find(context => context.contextOccurrenceId === id)?.label ?? id;
  const capability = (action: RootRelationMutation["kind"], id: string) => capabilities?.capabilities.find(cap => cap.action === action && cap.relationId === id);
  const allowed = (action: RootRelationMutation["kind"], id: string) => capability(action, id)?.status === "AVAILABLE";
  const guarded = (action: () => void) => { if (!busy && guard(action)) action(); };
  const create = async () => {
    const id = crypto.randomUUID();
    if (await command({ kind: "CREATE_ROOT_RELATION", relationId: id, orderedContextIds: [first, second] }, `root-group-${id}`)) clear();
  };
  return <dialog ref={dialog} className={styles.dialog} data-root-commands aria-labelledby="root-command-title"
    onCancel={event => { event.preventDefault(); guarded(close); }}>
    <h2 id="root-command-title" tabIndex={-1}>Organiser une sortie</h2>
    <p className={styles.notice}>Organisation locale non sauvegardée. Sauvegarde et transformation en Plan suspendues jusqu’à l’abandon explicite. Un rechargement complet perd cette organisation après avertissement.</p>
    {error && <p role="alert">{error}</p>}
    <section aria-label="Nouvelle sortie">
      <label>Première activité<select value={first} disabled={busy} onChange={event => setFirst(event.target.value)}><option value="">Choisir</option>{eligible.map(id => <option key={id} value={id}>{label(id)}</option>)}</select></label>
      <label>Deuxième activité<select value={second} disabled={busy} onChange={event => setSecond(event.target.value)}><option value="">Choisir</option>{eligible.filter(id => id !== first).map(id => <option key={id} value={id}>{label(id)}</option>)}</select></label>
      <button data-root-create disabled={busy || !first || !second || first === second} onClick={() => void create()}>Relier dans cet ordre</button>
      {!eligible.length && <p>Aucune paire supplémentaire admissible dans ce brouillon.</p>}
    </section>
    {relations.map((relation, index) => <section key={relation.relationId} data-root-relation-id={relation.relationId}>
      <h3 id={`root-group-${relation.relationId}`} tabIndex={-1}>Sortie {index + 1}</h3>
      <ol>{relation.orderedContextIds.map((id, position) => <li key={id} data-root-member={id}>
        <span id={`root-member-${relation.relationId}-${id}`} tabIndex={-1}>{label(id)}</span>
        {([-1, 1] as const).map(direction => <button key={direction} aria-label={`${direction < 0 ? "Monter" : "Descendre"} ${label(id)}`} disabled={busy || !allowed("REORDER_ROOT_RELATION", relation.relationId) || position + direction < 0 || position + direction >= relation.orderedContextIds.length}
          onClick={() => { const order = [...relation.orderedContextIds]; [order[position], order[position + direction]] = [order[position + direction], order[position]];
            void command({ kind: "REORDER_ROOT_RELATION", relationId: relation.relationId, orderedContextIds: order }, `root-member-${relation.relationId}-${id}`); }}>{direction < 0 ? "Monter" : "Descendre"}</button>)}
        <button disabled={busy || !allowed("DETACH_ROOT_RELATION_MEMBER", relation.relationId)} onClick={() => void command({ kind: "DETACH_ROOT_RELATION_MEMBER", relationId: relation.relationId, contextOccurrenceId: id }, `root-group-${relation.relationId}`)}>Détacher {label(id)}</button>
      </li>)}</ol>
      <label>Ajouter une activité<select value={additional[relation.relationId] ?? ""} disabled={busy} onChange={event => setAdditional(previous => ({ ...previous, [relation.relationId]: event.target.value }))}>
        <option value="">Choisir</option>{capability("ADD_ROOT_RELATION_MEMBER", relation.relationId)?.eligibleContextIds.map(id => <option key={id} value={id}>{label(id)}</option>)}</select></label>
      <button disabled={busy || !additional[relation.relationId] || !allowed("ADD_ROOT_RELATION_MEMBER", relation.relationId)} onClick={async () => {
        if (await command({ kind: "ADD_ROOT_RELATION_MEMBER", relationId: relation.relationId, contextOccurrenceId: additional[relation.relationId] }, `root-group-${relation.relationId}`)) setAdditional(previous => ({ ...previous, [relation.relationId]: "" })); }}>Ajouter à la fin</button>
      <button disabled={busy || !allowed("REMOVE_ROOT_RELATION", relation.relationId)} onClick={() => void command({ kind: "REMOVE_ROOT_RELATION", relationId: relation.relationId })}>Dissoudre le groupe</button>
    </section>)}
    <footer><button disabled={busy || !canUndo} onClick={() => guarded(undo)}>Annuler</button><button disabled={busy || !canRedo} onClick={() => guarded(redo)}>Rétablir</button>
      <button disabled={busy} onClick={() => guarded(close)}>Fermer</button><button disabled={busy} onClick={() => guarded(abandon)}>Abandonner l’organisation locale</button></footer>
  </dialog>;
}
