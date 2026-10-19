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
export function BarPersonalPlaces({detail,query,onChoose,rawTargetRef='bar-personal-place'}:{detail:SelectedRestaurantPlace|null;query:string;onChoose?:(label:string,ref:BarGoogleRef)=>void;rawTargetRef?:string}) {
  const [enabled,setEnabled]=useState(false),[places,setPlaces]=useState<PersonalGooglePlace[]>([]),[label,setLabel]=useState('');
  const [status,setStatus]=useState(''),[busy,setBusy]=useState(false),[page,setPage]=useState(0);
  const [rawVersion,setRawVersion]=useState(0);
  const generation=useRef(0),pending=useRef<{identity:string;requestId:string}|null>(null);
  const currentDetail=useRef(detail?.placeId);currentDetail.current=detail?.placeId;
  useEffect(()=>{const controller=new AbortController();void fetch('/api/places/personal',{cache:'no-store',signal:controller.signal})
    .then(async r=>{if(!r.ok)return;const v=await r.json();if(!controller.signal.aborted&&v.enabled===true&&Array.isArray(v.places)){const admitted=v.places.map(parsePersonalGooglePlace);setEnabled(true);setPlaces(admitted);}})
    .catch(()=>{});return()=>{controller.abort();generation.current++;};},[]);
  useEffect(()=>{generation.current++;setLabel('');setStatus('');setBusy(false);pending.current=null;},[detail?.placeId]);
  useEffect(()=>setPage(0),[query]);
  const existing=places.find(p=>p.googlePlaceId===detail?.placeId);
  useWorkshopRaw(rawTargetRef,enabled&&!!detail&&!!label.trim()&&existing?.status!=='SAVED',()=>setLabel(''),`bar-personal-label:${rawVersion}`);
  if(!enabled)return null;
  const matches=places.filter(p=>p.status==='SAVED'&&p.userLabel.toLocaleLowerCase('fr').includes(query.trim().toLocaleLowerCase('fr')));
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
        setStatus(v.superseded===true?'Cette demande avait été enregistrée. Une version plus récente a été relue.':action==='SAVE'?'Enregistré dans mes lieux personnels. La sortie reste inchangée.':'Retiré de mes suggestions. Archive conservée.');
      }else setStatus(v.status==='CONFLICT'?'Ce lieu a changé ailleurs. Rouvrez la recherche pour relire sa version.':v.status==='DENIED'?'Enregistrement refusé. Votre sortie est conservée.':'Enregistrement non confirmé. Votre sortie est conservée ; vous pouvez réessayer.');
    }catch{if(generation.current===ticket)setStatus('Enregistrement non confirmé. Réessayez pour vérifier la même demande, sans double écriture.');}
    finally{if(generation.current===ticket)setBusy(false);}
  };
  return <section aria-label="Mes lieux personnels" data-bar-personal-places>
    {!detail&&matches.slice(page*3,(page+1)*3).map(p=><div key={p.id}>
      <button type="button" onClick={()=>onChoose?.(p.userLabel,{provider:'google_places',kind:'BAR_APERO',placeId:p.googlePlaceId})}>{p.userLabel} · Lieu personnel</button>
      <button type="button" disabled={busy} onClick={()=>void mutate('ARCHIVE',p.googlePlaceId,p.userLabel,p.version)}>Retirer de mes lieux</button>
    </div>)}
    {!detail&&<BarPageControls index={page} count={Math.ceil(matches.length/3)} onChange={setPage} label="Mes lieux personnels"/>}
    {detail&&(!existing||existing.status==='ARCHIVED')&&<>
      <label>Nom personnel<input maxLength={120} value={label} onChange={e=>{setLabel(e.target.value);setRawVersion(v=>v+1);}} placeholder="Le repère que vous souhaitez garder"/></label>
      <button type="button" disabled={busy||!label.trim()} onClick={()=>{if(currentDetail.current===detail.placeId)void mutate('SAVE',detail.placeId,label.trim(),existing?.version??0);}}>Enregistrer dans mes lieux</button>
      <small>Favori privé · ne crée ni lieu Canonical, ni visite enregistrée.</small>
    </>}
    {detail&&existing?.status==='SAVED'&&<p>Dans mes lieux personnels : {existing.userLabel}</p>}
    {status&&<p role="status">{status}</p>}
  </section>;
}
