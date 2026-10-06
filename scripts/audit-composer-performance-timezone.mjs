// Paired microbenchmark of the existing validator, no business sources/network.
import fs from 'node:fs';
import {performance} from 'node:perf_hooks';
import {require} from './lib/phase2-ts-loader.mjs';
const {parseHouseholdTimeZone}=require('@/core/time');
globalThis.fetch=async()=>{throw new Error('TIMEZONE_BENCHMARK_NETWORK_FORBIDDEN');};
const [out,count='10767']=process.argv.slice(2);if(!out)throw new Error('OUTPUT_FILE_REQUIRED');
const memo=(value,cache)=>{if(cache.has(value))return value;const result=parseHouseholdTimeZone(value);cache.add(value);return result;};
const cases=['Europe/Paris','UTC','America/New_York','',null,123,' +01:00','+01:00','Mars/Fake'];
const outcome=fn=>{try{return {value:fn()};}catch(e){return {error:e.name,message:e.message};}};
const parity=cases.every(value=>JSON.stringify(outcome(()=>parseHouseholdTimeZone(value)))===JSON.stringify(outcome(()=>memo(value,new Set()))));
if(!parity)throw new Error('TIMEZONE_PARITY_FAILED');
parseHouseholdTimeZone('Europe/Paris');const rows=[];
for(let run=1;run<=5;run++)for(const variant of run%2?['baseline','memo']:['memo','baseline']){
 const cache=new Set(),start=performance.now(),cpuStart=process.cpuUsage();
 for(let i=0;i<Number(count);i++)variant==='baseline'?parseHouseholdTimeZone('Europe/Paris'):memo('Europe/Paris',cache);
 const cpu=process.cpuUsage(cpuStart);rows.push({run,variant,duration:performance.now()-start,cpuMs:(cpu.user+cpu.system)/1000,validations:variant==='baseline'?Number(count):1});
}
fs.writeFileSync(out,JSON.stringify({count:Number(count),parity,rows,remoteRequests:0},null,2));console.log(JSON.stringify({parity,rows}));
