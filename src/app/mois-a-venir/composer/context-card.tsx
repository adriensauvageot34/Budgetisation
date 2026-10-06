import { GripVertical, Trash2, Pin, Link2, Pencil } from "lucide-react";
import type { ComposerContextCardView, DropTarget, ComposerAssetView } from "@/domain/phase2/planner/composer-contract";
import type { ComponentSelectionV1 } from "@/domain/phase2/planner/component-contract";
import type { ComposerUiModel, ComposerOperation } from "@/domain/phase2/planner/composer-ui-contract";
import { ContextSocket } from "./context-socket";
import { knowledgeLabel } from "./display";
import styles from "./composer.module.css";
export function ContextCard({ card, model, busy, selected, drag, drop, choose, request, edit }: { card: ComposerContextCardView; model: ComposerUiModel; busy: boolean;
  selected: string | null; drag: (key: string | null) => void; drop: (target: DropTarget, key?: string) => void;
  choose: (asset: ComposerAssetView, target: DropTarget, selection?: ComponentSelectionV1) => void;
  request: (operation: ComposerOperation) => void; edit: (card: ComposerContextCardView) => void }) {
  const instance = `context-occurrence:${card.contextOccurrenceId}`;
  const removable = model.dropCapabilities.some(d => d.sourceAssetKey === instance && d.target.kind === "TRASH" && d.resolution !== "BLOCKED");
  const preserved = model.semanticState.preferences.flexibility[card.contextOccurrenceId] === "PRESERVE";
  const children = (id: string) => { const child = model.board.contexts.find(c => c.contextOccurrenceId === id); return child ? <ContextCard card={child} model={model} busy={busy} selected={selected} drag={drag} drop={drop} choose={choose} request={request} edit={edit} /> : null; };
  return <article className={styles.contextCard} data-context={card.contextOccurrenceId} data-state={card.readOnly ? "derived" : card.knowledge === "UNKNOWN" ? "unresolved" : "chosen"}>
    <header className={styles.contextHeader}><div><span className={styles.badge}>{card.readOnly ? "Intention externe" : model.appliedContextIds.includes(card.contextOccurrenceId) ? "Appliqué" : "Brouillon"} · {knowledgeLabel(card.knowledge)}</span><h3>{card.label}</h3>{typeof card.fields.plannedDate === "string" && <p>{new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${card.fields.plannedDate}T12:00:00Z`))}</p>}</div>
      <div className={styles.contextTools}>{!card.readOnly && <><button className={styles.iconButton} disabled={busy} aria-label={`${preserved ? "Libérer" : "Préserver"} ${card.label}`} aria-pressed={preserved} onClick={() => request({ kind: "PRESERVE", targetRef: card.contextOccurrenceId, preserve: !preserved })}><Pin size={15} /></button>
        <button className={styles.iconButton} disabled={busy || !card.capabilityRefs.includes("PATCH_CONTEXT")} aria-label={`Modifier les informations de ${card.label}`} onClick={() => edit(card)}><Pencil size={14} /></button>
        <button className={styles.dragHandle} disabled={busy || !removable} draggable={removable && !busy} aria-label={`Déplacer ${card.label}`} onClick={() => drag(selected === instance ? null : instance)} onDragStart={e => { e.dataTransfer.setData("application/x-planner-asset", instance); drag(instance); }} onDragEnd={() => drag(null)}><GripVertical size={17} /></button>
        <button className={styles.iconButton} disabled={busy || !removable} aria-label={`Retirer ${card.label}`} onClick={() => drop({ kind: "TRASH" }, instance)}><Trash2 size={15} /></button></>}</div></header>
    {card.readOnly ? <p className={styles.helper}><Link2 size={13} /> Intention déjà connue, comptée une fois. Son éditeur habituel reste propriétaire.</p> : card.sockets.map(socket => {
      const target: DropTarget = { kind: "CONTEXT_SOCKET", contextOccurrenceId: card.contextOccurrenceId, slotKey: socket.slotKey };
      const matches = (d: ComposerUiModel["dropCapabilities"][number]) => d.target.contextOccurrenceId === card.contextOccurrenceId && d.target.slotKey === socket.slotKey && d.resolution !== "BLOCKED";
      const assets = model.library.searchableAssets.filter(a => (!socket.choiceAssetKeys || socket.choiceAssetKeys.includes(a.assetKey)) && model.dropCapabilities.some(d => d.sourceAssetKey === a.assetKey && matches(d)));
      const compatible = !!selected && model.dropCapabilities.some(d => d.sourceAssetKey === selected && matches(d));
      return <ContextSocket key={socket.slotKey} socket={socket} busy={busy} compatible={compatible} assets={assets} drop={drop} choose={choose}
        remove={item => request({ kind: "CLEAR_SOCKET", contextOccurrenceId: card.contextOccurrenceId, slotKey: socket.slotKey, selectionId: item.selectionId })}
        accept={item => request({ kind: "MUTATE", mutation: { kind: "PATCH_CONTEXT", contextOccurrenceId: card.contextOccurrenceId, slotKey: socket.slotKey, items: socket.currentItems.map(i => i.selectionId === item.selectionId ? { ...i, provenance: "EXPLICIT_USER_DECISION" } : i) } })} child={children} />;
    })}
  </article>;
}
