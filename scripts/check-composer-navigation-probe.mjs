// Transport/privacy proof for the audit probe, ephemeral HTTP + mocked Supabase.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const out=fs.mkdtempSync(path.join(os.tmpdir(),'composer-navigation-probe-'));
process.env.COMPOSER_PERF_OUTPUT=out;
const original=globalThis.fetch;let remote=0;
globalThis.fetch=async(input,init)=>{if(String(input).includes('test.supabase.co')){remote++;return new Response('[]')}return original(input,init)};
createRequire(import.meta.url)('./lib/composer-navigation-probe.cjs');
const server=http.createServer((request,response)=>{response.setHeader('content-type','text/x-component');response.write('first');setTimeout(()=>response.end('second'),10)});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
try{
 await(await fetch(base+'/mois-a-venir/composer?month=2026-10',{headers:{RSC:'1','Next-Router-Prefetch':'1',Authorization:'private-synthetic-marker'}})).text();
 await(await fetch(base+'/mois-a-venir',{method:'POST',headers:{'Next-Action':'private-action-marker'},body:'private-body-marker'})).text();
 for(const [method,url]of [['POST','https://test.supabase.co/rest/v1/table'],['PATCH','https://test.supabase.co/rest/v1/table'],['GET','https://test.supabase.co/rest/v1/rpc/action']])await assert.rejects(()=>fetch(url,{method}),/REMOTE_WRITE_FORBIDDEN/);
 assert.equal(remote,0);
 await new Promise(r=>setTimeout(r,400));
 const text=fs.readdirSync(out).filter(f=>f.endsWith('.jsonl')).map(f=>fs.readFileSync(path.join(out,f),'utf8')).join('\n');
 assert.ok(!/private-(?:synthetic|action|body)-marker/.test(text),'Credentials, action IDs and bodies absent from diagnostic output');
 const rows=text.trim().split(/\r?\n/).filter(Boolean).map(JSON.parse),meta=rows.filter(r=>r.type==='http-navigation');
 assert.equal(meta.length,2);const get=meta.find(r=>r.method==='GET'),post=meta.find(r=>r.method==='POST');
 assert.equal(get.rsc,true);assert.equal(get.prefetch,true);assert.equal(get.month,'2026-10');assert.equal(get.bytesWritten,11);
 // A first write can implicitly flush headers inside the original write method.
 assert.ok(get.start<=get.headersAt&&get.headersAt<=get.end&&get.start<=get.firstWriteAt&&get.firstWriteAt<=get.end);
 assert.equal(post.action,true);assert.equal(post.rsc,false);assert.equal(post.status,200);
 console.log(JSON.stringify({streamMetadata:'PASS',privacy:'PASS',blockedRemoteWrites:3,actualRemoteNetwork:0}));
}finally{await new Promise(r=>server.close(r))}
