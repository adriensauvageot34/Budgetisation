import {useLayoutEffect} from 'react';
type Sample={label:string;at:number;trusted:boolean;stateMs?:number;commitMs?:number;domMs?:number;paintUpperMs?:number;status?:string|null;nodes?:number;visibility?:string;viewport?:number[]};
export const p4={samples:[] as Sample[],editorReady:[] as {asset:string;ms:number;chunk:string}[],resources:[] as {name:string;transfer:number;decoded:number;ms:number}[],spans:{} as Record<string,{calls:number;ms:number}>,renders:{} as Record<string,number>,profiles:[] as unknown[],longTasks:[] as number[],requests:[] as unknown[],rectCalls:0,rectMs:0,heapStart:0,heapEnd:0};
let pending:Sample|null=null,finishing=false;
let editorStart:{asset:string;at:number}|null=null;
const heap=()=>((performance as Performance & {memory?:{usedJSHeapSize:number}}).memory?.usedJSHeapSize??0);
export function p4Publish(){p4.heapEnd=heap();p4.resources=performance.getEntriesByType('resource').filter(e=>new URL(e.name).pathname.endsWith('.js')).map(e=>({name:new URL(e.name).pathname,transfer:(e as PerformanceResourceTiming).transferSize,decoded:(e as PerformanceResourceTiming).decodedBodySize,ms:e.duration}));document.querySelector('[data-p4-metrics]')?.setAttribute('data-result',JSON.stringify(p4));}
export function p4Reset(){p4.samples=[];p4.editorReady=[];p4.spans={};p4.renders={};p4.profiles=[];p4.longTasks=[];p4.requests=[];p4.rectCalls=0;p4.rectMs=0;p4.heapStart=heap();pending=null;editorStart=null;finishing=false;p4Publish();}
export function p4Span(label:string){const at=performance.now();return()=>{const row=p4.spans[label]??={calls:0,ms:0};row.calls++;row.ms+=performance.now()-at;
  if(label==='stage'&&pending)pending.stateMs=performance.now()-pending.at;};}
export function p4Rendered(label:string){p4.renders[label]=(p4.renders[label]??0)+1;}
function changed(){if(editorStart&&document.querySelector('dialog[open] [data-night-out-editor],dialog[open] [data-family-visit-editor],dialog[open] [data-short-stay-editor],dialog[open] [data-gift-editor],dialog[open] [data-catalog-context-editor]')){
    const start=editorStart;editorStart=null;p4.editorReady.push({asset:start.asset,ms:performance.now()-start.at,chunk:document.querySelector('dialog[open] [data-editor-loading]')?'loading':'ready'});p4Publish();
  }
  if(!pending||finishing)return;pending.domMs=performance.now()-pending.at;finishing=true;const sample=pending;
  // rAF runs before paint. A second rAF is an upper bound after the intervening
  // rendering opportunity, not the end of the 220ms FLIP animation.
  requestAnimationFrame(()=>requestAnimationFrame(()=>{sample.paintUpperMs=performance.now()-sample.at;sample.status=document.querySelector('[data-composer]')?.getAttribute('data-preview-state');
    sample.nodes=document.querySelectorAll('[data-composer] *').length;sample.visibility=document.visibilityState;sample.viewport=[innerWidth,innerHeight];p4.samples.push(sample);pending=null;finishing=false;p4Publish();}));}
export function ReactP4Commit(_digest:string,_status:string){useLayoutEffect(()=>{if(pending&&pending.commitMs===undefined)pending.commitMs=performance.now()-pending.at;});}
export function p4Install(){
  document.addEventListener('click',event=>{const el=event.target instanceof Element?event.target.closest('button,[data-board-page]'):null;
    if(!el||el.closest('[data-p4-toolbar]'))return;
    pending={label:el.getAttribute('aria-label')||el.getAttribute('data-asset')||el.textContent?.trim().slice(0,80)||'click',at:performance.now(),trusted:event.isTrusted};finishing=false;
    if(el.getAttribute('data-asset')?.startsWith('template:'))editorStart={asset:el.getAttribute('data-asset')??'',at:pending.at};
  },true);
  document.addEventListener('input',event=>{const el=event.target as Element;if(el.closest('[data-p4-toolbar]'))return;pending={label:el.getAttribute('aria-label')||'input',at:performance.now(),trusted:event.isTrusted};finishing=false;},true);
  new MutationObserver(changed).observe(document.getElementById('root')!,{childList:true,subtree:true,attributes:true,attributeFilter:['data-preview-state','data-board-page-active','data-focused','data-value','data-open','aria-pressed']});
  document.addEventListener('toggle',changed,true);
  try{new PerformanceObserver(list=>{p4.longTasks.push(...list.getEntries().map(e=>e.duration));}).observe({type:'longtask',buffered:false});}catch{}
  if(process.env.P4_DIAGNOSTICS){const original=Element.prototype.getBoundingClientRect;Element.prototype.getBoundingClientRect=function(){const at=performance.now();const r=original.call(this);p4.rectCalls++;p4.rectMs+=performance.now()-at;return r;};}
  p4Reset();
}
