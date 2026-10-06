import { Plus, Check, Link2, Sparkle, ArrowLeftRight } from "lucide-react";
import type { ContextSocketView, DropTarget, ComposerAssetView } from "@/domain/phase2/planner/composer-contract";
import type { ComponentSelectionV1 } from "@/domain/phase2/planner/component-contract";
import type { ComposerSocketPresentation } from "@/domain/phase2/planner/composer-ui-contract";
import { money } from "./display";
import styles from "./composer.module.css";
import { PlannerIcon } from "./planner-icons/planner-icon";
import { AtomicPopover } from "./atomic-popover";
import { useComposerInteractions, sameTarget, leftSurface } from "./interactions";
export function ContextSocket({ socket, presentation, busy, compatible, assets, drop, choose, remove, accept, child, focus, moveTargets = [] }: {
  socket: ContextSocketView; presentation: ComposerSocketPresentation; busy: boolean; compatible: boolean; focus: () => void;
  assets: readonly ComposerAssetView[]; drop: (target: DropTarget, key?: string) => void; choose: (asset: ComposerAssetView, target: DropTarget, selection?: ComponentSelectionV1) => void;
  remove: (selection: ComponentSelectionV1) => void; accept: (selection: ComponentSelectionV1) => void; child: (id: string) => React.ReactNode;
  moveTargets?: readonly Readonly<{ selectionId: string; target: DropTarget; label: string }>[];
}) {
  const target: DropTarget = { kind: "CONTEXT_SOCKET", contextOccurrenceId: socket.contextOccurrenceId, slotKey: socket.slotKey };
  const interaction = useComposerInteractions();
  const choices = (close: () => void) => <div className={styles.socketActions}>
    {compatible && <button data-snap disabled={busy} onClick={() => { close(); drop(target); }} className={styles.snapButton}>Rattacher la carte sélectionnée ici</button>}
    {presentation.canAdd && <select data-socket-choice aria-label={`Choisir pour ${socket.label ?? socket.slotKey}`} disabled={busy} value="" onChange={e => {
      const asset = assets.find(a => a.assetKey === e.target.value); if (asset) { close(); choose(asset, target); }
    }}><option value="">{socket.cardinality === "REPEATING" ? "+ Ajouter" : "Choisir / remplacer"}</option>{presentation.options.map(option => {
      const asset = assets.find(a => a.assetKey === option.assetKey)!; return <option key={asset.assetKey} value={asset.assetKey}>{asset.label}</option>;
    })}</select>}
  </div>;
  return <section className={styles.socket} data-socket={`${socket.contextOccurrenceId}:${socket.slotKey}`} data-compatible={compatible} data-visual-state={socket.visualState}
    data-drag-over={sameTarget(interaction?.overTarget ?? null, target)}
    onDragOver={e => { e.stopPropagation(); if (compatible && !busy) { e.preventDefault(); e.dataTransfer.dropEffect = "move"; interaction?.over(target); } else interaction?.over(null); }}
    onDragLeave={e => { e.stopPropagation(); if (leftSurface(e)) interaction?.over(null); }}
    onDrop={e => { e.preventDefault(); e.stopPropagation(); if (compatible && !busy) { if (interaction?.grabbed) interaction.place(target); else drop(target, e.dataTransfer.getData("application/x-planner-asset")); } }}>
    {presentation.satellites.map(satellite => {
      const item = socket.currentItems.find(i => i.selectionId === satellite.selectionId)!;
      const editAsset = assets.find(a => a.assetKey === satellite.editableAssetKey);
      const stateLabel = { CHOSEN: "Choisi", SUGGESTED: "Suggestion personnelle", DERIVED: "Dérivé", UNRESOLVED: "À préciser" }[satellite.state];
      return <AtomicPopover key={item.selectionId} label={`${satellite.label} · ${stateLabel}`} state={satellite.state} selectionId={item.selectionId} focus={focus}
        dragSourceKey={satellite.state === "DERIVED" ? undefined : satellite.childContextOccurrenceId ? `context-occurrence:${satellite.childContextOccurrenceId}` : satellite.editableAssetKey ? `satellite:${socket.contextOccurrenceId}:${socket.slotKey}:${item.selectionId}` : undefined}
        icon={<><PlannerIcon iconKey={satellite.iconKey} scale="SATELLITE" /><span className={styles.satelliteMarker} aria-hidden="true">
          {satellite.state === "SUGGESTED" ? <Sparkle size={10} /> : satellite.state === "DERIVED" ? <Link2 size={10} /> : satellite.state === "UNRESOLVED" ? <i /> : <Check size={9} />}</span></>}>
        {close => <><p className={styles.popoverAmount}>{satellite.state === "SUGGESTED" ? "Hors coût · à accepter" : satellite.costCaption ?? `Retenu : ${money(satellite.economicAmount)}`}</p>
          {satellite.details.map(line => <p key={line} className={styles.popoverNote}>{line}</p>)}
          {satellite.childContextOccurrenceId && child(satellite.childContextOccurrenceId)}
          <div className={styles.popoverActions}>{satellite.canAccept && <button disabled={busy} onClick={() => { close(); accept(item); }}>Accepter</button>}
            {editAsset && !satellite.canAccept && <button disabled={busy} onClick={() => { close(); choose(editAsset, target, item); }}>Modifier</button>}
            {satellite.canRemove && <button disabled={busy} onClick={() => { close(); remove(item); }}>Retirer de ce moment</button>}
            {moveTargets.filter(t => t.selectionId === item.selectionId).map(t => <button key={`${t.target.contextOccurrenceId}:${t.target.slotKey}`} disabled={busy}
              onClick={() => { close(); interaction?.equip(`satellite:${socket.contextOccurrenceId}:${socket.slotKey}:${item.selectionId}`, t.target); }}>Rattacher à {t.label}</button>)}</div>
          {choices(close)}</>}
      </AtomicPopover>;
    })}
    {presentation.canAdd && (socket.cardinality === "REPEATING" || !socket.currentItems.length) && <AtomicPopover label={`Ajouter · ${socket.label ?? socket.slotKey}`} state="EMPTY" empty focus={focus}
      icon={<Plus size={16} aria-hidden="true" />}>{close => <><p className={styles.popoverNote}>Choisissez un élément pour ce moment.</p>{choices(close)}</>}</AtomicPopover>}
    {compatible && !presentation.satellites.length && !presentation.canAdd && <AtomicPopover label={`Placer · ${socket.label ?? socket.slotKey}`} state="EMPTY" empty focus={focus}
      icon={<ArrowLeftRight size={16} />}>{close => choices(close)}</AtomicPopover>}
  </section>;
}
