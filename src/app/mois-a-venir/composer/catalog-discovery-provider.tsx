"use client";
import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import type { ComposerUiModel } from '@/domain/phase2/planner/composer-ui-contract';
import type { ComposerPresetKey } from '@/domain/phase2/planner/composer-presets';
import type { ComposerAssetView, DropTarget } from '@/domain/phase2/planner/composer-contract';
import type { ComponentSelectionV1 } from '@/domain/phase2/planner/component-contract';
import { clayCatalogArtwork, loadClayV22Collection, type ClayCatalogEntry } from '../clay-v22-catalog';
import { CATALOG_SCOPES, catalogResults, discoveryActions, scopeForCard, selectedCatalogIdentities, type DiscoveryTarget } from './catalog-discovery';
import styles from './catalog-discovery.module.css';

type Command=Readonly<{visualConceptId:string;label:string;run:()=>void;editsExisting?:boolean}>;
type Request=DiscoveryTarget&Readonly<{query?:string;commands?:readonly Command[]}>;
const DiscoveryContext=createContext<((target:Request)=>void)|null>(null);
export function CatalogOpenButton({children='Tous les éléments',target={},className}:{children?:ReactNode;target?:Request;className?:string}){
 const open=useContext(DiscoveryContext);
 return open?<button type="button" className={className??styles.open} data-catalog-open onClick={()=>open(target)}>{children}</button>:null;
}
export function CatalogDiscoveryProvider({model,busy,children,openContext,choose,choosePreset,revealControl}:{model:ComposerUiModel;busy:boolean;children:ReactNode;
 openContext:(id:string)=>void;revealControl:(id:string)=>void;choose:(asset:ComposerAssetView,target:DropTarget,selection?:ComponentSelectionV1)=>void;
 choosePreset:(asset:ComposerAssetView,key:ComposerPresetKey)=>void}){
 const [request,setRequest]=useState<Request|null>(null),[entries,setEntries]=useState<readonly ClayCatalogEntry[]>([]),[error,setError]=useState('');
 const [query,setQuery]=useState(''),[scope,setScope]=useState('all'),[family,setFamily]=useState(''),[nature,setNature]=useState(''),[page,setPage]=useState(0),[selected,setSelected]=useState<string|null>(null);
 const dialog=useRef<HTMLDialogElement>(null), trigger=useRef<HTMLElement|null>(null), requestDigest=useRef('');
 const frozenSelections=useRef<ReadonlySet<string>>(new Set());
 const open=(target:Request)=>{trigger.current=document.activeElement instanceof HTMLElement?document.activeElement:null;requestDigest.current=model.board.draft.semanticStateDigest;
   frozenSelections.current=selectedCatalogIdentities(model,target.contextId);
   setRequest(target);setScope(target.scope??scopeForCard(model,target.contextId));setQuery(target.query??'');setFamily('');setNature('');setPage(0);setSelected(null);};
 const close=()=>{dialog.current?.close();setRequest(null);trigger.current?.focus({preventScroll:true});};
 useEffect(()=>{if(!request)return;let current=true;dialog.current?.showModal();setError('');
   void loadClayV22Collection().then(c=>{if(current)setEntries(c.entries);}).catch(()=>{if(current)setError('Le catalogue n’a pas pu être chargé. Fermez puis réessayez.');});
   return()=>{current=false;};},[request]);
 const results=useMemo(()=>catalogResults(entries,{query,scope,family,nature,selectedIds:frozenSelections.current}),[entries,query,scope,family,nature,request]);
 const chosen=entries.find(e=>e.visualConceptId===selected),context=model.board.contexts.find(c=>c.contextOccurrenceId===request?.contextId);
 const currentRequest=request&&(!request.contextId||!!context)&&requestDigest.current===model.board.draft.semanticStateDigest;
 const alreadyChosen=chosen&&context?.sockets.some(s=>s.currentItems.some(i=>i.kind==='COMPONENT'&&i.productAssetRef&&chosen.assetKeys.includes(i.productAssetRef.assetKey)));
 const commands=chosen&&currentRequest?request?.commands?.filter(c=>c.visualConceptId===chosen.visualConceptId&&(!alreadyChosen||c.editsExisting))??[]:[];
 const actions=chosen&&request?discoveryActions(chosen,model,request).filter(action=>action.kind!=='CHOOSE'||!commands.length):[];
 const change=()=>{setPage(0);setSelected(null);};
 const execute=(fn:()=>void)=>{close();fn();};
 return <DiscoveryContext.Provider value={open}>{children}{request&&createPortal(<dialog ref={dialog} className={styles.dialog} aria-labelledby="clay-catalog-title" data-composer-catalog
   onCancel={e=>{e.preventDefault();close();}} onClick={e=>{if(e.target===e.currentTarget)close();}}>
   <div className={styles.panel}>
    <header><div><h2 id="clay-catalog-title">Tous les éléments</h2><p>{context?`Pour ${context.label}`:scope==='courses'?'Produits pour Courses · distincts du budget mensuel':'Concepts, intentions et repères visuels de Composer'}</p></div><button type="button" onClick={close} aria-label="Fermer le catalogue">Fermer</button></header>
    <div className={styles.filters}>
     <label className={styles.search}>Rechercher un élément<input autoFocus aria-label="Rechercher dans tous les éléments" placeholder="Pâtes alimentaires, mascara, billet…" value={query} onChange={e=>{setQuery(e.target.value);change();}}/></label>
     <label>Contexte<select aria-label="Contexte du catalogue" value={scope} onChange={e=>{setScope(e.target.value);setFamily('');change();}}>{CATALOG_SCOPES.map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label>
     <label>Famille<select aria-label="Famille du catalogue" value={family} onChange={e=>{setFamily(e.target.value);change();}}><option value="">Toutes les familles</option>{[...new Set(entries.filter(e=>scope==='all'||e.discovery.contexts.includes(scope)).map(e=>e.discovery.family))].sort().map(f=><option key={f}>{f}</option>)}</select></label>
     <label>Nature<select aria-label="Nature du visuel" value={nature} onChange={e=>{setNature(e.target.value);change();}}><option value="">Toutes les natures</option>{[['ELEMENT','Éléments'],['INTENT','Intentions'],['SCENE','Scènes'],['MODE','Modes de trajet'],['GROUP','Groupes de produits'],['CONFIGURATION','Configurations']].map(([k,l])=><option key={k} value={k}>{l}</option>)}</select></label>
    </div>
    {scope==='courses'&&<p className={styles.notice}>Les produits sont des références à explorer. Le budget Courses du mois reste un contrôle séparé ; consulter un produit ne crée aucun achat.</p>}
    {error?<p role="alert">{error}</p>:!entries.length?<p role="status">Chargement du catalogue…</p>:<>
    <div className={styles.count} role="status">{results.length} résultat(s){query?' pour votre recherche':' · classés selon ce contexte'}<span>Affinités personnelles non utilisées</span></div>
    <div className={styles.content}>
     <div className={styles.results} aria-label="Éléments du catalogue">{results.slice(page*24,page*24+24).map(({entry,reason})=>{const art=clayCatalogArtwork(entry);return <button type="button" key={entry.visualConceptId} data-catalog-entry={entry.visualConceptId} aria-pressed={selected===entry.visualConceptId} onClick={()=>setSelected(entry.visualConceptId)}>
       {art&&<img src={art.src} width={art.width} height={art.height} alt="" loading="lazy" decoding="async"/>}<strong>{entry.label}</strong><small>{entry.discovery.nature==='ELEMENT'?'Élément':entry.discovery.nature==='INTENT'?'Intention':'Repère visuel'} · {reason}</small><span>Consulter</span></button>;})}
      {!results.length&&<p>Aucun résultat. Changez de famille ou choisissez « Tous les éléments » pour élargir la recherche.</p>}
     </div>
     {chosen&&<section className={styles.detail} aria-label={`Fiche ${chosen.label}`} data-catalog-detail={chosen.visualConceptId}>
      <button type="button" className={styles.back} onClick={()=>setSelected(null)}>Retour aux résultats</button>
      {(()=>{const art=clayCatalogArtwork(chosen,chosen.nativeRatio==='2:1'?'wide':'primary');return art?<img src={art.src} width={art.width} height={art.height} alt={chosen.label}/>:null;})()}
      <h3>{chosen.label}</h3><p>{chosen.discovery.family}</p>
      <p>{chosen.discovery.sourceRow?`Concept Excel V22 · ligne ${chosen.discovery.sourceRow}`:chosen.protected?'Illustration historique protégée':'Visuel complémentaire M10 · hors Excel'}</p>
      <p>{chosen.discovery.nature==='ELEMENT'?'Cet élément reste consultable même s’il n’est pas proposé dans les premières suggestions.':'Ce visuel représente une intention, une scène ou une configuration ; il ne constitue pas un article à acheter.'}</p>
      {!!alreadyChosen&&<p>Déjà présent dans cette composition.</p>}
      {(!actions.length&&!commands.length)&&<p>Consultation uniquement : {scope==='courses'?'ce produit ne peut pas être ajouté au budget mensuel depuis cette fiche.':'ce contexte ne propose pas d’action pour ce concept.'}</p>}
      {!currentRequest&&<p>La composition a changé. Rouvrez le catalogue depuis l’objet concerné pour configurer un élément.</p>}
      <div className={styles.actions}>{actions.map(a=><button type="button" key={a.key} disabled={busy||!currentRequest} onClick={()=>execute(()=>{if(a.kind==='OPEN')openContext(a.contextId!);else if(a.kind==='PRESET')choosePreset(a.asset!,a.presetKey as ComposerPresetKey);else choose(a.asset!,a.target!,a.selection);})}>{a.label}</button>)}
        {commands.map((c,i)=><button type="button" key={i} disabled={busy} onClick={()=>execute(c.run)}>{c.label}</button>)}
        {request.controlRef&&<button type="button" onClick={()=>execute(()=>revealControl(request.controlRef!))}>Voir le budget Courses du mois</button>}
        {!request.contextId&&model.board.contexts.filter(c=>chosen.discovery.contexts.includes(scopeForCard(model,c.contextOccurrenceId))).map(c=><button type="button" key={c.contextOccurrenceId} onClick={()=>open({contextId:c.contextOccurrenceId,query:chosen.label})}>Explorer pour {c.label}</button>)}
      </div>
     </section>}
    </div>
    <nav className={styles.pages} aria-label="Pages du catalogue"><button type="button" disabled={!page} onClick={()=>{setPage(p=>p-1);setSelected(null);}}>Précédent</button><span>Page {page+1} / {Math.max(1,Math.ceil(results.length/24))}</span><button type="button" disabled={(page+1)*24>=results.length} onClick={()=>{setPage(p=>p+1);setSelected(null);}}>Suivant</button></nav>
    </>}
   </div>
  </dialog>,document.body)}</DiscoveryContext.Provider>;
}
