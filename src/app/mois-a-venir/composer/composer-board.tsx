import { Plus, Trash2, LockKeyhole } from "lucide-react";
import { useLayoutEffect, useRef } from "react";
import type { ComposerUiModel, ComposerOperation } from "@/domain/phase2/planner/composer-ui-contract";
import type { ComposerCardView, ComposerContextCardView, DropTarget, ComposerAssetView } from "@/domain/phase2/planner/composer-contract";
import type { ComponentSelectionV1 } from "@/domain/phase2/planner/component-contract";
import type { SemanticMutation } from "@/domain/phase2/planner/adjustment-contract";
import { ComposerCard } from "./composer-card";
import { ContextCard } from "./context-card";
import { ContextPalette } from "./context-palette";
import styles from "./composer.module.css";
import { useComposerInteractions, sameTarget, leftSurface } from "./interactions";
import { PlannerIcon } from "./planner-icons/planner-icon";
export function ComposerBoard({ model, busy, selected, focused, focus, edit, choose, drag, drop, request, hover, editContext, add, preview, balance, details }: { model: ComposerUiModel; busy: boolean; selected: string | null;
  focused: string | null; focus: (id: string | null) => void;
  edit: (card: ComposerCardView) => void; choose: (asset: ComposerAssetView, target: DropTarget, selection?: ComponentSelectionV1) => void;
  drag: (key: string | null) => void; drop: (target: DropTarget, key?: string) => void; request: (operation: ComposerOperation) => void; hover: (mutation: SemanticMutation | null) => void; editContext: (card: ComposerContextCardView) => void;
  add: () => void; preview: () => void; balance: () => void; details: () => void }) {
  const boardAccepts = !!selected && model.dropCapabilities.some(d => d.sourceAssetKey === selected && d.target.kind === "BOARD_ZONE" && d.resolution !== "BLOCKED");
  const trashAccepts = !!selected && model.dropCapabilities.some(d => d.sourceAssetKey === selected && d.target.kind === "TRASH" && d.resolution !== "BLOCKED");
  const controls = [...model.board.baselineControls, ...model.board.discretionaryControls, ...model.board.savings];
  const focusedCard = model.board.contexts.find(c => c.contextOccurrenceId === focused);
  const scroll = useRef<HTMLDivElement>(null);
  const interaction = useComposerInteractions();
  const trashVisible = !!interaction?.grabbed && (!!interaction.grabbed.removeOperation || interaction.grabbed.protected);
  const boardTarget: DropTarget = { kind: "BOARD_ZONE" }, trashTarget: DropTarget = { kind: "TRASH" };
  useLayoutEffect(() => {
    if (!focused || !scroll.current) return;
    const card = scroll.current.querySelector<HTMLElement>(`[data-context="${CSS.escape(focused)}"]`);
    if (card?.getClientRects().length && !card.closest("[popover]")) {
      const bounds = card.getBoundingClientRect(), frame = scroll.current.getBoundingClientRect();
      if (bounds.bottom > frame.bottom - 10) scroll.current.scrollTop += Math.ceil(bounds.bottom - frame.bottom + 10);
      else if (bounds.top < frame.top + 10) scroll.current.scrollTop += Math.floor(bounds.top - frame.top - 10);
    }
  }, [focused]);
  return <section className={styles.board} aria-label="Board du mois">
    <header className={styles.boardHeader}><div><span className={styles.boardEyebrow}>L’atelier du mois</span><h2>Faites de la place à vos envies.</h2></div>
      <div className={styles.boardTools}><button data-preview className={styles.textButton} disabled={busy} onClick={preview}>Prévisualiser le mois</button>
        <button data-balance className={styles.textButton} disabled={busy} onClick={balance}>Explorer les ajustements</button>
        <button data-financial-details className={styles.textButton} disabled={busy} onClick={details}>Détail financier</button></div></header>
    <div ref={scroll} className={styles.boardScroll} data-board-scroll data-board-drop data-compatible={boardAccepts}
      data-drag-over={sameTarget(interaction?.overTarget ?? null, boardTarget)}
      onDragOver={e => { if (boardAccepts && !busy) { e.preventDefault(); e.dataTransfer.dropEffect = "move"; interaction?.over(boardTarget); } else interaction?.over(null); }}
    onDragLeave={e => { if (leftSurface(e)) interaction?.over(null); }}
      onDrop={e => { e.preventDefault(); if (boardAccepts && !busy) { if (interaction?.grabbed) interaction.place(boardTarget); else drop(boardTarget, e.dataTransfer.getData("application/x-planner-asset")); } }}>
      <div className={styles.mosaic} data-mosaic data-has-focus={!!focusedCard} data-completeness-focus={interaction?.completenessFocus} onClick={e => { if (e.target === e.currentTarget) focus(null); }}>{controls.map(card => <ComposerCard key={card.cardId} card={card} presentation={model.presentation.objects[card.targetRef]} busy={busy}
        preserved={model.semanticState.preferences.flexibility[card.targetRef] === "PRESERVE"} edit={() => edit(card)}
        preserve={() => request({ kind: "PRESERVE", targetRef: card.targetRef, preserve: model.semanticState.preferences.flexibility[card.targetRef] !== "PRESERVE" })}
        mutate={mutation => request({ kind: "MUTATE", mutation })} hover={hover} />)}
        {model.board.contexts.filter(c => !c.parentContextOccurrenceId).map(card => <ContextCard key={card.contextOccurrenceId} card={card} model={model} busy={busy} selected={selected} focused={focusedCard?.contextOccurrenceId ?? null} focus={focus} drag={drag} drop={drop} choose={choose} request={request} edit={editContext} />)}
        {interaction?.grabbed?.pack && <article className={styles.packGhost} data-pack-ghost aria-label={`Aperçu de ${interaction.grabbed.label}`}><PlannerIcon iconKey={interaction.grabbed.iconKey} /><h3>{interaction.grabbed.label}</h3>
          <div>{interaction.grabbed.pack.map((s, index) => <span key={`${s.label}:${index}`} title={`${s.label} · ${s.provenance}`}><PlannerIcon iconKey={s.iconKey} scale="SATELLITE" /><small>{s.label}</small></span>)}</div><p>Estimation après ajout</p></article>}
        <button data-add-element className={styles.addObject} disabled={busy} onClick={boardAccepts ? () => drop({ kind: "BOARD_ZONE" }) : add}><Plus size={25} aria-hidden="true" /><span>{boardAccepts ? "Placer l’intention sélectionnée" : "Ajouter un élément"}</span><small>{boardAccepts ? "Composer ce moment" : "Choisir dans la bibliothèque"}</small></button>
      </div>
    </div>
    {focusedCard && <ContextPalette card={focusedCard} model={model} busy={busy} choose={choose} close={() => focus(null)} />}
    {trashVisible && <div className={styles.trash} data-trash data-protected={interaction?.grabbed?.protected} data-compatible={trashAccepts || !!interaction?.grabbed?.removeOperation} data-drag-over={sameTarget(interaction?.overTarget ?? null, trashTarget)}
      role="status" aria-label={interaction?.grabbed?.protected ? "Protégée · retrait interdit" : "Retirer l’élément saisi"}
      onDragOver={e => { e.stopPropagation(); if (!busy && !interaction?.grabbed?.protected) { e.preventDefault(); interaction?.over(trashTarget); } }}
      onDragEnter={() => { if (interaction?.grabbed?.protected) interaction.reject(); }}
      onDragLeave={() => interaction?.over(null)} onDrop={e => { e.preventDefault(); e.stopPropagation(); if (!busy) interaction?.place(trashTarget); }}>
      {interaction?.grabbed?.protected ? <LockKeyhole size={17} /> : <Trash2 size={17} />}{interaction?.grabbed?.protected ? "Protégée" : "Retirer"}</div>}
  </section>;
}
