"use client";
import {ComposerShell} from '@/app/mois-a-venir/composer/composer-shell';
import type {ComposerUiModel,ComposerRequest} from '@/domain/phase2/planner/composer-ui-contract';
const endpoint='/api/recette/bar-favoris';
async function call(kind:string,payload:unknown){const r=await fetch(endpoint,{method:'POST',cache:'no-store',headers:{'Content-Type':'application/json'},body:JSON.stringify({kind,payload})});if(!r.ok)throw Error('BAR_RECEPTION_REQUEST_UNAVAILABLE');return r.json();}
const transport=(request:ComposerRequest)=>call('INTERACTION',request);
export function BarFavoritesReception({model}:{model:ComposerUiModel}){
  return <ComposerShell initialModel={model} transport={transport}/>;
}
