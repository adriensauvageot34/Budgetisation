import { GripVertical, MoreHorizontal, Pin, Link2, Pencil, LockKeyhole } from "lucide-react";
import type { ComposerContextCardView, DropTarget, ComposerAssetView } from "@/domain/phase2/planner/composer-contract";
import type { ComponentSelectionV1 } from "@/domain/phase2/planner/component-contract";
import type { ComposerUiModel, ComposerOperation } from "@/domain/phase2/planner/composer-ui-contract";
import { ContextSocket } from "./context-socket";
import { knowledgeLabel } from "./display";
import { PlannerIcon } from "./planner-icons/planner-icon";
import styles from "./composer.module.css";
import { AtomicPopover } from "./atomic-popover";
import { useComposerInteractions, useDragHandle, leftSurface } from "./interactions";
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
  const interaction = useComposerInteractions(), handle = useDragHandle(instance);
  const targets = selected ? model.dropCapabilities.filter(d => d.sourceAssetKey === selected && d.target.kind === "CONTEXT_SOCKET" && d.target.contextOccurrenceId === card.contextOccurrenceId && d.resolution !== "BLOCKED") : [];
  const magnetic = targets.length === 1 ? targets[0].target : null;
  const reparentTargets = model.dropCapabilities.filter(d => d.sourceAssetKey === instance && d.target.kind === "CONTEXT_SOCKET" && d.resolution !== "BLOCKED");
  return <article className={styles.contextCard} data-context={card.contextOccurrenceId} data-focused={focused === card.contextOccurrenceId} data-variant={presentation.variant} data-state={card.readOnly ? "derived" : card.knowledge === "UNKNOWN" ? "unresolved" : "chosen"}
    data-compatible={targets.length > 0 || interaction?.canTarget(card.contextOccurrenceId)} data-magnetic={interaction?.overTarget?.contextOccurrenceId === card.contextOccurrenceId}
    data-unresolved={interaction?.unresolvedRefs.includes(card.contextOccurrenceId)} data-snap={interaction?.motionTarget === card.contextOccurrenceId ? interaction.motion : undefined}
    data-grabbed={interaction?.grabbed?.sourceKey === instance} data-recoil={interaction?.motion === "recoil" && interaction.motionTarget === instance}
    onDragOver={e => { e.stopPropagation(); if (interaction?.canTarget(card.contextOccurrenceId) && !busy) { e.preventDefault(); interaction.overAssistant(card.contextOccurrenceId); } else if (magnetic && interaction?.grabbed && !busy) { e.preventDefault(); interaction.over(magnetic); } else interaction?.over(null); }}
    onDragLeave={e => { e.stopPropagation(); if (leftSurface(e)) { interaction?.over(null); interaction?.overAssistant(null); } }}
    onDrop={e => { e.preventDefault(); e.stopPropagation(); if (interaction?.canTarget(card.contextOccurrenceId) && !busy) interaction.placeAssistant(card.contextOccurrenceId); else if (magnetic && interaction?.grabbed && !busy) interaction.place(magnetic); }}
    onClick={e => { if (e.target instanceof Element && !e.target.closest("button,input,select,a,[popover]")) focus(card.contextOccurrenceId); }}>
    {magnetic && interaction?.grabbed && <span className={styles.magneticLabel}>Rattacher à {card.label}</span>}
    <div className={styles.contextOrbit}>
    <div className={styles.contextNucleus}>
    <PlannerIcon iconKey={presentation.iconKey} className={styles.contextObjectIcon} />
    <header className={styles.contextHeader}><div><h3><button data-context-focus aria-pressed={focused === card.contextOccurrenceId} onClick={() => focus(focused === card.contextOccurrenceId ? null : card.contextOccurrenceId)}>{card.label}</button></h3>{typeof card.fields.plannedDate === "string" && <p>{new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${card.fields.plannedDate}T12:00:00Z`))}</p>}
      <span className={styles.contextState} title={knowledgeLabel(card.knowledge)} aria-label={knowledgeLabel(card.knowledge)}>{preserved ? <LockKeyhole size={12} /> : card.readOnly ? <Link2 size={12} /> : card.knowledge === "UNKNOWN" ? <i /> : null}</span></div>
      <div className={styles.contextTools}>{!card.readOnly && <><button className={styles.iconButton} disabled={busy} aria-label={`${preserved ? "Libérer" : "Préserver"} ${card.label}`} aria-pressed={preserved} onClick={() => request({ kind: "PRESERVE", targetRef: card.contextOccurrenceId, preserve: !preserved })}><Pin size={15} /></button>
        <button className={styles.iconButton} disabled={busy || !card.capabilityRefs.includes("PATCH_CONTEXT")} aria-label={`Modifier les informations de ${card.label}`} onClick={() => edit(card)}><Pencil size={14} /></button>
        <button className={styles.dragHandle} disabled={busy} {...handle} aria-label={`Déplacer ${card.label}`} onClick={() => drag(selected === instance ? null : instance)}><GripVertical size={17} /></button>
        <AtomicPopover utility label={`Actions de ${card.label}`} state="ACTIONS" focus={() => focus(card.contextOccurrenceId)} icon={<MoreHorizontal size={15} />}>{close => <div className={styles.popoverActions}>
          {removable && <button disabled={busy} aria-label={`Retirer ${card.label}`} onClick={() => { close(); drop({ kind: "TRASH" }, instance); }}>Retirer ce moment</button>}
          {reparentTargets.map(d => <button key={`${d.target.contextOccurrenceId}:${d.target.slotKey}`} disabled={busy} onClick={() => { close(); drop(d.target, instance); }}>Rattacher à {model.board.contexts.find(c => c.contextOccurrenceId === d.target.contextOccurrenceId)?.label} · {model.board.contexts.find(c => c.contextOccurrenceId === d.target.contextOccurrenceId)?.sockets.find(s => s.slotKey === d.target.slotKey)?.label}</button>)}
          {!removable && <p>Moment protégé dans ce brouillon.</p>}</div>}</AtomicPopover></>}</div></header>
    {card.readOnly && <p className={styles.externalNote}>Intention déjà connue · comptée une fois</p>}
    </div>
    {(["NORTH", "WEST", "EAST", "SOUTH"] as const).map(orbit => <div key={orbit} className={styles.orbitGroup} data-orbit={orbit}>{card.sockets.filter(s => model.presentation.sockets[`${card.contextOccurrenceId}:${s.slotKey}`].orbit === orbit).map(socket => {
      const socketPresentation = model.presentation.sockets[`${card.contextOccurrenceId}:${socket.slotKey}`];
      const assets = socketPresentation.options.map(o => model.library.searchableAssets.find(a => a.assetKey === o.assetKey)!);
      const compatible = !!selected && model.dropCapabilities.some(d => d.sourceAssetKey === selected && d.target.kind === "CONTEXT_SOCKET"
        && d.target.contextOccurrenceId === card.contextOccurrenceId && d.target.slotKey === socket.slotKey && d.resolution !== "BLOCKED");
      return <ContextSocket key={socket.slotKey} socket={socket} presentation={socketPresentation} focus={() => focus(card.contextOccurrenceId)} busy={busy} compatible={compatible} assets={assets} drop={drop} choose={choose}
        moveTargets={socketPresentation.satellites.flatMap(item => model.dropCapabilities.filter(d => d.sourceAssetKey === item.editableAssetKey && d.target.kind === "CONTEXT_SOCKET"
          && d.resolution !== "BLOCKED" && (d.target.contextOccurrenceId !== card.contextOccurrenceId || d.target.slotKey !== socket.slotKey))
          .map(d => ({ selectionId: item.selectionId, target: d.target, label: `${model.board.contexts.find(c => c.contextOccurrenceId === d.target.contextOccurrenceId)?.label} · ${model.board.contexts.find(c => c.contextOccurrenceId === d.target.contextOccurrenceId)?.sockets.find(s => s.slotKey === d.target.slotKey)?.label}` })))}
        remove={item => request({ kind: "CLEAR_SOCKET", contextOccurrenceId: card.contextOccurrenceId, slotKey: socket.slotKey, selectionId: item.selectionId })}
        accept={item => request({ kind: "MUTATE", mutation: { kind: "PATCH_CONTEXT", contextOccurrenceId: card.contextOccurrenceId, slotKey: socket.slotKey, items: socket.currentItems.map(i => i.selectionId === item.selectionId ? { ...i, provenance: "EXPLICIT_USER_DECISION" } : i) } })} child={children} />;
    })}</div>)}
    </div>
  </article>;
}
