import { useRef } from "react";
import { Check, Sparkle, ArrowLeftRight, Plus, X, ChevronDown } from "lucide-react";
import type { ComposerUiModel } from "@/domain/phase2/planner/composer-ui-contract";
import type { ComposerAssetView, ComposerContextCardView, DropTarget } from "@/domain/phase2/planner/composer-contract";
import { PlannerIcon } from "./planner-icons/planner-icon";
import { displayEquipmentGroups, type EquipmentTile } from "./presentation/palette-groups";
import styles from "./composer.module.css";
import { useComposerInteractions } from "./interactions";

function routeCaption(groupKey: string, slotKey: string, assetKey: string, socketLabel: string | null | undefined): string {
  if (groupKey === "meal") return assetKey.startsWith("template:") ? "Objet autonome" : "Composant du repas";
  if (groupKey === "travel") return slotKey === "outbound" ? "Aller" : "Retour";
  return socketLabel ?? slotKey;
}

function EquipmentTileButton({ tile, groupKey, card, model, assets, busy, choose }: {
  tile: EquipmentTile; groupKey: string; card: ComposerContextCardView; model: ComposerUiModel;
  assets: ReadonlyMap<string, ComposerAssetView>; busy: boolean; choose: (asset: ComposerAssetView, target: DropTarget) => void;
}) {
  const interaction = useComposerInteractions();
  const trigger = useRef<HTMLButtonElement>(null), menu = useRef<HTMLDivElement>(null);
  const routes = tile.routes.flatMap(({ socket, option }) => {
    const asset = assets.get(option.assetKey);
    if (!asset) return [];
    const target: DropTarget = { kind: "CONTEXT_SOCKET", contextOccurrenceId: card.contextOccurrenceId, slotKey: socket.slotKey };
    const item = socket.currentItems.find(current => current.optionKey === asset.optionKey && current.kind === asset.optionKind);
    const satelliteKey = `satellite:${card.contextOccurrenceId}:${socket.slotKey}:${item?.selectionId}`;
    const sourceKey = item && model.presentation.dragSources[satelliteKey] ? satelliteKey : asset.assetKey;
    return [{ asset, target, sourceKey, state: option.state,
      caption: routeCaption(groupKey, socket.slotKey, asset.assetKey, socket.label) }];
  });
  if (!routes.length) return null;
  const first = routes[0], multiple = routes.length > 1;
  const state = routes.some(route => route.state === "EQUIPPED") ? "EQUIPPED" : first.state;
  const action = state === "EQUIPPED" ? "Équipé" : state === "ALTERNATIVE" ? "Remplacer avec" : "Équiper";
  const equip = (route: typeof first) => interaction ? interaction.equip(route.sourceKey, route.target) : choose(route.asset, route.target);
  const openChoices = () => {
    const node = menu.current, button = trigger.current;
    if (!node || !button) return;
    if (node.matches(":popover-open")) { node.hidePopover(); return; }
    node.showPopover();
    const anchor = button.getBoundingClientRect(), box = node.getBoundingClientRect();
    node.style.left = `${Math.max(12, Math.min(innerWidth - box.width - 12, anchor.left))}px`;
    node.style.top = `${Math.max(12, anchor.top - box.height - 10)}px`;
    node.querySelector<HTMLButtonElement>("[data-palette-route]")?.focus();
  };
  return <>
    <button ref={trigger} className={styles.equipmentTile} data-palette-asset={first.asset.assetKey} data-visual-key={tile.visualKey}
      data-option-state={state} disabled={busy} title={`${action} ${first.asset.label}${multiple ? " · choisir une utilisation" : ""}`}
      aria-label={multiple ? `Choisir comment utiliser ${first.asset.label}` : `${action} ${first.asset.label} dans ${first.caption}`}
      aria-haspopup={multiple ? "dialog" : undefined} draggable={!busy && !multiple}
      data-drag-source={!multiple ? first.sourceKey : undefined} data-grabbed={!multiple && interaction?.grabbed?.sourceKey === first.sourceKey}
      onDragStart={event => { if (!multiple) interaction?.start(first.sourceKey, event); }} onDragEnd={() => interaction?.end()}
      onClick={() => multiple ? openChoices() : equip(first)}>
      <PlannerIcon iconKey={first.asset.iconKey} scale="PALETTE" /><span>{first.asset.label}</span>
      {multiple ? <ChevronDown size={15} /> : state === "EQUIPPED" ? <Check size={14} /> : state === "SUGGESTED" ? <Sparkle size={14} />
        : state === "ALTERNATIVE" ? <ArrowLeftRight size={14} /> : <Plus size={14} />}
    </button>
    {multiple && <div ref={menu} popover="auto" role="dialog" aria-label={`Utilisations de ${first.asset.label}`} className={styles.equipmentChoices} data-equipment-choices={tile.visualKey}
      onToggle={event => { if ((event.nativeEvent as ToggleEvent).newState === "closed" &&
        (menu.current?.contains(document.activeElement) || document.activeElement === document.body)) trigger.current?.focus(); }}>
      <strong>{first.asset.label}</strong><p>Choisissez l'utilisation avant d'équiper ou de glisser.</p>
      {routes.map(route => <button key={`${route.target.slotKey}:${route.asset.assetKey}`} type="button"
        data-palette-route={route.asset.assetKey} data-palette-slot={route.target.slotKey} data-drag-source={route.sourceKey}
        aria-label={`${route.asset.label} · ${route.caption}`} disabled={busy} draggable={!busy}
        onDragStart={event => interaction?.start(route.sourceKey, event)} onDragEnd={() => { interaction?.end(); menu.current?.hidePopover(); }}
        onClick={() => { menu.current?.hidePopover(); equip(route); }}>
        <PlannerIcon iconKey={route.asset.iconKey} scale="SATELLITE" /><span>{route.caption}</span>
        {route.state === "EQUIPPED" ? <Check size={13} /> : <Plus size={13} />}
      </button>)}
    </div>}
  </>;
}

