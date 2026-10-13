import React,{Profiler} from 'react';
import {createRoot} from 'react-dom/client';
import {ComposerShell} from '../../src/app/mois-a-venir/composer/composer-shell';
import {AppShell} from '../../src/components/layout/app-shell';
import {p4,p4Install,p4Reset,p4Publish} from './planner-p14-p4a-probe';
import type {ComposerRequest} from '../../src/domain/phase2/planner/composer-ui-contract';
const transport=async(request:ComposerRequest)=>{if(request.kind==='APPLY')throw Error('P4_APPLY_FORBIDDEN');const at=performance.now();
  const response=await fetch('/interaction'+location.search,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(request)});
  p4.requests.push({kind:request.kind,sequence:request.sequence,ms:performance.now()-at,status:response.status});if(!response.ok)throw Error('P4_SYNTHETIC_NETWORK_FAILURE');return response.json();};
const initial=await transport({kind:'READ',sequence:0,targetMonth:'2026-11'});if(!initial.ok)throw Error(initial.code);
const toolbar=<div data-p4-toolbar style={{position:'fixed',bottom:0,left:0,zIndex:12000,background:'white',padding:4,fontSize:11}}>
  <button data-p4-reset onClick={p4Reset}>Réinitialiser mesures</button><button data-p4-save onClick={()=>{p4Publish();void fetch('/p4-metrics'+location.search,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(p4)});}}>Enregistrer mesures</button>
  <span hidden data-p4-metrics data-result="{}" /></div>;
const app=<AppShell><ComposerShell initialModel={initial.model} transport={transport}/></AppShell>;
createRoot(document.getElementById('root')!).render(<>{toolbar}{process.env.P4_DIAGNOSTICS?<Profiler id="Composer" onRender={(id,phase,actualDuration,baseDuration,startTime,commitTime)=>p4.profiles.push({id,phase,actualDuration,baseDuration,startTime,commitTime})}>{app}</Profiler>:app}</>);
p4Install();
