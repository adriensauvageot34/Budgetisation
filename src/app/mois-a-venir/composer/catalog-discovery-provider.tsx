"use client";
import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import type { ComposerUiModel } from '@/domain/phase2/planner/composer-ui-contract';
import type { ComposerPresetKey } from '@/domain/phase2/planner/composer-presets';
import type { ComposerAssetView, DropTarget } from '@/domain/phase2/planner/composer-contract';
import type { ComponentSelectionV1 } from '@/domain/phase2/planner/component-contract';
import { clayCatalogArtwork, loadClayV22Collection, type ClayCatalogEntry } from '../clay-v22-catalog';
import { CATALOG_SCOPES, catalogRefLocked, catalogResults, discoveryActions, scopeForCard, selectedCatalogIdentities, type CatalogCommand, type DiscoveryTarget } from './catalog-discovery';
import { isPurchaseBasket, type BasketConcept } from '@/domain/phase2/planner/purchase-basket';
import { publishedDrop } from './interactions';
import styles from './catalog-discovery.module.css';

type Request=DiscoveryTarget&Readonly<{query?:string;entryId?:string;commands?:readonly CatalogCommand[];
 resolveCommands?:(entry:ClayCatalogEntry)=>readonly CatalogCommand[]}>;
const DiscoveryContext=createContext<((target:Request)=>void)|null>(null);
export function CatalogOpenButton({children='Tous les éléments',target={},className}:{children?:ReactNode;target?:Request;className?:string}){
 const open=useContext(DiscoveryContext);
 return open?<button type="button" className={className??styles.open} data-catalog-open onClick={()=>open(target)}>{children}</button>:null;
}
export function CatalogDiscoveryProvider({model,busy,children,openContext,choose,choosePreset,prepareBasketArticle,revealControl}:{model:ComposerUiModel;busy:boolean;children:ReactNode;
 openContext:(id:string,focus?:string,articleLabel?:string)=>void;revealControl:(id:string)=>void;choose:(asset:ComposerAssetView,target:DropTarget,selection?:ComponentSelectionV1,componentLabel?:string,concept?:BasketConcept)=>void;
 choosePreset:(asset:ComposerAssetView,key:ComposerPresetKey,concept?:BasketConcept)=>void;
 prepareBasketArticle?:(id:string,concept:BasketConcept)=>void}){
 const [request,setRequest]=useState<Request|null>(null),[entries,setEntries]=useState<readonly ClayCatalogEntry[]>([]),[error,setError]=useState('');
 const [query,setQuery]=useState(''),[scope,setScope]=useState('all'),[family,setFamily]=useState(''),[nature,setNature]=useState(''),[page,setPage]=useState(0),[selected,setSelected]=useState<string|null>(null);
 const dialog=useRef<HTMLDialogElement>(null), trigger=useRef<HTMLElement|null>(null), requestDigest=useRef('');
 const resultsRegion=useRef<HTMLDivElement>(null), detailHeading=useRef<HTMLHeadingElement>(null), resultTrigger=useRef<HTMLElement|null>(null);
 const returnToResults=useRef(false);
 const frozenSelections=useRef<ReadonlySet<string>>(new Set());
 const open=(target:Request)=>{if(!dialog.current?.open)trigger.current=document.activeElement instanceof HTMLElement?document.activeElement:null;requestDigest.current=model.board.draft.semanticStateDigest;
   returnToResults.current=false;resultTrigger.current=null;
   frozenSelections.current=selectedCatalogIdentities(model,target.contextId);
   setRequest(target);setScope(target.scope??scopeForCard(model,target.contextId));setQuery(target.query??'');setFamily('');setNature('');setPage(0);setSelected(target.entryId??null);};
 const close=()=>{dialog.current?.close();setRequest(null);trigger.current?.focus({preventScroll:true});};
 useEffect(()=>{if(!request)return;let current=true;if(!dialog.current?.open)dialog.current?.showModal();setError('');
   void loadClayV22Collection().then(c=>{if(current)setEntries(c.entries);}).catch(()=>{if(current)setError('Le catalogue n’a pas pu être chargé. Fermez puis réessayez.');});
   return()=>{current=false;};},[request]);
 const commandIds=useMemo(()=>new Set(request?.commands?.map(command=>command.visualConceptId)),[request]);
 const results=useMemo(()=>catalogResults(entries,{query,scope,family,nature,selectedIds:frozenSelections.current,
   moment:request?.moment,commandIds}),[entries,query,scope,family,nature,request?.moment,commandIds]);
 const chosen=entries.find(e=>e.visualConceptId===selected),context=model.board.contexts.find(c=>c.contextOccurrenceId===request?.contextId);
 const chosenId=chosen?.visualConceptId;
 useEffect(()=>{
   if(chosenId){detailHeading.current?.focus({preventScroll:true});return;}
   if(!returnToResults.current)return;
   returnToResults.current=false;
   if(resultTrigger.current?.isConnected)resultTrigger.current.focus({preventScroll:true});
   else resultsRegion.current?.focus({preventScroll:true});
 },[chosenId]);
 const basket=context&&isPurchaseBasket(context);
 const coursesAsset=!context&&scope==='courses'?model.library.searchableAssets.find(a=>a.assetKey==='template:purchase'):undefined;
 const canPrepareCourses=!!coursesAsset&&publishedDrop(model,coursesAsset.assetKey,{kind:'BOARD_ZONE'})?.semanticAction==='ADD_CONTEXT';
 const currentRequest=request&&(!request.contextId||!!context)&&requestDigest.current===model.board.draft.semanticStateDigest;
 const alreadyChosen=chosen&&context?.sockets.some(s=>s.currentItems.some(i=>i.kind==='COMPONENT'
   &&(i.basketArticle?.concept?.id===chosen.visualConceptId||i.productAssetRef&&chosen.assetKeys.includes(i.productAssetRef.assetKey))));
 const commands=chosen&&currentRequest&&context&&!context.readOnly&&!catalogRefLocked(model,context.contextOccurrenceId)
   ?[...(request?.resolveCommands?.(chosen)??[]),...(request?.commands??[])].filter(c=>c.visualConceptId===chosen.visualConceptId
     &&(!alreadyChosen||c.editsExisting||c.allowRepeat)):[];
 const actions=chosen&&request?discoveryActions(chosen,model,{...request,scope}).filter(action=>
   (action.kind!=='BASKET_ARTICLE'||prepareBasketArticle)&&(!commands.length||action.kind==='OPEN'&&action.focus)):[];
 const unavailable=request?.controlRef?'Le budget mensuel permet de consulter ou d’ajuster sa cible. Préparez un achat de courses pour choisir vos produits.'
   :context?.readOnly||context&&catalogRefLocked(model,context.contextOccurrenceId)?'Cette décision est protégée.'
     :basket?'Cet élément est consultable dans le catalogue. Choisissez un produit adapté à ce panier.'
     :context?.templateKey==='purchase'?'Cet achat contient une seule ligne article. Consultez la fiche de l’achat pour modifier cette ligne.'
       :context&&!context.sockets.length?'Les choix de cette carte seront disponibles après la prévisualisation.'
         :'Cet élément est disponible en consultation dans ce contexte.';
 const change=()=>{setPage(0);setSelected(null);};
 const execute=(fn:()=>void)=>{close();fn();};
 return <DiscoveryContext.Provider value={open}>{children}{request&&createPortal(<dialog ref={dialog} className={styles.dialog} aria-labelledby="clay-catalog-title" data-composer-catalog
   onCancel={e=>{e.preventDefault();close();}} onClick={e=>{if(e.target===e.currentTarget)close();}}>
   <div className={styles.panel}>
    <header><div><h2 id="clay-catalog-title">Tous les éléments</h2><p>{context?`Pour ${context.label}`:scope==='courses'?'Produits pour Courses · distincts du budget mensuel':'Concepts, intentions et repères visuels de Composer'}</p></div><button type="button" onClick={close} aria-label="Fermer le catalogue">Fermer</button></header>
    <div className={styles.filters}>
     <label className={styles.search}>Rechercher un élément<input autoFocus aria-label="Rechercher dans tous les éléments" placeholder="Pâtes alimentaires, mascara, billet…" value={query} onChange={e=>{setQuery(e.target.value);change();}}
      onKeyDown={e=>{
        if(e.key!=='Enter'||e.nativeEvent.isComposing||!query.trim()||results.length!==1||chosenId)return;
        e.preventDefault();
        resultTrigger.current=e.currentTarget;
        setSelected(results[0].entry.visualConceptId);
      }}/></label>
     <label>Contexte<select aria-label="Contexte du catalogue" value={scope} onChange={e=>{setScope(e.target.value);setFamily('');change();}}>{CATALOG_SCOPES.map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label>
     <label>Famille<select aria-label="Famille du catalogue" value={family} onChange={e=>{setFamily(e.target.value);change();}}><option value="">Toutes les familles</option>{[...new Set(entries.filter(e=>scope==='all'||e.discovery.contexts.includes(scope)).map(e=>e.discovery.family))].sort().map(f=><option key={f}>{f}</option>)}</select></label>
     <label>Nature<select aria-label="Nature du visuel" value={nature} onChange={e=>{setNature(e.target.value);change();}}><option value="">Toutes les natures</option>{[['ELEMENT','Éléments'],['INTENT','Intentions'],['SCENE','Scènes'],['MODE','Modes de trajet'],['GROUP','Groupes de produits'],['CONFIGURATION','Configurations']].map(([k,l])=><option key={k} value={k}>{l}</option>)}</select></label>
    </div>
    {scope==='courses'&&!basket&&<div className={styles.notice}><p>Le budget Courses du mois et le panier de produits sont deux décisions distinctes.</p>
      {canPrepareCourses&&<button type="button" disabled={busy||!currentRequest} onClick={()=>execute(()=>choosePreset(coursesAsset!,'groceries-purchase'))}>Préparer mes courses</button>}</div>}
    {error?<p role="alert">{error}</p>:!entries.length?<p role="status">Chargement du catalogue…</p>:<>
    <div className={styles.count} role="status">{results.length} résultat(s){query?' pour votre recherche':' · classés selon ce contexte'}</div>
    <div className={styles.content} data-catalog-detail-open={!!chosen}>
     <div ref={resultsRegion} tabIndex={-1} className={styles.results} aria-label="Éléments du catalogue">{results.slice(page*24,page*24+24).map(({entry,reason})=>{const art=clayCatalogArtwork(entry);return <button type="button" key={entry.visualConceptId} data-catalog-entry={entry.visualConceptId} aria-pressed={selected===entry.visualConceptId} onClick={event=>{resultTrigger.current=event.currentTarget;setSelected(entry.visualConceptId);}}>
       {art&&<img src={art.src} width={art.width} height={art.height} alt="" loading="lazy" decoding="async"/>}<strong>{entry.label}</strong><small>{entry.discovery.nature==='ELEMENT'?'Élément':entry.discovery.nature==='INTENT'?'Intention':'Repère visuel'} · {reason}</small><span>Consulter</span></button>;})}
      {!results.length&&<p>Aucun résultat. Changez de famille ou choisissez « Tous les éléments » pour élargir la recherche.</p>}
     </div>
     {chosen&&<section className={styles.detail} aria-label={`Fiche ${chosen.label}`} data-catalog-detail={chosen.visualConceptId}>
      <button type="button" className={styles.back} onClick={()=>{returnToResults.current=true;setSelected(null);}}>Retour aux résultats</button>
      {(()=>{const art=clayCatalogArtwork(chosen,chosen.nativeRatio==='2:1'?'wide':'primary');return art?<img src={art.src} width={art.width} height={art.height} alt={chosen.label}/>:null;})()}
      <h3 ref={detailHeading} tabIndex={-1}>{chosen.label}</h3><p>{chosen.discovery.family}</p>
      <p>{chosen.discovery.sourceRow?`Concept Excel V22 · ligne ${chosen.discovery.sourceRow}`:chosen.protected?'Illustration historique protégée':'Visuel complémentaire M10 · hors Excel'}</p>
      {!!alreadyChosen&&<p>Déjà présent dans cette composition.</p>}
      {context?.templateKey==='purchase'&&!basket&&actions.some(action=>action.target?.slotKey==='item'&&action.selection)&&<p>Cet achat contient une seule ligne article.</p>}
      {(!actions.length&&!commands.length)&&<p>{unavailable}</p>}
      {!currentRequest&&<p>La composition a changé. Rouvrez le catalogue depuis l’objet concerné pour configurer un élément.</p>}
      <div className={styles.actions}>{actions.map(a=><button type="button" key={a.key} disabled={busy||!currentRequest} onClick={()=>execute(()=>{
        if(a.kind==='OPEN')openContext(a.contextId!,a.focus,a.articleLabel);
        else if(a.kind==='PRESET')choosePreset(a.asset!,a.presetKey as ComposerPresetKey,a.concept);
        else if(a.kind==='BASKET_ARTICLE')prepareBasketArticle?.(a.contextId!,a.concept!);
        else choose(a.asset!,a.target!,a.selection,a.componentLabel,a.concept);
      })}>{a.label}</button>)}
        {commands.map(c=><button type="button" key={c.key??c.label} disabled={busy} onClick={()=>execute(c.run)}>{c.label}</button>)}
        {request.controlRef&&<button type="button" onClick={()=>execute(()=>revealControl(request.controlRef!))}>Voir le budget Courses du mois</button>}
        {!request.contextId&&model.board.contexts.filter(c=>chosen.discovery.contexts.includes(scopeForCard(model,c.contextOccurrenceId))).map(c=><button type="button" key={c.contextOccurrenceId} onClick={()=>open({contextId:c.contextOccurrenceId,query:chosen.label,entryId:chosen.visualConceptId})}>Explorer pour {c.label}</button>)}
      </div>
     </section>}
    </div>
    <nav className={styles.pages} aria-label="Pages du catalogue"><button type="button" disabled={!page} onClick={()=>{setPage(p=>p-1);setSelected(null);}}>Précédent</button><span>Page {page+1} / {Math.max(1,Math.ceil(results.length/24))}</span><button type="button" disabled={(page+1)*24>=results.length} onClick={()=>{setPage(p=>p+1);setSelected(null);}}>Suivant</button></nav>
    </>}
   </div>
  </dialog>,document.body)}</DiscoveryContext.Provider>;
}
