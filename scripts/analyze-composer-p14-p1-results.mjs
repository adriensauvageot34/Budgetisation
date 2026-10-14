// Recalculate published percentiles from sanitized observations, without I/O to services.
import fs from 'node:fs';
import assert from 'node:assert/strict';
const r=JSON.parse(fs.readFileSync('docs/status/evidence/p14-p1/real-opening-observations.json','utf8'));
assert.equal(r.financialFingerprintsEqualAcrossAllNineOpenings,true);
const q=(xs,p)=>xs.toSorted((a,b)=>a-b)[Math.ceil(xs.length*p)-1];
const metrics=['boardMs','freshMs','serverMs','worldMs','forecastMs','baselineMs','financeMs','canonicalMaxMs'];
const output={};
for(const v of ['A','B']){
  const xs=r.warm.filter(x=>x.variant===v);assert.equal(xs.length,3);
  assert.ok(xs.every(x=>x.state==='FRESH'&&x.timeouts===0&&x.blockedWrites===0));
  output[v]={n:xs.length};
  for(const key of metrics){const values=xs.map(x=>x[key]);output[v][key]={p50:q(values,.5),p95:q(values,.95),min:Math.min(...values),max:Math.max(...values)};}
}
output.gainFreshMedianMs=output.A.freshMs.p50-output.B.freshMs.p50;
output.gainFreshMedianPercent=100*output.gainFreshMedianMs/output.A.freshMs.p50;
output.gainFreshP95ObservedMs=output.A.freshMs.p95-output.B.freshMs.p95;
output.realGetAvoided=r.warm.find(x=>x.variant==='A').restGet-r.warm.find(x=>x.variant==='B').restGet;
console.log(JSON.stringify(output,null,2));
