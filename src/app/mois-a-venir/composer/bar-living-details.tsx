"use client";
import type {ReactNode} from "react";
import {mobilityIntentId} from "@/domain/phase2/planner/identity";
import {CalendarDays,Users,MapPin,ArrowRight,Car,Train,Bus,Footprints,Plus,CarTaxiFront} from "lucide-react";
import type {ComponentSelectionV1} from "@/domain/phase2/planner/component-contract";
import type {ComposerContextCardView} from "@/domain/phase2/planner/composer-contract";
import type {ComposerUiModel} from "@/domain/phase2/planner/composer-ui-contract";
import type {ProspectivePersonRef,ProspectivePlaceRef} from "@/domain/phase2/planned-contract";
import {SOCIAL_CONTACTS_V1} from "@/domain/phase2/planned-rules";
import {BarProductVisual} from "./bar-product-visual";
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
 return <><BarProductVisual assetKey={item.kind==="COMPONENT"?item.productAssetRef?.assetKey:undefined} label={item.kind==="COMPONENT"?item.label:""} child={item.kind==="CHILD_CONTEXT"}/>
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
export function BarRouteLine({slot,leg,model,open,navigate,contextId,disabled=false,active=false}: {slot:"outbound"|"return";contextId:string;leg?:BarLeg;model:ComposerUiModel;open:()=>void;navigate?:(target:BarTarget)=>void;disabled?:boolean;active?:boolean}){
 const summary=model.mobilitySummaries?.find(s=>s.contextOccurrenceId===contextId&&s.ownerIntentId===mobilityIntentId(contextId,slot));
 const fresh=model.nightOutSummaries?.find(s=>s.contextOccurrenceId===contextId)?.semanticStateDigest===model.board.draft.semanticStateDigest;
 const Icon=leg?.optionKey==="car"?Car:leg?.optionKey==="taxi"?CarTaxiFront:leg?.optionKey==="train"?Train:leg?.optionKey==="bus"?Bus:leg?.optionKey==="free"?Footprints:ArrowRight;
 const go=(point:"origin"|"destination"|"fare"|"vehicle")=>navigate?navigate(`route:${slot}:${point}`):open();
 const cost=leg?.optionKey==="car"?summary?.economicFuel:leg?.pricing?.fare.kind==="MANUAL"?leg.pricing.fare.unitAmount:summary?.fare;
 const missing=leg?[!leg.origin?"départ":null,!leg.destination?"arrivée":null,leg.optionKey==="car"&&!leg.route?.vehicleRef?"véhicule":null,leg.origin?.kind==="TEXT"||leg.destination?.kind==="TEXT"?"distance du repère libre":null].filter(Boolean):[];
 const fallbackLabels:Record<string,string>={GEOCODING_UNAVAILABLE:"Adresse non résolue",OFFICIAL_PRICE_UNAVAILABLE:"Référence publique de carburant indisponible",FUEL_PRICE_FALLBACK:"Prix de carburant de repli",FUEL_PRICE_UNAVAILABLE:"Prix de carburant indisponible",TOMTOM_UNAVAILABLE:"Calcul d’itinéraire indisponible",TOLL_UNAVAILABLE:"Péage à préciser"};
 const availability=[...new Set((summary?.fallbacks??[]).map(code=>fallbackLabels[code]).filter(Boolean))];
 const vehicle=leg?.route?.vehicleRef;
 return <div className={styles.barRouteLine} data-bar-route-module={slot} data-active={active}>
   <button type="button" data-bar-route={slot} aria-pressed={active} disabled={disabled} onClick={open}><b>{leg?.returnRequired?"Aller-retour":slot==="outbound"?"Aller":"Retour"}</b><Icon size={17}/>{leg?barModeLabel(leg.optionKey):"Déplacement"}</button>
   {leg&&<><div className={styles.barRouteStops}><button type="button" disabled={disabled} onClick={()=>go("origin")} aria-label={`Modifier le départ ${slot==="outbound"?"de l’aller":"du retour"}`}>Départ · {barPlaceLabel(leg.origin,model)}</button><ArrowRight size={14}/><button type="button" disabled={disabled} onClick={()=>go("destination")} aria-label={`Modifier l’arrivée ${slot==="outbound"?"de l’aller":"du retour"}`}>Arrivée · {barPlaceLabel(leg.destination,model)}</button></div>
   {leg.optionKey==="car"&&<button type="button" data-bar-vehicle-capsule title={vehicle?.labelAtSelection??"Choisir un véhicule"} disabled={disabled} onClick={()=>go("vehicle")} aria-label={`Modifier le véhicule ${slot==="outbound"?"de l’aller":"du retour"}`}><Car size={14}/><span>{vehicle?.labelAtSelection??"Véhicule à choisir"}</span></button>}
   <button type="button" className={styles.barRouteCost} disabled={disabled} onClick={()=>leg.optionKey==="car"?open():go("fare")} aria-label={`${leg.optionKey==="car"?"Consulter le coût d’usage":"Modifier le tarif"} ${slot==="outbound"?"de l’aller":"du retour"}`}>
     {cost!=null?money(cost):leg.optionKey==="car"?"Usage à estimer":"Tarif à préciser"}{cost!=null&&<small>{leg.optionKey==="car"?"Coût d’usage":"Tarif prévu"}{!fresh?" · précédent":""}</small>}
   </button>
   {leg.optionKey==="car"&&<small data-bar-usage-not-payment>Coût d’usage estimé · aucun achat de carburant.{cost==null&&missing.length===0?" Estimation Mobility encore indisponible ; aucun prix n’est supposé.":""}{summary?.status==="PARTIAL"?" Estimation partielle.":""}</small>}
   {leg.optionKey==="car"&&summary?.fare!=null&&<small>Autre tarif prévu : {money(summary.fare)}{!fresh?" · précédent":""}</small>}
   {(missing.length>0||summary?.toll!=null||summary?.parking!=null||summary?.cashTransport!=null||(leg.route?.stops.length??0)>2)&&<small className={styles.barRouteEvidence}>{missing.length>0&&`À préciser : ${missing.join(", ")}`}{summary?.toll!=null&&` · péage ${money(summary.toll)}`}{summary?.parking!=null&&` · parking ${money(summary.parking)}`}{summary?.cashTransport!=null&&` · coût monétaire du transport ${money(summary.cashTransport)}`}{(leg.route?.stops.length??0)>2&&` · ${leg.route!.stops.length-2} étape(s) intermédiaire(s)`}</small>}
   {availability.length>0&&<small data-bar-route-availability>{availability.join(" · ")}{!fresh?" · précédente estimation":""}</small>}
   </>}
 </div>;
}
