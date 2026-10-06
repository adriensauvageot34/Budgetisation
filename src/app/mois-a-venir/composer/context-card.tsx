import { GripVertical, Trash2, Pin, Link2, Pencil, LockKeyhole } from "lucide-react";
import type { ComposerContextCardView, DropTarget, ComposerAssetView } from "@/domain/phase2/planner/composer-contract";
import type { ComponentSelectionV1 } from "@/domain/phase2/planner/component-contract";
import type { ComposerUiModel, ComposerOperation } from "@/domain/phase2/planner/composer-ui-contract";
import { ContextSocket } from "./context-socket";
import { knowledgeLabel } from "./display";
import { PlannerIcon } from "./planner-icons/planner-icon";
import styles from "./composer.module.css";
export function ContextCard({ card, model, busy, selected, focused, focus, drag, drop, choose, request, edit }: { card: ComposerContextCardView; model: ComposerUiModel; busy: boolean;
  focused: string | null; focus: (id: string | null) => void;
  selected: string | null; drag: (key: string | null) => void; drop: (target: DropTarget, key?: string) => void;
  choose: (asset: ComposerAssetView, target: DropTarget, selection?: ComponentSelectionV1) => void;
  request: (operation: ComposerOperation) => void; edit: (card: ComposerContextCardView) => void }) {
  const instance = `context-occurrence:${card.contextOccurrenceId}`;
  const removable = model.dropCapabilities.some(d => d.sourceAssetKey === instance && d.target.kind === "TRASH" && d.resolution !== "BLOCKED");
  const preserved = model.semanticState.preferences.flexibility[card.contextOccurrenceId] === "PRESERVE";
  const children = (id: string) => { const child = model.board.contexts.find(c => c.contextOccurrenceId === id); return child ? <ContextCard card={child} model={model} busy={busy} selected={selected} focused={focused} focus={focus} drag={drag} drop={drop} choose={choose} request={request} edit={edit} /> : null; };
  const presentation = model.presentation.objects[card.contextOccurrenceId];
  return <article className={styles.contextCard} data-context={card.contextOccurrenceId} data-focused={focused === card.contextOccurrenceId} data-variant={presentation.variant} data-state={card.readOnly ? "derived" : card.knowledge === "UNKNOWN" ? "unresolved" : "chosen"}
    onClick={e => { if (e.target instanceof Element && !e.target.closest("button,input,select,a,[popover]")) focus(card.contextOccurrenceId); }}>
    <div className={styles.contextOrbit}>
    <div className={styles.contextNucleus}>
    <PlannerIcon iconKey={presentation.iconKey} className={styles.contextObjectIcon} />
    <header className={styles.contextHeader}><div><h3><button data-context-focus aria-pressed={focused === card.contextOccurrenceId} onClick={() => focus(focused === card.contextOccurrenceId ? null : card.contextOccurrenceId)}>{card.label}</button></h3>{typeof card.fields.plannedDate === "string" && <p>{new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${card.fields.plannedDate}T12:00:00Z`))}</p>}
      <span className={styles.contextState} title={knowledgeLabel(card.knowledge)} aria-label={knowledgeLabel(card.knowledge)}>{preserved ? <LockKeyhole size={12} /> : card.readOnly ? <Link2 size={12} /> : card.knowledge === "UNKNOWN" ? <i /> : null}</span></div>
      <div className={styles.contextTools}>{!card.readOnly && <><button className={styles.iconButton} disabled={busy} aria-label={`${preserved ? "Libérer" : "Préserver"} ${card.label}`} aria-pressed={preserved} onClick={() => request({ kind: "PRESERVE", targetRef: card.contextOccurrenceId, preserve: !preserved })}><Pin size={15} /></button>
        <button className={styles.iconButton} disabled={busy || !card.capabilityRefs.includes("PATCH_CONTEXT")} aria-label={`Modifier les informations de ${card.label}`} onClick={() => edit(card)}><Pencil size={14} /></button>
        <button className={styles.dragHandle} disabled={busy || !removable} draggable={removable && !busy} aria-label={`Déplacer ${card.label}`} onClick={() => drag(selected === instance ? null : instance)} onDragStart={e => { e.dataTransfer.setData("application/x-planner-asset", instance); drag(instance); }} onDragEnd={() => drag(null)}><GripVertical size={17} /></button>
        <button className={styles.iconButton} disabled={busy || !removable} aria-label={`Retirer ${card.label}`} onClick={() => drop({ kind: "TRASH" }, instance)}><Trash2 size={15} /></button></>}</div></header>
    {card.readOnly && <p className={styles.externalNote}>Intention déjà connue · comptée une fois</p>}
    </div>
    {(["NORTH", "WEST", "EAST", "SOUTH"] as const).map(orbit => <div key={orbit} className={styles.orbitGroup} data-orbit={orbit}>{card.sockets.filter(s => model.presentation.sockets[`${card.contextOccurrenceId}:${s.slotKey}`].orbit === orbit).map(socket => {
      const socketPresentation = model.presentation.sockets[`${card.contextOccurrenceId}:${socket.slotKey}`];
      const assets = socketPresentation.options.map(o => model.library.searchableAssets.find(a => a.assetKey === o.assetKey)!);
      const compatible = !!selected && model.dropCapabilities.some(d => d.sourceAssetKey === selected && d.target.kind === "CONTEXT_SOCKET"
        && d.target.contextOccurrenceId === card.contextOccurrenceId && d.target.slotKey === socket.slotKey && d.resolution !== "BLOCKED");
      return <ContextSocket key={socket.slotKey} socket={socket} presentation={socketPresentation} focus={() => focus(card.contextOccurrenceId)} busy={busy} compatible={compatible} assets={assets} drop={drop} choose={choose}
        remove={item => request({ kind: "CLEAR_SOCKET", contextOccurrenceId: card.contextOccurrenceId, slotKey: socket.slotKey, selectionId: item.selectionId })}
        accept={item => request({ kind: "MUTATE", mutation: { kind: "PATCH_CONTEXT", contextOccurrenceId: card.contextOccurrenceId, slotKey: socket.slotKey, items: socket.currentItems.map(i => i.selectionId === item.selectionId ? { ...i, provenance: "EXPLICIT_USER_DECISION" } : i) } })} child={children} />;
    })}</div>)}
    </div>
  </article>;
}
