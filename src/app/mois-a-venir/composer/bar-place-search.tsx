"use client";
import {useEffect,useRef,useState} from "react";
import {RestaurantSearchSession,validGooglePlaceId,type RestaurantSuggestion,type SelectedRestaurantPlace} from "@/domain/phase2/restaurant-places";
import type {PlannedPlaceOption} from "@/domain/phase2/planned-places";
import {GoogleMapsAttribution} from "../restaurant-place-search";
import {BarPageControls} from "./bar-pages";
import styles from "./composer.module.css";
import {projectPlaceTypeCompatible} from "@/domain/phase2/restaurant-places";
import type {PersonalGooglePlace} from "@/domain/phase2/personal-google-place";
import type {BarGoogleRef} from "@/domain/phase2/planner/night-out-venue";
import {BarPersonalPlaces} from "./bar-personal-places";
import {useInlineEditRegistry} from "./inline-edit-registry";
import {useBarPlaceTransport} from "./bar-place-transport";
export type BarPlaceSearchState={query:string;city:string;resultPage:number;detail?:SelectedRestaurantPlace;detailReadAt?:number;personalPlacesEnabled?:boolean};
/** Fixed result footprint; full owner text is available to keyboard and pointer. */
export function BarPlaceChoice({label,choose}:{label:string;choose:()=>void}){
  return <button type="button" className={styles.barPlaceChoice} title={label} aria-label={label} onClick={choose}><span>{label}</span><span className={styles.barPlaceFullLabel} data-full-label={label} aria-hidden="true"/></button>;
}

/** Details stay transient; only the user's minimal prospective reference or an
 * already published Canonical identity is admitted. No Canonical promotion. */
