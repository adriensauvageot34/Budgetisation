"use client";
import {useEffect,useRef,useId,type ReactNode,type HTMLAttributes} from "react";
import { CircleDashed, Info, Plus, CalendarDays, Users } from "lucide-react";
import type { ComposerContextCardView } from "@/domain/phase2/planner/composer-contract";
import type { ComposerUiModel } from "@/domain/phase2/planner/composer-ui-contract";




import { money } from "./display";
import {useBarClosedDrag,isBarDragSurface} from './bar-closed-drag';
import type { BarTarget } from "./bar-living-operations";
import styles from "./composer.module.css";
import {barBefore} from "./bar-before";
import {componentPresentationGroups} from '@/domain/phase2/planner/component-group-presentation';
import {BarComponentGroup} from './bar-component-group';
import {BarRouteLine,barPlaceLabel,barModeLabel,barPeopleLabel,barDateLabel,barPersonLabel} from "./bar-living-details";
import type {ProspectivePersonRef,ProspectivePlaceRef} from "@/domain/phase2/planned-contract";
import {nightOutConsumption} from "@/domain/phase2/planner/night-out-consumption";
export {barPlaceLabel,barModeLabel,barPeopleLabel};

export type LivingBar = {id?:string; removingId?:string; content?:ReactNode; open:(card:ComposerContextCardView,target:BarTarget)=>void; close:()=>void};

