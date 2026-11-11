import { controlAccessLabel } from "@/domain/phase2/planner/control-input";
import { controlValuePresentation, controlValueSummary } from "./control-value-presentation";
import { memo, useState, useRef, useEffect, useMemo } from "react";
import type { ComposerPresetKey } from "@/domain/phase2/planner/composer-presets";
import { composerLibraryIndex, filterLibraryIntentions, hairdresserReferenceLines, isClothingPurchase, isHairdresserReference, librarySearchAction, LIBRARY_CATEGORIES, normalizeLibrarySearch, type LibraryIntention } from "@/domain/phase2/planner/composer-library-index";
import { PresetIllustration } from "./preset-illustration";
import { ComposerAssetVisual } from "./compact-catalog-visual";
import { Search, Star } from "lucide-react";
import type { ComposerUiModel } from "@/domain/phase2/planner/composer-ui-contract";
import type { ComposerAssetView } from "@/domain/phase2/planner/composer-contract";
import styles from "./composer.module.css";
import { PlannerIcon } from "./planner-icons/planner-icon";
import { useComposerInteractions,publishedDrop } from "./interactions";
import { composerRenderIndex } from "./render-index";
import { preloadEditorForAsset } from "./editor-chunks";
import { CatalogOpenButton } from "./catalog-discovery-provider";
import { MONTHLY_GROCERIES_REF } from "./catalog-discovery";

