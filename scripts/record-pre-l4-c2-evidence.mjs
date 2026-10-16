import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
const out='docs/status/evidence/pre-l4-c2',snapshots=[];
for(const scenario of ['L1_L33_DENSE_C2_AFTER','L1_L33_C2_GESTURES','DISSOLVE_BEAUTY']){
 const base='http://127.0.0.1:3218',e=await(await fetch(base+'/evidence?scenario='+scenario)).json();
 const d=await(await fetch(base+'/draft?scenario='+scenario)).json();
 assert.deepEqual(e.counts,{plans:0,revisions:0});assert.equal(e.rpcCalls,0);assert.equal(e.remoteWrites,0);assert.equal(e.historicalCanaryWrites,0);
 snapshots.push({scenario,counts:e.counts,rpcCalls:e.rpcCalls,remoteWrites:e.remoteWrites,historicalCanaryWrites:e.historicalCanaryWrites,
  log:e.log.map(r=>({kind:r.kind,sequence:r.sequence,digest:r.digest,ok:r.ok})),draft:e.drafts,semanticState:d.active?.semanticState??null});
}
const before=JSON.parse(fs.readFileSync(out+'/visual-reads-before.json','utf8'));
const after=snapshots[0];
assert.deepEqual(JSON.parse(JSON.stringify(after.log.map(({kind,sequence,digest})=>({kind,sequence,digest})))),before.log); // same projection; no extra request
fs.writeFileSync(out+'/browser-server-state.json',JSON.stringify({environment:'LOCAL_SYNTHETIC_ONLY',visualExtraRequests:0,snapshots},null,2)+'\n');
const bundle='outputs/pre-l4-c2-candidate',meta=JSON.parse(fs.readFileSync(bundle+'/bundle-meta.json','utf8'));
const wanted=['composer-shell.tsx','composer-board.tsx','composer.module.css','composer-card.tsx','composer-library.tsx','composer-financial-inspector.tsx','control-value-presentation.ts','inline-control-value.tsx','inline-edit-registry.tsx','board-carousel.tsx','visual-cluster.tsx','fixed-charges.tsx','local-draft.ts','preview-scheduler.ts','durable-draft.ts'];
const matched=new Map(),normalize=s=>s.replace(/\r\n/g,'\n');
for(const output of Object.keys(meta.outputs).filter(p=>p.endsWith('.map'))){const map=JSON.parse(fs.readFileSync(output,'utf8'));for(let i=0;i<map.sources.length;i++){
 const file=path.resolve(path.dirname(output),map.sources[i]);if(!wanted.includes(path.basename(file)))continue;
 assert.equal(normalize(map.sourcesContent[i]),normalize(fs.readFileSync(file,'utf8')),file);
 matched.set(path.basename(file),{file:path.relative(process.cwd(),file).replaceAll('\\','/'),sourceMatches:true});
}}
assert.deepEqual([...matched.keys()].sort(),wanted.sort());
fs.writeFileSync(out+'/bundle-identity.json',JSON.stringify({testedSha:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),mode:'PRODUCTION_MINIFIED_REACT_ESBUILD_FIXTURE',comparison:'LF_NORMALIZED_SOURCE_CONTENTS',bundleSha256:crypto.createHash('sha256').update(fs.readFileSync(bundle+'/app.js')).digest('hex'),modules:[...matched.values()]},null,2)+'\n');
const reference='outputs/pre-l4-c2-reference',refMeta=JSON.parse(fs.readFileSync(reference+'/bundle-meta.json','utf8')),refMatched=new Set();
for(const output of Object.keys(refMeta.outputs).filter(p=>p.endsWith('.map'))){const map=JSON.parse(fs.readFileSync(output,'utf8'));for(let i=0;i<map.sources.length;i++){
 const file=path.resolve(path.dirname(output),map.sources[i]);if(!wanted.includes(path.basename(file)))continue;
 const relative=path.relative(process.cwd(),file).replaceAll('\\','/');
 assert.equal(normalize(map.sourcesContent[i]),normalize(execFileSync('git',['show','fb71ae2:'+relative],{encoding:'utf8'})),relative);refMatched.add(relative);
}}
assert.equal(refMatched.size,wanted.length-1);
fs.writeFileSync(out+'/reference-bundle-identity.json',JSON.stringify({sha:'fb71ae2deb69a915bdf633b2ce721c4cf904821e',comparison:'LF_NORMALIZED_SOURCE_CONTENTS',modules:[...refMatched],bundleSha256:crypto.createHash('sha256').update(fs.readFileSync(reference+'/app.js')).digest('hex')},null,2)+'\n');
console.log('C2 BUNDLE, ZERO VISUAL REQUESTS, ZERO PLAN/APPLY/REMOTE/CANARY WRITES PASS');
