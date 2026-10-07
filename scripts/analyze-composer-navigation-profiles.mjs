// Same-clock profile windows; source-map labels contain no source contents or facts.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';
import { AnyMap, originalPositionFor } from '@jridgewell/trace-mapping';
const root=process.argv[2];if(!root)throw new Error('AUDIT_ROOT_REQUIRED');
const runs=JSON.parse(fs.readFileSync(path.join(root,'controlled/runs.json'),'utf8'));
const maps=new Map();
function source(frame){
 let original=null;
 if(frame.url.startsWith('file:')&&frame.lineNumber>=0){
  const file=fileURLToPath(frame.url)+'.map';
  if(!maps.has(file))maps.set(file,fs.existsSync(file)?AnyMap(JSON.parse(fs.readFileSync(file,'utf8')),pathToFileURL(file).href):null);
  const map=maps.get(file);if(map)original=originalPositionFor(map,{line:frame.lineNumber+1,column:frame.columnNumber});
 }
 let label=decodeURIComponent(original?.source??frame.url).replaceAll('\\','/');
 if(label.includes('/node_modules/'))label='node_modules/'+label.split('/node_modules/').at(-1);
 else if(label.includes('/src/'))label='src/'+label.split('/src/').at(-1);
 else if(label.startsWith('file:'))label=label.includes('/scripts/')?'scripts/'+label.split('/scripts/').at(-1):path.basename(label);
 else label=label.replace(/^http:\/\/localhost:\d+/, '<local>');
 return{source:label,name:original?.name??frame.functionName,line:original?.line??frame.lineNumber+1,mapped:!!original?.source};
}
function summarize(profile,offset,window){
 const nodes=new Map(profile.nodes.map(n=>[n.id,n])),parents=new Map(),frames=new Map();
 for(const n of profile.nodes){frames.set(n.id,source(n.callFrame));for(const child of n.children??[])parents.set(child,n.id)}
 const classes=new Map();
 function classify(id){if(classes.has(id))return classes.get(id);const frame=frames.get(id);let c=null;
  if(frame?.source==='src/analytics/global-v2/mobility-context.ts')c='M7 + descendants';
  else if(frame?.source.includes('household-timezone'))c='Household timezone + descendants';
  else if(parents.has(id))c=classify(parents.get(id));classes.set(id,c);return c;
 }
 let micro=profile.startTime,included=0,mapped=0;const buckets={},groups=new Map();
 for(let i=0;i<profile.samples.length;i++){
  const delta=profile.timeDeltas[i]??0;micro+=delta;const epoch=micro/1000+offset;
  if(epoch<window[0]||epoch>window[1])continue;
  included+=delta;const id=profile.samples[i],frame=frames.get(id);if(!frame)continue;
  if(frame.mapped)mapped+=delta;
  const key=frame.name+'|'+frame.source,entry=groups.get(key)??{name:frame.name,source:frame.source,ms:0};entry.ms+=delta/1000;groups.set(key,entry);
  const special=nodes.get(id).callFrame.functionName;
  const c=classify(id)??(['(idle)','(garbage collector)','(program)'].includes(special)?special:'Other sampled CPU');buckets[c]=(buckets[c]??0)+delta/1000;
 }
 assert.ok(included>0,'Profile must intersect measured clock window');
 return{window,wallMs:window[1]-window[0],sampledMs:included/1000,mappedSelfSampleMs:mapped/1000,buckets,top:[...groups.values()].sort((a,b)=>b.ms-a.ms).slice(0,15)};
}
const result={schema:'composer-navigation-profiles@1',note:'One profiled run per variant, retained in the main latency series. Sampled time is not a sum of request wall times. Server profile covers the whole process, including any concurrent V2 action, GC and audit overhead. Source-mapped M7 subtree uses ancestry; other minified frames are not assigned guessed names. Browser (program) includes native/unattributed work. Browser production maps are absent.',profiles:[]};
for(const variant of ['a','b']){
 const run=runs.find(r=>r.variant===variant&&r.profile&&!r.failed);assert.ok(run?.profile);
 const files=fs.readdirSync(path.join(root,'server-'+variant)).filter(f=>/^server-.*\.jsonl$/.test(f));
 const events=files.flatMap(f=>fs.readFileSync(path.join(root,'server-'+variant,f),'utf8').trim().split('\n').filter(Boolean).map(JSON.parse));
 const owner=events.find(e=>e.type==='http'&&e.name==='http:GET:/mois-a-venir/composer'&&e.start>=run.clickAt-100&&e.start<=run.interactiveAt);
 const startup=events.find(e=>e.type==='startup'&&e.pid===owner?.pid);assert.ok(startup?.hrtimeMicro);
 for(const kind of ['server','browser']){
  const filename=run.id+'-'+kind+'.cpuprofile';
  const directory=fs.existsSync(path.join(root,'controlled',filename))?'controlled':variant==='a'?'before':'after';
  const profile=JSON.parse(fs.readFileSync(path.join(root,directory,filename),'utf8'));
  const offset=kind==='server'?startup.epoch-startup.hrtimeMicro/1000:run.network[0].wall-run.network[0].start;
  result.profiles.push({variant,kind,fullProfileMs:(profile.endTime-profile.startTime)/1000,client:summarize(profile,offset,[run.clickAt,run.interactiveAt]),beforeClick:summarize(profile,offset,[run.trialStart,run.clickAt])});
 }
}
fs.writeFileSync(path.join(root,'profile-summary.json'),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result.profiles.map(p=>({variant:p.variant,kind:p.kind,client:p.client.buckets,top:p.client.top.slice(0,5)}))));
