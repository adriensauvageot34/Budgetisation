// Aggregate audit metadata only. Never emits credentials, predicates or financial rows.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
const [root,repo=process.cwd()]=process.argv.slice(2);
if(!root)throw new Error('AUDIT_OUTPUT_ROOT_REQUIRED');
const read=file=>JSON.parse(fs.readFileSync(file,'utf8'));
const events=dir=>fs.existsSync(dir)?fs.readdirSync(dir).filter(n=>/^server-.*\.jsonl$/.test(n)).flatMap(n=>fs.readFileSync(path.join(dir,n),'utf8').trim().split('\n').filter(Boolean).map(JSON.parse)):[];
function stats(values){const a=values.filter(Number.isFinite).sort((a,b)=>a-b);return a.length?{n:a.length,min:a[0],median:a.length%2?a[(a.length-1)/2]:(a[a.length/2-1]+a[a.length/2])/2,p95:a[Math.ceil(a.length*.95)-1],max:a.at(-1)}:null;}
function union(intervals){const sorted=intervals.filter(x=>x[1]>=x[0]).sort((a,b)=>a[0]-b[0]);let total=0,start=null,end;for(const [s,e]of sorted){if(start===null){start=s;end=e;}else if(s<=end)end=Math.max(end,e);else{total+=end-start;start=s;end=e;}}return total+(start===null?0:end-start);}
const browsers={};
for(const mode of ['hard','cold','warm','link','client','fixture-cold','fixture-hard']){
 const file=path.join(root,'browser-baseline',mode+'-runs.json');if(!fs.existsSync(file))continue;
 const runs=read(file),success=runs.filter(r=>!r.failed&&r.page);
 browsers[mode]={success:success.length,failures:runs.filter(r=>r.failed).map(r=>({run:r.run,error:r.failed,elapsed:r.wallEnd-r.wallStart})),
 tti:stats(success.map(r=>r.page.interactiveFromWall)),ttfb:stats(success.map(r=>mode==='client'?r.network.find(n=>n.type==='Fetch'&&n.path.includes('composer'))?.headersAt-r.network.find(n=>n.type==='Fetch'&&n.path.includes('composer'))?.start:r.page.navigation?.responseStart)),
 board:stats(success.map(r=>r.page.audit.marks.board-(r.page.clientStart??0))),hydrated:stats(success.map(r=>r.page.audit.marks.hydrated-(r.page.clientStart??0))),
 rows:success.map(r=>({run:r.run,tti:r.page.interactiveFromWall,board:r.page.audit.marks.board-(r.page.clientStart??0),hydrated:r.page.audit.marks.hydrated-(r.page.clientStart??0),requests:r.network.length,bytes:r.network.reduce((s,n)=>s+(n.encodedBytes??0),0),dom:r.page.dom,react:r.page.audit.react,longtasks:r.page.audit.longtasks.length,longtaskTotal:r.page.audit.longtasks.reduce((s,l)=>s+l.duration,0),longtaskMax:Math.max(0,...r.page.audit.longtasks.map(l=>l.duration)),resizeCount:r.page.audit.resizeCount,resizeMs:r.page.audit.resizeMs,cls:r.page.audit.shifts.reduce((s,l)=>s+l.value,0),interaction:r.page.interaction,errors:r.errors}))};
}
const owner=events(path.join(root,'owner-baseline')),spans=owner.filter(e=>e.type==='span'),fetches=owner.filter(e=>e.type==='fetch'),bodies=owner.filter(e=>e.type==='body');
const ids=new Map(spans.map(s=>[s.id,s]));
const roots=spans.filter(s=>s.name==='audit:complete-read-owner');
const businessBodies=bodies.filter(b=>b.path?.startsWith('/rest/v1/'));
function groupFetch(es){const groups=new Map();for(const e of es){const key=e.path;const g=groups.get(key)??{path:key,count:0,durations:[],rows:0,bytes:0,statuses:{},exact:new Set(),callSites:new Set()};g.count++;g.durations.push(e.headerDuration??e.end-e.start);g.statuses[e.status??e.error]=(g.statuses[e.status??e.error]??0)+1;g.exact.add(e.exact);g.callSites.add(e.callSite);const b=bodies.find(b=>b.id===e.id);g.rows+=b?.rows??0;g.bytes+=b?.bytes??0;groups.set(key,g);}return [...groups.values()].map(g=>({...g,mean:g.durations.reduce((s,n)=>s+n,0)/g.count,total:g.durations.reduce((s,n)=>s+n,0),stats:stats(g.durations),exact:g.exact.size,callSites:[...g.callSites],durations:undefined})).sort((a,b)=>b.count-a.count);}
const ownerReport={roots:roots.map(root=>({duration:root.duration,spanCount:spans.filter(e=>e.root===root.id).length,fetchCount:fetches.filter(e=>e.root===root.id).length})),
 slowSpans:spans.filter(s=>s.duration>100).map(s=>({name:s.name,duration:s.duration,selfWall:s.duration-union(spans.filter(c=>c.parent===s.id).map(c=>[Math.max(c.start,s.start),Math.min(c.end,s.end)])),parent:ids.get(s.parent)?.name})).sort((a,b)=>b.duration-a.duration).slice(0,80),
 counts:Object.fromEntries([...new Set(spans.map(s=>s.name))].filter(n=>/compileSemantic|deriveMonth|forecastRemaining|buildPlanning|readActivePlan|evaluatePlan|resolveGlobalM7|PredictionEvidence/.test(n)).map(n=>[n,spans.filter(s=>s.name===n).length])),
 bodies:{rows:businessBodies.reduce((s,b)=>s+(b.rows??0),0),bytes:businessBodies.reduce((s,b)=>s+(b.bytes??0),0),measurementOverhead:bodies.reduce((s,b)=>s+(b.measureOverhead??0),0)},fetches:groupFetch(fetches.filter(f=>f.business)),payload:owner.filter(e=>e.type==='payload')};
