import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
const out='docs/status/evidence/pre-l4-final';
fs.mkdirSync(out,{recursive:true});
const before=new Map();
function walk(dir){for(const e of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,e.name);if(p.replaceAll('\\','/').startsWith(out))continue;if(e.isDirectory())walk(p);else before.set(p,fs.readFileSync(p));}}
walk('docs/status/evidence');
const files=['check-pre-l4-c1.mjs','check-pre-l4-c2.mjs','check-l3-3-workshop.mjs','check-phase2-planner-kernel.mjs','check-phase2-planner-simple-levers.mjs','check-phase2-planner-renewals.mjs','check-phase2-savings-allocations.mjs','check-b3-transverse-plan.mjs','check-composer-post-snap3-draft-http.mjs','check-phase2-planner-p13.mjs','check-composer-p14-p2-scheduler.mjs','check-l1-restaurant.mjs','check-l3-1-ux.mjs','check-composer-r6-presentation.mjs','check-phase2-planner-composer.mjs','check-planner-performance-parity.mjs'];
const results=[];
try{for(const file of files){const startedAt=new Date().toISOString();const r=spawnSync(process.execPath,['scripts/'+file],{encoding:'utf8',maxBuffer:8000000,env:{...process.env,PLANNER_C8_REPORT_PATH:out+'/c8.json',P14_P2_SCHEDULER_REPORT:out+'/scheduler.json'}});fs.writeFileSync(out+'/'+file.replace('.mjs','.log'),(r.stdout??'')+(r.stderr??'')+(r.error?.message??''));results.push({file,startedAt,finishedAt:new Date().toISOString(),exitCode:r.status});console.log(JSON.stringify(results.at(-1)));}}
finally{for(const[p,b]of before)if(fs.existsSync(p)&&!fs.readFileSync(p).equals(b))fs.writeFileSync(p,b);fs.writeFileSync(out+'/regressions.json',JSON.stringify(results,null,2)+'\n');}
process.exitCode=results.some(r=>r.exitCode!==0)?1:0;