export function BarPlaceSearch({places,onKnown,onText,onGoogle,initialCity,initialSearch,onSearchChange,personalPlacesCapability=false,rawTargetRef,onPersonalSuggestions,commitOnVerified=false,onManual,decisionKey}: {decisionKey?:string;onManual?:()=>void;onPersonalSuggestions?:(places:readonly PersonalGooglePlace[])=>void;commitOnVerified?:boolean;rawTargetRef?:string;personalPlacesCapability?:boolean;places:readonly PlannedPlaceOption[];onKnown:(placeId:string)=>void;onText?:(label:string)=>void;onGoogle?:(label:string,ref:BarGoogleRef)=>void;initialCity?:string;initialSearch?:BarPlaceSearchState;onSearchChange?:(state:BarPlaceSearchState)=>void}) {
  const placesFetch=useBarPlaceTransport();
  const [query,setQuery]=useState(initialSearch?.query??""),[city,setCity]=useState(initialSearch?.city??initialCity??""),[editCity,setEditCity]=useState(!initialCity||!!initialSearch&&initialSearch.city!==initialCity),[results,setResults]=useState<RestaurantSuggestion[]>([]);
  const [personalPlacesEnabled,setPersonalPlacesEnabled]=useState(initialSearch?.personalPlacesEnabled===true);
  const registry=useInlineEditRegistry();
  const changeQuestion=(run:()=>void)=>{if(!registry||registry.guard(run,rawTargetRef?new Set([rawTargetRef]):undefined,false))run();};
  const reusableDetail=initialSearch?.detail?.provider==="google_places"&&validGooglePlaceId(initialSearch.detail.placeId)
    &&Array.isArray(initialSearch.detail.types)&&projectPlaceTypeCompatible(initialSearch.detail.types,"BAR_APERO")
    && typeof initialSearch.detailReadAt==="number"&&initialSearch.detailReadAt<=Date.now()&&Date.now()-initialSearch.detailReadAt<300_000;
  const [detail,setDetail]=useState<SelectedRestaurantPlace|null>(()=>reusableDetail?initialSearch!.detail!:null),[status,setStatus]=useState("");
  const [detailReadAt,setDetailReadAt]=useState<number|undefined>(()=>reusableDetail?initialSearch?.detailReadAt:undefined);
  const resumeDetail=useRef(reusableDetail?{query,city}:null);
  const [resultPage,setResultPage]=useState(initialSearch?.resultPage??0);
  const matchingKnown=query.trim()?places.filter(place=>!place.privatePlace&&`${place.name} ${place.commune??""} ${place.address??""}`.toLocaleLowerCase("fr").includes(query.trim().toLocaleLowerCase("fr"))):[];
  // One bounded result surface. Preserve every candidate and its source;
  // only an already published exact Google identity can remove a duplicate.
  const choices=[...matchingKnown.map(known=>({known,google:null})),...results.filter(result=>!matchingKnown.some(known=>known.googlePlaceId===result.placeId)).map(google=>({known:null,google}))];
  const resultPageIndex=Math.min(resultPage,Math.max(0,Math.ceil(choices.length/3)-1));
  const previousSearch=useRef(`${query}\0${city}`);
  useEffect(()=>{onSearchChange?.({query,city,resultPage,...(detail?{detail,detailReadAt}:{}),...(personalPlacesEnabled?{personalPlacesEnabled:true}:{})});},[query,city,resultPage,detail,detailReadAt,onSearchChange,personalPlacesEnabled]);
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
    const ticket=++generation.current;abort.current?.abort();setDetail(null);setResults([]);if(previousSearch.current!==`${query}\0${city}`)setResultPage(0);previousSearch.current=`${query}\0${city}`;setStatus("");setFailed(false);setDetailRetry(null);
    session.current.schedule(query,city,(request,current)=>{
      const controller=new AbortController();abort.current=controller;setStatus("Recherche…");
      void placesFetch("/api/places/autocomplete",{method:"POST",cache:"no-store",signal:controller.signal,headers:{"Content-Type":"application/json"},body:JSON.stringify({input:request.input,sessionToken:request.sessionToken,context:{city:request.city,country:"FR",kind:"BAR_APERO"}})})
        .then(async response=>{if(!response.ok)throw Error(response.status===401?"Connectez-vous pour rechercher avec Google Maps.":response.status===403?"Accès à la recherche refusé. Vérifiez votre session ; votre sortie est conservée.":response.status===429?"Recherche temporairement limitée. Réessayez plus tard ou saisissez un lieu.":"Recherche indisponible. Les lieux enregistrés et la saisie libre restent disponibles.");try{return await response.json();}catch{throw Error("Recherche indisponible. Les lieux enregistrés et la saisie libre restent disponibles.");}})
        .then(raw=>{if(current()&&generation.current===ticket){if(!raw||!Array.isArray(raw.suggestions))throw Error("Réponse de recherche invalide. Réessayez ou utilisez un nom libre.");setPersonalPlacesEnabled(raw.capabilities?.personalSavedPlaces===true);const admitted=raw.suggestions.filter((item:RestaurantSuggestion)=>item&&item.source==="google_places"&&validGooglePlaceId(item.placeId)&&typeof item.primaryText==="string");setResults(admitted);setStatus(admitted.length?"Résultats Google Maps":"Aucun résultat Google pour cette recherche. Essayez une autre ville ou un nom libre.");}})
        .catch(error=>{if(current()&&generation.current===ticket&&!controller.signal.aborted){setStatus(error.message);setFailed(true);}});
    });
    return()=>{session.current.cancel();abort.current?.abort();};
  },[query,city,attempt,placesFetch]);
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
  return <section data-bar-google-search aria-label="Chercher un bar avec Google Maps">
    {!detail&&<><div className={styles.barPlaceFields}><label>Chercher un bar<input autoFocus maxLength={120} value={query} onChange={e=>setQuery(e.target.value)} placeholder="Nom du lieu…"/></label>
    {editCity?<label>Ville<input maxLength={100} value={city} onChange={e=>setCity(e.target.value)}/></label>
      :<div className={styles.barPlaceContext}>Autour de {city} <button type="button" onClick={()=>setEditCity(true)}>Modifier la ville</button></div>}</div>
    <button type="button" onClick={()=>{setCity("");setEditCity(true);}}>Chercher ailleurs, sans ville imposée</button>
    {!city.trim()&&<small>Recherche en France · ajoutez une ville au nom pour préciser.</small>}</>}
    {onManual&&<button type="button" onClick={()=>changeQuestion(onManual)}>Nom libre</button>}
    <div className={styles.barPlaceResults} data-bar-place-results>
    {!detail&&choices.slice(resultPageIndex*3,(resultPageIndex+1)*3).map(({known,google})=>known?<BarPlaceChoice key={`known:${known.placeId}`} label={`${known.name} · ${known.commune??"Lieu enregistré"}${known.address?" · "+known.address:""}`} choose={()=>changeQuestion(()=>onKnown(known.placeId))}/>:google?<BarPlaceChoice key={`google:${google.placeId}`} label={`${google.primaryText}${google.secondaryText?" · "+google.secondaryText:""}`} choose={()=>void select(google)}/>:null)}
    </div>
    {(personalPlacesCapability||personalPlacesEnabled)&&<BarPersonalPlaces detail={detail} query={query} onChoose={onGoogle} rawTargetRef={rawTargetRef} onSuggestions={onPersonalSuggestions}/>}
    <div className={styles.barPlaceFeedback} data-bar-search-feedback><GoogleMapsAttribution/>{status&&<p role="status">{status}</p>}
    {failed&&<button type="button" onClick={()=>{session.current.complete();setAttempt(value=>value+1);}}>Réessayer la recherche</button>}
    {detailRetry&&<button type="button" onClick={()=>void select(detailRetry)}>Réessayer ce lieu</button>}
    </div>
    <div className={styles.barSearchPages}>{!detail&&<BarPageControls index={resultPageIndex} count={Math.ceil(choices.length/3)} onChange={setResultPage} label="Résultats de la recherche"/>}</div>
    {detail&&<div data-bar-place-detail><strong>{detail.displayName}</strong><p>{detail.formattedAddress}</p><button type="button" onClick={()=>changeQuestion(()=>{setDetail(null);session.current.complete();setAttempt(value=>value+1);})}>Reprendre cette recherche</button>{known.length?known.map(place=><button type="button" key={place.placeId} onClick={()=>onKnown(place.placeId)}>{known.length===1?"Retenir ce lieu enregistré":`Retenir ${place.name} · ${place.commune??"commune à préciser"} · ${place.address??place.placeId.slice(-6)}`}</button>)
      :<><p role="status">Ce bar peut être retenu sans créer de lieu enregistré. Son adresse sera relue pour le trajet.</p>{onGoogle&&detail.displayName.trim().length<=120&&<button type="button" onClick={()=>onGoogle(detail.displayName.trim(),{provider:"google_places",kind:"BAR_APERO",placeId:detail.placeId})}>Retenir ce bar pour ma sortie</button>}{onText&&detail.displayName.trim().length<=120&&<button type="button" onClick={()=>onText(detail.displayName.trim())}>{onGoogle?"Garder seulement le nom libre":"Retenir comme nom libre"}</button>}</>}</div>}
  </section>;
}
