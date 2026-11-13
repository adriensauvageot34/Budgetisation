"use client";

import { useContext, useState } from "react";
import type { ComposerUiModel, ComposerOperation } from "@/domain/phase2/planner/composer-ui-contract";
import { BudgetPreviewStatus, IntentBudgetImpact } from "./intent-budget-impact";
import { money } from "./display";
import { intentionNavigationEntries } from "./workshop-navigation";
import { publishedDrop } from "./interactions";
import { semanticStateDigest } from "@/domain/phase2/planner/semantic-state";
import { componentId } from "@/domain/phase2/planner/identity";
import { useWorkshopConfirmation } from "./workshop-confirmation";
import { useInlineEditRegistry } from "./inline-edit-registry";
import { useCommittedEvent } from "./use-committed-event";
import styles from "./composer.module.css";

export function linkedIntentionMoveTargets(model: ComposerUiModel, parentId: string, childId: string) {
  const cards = new Map(model.board.contexts.map(card => [card.contextOccurrenceId, card]));
  const contexts = new Map(model.semanticState.contexts.map(context => [context.contextOccurrenceId, context]));
  const parent = cards.get(parentId), child = cards.get(childId);
  const locked = (id: string) => model.semanticState.preferences.anchors.includes(id) || model.semanticState.preferences.flexibility[id] === "PRESERVE";
  const writable = (id: string) => { const card = cards.get(id); return card && !card.readOnly && card.capabilityRefs.includes("PATCH_CONTEXT") && !locked(id); };
  if (model.board.targetMonth !== model.semanticState.targetMonth || !parent || !child || !writable(parentId) || !writable(childId)
    || child.parentContextOccurrenceId !== parentId || contexts.get(childId)?.parentContextOccurrenceId !== parentId
    || !parent.childContextOccurrenceIds.includes(childId)) return [];
  const sourceRelations = parent.sockets.flatMap(socket =>
    socket.currentItems.filter(item => item.kind === "CHILD_CONTEXT" && item.childContextOccurrenceId === childId)
      .map(item => componentId(parentId, socket.slotKey, item.selectionId)));
  if (!sourceRelations.length || sourceRelations.some(locked)) return [];
  const labels = new Map(intentionNavigationEntries(model.board.contexts).map(entry => [entry.id, entry.label]));
  return model.board.contexts.flatMap(candidate => {
    const id = candidate.contextOccurrenceId;
    if (id === parentId || !writable(id)) return [];
    const seen = new Set<string>();
    let ancestor: string | null = id;
    while (ancestor) {
      if (ancestor === childId || seen.has(ancestor)) return [];
      seen.add(ancestor); ancestor = contexts.get(ancestor)?.parentContextOccurrenceId ?? null;
    }
    return candidate.sockets.flatMap(socket => {
      // A repeating socket never replaces and prunes another intention.
      if (socket.cardinality !== "REPEATING" || socket.contextOccurrenceId !== id
        || !socket.capabilityRefs.includes(`${candidate.templateKey}:${socket.slotKey}:ATTACH_CHILD_CONTEXT`)) return [];
      const target = { kind: "CONTEXT_SOCKET" as const, contextOccurrenceId: id, slotKey: socket.slotKey };
      const assetKey = `context-occurrence:${childId}`;
      if (!publishedDrop(model, assetKey, target)?.choices.includes("REPARENT_PRESERVE_ID")) return [];
      return [{ key: JSON.stringify([id, socket.slotKey]), label: `${labels.get(id)} · ${socket.label ?? socket.slotKey}`, target, assetKey }];
    });
  });
}

