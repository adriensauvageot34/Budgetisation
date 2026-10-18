"use client";
import type {ReactNode} from "react";
import {mobilityIntentId} from "@/domain/phase2/planner/identity";
import {CalendarDays,Users,MapPin,ArrowRight,Car,Train,Bus,Footprints,Plus,CarTaxiFront} from "lucide-react";
import type {ComponentSelectionV1} from "@/domain/phase2/planner/component-contract";
import type {ComposerContextCardView} from "@/domain/phase2/planner/composer-contract";
import type {ComposerUiModel} from "@/domain/phase2/planner/composer-ui-contract";
import type {ProspectivePersonRef,ProspectivePlaceRef} from "@/domain/phase2/planned-contract";
import {SOCIAL_CONTACTS_V1} from "@/domain/phase2/planned-rules";
import {plannedAsset} from "@/domain/phase2/planned-assets";
import {money} from "./display";
import type {BarTarget,BarLeg} from "./bar-living-operations";
import styles from "./composer.module.css";

export const barPlaceLabel=(ref:ProspectivePlaceRef|null|undefined,model:ComposerUiModel)=>ref?.kind==="TEXT"?ref.label:ref?.kind==="KNOWN"?model.mobilityOptions?.places.find(p=>p.placeId===ref.placeId)?.name??"Lieu enregistré":"À préciser";
export const barModeLabel=(key:string)=>({car:"Voiture",train:"Train / tram",bus:"Bus",taxi:"Taxi",free:"À pied",other:"Autre mode",unknown:"Mode à préciser"} as Record<string,string>)[key]??"Trajet";
export const barDateLabel=(raw:unknown)=>typeof raw==="string"&&/^\d{4}-\d{2}-\d{2}$/.test(raw)?new Intl.DateTimeFormat("fr-FR",{weekday:"short",day:"numeric",month:"short",timeZone:"UTC"}).format(new Date(`${raw}T12:00:00Z`)):null;
export function barPersonLabel(person:ProspectivePersonRef,model:ComposerUiModel){return person.kind==="TEXT"?person.label:person.kind==="HOUSEHOLD_PERSON"?model.householdPersons.find(p=>p.personId===person.personId)?.displayName??"Personne liée":SOCIAL_CONTACTS_V1.find(p=>p.key===person.contactKey)?.label??"Contact lié";}
export function barPeopleLabel(value:unknown,model:ComposerUiModel){return Array.isArray(value)&&value.length?(value as ProspectivePersonRef[]).map(p=>barPersonLabel(p,model)).join(", "):"Personnes à préciser";}

