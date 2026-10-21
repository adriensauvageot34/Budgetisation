"use client";
import {useEffect,useRef,useState} from "react";
import {createPortal} from "react-dom";
import {RestaurantSearchSession,validGooglePlaceId,type RestaurantSuggestion,type SelectedRestaurantPlace} from "@/domain/phase2/restaurant-places";
import type {ComposerUiModel} from "@/domain/phase2/planner/composer-ui-contract";
import type {ComposerContextCardView} from "@/domain/phase2/planner/composer-contract";
import {ContextPalette,type PaletteQuestion} from "./context-palette";
import {useBarPlaceTransport} from "./bar-place-transport";
import {GoogleMapsAttribution} from "../restaurant-place-search";
import {useCommittedEvent} from "./use-committed-event";
import styles from "./composer.module.css";

/** Transient discovery only. The admitted directed binding lives in the Draft. */
export function BarRouteEndpointSearch({identity,decisionKey,query,change,choose,known,card,model,dockHost,disabled=false}:{
  identity:string;decisionKey:string;query:string;change:(value:string)=>void;
  choose:(label:string,placeId:string)=>void;known:PaletteQuestion["choices"];
  card:ComposerContextCardView;model:ComposerUiModel;dockHost?:HTMLElement|null;disabled?:boolean;
}){
  const request=useBarPlaceTransport(),session=useRef(new RestaurantSearchSession()),generation=useRef(0),abort=useRef<AbortController|null>(null);
  const tokenScope=useRef("");
  const scope=useCommittedEvent(()=>JSON.stringify([identity,decisionKey,query]));
  const [results,setResults]=useState<RestaurantSuggestion[]>([]),[status,setStatus]=useState(""),[attempt,setAttempt]=useState(0),[retry,setRetry]=useState<RestaurantSuggestion|null>(null);
  const [failed,setFailed]=useState(false),[loading,setLoading]=useState(false);
  useEffect(()=>{
    const ticket=++generation.current;abort.current?.abort();session.current.cancel();
    const nextScope=JSON.stringify([identity,decisionKey,attempt]);if(tokenScope.current!==nextScope){session.current.complete();tokenScope.current=nextScope;}
    setResults([]);setRetry(null);setFailed(false);setStatus("");setLoading(false);
    if(disabled)return;
    session.current.schedule(query,"",(input,current)=>{
      const controller=new AbortController();abort.current=controller;setLoading(true);setStatus("Recherche…");
      void request("/api/places/autocomplete",{method:"POST",cache:"no-store",signal:controller.signal,headers:{"Content-Type":"application/json"},body:JSON.stringify({...input,context:{kind:"ROUTE_ENDPOINT",country:"FR"}})})
        .then(async response=>{if(!response.ok)throw Error("Recherche Google indisponible. Les adresses enregistrées restent accessibles.");return response.json();})
        .then(raw=>{if(!current()||ticket!==generation.current||controller.signal.aborted)return;
          if(!Array.isArray(raw?.suggestions))throw Error("Réponse Google invalide.");
          const choices=raw.suggestions.filter((s:RestaurantSuggestion)=>s?.source==="google_places"&&validGooglePlaceId(s.placeId)&&typeof s.primaryText==="string");
          setResults(choices);setLoading(false);setStatus(choices.length?"":"Aucun résultat Google. Essayez une autre recherche ou une adresse enregistrée.");
        }).catch(error=>{if(current()&&ticket===generation.current&&!controller.signal.aborted){setLoading(false);setFailed(true);setStatus(error.message);}});
    });
    return()=>{generation.current++;abort.current?.abort();session.current.cancel();};
  },[identity,decisionKey,query,attempt,disabled,request]);
  const select=async(suggestion:RestaurantSuggestion)=>{
    const expected=scope(),ticket=++generation.current;session.current.cancel();abort.current?.abort();const controller=new AbortController();abort.current=controller;setRetry(null);setLoading(true);setFailed(false);setStatus("Vérification de l’adresse…");
    try{
      const response=await request("/api/places/details",{method:"POST",cache:"no-store",signal:controller.signal,headers:{"Content-Type":"application/json"},body:JSON.stringify({placeId:suggestion.placeId,sessionToken:session.current.sessionToken(),context:{kind:"ROUTE_ENDPOINT",country:"FR"}})});
      if(!response.ok)throw Error("Adresse non vérifiée. Réessayez ou choisissez une adresse enregistrée.");
      const raw=await response.json(),place=raw?.place as SelectedRestaurantPlace|undefined;
      if(!place||place.provider!=="google_places"||place.placeId!==suggestion.placeId||place.countryCode!=="FR"||!place.formattedAddress?.trim()||place.lat==null||!Number.isFinite(place.lat)||place.lng==null||!Number.isFinite(place.lng))throw Error("Ce point n’est pas une adresse française vérifiée.");
      if(ticket!==generation.current||controller.signal.aborted||scope()!==expected)return;
      setLoading(false);setStatus("");session.current.complete();choose((place.displayName||place.formattedAddress).trim().slice(0,120),place.placeId);
    }catch(error){if(ticket===generation.current&&!controller.signal.aborted){setLoading(false);setStatus(error instanceof Error?error.message:"Adresse indisponible.");setRetry(suggestion);}}
  };
  const choices:PaletteQuestion["choices"]=[...results.filter(s=>!known.some(k=>k.key===`google-route:${s.placeId}`)).map(s=>({key:`google-route:${s.placeId}`,iconKey:"activity",label:s.primaryText,hint:s.secondaryText??"Adresse à vérifier",showHint:true,choose:()=>void select(s)})),...known];
  return <section className={styles.barEndpointSearch} data-bar-route-search={identity} aria-label="Point du trajet">
    {results.length>0&&<GoogleMapsAttribution showPolicyLink/>}
    {status&&<small role="status">{status}</small>}
    {failed&&<button type="button" disabled={disabled} onClick={()=>setAttempt(x=>x+1)}>Réessayer la recherche</button>}
    {retry&&<button type="button" disabled={disabled||loading} onClick={()=>void select(retry)}>Réessayer cette adresse</button>}
    {dockHost&&createPortal(<ContextPalette card={card} model={model} appearance="bar" busy={disabled} configure choose={()=>{}} close={()=>{}} question={{title:"Choisir le point du trajet",identity,choices,filterChoices:false,search:{label:"Rechercher une adresse ou un lieu",value:query,change}}}/>,dockHost)}
  </section>;
}
