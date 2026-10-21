"use client";
import {useCallback,useEffect,useId,useRef,useState} from "react";
import {createPortal} from "react-dom";
import {MapPin} from "lucide-react";
import {RestaurantSearchSession,validGooglePlaceId,type RestaurantSuggestion,type SelectedRestaurantPlace} from "@/domain/phase2/restaurant-places";
import type {PlannedPlaceOption} from "@/domain/phase2/planned-places";
import {GoogleMapsAttribution} from "../restaurant-place-search";
import styles from "./composer.module.css";
import {projectPlaceTypeCompatible} from "@/domain/phase2/restaurant-places";
import type {PersonalGooglePlace} from "@/domain/phase2/personal-google-place";
import type {BarGoogleRef} from "@/domain/phase2/planner/night-out-venue";
import {BarPersonalPlaces} from "./bar-personal-places";
import {useInlineEditRegistry} from "./inline-edit-registry";
import {useBarPlaceTransport} from "./bar-place-transport";
export type BarPlaceSearchState={query:string;city:string;resultPage:number;googleOn?:boolean;detail?:SelectedRestaurantPlace;detailReadAt?:number;personalPlacesEnabled?:boolean};
/** Fixed result footprint; full owner text is available to keyboard and pointer. */
export function BarPlaceChoice({label,source,choose}:{label:string;source?:string;choose:()=>void}){
  return <button type="button" className={styles.barPlaceChoice} title={label} aria-label={`${label}${source?` · ${source}`:''}`} onClick={choose}><span>{label}</span>{source&&<small>{source}</small>}<span className={styles.barPlaceFullLabel} data-full-label={label} aria-hidden="true"/></button>;
}

/** Details stay transient; only the user's minimal prospective reference or an
 * already published Canonical identity is admitted. No Canonical promotion. */
