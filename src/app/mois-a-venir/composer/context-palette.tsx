import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { Check, Sparkle, ArrowLeft, ArrowLeftRight, Plus, X, ChevronDown, ChevronLeft, ChevronRight, Search, SlidersHorizontal } from "lucide-react";
import type { ComposerUiModel } from "@/domain/phase2/planner/composer-ui-contract";
import type { ComposerAssetView, ComposerContextCardView, DropTarget } from "@/domain/phase2/planner/composer-contract";
import type { ComponentSelectionV1 } from "@/domain/phase2/planner/component-contract";
import { PlannerIcon } from "./planner-icons/planner-icon";
import { displayEquipmentGroups, type EquipmentTile } from "./presentation/palette-groups";
import styles from "./composer.module.css";
import { publishedDrop,useComposerInteractions } from "./interactions";
import type {BarDockDrag} from './bar-dock-drag';
import { barDockCatalog } from "./bar-dock-catalog";
import { BarProductVisual } from "./bar-product-visual";
import { CompactCatalogVisual, compactCatalogImage, historicalCatalogImage, ComposerAssetVisual } from "./compact-catalog-visual";
import { clayAssetArtwork, clayV22Artwork } from "../clay-v22-media";
import { CatalogOpenButton } from "./catalog-discovery-provider";
import type { CatalogMoment } from "./catalog-discovery";
import { clayBarArtwork } from "../clay-v22-media";
import { composerPreset, presetIllustrationPath, type ComposerPresetKey } from "@/domain/phase2/planner/composer-presets";
import { normalizeLibrarySearch } from "@/domain/phase2/planner/composer-library-index";

function routeCaption(groupKey: string, slotKey: string, assetKey: string, socketLabel: string | null | undefined): string {
  if (groupKey === "meal") return assetKey.startsWith("template:") ? "Objet autonome" : "Composant du repas";
  if (groupKey === "travel" && slotKey === "outbound") return "Aller";
  if (groupKey === "travel" && slotKey === "return") return "Retour";
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
    const matches = socket.currentItems.filter(current => current.optionKey === asset.optionKey && current.kind === asset.optionKind);
    return (matches.length ? matches : [undefined]).map((item, index) => {
      const satelliteKey = `satellite:${card.contextOccurrenceId}:${socket.slotKey}:${item?.selectionId}`;
      const sourceKey = item && model.presentation.dragSources[satelliteKey] ? satelliteKey : asset.assetKey;
      const caption = routeCaption(groupKey, socket.slotKey, asset.assetKey, socket.label);
      const selectionLabel = item?.kind === "COMPONENT" ? item.label : asset.label;
      return { asset, target, sourceKey, selection: item, state: option.state, caption: matches.length > 1
        ? `${caption} · ${selectionLabel} (${index + 1})` : caption };
    });
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
      <ComposerAssetVisual assetKey={first.asset.assetKey} iconKey={first.asset.iconKey} scale="PALETTE" /><span>{first.asset.label}</span>
      {multiple ? <ChevronDown size={15} /> : state === "EQUIPPED" ? <Check size={14} /> : state === "SUGGESTED" ? <Sparkle size={14} />
        : state === "ALTERNATIVE" ? <ArrowLeftRight size={14} /> : <Plus size={14} />}
    </button>
    {multiple && <div ref={menu} popover="auto" role="dialog" aria-label={`Utilisations de ${first.asset.label}`} className={styles.equipmentChoices} data-equipment-choices={tile.visualKey}
      onToggle={event => { if ((event.nativeEvent as ToggleEvent).newState === "closed" &&
        (menu.current?.contains(document.activeElement) || document.activeElement === document.body)) trigger.current?.focus(); }}>
      <strong>{first.asset.label}</strong><p>Choisissez l'utilisation avant d'équiper ou de glisser.</p>
      {routes.map(route => <button key={`${route.target.slotKey}:${route.asset.assetKey}:${route.selection?.selectionId ?? ""}`} type="button"
        data-palette-route={route.asset.assetKey} data-palette-slot={route.target.slotKey} data-drag-source={route.sourceKey}
        aria-label={`${route.asset.label} · ${route.caption}`} disabled={busy} draggable={!busy && !configure}
        onDragStart={event => interaction?.start(route.sourceKey, event)} onDragEnd={() => { interaction?.end(); menu.current?.hidePopover(); }}
        onClick={() => { menu.current?.hidePopover(); equip(route); }}>
        <ComposerAssetVisual assetKey={route.asset.assetKey} iconKey={route.asset.iconKey} scale="SATELLITE" /><span>{route.caption}</span>
        {route.state === "EQUIPPED" ? <Check size={13} /> : <Plus size={13} />}
      </button>)}
    </div>}
  </>;
}

