import fs from 'node:fs';
const [reference,candidate]=process.argv.slice(2);if(!reference||!candidate)throw Error('Usage: reference.json candidate.json');
const quantile=(values,p)=>{const sorted=values.filter(Number.isFinite).toSorted((a,b)=>a-b);return sorted.length?sorted[Math.ceil(sorted.length*p)-1]:null;};
const stats=values=>({n:values.filter(Number.isFinite).length,p50:quantile(values,.5),p95:quantile(values,.95)});
function summary(file){
  const data=JSON.parse(fs.readFileSync(file,'utf8')),simple=data.cycles.filter(c=>c.label==='simple'&&c.T7!==undefined);
  const delta=(a,b)=>simple.map(c=>c[b]===undefined||c[a]===undefined?NaN:c[b]-c[a]);
  const reqs=data.requests.filter(r=>r.kind==='READ'&&r.sequence>0),sum=(server,label)=>server?.spans?.filter(s=>s.label===label).reduce((n,s)=>n+s.ms,0)??0;
  return {file,completed:data.completed,error:data.error,origin:'production React fixture, programmatic semantic gestures',
    simple:{local:stats(delta('T0','T1')),wait:stats(delta('T2','T3')),response:stats(delta('T3','T4')),
      admission:stats(delta('T4','T5')),commit:stats(delta('T5','T7')),fresh:stats(delta('T0','T7')),paintUpper:stats(delta('T0','paintUpper'))},
    server:{wall:stats(reqs.map(r=>r.server?.serverMs??NaN)),world:stats(reqs.map(r=>sum(r.server,'world'))),
      evaluationInclusive:stats(reqs.map(r=>sum(r.server,'evaluation'))),compiler:stats(reqs.map(r=>sum(r.server,'compiler'))),
      finance:stats(reqs.map(r=>sum(r.server,'finance-v2'))),prepare:stats(reqs.map(r=>sum(r.server,'prepare-world-mobility'))),
      bytes:stats(reqs.map(r=>r.bytes??NaN)),worldReads:[...new Set(reqs.map(r=>r.server?.worldReads))],financeCalls:[...new Set(reqs.map(r=>r.server?.financeCalls))]},
    requests:data.requests.map(r=>({kind:r.kind,sequence:r.sequence,ms:r.response===undefined?null:r.response-r.start,
      worldReads:r.server?.worldReads,financeCalls:r.server?.financeCalls,serverMs:r.server?.serverMs,bytes:r.bytes,error:r.error})),
    burst:data.cycles.filter(c=>c.label.startsWith('burst')).map(c=>({label:c.label,sent:c.T3!==undefined,accepted:c.T7!==undefined,fresh:c.T7?c.T7-c.T0:null})),
    undoRedo:data.cycles.filter(c=>['undo','redo'].includes(c.label)).map(c=>({label:c.label,ms:c.T7?c.T7-c.T0:null,status:c.status})),
    memory:data.memory,errors:data.requests.filter(r=>r.error).length};
}
console.log(JSON.stringify({P4B:summary(reference),P4D:summary(candidate)},null,2));
