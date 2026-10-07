// Publish hashes, counters and timings only. Never publish captured facts/cookies.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
const root=process.argv[2];if(!root)throw new Error('P2B_OUTPUT_ROOT_REQUIRED');
const read=file=>JSON.parse(fs.readFileSync(file,'utf8'));
const hash=value=>crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
const events=folder=>fs.existsSync(folder)?fs.readdirSync(folder).filter(f=>/^server-.*\.jsonl$/.test(f)).flatMap(f=>fs.readFileSync(path.join(folder,f),'utf8').trim().split('\n').filter(Boolean).map(JSON.parse)):[];
function stats(values){const a=values.filter(Number.isFinite).sort((a,b)=>a-b),n=a.length;return n?{n,min:a[0],median:n%2?a[(n-1)/2]:(a[n/2-1]+a[n/2])/2,max:a.at(-1),p95:a[Math.ceil(n*.95)-1]}:null;}
function owner(folder){
 if(!fs.existsSync(path.join(folder,'owner-runs.json')))return null;
 const rows=read(path.join(folder,'owner-runs.json')),trace=events(folder);
 const samples=trace.filter(e=>e.type==='span'&&e.name==='audit:complete-read-owner').map(r=>{
  const t=trace.filter(e=>e.pid===r.pid&&e.root===r.id),spans=t.filter(e=>e.type==='span'),fetches=t.filter(e=>e.type==='fetch'&&e.business&&e.method==='GET');
  const find=p=>spans.find(s=>p.test(s.name))?.duration;
  return {server:r.duration,m7Sync:find(/^audit:mobility-context-builder$/),m7Total:find(/global-v2-mobility-context-authority.*resolveGlobalM7MobilityContextAuthority$/),
   compile:spans.filter(s=>/:compileSemanticPlan$/.test(s.name)).length,derive:spans.filter(s=>/:deriveMonthScenario$/.test(s.name)).length,
   get:fetches.length,queryFingerprint:hash(fetches.map(e=>e.exact).sort()),fullUiDigest:t.find(e=>e.type==='payload')?.fullUiDigest,
   decodedBytes:t.filter(e=>e.type==='body'&&e.path?.startsWith('/rest/v1/')).reduce((s,e)=>s+e.bytes,0)};
 });
 return {wall:stats(rows.filter(r=>!r.error).map(r=>r.duration)),cpu:stats(rows.map(r=>r.cpuMs)),m7Sync:stats(samples.map(s=>s.m7Sync)),m7Total:stats(samples.map(s=>s.m7Total)),
  rows,samples,errors:trace.filter(e=>e.error).map(e=>({type:e.type,name:e.name,path:e.path,error:e.error})),blocked:trace.filter(e=>e.blocked).length,
  remoteWrites:trace.filter(e=>e.type==='fetch'&&e.business&&!['GET','HEAD'].includes(e.method)&&!e.blocked).length};
}
function browser(phase,mode){const file=path.join(root,phase,'browser',`${mode}-runs.json`);if(!fs.existsSync(file))return null;
 const rows=read(file),valid=rows.filter(r=>!r.failed&&r.page);
 return {tti:stats(valid.map(r=>r.page.interactiveFromWall)),firstResponse:stats(valid.map(r=>mode==='hard'?r.page.navigation.responseStart:(r.network.find(n=>n.type==='Fetch'&&n.path.includes('composer'))?.headersAt-r.network.find(n=>n.type==='Fetch'&&n.path.includes('composer'))?.start))),
  completedResponse:stats(valid.map(r=>mode==='hard'?r.page.navigation.responseEnd:(r.network.find(n=>n.type==='Fetch'&&n.path.includes('composer'))?.end-r.network.find(n=>n.type==='Fetch'&&n.path.includes('composer'))?.start))),
  rows:valid.map(r=>({run:r.run,tti:r.page.interactiveFromWall,viewport:r.page.viewport,errors:r.errors,blocked:r.blocked,interaction:r.page.interaction})),failures:rows.filter(r=>r.failed).map(r=>r.failed)};
}
const phases={};
for(const phase of ['baseline','after']){const dir=path.join(root,phase);phases[phase]={real:owner(path.join(dir,'owner-real')),replay:owner(path.join(dir,'replay')),cpu:owner(path.join(dir,'cpu-offline')),browser:{hard:browser(phase,'hard'),client:browser(phase,'client')}};}
const parityKeys=['semanticDigest','baselineDigest','projectionDigest','cardsDigest','capabilitiesDigest','manifestDigest','unknownDigest','uiBytes','counts'];
const parity=r=>Object.fromEntries(parityKeys.map(k=>[k,r[k]])),reference=parity(phases.baseline.real.rows[0]);
const trace=['baseline','after'].flatMap(p=>events(path.join(root,p,'server-browser'))),requests=trace.filter(e=>e.type==='http'&&/^http:GET:\/mois-a-venir\/composer$/.test(e.name));
const privateQueries=new Map();
for(const phase of ['baseline','after']){const dir=path.join(root,phase,'server-browser');if(fs.existsSync(dir))for(const file of fs.readdirSync(dir).filter(f=>/^private-queries-\d+\.jsonl$/.test(f))){
 const pid=Number(file.match(/\d+/)[0]);for(const q of fs.readFileSync(path.join(dir,file),'utf8').trim().split('\n').filter(Boolean).map(JSON.parse))privateQueries.set(`${pid}:${q.id}`,q);
}}
const requestRows=requests.map(r=>{const gets=trace.filter(e=>e.pid===r.pid&&e.root===r.id&&e.type==='fetch'&&e.business&&e.method==='GET');let dynamicCutoffs=0;
 const comparable=gets.map(e=>{const q=privateQueries.get(`${r.pid}:${e.id}`);if(!q)throw new Error('PRIVATE_QUERY_METADATA_REQUIRED');
  const params=q.parameters.map(([key,value])=>{
   if(q.path==='/rest/v1/person_habit_assertions'&&key==='validated_at'){
    assert.ok(value.startsWith('lte.'),'Unchanged habit cutoff operator');const cutoff=Date.parse(value.slice(4));
    assert.ok(cutoff>=r.start-100&&cutoff<=r.end+100,'Only the existing fresh request knowledge cutoff may vary');
    dynamicCutoffs++;return[key,'lte.<request-knowledge-cutoff>'];
   }return[key,value];});return hash([q.path,params]);});
 return{server:r.duration,status:r.status,get:gets.length,queryFingerprint:hash(gets.map(e=>e.exact).sort()),comparableQueryFingerprint:hash(comparable.sort()),dynamicCutoffs};});
