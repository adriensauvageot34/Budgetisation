"use client";

import { useContext, useState } from "react";
import type { ComposerUiModel, ComposerOperation } from "@/domain/phase2/planner/composer-ui-contract";
import { BudgetPreviewStatus, IntentBudgetImpact } from "./intent-budget-impact";
import { money } from "./display";
import { intentionNavigationEntries } from "./workshop-navigation";
import { publishedDrop } from "./interactions";
import { semanticStateDigest } from "@/domain/phase2/planner/semantic-state";
import { componentId } from "@/domain/phase2/planner/identity";
import { normalizeLibrarySearch } from "@/domain/phase2/planner/composer-library-index";
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
  const [filter, setFilter] = useState<"ALL" | "INCOMPLETE" | "READ_ONLY">("ALL");
  const [query, setQuery] = useState("");
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
  const readOnly = (id: string) => {
    const card = byId.get(id)!;
    return card.readOnly || !card.capabilityRefs.includes("PATCH_CONTEXT") || model.semanticState.preferences.anchors.includes(id)
      || model.semanticState.preferences.flexibility[id] === "PRESERVE";
  };
  const incomplete = (id: string) => {
    if (!current) return false;
    const impact = reading?.byContext[id];
    const knowledge = byId.get(id)!.knowledge;
    return impact ? impact.gross === null : knowledge === "UNKNOWN" || knowledge === "PARTIAL";
  };
  const filterable = children.length > 4;
  const activeFilter = filterable ? filter : "ALL";
  const terms = filterable ? normalizeLibrarySearch(query).split(" ").filter(Boolean) : [];
  const visible = children.filter(child => {
    if (activeFilter === "READ_ONLY" && !readOnly(child.id) || activeFilter === "INCOMPLETE" && !incomplete(child.id)) return false;
    const label = normalizeLibrarySearch(child.label);
    return terms.every(term => label.includes(term));
  });
  const consultationCount = children.filter(child => readOnly(child.id)).length;
  const incompleteCount = children.filter(child => incomplete(child.id)).length;
  return <section className={styles.nightSection} aria-label="Intentions liées">
    <h3>Intentions liées</h3>
    <p>{children.length} intention{children.length > 1 ? "s" : ""} · {current ? `${incompleteCount} à compléter` : "Évaluation à actualiser"}
      {consultationCount > 0 ? ` · ${consultationCount} en consultation` : ""}</p>
    {filterable && <label className={styles.projectAttachmentSearch}>Rechercher dans ce projet
      <input type="search" value={query} onChange={event => setQuery(event.target.value)} onKeyDown={event => {
        if (event.key !== "Enter" || event.nativeEvent.isComposing || !terms.length || visible.length !== 1 || busy || !open) return;
        event.preventDefault();
        open(visible[0].id);
      }} />
    </label>}
    {filterable && <nav className={styles.linkedFilters} aria-label="Afficher les intentions liées">
      {([ ["ALL", "Toutes"], ["INCOMPLETE", "À compléter"], ["READ_ONLY", "En consultation"] ] as const).map(([key, label]) =>
        <button type="button" key={key} data-linked-filter={key} aria-pressed={activeFilter === key}
          disabled={key === "INCOMPLETE" && !current} onClick={() => setFilter(key)}>{label}</button>)}
    </nav>}
    {!visible.length && <p role="status">{activeFilter === "INCOMPLETE" && !current ? "Attendez la nouvelle projection pour retrouver les informations à compléter."
      : "Aucune intention liée ne correspond à ce filtre."}</p>}
    <ul>{visible.map(child => {
      const impact = current ? reading?.byContext[child.id] : undefined;
      const destinations = decide ? linkedIntentionMoveTargets(model, parentId, child.id) : [];
      return <li key={child.id} className={styles.linkedIntention} data-linked-intention={child.id}>
        {open ? <button type="button" disabled={busy} onClick={() => open(child.id)}>{child.label}</button> : <span>{child.label}</span>}
        <p className={styles.linkedCost}>
          {!current ? "Coût à actualiser" : impact?.gross != null ? <>Coût total · <strong>{money(impact.gross)}</strong></>
            : impact?.knownSubtotal != null ? <>Sous-total connu · <strong>{money(impact.knownSubtotal)}</strong> · Total à préciser</>
              : "Coût à préciser"}
          {readOnly(child.id) && <small> · Consultation seule</small>}
        </p>
        {current && <details><summary>Budget et informations à compléter</summary>
          <IntentBudgetImpact model={model} contextId={child.id} />
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
