import { Sparkles, Plus, Trash2 } from "lucide-react";
import type { ComposerUiModel, ComposerOperation } from "@/domain/phase2/planner/composer-ui-contract";
import type { ComposerCardView, ComposerContextCardView, DropTarget, ComposerAssetView } from "@/domain/phase2/planner/composer-contract";
import type { ComponentSelectionV1 } from "@/domain/phase2/planner/component-contract";
import type { SemanticMutation } from "@/domain/phase2/planner/adjustment-contract";
import { ComposerCard } from "./composer-card";
import { ContextCard } from "./context-card";
import styles from "./composer.module.css";
export function ComposerBoard({ model, busy, selected, edit, choose, drag, drop, request, hover, editContext }: { model: ComposerUiModel; busy: boolean; selected: string | null;
  edit: (card: ComposerCardView) => void; choose: (asset: ComposerAssetView, target: DropTarget, selection?: ComponentSelectionV1) => void;
  drag: (key: string | null) => void; drop: (target: DropTarget, key?: string) => void; request: (operation: ComposerOperation) => void; hover: (mutation: SemanticMutation | null) => void; editContext: (card: ComposerContextCardView) => void }) {
  const boardAccepts = !!selected && model.dropCapabilities.some(d => d.sourceAssetKey === selected && d.target.kind === "BOARD_ZONE" && d.resolution !== "BLOCKED");
  const trashAccepts = !!selected && model.dropCapabilities.some(d => d.sourceAssetKey === selected && d.target.kind === "TRASH" && d.resolution !== "BLOCKED");
  const cards = (items: readonly ComposerCardView[]) => <div className={styles.cardGrid}>{items.map(card => <ComposerCard key={card.cardId} card={card} busy={busy}
    preserved={model.semanticState.preferences.flexibility[card.targetRef] === "PRESERVE"} edit={() => edit(card)}
    preserve={() => request({ kind: "PRESERVE", targetRef: card.targetRef, preserve: model.semanticState.preferences.flexibility[card.targetRef] !== "PRESERVE" })}
    mutate={mutation => request({ kind: "MUTATE", mutation })} hover={hover} />)}</div>;
  return <section className={styles.board} aria-label="Board du mois"><header className={styles.panelHeader}><Sparkles size={18} /><h2>Votre mois, à votre façon</h2><span className={styles.badge}>{model.board.draft.dirty ? "Brouillon" : "État appliqué / initial"}</span></header>
    <div className={styles.boardScroll} data-board-scroll><section className={styles.boardSection}><div className={styles.sectionHeading}><h2>Socle du mois</h2><p>Habitudes, besoins et engagements</p></div>{cards(model.board.baselineControls)}</section>
      <section className={styles.boardSection}><div className={styles.sectionHeading}><h2>Vie & envies</h2><p>Les choix simples du quotidien</p></div>{cards(model.board.discretionaryControls)}</section>
      <section className={styles.boardSection} data-board-drop data-compatible={boardAccepts} onDragOver={e => { if (boardAccepts && !busy) { e.preventDefault(); e.dataTransfer.dropEffect = "move"; } }} onDrop={e => { e.preventDefault(); if (boardAccepts && !busy) drop({ kind: "BOARD_ZONE" }, e.dataTransfer.getData("application/x-planner-asset")); }}>
        <div className={styles.sectionHeading}><h2>Contexts & projets</h2><p>Des moments qui se composent</p></div>
        {model.board.contexts.filter(c => !c.parentContextOccurrenceId).map(card => <ContextCard key={card.contextOccurrenceId} card={card} model={model} busy={busy} selected={selected} drag={drag} drop={drop} choose={choose} request={request} edit={editContext} />)}
        <div className={styles.boardPlaceholder}>{boardAccepts ? <button disabled={busy} onClick={() => drop({ kind: "BOARD_ZONE" })}><Plus size={17} /> Placer l’intention sélectionnée</button> : <><Sparkles size={21} /><p>Ajoutez un moment depuis la bibliothèque.<br /><span>Un dîner, une visite, un week-end…</span></p></>}</div>
      </section>
      <section className={styles.boardSection}><div className={styles.sectionHeading}><h2>Cagnottes</h2><p>Votre argent réservé, avec ses protections</p></div>{cards(model.board.savings)}</section>
    </div>
    <button className={styles.trash} data-trash data-compatible={trashAccepts} disabled={busy || !trashAccepts} aria-label="Retirer le Context sélectionné" onClick={() => drop({ kind: "TRASH" })}
      onDragOver={e => { if (trashAccepts && !busy) e.preventDefault(); }} onDrop={e => { e.preventDefault(); if (trashAccepts && !busy) drop({ kind: "TRASH" }, e.dataTransfer.getData("application/x-planner-asset")); }}><Trash2 size={15} /> Corbeille contextuelle <small>Retirer une intention sélectionnée</small></button>
  </section>;
}
