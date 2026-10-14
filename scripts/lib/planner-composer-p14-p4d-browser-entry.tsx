import React from 'react';
import {createRoot} from 'react-dom/client';
import {ComposerShell} from '../../src/app/mois-a-venir/composer/composer-shell';
import {AppShell} from '../../src/components/layout/app-shell';
import {semanticStateDigest} from '../../src/domain/phase2/planner/semantic-state';
import type {ComposerRequest} from '../../src/domain/phase2/planner/composer-ui-contract';
import {p4d,p4dInstall,p4dPublish,p4dSending,p4dReceived} from './planner-p14-p4d-probe';
const sleep=(ms:number)=>new Promise(r=>setTimeout(r,ms));
const transport=async(request:ComposerRequest)=>{
  if(['APPLY','CHECK_APPLY'].includes(request.kind))throw Error('P4D_APPLY_FORBIDDEN');
  const row=p4dSending(request.kind,request.sequence,request.draft?semanticStateDigest(request.draft):undefined);
  const response=await fetch('/interaction'+location.search,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(request)});
  const text=await response.text(),result=response.ok?JSON.parse(text):null;
  p4dReceived(row,result?.model?.board?.draft?.semanticStateDigest,result?.p4dPerformance,new TextEncoder().encode(text).length,!result?.ok);
  if(!response.ok)throw Error('P4D_FIXTURE_NETWORK_FAILED');return result;
};
const initial=await transport({kind:'READ',sequence:0,targetMonth:'2026-11'});if(!initial.ok)throw Error(initial.code);
const command=(detail:unknown)=>window.dispatchEvent(new CustomEvent('p4d-fixture-command',{detail}));
async function settled(){const cycle=p4d.cycles.at(-1),start=performance.now();while(performance.now()-start<20000){
  if(cycle?cycle.T7!==undefined:['FRESH','BLOCKED'].includes(document.querySelector('[data-composer]')?.getAttribute('data-preview-state')??'')){await sleep(30);return;}
  await sleep(20);
}throw Error('P4D_FIXTURE_FINANCIAL_WAIT_EXCEEDED');}
let running=false,cursor=0;
const batch=Math.min(40,Math.max(1,Number(new URLSearchParams(location.search).get('batch')??40)));
async function suite(){if(running||cursor>=40)return;running=true;p4d.completed=false;p4d.error=null;
  try{
    await settled();
    const end=Math.min(40,cursor+batch);
    for(let i=cursor;i<end;i++){command({mode:'amount',amount:String(350+i),label:'simple'});await settled();}
    cursor=end;if(cursor<40){p4d.completed=true;p4dPublish();return;}
    command({mode:'amount',amount:'410',label:'burst-a'});await sleep(40);
    command({mode:'amount',amount:'411',label:'burst-b'});await sleep(40);
    command({mode:'amount',amount:'412',label:'burst-last'});await settled();
    command({mode:'undo',label:'undo'});await settled();command({mode:'redo',label:'redo'});await settled();
    const last=p4d.requests.length;command({mode:'suggestions',label:'suggestions'});
    while(p4d.requests.length===last||p4d.requests.at(-1)?.response===undefined)await sleep(25);
    for(let i=0;i<100;i++){
      command({mode:'amount',amount:String(500+i),label:'memory'});await sleep(5);
      if([19,49,99].includes(i))p4d.memory.push({actions:i+1,heap:(performance as Performance & {memory?:{usedJSHeapSize:number}}).memory?.usedJSHeapSize??0});
    }await settled();p4d.completed=true;p4dPublish();
  }catch(e){p4d.error=e instanceof Error?e.message:'FAILED';p4dPublish();}finally{running=false;}
}
createRoot(document.getElementById('root')!).render(<><div data-p4d-toolbar style={{position:'fixed',bottom:0,left:0,zIndex:12000,background:'white'}}>
  <button onClick={()=>void suite()}>Mesurer la chronologie P4D</button><span hidden data-p4d-metrics data-result="{}" /></div>
  <AppShell><ComposerShell initialModel={initial.model} transport={transport} draftTransport={null}/></AppShell></>);
p4dInstall();
