// Synthetic observation tests only. No credentials or real network.
import assert from 'node:assert/strict';
import {require} from './lib/phase2-ts-loader.mjs';
process.env.COMPOSER_SNAP_METRICS_ENABLED='1';
process.env.COMPOSER_WORLD_TRACE_ENABLED='1';
process.env.COMPOSER_SNAP_BENCHMARK_READ_ONLY='1';
process.env.VERCEL_ENV='preview';
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
globalThis.fetch=async input=>{await sleep(String(input).includes('slow')?45:25);return new Response('{"privateFixture":"must not be recorded"}',{status:200});};
const {observeSnapshot,snapshotWork,snapshotSync}=require('@/server/phase2/planner/snapshot-observation');
const run=()=>observeSnapshot(()=>snapshotWork('World',()=>Promise.all([
 snapshotWork('Fast',()=>fetch('https://fixture.invalid/rest/v1/operations?private=do-not-export')),
 snapshotWork('Slow',()=>fetch('https://fixture.invalid/rest/v1/slow?private=do-not-export')),
])));
const {metrics}=await run(),byLabel=Object.fromEntries(metrics.spans.map(s=>[s.label,s]));
assert.equal(metrics.version,'world-trace@1');
assert.notEqual(byLabel.Fast.id,byLabel.Slow.id);
assert.equal(byLabel.Fast.parentId,byLabel.World.id);assert.equal(byLabel.Slow.parentId,byLabel.World.id);
assert.ok(byLabel.Fast.startMs<byLabel.Slow.endMs&&byLabel.Slow.startMs<byLabel.Fast.endMs);
assert.ok(byLabel.World.endMs>=Math.max(byLabel.Fast.endMs,byLabel.Slow.endMs));
assert.ok(metrics.requests.every(r=>r.endMs>=r.startMs&&r.bodyEndMs>=r.endMs&&[byLabel.Fast.id,byLabel.Slow.id].includes(r.parentId)));
assert.ok(!JSON.stringify(metrics).includes('do-not-export')&&!JSON.stringify(metrics).includes('privateFixture'));
console.log('TRACE-CONCURRENCY-PARENTAGE-AND-NO-SOURCE-CONTENT PASS');
const thenable=await observeSnapshot(()=>snapshotWork('Builder',()=>({then(resolve,reject){fetch('https://fixture.invalid/rest/v1/query_builder').then(resolve,reject)}})));
assert.equal(thenable.metrics.requests[0].parentId,thenable.metrics.spans.find(s=>s.label==='Builder').id);
console.log('TRACE-POSTGREST-THENABLE-ATTRIBUTION PASS');
const error=new Error('fixture error');
await assert.rejects(observeSnapshot(()=>snapshotWork('Fail',()=>{throw error})),e=>e===error);
assert.equal(snapshotSync('Value',()=>42),42);
console.log('TRACE-ERROR-AND-VALUE-PRESERVATION PASS');
const sessions=await Promise.all([run(),run()]);
assert.notEqual(sessions[0].metrics.traceId,sessions[1].metrics.traceId);
assert.ok(sessions.every(s=>s.metrics.requests.length===2));
console.log('TRACE-REQUEST-ISOLATION PASS');
await assert.rejects(observeSnapshot(()=>snapshotWork('NoWrite',()=>fetch('https://fixture.invalid/rest/v1/operations',{method:'POST'}))),/SNAP_BENCHMARK_WRITE_REFUSED/);
console.log('TRACE-BENCHMARK-WRITE-GUARD PASS');
process.env.COMPOSER_WORLD_TRACE_ENABLED='0';const disabled=await observeSnapshot(()=>snapshotWork('Off',()=>Promise.resolve('unchanged')));
assert.equal(disabled.value,'unchanged');assert.equal(disabled.metrics.version,'snap-real@1');assert.equal(disabled.metrics.traceId,undefined);
process.env.COMPOSER_SNAP_METRICS_ENABLED='0';assert.equal((await observeSnapshot(()=>snapshotWork('NoMetrics',()=>Promise.resolve(7)))).metrics,null);
console.log('TRACE-OFF-DEFAULT-PASS');
