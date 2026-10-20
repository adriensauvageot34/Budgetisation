"use client";
import {useRef,type ReactNode} from 'react';
import type {ComposerUiModel} from '@/domain/phase2/planner/composer-ui-contract';
import {useComposerInteractions,publishedDrop,leftSurface} from './interactions';
import styles from './composer.module.css';
/** Presentation only. Targets exist only for published sockets, never guessed owners. */
export function BarMomentRail({label,children,add,addLabel,disabled=false,model,owner,slot,showAdd=true}:{label:string;children?:ReactNode;add:()=>void;addLabel:string;disabled?:boolean;model?:ComposerUiModel;owner?:string;slot?:string;showAdd?:boolean}){
 const ref=useRef<HTMLDivElement>(null),interaction=useComposerInteractions();
 const target=owner&&slot?{kind:'CONTEXT_SOCKET' as const,contextOccurrenceId:owner,slotKey:slot}:null;
 const compatible=!!(!disabled&&target&&model&&interaction?.grabbed&&publishedDrop(model,interaction.grabbed.assetKey,target));
 const scroll=(delta:number)=>ref.current?.scrollBy({left:delta,behavior:'smooth'});
 return <div className={styles.barMomentRailWrap}><div className={styles.barMomentRail} ref={ref} tabIndex={0} role="group" aria-label={label} data-bar-moment-rail
   onKeyDown={e=>{if(e.target!==e.currentTarget)return;if(e.key==='ArrowRight'||e.key==='ArrowLeft'){e.preventDefault();scroll(e.key==='ArrowRight'?200:-200);}}}>
   {children}{showAdd&&<button type="button" className={styles.barProgressiveSlot} disabled={disabled} aria-label={addLabel} data-bar-moment-slot data-drop-compatible={compatible}
    onClick={add} onDragOver={e=>{e.stopPropagation();if(compatible&&target){e.preventDefault();interaction?.over(target);}}}
    onDragLeave={e=>{e.stopPropagation();if(leftSurface(e))interaction?.over(null);}}
    onDrop={e=>{e.preventDefault();e.stopPropagation();if(compatible&&target)interaction?.place(target);else interaction?.reject();}}>
    <span aria-hidden="true">+</span><small>{children?'':"Ajouter un objet"}</small></button>}
 </div><div className={styles.barMomentRailArrows}><button type="button" aria-label={`${label} · précédent`} onClick={()=>scroll(-300)}>←</button><button type="button" aria-label={`${label} · suivant`} onClick={()=>scroll(300)}>→</button></div></div>;
}
