// Public hashes, counts and timing only. Raw facts, cookies and query values excluded.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
const root=process.argv[2];if(!root)throw new Error('AUDIT_ROOT_REQUIRED');
const read=f=>JSON.parse(fs.readFileSync(path.join(root,f),'utf8'));
const stats=v=>{const a=v.filter(Number.isFinite).sort((a,b)=>a-b),n=a.length;return n?{n,min:a[0],median:n%2?a[(n-1)/2]:(a[n/2-1]+a[n/2])/2,max:a.at(-1),p95:a[Math.ceil(n*.95)-1]}:null};
const hash=v=>crypto.createHash('sha256').update(JSON.stringify(v)).digest('hex');
const queryProfile=es=>[...new Set(es.map(e=>e.path))].sort().map(path=>{const found=es.filter(e=>e.path===path);return{path,count:found.length,headersMs:stats(found.map(e=>e.headerDuration))}});
const traces={},http={},queries={};
for(const variant of ['a','b']){
 const dir=path.join(root,'server-'+variant),files=fs.readdirSync(dir),load=f=>fs.readFileSync(path.join(dir,f),'utf8').trim().split('\n').filter(Boolean).map(JSON.parse);
 traces[variant]=files.filter(f=>/^server-.*\.jsonl$/.test(f)).flatMap(load);
 http[variant]=files.filter(f=>/^navigation-.*\.jsonl$/.test(f)).flatMap(load);
 queries[variant]=new Map();for(const f of files.filter(f=>/^private-queries-.*\.jsonl$/.test(f))){const pid=Number(f.match(/\d+/)[0]);for(const q of load(f))queries[variant].set(`${pid}:${q.id}`,q)}
}
function parallel(intervals,start,end){const edges=intervals.flatMap(r=>[[Math.max(start,r.start),1],[Math.min(end,r.end),-1]]).filter(([x])=>x>=start&&x<=end).sort((a,b)=>a[0]-b[0]||a[1]-b[1]);let active=0,max=0,last=start,atLeastTwo=0,occupied=0;
 for(const[x,d]of edges){if(active>=2)atLeastTwo+=x-last;if(active>=1)occupied+=x-last;active+=d;max=Math.max(max,active);last=x}return{max,atLeastTwo,occupied}}
