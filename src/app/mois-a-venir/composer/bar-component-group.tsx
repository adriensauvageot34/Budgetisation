"use client";
import {useState,type ReactNode,type DragEvent} from 'react';
import {UsersRound,UserRound} from 'lucide-react';
import type {ComponentSelectionV1} from '@/domain/phase2/planner/component-contract';
import type {ComposerUiModel} from '@/domain/phase2/planner/composer-ui-contract';
import {BarProductVisual} from './bar-product-visual';
import {AtomicPopover} from './atomic-popover';
import {BarPageControls} from './bar-pages';
import {money} from './display';
import styles from './composer.module.css';
import {useComposerInteractions} from './interactions';

type Group={key:string;items:readonly ComponentSelectionV1[]};
/** All membership is retained. Only server rollups of Compiler facts may be totals. */
function groupPresentation(group:Group,model:ComposerUiModel,owner:string,slot:string){
 const first=group.items[0],component=first.kind==='COMPONENT'?first:null;
 const projection=model.nightOutComponentGroups?.find(p=>p.contextOccurrenceId===owner&&p.slotKey===slot&&p.groupKey===group.key
   &&p.semanticStateDigest===model.board.draft.semanticStateDigest&&p.selectionIds.length===group.items.length&&group.items.every(i=>p.selectionIds.includes(i.selectionId)));
 const amount=projection?.knownAmount;
 const price=amount!=null?money(amount)+(projection?.incomplete?' + ?':''):group.items.length===1&&component?.cost.kind==='MANUAL'?`${money(component.cost.unitAmount)} / ${component.unitBasis==='SHARED'?'lot':'unité'}`:'?';
 const quantity=projection?.quantity??(group.items.length===1&&component?component.quantity:null);
 return {first,component,projection,price,quantity};
}
export function BarGroupFace({group,model,owner,slot,closed=false}:{group:Group;model:ComposerUiModel;owner:string;slot:string;closed?:boolean}){
 const {first,component,projection,price,quantity}=groupPresentation(group,model,owner,slot);
 const badges=<span className={styles.barCompactBadges}><span aria-label={quantity?`Quantité ${quantity}${component?.unitBasis==='SHARED'?' lots partagés':''}`:`${group.items.length} lignes conservées`}>{quantity?`×${quantity}`:`${group.items.length} lignes`}</span>
   <span data-price-unknown={price==='?'} aria-label={price==='?'?'Prix à préciser':projection?.incomplete?`Montant connu partiel ${price}`:price}>{price}</span></span>;
 if(closed){
   const title=component?.productAssetRef?.assetKey.split(':').at(-1)==='shared'?'Bouteille':component?.label??'Moment lié';
   return <span className={styles.barClosedFace} data-bar-group-face data-closed-face>
     <span className={styles.barClosedTileHeading}><strong title={component?.label??title}>{title}</strong>{badges}</span>
     <span className={styles.barClosedTileVisual}><BarProductVisual closed assetKey={component?.productAssetRef?.assetKey} label={component?.label}/>
       {component?.unitBasis==='SHARED'&&<span className={styles.barClosedUnit} role="img" aria-label="Consommation commune (lot)" title="Consommation commune (lot)"><UsersRound size={16} aria-hidden="true"/></span>}
       {component?.unitBasis==='PERSON'&&<span className={styles.barClosedUnit} role="img" aria-label="Par personne tarifée" title="Par personne tarifée"><UserRound size={16} aria-hidden="true"/></span>}
       {first.provenance==='PERSONAL_SUGGESTION'&&<small className={styles.barClosedSuggestion}>Suggestion non retenue</small>}
     </span>
   </span>;
 }
 return <span className={styles.barCompactFace} data-bar-group-face><strong title={component?.label}>{component?.label??'Moment lié'}</strong>
   <BarProductVisual assetKey={component?.productAssetRef?.assetKey} label={component?.label}/>{badges}
   {component?.unitBasis&&component.unitBasis!=='ITEM'&&<small>{component.unitBasis==='SHARED'?'Lot partagé':'Par personne tarifée'}</small>}
   {first.provenance==='PERSONAL_SUGGESTION'&&<small>Suggestion non retenue</small>}
 </span>;
}
export function BarComponentGroup({group,model,owner,slot,closed=false,disabled=false,choose,children}:{group:Group;model:ComposerUiModel;owner:string;slot:string;closed?:boolean;disabled?:boolean;choose:(item:ComponentSelectionV1)=>void;children?:ReactNode}){
 const [expanded,setExpanded]=useState(false),[page,setPage]=useState(0);
 const interaction=useComposerInteractions();
 const dragProps=(item:ComponentSelectionV1)=>{const source=`satellite:${owner}:${slot}:${item.selectionId}`,allowed=!disabled&&!!model.presentation.dragSources[source];return {draggable:allowed,'data-drag-source':allowed?source:undefined,onDragStart:(event:DragEvent<HTMLButtonElement>)=>{event.stopPropagation();if(allowed)interaction?.start(source,event);},onDragEnd:()=>interaction?.end()};};
 const index=Math.min(page,Math.max(0,Math.ceil(group.items.length/4)-1));
 const view=groupPresentation(group,model,owner,slot);
 const details=(close?:()=>void)=><section className={styles.barGroupLines} aria-label="Lignes distinctes du groupe"><p>{group.items.length} postes distincts · modifier séparément</p>{group.items.slice(index*4,(index+1)*4).map((item,i)=><button {...dragProps(item)} data-bar-group-line={item.selectionId} key={item.selectionId} type="button" disabled={disabled} onClick={()=>{close?.();choose(item);}}>{item.kind==='COMPONENT'?item.label:'Moment lié'} n°{index*4+i+1}<small>{item.kind==='COMPONENT'&&item.cost.kind==='MANUAL'?`${money(item.cost.unitAmount)} / ${item.unitBasis==='SHARED'?'lot':'unité'}`:'Prix à préciser'}</small></button>)}<BarPageControls index={index} count={Math.ceil(group.items.length/4)} onChange={setPage} label="Lignes du groupe"/></section>;
 const groupedClosed=closed&&group.items.length>1&&!disabled;
 return <div className={styles.barGroup} data-bar-group data-bar-group-lines={group.items.length}>
   {groupedClosed?<AtomicPopover label={`${view.component?.label??'Consommations'} · ${group.items.length} postes distincts · ${view.price}`} state="group" focus={()=>{}} icon={<BarGroupFace closed group={group} model={model} owner={owner} slot={slot}/>}>{close=>details(close)}</AtomicPopover>:
     <button type="button" {...(group.items.length===1?dragProps(group.items[0]):{})} disabled={disabled} aria-expanded={group.items.length>1?expanded:!!children} onClick={()=>group.items.length===1?choose(group.items[0]):setExpanded(v=>!v)}><BarGroupFace closed={closed} group={group} model={model} owner={owner} slot={slot}/></button>}

   {expanded&&group.items.length>1&&details()}

   {children}
 </div>;
}
