"use client";

import { useContext } from "react";
import type { ComposerUiModel } from "@/domain/phase2/planner/composer-ui-contract";
import { BudgetPreviewStatus } from "./intent-budget-impact";
import { money } from "./display";
import { intentionNavigationEntries } from "./workshop-navigation";
import styles from "./composer.module.css";

export function LinkedIntentions({ model, parentId, busy, open }: {
  model: ComposerUiModel; parentId: string; busy: boolean; open?: (id: string) => void;
}) {
  const preview = useContext(BudgetPreviewStatus);
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
      return <li key={child.id}>
        {open ? <button type="button" disabled={busy} onClick={() => open(child.id)}>{child.label}</button> : <span>{child.label}</span>}
        <small> · {impact ? impact.gross === null && impact.knownSubtotal !== null
          ? `${money(impact.knownSubtotal)} connus, total à préciser` : money(impact.gross)
          : current ? "Coût à préciser" : "Coût à actualiser"}</small>
      </li>;
    })}</ul>
    <p>Le total consolidé du projet n’est pas publié. Chaque poste conserve son évaluation.</p>
  </section>;
}
