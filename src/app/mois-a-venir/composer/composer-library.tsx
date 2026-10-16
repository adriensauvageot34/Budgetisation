import { controlAccessLabel } from "@/domain/phase2/planner/control-input";
import { money, quantityLabel } from "./display";
import { memo, useState, useRef, useEffect, useMemo } from "react";
import type { ComposerPresetKey } from "@/domain/phase2/planner/composer-presets";
import { composerLibraryIndex, filterLibraryIntentions, LIBRARY_CATEGORIES, normalizeLibrarySearch, type LibraryIntention } from "@/domain/phase2/planner/composer-library-index";
import { PresetIllustration } from "./preset-illustration";
import { Search, Star } from "lucide-react";
import type { ComposerUiModel } from "@/domain/phase2/planner/composer-ui-contract";
import type { ComposerAssetView } from "@/domain/phase2/planner/composer-contract";
import styles from "./composer.module.css";
import { PlannerIcon } from "./planner-icons/planner-icon";
import { useComposerInteractions } from "./interactions";
import { composerRenderIndex } from "./render-index";
import { preloadEditorForAsset, preloadEditorForPreset } from "./editor-chunks";

const FAVORITES_KEY="budgetisation.composer.library-favorites.v1";
export const ComposerLibrary=memo(ComposerLibraryView);
function ComposerLibraryView({model,openToken,busy,selected,choose,choosePreset,drag,inspectContext}:{model:ComposerUiModel;openToken:number;busy:boolean;selected:string|null;
  choose:(asset:ComposerAssetView)=>void;choosePreset:(asset:ComposerAssetView,key:ComposerPresetKey)=>void;drag:(key:string|null)=>void;inspectContext:(id:string)=>void}) {
  const [space,setSpace]=useState<"add"|"manage">("add"),[query,setQuery]=useState(""),[opened,setOpened]=useState<string|null>("SOCIAL");
  const [expanded,setExpanded]=useState<ReadonlySet<string>>(()=>new Set()),[favorites,setFavorites]=useState<readonly string[]>([]);
  const [favoriteNotice,setFavoriteNotice]=useState("");
  const search=useRef<HTMLInputElement>(null), interaction=useComposerInteractions();
  const index=useMemo(()=>composerLibraryIndex(model),[model]);
  useEffect(()=>{try {const stored:unknown=JSON.parse(localStorage.getItem(FAVORITES_KEY)??"[]");if(Array.isArray(stored))setFavorites(stored.filter((v):v is string=>typeof v==="string").slice(0,100));}catch{setFavoriteNotice("Favoris indisponibles dans ce navigateur.");}},[]);
  useEffect(()=>{if(openToken>0){setSpace("add");setQuery("");search.current?.focus();}},[openToken]);
  useEffect(()=>{const quick=(event:KeyboardEvent)=>{if(event.key!=="/"||event.ctrlKey||event.metaKey||event.altKey||event.target instanceof Element&&event.target.closest("input,textarea,select,[contenteditable=true],dialog[open]"))return;event.preventDefault();search.current?.focus();};window.addEventListener("keydown",quick);return()=>window.removeEventListener("keydown",quick);},[]);
  const toggleFavorite=(key:string)=>{
    const next=favorites.includes(key)?favorites.filter(k=>k!==key):[...favorites,key];setFavorites(next);
    try{localStorage.setItem(FAVORITES_KEY,JSON.stringify(next));setFavoriteNotice("");}catch{setFavoriteNotice("Favoris conservés pour cette session uniquement.");}
  };
  const matches=useMemo(()=>filterLibraryIntentions(index.intentions,query),[index.intentions,query]);
  const favoriteItems=matches.filter(item=>favorites.includes(item.key));
  const categories=LIBRARY_CATEGORIES.map(([key,label])=>({key,label,items:matches.filter(item=>item.category===key)})).filter(g=>g.items.length);
  const activate=(item:LibraryIntention)=>item.preset?choosePreset(item.asset,item.preset.presetKey):choose(item.asset);
  const tile=(item:LibraryIntention)=>{
    const asset=item.asset, source=model.presentation.dragSources[asset.assetKey];
    const draggable=!item.preset && (!!source?.editorDropTarget || (composerRenderIndex(model).drops.get(asset.assetKey)??[]).some(d=>d.resolution!=="BLOCKED")) && asset.provenance!=="DERIVED_CONSEQUENCE";
    return <div className={item.preset?styles.libraryTile:styles.libraryGenericTile} key={item.key}>
      <button type="button" className={item.preset?styles.presetTile:styles.libraryGenericChoice} data-preset={item.preset?.presetKey} data-asset={item.preset?undefined:asset.assetKey}
        data-selected={selected===asset.assetKey} disabled={busy}
        onFocus={()=>item.preset?preloadEditorForPreset(asset):preloadEditorForAsset(asset)}
        onClick={()=>activate(item)} draggable={!busy&&draggable} data-drag-source={draggable?asset.assetKey:undefined}
        onDragStart={event=>{if(interaction)interaction.start(asset.assetKey,event);else{event.dataTransfer.setData("application/x-planner-asset",asset.assetKey);drag(asset.assetKey);}}}
        onDragEnd={()=>{interaction?.end();drag(null);}}>
        {item.preset?<PresetIllustration preset={item.preset}/>:<PlannerIcon iconKey={asset.iconKey} identityRef={asset.capabilityRef} scale="LIBRARY" className={styles.assetIcon}/>}
        <span>{item.label}</span>
      </button>
      <button type="button" className={styles.libraryFavorite} aria-label={`${favorites.includes(item.key)?"Retirer":"Épingler"} ${item.label}`} aria-pressed={favorites.includes(item.key)} onClick={()=>toggleFavorite(item.key)}><Star size={13} fill={favorites.includes(item.key)?"currentColor":"none"}/></button>
    </div>;
  };
  return <aside className={styles.library} data-library aria-label="Bibliothèque d’intentions">
    <header className={styles.panelHeader}><h2><button className={styles.libraryOpen} data-library-open onClick={()=>search.current?.focus()}>Que veux-tu prévoir ?</button></h2></header>
    <nav className={styles.libraryTabs} aria-label="Espaces de la bibliothèque"><button type="button" aria-pressed={space==="add"} onClick={()=>setSpace("add")}>À ajouter</button><button type="button" aria-pressed={space==="manage"} onClick={()=>setSpace("manage")}>À piloter</button></nav>
    <label className={styles.search}><Search size={15} aria-hidden="true"/><input ref={search} data-library-search aria-label="Rechercher une intention" placeholder={space==="add"?"Soirée, repas, achat…":"Budget ou cagnotte…"} value={query} onChange={e=>setQuery(e.target.value)}
      onKeyDown={e=>{if(e.key==="Enter"&&space==="add"&&query&&matches[0]&&!busy){e.preventDefault();activate(matches[0]);}else if(e.key==="ArrowDown"){e.preventDefault();e.currentTarget.closest("aside")?.querySelector<HTMLButtonElement>("[data-library-scroll] button")?.focus();}}}/></label>
    <div className={styles.libraryScroll} data-library-scroll onKeyDown={e=>{if(!["ArrowDown","ArrowUp","Home","End"].includes(e.key)||!(e.target instanceof HTMLButtonElement))return;e.preventDefault();const buttons=Array.from(e.currentTarget.querySelectorAll<HTMLButtonElement>("button:not(:disabled)"));const at=buttons.indexOf(e.target);buttons[e.key==="Home"?0:e.key==="End"?buttons.length-1:Math.max(0,Math.min(buttons.length-1,at+(e.key==="ArrowUp"?-1:1)))]?.focus();}}>
    {space==="add"?<>
      {favoriteItems.length>0&&<section className={styles.assetGroup} data-library-favorites><h3>Épinglés par vous</h3><div className={styles.presetGrid}>{favoriteItems.filter(i=>i.preset).map(tile)}</div>{favoriteItems.filter(i=>!i.preset).map(tile)}</section>}
      <p className={styles.libraryLocalNote}>Favoris locaux à ce navigateur · aucun budget engagé.{favoriteNotice&&` ${favoriteNotice}`}</p>
      {categories.map(group=>{const searching=!!query.trim(),isOpen=searching||opened===group.key,all=searching||expanded.has(group.key);
        const primary=group.items.filter(item=>item.preset),generic=group.items.filter(item=>!item.preset),visible=all||primary.length===7?primary:primary.slice(0,6);
        const groups=[...new Set(visible.map(item=>item.group))],freeOpen=searching||!primary.length||expanded.has("free:"+group.key);
        return <section className={styles.assetGroup} key={group.key} data-library-group={group.key}>
        <h3><button type="button" className={styles.assetGroupToggle} data-library-group-toggle={group.key} aria-expanded={isOpen} aria-controls={`library-${group.key}`} onClick={()=>{if(query)setQuery("");setOpened(opened===group.key?null:group.key);}}>
          <span aria-hidden="true">{isOpen?"▾":"▸"}</span>{group.label}<small>{group.items.length}</small></button></h3>
        {isOpen&&<div id={`library-${group.key}`}>
          {groups.map(subgroup=><div key={subgroup} data-library-subgroup={subgroup}>{subgroup&&<h4 className={styles.librarySubgroupTitle}>{subgroup}</h4>}<div className={styles.presetGrid}>{visible.filter(item=>item.group===subgroup).map(tile)}</div></div>)}
          {!all&&primary.length>7&&<button type="button" className={styles.libraryShowAll} onClick={()=>setExpanded(old=>new Set([...old,group.key]))}>Tout voir · {primary.length}</button>}
          {generic.length>0&&<div className={styles.libraryGenericGroup} data-library-generics={group.key}>
            {!!primary.length&&<button type="button" className={styles.libraryGenericToggle} aria-expanded={freeOpen} aria-controls={`library-free-${group.key}`}
              onClick={()=>setExpanded(old=>{const next=new Set(old);if(next.has("free:"+group.key))next.delete("free:"+group.key);else next.add("free:"+group.key);return next;})}>
              <span aria-hidden="true">{freeOpen?"▾":"▸"}</span> Autre intention · {generic.length}</button>}
            {freeOpen&&<div id={`library-free-${group.key}`}>{generic.map(tile)}</div>}
          </div>}
        </div>}
      </section>;})}
      {!matches.length&&<p className={styles.searchEmpty}>Aucune intention correspondante. Les compléments se trouvent dans la palette de leur carte.</p>}
    </>:<>
      <p className={styles.libraryLocalNote}>Retrouvez la carte déjà présente dans votre mois. Aucun doublon n’est créé.</p>
      {(["Habitudes", "Enveloppes", "Réservations", "Autres références"] as const).map(group => {
        const controls=index.controls.filter(asset=>{const c=composerRenderIndex(model).controls.get(asset.capabilityRef);
          const family=c?.kind==="SAVINGS" ? "Réservations" : !c?.capability?.actions.length ? "Autres références" : c.capability.fields?.count ? "Habitudes" : "Enveloppes";
          return family===group&&(!query||normalizeLibrarySearch(asset.label).includes(normalizeLibrarySearch(query)));});
        return controls.length ? <section key={group} className={styles.manageGroup}><h3>{group}</h3><div className={styles.assetGrid}>{controls.map(asset=>{
          const control=composerRenderIndex(model).controls.get(asset.capabilityRef);
          const caption=control ? control.value.count !== null ? `${quantityLabel(control.value.count)} occurrence(s)` : !control.value.decisionValue&&control.value.inclusion==="SUGGESTION_ONLY" ? "Enveloppe à définir" : money(control.value.amount) : "Référence indisponible";
          return <button type="button" className={styles.asset} key={asset.assetKey} data-asset={asset.assetKey} disabled={busy} onClick={()=>inspectContext(asset.capabilityRef)}>
            <PlannerIcon iconKey={asset.iconKey} scale="LIBRARY" className={styles.assetIcon}/><span>{asset.label}</span><small>{caption}</small><small>{control?controlAccessLabel(control):"Édition indisponible"}</small></button>;
        })}</div></section> : null;
      })}
      {model.board.contexts.filter(c=>c.readOnly&&(!query||normalizeLibrarySearch(c.label).includes(normalizeLibrarySearch(query)))).map(c=><button type="button" className={styles.asset} key={c.contextOccurrenceId} onClick={()=>inspectContext(c.contextOccurrenceId)}>{c.label}<small>Référence externe · lecture seule</small></button>)}
    </>}
    </div>
  </aside>;
}

