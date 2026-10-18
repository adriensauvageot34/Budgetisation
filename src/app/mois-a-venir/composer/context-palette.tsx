import { useId, useLayoutEffect, useRef, useState } from "react";
import { Check, Sparkle, ArrowLeftRight, Plus, X, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import type { ComposerUiModel } from "@/domain/phase2/planner/composer-ui-contract";
import type { ComposerAssetView, ComposerContextCardView, DropTarget } from "@/domain/phase2/planner/composer-contract";
import type { ComponentSelectionV1 } from "@/domain/phase2/planner/component-contract";
import { PlannerIcon } from "./planner-icons/planner-icon";
import { displayEquipmentGroups, type EquipmentTile } from "./presentation/palette-groups";
import styles from "./composer.module.css";
import { useComposerInteractions } from "./interactions";
import { BarPageControls } from "./bar-pages";
import { BarProductVisual } from "./bar-product-visual";

function routeCaption(groupKey: string, slotKey: string, assetKey: string, socketLabel: string | null | undefined): string {
  if (groupKey === "meal") return assetKey.startsWith("template:") ? "Objet autonome" : "Composant du repas";
  if (groupKey === "travel") return slotKey === "outbound" ? "Aller" : "Retour";
  return socketLabel ?? slotKey;
}

function EquipmentTileButton({ tile, groupKey, card, model, assets, busy, choose, configure = false }: {
  tile: EquipmentTile; groupKey: string; card: ComposerContextCardView; model: ComposerUiModel;
  assets: ReadonlyMap<string, ComposerAssetView>; busy: boolean; choose: (asset: ComposerAssetView, target: DropTarget, selection?: ComponentSelectionV1) => void; configure?: boolean;
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
    return [{ asset, target, sourceKey, selection: item, state: option.state,
      caption: routeCaption(groupKey, socket.slotKey, asset.assetKey, socket.label) }];
  });
  if (!routes.length) return null;
  const first = routes[0], multiple = routes.length > 1;
  const state = routes.some(route => route.state === "EQUIPPED") ? "EQUIPPED" : first.state;
  const action = state === "EQUIPPED" ? "Modifier" : state === "ALTERNATIVE" ? "Remplacer avec" : "Équiper";
  const equip = (route: typeof first) => route.selection ? choose(route.asset, route.target, route.selection)
    : interaction && !configure ? interaction.equip(route.sourceKey, route.target) : choose(route.asset, route.target);
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
      aria-haspopup={multiple ? "dialog" : undefined} draggable={!busy && !multiple && !configure}
      data-drag-source={!multiple && !configure ? first.sourceKey : undefined} data-grabbed={!multiple && interaction?.grabbed?.sourceKey === first.sourceKey}
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
        aria-label={`${route.asset.label} · ${route.caption}`} disabled={busy} draggable={!busy && !configure}
        onDragStart={event => interaction?.start(route.sourceKey, event)} onDragEnd={() => { interaction?.end(); menu.current?.hidePopover(); }}
        onClick={() => { menu.current?.hidePopover(); equip(route); }}>
        <PlannerIcon iconKey={route.asset.iconKey} scale="SATELLITE" /><span>{route.caption}</span>
        {route.state === "EQUIPPED" ? <Check size={13} /> : <Plus size={13} />}
      </button>)}
    </div>}
  </>;
}

export type PaletteQuestion = { title: string; identity?:string; choices: readonly { key: string; label: string; iconKey: string; selected?: boolean; hint?: string; showHint?:boolean; symbol?: string; choose: () => void }[];
  search?: { value: string; change: (value: string) => void; label: string }; emptyLabel?:string };
