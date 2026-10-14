// Technical aggregates only. Input is the metrics DOM exported from actual READs.
// Inclusive spans are NEVER added to estimate the page duration.
import fs from 'node:fs';
const input=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));
const observations=Array.isArray(input)?input:input.observations;
const union=intervals=>{let total=0,end=-Infinity;for(const [a,b] of intervals.sort((a,b)=>a[0]-b[0])){if(b>end){total+=b-Math.max(a,end);end=b;}}return total;};
const traces=observations.map(o=>{
 const m=o.metrics??o.server??o,spans=m.spans,byId=new Map(spans.filter(s=>s.id!==undefined).map(s=>[s.id,s]));
 const isChild=(id,parent)=>{for(let n=0;id!=null&&n<1000;n++){if(id===parent)return true;id=byId.get(id)?.parentId;}return false;};
 const groups=spans.map(s=>{
  const requests=s.id===undefined?[]:m.requests.filter(r=>isChild(r.parentId,s.id));
  const children=spans.filter(c=>s.id!==undefined&&c.parentId===s.id&&c.startMs!=null&&c.endMs!=null);
  const descendantWall=union(children.map(c=>[c.startMs,c.endMs]));
  return {label:s.label,id:s.id,parentId:s.parentId,kind:s.kind,startMs:s.startMs,endMs:s.endMs,wallMs:s.ms,
   childUnionMs:descendantWall,wallOutsideImmediateChildrenMs:Math.max(0,s.ms-descendantWall),
   calls:requests.length,decodedBytes:requests.reduce((n,r)=>n+r.bytes,0),
   httpHeadersWaitUnionMs:union(requests.map(r=>[r.startMs,r.endMs])),
   note:'Nested groups overlap; outside-children time is not an exclusive CPU metric. HTTP wait includes network/server/headers, not SQL execution alone.'};
 });
 const barrier=spans.find(s=>s.label==='Baseline_ReadBarrier');
 const known=['Publications_Global_Food','Live_MonthInputs','Live_PlannedExpenses','Habits','Persona_ProductObservations','Mobility_Legs','Mobility_M7_Context','Canonical_PurchaseAware','ActivityHistory','PredictionEvidence'];
 const finishes=spans.filter(s=>known.includes(s.label)).sort((a,b)=>b.endMs-a.endMs);
 return {traceId:m.traceId,phase:o.phase??'READ',serverMs:m.serverMs,groups,
  barrier:barrier?{startMs:barrier.startMs,endMs:barrier.endMs,wallMs:barrier.ms,
   branchFinishes:finishes.map(s=>({label:s.label,endMs:s.endMs})),
   lastBranchExposedTailMs:finishes.length>1?Math.max(0,finishes[0].endMs-finishes[1].endMs):null,
   note:'ESTIMATED zero-cost removal tail for the last branch only; shared dependencies/concurrency and future admission costs must be accounted for. Not a measured acceleration.'}:null,
  calls:m.requests.length,decodedBytes:m.requests.reduce((n,r)=>n+r.bytes,0),timeouts:m.requests.filter(r=>r.timeout).length};
});
const result={status:'DERIVED_FROM_MEASURED_REAL_TRACES',traces};
if(process.argv[3])fs.writeFileSync(process.argv[3],JSON.stringify(result,null,2));else console.log(JSON.stringify(result,null,2));
