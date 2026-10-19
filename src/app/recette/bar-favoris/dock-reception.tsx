"use client";
import {useState} from 'react';
import type {ComposerUiModel} from '@/domain/phase2/planner/composer-ui-contract';
import {ContextPalette} from '@/app/mois-a-venir/composer/context-palette';
import styles from '@/app/mois-a-venir/composer/composer.module.css';

/** Protected reception host only. Exercises the real rail with synthetic choices;
 * no composer decision, financial calculation, Draft writer or provider request. */
export function BarDockReception({model,count}:{model:ComposerUiModel;count:25|120|150}){
  const [added,setAdded]=useState(0),[positions,setPositions]=useState<Record<string,number>>({});
  const card=model.board.contexts.find(c=>c.templateKey==='night-out')??model.board.contexts[0];
  if(!card)return <p>Fixture Bar indisponible.</p>;
  return <div className={styles.workspace} style={{minHeight:250,padding:20}}>
    <p role="note">Réception du composant dock :{count} choix fictifs. Aucune décision financière, aucune sauvegarde.</p>
    <p role="status">{added} choix de test</p>
    <ContextPalette appearance="bar" card={card} model={model} busy={false} configure choose={()=>{}} close={()=>{}}
      questionScroll={positions} onQuestionScrollChange={(key,value)=>setPositions(previous=>({...previous,[key]:value}))}
      question={{title:'Catalogue fictif '+count,nature:'OBJECTS',identity:'r5-catalogue-'+count,choices:Array.from({length:count},(_,i)=>({key:'fixture-product:'+i,label:'Cocktail de démonstration '+String(i+1).padStart(3,'0')+' — libellé long sans données réelles',iconKey:'night-out',choose:()=>setAdded(value=>value+1)}))}}/>
  </div>;
}