export function ContextPalette({ card, model, busy, choose, close }: { card: ComposerContextCardView; model: ComposerUiModel; busy: boolean;
  choose: (asset: ComposerAssetView, target: DropTarget) => void; close: () => void;
}) {
  const groups = displayEquipmentGroups(card, model);
  const assets = new Map(model.library.searchableAssets.map(asset => [asset.assetKey, asset]));
  const iconKey = model.presentation.objects[card.contextOccurrenceId]?.iconKey ?? "activity";
  return <section className={styles.contextPalette} data-context-palette={card.contextOccurrenceId} aria-label={`Équiper ${card.label}`}>
    <header><div className={styles.paletteHeading}><PlannerIcon iconKey={iconKey} scale="SATELLITE" /><div><h3>Équiper · {card.label}</h3><p>Choisissez un objet pour ce moment</p></div></div>
      <button className={styles.iconButton} aria-label="Quitter la sélection du moment" onClick={close}><X size={16} /></button></header>
    {groups.length ? <div className={styles.paletteOptions} data-palette-options tabIndex={0} aria-label={`Options pour ${card.label}`}
      onKeyDown={event => { if (event.target !== event.currentTarget || !["ArrowLeft", "ArrowRight"].includes(event.key)) return;
        event.preventDefault(); event.currentTarget.scrollBy({ left: event.key === "ArrowRight" ? 150 : -150, behavior: "smooth" }); }}>
      {groups.map(group => <div key={group.key} className={styles.paletteGroup} data-palette-group={group.key}>
        <span>{group.title}</span><div>{group.tiles.map(tile => <EquipmentTileButton key={tile.visualKey} tile={tile} groupKey={group.key} card={card} model={model}
          assets={assets} busy={busy} choose={choose} />)}</div>
      </div>)}</div> : <p className={styles.popoverNote}>Ce moment est préservé ou suivi par son éditeur habituel.</p>}
  </section>;
}
