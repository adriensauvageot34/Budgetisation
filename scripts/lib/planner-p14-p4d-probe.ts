import {useLayoutEffect} from 'react';
type Cycle={label:string;trusted:boolean;T0:number;T1?:number;T2?:number;T3?:number;T4?:number;T5?:number;T6?:number;T7?:number;paintUpper?:number;digest?:string;status?:string};
type RequestRow={kind:string;sequence:number;start:number;response?:number;server?:unknown;bytes?:number;error?:boolean};
export const p4d={cycles:[] as Cycle[],requests:[] as RequestRow[],memory:[] as {actions:number;heap:number}[],completed:false,error:null as string|null};
let intent:Cycle|null=null;
export function p4dPublish(){document.querySelector('[data-p4d-metrics]')?.setAttribute('data-result',JSON.stringify(p4d));}
export function p4dIntent(label:string,trusted:boolean){intent={label,trusted,T0:performance.now()};}
export function p4dStage(digest:string){if(!intent)p4dIntent('stage',false);intent!.T1=performance.now();intent!.digest=digest;p4d.cycles.push(intent!);p4dPublish();}
export function p4dScheduled(digest:string){const cycle=p4d.cycles.findLast(c=>c.digest===digest&&!c.T2);if(cycle)cycle.T2=performance.now();}
export function p4dAdmitted(digest:string){const cycle=p4d.cycles.findLast(c=>c.digest===digest&&!c.T5);if(cycle)cycle.T5=performance.now();}
export function p4dCommit(localDigest:string,modelDigest:string,status:string){useLayoutEffect(()=>{
  const cycle=p4d.cycles.findLast(c=>c.digest===localDigest&&c.digest===modelDigest&&!c.T7);
  if(cycle&&['FRESH','BLOCKED'].includes(status)){cycle.T6=performance.now();cycle.T7=performance.now();cycle.status=status;
    requestAnimationFrame(()=>{cycle.paintUpper=performance.now();p4dPublish();});p4dPublish();}
});}
export function p4dSending(kind:string,sequence:number,digest?:string){const row:RequestRow={kind,sequence,start:performance.now()};p4d.requests.push(row);
  const cycle=p4d.cycles.findLast(c=>c.digest===digest&&!c.T3);if(cycle)cycle.T3=row.start;return row;}
export function p4dReceived(row:RequestRow,digest:string|undefined,server:unknown,bytes:number,error:boolean){row.response=performance.now();row.server=server;row.bytes=bytes;row.error=error;
  const cycle=p4d.cycles.findLast(c=>c.digest===digest&&!c.T4);if(cycle)cycle.T4=row.response;p4dPublish();}
export function p4dInstall(){document.addEventListener('click',e=>{const el=e.target as Element;if(!el.closest('[data-p4d-toolbar]'))p4dIntent('browser-click',e.isTrusted);},true);
  document.addEventListener('input',e=>{if(!(e.target as Element).closest('[data-p4d-toolbar]'))p4dIntent('browser-input',e.isTrusted);},true);}
