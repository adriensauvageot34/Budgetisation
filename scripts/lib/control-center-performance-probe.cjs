// Audit only: hashes of whole pure read results, never row bodies or credentials.
require('./composer-navigation-probe.cjs');
const fs=require('node:fs'),crypto=require('node:crypto');
const out=process.env.COMPOSER_PERF_OUTPUT,original=globalThis.__composerPerf;
const fingerprint=value=>crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
function snapshot(name,value){
 if(!value)return;
 const page=name.endsWith(':MonthForecastPage');
 if(!page&&![':projectMonthControlCenter',':previewMonthControlCenter'].some(s=>name.endsWith(s)))return;
 const model=page?value.props?.controlModel:name.endsWith(':previewMonthControlCenter')?value.model:value;
 if(!model)return;
 if(page)value=model;
 const result={type:'control-result',pid:process.pid,at:Date.now(),owner:name,targetMonth:model.targetMonth,baseDigest:model.baseDigest,
  fullDigest:fingerprint(value),modelDigest:fingerprint(model),bytes:Buffer.byteLength(JSON.stringify(value))};
 fs.appendFileSync(`${out}/control-${process.pid}.jsonl`,JSON.stringify(result)+'\n');
}
globalThis.__composerPerf=function(name,run){const value=original(name,run);return value&&typeof value.then==='function'?value.then(v=>{snapshot(name,v);return v}):(snapshot(name,value),value)};
