"use client";
import {BarLivingCard} from '@/app/mois-a-venir/composer/bar-living-card';
import type {ComposerUiModel} from '@/domain/phase2/planner/composer-ui-contract';
/** Width-only synthetic visual harness. Never changes production Board packing. */
export function BarClosedWideReception({model,id}:{model:ComposerUiModel;id:string}){
  const card=model.board.contexts.find(c=>c.contextOccurrenceId===id);
  if(!card)return null;
  return <div data-r62-wide-reception style={{width:700,maxWidth:'100%',padding:20,boxSizing:'content-box'}}>
    <p>Fixture visuelle synthétique · carte de 700 px hors packer · cinq groupes explicites en mémoire. Navigation métier testée séparément dans le Board. Aucun writer ni Apply.</p>
    <BarLivingCard card={card} model={model} living={{open(){},close(){}}} busy={false} preserved={false} preserve={()=>{}} drag={()=>{}}/>
  </div>;
}
