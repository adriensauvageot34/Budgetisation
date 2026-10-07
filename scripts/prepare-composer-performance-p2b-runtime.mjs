// Build-local diagnostics in a marked disposable copy, never production logs.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { instrumentPresenceSource, replaceFunction, presenceFile } from './lib/m7-presence-audit.mjs';
const runtime=path.resolve(process.argv[2]??'');
if(!process.argv[2]||!fs.existsSync(path.join(runtime,'audit-instrumentation.json'))||fs.existsSync(path.join(runtime,'.git')))
  throw new Error('MARKED_DISPOSABLE_RUNTIME_REQUIRED');
execFileSync(process.execPath,['scripts/prepare-composer-performance-p2a-runtime.mjs',runtime],{stdio:'inherit',windowsHide:true});
const target=path.join(runtime,presenceFile);
let code=instrumentPresenceSource(fs.readFileSync(target,'utf8'));
code=replaceFunction(code,'buildGlobalM7MobilityContextAuthority',body=>`{
  if(process.env.COMPOSER_PERF_CAPTURE_M7==='1')require('node:fs').writeFileSync(process.env.COMPOSER_PERF_M7_INPUT,JSON.stringify(input));
  ${body}}`);
fs.writeFileSync(target,code);
const index='src/analytics/global-v2/mobility-presence-index.ts';
if(fs.existsSync(index)){
  let source=fs.readFileSync(index,'utf8');
  for(const marker of ['prepare(0, entries.length);','catch { return visits; }'])
    if(source.split(marker).length!==2)throw new Error('INDEX_AUDIT_MARKER_REQUIRED');
  source=source.replace('prepare(0, entries.length);', `prepare(0, entries.length);
    const c=(globalThis as any).__auditWorkCounts;
    if(c){c.indexEntries=(c.indexEntries??0)+entries.length;c.invalidFallbackEntries=(c.invalidFallbackEntries??0)+fallback.length;c.indexPersonCount=(c.indexPersonCount??0)+1;}`);
  source=source.replace('catch { return visits; }', `catch { const c=(globalThis as any).__auditWorkCounts;if(c)c.invalidQueryFallbacks=(c.invalidQueryFallbacks??0)+1;return visits; }`);
  source=replaceFunction(source,'createPresenceIntervalIndex',body=>`{
    const c=(globalThis as any).__auditWorkCounts,t=performance.now(),heap=process.memoryUsage().heapUsed;
    const query=(()=>{${body}})();
    if(c){c.indexBuildMs=(c.indexBuildMs??0)+performance.now()-t;c.indexHeapDeltaBytes=(c.indexHeapDeltaBytes??0)+process.memoryUsage().heapUsed-heap;}
    return interval=>{const t=performance.now();if(c)c.indexLookupCalls=(c.indexLookupCalls??0)+1;try{return query(interval);}finally{if(c)c.indexLookupMs=(c.indexLookupMs??0)+performance.now()-t;}};
  }`);
  fs.writeFileSync(path.join(runtime,index),source);
}
console.log(JSON.stringify({runtime,actualCode:true,indexPresent:fs.existsSync(index)}));
