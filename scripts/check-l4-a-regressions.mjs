import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
const out='docs/status/evidence/l4-a';fs.mkdirSync(out,{recursive:true});
const prior=new Map();
function remember(dir){for(const entry of fs.readdirSync(dir,{withFileTypes:true})){const file=path.join(dir,entry.name);if(file.replaceAll('\\','/').startsWith(out))continue;if(entry.isDirectory())remember(file);else prior.set(file,fs.readFileSync(file));}}
remember('docs/status/evidence');
const files=['check-l4-a-minimal.mjs','check-l4-a-base-p09.mjs','check-phase2-planner-p09.mjs','check-pre-l4-c1.mjs','check-pre-l4-c2.mjs','check-composer-post-snap3-draft-http.mjs','check-composer-p14-p2-scheduler.mjs','check-phase2-planner-p13.mjs','check-phase2-planner-mobility.mjs','check-phase2-planner-contexts.mjs','check-phase2-planner-kernel.mjs','check-l1-restaurant.mjs','check-planner-performance-parity.mjs'];
const results=[];
try{for(const file of files){const startedAt=new Date().toISOString();const result=spawnSync(process.execPath,['scripts/'+file],{encoding:'utf8',maxBuffer:8000000,env:{...process.env,P14_P2_SCHEDULER_REPORT:out+'/scheduler.json'}});
  fs.writeFileSync(out+'/'+file.replace('.mjs','.log'),(result.stdout??'')+(result.stderr??'')+(result.error?.message??''));
  results.push({file,startedAt,finishedAt:new Date().toISOString(),exitCode:result.status});console.log(JSON.stringify(results.at(-1)));}}
finally{for(const[file,bytes]of prior)if(fs.existsSync(file)&&!fs.readFileSync(file).equals(bytes))fs.writeFileSync(file,bytes);fs.writeFileSync(out+'/regressions.json',JSON.stringify(results,null,2)+'\n');}
process.exitCode=results.some(result=>result.exitCode!==0)?1:0;
