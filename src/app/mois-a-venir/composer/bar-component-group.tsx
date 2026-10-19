"use client";
import {useState,type ReactNode,type DragEvent} from 'react';
import type {ComponentSelectionV1} from '@/domain/phase2/planner/component-contract';
import type {ComposerUiModel} from '@/domain/phase2/planner/composer-ui-contract';
import {BarProductVisual} from './bar-product-visual';
import {BarPageControls} from './bar-pages';
import {money} from './display';
import styles from './composer.module.css';
import {useComposerInteractions} from './interactions';

type Group={key:string;items:readonly ComponentSelectionV1[]};
/** All membership is retained. Only server rollups of Compiler facts may be totals. */
export function BarGroupFace({group,model,owner,slot}:{group:Group;model:ComposerUiModel;owner:string;slot:string}){
 const first=group.items[0],component=first.kind==='COMPONENT'?first:null;
 const projection=model.nightOutComponentGroups?.find(p=>p.contextOccurrenceId===owner&&p.slotKey===slot&&p.groupKey===group.key
   &&p.semanticStateDigest===model.board.draft.semanticStateDigest&&p.selectionIds.length===group.items.length&&group.items.every(i=>p.selectionIds.includes(i.selectionId)));
 const amount=projection?.knownAmount;
 const price=amount!=null?money(amount)+(projection?.incomplete?' + ?':''):group.items.length===1&&component?.cost.kind==='MANUAL'?`${money(component.cost.unitAmount)} / ${component.unitBasis==='SHARED'?'lot':'unité'}`:'?';
 const quantity=projection?.quantity??(group.items.length===1&&component?component.quantity:null);
 return <span className={styles.barCompactFace} data-bar-group-face><strong title={component?.label}>{component?.label??'Moment lié'}</strong>
   <BarProductVisual assetKey={component?.productAssetRef?.assetKey} label={component?.label}/>
   <span className={styles.barCompactBadges}><span aria-label={quantity?`Quantité ${quantity}${component?.unitBasis==='SHARED'?' lots partagés':''}`:`${group.items.length} lignes conservées`}>{quantity?`×${quantity}`:`${group.items.length} lignes`}</span>
   <span aria-label={price==='?'?'Prix à préciser':projection?.incomplete?`Montant connu partiel ${price}`:price}>{price}</span></span>
   {component?.unitBasis&&component.unitBasis!=='ITEM'&&<small>{component.unitBasis==='SHARED'?'Lot partagé':'Par personne tarifée'}</small>}
   {first.provenance==='PERSONAL_SUGGESTION'&&<small>Suggestion non retenue</small>}
 </span>;
}
export function BarComponentGroup({group,model,owner,slot,disabled=false,choose,children}:{group:Group;model:ComposerUiModel;owner:string;slot:string;disabled?:boolean;choose:(item:ComponentSelectionV1)=>void;children?:ReactNode}){
 const [expanded,setExpanded]=useState(false),[page,setPage]=useState(0);
 const interaction=useComposerInteractions();
 const dragProps=(item:ComponentSelectionV1)=>{const source=`satellite:${owner}:${slot}:${item.selectionId}`,allowed=!disabled&&!!model.presentation.dragSources[source];return {draggable:allowed,'data-drag-source':allowed?source:undefined,onDragStart:(event:DragEvent<HTMLButtonElement>)=>{event.stopPropagation();if(allowed)interaction?.start(source,event);},onDragEnd:()=>interaction?.end()};};
 const index=Math.min(page,Math.max(0,Math.ceil(group.items.length/4)-1));
 return <div className={styles.barGroup} data-bar-group data-bar-group-lines={group.items.length}>
   <button type="button" {...(group.items.length===1?dragProps(group.items[0]):{})} disabled={disabled} aria-expanded={group.items.length>1?expanded:!!children} onClick={()=>group.items.length===1?choose(group.items[0]):setExpanded(v=>!v)}><BarGroupFace group={group} model={model} owner={owner} slot={slot}/></button>
   {expanded&&group.items.length>1&&<section className={styles.barGroupLines} aria-label="Lignes distinctes du groupe"><p>{group.items.length} postes distincts · modifier séparément</p>{group.items.slice(index*4,(index+1)*4).map((item,i)=><button {...dragProps(item)} data-bar-group-line={item.selectionId} key={item.selectionId} type="button" disabled={disabled} onClick={()=>choose(item)}>{item.kind==='COMPONENT'?item.label:'Moment lié'} n°{index*4+i+1}<small>{item.kind==='COMPONENT'&&item.cost.kind==='MANUAL'?`${money(item.cost.unitAmount)} / unité`:'Prix à préciser'}</small></button>)}<BarPageControls index={index} count={Math.ceil(group.items.length/4)} onChange={setPage} label="Lignes du groupe"/></section>}
   {children}
 </div>;
}
