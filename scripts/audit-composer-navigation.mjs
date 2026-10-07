// Controlled native Chromium interactions; diagnostic output never includes cookies.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
const [connectionFile,planFile,out]=process.argv.slice(2);
if(!connectionFile||!planFile||!out)throw new Error('CONNECTION_PLAN_OUTPUT_REQUIRED');
const connection=JSON.parse(fs.readFileSync(connectionFile,'utf8')),plan=JSON.parse(fs.readFileSync(planFile,'utf8'));
fs.mkdirSync(out,{recursive:true});
class CDP {
 constructor(url){this.socket=new WebSocket(url);this.seq=0;this.pending=new Map();this.events=()=>{};this.ready=new Promise((r,j)=>{this.socket.onopen=r;this.socket.onerror=j});
  this.socket.onmessage=e=>{const m=JSON.parse(e.data),p=this.pending.get(m.id);if(p){this.pending.delete(m.id);clearTimeout(p.timer);m.error?p.reject(new Error(p.method+':'+m.error.message)):p.resolve(m.result)}else this.events(m)};}
 async send(method,params={},sessionId){await this.ready;return new Promise((resolve,reject)=>{const id=++this.seq,timer=setTimeout(()=>{this.pending.delete(id);reject(new Error('CDP_TIMEOUT:'+method))},180000);this.pending.set(id,{resolve,reject,timer,method});this.socket.send(JSON.stringify({id,method,params,...(sessionId?{sessionId}:{})}))})}
 close(){this.socket.close()}
}
const browser=new CDP(connection.endpoint);await browser.ready;
const cookies=(await browser.send('Storage.getCookies')).cookies; // Memory only.
const oldHarness=fs.readFileSync(new URL('./audit-composer-performance-browser.mjs',import.meta.url),'utf8');
const observer=oldHarness.match(/const observer=`([\s\S]*?)`;/)?.[1];assert.ok(observer,'Unchanged P2-A TTI observer required');
const pause=ms=>new Promise(r=>setTimeout(r,ms));
const actionIds={};
for(const variant of new Set(plan.trials.map(t=>t.variant))){const manifest=JSON.parse(fs.readFileSync(path.join(plan.runtimes[variant],'.next/server/server-reference-manifest.json'),'utf8'));
 actionIds[variant]=Object.entries(manifest.node).filter(([,v])=>v.exportedName==='previewMonthControlCenter').map(([id])=>id);assert.equal(actionIds[variant].length,1)}
