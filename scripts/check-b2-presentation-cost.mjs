// Same persisted synthetic input, old B1 view versus B2 view. CPU SSR only; no page-latency claim.
import fs from 'node:fs';
import path from 'node:path';
import Module from 'node:module';
import {execFileSync} from 'node:child_process';
import {performance} from 'node:perf_hooks';
process.env.NODE_ENV='production';
const {require}=await import('./lib/phase2-ts-loader.mjs');
const oldLoad=Module._load;
Module._load=function(name,...args){return name==='next/navigation'?{useRouter:()=>({refresh(){throw Error('B2_READ_ONLY');}})}:oldLoad.call(this,name,...args);};
globalThis.fetch=async()=>{throw Error('B2_NETWORK_FORBIDDEN');};
const React=require('react'),{renderToStaticMarkup}=require('react-dom/server'),ts=require('typescript');
const {persistedCase}=await import('./fixtures/b2-plan.mjs');
const file=path.resolve('src/app/mois-a-venir/applied-month-view.tsx');
const old=new Module(file);old.filename=file;old.paths=Module._nodeModulePaths(path.dirname(file));
old._compile(ts.transpileModule(execFileSync('git',['show','ef1cb54c66b45b930204391624a0014c69ed014e:src/app/mois-a-venir/applied-month-view.tsx'],{encoding:'utf8'}),{
  compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true},fileName:file}).outputText,file);
const current=require('@/app/mois-a-venir/applied-month-view').AppliedMonthView;
const {props,proof}=await persistedCase('C'),rows={before:[],after:[]},bytes={};
for(let i=0;i<22;i++)for(const [key,view] of i%2?[['after',current],['before',old.exports.AppliedMonthView]]:[['before',old.exports.AppliedMonthView],['after',current]]){
  const start=performance.now(),html=renderToStaticMarkup(React.createElement(view,props));
  if(i>=2)rows[key].push(+(performance.now()-start).toFixed(3));bytes[key]=Buffer.byteLength(html);
}
const summary=Object.fromEntries(Object.entries(rows).map(([k,v])=>{const sorted=[...v].sort((a,b)=>a-b);return[k,{n:v.length,p50:sorted[9],p95:sorted[18],htmlBytes:bytes[k]}];}));
const result={method:'Alternating SSR production React; C composite fixture; 2 warm-ups, 20 retained samples per view; no IO in render',reference:'ef1cb54',summary,samples:rows,
  worldReadsDuringScenario:proof.reads,additionalReadsDuringPresentation:0,newFinancialEvaluationsInPresentation:0,userLatency:'NOT_MEASURED'};
fs.writeFileSync('docs/status/evidence/b2-mois-a-venir-plan-ux/presentation-cost.json',JSON.stringify(result,null,2));console.log(JSON.stringify(summary));
