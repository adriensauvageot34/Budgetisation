import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
const dir='docs/status/evidence/bar-apero-350/';
const read=name=>JSON.parse(fs.readFileSync(dir+name,'utf8'));
export function sourceRequirements(text){
 let category=null,title=null;const rows=[];
 for(const line of text.split(/\r?\n/u)){
  const heading=/^## ([A-M])\. (.+) — (\d+) recommandations$/u.exec(line);
  if(heading){category=heading[1];title=heading[2];}
  const item=/^- \*\*(R\d{3})\*\* — (.+)$/u.exec(line);
  if(item){assert.ok(category,'Recommendation without owner');rows.push({id:item[1],description_originale:item[2],chantier:category,chantier_original:title,vague:({A:1,B:1,C:1,D:2,E:2,F:3,G:3,H:4,I:4,J:4,K:5,L:5,M:6})[category]});}
 }
 return rows.sort((a,b)=>a.id.localeCompare(b.id));
}
export const statuses=new Set(['PLANNED','IN_PROGRESS','ALREADY_DONE_VERIFIED','ALREADY_DONE_UNVERIFIED','DONE_STATIC','DONE_BROWSER_FIXTURE','DONE_PREVIEW','DONE_AUTH_REAL','PARTIAL','BLOCKED_OWNER','BLOCKED_ENV','NOT_RUN','DEFERRED_USER','REGRESSION']);
export function check(overrides={}){
 const manifest=read('source-manifest.json'),evidence=overrides.evidence??read('evidence.json'),rows=overrides.rows??read('requirements.json');
 const original=fs.readFileSync(dir+'source-master.md');
 assert.equal(crypto.createHash('sha256').update(original.toString('utf8').replaceAll('\r\n','\n')).digest('hex'),manifest.sha256_normalized_lf,'Master text changed');
 const source=sourceRequirements(original.toString('utf8'));
 const grouped=sourceRequirements(fs.readFileSync(dir+'source-grouped.md','utf8'));assert.deepEqual(source,grouped,'Grouped source diverges');
 assert.equal(source.length,350);assert.equal(rows.length,350);
 assert.equal(new Set(rows.map(r=>r.id)).size,350,'Duplicate IDs');
 const byId=new Map(rows.map(r=>[r.id,r]));
 for(let n=1;n<=350;n++)assert.ok(byId.has('R'+String(n).padStart(3,'0')));
 const knownShas=new Map();
 const shaExists=sha=>{if(knownShas.has(sha))return knownShas.get(sha);let exists=false;try{exists=execFileSync('git',['cat-file','-t',sha],{encoding:'utf8'}).trim()==='commit';}catch{}knownShas.set(sha,exists);return exists;};
 for(const expected of source){
  const row=byId.get(expected.id);for(const key of Object.keys(expected))assert.equal(row[key],expected[key],`${row.id} changed ${key}`);
  assert.ok(statuses.has(row.statut),`${row.id} unknown status`);
  for(const key of ['localisation','baseline','action_requise','preuves','sha_preuve','environnement','reste','blocage','fichiers_modifiés'])assert.ok(key in row,`${row.id} missing ${key}`);
  const done=row.statut.startsWith('DONE')||row.statut==='ALREADY_DONE_VERIFIED';
  if(done){assert.ok(row.preuves.length,`${row.id} missing evidence`);assert.ok(row.sha_preuve,`${row.id} missing SHA`);}
  const levels=row.preuves.map(key=>evidence[key]?.niveau??'');
  if(row.statut==='DONE_AUTH_REAL')assert.ok(levels.includes('PASS_AUTH_REAL'),`${row.id} Auth not executed`);
  if(row.statut==='DONE_BROWSER_FIXTURE')assert.ok(levels.some(level=>level.includes('BROWSER_FIXTURE')),`${row.id} browser not executed`);
  if(row.statut==='DONE_PREVIEW')assert.ok(levels.includes('PASS_PREVIEW'),`${row.id} Preview functional test not executed`);
  if(row.sha_preuve&&!shaExists(row.sha_preuve))assert.equal(row.qualification_sha,'HISTORICAL',`${row.id} unqualified unknown SHA`);
  for(const key of row.preuves){const proof=evidence[key];assert.ok(proof,`${row.id} missing ${key}`);assert.ok(fs.existsSync(proof.path),`${key} absent file`);assert.ok(proof.sha&& (shaExists(proof.sha)||proof.qualification==='HISTORICAL'),`${key} unknown SHA`);
    const digest=crypto.createHash('sha256').update(fs.readFileSync(proof.path,'utf8').replaceAll('\r\n','\n')).digest('hex');assert.equal(proof.file_sha256_lf,digest,`${key} evidence bytes changed`);}
 }
 const counts=key=>Object.fromEntries([...new Set(source.map(r=>r[key]))].map(k=>[k,rows.filter(r=>r[key]===k).length]));
 assert.deepEqual(counts('chantier'),manifest.chantiers);assert.deepEqual(counts('vague'),manifest.vagues);
 const pending=rows.some(r=>!r.statut.startsWith('DONE')&&r.statut!=='ALREADY_DONE_VERIFIED');
 const report='docs/status/BAR_APERO_350_RECONCILIATION_FINAL_RECEPTION.md';
 if(pending&&fs.existsSync(report))assert.ok(!/(?:350\/350 (?:réalisé|PASS)|READY_FOR_REPLICATION\s*[=:]\s*(?:PASS|true))/iu.test(fs.readFileSync(report,'utf8')),'Unjustified completion claim');
 const summary={total:rows.length,chantiers:counts('chantier'),vagues:counts('vague'),statuts:Object.fromEntries([...statuses].map(k=>[k,rows.filter(r=>r.statut===k).length]).filter(([,n])=>n))};
 if(overrides.verbose!==false)console.log(JSON.stringify({integrity:'PASS',...summary}));return summary;
}
if(process.argv[1]?.replaceAll('\\','/').endsWith('/check-bar-apero-350.mjs'))check();
