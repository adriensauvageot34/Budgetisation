import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createRequire} from 'node:module';
const out=fs.mkdtempSync(path.join(os.tmpdir(),'composer-perf-probe-'));
process.env.COMPOSER_PERF_OUTPUT=out;
let network=0;
globalThis.fetch=async()=>{network++;return new Response('[]',{status:200});};
createRequire(import.meta.url)('./lib/composer-performance-probe.cjs');
let calls=0;
assert.equal(globalThis.__composerPerf('test:null',()=>{calls++;return null}),null);assert.equal(calls,1);
const values=await globalThis.__composerPerf('test:root',()=>Promise.all([
 globalThis.__composerPerf('test:left',async()=>{await new Promise(r=>setTimeout(r,2));return 1}),
 globalThis.__composerPerf('test:right',async()=>2)
]));assert.deepEqual(values,[1,2]);
for(const [method,url] of [['POST','https://test.supabase.co/rest/v1/table'],['GET','https://test.supabase.co/rest/v1/rpc/action'],['PATCH','https://test.supabase.co/storage/v1/object']])
 await assert.rejects(()=>fetch(url,{method}),/REMOTE_WRITE_FORBIDDEN/);
assert.equal(network,0);
await fetch('https://test.supabase.co/rest/v1/table');assert.equal(network,1);
await new Promise(r=>setTimeout(r,300));
const rows=fs.readdirSync(out).filter(f=>f.startsWith('server-')).flatMap(f=>fs.readFileSync(path.join(out,f),'utf8').trim().split(/\r?\n/).map(JSON.parse));
const root=rows.find(r=>r.name==='test:root');assert.ok(root);
assert.equal(rows.find(r=>r.name==='test:left').parent,root.id);assert.equal(rows.find(r=>r.name==='test:right').parent,root.id);
assert.equal(rows.filter(r=>r.blocked).length,3);
console.log(JSON.stringify({checks:8,remoteNetwork:0,blockedWrites:3,parallelParentage:'PASS',nullSingleExecution:'PASS'}));
