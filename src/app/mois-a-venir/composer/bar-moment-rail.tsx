"use client";
import {Children,useRef,useLayoutEffect,type ReactNode,type DragEvent} from 'react';
import type {ComposerUiModel,ComposerDragSource} from '@/domain/phase2/planner/composer-ui-contract';
import {useComposerInteractions,publishedDrop,leftSurface} from './interactions';
import styles from './composer.module.css';
/** Presentation only. Targets exist only for published sockets, never guessed owners. */
export function BarMomentRail({label,children,add,addLabel,disabled=false,dropBlocked=false,model,owner,slot,showAdd=true}:{label:string;children?:ReactNode;add:()=>void;addLabel:string;disabled?:boolean;dropBlocked?:boolean;model?:ComposerUiModel;owner?:string;slot?:string;showAdd?:boolean}){
 const ref=useRef<HTMLDivElement>(null),interaction=useComposerInteractions();
 const count=Children.count(children);
 useLayoutEffect(()=>{
   const node=ref.current;if(!node)return;
   const size=()=>{
     const gap=6,width=node.clientWidth-6,total=count*144+(showAdd?48:0)+Math.max(0,count+(showAdd?1:0)-1)*gap;
     const columns=Math.max(1,Math.floor((width-24)/150));
     node.style.setProperty('--bar-rail-tile',`${total<=width?144:Math.max(90,(width-24-columns*gap)/columns)}px`);
   };
   size();const observer=new ResizeObserver(size);observer.observe(node);return()=>observer.disconnect();
 },[count,showAdd]);
 const target=owner&&slot?{kind:'CONTEXT_SOCKET' as const,contextOccurrenceId:owner,slotKey:slot}:null;
 const allowed=(source:ComposerDragSource|null)=>!!(!disabled&&!dropBlocked&&target&&model&&source&&!source.protected&&publishedDrop(model,source.assetKey,target));
 const compatible=allowed(interaction?.grabbed??null);
 const eventCompatible=(e:DragEvent<HTMLButtonElement>)=>{
   // Native dragstart updates the owner's ref synchronously; React's public
   // snapshot may commit later. The drop still needs the same published source.
   const key=e.dataTransfer.getData('application/x-planner-asset');
   return compatible||!!(key&&allowed(model?.presentation.dragSources[key]??null));
 };
 const scroll=(delta:number)=>ref.current?.scrollBy({left:delta,behavior:typeof matchMedia==='function'&&matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});
 return <div className={styles.barMomentRailWrap}><div className={styles.barMomentRail} ref={ref} tabIndex={0} role="group" aria-label={label} data-bar-moment-rail
   onKeyDown={e=>{if(e.target!==e.currentTarget)return;if(e.key==='ArrowRight'||e.key==='ArrowLeft'){e.preventDefault();scroll(e.key==='ArrowRight'?200:-200);}}}>
   {children}{showAdd&&<button type="button" className={styles.barProgressiveSlot} disabled={disabled} aria-label={addLabel} data-bar-moment-slot data-drop-compatible={compatible}
    onClick={add} onDragOver={e=>{e.stopPropagation();if(eventCompatible(e)&&target){e.preventDefault();e.dataTransfer.dropEffect='move';interaction?.over(target);}}}
    onDragLeave={e=>{e.stopPropagation();if(leftSurface(e))interaction?.over(null);}}
    onDrop={e=>{e.preventDefault();e.stopPropagation();if(eventCompatible(e)&&target)interaction?.place(target);else interaction?.reject();}}>
    <span aria-hidden="true">+</span><small>{count?'':"Ajouter un objet"}</small></button>}
 </div></div>;
}
