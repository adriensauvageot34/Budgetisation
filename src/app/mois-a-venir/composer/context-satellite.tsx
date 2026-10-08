import { Check, Link2, Sparkle } from "lucide-react";
import type { ComposerAssetView, DropTarget } from "@/domain/phase2/planner/composer-contract";
import type { ComponentSelectionV1 } from "@/domain/phase2/planner/component-contract";
import type { ComposerSatellitePresentation } from "@/domain/phase2/planner/composer-ui-contract";
import { AtomicPopover } from "./atomic-popover";
import { money } from "./display";
import { useComposerInteractions } from "./interactions";
import { PlannerIcon } from "./planner-icons/planner-icon";
import styles from "./composer.module.css";

export function ContextSatellite({ satellite, item, target, editAsset, busy, focus, choose, remove, accept, child, moveTargets }: {
  satellite: ComposerSatellitePresentation; item: ComponentSelectionV1; target: DropTarget;
  editAsset?: ComposerAssetView; busy: boolean; focus: () => void;
  choose: (asset: ComposerAssetView, target: DropTarget, selection?: ComponentSelectionV1) => void;
  remove: (selection: ComponentSelectionV1) => void; accept: (selection: ComponentSelectionV1) => void;
  child: (id: string) => React.ReactNode;
  moveTargets: readonly Readonly<{ target: DropTarget; label: string }>[];
}) {
  const interaction = useComposerInteractions();
  const title = satellite.label.replace(/^Synthetic\s+/i, "").replace(/^./, letter => letter.toUpperCase());
  const sourceKey = satellite.state === "DERIVED" ? undefined : satellite.childContextOccurrenceId
    ? `context-occurrence:${satellite.childContextOccurrenceId}` : satellite.editableAssetKey
      ? `satellite:${target.contextOccurrenceId}:${target.slotKey}:${item.selectionId}` : undefined;
  const stateText = satellite.state === "SUGGESTED" ? "Suggestion à confirmer" : satellite.state === "DERIVED" ? "Lié à un autre objet"
    : satellite.state === "UNRESOLVED" ? "À préciser" : "Équipé pour ce moment";
  return <AtomicPopover label={title} state={satellite.state} selectionId={item.selectionId} focus={focus} dragSourceKey={sourceKey}
    icon={<><PlannerIcon iconKey={satellite.iconKey} scale="SATELLITE" /><span className={styles.satelliteMarker} aria-hidden="true">
      {satellite.state === "SUGGESTED" ? <Sparkle size={10} /> : satellite.state === "DERIVED" ? <Link2 size={10} /> : satellite.state === "UNRESOLVED" ? <i /> : <Check size={9} />}</span></>}>
    {close => <div className={styles.objectSheet} data-object-sheet>
      <p className={styles.objectSheetState}>{stateText}</p>
      <p className={styles.popoverAmount}>{satellite.state === "SUGGESTED" ? "À confirmer avant de compter ce choix" : satellite.costCaption
        ?? (satellite.economicAmount === null ? "Montant non disponible" : `Retenu : ${money(satellite.economicAmount)}`)}</p>
      <div className={styles.popoverActions}>
        {satellite.canAccept && <button disabled={busy} onClick={() => { close(); accept(item); }}>Accepter la suggestion</button>}
        {editAsset && !satellite.canAccept && <button disabled={busy} onClick={() => { close(); choose(editAsset, target, item); }}>Modifier</button>}
      </div>
      {satellite.childContextOccurrenceId && <details className={styles.objectSheetDetails}><summary>Ouvrir ce moment lié</summary>{child(satellite.childContextOccurrenceId)}</details>}
      {(satellite.details.length > 0 || satellite.canRemove || moveTargets.length > 0) && <details className={styles.objectSheetDetails}>
        <summary>Autres actions et détails</summary>
        {satellite.details.map(line => <p key={line} className={styles.popoverNote}>{line}</p>)}
        <div className={styles.popoverActions}>
          {satellite.canRemove && <button disabled={busy} onClick={() => { close(); remove(item); }}>Retirer de ce moment</button>}
          {moveTargets.map(({ target: destination, label }) => <button key={`${destination.contextOccurrenceId}:${destination.slotKey}`} disabled={busy}
            onClick={() => { close(); if (sourceKey) interaction?.equip(sourceKey, destination); }}>Rattacher à {label}</button>)}
        </div>
      </details>}
    </div>}
  </AtomicPopover>;
}