const controlled=read('controlled/runs.json');
const supplemental=fs.existsSync(path.join(root,'supplementary-runs.json'))?read('supplementary-runs.json').map(r=>({...r,id:r.id+'-unpaired',supplemental:true})):[];
const runs=[...controlled,...supplemental],rows=[];
for(const run of runs){
 if(run.failed){rows.push({id:run.id,variant:run.variant,failed:run.failed});continue}
 const events=traces[run.variant],roots=events.filter(e=>e.type==='http'&&e.start>=run.trialStart-100&&e.start<=run.trialEnd),within=events.filter(e=>e.start>=run.trialStart-100&&e.start<=run.trialEnd);
 const composer=roots.find(e=>e.name==='http:GET:/mois-a-venir/composer'),preview=roots.find(e=>e.name==='http:POST:/mois-a-venir'),centre=roots.find(e=>e.name==='http:GET:/mois-a-venir');
 const descendants=r=>r?events.filter(e=>e.pid===r.pid&&e.root===r.id):[];
 const gets=r=>descendants(r).filter(e=>e.type==='fetch'&&e.business&&e.method==='GET');
 const getEvents=within.filter(e=>e.type==='fetch'&&e.business&&e.method==='GET');
 const boundaries=getEvents.map(e=>({start:e.start,end:events.find(b=>b.type==='body'&&b.id===e.id&&b.pid===e.pid)?.end??e.headersAt??e.end})).filter(e=>Number.isFinite(e.end));
 const overlap=preview&&composer?Math.max(0,Math.min(preview.end,composer.end)-Math.max(preview.start,composer.start)):0;
 const cg=gets(composer),pg=gets(preview);
 let dynamicCutoffs=0;
 const queryComparable=cg.map(e=>{const q=queries[run.variant].get(`${e.pid}:${e.id}`);assert.ok(q);return[q.path,q.parameters.map(([k,v])=>{
  if(q.path==='/rest/v1/person_habit_assertions'&&k==='validated_at'){
   assert.ok(v.startsWith('lte.'));const cutoff=Date.parse(v.slice(4));assert.ok(cutoff>=composer.start-100&&cutoff<=composer.end+100);dynamicCutoffs++;return[k,'lte.<fresh-cutoff>'];
  }return[k,v];})]});
 const meta=http[run.variant].filter(e=>e.type==='http-navigation'&&e.start>=run.trialStart-100&&e.start<=run.trialEnd);
 const cm=meta.find(e=>e.path==='/mois-a-venir/composer'&&!e.prefetch),networkComposer=run.network.find(e=>e.path==='/mois-a-venir/composer'&&!e.prefetch);
 const nodeSamples=http[run.variant].filter(e=>e.type==='process-sample'&&e.at>=run.clickAt&&e.at<=run.interactiveAt);
 const spans=descendants(composer).filter(e=>e.type==='span');
 const fullPayload=descendants(composer).find(e=>e.type==='payload');
 const r={id:run.id,variant:run.variant,mode:run.mode,waitPreview:run.waitPreview,profile:run.profile,supplemental:!!run.supplemental,clickAt:run.clickAt,interactiveAt:run.interactiveAt,tti:run.tti,endToEnd:run.endToEnd,
  centreMs:centre?.duration??0,centrePreparationMs:(run.centreReady??run.clickAt)-run.trialStart,centreToClickMs:run.centreOpen?run.clickAt-run.centreOpen:0,
  composerStartVsClickMs:composer?.start-run.clickAt,composerServerMs:composer?.duration,previewMs:preview?.duration??0,previewStartVsClickMs:preview?preview.start-run.clickAt:null,previewEndVsClickMs:preview?preview.end-run.clickAt:null,previewOverlapMs:overlap,
  composerGETs:cg.length,previewGETs:pg.length,centreGETs:gets(centre).length,composerStatus:composer?.status,previewStatus:preview?.status??null,
  centreQueryProfile:queryProfile(gets(centre)),previewQueryProfile:queryProfile(pg),composerQueryProfile:queryProfile(cg),
  businessFetchErrors:within.filter(e=>e.type==='fetch'&&e.business&&(e.error||e.status>=400)).map(e=>({path:e.path,error:e.error??null,status:e.status??null})),
  dynamicCutoffs,queryComparableHash:hash(queryComparable.map(hash).sort()),
  composerFetchHeaderMs:stats(cg.map(e=>e.headerDuration)),previewFetchHeaderMs:stats(pg.map(e=>e.headerDuration)),
  composerBodyObservations:descendants(composer).filter(e=>e.type==='body'&&e.path?.startsWith('/rest/v1/')).length,
  composerBodyBytes:descendants(composer).some(e=>e.type==='body'&&e.path?.startsWith('/rest/v1/'))?descendants(composer).filter(e=>e.type==='body'&&e.path?.startsWith('/rest/v1/')).reduce((s,e)=>s+e.bytes,0):null,
  v2PreviewSpans:descendants(preview).filter(e=>e.type==='span'&&e.name.endsWith(':previewMonthControlCenter')).map(e=>({name:e.name,duration:e.duration})),
  m7BuilderMs:spans.find(e=>e.name.endsWith(':buildGlobalM7MobilityContextAuthority'))?.duration,
  readMonthComposerMs:spans.find(e=>e.name.endsWith(':readMonthComposer'))?.duration,
  projectionOwnerMs:spans.find(e=>e.name.endsWith(':loadPurchaseAwareCanonical'))?.duration,
  parallelBusinessGets:parallel(boundaries.filter(e=>e.start<run.interactiveAt&&e.end>run.clickAt),run.clickAt,run.interactiveAt),
  rsc:cm?.rsc,firstHeaderVsClickMs:cm?.headersAt-run.clickAt,firstChunkVsClickMs:cm?.firstWriteAt-run.clickAt,rscCompletedVsClickMs:cm?.end-run.clickAt,rscBytes:cm?.bytesWritten,
  postStreamToInteractiveMs:cm?run.interactiveAt-cm.end:null,browserFirstHeaderMs:networkComposer?networkComposer.headersAt-networkComposer.start:null,
  browserNetwork:{requests:run.network.length,staticRequests:run.network.filter(e=>e.path.startsWith('/_next/static/')).length,staticEncodedBytes:run.network.filter(e=>e.path.startsWith('/_next/static/')).reduce((sum,e)=>sum+(e.encodedBytes??0),0),totalObservedCompletedEncodedBytes:run.network.reduce((sum,e)=>sum+(e.encodedBytes??0),0),failedRequests:run.network.filter(e=>e.error).map(e=>({path:e.path,method:e.method,status:e.status??null,error:e.error,canceled:e.canceled??false})),composerTransfer:networkComposer?{finishedEncodedBytes:networkComposer.encodedBytes??null,observedChunkEncodedBytes:networkComposer.chunks.reduce((sum,e)=>sum+e.encoded,0),observedDecodedChunkBytes:networkComposer.chunks.reduce((sum,e)=>sum+e.bytes,0),canceled:networkComposer.canceled??false}:null},
  boardVsClickMs:run.page.timeOrigin+run.page.audit.marks.board-run.clickAt,hydrationVsClickMs:run.page.timeOrigin+run.page.audit.marks.hydrated-run.clickAt,
  prefetches:meta.filter(e=>e.prefetch||e.segmentPrefetch).map(e=>{const root=roots.filter(h=>h.name===`http:${e.method}:${e.path}`).sort((a,b)=>Math.abs(a.start-e.start)-Math.abs(b.start-e.start))[0];assert.ok(root&&Math.abs(root.start-e.start)<10,'Prefetch must match its own method/path HTTP root');return{path:e.path,duration:e.end-e.start,rsc:e.rsc,businessGETs:gets(root).length}}),
  browserLongTasks:run.page.audit.longtasks.filter(e=>run.mode!=='client'||e.start>=run.page.clientStart).reduce((sum,e)=>sum+e.duration,0),
  browserExceptions:run.errors.length,blocked:run.blocked,allowedReadOnlyActionPosts:run.allowedPost,viewport:run.page.viewport,interaction:run.interaction,drainTimeout:run.drainTimeout,
  processMemory:{rss:stats(nodeSamples.map(e=>e.rss)),heapUsed:stats(nodeSamples.map(e=>e.heapUsed)),systemFreeBytes:stats(nodeSamples.map(e=>e.systemFreeBytes))},
  payload:fullPayload?{bytes:fullPayload.bytes,fullUiDigest:fullPayload.fullUiDigest,digest:fullPayload.digest,cards:fullPayload.cards,contexts:fullPayload.contexts,assets:fullPayload.assets}:null};
 rows.push(r);
}
const grouped={};for(const variant of ['a','b'])for(const kind of ['rapid','quiet','hard']){
 const rs=rows.filter(r=>!r.failed&&r.variant===variant&&(kind==='hard'?r.mode==='hard':r.mode==='client'&&r.waitPreview===(kind==='quiet')));
 grouped[variant+'-'+kind]=Object.fromEntries(['tti','endToEnd','centreMs','centreToClickMs','composerServerMs','previewMs','previewOverlapMs','m7BuilderMs','projectionOwnerMs','postStreamToInteractiveMs','browserLongTasks','boardVsClickMs','hydrationVsClickMs'].map(k=>[k,stats(rs.map(r=>r[k]))]));
}
const pairs=[];for(let i=1;i<=12;i++){const id='pair'+String(i).padStart(2,'0'),a=rows.find(r=>r.id===id+'-a'),b=rows.find(r=>r.id===id+'-b');if(a&&!a.failed&&b&&!b.failed)pairs.push({pair:i,order:i%2?'AB':'BA',a:a.tti,b:b.tti,bMinusA:b.tti-a.tti,serverBMinusA:b.composerServerMs-a.composerServerMs})}
let confidence=null;if(pairs.length===12){let seed=0x72b50001;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296};const medians=[];for(let sample=0;sample<10000;sample++)medians.push(stats(Array.from({length:12},()=>pairs[Math.floor(random()*12)].bMinusA)).median);medians.sort((a,b)=>a-b);confidence={method:'10000 seeded paired bootstrap median differences; local observational interval, no production SLA',lower95:medians[249],upper95:medians[9749]}}
const remoteWrites=Object.values(traces).flat().filter(e=>e.type==='fetch'&&e.business&&!['GET','HEAD'].includes(e.method)&&!e.blocked).length;
const result={schema:'composer-navigation-audit@1',rows,grouped,pairs,pairedDifference:stats(pairs.map(p=>p.bMinusA)),confidence,remoteWrites,
 note:'Raw private traces preserved. Hard control is a fresh direct document navigation with explicit same month. Client TTI keeps P2-A native Board/search criterion; captures now begin before Centre. First pair is profiled on both variants; retained in main statistics. Production Next fetch wrapping bypasses the body observer: body bytes are null when unobserved; GET concurrency then measures start-to-headers only, not body completion. Browser net::ERR_ABORTED with canceled=true after HTTP 200 is retained separately; completed encoded bytes are only the observed loadingFinished subset, not a full transfer size when streams are canceled.'};
