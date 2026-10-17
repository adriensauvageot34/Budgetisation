"use client";
import {useEffect,useRef,type ReactNode,type HTMLAttributes} from "react";
import { X, GripVertical, Pin } from "lucide-react";
import type { ComposerContextCardView } from "@/domain/phase2/planner/composer-contract";
import type { ComposerUiModel } from "@/domain/phase2/planner/composer-ui-contract";


import { composerPreset } from "@/domain/phase2/planner/composer-presets";
import { PresetIllustration } from "./preset-illustration";
import { money } from "./display";
import { useDragHandle } from "./interactions";
import type { BarTarget } from "./bar-living-operations";
import styles from "./composer.module.css";
import {BarMetadata,BarRouteLine,BarComponentFace,barPlaceLabel,barModeLabel,barPeopleLabel} from "./bar-living-details";
export {barPlaceLabel,barModeLabel,barPeopleLabel};

export type LivingBar = {id?:string; content?:ReactNode; open:(card:ComposerContextCardView,target:BarTarget)=>void; close:()=>void};

export function BarLivingCard({card,model,living,busy,preserved,preserve,remove,drag,surfaceProps}: {
  card:ComposerContextCardView; model:ComposerUiModel; living:LivingBar; busy:boolean; preserved:boolean;
  preserve:()=>void; remove?:()=>void; drag:()=>void;surfaceProps?:HTMLAttributes<HTMLElement>;
}) {
  const handle=useDragHandle(`context-occurrence:${card.contextOccurrenceId}`), expanded=living.id===card.contextOccurrenceId;
  const root=useRef<HTMLElement>(null),wasExpanded=useRef(false);
  useEffect(()=>{
    if(expanded||wasExpanded.current){const frame=requestAnimationFrame(()=>root.current?.querySelector<HTMLButtonElement>(expanded?'button[aria-label="Replier la carte"]':"h3 button")?.focus({preventScroll:true}));wasExpanded.current=expanded;return()=>cancelAnimationFrame(frame);}
  },[expanded]);
  const summary=model.nightOutSummaries?.find(s=>s.contextOccurrenceId===card.contextOccurrenceId);
  const fresh=summary?.semanticStateDigest===model.board.draft.semanticStateDigest;

  const open=(target:BarTarget)=>living.open(card,target), locked=busy||preserved||card.readOnly;
  return <article {...surfaceProps} ref={root} className={styles.barLivingCard} data-bar-living-card data-context={card.contextOccurrenceId} data-template-key="night-out" data-expanded={expanded}
    data-preset-key="bar-apero" data-state={card.knowledge} aria-label={card.label} onKeyDown={event=>{if(event.key==="Escape"&&expanded&&!document.querySelector("dialog[open],[popover]:popover-open")){event.preventDefault();event.stopPropagation();living.close();}}}>
    <header className={styles.barLivingHeader}>
      <PresetIllustration preset={composerPreset("bar-apero")!} className={styles.barLivingImage}/>
      <div><h3><button type="button" disabled={locked} onClick={()=>open("summary")}>{card.label}</button></h3>
        <strong>{summary?.knownAmount!=null?money(summary.knownAmount):"Coût à préciser"}</strong>
        <small>{summary?.knownAmount!=null?(fresh?summary.incomplete?"connus · à compléter":"Coût prévu":"Résultat précédent · recalcul en cours"):"Aucun prix inventé"}</small></div>
      <div className={styles.barLivingTools}>
        {!card.readOnly&&<button type="button" disabled={busy} onClick={preserve} aria-label={`${preserved?"Libérer":"Préserver"} ${card.label}`} aria-pressed={preserved}><Pin size={15}/></button>}
        {expanded ? <button type="button" onClick={living.close} aria-label="Replier la carte"><X size={18}/></button>
          : <button type="button" {...handle} disabled={busy||card.readOnly} onClick={drag} aria-label={`Déplacer ${card.label}`}><GripVertical size={17}/></button>}
      </div>
    </header>
    {expanded ? living.content : <div className={styles.barLivingCompact}>
      <BarMetadata fields={card.fields} model={model} open={open} disabled={locked}/>
      {(["outbound","return"] as const).map(slot=>{const leg=card.sockets.find(s=>s.slotKey===slot)?.currentItems.find(s=>s.kind==="MOBILITY_INTENT");return <BarRouteLine key={slot} slot={slot} contextId={card.contextOccurrenceId} leg={leg?.kind==="MOBILITY_INTENT"?leg:undefined} model={model} disabled={locked} open={()=>open(slot)}/>;})}
      <div className={styles.barLivingTiles}>{card.sockets.flatMap(socket=>socket.currentItems.filter(item=>item.kind==="COMPONENT"||item.kind==="CHILD_CONTEXT").map(item=><button type="button" key={item.selectionId} disabled={locked} onClick={()=>open(`component:${socket.slotKey}:${item.selectionId}`)}>
        <BarComponentFace item={item} amount={socket.evaluations?.find(e=>e.selectionId===item.selectionId)?.economicAmount} fresh={fresh}/>
      </button>))}<button type="button" className={styles.barAddSlot} disabled={locked} onClick={()=>open("drinks")} aria-label="Ajouter une consommation">+<small>Consommation</small></button></div>
      {remove&&<button type="button" className={styles.nightLink} disabled={locked} onClick={remove}>Retirer ce moment</button>}
    </div>}
  </article>;
}
