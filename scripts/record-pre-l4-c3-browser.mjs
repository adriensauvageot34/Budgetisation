import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
const out='docs/status/evidence/pre-l4-final';
const snapshots=[];
for(const scenario of ['L1_L33_C3_FLOW','L1_L33_C3_ERROR','L1_L33_DENSE_C3']){
 const url='http://127.0.0.1:3220';
 const e=await(await fetch(url+'/evidence?scenario='+scenario)).json();
 const d=await(await fetch(url+'/draft?scenario='+scenario)).json();
 assert.deepEqual(e.counts,{plans:0,revisions:0});assert.equal(e.rpcCalls,0);assert.equal(e.remoteWrites,0);assert.equal(e.historicalCanaryWrites,0);
 snapshots.push({scenario,counts:e.counts,rpcCalls:e.rpcCalls,remoteWrites:e.remoteWrites,historicalCanaryWrites:e.historicalCanaryWrites,log:e.log.map(({kind,sequence,digest,ok})=>({kind,sequence,digest,ok})),drafts:e.drafts,semanticState:d.active?.semanticState??null});
}
const flow=snapshots[0],error=snapshots[1],dense=snapshots[2];
const coffee=flow.semanticState.controls.find(c=>c.decisionSlotKey.includes('coffee'));
assert.equal(coffee.value.count,'13');assert.equal(coffee.value.unitAmount,'2.10');
assert.equal(flow.semanticState.controls.find(c=>c.decisionSlotKey.endsWith(':groceries')).value.amount,'300.00');
assert.equal(flow.semanticState.controls.find(c=>c.decisionSlotKey.endsWith(':clothing')).value.amount,'0.00');
const purchase=flow.semanticState.contexts.find(c=>c.fields.label==='Sacs-poubelle');assert.ok(purchase);
const item=purchase.slotSelections.item.items[0];assert.equal(item.cost.kind,'MANUAL');assert.equal(Number(item.cost.unitAmount),4);assert.equal(item.quantity,'1');assert.equal(item.binding.mode,'CONFIRMED_CONSUMPTION');
assert.equal(error.drafts.events.filter(e=>e.kind==='SAVE_FAILED_BEFORE_COMMIT').length,1);
assert.equal(error.drafts.events.filter(e=>e.kind==='SAVE').length,1);assert.equal(error.drafts.active.version,1);
assert.equal(error.log.filter(e=>e.kind==='NETWORK_FAILURE').length,1);
assert.equal(dense.drafts.active,null); // all dense operations were visual/RAW
fs.writeFileSync(out+'/browser-server-state.json',JSON.stringify({environment:'LOCAL_SYNTHETIC_ONLY',snapshots},null,2)+'\n');
const checks=JSON.parse(fs.readFileSync(out+'/browser-checks.json')).checks;
const get=id=>{const c=checks.find(c=>c.id===id);assert.ok(c,id);return c.state;};
const digest=s=>s.composer['data-digest'];
assert.equal(get('courses250-saved-fresh').composer['data-save-state'],'SAVED');
assert.equal(get('courses250-saved-fresh').composer['data-preview-state'],'FRESH');
for(const id of ['courses300-raw','courses300-escape'])assert.equal(digest(get(id)),digest(get('courses250-saved-fresh')));
assert.equal(get('courses300-raw').applyDisabled,true);assert.equal(get('courses300-raw').raw[0].value,'300');assert.match(get('courses300-raw').summary,/Saisie non validée/);
assert.deepEqual(get('courses300-escape').raw,[]);
assert.equal(digest(get('courses300-saved-fresh')),digest(get('courses300-reload')));
assert.notEqual(digest(get('courses300-saved-fresh')),digest(get('courses250-saved-fresh')));
assert.equal(get('save-error-preview-failed').composer['data-save-state'],'ERROR');
assert.equal(get('saved-but-preview-failed').composer['data-save-state'],'SAVED');
for(const id of ['save-error-preview-failed','saved-but-preview-failed']){assert.equal(get(id).composer['data-preview-state'],'FAILED');assert.equal(get(id).applyDisabled,true);}
assert.equal(get('preview-recovered-saved-fresh').composer['data-preview-state'],'FRESH');
for(const id of ['dense-raw-after-page','dense-raw-after-inspector']){assert.equal(get(id).raw[0].value,'300');assert.equal(get(id).applyDisabled,true);assert.equal(digest(get(id)),digest(get('dense-final-no-mutation')));}
const geometry=JSON.parse(fs.readFileSync(out+'/geometry.json')).geometry.filter(g=>g.id.startsWith('dense-error'));
assert.deepEqual(geometry.map(g=>g.viewport),[[1440,900],[1728,900],[1920,1080]]);
for(const g of geometry){assert.equal(g.overflow,false);assert.equal(g.raw,'2,345');assert.ok(g.input.x+g.input.width<=g.buttons[0].rect.x);assert.ok(g.buttons[0].rect.x+28<=g.buttons[1].rect.x);assert.ok(g.buttons[1].rect.x+28<=g.card.x+g.card.width);}
const bundle=process.env.C3_BUNDLE??'C:/Users/AdrienSauvageot/Documents/Codex/pre-l4-c2-validation-8978ac1/pre-l4-c2-candidate';
const meta=JSON.parse(fs.readFileSync(bundle+'/bundle-meta.json'));
const wanted=['composer-shell.tsx','composer-board.tsx','composer.module.css','composer-card.tsx','composer-library.tsx','composer-financial-inspector.tsx','control-value-presentation.ts','inline-control-value.tsx','inline-edit-registry.tsx','board-carousel.tsx','visual-cluster.tsx','fixed-charges.tsx','local-draft.ts','preview-scheduler.ts','durable-draft.ts'];
const matched=new Set(),norm=s=>s.replace(/\r\n/g,'\n');
for(const output of Object.keys(meta.outputs).filter(p=>p.endsWith('.map'))){
 const suffix=output.replaceAll('\\','/').split('pre-l4-c2-candidate/')[1];
 const map=JSON.parse(fs.readFileSync(path.join(bundle,suffix)));
 for(let i=0;i<map.sources.length;i++){
  const file=path.resolve(path.dirname(output),map.sources[i]);if(!wanted.includes(path.basename(file)))continue;
  assert.equal(norm(map.sourcesContent[i]),norm(fs.readFileSync(file,'utf8')),file);matched.add(path.basename(file));
 }
}
assert.deepEqual([...matched].sort(),wanted.sort());
const unchanged=execFileSync('git',['diff','0fc3d0882a649bf023b80edc83724aec43644d30','--name-only','--','src','supabase','public','package.json','package-lock.json','next.config.ts','vercel.json'],{encoding:'utf8'}).trim();assert.equal(unchanged,'');
const golden='scripts/fixtures/planner-performance-parity.json';
const current=fs.readFileSync(golden),before=execFileSync('git',['show','0fc3d0:'+golden]);
assert.equal(norm(current.toString()),norm(before.toString()));
fs.writeFileSync(out+'/bundle-identity.json',JSON.stringify({testedSha:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),productSourceSha:'8978ac18b0b4dbe0650c044b3ca086a54014ba8b',sameProductAsC2:true,mode:'PRODUCTION_MINIFIED_REACT_ESBUILD_FIXTURE',sourceContentsMatches:[...matched],bundleSha256:crypto.createHash('sha256').update(fs.readFileSync(bundle+'/app.js')).digest('hex'),goldenUnchanged:true,goldenSha256LF:crypto.createHash('sha256').update(norm(current.toString())).digest('hex')},null,2)+'\n');
console.log('C3 BROWSER STATE, RECOVERY, IDENTITIES, ZERO PLAN/APPLY/REMOTE/CANARY WRITES, BUNDLE AND GOLDEN IDENTITY PASS');