export function LinkedIntentions({ model, parentId, busy, open, decide }: {
  model: ComposerUiModel; parentId: string; busy: boolean; open?: (id: string) => void;
  decide?: (operation: ComposerOperation) => boolean;
}) {
  const preview = useContext(BudgetPreviewStatus);
  const confirm = useWorkshopConfirmation(), edits = useInlineEditRegistry();
  const [error, setError] = useState<string | null>(null);
  const move = useCommittedEvent((childId: string, key: string, digest: string) => {
    if (busy || !decide) return;
    const target = linkedIntentionMoveTargets(model, parentId, childId).find(target => target.key === key);
    if (!target || semanticStateDigest(model.semanticState) !== digest) { setError("Le projet ou ses droits ont changé. Rouvrez le déplacement."); return; }
    if (decide({ kind: "DROP", assetKey: target.assetKey, target: target.target, identity: childId, selectionId: crypto.randomUUID(), values: {} })) setError(null);
  });
  const askMove = useCommittedEvent((childId: string, key: string) => {
    if (busy || !decide) return;
    const target = linkedIntentionMoveTargets(model, parentId, childId).find(target => target.key === key);
    if (!target) return;
    const digest = semanticStateDigest(model.semanticState);
    const ask = () => confirm({ message: `Déplacer cette intention vers « ${target.label} » ? Son identité et ses postes sont conservés. Elle quittera ce projet.`,
      acceptLabel: "Déplacer cette intention", accept: () => move(childId, key, digest) });
    if (!edits || edits.guard(ask)) ask();
  });
  const parent = model.board.contexts.find(card => card.contextOccurrenceId === parentId);
  const byId = new Map(model.board.contexts.map(card => [card.contextOccurrenceId, card]));
  const children = intentionNavigationEntries([...new Set(parent?.childContextOccurrenceIds ?? [])].flatMap(id => {
    const child = byId.get(id);
    return child?.parentContextOccurrenceId === parentId ? [child] : [];
  }));
  if (!children.length) return null;
  const reading = model.budgetReading;
  const current = reading?.semanticStateDigest === model.board.draft.semanticStateDigest
    && (preview === "FRESH" || preview === "BLOCKED");
  return <section className={styles.nightSection} aria-label="Intentions liées">
    <h3>Intentions liées</h3>
    <ul>{children.map(child => {
      const impact = current ? reading?.byContext[child.id] : undefined;
      const card = byId.get(child.id)!;
      const missing = current ? model.board.diagnostics.filter(diagnostic => diagnostic.targetRef === child.id
        && diagnostic.severity !== "INFO") : [];
      const destinations = decide ? linkedIntentionMoveTargets(model, parentId, child.id) : [];
      return <li key={child.id} className={styles.linkedIntention} data-linked-intention={child.id}>
        {open ? <button type="button" disabled={busy} onClick={() => open(child.id)}>{child.label}</button> : <span>{child.label}</span>}
        <small> · {impact ? impact.gross === null && impact.knownSubtotal !== null
          ? `${money(impact.knownSubtotal)} connus, total à préciser` : money(impact.gross)
          : current ? "Coût à préciser" : "Coût à actualiser"}</small>
        {(card.readOnly || !card.capabilityRefs.includes("PATCH_CONTEXT")) && <small> · Consultation seule</small>}
        {current && <details><summary>Budget et informations à compléter</summary>
          <IntentBudgetImpact model={model} contextId={child.id} />
          {missing.length > 0 && <ul>{missing.map((diagnostic, index) => <li key={`${diagnostic.code}:${index}`}>{diagnostic.message}</li>)}</ul>}
        </details>}
        {destinations.length > 0 && <details><summary>Déplacer vers un autre projet</summary>
          <p>L’intention conserve ses postes. Choisissez le projet qui doit la contenir.</p>
          {destinations.map(destination => <button type="button" key={destination.key} disabled={busy} data-move-linked={child.id}
            onClick={() => askMove(child.id, destination.key)}>Déplacer vers {destination.label}</button>)}
        </details>}
      </li>;
    })}</ul>
    <p>Le total consolidé du projet n’est pas publié. Chaque poste conserve son évaluation.</p>
    {error && <p role="alert">{error}</p>}
  </section>;
}
