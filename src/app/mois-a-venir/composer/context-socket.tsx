import { Plus, X } from "lucide-react";
import type { ContextSocketView, DropTarget, ComposerAssetView } from "@/domain/phase2/planner/composer-contract";
import type { ComponentSelectionV1 } from "@/domain/phase2/planner/component-contract";
import { money } from "./display";
import styles from "./composer.module.css";
import { PlannerIcon } from "./planner-icons/planner-icon";
export function ContextSocket({ socket, busy, compatible, assets, drop, choose, remove, accept, child }: { socket: ContextSocketView; busy: boolean; compatible: boolean;
  assets: readonly ComposerAssetView[]; drop: (target: DropTarget, key?: string) => void; choose: (asset: ComposerAssetView, target: DropTarget, selection?: ComponentSelectionV1) => void;
  remove: (selection: ComponentSelectionV1) => void; accept: (selection: ComponentSelectionV1) => void; child: (id: string) => React.ReactNode }) {
  const target: DropTarget = { kind: "CONTEXT_SOCKET", contextOccurrenceId: socket.contextOccurrenceId, slotKey: socket.slotKey };
  const [first] = assets;
  return <section className={styles.socket} data-socket={`${socket.contextOccurrenceId}:${socket.slotKey}`} data-compatible={compatible} data-visual-state={socket.visualState}
    onDragOver={e => { if (compatible && !busy) { e.preventDefault(); e.stopPropagation(); e.dataTransfer.dropEffect = "move"; } }}
    onDrop={e => { e.preventDefault(); e.stopPropagation(); if (compatible && !busy) drop(target, e.dataTransfer.getData("application/x-planner-asset")); }}>
    <div className={styles.socketHeader}><h4>{socket.label ?? socket.slotKey}</h4><span>{socket.cardinality === "REPEATING" ? "Plusieurs possibles" : socket.cardinality === "REQUIRED_ONE" ? "À choisir" : "Facultatif"}</span></div>
    {socket.currentItems.map(item => item.kind === "CHILD_CONTEXT" ? <div key={item.selectionId}>{child(item.childContextOccurrenceId)}</div> : item.kind === "UNRESOLVED" ? <p key={item.selectionId} className={styles.ghost}>Un élément à choisir</p> : <div key={item.selectionId} className={`${styles.selection} ${item.provenance === "PERSONAL_SUGGESTION" ? styles.ghost : ""}`} data-selection={item.selectionId}>
      <PlannerIcon iconKey={assets.find(a => a.optionKey === item.optionKey)?.iconKey ?? socket.slotKey} scale="SATELLITE" />
      <span>{item.kind === "COMPONENT" ? item.label : assets.find(a => a.optionKey === item.optionKey)?.label ?? item.optionKey}<small>{item.provenance === "PERSONAL_SUGGESTION" ? "Suggestion · hors coût tant que non acceptée" : item.kind === "COMPONENT" ? `${money(socket.evaluations?.find(e => e.selectionId === item.selectionId)?.economicAmount)}${item.quantity !== "1.00" && item.quantity !== "1" ? ` · ${item.quantity} unités` : ""}` : "Mobilité évaluée par le serveur"}</small></span>
      {item.provenance === "PERSONAL_SUGGESTION" ? <button disabled={busy} onClick={() => accept(item)}>Accepter</button> : assets.find(a => a.optionKey === item.optionKey) && <button disabled={busy} onClick={() => choose(assets.find(a => a.optionKey === item.optionKey)!, target, item)}>Modifier</button>}
      <button className={styles.iconButton} disabled={busy || !assets.length} aria-label={`Retirer ${item.kind === "COMPONENT" ? item.label : "le transport"}`} onClick={() => remove(item)}><X size={13} /></button>
    </div>)}
    {!socket.currentItems.length && <p className={styles.ghost}>Glissez une carte ou choisissez ci-dessous</p>}
    <div className={styles.socketActions}>{compatible && <button disabled={busy} onClick={() => drop(target)} className={styles.snapButton}>Placer la carte sélectionnée ici</button>}
      {!!first && <select aria-label={`Choisir pour ${socket.label ?? socket.slotKey}`} disabled={busy} value="" onChange={e => { const asset = assets.find(a => a.assetKey === e.target.value); if (asset) choose(asset, target); }}><option value="">{socket.cardinality === "REPEATING" ? "+ Ajouter" : "Choisir / remplacer"}</option>{assets.map(a => <option key={a.assetKey} value={a.assetKey}>{a.label}</option>)}</select>}
    </div>
  </section>;
}
