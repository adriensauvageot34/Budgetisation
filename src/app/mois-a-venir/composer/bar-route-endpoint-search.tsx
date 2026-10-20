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
export function BarRouteEndpointSearch({identity,decisionKey,query,change,googleOn,toggle,choose,free,known,card,model,dockHost,disabled=false}:{
  identity:string;decisionKey:string;query:string;change:(value:string)=>void;googleOn:boolean;toggle:()=>void;
  choose:(label:string,placeId:string)=>void;free:()=>void;known:PaletteQuestion["choices"];
  card:ComposerContextCardView;model:ComposerUiModel;dockHost?:HTMLElement|null;disabled?:boolean;
}){
  const request=useBarPlaceTransport(),session=useRef(new RestaurantSearchSession()),generation=useRef(0),abort=useRef<AbortController|null>(null);
  const tokenScope=useRef("");
  const scope=useCommittedEvent(()=>JSON.stringify([identity,decisionKey,query,googleOn]));
  const [results,setResults]=useState<RestaurantSuggestion[]>([]),[status,setStatus]=useState(""),[attempt,setAttempt]=useState(0),[retry,setRetry]=useState<RestaurantSuggestion|null>(null);
  const [failed,setFailed]=useState(false),[loading,setLoading]=useState(false);
  useEffect(()=>{
    const ticket=++generation.current;abort.current?.abort();session.current.cancel();
    const nextScope=JSON.stringify([identity,decisionKey,googleOn,attempt]);if(tokenScope.current!==nextScope){session.current.complete();tokenScope.current=nextScope;}
    setResults([]);setRetry(null);setFailed(false);setStatus("");setLoading(false);
    if(!googleOn||disabled)return;
    session.current.schedule(query,"",(input,current)=>{
      const controller=new AbortController();abort.current=controller;setLoading(true);setStatus("Recherche…");
      void request("/api/places/autocomplete",{method:"POST",cache:"no-store",signal:controller.signal,headers:{"Content-Type":"application/json"},body:JSON.stringify({...input,context:{kind:"ROUTE_ENDPOINT",country:"FR"}})})
        .then(async response=>{if(!response.ok)throw Error("Recherche Google indisponible. Les lieux connus et le nom libre restent accessibles.");return response.json();})
        .then(raw=>{if(!current()||ticket!==generation.current||controller.signal.aborted)return;
          if(!Array.isArray(raw?.suggestions))throw Error("Réponse Google invalide.");
          const choices=raw.suggestions.filter((s:RestaurantSuggestion)=>s?.source==="google_places"&&validGooglePlaceId(s.placeId)&&typeof s.primaryText==="string");
          setResults(choices);setLoading(false);setStatus(choices.length?"":"Aucun résultat Google. Essayez un autre nom, un lieu enregistré ou le nom libre.");
        }).catch(error=>{if(current()&&ticket===generation.current&&!controller.signal.aborted){setLoading(false);setFailed(true);setStatus(error.message);}});
    });
    return()=>{generation.current++;abort.current?.abort();session.current.cancel();};
  },[identity,decisionKey,query,googleOn,attempt,disabled,request]);
  const select=async(suggestion:RestaurantSuggestion)=>{
    const expected=scope(),ticket=++generation.current;session.current.cancel();abort.current?.abort();const controller=new AbortController();abort.current=controller;setRetry(null);setLoading(true);setFailed(false);setStatus("Vérification de l’adresse…");
    try{
      const response=await request("/api/places/details",{method:"POST",cache:"no-store",signal:controller.signal,headers:{"Content-Type":"application/json"},body:JSON.stringify({placeId:suggestion.placeId,sessionToken:session.current.sessionToken(),context:{kind:"ROUTE_ENDPOINT",country:"FR"}})});
      if(!response.ok)throw Error("Adresse non vérifiée. Réessayez ou utilisez un nom libre.");
      const raw=await response.json(),place=raw?.place as SelectedRestaurantPlace|undefined;
      if(!place||place.provider!=="google_places"||place.placeId!==suggestion.placeId||place.countryCode!=="FR"||!place.formattedAddress?.trim()||place.lat==null||!Number.isFinite(place.lat)||place.lng==null||!Number.isFinite(place.lng))throw Error("Ce point n’est pas une adresse française vérifiée.");
      if(ticket!==generation.current||controller.signal.aborted||scope()!==expected)return;
      setLoading(false);setStatus("");session.current.complete();choose((place.displayName||place.formattedAddress).trim().slice(0,120),place.placeId);
    }catch(error){if(ticket===generation.current&&!controller.signal.aborted){setLoading(false);setStatus(error instanceof Error?error.message:"Adresse indisponible.");setRetry(suggestion);}}
  };
  const choices:PaletteQuestion["choices"]=[...(googleOn?results.map(s=>({key:`google-route:${s.placeId}`,iconKey:"activity",label:s.primaryText,hint:s.secondaryText??"Adresse à vérifier",showHint:true,choose:()=>void select(s)})):[]),...known,
    {key:"route-free",iconKey:"activity",label:googleOn?"Nom libre":"Retenir ce nom libre",hint:"Non vérifié · aucune identité Google",showHint:true,choose:googleOn?toggle:free}];
  return <section className={styles.barEndpointSearch} data-bar-route-search={identity} data-google-mode={googleOn?"ON":"OFF"} aria-label="Point du trajet">
    <button type="button" className={styles.barGoogleToggle} aria-label="Recherche Google Maps" aria-pressed={googleOn} disabled={disabled} onClick={toggle}><img src="/brands/google.svg" width={18} height={18} alt=""/> {googleOn?"ON":"OFF"}</button>
    {googleOn&&results.length>0&&<GoogleMapsAttribution showPolicyLink/>}
    {status&&<small role="status">{status}</small>}
    {failed&&<button type="button" disabled={disabled} onClick={()=>setAttempt(x=>x+1)}>Réessayer la recherche</button>}
    {retry&&<button type="button" disabled={disabled||loading} onClick={()=>void select(retry)}>Réessayer cette adresse</button>}
    {dockHost&&createPortal(<ContextPalette card={card} model={model} appearance="bar" busy={disabled} configure choose={()=>{}} close={()=>{}} question={{title:googleOn?"Choisir le point du trajet":"Nom libre du point de trajet",identity,choices,filterChoices:false,search:{label:"Rechercher une adresse ou un lieu",value:query,change}}}/>,dockHost)}
  </section>;
}
