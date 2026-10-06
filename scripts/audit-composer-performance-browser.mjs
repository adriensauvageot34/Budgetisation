// Private Chromium CDP audit. Stores no cookies, credentials or response bodies.
import fs from 'node:fs';
import path from 'node:path';
import {spawn} from 'node:child_process';
const [endpoint,targetId,out,base='http://localhost:3117',mode='hard',countText='5',coldServerRepo]=process.argv.slice(2);
if(!endpoint||!targetId||!out)throw new Error('endpoint targetId output base mode count required');
fs.mkdirSync(out,{recursive:true});
const socket=new WebSocket(endpoint); await new Promise((resolve,reject)=>{socket.onopen=resolve;socket.onerror=reject;});
let seq=0,session, pending=new Map(), network=[], errors=[], blocked=0;
function send(method,params={},sessionId=session){return new Promise((resolve,reject)=>{const id=++seq;const timer=setTimeout(()=>{pending.delete(id);reject(new Error('CDP_METHOD_TIMEOUT:'+method));},30000);pending.set(id,{resolve:v=>{clearTimeout(timer);resolve(v)},reject:e=>{clearTimeout(timer);reject(e)},method});socket.send(JSON.stringify({id,method,params,...(sessionId?{sessionId}:{})}));});}
socket.onmessage=async event=>{
  const data=JSON.parse(event.data);
  if(data.id){const p=pending.get(data.id);pending.delete(data.id);if(data.error)p?.reject(new Error(p.method+': '+JSON.stringify(data.error)));else p?.resolve(data.result);return;}
  if(data.sessionId!==session)return;
  const p=data.params;
  if(data.method==='Fetch.requestPaused'){
    const u=new URL(p.request.url), business=u.hostname.endsWith('.supabase.co')&&/^\/(rest|storage)\/v1\//.test(u.pathname), deny=business&&(!['GET','HEAD'].includes(p.request.method)||u.pathname.includes('/rpc/'));
    if(deny){blocked++;await send('Fetch.failRequest',{requestId:p.requestId,errorReason:'BlockedByClient'});}else await send('Fetch.continueRequest',{requestId:p.requestId});
  }
  if(data.method==='Network.requestWillBeSent'){
    const u=new URL(p.request.url);network.push({id:p.requestId,start:p.timestamp*1000,wall:p.wallTime*1000,path:u.pathname,host:u.hostname,method:p.request.method,type:p.type,initiator:p.initiator.type});
  }
  if(data.method==='Network.responseReceived'){const r=network.findLast(r=>r.id===p.requestId);if(r)Object.assign(r,{headersAt:p.timestamp*1000,status:p.response.status,mime:p.response.mimeType,fromCache:p.response.fromDiskCache||p.response.fromServiceWorker});}
  if(data.method==='Network.loadingFinished'){const r=network.findLast(r=>r.id===p.requestId);if(r)Object.assign(r,{end:p.timestamp*1000,encodedBytes:p.encodedDataLength});}
  if(data.method==='Network.loadingFailed'){const r=network.findLast(r=>r.id===p.requestId);if(r)Object.assign(r,{end:p.timestamp*1000,error:p.errorText});}
  if(data.method==='Runtime.exceptionThrown')errors.push({time:Date.now(),message:p.exceptionDetails.text});
};
const observer=`(()=>{
  window.__audit={longtasks:[],shifts:[],marks:{},react:{},resizeCount:0,resizeMs:0};
  window.__composerAuditRenders={};
  // Fiber flags below are raw diagnostics only. Render counts use function-entry
  // counters in the isolated fixture; PerformedWork can persist across bailouts.
  if(!window.__REACT_DEVTOOLS_GLOBAL_HOOK__)window.__REACT_DEVTOOLS_GLOBAL_HOOK__={supportsFiber:true,renderers:new Map(),inject(renderer){const id=this.renderers.size+1;this.renderers.set(id,renderer);return id},onCommitFiberRoot(id,root){
    const a=window.__audit;a.react.commits=(a.react.commits??0)+1;a.react.lastCommit=performance.now();
    function walk(f){if(!f)return;const name=typeof f.type==='function'?(f.type.displayName||f.type.name):null;if(name&&(f.flags&1)){a.react[name]=(a.react[name]??0)+1;}walk(f.child);walk(f.sibling)}walk(root.current);
  },onCommitFiberUnmount(){},onPostCommitFiberRoot(){}};
  const OriginalResize=window.ResizeObserver;
  window.ResizeObserver=class extends OriginalResize {constructor(cb){super((...args)=>{const t=performance.now();window.__audit.resizeCount++;try{return cb(...args)}finally{window.__audit.resizeMs+=performance.now()-t}})}};
  for(const type of ['longtask','layout-shift'])try{new PerformanceObserver(list=>{for(const e of list.getEntries())type==='longtask'?window.__audit.longtasks.push({start:e.startTime,duration:e.duration}):window.__audit.shifts.push({start:e.startTime,value:e.value})}).observe({type,buffered:true})}catch{}
  const poll=()=>{
    const c=document.querySelector('[data-composer]'),b=document.querySelector('[data-board-scroll]');
    if(c&&b&&!window.__audit.marks.board&&b.getBoundingClientRect().height>0){window.__audit.marks.board=performance.now();window.__audit.domAtBoard=document.querySelectorAll('*').length;window.__audit.clayAtBoard=document.querySelectorAll('[data-clay-icon]').length;window.__audit.rendersAtBoard={...window.__composerAuditRenders};}
    if(c&&!window.__audit.marks.hydrated){const button=c.querySelector('button');if(button&&Object.keys(button).some(k=>k.startsWith('__reactProps$')))window.__audit.marks.hydrated=performance.now();}
    if(!window.__audit.marks.hydrated)requestAnimationFrame(poll);
  };requestAnimationFrame(poll);
})()`;
async function attach(id){if(session)try{await send('Target.detachFromTarget',{sessionId:session},null);}catch{}session=(await send('Target.attachToTarget',{targetId:id,flatten:true},null)).sessionId;
  await send('Page.enable');await send('Runtime.enable');await send('Network.enable');await send('Performance.enable');
  await send('Emulation.setDeviceMetricsOverride',{width:1728,height:900,deviceScaleFactor:1,mobile:false});
  await send('Fetch.enable',{patterns:[{urlPattern:'*supabase.co*'}]});
  await send('Page.addScriptToEvaluateOnNewDocument',{source:observer});
}
await attach(targetId);
const evaluate=async expression=>{const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw new Error(r.exceptionDetails.text);return r.result.value;};
const pause=ms=>new Promise(r=>setTimeout(r,ms));
async function ready(timeout=240000){const start=Date.now();while(Date.now()-start<timeout){try{if(await evaluate('!!document.querySelector("[data-composer]") && !!window.__audit?.marks.hydrated'))return;}catch{}await pause(400);}throw new Error('COMPOSER_READY_TIMEOUT');}
async function click(selector){const point=await evaluate(`(()=>{const b=document.querySelector(${JSON.stringify(selector)});if(!b)return null;const r=b.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`);if(!point)throw new Error('INTERACTION_TARGET_MISSING');await send('Input.dispatchMouseEvent',{type:'mousePressed',...point,button:'left',clickCount:1});await send('Input.dispatchMouseEvent',{type:'mouseReleased',...point,button:'left',clickCount:1});}
const results=[], count=Number(countText);
if(mode==='client' && fs.existsSync(path.join(out,mode+'-runs.json')))results.push(...JSON.parse(fs.readFileSync(path.join(out,mode+'-runs.json'),'utf8')));
const cookies=(await send('Network.getCookies',{urls:[base]})).cookies; // in memory only
for(let run=results.length+1;run<=count;run++){
  let contextId,server;
  if(mode==='cold'&&coldServerRepo){
    server=spawn(process.execPath,[path.join(coldServerRepo,'node_modules/next/dist/bin/next'),'start','-p',new URL(base).port],{cwd:coldServerRepo,windowsHide:true,stdio:'ignore',env:{...process.env,NODE_OPTIONS:'--require '+path.join(coldServerRepo,'scripts/lib/composer-performance-probe.cjs'),COMPOSER_PERF_OUTPUT:path.join(out,'server'),COMPOSER_PERF_PRIVATE_QUERIES:'1'}});
    let listening=false;for(let i=0;i<150;i++){try{listening=(await fetch(base+'/connexion',{method:'HEAD'})).ok;}catch{}if(listening)break;await pause(200);}if(!listening)throw new Error('SERVER_START_TIMEOUT');
  }
  if(mode==='cold'||mode==='fixture-cold'){
    contextId=(await send('Target.createBrowserContext',{},null)).browserContextId;
    const id=(await send('Target.createTarget',{url:'about:blank',browserContextId:contextId},null)).targetId;
    await attach(id);await send('Network.setCookies',{cookies});
  }
  if(mode==='warm'||mode==='client'){
    await send('Page.navigate',{url:base+'/mois-a-venir'});
    let parentReady=false;for(let i=0;i<600;i++){try{parentReady=await evaluate('!![...document.querySelectorAll("button,a")].find(b=>/Piloter mon mois|Composer mon mois/.test(b.textContent))');}catch{}if(parentReady)break;await pause(400);}if(!parentReady)throw new Error('PARENT_READY_TIMEOUT');
    if(mode==='client'){
      let parentHydrated=false;for(let i=0;i<200;i++){parentHydrated=await evaluate('(()=>{const b=document.querySelector("[data-month-control-trigger]");return !!b&&Object.keys(b).some(k=>k.startsWith("__reactProps$"))})()');if(parentHydrated)break;await pause(100);}if(!parentHydrated)throw new Error('PARENT_HYDRATION_TIMEOUT');
      await click('[data-month-control-trigger]');
      let pilotReady=false;for(let i=0;i<100;i++){pilotReady=await evaluate('!!document.querySelector("[data-control-hub=pilot]")');if(pilotReady)break;await pause(100);}if(!pilotReady)throw new Error('PILOT_BUTTON_MISSING');
    }
  }
  network=[];errors=[];const wallStart=Date.now();
  await send('Profiler.enable');if(run===1)await send('Profiler.start');
  if(mode==='client'){
    await evaluate(`window.__auditClientStart=performance.now();${observer}`);
    await click('[data-control-hub=pilot]');
  }else if(mode==='hard'||mode==='fixture-hard'&&run>1)await send('Page.reload',{ignoreCache:true});
  else if(mode.startsWith('fixture'))await send('Page.navigate',{url:base+'/?scenario=VISUAL'});
  else await send('Page.navigate',{url:base+'/mois-a-venir/composer'});
  let failed=null;try{await ready();}catch(e){failed=e.message;}
  let page=null;
  if(!failed){
    await click('[data-library] input'); await send('Input.insertText',{text:'zzzz-perf'});await pause(80);
    const reacts=await evaluate(`(()=>{const i=document.querySelector('[data-library] input');return {value:i?.value,empty:document.querySelector('[data-library]')?.textContent.includes('Aucun'),matches:document.querySelectorAll('[data-library] [data-library-asset]').length}})()`);
    await send('Input.dispatchKeyEvent',{type:'keyDown',key:'a',code:'KeyA',modifiers:2});await send('Input.dispatchKeyEvent',{type:'keyUp',key:'a',code:'KeyA',modifiers:2});await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Backspace',code:'Backspace'});await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Backspace',code:'Backspace'});
    const interactiveWall=Date.now();
    page=await evaluate(`(()=>{const a=window.__audit,n=performance.getEntriesByType('navigation')[0];return {audit:a,timeOrigin:performance.timeOrigin,clientStart:window.__auditClientStart??0,navigation:n?.toJSON(),paints:performance.getEntriesByType('paint').map(e=>e.toJSON()),resources:performance.getEntriesByType('resource').map(e=>({path:new URL(e.name).pathname,initiator:e.initiatorType,start:e.startTime,duration:e.duration,transfer:e.transferSize,encoded:e.encodedBodySize,decoded:e.decodedBodySize})),dom:document.querySelectorAll('*').length,clay:document.querySelectorAll('[data-clay-icon]').length,cards:document.querySelectorAll('[data-inventory-id]').length,react:window.__composerAuditRenders??{},fonts:document.fonts.status}})()`);
    page.interaction=reacts;page.interactiveFromWall=interactiveWall-wallStart;
    page.dataReady=await evaluate('window.__composerAuditDataReady??null');
    page.viewport=await evaluate('({width:innerWidth,height:innerHeight,boardHeight:document.querySelector("[data-board-scroll]")?.getBoundingClientRect().height})');
  }
  const profile=run===1?(await send('Profiler.stop')).profile:null;
  if(profile)fs.writeFileSync(path.join(out,mode+'-cpu.json'),JSON.stringify(profile));
  const result={mode,run,wallStart,wallEnd:Date.now(),failed,page,network,errors,blocked};results.push(result);
  fs.writeFileSync(path.join(out,mode+'-runs.json'),JSON.stringify(results,null,2));console.log(JSON.stringify({mode,run,failed,duration:Date.now()-wallStart,board:page?.audit.marks.board,hydrated:page?.audit.marks.hydrated,requests:network.length}));
  if(contextId) {await send('Target.disposeBrowserContext',{browserContextId:contextId},null);await attach(targetId);}
  if(server) {server.kill();await pause(300);}
}
socket.close();
