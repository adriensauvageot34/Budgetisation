import fs from 'node:fs';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {check} from './check-bar-apero-350.mjs';
const dir='docs/status/evidence/bar-apero-350/',rdir=dir+'residual23/';
const read=name=>JSON.parse(fs.readFileSync(rdir+name,'utf8'));
for(const file of read('files-sha256.json').files){const bytes=fs.readFileSync(rdir+file.name);const content=file.method==='utf8_normalized_lf'?bytes.toString('utf8').replaceAll('\r\n','\n'):bytes;assert.equal(crypto.createHash('sha256').update(content).digest('hex'),file.sha256,file.name+' evidence content changed');}
const base=JSON.parse(execFileSync('git',['show','8998ba8f82a3ab72e7d60619bc8c0c81174ce15a:'+dir+'requirements.json'],{encoding:'utf8'}));
// This is an immutable historical reception, followed by the residual16 layer.
const rows=JSON.parse(execFileSync('git',['show','264dfce70e3c94248ccb691d8348da8020cd84c7:'+dir+'requirements.json'],{encoding:'utf8'})),transitions=read('transitions-23.json');
const pending=base.filter(r=>!r.statut.startsWith('DONE')&&r.statut!=='ALREADY_DONE_VERIFIED');
assert.equal(pending.length,23);assert.equal(transitions.length,23);
assert.deepEqual(transitions.map(r=>r.id).sort(),pending.map(r=>r.id).sort());
for(const old of base){const row=rows.find(r=>r.id===old.id),transition=transitions.find(r=>r.id===old.id);
  if(!transition){assert.deepEqual(row,old,old.id+' acquired evidence changed');continue;}
  assert.equal(transition.description_originale,old.description_originale);
  assert.deepEqual(transition.avant,{statut:old.statut,reste:old.reste});
  assert.deepEqual(transition.apres,{statut:row.statut,reste:row.reste});
  assert.equal(transition.sha,row.sha_preuve);assert.ok(transition.raison&&transition.preuves.length);
}
const closed=transitions.filter(t=>t.apres.statut==='DONE_BROWSER_FIXTURE').map(t=>t.id);
assert.deepEqual(closed,['R030','R084','R307','R308','R315','R328','R343']);
assert.deepEqual(rows.find(r=>r.id==='R337'),base.find(r=>r.id==='R337'),'Auth HTTP evidence must remain intact');
const exclusion=rows.find(r=>r.id==='R030').scope_exclusions[0];
assert.equal(exclusion.status,'OUT_OF_SCOPE_USER_APPROVED');assert.equal(exclusion.not_a_pass,true);
const geo=read('geometry.json');assert.equal(geo.length,9);
for(const width of [1152,1440,1920])for(const scene of ['summary','drinks','date']){
 const r=geo.find(r=>r.label===width+'-'+scene);assert.equal(r.scene,scene);assert.equal(r.viewport[0],width);assert.equal(r.collisions,0);
 assert.ok(r.card.scroll[2]<=r.card.scroll[3]+2,'Internal card overflow');
 if(r.dock)assert.ok(r.dock.scroll[0]<=r.dock.scroll[1]+2,'Internal dock overflow');
 assert.notEqual(r.focus,'BODY');
}
const drag=read('drag-final.json'),cancel=read('drag-cancel-final.json');
assert.ok(drag.latency.events.some(e=>e.name==='drop'&&e.category==='TRASH'));
assert.ok(drag.latency.states.some(s=>!s.barPresent));
assert.ok(drag.latency.states.some(s=>s.barPresent&&s.save==='SAVED'&&s.preview==='FRESH'));
assert.equal(drag.trashPresent,false);assert.equal(cancel.trashPresent,false);assert.equal(cancel.barPresent,true);
for(const value of ['Bar du Canal','8,00','9,00','20,00','12,00'])assert.ok(drag.card.includes(value));
assert.equal(drag.focus,'Bar / Apéro');
const raw=read('raw-keyboard-final.json');assert.equal(raw.raw,'8,');assert.equal(raw.focus,'Prix unitaire (€)');assert.equal(raw.applyDisabled,true);
const m=read('metrics.json');assert.equal(m.price.n,40);assert.equal(m.price.captureSaturated,false);assert.equal(m.price.financialRequestsDuringRaw,0);
assert.equal(m.withdrawals.baseline.rows.length,6);assert.equal(m.withdrawals.candidate.rows.length,6);
assert.ok(m.contrast.every(c=>c.ratio>=4.5));
const tests=read('tests.json');assert.equal(tests.length,8);assert.ok(tests.every(t=>t.exitCode===0&&t.sha===m.productSha));
assert.match(fs.readFileSync(rdir+'test-parity.log','utf8'),/"cases":22,"hashesPerCase":9,"parity":"PASS"/);
const preview=read('vercel.json');assert.equal(preview.sha,m.productSha);assert.equal(preview.state,'READY');assert.equal(preview.production,false);
assert.equal(read('zoom-native-attempt.json').verdict,'NOT_VERIFIABLE');
const counts=check({verbose:false});assert.equal(counts.total,350);
console.log('RESIDUAL23_HISTORICAL_TRACE_PASS: 327 acquired rows intact; 7 desktop closures, then 16 open. Current transitions checked by residual16 gate. Not Auth UI or provider certification.');
