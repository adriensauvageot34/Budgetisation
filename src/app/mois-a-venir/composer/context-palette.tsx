import { Check, Sparkle, ArrowLeftRight, Plus, X } from "lucide-react";
import type { ComposerUiModel } from "@/domain/phase2/planner/composer-ui-contract";
import type { ComposerAssetView, ComposerContextCardView, DropTarget } from "@/domain/phase2/planner/composer-contract";
import { PlannerIcon } from "./planner-icons/planner-icon";
import { equipmentGroups } from "./presentation/palette-groups";
import styles from "./composer.module.css";
import { useComposerInteractions } from "./interactions";

export function ContextPalette({ card, model, busy, choose, close }: { card: ComposerContextCardView; model: ComposerUiModel; busy: boolean;
  choose: (asset: ComposerAssetView, target: DropTarget) => void; close: () => void;
}) {
  const interaction = useComposerInteractions();
  const groups = equipmentGroups(card, model);
  const assets = new Map(model.library.searchableAssets.map(asset => [asset.assetKey, asset]));
  const iconKey = model.presentation.objects[card.contextOccurrenceId]?.iconKey ?? "activity";
  return <section className={styles.contextPalette} data-context-palette={card.contextOccurrenceId} aria-label={`Équiper ${card.label}`}>
    <header><div className={styles.paletteHeading}><PlannerIcon iconKey={iconKey} scale="SATELLITE" /><div><h3>Équiper · {card.label}</h3><p>Choisissez un élément pour ce moment</p></div></div>
      <button className={styles.iconButton} aria-label="Quitter la sélection du moment" onClick={close}><X size={16} /></button></header>
    {groups.length ? <div className={styles.paletteOptions} data-palette-options tabIndex={0} aria-label={`Options pour ${card.label}`}
      onKeyDown={event => { if (event.target !== event.currentTarget || !["ArrowLeft", "ArrowRight"].includes(event.key)) return;
        event.preventDefault(); event.currentTarget.scrollBy({ left: event.key === "ArrowRight" ? 150 : -150, behavior: "smooth" }); }}>
      {groups.map(group => <div key={group.key} className={styles.paletteGroup} data-palette-group={group.key}>
        <span>{group.title}</span><div>{group.entries.map(({ socket, option }) => {
          const asset = assets.get(option.assetKey);
          if (!asset) return null;
          const target: DropTarget = { kind: "CONTEXT_SOCKET", contextOccurrenceId: card.contextOccurrenceId, slotKey: socket.slotKey };
          const item = socket.currentItems.find(current => current.optionKey === asset.optionKey && current.kind === asset.optionKind);
          const sourceKey = item && model.presentation.dragSources[`satellite:${card.contextOccurrenceId}:${socket.slotKey}:${item.selectionId}`]
            ? `satellite:${card.contextOccurrenceId}:${socket.slotKey}:${item.selectionId}` : asset.assetKey;
          const action = option.state === "EQUIPPED" ? "Équipé" : option.state === "ALTERNATIVE" ? "Remplacer avec" : "Équiper";
          return <button key={`${socket.slotKey}:${asset.assetKey}`} data-palette-asset={asset.assetKey} data-palette-slot={socket.slotKey}
            data-option-state={option.state} disabled={busy} title={`${action} ${asset.label} · ${socket.label ?? socket.slotKey}`}
            aria-label={`${action} ${asset.label} dans ${socket.label ?? socket.slotKey}`}
            draggable={!busy} data-drag-source={sourceKey} data-grabbed={interaction?.grabbed?.sourceKey === sourceKey}
            onDragStart={event => interaction?.start(sourceKey, event)} onDragEnd={() => interaction?.end()}
            onClick={() => interaction ? interaction.equip(sourceKey, target) : choose(asset, target)}>
            <PlannerIcon iconKey={asset.iconKey} scale="PALETTE" /><span>{asset.label}</span>
            {option.state === "EQUIPPED" ? <Check size={13} /> : option.state === "SUGGESTED" ? <Sparkle size={13} />
              : option.state === "ALTERNATIVE" ? <ArrowLeftRight size={13} /> : <Plus size={13} />}
          </button>;
        })}</div>
      </div>)}</div> : <p className={styles.popoverNote}>Ce moment est préservé ou suivi par son éditeur habituel.</p>}
  </section>;
}
