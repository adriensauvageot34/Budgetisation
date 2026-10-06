import { Plus, Trash2, LockKeyhole } from "lucide-react";
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
import { BoardCarousel } from "./board-carousel";
export function ComposerBoard({ model, busy, selected, focused, focus, edit, choose, drag, drop, request, hover, editContext, add, preview, balance, details }: { model: ComposerUiModel; busy: boolean; selected: string | null;
  focused: string | null; focus: (id: string | null) => void;
  edit: (card: ComposerCardView) => void; choose: (asset: ComposerAssetView, target: DropTarget, selection?: ComponentSelectionV1) => void;
  drag: (key: string | null) => void; drop: (target: DropTarget, key?: string) => void; request: (operation: ComposerOperation) => void; hover: (mutation: SemanticMutation | null) => void; editContext: (card: ComposerContextCardView) => void;
  add: () => void; preview: () => void; balance: () => void; details: () => void }) {
  const boardAccepts = !!selected && (model.dropCapabilities.some(d => d.sourceAssetKey === selected && d.target.kind === "BOARD_ZONE" && d.resolution !== "BLOCKED")
    || model.presentation.dragSources[selected]?.editorDropTarget?.kind === "BOARD_ZONE");
  const trashAccepts = !!selected && model.dropCapabilities.some(d => d.sourceAssetKey === selected && d.target.kind === "TRASH" && d.resolution !== "BLOCKED");
  const focusedCard = model.board.contexts.find(c => c.contextOccurrenceId === focused);
  const interaction = useComposerInteractions();
  const trashVisible = !!interaction?.grabbed && (!!interaction.grabbed.removeOperation || interaction.grabbed.protected);
  const boardTarget: DropTarget = { kind: "BOARD_ZONE" }, trashTarget: DropTarget = { kind: "TRASH" };
  return <section className={styles.board} aria-label="Board du mois">
    <BoardCarousel model={model} focused={focused} emptyClick={() => focus(null)} dropProps={{ "data-compatible": boardAccepts,
      "data-drag-over": sameTarget(interaction?.overTarget ?? null, boardTarget),
      onDragOver: e => { if (boardAccepts && !busy) { e.preventDefault(); e.dataTransfer.dropEffect = "move"; interaction?.over(boardTarget); } else interaction?.over(null); },
      onDragLeave: e => { if (leftSurface(e)) interaction?.over(null); },
      onDrop: e => { e.preventDefault(); if (boardAccepts && !busy) { if (interaction?.grabbed) interaction.place(boardTarget); else drop(boardTarget, e.dataTransfer.getData("application/x-planner-asset")); } }
    }} render={item => item.context ? <ContextCard card={item.context} model={model} busy={busy} selected={selected} focused={focusedCard?.contextOccurrenceId ?? null} focus={focus} drag={drag} drop={drop} choose={choose} request={request} edit={editContext} />
      : <ComposerCard card={item.control!} presentation={model.presentation.objects[item.id]} busy={busy} focused={focused === item.id} focus={() => focus(item.id)}
        preserved={model.semanticState.preferences.flexibility[item.id] === "PRESERVE"} edit={() => edit(item.control!)}
        preserve={() => request({ kind: "PRESERVE", targetRef: item.id, preserve: model.semanticState.preferences.flexibility[item.id] !== "PRESERVE" })}
        mutate={mutation => request({ kind: "MUTATE", mutation })} hover={hover} />}>
      {interaction?.grabbed?.pack && <article className={styles.packGhost} data-pack-ghost aria-label={`Aperçu de ${interaction.grabbed.label}`}><PlannerIcon iconKey={interaction.grabbed.iconKey} /><h3>{interaction.grabbed.label}</h3>
          <div>{interaction.grabbed.pack.map((s, index) => <span key={`${s.label}:${index}`} title={`${s.label} · ${s.provenance}`}><PlannerIcon iconKey={s.iconKey} scale="SATELLITE" /><small>{s.label}</small></span>)}</div><p>Estimation après ajout</p></article>}
    </BoardCarousel>
    {model.presentation.elementCount < 4 && <button data-add-element className={styles.emptyInvitation} disabled={busy} onClick={add}><Plus size={14} /> Ajouter à votre mois</button>}
    {focusedCard && <div className={styles.paletteDock} data-palette-dock><ContextPalette card={focusedCard} model={model} busy={busy} choose={choose} close={() => focus(null)} /></div>}
    {trashVisible && <div className={styles.trash} data-trash data-protected={interaction?.grabbed?.protected} data-compatible={trashAccepts || !!interaction?.grabbed?.removeOperation} data-drag-over={sameTarget(interaction?.overTarget ?? null, trashTarget)}
      role="status" aria-label={interaction?.grabbed?.protected ? "Protégée · retrait interdit" : "Retirer l’élément saisi"}
      onDragOver={e => { e.stopPropagation(); if (!busy && !interaction?.grabbed?.protected) { e.preventDefault(); interaction?.over(trashTarget); } }}
      onDragEnter={() => { if (interaction?.grabbed?.protected) interaction.reject(); }}
      onDragLeave={() => interaction?.over(null)} onDrop={e => { e.preventDefault(); e.stopPropagation(); if (!busy) interaction?.place(trashTarget); }}>
      {interaction?.grabbed?.protected ? <LockKeyhole size={17} /> : <Trash2 size={17} />}{interaction?.grabbed?.protected ? "Protégée" : "Retirer"}</div>}
  </section>;
}