export function BarPlaceSearch({places,onKnown,onText,onGoogle,initialSearch,onSearchChange,personalPlacesCapability=false,rawTargetRef,onPersonalSuggestions,commitOnVerified=false,onManual,decisionKey}: {decisionKey?:string;onManual?:()=>void;onPersonalSuggestions?:(places:readonly PersonalGooglePlace[])=>void;commitOnVerified?:boolean;rawTargetRef?:string;personalPlacesCapability?:boolean;places:readonly PlannedPlaceOption[];onKnown:(placeId:string)=>void;onText?:(label:string)=>void;onGoogle?:(label:string,ref:BarGoogleRef)=>void;initialSearch?:BarPlaceSearchState;onSearchChange?:(state:BarPlaceSearchState)=>void}) {
  const placesFetch=useBarPlaceTransport();
  // A new city is part of the one field. Never silently bias a new query to
  // the already selected venue's old city.
  const [query,setQuery]=useState(initialSearch?.query??""),city="",[googleOn,setGoogleOn]=useState(initialSearch?.googleOn!==false),[results,setResults]=useState<RestaurantSuggestion[]>([]);
  const [personalPlacesEnabled,setPersonalPlacesEnabled]=useState(initialSearch?.personalPlacesEnabled===true);
  const registry=useInlineEditRegistry();
  const changeQuestion=(run:()=>void)=>{if(!registry||registry.guard(run,rawTargetRef?new Set([rawTargetRef]):undefined,false))run();};
  const reusableDetail=initialSearch?.detail?.provider==="google_places"&&validGooglePlaceId(initialSearch.detail.placeId)
    &&Array.isArray(initialSearch.detail.types)&&projectPlaceTypeCompatible(initialSearch.detail.types,"BAR_APERO")
    && typeof initialSearch.detailReadAt==="number"&&initialSearch.detailReadAt<=Date.now()&&Date.now()-initialSearch.detailReadAt<300_000;
  const [detail,setDetail]=useState<SelectedRestaurantPlace|null>(()=>reusableDetail?initialSearch!.detail!:null),[status,setStatus]=useState("");
  const [detailReadAt,setDetailReadAt]=useState<number|undefined>(()=>reusableDetail?initialSearch?.detailReadAt:undefined);
  const resumeDetail=useRef(reusableDetail?{query,city}:null);
  const [personalSuggestions,setPersonalSuggestions]=useState<readonly PersonalGooglePlace[]>([]);
  const [focused,setFocused]=useState(false),[dismissed,setDismissed]=useState(false);
  const searchField=useRef<HTMLDivElement>(null),suggestionPanel=useRef<HTMLDivElement>(null),suggestionId=useId();
  const [position,setPosition]=useState<{left:number;top:number;width:number;maxHeight:number}|null>(null);
  const matchingKnown=query.trim()?places.filter(place=>!place.privatePlace&&`${place.name} ${place.commune??""} ${place.address??""}`.toLocaleLowerCase("fr").includes(query.trim().toLocaleLowerCase("fr"))):[];
  const matchingPersonal=personalSuggestions.filter(place=>!query.trim()||`${place.userLabel} ${place.googlePlaceId}`.toLocaleLowerCase("fr").includes(query.trim().toLocaleLowerCase("fr")));
  // One bounded result surface. Preserve every candidate and its source;
  // only an already published exact Google identity can remove a duplicate.
  const choices=googleOn?[...matchingKnown.map(known=>({kind:"known" as const,known})),...matchingPersonal.filter(personal=>!matchingKnown.some(known=>known.googlePlaceId===personal.googlePlaceId)).map(personal=>({kind:"personal" as const,personal})),...results.filter(result=>!matchingKnown.some(known=>known.googlePlaceId===result.placeId)&&!matchingPersonal.some(personal=>personal.googlePlaceId===result.placeId)).map(google=>({kind:"google" as const,google}))]:[];
  const showSuggestions=!detail&&focused&&!dismissed&&(choices.length>0||!googleOn&&!!query.trim());
  useEffect(()=>{onSearchChange?.({query,city,resultPage:0,googleOn,...(detail?{detail,detailReadAt}:{}),...(personalPlacesEnabled?{personalPlacesEnabled:true}:{})});},[query,city,googleOn,detail,detailReadAt,onSearchChange,personalPlacesEnabled]);
  const receivePersonal=useCallback((places:readonly PersonalGooglePlace[])=>{setPersonalSuggestions(places);onPersonalSuggestions?.(places);},[onPersonalSuggestions]);
  useEffect(()=>{if(!showSuggestions)return;const update=()=>{const rect=searchField.current?.getBoundingClientRect();if(!rect)return;const below=window.innerHeight-rect.bottom-8,above=rect.top-8,flip=below<180&&above>below;
    const maxHeight=Math.max(80,Math.min(240,flip?above:below));setPosition({left:Math.max(8,Math.min(rect.left,window.innerWidth-Math.max(rect.width,280)-8)),top:flip?rect.top-maxHeight-5:rect.bottom+5,width:Math.min(Math.max(rect.width,280),window.innerWidth-16),maxHeight});};
    update();window.addEventListener('resize',update);document.addEventListener('scroll',update,true);return()=>{window.removeEventListener('resize',update);document.removeEventListener('scroll',update,true);};},[showSuggestions,query,choices.length]);
  const [attempt,setAttempt]=useState(0),[failed,setFailed]=useState(false),[detailRetry,setDetailRetry]=useState<RestaurantSuggestion|null>(null);
  const session=useRef(new RestaurantSearchSession()),abort=useRef<AbortController|null>(null),generation=useRef(0);
  const priorDecision=useRef(decisionKey);
  useEffect(()=>{
    if(priorDecision.current===decisionKey)return;
    priorDecision.current=decisionKey;generation.current++;abort.current?.abort();session.current.cancel();
    setStatus("La sortie a changé. Relancez votre recherche pour retenir un lieu.");setFailed(true);
  },[decisionKey]);
  useEffect(()=>{
    // Resume a briefly retained fiche, never a durable identity or route.
    if(resumeDetail.current?.query===query&&resumeDetail.current.city===city&&attempt===0)return;
    resumeDetail.current=null;
    const ticket=++generation.current;abort.current?.abort();setDetail(null);setResults([]);setStatus("");setFailed(false);setDetailRetry(null);
    if(!googleOn){session.current.complete();return;}
    session.current.schedule(query,city,(request,current)=>{
      const controller=new AbortController();abort.current=controller;setStatus("Recherche…");
      void placesFetch("/api/places/autocomplete",{method:"POST",cache:"no-store",signal:controller.signal,headers:{"Content-Type":"application/json"},body:JSON.stringify({input:request.input,sessionToken:request.sessionToken,context:{city:request.city,country:"FR",kind:"BAR_APERO"}})})
        .then(async response=>{if(!response.ok)throw Error(response.status===401?"Connectez-vous pour rechercher avec Google Maps.":response.status===403?"Accès à la recherche refusé. Vérifiez votre session ; votre sortie est conservée.":response.status===429?"Recherche temporairement limitée. Réessayez plus tard ou saisissez un lieu.":"Recherche indisponible. Les lieux enregistrés et la saisie libre restent disponibles.");try{return await response.json();}catch{throw Error("Recherche indisponible. Les lieux enregistrés et la saisie libre restent disponibles.");}})
        .then(raw=>{if(current()&&generation.current===ticket){if(!raw||!Array.isArray(raw.suggestions))throw Error("Réponse de recherche invalide. Réessayez ou utilisez un nom libre.");setPersonalPlacesEnabled(raw.capabilities?.personalSavedPlaces===true);const admitted=raw.suggestions.filter((item:RestaurantSuggestion)=>item&&item.source==="google_places"&&validGooglePlaceId(item.placeId)&&typeof item.primaryText==="string");setResults(admitted);setStatus(admitted.length?"Résultats Google Maps":"Aucun résultat Google pour cette recherche. Essayez une autre ville ou un nom libre.");}})
        .catch(error=>{if(current()&&generation.current===ticket&&!controller.signal.aborted){setStatus(error.message);setFailed(true);}});
    });
    return()=>{session.current.cancel();abort.current?.abort();};
  },[query,city,googleOn,attempt,placesFetch]);
  useEffect(()=>()=>{generation.current++;session.current.complete();abort.current?.abort();},[]);
  const select=async(suggestion:RestaurantSuggestion)=>{
    const ticket=++generation.current;session.current.cancel();abort.current?.abort();const controller=new AbortController();abort.current=controller;setDetail(null);setDetailRetry(null);setFailed(false);setStatus("Lecture du lieu…");
    try{
      const response=await placesFetch("/api/places/details",{method:"POST",cache:"no-store",signal:controller.signal,headers:{"Content-Type":"application/json"},body:JSON.stringify({placeId:suggestion.placeId,sessionToken:session.current.sessionToken(),context:{kind:"BAR_APERO"}})});
      if(!response.ok)throw Error("Ce lieu n’a pas pu être vérifié. Réessayez ou saisissez son nom librement.");
      let payload:{place:SelectedRestaurantPlace;capabilities?:{personalSavedPlaces?:boolean}};
      try{payload=await response.json();}catch{throw Error("Ce lieu n’a pas pu être vérifié. Réessayez ou saisissez son nom librement.");}
      const {place}=payload;
      if(!place||place.provider!=="google_places"||place.placeId!==suggestion.placeId||!validGooglePlaceId(place.placeId)||!Array.isArray(place.types)||!projectPlaceTypeCompatible(place.types,"BAR_APERO")||typeof place.displayName!=="string"||!place.displayName.trim())throw Error("Lieu non admissible. Réessayez ou saisissez un repère libre.");
      if(generation.current!==ticket||controller.signal.aborted)return;
      setPersonalPlacesEnabled(payload.capabilities?.personalSavedPlaces===true);setDetail(place);setDetailReadAt(Date.now());setStatus("");setResults([]);session.current.complete();
      if(commitOnVerified){
        const exact=places.filter(candidate=>!candidate.privatePlace&&candidate.googlePlaceId===place.placeId);
        if(exact.length===1)changeQuestion(()=>{if(generation.current===ticket&&!controller.signal.aborted)onKnown(exact[0].placeId);});
        else if(exact.length===0&&onGoogle&&place.displayName.trim().length<=120)
          changeQuestion(()=>{if(generation.current===ticket&&!controller.signal.aborted)onGoogle(place.displayName.trim(),{provider:"google_places",kind:"BAR_APERO",placeId:place.placeId});});
      }
    }catch(error){if(generation.current===ticket&&!controller.signal.aborted){setStatus(error instanceof Error?error.message:"Recherche indisponible");setDetailRetry(suggestion);}}
  };
  const known=detail?places.filter(place=>!place.privatePlace&&place.googlePlaceId===detail.placeId):[];
  const acceptFree=()=>{const label=query.trim();if(label&&onText)changeQuestion(()=>onText(label));else if(onManual)changeQuestion(onManual);};
  const firstSuggestion=()=>suggestionPanel.current?.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus();
  return <section data-bar-google-search aria-label="Choisir le lieu du bar" className={styles.barPlaceCompact}>
    {!detail&&<div className={styles.barPlaceSearchField} ref={searchField}>
      <label className={styles.visuallyHidden} htmlFor={suggestionId+"-input"}>Lieu de la sortie</label>
      <input id={suggestionId+"-input"} autoFocus maxLength={120} value={query} role="combobox" aria-autocomplete="list" aria-expanded={showSuggestions} aria-controls={suggestionId} aria-label={googleOn?"Rechercher un bar ou un lieu":"Nom libre du lieu"}
        placeholder={googleOn?"Rechercher un bar ou un lieu…":"Nom du lieu…"} onFocus={()=>{setFocused(true);setDismissed(false);}}
        onBlur={event=>{const next=event.relatedTarget as HTMLElement|null;if(next&&suggestionPanel.current?.contains(next))return;setFocused(false);}}
        onChange={event=>{setQuery(event.target.value);setDismissed(false);}}
        onKeyDown={event=>{if(event.key==="ArrowDown"&&showSuggestions){event.preventDefault();firstSuggestion();}else if(event.key==="Enter"&&!googleOn){event.preventDefault();acceptFree();}else if(event.key==="Escape"){setDismissed(true);setFocused(false);}}}/>
      <button type="button" data-bar-google-toggle aria-label={googleOn?"Désactiver Google Maps et saisir un nom libre":"Activer la recherche Google Maps"} title={googleOn?"Google Maps actif · passer au nom libre":"Nom libre · activer Google Maps"} aria-pressed={googleOn} onClick={()=>{setGoogleOn(value=>!value);setDetail(null);setDismissed(false);setFocused(true);searchField.current?.querySelector('input')?.focus();}}><MapPin aria-hidden="true" size={18}/></button>
    </div>}
    {showSuggestions&&position&&typeof document!=="undefined"&&createPortal(<div ref={suggestionPanel} id={suggestionId} role="region" aria-label="Suggestions de lieux" data-bar-place-suggestions className={styles.barPlaceSuggestions} style={position}
      onPointerDown={event=>event.preventDefault()} onBlur={event=>{const next=event.relatedTarget as HTMLElement|null;if(!next||!suggestionPanel.current?.contains(next)){setFocused(false);}}} onKeyDown={event=>{if(event.key==="Escape"){event.preventDefault();setDismissed(true);searchField.current?.querySelector('input')?.focus();}}}>
      {choices.map(choice=>choice.kind==="known"
        ?<BarPlaceChoice key={`known:${choice.known.placeId}`} label={`${choice.known.name}${choice.known.commune?" · "+choice.known.commune:""}`} source="Lieu enregistré" choose={()=>changeQuestion(()=>onKnown(choice.known.placeId))}/>
        :choice.kind==="personal"
        ?<BarPlaceChoice key={`personal:${choice.personal.googlePlaceId}`} label={choice.personal.userLabel} source="Mon lieu personnel" choose={()=>onGoogle&&changeQuestion(()=>onGoogle(choice.personal.userLabel,{provider:"google_places",kind:"BAR_APERO",placeId:choice.personal.googlePlaceId}))}/>
        :<BarPlaceChoice key={`google:${choice.google.placeId}`} label={`${choice.google.primaryText}${choice.google.secondaryText?" · "+choice.google.secondaryText:""}`} source="Google Maps" choose={()=>void select(choice.google)}/>)}
      {!googleOn&&!!query.trim()&&<BarPlaceChoice label={`Retenir « ${query.trim()} »`} source="Nom libre" choose={acceptFree}/>}
      {googleOn&&results.length>0&&<GoogleMapsAttribution/>}
    </div>,document.body)}
    {(personalPlacesCapability||personalPlacesEnabled)&&<BarPersonalPlaces detail={detail} query={query} onChoose={onGoogle} rawTargetRef={rawTargetRef} onSuggestions={receivePersonal} suggestionsOnly/>}
    {(failed||detailRetry)&&<div className={styles.barPlaceFeedback} data-bar-search-feedback><p role="alert">{status}</p>{failed&&<button type="button" onClick={()=>{session.current.complete();setAttempt(value=>value+1);}}>Réessayer</button>}{detailRetry&&<button type="button" onClick={()=>void select(detailRetry)}>Réessayer ce lieu</button>}</div>}
    {detail&&<div data-bar-place-detail className={styles.barPlaceDetail}><strong>{detail.displayName}</strong><small>{detail.formattedAddress}</small><button type="button" onClick={()=>changeQuestion(()=>{setDetail(null);session.current.complete();setAttempt(value=>value+1);})}>Changer de lieu</button>{known.length?known.map(place=><button type="button" key={place.placeId} onClick={()=>changeQuestion(()=>onKnown(place.placeId))}>{known.length===1?"Retenir ce lieu enregistré":`Retenir ${place.name} · ${place.commune??"commune à préciser"}`}</button>)
      :<>{onGoogle&&detail.displayName.trim().length<=120&&<button type="button" onClick={()=>changeQuestion(()=>onGoogle(detail.displayName.trim(),{provider:"google_places",kind:"BAR_APERO",placeId:detail.placeId}))}>Retenir ce bar</button>}{onText&&detail.displayName.trim().length<=120&&<button type="button" onClick={()=>changeQuestion(()=>onText(detail.displayName.trim()))}>Garder seulement le nom libre</button>}</>}</div>}
  </section>;
}
