"use client";
import {useEffect,useRef,type ReactNode,type HTMLAttributes} from "react";
import { X, GripVertical, Pin } from "lucide-react";
import type { ComposerContextCardView } from "@/domain/phase2/planner/composer-contract";
import type { ComposerUiModel } from "@/domain/phase2/planner/composer-ui-contract";




import { money } from "./display";
import { useDragHandle } from "./interactions";
import type { BarTarget } from "./bar-living-operations";
import styles from "./composer.module.css";
import {barBefore} from "./bar-before";
import {BarMetadata,BarRouteLine,BarComponentFace,barPlaceLabel,barModeLabel,barPeopleLabel} from "./bar-living-details";
export {barPlaceLabel,barModeLabel,barPeopleLabel};

export type LivingBar = {id?:string; removingId?:string; content?:ReactNode; open:(card:ComposerContextCardView,target:BarTarget)=>void; close:()=>void};

export function BarLivingCard({card,model,living,busy,preserved,preserve,remove,drag,surfaceProps}: {
  card:ComposerContextCardView; model:ComposerUiModel; living:LivingBar; busy:boolean; preserved:boolean;
  preserve:()=>void; remove?:()=>void; drag:()=>void;surfaceProps?:HTMLAttributes<HTMLElement>;
}) {
  const handle=useDragHandle(`context-occurrence:${card.contextOccurrenceId}`), expanded=living.id===card.contextOccurrenceId;
  const root=useRef<HTMLElement>(null),wasExpanded=useRef(false);
  useEffect(()=>{
    if(expanded||wasExpanded.current){const frame=requestAnimationFrame(()=>{
      const active=document.activeElement;
      // Repacking can remount the card while the user is still in its dock.
      // Keep that live focus, including buttons and the options group.
      if(expanded&&active instanceof HTMLElement&&active!==document.body
        &&(root.current?.contains(active)||active.closest('[data-bar-dock]')))return;
      root.current?.querySelector<HTMLButtonElement>(expanded?'button[aria-label="Replier la carte"]':"h3 button")?.focus({preventScroll:true});
    });wasExpanded.current=expanded;return()=>cancelAnimationFrame(frame);}
  },[expanded]);
  const summary=model.nightOutSummaries?.find(s=>s.contextOccurrenceId===card.contextOccurrenceId);
  const fresh=summary?.semanticStateDigest===model.board.draft.semanticStateDigest;

  const removing=living.removingId===card.contextOccurrenceId;
  const open=(target:BarTarget)=>living.open(card,target), locked=busy||preserved||card.readOnly||removing;
  const semantic=model.semanticState.contexts.find(c=>c.contextOccurrenceId===card.contextOccurrenceId);
  const before=semantic&&barBefore(model.semanticState,semantic);
  const components=card.sockets.flatMap(socket=>socket.currentItems.filter(item=>item.kind==="COMPONENT"||item.kind==="CHILD_CONTEXT").map(item=>({slot:socket.slotKey,item,amount:socket.evaluations?.find(e=>e.selectionId===item.selectionId)?.economicAmount})));
  const route=(slot:"outbound"|"return")=>card.sockets.find(s=>s.slotKey===slot)?.currentItems.find(s=>s.kind==="MOBILITY_INTENT");
  // Presentation only: decoration yields to actual selected contents, never to a price.
  const richness=before||components.length>2||route("outbound")||route("return")?"rich":components.length||card.fields.placeRef||card.fields.plannedDate||(Array.isArray(card.fields.participantRefs)&&card.fields.participantRefs.length)?"partial":"empty";
  return <article {...surfaceProps} ref={root} className={styles.barLivingCard} data-bar-living-card data-context={card.contextOccurrenceId} data-template-key="night-out" data-expanded={expanded}
    data-preset-key="bar-apero" data-richness={richness} data-state={card.knowledge} data-removing={removing} aria-busy={removing} aria-label={card.label} onKeyDown={event=>{if(event.key==="Escape"&&expanded&&!document.querySelector("dialog[open],[popover]:popover-open")){event.preventDefault();event.stopPropagation();living.close();}}}>
    <header className={styles.barLivingHeader}>
      <button type="button" className={styles.barImageTrigger} disabled={locked} aria-label={`Ouvrir ${card.label}`} onClick={()=>open("summary")}><img src="/planned-visuals/builder/clay/drinks/bar-editorial.webp" alt="" className={styles.barLivingImage} width={128} height={128}/></button>
      <div className={styles.barLivingIdentity}><h3><button type="button" disabled={locked} onClick={()=>open("summary")}>{card.label}</button></h3>
        <div className={styles.barLivingAmount}><button type="button" data-bar-amount-trigger className={styles.barAmountTrigger} disabled={locked} aria-label="Modifier l’estimation des consommations" title="Choisir la portée à modifier · aucun total calculé n’est écrasé" onClick={()=>open("quick")}><strong>{summary?.knownAmount!=null?money(summary.knownAmount):"Coût à préciser"}</strong></button>
        {summary?.knownAmount!=null&&<small>{fresh?summary.incomplete?"connus · coûts à préciser":"Coût prévu":"Résultat précédent · actualisation"}</small>}
        {(preserved||card.readOnly)&&<small>{card.readOnly?"Lecture seule":"Carte préservée"}</small>}</div></div>
      <div className={styles.barLivingTools}>
        {remove&&<details className={styles.barManage}><summary aria-label={`Actions de ${card.label}`}>⋯</summary><button type="button" disabled={locked} onClick={remove}>Retirer la sortie</button></details>}
        {!card.readOnly&&<button type="button" disabled={busy} onClick={preserve} aria-label={`${preserved?"Libérer":"Préserver"} ${card.label}`} aria-pressed={preserved}><Pin size={15}/></button>}
        {expanded ? <button type="button" onClick={living.close} aria-label="Replier la carte"><X size={18}/></button>
          : <button type="button" {...handle} disabled={busy||card.readOnly} onClick={drag} aria-label={`Déplacer ${card.label}`}><GripVertical size={17}/></button>}
      </div>
    </header>
    {removing&&<p role="status" data-bar-removal-pending>Retrait en cours… Votre brouillon reste conservé jusqu’à confirmation.</p>}
    {expanded ? living.content : <div className={styles.barLivingCompact}>
      <BarMetadata fields={card.fields} model={model} open={open} disabled={locked}/>
      {(["outbound","return"] as const).map(slot=>{const leg=route(slot);return leg?.kind==="MOBILITY_INTENT"?<BarRouteLine key={slot} slot={slot} contextId={card.contextOccurrenceId} leg={leg} model={model} disabled={locked} navigate={open} open={()=>open(slot)}/>:null;})}
      {route("outbound")?.kind==="MOBILITY_INTENT"&&!route("return")&&!route("outbound")?.returnRequired&&<button type="button" className={styles.barInlineAdd} disabled={locked} onClick={()=>open("return")}>+ Retour</button>}
      {before&&<section data-bar-before-miniature><button type="button" className={styles.barSceneBack} disabled={locked} onClick={()=>open("before")}>Avant de sortir · {1+before.extras.length} objets</button><div className={styles.barLivingTiles}>{[before.bottle,...before.extras].slice(0,2).map(item=><button type="button" key={item.selectionId} disabled={locked} onClick={()=>open(item.selectionId===before.bottle.selectionId?`component:before-main:${item.selectionId}`:`component:before-extras:${item.selectionId}`)}><BarComponentFace item={item} fresh={fresh}/></button>)}{before.extras.length>1&&<button type="button" disabled={locked} onClick={()=>open("before")}>+{before.extras.length-1}</button>}</div></section>}
      {(["extras","food","main","before"] as const).map(slot=>{
        const items=components.filter(c=>c.slot===slot&&(slot!=="before"||!before));if(!items.length)return null;
        const label=slot==="extras"?"Au bar":slot==="food"?"Repas":slot==="before"?"Avant de sortir":items.some(c=>c.item.kind==="COMPONENT"&&c.item.label==="Consommations regroupées")?"Consommations regroupées":"Entrées / contribution";
        return <section key={slot} aria-label={label}><h4>{label}</h4><div className={styles.barLivingTiles}>{items.slice(0,2).map(({item,amount})=><button type="button" key={item.selectionId} disabled={locked} onClick={()=>open(`component:${slot}:${item.selectionId}`)}><BarComponentFace item={item} amount={amount} fresh={fresh}/></button>)}{items.length>2&&<button type="button" className={styles.barMoreCount} disabled={locked} onClick={()=>open(slot==="extras"?"drinks":"summary")} aria-label={`Voir les ${items.length} postes existants`}>+{items.length-2}</button>}</div></section>;
      })}
      {richness==="empty"&&!locked&&<button type="button" className={styles.barInlineAdd} onClick={()=>open("summary")}>Composer cette sortie <span aria-hidden="true">↗</span></button>}
    </div>}
  </article>;
}