const experimentDir=path.join(root,'experiments'),experiments={};
if(fs.existsSync(experimentDir))for(const name of fs.readdirSync(experimentDir)){
 const file=path.join(experimentDir,name,'owner-runs.json');if(!fs.existsSync(file))continue;const rows=read(file),es=events(path.dirname(file));const mobility=es.filter(e=>e.type==='span'&&e.name==='audit:mobility-context-builder');
 experiments[name]={duration:stats(rows.filter(r=>!r.error).map(r=>r.duration)),mobility:stats(mobility.map(s=>s.duration)),rows,fetchCount:es.filter(e=>e.type==='fetch').length,blocked:es.filter(e=>e.blocked).length,errors:es.filter(e=>e.error),counts:Object.fromEntries([...new Set(es.filter(e=>e.type==='span').map(e=>e.name))].filter(n=>/compileSemantic|deriveMonth/.test(n)).map(n=>[n,es.filter(e=>e.name===n).length]))};
}
const chunks=path.join(repo,'.next/static/chunks'),bundle=fs.existsSync(chunks)?fs.readdirSync(chunks).filter(n=>/\.(js|css)$/.test(n)).map(n=>{const b=fs.readFileSync(path.join(chunks,n));return {name:n,bytes:b.length,gzip:zlib.gzipSync(b).length};}).sort((a,b)=>b.bytes-a.bytes):[];
const summary={generatedAt:new Date().toISOString(),browsers,owner:ownerReport,experiments,bundle};
fs.writeFileSync(path.join(root,'public-summary.json'),JSON.stringify(summary,null,2));
console.log(JSON.stringify({browsers:Object.fromEntries(Object.entries(browsers).map(([k,v])=>[k,{success:v.success,failures:v.failures,tti:v.tti,board:v.board}])),owner:{duration:ownerReport.roots,bodies:ownerReport.bodies,counts:ownerReport.counts},experiments:Object.fromEntries(Object.entries(experiments).map(([k,v])=>[k,{duration:v.duration,mobility:v.mobility,errors:v.errors.length,work:v.rows[0]?.work}]))},null,2));