fs.writeFileSync(path.join(root,'public-summary.json'),JSON.stringify(result,null,2)+'\n');
if(process.argv.includes('--certify')){
 assert.equal(controlled.length,36);assert.ok(rows.every(r=>!r.failed&&r.blocked===0&&r.browserExceptions===0&&r.interaction.empty&&r.viewport.width===1728&&r.viewport.height===900));assert.equal(pairs.length,12);assert.equal(remoteWrites,0);
 assert.ok(rows.every(r=>r.composerStatus===200&&r.businessFetchErrors.length===0));
 assert.ok(rows.every(r=>r.browserNetwork.failedRequests.every(e=>e.canceled&&e.status===200)),'Canceled HTTP 200 streams retained; actual transport failures invalidate the series');
 assert.ok(rows.every(r=>r.composerGETs===291&&r.dynamicCutoffs===1&&r.queryComparableHash===rows[0].queryComparableHash));
 assert.ok(rows.filter(r=>r.mode==='client').every(r=>r.centreGETs===45&&r.previewGETs===27&&r.previewStatus===200&&r.allowedReadOnlyActionPosts===1));
 assert.ok(rows.every(r=>r.prefetches.every(p=>p.businessGETs===0)));
 assert.ok(rows.filter(r=>r.mode==='hard').every(r=>r.previewGETs===0&&r.allowedReadOnlyActionPosts===0));
 assert.ok(rows.filter(r=>r.waitPreview).every(r=>r.previewOverlapMs===0));
 console.log('P2B5_READONLY_MEASUREMENT_CERTIFICATION PASS');
}
console.log(JSON.stringify({completed:rows.length,grouped:Object.fromEntries(Object.entries(grouped).map(([k,v])=>[k,{tti:v.tti,server:v.composerServerMs,preview:v.previewMs}])),pairedDifference:result.pairedDifference,confidence,remoteWrites}));