export function BarLivingCard({card,model,living,busy,preserved,preserve,remove,drag,surfaceProps}: {
  card:ComposerContextCardView; model:ComposerUiModel; living:LivingBar; busy:boolean; preserved:boolean;
  preserve:()=>void; remove?:()=>void; drag:()=>void;surfaceProps?:HTMLAttributes<HTMLElement>;
}) {
  const expanded=living.id===card.contextOccurrenceId,infoId=useId();
  const root=useRef<HTMLElement>(null),wasExpanded=useRef(false);
  useEffect(()=>{
    if(expanded||wasExpanded.current){const frame=requestAnimationFrame(()=>{
      const active=document.activeElement;
      // Repacking can remount the card while the user is still in its dock.
      // Keep that live focus, including buttons and the options group.
      if(expanded&&active instanceof HTMLElement&&active!==document.body
        &&(root.current?.contains(active)||active.closest('[data-bar-dock]')))return;
      const scene=root.current?.querySelector<HTMLElement>('[data-bar-living-editor]')?.dataset.barStep;
      const sceneFocus=expanded&&(scene==="place"||scene==="google")?root.current?.querySelector<HTMLElement>('[data-bar-google-search] input')
        :expanded&&scene==="date"?root.current?.querySelector<HTMLElement>('[data-bar-calendar] button[tabindex="0"]'):null;
      (sceneFocus??root.current?.querySelector<HTMLButtonElement>("h3 button"))?.focus({preventScroll:true});
    });wasExpanded.current=expanded;return()=>cancelAnimationFrame(frame);}
  },[expanded]);
  const summary=model.nightOutSummaries?.find(s=>s.contextOccurrenceId===card.contextOccurrenceId);
  const fresh=summary?.semanticStateDigest===model.board.draft.semanticStateDigest;

  const removing=living.removingId===card.contextOccurrenceId;
  const open=(target:BarTarget)=>living.open(card,target), locked=busy||preserved||card.readOnly||removing;
  const {suppressClick,...surfaceDrag}=useBarClosedDrag(`context-occurrence:${card.contextOccurrenceId}`,!expanded&&!locked);
  const semantic=model.semanticState.contexts.find(c=>c.contextOccurrenceId===card.contextOccurrenceId);
  const directSelectionId=semantic?nightOutConsumption(semantic)?.directSelectionId:null;
  const before=semantic&&barBefore(model.semanticState,semantic);
  const beforeGroups=before?componentPresentationGroups([before.bottle,...before.extras]):[];
  const components=card.sockets.flatMap(socket=>socket.currentItems.filter(item=>(item.kind==="COMPONENT"||item.kind==="CHILD_CONTEXT")&&item.selectionId!==directSelectionId).map(item=>({slot:socket.slotKey,item,amount:socket.evaluations?.find(e=>e.selectionId===item.selectionId)?.economicAmount})));
  // The summary may also be incomplete because context information is missing.
  // Do not claim missing prices unless the published line evaluations say so.
  const missingComponentPrice=components.some(c=>c.item.kind==='COMPONENT'&&c.amount==null)||model.nightOutComponentGroups?.some(group=>group.contextOccurrenceId===before?.child.contextOccurrenceId&&group.semanticStateDigest===model.board.draft.semanticStateDigest&&group.incomplete);
  const incompleteExplanation=summary?.knownAmount!=null?`${money(summary.knownAmount)} connus, ${missingComponentPrice?'certains prix restent à préciser':'certains coûts restent à chiffrer'}`:'';
  const route=(slot:"outbound"|"return")=>card.sockets.find(s=>s.slotKey===slot)?.currentItems.find(s=>s.kind==="MOBILITY_INTENT");
  const place=card.fields.placeRef as ProspectivePlaceRef|undefined;
  const date=barDateLabel(card.fields.plannedDate);
  const people=Array.isArray(card.fields.participantRefs)?card.fields.participantRefs as ProspectivePersonRef[]:[];
  const placeLabel=place?barPlaceLabel(place,model):null;
  // Presentation groups retain their owner and slot. Before remains a child.
  const moments=[
    ...(before?[{key:'$before',label:'Before',owner:before.child.contextOccurrenceId,slot:'$before',groups:beforeGroups,
      target:(selectionId:string):BarTarget=>selectionId===before.bottle.selectionId?`component:before-main:${selectionId}`:`component:before-extras:${selectionId}`}]:[]),
    ...(["extras","food","main","before"] as const).flatMap(slot=>{
      const items=components.filter(c=>c.slot===slot&&(slot!=="before"||!before));if(!items.length)return [];
      const label=slot==="extras"?"Au bar":slot==="food"?"Repas":slot==="before"?"Avant de sortir":items.some(c=>c.item.kind==="COMPONENT"&&c.item.label==="Consommations regroupées")?"Consommations regroupées":"Entrées / contribution";
      return [{key:slot,label,owner:card.contextOccurrenceId,slot,groups:componentPresentationGroups(items.map(c=>c.item)),target:(selectionId:string):BarTarget=>`component:${slot}:${selectionId}`}];
    })
  ];
  const visibleGroups=new Set(components.map(component=>component.slot));
  const parallelContent=visibleGroups.size>1||!!route("outbound")&&!!route("return")||visibleGroups.size>0&&(!!route("outbound")||!!route("return"));
  // Presentation only: decoration yields to actual selected contents, never to a price.
  const richness=before||components.length>2||route("outbound")||route("return")?"rich":components.length||card.fields.placeRef||card.fields.plannedDate||(Array.isArray(card.fields.participantRefs)&&card.fields.participantRefs.length)?"partial":"empty";
  return <article {...surfaceProps} {...(!expanded?surfaceDrag:{})} ref={root} tabIndex={expanded?undefined:0} className={styles.barLivingCard} data-bar-living-card data-context={card.contextOccurrenceId} data-template-key="night-out" data-expanded={expanded}
    title={expanded?undefined:'Maintenir le fond puis déplacer · Entrée pour ouvrir · Espace pour sélectionner · Suppr pour retirer · Undo pour rétablir'}
    aria-keyshortcuts={expanded?undefined:'Enter Space Delete'} onClick={event=>{if(!expanded&&isBarDragSurface(event.target,event.currentTarget)&&!suppressClick()&&!busy&&!card.readOnly&&!removing)open('summary');}}
    data-preset-key="bar-apero" data-richness={richness} data-bar-surface-rich={parallelContent} data-bar-surface-items={components.length>0} data-state={card.knowledge} data-removing={removing} aria-busy={removing} aria-label={card.label} onKeyDown={event=>{
      if(!expanded&&event.target===event.currentTarget){
        if(event.key==='Delete'&&remove&&!locked){event.preventDefault();event.stopPropagation();remove();}
        else if(event.key===' '&&!locked){event.preventDefault();event.stopPropagation();drag();}
        else if(event.key==='Enter'&&!busy&&!card.readOnly&&!removing){event.preventDefault();open('summary');}
      }
      if(event.key==="Escape"&&expanded&&!document.querySelector("dialog[open],[popover]:popover-open")){event.preventDefault();event.stopPropagation();living.close();}
    }}>
    <header className={styles.barLivingHeader}>
      <div className={styles.barLivingIdentity}><h3><button type="button" disabled={busy||card.readOnly||removing} aria-label={`Ouvrir ${card.label}`} onClick={()=>open("summary")}>{expanded||place?"Bar":card.label}</button>
        {expanded&&!place&&<button type="button" className={styles.barMissingPlace} disabled={locked} aria-label="Modifier le lieu" onClick={()=>open('place')}><Plus size={14}/></button>}
        {place&&<><span aria-hidden="true"> · </span><button type="button" data-bar-closed-place className={styles.barClosedPlace} disabled={locked} title={placeLabel??undefined} aria-label={`Modifier le lieu · ${placeLabel}`} onClick={()=>open('place')}><span>{placeLabel}</span></button></>}
      </h3>
        <div className={styles.barLivingAmount} data-cost-unknown={summary?.knownAmount==null}>{expanded?<div data-bar-open-amount><strong data-bar-amount-fallback aria-label={summary?.knownAmount==null?"Montant à renseigner":undefined}>{summary?.knownAmount!=null?money(summary.knownAmount):"… €"}</strong></div>:<button type="button" data-bar-amount-trigger className={styles.barAmountTrigger} disabled={locked} aria-label={summary?.knownAmount==null?"Modifier l’estimation des consommations · Montant à renseigner":"Modifier l’estimation des consommations"} title="Choisir la portée à modifier · aucun total calculé n’est écrasé" onClick={()=>open("quick")}><strong>{summary?.knownAmount!=null?money(summary.knownAmount):"… €"}</strong></button>}
        {expanded ? summary?.knownAmount!=null&&<>{!fresh?<small>Estimation à actualiser</small>:summary.costIncomplete?<small aria-label={incompleteExplanation}>Montant partiel</small>:null}</>
          : !fresh&&summary ? <span className={styles.barClosedCostStatus} data-bar-cost-info tabIndex={0} aria-describedby={infoId}><Info size={13} aria-hidden="true"/>Estimation à actualiser<span id={infoId} role="tooltip" className={styles.barClosedCostTip}>La projection précédente doit être actualisée avant de servir de projection actuelle.</span></span>
          : summary?.knownAmount!=null&&summary.costIncomplete&&<span className={styles.barClosedCostStatus} data-bar-cost-info tabIndex={0} aria-label={incompleteExplanation} aria-describedby={infoId}><CircleDashed size={13} aria-hidden="true"/>Montant partiel<Info size={13} aria-hidden="true"/><span id={infoId} role="tooltip" className={styles.barClosedCostTip}>{incompleteExplanation}</span></span>}
        {(preserved||card.readOnly)&&<small>{card.readOnly?"Lecture seule":"Carte préservée"}</small>}</div></div>
      <div className={styles.barLivingTools}>
        {date&&<button type="button" className={styles.barClosedDate} data-bar-closed-date disabled={locked} aria-label={`Modifier la date · ${date}`} onClick={()=>open('date')}>{date}</button>}
        {expanded&&!date&&<button type="button" className={styles.barClosedDate} disabled={locked} aria-label="Modifier la date" onClick={()=>open('date')}><CalendarDays size={14}/><Plus size={10}/></button>}
        {expanded&&<div data-bar-route-host className={styles.barHeaderRoutes}/>}
      </div>
    </header>
    {removing&&<p role="status" data-bar-removal-pending>Retrait en cours… Votre brouillon reste conservé jusqu’à confirmation.</p>}
    {expanded ? living.content : <div className={styles.barLivingCompact}>
      {(!place||!date||!people.length)&&<nav className={styles.barClosedMissing} aria-label="Compléter la sortie">
        {!place&&<button type="button" disabled={locked} aria-label="Modifier le lieu" onClick={()=>open('place')}><Plus size={12}/>Lieu</button>}
        {!date&&<button type="button" disabled={locked} aria-label="Modifier la date" onClick={()=>open('date')}><Plus size={12}/>Date</button>}
        {!people.length&&<button type="button" disabled={locked} aria-label="Modifier les personnes · Personnes à préciser" onClick={()=>open('people')}><Plus size={12}/>Personnes</button>}
      </nav>}
      <div className={styles.barLivingRoutes}>{(["outbound","return"] as const).map(slot=>{const leg=route(slot);return leg?.kind==="MOBILITY_INTENT"?<BarRouteLine key={slot} slot={slot} contextId={card.contextOccurrenceId} leg={leg} model={model} disabled={locked} navigate={open} open={()=>open(slot)}/>:null;})}</div>
      {route("outbound")?.kind==="MOBILITY_INTENT"&&!route("return")&&!route("outbound")?.returnRequired&&<button type="button" className={styles.barInlineAdd} disabled={locked} onClick={()=>open("return")}>+ Retour</button>}
      {moments.length>0&&<div className={styles.barClosedMoments} data-bar-closed-rail tabIndex={0} role="region" aria-label="Moments de la sortie · faire défiler horizontalement" onKeyDown={event=>{
        if(event.target!==event.currentTarget||!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
        event.preventDefault();event.stopPropagation();const rail=event.currentTarget;
        rail.scrollTo({left:event.key==='Home'?0:event.key==='End'?rail.scrollWidth:rail.scrollLeft+(event.key==='ArrowRight'?140:-140),behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});
      }}>{moments.map(moment=><section key={moment.key} className={styles.barClosedMoment} aria-label={moment.label} data-bar-moment={moment.key}>
        <h4>{moment.label}</h4><div className={styles.barLivingTiles}>
          {(moments.length>1?moment.groups.slice(0,2):moment.groups).map(group=><BarComponentGroup closed key={group.key} group={group} model={model} owner={moment.owner} slot={moment.slot} disabled={locked} choose={item=>open(moment.target(item.selectionId))}/>)}
          {moments.length>1&&moment.groups.length>2&&<span className={styles.barMoreCount} data-bar-hidden-groups aria-label={`${moment.groups.length-2} autres groupes dans ${moment.label}`}>+{moment.groups.length-2}</span>}
        </div>
      </section>)}</div>}
      {richness==="empty"&&!locked&&<button type="button" className={styles.barInlineAdd} onClick={()=>open("summary")}>Composer cette sortie <span aria-hidden="true">↗</span></button>}
      {people.length>0&&<div className={styles.barClosedPeopleReserve}><button type="button" className={styles.barClosedPeople} data-bar-closed-people disabled={locked} aria-label={`Modifier les personnes · ${barPeopleLabel(people,model)}`} title={barPeopleLabel(people,model)} onClick={()=>open('people')}>
        {people.slice(0,3).map((person,index)=><span key={index} aria-hidden="true">{barPersonLabel(person,model).split(/\s+/).filter(Boolean).slice(0,2).map(word=>word[0]).join('')}</span>)}{people.length>3&&<span aria-hidden="true">+{people.length-3}</span>}
      </button></div>}
    </div>}
    {expanded&&<div className={styles.barClosedPeopleReserve} data-bar-open-footer><button type="button" className={styles.barClosedPeople} data-bar-closed-people disabled={locked} aria-label={`Modifier les personnes · ${barPeopleLabel(people,model)}`} title={barPeopleLabel(people,model)} onClick={()=>open('people')}>
      {!people.length&&<><Users size={14}/><Plus size={10}/></>}
      {people.slice(0,3).map((person,index)=><span key={index} aria-hidden="true">{barPersonLabel(person,model).split(/\s+/).filter(Boolean).slice(0,2).map(word=>word[0]).join('')}</span>)}{people.length>3&&<span aria-hidden="true">+{people.length-3}</span>}
    </button></div>}
  </article>;
}