/** Identity and authoritative amounts only; no client multiplication or summation. */
export function BarComponentFace({item,amount,fresh=true}: {item:ComponentSelectionV1;amount?:string|null;fresh?:boolean}){
 const asset=item.kind==="COMPONENT"&&item.productAssetRef?plannedAsset(item.productAssetRef.assetKey):undefined;
 const art=asset?.assetKey.split(":").at(-1);const image=art&&({beer:"beer",vodka:"vodka",rum:"rum",wine:"wine-glass",soft:"soft",water:"water",shot:"shot",mixer:"soft",crazy_tiger:"energy"} as Record<string,string>)[art];
 return <><span className={styles.barProductSymbol} aria-hidden="true">{image?<img src={`/planned-visuals/builder/clay/drinks/${image}.webp`} alt=""/>:asset?.icon??(item.kind==="CHILD_CONTEXT"?"🎟️":"✦")}</span>
   <strong>{item.kind==="COMPONENT"?item.label:"Moment lié"}{item.kind==="COMPONENT"?` ×${item.quantity}`:""}</strong>
   <small>{amount!=null?`${money(amount)}${fresh?"":" · précédent"}`:item.kind==="COMPONENT"&&item.cost.kind==="MANUAL"?`${money(item.cost.unitAmount)} / ${item.unitBasis==="SHARED"?"lot":"unité"}`:item.kind==="COMPONENT"&&item.cost.kind==="QUOTE"?"Devis conservé":item.kind==="CHILD_CONTEXT"?"Ouvrir ce moment":"Prix à préciser"}</small>
   {item.provenance==="PERSONAL_SUGGESTION"&&<small>Suggestion non retenue</small>}
   {item.kind==="COMPONENT"&&item.unitBasis!=="ITEM"&&<small>{item.unitBasis==="SHARED"?"Lot partagé":"Par personne tarifée"}</small>}
 </>;
}
export function BarMetadata({fields,model,open,editing=false,disabled=false,active,children}: {fields:ComposerContextCardView["fields"];model:ComposerUiModel;open:(target:BarTarget)=>void;editing?:boolean;disabled?:boolean;active?:string;children?:ReactNode}){
 const place=fields.placeRef as ProspectivePlaceRef|undefined,date=barDateLabel(fields.plannedDate),people=Array.isArray(fields.participantRefs)?fields.participantRefs as ProspectivePersonRef[]:[];
 return <nav className={styles.barLivingMetadata} aria-label="Précisions de la sortie">
   {children}
   <button type="button" aria-label="Modifier le lieu" aria-pressed={active==="place"||active==="manual-place"||active==="google"} disabled={disabled} onClick={()=>open("place")} title={place?.kind==="KNOWN"?"Lieu enregistré · identité conservée":"Repère textuel · itinéraire à préciser"}>{place?<MapPin size={14}/>:<Plus size={14}/>} {place?barPlaceLabel(place,model):"Lieu"}</button>
   <button type="button" aria-label="Modifier la date" aria-pressed={active==="date"} disabled={disabled} onClick={()=>open("date")}>{date?<CalendarDays size={14}/>:<Plus size={14}/>} {date??"Date"}</button>
   <button type="button" className={styles.barPeople} aria-pressed={active==="people"} disabled={disabled} onClick={()=>open("people")} aria-label={`Modifier les personnes · ${barPeopleLabel(people,model)}`} title={barPeopleLabel(people,model)}>
     {people.length?people.slice(0,3).map((p,i)=>{const label=barPersonLabel(p,model);return <span key={i}><i aria-hidden="true">{label.split(/\s+/).filter(Boolean).slice(0,2).map(s=>s[0]).join("")}</i>{label.split(/\s+/)[0]}</span>;}):<><Plus size={14}/>Personnes</>}{people.length>3&&<span>+{people.length-3}</span>}
   </button>
 </nav>;
}
export function BarRouteLine({slot,leg,model,open,contextId,disabled=false,active=false}: {slot:"outbound"|"return";contextId:string;leg?:BarLeg;model:ComposerUiModel;open:()=>void;disabled?:boolean;active?:boolean}){
 const summary=model.mobilitySummaries?.find(s=>s.contextOccurrenceId===contextId&&s.ownerIntentId===mobilityIntentId(contextId,slot));
 const fresh=model.nightOutSummaries?.find(s=>s.contextOccurrenceId===contextId)?.semanticStateDigest===model.board.draft.semanticStateDigest;
 const Icon=leg?.optionKey==="car"?Car:leg?.optionKey==="taxi"?CarTaxiFront:leg?.optionKey==="train"?Train:leg?.optionKey==="bus"?Bus:leg?.optionKey==="free"?Footprints:ArrowRight;
 return <button type="button" className={styles.barRouteLine} data-bar-route={slot} aria-pressed={active} disabled={disabled} onClick={open}>
   <b>{leg?.returnRequired?"Aller-retour":slot==="outbound"?"Aller":"Retour"}</b>{leg?<><span className={styles.barRouteStops}>{barPlaceLabel(leg.origin,model)}<span><Icon size={17}/>{barModeLabel(leg.optionKey)}<ArrowRight size={14}/></span>{barPlaceLabel(leg.destination,model)}</span>
     <small>{leg.optionKey==="car"?"Coût d’usage estimé": "Tarif prévu"} · {leg.optionKey==="car"?summary?.economicFuel!=null?money(summary.economicFuel):"à estimer":leg.pricing?.fare.kind==="MANUAL"?`${money(leg.pricing.fare.unitAmount)} déclaré`:summary?.fare!=null?money(summary.fare):leg.pricing?.fare.kind==="QUOTE"?"devis à estimer":"à préciser"}{summary&&!fresh?" · estimation précédente":""}
       {(leg.route?.stops.length??0)>2&&` · ${leg.route!.stops.length} arrêts`}
     </small></>
     :<span><Plus size={14}/>{slot==="return"?"Retour":"Déplacement"}</span>}
 </button>;
}
