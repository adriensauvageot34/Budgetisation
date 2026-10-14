// Consumes sanitized DOM measurements. No network, credentials or financial rows.
import fs from 'node:fs';
const input=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));
const samples=input.samples??input;
const percentile=(values,p)=>{const sorted=values.filter(Number.isFinite).sort((a,b)=>a-b);if(!sorted.length)return null;
 return p===.5&&sorted.length%2===0?(sorted[sorted.length/2-1]+sorted[sorted.length/2])/2:sorted[Math.max(0,Math.ceil(p*sorted.length)-1)];};
const span=(metrics,label)=>metrics.spans?.find(s=>s.label===label)?.ms??null;
const measured=samples.map(s=>{
 const m=s.server??s.action?.metrics??{},browser=s.browser??{},history=m.history??[];
 const values={freshMs:s.phase==='EDIT'?s.intent?.visualFreshMs:browser.freshMs,
  worldMs:span(m,'World'),evidenceMs:span(m,'PredictionEvidence'),forecastMs:span(m,'Forecast'),
  metadataMs:span(m,'Evidence_Metadata'),historyMs:span(m,'Evidence_HistoryBarrier'),joinMs:span(m,'Evidence_Join_Coverage'),
  metricsDrainMs:m.metricsDrainMs,responseReadyMs:m.responseReadyMs,
  responseEndToFreshMs:s.phase==='EDIT'?null:browser.responseEndToFreshMs,
  calls:m.requests?.length,decodedBytes:m.requests?.reduce((n,r)=>n+r.bytes,0)};
 const hits=['SNAP3_CANONICAL','SNAP3_M7'].every(reason=>history.some(h=>h.reason===reason&&h.status==='HIT'));
 const failures=m.requests?.filter(r=>r.timeout||r.status>=400||r.status===0).length??0;
 return {pair:s.pair,variant:s.variant,phase:s.phase,kind:s.kind??'OPEN',region:m.region,
  semanticDigest:s.semanticDigest,previewDigest:s.previewDigest,readTrace:m.traceId,
  status:s.status??browser.previewStatus,completeSnap3Hit:hits,failedRequests:failures,values,
  evidenceSpans:m.spans?.filter(x=>x.label.startsWith('Evidence_')).map(x=>({label:x.label,startMs:x.startMs,endMs:x.endMs,ms:x.ms,failed:x.failed})),
  comparable:hits&&!failures&&(s.status??browser.previewStatus)==='FRESH'};
});
const groups=[];
for(const key of new Set(measured.map(s=>`${s.variant}|${s.phase}|${s.kind}`))){
 const group=measured.filter(s=>`${s.variant}|${s.phase}|${s.kind}`===key);
 groups.push({key,n:group.length,comparable:group.filter(s=>s.comparable).length,
  metrics:Object.fromEntries(Object.keys(group[0].values).map(name=>[name,{p50:percentile(group.map(s=>s.values[name]),.5),
   p95Descriptive:percentile(group.map(s=>s.values[name]),.95),min:percentile(group.map(s=>s.values[name]),0),max:percentile(group.map(s=>s.values[name]),1)}]))});
}
const pairs=[];
for(const [reference,candidate]of [['reference_iad1','reference_fra1'],['reference_iad1','candidate_iad1'],['reference_fra1','candidate_fra1']]){
 for(const before of measured.filter(s=>s.variant===reference)){
  const after=measured.find(s=>s.variant===candidate&&s.pair===before.pair&&s.phase===before.phase&&s.kind===before.kind);
  if(!after)continue;
  const parity=!!before.semanticDigest&&!!before.previewDigest&&before.semanticDigest===after.semanticDigest&&before.previewDigest===after.previewDigest;
  pairs.push({pair:before.pair,phase:before.phase,kind:before.kind,reference,candidate,parity,
   comparable:before.comparable&&after.comparable&&parity,
   deltas:Object.fromEntries(Object.keys(before.values).map(k=>[k,Number.isFinite(before.values[k])&&Number.isFinite(after.values[k])?after.values[k]-before.values[k]:null]))});
 }
}
const result={status:'DERIVED_FROM_RECORDED_MEASUREMENTS',percentiles:'Median and nearest-rank descriptive P95; no robust tail certification.',
 notes:['Server spans overlap; never sum them.','No cross-clock subtraction.','All observations are retained, including failures and unfavorable pairs.'],groups,pairs,samples:measured};
if(process.argv[3])fs.writeFileSync(process.argv[3],JSON.stringify(result,null,2)+'\n');else console.log(JSON.stringify(result,null,2));
