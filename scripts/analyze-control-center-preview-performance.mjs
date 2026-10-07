// P2-B.6: count real reads by HTTP owner; publish hashes and timings only.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
const root=process.argv[2];assert.ok(root,'AUDIT_ROOT_REQUIRED');
const load=name=>JSON.parse(fs.readFileSync(path.join(root,name),'utf8'));
const runs=[...load('before/runs.json'),...load('after/runs.json')];
fs.mkdirSync(path.join(root,'controlled'),{recursive:true});
fs.writeFileSync(path.join(root,'controlled/runs.json'),JSON.stringify(runs));
execFileSync(process.execPath,['scripts/analyze-composer-navigation.mjs',root],{stdio:'pipe'});
const generic=load('public-summary.json');
const controls={};
for(const variant of ['a','b'])controls[variant]=fs.readdirSync(path.join(root,'server-'+variant)).filter(f=>/^control-.*\.jsonl$/.test(f)).flatMap(f=>fs.readFileSync(path.join(root,'server-'+variant,f),'utf8').trim().split('\n').filter(Boolean).map(JSON.parse));
const stats=values=>{const v=values.filter(Number.isFinite).sort((a,b)=>a-b),n=v.length;return n?{n,min:v[0],median:n%2?v[(n-1)/2]:(v[n/2-1]+v[n/2])/2,max:v.at(-1),p95:v[Math.ceil(n*.95)-1]}:null};
for(const row of generic.rows){const run=runs.find(r=>r.id===row.id);const found=controls[row.variant].filter(c=>c.at>=run.trialStart&&c.at<=run.trialEnd);
 row.controlResults=found;row.centreInitialUiDigest=run.centreInitialUiDigest??null;row.centreFinalUiDigest=run.centreFinalUiDigest??null;
 row.pilotVisibleToClickMs=run.pilotVisibleAt?run.clickAt-run.pilotVisibleAt:null;
 row.totalBusinessGETs=row.centreGETs+row.previewGETs+row.composerGETs;
 row.previewStarted=row.allowedReadOnlyActionPosts>0;row.previewCompleted=row.previewStatus===200;
 row.serverCpuMs=run.serverCpuBefore&&run.serverCpuAfter?(run.serverCpuAfter.cpu.user+run.serverCpuAfter.cpu.system-run.serverCpuBefore.cpu.user-run.serverCpuBefore.cpu.system)/1000:null;
}
const grouped={};
for(const variant of ['a','b'])for(const mode of ['client','center','hard']){const rows=generic.rows.filter(r=>r.variant===variant&&r.mode===mode&&!r.id.includes('interaction'));
 grouped[variant+'-'+mode]=Object.fromEntries(['tti','endToEnd','centreMs','centreToClickMs','pilotVisibleToClickMs','previewMs','previewOverlapMs','firstHeaderVsClickMs','firstChunkVsClickMs','rscCompletedVsClickMs','boardVsClickMs','serverCpuMs'].map(k=>[k,stats(rows.map(r=>r[k]))]));}
const output={...generic,schema:'control-center-preview-performance@1',grouped,pairs:[],confidence:null,pairedDifference:null,
 note:generic.note+' Before/after production series are sequential, not randomized pairs. CPU delta covers parent document through native TTI, not preview CPU alone. Centre controls stop after readonly action completion; full model/workbench hashes are authoritative parity oracles.'};
fs.writeFileSync(path.join(root,'p2b6-public-summary.json'),JSON.stringify(output,null,2)+'\n');
if(process.argv.includes('--certify')){
 const rows=output.rows,composers=rows.filter(r=>r.mode!=='center'),centres=rows.filter(r=>r.mode==='center'),rapid=rows.filter(r=>r.mode==='client');
 for(const variant of ['a','b']){assert.equal(rapid.filter(r=>r.variant===variant).length,12);assert.equal(centres.filter(r=>r.variant===variant&&!r.id.includes('interaction')).length,3);assert.equal(rows.filter(r=>r.variant===variant&&r.mode==='hard').length,3)}
 assert.ok(rows.every(r=>!r.failed&&!r.blocked&&!r.browserExceptions&&r.interaction.empty&&!r.businessFetchErrors.length));
 assert.equal(output.remoteWrites,0);
 assert.ok(rows.every(r=>r.browserNetwork.failedRequests.every(e=>e.canceled&&e.status===200)),'Actual transport failure invalidates series');
 assert.ok(composers.every(r=>r.composerStatus===200&&r.composerGETs===291&&r.dynamicCutoffs===1&&r.queryComparableHash===composers[0].queryComparableHash));
 assert.ok(composers.every(r=>r.payload&&JSON.stringify(r.payload)===JSON.stringify(composers[0].payload)),'Complete Composer DTO parity');
 assert.ok(rapid.every(r=>r.centreGETs===45&&r.previewGETs===(r.previewStarted?27:0)&&r.totalBusinessGETs===(r.previewStarted?363:336)));
 const beforeRapid=rapid.filter(r=>r.variant==='a'),afterRapid=rapid.filter(r=>r.variant==='b');
 assert.ok(beforeRapid.every(r=>r.previewStarted));
 assert.ok(afterRapid.filter(r=>!r.previewStarted).length>=10,'At least ten observed exits must eliminate the action and all 27 reads');
 assert.ok(afterRapid.filter(r=>r.previewStarted).every(r=>r.pilotVisibleToClickMs>=800),'A rapid exit must not start preview; delayed dispatch incidents are retained explicitly');
 assert.ok(rapid.filter(r=>r.variant==='a').every(r=>r.previewCompleted));
 assert.ok(afterRapid.every(r=>r.previewStarted?r.previewCompleted&&r.controlResults.length===2:!r.previewCompleted&&r.previewOverlapMs===0&&r.controlResults.length===1));
 assert.ok(centres.every(r=>r.centreGETs===45&&r.previewGETs===27&&r.previewCompleted&&r.controlResults.length===2));
 const initial=rows.flatMap(r=>r.controlResults.filter(c=>c.owner.endsWith(':MonthForecastPage'))),preview=rows.flatMap(r=>r.controlResults.filter(c=>c.owner.endsWith(':previewMonthControlCenter')));
 assert.ok(initial.every(c=>c.fullDigest===initial[0].fullDigest&&c.modelDigest===initial[0].modelDigest));
 assert.ok(preview.every(c=>c.fullDigest===preview[0].fullDigest&&c.modelDigest===initial[0].modelDigest),'Whole workbench and Centre model parity');
 assert.ok(centres.filter(r=>!r.id.includes('interaction')).every(r=>r.centreInitialUiDigest===centres[0].centreInitialUiDigest&&r.centreFinalUiDigest===centres[0].centreFinalUiDigest));
 assert.ok(rows.filter(r=>r.mode==='hard').every(r=>r.centreGETs===0&&r.previewGETs===0&&!r.previewStarted));
 assert.ok(rows.every(r=>r.prefetches.every(p=>p.businessGETs===0)));
 console.log('P2B6_READONLY_MEASUREMENT_CERTIFICATION PASS');
}
console.log(JSON.stringify({completed:runs.length,grouped,remoteWrites:output.remoteWrites}));
