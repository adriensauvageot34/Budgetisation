"use client";
import type {ReactNode} from "react";
import {mobilityIntentId} from "@/domain/phase2/planner/identity";
import {CalendarDays,Users,MapPin,ArrowRight,ArrowLeftRight,Car,Train,Bus,Footprints,Plus,CarTaxiFront,X,Settings2} from "lucide-react";
import type {ComponentSelectionV1} from "@/domain/phase2/planner/component-contract";
import type {ComposerContextCardView} from "@/domain/phase2/planner/composer-contract";
import type {ComposerUiModel} from "@/domain/phase2/planner/composer-ui-contract";
import type {ProspectivePersonRef,ProspectivePlaceRef} from "@/domain/phase2/planned-contract";
import {parseNightOutVenue} from "@/domain/phase2/planner/night-out-venue";
import {SOCIAL_CONTACTS_V1} from "@/domain/phase2/planned-rules";
import {BarProductVisual} from "./bar-product-visual";
import {money} from "./display";
import type {BarTarget,BarLeg} from "./bar-living-operations";
import styles from "./composer.module.css";
import {barEndpointLabel} from './bar-place-knowledge';

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
export function BarMetadata({fields,model,open,editing=false,disabled=false,active,children,removePlace}: {fields:ComposerContextCardView["fields"];model:ComposerUiModel;open:(target:BarTarget)=>void;editing?:boolean;disabled?:boolean;active?:string;children?:ReactNode;removePlace?:()=>void}){
 const place=fields.placeRef as ProspectivePlaceRef|undefined,date=barDateLabel(fields.plannedDate),people=Array.isArray(fields.participantRefs)?fields.participantRefs as ProspectivePersonRef[]:[];
 const googleVenue=fields.venueDecision?!!parseNightOutVenue(fields.venueDecision).google:false;
 return <nav className={styles.barLivingMetadata} aria-label="Précisions de la sortie">
   {children}
   {(!editing||!place)&&<button type="button" aria-label="Modifier le lieu" aria-pressed={active==="place"||active==="manual-place"||active==="google"} disabled={disabled} onClick={()=>open("place")} title={place?.kind==="KNOWN"?"Lieu enregistré · identité conservée":googleVenue?"Bar Google retenu · itinéraire calculable sous réserve des fournisseurs":"Repère textuel · itinéraire à préciser"}>{place?<MapPin size={14}/>:<Plus size={14}/>} {place?barPlaceLabel(place,model):"Lieu"}</button>}
   {place&&removePlace&&(!editing||active==="place"||active==="google"||active==="manual-place")&&<button type="button" aria-label="Retirer le lieu de la sortie" disabled={disabled} onClick={removePlace}><X size={14}/></button>}
   {(!editing||!date)&&<button type="button" aria-label="Modifier la date" aria-pressed={active==="date"} disabled={disabled} onClick={()=>open("date")}>{date?<CalendarDays size={14}/>:<Plus size={14}/>} {date??"Date"}</button>}
   {(!editing||!people.length)&&<button type="button" className={styles.barPeople} aria-pressed={active==="people"} disabled={disabled} onClick={()=>open("people")} aria-label={`Modifier les personnes · ${barPeopleLabel(people,model)}`} title={barPeopleLabel(people,model)}>
     {active==="people"?<><Users size={14}/>{people.length?`${people.length} personne${people.length>1?"s":""}`:"Personnes"}</>:<>{people.length?people.slice(0,3).map((p,i)=>{const label=barPersonLabel(p,model);return <span key={i}><i aria-hidden="true">{label.split(/\s+/).filter(Boolean).slice(0,2).map(s=>s[0]).join("")}</i>{label.split(/\s+/)[0]}</span>;}):<><Plus size={14}/>Personnes</>}{people.length>3&&<span>+{people.length-3}</span>}</>}
   </button>}
 </nav>;
}
export type BarRouteAction="mode"|"vehicle"|"reverse"|"remove"|"advanced"|"time";
export function BarRouteLine({slot,leg,model,open,navigate,contextId,disabled=false,active=false,action,pending=false,failed=false,compact=false}: {slot:"outbound"|"return";contextId:string;leg?:BarLeg;model:ComposerUiModel;open:()=>void;navigate?:(target:BarTarget)=>void;disabled?:boolean;active?:boolean;action?:(action:BarRouteAction)=>void;pending?:boolean;failed?:boolean;compact?:boolean}){
 const summary=model.mobilitySummaries?.find(s=>s.contextOccurrenceId===contextId&&s.ownerIntentId===mobilityIntentId(contextId,slot));
 const fresh=model.nightOutSummaries?.find(s=>s.contextOccurrenceId===contextId)?.semanticStateDigest===model.board.draft.semanticStateDigest;
 const Icon=leg?.optionKey==="car"?Car:leg?.optionKey==="taxi"?CarTaxiFront:leg?.optionKey==="train"?Train:leg?.optionKey==="bus"?Bus:leg?.optionKey==="free"?Footprints:ArrowRight;
 const go=(point:"origin"|"destination"|"fare"|"vehicle")=>navigate?navigate(`route:${slot}:${point}`):open();
 const cost=leg?.optionKey==="car"?summary?.economicFuel:leg?.pricing?.fare.kind==="MANUAL"?leg.pricing.fare.unitAmount:summary?.fare;
 const missing=leg?[!leg.origin?"départ":null,!leg.destination?"arrivée":null,leg.optionKey==="car"&&!leg.route?.vehicleRef?"véhicule":null,(leg.origin?.kind==="TEXT"&&!leg.venueEndpoints?.origin?.venue.google&&!leg.routeEndpointBindings?.origin)||(leg.destination?.kind==="TEXT"&&!leg.venueEndpoints?.destination?.venue.google&&!leg.routeEndpointBindings?.destination)?"distance du repère libre":null].filter(Boolean):[];
 const fallbackLabels:Record<string,string>={GEOCODING_UNAVAILABLE:"Adresse non résolue",OFFICIAL_PRICE_UNAVAILABLE:"Référence publique de carburant indisponible",FUEL_PRICE_FALLBACK:"Prix de carburant de repli",FUEL_PRICE_UNAVAILABLE:"Prix de carburant indisponible",TOMTOM_UNAVAILABLE:"Calcul d’itinéraire indisponible",TOLL_UNAVAILABLE:"Péage à préciser"};
 const availability=[...new Set((summary?.fallbacks??[]).map(code=>fallbackLabels[code]).filter(Boolean))];
 const vehicle=leg?.route?.vehicleRef;
 const vehicleDisplay=vehicle?.vehicleId===model.mobilityOptions?.vehicle?.vehicleId?model.mobilityOptions?.vehicle?.presentation?.displayName:undefined;
 const proposed=!vehicle&&model.mobilityOptions?.vehicleIsUnique&&model.mobilityOptions.vehicle?.vehicleId?model.mobilityOptions.vehicle:null;
 const vehicleLabel=vehicleDisplay??vehicle?.labelAtSelection??proposed?.presentation?.displayName??proposed?.label??"Choisir un véhicule";
 const estimating=pending&&!failed&&!!leg?.origin&&!!leg?.destination&&(leg.optionKey!=="car"||!!vehicle)&&!fresh;
 if(compact){
   const label=(ref:ProspectivePlaceRef|null|undefined)=>{const place=ref?.kind==='KNOWN'?model.mobilityOptions?.places.find(p=>p.placeId===ref.placeId):undefined;return place?barEndpointLabel(place):barPlaceLabel(ref,model);};
   const amount=!failed&&!estimating&&fresh&&cost!=null?`${leg?.optionKey==='car'?'≈ ':''}${money(cost)}`:'';
   const description=[leg?.returnRequired?'Trajet aller-retour':null,leg?.optionKey==='car'?`Coût d’usage ${summary?.status==='PARTIAL'?'partiel':'estimé'} ≠ achat de carburant`:null,failed?'Estimation indisponible':estimating?'Estimation en cours':!fresh?'Projection à actualiser':cost==null?'Prix non renseigné':null,...availability,missing.length?`À préciser : ${missing.join(', ')}`:null,summary?.toll!=null?`Péage ${money(summary.toll)}`:null,summary?.parking!=null?`Stationnement ${money(summary.parking)}`:null,(leg?.route?.stops.length??0)>2?`${leg!.route!.stops.length-2} étapes intermédiaires conservées`:null].filter(Boolean).join(' · ');
   return <button type="button" className={styles.barRouteBadge} data-bar-route-module={slot} data-bar-route={slot} aria-pressed={active} disabled={disabled} onClick={open} title={description} aria-label={`${slot==='outbound'?'Modifier l’aller':'Modifier le retour'} · ${description}`}>
     <Icon size={13}/><span>{label(leg?.origin)} – {barModeLabel(leg?.optionKey??'unknown')} {leg?.returnRequired?'⇄':'–'} {label(leg?.destination)}{amount&&<> · {amount}</>}</span>
   </button>;
 }
 return <div className={styles.barRouteLine} data-bar-route-module={slot} data-active={active} data-bar-route-compact={!!action}>
   <button type="button" data-bar-route={slot} aria-pressed={active} disabled={disabled} onClick={()=>action?action("mode"):open()}><b>{leg?.returnRequired?"Aller-retour":slot==="outbound"?"Aller":"Retour"}</b><Icon size={17}/>{leg?barModeLabel(leg.optionKey):"Déplacement"}</button>
   {leg&&<>{leg.optionKey==="car"&&<button type="button" data-bar-vehicle-capsule data-proposed={!!proposed} title={proposed?"Véhicule proposé · cliquez pour le retenir":vehicleLabel} disabled={disabled} onClick={()=>action?action("vehicle"):go("vehicle")} aria-label={`${proposed?"Retenir":"Modifier"} le véhicule ${slot==="outbound"?"de l’aller":"du retour"}`}><Car size={14}/><span>{vehicleLabel}{proposed?" · Retenir":""}</span></button>}
   <div className={styles.barRouteStops}><button type="button" data-route-google-id={leg.routeEndpointBindings?.origin?.google.placeId} title={barPlaceLabel(leg.origin,model)+(leg.routeEndpointBindings?.origin?" · Google retenu, adresse relue au calcul":"")} disabled={disabled} onClick={()=>go("origin")} aria-label={`Modifier le départ ${slot==="outbound"?"de l’aller":"du retour"}`}><span>{barPlaceLabel(leg.origin,model)}</span></button>{action?<button type="button" data-bar-route-reverse aria-label={`Inverser les points ${slot==="outbound"?"de l’aller":"du retour"}`} title="Inverser ce seul sens" disabled={disabled} onClick={()=>action("reverse")}><ArrowLeftRight size={16}/></button>:<ArrowRight size={14}/>}<button type="button" data-route-google-id={leg.routeEndpointBindings?.destination?.google.placeId} title={barPlaceLabel(leg.destination,model)+(leg.routeEndpointBindings?.destination?" · Google retenu, adresse relue au calcul":"")} disabled={disabled} onClick={()=>go("destination")} aria-label={`Modifier l’arrivée ${slot==="outbound"?"de l’aller":"du retour"}`}><span>{barPlaceLabel(leg.destination,model)}</span></button></div>
   <button type="button" className={styles.barRouteCost} title={cost==null?"Montant à préciser · aucun prix supposé":leg.optionKey==="car"?"Coût d’usage estimé, aucun achat de carburant":"Tarif prévu explicitement"} disabled={disabled} onClick={event=>{if(leg.optionKey!=="car"){go("fare");return;}const details=event.currentTarget.parentElement?.querySelector("details");if(details)details.open=!details.open;}} aria-label={`${leg.optionKey==="car"?"Consulter le coût d’usage":"Modifier le tarif"} ${slot==="outbound"?"de l’aller":"du retour"}`}>
     {failed&&leg.optionKey==="car"?"Estimation indisponible":estimating&&leg.optionKey==="car"?"Estimation en cours":cost!=null?money(cost):leg.optionKey==="car"?"Usage à préciser":"Tarif inconnu"}{cost!=null&&!failed&&!(estimating&&leg.optionKey==="car")&&<small>{leg.optionKey==="car"?(summary?.status==="PARTIAL"?"Usage partiel":"Usage estimé"):"Tarif prévu"}{!fresh?" · précédent":""}{fresh&&summary?.distanceKm!=null?` · ${summary.distanceKm} km`:""}</small>}
   </button>
   <details className={styles.barRouteEvidence} data-bar-route-availability><summary>{summary?.status==="PARTIAL"?"Estimation partielle":cost==null?"À préciser":"Détails du coût"}</summary>
   {summary?.distanceKm!=null&&<small>{summary.distanceKm} km{summary.durationSeconds!=null?` · ${summary.durationSeconds} s`:""}{summary.fuelLiters!=null?` · ${summary.fuelLiters} L`:""}{!fresh?" · précédent":""}</small>}
   {leg.optionKey==="car"&&<small data-bar-usage-not-payment>Coût d’usage estimé · aucun achat de carburant.{cost==null&&missing.length===0?" Estimation Mobility encore indisponible ; aucun prix n’est supposé.":""}{summary?.status==="PARTIAL"?" Estimation partielle.":""}</small>}
   {leg.optionKey==="car"&&summary?.fare!=null&&<small>Autre tarif prévu : {money(summary.fare)}{!fresh?" · précédent":""}</small>}
   {(missing.length>0||summary?.toll!=null||summary?.parking!=null||summary?.cashTransport!=null||(leg.route?.stops.length??0)>2)&&<small className={styles.barRouteEvidence}>{missing.length>0&&`À préciser : ${missing.join(", ")}`}{summary?.toll!=null&&` · péage ${money(summary.toll)}`}{summary?.parking!=null&&` · parking ${money(summary.parking)}`}{summary?.cashTransport!=null&&` · coût monétaire du transport ${money(summary.cashTransport)}`}{(leg.route?.stops.length??0)>2&&` · ${leg.route!.stops.length-2} étape(s) intermédiaire(s)`}</small>}
   {availability.length>0&&<small>{availability.join(" · ")}{!fresh?" · précédente estimation":""}</small>}
   {action&&<button type="button" disabled={disabled} onClick={()=>action("time")}>Heure de départ{leg.plannedTime?` · ${leg.plannedTime}`:" · facultative"}</button>}
   </details>
   {action&&<><button type="button" aria-label={`Options avancées ${slot==="outbound"?"de l’aller":"du retour"}`} title="Relations, financement, étapes et véhicule" disabled={disabled} onClick={()=>action("advanced")}><Settings2 size={15}/></button><button type="button" aria-label={`Retirer uniquement ${slot==="outbound"?"l’aller":"le retour"}`} title="Retirer ce seul sens · Undo disponible" disabled={disabled} onClick={()=>action("remove")}><X size={16}/></button></>}
   </>}
 </div>;
}
