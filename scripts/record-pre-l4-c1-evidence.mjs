import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
const out='docs/status/evidence/pre-l4-c1';
const scenarios=['L1_L33_C1','L1_L33_DENSE_C1','L1_L33_C1_GROUP','L1_L33_C1_ASYNC'];
const snapshots=[];
for(const scenario of scenarios){
 const base='http://127.0.0.1:3216';
 const evidence=await (await fetch(base+'/evidence?scenario='+scenario)).json();
 const draft=await (await fetch(base+'/draft?scenario='+scenario)).json();
 assert.deepEqual(evidence.counts,{plans:0,revisions:0});assert.equal(evidence.rpcCalls,0);assert.equal(evidence.remoteWrites,0);assert.equal(evidence.historicalCanaryWrites,0);
 snapshots.push({scenario,counts:evidence.counts,rpcCalls:evidence.rpcCalls,remoteWrites:evidence.remoteWrites,historicalCanaryWrites:evidence.historicalCanaryWrites,
  reads:evidence.log.map(row=>({kind:row.kind,sequence:row.sequence,digest:row.digest,ok:row.ok})),
  drafts:evidence.drafts,storedControls:draft.active?.semanticState.controls??null,
  archives:draft.archives.map(archive=>({id:archive.draftId,version:archive.version,digest:archive.digest,controls:archive.semanticState.controls}))});
}
const recovered=snapshots.find(item=>item.scenario==='L1_L33_C1_ASYNC');
assert.equal(recovered.drafts.active,null);assert.equal(recovered.archives.length,1);
assert.deepEqual(recovered.archives[0].controls[0].value,{count:'16',unitAmount:'2.20'});
fs.writeFileSync(out+'/browser-server-state.json',JSON.stringify({environment:'LOCAL_SYNTHETIC_ONLY',snapshots},null,2)+'\n');
const bundle='outputs/pre-l4-c1-candidate',meta=JSON.parse(fs.readFileSync(bundle+'/bundle-meta.json','utf8'));
const wanted=['composer-shell.tsx','composer-board.tsx','composer.module.css','inline-control-value.tsx','inline-edit-registry.tsx','board-carousel.tsx','visual-cluster.tsx','local-draft.ts','preview-scheduler.ts','durable-draft.ts'];
const matched=new Map();
for(const output of Object.keys(meta.outputs).filter(name=>name.endsWith('.map'))){
 const map=JSON.parse(fs.readFileSync(output,'utf8'));
 for(let i=0;i<map.sources.length;i++){
  const file=path.resolve(path.dirname(output),map.sources[i]);if(!wanted.includes(path.basename(file)))continue;
  const normalize=text=>text.replace(/\r\n/g,'\n');
  assert.equal(normalize(map.sourcesContent[i]),normalize(fs.readFileSync(file,'utf8')),file);
  matched.set(path.basename(file),{file:path.relative(process.cwd(),file).replaceAll('\\','/'),sourceMatches:true});
 }
}
assert.deepEqual([...matched.keys()].sort(),wanted.sort());
fs.writeFileSync(out+'/browser-bundle-identity.json',JSON.stringify({productCommit:'6d9d2bee085437cfc087647b6de7d77278a098dd',mode:'production',minified:true,
 bundleSha256:crypto.createHash('sha256').update(fs.readFileSync(bundle+'/app.js')).digest('hex'),modules:[...matched.values()],comparison:'LF_NORMALIZED_SOURCE_CONTENTS'},null,2)+'\n');
console.log('C1-BROWSER-SERVER-CANARIES-AND-BUNDLE PASS');
