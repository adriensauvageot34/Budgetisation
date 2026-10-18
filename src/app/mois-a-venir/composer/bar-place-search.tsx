"use client";
import {useEffect,useRef,useState} from "react";
import {RestaurantSearchSession,validGooglePlaceId,type RestaurantSuggestion,type SelectedRestaurantPlace} from "@/domain/phase2/restaurant-places";
import type {PlannedPlaceOption} from "@/domain/phase2/planned-places";
import {GoogleMapsAttribution} from "../restaurant-place-search";
import {BarPageControls} from "./bar-pages";
import styles from "./composer.module.css";
export type BarPlaceSearchState={query:string;city:string;resultPage:number};

/** Provider data stays transient. Only an already published canonical identity
 * can be admitted; Composer has no Google-place promotion writer. */
export function BarPlaceSearch({places,onKnown,onText,initialCity,initialSearch,onSearchChange}: {places:readonly PlannedPlaceOption[];onKnown:(placeId:string)=>void;onText?:(label:string)=>void;initialCity?:string;initialSearch?:BarPlaceSearchState;onSearchChange?:(state:BarPlaceSearchState)=>void}) {
  const [query,setQuery]=useState(initialSearch?.query??""),[city,setCity]=useState(initialSearch?.city??initialCity??""),[editCity,setEditCity]=useState(!initialCity||!!initialSearch),[results,setResults]=useState<RestaurantSuggestion[]>([]);
  const [detail,setDetail]=useState<SelectedRestaurantPlace|null>(null),[status,setStatus]=useState("");
  const [resultPage,setResultPage]=useState(initialSearch?.resultPage??0);
  const previousSearch=useRef(`${query}\0${city}`);
  useEffect(()=>{onSearchChange?.({query,city,resultPage});},[query,city,resultPage,onSearchChange]);
  const [attempt,setAttempt]=useState(0),[failed,setFailed]=useState(false),[detailRetry,setDetailRetry]=useState<RestaurantSuggestion|null>(null);
  const session=useRef(new RestaurantSearchSession()),abort=useRef<AbortController|null>(null),generation=useRef(0);
  useEffect(()=>{
    const ticket=++generation.current;abort.current?.abort();setDetail(null);setResults([]);if(previousSearch.current!==`${query}\0${city}`)setResultPage(0);previousSearch.current=`${query}\0${city}`;setStatus("");setFailed(false);setDetailRetry(null);
    session.current.schedule(query,city,(request,current)=>{
      const controller=new AbortController();abort.current=controller;setStatus("Recherche…");
      void fetch("/api/places/autocomplete",{method:"POST",cache:"no-store",signal:controller.signal,headers:{"Content-Type":"application/json"},body:JSON.stringify({input:request.input,sessionToken:request.sessionToken,context:{city:request.city,country:"FR",kind:"BAR_APERO"}})})
        .then(async response=>{if(!response.ok)throw Error(response.status===401?"Connectez-vous pour rechercher avec Google Maps.":response.status===403?"Accès à la recherche refusé. Vérifiez votre session ; votre sortie est conservée.":response.status===429?"Recherche temporairement limitée. Réessayez plus tard ou saisissez un lieu.":"Recherche indisponible. Les lieux enregistrés et la saisie libre restent disponibles.");try{return await response.json();}catch{throw Error("Recherche indisponible. Les lieux enregistrés et la saisie libre restent disponibles.");}})
        .then(raw=>{if(current()&&generation.current===ticket){if(!raw||!Array.isArray(raw.suggestions))throw Error("Réponse de recherche invalide. Réessayez ou utilisez un nom libre.");const admitted=raw.suggestions.filter((item:RestaurantSuggestion)=>item&&item.source==="google_places"&&validGooglePlaceId(item.placeId)&&typeof item.primaryText==="string");setResults(admitted);setResultPage(page=>Math.min(page,Math.max(0,Math.ceil(admitted.length/3)-1)));setStatus(admitted.length?"Résultats Google Maps":"Aucun résultat Google pour cette recherche. Essayez une autre ville ou un nom libre.");}})
        .catch(error=>{if(current()&&generation.current===ticket&&!controller.signal.aborted){setStatus(error.message);setFailed(true);}});
    });
    return()=>{session.current.cancel();abort.current?.abort();};
  },[query,city,attempt]);
  useEffect(()=>()=>{generation.current++;session.current.complete();abort.current?.abort();},[]);
  const select=async(suggestion:RestaurantSuggestion)=>{
    const ticket=++generation.current;session.current.cancel();abort.current?.abort();const controller=new AbortController();abort.current=controller;setDetail(null);setDetailRetry(null);setFailed(false);setStatus("Lecture du lieu…");
    try{
      const response=await fetch("/api/places/details",{method:"POST",cache:"no-store",signal:controller.signal,headers:{"Content-Type":"application/json"},body:JSON.stringify({placeId:suggestion.placeId,sessionToken:session.current.sessionToken(),context:{kind:"BAR_APERO"}})});
      if(!response.ok)throw Error("Ce lieu n’a pas pu être vérifié. Réessayez ou saisissez son nom librement.");
      let payload:{place:SelectedRestaurantPlace};
      try{payload=await response.json();}catch{throw Error("Ce lieu n’a pas pu être vérifié. Réessayez ou saisissez son nom librement.");}
      const {place}=payload;
      if(!place||place.provider!=="google_places"||place.placeId!==suggestion.placeId||!validGooglePlaceId(place.placeId)||typeof place.displayName!=="string"||!place.displayName.trim())throw Error("Lieu non admissible. Réessayez ou saisissez un repère libre.");
      if(generation.current!==ticket||controller.signal.aborted)return;
      setDetail(place);setStatus("");setResults([]);session.current.complete();
    }catch(error){if(generation.current===ticket&&!controller.signal.aborted){setStatus(error instanceof Error?error.message:"Recherche indisponible");setDetailRetry(suggestion);}}
  };
  const known=detail?places.filter(place=>!place.privatePlace&&place.googlePlaceId===detail.placeId):[];
  return <section data-bar-google-search aria-label="Chercher un bar avec Google Maps">
    {!detail&&<><label>Chercher un bar<input autoFocus maxLength={120} value={query} onChange={e=>setQuery(e.target.value)} placeholder="Nom du lieu…"/></label>
    {editCity?<label>Ville<input maxLength={100} value={city} onChange={e=>setCity(e.target.value)}/></label>
      :<div className={styles.barPlaceContext}>Autour de {city} <button type="button" onClick={()=>setEditCity(true)}>Modifier la ville</button></div>}
    <button type="button" onClick={()=>{setCity("");setEditCity(true);}}>Chercher ailleurs, sans ville imposée</button>
    {!city.trim()&&<small>Recherche en France · ajoutez une ville au nom pour préciser.</small>}</>}
    <GoogleMapsAttribution/>{status&&<p role="status">{status}</p>}
    {failed&&<button type="button" onClick={()=>{session.current.complete();setAttempt(value=>value+1);}}>Réessayer la recherche</button>}
    {detailRetry&&<button type="button" onClick={()=>void select(detailRetry)}>Réessayer ce lieu</button>}
    {results.slice(resultPage*3,(resultPage+1)*3).map(result=><button type="button" key={result.placeId} onClick={()=>void select(result)}>{result.primaryText} · {result.secondaryText}</button>)}
    <BarPageControls index={resultPage} count={Math.ceil(results.length/3)} onChange={setResultPage} label="Résultats Google"/>
    {detail&&<div data-bar-place-detail><strong>{detail.displayName}</strong><p>{detail.formattedAddress}</p><button type="button" onClick={()=>{setDetail(null);session.current.complete();setAttempt(value=>value+1);}}>Reprendre cette recherche</button>{known.length?known.map(place=><button type="button" key={place.placeId} onClick={()=>onKnown(place.placeId)}>{known.length===1?"Retenir ce lieu enregistré":`Retenir ${place.name} · ${place.commune??"commune à préciser"} · ${place.address??place.placeId.slice(-6)}`}</button>)
      :<><p role="status">Ce lieu n’est pas encore enregistré. Vous pouvez garder son nom ; l’itinéraire restera à préciser.</p>{onText&&detail.displayName.trim().length<=120&&<button type="button" onClick={()=>onText(detail.displayName.trim())}>Retenir comme nom libre</button>}</>}</div>}
  </section>;
}
