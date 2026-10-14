import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
const root=process.argv[2]??'docs/status/evidence/p14-p2';
const stats=values=>{const a=values.filter(Number.isFinite).sort((a,b)=>a-b);return {n:a.length,p50:a[Math.ceil(a.length*.5)-1]??null,p95:a[Math.ceil(a.length*.95)-1]??null,min:a[0]??null,max:a.at(-1)??null};};
const files=fs.readdirSync(root).filter(name=>/^browser-P[12]-.*-client.json$/.test(name));
const rows=files.map(name=>{
  const p=JSON.parse(fs.readFileSync(path.join(root,name),'utf8')),variant=name.includes('P1-')?'P1':'P2';
  assert.equal(p.completed,true);assert.equal(p.failure,null);assert.equal(p.commits.at(-1).cards,20);assert.equal(p.commits.at(-1).status,'FRESH');assert.equal(p.commits.at(-1).save,'SAVED');
  const added=p.stages.filter(s=>['night-add','family-add','stay-add','add-to-20'].includes(s.phase));assert.equal(added.length,20);
  const fresh=p.commits.filter((c,i)=>c.status==='FRESH'&&p.commits[i-1]?.status!=='FRESH'&&p.stages.some(s=>s.at<=c.at));
  const lastToFresh=fresh.map(c=>c.at-p.stages.filter(s=>s.at<=c.at).at(-1).at);
  const evidence=JSON.parse(fs.readFileSync(path.join(root,'browser-'+variant+'-server.json'),'utf8'));
  // The P1 tab was recreated before its first gesture. Exclude the abandoned
  // initial READ using the exact server start mark captured by this client.
  const initialStart=p.requests[0].server.started;
  const server=evidence.log.filter(r=>r.fixturePerformance?.started>=initialStart).map(r=>r.fixturePerformance);
  assert.equal(server.length,p.requests.length,'wait for all dispatched calculations to finish before extracting server evidence');
  assert.equal(evidence.drafts.active.digest,p.commits.at(-1).digest);
  assert.deepEqual(evidence.counts,{plans:0,revisions:0});assert.equal(evidence.rpcCalls,0);
  return {file:name,variant,completed:p.completed,final:p.commits.at(-1),requests:p.requests.length,readRequests:p.requests.filter(r=>r.kind==='READ').length,
    hoverRequests:p.requests.filter(r=>r.kind==='MUTATE').length,worldReads:server.reduce((n,s)=>n+s.worldReads,0),simulatedGets:server.reduce((n,s)=>n+s.simulatedGets,0),
    evaluations:server.reduce((n,s)=>n+s.evaluations,0),financeCalls:server.reduce((n,s)=>n+s.financeCalls,0),financeCpuMs:server.reduce((n,s)=>n+s.financeCallsMs,0),
    spans:p.spans,addPaintMs:added.map(s=>s.paintMs),addCpuMs:added.map(s=>s.cpuMs),lastToFreshMs:lastToFresh,renderMs:p.renders.map(r=>r.ms),
    requestMs:p.requests.map(r=>r.ms),digestSequence:p.commits.filter(c=>c.status==='FRESH').map(c=>({draft:c.digest,preview:c.proof})),
    autosaves:evidence.drafts.events.length,adjacentIdenticalSaves:evidence.drafts.events.filter((e,i)=>i>0&&e.digest===evidence.drafts.events[i-1].digest).length,
    savePhases:evidence.drafts.events.map(e=>({version:e.version,digest:e.digest,phase:p.commits.find(c=>c.digest===e.digest&&c.save==='SAVED')?.phase??'saved while newer edits pending'})),
    phases:Object.fromEntries([...new Set(p.requests.map(r=>r.server?.kind))].filter(Boolean).map(kind=>[kind,p.requests.filter(r=>r.server?.kind===kind).length]))};
});
const aggregate=Object.fromEntries(['P1','P2'].map(variant=>{const a=rows.filter(r=>r.variant===variant);return[variant,{sessions:a.length,addPaintMs:stats(a.flatMap(r=>r.addPaintMs)),addCpuMs:stats(a.flatMap(r=>r.addCpuMs)),lastIntentToFreshMs:stats(a.flatMap(r=>r.lastToFreshMs)),renderMs:stats(a.flatMap(r=>r.renderMs)),requestMs:stats(a.flatMap(r=>r.requestMs)),requests:stats(a.map(r=>r.requests)),readRequests:stats(a.map(r=>r.readRequests)),hoverRequests:stats(a.map(r=>r.hoverRequests)),worldReads:stats(a.map(r=>r.worldReads)),financeCalls:stats(a.map(r=>r.financeCalls)),financeCpuMs:stats(a.map(r=>r.financeCpuMs))}];}));
const finalDigests=new Set(rows.map(r=>r.final.digest)),finalProofs=new Set(rows.map(r=>r.final.proof));assert.equal(finalDigests.size,1);assert.equal(finalProofs.size,1);
const result={environment:'ISOLATED_BROWSER_REACT_DEVELOPMENT_PGLITE_WORLD_DELAY_120MS',realSupabase:false,sqlCancellation:false,rows,aggregate,finalDigestParity:true,finalPreviewParity:true};
fs.writeFileSync(path.join(root,'browser-comparison.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(aggregate,null,2));
