"use client";
import {useEffect,useRef,useState} from 'react';
import type {PersonalGooglePlace} from '@/domain/phase2/personal-google-place';
import {parsePersonalGooglePlace} from '@/domain/phase2/personal-google-place';
import type {SelectedRestaurantPlace} from '@/domain/phase2/restaurant-places';
import type {BarGoogleRef} from '@/domain/phase2/planner/night-out-venue';
import {BarPageControls} from './bar-pages';
import {useWorkshopRaw} from './inline-edit-registry';

/** Capability remains OFF until the personal-place owner SQL is reviewed.
 * Saving a favourite never selects a venue, creates KNOWN, or changes a route.
 */
export function BarPersonalPlaces({detail,query,onChoose,rawTargetRef='bar-personal-place',onSuggestions}:{detail:SelectedRestaurantPlace|null;query:string;onChoose?:(label:string,ref:BarGoogleRef)=>void;rawTargetRef?:string;onSuggestions?:(places:readonly PersonalGooglePlace[])=>void}) {
  const [enabled,setEnabled]=useState(false),[places,setPlaces]=useState<PersonalGooglePlace[]>([]),[label,setLabel]=useState('');
  const [status,setStatus]=useState(''),[busy,setBusy]=useState(false),[page,setPage]=useState(0);
  const [lastReceipt,setLastReceipt]=useState<{requestId:string;status:string;version?:number}|null>(null);
  const [rawVersion,setRawVersion]=useState(0);
  const [editingId,setEditingId]=useState<string|null>(null),[showArchives,setShowArchives]=useState(false);
  const generation=useRef(0),pending=useRef<{identity:string;requestId:string}|null>(null);
  const currentDetail=useRef(detail?.placeId);currentDetail.current=detail?.placeId;
  useEffect(()=>{const controller=new AbortController();void fetch('/api/places/personal',{cache:'no-store',signal:controller.signal})
    .then(async r=>{if(!r.ok)return;const v=await r.json();if(!controller.signal.aborted&&v.enabled===true&&Array.isArray(v.places)){const admitted=v.places.map(parsePersonalGooglePlace);setEnabled(true);setPlaces(admitted);}})
    .catch(()=>{});return()=>{controller.abort();generation.current++;};},[]);
  useEffect(()=>{generation.current++;setLabel('');setEditingId(null);setStatus('');setBusy(false);pending.current=null;},[detail?.placeId]);
  useEffect(()=>setPage(0),[query]);
  const existing=places.find(p=>p.googlePlaceId===detail?.placeId);
  const editing=places.find(p=>p.id===editingId);
  const guardPersonal=useWorkshopRaw(rawTargetRef,enabled&&!!label.trim()&&(editing?label.trim()!==editing.userLabel:!!detail&&existing?.status!=='SAVED'),()=>{setLabel('');setEditingId(null);},`bar-personal-label:${rawVersion}`);
  const guarded=(run:()=>void)=>{if(guardPersonal(run))run();};
  useEffect(()=>{onSuggestions?.(enabled?places.filter(place=>place.status==='SAVED'):[]);},[enabled,places,onSuggestions]);
  if(!enabled)return null;
  const matches=places.filter(p=>p.status===(showArchives?'ARCHIVED':'SAVED')&&p.userLabel.toLocaleLowerCase('fr').includes(query.trim().toLocaleLowerCase('fr')));
  const effectivePage=Math.min(page,Math.max(0,Math.ceil(matches.length/3)-1));
  const rename=(p:PersonalGooglePlace)=>guarded(()=>{setEditingId(p.id);setLabel(p.userLabel);setRawVersion(v=>v+1);});
  const mutate=async(action:'SAVE'|'ARCHIVE',id:string,userLabel:string,expectedVersion:number)=>{
    if(busy)return;const ticket=++generation.current,identity=JSON.stringify([action,id,userLabel,expectedVersion]);
    const requestId=pending.current?.identity===identity?pending.current.requestId:crypto.randomUUID();pending.current={identity,requestId};
    setBusy(true);setStatus(action==='SAVE'?'Enregistrement…':'Retrait…');
    try {const r=await fetch('/api/places/personal',{method:'POST',cache:'no-store',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({version:'personal-google-place@v1',requestId,googlePlaceId:id,userLabel,expectedVersion,action})});
      const v=await r.json();if(generation.current!==ticket)return;
      if(r.ok&&(v.status==='SAVED'||v.status==='ARCHIVED')&&v.place?.googlePlaceId===id&&v.place.kind==='PERSONAL_SAVED_PLACE'){
        const receipt=parsePersonalGooglePlace(v.place);if(receipt.status!==v.status)throw Error('PERSONAL_PLACE_RESPONSE_INVALID');
        const admitted=v.currentPlace?parsePersonalGooglePlace(v.currentPlace):receipt;
        if(admitted.id!==receipt.id||admitted.googlePlaceId!==id||admitted.version<receipt.version)throw Error('PERSONAL_PLACE_RESPONSE_INVALID');
        setPlaces(previous=>previous.some(p=>p.googlePlaceId===id&&p.version>admitted.version)?previous:[...previous.filter(p=>p.googlePlaceId!==id),admitted]);pending.current=null;
        setLastReceipt({requestId,status:admitted.status,version:admitted.version});
        setEditingId(null);setLabel('');
        setStatus(v.superseded===true?'Cette demande avait été enregistrée. Une version plus récente a été relue.':action==='SAVE'?'Enregistré dans mes lieux personnels. La sortie reste inchangée.':'Retiré de mes suggestions. Archive conservée.');
      }else {setLastReceipt({requestId,status:v.status==='CONFLICT'?'CONFLICT':v.status==='DENIED'?'DENIED':'UNCONFIRMED'});setStatus(v.status==='CONFLICT'?'Ce lieu a changé ailleurs. Rouvrez la recherche pour relire sa version.':v.status==='DENIED'?'Enregistrement refusé. Votre sortie est conservée.':'Enregistrement non confirmé. Votre sortie est conservée ; vous pouvez réessayer.');}
    }catch{if(generation.current===ticket){setLastReceipt({requestId,status:'HTTP_UNCONFIRMED'});setStatus('Enregistrement non confirmé. Réessayez pour vérifier la même demande, sans double écriture.');}}
    finally{if(generation.current===ticket)setBusy(false);}
  };
  return <section aria-label="Mes lieux personnels" data-bar-personal-places data-place-request-id={lastReceipt?.requestId} data-place-result={lastReceipt?.status} data-place-version={lastReceipt?.version}>
    {!detail&&<button type="button" disabled={busy} onClick={()=>guarded(()=>{setShowArchives(v=>!v);setPage(0);})}>{showArchives?'Mes lieux actifs':'Lieux archivés'}</button>}
    {!detail&&(!onSuggestions||showArchives||!!query.trim())&&matches.slice(effectivePage*3,(effectivePage+1)*3).map(p=><div key={p.id}>
      <button type="button" onClick={()=>guarded(()=>onChoose?.(p.userLabel,{provider:'google_places',kind:'BAR_APERO',placeId:p.googlePlaceId}))}>{p.userLabel} · {p.status==='SAVED'?'Lieu personnel':'Archivé'}</button>
      {p.status==='SAVED'?<><button type="button" disabled={busy} onClick={()=>rename(p)}>Renommer {p.userLabel}</button>
        <button type="button" disabled={busy} onClick={()=>guarded(()=>void mutate('ARCHIVE',p.googlePlaceId,p.userLabel,p.version))}>Retirer de mes lieux</button></>
        :<button type="button" disabled={busy} onClick={()=>void mutate('SAVE',p.googlePlaceId,p.userLabel,p.version)}>Récupérer {p.userLabel}</button>}
    </div>)}
    {!detail&&(!onSuggestions||showArchives||!!query.trim())&&<BarPageControls index={effectivePage} count={Math.ceil(matches.length/3)} onChange={setPage} label="Mes lieux personnels"/>}
    {editing&&<><label>Nom personnel<input disabled={busy} maxLength={120} value={label} onChange={e=>{setLabel(e.target.value);setRawVersion(v=>v+1);}}/></label>
      <button type="button" disabled={busy||!label.trim()||label.trim()===editing.userLabel} onClick={()=>void mutate('SAVE',editing.googlePlaceId,label.trim(),editing.version)}>Enregistrer le nom</button></>}
    {detail&&(!existing||existing.status==='ARCHIVED')&&<>
      <label>Nom personnel<input disabled={busy} maxLength={120} value={label} onChange={e=>{setLabel(e.target.value);setRawVersion(v=>v+1);}} placeholder="Le repère que vous souhaitez garder"/></label>
      <button type="button" disabled={busy||!label.trim()} onClick={()=>{if(currentDetail.current===detail.placeId)void mutate('SAVE',detail.placeId,label.trim(),existing?.version??0);}}>Enregistrer dans mes lieux</button>
      <small>Favori privé · ne crée ni lieu Canonical, ni visite enregistrée.</small>
    </>}
    {detail&&existing?.status==='SAVED'&&<p>Dans mes lieux personnels : {existing.userLabel} <button type="button" disabled={busy} onClick={()=>rename(existing)}>Renommer {existing.userLabel}</button></p>}
    {status&&<p role="status">{status}</p>}
  </section>;
}
