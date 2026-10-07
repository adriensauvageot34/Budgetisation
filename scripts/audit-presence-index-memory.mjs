// Approximate retained index memory; private input never leaves this process.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { require } from './lib/phase2-ts-loader.mjs';
const [input,output]=process.argv.slice(2);if(!input||!output||!globalThis.gc)throw new Error('PRIVATE_INPUT_OUTPUT_AND_EXPOSE_GC_REQUIRED');
const { Temporal }=require('@js-temporal/polyfill');
const { createPresenceIntervalIndex }=require('@/analytics/global-v2/mobility-presence-index');
const values=JSON.parse(fs.readFileSync(input,'utf8')).placeVisits;
const interval=v=>v.timePrecision==='exact'&&v.interval.kind==='known'?{startAt:String(v.interval.startedAt),endAt:String(v.interval.endedAt)}:null;
const memo=new Map(),parse=s=>{if(!memo.has(s))memo.set(s,Temporal.Instant.from(s));return memo.get(s)};
for(const v of values){const i=interval(v);if(i){parse(i.startAt);parse(i.endAt);}}
const byPerson=new Map();for(const v of values){const key=String(v.personId),list=byPerson.get(key)??[];list.push(v);byPerson.set(key,list);}
// Facts and memo are already live before the measurement: do not count them twice.
const retained=[];globalThis.gc();const before=process.memoryUsage().heapUsed;
for(let build=0;build<5;build++){
 const indexes=[...byPerson.values()].map(list=>createPresenceIntervalIndex(list,interval,parse));
 retained.push(indexes);assert.equal(indexes.length,byPerson.size);
}
globalThis.gc();const after=process.memoryUsage().heapUsed;
const result={builds:retained.length,personIndexesPerBuild:byPerson.size,entriesPerBuild:values.filter(v=>interval(v)!==null).length,
 retainedHeapDeltaBytes:after-before,approximateBytesPerBuild:(after-before)/retained.length,
 note:'GC estimate in an isolated process. Facts and prewarmed P2-A memo excluded; includes entries, bigint bounds, maxEnds, arrays and closures. Not an exact byte count.'};
fs.writeFileSync(output,JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
