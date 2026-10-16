import { memo, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
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
import { inventoryItems, inventoryRootRef } from "./inventory-layout";
import type { AtomicNode, VisualClusterNode, ComposerPresentationNode } from "./presentation/node-types";
import { VisualClusterCard, VisualClusterOverlay } from "./visual-cluster";
import { composerRenderIndex } from "./render-index";
type BoardProps=Parameters<typeof ComposerBoard>[0];
const InventoryAtomic = memo(function InventoryAtomic({item,inCluster,closeCluster,...props}:Pick<BoardProps,"model"|"busy"|"selected"|"focused"|"focus"|"edit"|"editContext"|"choose"|"drag"|"drop"|"request"|"hover"> & {item:AtomicNode;inCluster:boolean;closeCluster:()=>void}) {
  const {model,busy,selected,focused,focus,edit,editContext,choose,drag,drop,request,hover}=props,index=composerRenderIndex(model);
  // The drag geometry may be held, but card values always use the current model.
  if(item.context){const card=index.contexts.get(item.id);return card?<ContextCard card={card} model={model} busy={busy} selected={selected} focused={focused} focus={focus} drag={drag} drop={drop} choose={choose} request={request} edit={value=>{if(inCluster)closeCluster();editContext(value);}}/>:null;}
  const card=index.controls.get(item.id);if(!card)return null;
  return <ComposerCard card={card} presentation={model.presentation.objects[item.id]} busy={busy} focused={focused===item.id} focus={()=>focus(item.id)}
    preserved={model.semanticState.preferences.flexibility[item.id]==="PRESERVE"} edit={()=>{if(inCluster)closeCluster();edit(card);}}
    preserve={()=>request({kind:"PRESERVE",targetRef:item.id,preserve:model.semanticState.preferences.flexibility[item.id]!=="PRESERVE"})}
    mutate={mutation=>request({kind:"MUTATE",mutation})} hover={hover}/>;
});
export function ComposerBoard({ model, busy, selected, focused, focus, edit, choose, drag, drop, request, hover, editContext, add, preview, balance, details, contextGuide, reveal }: { model: ComposerUiModel; busy: boolean; selected: string | null;
  focused: string | null; focus: (id: string | null) => void;
  edit: (card: ComposerCardView) => void; choose: (asset: ComposerAssetView, target: DropTarget, selection?: ComponentSelectionV1) => void;
  drag: (key: string | null) => void; drop: (target: DropTarget, key?: string) => void; request: (operation: ComposerOperation) => void; hover: (mutation: SemanticMutation | null) => void; editContext: (card: ComposerContextCardView) => void;
  add: () => void; preview: () => void; balance: () => void; details: () => void; contextGuide?: ReactNode; reveal?: { targetRef: string; sequence: number } | null }) {
  const boardAccepts = !!selected && (model.dropCapabilities.some(d => d.sourceAssetKey === selected && d.target.kind === "BOARD_ZONE" && d.resolution !== "BLOCKED")
    || model.presentation.dragSources[selected]?.editorDropTarget?.kind === "BOARD_ZONE");
  const trashAccepts = !!selected && model.dropCapabilities.some(d => d.sourceAssetKey === selected && d.target.kind === "TRASH" && d.resolution !== "BLOCKED");
  const focusedCard = model.board.contexts.find(c => c.contextOccurrenceId === focused);
  const interaction = useComposerInteractions();
  const trashVisible = !!interaction?.grabbed && (!!interaction.grabbed.removeOperation || interaction.grabbed.protected);
  const boardTarget: DropTarget = { kind: "BOARD_ZONE" }, trashTarget: DropTarget = { kind: "TRASH" };
  const [openClusterId, setOpenClusterId] = useState<string | null>(null);
  const restaurantFocus = contextGuide && focusedCard?.templateKey === "restaurant" ? focusedCard.contextOccurrenceId : null;
  const items=useMemo(()=>inventoryItems(model).flatMap<ComposerPresentationNode>(item => {
    if (item.kind !== "CLUSTER" || !restaurantFocus) return [item];
    const selected = item.children.find(child => child.id === restaurantFocus);
    if (!selected) return [item];
    const remaining = item.children.filter(child => child.id !== restaurantFocus);
    // Keep the intention visible while its guide is open; this is transient layout only.
    return [selected, ...(remaining.length > 1 ? [{ ...item, children: remaining }] : remaining)];
  }),[model,restaurantFocus]),closeCluster=useCallback(()=>setOpenClusterId(null),[]);
  const openCluster = items.find((item): item is VisualClusterNode => item.kind === "CLUSTER" && item.id === openClusterId);
  const lastReveal = useRef<number | null>(null);
  const [selectionReveal, setSelectionReveal] = useState(0);
  const revealFocused = () => {
    setSelectionReveal(value => value + 1);
    const root = focused && inventoryRootRef(focused, model);
    const cluster = items.find(item => item.kind === "CLUSTER" && item.children.some(child => child.id === root));
    if (cluster) setOpenClusterId(cluster.id);
  };
  useEffect(() => {
    if (!reveal || lastReveal.current === reveal.sequence) return;
    lastReveal.current = reveal.sequence;
    const root = inventoryRootRef(reveal.targetRef, model);
    const cluster = items.find(item => item.kind === "CLUSTER" && item.children.some(child => child.id === root));
    setOpenClusterId(cluster?.id ?? null);
    // Only an explicit inspector navigation opens a group, never a layout update.
  }, [reveal, items, model]);
  useEffect(() => { if (openClusterId && !openCluster) setOpenClusterId(null); }, [openClusterId, openCluster]);
  const focusedInCluster = !!openCluster?.children.some(child => child.id === focusedCard?.contextOccurrenceId);
  const renderAtomic = (item:AtomicNode,inCluster=false)=><InventoryAtomic item={item} inCluster={inCluster} closeCluster={closeCluster}
    model={model} busy={busy} selected={selected} focused={focused} focus={focus} drag={drag} drop={drop} choose={choose} request={request} edit={edit} editContext={editContext} hover={hover}/>;
  const palette = focusedCard && <div className={styles.paletteDock} data-palette-dock>{contextGuide ?? <ContextPalette card={focusedCard} model={model} busy={busy} choose={choose} onConfigure={!focusedCard.readOnly ? () => editContext(focusedCard) : undefined} close={() => focus(null)} />}</div>;
  const trashZone = trashVisible && <div className={styles.trash} data-trash data-protected={interaction?.grabbed?.protected} data-compatible={trashAccepts || !!interaction?.grabbed?.removeOperation} data-drag-over={sameTarget(interaction?.overTarget ?? null, trashTarget)}
    role="status" aria-label={interaction?.grabbed?.protected ? "Protégée · retrait interdit" : "Retirer l’élément saisi"}
    onDragOver={e => { e.stopPropagation(); if (!busy && !interaction?.grabbed?.protected) { e.preventDefault(); interaction?.over(trashTarget); } }}
    onDragEnter={() => { if (interaction?.grabbed?.protected) interaction.reject(); }}
    onDragLeave={() => interaction?.over(null)} onDrop={e => { e.preventDefault(); e.stopPropagation(); if (!busy) interaction?.place(trashTarget); }}>
    {interaction?.grabbed?.protected ? <LockKeyhole size={17} /> : <Trash2 size={17} />}{interaction?.grabbed?.protected ? "Protégée" : "Retirer"}</div>;
  return <section className={styles.board} aria-label="Board du mois">
    <div className={styles.boardHeading}><h2>Votre mois prend forme</h2><span>Besoins & habitudes · intentions ponctuelles</span></div>
    <BoardCarousel model={model} inventory={items} focused={focused} revealSequence={(reveal?.sequence ?? 0) + selectionReveal} revealFocused={revealFocused} emptyClick={() => focus(null)} dropProps={{ "data-compatible": boardAccepts,
      "data-drag-over": sameTarget(interaction?.overTarget ?? null, boardTarget),
      onDragOver: e => { if (boardAccepts && !busy) { e.preventDefault(); e.dataTransfer.dropEffect = "move"; interaction?.over(boardTarget); } else interaction?.over(null); },
      onDragLeave: e => { if (leftSurface(e)) interaction?.over(null); },
      onDrop: e => { e.preventDefault(); if (boardAccepts && !busy) { if (interaction?.grabbed) interaction.place(boardTarget); else drop(boardTarget, e.dataTransfer.getData("application/x-planner-asset")); } }
    }} render={item => item.kind === "CLUSTER" ? <VisualClusterCard node={item} open={() => setOpenClusterId(item.id)} /> : renderAtomic(item)}>
      {interaction?.grabbed?.pack && <article className={styles.packGhost} data-pack-ghost aria-label={`Aperçu de ${interaction.grabbed.label}`}><PlannerIcon iconKey={interaction.grabbed.iconKey} /><h3>{interaction.grabbed.label}</h3>
          <div>{interaction.grabbed.pack.map((s, index) => <span key={`${s.label}:${index}`} title={`${s.label} · ${s.provenance}`}><PlannerIcon iconKey={s.iconKey} scale="SATELLITE" /><small>{s.label}</small></span>)}</div><p>Estimation après ajout</p></article>}
    </BoardCarousel>
    {openCluster && <VisualClusterOverlay node={openCluster} focused={focused} close={() => setOpenClusterId(null)} renderChild={item => renderAtomic(item, true)} palette={focusedInCluster ? palette : null} trash={trashZone} />}
    {model.presentation.elementCount < 4 && <button data-add-element className={styles.emptyInvitation} disabled={busy} onClick={add}><Plus size={14} /> Ajouter à votre mois</button>}
    {!focusedInCluster && palette}
    {!openCluster && trashZone}
  </section>;
}