const FAVORITES_KEY="budgetisation.composer.library-favorites.v1";
export const ComposerLibrary=memo(ComposerLibraryView);
function ComposerLibraryView({model,openToken,busy,selected,choose,choosePreset,drag,inspectContext,openContext}:{model:ComposerUiModel;openToken:number;busy:boolean;selected:string|null;
  choose:(asset:ComposerAssetView)=>void;choosePreset:(asset:ComposerAssetView,key:ComposerPresetKey)=>void;drag:(key:string|null)=>void;inspectContext:(id:string)=>void;openContext:(id:string)=>void}) {
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
  const occurrences=useMemo(()=>query.trim()?filterLibraryIntentions(index.occurrences,query):[],[index.occurrences,query]);
  const serviceQuery=["coiffeur","coiffure","coupe de cheveux","brushing","soin capillaire"].includes(normalizeLibrarySearch(query));
  const favoriteItems=matches.filter(item=>favorites.includes(item.key));
  const categories=LIBRARY_CATEGORIES.map(([key,label])=>({key,label,items:matches.filter(item=>item.category===key)})).filter(g=>g.items.length);
  const activate=(item:LibraryIntention)=>item.preset?choosePreset(item.asset,item.preset.presetKey):choose(item.asset);
  const focusActions=()=>search.current?.closest("aside")?.querySelector<HTMLButtonElement>("[data-library-existing-action]:not(:disabled),[data-library-add-action]:not(:disabled)")?.focus();
  const tile=(item:LibraryIntention)=>{
    const asset=item.asset, source=model.presentation.dragSources[asset.assetKey];
    const draggable=!!source&&(item.preset?!!publishedDrop(model,asset.assetKey,{kind:'BOARD_ZONE'}):!!source.editorDropTarget||(composerRenderIndex(model).drops.get(asset.assetKey)??[]).some(d=>d.resolution!=="BLOCKED"))&&asset.provenance!=="DERIVED_CONSEQUENCE";
    return <div className={item.preset?styles.libraryTile:styles.libraryGenericTile} key={item.key}>
      <button type="button" className={item.preset?styles.presetTile:styles.libraryGenericChoice} data-preset={item.preset?.presetKey} data-asset={item.preset?undefined:asset.assetKey}
        data-selected={selected===asset.assetKey} data-library-add-action={query.trim()?item.key:undefined} disabled={busy}
        onFocus={()=>preloadEditorForAsset(asset,item.preset?.presetKey)}
        onClick={()=>activate(item)} draggable={!busy&&draggable} data-drag-source={draggable?asset.assetKey:undefined}
        onDragStart={event=>{event.stopPropagation();if(busy||!draggable){event.preventDefault();return;}if(interaction)interaction.start(asset.assetKey,event,item.preset?.presetKey);else if(item.preset){event.preventDefault();}else{event.dataTransfer.setData("application/x-planner-asset",asset.assetKey);drag(asset.assetKey);}}}
        onDragEnd={()=>{interaction?.end();drag(null);}}>
        {item.preset?<PresetIllustration preset={item.preset}/>:<ComposerAssetVisual assetKey={asset.assetKey} templateKey={asset.templateKey} iconKey={asset.iconKey} identityRef={asset.capabilityRef} className={styles.assetIcon}/>}
        <span>{query.trim()?`${index.occurrences.some(row=>row.presetKey===item.preset?.presetKey)?"Ajouter un autre":"Ajouter"} ${item.label}`:item.label}</span>
      </button>
      <button type="button" className={styles.libraryFavorite} aria-label={`${favorites.includes(item.key)?"Retirer":"Épingler"} ${item.label}`} aria-pressed={favorites.includes(item.key)} onClick={()=>toggleFavorite(item.key)}><Star size={13} fill={favorites.includes(item.key)?"currentColor":"none"}/></button>
    </div>;
  };
  return <aside className={styles.library} data-library aria-label="Bibliothèque d’intentions">
    <header className={styles.panelHeader}><h2><button className={styles.libraryOpen} data-library-open onClick={()=>search.current?.focus()}>Que veux-tu prévoir ?</button></h2></header>
    <nav className={styles.libraryTabs} aria-label="Espaces de la bibliothèque"><button type="button" aria-pressed={space==="add"} onClick={()=>setSpace("add")}>À ajouter</button><button type="button" aria-pressed={space==="manage"} onClick={()=>setSpace("manage")}>À piloter</button></nav>
    <div className={styles.catalogLibraryAccess}><CatalogOpenButton target={{query,scope:'all'}}>Tous les éléments{query.trim()?` · ${query}`:''}</CatalogOpenButton><CatalogOpenButton target={{scope:'courses',controlRef:index.controls.find(a=>a.capabilityRef===MONTHLY_GROCERIES_REF)?.capabilityRef}}>Produits pour Courses</CatalogOpenButton></div>
    <label className={styles.search}><Search size={15} aria-hidden="true"/><input ref={search} data-library-search aria-label="Rechercher une intention" placeholder={space==="add"?"Soirée, repas, achat…":"Budget ou cagnotte…"} value={query} onChange={e=>setQuery(e.target.value)}
      onKeyDown={e=>{if(e.key==="Enter"&&space==="add"&&query.trim()&&!busy){e.preventDefault();const action=librarySearchAction(matches,occurrences,query);
        if(action.kind==="OPEN")openContext(action.contextOccurrenceId);else if(action.kind==="ADD"){const item=matches.find(item=>item.key===action.key);if(item)activate(item);}else focusActions();
      }else if(e.key==="ArrowDown"){e.preventDefault();e.currentTarget.closest("aside")?.querySelector<HTMLButtonElement>("[data-library-scroll] button:not(:disabled)")?.focus();}}}/></label>
    <div className={styles.libraryScroll} data-library-scroll onKeyDown={e=>{if(!["ArrowDown","ArrowUp","Home","End"].includes(e.key)||!(e.target instanceof HTMLButtonElement))return;e.preventDefault();const buttons=Array.from(e.currentTarget.querySelectorAll<HTMLButtonElement>("button:not(:disabled)"));const at=buttons.indexOf(e.target);buttons[e.key==="Home"?0:e.key==="End"?buttons.length-1:Math.max(0,Math.min(buttons.length-1,at+(e.key==="ArrowUp"?-1:1)))]?.focus();}}>
    {space==="add"?<>
      {!!query.trim()&&occurrences.length>0&&<section className={styles.libraryExisting} aria-label="Intentions du mois" data-library-existing>
        <h3>Dans ce mois</h3><p>{occurrences.length===1?"Retrouvez cette intention, ou ajoutez-en une autre explicitement.":"Choisissez l’intention à ouvrir ; aucun ajout automatique."}</p>
        {occurrences.map((row,index)=><button key={row.contextOccurrenceId} type="button" className={styles.libraryExistingAction}
          data-library-existing-action={row.contextOccurrenceId} disabled={busy} onClick={()=>openContext(row.contextOccurrenceId)}>
          <strong>{row.action==="EDIT"?"Modifier":"Voir"} {row.label}</strong>
          <small>{occurrences.length>1?`Occurrence ${index+1} · `:""}{row.plannedDate?new Intl.DateTimeFormat("fr-FR",{dateStyle:"medium",timeZone:"UTC"}).format(new Date(`${row.plannedDate}T12:00:00Z`)):"Date à préciser"} · {row.action==="EDIT"?"Éditeur de cette carte":isClothingPurchase(model.board.contexts.find(card=>card.contextOccurrenceId===row.contextOccurrenceId))?"Fiche de cet article en lecture seule":"Lecture seule sur le Board"}</small>
          {model.board.contexts.some(card=>card.contextOccurrenceId===row.contextOccurrenceId&&isHairdresserReference(model,card))&&<small>Prestation externe · dépense du mois · voir cette prestation sur le Board</small>}
        </button>)}
      </section>}
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
      {!matches.length&&!occurrences.length&&<p className={styles.searchEmpty}>Aucune intention correspondante. {serviceQuery
        ? "Aucune prestation autorisée n’est attestée pour cette recherche dans ce mois. Un concept du catalogue ne constitue pas un rendez-vous réservé."
        : "Les compléments se trouvent dans la palette de leur carte."}</p>}
    </>:<>
      <p className={styles.libraryLocalNote}>Retrouvez la carte déjà présente dans votre mois. Aucun doublon n’est créé.</p>
      {(["Habitudes", "Enveloppes", "Réservations", "Autres références"] as const).map(group => {
        const controls=index.controls.filter(asset=>{const c=composerRenderIndex(model).controls.get(asset.capabilityRef);
          const family=c?.kind==="SAVINGS" ? "Réservations" : !c?.capability?.actions.length ? "Autres références" : c.capability.fields?.count ? "Habitudes" : "Enveloppes";
          return family===group&&(!query||normalizeLibrarySearch(asset.label).includes(normalizeLibrarySearch(query)));});
        return controls.length ? <section key={group} className={styles.manageGroup}><h3>{group}</h3><div className={styles.assetGrid}>{controls.map(asset=>{
          const control=composerRenderIndex(model).controls.get(asset.capabilityRef);
          const caption=control ? controlValueSummary(control) : "Référence indisponible";
          return <button type="button" className={styles.asset} key={asset.assetKey} data-asset={asset.assetKey} data-value-status={control ? controlValuePresentation(control).kind : undefined} disabled={busy} onClick={()=>inspectContext(asset.capabilityRef)}>
            <PlannerIcon iconKey={asset.iconKey} scale="LIBRARY" className={styles.assetIcon}/><span>{asset.label}</span><small>{caption}</small><small>{control?`${controlValuePresentation(control).label} · ${controlAccessLabel(control)}`:"Édition indisponible"}</small></button>;
        })}</div></section> : null;
      })}
      {model.board.contexts.filter(c=>c.readOnly&&(!hairdresserReferenceLines(c).length||isHairdresserReference(model,c))
        &&(!query||normalizeLibrarySearch(c.label).includes(normalizeLibrarySearch(query)))).map(c=><button type="button" className={styles.asset} key={c.contextOccurrenceId}
          data-library-external-view={c.contextOccurrenceId} onClick={()=>inspectContext(c.contextOccurrenceId)}>{c.label}<small>Référence externe · lecture seule</small></button>)}
    </>}
    </div>
  </aside>;
}

