// Numeric evidence only; never opens Supabase or an authenticated session.
import fs from 'node:fs';
const dir='docs/status/evidence/p14-p3';
const fixture=JSON.parse(fs.readFileSync(`${dir}/history.json`,'utf8'));
const latest=JSON.parse(fs.readFileSync(`${dir}/history-final.json`,'utf8'));
const preview=[JSON.parse(fs.readFileSync(`${dir}/preview-samples.jsonl`,'utf8').trim()),
  ...['warm2-p2','warm3-p2','warm1-p3','warm2-p3','warm3-p3'].map(name=>JSON.parse(fs.readFileSync(`${dir}/preview-${name}.json`,'utf8')))];
const distribution=values=>{const sorted=values.toSorted((a,b)=>a-b);return{n:values.length,raw:values,p50:sorted[Math.floor(sorted.length/2)],p95NearestRank:sorted[Math.ceil(sorted.length*.95)-1],min:sorted[0],max:sorted.at(-1)};};
const fixtureProfiles=[];for(const latency of [0,15,75])for(const variant of ['P2','A','B']){
  const rows=fixture.samples.filter(row=>row.variant===variant&&row.latency===latency);
  fixtureProfiles.push({latency,variant,wallMs:distribution(rows.map(row=>row.wallMs)),cpuMs:distribution(rows.map(row=>row.cpuMs)),
    transportCpuMs:distribution(rows.map(row=>row.transportCpuMs)),heapDeltaBytes:distribution(rows.map(row=>row.heapDeltaBytes)),peakPhysicalConcurrency:Math.max(...rows.map(row=>row.peakPhysicalConcurrency))});
}
const previewSummary=['P2','P3'].map(variant=>{const rows=preview.filter(row=>row.variant===variant);return{variant,
  totalMs:distribution(rows.map(row=>row.totalMs)),worldMs:distribution(rows.map(row=>row.spans.find(span=>span.label==='world').ms)),
  baselineSourcesMs:distribution(rows.map(row=>row.spans.find(span=>span.label==='baseline-sources').ms)),
  freshMs:distribution(rows.map(row=>row.client.freshMs)),businessGets:rows.map(row=>row.count),bytes:rows.map(row=>row.bytes),
  errors:rows.reduce((n,row)=>n+row.errors,0),timeouts:rows.reduce((n,row)=>n+row.timeouts,0),fingerprints:[...new Set(rows.map(row=>row.fingerprint))]};});
const report={fixtureProfiles,fixtureTransport:[{variant:'P2',...latest.reference},...latest.variants],previewSummary,
  conclusions:{comparativeOpeningLatency:'NOT_CERTIFIED_P3_MEDIAN_AND_MAX_SLOWER',boardComparability:'DIFFERENT_VIEWPORTS_918x811_AND_1280x720',
    fixtureP95:'DESCRIPTIVE_NEAREST_RANK_MAX_N3_NOT_STABLE_P95',previewP95:'DESCRIPTIVE_NEAREST_RANK_MAX_N3_NOT_STABLE_P95',
    realAvoidedBusinessGets:10,realAvoidedBytes:228098,fixtureAvoidedPhysicalGets:46,fixtureAvoidedBytes:523617}};
fs.writeFileSync(`${dir}/summary.json`,JSON.stringify(report,null,2));
console.log(JSON.stringify({fixtureProfiles:fixtureProfiles.map(row=>({latency:row.latency,variant:row.variant,wall:row.wallMs.p50,cpu:row.cpuMs.p50,peak:row.peakPhysicalConcurrency})),previewSummary}));
