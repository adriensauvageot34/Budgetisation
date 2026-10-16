import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
const out='docs/status/evidence/pre-l4-c1';fs.mkdirSync(out,{recursive:true});
const files=['check-phase2-planner-simple-levers.mjs','check-phase2-planner-renewals.mjs','check-phase2-planner-kernel.mjs',
 'check-phase2-planner-p13.mjs','check-composer-post-snap3-draft-http.mjs','check-composer-p14-p2-scheduler.mjs',
 'check-l3-3-workshop.mjs','check-planner-performance-parity.mjs','check-l3-1-ux.mjs'];
// Existing suites write their historical reports. Preserve those bytes and keep
// this run's outputs under C1, without rewriting previously accepted evidence.
const before=new Map();
function walk(dir){for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
 const p=path.join(dir,entry.name);if(p.replaceAll('\\','/').startsWith(out))continue;
 if(entry.isDirectory())walk(p);else if(/\.(json|md|log|txt)$/.test(entry.name))before.set(p,fs.readFileSync(p));
}}
walk('docs/status/evidence');
const results=[];
try{for(const file of files){const started=Date.now();const r=spawnSync(process.execPath,['scripts/'+file],{encoding:'utf8',maxBuffer:8000000,
 env:{...process.env,PLANNER_C8_REPORT_PATH:out+'/c8.json',P14_P2_SCHEDULER_REPORT:out+'/scheduler.json'}});
 fs.writeFileSync(out+'/'+file.replace('.mjs','.log'),(r.stdout??'')+(r.stderr??'')+(r.error?.message??''));
 const result={file,exitCode:r.status,elapsedMs:Date.now()-started};results.push(result);
 fs.writeFileSync(out+'/regressions.json',JSON.stringify(results,null,2)+'\n');console.log(JSON.stringify(result));}}
finally{for(const[p,bytes]of before){if(fs.existsSync(p)&&!fs.readFileSync(p).equals(bytes)){
 fs.copyFileSync(p,out+'/rerun-'+path.relative('docs/status/evidence',p).replaceAll(path.sep,'-'));fs.writeFileSync(p,bytes);
}}}
process.exitCode=results.some(r=>r.exitCode!==0)?1:0;
