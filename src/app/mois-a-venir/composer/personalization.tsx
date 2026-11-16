"use client";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { preferenceDay, preferenceEffect, type ExplicitPreference } from "@/domain/phase2/composer-preferences";
import styles from "./personalization.module.css";

const empty:readonly ExplicitPreference[]=[];
async function command(body:unknown){
  const response=await fetch('/api/composer/preferences',{method:'POST',credentials:'same-origin',cache:'no-store',
    headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  const result=await response.json();
  if(!response.ok)throw Error(response.status===409?'La préférence a changé dans un autre onglet. Sa version actuelle vient d’être relue.'
    :response.status===401?'Reconnectez-vous pour retrouver vos préférences.':'Sauvegarde de préférence non confirmée. Réessayez lorsque la connexion est disponible.');
  return result;
}
type PersonalizationState={rows:readonly ExplicitPreference[];status:'LOADING'|'READY'|'UNAVAILABLE';busy:boolean;today:string;
  change:(subjectKey:string,label:string,stance:'LIKE'|'DISMISS',scope?:string,scopeLabel?:string,reviewOn?:string|null)=>Promise<void>;
  remove:(row:ExplicitPreference)=>Promise<void>;open:()=>void};
const Personalization=createContext<PersonalizationState|null>(null);
export const usePersonalization=()=>useContext(Personalization);

export function PersonalizationProvider({children}:{children:ReactNode}){
  const [rows,setRows]=useState(empty),[status,setStatus]=useState<PersonalizationState['status']>('LOADING');
  const [busy,setBusy]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState(''),[opened,setOpened]=useState(false);
  const latest=useRef(rows);latest.current=rows;
  const mounted=useRef(true),saving=useRef(false);
  const [today]=useState(preferenceDay);
  const refresh=useCallback(async()=>{const data=await command({kind:'READ'});if(mounted.current){setRows(data.rows);setStatus('READY');}},[]);
  useEffect(()=>{mounted.current=true;void refresh().catch(()=>{if(mounted.current){setRows(empty);setStatus('UNAVAILABLE');}});return()=>{mounted.current=false;};},[refresh]);
  const run=useCallback(async(work:()=>Promise<ExplicitPreference|null>,removed?:ExplicitPreference)=>{
    if(saving.current)return;
    saving.current=true;setBusy(true);setMessage('');setError('');
    try{const result=await work();if(mounted.current){setRows(current=>result?[...current.filter(r=>r.subjectKey!==result.subjectKey||r.scope!==result.scope),result]
      :current.filter(r=>r.subjectKey!==removed?.subjectKey||r.scope!==removed?.scope));setMessage(result?'Préférence sauvegardée dans votre compte.':'Préférence retirée de votre compte.');}}
    catch(e){if(mounted.current)setError(e instanceof Error?e.message:'Enregistrement non confirmé.');await refresh().catch(()=>{});}
    finally{saving.current=false;if(mounted.current)setBusy(false);}
  },[refresh]);
  const change=useCallback(async(subjectKey:string,label:string,stance:'LIKE'|'DISMISS',scope='GLOBAL',scopeLabel='Mes idées',reviewOn:string|null=null)=>{
    const previous=latest.current.find(r=>r.subjectKey===subjectKey&&r.scope===scope);
    await run(async()=>(await command({kind:'SET',preference:{subjectKey,scope,label,scopeLabel,stance,
      reviewOn:stance==='LIKE'?reviewOn:null,version:previous?.version??0}})).preference);
  },[run]);
  const remove=useCallback(async(row:ExplicitPreference)=>{await run(async()=>{await command({kind:'REMOVE',subjectKey:row.subjectKey,scope:row.scope,version:row.version});return null;},row);},[run]);
  return <Personalization.Provider value={{rows,status,busy,today,change,remove,open:()=>setOpened(true)}}>{children}
    {(message||error)&&<div className={styles.notice} data-preference-feedback role={error?'alert':'status'}>{error||message}
      <button type="button" aria-label="Fermer le message des préférences" onClick={()=>{setMessage('');setError('');}}>×</button></div>}
    {opened&&<PreferenceManager close={()=>setOpened(false)}/>}
  </Personalization.Provider>;
}

export function PreferencesButton(){const p=usePersonalization();return p?<button type="button" className={styles.manage} onClick={p.open}>Mes préférences</button>:null;}
export function PreferenceFeedback({subjectKey,label,contextId,contextLabel}:{subjectKey?:string;label:string;contextId?:string;contextLabel?:string}){
  const p=usePersonalization();if(!p||!subjectKey)return null;
  const global=p.rows.find(r=>r.subjectKey===subjectKey&&r.scope==='GLOBAL');
  const scoped=p.rows.find(r=>r.subjectKey===subjectKey&&r.scope===(contextId??'GLOBAL'));
  const effect=preferenceEffect(subjectKey,{rows:p.rows,contextId,today:p.today});
  const disabled=p.status!=='READY'||p.busy;
  return <div className={styles.feedback} data-preference-subject={subjectKey} onClick={event=>event.stopPropagation()}>
    <button type="button" disabled={disabled} aria-label={`Ça m’intéresse · ${label}`} aria-pressed={global?.stance==='LIKE'}
      onClick={()=>void (global?.stance==='LIKE'?p.remove(global):p.change(subjectKey,label,'LIKE'))}>Ça m’intéresse</button>
    <button type="button" disabled={disabled} aria-label={`Moins ${contextId?'dans ce projet':'dans mes idées'} · ${label}`} aria-pressed={scoped?.stance==='DISMISS'}
      onClick={()=>void (scoped?.stance==='DISMISS'?p.remove(scoped):p.change(subjectKey,label,'DISMISS',contextId,contextLabel??'Mes idées'))}>
      {contextId?'Moins dans ce projet':'Moins dans mes idées'}</button>
    {effect.reason&&<small>{effect.reason}</small>}
    {p.status==='UNAVAILABLE'&&<small>Préférences indisponibles · recherche et préparation restent accessibles.</small>}
  </div>;
}

function PreferenceManager({close}:{close:()=>void}){
  const p=usePersonalization()!,dialog=useRef<HTMLDialogElement>(null);
  useEffect(()=>{const trigger=document.activeElement as HTMLElement|null;dialog.current?.showModal();return()=>{dialog.current?.close();if(trigger?.isConnected)trigger.focus();};},[]);
  return createPortal(<dialog ref={dialog} className={styles.manager} data-preference-manager aria-labelledby="preference-title" onCancel={e=>{e.preventDefault();if(!p.busy)close();}}>
    <header><h2 id="preference-title">Mes préférences</h2><button type="button" disabled={p.busy} aria-label="Fermer mes préférences" onClick={close}>Fermer</button></header>
    <p>Vos choix privés adaptent les suggestions. Ils ne créent aucune intention, aucun achat ni paiement. La recherche conserve tous ses résultats.</p>
    <p>Un réexamen indique une date que vous choisissez, jamais une dernière date d’achat, un stock ou une urgence calculée.</p>
    {p.status==='LOADING'?<p role="status">Lecture des préférences…</p>:p.status==='UNAVAILABLE'?<p role="alert">Préférences privées indisponibles.</p>:!p.rows.length?<p>Aucune préférence enregistrée.</p>:p.rows.map(row=><PreferenceEntry key={row.subjectKey+row.scope} row={row}/>)}
  </dialog>,document.body);
}
function PreferenceEntry({row}:{row:ExplicitPreference}){
  const p=usePersonalization()!;
  return <section className={styles.entry} data-saved-preference={row.subjectKey}>
    <h3>{row.label}</h3><p>{row.scope==='GLOBAL'?'Pour mes idées':`Pour ce projet · ${row.scopeLabel}`} · {row.stance==='LIKE'?'M’intéresse':'Moins de suggestions'}</p>
    {row.reviewOn&&<p>Réexamen choisi : {row.reviewOn} · aucun achat déduit.</p>}
    <button type="button" disabled={p.busy} onClick={()=>void p.change(row.subjectKey,row.label,row.stance==='LIKE'?'DISMISS':'LIKE',row.scope,row.scopeLabel)}>Changer en « {row.stance==='LIKE'?'Moins de suggestions':'M’intéresse'} »</button>
    <button type="button" disabled={p.busy} aria-label={`Retirer la préférence · ${row.label}`} onClick={()=>void p.remove(row)}>Retirer la préférence</button>
    {row.stance==='LIKE'&&<form onSubmit={event=>{event.preventDefault();const date=String(new FormData(event.currentTarget).get('reviewOn')??'');void p.change(row.subjectKey,row.label,'LIKE',row.scope,row.scopeLabel,date||null);}}>
      <label>Réexaminer à partir du (facultatif)<input key={row.version} name="reviewOn" type="date" defaultValue={row.reviewOn??''} disabled={p.busy}/></label>
      <button disabled={p.busy}>Conserver la date de réexamen</button></form>}
  </section>;
}
