"use client";
import {useEffect,useRef,type ReactNode,type HTMLAttributes} from "react";
import { X, GripVertical, Pin } from "lucide-react";
import type { ComposerContextCardView } from "@/domain/phase2/planner/composer-contract";
import type { ComposerUiModel } from "@/domain/phase2/planner/composer-ui-contract";
import type { ProspectivePlaceRef,ProspectivePersonRef } from "@/domain/phase2/planned-contract";
import {SOCIAL_CONTACTS_V1} from "@/domain/phase2/planned-rules";
import { composerPreset } from "@/domain/phase2/planner/composer-presets";
import { PresetIllustration } from "./preset-illustration";
import { money } from "./display";
import { useDragHandle } from "./interactions";
import type { BarTarget } from "./bar-living-operations";
import styles from "./composer.module.css";

export type LivingBar = {id?:string; content?:ReactNode; open:(card:ComposerContextCardView,target:BarTarget)=>void; close:()=>void};
export const barPlaceLabel = (ref: ProspectivePlaceRef | null | undefined, model:ComposerUiModel) =>
  ref?.kind === "TEXT" ? ref.label : ref?.kind === "KNOWN" ? model.mobilityOptions?.places.find(p=>p.placeId===ref.placeId)?.name ?? "Lieu enregistré" : "À préciser";
export const barModeLabel = (key:string) => ({car:"Voiture",train:"Train / tram",bus:"Bus",taxi:"Taxi",free:"Gratuit déclaré",other:"Autre transport",unknown:"Mode à préciser"} as Record<string,string>)[key] ?? "Trajet";
export function barPeopleLabel(value:unknown,model:ComposerUiModel) {
  if(!Array.isArray(value)||!value.length)return "Personnes à préciser";
  return (value as ProspectivePersonRef[]).map(person=>person.kind==="TEXT"?person.label:person.kind==="HOUSEHOLD_PERSON"
    ?model.householdPersons.find(p=>p.personId===person.personId)?.displayName??"Personne liée"
    :SOCIAL_CONTACTS_V1.find(p=>p.key===person.contactKey)?.label??"Contact lié").join(", ");
}

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
  const knownCost=card.sockets.some(socket=>socket.evaluations?.some(evaluation=>evaluation.economicAmount!=null));
  const hasChoices=card.sockets.some(socket=>socket.currentItems.length>0);
  const open=(target:BarTarget)=>living.open(card,target), locked=busy||preserved||card.readOnly;
  return <article {...surfaceProps} ref={root} className={styles.barLivingCard} data-bar-living-card data-context={card.contextOccurrenceId} data-template-key="night-out" data-expanded={expanded}
    data-state={card.knowledge} aria-label={card.label} onKeyDown={event=>{if(event.key==="Escape"&&expanded&&!document.querySelector("dialog[open],[popover]:popover-open")){event.preventDefault();event.stopPropagation();living.close();}}}>
    <header className={styles.barLivingHeader}>
      <PresetIllustration preset={composerPreset("bar-apero")!} className={styles.barLivingImage}/>
      <div><h3><button type="button" disabled={locked} onClick={()=>open("place")}>{card.label}</button></h3>
        <strong>{fresh ? knownCost ? money(summary?.knownAmount??null) : hasChoices?"Coût à préciser":"Aucun coût décidé" : "Projection à actualiser"}</strong>
        {fresh&&summary?.incomplete&&<small>Part connue · à compléter</small>}</div>
      <div className={styles.barLivingTools}>
        {!card.readOnly&&<button type="button" disabled={busy} onClick={preserve} aria-label={`${preserved?"Libérer":"Préserver"} ${card.label}`} aria-pressed={preserved}><Pin size={15}/></button>}
        {expanded ? <button type="button" onClick={living.close} aria-label="Replier la carte"><X size={18}/></button>
          : <button type="button" {...handle} disabled={busy||card.readOnly} onClick={drag} aria-label={`Déplacer ${card.label}`}><GripVertical size={17}/></button>}
      </div>
    </header>
    {expanded ? living.content : <div className={styles.barLivingCompact}>
      <button type="button" disabled={locked} onClick={()=>open("place")}>{barPlaceLabel(card.fields.placeRef as ProspectivePlaceRef,model)}</button>
      <div><button type="button" disabled={locked} onClick={()=>open("date")}>{String(card.fields.plannedDate??"Date à préciser")}</button>
        <button type="button" disabled={locked} onClick={()=>open("people")}>{barPeopleLabel(card.fields.participantRefs,model)}</button></div>
      {(["outbound","return"] as const).map(slot=>{const leg=card.sockets.find(s=>s.slotKey===slot)?.currentItems.find(s=>s.kind==="MOBILITY_INTENT");return <button type="button" key={slot} disabled={locked} onClick={()=>open(slot)}>
        <b>{slot==="outbound"?"Aller":"Retour"}</b> · {leg?.kind==="MOBILITY_INTENT"?`${barModeLabel(leg.optionKey)} · ${barPlaceLabel(leg.origin,model)} → ${barPlaceLabel(leg.destination,model)}`:"À préciser"}</button>;})}
      <div className={styles.barLivingTiles}>{card.sockets.flatMap(socket=>socket.currentItems.filter(item=>item.kind==="COMPONENT"||item.kind==="CHILD_CONTEXT").map(item=><button type="button" key={item.selectionId} disabled={locked} onClick={()=>open(`component:${socket.slotKey}:${item.selectionId}`)}>
        {item.kind==="COMPONENT"?item.label:"Moment lié"}</button>))}<button type="button" disabled={locked} onClick={()=>open("drinks")}>+ Consommation</button></div>
      {remove&&<button type="button" className={styles.nightLink} disabled={locked} onClick={remove}>Retirer ce moment</button>}
    </div>}
  </article>;
}
