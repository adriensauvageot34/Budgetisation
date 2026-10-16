import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
const out='docs/status/evidence/l3-1-composer-ux-finish';fs.mkdirSync(out,{recursive:true});
const generated=[['l3-composer-workshop/workshop-contracts.json','l3-contracts.json'],['l0-l1-composer-restaurant/contract-tests.json','l1-contracts.json'],
  ['l2a-composer-presets/contract-tests.json','l2a-contracts.json'],['l2b-composer-library/contract-tests.json','l2b-contracts.json'],['l2b-composer-library/option-reachability.json','option-reachability.json']];
const originals=new Map(generated.map(([file])=>[file,fs.existsSync('docs/status/evidence/'+file)?fs.readFileSync('docs/status/evidence/'+file):null]));
const files=['check-l3-1-ux.mjs','check-l3-workshop.mjs','check-composer-r6-p4.mjs','check-composer-r6-p45.mjs','check-composer-r6-presentation.mjs',
  'check-b0-b1-plan-forecast.mjs','check-l1-restaurant.mjs','check-l2a-presets.mjs','check-l2b-library.mjs','check-phase2-planner-composer.mjs',
  'check-phase2-planner-p13.mjs','check-phase2-planner-kernel.mjs','check-composer-post-snap3-draft-http.mjs','check-composer-p14-p2-scheduler.mjs','check-planner-performance-parity.mjs'];
const results=[];
try{for(const file of files){const start=Date.now(), result=spawnSync(process.execPath,['scripts/'+file],{encoding:'utf8',maxBuffer:8000000,
  env:{...process.env,L2B_REMAINING_ONLY:'1',PLANNER_C8_REPORT_PATH:out+'/c8.json',B0_B1_REPORT_PATH:out+'/b0-b1.json',P14_P2_SCHEDULER_REPORT:out+'/scheduler.json'}});
  fs.writeFileSync(out+'/'+file.replace('.mjs','.log'),(result.stdout??'')+(result.stderr??'')+(result.error?.message??''));
  results.push({file,exitCode:result.status,elapsedMs:Date.now()-start,...(file==='check-l2b-library.mjs'?{mode:'REMAINING_ONLY',presetRoundTrips:'Prior full L3 execution retained; unchanged preset recipes/library; no new 26-loop certification'}:{})});
  fs.writeFileSync(out+'/regressions.json',JSON.stringify(results,null,2)+'\n'); console.log(JSON.stringify(results.at(-1)));
}}finally{for(const[file,name]of generated){const target='docs/status/evidence/'+file;if(fs.existsSync(target))fs.copyFileSync(target,out+'/'+name);const before=originals.get(file);if(before)fs.writeFileSync(target,before);else if(fs.existsSync(target))fs.unlinkSync(target);}}
process.exitCode=results.some(r=>r.exitCode!==0)?1:0;
