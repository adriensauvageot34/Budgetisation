import { Check, Sparkle, ArrowLeftRight, X } from "lucide-react";
import type { ComposerUiModel } from "@/domain/phase2/planner/composer-ui-contract";
import type { ComposerAssetView, ComposerContextCardView, DropTarget } from "@/domain/phase2/planner/composer-contract";
import { PlannerIcon } from "./planner-icons/planner-icon";
import styles from "./composer.module.css";
import { useComposerInteractions } from "./interactions";

export function ContextPalette({ card, model, busy, choose, close }: { card: ComposerContextCardView; model: ComposerUiModel; busy: boolean;
  choose: (asset: ComposerAssetView, target: DropTarget) => void; close: () => void;
}) {
  const interaction = useComposerInteractions();
  return <section className={styles.contextPalette} data-context-palette={card.contextOccurrenceId} aria-label={`Équiper ${card.label}`}>
    <header><div><h3>Équiper · {card.label}</h3><p>Ajoutez ou remplacez des éléments de ce moment.</p></div><button className={styles.iconButton} aria-label="Quitter la sélection du moment" onClick={close}><X size={16} /></button></header>
    <div className={styles.paletteOptions}>{card.sockets.map(socket => <div key={socket.slotKey} className={styles.paletteGroup}>
      {model.presentation.sockets[`${card.contextOccurrenceId}:${socket.slotKey}`].options.length > 0 && <span>{socket.label ?? socket.slotKey}</span>}
      {model.presentation.sockets[`${card.contextOccurrenceId}:${socket.slotKey}`].options.map(option => {
        const asset = model.library.searchableAssets.find(a => a.assetKey === option.assetKey)!;
        const item = socket.currentItems.find(i => i.optionKey === asset.optionKey && i.kind === asset.optionKind);
        const sourceKey = item && model.presentation.dragSources[`satellite:${card.contextOccurrenceId}:${socket.slotKey}:${item.selectionId}`]
          ? `satellite:${card.contextOccurrenceId}:${socket.slotKey}:${item.selectionId}` : asset.assetKey;
        return <button key={asset.assetKey} data-palette-asset={asset.assetKey} data-option-state={option.state} disabled={busy} title={option.state === "ALTERNATIVE" ? `Remplacer par ${asset.label}` : asset.label}
          draggable={!busy} data-drag-source={sourceKey} data-grabbed={interaction?.grabbed?.sourceKey === sourceKey} onDragStart={e => interaction?.start(sourceKey, e)} onDragEnd={() => interaction?.end()}
          onClick={() => interaction ? interaction.equip(sourceKey, { kind: "CONTEXT_SOCKET", contextOccurrenceId: card.contextOccurrenceId, slotKey: socket.slotKey }) : choose(asset, { kind: "CONTEXT_SOCKET", contextOccurrenceId: card.contextOccurrenceId, slotKey: socket.slotKey })}>
          <PlannerIcon iconKey={asset.iconKey} scale="SATELLITE" /><span>{asset.label}</span>
          {option.state === "EQUIPPED" ? <Check size={11} /> : option.state === "SUGGESTED" ? <Sparkle size={11} /> : option.state === "ALTERNATIVE" ? <ArrowLeftRight size={12} /> : null}
        </button>;
      })}</div>)}</div>
    {!card.sockets.some(s => model.presentation.sockets[`${card.contextOccurrenceId}:${s.slotKey}`].options.length) && <p className={styles.popoverNote}>Ce moment est préservé ou suivi par son éditeur habituel.</p>}
  </section>;
}
