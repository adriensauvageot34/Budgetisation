import fs from 'node:fs';import assert from 'node:assert/strict';import {execFileSync} from 'node:child_process';
import {check} from './check-bar-apero-350.mjs';
const dir='docs/status/evidence/bar-apero-350/',rdir=dir+'residual16/',read=name=>JSON.parse(fs.readFileSync(rdir+name,'utf8'));
const baseline=JSON.parse(execFileSync('git',['show','264dfce70e3c94248ccb691d8348da8020cd84c7:'+dir+'requirements.json'],{encoding:'utf8'}));
const rows=JSON.parse(fs.readFileSync(dir+'requirements.json','utf8')),transitions=read('transitions-16.json');
assert.equal(transitions.length,16);assert.equal(new Set(transitions.map(t=>t.id)).size,16);
for(const old of baseline){const current=rows.find(r=>r.id===old.id),t=transitions.find(t=>t.id===old.id);
 if(!t){assert.deepEqual(current,old,old.id+' acquired row changed');continue;}
 assert.equal(t.description_originale,old.description_originale);assert.deepEqual(t.avant,{statut:old.statut,reste:old.reste,sha_preuve:old.sha_preuve,preuves:old.preuves,niveau_preuve:old.niveau_preuve,blocage:old.blocage});
 assert.deepEqual(t.apres,{statut:current.statut,reste:current.reste});assert.equal(t.sha,current.sha_preuve);assert.ok(t.action_suivante&&t.correctif&&t.niveau_preuve);
 assert.ok(old.preuves.every(p=>current.preuves.includes(p)),'Historical proofs removed');
}
assert.deepEqual(transitions.filter(t=>t.resultat==='CLOSED_AT_RECORDED_LEVEL').map(t=>t.id),['R208','R214','R255','R257','R276','R282']);
assert.deepEqual(rows.find(r=>r.id==='R337'),baseline.find(r=>r.id==='R337'),'Existing Auth HTTP certificate changed');
const matrix=fs.readFileSync(rdir+'matrix-16.md','utf8');for(const t of transitions)assert.equal(matrix.split('\n').filter(line=>line.startsWith('| '+t.id+' |')).length,1);
const geo=read('geometry.json');for(const width of [1152,1440,1728,1920])for(const scene of ['summary','closed']){const g=geo.find(g=>g.width===width&&g.scene===scene);assert.ok(g,width+scene+' absent');assert.equal(g.collisions.length,0);assert.equal(g.card.scroll[0],g.card.scroll[1]);assert.equal(g.card.scroll[2],g.card.scroll[3]);if(g.dock){assert.equal(g.dock.scroll[0],g.dock.scroll[1]);assert.equal(g.dock.scroll[2],g.dock.scroll[3]);}}
const raw=geo.find(g=>g.label==='1152-dense-raw');assert.equal(raw.focus,'Prix unitaire (€)');assert.ok(raw.card.text.includes('Bière'));
const google=read('google-browser.json');assert.equal(google.final.preview,'FRESH');assert.equal(google.final.save,'SAVED');for(const s of ['12,00','Prix à préciser','Bar Google synthétique','10 km'])assert.ok(google.final.card.text.includes(s));assert.ok(!google.final.card.text.includes('Consommations regroupées'));
assert.ok(read('undo-browser.json').card.text.includes('60,00'));
const domain=read('google-route.json');assert.ok(domain.checks.every(c=>c.status==='PASS'));assert.ok(read('economic-scope.json').checks.every(c=>c.status==='PASS'));
assert.match(fs.readFileSync(rdir+'test-parity-final.log','utf8'),/"cases":22,"hashesPerCase":9,"parity":"PASS"/);
const env=read('environment.json');assert.equal(env.remoteFinancialWrites,0);assert.equal(env.accountsChanged,false);assert.equal(env.h1Gate,'BLOCKED_OWNER');assert.equal(env.historicalDraftIncident,'HISTORICAL_INCIDENT_UNEXPLAINED');
for(const d of read('vercel.json').deployments){assert.equal(d.environment,'Preview');assert.equal(d.target,null);assert.equal(d.state,'READY');assert.equal(d.authProviderSmoke,'NOT_RUN_H1_BLOCKED');}
const counts=check({verbose:false});assert.equal(counts.total,350);assert.equal(counts.statuts.PARTIAL,6);assert.equal(counts.statuts.BLOCKED_OWNER,2);assert.equal(counts.statuts.BLOCKED_ENV,2);
console.log('RESIDUAL16_TRACE_PASS: 334 acquired rows unchanged; 6 closures at recorded fixture/static level; 10 open; no Auth/provider/zoom claim.');
