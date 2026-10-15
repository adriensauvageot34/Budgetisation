import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
const directory='docs/status/evidence/l2a-composer-presets';
const files=['check-l1-restaurant.mjs','check-phase2-planner-composer.mjs','check-phase2-planner-p09.mjs',
  'check-phase2-planner-p10.mjs','check-phase2-planner-p12.mjs','check-phase2-planner-p13.mjs',
  'check-phase2-planner-kernel.mjs','check-composer-post-snap3-draft-http.mjs','check-composer-p14-p2-scheduler.mjs'];
const results=[];
for(const file of files) {
  const started=Date.now();
  const r=spawnSync(process.execPath,['scripts/'+file],{encoding:'utf8',maxBuffer:8000000});
  fs.writeFileSync(directory+'/'+file.replace('.mjs','.log'),(r.stdout??'')+(r.stderr??'')+(r.error?.message??''));
  const result={file,exitCode:r.status,error:r.error?.code,elapsedMs:Date.now()-started};
  results.push(result);console.log(JSON.stringify(result));
  fs.writeFileSync(directory+'/regressions.json',JSON.stringify(results,null,2)+'\n');
}
process.exitCode=results.some(r=>r.exitCode!==0)?1:0;
