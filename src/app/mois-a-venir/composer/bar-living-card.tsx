"use client";
import {useEffect,useRef,useId,type ReactNode,type HTMLAttributes} from "react";
import { X, Pin, CircleDashed, Info } from "lucide-react";
import type { ComposerContextCardView } from "@/domain/phase2/planner/composer-contract";
import type { ComposerUiModel } from "@/domain/phase2/planner/composer-ui-contract";




import { money } from "./display";
import {useBarClosedDrag,isBarDragSurface} from './bar-closed-drag';
import type { BarTarget } from "./bar-living-operations";
import styles from "./composer.module.css";
import {barBefore} from "./bar-before";
import {componentPresentationGroups} from '@/domain/phase2/planner/component-group-presentation';
import {BarComponentGroup} from './bar-component-group';
import {BarMetadata,BarRouteLine,BarComponentFace,barPlaceLabel,barModeLabel,barPeopleLabel} from "./bar-living-details";
export {barPlaceLabel,barModeLabel,barPeopleLabel};

export type LivingBar = {id?:string; removingId?:string; content?:ReactNode; open:(card:ComposerContextCardView,target:BarTarget)=>void; close:()=>void};

export function BarLivingCard({card,model,living,busy,preserved,preserve,remove,drag,surfaceProps}: {
  card:ComposerContextCardView; model:ComposerUiModel; living:LivingBar; busy:boolean; preserved:boolean;
  preserve:()=>void; remove?:()=>void; drag:()=>void;surfaceProps?:HTMLAttributes<HTMLElement>;
}) {
  const expanded=living.id===card.contextOccurrenceId,infoId=useId();
  const root=useRef<HTMLElement>(null),wasExpanded=useRef(false);
  useEffect(()=>{
    if(expanded||wasExpanded.current){const frame=requestAnimationFrame(()=>{
      const active=document.activeElement;
      // Repacking can remount the card while the user is still in its dock.
      // Keep that live focus, including buttons and the options group.
      if(expanded&&active instanceof HTMLElement&&active!==document.body
        &&(root.current?.contains(active)||active.closest('[data-bar-dock]')))return;
      const scene=root.current?.querySelector<HTMLElement>('[data-bar-living-editor]')?.dataset.barStep;
      const sceneFocus=expanded&&(scene==="place"||scene==="google")?root.current?.querySelector<HTMLElement>('[data-bar-google-search] input')
        :expanded&&scene==="date"?root.current?.querySelector<HTMLElement>('[data-bar-calendar] button[tabindex="0"]'):null;
      (sceneFocus??root.current?.querySelector<HTMLButtonElement>(expanded?'button[aria-label="Replier la carte"]':"h3 button"))?.focus({preventScroll:true});
    });wasExpanded.current=expanded;return()=>cancelAnimationFrame(frame);}
  },[expanded]);
  const summary=model.nightOutSummaries?.find(s=>s.contextOccurrenceId===card.contextOccurrenceId);
  const fresh=summary?.semanticStateDigest===model.board.draft.semanticStateDigest;

  const removing=living.removingId===card.contextOccurrenceId;
  const open=(target:BarTarget)=>living.open(card,target), locked=busy||preserved||card.readOnly||removing;
  const {suppressClick,...surfaceDrag}=useBarClosedDrag(`context-occurrence:${card.contextOccurrenceId}`,!expanded&&!locked);
  const semantic=model.semanticState.contexts.find(c=>c.contextOccurrenceId===card.contextOccurrenceId);
  const before=semantic&&barBefore(model.semanticState,semantic);
  const beforeGroups=before?componentPresentationGroups([before.bottle,...before.extras]):[];
  const components=card.sockets.flatMap(socket=>socket.currentItems.filter(item=>item.kind==="COMPONENT"||item.kind==="CHILD_CONTEXT").map(item=>({slot:socket.slotKey,item,amount:socket.evaluations?.find(e=>e.selectionId===item.selectionId)?.economicAmount})));
  // The summary may also be incomplete because context information is missing.
  // Do not claim missing prices unless the published line evaluations say so.
  const incompleteExplanation=summary?.knownAmount!=null?`${money(summary.knownAmount)} connus, ${components.some(c=>c.item.kind==='COMPONENT'&&c.amount==null)?'certains prix restent à préciser':'estimation encore incomplète'}`:'';
  const route=(slot:"outbound"|"return")=>card.sockets.find(s=>s.slotKey===slot)?.currentItems.find(s=>s.kind==="MOBILITY_INTENT");
  const visibleGroups=new Set(components.map(component=>component.slot));
  const parallelContent=visibleGroups.size>1||!!route("outbound")&&!!route("return")||visibleGroups.size>0&&(!!route("outbound")||!!route("return"));
  // Presentation only: decoration yields to actual selected contents, never to a price.
  const richness=before||components.length>2||route("outbound")||route("return")?"rich":components.length||card.fields.placeRef||card.fields.plannedDate||(Array.isArray(card.fields.participantRefs)&&card.fields.participantRefs.length)?"partial":"empty";
  return <article {...surfaceProps} {...(!expanded?surfaceDrag:{})} ref={root} tabIndex={expanded?undefined:0} className={styles.barLivingCard} data-bar-living-card data-context={card.contextOccurrenceId} data-template-key="night-out" data-expanded={expanded}
    title={expanded?undefined:'Maintenir le fond puis déplacer · Entrée pour ouvrir · Espace pour sélectionner · Suppr pour retirer · Undo pour rétablir'}
    aria-keyshortcuts={expanded?undefined:'Enter Space Delete'} onClick={event=>{if(!expanded&&isBarDragSurface(event.target,event.currentTarget)&&!suppressClick()&&!busy&&!card.readOnly&&!removing)open('summary');}}
    data-preset-key="bar-apero" data-richness={richness} data-bar-surface-rich={parallelContent} data-bar-surface-items={components.length>0} data-state={card.knowledge} data-removing={removing} aria-busy={removing} aria-label={card.label} onKeyDown={event=>{
      if(!expanded&&event.target===event.currentTarget){
        if(event.key==='Delete'&&remove&&!locked){event.preventDefault();event.stopPropagation();remove();}
        else if(event.key===' '&&!locked){event.preventDefault();event.stopPropagation();drag();}
        else if(event.key==='Enter'&&!busy&&!card.readOnly&&!removing){event.preventDefault();open('summary');}
      }
      if(event.key==="Escape"&&expanded&&!document.querySelector("dialog[open],[popover]:popover-open")){event.preventDefault();event.stopPropagation();living.close();}
    }}>
    <header className={styles.barLivingHeader}>
      <button type="button" className={styles.barImageTrigger} disabled={busy||card.readOnly||removing} aria-label={`Ouvrir ${card.label}`} onClick={()=>open("summary")}><img src="/planned-visuals/builder/clay/drinks/bar-editorial.webp" alt="" className={styles.barLivingImage} width={128} height={128}/></button>
      <div className={styles.barLivingIdentity}><h3><button type="button" disabled={busy||card.readOnly||removing} onClick={()=>open("summary")}>{card.label}</button></h3>
        <div className={styles.barLivingAmount} data-cost-unknown={summary?.knownAmount==null}><button type="button" data-bar-amount-trigger className={styles.barAmountTrigger} disabled={locked} aria-label="Modifier l’estimation des consommations" title="Choisir la portée à modifier · aucun total calculé n’est écrasé" onClick={()=>open("quick")}><strong>{summary?.knownAmount!=null?money(summary.knownAmount):"Coût à préciser"}</strong></button>
        {expanded ? summary?.knownAmount!=null&&<small>{fresh?summary.incomplete?"connus · coûts à préciser":"Coût prévu":"Résultat précédent · actualisation"}</small>
          : !fresh&&summary ? <span className={styles.barClosedCostStatus} data-bar-cost-info tabIndex={0} aria-describedby={infoId}><Info size={13} aria-hidden="true"/>Estimation à actualiser<span id={infoId} role="tooltip" className={styles.barClosedCostTip}>La projection précédente doit être actualisée avant de servir de projection actuelle.</span></span>
          : summary?.knownAmount!=null&&summary.incomplete&&<span className={styles.barClosedCostStatus} data-bar-cost-info tabIndex={0} aria-label={incompleteExplanation} aria-describedby={infoId}><CircleDashed size={13} aria-hidden="true"/>Montant partiel<Info size={13} aria-hidden="true"/><span id={infoId} role="tooltip" className={styles.barClosedCostTip}>{incompleteExplanation}</span></span>}
        {(preserved||card.readOnly)&&<small>{card.readOnly?"Lecture seule":"Carte préservée"}</small>}</div></div>
      <div className={styles.barLivingTools}>
        {expanded&&remove&&<details className={styles.barManage}><summary aria-label="Actions de la sortie" title="Actions de la sortie">⋯</summary><button type="button" disabled={locked} onClick={remove}>Retirer la sortie</button><small>Undo permet de la rétablir.</small></details>}
        {expanded&&!card.readOnly&&<button type="button" disabled={busy} onClick={preserve} title={preserved?"Libérer les choix de cette sortie pour les modifier":"Préserver les choix de cette sortie · ne déplace pas la carte"} aria-label={preserved?"Libérer les choix de cette sortie":"Préserver les choix de cette sortie"} aria-pressed={preserved}><Pin size={15}/></button>}
        {expanded&&<button type="button" onClick={living.close} aria-label="Replier la carte"><X size={18}/></button>}
      </div>
    </header>
    {removing&&<p role="status" data-bar-removal-pending>Retrait en cours… Votre brouillon reste conservé jusqu’à confirmation.</p>}
    {expanded ? living.content : <div className={styles.barLivingCompact}>
      <BarMetadata fields={card.fields} model={model} open={open} disabled={locked}/>
      <div className={styles.barLivingRoutes}>{(["outbound","return"] as const).map(slot=>{const leg=route(slot);return leg?.kind==="MOBILITY_INTENT"?<BarRouteLine key={slot} slot={slot} contextId={card.contextOccurrenceId} leg={leg} model={model} disabled={locked} navigate={open} open={()=>open(slot)}/>:null;})}</div>
      {route("outbound")?.kind==="MOBILITY_INTENT"&&!route("return")&&!route("outbound")?.returnRequired&&<button type="button" className={styles.barInlineAdd} disabled={locked} onClick={()=>open("return")}>+ Retour</button>}
      {before&&<section data-bar-before-miniature><button type="button" className={styles.barSceneBack} disabled={locked} onClick={()=>open("before")}>Before · {1+before.extras.length} lignes</button><div className={styles.barLivingTiles} data-bar-closed-rail tabIndex={0} aria-label="Consommations Before · faire défiler si nécessaire">{beforeGroups.slice(0,5).map(group=><BarComponentGroup closed key={group.key} group={group} model={model} owner={before.child.contextOccurrenceId} slot="$before" disabled={locked} choose={item=>open(item.selectionId===before.bottle.selectionId?`component:before-main:${item.selectionId}`:`component:before-extras:${item.selectionId}`)}/>)}{beforeGroups.length>5&&<button type="button" disabled={locked} onClick={()=>open("before")}>+{beforeGroups.length-5} groupes</button>}</div></section>}
      {(["extras","food","main","before"] as const).map(slot=>{
        const items=components.filter(c=>c.slot===slot&&(slot!=="before"||!before));if(!items.length)return null;
        const label=slot==="extras"?"Au bar":slot==="food"?"Repas":slot==="before"?"Avant de sortir":items.some(c=>c.item.kind==="COMPONENT"&&c.item.label==="Consommations regroupées")?"Consommations regroupées":"Entrées / contribution";
        const groups=componentPresentationGroups(items.map(c=>c.item));
        return <section key={slot} aria-label={label}><h4>{label}</h4><div className={styles.barLivingTiles} data-bar-closed-rail tabIndex={0} aria-label={`${label} · faire défiler si nécessaire`}>{groups.slice(0,5).map(group=><BarComponentGroup closed key={group.key} group={group} model={model} owner={card.contextOccurrenceId} slot={slot} disabled={locked} choose={item=>open(`component:${slot}:${item.selectionId}`)}/>)}{groups.length>5&&<button type="button" className={styles.barMoreCount} disabled={locked} onClick={()=>open(slot==="extras"?"drinks":"summary")} aria-label={`Voir les ${groups.length} groupes · ${items.length} postes existants`}>+{groups.length-5} groupes</button>}</div></section>;
      })}
      {richness==="empty"&&!locked&&<button type="button" className={styles.barInlineAdd} onClick={()=>open("summary")}>Composer cette sortie <span aria-hidden="true">↗</span></button>}
    </div>}
  </article>;
}
