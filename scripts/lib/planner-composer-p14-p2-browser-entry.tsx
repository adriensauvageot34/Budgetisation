import React, {Profiler} from "react";
import {createRoot} from "react-dom/client";
import {ComposerShell} from "../../src/app/mois-a-venir/composer/composer-shell";
import {AppShell} from "../../src/components/layout/app-shell";
import {probe,publish,rendered} from "./planner-p14-p2-probe";
import type {ComposerRequest} from "../../src/domain/phase2/planner/composer-ui-contract";
const params=new URLSearchParams(location.search),draftUrl='/draft'+location.search;
const uuid=(n:number)=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const transport=async(request:ComposerRequest)=>{
  const at=performance.now(),row:{kind:string;sequence:number;at:number;ms?:number;ok?:boolean;server?:unknown}={kind:request.kind,sequence:request.sequence,at};
  probe.requests.push(row);
  const response=await fetch('/interaction'+location.search,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(request)});
  row.ms=performance.now()-at;if(!response.ok){row.ok=false;publish();throw Error('P2_FIXTURE_NETWORK_FAILURE');}
  const result=await response.json();row.ok=result.ok;row.server=result.fixturePerformance;publish();return result;
};
const draftRead=async()=>{const response=await fetch(draftUrl);if(!response.ok)throw Error('P2_FIXTURE_DRAFT_READ_FAILED');return response.json();};
const draftCall=async(kind:string,command:unknown)=>{
  const response=await fetch(draftUrl,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({kind,command})});
  if(response.ok)return response.json();
  const latest=await draftRead(),id=(command as {requestId:string}).requestId;
  const row=[latest.active,...latest.archives].find(item=>item?.lastMutationRequestId===id);
  return row?{ok:true,draft:row,replayed:true}:{ok:false,code:'UNAVAILABLE',message:'Réponse perdue non confirmée.',latest};
};
const draftTransport={read:()=>draftRead(),save:(command:unknown)=>draftCall('SAVE',command),archive:(command:unknown)=>draftCall('ARCHIVE',command),restore:(command:unknown)=>draftCall('RESTORE',command)};
const initialDrafts=await draftRead();
const initial=await transport({kind:'READ',sequence:0,targetMonth:'2026-11',...(initialDrafts.active?{draft:initialDrafts.active.semanticState}:{})});
if(!initial.ok)throw Error(initial.code);
function command(detail:unknown){window.dispatchEvent(new CustomEvent('p2-fixture-command',{detail}));}
const sleep=(ms:number)=>new Promise(resolve=>setTimeout(resolve,ms));
async function settled(save=false){
  const start=performance.now();
  while(performance.now()-start<20000){
    const board=document.querySelector('[data-composer]'),state=board?.getAttribute('data-preview-state');
    if((state==='FRESH'||state==='BLOCKED')&&(!save||['SAVED','CLEAN'].includes(board?.getAttribute('data-save-state')??''))){await sleep(60);return;}
    await sleep(30);
  }throw Error('P2_FIXTURE_LAST_PREVIEW_OR_SAVE_NOT_SETTLED');
}
async function step(detail:unknown,phase:string,wait=60){
  probe.phase=phase;const count=probe.stages.length;command(detail);
  if(!['hover','clear-hover'].includes((detail as {mode?:string}).mode??'')){
    const start=performance.now();while(probe.stages.length===count&&performance.now()-start<5000)await sleep(10);
    if(probe.stages.length===count)throw Error('P2_FIXTURE_NO_PAINT_ACK');
  }
  // Let passive effects expose the next history state before the next gesture.
  await sleep(wait);
}
const add=(template:string,n:number)=>({operation:{kind:'DROP',assetKey:'template:'+template,target:{kind:'BOARD_ZONE'},identity:uuid(50000+n),selectionId:uuid(51000+n),values:{}}});
let busy=false;
async function session(){
  if(busy)return;busy=true;probe.completed=false;probe.failure=null;
  try{
    await step(add('night-out',1),'night-add');await settled();
    await step({mode:'asset',slot:'main',contextId:uuid(50001),selectionId:uuid(50101)},'asset-main');await settled();
    await step({mode:'asset',slot:'extras',contextId:uuid(50001),selectionId:uuid(50102)},'asset-extra-1');await settled();
    await step({mode:'asset',slot:'extras',contextId:uuid(50001),selectionId:uuid(50103)},'asset-extra-2');await settled();
    await step({mode:'asset',slot:'extras',contextId:uuid(50001),selectionId:uuid(50103),quantity:'3'},'quantity');await settled();
    await step(add('family-visit',2),'family-add');await settled();
    await step(add('short-stay',3),'stay-add');await settled();
    for(let i=0;i<5;i++)await step({mode:'amount',amount:String(350+i)},'five-amounts',40);await settled();
    for(let i=0;i<10;i++)await step({mode:'amount',amount:String(360+i)},'ten-edits',40);await settled();
    for(let n=4;n<=20;n++)await step(add('night-out',n),'add-to-20',55);await settled(true);
    for(let n=20;n>=19;n--)await step({operation:{kind:'DROP',assetKey:'context-occurrence:'+uuid(50000+n),target:{kind:'TRASH'},values:{},identity:uuid(50000+n),selectionId:uuid(51000+n)}},'delete-two');await settled();
    for(const mode of ['undo','undo','redo','redo','undo','undo'])await step({mode},'history',40);await settled(true);
    // Same semantic choice is deliberately repeated after prior FRESH; no source refresh is requested.
    for(let i=0;i<3;i++)await step({mode:'same-amount'},'same-choice',250);await settled(true);
    for(let i=0;i<5;i++)await step({mode:'hover'},'same-hover',250);
    await step({mode:'clear-hover'},'clear-hover');await sleep(1500);await settled(true);
    probe.phase='complete';probe.completed=true;publish();
    await fetch('/p2-metrics'+location.search,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(probe)});
  }catch(error){probe.failure=error instanceof Error?error.message:'P2_FIXTURE_FAILED';publish();}finally{busy=false;}
}
createRoot(document.getElementById('root')!).render(<><div style={{position:'fixed',zIndex:10000,bottom:0,left:0,background:'#fff',padding:5,fontSize:12}}>
  <button type="button" data-p2-run onClick={()=>void session()}>P2 — Exécuter la séance</button>
  <button type="button" onClick={()=>command(add('night-out',1))}>P2 — Ajouter une Soirée</button>
  <button type="button" onClick={()=>command(add('family-visit',2))}>P2 — Ajouter une Visite</button>
  <span hidden data-p2-metrics data-result="{}" /></div>
  <Profiler id="Composer" onRender={rendered}><AppShell><ComposerShell initialModel={initial.model} transport={transport}
    initialDrafts={initialDrafts} draftTransport={draftTransport}/></AppShell></Profiler></>);
await sleep(100);publish();
