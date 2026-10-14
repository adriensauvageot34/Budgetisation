import assert from 'node:assert/strict';
import fs from 'node:fs';
import { performance } from 'node:perf_hooks';
import { require } from './lib/phase2-ts-loader.mjs';
import { canonicalClient,components,context,uuid } from './fixtures/canonical-p14-p1.mjs';
const {CanonicalRepository}=require('@/server/canonical/repository');
const {CanonicalRequestKeyReads,readCanonicalInBatches}=require('@/server/canonical/in-batches');
globalThis.fetch=async()=>{throw new Error('P14_P1_FIXTURE_NETWORK_FORBIDDEN');};
const checks=[];
const check=async(name,fn)=>{await fn();checks.push(name);console.log(`${name} PASS`);};
const ids=Array.from({length:240},(_,i)=>uuid(100+i));
async function run(enabled,options={},sets=[ids,ids.slice(30,150)]) {
  const source=canonicalClient(options),repo=new CanonicalRepository(source.client,{...context,timezone:options.timezone??context.timezone,
    personIds:options.partial?[uuid(2)]:[]},{shareEconomicReads:enabled});
  const start=performance.now(),results=[];
  for(const keys of sets){const rows=await repo.loadEconomicComponentRowsByOperations(keys);results.push(await repo.projectEconomicComponentRows(rows));}
  return {results,calls:source.calls,ms:performance.now()-start};
}
await check('P1-RAW-FACTS-PARITY',async()=>{
  const a=await run(false),b=await run(true);assert.deepEqual(b.results,a.results);
  assert.equal(a.calls.length,34);assert.equal(b.calls.length,23);
  assert.equal(a.results[1][0].economicTiming.segments[0].economicMonth,'2025-08');
  assert.ok(b.calls.every(c=>c.keys<=120));
});
await check('P1-UNKNOWN-IDENTITY-PROVENANCE',async()=>{
  const a=await run(false,{unknown:true}),b=await run(true,{unknown:true});assert.deepEqual(b.results,a.results);
  assert.equal(b.results[1][0].person.kind,'unknown');assert.equal(b.results[1][0].canonicalPlace.kind,'unknown');
});
await check('P1-PARTIAL-OVERLAP-MISSING-DIRECT',async()=>{
  const sets=[ids.slice(0,120),ids.slice(60,180),ids.slice(180)];
  assert.deepEqual((await run(true,{},sets)).results,(await run(false,{},sets)).results);
});
await check('P1-PARTIAL-PERSON-SHARES',async()=>{
  const a=await run(false,{partial:true}),b=await run(true,{partial:true});assert.deepEqual(b.results,a.results);
  assert.equal(b.results[1][0].person.kind,'partial');
});
await check('P1-FRESH-REQUEST-RETROACTIVE-CHANGE',async()=>{
  const original=await run(true),modified=await run(true,{amount:'12.00'}),direct=await run(false,{amount:'12.00'});
  assert.notDeepEqual(modified.results,original.results);assert.deepEqual(modified.results,direct.results);
});
await check('P1-NEW-TIMEZONE-CONTEXT',async()=>{
  for(const timezone of ['Pacific/Honolulu','Asia/Tokyo'])assert.deepEqual((await run(true,{timezone})).results,(await run(false,{timezone})).results);
});
await check('P1-EMPTY-HISTORY-NOT-INVENTED',async()=>{
  assert.deepEqual((await run(true,{},[[]])).results,[[]]);
});
await check('P1-TIMEOUT-NO-PARTIAL-SUCCESS',async()=>{
  const save=console.error;console.error=()=>{};
  try{for(const enabled of [false,true])await assert.rejects(()=>run(enabled,{failTable:'financial_economic_timing_canonical'}),e=>e.source==='timing'&&e.cause.code==='57014');}
  finally{console.error=save;}
});
await check('P1-CONCURRENT-KEYS-ONE-READ',async()=>{
  const cache=new CanonicalRequestKeyReads(),calls=[];
  const options=values=>({values,batchSize:120,executeBatch:async batch=>{calls.push(...batch);await new Promise(r=>setImmediate(r));return batch.map(id=>({id,segment:1}));},
    rowIdentity:r=>`${r.id}:${r.segment}`,compareRows:(a,b)=>a.id.localeCompare(b.id)});
  const [a,b]=await Promise.all([cache.read('timing',options(ids.slice(0,160)),r=>r.id,1000),cache.read('timing',options(ids.slice(80)),r=>r.id,1000)]);
  assert.equal(calls.length,240);assert.equal(new Set(calls).size,240);assert.equal(a.length,160);assert.equal(b.length,160);
});
await check('P1-FAILED-GROUP-IS-ATOMIC',async()=>{
  const cache=new CanonicalRequestKeyReads(),failure=new Error('timeout'),calls=[];
  const options={values:ids,batchSize:120,executeBatch:async batch=>{calls.push(batch);if(batch.includes(ids[239]))throw failure;return batch.map(id=>({id}));},rowIdentity:r=>r.id,compareRows:(a,b)=>a.id.localeCompare(b.id)};
  await assert.rejects(()=>cache.read('timing',options,r=>r.id,1000),failure);
  await assert.rejects(()=>cache.read('timing',{...options,values:[ids[0]]},r=>r.id,1000),failure);
  assert.equal(calls.length,2);
});
await check('P1-NAMESPACES-AND-SESSIONS-ISOLATED',async()=>{
  const options={values:['a'],executeBatch:async()=>[{id:'a',value:1}],rowIdentity:r=>r.id,compareRows:()=>0};
  const one=new CanonicalRequestKeyReads(),two=new CanonicalRequestKeyReads();
  await one.read('timing',options,r=>r.id,1000);
  assert.equal((await one.read('place',{...options,executeBatch:async()=>[{id:'a',value:2}]},r=>r.id,1000))[0].value,2);
  assert.equal((await two.read('timing',{...options,executeBatch:async()=>[{id:'a',value:3}]},r=>r.id,1000))[0].value,3);
});
await check('P1-ORDER-ONE-TO-MANY-EMPTY',async()=>{
  const cache=new CanonicalRequestKeyReads();let calls=0;
  const options={values:['b','a','empty'],executeBatch:async()=>{calls++;return [{id:'b',segment:2},{id:'a',segment:1},{id:'b',segment:1}];},
    rowIdentity:r=>`${r.id}:${r.segment}`,compareRows:(a,b)=>a.id.localeCompare(b.id)||a.segment-b.segment};
  assert.deepEqual(await cache.read('timing',options,r=>r.id,1000),await readCanonicalInBatches(options));
  assert.deepEqual(await cache.read('timing',{...options,values:['empty']},r=>r.id,1000),[]);assert.equal(calls,2);
});
await check('P1-CAPPED-RESULT-NOT-REUSED-AS-COMPLETE',async()=>{
  const cache=new CanonicalRequestKeyReads();let calls=0;
  const options={values:['a','b'],executeBatch:async keys=>{calls++;return keys.length===2?
    Array.from({length:1000},(_,n)=>({id:'a',segment:n})):[{id:'b',segment:1001}];},
    rowIdentity:r=>`${r.id}:${r.segment}`,compareRows:(a,b)=>a.id.localeCompare(b.id)||a.segment-b.segment};
  const first=await cache.read('timing',options,r=>r.id,1000);
  assert.equal(first.length,1000);assert.equal(calls,1,'do not repeat the initial capped request');
  const subset=await cache.read('timing',{...options,values:['b']},r=>r.id,1000);
  assert.deepEqual(subset,[{id:'b',segment:1001}]);assert.equal(calls,2,'read the original subset instead of returning an invented empty group');
});
const pairs=[];
for(let n=0;n<12;n++){
  const order=n%2?[true,false]:[false,true],pair={};
  for(const enabled of order){const r=await run(enabled,{delayMs:8});pair[enabled?'after':'before']={ms:r.ms,reads:r.calls.length,bytes:r.calls.reduce((n,c)=>n+c.bytes,0)};}
  pairs.push(pair);
}
const percentile=(values,p)=>[...values].sort((a,b)=>a-b)[Math.ceil(values.length*p)-1];
const report={status:'PASS_SYNTHETIC_ONLY',checks,n:pairs.length,delayPerSyntheticReadMs:8,pairs,
  before:{p50:percentile(pairs.map(p=>p.before.ms),.5),p95:percentile(pairs.map(p=>p.before.ms),.95),reads:pairs[0].before.reads,bytes:pairs[0].before.bytes},
  after:{p50:percentile(pairs.map(p=>p.after.ms),.5),p95:percentile(pairs.map(p=>p.after.ms),.95),reads:pairs[0].after.reads,bytes:pairs[0].after.bytes},remoteWrites:0,sqlMeasured:false};
if(process.env.P14_P1_FIXTURE_REPORT)fs.writeFileSync(process.env.P14_P1_FIXTURE_REPORT,JSON.stringify(report,null,2));
console.log(JSON.stringify(report));
