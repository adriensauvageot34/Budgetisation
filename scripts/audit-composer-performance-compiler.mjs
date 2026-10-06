// Paired pure-owner experiment, input snapshot must remain outside Git.
import fs from 'node:fs';
import path from 'node:path';
import Module from 'node:module';
import {performance} from 'node:perf_hooks';
import {createRequire} from 'node:module';
import {require} from './lib/phase2-ts-loader.mjs';
const [input,out]=process.argv.slice(2);if(!input||!out)throw new Error('PRIVATE_WORLD_AND_PUBLIC_OUTPUT_REQUIRED');
const {world,state,base,expected}=JSON.parse(fs.readFileSync(input,'utf8'));
globalThis.fetch=async()=>{throw new Error('COMPILER_BENCHMARK_NETWORK_FORBIDDEN');};
const ts=createRequire(import.meta.url)('typescript'),sourceFile=path.resolve('src/server/phase2/planner/preview.ts'),source=fs.readFileSync(sourceFile,'utf8');
function load(code,name){const filename=path.join(path.dirname(sourceFile),name+'.js'),m=new Module(filename);m.filename=filename;m.paths=Module._nodeModulePaths(path.dirname(filename));m._compile(ts.transpileModule(code,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,filename);return m.exports.evaluatePlanScenario;}
const baseline=load(source,'audit-baseline'),variant=load(source.replace('const baselineCompiled = compileSemanticPlan(', 'const baselineCompiled = state.controls.length===0 && state.contexts.length===0 ? compiled : compileSemanticPlan(').replace('baselineScenario = deriveCompiledMonthScenario(world, baselineCompiled);','baselineScenario = baselineCompiled === compiled ? scenario : deriveCompiledMonthScenario(world, baselineCompiled);'),'audit-variant');
let counts;
for(const [name,mod]of [['compile',require('@/server/phase2/planner/compiler')],['derive',require('@/server/phase2/month-scenario')]]){
 const key=name==='compile'?'compileSemanticPlan':'deriveMonthScenario',fn=mod[key];mod[key]=function(...args){if(counts)counts[name]=(counts[name]??0)+1;return fn.apply(this,args);};
}
const digest=r=>({manifest:r.compiledManifestDigest,projection:r.projectionDigest,semantic:r.semanticStateDigest});
const first=baseline(world,state,base);if(JSON.stringify(digest(first))!==JSON.stringify(expected))throw new Error('WORLD_ROUNDTRIP_PARITY_FAILED');
const rows=[];
for(let run=1;run<=5;run++)for(const name of run%2?['baseline','neutral-reuse']:['neutral-reuse','baseline']){
 counts={};const start=performance.now(),cpuStart=process.cpuUsage(),result=(name==='baseline'?baseline:variant)(world,state,base),cpu=process.cpuUsage(cpuStart);
 const parity=JSON.stringify(digest(result))===JSON.stringify(expected);rows.push({run,variant:name,duration:performance.now()-start,cpuMs:(cpu.user+cpu.system)/1000,counts,parity});if(!parity)throw new Error('COMPILER_VARIANT_PARITY_FAILED');
}
fs.writeFileSync(out,JSON.stringify({rows,parity:true,remoteRequests:0,scope:'EMPTY_SEMANTIC_STATE_ONLY'},null,2));console.log(JSON.stringify({rows,parity:true}));
