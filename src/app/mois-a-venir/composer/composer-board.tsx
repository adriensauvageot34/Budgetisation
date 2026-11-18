import type {LivingBar} from "./bar-living-card";
import { memo, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Trash2, LockKeyhole } from "lucide-react";
import type { ComposerUiModel, ComposerOperation } from "@/domain/phase2/planner/composer-ui-contract";
import type { ComposerCardView, ComposerContextCardView, DropTarget, ComposerAssetView } from "@/domain/phase2/planner/composer-contract";
import type { ComponentSelectionV1 } from "@/domain/phase2/planner/component-contract";
import type { SemanticMutation } from "@/domain/phase2/planner/adjustment-contract";
import { FixedChargeCard, FixedChargesDetails } from "./fixed-charges";
import { ComposerCard } from "./composer-card";
import { ContextCard } from "./context-card";
import { ContextPalette } from "./context-palette";
import { CommerceDock } from "./commerce-dock";
import { useCommerceLibrary } from "./commerce-library";
import styles from "./composer.module.css";
import { useComposerInteractions, sameTarget, leftSurface } from "./interactions";
import { BoardCarousel } from "./board-carousel";
import { inventoryItems, inventoryRootRef } from "./inventory-layout";
import type { AtomicNode, VisualClusterNode, ComposerPresentationNode } from "./presentation/node-types";
import { VisualClusterCard, VisualClusterOverlay } from "./visual-cluster";
import { composerRenderIndex } from "./render-index";
import { useInlineEditRegistry } from "./inline-edit-registry";
import { presetForContext } from "@/domain/phase2/planner/composer-presets";
import type { RealizedCard } from "@/server/phase2/planner/realized-month";
import { CardReferenceDock, type CardReferenceKind } from "./card-reference-controls";
const reconstructionOrder = { fixed: 0, daily: 1, events: 2, flows: 3 };
type BoardProps=Parameters<typeof ComposerBoard>[0];
const InventoryAtomic = memo(function InventoryAtomic({item,inCluster,closeCluster,openEquipment,openReference,...props}:Pick<BoardProps,"model"|"busy"|"selected"|"focused"|"focus"|"edit"|"editContext"|"choose"|"drag"|"drop"|"request"|"hover"|"details"|"livingBar"> & {item:AtomicNode;inCluster:boolean;closeCluster:(after?:()=>void)=>boolean;openEquipment:(id:string,slotKey?:string)=>void;openReference:(id:string,kind:CardReferenceKind)=>void}) {
  const {model,busy,selected,focused,focus,edit,editContext,choose,drag,drop,request,hover,details,livingBar}=props,index=composerRenderIndex(model);
  // The drag geometry may be held, but card values always use the current model.
  if(item.context){const card=index.contexts.get(item.id);return card?<ContextCard livingBar={livingBar} card={card} model={model} busy={busy} selected={selected} focused={focused} focus={focus} drag={drag} drop={drop} choose={choose} request={request} openEquipment={openEquipment} openReference={openReference} edit={(value,selectionId)=>{if(inCluster&&!closeCluster(()=>editContext(value,selectionId)))return;editContext(value,selectionId);}}/>:null;}
  const card=index.controls.get(item.id);if(!card)return null;
  return <ComposerCard card={card} presentation={model.presentation.objects[item.id]} busy={busy} focused={focused===item.id} focus={()=>focus(item.id)}
    preserved={model.semanticState.preferences.flexibility[item.id]==="PRESERVE"} edit={()=>{if(inCluster&&!closeCluster(()=>edit(card)))return;edit(card);}}
    preserve={()=>request({kind:"PRESERVE",targetRef:item.id,preserve:model.semanticState.preferences.flexibility[item.id]!=="PRESERVE"})}
    details={()=>{if(inCluster&&!closeCluster(()=>{focus(item.id);details();}))return;focus(item.id);details();}}
    mutate={mutation=>request({kind:"MUTATE",mutation})} hover={hover}/>;
});
export function ComposerBoard({ model, busy, selected, focused, focus, focusEquipment, edit, choose, drag, drop, request, hover, editContext, details, contextGuide, reveal, livingBar, reconstructedCards }: { model: ComposerUiModel; busy: boolean; selected: string | null;
  focused: string | null; focus: (id: string | null) => void;
  focusEquipment: (id: string, ready: () => void) => void;
  edit: (card: ComposerCardView) => void; choose: (asset: ComposerAssetView, target: DropTarget, selection?: ComponentSelectionV1) => void;
  drag: (key: string | null) => void; drop: (target: DropTarget, key?: string) => void; request: (operation: ComposerOperation) => boolean | void; hover: (mutation: SemanticMutation | null) => void; editContext: (card: ComposerContextCardView, selectionId?: string) => void;
  details: () => void; livingBar?:LivingBar; contextGuide?: ReactNode; reveal?: { targetRef: string; sequence: number } | null;
  reconstructedCards?: ReadonlyMap<string, RealizedCard> }) {
  const boardAccepts = !!selected && (model.dropCapabilities.some(d => d.sourceAssetKey === selected && d.target.kind === "BOARD_ZONE" && d.resolution !== "BLOCKED")
    || model.presentation.dragSources[selected]?.editorDropTarget?.kind === "BOARD_ZONE");
  const trashAccepts = !!selected && model.dropCapabilities.some(d => d.sourceAssetKey === selected && d.target.kind === "TRASH" && d.resolution !== "BLOCKED");
  const focusedCard = model.board.contexts.find(c => c.contextOccurrenceId === focused);
  const commerce = useCommerceLibrary();
  const [equipmentTarget, setEquipmentTarget] = useState<{ id: string; slotKey?: string }>();
  const [referenceTarget, setReferenceTarget] = useState<{ id: string; kind: CardReferenceKind }>();
  const referenceTrigger = useRef<HTMLElement | null>(null);
  const closeCommerce = commerce?.closeDock;
  const focusBoard = useCallback((id: string | null) => { setReferenceTarget(undefined); focus(id); }, [focus]);
  const editBoard = useCallback((card: ComposerContextCardView, selectionId?: string) => {
    setReferenceTarget(undefined);
    editContext(card, selectionId);
  }, [editContext]);
  const openEquipment = useCallback((id: string, slotKey?: string) => {
    focusEquipment(id, () => { setReferenceTarget(undefined); setEquipmentTarget({ id, slotKey }); });
  }, [focusEquipment]);
  const openReference = useCallback((id: string, kind: CardReferenceKind) => {
    const trigger = document.activeElement;
    focusEquipment(id, () => {
      referenceTrigger.current = trigger instanceof HTMLElement ? trigger : null;
      closeCommerce?.();
      setEquipmentTarget(undefined);
      setReferenceTarget({ id, kind });
    });
  }, [focusEquipment, closeCommerce]);
  const closeReference = () => {
    focusBoard(null);
    requestAnimationFrame(() => {
      const trigger = referenceTrigger.current;
      const replacement = referenceTarget && document.querySelector<HTMLElement>(
        `[data-context="${CSS.escape(referenceTarget.id)}"] [data-context-reference="${referenceTarget.kind}"]`);
      (trigger?.isConnected ? trigger : replacement)?.focus({ preventScroll: true });
    });
  };
  const interaction = useComposerInteractions(), inlineEdits = useInlineEditRegistry();
  const trashVisible = !!interaction?.grabbed && (!!interaction.grabbed.removeOperation || interaction.grabbed.protected);
  const boardTarget: DropTarget = { kind: "BOARD_ZONE" }, trashTarget: DropTarget = { kind: "TRASH" };
  const [openClusterId, setOpenClusterId] = useState<string | null>(null);
  const layoutKey = `budgetisation.composer.fixed-layout.v1:${model.semanticState.targetMonth}`;
  const [detached, setDetached] = useState<ReadonlySet<string>>(() => new Set());
  const [fixedOpen, setFixedOpen] = useState<string | null>(null);
  useEffect(() => { try { const ids: unknown = JSON.parse(localStorage.getItem(layoutKey) ?? "[]"); setDetached(new Set(Array.isArray(ids) ? ids.filter((id): id is string => typeof id === "string") : [])); } catch { setDetached(new Set()); } }, [layoutKey]);
  const toggleFixed = (key: string) => {
    const next = new Set(detached); if (next.has(key)) next.delete(key); else next.add(key);
    setDetached(next); try { localStorage.setItem(layoutKey, JSON.stringify([...next])); } catch { /* Presentation stays in memory. */ }
  };
  const fixedFacts = model.board.structuralObligations ?? [];
  // Presentation only. The six financial reading sections and all Draft data
  // remain available; expanding restores the original monthly card owners.
  const [showMonthCards, setShowMonthCards] = useState(false);
  const monthTargets = new Set([...model.board.baselineControls, ...model.board.discretionaryControls, ...model.board.savings].map(card => card.targetRef));
  const revealMonthlyControl = !!reveal && monthTargets.has(reveal.targetRef);
  useEffect(() => {
    if (revealMonthlyControl) setShowMonthCards(true);
  }, [revealMonthlyControl, reveal?.sequence]);
  const toggleMonthCards = () => {
    const change = () => {
      inlineEdits?.flushPending();
      if (showMonthCards && commerce?.dock?.badge.anchor?.key.startsWith("control:")) commerce.closeDock();
      setShowMonthCards(value => !value);
    };
    if (!showMonthCards || !inlineEdits || inlineEdits.guard(change, monthTargets)) change();
  };
  const restaurantFocus = livingBar?.id ?? (contextGuide && focusedCard?.templateKey === "restaurant" ? focusedCard.contextOccurrenceId : null);
  const items=useMemo(()=>{
    if (reconstructedCards) return inventoryItems(model, false, false).sort((a, b) => {
      const left = reconstructedCards.get(a.id), right = reconstructedCards.get(b.id);
      return (left ? reconstructionOrder[left.section] : 4) - (right ? reconstructionOrder[right.section] : 4)
        || (left?.date ?? "").localeCompare(right?.date ?? "")
        || (left?.label ?? "").localeCompare(right?.label ?? "", "fr");
    });
    const grouped = fixedFacts.filter(f => !detached.has(f.factKey));
    const fixed: ComposerPresentationNode[] = [...(grouped.length ? [{ id:"fixed:group", kind:"FIXED" as const, iconKey:"home" as const, width:225, height:112, density:"NORMAL" as const, spatialFamily:"OTHER" as const, facts:grouped, detached:false }] : []),
      ...fixedFacts.filter(f => detached.has(f.factKey)).map(f => ({ id:`fixed:${f.factKey}`, kind:"FIXED" as const, iconKey:"home" as const, width:225, height:124, density:"NORMAL" as const, spatialFamily:"OTHER" as const, facts:[f], detached:true }))];
    return [...(showMonthCards ? fixed : []),...inventoryItems(model, showMonthCards).flatMap<ComposerPresentationNode>(item => {
    if (item.kind !== "CLUSTER" || !restaurantFocus) return [item];
    const selected = item.children.find(child => child.id === restaurantFocus);
    if (!selected) return [item];
    const remaining = item.children.filter(child => child.id !== restaurantFocus);
    // Keep the intention visible while its guide is open; this is transient layout only.
    return [selected, ...(remaining.length > 1 ? [{ ...item, children: remaining }] : remaining)];
  })];},[model,restaurantFocus,detached,showMonthCards,reconstructedCards]),closeCluster=useCallback((after?:()=>void)=>{
    const targets = new Set([...document.querySelectorAll<HTMLElement>("dialog [data-control]")].map(node => node.dataset.control!));
    if (inlineEdits && !inlineEdits.guard(() => { inlineEdits.flushPending(); setOpenClusterId(null); after?.(); }, targets)) return false;
    inlineEdits?.flushPending();
    setOpenClusterId(null);
    return true;
  },[inlineEdits]);
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
    if (!showMonthCards && monthTargets.has(reveal.targetRef)) { setShowMonthCards(true); return; }
    lastReveal.current = reveal.sequence;
    const root = inventoryRootRef(reveal.targetRef, model);
    const cluster = items.find(item => item.kind === "CLUSTER" && item.children.some(child => child.id === root));
    setOpenClusterId(cluster?.id ?? null);
    // Only an explicit inspector navigation opens a group, never a layout update.
  }, [reveal, items, model, showMonthCards]);
  useEffect(() => { if (openClusterId && !openCluster) setOpenClusterId(null); }, [openClusterId, openCluster]);
  const focusedInCluster = !!openCluster?.children.some(child => child.id === focusedCard?.contextOccurrenceId);
  const renderAtomic = (item:AtomicNode,inCluster=false)=><InventoryAtomic item={item} inCluster={inCluster} closeCluster={closeCluster}
    model={model} busy={busy} selected={selected} focused={focused} focus={focusBoard} drag={drag} drop={drop} choose={choose} request={request} edit={edit} editContext={editBoard} hover={hover} details={details} livingBar={livingBar} openEquipment={openEquipment} openReference={openReference}/>;
  // The compact living card already exposes its direct entry points. Do not
  // leave the generic equipment dock behind after folding it: that changes
  // the Board's available height and prevents an exact return to its layout.
  const paletteInCluster = commerce?.dock ? commerce.dock.cluster && !!openCluster : focusedInCluster;
  const merchantPalette = commerce?.dock && <CommerceDock key={`${commerce.dock.badge.anchor?.key}:${commerce.dock.badge.anchor?.digest}`} library={commerce} />;
  const referencePalette = referenceTarget && focusedCard?.contextOccurrenceId === referenceTarget.id
    && <CardReferenceDock key={`${referenceTarget.id}:${referenceTarget.kind}`} card={focusedCard} model={model} kind={referenceTarget.kind}
      busy={busy} close={closeReference} request={request} />;
  const regularPalette = focusedCard && (presetForContext(focusedCard)?.presetKey !== "bar-apero" || livingBar?.id === focusedCard.contextOccurrenceId) && <div className={styles.paletteDock} data-palette-dock hidden={!!merchantPalette}>{contextGuide || referencePalette || <ContextPalette key={focusedCard.contextOccurrenceId} card={focusedCard} model={model} busy={busy} choose={choose}
    equipmentTarget={equipmentTarget?.id === focusedCard.contextOccurrenceId ? equipmentTarget : undefined}
    onConfigure={!focusedCard.readOnly ? () => editContext(focusedCard) : undefined}
    close={() => { setEquipmentTarget(undefined); focus(null); }} />}</div>;
  const trashZone = trashVisible && <div className={styles.trash} data-trash data-protected={interaction?.grabbed?.protected} data-compatible={trashAccepts || !!interaction?.grabbed?.removeOperation} data-drag-over={sameTarget(interaction?.overTarget ?? null, trashTarget)}
    role="status" aria-label={interaction?.grabbed?.protected ? "Protégée · retrait interdit" : "Retirer l’élément saisi"}
    onDragOver={e => { e.stopPropagation(); if (!busy && !interaction?.grabbed?.protected) { e.preventDefault(); interaction?.over(trashTarget); } }}
    onDragEnter={e => { e.stopPropagation(); if (interaction?.grabbed?.protected) interaction.reject();
      else if (!busy) { e.preventDefault(); e.dataTransfer.dropEffect = "move"; interaction?.over(trashTarget); } }}
    onDragLeave={() => interaction?.over(null)} onDrop={e => { e.preventDefault(); e.stopPropagation(); if (!busy) interaction?.place(trashTarget); }}>
    {interaction?.grabbed?.protected ? <LockKeyhole size={17} /> : <Trash2 size={17} />}{interaction?.grabbed?.protected ? "Protégée" : "Retirer"}</div>;
  return <section className={styles.board} aria-label="Board du mois" data-bar-workspace={!!livingBar?.id}>
    <div className={styles.boardHeading}><h2>{reconstructedCards ? "Brouillon de juillet" : "Votre mois prend forme"}</h2>
      {reconstructedCards ? <span>Cartes reconstituées · modifications dans le brouillon</span>
        : <><span>{showMonthCards ? "Socle · habitudes et enveloppes · intentions" : "Intentions · cartes du mois repliées"}</span>
          <button type="button" className={styles.monthCardsToggle} aria-expanded={showMonthCards} disabled={busy} onClick={toggleMonthCards}>{showMonthCards ? "Replier les cartes du mois" : "Afficher les cartes du mois"}</button></>}</div>
    <BoardCarousel expandedId={livingBar?.id} model={model} inventory={items} focused={focused} revealSequence={(reveal?.sequence ?? 0) + selectionReveal} revealFocused={revealFocused} emptyClick={() => focusBoard(null)} dropProps={{ "data-compatible": boardAccepts,
      "data-drag-over": sameTarget(interaction?.overTarget ?? null, boardTarget),
      onDragOver: e => { if (boardAccepts && !busy) { e.preventDefault(); e.dataTransfer.dropEffect = "move"; interaction?.over(boardTarget); } else interaction?.over(null); },
      onDragLeave: e => { if (leftSurface(e)) interaction?.over(null); },
      onDrop: e => { e.preventDefault(); e.stopPropagation(); if (boardAccepts && !busy) { if (interaction) interaction.place(boardTarget); else drop(boardTarget, e.dataTransfer.getData("application/x-planner-asset")); } }
    }} render={item => item.kind === "FIXED" ? <FixedChargeCard facts={item.facts} detached={item.detached} open={() => setFixedOpen(item.detached ? item.facts[0].factKey : "group")} reattach={() => toggleFixed(item.facts[0].factKey)} />
      : item.kind === "CLUSTER" ? <VisualClusterCard node={item} open={() => setOpenClusterId(item.id)} /> : renderAtomic(item)}>
    </BoardCarousel>
    {openCluster && <VisualClusterOverlay node={openCluster} focused={focused} close={()=>closeCluster(() => { if (commerce?.dock?.cluster) commerce.closeDock(); })} renderChild={item => renderAtomic(item, true)}
      palette={<>{focusedInCluster && regularPalette}{paletteInCluster && merchantPalette && <div className={styles.paletteDock} data-palette-dock>{merchantPalette}</div>}</>} trash={trashZone} />}
    {!focusedInCluster && regularPalette}
    {!paletteInCluster && merchantPalette && <div className={styles.paletteDock} data-palette-dock>{merchantPalette}</div>}
    {!openCluster && trashZone}
    {fixedOpen && <FixedChargesDetails month={model.board.targetMonth} editableKeys={model.budgetReading?.monthUpdate?.obligationKeys}
      facts={fixedOpen === "group" ? fixedFacts.filter(f => !detached.has(f.factKey)) : fixedFacts.filter(f => f.factKey === fixedOpen)}
      detached={detached} toggle={toggleFixed} close={() => setFixedOpen(null)} />}
  </section>;
}
