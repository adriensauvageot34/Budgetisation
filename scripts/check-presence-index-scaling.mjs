import assert from 'node:assert/strict';
import fs from 'node:fs';
import { performance } from 'node:perf_hooks';
import { require } from './lib/phase2-ts-loader.mjs';
import { visit } from './fixtures/m7-presence-intervals.mjs';
const { Temporal }=require('@js-temporal/polyfill');
const { createPresenceIntervalIndex }=require('@/analytics/global-v2/mobility-presence-index');
const full=process.argv.includes('--benchmark'), rows=[];
const sizes=full?[100,500,1000,2000,5000]:[100,2000];
for(const n of sizes)for(const kind of ['non-overlapping','moderate','all-overlapping']){
  if(!full&&kind==='all-overlapping'&&n===2000)continue;
  const stamp=minute=>new Date(Date.UTC(2026,0,1)+minute*60000).toISOString();
  const values=Array.from({length:n},(_,i)=>visit(`visit-${i}`,stamp(kind==='all-overlapping'?0:i*10),stamp(kind==='all-overlapping'?100:i*10+(kind==='moderate'?25:5))));
  const interval=v=>({startAt:v.interval.startedAt,endAt:v.interval.endedAt}),memo=new Map();
  const parse=s=>{if(!memo.has(s))memo.set(s,Temporal.Instant.from(s));return memo.get(s)};
  const heap=process.memoryUsage().heapUsed,start=performance.now(),query=createPresenceIntervalIndex(values,interval,parse),buildMs=performance.now()-start;
  const heapDeltaBytes=process.memoryUsage().heapUsed-heap,searchStart=performance.now();let count=0;
  for(let i=0;i<n;i++){
    const candidates=query(interval(values[i]));count+=candidates.length;
    const expected=kind==='all-overlapping'?n:kind==='non-overlapping'?1:Math.min(n-1,i+2)-Math.max(0,i-2)+1;
    assert.equal(candidates.length,expected,`${kind}/${n}/${i}: exact candidate count`);
    // Source ordering and distinct identity must survive temporal sorting.
    assert.ok(candidates.every((v,j)=>j===0||Number(v.visitKey.slice(6))>Number(candidates[j-1].visitKey.slice(6))));
  }
  assert.equal(count,kind==='all-overlapping'?n*n:kind==='non-overlapping'?n:5*n-6);
  const lookupMs=performance.now()-searchStart;
  const bounds=values.map(v=>({start:parse(v.interval.startedAt).epochNanoseconds,end:parse(v.interval.endedAt).epochNanoseconds}));
  const bruteStart=performance.now();let bruteMatches=0;
  for(const a of bounds)for(const b of bounds)if(a.start<b.end&&b.start<a.end)bruteMatches++;
  const bruteForceMs=performance.now()-bruteStart;assert.equal(count,bruteMatches,'Independent exhaustive predicate');
  rows.push({n,kind,bruteForcePairs:n*n,indexedPairs:count,bruteMatches,buildMs,lookupMs,bruteForceMs,heapDeltaBytes,
    note:'Includes self queries; exhaustive bigint predicate count is equal. Timing is indicative, never a CI threshold; final Temporal oracle also checked by M7 fixtures.'});
}
// Independent exhaustive predicate on adversarial valid, zero and inverted bounds.
const bounds=[[-20,20],[0,0],[4,2],[2,4],[3,3],[-1,0],[0,1],[1,2],[2,3],[3,4]];
const s=x=>new Date(Date.UTC(2026,0,1)+x*60000).toISOString();
const values=bounds.map(([a,b],i)=>visit(String(i),s(a),s(b))),interval=v=>({startAt:v.interval.startedAt,endAt:v.interval.endedAt});
const query=createPresenceIntervalIndex(values,interval,Temporal.Instant.from);
for(const [a,b]of bounds){const expected=values.filter((_,i)=>a<bounds[i][1]&&bounds[i][0]<b);assert.deepEqual(query({startAt:s(a),endAt:s(b)}),expected);}
assert.deepEqual(query({startAt:'bad',endAt:s(5)}),values,'Unparseable query falls back to original visits');
const output=process.argv.find(a=>a.endsWith('.json'));if(output)fs.writeFileSync(output,JSON.stringify({rows,parity:'PASS'},null,2)+'\n');
console.log(JSON.stringify({rows,parity:'PASS'}));