export function ContextPalette({ card, model, busy, choose, close, configure = false, onConfigure, question, appearance }: { card: ComposerContextCardView; model: ComposerUiModel; busy: boolean; configure?: boolean; onConfigure?: () => void; question?: PaletteQuestion; appearance?:"bar";
  choose: (asset: ComposerAssetView, target: DropTarget, selection?: ComponentSelectionV1) => void; close: () => void;
}) {
  const groups = question ? [] : displayEquipmentGroups(card, model);
  const assets = new Map(model.library.searchableAssets.map(asset => [asset.assetKey, asset]));
  const [mode, setMode] = useState<"complete" | "all">("complete"), [query, setQuery] = useState("");
  const options = useRef<HTMLDivElement>(null), optionsId = useId();
  const [scroll, setScroll] = useState({ before: false, after: false });
  const [answerPositions,setAnswerPositions]=useState<Record<string,number>>({}),[answerCount,setAnswerCount]=useState(4);
  const answerKey=JSON.stringify([question?.identity??question?.title,question?.search?.value??""]);
  const answerPage=answerPositions[answerKey]??0;
  const setAnswerPage=(page:number)=>setAnswerPositions(previous=>({...previous,[answerKey]:page}));
  useLayoutEffect(()=>{
    if(appearance!=="bar"||!options.current)return;
    const node=options.current;
    const measure=()=>setAnswerCount(Math.max(1,Math.min(6,Math.floor(node.clientWidth/170)||4)));
    measure();const observer=new ResizeObserver(measure);observer.observe(node);return()=>observer.disconnect();
  },[appearance]);
  useLayoutEffect(()=>setAnswerPage(0),[question?.identity,question?.title,question?.search?.value]);
  const answerPages=Math.max(1,Math.ceil((question?.choices.length??0)/answerCount));
  const currentAnswerPage=Math.min(answerPage,answerPages-1);
  const measureScroll = () => {
    if(appearance==="bar")return;
    const node = options.current;
    const next = { before: !!node && node.scrollLeft > 2, after: !!node && node.scrollLeft + node.clientWidth < node.scrollWidth - 2 };
    setScroll(old => old.before === next.before && old.after === next.after ? old : next);
  };
  const hasGroups = !!question || groups.length > 0;
  useLayoutEffect(() => {
    if(appearance==="bar")return;
    const node = options.current; if (!node) return;
    measureScroll(); const observer = new ResizeObserver(measureScroll); observer.observe(node);
    return () => observer.disconnect();
  }, [hasGroups]);
  useLayoutEffect(() => { if(options.current) options.current.scrollLeft = 0; measureScroll(); }, [question?.title]);
  useLayoutEffect(measureScroll, [card, mode, query, question]);
  const normalize = (text: string) => text.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLocaleLowerCase("fr");
  const visible = groups.map(group => ({ ...group, tiles: group.tiles.filter(tile => !query.trim()
    || tile.routes.some(route => normalize(assets.get(route.option.assetKey)?.label ?? "").includes(normalize(query.trim())))) }))
    .filter(group => group.tiles.length);
  const iconKey = model.presentation.objects[card.contextOccurrenceId]?.iconKey ?? "activity";
  if (question) return <section className={`${styles.contextPalette} ${styles.questionPalette} ${appearance==="bar"?styles.barCompositionDock:""}`} data-bar-dock={appearance==="bar"?true:undefined} data-context-palette={card.contextOccurrenceId} data-question-dock aria-label={question.title}>
    <header><div className={styles.paletteHeading}><PlannerIcon iconKey={iconKey} scale="SATELLITE" /><h3>{question.title}</h3></div>
      {question.search && <input disabled={appearance==="bar"&&busy} aria-label={question.search.label} placeholder={question.search.label} value={question.search.value} onChange={event => question.search!.change(event.target.value)} />}
      {appearance==="bar"?<BarPageControls index={currentAnswerPage} count={answerPages} onChange={setAnswerPage} label="Pages du dock"/>:<div className={styles.paletteScrollControls} aria-label="Parcourir les réponses">
        <button type="button" aria-label="Réponses précédentes" aria-controls={optionsId} disabled={!scroll.before} onClick={() => options.current?.scrollBy({left:-300,behavior:"smooth"})}><ChevronLeft size={18} /></button>
        <button type="button" aria-label="Réponses suivantes" aria-controls={optionsId} disabled={!scroll.after} onClick={() => options.current?.scrollBy({left:300,behavior:"smooth"})}><ChevronRight size={18} /></button>
      </div>}</header>
    <div ref={options} id={optionsId} className={styles.paletteOptions} data-palette-options onScroll={measureScroll} tabIndex={0} aria-label={question.title}
      onKeyDown={event => {if(event.target===event.currentTarget && ["ArrowLeft","ArrowRight"].includes(event.key)){event.preventDefault();if(appearance==="bar")setAnswerPage(Math.max(0,Math.min(answerPages-1,currentAnswerPage+(event.key==="ArrowRight"?1:-1))));else event.currentTarget.scrollBy({left:event.key==="ArrowRight"?180:-180,behavior:"smooth"});}}}>
      {(appearance==="bar"?question.choices.slice(currentAnswerPage*answerCount,(currentAnswerPage+1)*answerCount):question.choices).map(choice => <button type="button" key={choice.key} className={styles.questionAnswer} data-show-hint={choice.showHint} aria-pressed={choice.selected} disabled={busy} title={choice.hint} onFocus={event => {if(appearance!=="bar")event.currentTarget.scrollIntoView({block:"nearest",inline:"nearest"});}} onClick={choice.choose}>
          {appearance==="bar"&&/^(bar|house_party):/u.test(choice.key)?<BarProductVisual assetKey={choice.key} label={choice.label}/>:choice.symbol?<span className={styles.barChoiceSymbol} aria-hidden="true">{choice.symbol}</span>:<PlannerIcon iconKey={choice.iconKey} scale="PALETTE" />}<span><strong>{choice.label}</strong>{choice.hint && (appearance!=="bar"||choice.showHint) && <small>{choice.hint}</small>}</span>{choice.selected && <Check size={16} />}</button>)}
      {!question.choices.length && <p>{question.emptyLabel??"Aucun résultat. Vous pouvez saisir votre choix."}</p>}
    </div></section>;
  return <section className={styles.contextPalette} data-context-palette={card.contextOccurrenceId} aria-label={`Équiper ${card.label}`}>
    <header><div className={styles.paletteHeading}><PlannerIcon iconKey={iconKey} scale="SATELLITE" /><div><h3>Équiper · {card.label}</h3><p>Choisissez un objet pour ce moment</p></div></div>
      <div className={styles.paletteModes}>{onConfigure && <button type="button" onClick={onConfigure}>Configurer</button>}
        <button type="button" aria-pressed={mode === "complete"} onClick={() => { setMode("complete"); setQuery(""); }}>Compléter</button>
        <button type="button" title="Voir tous les compléments admissibles" aria-pressed={mode === "all"} onClick={() => setMode("all")}>Autres options</button></div>
      {hasGroups && <div className={styles.paletteScrollControls} aria-label="Parcourir les compléments">
        <button type="button" aria-label="Options précédentes" aria-controls={optionsId} disabled={!scroll.before} onClick={() => options.current?.scrollBy({ left: -320, behavior: "smooth" })}><ChevronLeft size={16} /></button>
        <button type="button" aria-label="Options suivantes" aria-controls={optionsId} disabled={!scroll.after} onClick={() => options.current?.scrollBy({ left: 320, behavior: "smooth" })}><ChevronRight size={16} /></button>
      </div>}
      <button className={styles.iconButton} aria-label="Quitter la sélection du moment" onClick={close}><X size={16} /></button></header>
    {mode === "all" && <label className={styles.paletteSearch}>Rechercher un complément<input aria-label="Rechercher un complément" value={query} onChange={event => setQuery(event.target.value)} /></label>}
    {groups.length ? <div ref={options} id={optionsId} className={styles.paletteOptions} data-palette-options onScroll={measureScroll} tabIndex={0} aria-label={`Options pour ${card.label}`}
      onKeyDown={event => { if (event.target !== event.currentTarget || !["ArrowLeft", "ArrowRight"].includes(event.key)) return;
        event.preventDefault(); event.currentTarget.scrollBy({ left: event.key === "ArrowRight" ? 150 : -150, behavior: "smooth" }); }}>
      {visible.map(group => <div key={group.key} className={styles.paletteGroup} data-palette-group={group.key}>
        <span>{group.title}</span><div>{(mode === "all" ? group.tiles : group.tiles.slice(0,5)).map(tile => <EquipmentTileButton key={tile.visualKey} tile={tile} groupKey={group.key} card={card} model={model}
          assets={assets} busy={busy} choose={choose} configure={configure} />)}</div>
      </div>)}</div> : <p className={styles.popoverNote}>Ce moment est préservé ou suivi par son éditeur habituel.</p>}
  </section>;
}