const summary={phases,reference,requests:requestRows,exactPairs:fs.existsSync(path.join(root,'real-presence-parity.json'))?read(path.join(root,'real-presence-parity.json')):null,
 remoteWrites:trace.filter(e=>e.type==='fetch'&&e.business&&!['GET','HEAD'].includes(e.method)&&!e.blocked).length,browserBlocked:trace.filter(e=>e.blocked).length,
 note:'Initial baseline live work.overlapCalls double-counted two audit hooks. finalOverlapCalls from the independent oracle/replays is authoritative; all valid timing runs retained. Next has one existing fresh validated_at habit cutoff per request; literal hashes retained, comparable hash normalizes ONLY that cutoff after checking it lies inside the request. Headless fixed-cutoff query hashes remain strictly literal.'};
fs.writeFileSync(path.join(root,'public-summary.json'),JSON.stringify(summary,null,2)+'\n');
if(process.argv.includes('--certify')){
 assert.ok(phases.after.replay.rows.length>=25,'25 post-index offline replays');
 const owners=Object.values(phases).flatMap(p=>[p.real,p.replay,p.cpu]);
 const uiHash=phases.baseline.cpu.samples[0].fullUiDigest;assert.ok(uiHash);
 for(const o of owners){assert.ok(o&&!o.errors.length&&!o.blocked&&!o.remoteWrites);assert.ok(o.rows.every(r=>!r.error&&JSON.stringify(parity(r))===JSON.stringify(reference)));
  assert.ok(o.samples.every(s=>s.get===313&&s.queryFingerprint===phases.baseline.replay.samples[0].queryFingerprint&&s.compile===1&&s.derive===1));
  if(o!==phases.baseline.real&&o!==phases.baseline.replay)assert.ok(o.samples.every(s=>s.fullUiDigest===uiHash));}
 for(const mode of ['hard','client'])for(const p of Object.values(phases)){const b=p.browser[mode];assert.ok(b&&b.rows.length>=5&&!b.failures.length);assert.ok(b.rows.every(r=>!r.errors.length&&!r.blocked&&r.viewport.width===1728&&r.viewport.height===900&&r.interaction.empty));}
 assert.ok(requestRows.length>=20&&requestRows.every(r=>r.get===291&&r.status===200&&r.dynamicCutoffs===1&&r.comparableQueryFingerprint===requestRows[0].comparableQueryFingerprint));
 assert.equal(summary.remoteWrites,0);assert.equal(summary.browserBlocked,0);
 assert.equal(summary.exactPairs.before.pairsHash,summary.exactPairs.after.pairsHash);assert.equal(summary.exactPairs.before.authorityHash,summary.exactPairs.after.authorityHash);
 assert.ok(phases.after.replay.rows.every(r=>r.work.finalOverlapCalls===1666&&r.work.positiveOverlaps===1638&&r.work.invalidFallbackEntries===0&&r.work.zoneValidations===2));
 assert.equal(phases.after.real.rows.length,5);console.log('P2B_MEASUREMENT_CERTIFICATION PASS');
}
console.log(JSON.stringify({phases:Object.fromEntries(Object.entries(phases).map(([p,v])=>[p,{real:v.real?.wall,replay:v.replay?.wall,m7:v.real?.m7Sync,hard:v.browser.hard?.tti,client:v.browser.client?.tti,work:v.replay?.rows[0]?.work}])),requests:requestRows.length}));