export type PaletteQuestion = { title: string; identity?:string; catalogMoment?:CatalogMoment; nature?:"FAMILIES"|"OBJECTS"|"PEOPLE"|"MODES"|"KNOWN_ROUTES"|"PLACE_FAVORITES"|"FINANCING"|"DECISION"; choices: readonly { key: string; label: string; iconKey: string; selected?: boolean; hint?: string; showHint?:boolean; symbol?: string; visualKey?:string; catalogAssetKey?: string; visualConceptId?: string; presetArtwork?: ComposerPresetKey; catalogActionLabel?:string; catalogRepeat?:boolean; catalogUnavailable?:boolean; drag?:BarDockDrag; choose: () => void }[];
  search?: { value: string; change: (value: string) => void; label: string }; filterChoices?:boolean; emptyLabel?:string; backToFamilies?:()=>void;
  hideCatalog?: boolean; dismissible?: boolean };
export function ContextPalette({ card, model, busy, choose, close, configure = false, onConfigure, equipmentTarget, question, appearance, questionScroll, onQuestionScrollChange }: { card: ComposerContextCardView; model: ComposerUiModel; busy: boolean; configure?: boolean; onConfigure?: () => void; equipmentTarget?: { slotKey?: string }; question?: PaletteQuestion; appearance?:"bar";
  questionScroll?:Readonly<Record<string,number>>; onQuestionScrollChange?:(key:string,index:number)=>void;
  choose: (asset: ComposerAssetView, target: DropTarget, selection?: ComponentSelectionV1) => void; close: () => void;
}) {
  const interaction=useComposerInteractions();
  const groups = question ? [] : displayEquipmentGroups(card, model);
  const assets = new Map(model.library.searchableAssets.map(asset => [asset.assetKey, asset]));
  const [filter, setFilter] = useState<{ owner: typeof equipmentTarget; group?: string }>();
  const [query, setQuery] = useState(""), [searchOpen, setSearchOpen] = useState(false);
  const options = useRef<HTMLDivElement>(null), searchInput=useRef<HTMLInputElement>(null), optionsId = useId();
  const searchTrigger = useRef<HTMLButtonElement>(null);
  const questionFocus=useRef<HTMLElement|null>(null);
  const [scroll, setScroll] = useState({ before: false, after: false });
  const scrollPositions=useRef<Record<string,number>>({});
  const [searches,setSearches]=useState<Record<string,string>>({});
  const [limits,setLimits]=useState<Record<string,number>>({});
  const [caption,setCaption]=useState<{key:string;label:string}|null>(null);
  const answerKey=JSON.stringify([card.contextOccurrenceId,question?.identity??question?.title??""]);
  const productScene=appearance==="bar"&&(question?.nature==="FAMILIES"||question?.nature==="OBJECTS");
  const searchValue=productScene?"":question?.search?.value??searches[answerKey]??"";
  const catalogue=barDockCatalog(question?.choices??[],question?.filterChoices===false?"":searchValue,productScene?question?.choices.length:limits[answerKey]??24);
  // Internal search/"show more" can change the rendered rail while the caller's
  // question object stays identical. Measure the actual projection, not its owner.
  const renderedChoicesKey=JSON.stringify([catalogue.visible.map(choice=>[choice.key,choice.label,choice.hint,choice.showHint]),catalogue.remaining]);
  const search=productScene?undefined:question?.search??(appearance==="bar"&&(question?.choices.length??0)>24?{
    value:searchValue,label:"Rechercher dans ces choix",change:(value:string)=>setSearches(previous=>({...previous,[answerKey]:value}))
  }:undefined);
  const scrollRail=(left:number)=>options.current?.scrollBy({left,behavior:typeof window!=="undefined"&&window.matchMedia?.("(prefers-reduced-motion: reduce)").matches?"auto":"smooth"});
  const measureScroll = () => {
    const node = options.current;
    if(node&&appearance==='bar'){
      // Size real border boxes, reserving a 24px peek only when another tile
      // exists. No arbitrary overflow threshold or synthetic scroll controls.
      const gap=8, preferred=productScene?156:170, count=node.children.length;
      const width=node.clientWidth;
      const fits=count*preferred+Math.max(0,count-1)*gap<=width;
      const columns=Math.max(1,Math.floor((width-24)/(preferred+gap)));
      node.style.setProperty('--bar-dock-tile',`${fits?preferred:Math.max(80,(width-24-columns*gap)/columns)}px`);
    }
    const next = { before: !!node && node.scrollLeft > 2, after: !!node && node.scrollLeft + node.clientWidth < node.scrollWidth - 2 };
    setScroll(old => old.before === next.before && old.after === next.after ? old : next);
  };
  useLayoutEffect(()=>{
    const prior=questionFocus.current;
    if(appearance==="bar"&&typeof document!=="undefined"&&prior&&(!prior.isConnected||prior.matches(':disabled'))
      &&(document.activeElement===document.body||document.activeElement===prior))
      options.current?.focus({preventScroll:true});
  },[appearance,answerKey,searchValue]);
  const hasGroups = !!question || groups.length > 0;
  useEffect(()=>{
    const node=options.current;if((appearance==="bar"&&!productScene)||!node)return;
    const wheel=(event:WheelEvent)=>{
      if(Math.abs(event.deltaX)>=Math.abs(event.deltaY)||event.ctrlKey)return;
      const before=node.scrollLeft;
      node.scrollLeft+=event.deltaY*(event.deltaMode===1?32:event.deltaMode===2?node.clientWidth:1);
      if(node.scrollLeft!==before)event.preventDefault();
    };
    node.addEventListener("wheel",wheel,{passive:false});
    return()=>node.removeEventListener("wheel",wheel);
  },[productScene,hasGroups,appearance]);
  useLayoutEffect(() => {
    const node = options.current; if (!node) return;
    measureScroll(); const observer = new ResizeObserver(measureScroll); observer.observe(node);
    return () => observer.disconnect();
  }, [hasGroups,appearance]);
  useLayoutEffect(() => {
    if(options.current) options.current.scrollLeft = appearance==="bar" ? (questionScroll??scrollPositions.current)[answerKey]??0 : 0;
    measureScroll();
    // Restore only when the semantic scene changes, never on an admitted object or keystroke.
  }, [answerKey,appearance]);
  const manuallyFiltered = !!filter && filter.owner === equipmentTarget;
  const requestedSlot = manuallyFiltered ? undefined : equipmentTarget?.slotKey;
  const groupKey = manuallyFiltered ? filter.group
    : groups.find(group => group.tiles.some(tile => tile.routes.some(route => route.socket.slotKey === requestedSlot)))?.key;
  const terms = normalizeLibrarySearch(query).split(" ").filter(Boolean);
  const searching = terms.length > 0;
  const visible = groups.filter(group => searching || !groupKey || group.key === groupKey).map(group => ({ ...group,
    tiles: group.tiles.flatMap(tile => {
      const routes = tile.routes.filter(route => {
        if (!searching) return !requestedSlot || route.socket.slotKey === requestedSlot;
        const label = assets.get(route.option.assetKey)?.label;
        return !!label && terms.every(term => normalizeLibrarySearch(label + " " + group.title).includes(term));
      });
      return routes.length ? [{ ...tile, routes }] : [];
    }),
  }))
    .filter(group => group.tiles.length);
  useLayoutEffect(() => {
    if (!question && options.current) options.current.scrollLeft = 0;
  }, [equipmentTarget, groupKey, question]);
  useLayoutEffect(() => {
    if (equipmentTarget && !question) options.current?.focus({ preventScroll: true });
  }, [equipmentTarget, question]);
  useLayoutEffect(measureScroll, [card, groupKey, query, question, renderedChoicesKey]);
  const iconKey = model.presentation.objects[card.contextOccurrenceId]?.iconKey ?? "activity";
  if (question) return <section className={`${styles.contextPalette} ${styles.questionPalette} ${appearance==="bar"?styles.barCompositionDock:styles.compactQuestionDock}`} data-bar-dock={appearance==="bar"?true:undefined} data-compact-dock={appearance==='bar'&&question.choices.length<=3&&!search} data-context-palette={card.contextOccurrenceId} data-question-dock data-dock-nature={question.nature} aria-label={question.title}
    onFocusCapture={event=>{if(appearance==="bar"&&event.target instanceof HTMLElement)questionFocus.current=event.target;}}>
    {appearance==="bar"&&caption&&caption.key.startsWith(answerKey+":")&&<div role="tooltip" id={optionsId+"-full-label"} className={styles.barDockFullLabel}>{caption.label}</div>}
    <header>{appearance==="bar"?(question.nature==="OBJECTS"&&question.backToFamilies&&<button type="button" className={styles.barFamiliesBack} aria-label="Revenir aux catégories" title="Revenir aux catégories" disabled={busy} onClick={question.backToFamilies}><ArrowLeft size={15}/></button>):<div className={styles.paletteHeading}><PlannerIcon iconKey={iconKey} scale="SATELLITE" /><h3>{question.title}</h3></div>}
      {search && <><input ref={searchInput} autoFocus={question.dismissible} disabled={appearance==="bar"&&busy} aria-label={search.label} placeholder={search.label} value={search.value} onChange={event => search.change(event.target.value)} />
        {appearance==="bar"&&search.value&&<button type="button" className={styles.iconButton} disabled={busy} aria-label="Effacer la recherche des choix" onClick={()=>{search.change("");searchInput.current?.focus({preventScroll:true});}}><X size={16}/></button>}</>}
      {!question.hideCatalog && <CatalogOpenButton target={{contextId:card.contextOccurrenceId,moment:question.catalogMoment,commands:question.choices.flatMap(c=>{
        if(c.catalogUnavailable)return [];
        const art=clayV22Artwork(c.visualConceptId)??clayBarArtwork(c.catalogAssetKey??c.visualKey??c.key);
        return art?[{key:c.key,visualConceptId:art.visualConceptId,label:c.catalogActionLabel??`Configurer ${c.label} · ${question.title}`,allowRepeat:c.catalogRepeat,run:c.choose}]:[];
      })}}>Parcourir les éléments</CatalogOpenButton>}
      {question.dismissible && <button type="button" className={styles.iconButton} aria-label="Fermer le choix" onClick={close}><X size={16} /></button>}
      {appearance!=="bar"&&(scroll.before||scroll.after)&&<div className={styles.paletteScrollControls} aria-label="Parcourir les réponses">
        <button type="button" aria-label="Réponses précédentes" aria-controls={optionsId} disabled={!scroll.before} onClick={() => scrollRail(-300)}><ChevronLeft size={16} /></button>
        <button type="button" aria-label="Réponses suivantes" aria-controls={optionsId} disabled={!scroll.after} onClick={() => scrollRail(300)}><ChevronRight size={16} /></button>
      </div>}</header>
    <div ref={options} id={optionsId} className={styles.paletteOptions} data-palette-options data-overflow-before={scroll.before} data-overflow-after={scroll.after} onLoadCapture={measureScroll} onScroll={()=>{
        measureScroll();if(appearance==="bar"&&options.current){const value=options.current.scrollLeft;scrollPositions.current[answerKey]=value;onQuestionScrollChange?.(answerKey,value);}
      }} tabIndex={0} aria-label={question.title}
      onFocusCapture={event=>{if(appearance==="bar"&&event.target instanceof HTMLElement)questionFocus.current=event.target;}}
      onKeyDown={event => {if(event.target===event.currentTarget && ["ArrowLeft","ArrowRight"].includes(event.key)){event.preventDefault();scrollRail(event.key==="ArrowRight"?180:-180);}}}>
      {(appearance==="bar"?catalogue.visible:question.choices).map(choice => {const fullLabel=choice.label+(choice.showHint&&choice.hint?" · "+choice.hint:"");const key=answerKey+":"+choice.key;const reveal=()=>{if(appearance==="bar")setCaption(fullLabel.length>36?{key,label:fullLabel}:null);}; const source=choice.drag&&model.presentation.dragSources[choice.drag.sourceKey]; const drag=appearance==="bar"&&question.nature==="OBJECTS"&&!busy&&source&&!source.protected&&!source.selection&&!source.sourceSocket&&publishedDrop(model,source.assetKey,choice.drag!.target)?choice.drag:undefined;
        const catalogKey = choice.catalogAssetKey ?? choice.key;
        const artwork = clayV22Artwork(choice.visualConceptId) ?? clayAssetArtwork(catalogKey);
        const preset = choice.presetArtwork ? composerPreset(choice.presetArtwork) : undefined;
        const catalogImage = artwork?.src ?? (preset ? presetIllustrationPath(preset) : compactCatalogImage(catalogKey));
        return <button type="button" key={choice.key} className={styles.questionAnswer} data-show-hint={choice.showHint} aria-pressed={choice.selected} aria-label={appearance==="bar"?fullLabel:undefined} aria-describedby={caption?.key===key?optionsId+"-full-label":undefined} disabled={busy} title={appearance==="bar"?fullLabel:choice.hint} onMouseEnter={reveal} onMouseLeave={event=>{if(!event.currentTarget.contains(document.activeElement))setCaption(null);}} onBlur={()=>setCaption(null)} onFocus={event => {event.currentTarget.scrollIntoView?.({block:"nearest",inline:"nearest"});reveal();}} draggable={!!drag} data-drag-source={drag?.sourceKey} onDragStart={event=>{event.stopPropagation();if(drag)interaction?.start(drag.sourceKey,event,undefined,drag.values);else event.preventDefault();}} onDragEnd={()=>interaction?.end()} onClick={choice.choose}>
          {appearance==="bar"&&(!!choice.visualKey||/^(bar|house_party|club|option:night-out):/u.test(choice.key)||["shared","drinks","food"].includes(choice.key))
            ? <BarProductVisual dock={productScene} assetKey={choice.visualKey??choice.key} label={choice.label}/>
            : catalogImage ? <CompactCatalogVisual src={catalogImage} fallbackSrc={historicalCatalogImage(catalogKey)} visualConceptId={artwork?.visualConceptId} iconKey={choice.iconKey} />
            : choice.symbol ? <span className={styles.barChoiceSymbol} aria-hidden="true">{choice.symbol}</span>
            : <PlannerIcon iconKey={choice.iconKey} scale="PALETTE" />}
          <span><strong>{choice.label}</strong>{choice.hint && (appearance!=="bar"||choice.showHint) && <small>{choice.hint}</small>}</span>{choice.selected && <Check size={16} />}</button>;})}
      {appearance==="bar"&&catalogue.remaining>0&&<button type="button" className={styles.questionAnswer} onClick={()=>setLimits(previous=>({...previous,[answerKey]:(previous[answerKey]??24)+24}))}>Afficher la suite ({catalogue.remaining})</button>}
      {!(appearance==="bar"?catalogue.total:question.choices.length) && <p>{question.emptyLabel??"Aucun résultat. Vous pouvez saisir votre choix."}</p>}
    </div></section>;
  return <section className={`${styles.contextPalette} ${styles.compactEquipmentDock}`} data-context-palette={card.contextOccurrenceId} aria-label={`Équiper ${card.label}`}
    onKeyDown={event => {
      if (event.key !== "Escape" || event.nativeEvent.isComposing || (event.target instanceof Element && event.target.closest("[popover]:popover-open"))) return;
      event.stopPropagation();
      if (searchOpen) {
        setQuery("");
        setSearchOpen(false);
        searchTrigger.current?.focus({ preventScroll:true });
      } else close();
    }}>
    <header><div className={styles.paletteHeading}><h3 title={card.label}>{card.label}</h3></div>
      {searchOpen && <input type="search" autoFocus className={styles.dockSearch} placeholder="Rechercher un complément" aria-label="Rechercher un complément" value={query} onChange={event => setQuery(event.target.value)} />}
      <div className={styles.dockTools}>{onConfigure && <button type="button" className={styles.iconButton} disabled={busy} aria-label="Configurer" title="Configurer" onClick={onConfigure}><SlidersHorizontal size={15} /></button>}
        {hasGroups && <button type="button" ref={searchTrigger} className={styles.iconButton} aria-label="Rechercher" title="Rechercher" aria-expanded={searchOpen} onClick={() => {
          setSearchOpen(!searchOpen);
          if (searchOpen) setQuery("");
        }}><Search size={15} /></button>}</div>
      {hasGroups && (scroll.before||scroll.after) && <div className={styles.paletteScrollControls} aria-label="Parcourir les compléments">
        <button type="button" aria-label="Options précédentes" aria-controls={optionsId} disabled={!scroll.before} onClick={() => scrollRail(-320)}><ChevronLeft size={16} /></button>
        <button type="button" aria-label="Options suivantes" aria-controls={optionsId} disabled={!scroll.after} onClick={() => scrollRail(320)}><ChevronRight size={16} /></button>
      </div>}
      <CatalogOpenButton target={{contextId:card.contextOccurrenceId}}>Catalogue</CatalogOpenButton>
      <button className={styles.iconButton} aria-label="Quitter la sélection du moment" onClick={close}><X size={16} /></button></header>
    {groups.length > 1 && !searching && <div className={styles.dockGroups} role="group" aria-label="Familles de compléments">
      {[{ key: undefined, title: "Tout" }, ...groups].map(group => <button key={group.key ?? "all"} type="button"
        aria-pressed={groupKey === group.key} aria-controls={optionsId} onClick={() => setFilter({ owner: equipmentTarget, group: group.key })}>{group.title}</button>)}
    </div>}
    {groups.length ? <div ref={options} id={optionsId} className={styles.paletteOptions} data-palette-options onScroll={measureScroll} tabIndex={0} aria-label={`Options pour ${card.label}`}
      onKeyDown={event => { if (event.target !== event.currentTarget || !["ArrowLeft", "ArrowRight"].includes(event.key)) return;
        event.preventDefault(); event.currentTarget.scrollBy({ left: event.key === "ArrowRight" ? 150 : -150, behavior: "smooth" }); }}>
      {visible.map(group => <div key={group.key} className={styles.paletteGroup} data-palette-group={group.key}>
        {!groupKey && groups.length > 1 && <span>{group.title}</span>}
        <div>{group.tiles.map(tile => <EquipmentTileButton key={tile.visualKey} tile={tile} groupKey={group.key} card={card} model={model}
          assets={assets} busy={busy} choose={choose} configure={configure} />)}</div>
      </div>)}
      {!visible.length && <p role="status" className={styles.popoverNote}>Aucun complément trouvé.</p>}</div> : <p className={styles.popoverNote}>Aucun complément disponible pour ce moment.</p>}
  </section>;
}
