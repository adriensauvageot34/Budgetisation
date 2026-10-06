import { Plus, Trash2 } from "lucide-react";
import type { ComposerUiModel, ComposerOperation } from "@/domain/phase2/planner/composer-ui-contract";
import type { ComposerCardView, ComposerContextCardView, DropTarget, ComposerAssetView } from "@/domain/phase2/planner/composer-contract";
import type { ComponentSelectionV1 } from "@/domain/phase2/planner/component-contract";
import type { SemanticMutation } from "@/domain/phase2/planner/adjustment-contract";
import { ComposerCard } from "./composer-card";
import { ContextCard } from "./context-card";
import styles from "./composer.module.css";
export function ComposerBoard({ model, busy, selected, edit, choose, drag, drop, request, hover, editContext, add, preview, balance, details }: { model: ComposerUiModel; busy: boolean; selected: string | null;
  edit: (card: ComposerCardView) => void; choose: (asset: ComposerAssetView, target: DropTarget, selection?: ComponentSelectionV1) => void;
  drag: (key: string | null) => void; drop: (target: DropTarget, key?: string) => void; request: (operation: ComposerOperation) => void; hover: (mutation: SemanticMutation | null) => void; editContext: (card: ComposerContextCardView) => void;
  add: () => void; preview: () => void; balance: () => void; details: () => void }) {
  const boardAccepts = !!selected && model.dropCapabilities.some(d => d.sourceAssetKey === selected && d.target.kind === "BOARD_ZONE" && d.resolution !== "BLOCKED");
  const trashAccepts = !!selected && model.dropCapabilities.some(d => d.sourceAssetKey === selected && d.target.kind === "TRASH" && d.resolution !== "BLOCKED");
  const controls = [...model.board.baselineControls, ...model.board.discretionaryControls, ...model.board.savings];
  return <section className={styles.board} aria-label="Board du mois">
    <header className={styles.boardHeader}><div><span className={styles.boardEyebrow}>L’atelier du mois</span><h2>Faites de la place à vos envies.</h2></div>
      <div className={styles.boardTools}><button data-preview className={styles.textButton} disabled={busy} onClick={preview}>Prévisualiser le mois</button>
        <button data-balance className={styles.textButton} disabled={busy} onClick={balance}>Explorer les ajustements</button>
        <button data-financial-details className={styles.textButton} disabled={busy} onClick={details}>Détail financier</button></div></header>
    <div className={styles.boardScroll} data-board-scroll data-board-drop data-compatible={boardAccepts}
      onDragOver={e => { if (boardAccepts && !busy) { e.preventDefault(); e.dataTransfer.dropEffect = "move"; } }}
      onDrop={e => { e.preventDefault(); if (boardAccepts && !busy) drop({ kind: "BOARD_ZONE" }, e.dataTransfer.getData("application/x-planner-asset")); }}>
      <div className={styles.mosaic} data-mosaic>{controls.map(card => <ComposerCard key={card.cardId} card={card} presentation={model.presentation.objects[card.targetRef]} busy={busy}
        preserved={model.semanticState.preferences.flexibility[card.targetRef] === "PRESERVE"} edit={() => edit(card)}
        preserve={() => request({ kind: "PRESERVE", targetRef: card.targetRef, preserve: model.semanticState.preferences.flexibility[card.targetRef] !== "PRESERVE" })}
        mutate={mutation => request({ kind: "MUTATE", mutation })} hover={hover} />)}
        {model.board.contexts.filter(c => !c.parentContextOccurrenceId).map(card => <ContextCard key={card.contextOccurrenceId} card={card} model={model} busy={busy} selected={selected} drag={drag} drop={drop} choose={choose} request={request} edit={editContext} />)}
        <button data-add-element className={styles.addObject} disabled={busy} onClick={boardAccepts ? () => drop({ kind: "BOARD_ZONE" }) : add}><Plus size={25} aria-hidden="true" /><span>{boardAccepts ? "Placer l’intention sélectionnée" : "Ajouter un élément"}</span><small>{boardAccepts ? "Composer ce moment" : "Choisir dans la bibliothèque"}</small></button>
      </div>
    </div>
    <button className={styles.trash} data-trash data-compatible={trashAccepts} disabled={busy || !trashAccepts} aria-label="Retirer le Context sélectionné" onClick={() => drop({ kind: "TRASH" })}
      onDragOver={e => { if (trashAccepts && !busy) e.preventDefault(); }} onDrop={e => { e.preventDefault(); if (trashAccepts && !busy) drop({ kind: "TRASH" }, e.dataTransfer.getData("application/x-planner-asset")); }}><Trash2 size={15} /> Corbeille contextuelle <small>Retirer une intention sélectionnée</small></button>
  </section>;
}
