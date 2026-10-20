"use client";
import {ComposerShell} from '@/app/mois-a-venir/composer/composer-shell';
import type {ComposerUiModel,ComposerRequest} from '@/domain/phase2/planner/composer-ui-contract';
import {useCallback,useState} from 'react';
import {presetForContext} from '@/domain/phase2/planner/composer-presets';
import {BarPlaceTransportContext} from '@/app/mois-a-venir/composer/bar-place-transport';
const endpoint='/api/recette/bar-favoris';
async function call(kind:string,payload:unknown){const r=await fetch(endpoint,{method:'POST',cache:'no-store',headers:{'Content-Type':'application/json'},body:JSON.stringify({kind,payload})});if(!r.ok)throw Error('BAR_RECEPTION_REQUEST_UNAVAILABLE');return r.json();}
const transport=(request:ComposerRequest)=>call('INTERACTION',request);
// Memory-only geometry reception. No real Google call or favourite writer.
// "lent" deliberately ignores abort to exercise the production generation guard.
const geometryPlaces:typeof fetch=async(input,init)=>{
  const path=String(input),body=JSON.parse(String(init?.body??'{}'));
  if(path!=='/api/places/autocomplete')return Response.json({code:'GEOMETRY_DETAILS_NOT_ADMITTED'},{status:503});
  const query=String(body.input??'').toLowerCase();
  if(query.includes('lent'))await new Promise(resolve=>setTimeout(resolve,1800));
  if(query.includes('erreur'))return Response.json({code:'SIMULATED_PROVIDER_UNAVAILABLE'},{status:503});
  return Response.json({capabilities:{personalSavedPlaces:false},suggestions:query.includes('vide')?[]:Array.from({length:3},(_,i)=>({source:'google_places',placeId:`geometry_fixture_${i}`,primaryText:`Bar fictif ${i+1} de la Promenade des Démonstrations`,secondaryText:'Ville fictive',photos:[{name:'ignored-unpublished-photo',width:10000}]}))});
};
const contextReceipt=(model:ComposerUiModel)=>model.semanticState.contexts.map(c=>({contextOccurrenceId:c.contextOccurrenceId,templateKey:c.templateKey,presetKey:presetForContext(c)?.presetKey??null}));
export function BarFavoritesReception({model,geometry=false,liveGoogle=false,traceDnd=false}:{model:ComposerUiModel;geometry?:boolean;liveGoogle?:boolean;traceDnd?:boolean}){
  const [contexts,setContexts]=useState(()=>contextReceipt(model));
  const tracedTransport=useCallback(async(request:ComposerRequest)=>{const reply=await transport(request);if(traceDnd&&reply.ok)setContexts(contextReceipt(reply.model));return reply;},[traceDnd]);
  // The live provider uses the ordinary authenticated routes. Composer remains
  // synthetic and memory-only; this never grants a favourite or Draft writer.
  const shell=<ComposerShell initialModel={model} transport={tracedTransport}/>;
  return <BarPlaceTransportContext.Provider value={geometry&&!liveGoogle?geometryPlaces:null}>{traceDnd?<div data-r63-contexts={JSON.stringify(contexts)} style={{height:'100%',display:'flex',flexDirection:'column',minHeight:0}}><div style={{flex:1,minHeight:0}}>{shell}</div></div>:shell}</BarPlaceTransportContext.Provider>;
}
