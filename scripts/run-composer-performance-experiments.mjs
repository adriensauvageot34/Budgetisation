// Serial local replay: one variable per variant, identical private GET responses.
import fs from 'node:fs';
import path from 'node:path';
import {spawn,execFileSync} from 'node:child_process';
const [runtime,endpoint,output,names='instant-memo,zone-memo,recompile-empty,combined',count='5']=process.argv.slice(2),repo=process.cwd();
const baseline=JSON.parse(fs.readFileSync(path.join(output,'experiments/baseline/owner-runs.json'),'utf8'));
const keys=['semanticDigest','baselineDigest','projectionDigest','cardsDigest','capabilitiesDigest','manifestDigest','unknownDigest','uiBytes','counts'];
const failed=r=>!r.semanticDigest||r.error;
if(baseline.some(failed))throw new Error('SUCCESSFUL_BASELINE_REQUIRED');
const reset=()=>execFileSync(process.execPath,['scripts/audit-composer-performance-experiment.mjs',runtime,'baseline'],{cwd:repo,stdio:'inherit',windowsHide:true});
try{
 for(const name of names.split(',')){
  reset();execFileSync(process.execPath,['scripts/audit-composer-performance-experiment.mjs',runtime,name],{cwd:repo,stdio:'inherit',windowsHide:true});
  const out=path.join(output,'experiments',name);
  const env={...process.env,COMPOSER_PERF_OUTPUT:out,COMPOSER_PERF_REPLAY:path.join(output,'owner-baseline/private-replay'),COMPOSER_PERF_LATENCY_SCALE:'0',COMPOSER_PERF_ASOF:'2026-10-06T21:00:00Z',COMPOSER_PERF_FREEZE_CLOCK:'1',COMPOSER_PERF_PRIVATE_QUERIES:'0'};
  const code=await new Promise(resolve=>{const child=spawn(process.execPath,['--env-file=.env.local','--require','./scripts/lib/composer-performance-probe.cjs','scripts/audit-composer-performance-headless.mjs',runtime,endpoint,out,count],{cwd:repo,env,windowsHide:true,stdio:'inherit'});child.on('exit',resolve);});
  if(code!==0)throw new Error('EXPERIMENT_PROCESS_FAILED:'+name);
  const rows=JSON.parse(fs.readFileSync(path.join(out,'owner-runs.json'),'utf8'));
  const parity=rows.length===Number(count)&&rows.every(r=>!failed(r)&&keys.every(k=>JSON.stringify(r[k])===JSON.stringify(baseline[0][k])));
  fs.writeFileSync(path.join(out,'parity.json'),JSON.stringify({variant:name,parity,comparedFields:keys,network:'OFFLINE_REPLAY',productChanged:false},null,2));
  console.log(JSON.stringify({variant:name,parity}));if(!parity)throw new Error('EXPERIMENT_PARITY_FAILED:'+name);
 }
}finally{
 execFileSync(process.execPath,['scripts/audit-composer-performance-runtime.mjs',runtime,'--refresh-probes'],{cwd:repo,stdio:'inherit',windowsHide:true});
 fs.copyFileSync(path.join(repo,'src/core/time/values.ts'),path.join(runtime,'src/core/time/values.ts'));
 console.log('EXPERIMENTAL_PATCHES_RESTORED');
}
