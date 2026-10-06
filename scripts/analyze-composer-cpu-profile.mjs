// Linear-time CPU profile summary. Optional owner window excludes TS-loader startup.
import fs from 'node:fs';
const [file,output,eventsFile]=process.argv.slice(2);if(!file||!output)throw new Error('PROFILE_AND_OUTPUT_REQUIRED');
const p=JSON.parse(fs.readFileSync(file,'utf8')),nodes=new Map(p.nodes.map(n=>[n.id,n])),parents=new Map();
for(const n of p.nodes)for(const id of n.children??[])parents.set(id,n.id);
let window=null,offset=0;
if(eventsFile){const events=fs.readFileSync(eventsFile,'utf8').trim().split('\n').map(JSON.parse),start=events.find(e=>e.type==='startup'),owner=events.find(e=>e.type==='span'&&e.name==='audit:complete-read-owner');if(!start?.hrtimeMicro||!owner)throw new Error('PROFILE_ALIGNMENT_REQUIRED');offset=start.epoch-start.hrtimeMicro/1000;window=[owner.start,owner.end];}
const classes=new Map();
function classify(id){if(classes.has(id))return classes.get(id);const frame=nodes.get(id)?.callFrame;let c=null;
 if(frame?.url?.includes('/global-v2/mobility-context'))c='M7 + descendants';
 else if(frame?.functionName==='parseHouseholdTimeZone')c='Timezone validator + descendants';
 else if(frame?.url?.includes('/10u3y4bw1ayzs.js'))c='React DOM chunk + descendants';
 else if(parents.has(id))c=classify(parents.get(id));
 classes.set(id,c);return c;}
const groups=new Map(),buckets={};let micro=p.startTime,included=0;
for(let i=0;i<(p.samples?.length??0);i++){
 const delta=p.timeDeltas[i]??0;micro+=delta;const epoch=micro/1000+offset;if(window&&(epoch<window[0]||epoch>window[1]))continue;
 included+=delta;const f=nodes.get(p.samples[i])?.callFrame;if(!f)continue;
 const key=f.functionName+'|'+f.url,g=groups.get(key)??{name:f.functionName,url:f.url,ms:0};g.ms+=delta/1000;groups.set(key,g);
 const c=classify(p.samples[i])??(['(idle)','(garbage collector)','(program)'].includes(f.functionName)?f.functionName:'Other CPU');buckets[c]=(buckets[c]??0)+delta/1000;
}
const result={window,profileDuration:(p.endTime-p.startTime)/1000,sampledMs:included/1000,buckets,top:[...groups.values()].sort((a,b)=>b.ms-a.ms).slice(0,35)};
fs.writeFileSync(output,JSON.stringify(result,null,2));console.log(JSON.stringify({...result,top:result.top.slice(0,12)},null,2));