let session,network=[],errors=[],blocked=0,allowedPost=0,requested=[];
const header=(headers,key)=>Object.entries(headers??{}).find(([k])=>k.toLowerCase()===key.toLowerCase())?.[1];
browser.events=async m=>{if(m.sessionId!==session)return;const p=m.params;
 if(m.method==='Fetch.requestPaused'){
  const u=new URL(p.request.url),business=u.hostname.endsWith('.supabase.co')&&/^\/(rest|storage)\/v1\//.test(u.pathname),method=p.request.method;
  const localPost=u.hostname==='localhost'&&!['GET','HEAD'].includes(method);
  const id=header(p.request.headers,'Next-Action'),known=Object.values(actionIds).flat().includes(id);
  const deny=business&&(!['GET','HEAD'].includes(method)||u.pathname.includes('/rpc/'))||localPost&&!(method==='POST'&&u.pathname==='/mois-a-venir'&&known);
  if(deny){blocked++;await browser.send('Fetch.failRequest',{requestId:p.requestId,errorReason:'BlockedByClient'},session)}else{if(localPost)allowedPost++;await browser.send('Fetch.continueRequest',{requestId:p.requestId},session)}
 }
 if(m.method==='Network.requestWillBeSent'){
  const u=new URL(p.request.url),h=p.request.headers;
  network.push({id:p.requestId,start:p.timestamp*1000,wall:p.wallTime*1000,path:u.pathname,month:u.searchParams.get('month'),host:u.hostname,method:p.request.method,type:p.type,
   rsc:header(h,'RSC')==='1',prefetch:header(h,'Next-Router-Prefetch')==='1',segmentPrefetch:!!header(h,'Next-Router-Segment-Prefetch'),action:!!header(h,'Next-Action'),initiator:p.initiator.type,chunks:[]});
 }
 if(m.method==='Network.responseReceived'){const n=network.findLast(n=>n.id===p.requestId);if(n)Object.assign(n,{headersAt:p.timestamp*1000,status:p.response.status,mime:p.response.mimeType,fromCache:!!(p.response.fromDiskCache||p.response.fromServiceWorker)})}
 if(m.method==='Network.dataReceived'){const n=network.findLast(n=>n.id===p.requestId);if(n)n.chunks.push({at:p.timestamp*1000,bytes:p.dataLength,encoded:p.encodedDataLength})}
 if(m.method==='Network.loadingFinished'){const n=network.findLast(n=>n.id===p.requestId);if(n)Object.assign(n,{end:p.timestamp*1000,encodedBytes:p.encodedDataLength})}
 if(m.method==='Network.loadingFailed'){const n=network.findLast(n=>n.id===p.requestId);if(n)Object.assign(n,{end:p.timestamp*1000,error:p.errorText,canceled:p.canceled})}
 if(m.method==='Runtime.exceptionThrown')errors.push({message:p.exceptionDetails.text,at:Date.now()});
};
const call=(method,params)=>browser.send(method,params,session);
const evaluate=async expression=>{const r=await call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw new Error(r.exceptionDetails.exception?.description??r.exceptionDetails.text);return r.result.value};
async function until(expression,label,timeout=240000){const start=Date.now();while(Date.now()-start<timeout){try{if(await evaluate(expression))return}catch{}await pause(100)}throw new Error(label+'_TIMEOUT')}
async function click(selector){const point=await evaluate(`(()=>{const b=document.querySelector(${JSON.stringify(selector)});if(!b)return null;const r=b.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()`);assert.ok(point,'Observed interaction target required');await call('Input.dispatchMouseEvent',{type:'mousePressed',...point,button:'left',clickCount:1});await call('Input.dispatchMouseEvent',{type:'mouseReleased',...point,button:'left',clickCount:1})}
async function serverProfiler(variant){const targets=await(await fetch(`http://127.0.0.1:${plan.inspectorPorts[variant]}/json/list`)).json(),c=new CDP(targets[0].webSocketDebuggerUrl);await c.ready;await c.send('Profiler.enable');await c.send('Profiler.start');return c}
async function serverCounters(variant){const targets=await(await fetch(`http://127.0.0.1:${plan.inspectorPorts[variant]}/json/list`)).json(),c=new CDP(targets[0].webSocketDebuggerUrl);await c.ready;return c}
async function cpu(c){return(await c.send('Runtime.evaluate',{expression:'({cpu:process.cpuUsage(),at:Date.now()})',returnByValue:true})).result.value}
const resultsFile=path.join(out,'runs.json'),results=fs.existsSync(resultsFile)?JSON.parse(fs.readFileSync(resultsFile,'utf8')):[];
assert.ok(results.length<=plan.trials.length);
assert.ok(results.every((r,i)=>!r.failed&&r.id===plan.trials[i].id),'Failed/inconsistent series must remain separate, never skipped on resume');
for(const trial of plan.trials.slice(results.length)){
 const base=plan.origins[trial.variant];let context,target,serverProfile,counters,started=Date.now();
 network=[];errors=[];blocked=0;allowedPost=0;let result={...trial,trialStart:started};
 try{
  if(plan.processCPU){counters=await serverCounters(trial.variant);result.serverCpuBefore=await cpu(counters)}
  context=(await browser.send('Target.createBrowserContext')).browserContextId;
  await browser.send('Storage.setCookies',{browserContextId:context,cookies:cookies.map(c=>({...c,url:undefined}))});
  target=(await browser.send('Target.createTarget',{url:'about:blank',browserContextId:context})).targetId;
  session=(await browser.send('Target.attachToTarget',{targetId:target,flatten:true})).sessionId;
  await call('Page.enable');await call('Runtime.enable');await call('Network.enable');await call('Performance.enable');
  await call('Emulation.setDeviceMetricsOverride',{width:1728,height:900,deviceScaleFactor:1,mobile:false});
  await call('Fetch.enable',{patterns:[{urlPattern:'*'}]});await call('Page.addScriptToEvaluateOnNewDocument',{source:observer});
  if(trial.profile){serverProfile=await serverProfiler(trial.variant);await call('Profiler.enable');await call('Profiler.start')}
  let composerUrl=base+'/mois-a-venir/composer?month='+plan.month;
  if(trial.mode==='client'||trial.mode==='center'){
   await call('Page.navigate',{url:base+'/mois-a-venir?month='+plan.month});
   await until('(()=>{const b=document.querySelector("[data-month-control-trigger]");return !!b&&Object.keys(b).some(k=>k.startsWith("__reactProps$"))})()','CENTRE_HYDRATION');
   result.centreReady=Date.now();
   const href=await evaluate('(()=>{const a=[...document.querySelectorAll("a")].find(a=>a.getAttribute("href")?.includes("/mois-a-venir/composer"));return a?.getAttribute("href")})()');assert.ok(href);composerUrl=new URL(href,base).href;
   assert.equal(new URL(composerUrl).searchParams.get('month'),plan.month,'Same requested month in all paths');
   result.centreOpen=Date.now();await click('[data-month-control-trigger]');await until('!!document.querySelector("[data-control-hub=pilot]")','PILOT_VISIBLE');
   result.pilotVisibleAt=Date.now();
   const centreText=await evaluate('document.querySelector("[data-control-content]")?.textContent??""');
   result.centreInitialUiDigest=crypto.createHash('sha256').update(centreText).digest('hex');
   if(trial.centerInteraction)await click('[data-control-hub=savings]');
   await pause(trial.clickDelayMs??100); // Predeclared path; no wait for a rapid preview.
   if(trial.waitPreview){const wait=Date.now();while(Date.now()-wait<180000){const post=network.find(n=>n.method==='POST'&&n.path==='/mois-a-venir');if(post?.end)break;await pause(100)}
    assert.ok(network.some(n=>n.method==='POST'&&n.path==='/mois-a-venir'&&n.end),'Completed preview required for quiet control');await pause(500)}
   await evaluate(`window.__auditClientStart=performance.now();${observer}`);
  }
  result.clickAt=Date.now();result.composerUrl=new URL(composerUrl).pathname+'?month='+plan.month;
  if(trial.mode==='center'){
   const text=await evaluate('document.querySelector("[data-control-content]")?.textContent??""');
   result.centreFinalUiDigest=crypto.createHash('sha256').update(text).digest('hex');
   result.interactiveAt=Date.now();result.tti=result.interactiveAt-result.centreOpen;result.endToEnd=result.interactiveAt-result.trialStart;
   result.page=await evaluate('({audit:window.__audit,timeOrigin:performance.timeOrigin,viewport:{width:innerWidth,height:innerHeight}})');
   result.interaction={empty:true,centerStayed:true,changedView:!!trial.centerInteraction};
  }else{
  if(trial.mode==='client')await click('[data-control-hub=pilot]');else await call('Page.navigate',{url:composerUrl});
  await until('!!document.querySelector("[data-composer]")&&!!window.__audit?.marks.hydrated','COMPOSER_READY');
  await click('[data-library] input');await call('Input.insertText',{text:'zzzz-perf'});await pause(80);
  const interaction=await evaluate('(()=>{const i=document.querySelector("[data-library] input");return{value:i?.value,empty:document.querySelector("[data-library]")?.textContent.includes("Aucun"),matches:document.querySelectorAll("[data-library] [data-library-asset]").length}})()');
  await call('Input.dispatchKeyEvent',{type:'keyDown',key:'a',code:'KeyA',modifiers:2});await call('Input.dispatchKeyEvent',{type:'keyUp',key:'a',code:'KeyA',modifiers:2});await call('Input.dispatchKeyEvent',{type:'keyDown',key:'Backspace',code:'Backspace'});await call('Input.dispatchKeyEvent',{type:'keyUp',key:'Backspace',code:'Backspace'});
  result.interactiveAt=Date.now();result.tti=result.interactiveAt-result.clickAt;result.endToEnd=result.interactiveAt-result.trialStart;
  result.page=await evaluate('({audit:window.__audit,timeOrigin:performance.timeOrigin,clientStart:window.__auditClientStart??0,navigation:performance.getEntriesByType("navigation")[0]?.toJSON(),viewport:{width:innerWidth,height:innerHeight},dom:document.querySelectorAll("*").length,fonts:document.fonts.status})');
  result.interaction=interaction;assert.ok(interaction.empty,'Unchanged native Library interaction must complete');
  }
  if(counters)result.serverCpuAfter=await cpu(counters);
  if(trial.profile){const b=(await call('Profiler.stop')).profile;fs.writeFileSync(path.join(out,trial.id+'-browser.cpuprofile'),JSON.stringify(b));const p=(await serverProfile.send('Profiler.stop')).profile;fs.writeFileSync(path.join(out,trial.id+'-server.cpuprofile'),JSON.stringify(p))}
  // Keep all background requests in the trace and give them time to finish.
  const drain=Date.now();while(Date.now()-drain<15000&&network.some(n=>!n.end))await pause(100);
  result.drainTimeout=network.some(n=>!n.end);
 }catch(e){result.failed=e.message}
 finally{
  if(result.failed&&trial.profile){
   try{const p=(await call('Profiler.stop')).profile;fs.writeFileSync(path.join(out,trial.id+'-failed-browser.cpuprofile'),JSON.stringify(p))}catch{}
   if(serverProfile)try{const p=(await serverProfile.send('Profiler.stop')).profile;fs.writeFileSync(path.join(out,trial.id+'-failed-server.cpuprofile'),JSON.stringify(p))}catch{}
  }
  serverProfile?.close();counters?.close();result.trialEnd=Date.now();result.network=network;result.errors=errors;result.blocked=blocked;result.allowedPost=allowedPost;
  results.push(result);fs.writeFileSync(resultsFile,JSON.stringify(results,null,2)+'\n');
  console.log(JSON.stringify({id:trial.id,variant:trial.variant,mode:trial.mode,waitPreview:trial.waitPreview,tti:result.tti,failed:result.failed??null,allowedPost,blocked}));
  if(context)await browser.send('Target.disposeBrowserContext',{browserContextId:context});session=null;await pause(500);
 }
 if(result.failed||blocked||errors.length)throw new Error('TRIAL_FAILED_TRACE_PRESERVED:'+trial.id);
}
browser.close();
