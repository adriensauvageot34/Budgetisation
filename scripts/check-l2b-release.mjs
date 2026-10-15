import fs from 'node:fs';
import {spawnSync} from 'node:child_process';
const dir='docs/status/evidence/l2b-composer-library';fs.mkdirSync(dir,{recursive:true});
const files=['check-l2a-presets.mjs','check-l1-restaurant.mjs','check-phase2-planner-composer.mjs','check-phase2-planner-p12.mjs','check-phase2-planner-p13.mjs','check-phase2-planner-kernel.mjs','check-composer-post-snap3-draft-http.mjs','check-composer-p14-p2-scheduler.mjs','check-b3-transverse-plan.mjs','check-planner-performance-parity.mjs'];
const results=[];
for(const file of files){const start=Date.now();const r=spawnSync(process.execPath,['scripts/'+file],{encoding:'utf8',maxBuffer:8000000});fs.writeFileSync(dir+'/'+file.replace('.mjs','.log'),(r.stdout??'')+(r.stderr??'')+(r.error?.message??''));
results.push({file,exitCode:r.status,error:r.error?.code,elapsedMs:Date.now()-start});console.log(JSON.stringify(results.at(-1)));fs.writeFileSync(dir+'/regressions.json',JSON.stringify(results,null,2)+'\n');}
process.exitCode=results.some(r=>r.exitCode!==0)?1:0;

