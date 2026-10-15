// Consumes sanitized DOM measurements. No network, credentials or financial rows.
import fs from 'node:fs';
const input=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));
const samples=input.samples??input;
const percentile=(values,p)=>{const sorted=values.filter(Number.isFinite).sort((a,b)=>a-b);if(!sorted.length)return null;
 return p===.5&&sorted.length%2===0?(sorted[sorted.length/2-1]+sorted[sorted.length/2])/2:sorted[Math.max(0,Math.ceil(p*sorted.length)-1)];};
const span=(metrics,label)=>Array.isArray(metrics.spans)?metrics.spans.find(s=>s.label===label)?.ms??null:metrics.spans?.[label]??null;
const measured=samples.map(s=>{
 const flat=!s.server&&!s.action,m=s.server??s.action?.metrics??{},browser=s.browser??{},history=m.history??[];
 const values={freshMs:flat?s.freshMs:s.phase==='EDIT'?s.intent?.visualFreshMs:browser.freshMs,
  worldMs:flat?s.worldMs:span(m,'World'),evidenceMs:flat?s.evidenceMs:span(m,'PredictionEvidence'),forecastMs:span(m,'Forecast'),
  metadataMs:span(m,'Evidence_Metadata'),historyMs:span(m,'Evidence_HistoryBarrier'),joinMs:span(m,'Evidence_Join_Coverage'),
  metricsDrainMs:m.metricsDrainMs,responseReadyMs:m.responseReadyMs,
  responseEndToFreshMs:flat?s.responseEndToFreshMs:s.phase==='EDIT'?null:browser.responseEndToFreshMs,
  calls:flat?s.requests:m.requestCount??m.requests?.length,decodedBytes:flat?s.bytes:m.bytes??m.requests?.reduce((n,r)=>n+r.bytes,0)};
 const hits=flat?s.hits===2:['SNAP3_CANONICAL','SNAP3_M7'].every(reason=>history.some(h=>h.reason===reason&&h.status==='HIT'));
 const failures=flat?s.timeouts??0:m.requests?.filter(r=>r.timeout||r.status>=400||r.status===0).length??0;
 const status=s.status??browser.previewStatus??input.status;
 return {pair:s.pair,variant:s.variant,phase:s.phase??'OPEN',kind:s.kind??'OPEN',region:flat?s.region:m.region,
  semanticDigest:s.semanticDigest,previewDigest:s.previewDigest,readTrace:m.traceId,
  status,completeSnap3Hit:hits,failedRequests:failures,values,
  evidenceSpans:Array.isArray(m.spans)?m.spans.filter(x=>x.label.startsWith('Evidence_')).map(x=>({label:x.label,startMs:x.startMs,endMs:x.endMs,ms:x.ms,failed:x.failed})):undefined,
  exclusion:s.excludeFromPairs??s.confounder??null,
  comparable:!s.excludeFromPairs&&!s.confounder&&hits&&!failures&&status==='FRESH'};
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
const pairedSummaries=[];
for(const key of new Set(pairs.map(p=>`${p.reference}|${p.candidate}`))){
 const all=pairs.filter(p=>`${p.reference}|${p.candidate}`===key),eligible=all.filter(p=>p.comparable);
 const rows=variant=>eligible.map(p=>measured.find(s=>s.variant===variant&&s.pair===p.pair&&s.phase===p.phase&&s.kind===p.kind));
 const summary=items=>Object.fromEntries(Object.keys(measured[0]?.values??{}).map(metric=>[metric,{p50:percentile(items.map(s=>s.values[metric]),.5),p95Descriptive:percentile(items.map(s=>s.values[metric]),.95)}]));
 pairedSummaries.push({key,n:eligible.length,excluded:all.length-eligible.length,before:summary(rows(all[0].reference)),after:summary(rows(all[0].candidate)),
  deltaP50:Object.fromEntries(Object.keys(eligible[0]?.deltas??{}).map(metric=>[metric,percentile(eligible.map(p=>p.deltas[metric]),.5)]))});
}
const result={status:'DERIVED_FROM_RECORDED_MEASUREMENTS',percentiles:'Median and nearest-rank descriptive P95; no robust tail certification.',
 notes:['Server spans overlap; never sum them.','No cross-clock subtraction.','All observations are retained, including failures and unfavorable pairs.'],groups,pairs,pairedSummaries,samples:measured};
if(process.argv[3])fs.writeFileSync(process.argv[3],JSON.stringify(result,null,2)+'\n');else console.log(JSON.stringify(result,null,2));
