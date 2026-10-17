"use client";
import {useEffect,useRef,useState} from "react";
import {RestaurantSearchSession,validGooglePlaceId,type RestaurantSuggestion,type SelectedRestaurantPlace} from "@/domain/phase2/restaurant-places";
import type {PlannedPlaceOption} from "@/domain/phase2/planned-places";
import {GoogleMapsAttribution} from "../restaurant-place-search";
import styles from "./composer.module.css";

/** Provider data stays transient. Only an already published canonical identity
 * can be admitted; Composer has no Google-place promotion writer. */
export function BarPlaceSearch({places,onKnown,initialCity}: {places:readonly PlannedPlaceOption[];onKnown:(placeId:string)=>void;initialCity?:string}) {
  const [query,setQuery]=useState(""),[city,setCity]=useState(initialCity??""),[editCity,setEditCity]=useState(!initialCity),[results,setResults]=useState<RestaurantSuggestion[]>([]);
  const [detail,setDetail]=useState<SelectedRestaurantPlace|null>(null),[status,setStatus]=useState("");
  const session=useRef(new RestaurantSearchSession()),abort=useRef<AbortController|null>(null),generation=useRef(0);
  useEffect(()=>{
    const ticket=++generation.current;abort.current?.abort();setDetail(null);setResults([]);setStatus("");
    if(!city.trim()){session.current.cancel();return;}
    session.current.schedule(query,city,(request,current)=>{
      const controller=new AbortController();abort.current=controller;setStatus("Recherche…");
      void fetch("/api/places/autocomplete",{method:"POST",cache:"no-store",signal:controller.signal,headers:{"Content-Type":"application/json"},body:JSON.stringify({input:request.input,sessionToken:request.sessionToken,context:{city:request.city,country:"FR",kind:"VENUE"}})})
        .then(async response=>{if(!response.ok)throw Error(response.status===429?"Recherche temporairement limitée. Réessayez plus tard ou saisissez un lieu.":"Recherche indisponible. Les lieux enregistrés et la saisie libre restent disponibles.");return response.json();})
        .then(raw=>{if(current()&&generation.current===ticket){setResults(Array.isArray(raw.suggestions)?raw.suggestions.filter((item:RestaurantSuggestion)=>item.source==="google_places"&&validGooglePlaceId(item.placeId)&&typeof item.primaryText==="string"):[]);setStatus("Recherche terminée");}})
        .catch(error=>{if(current()&&generation.current===ticket&&!controller.signal.aborted)setStatus(error.message);});
    });
    return()=>{session.current.cancel();abort.current?.abort();};
  },[query,city]);
  useEffect(()=>()=>{generation.current++;session.current.complete();abort.current?.abort();},[]);
  const select=async(suggestion:RestaurantSuggestion)=>{
    const ticket=++generation.current;session.current.cancel();abort.current?.abort();const controller=new AbortController();abort.current=controller;setStatus("Lecture du lieu…");
    try{
      const response=await fetch("/api/places/details",{method:"POST",cache:"no-store",signal:controller.signal,headers:{"Content-Type":"application/json"},body:JSON.stringify({placeId:suggestion.placeId,sessionToken:session.current.sessionToken(),context:{kind:"VENUE"}})});
      if(!response.ok)throw Error("Ce lieu n’a pas pu être vérifié. Réessayez ou saisissez son nom librement.");
      const {place}=await response.json() as {place:SelectedRestaurantPlace};
      if(!place||place.provider!=="google_places"||!validGooglePlaceId(place.placeId)||typeof place.displayName!=="string")throw Error("Lieu non admissible. Saisissez un repère libre.");
      if(generation.current!==ticket||controller.signal.aborted)return;
      setDetail(place);setStatus("");setResults([]);session.current.complete();
    }catch(error){if(generation.current===ticket&&!controller.signal.aborted)setStatus(error instanceof Error?error.message:"Recherche indisponible");}
  };
  const known=detail?places.filter(place=>place.googlePlaceId===detail.placeId):[];
  return <section data-bar-google-search aria-label="Chercher un bar avec Google Maps">
    <label>Chercher un bar<input autoFocus maxLength={120} value={query} onChange={e=>setQuery(e.target.value)} placeholder="Nom du lieu…"/></label>
    {editCity?<label>Ville<input maxLength={100} value={city} onChange={e=>setCity(e.target.value)}/></label>
      :<div className={styles.barPlaceContext}>Autour de {city} · lieu enregistré <button type="button" onClick={()=>setEditCity(true)}>Modifier la ville</button></div>}
    <GoogleMapsAttribution/>{status&&<p role="status">{status}</p>}
    {results.map(result=><button type="button" key={result.placeId} onClick={()=>void select(result)}>{result.primaryText} · {result.secondaryText}</button>)}
    {detail&&<div><strong>{detail.displayName}</strong><p>{detail.formattedAddress}</p>{known.length?known.map(place=><button type="button" key={place.placeId} onClick={()=>onKnown(place.placeId)}>{known.length===1?"Retenir ce lieu enregistré":`Retenir ${place.name} · ${place.commune??"commune à préciser"} · ${place.address??place.placeId.slice(-6)}`}</button>)
      :<p role="status">Ce résultat n’est pas encore un lieu enregistré dans Budgetisation. Sa promotion n’est pas disponible ici. Saisissez votre propre repère avec « Nom libre » ; ses coordonnées et son trajet resteront à préciser.</p>}</div>}
  </section>;
}
